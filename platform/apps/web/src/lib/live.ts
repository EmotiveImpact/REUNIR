import { useEffect, useRef, useState } from 'react';
import { demoState, mode, syncDemo } from './data';
import { newId } from '../../../../packages/contracts/src/index';
import { CHANGE_POLL_MAX_MS, CHANGE_POLL_MS } from '../../../../packages/contracts/src/task-files';
import { projectWorkVersion } from '../../../../packages/domain/src/task-files';

/**
 * Live project work without new infrastructure. A change source answers one question, "has anything on this project's
 * board changed?", and the hook below asks it while the board is open. Today the source is a cheap poll of a fingerprint
 * (an empty 304 when nothing changed); a server-sent events stream or a hosted pub/sub channel can replace it behind the
 * same `watchProjectChanges` signature without touching the page.
 */
export type LiveState = 'live' | 'paused' | 'retrying';
interface ChangeSource { check(): Promise<string> }

function pollingSource(slug: string, userId: string, projectId: string): ChangeSource {
    if (mode === 'demo') return {
        // Another tab of the demo writes to this browser's storage; adopt it, then fingerprint as the server would.
        async check() { syncDemo(slug); const s = demoState(slug); return projectWorkVersion(s, { organizationId: s.organisation.id, userId, requestId: newId() }, projectId); },
    };
    let tag = '', version = '';
    return {
        async check() {
            const res = await fetch(`/api/organisations/${encodeURIComponent(slug)}/projects/${encodeURIComponent(projectId)}/changes`, { credentials: 'include', cache: 'no-store', headers: tag ? { 'If-None-Match': tag } : {} });
            if (res.status === 304) return version;
            if (!res.ok) throw Object.assign(new Error('Change check failed.'), { status: res.status });
            tag = res.headers.get('etag') || '';
            version = String((await res.json()).version);
            return version;
        },
    };
}

/**
 * Calls `onChange` when the fingerprint moves after the first answer. Asks every few seconds while the tab is visible,
 * stops while it is hidden and asks again as soon as it is shown, and backs off (doubling, up to a minute) after errors.
 * Returns a function that stops watching.
 */
export function watchProjectChanges(slug: string, userId: string, projectId: string, onChange: () => void, onState: (state: LiveState) => void = () => {}): () => void {
    const source = pollingSource(slug, userId, projectId);
    let stopped = false, timer = 0, delay = CHANGE_POLL_MS, last: string | null = null, running = false;
    const schedule = (ms: number) => { window.clearTimeout(timer); if (!stopped && !document.hidden) timer = window.setTimeout(tick, ms); };
    async function tick() {
        if (stopped || running) return;
        if (document.hidden) { onState('paused'); return; }
        running = true;
        try {
            const version = await source.check();
            if (stopped) return;
            if (last !== null && version !== last) onChange();
            last = version; delay = CHANGE_POLL_MS; onState('live');
        }
        catch { delay = Math.min(delay * 2, CHANGE_POLL_MAX_MS); if (!stopped) onState('retrying'); }
        finally { running = false; schedule(delay); }
    }
    const visibility = () => { if (document.hidden) { window.clearTimeout(timer); onState('paused'); } else void tick(); };
    document.addEventListener('visibilitychange', visibility);
    void tick();
    return () => { stopped = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
}

/**
 * While a project's board or one of its tasks is open: watch for changes, refresh when there is one, and report when
 * someone else's change arrived. `refresh` resolves to true when it brought different work onto the screen, so the
 * person's own saves (already on screen) never read as someone else's update.
 */
export function useProjectChanges(slug: string, userId: string, projectId: string | undefined, refresh: () => Promise<boolean>) {
    const [state, setState] = useState<LiveState>('live');
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);
    const latest = useRef(refresh);
    latest.current = refresh;
    useEffect(() => {
        if (!projectId) return;
        setUpdatedAt(null);
        return watchProjectChanges(slug, userId, projectId, () => { void latest.current().then(changed => { if (changed) setUpdatedAt(Date.now()); }, () => {}); }, setState);
    }, [slug, userId, projectId]);
    return { state, updatedAt };
}
