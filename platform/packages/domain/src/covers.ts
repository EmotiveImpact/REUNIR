import { DomainError, newId, type Command, type Member, type Project, type TenantContext, type Track, type Upload, type Workspace } from '../../contracts/src/index';
import {
    COVER_UPLOAD_TTL_MS, MAX_COVER_UPLOADS, MAX_PENDING_COVER_UPLOADS, coverUploadRequest, isCoverImageType,
    type CoverImage, type CoverSubject, type CoverUploadRequest,
} from '../../contracts/src/covers';
import { actorFor, canSeeSpace, isAdmin } from './access';
import { teaches } from './instructors';
import { normalisePurposeState } from './purpose';

/**
 * Cover images bind to one track's or project's upload records by ID. Clients never name storage keys.
 * Whoever can see the track or project can see its cover; changing it follows the right to edit that record.
 */
const coverFile = (u: Upload, organizationId: string) => u.organizationId === organizationId && u.purpose === 'cover_image';
const gone = (message = 'That cover is not available.'): never => { throw new DomainError('NOT_FOUND', message, 404); };
type Subject = Track | Project;
const subjectOf = (u: Upload): { kind: CoverSubject; id: string } | null =>
    u.coverTrackId ? { kind: 'track', id: u.coverTrackId } : u.coverProjectId ? { kind: 'project', id: u.coverProjectId } : null;
const belongsTo = (u: Upload, kind: CoverSubject, id: string) => (kind === 'track' ? u.coverTrackId : u.coverProjectId) === id;

/** Whitelist the stored fields so extras never travel with a track or project. */
export function normaliseCover(value: CoverImage | null | undefined): CoverImage | null {
    return value ? { fileId: value.fileId, contentType: value.contentType, sizeBytes: value.sizeBytes, focusX: value.focusX, focusY: value.focusY } : null;
}
/** The same visibility the workspace applies: space access, and unpublished tracks only for administrators. */
export function visibleSubject(s: Workspace, actor: Member, kind: CoverSubject, id: string): Subject | undefined {
    if (kind === 'track') return s.tracks.find(t => t.id === id && t.organizationId === actor.organizationId && canSeeSpace(s, actor, t.spaceId) && (t.published || isAdmin(actor)));
    return s.projects.find(p => p.id === id && p.organizationId === actor.organizationId && canSeeSpace(s, actor, p.spaceId));
}
/** A track cover follows the right to teach the track; a project cover, its owner or an administrator. */
export function canEditCover(s: Workspace, actor: Member, kind: CoverSubject, subject: Subject): boolean {
    return kind === 'track' ? teaches(s, actor, subject.id) : isAdmin(actor) || (subject as Project).ownerId === actor.userId;
}
function requireEditor(s: Workspace, ctx: TenantContext, kind: CoverSubject, id: string): { actor: Member; subject: Subject } {
    const actor = actorFor(s, ctx);
    const subject = visibleSubject(s, actor, kind, id) ?? gone(kind === 'track' ? 'That learning track is not available.' : 'That project is not available.');
    if (!canEditCover(s, actor, kind, subject)) throw new DomainError('COVER_EDITOR_REQUIRED', kind === 'track' ? 'Only a track instructor or a community owner or administrator can change a track cover.' : 'Only the project owner or a community administrator can change this cover.', 403);
    return { actor, subject };
}
export function isCoverReferenced(s: Workspace, organizationId: string, uploadId: string): boolean {
    const uses = (rows: Subject[]) => rows.some(r => r.organizationId === organizationId && r.coverImage?.fileId === uploadId);
    return uses(s.tracks) || uses(s.projects);
}
function record(s: Workspace, ctx: TenantContext, now: string, makeId: () => string, type: string, objectId: string, audit: boolean) {
    s.revision++;
    s.outbox.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, type, objectId, payload: { requestId: ctx.requestId } });
    if (audit) s.audit.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, action: type, objectId, metadata: { requestId: ctx.requestId } });
}

/**
 * Record an authorised cover upload before any storage capability is minted. Rejected uploads, stale pending ones and
 * replaced covers nobody references any more are pruned, and their keys are returned for best-effort deletion.
 */
export function beginCoverUpload(input: Workspace, ctx: TenantContext, raw: CoverUploadRequest, ids: { id: string; objectKey: string }, now: string, makeId: () => string = newId) {
    const request = coverUploadRequest.parse(raw);
    requireEditor(input, ctx, request.subject, request.subjectId);
    const s = normalisePurposeState(structuredClone(input));
    const nowMs = Date.parse(now), old = (u: Upload) => nowMs - Date.parse(u.createdAt) > COVER_UPLOAD_TTL_MS;
    const expired = s.uploads.filter(u => coverFile(u, ctx.organizationId) && !isCoverReferenced(s, ctx.organizationId, u.id)
        && (u.status === 'rejected' || old(u)));
    s.uploads = s.uploads.filter(u => !expired.includes(u));
    const covers = s.uploads.filter(u => coverFile(u, ctx.organizationId));
    if (covers.filter(u => u.userId === ctx.userId && u.status === 'pending').length >= MAX_PENDING_COVER_UPLOADS) throw new DomainError('UPLOADS_IN_PROGRESS', 'Let your current cover upload finish first.', 429);
    if (covers.length >= MAX_COVER_UPLOADS) throw new DomainError('UPLOAD_LIMIT', 'This community has reached its cover upload limit for the alpha. Try again in an hour.', 409);
    const upload: Upload = {
        id: ids.id, organizationId: ctx.organizationId, createdAt: now, userId: ctx.userId, purpose: 'cover_image', trackId: null,
        coverTrackId: request.subject === 'track' ? request.subjectId : null, coverProjectId: request.subject === 'project' ? request.subjectId : null,
        originalName: `${request.subject} cover`, contentType: request.contentType, sizeBytes: request.sizeBytes,
        status: 'pending', objectKey: ids.objectKey, completedAt: null, generation: null,
    };
    s.uploads.push(upload);
    record(s, ctx, now, makeId, 'cover.upload.started', upload.id, false);
    return { workspace: s, upload, expired: expired.map(u => ({ id: u.id, objectKey: u.objectKey })) };
}

/** What storage reported for the object. `bytesAcceptable` covers the signature and the declared dimensions. */
export interface CoverObservation { sizeBytes: number; contentType: string; generation: string | null; bytesAcceptable: boolean }
export function completeCoverUpload(input: Workspace, ctx: TenantContext, uploadId: string, observed: CoverObservation, now: string, makeId: () => string = newId) {
    const found = input.uploads.find(u => u.id === uploadId && coverFile(u, ctx.organizationId) && u.userId === ctx.userId) ?? gone('That upload is not available.');
    const subject = subjectOf(found) ?? gone('That upload is not available.');
    requireEditor(input, ctx, subject.kind, subject.id);
    if (found.status === 'ready') return { workspace: input, upload: found, outcome: 'unchanged' as const };
    if (found.status === 'rejected') throw new DomainError('FILE_REJECTED', 'This image did not pass verification. Choose it again.', 409);
    if (Date.parse(now) - Date.parse(found.createdAt) > COVER_UPLOAD_TTL_MS) throw new DomainError('UPLOAD_EXPIRED', 'This upload expired. Choose the image again.', 409);
    const s = normalisePurposeState(structuredClone(input));
    const upload = s.uploads.find(u => u.id === found.id && u.organizationId === ctx.organizationId)!;
    const accepted = observed.sizeBytes === upload.sizeBytes && observed.contentType === upload.contentType && observed.bytesAcceptable && !!observed.generation && /^[0-9]{1,20}$/.test(observed.generation);
    Object.assign(upload, { status: accepted ? 'ready' : 'rejected', completedAt: now, generation: accepted ? observed.generation : null });
    record(s, ctx, now, makeId, accepted ? 'cover.uploaded' : 'cover.rejected', upload.id, true);
    return { workspace: s, upload, outcome: accepted ? 'ready' as const : 'rejected' as const };
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
/** Set, refocus or remove a cover. The stored type and size always come from the verified upload. */
export function applyCovers(s: Workspace, ctx: TenantContext, cmd: Command): Result | undefined {
    if (cmd.type !== 'track.cover.set' && cmd.type !== 'project.cover.set') return undefined;
    const kind: CoverSubject = cmd.type === 'track.cover.set' ? 'track' : 'project';
    const id = cmd.type === 'track.cover.set' ? cmd.trackId : cmd.projectId;
    const { subject } = requireEditor(s, ctx, kind, id);
    const before = JSON.stringify(normaliseCover(subject.coverImage));
    if (cmd.fileId === null) {
        subject.coverImage = null;
        return { message: 'Cover removed. The plain panel shows instead.', objectId: subject.id, changed: before !== 'null', audit: true };
    }
    const upload = s.uploads.find(u => u.id === cmd.fileId && coverFile(u, ctx.organizationId) && belongsTo(u, kind, id));
    if (!upload) throw new DomainError('COVER_UNAVAILABLE', 'This image is not available for this cover. Upload it again.', 409);
    if (upload.status !== 'ready' || !isCoverImageType(upload.contentType)) throw new DomainError('COVER_NOT_READY', 'This image has not passed verification yet. Upload it again.', 409);
    subject.coverImage = { fileId: upload.id, contentType: upload.contentType, sizeBytes: upload.sizeBytes, focusX: cmd.focusX, focusY: cmd.focusY };
    return { message: 'Cover saved.', objectId: subject.id, changed: before !== JSON.stringify(subject.coverImage), audit: true };
}

/** Single gate for serving cover bytes. Mirrors the visibility of the track or project that shows it. */
export function resolveCoverImage(s: Workspace, ctx: TenantContext, kind: CoverSubject, id: string, fileId: string) {
    const actor = actorFor(s, ctx);
    const subject = visibleSubject(s, actor, kind, id) ?? gone();
    const cover = normaliseCover(subject.coverImage);
    if (!cover || cover.fileId !== fileId) gone();
    const upload = s.uploads.find(u => u.id === fileId && coverFile(u, ctx.organizationId) && belongsTo(u, kind, id)) ?? gone();
    if (upload.status !== 'ready' || !upload.generation || !isCoverImageType(upload.contentType)) gone();
    return { upload, cover: cover! };
}
