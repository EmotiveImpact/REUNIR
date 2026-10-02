import { inspectConfiguration, type Environment } from './config';
import { manualPilotGates, RELEASE_VERSION, type PilotStatus, type PilotCheck } from '../../../packages/contracts/src/operations';
import { DomainError } from '../../../packages/contracts/src/index';
import { WorkspaceRepository } from '../../../packages/db/src/repository';
import { runtimeRoleIsSafe } from '../../../packages/db/src/runtime-safety';
const iso = (x:unknown):string|null => x ? new Date(String(x)).toISOString() : null;
/** Owner only, explicitly tenant-scoped aggregates. Never returns messages, goals, mail payloads or secrets. */
export class PilotOperations {
    constructor(readonly repository:WorkspaceRepository, readonly env:Environment) {}
    async snapshot(slug:string,userId:string):Promise<PilotStatus> {
        return this.repository.within(slug,userId,false,async(sql,org)=>{
            const who=await sql.query<{role:string}>('SELECT role FROM members WHERE organization_id=$1 AND user_id=$2 AND status=$3',[org.id,userId,'active']);
            if(who.rows[0]?.role!=='owner')throw new DomainError('FORBIDDEN','Only the community owner can inspect pilot operations.',403);
            const checks: PilotCheck[]=inspectConfiguration(this.env);
            const runtimeSafe=await runtimeRoleIsSafe(sql);
            checks.push({key:'runtime-role',title:'Database isolation role',state:runtimeSafe ? 'pass' : 'blocked',detail:runtimeSafe ? 'The connection does not own public database objects, bypass row policies or assume another role.' : 'This connection has administrative database privileges. Use a restricted runtime role for the pilot.'});
            const required=['purposes','paths','contributions','outcomes','invitations','conversations','email_outbox','service_observations'];
            const schema=await sql.query<{name:string;present:boolean}>('SELECT name,to_regclass(\'public.\'||name) IS NOT NULL AS present FROM unnest($1::text[]) AS name',[required]);
            const schemaReady=schema.rows.length===required.length && schema.rows.every(r=>r.present);
            checks.push({key:'runtime-schema',title:'Required schema present',state:schemaReady ? 'pass' : 'blocked',detail:schemaReady ? 'Required feature tables exist. Migration checksums require the separate administrative CLI check.' : 'Required tables are missing. Run the ordered migration and grant-runtime commands on staging.'});

            if(!schemaReady){
                const members=await sql.query<{members:number;moderators:number}>(`SELECT count(*)::int AS members,count(*) FILTER(WHERE role IN ('moderator','admin') AND user_id<>$2)::int AS moderators FROM members WHERE organization_id=$1 AND status='active'`,[org.id,userId]);
                checks.push(...manualPilotGates());
                return {version:RELEASE_VERSION,generatedAt:new Date().toISOString(),source:'server',checks,overall:'blocked',community:{activeMembers:members.rows[0].members,independentModerators:members.rows[0].moderators,purposes:null,paths:null,projects:null},delivery:{queued:null,sending:null,failed:null,oldestQueuedAt:null,lastSentAt:null,lastWorkerAt:null}};
            }
            const tally=await sql.query<{members:number;moderators:number;purposes:number;paths:number;projects:number}>(`SELECT
                (SELECT count(*)::int FROM members WHERE organization_id=$1 AND status='active') AS members,
                (SELECT count(*)::int FROM members WHERE organization_id=$1 AND status='active' AND role IN ('moderator','admin') AND user_id<>$2) AS moderators,
                (SELECT count(*)::int FROM purposes WHERE organization_id=$1 AND status='active') AS purposes,
                (SELECT count(*)::int FROM paths WHERE organization_id=$1 AND status='published') AS paths,
                (SELECT count(*)::int FROM projects WHERE organization_id=$1) AS projects`,[org.id,userId]);
            const t=tally.rows[0];
            checks.push({key:'moderation-cover',title:'Independent moderation cover',state:t.moderators ? 'pass' : 'warning',detail:t.moderators ? 'Another active member has an assigned moderator or administrator role.' : 'Appoint another trusted moderator before inviting a wider pilot.'});
            checks.push({key:'community-purpose',title:'What we are here to do',state:t.purposes ? 'pass' : 'warning',detail:t.purposes ? 'The community has at least one active purpose.' : 'Add one Become, Build or Achieve purpose. All three are not required.'});
            const email=await sql.query<{queued:number;sending:number;failed:number;oldest:unknown;lastsent:unknown}>(`SELECT
                count(*) FILTER(WHERE status='queued')::int AS queued,
                count(*) FILTER(WHERE status='sending')::int AS sending,
                count(*) FILTER(WHERE status='failed')::int AS failed,
                min(created_at) FILTER(WHERE status='queued') AS oldest,
                max(sent_at) FILTER(WHERE status='sent') AS lastsent
                FROM email_outbox WHERE organization_id=$1`,[org.id]);
            const e=email.rows[0];
            const stale=e.oldest && Date.now()-new Date(String(e.oldest)).getTime()>15*60*1000;
            checks.push({key:'delivery-backlog',title:'Community invitation delivery',state:e.failed ? 'blocked' : stale ? 'warning' : 'pass',detail:e.failed ? 'This community has failed invitation jobs. Resolve the cause and issue new invitations deliberately.' : stale ? 'Invitations have been waiting more than 15 minutes. Check transport and schedule.' : 'No failed or old queued invitations were found in this community. This is not an inbox receipt.'});
            const observation=await sql.query<{last_attempt_at:unknown;last_success_at:unknown;state:string}>("SELECT last_attempt_at,last_success_at,state FROM service_observations WHERE name='mail-worker'");
            const worker=observation.rows[0],lastWorkerAt=iso(worker?.last_success_at);
            const fresh=lastWorkerAt!==null && Date.now()-new Date(lastWorkerAt).getTime()<15*60*1000;
            checks.push({key:'worker-heartbeat',title:'Mail worker observed',state:!worker ? 'unverified' : worker.state==='error'||worker.state==='unconfigured' ? 'blocked' : fresh ? 'pass' : 'warning',detail:!worker ? 'No worker run has been observed. A configured secret does not start a schedule.' : worker.state==='error' ? 'The last observed worker run had delivery errors. Check provider logs without copying tokens into reports.' : worker.state==='unconfigured' ? 'A worker ran without an email transport.' : fresh ? 'A successful worker poll was observed within the last 15 minutes. This does not prove ongoing scheduling or inbox delivery.' : 'No recent successful worker poll is recorded. Check the scheduler.'});
            checks.push(...manualPilotGates());
            return {version:RELEASE_VERSION,generatedAt:new Date().toISOString(),source:'server',checks,overall:checks.some(c=>c.state==='blocked')?'blocked':'needs-verification',community:{activeMembers:t.members,independentModerators:t.moderators,purposes:t.purposes,paths:t.paths,projects:t.projects},delivery:{queued:email.rows[0].queued,sending:email.rows[0].sending,failed:email.rows[0].failed,oldestQueuedAt:iso(email.rows[0].oldest),lastSentAt:iso(email.rows[0].lastsent),lastWorkerAt}};
        });
    }
}
