import { DomainError } from '../../../packages/contracts/src/index';
import { SIGNATURE_BYTES, fileSignatureMatches } from '../../../packages/contracts/src/lesson-resources';
import { COVER_HEAD_BYTES, coverBytesAcceptable, coverThumbnailAcceptable, imageDimensions } from '../../../packages/contracts/src/covers';
import type { WorkspaceRepository } from '../../../packages/db/src/repository';
import type { ScanQueue, ScanState } from '../../../packages/db/src/scans';
import { clientUpload, type StoredObservation } from '../../../packages/domain/src/resources';
import type { CoverObservation } from '../../../packages/domain/src/covers';
import { isMissingObject, type PrivateStorage, type StoredObject } from './storage';

/** What completing an upload came to: ready to use, or still waiting for the scan worker's verdict. */
export type Completion =
    | { id: string; status: 'ready'; upload?: ReturnType<typeof clientUpload> }
    | { id: string; status: 'scanning' };
export const FLAGGED_MESSAGE = 'This file was flagged by the virus scanner and has been deleted. Nothing was changed.';
const flagged = () => new DomainError('FILE_FLAGGED', FLAGGED_MESSAGE, 422);
const changed = () => new DomainError('UPLOAD_CHANGED', 'The file changed while it was being checked. Upload it again.', 409);

/**
 * Completes an upload for the person who made it (decision 042). The quick checks (stored size, type, generation and the
 * first bytes) run here. With scanning on, a file that passes them waits for the scan worker: this returns `scanning`
 * until a verdict exists for exactly the generation just measured, and only then lets the domain make the upload ready.
 * The browser calls this again while it waits, and the worker calls it once it has a verdict, so the upload completes
 * whether or not the person is still on the page. Either way the uploader's authority is checked as it stands then.
 */
export function uploadCompletion({ repository, storage, scans, remove }: {
    repository: WorkspaceRepository;
    storage: PrivateStorage;
    /** Present when uploads must be scanned before use. */
    scans?: ScanQueue;
    /** Deletes stored objects nothing will serve, logging rather than throwing. */
    remove: (requestId: string, keys: string[]) => Promise<void>;
}) {
    return async function complete(slug: string, who: string, id: string, requestId: string): Promise<Completion> {
        const intent = await repository.uploadIntent(slug, who, id);
        const key = String(intent.object_key);
        const state = scans && intent.status !== 'ready' ? await scans.state(slug, who, id) : null;
        // A file the scanner flagged says so every time it is asked about, never only the first time.
        if (intent.status === 'rejected' && state?.status === 'flagged') throw flagged();
        /** Stored size, type and generation, and the first bytes of exactly that generation. */
        const inspect = async (objectKey: string, size: number, contentType: string, bytes: number, missingIsChange: boolean) => {
            const meta = await storage.metadata(objectKey);
            if (!meta) return null;
            const matches = meta.size === size && meta.contentType === contentType && !!meta.generation;
            let head: Uint8Array = new Uint8Array();
            if (matches) {
                try { head = await storage.head(objectKey, Math.min(bytes, meta.size), meta.generation!); }
                catch (error) {
                    if (!isMissingObject(error)) throw error;
                    if (missingIsChange) throw changed();
                    return { meta, matches: false, head };
                }
            }
            return { meta, matches, head };
        };
        /**
         * The verdict for these generations, or 'scanning' after asking for one. Without scanning everything is clean. A
         * verdict for an earlier generation does not count: the file is scanned again as it now stands.
         */
        const verdict = async (meta: StoredObject, sizeBytes: number, thumbnail: { objectKey: string; meta: StoredObject } | null): Promise<'scanning' | { clean: boolean; thumbnailClean: boolean }> => {
            if (!scans) return { clean: true, thumbnailClean: true };
            const thumbGeneration = thumbnail?.meta.generation ?? null;
            if (!state || state.generation !== meta.generation || state.thumbnailGeneration !== thumbGeneration) {
                await scans.request(slug, who, id, { generation: meta.generation!, sizeBytes, thumbnail: thumbnail ? { objectKey: thumbnail.objectKey, generation: thumbGeneration!, sizeBytes: thumbnail.meta.size } : null });
                return 'scanning';
            }
            return waiting(state) ? 'scanning' : { clean: state.status === 'clean', thumbnailClean: state.thumbnailClean !== false };
        };
        const missing = () => new DomainError('UPLOAD_MISSING', 'The file has not reached private storage. Try uploading it again.', 409);

        if (intent.purpose === 'cover_image' || intent.purpose === 'cover_library') {
            let observed: CoverObservation = { sizeBytes: 0, contentType: '', generation: null, bytesAcceptable: false }, infected = false;
            if (intent.status === 'pending') {
                const main = await inspect(key, Number(intent.size_bytes), String(intent.content_type), COVER_HEAD_BYTES, true);
                if (!main) throw missing();
                const passes = main.matches && coverBytesAcceptable(String(intent.content_type), main.head);
                observed = { sizeBytes: main.meta.size, contentType: main.meta.contentType, generation: main.meta.generation ?? null, bytesAcceptable: passes };
                // The small copy is checked the same way, pinned to its own generation, and must be the same picture's shape.
                const thumbKey = intent.thumbnail_object_key ? String(intent.thumbnail_object_key) : null;
                let thumbPasses: { objectKey: string; meta: StoredObject } | null = null;
                if (thumbKey && passes) {
                    const thumb = await inspect(thumbKey, Number(intent.thumbnail_size_bytes), String(intent.thumbnail_content_type), COVER_HEAD_BYTES, false);
                    if (!thumb) observed.thumbnail = null;
                    else {
                        const ok = thumb.matches && coverThumbnailAcceptable(String(intent.thumbnail_content_type), thumb.head, imageDimensions(String(intent.content_type), main.head));
                        observed.thumbnail = { sizeBytes: thumb.meta.size, contentType: thumb.meta.contentType, generation: thumb.meta.generation ?? null, bytesAcceptable: ok };
                        if (ok) thumbPasses = { objectKey: thumbKey, meta: thumb.meta };
                    }
                }
                if (passes) {
                    const v = await verdict(main.meta, Number(intent.size_bytes), thumbPasses);
                    if (v === 'scanning') return { id, status: 'scanning' };
                    infected = !v.clean;
                    observed.bytesAcceptable = v.clean;
                    if (observed.thumbnail && thumbPasses && !v.thumbnailClean) observed.thumbnail.bytesAcceptable = false;
                }
            }
            const result = await repository.completeCoverUpload(slug, who, id, observed, requestId);
            // A refused picture goes with its small copy; a small copy that failed alone, or was flagged, goes and the picture stays.
            await remove(requestId, result.discarded);
            if (result.outcome === 'rejected') {
                if (infected) throw flagged();
                throw new DomainError('FILE_MISMATCH', 'This image is not a JPEG, PNG or WebP of a usable size. Nothing was changed.');
            }
            return { id, status: 'ready', upload: clientUpload(result.upload) };
        }
        // Task files share the lesson-file verification and virus scan below, so any later check on this path covers both.
        if (intent.purpose === 'lesson_resource' || intent.purpose === 'task_file') {
            let observed: StoredObservation = { sizeBytes: 0, contentType: '', generation: null, signatureMatches: false }, infected = false;
            if (intent.status === 'pending') {
                // Read only the first bytes, pinned to the generation that was just measured. The scan worker reads the rest.
                const found = await inspect(key, Number(intent.size_bytes), String(intent.content_type), SIGNATURE_BYTES, true);
                if (!found) throw missing();
                const passes = found.matches && fileSignatureMatches(String(intent.content_type), found.head);
                observed = { sizeBytes: found.meta.size, contentType: found.meta.contentType, generation: found.meta.generation ?? null, signatureMatches: passes };
                if (passes) {
                    const v = await verdict(found.meta, Number(intent.size_bytes), null);
                    if (v === 'scanning') return { id, status: 'scanning' };
                    infected = !v.clean;
                    observed.signatureMatches = v.clean;
                }
            }
            const result = intent.purpose === 'task_file' ? await repository.completeTaskFileUpload(slug, who, id, observed, requestId) : await repository.completeResourceUpload(slug, who, id, observed, requestId);
            if (result.outcome === 'rejected') {
                await remove(requestId, [key]);
                if (infected) throw flagged();
                throw new DomainError('FILE_MISMATCH', 'This file does not match its declared type and size. Nothing was attached.');
            }
            return { id, status: 'ready', upload: clientUpload(result.upload) };
        }
        // Member attachments. A rejected file stays rejected, so a second upload under the same policy cannot slip past the scanner.
        if (intent.status === 'rejected')
            throw new DomainError('FILE_REJECTED', 'This file did not pass verification. Choose it again.', 409);
        if (intent.status === 'ready') return { id, status: 'ready' };
        const meta = await storage.metadata(key);
        if (!meta) throw missing();
        if (meta.size !== Number(intent.size_bytes) || meta.contentType !== intent.content_type) {
            await repository.markUpload(slug, who, id, 'rejected');
            throw new DomainError('FILE_MISMATCH', 'The uploaded file does not match the permitted type and size.');
        }
        if (scans && !meta.generation) throw changed();
        const v = await verdict(meta, Number(intent.size_bytes), null);
        if (v === 'scanning') return { id, status: 'scanning' };
        if (!v.clean) {
            await repository.markUpload(slug, who, id, 'rejected');
            await remove(requestId, [key]);
            throw flagged();
        }
        // The generation that was scanned is the one served.
        await repository.markUpload(slug, who, id, 'ready', meta.generation ?? null);
        return { id, status: 'ready' };
    };
}
const waiting = (state: ScanState) => state.status === 'queued' || state.status === 'scanning';
export type CompleteUpload = ReturnType<typeof uploadCompletion>;
