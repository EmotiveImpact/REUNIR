import { DomainError, newId, type Workspace, type TenantContext, type Member, type Upload, type Track } from '../../contracts/src/index';
import {
    MAX_PENDING_RESOURCE_UPLOADS, MAX_RESOURCE_UPLOADS, RESOURCE_UPLOAD_TTL_MS, isLessonResourceType, resourceFileName, resourceUploadRequest,
    type LessonResource, type ResourceRef, type ResourceUploadRequest,
} from '../../contracts/src/lesson-resources';
import { actorFor, canSeeSpace, isAdmin } from './access';
import { contributedTracks, contributes, contributesAny, holdsGrant, seesTrack } from './instructors';
import { normalisePurposeState } from './purpose';

/**
 * Lesson files bind to one track's upload records by ID. Clients never name storage keys.
 * Who may download follows the same rules as reading the lesson, draft or revision that lists the file.
 */
type ResourceInput = { id: string; fileId: string; name: string; description?: string };
const gone = (message = 'That file is not available.'): never => { throw new DomainError('NOT_FOUND', message, 404); };
const lessonFile = (u: Upload, organizationId: string) => u.organizationId === organizationId && u.purpose === 'lesson_resource';

/** Whitelist resource fields so stored or submitted extras never travel with lesson content. */
export function normaliseResources(value: readonly LessonResource[] | null | undefined): LessonResource[] {
    return (value ?? []).map(r => ({ id: r.id, fileId: r.fileId, name: r.name, description: r.description ?? '', contentType: r.contentType, sizeBytes: r.sizeBytes }));
}
/** Storage keys and generations are server-only. */
export const clientUpload = (u: Upload): Upload => ({ ...u, objectKey: '', generation: null, ...(u.thumbnailObjectKey !== undefined ? { thumbnailObjectKey: u.thumbnailObjectKey ? '' : null, thumbnailGeneration: null } : {}) });
export function visibleUploads(s: Workspace, actor: Member): Upload[] {
    // Upload records reach only the people who teach the track: its instructors, its contributors and the community's administrators.
    const tracks = contributedTracks(s, actor);
    return s.uploads.filter(u => lessonFile(u, actor.organizationId) && !!u.trackId && tracks.has(u.trackId)).map(clientUpload);
}
export function isUploadReferenced(s: Workspace, organizationId: string, uploadId: string): boolean {
    const uses = (rows: { organizationId: string; resources?: LessonResource[] | null }[]) => rows.some(r => r.organizationId === organizationId && (r.resources ?? []).some(x => x.fileId === uploadId));
    return uses(s.lessons) || uses(s.lessonDrafts) || uses(s.lessonRevisions);
}
/** Turn submitted entries into stored ones. Type and size always come from the verified upload. */
export function resolveResources(s: Workspace, ctx: TenantContext, trackId: string, input: readonly ResourceInput[]): LessonResource[] {
    return input.map(item => {
        const upload = s.uploads.find(u => u.id === item.fileId && lessonFile(u, ctx.organizationId));
        if (!upload || upload.trackId !== trackId) throw new DomainError('RESOURCE_UNAVAILABLE', 'One of these files is not available for this lesson. Upload it again.', 409);
        if (upload.status !== 'ready' || !isLessonResourceType(upload.contentType)) throw new DomainError('RESOURCE_NOT_READY', 'A file has not passed verification yet. Upload it again.', 409);
        return { id: item.id, fileId: upload.id, name: item.name, description: item.description ?? '', contentType: upload.contentType, sizeBytes: upload.sizeBytes };
    });
}
export function assertResourcesAvailable(s: Workspace, ctx: TenantContext, trackId: string, resources: LessonResource[] | null | undefined) {
    resolveResources(s, ctx, trackId, normaliseResources(resources));
}

function requireAuthor(s: Workspace, ctx: TenantContext): Member {
    const actor = actorFor(s, ctx);
    if (!contributesAny(s, actor)) throw new DomainError('AUTHOR_REQUIRED', 'Only a track instructor or contributor, or a community owner or administrator, can manage lesson files.', 403);
    return actor;
}
function authorTrack(s: Workspace, ctx: TenantContext, trackId: string | null): { actor: Member; track: Track } {
    const actor = requireAuthor(s, ctx);
    const track = s.tracks.find(t => t.id === trackId && t.organizationId === ctx.organizationId);
    if (!track || !canSeeSpace(s, actor, track.spaceId) || !holdsGrant(s, actor, track.id)) gone('That learning material is not available.');
    return { actor, track: track! };
}
function record(s: Workspace, ctx: TenantContext, now: string, makeId: () => string, type: string, objectId: string, audit: boolean) {
    s.revision++;
    s.outbox.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, type, objectId, payload: { requestId: ctx.requestId } });
    if (audit) s.audit.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, action: type, objectId, metadata: { requestId: ctx.requestId } });
}

/** Record an authorised upload intent before any storage capability is minted. Stale and rejected intents are pruned. */
export function beginResourceUpload(input: Workspace, ctx: TenantContext, raw: ResourceUploadRequest, ids: { id: string; objectKey: string }, now: string, makeId: () => string = newId) {
    const request = resourceUploadRequest.parse(raw);
    authorTrack(input, ctx, request.trackId);
    const s = normalisePurposeState(structuredClone(input));
    const nowMs = Date.parse(now);
    const expired = s.uploads.filter(u => lessonFile(u, ctx.organizationId) && (u.status === 'rejected' || (u.status === 'pending' && nowMs - Date.parse(u.createdAt) > RESOURCE_UPLOAD_TTL_MS)) && !isUploadReferenced(s, ctx.organizationId, u.id));
    s.uploads = s.uploads.filter(u => !expired.includes(u));
    const files = s.uploads.filter(u => lessonFile(u, ctx.organizationId));
    if (files.filter(u => u.userId === ctx.userId && u.status === 'pending').length >= MAX_PENDING_RESOURCE_UPLOADS) throw new DomainError('UPLOADS_IN_PROGRESS', 'Let your current uploads finish before adding more.', 429);
    if (files.length >= MAX_RESOURCE_UPLOADS) throw new DomainError('UPLOAD_LIMIT', 'This community has reached its lesson file limit for the alpha. Discard unused uploads first.', 409);
    const upload: Upload = { id: ids.id, organizationId: ctx.organizationId, createdAt: now, userId: ctx.userId, purpose: 'lesson_resource', trackId: request.trackId, originalName: request.name, contentType: request.contentType, sizeBytes: request.sizeBytes, status: 'pending', objectKey: ids.objectKey, completedAt: null, generation: null };
    s.uploads.push(upload);
    record(s, ctx, now, makeId, 'lesson.resource.upload.started', upload.id, false);
    return { workspace: s, upload, expired: expired.map(u => ({ id: u.id, objectKey: u.objectKey })) };
}

/** What storage reported for the object. The signature check reads bytes pinned to this generation. */
export interface StoredObservation { sizeBytes: number; contentType: string; generation: string | null; signatureMatches: boolean }
export function completeResourceUpload(input: Workspace, ctx: TenantContext, uploadId: string, observed: StoredObservation, now: string, makeId: () => string = newId) {
    requireAuthor(input, ctx);
    const found = input.uploads.find(u => u.id === uploadId && lessonFile(u, ctx.organizationId) && u.userId === ctx.userId) ?? gone('That upload is not available.');
    authorTrack(input, ctx, found.trackId);
    if (found.status === 'ready') return { workspace: input, upload: found, outcome: 'unchanged' as const };
    if (found.status === 'rejected') throw new DomainError('FILE_REJECTED', 'This file did not pass verification. Choose it again.', 409);
    if (Date.parse(now) - Date.parse(found.createdAt) > RESOURCE_UPLOAD_TTL_MS) throw new DomainError('UPLOAD_EXPIRED', 'This upload expired. Choose the file again.', 409);
    const s = normalisePurposeState(structuredClone(input));
    const upload = s.uploads.find(u => u.id === found.id && u.organizationId === ctx.organizationId)!;
    const accepted = observed.sizeBytes === upload.sizeBytes && observed.contentType === upload.contentType && observed.signatureMatches && !!observed.generation && /^[0-9]{1,20}$/.test(observed.generation);
    Object.assign(upload, { status: accepted ? 'ready' : 'rejected', completedAt: now, generation: accepted ? observed.generation : null });
    record(s, ctx, now, makeId, accepted ? 'lesson.resource.uploaded' : 'lesson.resource.rejected', upload.id, true);
    return { workspace: s, upload, outcome: accepted ? 'ready' as const : 'rejected' as const };
}

/** Only files that no lesson, draft or revision references can be discarded. History keeps its files. */
export function discardResourceUpload(input: Workspace, ctx: TenantContext, uploadId: string, now: string, makeId: () => string = newId) {
    requireAuthor(input, ctx);
    const found = input.uploads.find(u => u.id === uploadId && lessonFile(u, ctx.organizationId)) ?? gone('That upload is not available.');
    authorTrack(input, ctx, found.trackId);
    if (isUploadReferenced(input, ctx.organizationId, found.id)) throw new DomainError('RESOURCE_IN_USE', 'This file is part of a lesson, a draft or its history, so it stays stored.', 409);
    const s = normalisePurposeState(structuredClone(input));
    s.uploads = s.uploads.filter(u => !(u.id === found.id && u.organizationId === ctx.organizationId));
    record(s, ctx, now, makeId, 'lesson.resource.discarded', found.id, true);
    return { workspace: s, id: found.id, objectKey: found.objectKey };
}

/** Single gate for every download. Mirrors the visibility of the lesson, draft or revision listing the file. */
export function resolveResourceDownload(s: Workspace, ctx: TenantContext, ref: ResourceRef) {
    const actor = actorFor(s, ctx), org = ctx.organizationId;
    const track = (id: string) => s.tracks.find(t => t.id === id && t.organizationId === org && canSeeSpace(s, actor, t.spaceId) && seesTrack(s, actor, t));
    let holder: { trackId: string; resources?: LessonResource[] | null } | undefined;
    if (ref.context === 'lesson') holder = s.lessons.find(l => l.id === ref.recordId && l.organizationId === org && (l.published || isAdmin(actor)) && !!track(l.trackId));
    else holder = (ref.context === 'draft' ? s.lessonDrafts : s.lessonRevisions).find(r => r.id === ref.recordId && r.organizationId === org && !!track(r.trackId) && contributes(s, actor, r.trackId, r.lessonId));
    const resource = holder?.resources?.find(r => r.id === ref.resourceId) ?? gone();
    const upload = s.uploads.find(u => u.id === resource.fileId && lessonFile(u, org) && u.trackId === holder!.trackId) ?? gone();
    if (upload.status !== 'ready' || !upload.generation || !isLessonResourceType(upload.contentType)) throw new DomainError('FILE_NOT_READY', 'This file is not ready to download.', 409);
    return { upload, resource, filename: resourceFileName(resource.name, upload.contentType) };
}
