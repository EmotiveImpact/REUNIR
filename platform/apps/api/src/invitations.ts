import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {DomainError} from '../../../packages/contracts/src/index';
import {WorkspaceRepository,setContext} from '../../../packages/db/src/repository';
import type {SQL} from '../../../packages/db/src/connection';
import {MailQueue} from './mail';
export const invitationEmail=z.string().trim().toLowerCase().email().max(254);
const tokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const hash=(token:string)=>createHash('sha256').update(tokenSchema.parse(token)).digest('hex');
interface Invitation {id:string;organization_id:string;email:string;token_hash:string;created_by:string;expires_at:Date|string;status:string;accepted_by:string|null}
function active(i:Invitation|undefined):asserts i is Invitation {
    if(!i||i.status!=='pending'||new Date(i.expires_at)<=new Date()) throw new DomainError('INVITE_UNAVAILABLE','This invitation has expired, was used or has been revoked.',410);
}
export class InvitationService {
    constructor(readonly repo:WorkspaceRepository,readonly origin:string,readonly mail:MailQueue){}
    private async administrator(sql:SQL,orgId:string,userId:string) {
        const m=await sql.query<{role:string}>("SELECT role FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'",[orgId,userId]);
        if(!['owner','admin'].includes(m.rows[0]?.role))throw new DomainError('FORBIDDEN','An administrator is required.',403);
    }
    private async log(sql:SQL,orgId:string,actorId:string,action:string,objectId:string) {
        await sql.query('INSERT INTO audit(organization_id,id,created_at,actor_id,action,object_id,metadata) VALUES($1,$2,now(),$3,$4,$5,$6)',[orgId,randomUUID(),actorId,action,objectId,'{}']);
    }
    async list(slug:string,userId:string) {
        return this.repo.within(slug,userId,false,async(sql,org)=>{await this.administrator(sql,String(org.id),userId);
            return (await sql.query(`SELECT i.id,i.email,i.status,i.created_at AS "createdAt",i.expires_at AS "expiresAt",i.accepted_at AS "acceptedAt",(SELECT e.status FROM email_outbox e WHERE e.invitation_id=i.id ORDER BY e.created_at DESC LIMIT 1) AS delivery FROM invitations i WHERE i.organization_id=$1 ORDER BY i.created_at DESC LIMIT 100`,[org.id])).rows;
        });
    }
    async create(slug:string,userId:string,email:string) {
        email=invitationEmail.parse(email);
        return this.repo.within(slug,userId,true,async(sql,org)=>{
            await this.administrator(sql,String(org.id),userId);
            const existing=await sql.query("SELECT m.status FROM members m JOIN auth_user a ON a.id=m.user_id WHERE m.organization_id=$1 AND lower(a.email)=$2",[org.id,email]);
            if(existing.rows.length)throw new DomainError('MEMBERSHIP_EXISTS','This person already has a membership. Manage their access instead.',409);
            // A resend deliberately rotates the bearer secret and cancels stale queued messages.
            const prior=await sql.query<{id:string}>("UPDATE invitations SET status='revoked' WHERE organization_id=$1 AND email=$2 AND status='pending' RETURNING id",[org.id,email]);
            for(const old of prior.rows)await sql.query("UPDATE email_outbox SET status='cancelled',payload='' WHERE invitation_id=$1 AND status IN ('queued','failed')",[old.id]);
            const token=randomBytes(32).toString('base64url'),id=randomUUID();
            await sql.query("INSERT INTO invitations(id,organization_id,email,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",[id,org.id,email,hash(token),userId]);
            const url=this.origin+'/#/invite?token='+token;
            await this.mail.enqueue({to:email,subject:`Your invitation to ${org.name} on REUNIR`,text:`You have been invited to ${org.name}.\n\nJoin your community: ${url}\n\nThis personal invitation expires in seven days and can be used once. Already have a REUNIR account? Sign in to accept it.\n\nIf you were not expecting this invitation, you can ignore this message.`},sql,String(org.id),id);
            await this.log(sql,String(org.id),userId,'invitation.created',id);
            return {id,url,delivery:'queued',emailConfigured:!!this.mail.transport};
        });
    }
    async revoke(slug:string,userId:string,id:string){return this.repo.within(slug,userId,true,async(sql,org)=>{
        await this.administrator(sql,String(org.id),userId);
        const r=await sql.query("UPDATE invitations SET status='revoked' WHERE organization_id=$1 AND id=$2 AND status='pending' RETURNING id",[org.id,id]);
        if(!r.rows.length)throw new DomainError('INVITE_UNAVAILABLE','This invitation is no longer pending.',409);
        await sql.query("UPDATE email_outbox SET status='cancelled',payload='' WHERE invitation_id=$1 AND status IN ('queued','failed')",[id]);
        await this.log(sql,String(org.id),userId,'invitation.revoked',id);return {ok:true};
    });}
    /** Token lookup reveals only the intended invitation, never general account existence. */
    async inspect(token:string){return this.repo.db.transaction(async sql=>{
        await sql.query("SELECT set_config('app.invitation_hash',$1,true)",[hash(token)]);
        const i=(await sql.query<Invitation>('SELECT * FROM invitations WHERE token_hash=$1',[hash(token)])).rows[0];active(i);
        await setContext(sql,i.organization_id,'');
        const o=(await sql.query<{slug:string;name:string}>('SELECT slug,name FROM organisations WHERE id=$1',[i.organization_id])).rows[0];
        const [local,domain]=i.email.split('@');
        return {community:o.name,slug:o.slug,emailHint:local[0]+'***@'+domain,expiresAt:i.expires_at};
    });}
    async registrationEmail(token:string){return this.repo.db.transaction(async sql=>{
        await sql.query("SELECT set_config('app.invitation_hash',$1,true)",[hash(token)]);
        const i=(await sql.query<Invitation>('SELECT * FROM invitations WHERE token_hash=$1',[hash(token)])).rows[0];active(i);return i.email;
    });}
    async accept(token:string,userId:string){return this.repo.db.transaction(async sql=>{
        const digest=hash(token); await sql.query("SELECT set_config('app.invitation_hash',$1,true)",[digest]);
        const initial=(await sql.query<Invitation>('SELECT * FROM invitations WHERE token_hash=$1',[digest])).rows[0];active(initial);
        await setContext(sql,initial.organization_id,userId);
        // Same locking order as account deletion and administration: account, organisation, then invitation. Holding the
        // account lock means a deletion under way finishes first (and the account is gone) or waits for this membership.
        const u=(await sql.query<{email:string;name:string}>('SELECT email,name FROM auth_user WHERE id=$1 FOR SHARE',[userId])).rows[0];
        const org=(await sql.query<{slug:string;name:string}>('SELECT slug,name FROM organisations WHERE id=$1 FOR UPDATE',[initial.organization_id])).rows[0];
        const i=(await sql.query<Invitation>('SELECT * FROM invitations WHERE id=$1 FOR UPDATE',[initial.id])).rows[0];active(i);
        if(!u||u.email.toLowerCase()!==i.email)throw new DomainError('INVITE_ACCOUNT_MISMATCH','Sign in with the email address this invitation was sent to.',403);
        const existing=await sql.query<{status:string}>('SELECT status FROM members WHERE organization_id=$1 AND user_id=$2',[i.organization_id,userId]);
        if(existing.rows[0]?.status && existing.rows[0].status!=='active')throw new DomainError('MEMBERSHIP_RESTRICTED','Ask the owner to review your community access.',403);
        if(!existing.rows.length)await sql.query(`INSERT INTO members(organization_id,id,created_at,user_id,name,headline,bio,skills,colour,avatar,role,status) VALUES($1,$2,now(),$3,$4,'','', '[]','violet','','member','active')`,[i.organization_id,randomUUID(),userId,u.name]);
        await sql.query("UPDATE invitations SET status='accepted',accepted_by=$2,accepted_at=now() WHERE id=$1",[i.id,userId]);
        await sql.query('UPDATE organisations SET revision=revision+1 WHERE id=$1',[i.organization_id]);
        await this.log(sql,i.organization_id,userId,'invitation.accepted',i.id);
        return {slug:org.slug,name:org.name};
    });}
}
