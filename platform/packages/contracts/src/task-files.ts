import { z } from 'zod';
import { MAX_RESOURCE_BYTES, lessonResourceType } from './lesson-resources';

/**
 * Files attached to a project task. They reuse the lesson-file upload intent, types, size limit and verification; only
 * the scope differs: a task, and through it the project team, instead of a track.
 */
export const MAX_TASK_FILES = 12;
/** Attached files across one project's tasks. Keeps the bounded workspace read well inside its table limit. */
export const MAX_PROJECT_TASK_FILES = 200;
export const MAX_PENDING_TASK_UPLOADS = 5;

const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
/** Upload intent for a task file. The server chooses the bucket, tenant prefix and object key. */
export const taskFileUploadRequest = z.object({
    purpose: z.literal('task_file'), taskId: key,
    name: z.string().trim().min(1).max(160).refine(n => !/[\x00-\x1f\\/]/.test(n), 'Use a filename, not a path.'),
    contentType: lessonResourceType,
    sizeBytes: z.number().int().positive('This file is empty.').max(MAX_RESOURCE_BYTES, 'Files can be up to 10 MB.'),
}).strict();
export type TaskFileUploadRequest = z.infer<typeof taskFileUploadRequest>;

/**
 * What the workboard's change check returns: an opaque fingerprint of everything the project team sees on the board and
 * in an open task. Equal fingerprints mean nothing visible changed. It names no person and carries no content.
 */
export interface ProjectChanges { version: string }
/** How often an open board asks, and the longest it waits after errors. */
export const CHANGE_POLL_MS = 5000;
export const CHANGE_POLL_MAX_MS = 60000;
