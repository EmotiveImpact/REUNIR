import { z } from 'zod';
import { fileSignatureMatches } from './lesson-resources';

/**
 * Cover images for tracks and projects. Bytes live in private object storage; a track or project only holds the
 * verified file, its type and size, and the focal point every card crops around. No cover means a plain panel.
 */
export const MAX_COVER_BYTES = 3 * 1024 * 1024;
/** Browsers re-encode covers so the longest edge is at most this many pixels before upload. */
export const COVER_EDGE = 1600;
/** The largest edge a stored cover may declare. Larger headers are refused, whatever the file size. */
export const MAX_COVER_EDGE = 4096;
export const MIN_COVER_EDGE = 16;
/** The signed policy lasts five minutes. Unused cover uploads are pruned an hour after they were started. */
export const COVER_UPLOAD_TTL_MS = 60 * 60 * 1000;
export const MAX_PENDING_COVER_UPLOADS = 3;
/** Per community, every status. Replaced covers are pruned, so this only bounds unusual churn. */
export const MAX_COVER_UPLOADS = 400;
/** Bytes read back from storage to check the signature and the declared dimensions. */
export const COVER_HEAD_BYTES = 64 * 1024;

export const coverImageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export type CoverImageType = keyof typeof coverImageTypes;
export const coverImageType = z.enum(['image/jpeg', 'image/png', 'image/webp'], 'Use a JPEG, PNG or WebP image.');
export const isCoverImageType = (value: unknown): value is CoverImageType => typeof value === 'string' && Object.hasOwn(coverImageTypes, value);
export const COVER_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export type CoverSubject = 'track' | 'project';
export const coverSubject = z.enum(['track', 'project']);
/** Stored on a track or project. Type and size are copied from the verified upload by the server. */
export interface CoverImage {
    fileId: string; contentType: CoverImageType; sizeBytes: number;
    /** Percentages used as the object position, so every card keeps the chosen part of the image in view. */
    focusX: number; focusY: number;
}

const key = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const coverFocus = z.number().int('Use a whole percentage.').min(0).max(100);
/** Upload intent for a cover. The server chooses the bucket, tenant prefix and object key. */
export const coverUploadRequest = z.object({
    purpose: z.literal('cover_image'), subject: coverSubject, subjectId: key,
    contentType: coverImageType,
    sizeBytes: z.number().int().positive('This image is empty.').max(MAX_COVER_BYTES, 'Cover images can be up to 3 MB.'),
}).strict();
export type CoverUploadRequest = z.infer<typeof coverUploadRequest>;
/** A community's cover library: pictures owners and administrators supply for anyone who edits a cover to choose. */
export const MAX_COVER_LIBRARY_ITEMS = 24;
export const coverLibraryLabel = z.string().trim().min(1, 'Give the picture a short name.').max(80, 'Keep the name under 80 characters.');
/** Upload intent for a library picture. It has no track or project; the server chooses the key. */
export const coverLibraryUploadRequest = z.object({
    purpose: z.literal('cover_library'), contentType: coverImageType,
    sizeBytes: z.number().int().positive('This image is empty.').max(MAX_COVER_BYTES, 'Cover images can be up to 3 MB.'),
}).strict();
export type CoverLibraryUploadRequest = z.infer<typeof coverLibraryUploadRequest>;
/** `fileId: null` removes the cover. Changing only the focus keeps the same verified file. */
export const coverChange = { fileId: key.nullable(), focusX: coverFocus.default(50), focusY: coverFocus.default(50) };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, text: string) => b.length >= i + text.length && Array.from(text).every((c, n) => b[i + n] === c.charCodeAt(0));
/** Start-of-frame markers carry the image size. C4, C8 and CC share the range but are other segments. */
const startOfFrame = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/** Width and height from the image header, or null when the header is missing, truncated or malformed. */
export function imageDimensions(contentType: string, bytes: Uint8Array): { width: number; height: number } | null {
    if (contentType === 'image/png') {
        if (bytes.length < 24 || !ascii(bytes, 12, 'IHDR')) return null;
        return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (contentType === 'image/webp') {
        if (bytes.length < 30 || !ascii(bytes, 0, 'RIFF') || !ascii(bytes, 8, 'WEBP')) return null;
        if (ascii(bytes, 12, 'VP8X')) return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
        if (ascii(bytes, 12, 'VP8 ')) return bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a
            ? { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff } : null;
        if (ascii(bytes, 12, 'VP8L')) {
            if (bytes[20] !== 0x2f) return null;
            const bits = (bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24)) >>> 0;
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
        return null;
    }
    if (contentType === 'image/jpeg') {
        let i = 2;
        while (i + 3 < bytes.length) {
            if (bytes[i] !== 0xff) return null;
            const marker = bytes[i + 1];
            if (marker === 0xff) { i++; continue; }
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
            if (marker === 0xd9 || marker === 0xda) return null;
            const length = u16be(bytes, i + 2);
            if (length < 2) return null;
            if (startOfFrame(marker)) return i + 8 < bytes.length ? { width: u16be(bytes, i + 7), height: u16be(bytes, i + 5) } : null;
            i += 2 + length;
        }
        return null;
    }
    return null;
}

/** Magic number plus a sane declared size. It confirms the container and its scale, not that an image is pleasant. */
export function coverBytesAcceptable(contentType: string, head: Uint8Array): boolean {
    if (!isCoverImageType(contentType) || !fileSignatureMatches(contentType, head)) return false;
    const size = imageDimensions(contentType, head);
    return !!size && size.width >= MIN_COVER_EDGE && size.height >= MIN_COVER_EDGE && size.width <= MAX_COVER_EDGE && size.height <= MAX_COVER_EDGE;
}

/** CSS object position for a stored cover. */
export const coverPosition = (cover: Pick<CoverImage, 'focusX' | 'focusY'>) => `${cover.focusX}% ${cover.focusY}%`;
