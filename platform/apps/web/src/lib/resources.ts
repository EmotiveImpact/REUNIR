import { api, commitDemo, demoState, mode, snapshot } from './data';
import { getDemoFile, putDemoFile, removeDemoFile } from './demo-files';
import { newId, type Upload, type Workspace } from '../../../../packages/contracts/src/index';
import { MAX_VIDEO_BYTES, RESOURCE_TYPES_HINT, SIGNATURE_BYTES, fileSignatureMatches, isLessonVideo, resourceSizeProblem, resourceTypeForFile, type LessonResourceType, type ResourceRef } from '../../../../packages/contracts/src/lesson-resources';
import { beginResourceUpload, clientUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload } from '../../../../packages/domain/src/resources';
import { DEMO_WORKSHEET_FILE, demoWorksheetPdf } from '../../../../packages/domain/src/demo-files';

/** Lesson files: the same domain rules in both modes. Live bytes go straight to private storage, never through the JSON API. */
export interface ResourceResult { message: string; workspace?: Workspace }
const base = (slug: string) => `/api/organisations/${encodeURIComponent(slug)}`;
const segments = { lesson: 'lessons', draft: 'lesson-drafts', revision: 'lesson-revisions' } as const;
const tenant = (s: Workspace, userId: string) => ({ organizationId: s.organisation.id, userId, requestId: newId() });
const now = () => new Date().toISOString();

/** `videoBytes` is the server's video limit, 0 when video is off. The server checks again either way. */
export function checkResourceFile(file: File, videoBytes = 0): LessonResourceType {
    const contentType = resourceTypeForFile(file.name, file.type);
    if (!contentType) throw new Error(RESOURCE_TYPES_HINT);
    const problem = resourceSizeProblem(contentType, file.size, videoBytes);
    if (problem) throw new Error(problem);
    return contentType;
}

export async function uploadLessonResource(slug: string, userId: string, trackId: string, file: File, videoBytes = 0): Promise<ResourceResult & { upload: Upload }> {
    // The fictional preview keeps bytes in this browser, so it shows video at the largest size a server could allow.
    const contentType = checkResourceFile(file, mode === 'demo' ? MAX_VIDEO_BYTES : videoBytes);
    const request = { purpose: 'lesson_resource' as const, trackId, name: file.name.slice(0, 160), contentType, sizeBytes: file.size };
    if (mode === 'demo') {
        const id = newId();
        const begun = beginResourceUpload(demoState(slug), tenant(demoState(slug), userId), request, { id, objectKey: `browser-demo/${slug}/${id}` }, now());
        let note = commitDemo(slug, begun.workspace);
        for (const old of begun.expired) await removeDemoFile(slug, old.id);
        await putDemoFile(slug, id, file);
        const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
        const done = completeResourceUpload(demoState(slug), tenant(demoState(slug), userId), id, { sizeBytes: file.size, contentType, generation: '1', signatureMatches: fileSignatureMatches(contentType, head) }, now());
        note = commitDemo(slug, done.workspace) || note;
        if (done.outcome === 'rejected') {
            await removeDemoFile(slug, id);
            throw new Error('This file does not match its type, so nothing was attached.');
        }
        return { upload: clientUpload(done.upload), message: 'Uploaded privately to this browser. Save the draft to keep it.' + note, workspace: snapshot(slug, userId) };
    }
    const intent = await api<{ id: string; url: string; fields: Record<string, string> }>(`${base(slug)}/uploads`, request);
    const form = new FormData();
    for (const [name, value] of Object.entries(intent.fields)) form.append(name, value);
    form.append('file', file);
    // Signed policy: exact size and type. No application cookies are sent to storage.
    const stored = await fetch(intent.url, { method: 'POST', body: form, credentials: 'omit' });
    if (!stored.ok) throw new Error('Private storage did not accept the file. Try again.');
    const done = await api<{ upload: Upload }>(`${base(slug)}/uploads/${encodeURIComponent(intent.id)}/complete`, {});
    return { upload: done.upload, message: 'Uploaded privately. Save the draft to keep it.' };
}

export async function discardLessonUpload(slug: string, userId: string, uploadId: string): Promise<ResourceResult> {
    if (mode === 'demo') {
        const s = demoState(slug), r = discardResourceUpload(s, tenant(s, userId), uploadId, now());
        const note = commitDemo(slug, r.workspace);
        await removeDemoFile(slug, r.id);
        return { message: 'Upload discarded.' + note, workspace: snapshot(slug, userId) };
    }
    await api(`${base(slug)}/uploads/${encodeURIComponent(uploadId)}/discard`, {});
    return { message: 'Upload discarded.' };
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** Returns the download name. Access is decided by the server (or the shared rules in the demo). */
export async function downloadLessonResource(slug: string, userId: string, ref: ResourceRef): Promise<string> {
    if (mode === 'demo') {
        const s = demoState(slug), target = resolveResourceDownload(s, tenant(s, userId), ref);
        const stored = await getDemoFile(slug, target.upload.id) ?? (target.upload.id === DEMO_WORKSHEET_FILE ? new Blob([demoWorksheetPdf()]) : undefined);
        if (!stored) throw new Error('This fictional file is no longer stored in this browser. Upload it again.');
        saveBlob(new Blob([stored], { type: target.upload.contentType }), target.filename);
        return target.filename;
    }
    const r = await api<{ url: string; filename: string }>(`${base(slug)}/${segments[ref.context]}/${encodeURIComponent(ref.recordId)}/resources/${encodeURIComponent(ref.resourceId)}/download`);
    // Two-minute signed link with attachment disposition: the page stays where it is.
    window.location.assign(r.url);
    return r.filename;
}

/**
 * A playable address for a lesson video. Live, it is a signed link that plays in the page for two hours; in the
 * fictional preview it is this browser's copy of the bytes. Access is decided exactly as for a download.
 */
export async function playLessonResource(slug: string, userId: string, ref: ResourceRef): Promise<string> {
    if (mode === 'demo') {
        const s = demoState(slug), target = resolveResourceDownload(s, tenant(s, userId), ref);
        if (!isLessonVideo(target.upload.contentType)) throw new Error('Only lesson videos play in the page. Download this file instead.');
        const stored = await getDemoFile(slug, target.upload.id);
        if (!stored) throw new Error('This fictional video is no longer stored in this browser. Upload it again.');
        return URL.createObjectURL(new Blob([stored], { type: target.upload.contentType }));
    }
    return (await api<{ url: string }>(`${base(slug)}/${segments[ref.context]}/${encodeURIComponent(ref.recordId)}/resources/${encodeURIComponent(ref.resourceId)}/play`)).url;
}

export interface UploadLimits { uploads: boolean; videoBytes: number }
export async function resourceUploadLimits(): Promise<UploadLimits> {
    if (mode === 'demo') return { uploads: true, videoBytes: MAX_VIDEO_BYTES };
    const c = await api<{ resourceUploads?: boolean; videoUploadBytes?: number }>('/api/account/capabilities');
    return { uploads: !!c.resourceUploads, videoBytes: c.resourceUploads ? Math.max(0, Number(c.videoUploadBytes) || 0) : 0 };
}
