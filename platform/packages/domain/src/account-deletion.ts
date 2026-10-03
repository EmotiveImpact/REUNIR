import { DomainError, newId, type Member, type Workspace } from '../../contracts/src/index';
import { FORMER_MEMBER, ownerRefusal } from '../../contracts/src/account';
export { FORMER_MEMBER } from '../../contracts/src/account';
export { isFormer } from './access';

/**
 * Deleting an account, community by community. Posts, comments and project work stay so conversations still make sense,
 * attributed to a scrubbed membership shown as "Former member". Private things and the person's own learning record go.
 */
export const isFormerMember = (m: Pick<Member, 'status'> | undefined) => m?.status === 'left';

/**
 * The person's own records, removed outright: goals, saved posts, inbox, reactions, attendance, private-space access,
 * learning and recognition, and instructor grants. Project team places stay with the project work that refers to them.
 */
export const PERSONAL_COLLECTIONS = ['memberGoals', 'bookmarks', 'notifications', 'reactions', 'rsvps', 'enrolments', 'completions', 'pathEnrolments', 'quizAttempts', 'reputation', 'spaceMembers', 'trackInstructors'] as const satisfies readonly (keyof Workspace)[];
export type PersonalCollection = typeof PERSONAL_COLLECTIONS[number];

export interface CommunityErasure {
    workspace: Workspace;
    memberId: string;
    removed: Record<PersonalCollection, number>;
    releasedTasks: number;
    rewordedNotices: number;
}

/** What a scrubbed membership keeps: its identifiers and joining date. Everything that described the person goes. */
export function scrubbedMember(m: Member): Member {
    return { ...m, name: FORMER_MEMBER, headline: '', bio: '', skills: [], colour: 'neutral', avatar: '', role: 'member', status: 'left' };
}

/**
 * Erase one person from one community's full state. The caller has already established who is asking (a verified
 * password in live mode) and that they own no community; owners are refused here as well.
 */
export function eraseFromCommunity(input: Workspace, userId: string, now: string, makeId: () => string = newId): CommunityErasure {
    const s = structuredClone(input), org = s.organisation.id;
    const member = s.members.find(m => m.userId === userId && m.organizationId === org);
    if (!member) throw new DomainError('NOT_FOUND', 'That person has no membership in this community.', 404);
    if (member.role === 'owner') throw new DomainError('OWNER_CANNOT_DELETE', ownerRefusal([s.organisation.name]), 409);
    const formerName = member.status === 'left' ? '' : member.name;
    Object.assign(member, scrubbedMember(member));
    const removed = {} as Record<PersonalCollection, number>;
    for (const key of PERSONAL_COLLECTIONS) {
        const rows = s[key] as { userId: string; organizationId: string }[];
        const kept = rows.filter(r => !(r.userId === userId && r.organizationId === org));
        removed[key] = rows.length - kept.length;
        (s as unknown as Record<string, unknown>)[key] = kept;
    }
    // Claimed tasks without submitted proof go back to the team. Tasks with proof keep it, and its contributor.
    let releasedTasks = 0;
    for (const t of s.projectTasks)
        if (t.organizationId === org && t.assigneeId === userId && !t.archived && !t.contributionId) {
            t.assigneeId = null; t.workState = 'todo'; t.version++; t.updatedAt = now; releasedTasks++;
        }
    // Notices about the person's activity begin with their name. Reword those in other inboxes, unless another member
    // shares the name, when the notice cannot be attributed with confidence and stays as it was.
    let rewordedNotices = 0;
    const shared = s.members.some(m => m.organizationId === org && m.userId !== userId && m.name === formerName);
    if (formerName && !shared)
        for (const n of s.notifications)
            if (n.organizationId === org && n.body.startsWith(formerName + ' ')) { n.body = 'A former member ' + n.body.slice(formerName.length + 1); rewordedNotices++; }
    s.audit.push({ id: makeId(), organizationId: org, createdAt: now, actorId: userId, action: 'member.account.deleted', objectId: member.id, metadata: { removed: Object.values(removed).reduce((a, b) => a + b, 0), releasedTasks, rewordedNotices } });
    s.revision = input.revision + 1;
    return { workspace: s, memberId: member.id, removed, releasedTasks, rewordedNotices };
}
