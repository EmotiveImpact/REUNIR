import { api } from './data';

/**
 * Completes a live upload. Where the server scans uploads, a file that passes its quick checks waits for the virus scan
 * worker and the server answers `scanning`; this asks again, a little less often each time, until the file is ready or
 * refused. It gives up waiting after `patienceMs` and resolves `null`: the server still completes the file once it has
 * been checked, so nothing is lost by leaving the page.
 */
export async function finishUpload<T extends object>(slug: string, uploadId: string, patienceMs = 120_000): Promise<T | null> {
    const path = `/api/organisations/${encodeURIComponent(slug)}/uploads/${encodeURIComponent(uploadId)}/complete`;
    const started = Date.now();
    for (let wait = 1000; ; wait = Math.min(5000, Math.round(wait * 1.5))) {
        const done = await api<T & { status?: string }>(path, {});
        if (done.status !== 'scanning') return done;
        if (Date.now() - started + wait > patienceMs) return null;
        await new Promise(resolve => window.setTimeout(resolve, wait));
    }
}
/** Two minutes, and a second more for each megabyte, so a large video has time to be read and checked. */
export const scanPatienceMs = (sizeBytes: number) => 120_000 + Math.ceil(sizeBytes / (1024 * 1024)) * 1000;
