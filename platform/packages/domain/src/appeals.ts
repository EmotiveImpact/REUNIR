import { DomainError, type Command, type Member, type ModerationAppeal, type Post, type TenantContext, type Workspace } from '../../contracts/src/index';
import { APPEALS_HREF } from '../../contracts/src/appeals';
import { actorFor, canSeeSpace, isAdmin, isFormer, isModerator } from './access';

/**
 * Appeals against a moderator hiding a post. The author asks; an active owner or administrator who neither hid the post
 * nor wrote it decides. Reversing restores the post; upholding keeps it hidden. Appeals are private to the appellant and
 * the community's owners and administrators, and never become community activity.
 */

/** The post an appeal is about, if it is in this community. */
export const appealPost = (s: Workspace, appeal: Pick<ModerationAppeal, 'organizationId' | 'subjectId'>): Post | undefined =>
    s.posts.find(p => p.id === appeal.subjectId && p.organizationId === appeal.organizationId);

/**
 * Whether the hiding an appeal challenges is still the post's latest moderation. If the post was restored or hidden again
 * since, the appeal no longer applies: deciding it would overrule a later decision it never challenged.
 */
export function appealIsCurrent(s: Workspace, appeal: ModerationAppeal): boolean {
    const post = appealPost(s, appeal);
    return !!post && (post.moderatedAt ?? null) === (appeal.hiddenAt ?? null);
}

/** Whether this member may decide this appeal: an active owner or administrator who is neither the appellant nor the moderator. */
export function mayDecide(s: Workspace, member: Member, appeal: ModerationAppeal): boolean {
    if (member.status !== 'active' || !isAdmin(member) || member.organizationId !== appeal.organizationId) return false;
    if (member.userId === appeal.appellantId || member.userId === appeal.hiddenBy) return false;
    return appealIsCurrent(s, appeal) && (appealPost(s, appeal)?.moderatedBy ?? null) !== member.userId;
}

/** Everyone who could decide the appeal now. Empty means it waits until the community has such a person. */
export const appealDeciders = (s: Workspace, appeal: ModerationAppeal): Member[] =>
    s.members.filter(m => mayDecide(s, m, appeal));

const OUTDATED = 'The post was moderated again after this appeal was made, so the appeal no longer applies. The author can appeal the current decision.';

/** Why a member cannot decide an appeal they can see, in words for the screen; null when they can. */
export function decisionBlock(s: Workspace, member: Member, appeal: ModerationAppeal): string | null {
    if (appeal.status !== 'pending') return 'This appeal has been closed.';
    if (!appealIsCurrent(s, appeal)) return OUTDATED;
    if (!isAdmin(member)) return 'Only an owner or administrator decides appeals.';
    if (member.userId === appeal.appellantId) return 'Another owner or administrator decides your own appeal.';
    if (appeal.hiddenBy === member.userId || (appealPost(s, appeal)?.moderatedBy ?? null) === member.userId) return 'You hid this post, so another owner or administrator decides.';
    return null;
}

/** Appeals this person may see: their own, or every appeal in the community for its owners and administrators. */
export function filterAppeals(s: Workspace, actor: Member): Workspace {
    s.moderationAppeals = s.moderationAppeals.filter(a => a.organizationId === actor.organizationId && (isAdmin(actor) || a.appellantId === actor.userId));
    return s;
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
export function applyAppeals(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (cmd.type !== 'moderation.appeal' && cmd.type !== 'moderation.appeal.decide' && cmd.type !== 'moderation.appeal.withdraw') return undefined;
    const actor = actorFor(s, ctx);
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    const notify = (userId: string, title: string, body: string) => {
        if (userId !== ctx.userId && !isFormer(s, userId)) s.notifications.push({ ...base(), userId, title, body, href: APPEALS_HREF, readAt: null });
    };
    const audit = (action: string, objectId: string, metadata: Record<string, unknown>) =>
        s.audit.push({ ...base(), actorId: ctx.userId, action, objectId, metadata: { requestId: ctx.requestId, ...metadata } });
    const missing = () => new DomainError('NOT_FOUND', 'That appeal is not available.', 404);

    if (cmd.type === 'moderation.appeal') {
        const post = s.posts.find(p => p.id === cmd.postId && p.organizationId === ctx.organizationId);
        // A hidden post is invisible to everyone but its author and the moderators, so others learn nothing about it.
        if (!post || !canSeeSpace(s, actor, post.spaceId) || (post.hidden && post.authorId !== ctx.userId && !isModerator(actor)))
            throw new DomainError('NOT_FOUND', 'That post is not available.', 404);
        if (post.authorId !== ctx.userId) throw new DomainError('NOT_AUTHOR', 'Only the person who wrote a post can appeal its moderation.', 403);
        if (!post.hidden) throw new DomainError('NOT_HIDDEN', 'This post is visible to members, so there is nothing to appeal.', 409);
        const mine = s.moderationAppeals.filter(a => a.organizationId === ctx.organizationId && a.subject === 'post' && a.subjectId === post.id);
        const hiddenAt = post.moderatedAt ?? null;
        const open = mine.find(a => a.status === 'pending');
        if (open && (open.hiddenAt ?? null) === hiddenAt) throw new DomainError('APPEAL_OPEN', 'Your appeal about this post is already waiting for a decision.', 409);
        // One decided appeal per hiding: a later hiding, after the post was restored, can be appealed again.
        if (mine.some(a => (a.status === 'upheld' || a.status === 'reversed') && (a.hiddenAt ?? null) === hiddenAt))
            throw new DomainError('APPEAL_DECIDED', 'An appeal about this hiding has already been decided.', 409);
        // An open appeal about an earlier hiding no longer applies; the new appeal replaces it.
        if (open) { Object.assign(open, { status: 'withdrawn', decidedAt: now }); audit('moderation.appeal.withdrawn', open.id, { postId: post.id, replacedByLaterHiding: true }); }
        const appeal: ModerationAppeal = { ...base(), subject: 'post', subjectId: post.id, appellantId: ctx.userId, hiddenBy: post.moderatedBy ?? null, hiddenAt, reason: cmd.reason, status: 'pending', decidedBy: null, decidedAt: null, response: '' };
        s.moderationAppeals.push(appeal);
        const deciders = appealDeciders(s, appeal);
        for (const d of deciders) notify(d.userId, 'An appeal to decide', `${actor.name} asked for a second look at a hidden post.`);
        audit('moderation.appeal', appeal.id, { postId: post.id });
        return {
            message: deciders.length ? 'Appeal sent. An owner or administrator who did not hide the post will decide it.' : 'Appeal saved. Nobody can decide it yet: it waits for an owner or administrator who did not hide the post.',
            objectId: appeal.id, changed: true,
        };
    }

    const appeal = s.moderationAppeals.find(a => a.id === cmd.appealId && a.organizationId === ctx.organizationId);
    // Only the appellant and the community's owners and administrators know an appeal exists.
    if (!appeal || (appeal.appellantId !== ctx.userId && !isAdmin(actor))) throw missing();

    if (cmd.type === 'moderation.appeal.withdraw') {
        if (appeal.appellantId !== ctx.userId) throw new DomainError('NOT_APPELLANT', 'Only the person who appealed can withdraw it.', 403);
        if (appeal.status !== 'pending') throw new DomainError('NOT_PENDING', 'This appeal has already been closed.', 409);
        Object.assign(appeal, { status: 'withdrawn', decidedAt: now });
        audit('moderation.appeal.withdrawn', appeal.id, { postId: appeal.subjectId });
        return { message: 'Appeal withdrawn. The post stays hidden.', objectId: appeal.id, changed: true };
    }

    if (!isAdmin(actor)) throw new DomainError('ADMIN_REQUIRED', 'Only an owner or administrator decides appeals.', 403);
    if (appeal.status !== 'pending') throw new DomainError('NOT_PENDING', 'This appeal has already been closed.', 409);
    if (appeal.appellantId === ctx.userId) throw new DomainError('SELF_DECISION', 'Another owner or administrator decides your own appeal.', 403);
    const post = appealPost(s, appeal);
    if (!post) throw missing();
    if (!appealIsCurrent(s, appeal)) throw new DomainError('APPEAL_OUTDATED', OUTDATED, 409);
    if (appeal.hiddenBy === ctx.userId || (post.moderatedBy ?? null) === ctx.userId) throw new DomainError('MODERATOR_CANNOT_DECIDE', 'You hid this post, so another owner or administrator decides.', 403);
    Object.assign(appeal, { status: cmd.decision, decidedBy: ctx.userId, decidedAt: now, response: cmd.response });
    const wasHidden = post.hidden;
    // Reversal restores the post. Who hid it, and when, stay on the post; the appeal records who restored it.
    if (cmd.decision === 'reversed') post.hidden = false;
    audit(`moderation.appeal.${cmd.decision}`, appeal.id, { postId: post.id });
    if (cmd.decision === 'reversed' && wasHidden) audit('post.restored', post.id, { appealId: appeal.id });
    notify(appeal.appellantId, cmd.decision === 'reversed' ? 'Your post is visible again' : 'Your post stays hidden', cmd.response);
    return {
        message: cmd.decision === 'reversed' ? 'Decision reversed. The post is visible to members again.' : 'Decision upheld. The post stays hidden.',
        objectId: appeal.id, changed: true,
    };
}
