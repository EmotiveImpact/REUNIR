import { DomainError, type Command, type Member, type TenantContext, type Workspace } from '../../contracts/src/index';
import { actorFor, isAdmin } from './access';

/**
 * Track instructors are explicit grants. Active owners and administrators author and review every track; an active
 * instructor authors and reviews only the tracks they were granted. Being named as a track's author grants nothing.
 */
export function teaches(s: Workspace, actor: Member, trackId: string): boolean {
    if (actor.status !== 'active') return false;
    return isAdmin(actor) || s.trackInstructors.some(i => i.organizationId === actor.organizationId && i.trackId === trackId && i.userId === actor.userId);
}
/** Tracks this member may author and review. */
export function taughtTracks(s: Workspace, actor: Member): Set<string> {
    return new Set(s.tracks.filter(t => t.organizationId === actor.organizationId && teaches(s, actor, t.id)).map(t => t.id));
}
/** Whether authoring and review open at all: administrators, or instructors of at least one existing track. */
export const teachesAny = (s: Workspace, actor: Member) => taughtTracks(s, actor).size > 0 || (actor.status === 'active' && isAdmin(actor));

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
        if (grant) return { message: `${member.name} already teaches this track.`, objectId: track.id, changed: false };
        s.trackInstructors.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, trackId: track.id, userId: member.userId, grantedBy: ctx.userId });
        if (member.userId !== ctx.userId) s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId: member.userId, title: `You can now teach ${track.title}`, body: `${actor.name} asked you to author lessons and review knowledge checks for this track.`, href: `/learn/${track.id}/studio`, readAt: null });
        return { message: `${member.name} can now author and review ${track.title}.`, objectId: track.id, changed: true, audit: true };
    }
    if (!grant) return { message: 'That member does not teach this track.', objectId: track.id, changed: false };
    s.trackInstructors = s.trackInstructors.filter(i => i !== grant);
    return { message: `${member?.name ?? 'That member'} no longer teaches ${track.title}. Their published lessons and reviews stay.`, objectId: track.id, changed: true, audit: true };
}
