import { z } from 'zod';

/** Private lesson files. Bytes live in private object storage; workspaces only hold bounded metadata. */
export const MAX_LESSON_RESOURCES = 12;
export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;
/** Alpha 37: the most a lesson video can ever be. A server sets its own lower limit, and none at all until it opts in. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
/** Signed playback links last long enough to watch a long lesson; access is checked again each time one is made. */
export const VIDEO_PLAYBACK_TTL_SECONDS = 2 * 60 * 60;
/** The signed policy lasts five minutes. A pending upload can be completed for an hour, then it expires. */
export const RESOURCE_UPLOAD_TTL_MS = 60 * 60 * 1000;
export const MAX_PENDING_RESOURCE_UPLOADS = 5;
/** Per community, every status. Keeps the bounded workspace read well inside its table limit. */
export const MAX_RESOURCE_UPLOADS = 500;
/** Bytes read back from storage to verify a file signature. */
export const SIGNATURE_BYTES = 1024;

export const lessonResourceTypes = {
    'application/pdf': { extension: 'pdf', label: 'PDF' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', label: 'Word document' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extension: 'pptx', label: 'PowerPoint presentation' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', label: 'Excel spreadsheet' },
    'image/jpeg': { extension: 'jpg', label: 'JPEG image' },
    'image/png': { extension: 'png', label: 'PNG image' },
    'image/webp': { extension: 'webp', label: 'WebP image' },
    'video/mp4': { extension: 'mp4', label: 'MP4 video' },
    'video/webm': { extension: 'webm', label: 'WebM video' },
} as const;
export type LessonResourceType = keyof typeof lessonResourceTypes;
const typeNames = Object.keys(lessonResourceTypes) as [LessonResourceType, ...LessonResourceType[]];
export const RESOURCE_TYPES_HINT = 'Use a PDF, Word, PowerPoint, Excel, JPEG, PNG, WebP, MP4 or WebM file.';
export const lessonResourceType = z.enum(typeNames, RESOURCE_TYPES_HINT);
export const isLessonResourceType = (value: unknown): value is LessonResourceType => typeof value === 'string' && Object.hasOwn(lessonResourceTypes, value);
export const lessonVideoTypes = ['video/mp4', 'video/webm'] as const;
export type LessonVideoType = typeof lessonVideoTypes[number];
export const isLessonVideo = (contentType: string): contentType is LessonVideoType => (lessonVideoTypes as readonly string[]).includes(contentType);
const megabytes = (bytes: number) => `${Math.floor(bytes / (1024 * 1024))} MB`;
/**
 * Why a file of this type and size cannot be attached, or null when it can. `videoBytes` is the limit this
 * community's server allows for video, and 0 when video uploads are not switched on.
 */
export function resourceSizeProblem(contentType: LessonResourceType, sizeBytes: number, videoBytes: number): string | null {
    if (sizeBytes <= 0) return 'This file is empty.';
    if (!isLessonVideo(contentType)) return sizeBytes > MAX_RESOURCE_BYTES ? 'Files can be up to 10 MB.' : null;
    if (videoBytes <= 0) return 'Video uploads are not switched on for this community.';
    return sizeBytes > Math.min(videoBytes, MAX_VIDEO_BYTES) ? `Videos can be up to ${megabytes(Math.min(videoBytes, MAX_VIDEO_BYTES))}.` : null;
}
export const RESOURCE_FILE_ACCEPT = [...typeNames, ...typeNames.map(t => '.' + lessonResourceTypes[t].extension), '.jpeg'].join(',');

const byExtension: Record<string, LessonResourceType> = Object.fromEntries([...typeNames.map(t => [lessonResourceTypes[t].extension, t]), ['jpeg', 'image/jpeg']]);
/** Browsers sometimes report no type for Office files. The extension is only a hint; storage bytes are verified later. */
export function resourceTypeForFile(name: string, reported: string): LessonResourceType | null {
    if (isLessonResourceType(reported)) return reported;
    if (reported && reported !== 'application/octet-stream') return null;
    const extension = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]?.toLowerCase();
    return extension ? byExtension[extension] ?? null : null;
}

export interface LessonResource {
    id: string; fileId: string; name: string; description: string;
    /** Copied from the verified upload record by the server, never from the client. */
    contentType: LessonResourceType; sizeBytes: number;
}
export type ResourceContext = 'lesson' | 'draft' | 'revision';
export interface ResourceRef { context: ResourceContext; recordId: string; resourceId: string }

const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const controls = /[\u0000-\u001f\u007f-\u009f]/;
const controlsExceptNewline = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
export const resourceName = z.string().trim().min(1, 'Give each file a name learners will recognise.').max(120, 'Keep file names under 120 characters.').refine(v => !controls.test(v), 'Use plain text for file names.');
export const resourceDescription = z.string().trim().max(280, 'Keep file descriptions under 280 characters.').refine(v => !controlsExceptNewline.test(v), 'Use plain text for file descriptions.');
/** Type and size are accepted only so saved drafts can be resent unchanged; the server always replaces them. */
export const lessonResourceInput = z.object({
    id: key, fileId: key, name: resourceName, description: resourceDescription.default(''),
    contentType: lessonResourceType.optional(), sizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES).optional(),
}).strict();
export const lessonResourcesInput = z.array(lessonResourceInput).max(MAX_LESSON_RESOURCES, `Attach up to ${MAX_LESSON_RESOURCES} files to a lesson.`).superRefine((items, ctx) => {
    if (new Set(items.map(i => i.id)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Each lesson file needs its own entry.' });
    if (new Set(items.map(i => i.fileId)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'This file is already attached to the lesson.' });
});
export type LessonResourceInput = z.input<typeof lessonResourceInput>;

/** Upload intent for a lesson file. The server chooses the bucket, tenant prefix and object key. */
export const resourceUploadRequest = z.object({
    purpose: z.literal('lesson_resource'), trackId: key,
    name: z.string().trim().min(1).max(160).refine(n => !/[\x00-\x1f\\/]/.test(n), 'Use a filename, not a path.'),
    contentType: lessonResourceType,
    sizeBytes: z.number().int().positive('This file is empty.').max(MAX_VIDEO_BYTES, `Videos can be up to ${megabytes(MAX_VIDEO_BYTES)}.`),
}).strict().superRefine((value, ctx) => {
    // Video is checked against the server's own limit where the request arrives; everything else is capped here.
    if (!isLessonVideo(value.contentType) && value.sizeBytes > MAX_RESOURCE_BYTES) ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: 'Files can be up to 10 MB.' });
});
export type ResourceUploadRequest = z.infer<typeof resourceUploadRequest>;

const ascii = (value: string) => Array.from(value, c => c.charCodeAt(0));
const at = (bytes: Uint8Array, signature: number[], offset = 0) => bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b);
const ZIP = [0x50, 0x4b, 0x03, 0x04];
/** Magic-number check over the first stored bytes. It confirms the container, not that a file is harmless. */
export function fileSignatureMatches(contentType: string, bytes: Uint8Array): boolean {
    switch (contentType) {
        case 'application/pdf': {
            // PDF readers accept a header anywhere in the first kilobyte.
            const marker = ascii('%PDF-'), last = Math.min(bytes.length, SIGNATURE_BYTES) - marker.length;
            for (let i = 0; i <= last; i++) if (at(bytes, marker, i)) return true;
            return false;
        }
        case 'image/png': return at(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        case 'image/jpeg': return at(bytes, [0xff, 0xd8, 0xff]);
        case 'image/webp': return at(bytes, ascii('RIFF')) && at(bytes, ascii('WEBP'), 8);
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return at(bytes, ZIP);
        // ISO base media: a box size, then an ftyp box naming the brand.
        case 'video/mp4': return at(bytes, ascii('ftyp'), 4);
        // Matroska's EBML header, with the WebM document type declared inside it.
        case 'video/webm': {
            if (!at(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return false;
            const marker = ascii('webm'), last = Math.min(bytes.length, 64) - marker.length;
            for (let i = 4; i <= last; i++) if (at(bytes, marker, i)) return true;
            return false;
        }
        default: return false;
    }
}

/** Learner-facing download name: the author's label plus the verified type's extension. */
export function resourceFileName(name: string, contentType: LessonResourceType): string {
    const { extension } = lessonResourceTypes[contentType];
    const trim = (value: string) => value.replace(/^[.\s]+|[.\s]+$/g, '');
    const cleaned = trim(name.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f"\\/:*?<>|]+/g, ' ').replace(/\s+/g, ' '));
    const stem = trim(Array.from(cleaned).slice(0, 100).join('')) || 'lesson-resource';
    const lower = stem.toLowerCase();
    return (extension === 'jpg' ? ['.jpg', '.jpeg'] : ['.' + extension]).some(e => lower.endsWith(e)) ? stem : `${stem}.${extension}`;
}
/** Downloads are always attachments. ASCII fallback plus RFC 5987 UTF-8 name. */
export function attachmentDisposition(filename: string, disposition: 'attachment' | 'inline' = 'attachment'): string {
    const fallback = filename.replace(/[^\x20-\x7e]|["\\%;]/g, '_');
    const encoded = encodeURIComponent(filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export const resourceTypeLabel = (contentType: string) => isLessonResourceType(contentType) ? lessonResourceTypes[contentType].label : 'File';
