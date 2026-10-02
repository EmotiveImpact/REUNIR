import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database, SQL } from '../../../packages/db/src/connection';
export interface Mail { to: string; subject: string; text: string }
export interface MailTransport { send(mail: Mail, idempotencyKey: string): Promise<void> }
/** Encrypted durable outbox. Never put reset or invitation links into logs. */
export class MailQueue {
    private readonly key: Buffer;
    constructor(readonly db: Database, secret: string, readonly transport?: MailTransport) {
        if (secret.length<32) throw new Error('Mail encryption secret must contain at least 32 characters.');
        this.key=createHash('sha256').update('reunir-email-v1\0'+secret).digest();
    }
    seal(mail: Mail) {
        const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',this.key,iv);
        const data=Buffer.concat([cipher.update(JSON.stringify(mail),'utf8'),cipher.final()]);
        return [iv,cipher.getAuthTag(),data].map(x=>x.toString('base64url')).join('.');
    }
    open(value:string):Mail {
        const [iv,tag,bytes]=value.split('.').map(x=>Buffer.from(x,'base64url'));
        const c=createDecipheriv('aes-256-gcm',this.key,iv);c.setAuthTag(tag);
        return JSON.parse(Buffer.concat([c.update(bytes),c.final()]).toString('utf8'));
    }
    async enqueue(mail:Mail, sql:SQL=this.db, organizationId:string|null=null, invitationId:string|null=null) {
        const id=randomUUID();
        await sql.query('INSERT INTO email_outbox(id,organization_id,invitation_id,payload) VALUES($1,$2,$3,$4)',[id,organizationId,invitationId,this.seal(mail)]);
        return id;
    }

    async drain(limit=20, maxMilliseconds=18000) {
        if(!Number.isInteger(limit) || limit<1 || limit>50)throw new Error('Mail batch must be an integer from 1 to 50.');
        if(!Number.isFinite(maxMilliseconds) || maxMilliseconds<1 || maxMilliseconds>120000)throw new Error('Invalid mail execution budget.');
        const started=Date.now();
        await this.db.query(`INSERT INTO service_observations(name,state,last_attempt_at) VALUES('mail-worker',$1,now())
            ON CONFLICT(name) DO UPDATE SET state=EXCLUDED.state,last_attempt_at=EXCLUDED.last_attempt_at`,[this.transport ? 'running' : 'unconfigured']);
        if(!this.transport)return {configured:false,sent:0,failed:0};
        let sent=0,failed=0;
        try {
            const exhausted=await this.db.query("UPDATE email_outbox SET status='failed',lease_until=NULL,lease_token=NULL,last_error='DELIVERY_UNCERTAIN' WHERE attempts>=5 AND ((status='sending' AND lease_until<now()) OR status='queued') RETURNING id");
            failed+=exhausted.rows.length;
            for(let i=0;i<limit && Date.now()-started<maxMilliseconds;i++) {
                const lease=randomUUID();
                const row=await this.db.transaction(async sql=>{
                    const found=await sql.query<{id:string;payload:string;attempts:number}>(`SELECT id,payload,attempts FROM email_outbox
                        WHERE (status='queued' AND available_at<=now()) OR (status='sending' AND lease_until<now())
                        ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`);
                    const r=found.rows[0];if(!r)return null;
                    await sql.query("UPDATE email_outbox SET status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes',lease_token=$2 WHERE id=$1",[r.id,lease]);
                    return r;
                });
                if(!row)break;
                try {
                    // Stable provider idempotency key prevents duplicates during uncertain delivery.
                    await this.transport.send(this.open(row.payload),row.id);
                    const accepted=await this.db.query("UPDATE email_outbox SET status='sent',sent_at=now(),lease_until=NULL,lease_token=NULL,payload='',last_error=NULL WHERE id=$1 AND status='sending' AND lease_token=$2 RETURNING id",[row.id,lease]);
                    sent+=accepted.rows.length;
                } catch {
                    const dead=row.attempts+1>=5;
                    const changed=await this.db.query("UPDATE email_outbox SET status=$3,lease_until=NULL,lease_token=NULL,available_at=now()+interval '2 minutes',last_error='DELIVERY_FAILED' WHERE id=$1 AND status='sending' AND lease_token=$2 RETURNING id",[row.id,lease,dead?'failed':'queued']);
                    failed+=changed.rows.length;
                }
            }
            await this.db.query("UPDATE service_observations SET state=$1,last_success_at=CASE WHEN $1='ok' THEN now() ELSE last_success_at END WHERE name='mail-worker'",[failed?'error':'ok']);
        } catch(e) {
            await this.db.query("UPDATE service_observations SET state='error' WHERE name='mail-worker'").catch(()=>{});
            throw e;
        }
        return {configured:true,sent,failed};
    }

}
export function resendTransport(apiKey?:string, from?:string):MailTransport|undefined {
    if(!apiKey||!from)return undefined;
    return {send:async (mail,key)=>{
        const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from,to:[mail.to],subject:mail.subject,text:mail.text}),signal:AbortSignal.timeout(8000)});
        if(!r.ok)throw new Error('DELIVERY_FAILED');
    }};
}
