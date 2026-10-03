import { DomainError, type Command, type Contribution, type ContributionCredit, type Member, type TenantContext, type Workspace } from '../../contracts/src/index';
import { CREDIT_HISTORY_LIMIT, CREDIT_LIMIT, LIVE_CREDIT, withNames } from '../../contracts/src/credits';
import { actorFor, canSeeSpace, isFormer } from './access';
import { canWorkOnProject } from './project-work';

/**
 * Credits name the other people behind one contribution, with their consent. The contribution's author invites; the
 * invited person accepts or declines; either may later withdraw an accepted credit. Invited, declined and withdrawn
 * credits are seen only by the author and the person named. Credits never feed paths, milestones, recognition, outcomes,
 * reputation, roles or any credential: those read the contribution's own author and review, never this collection.
 */
export const isLive = (k: Pick<ContributionCredit, 'status'>) => LIVE_CREDIT.includes(k.status);

/**
 * Run after contributions and members have been filtered for this person. Accepted credits show wherever the contribution
 * shows, while the credited person is visible here (a suspended member is hidden from people who cannot see suspended
 * members, as in the directory; a former member's credits were deleted with their account). Everything else only to the
 * author and the person named.
 */
export function filterCredits(s: Workspace, actor: Member): Workspace {
    const contributions = new Set(s.contributions.map(c => c.id)), people = new Set(s.members.map(m => m.userId));
    s.contributionCredits = (s.contributionCredits ?? []).filter(k => k.organizationId === actor.organizationId && contributions.has(k.contributionId)
        && (k.userId === actor.userId || k.invitedBy === actor.userId || (k.status === 'accepted' && people.has(k.userId))));
    return s;
}

/** Accepted credits on one contribution, in the order they were made. Input is an already visible workspace. */
export const acceptedCredits = (s: Workspace, contributionId: string) => s.contributionCredits.filter(k => k.contributionId === contributionId && k.status === 'accepted');
/** "With Nia and Theo" for a contribution, from visible accepted credits. */
export function creditLine(s: Workspace, contributionId: string): string {
    return withNames(acceptedCredits(s, contributionId).map(k => s.members.find(m => m.userId === k.userId)?.name).filter((n): n is string => !!n));
}
/** Work a person is credited on, kept apart from their own contributions. Input is an already visible workspace. */
export const creditedOn = (s: Workspace, userId: string) => s.contributionCredits
    .filter(k => k.userId === userId && k.status === 'accepted')
    .map(k => ({ credit: k, contribution: s.contributions.find(c => c.id === k.contributionId) }))
    .filter((x): x is { credit: ContributionCredit; contribution: Contribution } => !!x.contribution);

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
const commands = new Set(['credit.invite', 'credit.respond', 'credit.withdraw']);
export function applyCredits(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (!commands.has(cmd.type)) return undefined;
    s.contributionCredits ??= [];
    const actor = actorFor(s, ctx);
    const fail = (code: string, message: string, status = 409): never => { throw new DomainError(code, message, status); };
    const missing = (): never => fail('NOT_FOUND', 'That credit is not available.', 404);
    const name = (userId: string) => s.members.find(m => m.organizationId === ctx.organizationId && m.userId === userId)?.name ?? 'This member';
    const contribution = (id: string) => {
        const c = s.contributions.find(x => x.id === id && x.organizationId === ctx.organizationId) ?? missing();
        const p = s.projects.find(x => x.id === c.projectId && x.organizationId === ctx.organizationId) ?? missing();
        if (!canSeeSpace(s, actor, p.spaceId)) missing();
        return { c, p };
    };
    const credit = (id: string) => s.contributionCredits.find(k => k.id === id && k.organizationId === ctx.organizationId) ?? missing();
    const notify = (userId: string, title: string, body: string, projectId: string) => {
        if (userId !== ctx.userId && !isFormer(s, userId))
            s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId, title, body, href: `/projects/${projectId}`, readAt: null });
    };
    switch (cmd.type) {
        case 'credit.invite': {
            const { c, p } = contribution(cmd.contributionId);
            if (c.userId !== ctx.userId) fail('AUTHOR_REQUIRED', 'Only the person who recorded this contribution can credit others on it.', 403);
            if (!canWorkOnProject(s, actor, p)) fail('JOIN_PROJECT', 'Join this project before crediting others on its work.', 403);
            if (cmd.userId === ctx.userId) fail('SELF_CREDIT', 'This is already your contribution.');
            const target = s.members.find(m => m.organizationId === ctx.organizationId && m.userId === cmd.userId && m.status === 'active');
            if (!target || !canSeeSpace(s, target, p.spaceId) || !s.projectMembers.some(x => x.organizationId === ctx.organizationId && x.projectId === p.id && x.userId === cmd.userId))
                fail('INVALID_CREDIT', 'Choose an active member of this project’s team.');
            const history = s.contributionCredits.filter(k => k.organizationId === ctx.organizationId && k.contributionId === c.id);
            const theirs = history.filter(k => k.userId === cmd.userId);
            if (theirs.some(isLive)) fail('ALREADY_CREDITED', `${target!.name} is already credited or invited on this contribution.`);
            if (theirs.some(k => k.status === 'declined' || (k.status === 'withdrawn' && k.withdrawnBy === k.userId)))
                fail('CREDIT_REFUSED', `${target!.name} declined or removed this credit, so it is not offered again.`);
            if (history.filter(isLive).length >= CREDIT_LIMIT) fail('CREDIT_LIMIT', `A contribution can credit at most ${CREDIT_LIMIT} people.`);
            if (history.length >= CREDIT_HISTORY_LIMIT) fail('CREDIT_LIMIT', 'This contribution has reached its limit of credit invitations.');
            const k: ContributionCredit = { id: makeId(), organizationId: ctx.organizationId, createdAt: now, contributionId: c.id, projectId: p.id, userId: cmd.userId, invitedBy: ctx.userId, role: cmd.role, status: 'invited', respondedAt: null, withdrawnBy: null, withdrawnAt: null };
            s.contributionCredits.push(k);
            notify(k.userId, 'You have been asked to share credit', `${actor.name} would like to credit you on “${c.title}”. Nothing is shown until you accept.`, p.id);
            return { objectId: k.id, message: `Invitation sent. ${target!.name} is credited only after accepting.`, changed: true };
        }
        case 'credit.respond': {
            const k = credit(cmd.creditId);
            if (k.userId !== ctx.userId) missing();
            const { c, p } = contribution(k.contributionId);
            if (k.status !== 'invited') fail('NOT_PENDING', 'This credit is no longer waiting for your answer.');
            k.status = cmd.decision; k.respondedAt = now;
            notify(k.invitedBy, cmd.decision === 'accepted' ? 'Credit accepted' : 'Credit declined', `${actor.name} ${cmd.decision} the credit on “${c.title}”.`, p.id);
            return { objectId: k.id, message: cmd.decision === 'accepted' ? 'Credit accepted. It now shows on the contribution and your profile.' : 'Credit declined. Nothing is shown.', changed: true };
        }
        case 'credit.withdraw': {
            const k = credit(cmd.creditId);
            if (k.userId !== ctx.userId && k.invitedBy !== ctx.userId) missing();
            const { c, p } = contribution(k.contributionId);
            const author = k.invitedBy === ctx.userId && c.userId === ctx.userId;
            if (!author && k.userId !== ctx.userId) missing();
            if (author ? !isLive(k) : k.status !== 'accepted')
                fail('NOT_LIVE', author ? 'This credit has already ended.' : k.status === 'invited' ? 'Decline the invitation instead.' : 'This credit has already ended.');
            const wasAccepted = k.status === 'accepted';
            k.status = 'withdrawn'; k.withdrawnBy = ctx.userId; k.withdrawnAt = now;
            if (wasAccepted) {
                if (author) notify(k.userId, 'A credit was removed', `${actor.name} removed your credit on “${c.title}”.`, p.id);
                else notify(k.invitedBy, 'A credit was removed', `${actor.name} removed their credit on “${c.title}”.`, p.id);
            }
            return { objectId: k.id, message: author ? (wasAccepted ? `${name(k.userId)} is no longer credited.` : 'Invitation withdrawn.') : 'You are no longer credited on this contribution.', changed: true };
        }
        default: return undefined;
    }
}
