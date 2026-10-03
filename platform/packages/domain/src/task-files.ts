import { DomainError, newId, type Workspace, type TenantContext, type Member, type Upload, type ProjectTask, type Project } from '../../contracts/src/index';
import { RESOURCE_UPLOAD_TTL_MS, isLessonResourceType, resourceFileName } from '../../contracts/src/lesson-resources';
import { MAX_PENDING_TASK_UPLOADS, MAX_PROJECT_TASK_FILES, MAX_TASK_FILES, taskFileUploadRequest, type TaskFileUploadRequest } from '../../contracts/src/task-files';
import { TWO_FACTOR_REQUIRED, TWO_FACTOR_REQUIRED_MESSAGE } from '../../contracts/src/two-factor';
import { actorFor, isAdmin } from './access';
import { canWorkOnProject } from './project-work';
import { clientUpload, type StoredObservation } from './resources';
import { normalisePurposeState } from './purpose';

/**
 * Files attached to project tasks. They are upload intents with purpose `task_file`, bound to one task, verified exactly
 * as lesson files are, and seen only by the people who can currently work on the task's project: its team and the
 * community's owners and administrators, while they are active and can open the project's space. Clients send a task ID
 * and a file ID, never a storage key. A file is supporting material for the team; it is never proof of the work.
 */
const gone = (message = 'That file is not available.'): never => { throw new DomainError('NOT_FOUND', message, 404); };
export const isTaskFile = (u: Upload, organizationId: string) => u.organizationId === organizationId && u.purpose === 'task_file';

/** The task and its project, if this person can work on it now. */
function workableTask(s: Workspace, actor: Member, taskId: string | null | undefined): { task: ProjectTask; project: Project } {
    const task = (s.projectTasks ?? []).find(t => t.id === taskId && t.organizationId === actor.organizationId);
    const project = task && s.projects.find(p => p.id === task.projectId && p.organizationId === actor.organizationId);
    if (!task || !project || !canWorkOnProject(s, actor, project)) return gone('This project work is not available.');
    return { task, project };
}
/** Verified files on tasks this person can work on. Pending and refused uploads stay with the server. */
export function visibleTaskFiles(s: Workspace, actor: Member): Upload[] {
    const projects = new Set(s.projects.filter(p => canWorkOnProject(s, actor, p)).map(p => p.id));
    const tasks = new Set((s.projectTasks ?? []).filter(t => t.organizationId === actor.organizationId && projects.has(t.projectId)).map(t => t.id));
    return s.uploads.filter(u => isTaskFile(u, actor.organizationId) && u.status === 'ready' && !!u.taskId && tasks.has(u.taskId)).map(clientUpload);
}
/** Verified files on one task, oldest first. */
export const taskFiles = (s: Workspace, taskId: string) => s.uploads.filter(u => u.purpose === 'task_file' && u.taskId === taskId && u.status === 'ready').sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

function record(s: Workspace, ctx: TenantContext, now: string, makeId: () => string, type: string, objectId: string, audit: boolean) {
    s.revision++;
    s.outbox.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, type, objectId, payload: { requestId: ctx.requestId } });
    if (audit) s.audit.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, action: type, objectId, metadata: { requestId: ctx.requestId } });
}
const stale = (u: Upload, nowMs: number) => u.status === 'rejected' || (u.status === 'pending' && nowMs - Date.parse(u.createdAt) > RESOURCE_UPLOAD_TTL_MS);

/**
 * Record an authorised upload intent before any storage capability is minted. The person's own refused or expired task
 * uploads are pruned first. With `administration: 'withheld'`, an owner or administrator who is not on the team, and so
 * could attach only by that authority, is refused with TWO_FACTOR_REQUIRED.
 */
export function beginTaskFileUpload(input: Workspace, ctx: TenantContext, raw: TaskFileUploadRequest, ids: { id: string; objectKey: (projectId: string) => string }, now: string, makeId: () => string = newId, options: { administration?: 'allowed' | 'withheld' } = {}) {
    const request = taskFileUploadRequest.parse(raw);
    const actor = actorFor(input, ctx);
    const { task, project } = workableTask(input, actor, request.taskId);
    if (options.administration === 'withheld' && isAdmin(actor) && !canWorkOnProject(input, { ...actor, role: 'moderator' }, project))
        throw new DomainError(TWO_FACTOR_REQUIRED, TWO_FACTOR_REQUIRED_MESSAGE, 403);
    if (task.archived) throw new DomainError('TASK_ARCHIVED', 'Restore this task before changing it.', 409);
    const s = normalisePurposeState(structuredClone(input)), nowMs = Date.parse(now);
    const expired = s.uploads.filter(u => isTaskFile(u, ctx.organizationId) && u.userId === ctx.userId && stale(u, nowMs));
    s.uploads = s.uploads.filter(u => !expired.includes(u));
    const files = s.uploads.filter(u => isTaskFile(u, ctx.organizationId));
    if (files.filter(u => u.userId === ctx.userId && u.status === 'pending').length >= MAX_PENDING_TASK_UPLOADS) throw new DomainError('UPLOADS_IN_PROGRESS', 'Let your current uploads finish before adding more.', 429);
    if (files.filter(u => u.taskId === task.id && (u.status === 'ready' || u.userId === ctx.userId)).length >= MAX_TASK_FILES) throw new DomainError('TASK_FILE_LIMIT', `Attach up to ${MAX_TASK_FILES} files to a task. Remove one first.`, 409);
    const tasks = new Set(s.projectTasks.filter(t => t.projectId === project.id).map(t => t.id));
    if (files.filter(u => u.status === 'ready' && !!u.taskId && tasks.has(u.taskId)).length >= MAX_PROJECT_TASK_FILES) throw new DomainError('UPLOAD_LIMIT', 'This project has reached its file limit for the alpha. Remove files the team no longer needs first.', 409);
    const upload: Upload = { id: ids.id, organizationId: ctx.organizationId, createdAt: now, userId: ctx.userId, purpose: 'task_file', trackId: null, taskId: task.id, originalName: request.name, contentType: request.contentType, sizeBytes: request.sizeBytes, status: 'pending', objectKey: ids.objectKey(project.id), completedAt: null, generation: null };
    s.uploads.push(upload);
    record(s, ctx, now, makeId, 'task.file.upload.started', upload.id, false);
    return { workspace: s, upload, expired: expired.map(u => ({ id: u.id, objectKey: u.objectKey })) };
}

/** The same check as a lesson file: stored size and type, then the signature read at the measured generation. */
export function completeTaskFileUpload(input: Workspace, ctx: TenantContext, uploadId: string, observed: StoredObservation, now: string, makeId: () => string = newId) {
    const actor = actorFor(input, ctx);
    const found = input.uploads.find(u => u.id === uploadId && isTaskFile(u, ctx.organizationId) && u.userId === ctx.userId) ?? gone('That upload is not available.');
    const { task } = workableTask(input, actor, found.taskId);
    if (found.status === 'ready') return { workspace: input, upload: found, outcome: 'unchanged' as const };
    if (found.status === 'rejected') throw new DomainError('FILE_REJECTED', 'This file did not pass verification. Choose it again.', 409);
    if (task.archived) throw new DomainError('TASK_ARCHIVED', 'This task was archived while the file was uploading. Restore it, then attach the file again.', 409);
    if (Date.parse(now) - Date.parse(found.createdAt) > RESOURCE_UPLOAD_TTL_MS) throw new DomainError('UPLOAD_EXPIRED', 'This upload expired. Choose the file again.', 409);
    const s = normalisePurposeState(structuredClone(input));
    const upload = s.uploads.find(u => u.id === found.id && u.organizationId === ctx.organizationId)!;
    // Limits are checked again here, under the community lock: two teammates may each have started an upload into the last place.
    const ready = s.uploads.filter(u => isTaskFile(u, ctx.organizationId) && u.status === 'ready');
    if (ready.filter(u => u.taskId === task.id).length >= MAX_TASK_FILES) throw new DomainError('TASK_FILE_LIMIT', `Attach up to ${MAX_TASK_FILES} files to a task. Remove one first, then try again.`, 409);
    const projectTasks = new Set(s.projectTasks.filter(t => t.projectId === task.projectId).map(t => t.id));
    if (ready.filter(u => !!u.taskId && projectTasks.has(u.taskId)).length >= MAX_PROJECT_TASK_FILES) throw new DomainError('UPLOAD_LIMIT', 'This project has reached its file limit for the alpha. Remove files the team no longer needs, then try again.', 409);
    const accepted = observed.sizeBytes === upload.sizeBytes && observed.contentType === upload.contentType && observed.signatureMatches && !!observed.generation && /^[0-9]{1,20}$/.test(observed.generation);
    Object.assign(upload, { status: accepted ? 'ready' : 'rejected', completedAt: now, generation: accepted ? observed.generation : null });
    record(s, ctx, now, makeId, accepted ? 'task.file.attached' : 'task.file.rejected', upload.id, true);
    return { workspace: s, upload, outcome: accepted ? 'ready' as const : 'rejected' as const };
}

/**
 * Single gate for every task-file download, decided from current state: an active member of this community who can
 * work on the task's project now, and a verified file on that task with a recorded generation. A future scan verdict
 * belongs beside the readiness check here, so a file that has not passed it is never released.
 */
export function resolveTaskFileDownload(s: Workspace, ctx: TenantContext, taskId: string, fileId: string) {
    const actor = actorFor(s, ctx);
    const { task } = workableTask(s, actor, taskId);
    const upload = s.uploads.find(u => u.id === fileId && isTaskFile(u, ctx.organizationId) && u.taskId === task.id) ?? gone();
    if (upload.status !== 'ready' || !upload.generation || !isLessonResourceType(upload.contentType)) throw new DomainError('FILE_NOT_READY', 'This file is not ready to download.', 409);
    return { upload, task, filename: resourceFileName(upload.originalName, upload.contentType) };
}

/** Storage keys of task files a change removed, for the caller to delete once the change has committed. */
export function releasedTaskFileKeys(before: Workspace, after: Workspace): string[] {
    const kept = new Set(after.uploads.map(u => u.id));
    return before.uploads.filter(u => u.purpose === 'task_file' && !kept.has(u.id)).map(u => u.objectKey);
}
/** Task uploads that never became files: refused, or started over an hour ago and never completed. */
export function staleTaskUploads(s: Workspace, organizationId: string, now: string): Upload[] {
    const nowMs = Date.parse(now);
    return s.uploads.filter(u => isTaskFile(u, organizationId) && stale(u, nowMs));
}

/** Short, stable fingerprint. Not a security boundary: it only says whether something visible changed. */
function fingerprint(text: string): string {
    let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
/**
 * What the board and an open task show, reduced to one fingerprint: the project heading, its team, every task, the notes
 * and verified files on them and the proof linked to them. Only someone who can work on the project may ask; anyone else
 * gets the same "not available" as for a missing project, so the answer reveals nothing about projects they cannot see.
 */
export function projectWorkVersion(s: Workspace, ctx: TenantContext, projectId: string): string {
    const actor = actorFor(s, ctx), org = ctx.organizationId;
    const project = s.projects.find(p => p.id === projectId && p.organizationId === org);
    if (!project || !canWorkOnProject(s, actor, project)) return gone('This project work is not available.');
    const tasks = (s.projectTasks ?? []).filter(t => t.organizationId === org && t.projectId === project.id).sort((a, b) => a.id.localeCompare(b.id));
    const ids = new Set(tasks.map(t => t.id)), proof = new Set(tasks.map(t => t.contributionId).filter(Boolean));
    const team = s.projectMembers.filter(m => m.organizationId === org && m.projectId === project.id).map(m => m.userId).sort();
    const people = s.members.filter(m => m.organizationId === org && (team.includes(m.userId) || m.userId === project.ownerId)).map(m => [m.userId, m.name, m.status, m.avatar]).sort();
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    return fingerprint(JSON.stringify([
        [project.title, project.tagline, project.ownerId, project.spaceId, project.purposeId ?? null], team, people,
        tasks.map(t => [t.id, t.version, t.archived, t.workState, t.assigneeId, t.contributionId]),
        s.contributions.filter(c => c.organizationId === org && proof.has(c.id)).sort(byId).map(c => [c.id, c.status, c.body, c.evidenceUrl, c.feedback, c.reviewerId]),
        (s.taskNotes ?? []).filter(n => n.organizationId === org && ids.has(n.taskId)).sort(byId).map(n => [n.id, n.hidden]),
        s.uploads.filter(u => isTaskFile(u, org) && u.status === 'ready' && !!u.taskId && ids.has(u.taskId)).sort(byId).map(u => u.id),
    ]));
}
