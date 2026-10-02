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
    const names=['service_observations','invitations','email_outbox','conversations','messages','message_receipts','message_reports','member_blocks','organisations', ...tables.map(t=>t.table),'command_receipts','request_limits','upload_intents','auth_user','auth_session','auth_account','auth_verification','auth_rate_limit'];
    await sql.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await sql.query(`GRANT USAGE,SELECT ON SEQUENCE messages_sequence_seq TO ${role}`);
    await sql.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${names.join(',')} TO ${role}`);
    await sql.query(`REVOKE UPDATE,DELETE ON lesson_revisions FROM ${role}`);
    // Knowledge-check attempts are evidence: never deleted, and only review columns can change after submission.
    await sql.query(`REVOKE UPDATE,DELETE ON quiz_attempts FROM ${role}`);
    await sql.query(`GRANT UPDATE (results,score,passed,status,feedback,reviewer_id,reviewed_at,version) ON quiz_attempts TO ${role}`);
}
