import { TWO_FACTOR_REQUIRED } from '../../../../packages/contracts/src/two-factor';

// Errors as people meet them. Kept free of the build-time data mode so it can be checked on its own.

/** A refused or unreachable request, with the HTTP status and the server's error code so screens can explain it plainly. */
export class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly code: string) { super(message); this.name = 'ApiError'; }
}
export const OFFLINE_MESSAGE = 'REUNIR could not be reached. Check your connection and try again. Nothing was saved.';
/** What went wrong, in the terms a person can act on. */
export type Failure = 'offline' | 'session' | 'two-factor' | 'forbidden' | 'not-found' | 'outdated' | 'unknown';
export function failureOf(error: unknown): Failure {
    if (error instanceof ApiError) {
        if (error.code === 'OFFLINE' || error.status === 0) return 'offline';
        if (error.status === 401) return 'session';
        if (error.code === TWO_FACTOR_REQUIRED) return 'two-factor';
        if (error.status === 403) return 'forbidden';
        if (error.status === 404) return 'not-found';
        return 'unknown';
    }
    const message = error instanceof Error ? error.message : '';
    // A page's code could not be fetched: after an update, or without a connection.
    if (/dynamically imported module|importing a module script|module script failed|loading chunk/i.test(message)) return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'outdated';
    if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) return 'offline';
    return 'unknown';
}
export function displayError(error: unknown): string { if (error && typeof error === 'object' && 'issues' in error) {
    const issue = (error as {
        issues: {
            message: string;
            code?: string;
            minimum?: number | bigint;
            origin?: string;
            path?: PropertyKey[];
        }[];
    }).issues[0];
    // A blank required field reads as a sentence about that field, not a validator's wording.
    const field = issue?.path?.filter(p => typeof p === 'string').at(-1)?.replace(/([A-Z])/g, ' $1').toLowerCase();
    if (issue?.code === 'too_small' && issue.origin === 'string' && Number(issue.minimum) === 1 && field) return `Nothing was saved. Fill in the ${field} and try again.`;
    return issue?.message || 'Please check the form.';
}
// A request that never reached the server: the browser reports this differently in each engine.
if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) return OFFLINE_MESSAGE;
return error instanceof Error ? error.message : 'Something unexpected happened. Try again.'; }
