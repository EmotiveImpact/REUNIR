import { demoState, mode } from './data';
import { newId } from '../../../../packages/contracts/src/index';
import { learningRecord, learningRecordFilename } from '../../../../packages/domain/src/learning-record';

/** Hand a file to the browser's own download, then let go of it. */
function save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** The name the server chose, read from its attachment header; a dated fallback otherwise. */
const filenameFrom = (header: string | null, slug: string) => /filename="([^"]+)"/.exec(header ?? '')?.[1] ?? learningRecordFilename(slug, new Date().toISOString());

/**
 * Download the member's own learning record. The demo builds it in the browser with the same rules; live mode asks the
 * server, which reads it inside the member's own tenant transaction. Returns a short confirmation for the toast.
 */
export async function downloadLearningRecord(slug: string, userId: string): Promise<string> {
    if (mode === 'demo') {
        const s = demoState(slug), now = new Date().toISOString();
        const record = learningRecord(s, { organizationId: s.organisation.id, userId, requestId: newId() }, now);
        save(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), learningRecordFilename(slug, now));
        return 'Your learning record is downloading. It was made in this browser from fictional demo data.';
    }
    const res = await fetch(`/api/organisations/${encodeURIComponent(slug)}/me/learning-record`, { credentials: 'include' });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        const message = await res.json().then(d => d?.error?.message as string | undefined).catch(() => undefined);
        throw new Error(message || 'Your learning record could not be prepared. Try again.');
    }
    save(await res.blob(), filenameFrom(res.headers.get('content-disposition'), slug));
    return 'Your learning record is downloading.';
}
