import { DomainError, type Command, type Member, type TeachingRole, type TenantContext, type TrackInstructor, type Workspace } from '../../contracts/src/index';
import { actorFor, isAdmin } from './access';

/** A grant stored before roles existed is an instructor's. */
export const teachingRole = (grant: Pick<TrackInstructor, 'role'>): TeachingRole => grant.role ?? 'instructor';
const grantOf = (s: Workspace, actor: Member, trackId: string) =>
    s.trackInstructors.find(i => i.organizationId === actor.organizationId && i.trackId === trackId && i.userId === actor.userId);

/**
 * Track instructors are explicit grants. Active owners and administrators author and review every track; an active
 * instructor authors, publishes and reviews only the tracks they were granted. Being named as a track's author grants nothing.
 */
export function teaches(s: Workspace, actor: Member, trackId: string): boolean {
    if (actor.status !== 'active') return false;
    if (isAdmin(actor)) return true;
    const grant = grantOf(s, actor, trackId);
    return !!grant && teachingRole(grant) === 'instructor';
}
/**
 * Contributors write a track's drafts and attach its files, and read its history, but publishing, ordering, the cover
 * and knowledge-check answers stay with the track's instructors. Everyone who teaches a track also contributes to it.
 */
export function contributes(s: Workspace, actor: Member, trackId: string): boolean {
    if (actor.status !== 'active') return false;
    return isAdmin(actor) || !!grantOf(s, actor, trackId);
}
/** Tracks this member may publish and review. */
export function taughtTracks(s: Workspace, actor: Member): Set<string> {
    return new Set(s.tracks.filter(t => t.organizationId === actor.organizationId && teaches(s, actor, t.id)).map(t => t.id));
}
/** Tracks whose drafts and files this member may write. */
export function contributedTracks(s: Workspace, actor: Member): Set<string> {
    return new Set(s.tracks.filter(t => t.organizationId === actor.organizationId && contributes(s, actor, t.id)).map(t => t.id));
}
/** Whether review opens at all: administrators, or instructors of at least one existing track. */
export const teachesAny = (s: Workspace, actor: Member) => taughtTracks(s, actor).size > 0 || (actor.status === 'active' && isAdmin(actor));
/** Whether authoring opens at all: anyone who teaches, or contributes to at least one existing track. */
export const contributesAny = (s: Workspace, actor: Member) => contributedTracks(s, actor).size > 0 || (actor.status === 'active' && isAdmin(actor));

/** Grants are shown with the tracks a member can see, so learners know who teaches them. */
export function filterInstructors(s: Workspace, actor: Member): Workspace {
    const tracks = new Set(s.tracks.map(t => t.id));
    s.trackInstructors = s.trackInstructors.filter(i => i.organizationId === actor.organizationId && tracks.has(i.trackId));
    return s;
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
export function applyInstructors(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (cmd.type !== 'track.instructor.add' && cmd.type !== 'track.instructor.remove') return undefined;
    const actor = actorFor(s, ctx);
    if (!isAdmin(actor)) throw new DomainError('ADMIN_REQUIRED', 'Only a community owner or administrator can choose track instructors.', 403);
    const track = s.tracks.find(t => t.id === cmd.trackId && t.organizationId === ctx.organizationId);
    if (!track) throw new DomainError('NOT_FOUND', 'That learning track is not available.', 404);
    const member = s.members.find(m => m.userId === cmd.userId && m.organizationId === ctx.organizationId);
    const grant = s.trackInstructors.find(i => i.organizationId === ctx.organizationId && i.trackId === track.id && i.userId === cmd.userId);
    if (cmd.type === 'track.instructor.add') {
        if (!member || member.status !== 'active') throw new DomainError('MEMBER_UNAVAILABLE', 'Choose an active member of this community.', 409);
        const role = cmd.role;
        if (grant && teachingRole(grant) === role) return { message: role === 'instructor' ? `${member.name} already teaches this track.` : `${member.name} already contributes to this track.`, objectId: track.id, changed: false };
        // Grants are never rewritten: a new role replaces the grant, in this administrator's name.
        if (grant) s.trackInstructors = s.trackInstructors.filter(i => i !== grant);
        s.trackInstructors.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, trackId: track.id, userId: member.userId, grantedBy: ctx.userId, role });
        const notice = role === 'instructor'
            ? { title: `You can now teach ${track.title}`, body: `${actor.name} asked you to author lessons and review knowledge checks for this track.` }
            : { title: `You can now contribute to ${track.title}`, body: `${actor.name} asked you to write lesson drafts for this track. Its instructors publish them.` };
        if (member.userId !== ctx.userId) s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId: member.userId, ...notice, href: `/learn/${track.id}/studio`, readAt: null });
        const message = role === 'instructor' ? `${member.name} can now author and review ${track.title}.` : `${member.name} can now write drafts for ${track.title}. Instructors publish them.`;
        return { message: grant ? `${message} Their earlier role is replaced.` : message, objectId: track.id, changed: true, audit: true };
    }
    if (!grant) return { message: 'That member does not teach this track.', objectId: track.id, changed: false };
    s.trackInstructors = s.trackInstructors.filter(i => i !== grant);
    return { message: `${member?.name ?? 'That member'} no longer teaches ${track.title}. Their published lessons and reviews stay.`, objectId: track.id, changed: true, audit: true };
}
