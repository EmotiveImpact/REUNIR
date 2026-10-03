import { DomainError, type QuizAttempt, type TenantContext, type Workspace } from '../../contracts/src/index';
import { AUDIT_WINDOW, NOTIFICATION_WINDOW, cursorFor, pageQuery, readCursor, type Page, type PagedItems, type PagedList, type PageQuery, type WorkspaceSummary } from '../../contracts/src/pages';
import { isAdmin } from './access';
import { teaches } from './instructors';

type Dated = { createdAt: string; id: string };
const time = (x: Dated) => Date.parse(x.createdAt);
/** Newest first, with the ID breaking ties so every position is stable. */
const newest = (a: Dated, b: Dated) => time(b) - time(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const oldest = (a: Dated, b: Dated) => -newest(a, b);

/** Attempts this person reviews: on tracks they teach, never their own. Input is an already visible workspace. */
function reviewable(view: Workspace, ctx: TenantContext): QuizAttempt[] {
    const me = view.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId);
    if (!me) return [];
    return view.quizAttempts.filter(a => a.userId !== ctx.userId && teaches(view, me, a.trackId));
}

/** Every item of a list, in display order, from a workspace that `visibleWorkspace` has already filtered for this person. */
export function listItems<L extends PagedList>(view: Workspace, ctx: TenantContext, list: L): PagedItems[L][] {
    const rows = (() => {
        switch (list) {
            case 'notifications': return view.notifications.filter(n => n.userId === ctx.userId).sort(newest);
            case 'review-waiting': return reviewable(view, ctx).filter(a => a.status === 'awaiting_review').sort(oldest);
            case 'review-scored': return reviewable(view, ctx).filter(a => a.status === 'scored').sort(newest);
            case 'review-reviewed': return reviewable(view, ctx).filter(a => a.status === 'reviewed').sort(newest);
            case 'audit': return [...view.audit].sort(newest);
        }
    })();
    return rows as PagedItems[L][];
}

/** The order a list uses, for keyset comparison. */
const ascending = (list: PagedList) => list === 'review-waiting';

/**
 * One page of a list. The cursor names the last item already shown; the page continues strictly after it, so items added
 * meanwhile never repeat or shift a page. A cursor from somewhere else is refused rather than guessed at.
 */
export function pageOf<L extends PagedList>(view: Workspace, ctx: TenantContext, list: L, raw: PageQuery = {}): Page<PagedItems[L]> {
    const query = pageQuery.parse(raw);
    if (list === 'audit') {
        const me = view.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId);
        if (!me || !isAdmin(me)) throw new DomainError('FORBIDDEN', 'An administrator is required.', 403);
    }
    const all = listItems(view, ctx, list);
    let start = 0;
    if (query.cursor) {
        const after = readCursor(query.cursor);
        if (!after) throw new DomainError('INVALID_CURSOR', 'That page is not available. Reload the list.', 400);
        const order = ascending(list) ? oldest : newest;
        start = all.findIndex(x => order(x, after) > 0);
        if (start < 0) start = all.length;
    }
    const items = all.slice(start, start + query.limit);
    const more = start + items.length < all.length;
    return { items, total: all.length, nextCursor: more && items.length ? cursorFor(items[items.length - 1]) : null };
}

/** Totals for the lists the snapshot shortens, computed before it shortens them. */
export function summarise(view: Workspace, ctx: TenantContext, auditTotal = view.audit.length): WorkspaceSummary {
    const review = reviewable(view, ctx), waitingByTrack: Record<string, number> = {};
    for (const a of review) if (a.status === 'awaiting_review') waitingByTrack[a.trackId] = (waitingByTrack[a.trackId] ?? 0) + 1;
    const mine = view.notifications.filter(n => n.userId === ctx.userId);
    return {
        notifications: mine.length,
        unreadNotifications: mine.filter(n => !n.readAt).length,
        review: { waiting: review.filter(a => a.status === 'awaiting_review').length, scored: review.filter(a => a.status === 'scored').length, reviewed: review.filter(a => a.status === 'reviewed').length },
        waitingByTrack,
        audit: auditTotal,
    };
}

/**
 * Shorten a visible workspace to what a screen needs at once: the newest notices, the newest audit entries, and only the
 * person's own knowledge-check attempts. Review queues, older notices and the full audit trail come a page at a time.
 */
export function windowWorkspace(view: Workspace, ctx: TenantContext, auditTotal?: number): Workspace {
    view.summary = summarise(view, ctx, auditTotal);
    const keep = new Set(listItems(view, ctx, 'notifications').slice(0, NOTIFICATION_WINDOW).map(n => n.id));
    view.notifications = view.notifications.filter(n => keep.has(n.id));
    const audit = new Set(listItems(view, ctx, 'audit').slice(0, AUDIT_WINDOW).map(a => a.id));
    view.audit = view.audit.filter(a => audit.has(a.id));
    view.quizAttempts = view.quizAttempts.filter(a => a.userId === ctx.userId);
    return view;
}
