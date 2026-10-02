import { api, commitDemo, demoState, mode, snapshot } from './data';
import { getDemoFile, putDemoFile, removeDemoFile } from './demo-files';
import { newId, type Upload, type Workspace } from '../../../../packages/contracts/src/index';
import { MAX_RESOURCE_BYTES, SIGNATURE_BYTES, fileSignatureMatches, resourceTypeForFile, type LessonResourceType, type ResourceRef } from '../../../../packages/contracts/src/lesson-resources';
import { beginResourceUpload, clientUpload, completeResourceUpload, discardResourceUpload, resolveResourceDownload } from '../../../../packages/domain/src/resources';
import { DEMO_WORKSHEET_FILE, demoWorksheetPdf } from '../../../../packages/domain/src/demo-files';

/** Lesson files: the same domain rules in both modes. Live bytes go straight to private storage, never through the JSON API. */
export interface ResourceResult { message: string; workspace?: Workspace }
const base = (slug: string) => `/api/organisations/${encodeURIComponent(slug)}`;
const segments = { lesson: 'lessons', draft: 'lesson-drafts', revision: 'lesson-revisions' } as const;
const tenant = (s: Workspace, userId: string) => ({ organizationId: s.organisation.id, userId, requestId: newId() });
const now = () => new Date().toISOString();

export function checkResourceFile(file: File): LessonResourceType {
    const contentType = resourceTypeForFile(file.name, file.type);
    if (!contentType) throw new Error('Use a PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP file.');
    if (!file.size) throw new Error('This file is empty.');
    if (file.size > MAX_RESOURCE_BYTES) throw new Error('Files can be up to 10 MB.');
    return contentType;
}

export async function uploadLessonResource(slug: string, userId: string, trackId: string, file: File): Promise<ResourceResult & { upload: Upload }> {
    const contentType = checkResourceFile(file);
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

export async function resourceUploadsAvailable(): Promise<boolean> {
    if (mode === 'demo') return true;
    return !!(await api<{ resourceUploads?: boolean }>('/api/account/capabilities')).resourceUploads;
}
