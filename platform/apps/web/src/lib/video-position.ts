/**
 * Where a learner stopped in a lesson video (decision 054). Kept only in this browser's storage, never sent anywhere, and
 * forgotten when the video ends. Storage that is missing or refused simply means the video starts at the beginning.
 */
export type PositionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const PREFIX = 'reunir.resume.';
/** Positions this close to either end are not worth picking up from. */
export const RESUME_MARGIN_SECONDS = 15;

export function browserStore(): PositionStore | null {
    try { return window.localStorage; } catch { return null; }
}
/** The second to pick up from, or 0 to start at the beginning. */
export function savedPosition(store: PositionStore | null, key: string, duration: number): number {
    try {
        const at = Number(store?.getItem(PREFIX + key));
        return Number.isFinite(at) && at > RESUME_MARGIN_SECONDS && at < duration - RESUME_MARGIN_SECONDS ? at : 0;
    } catch { return 0; }
}
/** Remember a whole second, or forget the place with `null`. */
export function rememberPosition(store: PositionStore | null, key: string, seconds: number | null) {
    try { if (seconds === null) store?.removeItem(PREFIX + key); else store?.setItem(PREFIX + key, String(Math.floor(seconds))); }
    catch { /* Full or refused storage: the video starts at the beginning next time. */ }
}
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
