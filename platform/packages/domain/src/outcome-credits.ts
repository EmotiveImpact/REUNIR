import { DomainError, type Command, type Member, type Outcome, type OutcomeCredit, type TenantContext, type Workspace } from '../../contracts/src/index';
import { CREDIT_HISTORY_LIMIT, CREDIT_LIMIT, withNames } from '../../contracts/src/credits';
import { actorFor, canSeeSpace, isFormer, onTeam } from './access';
import { isLive } from './credits';

/**
 * Credits on an outcome (decision 059), on the same terms as credits on a contribution (decision 034). The outcome's author
 * invites; the person named accepts or declines; either may later withdraw an accepted credit. For an outcome from project
 * work, only the project's team can be credited; for one from a mission proof, any active member who can see the mission.
 * Credits never feed goals, paths, review, community outputs, reputation, roles or any credential: those read the
 * outcome's own author and review, never this collection.
 */

/**
 * Run after outcomes and members have been filtered for this person. Accepted credits show wherever the outcome shows,
 * while the credited person is visible here; everything else only to the author and the person named.
 */
export function filterOutcomeCredits(s: Workspace, actor: Member): Workspace {
    const outcomes = new Set(s.outcomes.map(o => o.id)), people = new Set(s.members.map(m => m.userId));
    s.outcomeCredits = (s.outcomeCredits ?? []).filter(k => k.organizationId === actor.organizationId && outcomes.has(k.outcomeId)
        && (k.userId === actor.userId || k.invitedBy === actor.userId || (k.status === 'accepted' && people.has(k.userId))));
    return s;
}

/** "With Nia and Theo" for an outcome, from visible accepted credits. */
export function outcomeCreditLine(s: Workspace, outcomeId: string): string {
    return withNames((s.outcomeCredits ?? []).filter(k => k.outcomeId === outcomeId && k.status === 'accepted')
        .map(k => s.members.find(m => m.userId === k.userId)?.name).filter((n): n is string => !!n));
}
/** Outcomes a person is credited on, kept apart from their own. Input is an already visible workspace. */
export const creditedOnOutcomes = (s: Workspace, userId: string) => (s.outcomeCredits ?? [])
    .filter(k => k.userId === userId && k.status === 'accepted')
    .map(k => ({ credit: k, outcome: s.outcomes.find(o => o.id === k.outcomeId) }))
    .filter((x): x is { credit: OutcomeCredit; outcome: Outcome } => !!x.outcome);
/** Whether this person holds an accepted credit on the outcome, so another administrator must review it. */
export const isCreditedOnOutcome = (s: Workspace, outcomeId: string, userId: string) =>
    (s.outcomeCredits ?? []).some(k => k.outcomeId === outcomeId && k.userId === userId && k.status === 'accepted');
/** Whether this person verified the outcome or decided a correction to it, so they cannot also share its credit. */
export const hasReviewedOutcome = (s: Workspace, o: Outcome, userId: string) => o.reviewerId === userId
    || (s.evidenceChanges ?? []).some(x => x.subject === 'outcome' && x.subjectId === o.id && x.kind === 'correction' && x.status !== 'pending' && x.decidedBy === userId);
/** The space an outcome's work happened in: its project's, or the space of the mission its proof answered. */
export function outcomeSpace(s: Workspace, o: Outcome): { found: boolean; spaceId: string | null } {
    if (o.projectId) {
        const p = s.projects.find(x => x.id === o.projectId && x.organizationId === o.organizationId);
        return { found: !!p, spaceId: p?.spaceId ?? null };
    }
    const proof = s.submissions.find(x => x.id === o.submissionId && x.organizationId === o.organizationId);
    const mission = proof && s.missions.find(x => x.id === proof.missionId && x.organizationId === o.organizationId);
    return { found: !!mission, spaceId: mission?.spaceId ?? null };
}
/** Whether a member may be offered a credit on this outcome: active, able to see its work, and on its project's team. */
export function mayBeCredited(s: Workspace, o: Outcome, m: Member): boolean {
    const where = outcomeSpace(s, o);
    return m.status === 'active' && m.organizationId === o.organizationId && where.found && canSeeSpace(s, m, where.spaceId)
        && (!o.projectId || onTeam(s, o.organizationId, o.projectId, m.userId));
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
const commands = new Set(['outcome.credit.invite', 'outcome.credit.respond', 'outcome.credit.withdraw']);
export function applyOutcomeCredits(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (!commands.has(cmd.type)) return undefined;
    s.outcomeCredits ??= [];
    const actor = actorFor(s, ctx);
    const fail = (code: string, message: string, status = 409): never => { throw new DomainError(code, message, status); };
    const missing = (): never => fail('NOT_FOUND', 'That credit is not available.', 404);
    const name = (userId: string) => s.members.find(m => m.organizationId === ctx.organizationId && m.userId === userId)?.name ?? 'This member';
    const outcome = (id: string) => {
        const o = s.outcomes.find(x => x.id === id && x.organizationId === ctx.organizationId) ?? missing();
        const where = outcomeSpace(s, o);
        if (!where.found || !canSeeSpace(s, actor, where.spaceId)) missing();
        return o;
    };
    const credit = (id: string) => s.outcomeCredits.find(k => k.id === id && k.organizationId === ctx.organizationId) ?? missing();
    const notify = (userId: string, title: string, body: string) => {
        if (userId !== ctx.userId && !isFormer(s, userId))
            s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId, title, body, href: '/outputs', readAt: null });
    };
    switch (cmd.type) {
        case 'outcome.credit.invite': {
            const o = outcome(cmd.outcomeId);
            if (o.authorId !== ctx.userId) fail('AUTHOR_REQUIRED', 'Only the person who recorded this outcome can credit others on it.', 403);
            if (o.status === 'withdrawn') fail('OUTCOME_WITHDRAWN', 'This outcome was withdrawn, so nobody new can be credited on it.');
            if (cmd.userId === ctx.userId) fail('SELF_CREDIT', 'This is already your outcome.');
            const target = s.members.find(m => m.organizationId === ctx.organizationId && m.userId === cmd.userId);
            if (!target || !mayBeCredited(s, o, target))
                fail('INVALID_CREDIT', o.projectId ? 'Choose an active member of this project’s team.' : 'Choose an active member who can see this mission.');
            if (hasReviewedOutcome(s, o, cmd.userId)) fail('REVIEWER_NOT_CREDITED', `${target!.name} reviewed this outcome, so they cannot also be credited on it.`);
            const history = s.outcomeCredits.filter(k => k.organizationId === ctx.organizationId && k.outcomeId === o.id);
            const theirs = history.filter(k => k.userId === cmd.userId);
            if (theirs.some(isLive)) fail('ALREADY_CREDITED', `${target!.name} is already credited or invited on this outcome.`);
            if (theirs.some(k => k.status === 'declined' || (k.status === 'withdrawn' && k.withdrawnBy === k.userId)))
                fail('CREDIT_REFUSED', `${target!.name} declined or removed this credit, so it is not offered again.`);
            if (history.filter(isLive).length >= CREDIT_LIMIT) fail('CREDIT_LIMIT', `An outcome can credit at most ${CREDIT_LIMIT} people.`);
            if (history.length >= CREDIT_HISTORY_LIMIT) fail('CREDIT_LIMIT', 'This outcome has reached its limit of credit invitations.');
            const k: OutcomeCredit = { id: makeId(), organizationId: ctx.organizationId, createdAt: now, outcomeId: o.id, projectId: o.projectId, userId: cmd.userId, invitedBy: ctx.userId, role: cmd.role, status: 'invited', respondedAt: null, withdrawnBy: null, withdrawnAt: null };
            s.outcomeCredits.push(k);
            notify(k.userId, 'You have been asked to share credit', `${actor.name} would like to credit you on the outcome “${o.title}”. Nothing is shown until you accept.`);
            return { objectId: k.id, message: `Invitation sent. ${target!.name} is credited only after accepting.`, changed: true };
        }
        case 'outcome.credit.respond': {
            const k = credit(cmd.creditId);
            if (k.userId !== ctx.userId) missing();
            const o = outcome(k.outcomeId);
            if (k.status !== 'invited') fail('NOT_PENDING', 'This credit is no longer waiting for your answer.');
            if (cmd.decision === 'accepted' && hasReviewedOutcome(s, o, ctx.userId)) fail('REVIEWER_NOT_CREDITED', 'You reviewed this outcome, so you cannot also be credited on it. Decline the invitation instead.');
            k.status = cmd.decision; k.respondedAt = now;
            notify(k.invitedBy, cmd.decision === 'accepted' ? 'Credit accepted' : 'Credit declined', `${actor.name} ${cmd.decision} the credit on the outcome “${o.title}”.`);
            return { objectId: k.id, message: cmd.decision === 'accepted' ? 'Credit accepted. It now shows on the outcome and your profile.' : 'Credit declined. Nothing is shown.', changed: true };
        }
        case 'outcome.credit.withdraw': {
            const k = credit(cmd.creditId);
            if (k.userId !== ctx.userId && k.invitedBy !== ctx.userId) missing();
            const o = outcome(k.outcomeId);
            const author = k.invitedBy === ctx.userId && o.authorId === ctx.userId;
            if (!author && k.userId !== ctx.userId) missing();
            if (author ? !isLive(k) : k.status !== 'accepted')
                fail('NOT_LIVE', author ? 'This credit has already ended.' : k.status === 'invited' ? 'Decline the invitation instead.' : 'This credit has already ended.');
            const wasAccepted = k.status === 'accepted';
            k.status = 'withdrawn'; k.withdrawnBy = ctx.userId; k.withdrawnAt = now;
            if (wasAccepted) {
                if (author) notify(k.userId, 'A credit was removed', `${actor.name} removed your credit on the outcome “${o.title}”.`);
                else notify(k.invitedBy, 'A credit was removed', `${actor.name} removed their credit on the outcome “${o.title}”.`);
            }
            return { objectId: k.id, message: author ? (wasAccepted ? `${name(k.userId)} is no longer credited.` : 'Invitation withdrawn.') : 'You are no longer credited on this outcome.', changed: true };
        }
        default: return undefined;
    }
}
