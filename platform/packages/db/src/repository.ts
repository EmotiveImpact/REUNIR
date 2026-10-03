import { createHash, randomUUID } from 'node:crypto';
import { applyCommand, visibleWorkspace, visibleRecords, actorFor, isAdmin } from '../../domain/src/engine';
import { pageOf } from '../../domain/src/pages';
import { cursorFor, pageQuery, readCursor, type Page, type PagedItems, type PagedList, type PageQuery } from '../../contracts/src/pages';
import { DomainError, commandSchema, type Workspace, type TenantContext, type MutationResult } from '../../contracts/src/index';
import type { ResourceRef, ResourceUploadRequest } from '../../contracts/src/lesson-resources';
import { beginResourceUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload, type StoredObservation } from '../../domain/src/resources';
import { releasedCoverKeys, beginCoverLibraryUpload, beginCoverUpload, completeCoverUpload, removeCoverLibraryItem, resolveCoverImage, resolveLibraryPicture, staleCoverUploads, type CoverObservation } from '../../domain/src/covers';
import type { CoverLibraryUploadRequest, CoverSubject, CoverUploadRequest } from '../../contracts/src/covers';
import { learningRecord } from '../../domain/src/learning-record';
import { eraseFromCommunity, PERSONAL_COLLECTIONS } from '../../domain/src/account-deletion';
import { ownerRefusal, type AccountDeletionSummary } from '../../contracts/src/account';
import type { OwnershipTransferResult } from '../../contracts/src/ownership';
import { transferOwnership } from '../../domain/src/ownership';
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
/** Audit entries a workspace read carries. The full trail is read a page at a time (`auditPage`). */
const AUDIT_READ = 100;
/**
 * The community's records for the domain rules. Write-only and personal histories are not read in full: the outbox not at
 * all, the audit trail only its newest entries, and, when `forUser` is given, only that person's own notices. Rules only
 * add to those collections, and `saveChanges` writes differences, so what is not read is never touched.
 */
async function readAll(sql: SQL, organisation: Record<string, unknown>, forUser?: string): Promise<Workspace> {
    const state = { organisation: { id: organisation.id, slug: organisation.slug, name: organisation.name, tagline: organisation.tagline, accent: organisation.accent, createdAt: organisation.created_at instanceof Date ? organisation.created_at.toISOString() : organisation.created_at }, revision: organisation.revision } as Workspace;
    let total = 0;
    for (const spec of tables) {
        if (spec.key === 'outbox') { state.outbox = []; continue; }
        const columns = spec.fields.map(f => f.column).join(','), where = `organization_id=$1${spec.where ? ' AND ' + spec.where : ''}`;
        if (spec.key === 'audit') {
            const recent = await sql.query(`SELECT ${columns} FROM audit WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT $2`, [organisation.id, AUDIT_READ]);
            state.audit = recent.rows.reverse().map(r => decode(r, spec)) as unknown as Workspace['audit'];
            continue;
        }
        const mine = spec.key === 'notifications' && forUser;
        const rows = await sql.query(`SELECT ${columns} FROM ${spec.table} WHERE ${where}${mine ? ' AND user_id=$3' : ''} ORDER BY created_at,id LIMIT $2`, mine ? [organisation.id, limitPerTable + 1, forUser] : [organisation.id, limitPerTable + 1]);
        total += rows.rows.length;
        if (rows.rows.length > limitPerTable || total > 20000)
            throw new DomainError('WORKSPACE_LIMIT', 'This community needs the paginated workspace release before it can grow further.', 503);
        (state as unknown as Record<string, unknown>)[spec.key] = rows.rows.map(r => decode(r, spec));
    }
    return state;
}
/** The browser's view. Administrators see the audit trail's true length, which a workspace read does not hold. */
async function view(sql: SQL, state: Workspace, ctx: TenantContext): Promise<Workspace> {
    const actor = state.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId);
    const auditTotal = actor && isAdmin(actor) ? (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM audit WHERE organization_id=$1', [ctx.organizationId])).rows[0].n : undefined;
    return visibleWorkspace(state, ctx, auditTotal);
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
        role: string;
    }>('SELECT o.slug,o.name,m.role FROM organisations o JOIN members m ON m.organization_id=o.id WHERE m.user_id=$1 AND m.status=$2 ORDER BY o.name', [userId, 'active'])).rows; }); }
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
    async snapshot(slug: string, userId: string) { return this.within(slug, userId, false, async (sql, org) => await view(sql, await readAll(sql, org, userId), context(String(org.id), userId))); }
    async execute(slug: string, userId: string, raw: unknown, key: string, requestId: string): Promise<MutationResult> {
        return (await this.executeCommand(slug, userId, raw, key, requestId)).result;
    }
    /** As `execute`, with the storage keys of cover pictures the change released, for the caller to remove after commit. */
    async executeCommand(slug: string, userId: string, raw: unknown, key: string, requestId: string): Promise<{ result: MutationResult; releasedFiles: string[] }> {
        const command = commandSchema.parse(raw);
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(key))
            throw new DomainError('INVALID_KEY', 'Use a valid idempotency key.');
        const digest = createHash('sha256').update(JSON.stringify(command)).digest('hex');
        return this.within(slug, userId, true, async (sql, org) => {
            const orgId = String(org.id), ctx = context(orgId, userId, requestId);
            const before = await readAll(sql, org, userId);
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
                return { result: { ...old.rows[0].result, workspace: await view(sql, before, ctx) }, releasedFiles: [] };
            }
            const result = applyCommand(before, ctx, command);
            await saveChanges(sql, before, result.workspace);
            await sql.query('INSERT INTO command_receipts(organization_id,user_id,request_key,body_hash,result) VALUES ($1,$2,$3,$4,$5)', [orgId, userId, key, digest, JSON.stringify({ message: result.message, objectId: result.objectId })]);
            return { result: { ...result, workspace: await view(sql, result.workspace, ctx) }, releasedFiles: releasedCoverKeys(before, result.workspace) };
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
            const before = await readAll(sql, org, userId), orgId = String(org.id), id = randomUUID();
            const result = beginResourceUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async completeResourceUpload(slug: string, userId: string, id: string, observed: StoredObservation, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId);
            const result = completeResourceUpload(before, context(String(org.id), userId, requestId), id, observed, new Date().toISOString());
            if (result.outcome !== 'unchanged') await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, outcome: result.outcome };
        });
    }
    async discardResourceUpload(slug: string, userId: string, id: string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId);
            const result = discardResourceUpload(before, context(String(org.id), userId, requestId), id, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { id: result.id, objectKey: result.objectKey };
        });
    }
    /** Cover images follow the same split: domain rules inside the tenant transaction, storage calls outside it. */
    async beginCoverUpload(slug: string, userId: string, request: CoverUploadRequest, key: (organizationId: string, id: string) => string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId), orgId = String(org.id), id = randomUUID();
            const result = beginCoverUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async completeCoverUpload(slug: string, userId: string, id: string, observed: CoverObservation, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId);
            const result = completeCoverUpload(before, context(String(org.id), userId, requestId), id, observed, new Date().toISOString());
            if (result.outcome !== 'unchanged') await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, outcome: result.outcome };
        });
    }
    /** Library pictures: only active owners and administrators add or remove them; every member may show one. */
    async beginCoverLibraryUpload(slug: string, userId: string, request: CoverLibraryUploadRequest, key: (organizationId: string, id: string) => string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId), orgId = String(org.id), id = randomUUID();
            const result = beginCoverLibraryUpload(before, context(orgId, userId, requestId), request, { id, objectKey: key(orgId, id) }, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { upload: result.upload, expired: result.expired };
        });
    }
    async removeCoverLibraryItem(slug: string, userId: string, itemId: string, requestId: string) {
        return this.within(slug, userId, true, async (sql, org) => {
            const before = await readAll(sql, org, userId);
            const result = removeCoverLibraryItem(before, context(String(org.id), userId, requestId), itemId, new Date().toISOString());
            await saveChanges(sql, before, result.workspace);
            return { id: result.item.id, objectKey: result.objectKey };
        });
    }
    async coverLibraryPicture(slug: string, userId: string, itemId: string) {
        return this.within(slug, userId, false, async (sql, org) => {
            const { upload } = resolveLibraryPicture(await readAll(sql, org, userId), context(String(org.id), userId), itemId);
            return { objectKey: upload.objectKey, generation: upload.generation!, contentType: upload.contentType, sizeBytes: upload.sizeBytes };
        });
    }
    async coverImage(slug: string, userId: string, kind: CoverSubject, subjectId: string, fileId: string) {
        return this.within(slug, userId, false, async (sql, org) => {
            const { upload } = resolveCoverImage(await readAll(sql, org, userId), context(String(org.id), userId), kind, subjectId, fileId);
            return { objectKey: upload.objectKey, generation: upload.generation!, contentType: upload.contentType, sizeBytes: upload.sizeBytes };
        });
    }
    /**
     * Operator procedures, for the migration connection only. Each runs inside the tenant transaction of an active owner
     * who authorised it, so forced row security still applies; the runtime role cannot delete attempts at all.
     */
    private async requireOwner(sql: SQL, organizationId: string, userId: string) {
        const found = await sql.query("SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active' AND role='owner'", [organizationId, userId]);
        if (!found.rows[0]) throw new DomainError('OWNER_REQUIRED', 'An active owner of this community must authorise this.', 403);
    }
    /** Erase one member's knowledge-check attempts and the feedback notices about them. Counts only unless `apply`. */
    async eraseLearnerAnswers(slug: string, authorisedBy: string, subjectUserId: string, reference: string, apply: boolean) {
        if (!/^[\w .:#/-]{3,80}$/.test(reference)) throw new DomainError('VALIDATION', 'Give the request a short reference, such as a ticket number.', 400);
        return this.within(slug, authorisedBy, apply, async (sql, org) => {
            const orgId = String(org.id);
            await this.requireOwner(sql, orgId, authorisedBy);
            if (!(await sql.query('SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2', [orgId, subjectUserId])).rows[0])
                throw new DomainError('NOT_FOUND', 'That person has no membership record in this community.', 404);
            await sql.query("SELECT set_config('app.erasure_subject',$1,true)", [subjectUserId]);
            const count = async (query: string) => (await sql.query<{ n: number }>(query, [orgId, subjectUserId])).rows[0].n;
            const feedback = "title='Feedback on your knowledge check'";
            const planned = { attempts: await count('SELECT count(*)::int AS n FROM quiz_attempts WHERE organization_id=$1 AND user_id=$2'), notifications: await count(`SELECT count(*)::int AS n FROM notifications WHERE organization_id=$1 AND user_id=$2 AND ${feedback}`) };
            if (!apply) return { ...planned, applied: false };
            const attempts = (await sql.query('DELETE FROM quiz_attempts WHERE organization_id=$1 AND user_id=$2 RETURNING id', [orgId, subjectUserId])).rows.length;
            // Row security would silently skip rows it does not admit; a partial erasure is refused and rolled back.
            if (attempts !== planned.attempts) throw new Error('Row security admitted only part of the erasure, so nothing was changed. Check the migration role and owner.');
            const notifications = (await sql.query(`DELETE FROM notifications WHERE organization_id=$1 AND user_id=$2 AND ${feedback} RETURNING id`, [orgId, subjectUserId])).rows.length;
            await sql.query('INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES($1,$2,now(),$3,$4,$5,$6)', [randomUUID(), orgId, authorisedBy, 'learner.answers.erased', subjectUserId, JSON.stringify({ reference, attempts, notifications })]);
            await sql.query('UPDATE organisations SET revision=revision+1 WHERE id=$1', [orgId]);
            return { attempts, notifications, applied: true };
        });
    }
    /** Cover and library uploads nothing shows or lists, rejected or over an hour old, with their storage keys. */
    async staleCoverUploads(slug: string, authorisedBy: string) {
        return this.within(slug, authorisedBy, false, async (sql, org) => {
            await this.requireOwner(sql, String(org.id), authorisedBy);
            return staleCoverUploads(await readAll(sql, org, authorisedBy), String(org.id), new Date().toISOString()).map(u => ({ id: u.id, objectKey: u.objectKey, purpose: u.purpose, status: u.status, createdAt: u.createdAt }));
        });
    }
    /** Delete the records of uploads whose stored files are gone, if they are still unused. Returns the IDs removed. */
    async removeStaleCoverUploads(slug: string, authorisedBy: string, ids: string[]) {
        return this.within(slug, authorisedBy, true, async (sql, org) => {
            const orgId = String(org.id);
            await this.requireOwner(sql, orgId, authorisedBy);
            const stale = new Set(staleCoverUploads(await readAll(sql, org, authorisedBy), orgId, new Date().toISOString()).map(u => u.id));
            const removable = ids.filter(id => stale.has(id));
            if (!removable.length) return [];
            const removed = (await sql.query<{ id: string }>('DELETE FROM upload_intents WHERE organization_id=$1 AND id = ANY($2::text[]) RETURNING id', [orgId, removable])).rows.map(r => r.id);
            await sql.query('INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES($1,$2,now(),$3,$4,$5,$6)', [randomUUID(), orgId, authorisedBy, 'cover.uploads.pruned', orgId, JSON.stringify({ removed: removed.length })]);
            return removed;
        });
    }
    /**
     * Delete the acting person's account, in one transaction across every community they belong to. Each membership is
     * scrubbed to "Former member" and kept, with their posts, comments and project work; their own records go; their
     * sign-in, sessions and email address go. Owners are refused. The transaction is marked as their own account
     * deletion, which is all that the policies in migrations 0015 and 0016 admit. Returns counts and the storage keys of their
     * private files, which the caller removes once this has committed.
     */
    async deleteAccount(userId: string, forgetMail?: (sql: SQL, email: string) => Promise<number>): Promise<{ summary: AccountDeletionSummary; files: string[] }> {
        return this.db.transaction(async (sql) => {
            await setContext(sql, '', userId);
            await sql.query("SELECT set_config('app.account_deletion',$1,true)", [userId]);
            // Locking the account first serialises a repeated request: the second finds nothing left to delete.
            const account = (await sql.query<{ email: string }>('SELECT email FROM auth_user WHERE id=$1 FOR UPDATE', [userId])).rows[0];
            if (!account) throw new DomainError('NOT_FOUND', 'This account no longer exists.', 404);
            const memberships = (await sql.query<{ organization_id: string; role: string }>('SELECT organization_id,role FROM members WHERE user_id=$1 ORDER BY organization_id', [userId])).rows;
            const owned: string[] = [];
            for (const m of memberships.filter(x => x.role === 'owner')) {
                await setContext(sql, m.organization_id, userId);
                owned.push(String((await sql.query<{ name: string }>('SELECT name FROM organisations WHERE id=$1', [m.organization_id])).rows[0]?.name ?? 'a community'));
            }
            if (owned.length) throw new DomainError('OWNER_CANNOT_DELETE', ownerRefusal(owned), 409);
            const now = new Date().toISOString(), removed: Record<string, number> = {}, files: string[] = [];
            const add = (key: string, n: number) => { if (n) removed[key] = (removed[key] ?? 0) + n; };
            const drop = async (key: string, query: string, params: unknown[]) => { const r = await sql.query<Record<string, unknown>>(query, params); add(key, r.rows.length); return r.rows; };
            let releasedTasks = 0, rewordedNotices = 0;
            // Communities are locked in a fixed order, so two deletions never wait on each other in a cycle.
            for (const { organization_id: orgId } of memberships) {
                await setContext(sql, orgId, userId);
                const org = (await sql.query('SELECT * FROM organisations WHERE id=$1 FOR UPDATE', [orgId])).rows[0];
                if (!org) throw new Error('A community could not be locked for account deletion, so nothing was changed.');
                const before = await readAll(sql, org);
                const erasure = eraseFromCommunity(before, userId, now, randomUUID), after = erasure.workspace;
                // 1. While the membership is still current: notices lose the name, and claimed tasks without proof go back to
                // their teams. The tasks are released directly, so this works where the person was suspended too (0018).
                const staged = structuredClone(before), reworded = new Map(after.notifications.map(n => [n.id, n]));
                staged.notifications = before.notifications.map(n => reworded.get(n.id) ?? n);
                await saveChanges(sql, before, staged);
                const claimed = "FROM project_tasks WHERE organization_id=$1 AND assignee_id=$2 AND contribution_id IS NULL AND NOT archived";
                const tasks = (await sql.query<{ id: string }>(`SELECT id ${claimed} ORDER BY id FOR UPDATE`, [orgId, userId])).rows.map(r => r.id);
                if (tasks.length !== erasure.releasedTasks) throw new Error('Row security admitted only part of the deletion (project_tasks), so nothing was changed.');
                // The released tasks are named for the 0018 read policy, which must still admit each row once it is unassigned.
                await sql.query("SELECT set_config('app.released_tasks',$1,true)", [tasks.join(',')]);
                if (tasks.length) await sql.query("UPDATE project_tasks SET assignee_id=NULL,work_state='todo',version=version+1,updated_at=$3 WHERE organization_id=$1 AND id = ANY($2::text[])", [orgId, tasks, now]);
                if ((await sql.query(`SELECT id ${claimed}`, [orgId, userId])).rows.length) throw new Error('Row security admitted only part of the deletion (project_tasks), so nothing was changed.');
                // 2. Their own records. Row security silently skips rows it does not admit, so a shortfall is refused.
                for (const key of PERSONAL_COLLECTIONS) {
                    const spec = tables.find(t => t.key === key)!;
                    const gone = (await sql.query(`DELETE FROM ${spec.table} WHERE organization_id=$1 AND user_id=$2 RETURNING id`, [orgId, userId])).rows.length;
                    if (gone !== erasure.removed[key]) throw new Error(`Row security admitted only part of the deletion (${spec.table}), so nothing was changed.`);
                    add(key, gone);
                }
                await drop('messageReceipts', 'DELETE FROM message_receipts WHERE organization_id=$1 AND user_id=$2 RETURNING conversation_id', [orgId, userId]);
                await drop('memberBlocks', 'DELETE FROM member_blocks WHERE organization_id=$1 AND user_id=$2 RETURNING blocked_user_id', [orgId, userId]);
                await drop('commandReceipts', 'DELETE FROM command_receipts WHERE organization_id=$1 AND user_id=$2 RETURNING request_key', [orgId, userId]);
                files.push(...(await drop('privateFiles', "DELETE FROM upload_intents WHERE organization_id=$1 AND user_id=$2 AND purpose='member' RETURNING object_key", [orgId, userId])).map(r => String(r.object_key)));
                // 3. The audit entry, then the scrub as the last write: later policies would no longer see an active member.
                const entry = after.audit.at(-1)!, member = after.members.find(m => m.userId === userId)!;
                await sql.query('INSERT INTO audit(id,organization_id,created_at,actor_id,action,object_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7)', [entry.id, orgId, entry.createdAt, entry.actorId, entry.action, entry.objectId, JSON.stringify(entry.metadata)]);
                await sql.query('UPDATE members SET name=$3,headline=$4,bio=$5,skills=$6,colour=$7,avatar=$8,role=$9,status=$10 WHERE organization_id=$1 AND user_id=$2', [orgId, userId, member.name, member.headline, member.bio, JSON.stringify(member.skills), member.colour, member.avatar, member.role, member.status]);
                await sql.query('UPDATE organisations SET revision=$2 WHERE id=$1', [orgId, after.revision]);
                releasedTasks += erasure.releasedTasks; rewordedNotices += erasure.rewordedNotices;
            }
            // Accepting an invitation takes the account lock held here, so no membership can have been added meanwhile.
            const held = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM members WHERE user_id=$1', [userId])).rows[0].n;
            if (held !== memberships.length) throw new Error('A membership changed during account deletion, so nothing was changed.');
            // Account-wide: invitations to their address in any community, joined or not (queued invitation mail goes with
            // them by cascade), rate counters, reset tokens and other queued mail, then the sign-in itself.
            await setContext(sql, '', userId);
            await drop('invitations', 'DELETE FROM invitations WHERE email=lower($1) RETURNING id', [account.email]);
            await sql.query('DELETE FROM request_limits WHERE key = ANY($1::text[])', [[`member:${userId}`, `invite-admin:${userId}`, `account-delete:${userId}`]]);
            await drop('signInTokens', 'DELETE FROM auth_verification WHERE value=$1 OR lower(identifier)=lower($2) RETURNING id', [userId, account.email]);
            if (forgetMail) add('queuedMail', await forgetMail(sql, account.email));
            add('sessions', (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM auth_session WHERE user_id=$1', [userId])).rows[0].n);
            // Sessions and the stored password hash go with the account (ON DELETE CASCADE).
            if ((await sql.query('DELETE FROM auth_user WHERE id=$1 RETURNING id', [userId])).rows.length !== 1) throw new Error('The account could not be deleted, so nothing was changed.');
            return { summary: { communities: memberships.length, removed, releasedTasks, rewordedNotices }, files };
        });
    }
    /**
     * Hand the community to one of its active administrators, under the community lock. The caller has checked the
     * owner's password. The previous owner is demoted first and the new owner promoted second, so the single-owner index
     * from migration 0017 never sees two owners at once.
     */
    async transferOwnership(slug: string, userId: string, memberId: string, confirmation: string, requestId: string): Promise<OwnershipTransferResult & { workspace: Workspace }> {
        return this.within(slug, userId, true, async (sql, org) => {
            const ctx = context(String(org.id), userId, requestId), before = await readAll(sql, org, userId);
            const t = transferOwnership(before, ctx, memberId, confirmation, new Date().toISOString());
            const demoted = (await sql.query("UPDATE members SET role='admin' WHERE organization_id=$1 AND id=$2 AND role='owner' RETURNING id", [ctx.organizationId, t.previousOwner.id])).rows;
            if (demoted.length !== 1) throw new DomainError('OWNERSHIP_CONFLICT', 'This community’s ownership needs attention before it can change hands.', 409);
            const step = structuredClone(before);
            step.members = step.members.map(m => m.id === t.previousOwner.id ? { ...m, role: 'admin' } : m);
            await saveChanges(sql, step, t.workspace);
            return { message: t.message, ownerMemberId: t.owner.id, previousOwnerMemberId: t.previousOwner.id, workspace: await view(sql, t.workspace, ctx) };
        });
    }
    /**
     * One page of a long list, read inside the person's own tenant transaction. The audit trail is paged in SQL by its
     * index; the other lists apply the same visibility rules as the workspace snapshot before cutting the page.
     */
    async page<L extends PagedList>(slug: string, userId: string, list: L, raw: PageQuery = {}): Promise<Page<PagedItems[L]>> {
        const query = pageQuery.parse(raw);
        return this.within(slug, userId, false, async (sql, org) => {
            const ctx = context(String(org.id), userId);
            if (list !== 'audit') return pageOf(visibleRecords(await readAll(sql, org, userId), ctx), ctx, list, query);
            const admin = await sql.query("SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active' AND role IN ('owner','admin')", [ctx.organizationId, userId]);
            if (!admin.rows[0]) throw new DomainError('FORBIDDEN', 'An administrator is required.', 403);
            const after = query.cursor ? readCursor(query.cursor) : null;
            if (query.cursor && !after) throw new DomainError('INVALID_CURSOR', 'That page is not available. Reload the list.', 400);
            // Positions compare at millisecond precision, the precision a cursor carries.
            const spec = tables.find(t => t.key === 'audit')!, ms = "date_trunc('milliseconds',created_at)";
            const rows = (await sql.query(`SELECT ${spec.fields.map(f => f.column).join(',')} FROM audit WHERE organization_id=$1${after ? ` AND (${ms},id)<($3::timestamptz,$4)` : ''} ORDER BY ${ms} DESC,id DESC LIMIT $2`, after ? [ctx.organizationId, query.limit + 1, after.createdAt, after.id] : [ctx.organizationId, query.limit + 1])).rows.map(r => decode(r, spec)) as unknown as PagedItems['audit'][];
            const total = (await sql.query<{ n: number }>('SELECT count(*)::int AS n FROM audit WHERE organization_id=$1', [ctx.organizationId])).rows[0].n;
            const items = rows.slice(0, query.limit);
            return { items: items as PagedItems[L][], total, nextCursor: rows.length > query.limit ? cursorFor(items[items.length - 1]) : null };
        });
    }
    /** The acting member's own learning record, read inside their own tenant transaction. */
    async learningRecord(slug: string, userId: string) {
        return this.within(slug, userId, false, async (sql, org) => learningRecord(await readAll(sql, org, userId), context(String(org.id), userId), new Date().toISOString()));
    }
    async resourceDownload(slug: string, userId: string, ref: ResourceRef) {
        return this.within(slug, userId, false, async (sql, org) => {
            const target = resolveResourceDownload(await readAll(sql, org, userId), context(String(org.id), userId), ref);
            return { objectKey: target.upload.objectKey, generation: target.upload.generation, contentType: target.upload.contentType, filename: target.filename };
        });
    }
}
