import { DomainError, type Post, type ProjectTask, type QuizAttempt, type TenantContext, type Workspace } from '../../contracts/src/index';
import { AUDIT_WINDOW, NOTIFICATION_WINDOW, POST_WINDOW, cursorFor, pageQuery, readCursor, type ItemList, type Page, type PageFilter, type PageItem, type PagedItems, type PagedList, type PageQuery, type PageRecords, type WorkspaceSummary } from '../../contracts/src/pages';
import { isAdmin } from './access';
import { teaches } from './instructors';
import { canWorkOnProject } from './project-work';

type Dated = { createdAt: string; id: string };
const time = (x: Dated) => Date.parse(x.createdAt);
/** Newest first, with the ID breaking ties so every position is stable. */
const newest = (a: Dated, b: Dated) => time(b) - time(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const oldest = (a: Dated, b: Dated) => -newest(a, b);

/** Attempts this person reviews: on tracks they teach, never their own. Input is an already visible workspace. */
function reviewable(view: Workspace, ctx: TenantContext): QuizAttempt[] {
    const me = view.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId);
    if (!me) return [];
    return view.quizAttempts.filter(a => a.userId !== ctx.userId && teaches(view, me, a.trackId, a.lessonId));
}

const notFound = (): never => { throw new DomainError('NOT_FOUND', 'This project work is not available.', 404); };
/** The project an archived-task list names, which this person must be able to work on. */
function workableProject(view: Workspace, ctx: TenantContext, projectId: string | undefined) {
    if (!projectId) throw new DomainError('PROJECT_REQUIRED', 'Name the project whose archived tasks to list.', 400);
    const me = view.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId);
    const project = view.projects.find(p => p.id === projectId && p.organizationId === ctx.organizationId);
    if (!me || !project || !canWorkOnProject(view, me, project)) return notFound();
    return project;
}
/**
 * Posts a feed pages: every visible post except pinned ones, which the snapshot always carries and a feed shows first.
 * A hidden post is here only for moderators and its author, as everywhere else.
 */
function feedPosts(view: Workspace, ctx: TenantContext, filter: PageFilter): Post[] {
    const saved = filter.saved ? new Set(view.bookmarks.filter(b => b.userId === ctx.userId).map(b => b.postId)) : null;
    return view.posts.filter(p => !p.pinned && (!filter.space || p.spaceId === filter.space) && (!filter.kind || p.kind === filter.kind) && (!saved || saved.has(p.id)));
}

/** Every item of a list, in display order, from a workspace that `visibleWorkspace` has already filtered for this person. */
export function listItems<L extends PagedList>(view: Workspace, ctx: TenantContext, list: L, filter: PageFilter = {}): PagedItems[L][] {
    const rows = (() => {
        switch (list) {
            case 'notifications': return view.notifications.filter(n => n.userId === ctx.userId).sort(newest);
            case 'review-waiting': return reviewable(view, ctx).filter(a => a.status === 'awaiting_review').sort(oldest);
            case 'review-scored': return reviewable(view, ctx).filter(a => a.status === 'scored').sort(newest);
            case 'review-reviewed': return reviewable(view, ctx).filter(a => a.status === 'reviewed').sort(newest);
            case 'audit': return [...view.audit].sort(newest);
            case 'posts': return feedPosts(view, ctx, filter).sort(newest);
            case 'archived-tasks': { const project = workableProject(view, ctx, filter.project); return view.projectTasks.filter(t => t.projectId === project.id && t.archived).sort(newest); }
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
    const all = listItems(view, ctx, list, query);
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
    const page: Page<PagedItems[L]> = { items, total: all.length, nextCursor: more && items.length ? cursorFor(items[items.length - 1]) : null };
    if (list === 'posts') page.records = postRecords(view, ctx, items as Post[]);
    if (list === 'archived-tasks') page.records = taskRecords(view, items as ProjectTask[]);
    return page;
}

/** Replies, appreciations and this person's bookmarks on these posts. */
function postRecords(view: Workspace, ctx: TenantContext, posts: Post[]): PageRecords {
    const ids = new Set(posts.map(p => p.id));
    return { comments: view.comments.filter(c => ids.has(c.postId)), reactions: view.reactions.filter(r => ids.has(r.postId)), bookmarks: view.bookmarks.filter(b => ids.has(b.postId) && b.userId === ctx.userId) };
}
/** Notes and verified files on these tasks. Proof is a contribution, which the snapshot carries. */
function taskRecords(view: Workspace, tasks: ProjectTask[]): PageRecords {
    const ids = new Set(tasks.map(t => t.id));
    return { taskNotes: view.taskNotes.filter(n => ids.has(n.taskId)), uploads: view.uploads.filter(u => u.purpose === 'task_file' && !!u.taskId && ids.has(u.taskId)) };
}

/**
 * One item of a list by its ID, with its records, for a link to a post or archived task the snapshot does not carry. A
 * post is read with every reply; anything this person cannot see is NOT_FOUND, never a hint that it exists.
 */
export function itemOf<L extends ItemList>(view: Workspace, ctx: TenantContext, list: L, id: string): PageItem<PagedItems[L]> {
    if (list === 'posts') {
        const post = view.posts.find(p => p.id === id);
        if (!post) throw new DomainError('NOT_FOUND', 'That conversation is not available.', 404);
        return { item: post as PagedItems[L], records: postRecords(view, ctx, [post]) };
    }
    const task = view.projectTasks.find(t => t.id === id);
    if (!task) return notFound();
    workableProject(view, ctx, task.projectId);
    return { item: task as PagedItems[L], records: taskRecords(view, [task]) };
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
        posts: view.posts.filter(p => !p.hidden).length,
        archivedTasks: archivedByProject(view),
    };
}
function archivedByProject(view: Workspace): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const t of view.projectTasks) if (t.archived) counts[t.projectId] = (counts[t.projectId] ?? 0) + 1;
    return counts;
}

/**
 * Posts the snapshot keeps: the newest few, every pinned post, the person's own hidden posts (so they can appeal), and
 * any post a visible collection, appeal or open report names. Everything else is a page away.
 */
function keptPosts(view: Workspace, ctx: TenantContext): Set<string> {
    const keep = new Set([...view.posts].sort(newest).slice(0, POST_WINDOW).map(p => p.id));
    for (const p of view.posts) if (p.pinned || (p.hidden && p.authorId === ctx.userId)) keep.add(p.id);
    for (const i of view.collectionItems ?? []) if (i.kind === 'post' && i.postId) keep.add(i.postId);
    for (const a of view.moderationAppeals ?? []) keep.add(a.subjectId);
    for (const r of view.reports) if (r.status === 'open') keep.add(r.postId);
    return keep;
}

/**
 * Shorten a visible workspace to what a screen needs at once: the newest notices, the newest audit entries, only the
 * person's own knowledge-check attempts, a window of posts and only active tasks. Review queues, older notices, the full
 * audit trail, feeds and archived tasks come a page at a time.
 */
export function windowWorkspace(view: Workspace, ctx: TenantContext, auditTotal?: number): Workspace {
    view.summary = summarise(view, ctx, auditTotal);
    const keep = new Set(listItems(view, ctx, 'notifications').slice(0, NOTIFICATION_WINDOW).map(n => n.id));
    view.notifications = view.notifications.filter(n => keep.has(n.id));
    const audit = new Set(listItems(view, ctx, 'audit').slice(0, AUDIT_WINDOW).map(a => a.id));
    view.audit = view.audit.filter(a => audit.has(a.id));
    view.quizAttempts = view.quizAttempts.filter(a => a.userId === ctx.userId);
    const posts = keptPosts(view, ctx);
    view.posts = view.posts.filter(p => posts.has(p.id));
    view.comments = view.comments.filter(c => posts.has(c.postId));
    view.reactions = view.reactions.filter(r => posts.has(r.postId));
    view.bookmarks = view.bookmarks.filter(b => posts.has(b.postId));
    // Archived tasks leave the board; their notes and files go with them. Active tasks are capped at 100 a project.
    const archived = new Set(view.projectTasks.filter(t => t.archived).map(t => t.id));
    view.projectTasks = view.projectTasks.filter(t => !archived.has(t.id));
    view.taskNotes = view.taskNotes.filter(n => !archived.has(n.taskId));
    view.uploads = view.uploads.filter(u => !(u.purpose === 'task_file' && u.taskId && archived.has(u.taskId)));
    return view;
}
