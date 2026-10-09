import { tables } from './tables';
import type { SQL } from './connection';
/** Explicit grants, not ALL TABLES/default privileges. Never grants schema ownership. */
export async function grantRuntimeTables(sql: SQL): Promise<void> {
    const role = 'reunir_app';
    const flags = await sql.query<{rolsuper:boolean;rolbypassrls:boolean;rolcreatedb:boolean;rolcreaterole:boolean}>(
        'SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1', [role]);
    if (!flags.rows.length) throw new Error('Create reunir_app with db:runtime-role before upgrading its table permissions.');
    const f=flags.rows[0];
    if(f.rolsuper||f.rolbypassrls||f.rolcreatedb||f.rolcreaterole)throw new Error('Runtime role has elevated privileges; correct the role before granting table access.');
    const owned=await sql.query('SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname=$1 LIMIT 1',[role]);
    if(owned.rows.length)throw new Error('Runtime role must not own database objects.');
    const memberships=await sql.query('SELECT 1 FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE r.rolname=$1 LIMIT 1',[role]);
    if(memberships.rows.length)throw new Error('Runtime role must not inherit or assume other database roles.');
    const names=['service_observations','invitations','email_outbox','conversations','conversation_joins','messages','message_receipts','message_reports','member_blocks','organisations', ...tables.map(t=>t.table),'command_receipts','request_limits','upload_intents','upload_scans','auth_user','auth_session','auth_account','auth_verification','auth_rate_limit','auth_two_factor'];
    await sql.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await sql.query(`GRANT USAGE,SELECT ON SEQUENCE messages_sequence_seq TO ${role}`);
    await sql.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${names.join(',')} TO ${role}`);
    await sql.query(`REVOKE UPDATE,DELETE ON lesson_revisions FROM ${role}`);
    // Knowledge-check attempts are evidence: only review columns change after submission. Row security admits a delete only
    // of the acting member's own attempts while they delete their own account (migration 0015), never anyone else's.
    await sql.query(`REVOKE UPDATE ON quiz_attempts FROM ${role}`);
    await sql.query(`GRANT UPDATE (results,score,passed,status,feedback,reviewer_id,reviewed_at,version) ON quiz_attempts TO ${role}`);
    // Instructor grants are added or revoked, never rewritten.
    await sql.query(`REVOKE UPDATE ON track_instructors FROM ${role}`);
    // Library pictures are added or removed; only their name and tags change in place (migration 0038), never the picture.
    await sql.query(`REVOKE UPDATE ON cover_library FROM ${role}`);
    // Appeals: only the decision fields change after an appeal is made (migration 0031).
    await sql.query(`REVOKE UPDATE ON moderation_appeals FROM ${role}`);
    await sql.query(`GRANT UPDATE (status,decided_by,decided_at,response) ON moderation_appeals TO ${role}`);
    // Suspension appeals: only the decision fields change after an appeal is made (migration 0049). A message report's
    // reporter, sender, reason and reported words never change; its review and second look do.
    await sql.query(`REVOKE UPDATE ON suspension_appeals,message_reports FROM ${role}`);
    await sql.query(`GRANT UPDATE (status,decided_by,decided_at,response) ON suspension_appeals TO ${role}`);
    await sql.query(`GRANT UPDATE (message_id,status,reviewed_by,reviewed_at,second_look,second_look_at,first_reviewed_by) ON message_reports TO ${role}`);
    // Evidence history is kept: a change is never removed, and only its decision is recorded once.
    await sql.query(`REVOKE UPDATE,DELETE ON evidence_changes FROM ${role}`);
    await sql.query(`GRANT UPDATE (status,decided_by,decided_at,response) ON evidence_changes TO ${role}`);
    // A credit is answered or withdrawn; who, what and when it was offered never change.
    await sql.query(`REVOKE UPDATE ON contribution_credits FROM ${role}`);
    await sql.query(`GRANT UPDATE (status,responded_at,withdrawn_by,withdrawn_at) ON contribution_credits TO ${role}`);
    // Collections change their wording, status and editor in place, and items only their order and note. Who created a
    // collection, and what an item points at, never change.
    await sql.query(`REVOKE UPDATE ON collections,collection_items FROM ${role}`);
    await sql.query(`GRANT UPDATE (title,description,status,featured,updated_by,updated_at,published_at) ON collections TO ${role}`);
    await sql.query(`GRANT UPDATE (position,note) ON collection_items TO ${role}`);
    await sql.query(`GRANT UPDATE (label,tags) ON cover_library TO ${role}`);
    // A project team membership only ends or resumes; who and which project never change (migration 0048).
    await sql.query(`REVOKE UPDATE ON project_members FROM ${role}`);
    await sql.query(`GRANT UPDATE (left_at,removed_by) ON project_members TO ${role}`);
}
