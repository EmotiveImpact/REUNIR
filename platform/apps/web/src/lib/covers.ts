import { api, commitDemo, demoState, mode } from './data';
import { getDemoFile, putDemoFile, removeDemoFile } from './demo-files';
import { newId, type Workspace } from '../../../../packages/contracts/src/index';
import { COVER_EDGE, COVER_HEAD_BYTES, MAX_COVER_BYTES, MIN_COVER_EDGE, coverBytesAcceptable, coverImageTypes, imageDimensions, type CoverImageType, type CoverSubject } from '../../../../packages/contracts/src/covers';
import { beginCoverUpload, completeCoverUpload } from '../../../../packages/domain/src/covers';

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

export interface PreparedCover { blob: Blob; contentType: CoverImageType; width: number; height: number; soft: boolean; url: string }

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
            return { blob, contentType: type, width, height, soft: Math.max(width, height) < SOFT_EDGE, url: URL.createObjectURL(blob) };
        }
        throw new Error('This image could not be prepared for upload. Try another picture.');
    }
    finally { image.close(); }
}

/** Upload a prepared cover and verify it. Returns the file ID to set on the track or project. */
export async function uploadCover(slug: string, userId: string, subject: CoverSubject, subjectId: string, prepared: PreparedCover): Promise<{ fileId: string }> {
    const request = { purpose: 'cover_image' as const, subject, subjectId, contentType: prepared.contentType, sizeBytes: prepared.blob.size };
    if (mode === 'demo') {
        const id = newId();
        const begun = beginCoverUpload(demoState(slug), tenant(demoState(slug), userId), request, { id, objectKey: `browser-demo/${slug}/${id}` }, now());
        commitDemo(slug, begun.workspace);
        for (const old of begun.expired) { forgetDemoCover(slug, old.id); await removeDemoFile(slug, old.id); }
        await putDemoFile(slug, id, prepared.blob);
        const done = completeCoverUpload(demoState(slug), tenant(demoState(slug), userId), id, { sizeBytes: prepared.blob.size, contentType: prepared.contentType, generation: '1', bytesAcceptable: coverBytesAcceptable(prepared.contentType, await head(prepared.blob)) }, now());
        commitDemo(slug, done.workspace);
        if (done.outcome === 'rejected') {
            await removeDemoFile(slug, id);
            throw new Error('This image is not a JPEG, PNG or WebP of a usable size. Nothing was changed.');
        }
        return { fileId: id };
    }
    const intent = await api<{ id: string; url: string; fields: Record<string, string> }>(`${base(slug)}/uploads`, request);
    const form = new FormData();
    for (const [name, value] of Object.entries(intent.fields)) form.append(name, value);
    form.append('file', prepared.blob, `cover.${coverImageTypes[prepared.contentType]}`);
    // Signed policy: exact size and type. No application cookies are sent to storage.
    const stored = await fetch(intent.url, { method: 'POST', body: form, credentials: 'omit' });
    if (!stored.ok) throw new Error('Private storage did not accept the image. Try again.');
    await api(`${base(slug)}/uploads/${encodeURIComponent(intent.id)}/complete`, {});
    return { fileId: intent.id };
}

export async function coverUploadsAvailable(): Promise<boolean> {
    if (mode === 'demo') return true;
    return !!(await api<{ coverUploads?: boolean }>('/api/account/capabilities')).coverUploads;
}

/** Live covers come from the same-origin route, which checks access on every request. */
export const liveCoverUrl = (slug: string, kind: CoverSubject, subjectId: string, fileId: string) =>
    `${base(slug)}/covers/${kind}/${encodeURIComponent(subjectId)}/${encodeURIComponent(fileId)}`;

/** Fictional demo only: object URLs for covers stored in this browser, kept for the session. */
const demoUrls = new Map<string, Promise<string | null>>(), resolvedDemoUrls = new Map<string, string | null>();
const demoKey = (slug: string, fileId: string) => `${slug}/${fileId}`;
export function demoCoverUrl(slug: string, fileId: string): Promise<string | null> {
    const key = demoKey(slug, fileId);
    let url = demoUrls.get(key);
    if (!url) {
        url = getDemoFile(slug, fileId).then(blob => blob ? URL.createObjectURL(blob) : null);
        url.then(value => { if (demoUrls.get(key) === url) resolvedDemoUrls.set(key, value); });
        demoUrls.set(key, url);
    }
    return url;
}
/** A URL that has already been resolved, so a cover seen before renders without a blank frame. */
export const peekDemoCoverUrl = (slug: string, fileId: string) => resolvedDemoUrls.get(demoKey(slug, fileId));
function forgetDemoCover(slug: string, fileId: string) {
    const key = demoKey(slug, fileId), url = resolvedDemoUrls.get(key);
    if (url) URL.revokeObjectURL(url);
    demoUrls.delete(key); resolvedDemoUrls.delete(key);
}
export function forgetDemoCovers() {
    for (const url of resolvedDemoUrls.values()) if (url) URL.revokeObjectURL(url);
    demoUrls.clear(); resolvedDemoUrls.clear();
}
if (typeof window !== 'undefined') window.addEventListener('reunir:reset-demo', forgetDemoCovers);
