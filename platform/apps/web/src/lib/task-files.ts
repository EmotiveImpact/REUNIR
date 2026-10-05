import { api, commitDemo, demoState, mode, syncDemo } from './data';
import { getDemoFile, putDemoFile, removeDemoFile } from './demo-files';
import { checkResourceFile } from './resources';
import { finishUpload, scanPatienceMs } from './uploads';
import { newId, type Workspace } from '../../../../packages/contracts/src/index';
import { SIGNATURE_BYTES, fileSignatureMatches } from '../../../../packages/contracts/src/lesson-resources';
import { beginTaskFileUpload, completeTaskFileUpload, resolveTaskFileDownload } from '../../../../packages/domain/src/task-files';

/**
 * Task files: the lesson-file pipeline with a task as the scope. Live bytes go straight to private storage with a signed
 * policy and are verified by the server; the demo runs the same domain rules and keeps bytes in this browser.
 */
const base = (slug: string) => `/api/organisations/${encodeURIComponent(slug)}`;
const tenant = (s: Workspace, userId: string) => ({ organizationId: s.organisation.id, userId, requestId: newId() });
const now = () => new Date().toISOString();

export async function uploadTaskFile(slug: string, userId: string, taskId: string, file: File): Promise<string> {
    const contentType = checkResourceFile(file);
    const request = { purpose: 'task_file' as const, taskId, name: file.name.slice(0, 160), contentType, sizeBytes: file.size };
    if (mode === 'demo') {
        syncDemo(slug);
        const id = newId();
        const begun = beginTaskFileUpload(demoState(slug), tenant(demoState(slug), userId), request, { id, objectKey: () => `browser-demo/${slug}/${id}` }, now());
        let note = commitDemo(slug, begun.workspace);
        for (const old of begun.expired) await removeDemoFile(slug, old.id);
        await putDemoFile(slug, id, file);
        const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
        const done = completeTaskFileUpload(demoState(slug), tenant(demoState(slug), userId), id, { sizeBytes: file.size, contentType, generation: '1', signatureMatches: fileSignatureMatches(contentType, head) }, now());
        note = commitDemo(slug, done.workspace) || note;
        if (done.outcome === 'rejected') {
            await removeDemoFile(slug, id);
            throw new Error('This file does not match its type, so nothing was attached.');
        }
        return `${file.name} attached. It is stored in this browser only.` + note;
    }
    const intent = await api<{ id: string; url: string; fields: Record<string, string> }>(`${base(slug)}/uploads`, request);
    const form = new FormData();
    for (const [name, value] of Object.entries(intent.fields)) form.append(name, value);
    form.append('file', file);
    // Signed policy: exact size and type. No application cookies are sent to storage.
    const stored = await fetch(intent.url, { method: 'POST', body: form, credentials: 'omit' });
    if (!stored.ok) throw new Error('Private storage did not accept the file. Try again.');
    if (!await finishUpload(slug, intent.id, scanPatienceMs(file.size))) return `${file.name} is uploaded and still being checked for viruses. It will appear on the task once it is ready.`;
    return `${file.name} attached for the project team.`;
}

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/** Returns the download name. Access is decided by the server (or the shared rules in the demo) at the moment of asking. */
export async function downloadTaskFile(slug: string, userId: string, taskId: string, fileId: string): Promise<string> {
    if (mode === 'demo') {
        syncDemo(slug);
        const s = demoState(slug), target = resolveTaskFileDownload(s, tenant(s, userId), taskId, fileId);
        const stored = await getDemoFile(slug, target.upload.id);
        if (!stored) throw new Error('This fictional file is no longer stored in this browser. Attach it again.');
        saveBlob(new Blob([stored], { type: target.upload.contentType }), target.filename);
        return target.filename;
    }
    const r = await api<{ url: string; filename: string }>(`${base(slug)}/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(fileId)}/download`);
    // Two-minute signed link with attachment disposition: the page stays where it is.
    window.location.assign(r.url);
    return r.filename;
}
/** After the removal command: the demo deletes this browser's copy, as the server deletes the stored object. */
export async function forgetTaskFile(slug: string, fileId: string) { if (mode === 'demo') await removeDemoFile(slug, fileId); }
