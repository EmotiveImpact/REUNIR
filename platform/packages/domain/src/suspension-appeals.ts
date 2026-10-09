import { DomainError, type Command, type Member, type SuspensionAppeal, type TenantContext, type Workspace } from '../../contracts/src/index';
import { APPEALS_HREF, type OwnSuspensionAppeal, type SuspensionStanding } from '../../contracts/src/appeals';
import { actorFor, isAdmin, isFormer } from './access';

/**
 * Appeals against a suspension (decision 058). The suspended member asks from their account, since they no longer see the
 * community; an active owner or administrator who neither suspended them nor is them decides. Reversing restores access;
 * upholding keeps it suspended. Appeals are private to the appellant and the community's owners and administrators.
 */

const newest = (a: SuspensionAppeal, b: SuspensionAppeal) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
const membership = (s: Workspace, organizationId: string, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === organizationId);

/** Whether the suspension an appeal challenges is still in force: the member is suspended, by that same suspension. */
export function suspensionAppealIsCurrent(s: Workspace, appeal: SuspensionAppeal): boolean {
    const m = membership(s, appeal.organizationId, appeal.appellantId);
    return !!m && m.status === 'suspended' && (m.suspendedAt ?? null) === (appeal.suspendedAt ?? null);
}

/** Whether this member may decide this appeal: an active owner or administrator who is neither the appellant nor the suspender. */
export function mayDecideSuspension(s: Workspace, member: Member, appeal: SuspensionAppeal): boolean {
    if (member.status !== 'active' || !isAdmin(member) || member.organizationId !== appeal.organizationId) return false;
    if (member.userId === appeal.appellantId || member.userId === appeal.suspendedBy) return false;
    return suspensionAppealIsCurrent(s, appeal);
}

/** Everyone who could decide the appeal now. Empty means it waits until the community has such a person. */
export const suspensionDeciders = (s: Workspace, appeal: SuspensionAppeal): Member[] => s.members.filter(m => mayDecideSuspension(s, m, appeal));

const OUTDATED = 'Access changed after this appeal was made, so the appeal no longer applies.';

/** Why a member cannot decide an appeal they can see, in words for the screen; null when they can. */
export function suspensionDecisionBlock(s: Workspace, member: Member, appeal: SuspensionAppeal): string | null {
    if (appeal.status !== 'pending') return 'This appeal has been closed.';
    if (!suspensionAppealIsCurrent(s, appeal)) return OUTDATED;
    if (!isAdmin(member)) return 'Only an owner or administrator decides appeals.';
    if (member.userId === appeal.appellantId) return 'Another owner or administrator decides your own appeal.';
    if (member.userId === appeal.suspendedBy) return 'You suspended this member, so another owner or administrator decides.';
    return null;
}

/** Appeals this person may see: their own, or every appeal in the community for its owners and administrators. */
export function filterSuspensionAppeals(s: Workspace, actor: Member): Workspace {
    s.suspensionAppeals = (s.suspensionAppeals ?? []).filter(a => a.organizationId === actor.organizationId && (isAdmin(actor) || a.appellantId === actor.userId));
    return s;
}

/**
 * Restoring access some other way closes an appeal still open about it, so an open appeal always concerns a suspension
 * in force. Called by the engine when an administrator restores a membership.
 */
export function closeOnRestore(s: Workspace, target: Member, now: string, audit: (action: string, objectId: string) => void) {
    for (const a of s.suspensionAppeals.filter(a => a.organizationId === target.organizationId && a.appellantId === target.userId && a.status === 'pending')) {
        Object.assign(a, { status: 'closed', decidedAt: now });
        audit('suspension.appeal.closed', a.id);
    }
}

/** The suspended person's own view of one community: its name, since when, and their own appeals. Null if not suspended. */
export function suspensionStanding(s: Workspace, userId: string): SuspensionStanding | null {
    const m = membership(s, s.organisation.id, userId);
    if (!m || m.status !== 'suspended') return null;
    const appeals = (s.suspensionAppeals ?? []).filter(a => a.organizationId === s.organisation.id && a.appellantId === userId).sort(newest);
    const about = appeals.filter(a => (a.suspendedAt ?? null) === (m.suspendedAt ?? null));
    const probe: SuspensionAppeal = { id: '', organizationId: s.organisation.id, createdAt: '', appellantId: userId, suspendedBy: m.suspendedBy ?? null, suspendedAt: m.suspendedAt ?? null, reason: '', status: 'pending', decidedBy: null, decidedAt: null, response: '' };
    const own = (a: SuspensionAppeal): OwnSuspensionAppeal => ({ id: a.id, createdAt: a.createdAt, reason: a.reason, status: a.status, decidedAt: a.decidedAt, response: a.response, current: suspensionAppealIsCurrent(s, a) });
    return {
        slug: s.organisation.slug, name: s.organisation.name, suspendedAt: m.suspendedAt ?? null,
        appeals: appeals.map(own),
        canAppeal: !about.some(a => a.status === 'pending' || a.status === 'upheld' || a.status === 'reversed'),
        decidable: suspensionDeciders(s, probe).length > 0,
    };
}

type Changed = { workspace: Workspace; message: string; objectId: string };
const suspended = (s: Workspace, ctx: TenantContext): Member => {
    const m = s.organisation.id === ctx.organizationId ? membership(s, ctx.organizationId, ctx.userId) : undefined;
    // Someone who is not suspended here learns nothing about the community from this path.
    if (!m || m.status !== 'suspended') throw new DomainError('NOT_FOUND', 'Community not found.', 404);
    return m;
};

/**
 * A suspended member appeals their suspension. This runs outside `applyCommand`, which admits only active members: the
 * appellant reaches nothing else in the community this way, and the caller writes only the appeal, notices and audit.
 */
export function appealSuspension(input: Workspace, ctx: TenantContext, reason: string, now: string, makeId: () => string): Changed {
    const s = structuredClone(input);
    s.suspensionAppeals ??= [];
    const me = suspended(s, ctx);
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    const audit = (action: string, objectId: string, metadata: Record<string, unknown> = {}) =>
        s.audit.push({ ...base(), actorId: ctx.userId, action, objectId, metadata: { requestId: ctx.requestId, ...metadata } });
    const mine = s.suspensionAppeals.filter(a => a.organizationId === ctx.organizationId && a.appellantId === ctx.userId);
    const at = me.suspendedAt ?? null, open = mine.find(a => a.status === 'pending');
    if (open && (open.suspendedAt ?? null) === at) throw new DomainError('APPEAL_OPEN', 'Your appeal about this suspension is already waiting for a decision.', 409);
    // One decided appeal per suspension: a later suspension, after access was restored, can be appealed again.
    if (mine.some(a => (a.status === 'upheld' || a.status === 'reversed') && (a.suspendedAt ?? null) === at))
        throw new DomainError('APPEAL_DECIDED', 'An appeal about this suspension has already been decided.', 409);
    // An open appeal about an earlier suspension no longer applies; the new appeal replaces it.
    if (open) { Object.assign(open, { status: 'withdrawn', decidedAt: now }); audit('suspension.appeal.withdrawn', open.id, { replacedByLaterSuspension: true }); }
    const appeal: SuspensionAppeal = { ...base(), appellantId: ctx.userId, suspendedBy: me.suspendedBy ?? null, suspendedAt: at, reason, status: 'pending', decidedBy: null, decidedAt: null, response: '' };
    s.suspensionAppeals.push(appeal);
    const deciders = suspensionDeciders(s, appeal);
    for (const d of deciders) if (!isFormer(s, d.userId))
        s.notifications.push({ ...base(), userId: d.userId, title: 'An access appeal to decide', body: `${me.name} asked for their suspension to be looked at again.`, href: APPEALS_HREF, readAt: null });
    audit('suspension.appeal', appeal.id, { memberId: me.id });
    s.revision++;
    return {
        workspace: s, objectId: appeal.id,
        message: deciders.length ? 'Appeal sent. An owner or administrator who did not suspend you will decide it.' : 'Appeal saved. Nobody can decide it yet: it waits for an owner or administrator who did not suspend you.',
    };
}

/** The suspended appellant withdraws their own open appeal. */
export function withdrawSuspensionAppeal(input: Workspace, ctx: TenantContext, appealId: string, now: string, makeId: () => string): Changed {
    const s = structuredClone(input);
    s.suspensionAppeals ??= [];
    suspended(s, ctx);
    const appeal = s.suspensionAppeals.find(a => a.id === appealId && a.organizationId === ctx.organizationId && a.appellantId === ctx.userId);
    if (!appeal) throw new DomainError('NOT_FOUND', 'That appeal is not available.', 404);
    if (appeal.status !== 'pending') throw new DomainError('NOT_PENDING', 'This appeal has already been closed.', 409);
    Object.assign(appeal, { status: 'withdrawn', decidedAt: now });
    s.audit.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, actorId: ctx.userId, action: 'suspension.appeal.withdrawn', objectId: appeal.id, metadata: { requestId: ctx.requestId } });
    s.revision++;
    return { workspace: s, objectId: appeal.id, message: 'Appeal withdrawn. Your access stays suspended.' };
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
/** An owner or administrator decides an appeal, inside `applyCommand`. */
export function applySuspensionAppeals(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (cmd.type !== 'suspension.appeal.decide') return undefined;
    const actor = actorFor(s, ctx);
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    const audit = (action: string, objectId: string, metadata: Record<string, unknown>) =>
        s.audit.push({ ...base(), actorId: ctx.userId, action, objectId, metadata: { requestId: ctx.requestId, ...metadata } });
    const appeal = s.suspensionAppeals.find(a => a.id === cmd.appealId && a.organizationId === ctx.organizationId);
    // Only the appellant and the community's owners and administrators know an appeal exists.
    if (!appeal || !isAdmin(actor)) throw new DomainError('NOT_FOUND', 'That appeal is not available.', 404);
    if (appeal.status !== 'pending') throw new DomainError('NOT_PENDING', 'This appeal has already been closed.', 409);
    if (appeal.appellantId === ctx.userId) throw new DomainError('SELF_DECISION', 'Another owner or administrator decides your own appeal.', 403);
    if (!suspensionAppealIsCurrent(s, appeal)) throw new DomainError('APPEAL_OUTDATED', OUTDATED, 409);
    if (appeal.suspendedBy === ctx.userId) throw new DomainError('SUSPENDER_CANNOT_DECIDE', 'You suspended this member, so another owner or administrator decides.', 403);
    const member = membership(s, ctx.organizationId, appeal.appellantId)!;
    Object.assign(appeal, { status: cmd.decision, decidedBy: ctx.userId, decidedAt: now, response: cmd.response });
    audit(`suspension.appeal.${cmd.decision}`, appeal.id, { memberId: member.id });
    // Reversal restores access in the same change. The suspension stays in the audit trail and on the appeal.
    if (cmd.decision === 'reversed') {
        Object.assign(member, { status: 'active', suspendedBy: null, suspendedAt: null });
        audit('member.active', member.id, { appealId: appeal.id });
    }
    // The notice waits in the community: they read it there once access is back, and see the response on their account now.
    s.notifications.push({ ...base(), userId: appeal.appellantId, title: cmd.decision === 'reversed' ? 'Your access is restored' : 'Your access stays suspended', body: cmd.response, href: APPEALS_HREF, readAt: null });
    return {
        message: cmd.decision === 'reversed' ? 'Decision reversed. Their access to the community is restored.' : 'Decision upheld. Their access stays suspended.',
        objectId: appeal.id, changed: true,
    };
}
