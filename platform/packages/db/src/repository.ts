import { createHash, randomUUID } from 'node:crypto';
import { applyCommand, visibleWorkspace, actorFor } from '../../domain/src/engine';
import { DomainError, commandSchema, type Workspace, type TenantContext, type MutationResult } from '../../contracts/src/index';
import type { ResourceRef, ResourceUploadRequest } from '../../contracts/src/lesson-resources';
import { beginResourceUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload, type StoredObservation } from '../../domain/src/resources';
import { beginCoverLibraryUpload, beginCoverUpload, completeCoverUpload, removeCoverLibraryItem, resolveCoverImage, resolveLibraryPicture, type CoverObservation } from '../../domain/src/covers';
import type { CoverLibraryUploadRequest, CoverSubject, CoverUploadRequest } from '../../contracts/src/covers';
import { learningRecord } from '../../domain/src/learning-record';
import { tables, type TableSpec, type CollectionKey } from './tables';
import type { Database, SQL } from './connection';
const slugPattern = /^[a-z0-9][a-z0-9-]{0,99}$/;
const limitPerTable = 5000;
function context(organizationId: string, userId: string, requestId: string = randomUUID()): TenantContext { return { organizationId, userId, requestId }; }
export async function setContext(sql: SQL, organizationId: string, userId: string) { await sql.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)", [organizationId, userId]); }
function decode(row: Record<string, unknown>, spec: TableSpec) { return Object.fromEntries(spec.fields.map(f => [f.property, row[f.column] instanceof Date ? (row[f.column] as Date).toISOString() : row[f.column]])); }
async function putRow(sql: SQL, spec: TableSpec, row: Record<string, unknown>, existing = false) {
    const columns = spec.fields.map(f => f.column);
    const params = spec.fields.map(f => f.type === 'jsonb' && row[f.property] != null ? JSON.stringify(row[f.property]) : row[f.property] ?? null);
    if (spec.mutable) {
        // Append-only evidence: inserts are plain, and later writes may only touch the declared review columns.
        if (!existing) {
            await sql.query(`INSERT INTO ${spec.table} (${columns.join(',')}) VALUES (${params.map((_, i) => '$' + (i + 1)).join(',')})`, params);
            return;
        }
        const fields = spec.fields.filter(f => spec.mutable!.includes(f.property));
        // A record with no mutable properties is added or deleted, never changed in place.
        if (!fields.length) throw new Error(`${spec.table} rows cannot be changed in place.`);
        const values = fields.map(f => f.type === 'jsonb' && row[f.property] != null ? JSON.stringify(row[f.property]) : row[f.property] ?? null);
        await sql.query(`UPDATE ${spec.table} SET ${fields.map((f, i) => `${f.column}=$${i + 3}`).join(',')} WHERE organization_id=$1 AND id=$2`, [row.organizationId, row.id, ...values]);
        return;
    }
    const updates = columns.filter(c => !['id', 'organization_id'].includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(',');
    if(spec.table==='lesson_revisions') {
        await sql.query(`INSERT INTO ${spec.table} (${columns.join(',')}) VALUES (${params.map((_, i) => '$' + (i + 1)).join(',')})`,params);
        return;
    }
    await sql.query(`INSERT INTO ${spec.table} (${columns.join(',')}) VALUES (${params.map((_, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(organization_id,id) DO UPDATE SET ${updates}`, params);
}
async function readAll(sql: SQL, organisation: Record<string, unknown>): Promise<Workspace> {
    const state = { organisation: { id: organisation.id, slug: organisation.slug, name: organisation.name, tagline: organisation.tagline, accent: organisation.accent, createdAt: organisation.created_at instanceof Date ? organisation.created_at.toISOString() : organisation.created_at }, revision: organisation.revision } as Workspace;
    let total = 0;
    for (const spec of tables) {
        const rows = await sql.query(`SELECT ${spec.fields.map(f => f.column).join(',')} FROM ${spec.table} WHERE organization_id=$1${spec.where ? ' AND ' + spec.where : ''} ORDER BY created_at,id LIMIT $2`, [organisation.id, limitPerTable + 1]);
        total += rows.rows.length;
        if (rows.rows.length > limitPerTable || total > 20000)
            throw new DomainError('WORKSPACE_LIMIT', 'This community needs the paginated workspace release before it can grow further.', 503);
        (state as unknown as Record<string, unknown>)[spec.key] = rows.rows.map(r => decode(r, spec));
    }
    return state;
}
async function saveChanges(sql: SQL, before: Workspace, after: Workspace) {
    // Delete children before parents. Insert parents before children. Only actual diffs are written.
    for (const spec of [...tables].reverse()) {
        const remaining = new Set(after[spec.key].map(r => r.id));
        for (const old of before[spec.key])
            if (!remaining.has(old.id))
                await sql.query(`DELETE FROM ${spec.table} WHERE organization_id=$1 AND id=$2`, [before.organisation.id, old.id]);
    }
    for (const spec of tables) {
        const old = new Map(before[spec.key].map(r => [r.id, JSON.stringify(r)]));
        for (const row of after[spec.key])
            if (JSON.stringify(row) !== old.get(row.id))
                await putRow(sql, spec, row as unknown as Record<string, unknown>, old.has(row.id));
    }
    await sql.query('UPDATE organisations SET name=$2,tagline=$3,accent=$4,revision=$5 WHERE id=$1', [after.organisation.id, after.organisation.name, after.organisation.tagline, after.organisation.accent, after.revision]);
}
export class WorkspaceRepository {
    constructor(readonly db: Database) { }
    async memberships(userId: string) { return this.db.transaction(async (sql) => { await setContext(sql, '', userId); return (await sql.query<{
        slug: string;
        name: string;
    }>('SELECT o.slug,o.name FROM organisations o JOIN members m ON m.organization_id=o.id WHERE m.user_id=$1 AND m.status=$2 ORDER BY o.name', [userId, 'active'])).rows; }); }
    async within<T>(slug: string, userId: string, write: boolean, fn: (sql: SQL, org: Record<string, unknown>) => Promise<T>) {
        if (!slugPattern.test(slug))
            throw new DomainError('NOT_FOUND', 'Community not found.', 404);
        return this.db.transaction(async (sql) => {
            await setContext(sql, '', userId);
            const found = await sql.query('SELECT o.* FROM organisations o WHERE o.slug=$1 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=o.id AND m.user_id=$2 AND m.status=$3)', [slug, userId, 'active']);
            if (!found.rows[0])
                throw new DomainError('NOT_FOUND', 'Community not found.', 404);
            const orgId = String(found.rows[0].id);
            await setContext(sql, orgId, userId);
            // A per-community lock serialises this bounded alpha. No locking of unrelated tenants.
            const locked = await sql.query('SELECT * FROM organisations WHERE id=$1' + (write ? ' FOR UPDATE' : ' FOR SHARE'), [orgId]);
            if (!locked.rows[0])
                throw new DomainError('NOT_FOUND', 'Community not found.', 404);
            // Membership may have changed while this transaction waited for the lock.
            const active = await sql.query("SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'", [orgId,userId]);
            if(!active.rows.length) throw new DomainError('NOT_FOUND','Community not found.',404);
            return fn(sql, locked.rows[0]);
        });
    }
    async snapshot(slug: string, userId: string) { return this.within(slug, userId, false, async (sql, org) => visibleWorkspace(await readAll(sql, org), context(String(org.id), userId))); }
    async execute(slug: string, userId: string, raw: unknown, key: string, requestId: string): Promise<MutationResult> {
        const command = commandSchema.parse(raw);
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
            throw new DomainError('INVALID_KEY', 'Use a valid idempotency key.');
        const digest = createHash('sha256').update(JSON.stringify(command)).digest('hex');
        return this.within(slug, userId, true, async (sql, org) => {
            const orgId = String(org.id), ctx = context(orgId, userId, requestId);
            const before = await readAll(sql, org);
            actorFor(before, ctx);
            const old = await sql.query<{
                body_hash: string;
                result: {
                    message: string;
                    objectId?: string;
                };
            }>('SELECT body_hash,result FROM command_receipts WHERE organization_id=$1 AND user_id=$2 AND request_key=$3', [orgId, userId, key]);
            if (old.rows[0]) {
                if (old.rows[0].body_hash !== digest)
                    throw new DomainError('KEY_REUSED', 'This request key was already used for a different action.', 409);
                return { ...old.rows[0].result, workspace: visibleWorkspace(before, ctx) };
            }
            const result = applyCommand(before, ctx, command);
            await saveChanges(sql, before, result.workspace);
            await sql.query('INSERT INTO command_receipts(organization_id,user_id,request_key,body_hash,result) VALUES ($1,$2,$3,$4,$5)', [orgId, userId, key, digest, JSON.stringify({ message: result.message, objectId: result.objectId })]);
            return { ...result, workspace: visibleWorkspace(result.workspace, ctx) };
        });
    }
    async consumeRateLimit(key: string, max = 100, seconds = 60) {
        // Atomic PostgreSQL counter: survives serverless instance changes and does not need Redis.
        const r = await this.db.query<{
            count: number;
        }>(`INSERT INTO request_limits(key,count,window_start) VALUES ($1,1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.window_start<now()-($2*interval '1 second') THEN 1 ELSE request_limits.count+1 END,window_start=CASE WHEN request_limits.window_start<now()-($2*interval '1 second') THEN now() ELSE request_limits.window_start END RETURNING count`, [key, seconds]);
        return r.rows[0].count <= max;
    }
    async seed(state: Workspace) {
        if (process.env.NODE_ENV === 'production')
            throw new Error('Fictional fixture seeding is forbidden in production.');
        await this.insertWorkspace(state);
    }
    private async insertWorkspace(state: Workspace) { await this.db.transaction(async (sql) => { await setContext(sql, state.organisation.id, ''); const o = state.organisation; await sql.query('INSERT INTO organisations(id,slug,name,tagline,accent,created_at,revision) VALUES ($1,$2,$3,$4,$5,$6,$7)', [o.id, o.slug, o.name, o.tagline, o.accent, o.createdAt, state.revision]); for (const spec of tables)
        for (const row of state[spec.key])
            await putRow(sql, spec, row as unknown as Record<string, unknown>); }); }
    async createCommunity(user: {
        id: string;
        name: string;
    }, slug: string, name: string) {
        if (!slugPattern.test(slug) || name.length < 2 || name.length > 80)
            throw new Error('Invalid community name or slug.');
        const orgId = randomUUID(), now = new Date().toISOString();
        const state = { organisation: { id: orgId, slug, name, tagline: 'Your people. Real progress.', accent: 'violet', createdAt: now }, revision: 0 } as Workspace;
        for (const spec of tables)
            (state as unknown as Record<string, unknown>)[spec.key] = [];
        state.members.push({ id: randomUUID(), organizationId: orgId, createdAt: now, userId: user.id, name: user.name, headline: 'Community owner', bio: '', skills: [], colour: 'violet', avatar: '', role: 'owner', status: 'active' });
        state.spaces.push({ id: randomUUID(), organizationId: orgId, createdAt: now, name: 'Community', slug: 'community', description: 'A place to begin the conversation.', colour: 'violet', kind: 'discussion', visibility: 'members' });
        await this.insertWorkspace(state);
        return orgId;
    }
    async addMembership(slug: string, user: {
        id: string;
        name: string;
    }, role: 'member' | 'admin' | 'moderator' = 'member', organisationId?: string) {
        // Administrative CLI only; never an exposed HTTP route. Uses the migration connection.
        return this.db.transaction(async (sql) => { if (organisationId)
            await setContext(sql, organisationId, ''); const rows = await sql.query('SELECT id FROM organisations WHERE slug=$1', [slug]); if (!rows.rows[0])
            throw new Error('Community not found.'); const orgId = String(rows.rows[0].id); await setContext(sql, orgId, user.id); await sql.query('SELECT id FROM organisations WHERE id=$1 FOR UPDATE', [orgId]); await putRow(sql, tables[0], { id: randomUUID(), organizationId: orgId, createdAt: new Date().toISOString(), userId: user.id, name: user.name, headline: '', bio: '', skills: [], colour: 'violet', avatar: '', role, status: 'active' }); await sql.query('UPDATE organisations SET revision=revision+1 WHERE id=$1', [orgId]); });
    }
    async createUploadIntent(slug: string, userId: string, intent: {
        id: string;
        objectKey: string;
        contentType: string;
        sizeBytes: number;
        originalName: string;
    }) {
        return this.within(slug, userId, true, async (sql, org) => { await sql.query('INSERT INTO upload_intents(organization_id,id,user_id,object_key,content_type,size_bytes,original_name,created_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8)', [org.id, intent.id, userId, intent.objectKey, intent.contentType, intent.sizeBytes, intent.originalName, 'pending']); return String(org.id); });
    }
    async uploadIntent(slug: string, userId: string, id: string) { return this.within(slug, userId, false, async (sql, org) => { const rows = await sql.query('SELECT * FROM upload_intents WHERE organization_id=$1 AND user_id=$2 AND id=$3', [org.id, userId, id]); if (!rows.rows[0])
        throw new DomainError('NOT_FOUND', 'File not found.', 404); return rows.rows[0]; }); }
    async markUpload(slug: string, userId: string, id: string, status: 'ready' | 'rejected') { return this.within(slug, userId, true, async (sql, org) => { const rows = await sql.query("UPDATE upload_intents SET status=$4 WHERE organization_id=$1 AND user_id=$2 AND id=$3 AND purpose='member' RETURNING id", [org.id, userId, id, status]); if (!rows.rows[0])
        throw new DomainError('NOT_FOUND', 'File not found.', 404); }); }
    /** Lesson files. Domain rules run inside the tenant transaction; storage calls happen outside it. */
    async beginResourceUpload(slug: string, userId: string, request: ResourceUploadRequest, key: (organizationId: string, id: string) => string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org), orgId = String(org.id), id = randomUUID();
            const result = beginResourceUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async completeResourceUpload(slug: string, userId: string, id: string, observed: StoredObservation, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org);
            const result = completeResourceUpload(before, context(String(org.id), userId, requestId), id, observed, new Date().toISOString());
            if (result.outcome !== 'unchanged') await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, outcome: result.outcome };
        });
    }
    async discardResourceUpload(slug: string, userId: string, id: string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org);
            const result = discardResourceUpload(before, context(String(org.id), userId, requestId), id, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { id: result.id, objectKey: result.objectKey };
        });
    }
    /** Cover images follow the same split: domain rules inside the tenant transaction, storage calls outside it. */
    async beginCoverUpload(slug: string, userId: string, request: CoverUploadRequest, key: (organizationId: string, id: string) => string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org), orgId = String(org.id), id = randomUUID();
            const result = beginCoverUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async completeCoverUpload(slug: string, userId: string, id: string, observed: CoverObservation, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org);
            const result = completeCoverUpload(before, context(String(org.id), userId, requestId), id, observed, new Date().toISOString());
            if (result.outcome !== 'unchanged') await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, outcome: result.outcome };
        });
    }
    /** Library pictures: only active owners and administrators add or remove them; every member may show one. */
    async beginCoverLibraryUpload(slug: string, userId: string, request: CoverLibraryUploadRequest, key: (organizationId: string, id: string) => string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org), orgId = String(org.id), id = randomUUID();
            const result = beginCoverLibraryUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async removeCoverLibraryItem(slug: string, userId: string, itemId: string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org);
            const result = removeCoverLibraryItem(before, context(String(org.id), userId, requestId), itemId, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { id: result.item.id, objectKey: result.objectKey };
        });
    }
    async coverLibraryPicture(slug: string, userId: string, itemId: string) {
        return this.within(slug, userId, false, async (sql, org) => {
            const { upload } = resolveLibraryPicture(await readAll(sql, org), context(String(org.id), userId), itemId);
            return { objectKey: upload.objectKey, generation: upload.generation!, contentType: upload.contentType, sizeBytes: upload.sizeBytes };
        });
    }
    async coverImage(slug: string, userId: string, kind: CoverSubject, subjectId: string, fileId: string) {
        return this.within(slug, userId, false, async (sql, org) => {
            const { upload } = resolveCoverImage(await readAll(sql, org), context(String(org.id), userId), kind, subjectId, fileId);
            return { objectKey: upload.objectKey, generation: upload.generation!, contentType: upload.contentType, sizeBytes: upload.sizeBytes };
        });
    }
    /** The acting member's own learning record, read inside their own tenant transaction. */
    async learningRecord(slug: string, userId: string) {
        return this.within(slug, userId, false, async (sql, org) => learningRecord(await readAll(sql, org), context(String(org.id), userId), new Date().toISOString()));
    }
    async resourceDownload(slug: string, userId: string, ref: ResourceRef) {
        return this.within(slug, userId, false, async (sql, org) => {
            const target = resolveResourceDownload(await readAll(sql, org), context(String(org.id), userId), ref);
            return { objectKey: target.upload.objectKey, generation: target.upload.generation, contentType: target.upload.contentType, filename: target.filename };
        });
    }
}
