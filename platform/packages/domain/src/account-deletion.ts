import { DomainError, newId, type Workspace } from '../../contracts/src/index';
import { ownerRefusal } from '../../contracts/src/account';
export { FORMER_MEMBER } from '../../contracts/src/account';
import { formerMember } from './access';
export { isFormer, formerMember } from './access';

/**
 * The person's own records, removed outright: goals, saved posts, inbox, reactions, attendance, private-space access,
 * learning and recognition, instructor grants, and credits naming them on other people's contributions (accepted or not).
 * Project team places stay with the project work that refers to them.
 */
export const PERSONAL_COLLECTIONS = ['memberGoals', 'bookmarks', 'notifications', 'reactions', 'rsvps', 'enrolments', 'completions', 'pathEnrolments', 'quizAttempts', 'reputation', 'spaceMembers', 'trackInstructors', 'notificationPreferences', 'contributionCredits'] as const satisfies readonly (keyof Workspace)[];
export type PersonalCollection = typeof PERSONAL_COLLECTIONS[number];

export interface CommunityErasure {
    workspace: Workspace;
    memberId: string;
    /** Rows removed, by collection. Appeals are the person's own too, and are named by their appellant. */
    removed: Record<PersonalCollection | 'moderationAppeals', number>;
    releasedTasks: number;
    rewordedNotices: number;
    /** Task uploads the person started that never became files (pending or refused), with their storage keys. */
    unfinishedUploads: { id: string; objectKey: string }[];
}


/**
 * Erase one person from one community's full state, as deleting their account does in every community. Posts, comments
 * and project work stay so conversations still make sense, attributed to a scrubbed membership shown as "Former member";
 * private things and the person's own learning record go. The caller has already established who is asking (a verified
 * password in live mode) and that they own no community; owners are refused here as well.
 */
export function eraseFromCommunity(input: Workspace, userId: string, now: string, makeId: () => string = newId): CommunityErasure {
    const s = structuredClone(input), org = s.organisation.id;
    const member = s.members.find(m => m.userId === userId && m.organizationId === org);
    if (!member) throw new DomainError('NOT_FOUND', 'That person has no membership in this community.', 404);
    if (member.role === 'owner') throw new DomainError('OWNER_CANNOT_DELETE', ownerRefusal([s.organisation.name]), 409);
    const formerName = member.status === 'left' ? '' : member.name;
    Object.assign(member, formerMember(member));
    const removed = {} as Record<PersonalCollection | 'moderationAppeals', number>;
    for (const key of PERSONAL_COLLECTIONS) {
        const rows = s[key] as { userId: string; organizationId: string }[];
        const kept = rows.filter(r => !(r.userId === userId && r.organizationId === org));
        removed[key] = rows.length - kept.length;
        (s as unknown as Record<string, unknown>)[key] = kept;
    }
    // Their appeals go too: private to them and the community team, and about a decision only they could ask to revisit.
    // Every decision stays in the audit trail, and a post restored on appeal stays restored.
    const appeals = (s.moderationAppeals ?? []).filter(a => !(a.appellantId === userId && a.organizationId === org));
    removed.moderationAppeals = (s.moderationAppeals ?? []).length - appeals.length;
    s.moderationAppeals = appeals;
    // Claimed tasks without submitted proof go back to the team. Tasks with proof keep it, and its contributor.
    let releasedTasks = 0;
    for (const t of s.projectTasks)
        if (t.organizationId === org && t.assigneeId === userId && !t.archived && !t.contributionId) {
            t.assigneeId = null; t.workState = 'todo'; t.version++; t.updatedAt = now; t.updatedBy = null; releasedTasks++;
        }
    // Files they attached to tasks are shared work and stay, shown as from a Former member; the project lead or an
    // administrator can remove one. Uploads they started that never became files are theirs alone and go.
    const unfinishedUploads = (s.uploads ?? []).filter(u => u.organizationId === org && u.userId === userId && u.purpose === 'task_file' && u.status !== 'ready');
    s.uploads = (s.uploads ?? []).filter(u => !unfinishedUploads.includes(u));
    // Notices about the person's activity begin with their name. Reword those in other inboxes, unless another member
    // shares the name, or a notice begins with a longer member name ("Jo Smith" when "Jo" leaves): then it cannot be
    // attributed with confidence and stays as it was.
    let rewordedNotices = 0;
    const others = s.members.filter(m => m.organizationId === org && m.userId !== userId).map(m => m.name);
    if (formerName && !others.includes(formerName))
        for (const n of s.notifications)
            if (n.organizationId === org && n.body.startsWith(formerName + ' ') && !others.some(o => o.length > formerName.length && n.body.startsWith(o + ' '))) {
                n.body = 'A former member ' + n.body.slice(formerName.length + 1); rewordedNotices++;
            }
    s.audit.push({ id: makeId(), organizationId: org, createdAt: now, actorId: userId, action: 'member.account.deleted', objectId: member.id, metadata: { removed: Object.values(removed).reduce((a, b) => a + b, 0), releasedTasks, rewordedNotices } });
    s.revision = input.revision + 1;
    return { workspace: s, memberId: member.id, removed, releasedTasks, rewordedNotices, unfinishedUploads: unfinishedUploads.map(u => ({ id: u.id, objectKey: u.objectKey })) };
}
