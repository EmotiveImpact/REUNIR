import type { SQL } from './connection';
/** Reject role capabilities that could bypass RLS, even with NOINHERIT + SET ROLE. */
export async function runtimeRoleIsSafe(sql: SQL): Promise<boolean> {
    const r = await sql.query<{unsafe:boolean}>(`SELECT (r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole
      OR EXISTS (SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND d.datdba=r.oid)
      OR has_schema_privilege(current_user,'public','CREATE')
      OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proowner=r.oid AND n.nspname='public')
      OR EXISTS (SELECT 1 FROM pg_auth_members am WHERE am.member=r.oid)
      OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relowner=r.oid AND n.nspname='public')
      OR EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname='public' AND n.nspowner=r.oid)) AS unsafe
      FROM pg_roles r WHERE r.rolname=current_user`);
    return r.rows.length === 1 && r.rows[0].unsafe === false;
}
export async function requireSafeRuntimeRole(sql: SQL): Promise<void> {
    if(!await runtimeRoleIsSafe(sql))throw new Error('Production DATABASE_URL must use a dedicated, non-owner, non-member NOBYPASSRLS application role.');
}
