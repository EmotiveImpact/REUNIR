import { z } from 'zod';
import type { AuditEvent, Notification, QuizAttempt } from './index';

/**
 * Long lists the server sends a page at a time. The workspace snapshot carries only a recent window of these, with exact
 * totals in `Workspace.summary`; older items come from `GET /api/organisations/:slug/pages/:list`.
 */
export const PAGED_LISTS = ['notifications', 'review-waiting', 'review-scored', 'review-reviewed', 'audit'] as const;
export type PagedList = typeof PAGED_LISTS[number];
export interface PagedItems { notifications: Notification; 'review-waiting': QuizAttempt; 'review-scored': QuizAttempt; 'review-reviewed': QuizAttempt; audit: AuditEvent }
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** Notices and audit entries the snapshot carries. Older ones are a page away. */
export const NOTIFICATION_WINDOW = 30;
export const AUDIT_WINDOW = 12;

export const pagedList = z.enum(PAGED_LISTS);
/** An opaque keyset cursor: the creation time and ID of the last item shown, never an offset. */
export const pageCursor = z.string().max(200).regex(/^[A-Za-z0-9_-]+$/);
export const pageQuery = z.object({
    cursor: pageCursor.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
}).strict();
export type PageQuery = z.input<typeof pageQuery>;

export interface Page<T> {
    items: T[];
    /** Every item in the list for this person, not only this page. */
    total: number;
    /** Present while more items follow. */
    nextCursor: string | null;
}

/** Exact totals for lists the snapshot shortens. */
export interface WorkspaceSummary {
    notifications: number;
    unreadNotifications: number;
    review: { waiting: number; scored: number; reviewed: number };
    /** Answers waiting for marks, per track this person teaches. */
    waitingByTrack: Record<string, number>;
    audit: number;
}

const encode = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const decode = (cursor: string) => {
    const b64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
};
export function cursorFor(item: { createdAt: string; id: string }): string { return encode(JSON.stringify([item.createdAt, item.id])); }
/** The position a cursor names, or null for one that was not issued by REUNIR. */
export function readCursor(cursor: string): { createdAt: string; id: string } | null {
    try {
        const value = JSON.parse(decode(cursor));
        if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string' && !Number.isNaN(Date.parse(value[0])) && /^[A-Za-z0-9_-]{1,100}$/.test(value[1]))
            return { createdAt: new Date(value[0]).toISOString(), id: value[1] };
    } catch { /* fall through */ }
    return null;
}
