import { z } from 'zod';
import { RETENTION_DAYS } from './retention';

/**
 * Usage stats that respect privacy (decision 060). Opening a part of the community adds one to that part's count for the
 * day. Nothing records who opened it, from where, or with what device: the count is the whole record. Owners and
 * administrators see weekly totals per part, and any count below USAGE_THRESHOLD shows as "fewer than 5", so a small
 * community never shows what one person did. It is not an engagement score, and nothing about one person is derived from it.
 */
export const USAGE_AREAS = ['home', 'discussions', 'learning', 'missions', 'projects', 'events', 'people', 'messages', 'knowledge', 'outputs', 'profile', 'notifications', 'saved'] as const;
export type UsageArea = typeof USAGE_AREAS[number];
export const USAGE_LABELS: Record<UsageArea, string> = {
    home: 'Your home', discussions: 'Discussions', learning: 'Paths & learning', missions: 'Missions', projects: 'Projects',
    events: 'Events', people: 'Your people', messages: 'Messages', knowledge: 'Knowledge & collections', outputs: 'Community outputs',
    profile: 'Your profile', notifications: 'Notifications', saved: 'Saved for later',
};
/** Counts below this are shown as "fewer than 5" and never as a number. */
export const USAGE_THRESHOLD = 5;
/** Weeks shown, the current one included. */
export const USAGE_WEEKS = 8;
/** Days a daily count is kept before the retention job clears it. Migration 0051 lets only older days be deleted. */
export const USAGE_KEEP_DAYS = RETENTION_DAYS.usageCounts;
/** Most counts one person's browser may add in a minute; anything beyond is dropped, never an error. */
export const USAGE_PER_MINUTE = 30;

export const usageVisit = z.object({ area: z.enum(USAGE_AREAS) }).strict();

/** The part of the community a path belongs to, or null for pages that are not counted (account, appeals, teaching, management). */
export function usageArea(pathname: string): UsageArea | null {
    const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    const first = path.split('/')[1] ?? '';
    if (path === '/') return 'home';
    // A course's authoring studio is teaching, which is not counted.
    if (first === 'learn' && path.split('/')[3] === 'studio') return null;
    const map: Record<string, UsageArea> = {
        discussions: 'discussions', community: 'discussions', spaces: 'discussions', post: 'discussions',
        paths: 'learning', learn: 'learning', missions: 'missions', projects: 'projects', events: 'events', members: 'people',
        messages: 'messages', knowledge: 'knowledge', collections: 'knowledge', outputs: 'outputs', profile: 'profile',
        notifications: 'notifications', saved: 'saved',
    };
    return map[first] ?? null;
}

/** Monday of the week a day falls in, as YYYY-MM-DD (UTC). */
export function weekStart(day: string | Date): string {
    const d = new Date(typeof day === 'string' ? `${day.slice(0, 10)}T00:00:00.000Z` : Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
}

/** One stored row: a community's count for one part on one day. */
export interface UsageDay { day: string; area: string; count: number }
/** A week's count for one part: a number at or above the threshold, 0, or null for "fewer than 5". */
export type UsageCell = number | null;
export interface UsageReport {
    /** Week starting days, oldest first; the last is the current week, still in progress. */
    weeks: string[];
    areas: { area: UsageArea; label: string; counts: UsageCell[] }[];
    threshold: number;
    keptDays: number;
}

/** Weekly totals per part from daily rows, with small counts hidden. The same function serves the server and the demo. */
export function usageReport(rows: UsageDay[], now: Date): UsageReport {
    const current = weekStart(now), weeks: string[] = [];
    for (let i = USAGE_WEEKS - 1; i >= 0; i--) { const d = new Date(`${current}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - 7 * i); weeks.push(d.toISOString().slice(0, 10)); }
    const totals = new Map<string, number>();
    for (const r of rows) if ((USAGE_AREAS as readonly string[]).includes(r.area)) {
        const key = `${r.area}|${weekStart(r.day)}`; totals.set(key, (totals.get(key) ?? 0) + r.count);
    }
    const cell = (n: number): UsageCell => n === 0 ? 0 : n < USAGE_THRESHOLD ? null : n;
    return { weeks, threshold: USAGE_THRESHOLD, keptDays: USAGE_KEEP_DAYS, areas: USAGE_AREAS.map(area => ({ area, label: USAGE_LABELS[area], counts: weeks.map(w => cell(totals.get(`${area}|${w}`) ?? 0)) })) };
}
