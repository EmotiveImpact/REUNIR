import { api, mode } from './data';
import { USAGE_AREAS, USAGE_THRESHOLD, usageReport, weekStart, type UsageArea, type UsageDay, type UsageReport } from '../../../../packages/contracts/src/usage';

/**
 * Usage stats that respect privacy (decision 060). Moving into a part of the community adds one to that part's count for
 * today, with nothing about who moved. A person can leave this device out; the browser's Global Privacy Control or Do
 * Not Track setting does the same. In the demo the counts stay in this page, on top of an illustrative history.
 */
const OPT_OUT = 'reunir.usage.leave-out';

/** Whether this browser asks not to be counted: the person's own choice here, Global Privacy Control or Do Not Track. */
export function browserAsksNotToCount(): boolean {
    const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav?.globalPrivacyControl === true || nav?.doNotTrack === '1';
}
/** The choice made on this page, which holds even when the browser cannot store it. */
let chosen: boolean | null = null;
export function leftOut(): boolean {
    if (chosen !== null) return chosen;
    try { return localStorage.getItem(OPT_OUT) === '1'; } catch { return false; }
}
/** Returns whether the browser kept the choice; if not, it lasts until this page closes. */
export function setLeftOut(value: boolean): boolean {
    chosen = value;
    try { if (value) localStorage.setItem(OPT_OUT, '1'); else localStorage.removeItem(OPT_OUT); return true; } catch { return false; }
}

const session = new Map<string, UsageDay[]>();
if (typeof window !== 'undefined') window.addEventListener('reunir:reset-demo', () => session.clear());
const today = () => new Date().toISOString().slice(0, 10);

/** Count one move into an area. Never throws and never tells the person: a lost count is not their problem. */
export function countVisit(slug: string, area: UsageArea): void {
    if (leftOut() || browserAsksNotToCount()) return;
    if (mode === 'demo') { const rows = session.get(slug) ?? []; rows.push({ day: today(), area, count: 1 }); session.set(slug, rows); return; }
    void fetch(`/api/organisations/${encodeURIComponent(slug)}/usage`, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area }) }).catch(() => undefined);
}

/** Fictional weekly counts for the demo, so the table has a history. Some stay under the threshold on purpose. */
function illustrative(slug: string, now: Date): UsageDay[] {
    const rows: UsageDay[] = [], current = weekStart(now), seed = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
    USAGE_AREAS.forEach((area, i) => {
        for (let w = 1; w < 8; w++) {
            const d = new Date(`${current}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - 7 * w);
            const count = (seed + i * 7 + w * 3) % 5 === 0 ? (i + w) % USAGE_THRESHOLD : 6 + ((seed * (i + 3) + w * 11) % 40);
            if (count) rows.push({ day: d.toISOString().slice(0, 10), area, count });
        }
    });
    return rows;
}

export async function loadUsage(slug: string): Promise<UsageReport & { illustrative: boolean }> {
    if (mode === 'live') return { ...await api<UsageReport>(`/api/organisations/${encodeURIComponent(slug)}/usage`), illustrative: false };
    const now = new Date();
    return { ...usageReport([...illustrative(slug, now), ...(session.get(slug) ?? [])], now), illustrative: true };
}
