import { DomainError, type Command, type Contribution, type EvidenceChange, type EvidenceSubject, type EvidenceText, type Member, type Outcome, type TenantContext, type Workspace } from '../../contracts/src/index';
import { actorFor, canSeeSpace, isAdmin, isFormer } from './access';

/**
 * Reviewed evidence is never rewritten in place. Its author can propose a correction, which a reviewer accepts or declines,
 * and its author or an administrator can withdraw it with a reason. Every change keeps the reviewed wording it replaced, so
 * the history reads in order. Withdrawn evidence stops counting: paths, profiles, goals and outputs that relied on it follow.
 */
type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
export type EvidenceRecord = Contribution | Outcome;

const commands = new Set(['evidence.correct', 'evidence.correction.review', 'evidence.withdraw']);
/** The same limits as when the evidence was first submitted. */
const LIMITS: Record<EvidenceSubject, { title: number; text: number }> = { contribution: { title: 140, text: 8000 }, outcome: { title: 160, text: 5000 } };

export const evidenceText = (subject: EvidenceSubject, x: EvidenceRecord): EvidenceText =>
    ({ title: x.title, text: subject === 'contribution' ? (x as Contribution).body : (x as Outcome).summary, evidenceUrl: x.evidenceUrl });
export const evidenceAuthor = (subject: EvidenceSubject, x: EvidenceRecord): string => subject === 'contribution' ? (x as Contribution).userId : (x as Outcome).authorId;
/** Recognised contributions and verified outcomes: the evidence that counts, and the only evidence this history changes. */
export const isReviewedEvidence = (subject: EvidenceSubject, x: EvidenceRecord): boolean => x.status === (subject === 'contribution' ? 'recognised' : 'verified');
/** Who reviews a correction: whoever could give the first review. A project owner or administrator for a contribution, an administrator for an outcome. */
export function canReviewEvidence(s: Workspace, subject: EvidenceSubject, x: EvidenceRecord, who: Member): boolean {
    if (who.status !== 'active' || who.organizationId !== x.organizationId) return false;
    if (isAdmin(who)) return true;
    return subject === 'contribution' && s.projects.some(p => p.id === (x as Contribution).projectId && p.organizationId === x.organizationId && p.ownerId === who.userId);
}

export function applyEvidenceHistory(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (!commands.has(cmd.type)) return undefined;
    s.evidenceChanges ??= [];
    const actor = actorFor(s, ctx);
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    const missing = (): never => { throw new DomainError('NOT_FOUND', 'That item is not available.', 404); };
    const forbidden = (message: string): never => { throw new DomainError('FORBIDDEN', message, 403); };
    const conflict = (code: string, message: string): never => { throw new DomainError(code, message, 409); };
    const find = <T extends { id: string; organizationId: string }>(xs: T[], id: string): T => xs.find(x => x.id === id && x.organizationId === ctx.organizationId) ?? missing();
    const notify = (userId: string, title: string, body: string, href: string) => { if (userId !== ctx.userId && !isFormer(s, userId)) s.notifications.push({ ...base(), userId, title, body, href, readAt: null }); };
    const space = (id: string | null) => { if (!canSeeSpace(s, actor, id)) missing(); };
    const project = (id: string) => space(find(s.projects, id).spaceId);
    /** The evidence, if this person may see where it came from: its project, or its mission and that mission's track. */
    const load = (subject: EvidenceSubject, id: string): EvidenceRecord => {
        if (subject === 'contribution') { const c = find(s.contributions, id); project(c.projectId); return c; }
        const o = find(s.outcomes, id);
        if (o.projectId) project(o.projectId);
        if (o.contributionId) project(find(s.contributions, o.contributionId).projectId);
        if (o.submissionId) { const m = find(s.missions, find(s.submissions, o.submissionId).missionId); space(m.spaceId); if (m.trackId) space(find(s.tracks, m.trackId).spaceId); }
        return o;
    };
    const href = (subject: EvidenceSubject, x: EvidenceRecord) => subject === 'contribution' ? `/projects/${(x as Contribution).projectId}` : '/outputs';
    const reviewers = (subject: EvidenceSubject, x: EvidenceRecord) =>
        s.members.filter(m => m.organizationId === ctx.organizationId && m.userId !== evidenceAuthor(subject, x) && canReviewEvidence(s, subject, x, m)).map(m => m.userId);
    const pending = (subjectId: string) => s.evidenceChanges.find(c => c.organizationId === ctx.organizationId && c.subjectId === subjectId && c.status === 'pending');
    /** Withdraws one piece of evidence and, for a contribution, the verified outcomes built on it. Returns the changes recorded. */
    const withdraw = (subject: EvidenceSubject, x: EvidenceRecord, reason: string): EvidenceChange[] => {
        const open = pending(x.id);
        if (open) Object.assign(open, { status: 'declined', decidedBy: ctx.userId, decidedAt: now, response: 'The evidence was withdrawn.' });
        const change: EvidenceChange = { ...base(), subject, subjectId: x.id, kind: 'withdrawal', requestedBy: ctx.userId, reason, previous: evidenceText(subject, x), proposed: null, previousStatus: subject === 'contribution' ? 'recognised' : 'verified', status: 'applied', decidedBy: ctx.userId, decidedAt: now, response: '' };
        s.evidenceChanges.push(change);
        const recorded = [change];
        x.status = 'withdrawn';
        if (subject === 'outcome') {
            // A goal completed with this outcome is open again: completion follows the evidence.
            for (const g of s.memberGoals.filter(g => g.organizationId === ctx.organizationId && g.outcomeId === x.id && g.status === 'completed')) {
                Object.assign(g, { status: 'active', completedAt: null, outcomeId: null });
                notify(g.userId, 'A goal is open again', `The outcome “${x.title}” was withdrawn, so the goal it completed is open again.`, `/members/${g.userId}`);
            }
        } else {
            // Outcomes still waiting for review cannot be verified without a recognised source, so only verified ones follow.
            for (const o of s.outcomes.filter(o => o.organizationId === ctx.organizationId && o.contributionId === x.id && o.status === 'verified'))
                recorded.push(...withdraw('outcome', o, 'The contribution it was built on was withdrawn.'));
        }
        return recorded;
    };

    switch (cmd.type) {
        case 'evidence.correct': {
            const x = load(cmd.subject, cmd.subjectId);
            if (evidenceAuthor(cmd.subject, x) !== ctx.userId) forbidden('Only its author can ask to correct this evidence.');
            if (!isReviewedEvidence(cmd.subject, x)) conflict('NOT_REVIEWED', 'Only reviewed evidence is corrected this way. Revise it while it is with the reviewers instead.');
            if (pending(x.id)) conflict('CORRECTION_PENDING', 'A correction to this evidence is already waiting for review.');
            const limit = LIMITS[cmd.subject];
            if (cmd.title.length > limit.title || cmd.text.length > limit.text) throw new DomainError('TOO_LONG', `Keep the title within ${limit.title} characters and the text within ${limit.text}.`, 400);
            const proposed: EvidenceText = { title: cmd.title, text: cmd.text, evidenceUrl: cmd.evidenceUrl };
            const previous = evidenceText(cmd.subject, x);
            if (previous.title === proposed.title && previous.text === proposed.text && previous.evidenceUrl === proposed.evidenceUrl) conflict('NO_CHANGE', 'Change something before asking for a correction.');
            const change: EvidenceChange = { ...base(), subject: cmd.subject, subjectId: x.id, kind: 'correction', requestedBy: ctx.userId, reason: cmd.reason, previous, proposed, previousStatus: cmd.subject === 'contribution' ? 'recognised' : 'verified', status: 'pending', decidedBy: null, decidedAt: null, response: '' };
            s.evidenceChanges.push(change);
            for (const u of reviewers(cmd.subject, x)) notify(u, 'A correction to review', `${actor.name} asked to correct “${x.title}”.`, href(cmd.subject, x));
            return { message: 'Correction sent for review. The reviewed version stays until it is accepted.', objectId: change.id, changed: true, audit: true };
        }
        case 'evidence.correction.review': {
            const change = find(s.evidenceChanges, cmd.changeId);
            const x = load(change.subject, change.subjectId);
            const author = evidenceAuthor(change.subject, x);
            if (change.kind !== 'correction' || change.status !== 'pending') {
                // Someone who could not see the pending correction learns nothing from this refusal.
                if (author !== ctx.userId && !canReviewEvidence(s, change.subject, x, actor)) missing();
                conflict('NOT_PENDING', 'This correction is no longer waiting for review.');
            }
            if (change.requestedBy === ctx.userId || author === ctx.userId) forbidden('You cannot review a correction to your own evidence.');
            if (!canReviewEvidence(s, change.subject, x, actor)) missing();
            Object.assign(change, { status: cmd.decision, decidedBy: ctx.userId, decidedAt: now, response: cmd.response });
            if (cmd.decision === 'accepted') {
                const t = change.proposed!;
                x.title = t.title; x.evidenceUrl = t.evidenceUrl;
                if (change.subject === 'contribution') (x as Contribution).body = t.text; else (x as Outcome).summary = t.text;
                // A published output repeats its outcome's words, so it follows the correction.
                if (change.subject === 'outcome')
                    for (const out of s.communityOutputs.filter(o => o.organizationId === ctx.organizationId && o.outcomeId === x.id))
                        Object.assign(out, { title: x.title, summary: (x as Outcome).summary, evidenceUrl: x.evidenceUrl });
            }
            notify(change.requestedBy, cmd.decision === 'accepted' ? 'Your correction was accepted' : 'Your correction was not accepted', cmd.response, href(change.subject, x));
            return { message: cmd.decision === 'accepted' ? 'Correction accepted. The earlier wording stays in the history.' : 'Correction declined. The reviewed version stays.', objectId: change.id, changed: true, audit: true };
        }
        case 'evidence.withdraw': {
            const x = load(cmd.subject, cmd.subjectId);
            const author = evidenceAuthor(cmd.subject, x), own = author === ctx.userId;
            if (!own && !isAdmin(actor)) forbidden('Only its author or a community administrator can withdraw this evidence.');
            if (!isReviewedEvidence(cmd.subject, x)) conflict('NOT_REVIEWED', 'Only reviewed evidence can be withdrawn.');
            const recorded = withdraw(cmd.subject, x, cmd.reason);
            if (!own) notify(author, 'Your evidence was withdrawn', `${actor.name} withdrew “${x.title}”: ${cmd.reason}`, href(cmd.subject, x));
            else if (x.reviewerId) notify(x.reviewerId, 'Evidence you reviewed was withdrawn', `${actor.name} withdrew “${x.title}”.`, href(cmd.subject, x));
            const more = recorded.length - 1;
            return { message: more ? `Withdrawn, with ${more} outcome${more > 1 ? 's' : ''} built on it. The history keeps what was reviewed.` : 'Withdrawn. The history keeps what was reviewed.', objectId: recorded[0].id, changed: true, audit: true };
        }
        default: return undefined;
    }
}

/**
 * The history a person may read: changes to evidence they can already see (run after the purpose filter). A pending
 * correction is shown only to its author, administrators and, for a contribution, the project owner.
 */
export function filterEvidenceHistory(s: Workspace, ctx: TenantContext, actor: Member): Workspace {
    const contributions = new Map(s.contributions.map(c => [c.id, c])), outcomes = new Map(s.outcomes.map(o => [o.id, o]));
    s.evidenceChanges = (s.evidenceChanges ?? []).filter(c => {
        if (c.organizationId !== ctx.organizationId) return false;
        const x = c.subject === 'contribution' ? contributions.get(c.subjectId) : outcomes.get(c.subjectId);
        if (!x) return false;
        if (c.status !== 'pending') return true;
        return evidenceAuthor(c.subject, x) === ctx.userId || canReviewEvidence(s, c.subject, x, actor);
    });
    return s;
}

/** A record's history, oldest first; changes made at the same moment keep the order they were made in. */
export const historyOf = (s: Workspace, subjectId: string): EvidenceChange[] =>
    (s.evidenceChanges ?? []).filter(c => c.subjectId === subjectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
