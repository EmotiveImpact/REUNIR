/** The day the fictional demo was written for: its upcoming events and recent activity are relative to this. */
export const DEMO_SEED_DAY = Date.UTC(2026, 8, 24);
const DAY = 86_400_000;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Moves every date in a freshly created demo forward by whole days, so a visitor today sees upcoming events and
 * recent activity rather than a calendar frozen on the day the demo was written. Never moves dates backwards.
 */
export function freshenDemoDates<T>(seed: T, now = Date.now()): T {
    const days = Math.floor((now - DEMO_SEED_DAY) / DAY);
    if (days <= 0) return seed;
    const shift = (value: unknown): unknown => {
        if (typeof value === 'string') {
            if (STAMP.test(value)) return new Date(Date.parse(value) + days * DAY).toISOString();
            if (DATE.test(value)) return new Date(Date.parse(value + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10);
            return value;
        }
        if (Array.isArray(value)) return value.map(shift);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shift(v)]));
        return value;
    };
    return shift(seed) as T;
}
