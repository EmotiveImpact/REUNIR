import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../packages/contracts/src/index';
import { attachmentDisposition, lessonResourceTypes, type LessonResourceType } from '../../../packages/contracts/src/lesson-resources';
import { coverImageTypes, type CoverImageType, type CoverSubject } from '../../../packages/contracts/src/covers';
const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const uploadSchema = z.object({ name: z.string().trim().min(1).max(160).refine(n => !/[\x00-\x1f\\/]/.test(n), 'Use a filename, not a path.'), contentType: z.enum(allowed), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).strict();
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const scope = (...values: string[]) => { for (const value of values)
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value))
        throw new DomainError('INVALID_PATH', 'Invalid object scope.'); };
export function objectKey(organizationId: string, userId: string, contentType: keyof typeof extensions, id = randomUUID()) {
    scope(organizationId, userId, id);
    return `organisations/${organizationId}/members/${userId}/${id}.${extensions[contentType]}`;
}
/** Lesson files sit under their track, never under the uploader, so authorship changes do not move them. */
export function resourceObjectKey(organizationId: string, trackId: string, contentType: LessonResourceType, id: string = randomUUID()) {
    scope(organizationId, trackId, id);
    return `organisations/${organizationId}/lesson-resources/${trackId}/${id}.${lessonResourceTypes[contentType].extension}`;
}
/** Covers sit under their track or project, never under the uploader, so ownership changes do not move them. */
export function coverObjectKey(organizationId: string, subject: CoverSubject, subjectId: string, contentType: CoverImageType, id: string = randomUUID()) {
    scope(organizationId, subjectId, id);
    return `organisations/${organizationId}/covers/${subject}s/${subjectId}/${id}.${coverImageTypes[contentType]}`;
}
/** Library pictures belong to the community, not to a track, project or uploader. */
export function coverLibraryObjectKey(organizationId: string, contentType: CoverImageType, id: string = randomUUID()) {
    scope(organizationId, id);
    return `organisations/${organizationId}/covers/library/${id}.${coverImageTypes[contentType]}`;
}
export interface DownloadOptions {
    /** Suggested download name. Disposition is always attachment. */
    filename?: string;
    /** Server-recorded type, forced on the response. */
    contentType?: string;
    /** Verified object generation. A replaced object is never served in its place. */
    generation?: string | null;
}
export interface StoredObject { size: number; contentType: string; generation?: string }
export interface PrivateStorage {
    upload(key: string, contentType: string, sizeBytes: number): Promise<{
        url: string;
        fields: Record<string, string>;
    }>;
    download(key: string, options?: DownloadOptions): Promise<string>;
    /** `null` when no object exists at the key yet. */
    metadata(key: string): Promise<StoredObject | null>;
    /** The first bytes of one exact generation, for signature checks. */
    head(key: string, bytes: number, generation: string): Promise<Uint8Array>;
    remove(key: string): Promise<void>;
}
/** Cloud Storage reports a missing object, or a generation that no longer exists, as code 404. */
export const isMissingObject = (error: unknown) => !!error && typeof error === 'object' && 'code' in error && Number((error as { code: unknown }).code) === 404;
/** `client` exists for offline signing tests; production uses application default or supplied credentials. */
export function googleStorage(bucket: string, credentialJSON?: string, client?: Storage): PrivateStorage {
    if (!bucket)
        throw new Error('GCS_BUCKET is required for storage.');
    const b = (client ?? new Storage(credentialJSON ? { credentials: JSON.parse(credentialJSON) } : {})).bucket(bucket);
    const file = (key: string, generation?: string | null) => generation ? b.file(key, { generation }) : b.file(key);
    return {
        upload: async (key, contentType, sizeBytes) => (await b.file(key).generateSignedPostPolicyV4({ expires: Date.now() + 5 * 60 * 1000, fields: { 'Content-Type': contentType }, conditions: [['content-length-range', sizeBytes, sizeBytes]] }))[0],
        download: async (key, options = {}) => (await file(key, options.generation).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 2 * 60 * 1000, responseDisposition: options.filename ? attachmentDisposition(options.filename) : 'attachment', ...(options.contentType ? { responseType: options.contentType } : {}) }))[0],
        metadata: async (key) => {
            try {
                const [m] = await b.file(key).getMetadata();
                return { size: Number(m.size), contentType: m.contentType || '', ...(m.generation != null ? { generation: String(m.generation) } : {}) };
            }
            catch (error) {
                if (isMissingObject(error))
                    return null;
                throw error;
            }
        },
        head: async (key, bytes, generation) => new Uint8Array((await file(key, generation).download({ start: 0, end: bytes - 1 }))[0]),
        remove: async (key) => { await b.file(key).delete({ ignoreNotFound: true }); },
    };
}
