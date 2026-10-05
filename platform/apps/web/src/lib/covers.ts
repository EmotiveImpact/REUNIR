import { finishUpload } from './uploads';
import { api, commitDemo, demoState, mode } from './data';
import { getDemoFile, putDemoFile, removeDemoFile } from './demo-files';
import mountainImage from '../assets/library-mountain.jpg';
import { newId, type CoverLibraryItem, type Workspace } from '../../../../packages/contracts/src/index';
import {
    COVER_EDGE, COVER_HEAD_BYTES, COVER_THUMBNAIL_WIDTH, MAX_COVER_BYTES, MAX_COVER_THUMBNAIL_BYTES, MIN_COVER_EDGE, coverBytesAcceptable, coverImageTypes, coverThumbnailAcceptable, imageDimensions,
    type CoverImageType, type CoverLibraryDetails, type CoverSubject, type CoverVariant,
} from '../../../../packages/contracts/src/covers';
import { beginCoverLibraryUpload, beginCoverUpload, completeCoverUpload, removeCoverLibraryItem, updateCoverLibraryItem } from '../../../../packages/domain/src/covers';
import { DEMO_COVER_LIBRARY_FILE } from '../../../../packages/domain/src/demo-files';

/**
 * Cover pictures. The browser resizes every image before upload, which also drops photo metadata such as location.
 * The same domain rules verify the result in both modes; live bytes go straight to private storage.
 */
const base = (slug: string) => `/api/organisations/${encodeURIComponent(slug)}`;
const tenant = (s: Workspace, userId: string) => ({ organizationId: s.organisation.id, userId, requestId: newId() });
const now = () => new Date().toISOString();
/** The largest original the browser will try to read. Only the resized copy is uploaded. */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
/** Decoding is refused above this, so a phone does not run out of memory. Halving steps then stay under canvas limits. */
const MAX_SOURCE_PIXELS = 60_000_000;
/** Transparent areas of a picture saved as JPEG take the plain panel's grey. */
const PANEL = '#171717';
/** Below this longest edge a cover can look soft on a large card. */
const SOFT_EDGE = 800;

/** A smaller copy for cards and lists, drawn from the same picture. */
export interface PreparedThumbnail { blob: Blob; contentType: CoverImageType; width: number; height: number }
export interface PreparedCover { blob: Blob; contentType: CoverImageType; width: number; height: number; soft: boolean; url: string; thumbnail: PreparedThumbnail | null }

interface Decoded { source: CanvasImageSource; width: number; height: number; close: () => void }
async function decode(file: Blob): Promise<Decoded> {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
            return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
        }
        catch { /* Some formats decode only through an image element. */ }
    }
    const url = URL.createObjectURL(file), image = new Image();
    try {
        image.src = url;
        await image.decode();
        return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
    }
    catch { throw new Error('This file could not be read as an image. Try a JPEG, PNG or WebP.'); }
    finally { URL.revokeObjectURL(url); }
}
/** Halve in steps before the final draw, so large photos keep their detail instead of aliasing. */
function draw(image: Decoded, width: number, height: number, fill: string | null): HTMLCanvasElement {
    let source = image.source, w = image.width, h = image.height;
    while (w / 2 >= width && h / 2 >= height) {
        const step = document.createElement('canvas');
        step.width = Math.round(w / 2); step.height = Math.round(h / 2);
        const c = step.getContext('2d')!;
        c.imageSmoothingQuality = 'high'; c.drawImage(source, 0, 0, step.width, step.height);
        source = step; w = step.width; h = step.height;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const c = canvas.getContext('2d')!;
    if (fill) { c.fillStyle = fill; c.fillRect(0, 0, width, height); }
    c.imageSmoothingQuality = 'high'; c.drawImage(source, 0, 0, width, height);
    return canvas;
}
const encode = (canvas: HTMLCanvasElement, type: CoverImageType, quality?: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
const head = async (blob: Blob) => new Uint8Array(await blob.slice(0, COVER_HEAD_BYTES).arrayBuffer());

/** Resize to at most COVER_EDGE on the longest side. PNG stays PNG when it fits, so logos keep transparency. */
export async function prepareCover(file: File): Promise<PreparedCover> {
    if (!file.size) throw new Error('This file is empty.');
    if (file.size > MAX_SOURCE_BYTES) throw new Error('This image is over 30 MB. Choose a smaller one.');
    const start = await head(file);
    const declared = (['image/jpeg', 'image/png', 'image/webp'] as const).map(type => imageDimensions(type, start)).find(Boolean);
    if (declared && declared.width * declared.height > MAX_SOURCE_PIXELS) throw new Error('This image has too many pixels to resize here. Choose one under 60 megapixels.');
    const image = await decode(file);
    try {
        if (Math.min(image.width, image.height) < MIN_COVER_EDGE) throw new Error('This image is too small. Use one at least 16 pixels on each side.');
        if (image.width * image.height > MAX_SOURCE_PIXELS) throw new Error('This image has too many pixels to resize here. Choose one under 60 megapixels.');
        const scale = Math.min(1, COVER_EDGE / Math.max(image.width, image.height));
        const width = Math.max(MIN_COVER_EDGE, Math.round(image.width * scale)), height = Math.max(MIN_COVER_EDGE, Math.round(image.height * scale));
        const attempts: [CoverImageType, number | undefined, string | null][] = [
            ...(file.type === 'image/png' ? [['image/png', undefined, null] as [CoverImageType, undefined, null]] : []),
            ['image/jpeg', 0.86, PANEL], ['image/jpeg', 0.76, PANEL], ['image/jpeg', 0.62, PANEL],
        ];
        let canvas: HTMLCanvasElement | null = null, filled = false;
        for (const [type, quality, fill] of attempts) {
            if (!canvas || filled !== !!fill) { canvas = draw(image, width, height, fill); filled = !!fill; }
            const blob = await encode(canvas, type, quality);
            // The browser's own encoder output is checked with the server's rules before anything is sent.
            if (!blob || blob.size > MAX_COVER_BYTES || blob.type !== type || !coverBytesAcceptable(type, await head(blob))) continue;
            const thumbnail = await prepareThumbnail(image, { width, height });
            return { blob, contentType: type, width, height, soft: Math.max(width, height) < SOFT_EDGE, url: URL.createObjectURL(blob), thumbnail };
        }
        throw new Error('This image could not be prepared for upload. Try another picture.');
    }
    finally { image.close(); }
}

/**
 * Cards and lists show covers a few hundred pixels wide, so they get a copy COVER_THUMBNAIL_WIDTH wide instead of the
 * full picture. WebP keeps transparency where the browser can write it; otherwise JPEG on the panel grey. Pictures
 * already that narrow, or a copy that fails the server's own checks here, simply have none and cards use the full one.
 */
async function prepareThumbnail(image: Decoded, full: { width: number; height: number }): Promise<PreparedThumbnail | null> {
    if (full.width <= COVER_THUMBNAIL_WIDTH) return null;
    const width = COVER_THUMBNAIL_WIDTH, height = Math.round(full.height * width / full.width);
    if (height < MIN_COVER_EDGE) return null;
    const attempts: [CoverImageType, number, string | null][] = [['image/webp', 0.8, null], ['image/jpeg', 0.8, PANEL], ['image/jpeg', 0.6, PANEL]];
    for (const [type, quality, fill] of attempts) {
        try {
            const blob = await encode(draw(image, width, height, fill), type, quality);
            if (!blob || blob.type !== type || blob.size > MAX_COVER_THUMBNAIL_BYTES || !coverThumbnailAcceptable(type, await head(blob), full)) continue;
            return { blob, contentType: type, width, height };
        }
        catch { /* A browser that cannot draw the copy uploads the picture alone. */ }
    }
    return null;
}

/** A cover for one track or project, or a picture for the community's library. */
type Destination = { purpose: 'cover_image'; subject: CoverSubject; subjectId: string } | { purpose: 'cover_library' };
/** Upload a prepared cover and verify it. Returns the file ID to set on the track or project. */
export const uploadCover = (slug: string, userId: string, subject: CoverSubject, subjectId: string, prepared: PreparedCover) =>
    uploadPrepared(slug, userId, { purpose: 'cover_image', subject, subjectId }, prepared);
/** Upload and verify a library picture. Listing it under a name is a separate command. */
export const uploadLibraryPicture = (slug: string, userId: string, prepared: PreparedCover) => uploadPrepared(slug, userId, { purpose: 'cover_library' }, prepared);
/** Fictional demo only: the small copy is kept in this browser beside the picture. */
const demoThumbnailId = (fileId: string) => `${fileId}-thumb`;
type Policy = { url: string; fields: Record<string, string> };
/** Signed policy: exact size and type. No application cookies are sent to storage. */
async function postToStorage(policy: Policy, blob: Blob, type: CoverImageType, name: string) {
    const form = new FormData();
    for (const [field, value] of Object.entries(policy.fields)) form.append(field, value);
    form.append('file', blob, `${name}.${coverImageTypes[type]}`);
    return (await fetch(policy.url, { method: 'POST', body: form, credentials: 'omit' })).ok;
}
async function uploadPrepared(slug: string, userId: string, destination: Destination, prepared: PreparedCover): Promise<{ fileId: string }> {
    const thumb = prepared.thumbnail;
    const request = { ...destination, contentType: prepared.contentType, sizeBytes: prepared.blob.size, ...(thumb ? { thumbnail: { contentType: thumb.contentType, sizeBytes: thumb.blob.size } } : {}) };
    if (mode === 'demo') {
        const id = newId(), ids = { id, objectKey: `browser-demo/${slug}/${id}`, ...(thumb ? { thumbnailObjectKey: `browser-demo/${slug}/${demoThumbnailId(id)}` } : {}) };
        const begun = request.purpose === 'cover_library'
            ? beginCoverLibraryUpload(demoState(slug), tenant(demoState(slug), userId), request, ids, now())
            : beginCoverUpload(demoState(slug), tenant(demoState(slug), userId), request, ids, now());
        commitDemo(slug, begun.workspace);
        for (const old of begun.expired) { forgetDemoCover(slug, old.id); await removeDemoFile(slug, old.id); await removeDemoFile(slug, demoThumbnailId(old.id)); }
        await putDemoFile(slug, id, prepared.blob);
        if (thumb) await putDemoFile(slug, demoThumbnailId(id), thumb.blob);
        const full = imageDimensions(prepared.contentType, await head(prepared.blob));
        const done = completeCoverUpload(demoState(slug), tenant(demoState(slug), userId), id, {
            sizeBytes: prepared.blob.size, contentType: prepared.contentType, generation: '1', bytesAcceptable: coverBytesAcceptable(prepared.contentType, await head(prepared.blob)),
            ...(thumb ? { thumbnail: { sizeBytes: thumb.blob.size, contentType: thumb.contentType, generation: '1', bytesAcceptable: coverThumbnailAcceptable(thumb.contentType, await head(thumb.blob), full) } } : {}),
        }, now());
        commitDemo(slug, done.workspace);
        if (done.outcome === 'rejected' || !done.upload.thumbnailGeneration) await removeDemoFile(slug, demoThumbnailId(id));
        if (done.outcome === 'rejected') {
            await removeDemoFile(slug, id);
            throw new Error('This image is not a JPEG, PNG or WebP of a usable size. Nothing was changed.');
        }
        return { fileId: id };
    }
    const intent = await api<Policy & { id: string; thumbnail?: Policy }>(`${base(slug)}/uploads`, request);
    if (!await postToStorage(intent, prepared.blob, prepared.contentType, 'cover')) throw new Error('Private storage did not accept the image. Try again.');
    // The small copy is a convenience: if storage refuses it, the server finds none and cards show the full picture.
    if (thumb && intent.thumbnail) await postToStorage(intent.thumbnail, thumb.blob, thumb.contentType, 'cover-thumbnail').catch(() => false);
    if (!await finishUpload(slug, intent.id)) throw new Error('The image is still being checked for viruses. Try again in a minute. Nothing was changed.');
    return { fileId: intent.id };
}

/** Remove an unused picture from the library, with its stored file. The server refuses while any cover shows it. */
export async function removeLibraryPicture(slug: string, userId: string, item: CoverLibraryItem): Promise<string> {
    const message = `${item.label} was removed from the cover library.`;
    if (mode === 'demo') {
        const s = demoState(slug), r = removeCoverLibraryItem(s, tenant(s, userId), item.id, now());
        const note = commitDemo(slug, r.workspace);
        forgetDemoCover(slug, item.fileId); await removeDemoFile(slug, item.fileId); await removeDemoFile(slug, demoThumbnailId(item.fileId));
        return message + note;
    }
    await api(`${base(slug)}/cover-library/${encodeURIComponent(item.id)}/remove`, {});
    return message;
}

/** Rename a library picture or change its tags. Covers that show it keep showing it. */
export async function saveLibraryDetails(slug: string, userId: string, item: CoverLibraryItem, details: CoverLibraryDetails): Promise<string> {
    const message = `${details.label} is saved.`;
    if (mode === 'demo') {
        const s = demoState(slug), r = updateCoverLibraryItem(s, tenant(s, userId), item.id, details, now());
        if (!r.changed) return 'Nothing changed.';
        return message + commitDemo(slug, r.workspace);
    }
    const r = await api<{ changed: boolean }>(`${base(slug)}/cover-library/${encodeURIComponent(item.id)}/details`, details);
    return r.changed ? message : 'Nothing changed.';
}

export async function coverUploadsAvailable(): Promise<boolean> {
    if (mode === 'demo') return true;
    return !!(await api<{ coverUploads?: boolean }>('/api/account/capabilities')).coverUploads;
}

/**
 * Live covers come from the same-origin route, which checks access on every request. The thumbnail address serves the
 * small copy, or the full picture for covers that have none.
 */
export const liveCoverUrl = (slug: string, kind: CoverSubject, subjectId: string, fileId: string, variant: CoverVariant = 'full') =>
    `${base(slug)}/covers/${kind}/${encodeURIComponent(subjectId)}/${encodeURIComponent(fileId)}${variant === 'thumbnail' ? '/thumbnail' : ''}`;
/** Library pictures are served to every active member of the community. */
export const liveLibraryUrl = (slug: string, itemId: string, variant: CoverVariant = 'full') => `${base(slug)}/cover-library/${encodeURIComponent(itemId)}${variant === 'thumbnail' ? '/thumbnail' : ''}`;

/** Fictional demo only: object URLs for covers stored in this browser, kept for the session. */
const demoUrls = new Map<string, Promise<string | null>>(), resolvedDemoUrls = new Map<string, string | null>();
const demoKey = (slug: string, fileId: string, variant: CoverVariant = 'full') => `${slug}/${fileId}/${variant}`;
/** The small copy when this browser holds one, otherwise the picture itself, as the live route does. */
export function demoCoverUrl(slug: string, fileId: string, variant: CoverVariant = 'full'): Promise<string | null> {
    // The fictional library picture is the bundled photograph; nothing is stored for it.
    if (fileId === DEMO_COVER_LIBRARY_FILE) return Promise.resolve(mountainImage);
    const key = demoKey(slug, fileId, variant);
    let url = demoUrls.get(key);
    if (!url) {
        const stored = variant === 'thumbnail' ? getDemoFile(slug, demoThumbnailId(fileId)).then(blob => blob ?? getDemoFile(slug, fileId)) : getDemoFile(slug, fileId);
        url = stored.then(blob => blob ? URL.createObjectURL(blob) : null);
        url.then(value => { if (demoUrls.get(key) === url) resolvedDemoUrls.set(key, value); });
        demoUrls.set(key, url);
    }
    return url;
}
/** A URL that has already been resolved, so a cover seen before renders without a blank frame. */
export const peekDemoCoverUrl = (slug: string, fileId: string, variant: CoverVariant = 'full') => fileId === DEMO_COVER_LIBRARY_FILE ? mountainImage : resolvedDemoUrls.get(demoKey(slug, fileId, variant));
function forgetDemoCover(slug: string, fileId: string) {
    for (const variant of ['full', 'thumbnail'] as const) {
        const key = demoKey(slug, fileId, variant), url = resolvedDemoUrls.get(key);
        if (url) URL.revokeObjectURL(url);
        demoUrls.delete(key); resolvedDemoUrls.delete(key);
    }
}
export function forgetDemoCovers() {
    for (const url of resolvedDemoUrls.values()) if (url) URL.revokeObjectURL(url);
    demoUrls.clear(); resolvedDemoUrls.clear();
}
if (typeof window !== 'undefined') window.addEventListener('reunir:reset-demo', forgetDemoCovers);
