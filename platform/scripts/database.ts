import './env';
import { openDatabase } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository } from '../packages/db/src/repository';
import { createSeed } from '../packages/domain/src/seed';
import { createAuth } from '../apps/api/src/auth';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { googleStorage, isMissingObject } from '../apps/api/src/storage';
const action = process.argv[2];
if (!['migrate', 'seed', 'owner', 'member', 'runtime-role', 'grant-runtime', 'check', 'erase-learner', 'prune-covers'].includes(action))
    throw new Error('Use migrate, seed, owner, member, runtime-role, grant-runtime, check, erase-learner or prune-covers. See docs/SETUP.md and docs/PILOT_OPERATIONS.md.');
const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url)
    throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL securely in the local environment.');
const db = await openDatabase(url);
const repo = new WorkspaceRepository(db);
function required(name: string) { const value = process.env[name]; if (!value)
    throw new Error(`Set ${name} in the local environment. Do not put credentials in source control.`); return value; }
try {
    if (action === 'migrate') {
        await migrate(db);
        console.log('Ordered migrations applied or already up to date. For an existing runtime role, now run db:grant-runtime using this migration connection.');
    }
    if (action === 'seed') {
        if (process.env.ALLOW_FICTIONAL_SEED !== 'yes' || process.env.NODE_ENV === 'production')
            throw new Error('Fictional seeding requires ALLOW_FICTIONAL_SEED=yes and a non-production database. Never seed customer data environments.');
        for (const slug of ['code-black', 'studio-north'])
            await repo.seed(createSeed(slug));
        console.log('Fictional research fixtures inserted. Browser demo mode does not need database seeding.');
    }
    if (action === 'owner' || action === 'member') {
        const slug = process.env.COMMUNITY_SLUG || 'code-black';
        const origin = required('APP_ORIGIN');
        const secret = required('BETTER_AUTH_SECRET');
        const email = required('BOOTSTRAP_EMAIL'), name = required('BOOTSTRAP_NAME'), password = required('BOOTSTRAP_PASSWORD');
        if (password.length < 12)
            throw new Error('Use at least twelve characters for the account password.');
        // Temporary factory is only used inside this administrative process; no signup server is opened.
        const auth = createAuth(db, origin, secret, true);
        const account = await auth.api.signUpEmail({ body: { email, name, password } });
        if (action === 'owner') {
            const id = await repo.createCommunity({ id: account.user.id, name: account.user.name }, slug, process.env.COMMUNITY_NAME || 'Code Black');
            console.log(`Empty community created: ${slug}. Organisation ID: ${id}. Save this ID for db:member.`);
        }
        else {
            await repo.addMembership(slug, { id: account.user.id, name: account.user.name }, 'member', required('COMMUNITY_ID'));
            console.log(`Member provisioned in ${slug}. Public signup remains disabled.`);
        }
        console.log('Clear BOOTSTRAP_PASSWORD from your environment after provisioning. No password has been printed.');
    }
    if (action === 'runtime-role') {
        if (db.kind !== 'postgres')
            throw new Error('Provision the production runtime role using the PostgreSQL migration connection.');
        const password = required('DB_RUNTIME_PASSWORD');
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(password))
            throw new Error('Generate DB_RUNTIME_PASSWORD with crypto.randomBytes(32).toString("base64url").');
        const name = 'reunir_app';
        const found = await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name]);
        if (found.rows.length)
            throw new Error('reunir_app already exists. No password or permissions have been changed.');
        await db.transaction(async (sql) => {
            await sql.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
            await grantRuntimeTables(sql);
        });
        console.log('Created reunir_app runtime role (database role: reunir_app). Set the pooled Neon URL for this role as the server DATABASE_URL. Keep the migration URL off the deployed server.');
    }
    if(action==='grant-runtime') {
        if(db.kind!=='postgres')throw new Error('Use the PostgreSQL migration connection for runtime grants.');
        await db.transaction(grantRuntimeTables);
        console.log('Existing reunir_app role granted only the current application tables. Password unchanged; migration history remains inaccessible.');
    }
    // Operator procedures. Both are dry runs unless explicitly confirmed, and both need an active owner who authorised them.
    if (action === 'erase-learner') {
        const slug = required('COMMUNITY_SLUG'), subject = required('MEMBER_USER_ID'), owner = required('AUTHORISED_BY'), reference = required('ERASURE_REFERENCE');
        const apply = process.env.ERASE === 'yes';
        const r = await repo.eraseLearnerAnswers(slug, owner, subject, reference, apply);
        console.log(apply
            ? `Erased ${r.attempts} knowledge-check attempts and ${r.notifications} feedback notices for that member in ${slug}. The audit entry records the reference and counts only.`
            : `Dry run: ${r.attempts} knowledge-check attempts and ${r.notifications} feedback notices would be erased for that member in ${slug}. Nothing was changed. Set ERASE=yes to erase.`);
    }
    if (action === 'prune-covers') {
        const slug = required('COMMUNITY_SLUG'), owner = required('AUTHORISED_BY');
        const stale = await repo.staleCoverUploads(slug, owner);
        if (process.env.PRUNE !== 'yes') {
            console.log(`Dry run: ${stale.length} cover, library or task uploads in ${slug} are unused and rejected or over an hour old. Nothing was changed. Set PRUNE=yes to delete them and their stored files.`);
            for (const u of stale) console.log(`  ${u.purpose} ${u.status} ${u.createdAt} ${u.objectKey}`);
        }
        else {
            const storage = googleStorage(required('GCS_BUCKET'), process.env.GCS_CREDENTIALS_JSON);
            const gone: string[] = [], kept: string[] = [];
            // Files first: a record is removed only once its stored file is gone, so nothing is left untracked.
            for (const u of stale) {
                try { await storage.remove(u.objectKey); gone.push(u.id); }
                catch (e) { if (isMissingObject(e)) gone.push(u.id); else kept.push(u.objectKey); }
            }
            const removed = await repo.removeStaleCoverUploads(slug, owner, gone);
            console.log(`Removed ${removed.length} unused cover, library or task uploads and their stored files.` + (kept.length ? ` ${kept.length} files could not be deleted, so their records were kept:\n  ${kept.join('\n  ')}` : ''));
        }
    }
    if (action === 'check') {
        const r = await db.query<{
            current_user: string;
        }>('SELECT current_user');
        console.log(`Database reachable; adapter=${db.kind}; role=${r.rows[0].current_user}.`);
        const a = await db.query('SELECT version,applied_at FROM schema_migrations ORDER BY version');
        console.log(JSON.stringify(a.rows, null, 2));
    }
}
catch (e) {
    console.error(e instanceof Error ? e.message : 'Database operation failed.');
    process.exitCode = 1;
}
finally {
    await db.close();
}
