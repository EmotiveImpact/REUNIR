import { DomainError, type Command, type Member, type TeachingRole, type TenantContext, type Track, type TrackInstructor, type Workspace } from '../../contracts/src/index';
import { actorFor, isAdmin } from './access';

/** A grant stored before roles existed is an instructor's. */
export const teachingRole = (grant: Pick<TrackInstructor, 'role'>): TeachingRole => grant.role ?? 'instructor';
const grantOf = (s: Workspace, actor: Member, trackId: string) =>
    s.trackInstructors.find(i => i.organizationId === actor.organizationId && i.trackId === trackId && i.userId === actor.userId);

/**
 * Which lessons a grant covers: the whole track when it lists none, otherwise only the lessons it lists. Work that
 * belongs to the track as a whole (a new lesson, the order, the cover) is covered only by a whole-track grant.
 */
export const coversLesson = (grant: Pick<TrackInstructor, 'lessonIds'>, lessonId: string | null): boolean =>
    !grant.lessonIds || (!!lessonId && grant.lessonIds.includes(lessonId));

/**
 * Track instructors are explicit grants. Active owners and administrators author and review every track; an active
 * instructor authors, publishes and reviews only what they were granted: a whole track, or some of its lessons. Without
 * a lesson, the question is about the whole track. Being named as a track's author grants nothing.
 */
export function teaches(s: Workspace, actor: Member, trackId: string, lessonId: string | null = null): boolean {
    if (actor.status !== 'active') return false;
    if (isAdmin(actor)) return true;
    const grant = grantOf(s, actor, trackId);
    return !!grant && teachingRole(grant) === 'instructor' && coversLesson(grant, lessonId);
}
/**
 * Contributors write drafts and attach files, and read history, for what they were granted, but publishing, ordering,
 * the cover and knowledge-check answers stay with the track's instructors. Everyone who teaches also contributes.
 */
export function contributes(s: Workspace, actor: Member, trackId: string, lessonId: string | null = null): boolean {
    if (actor.status !== 'active') return false;
    if (isAdmin(actor)) return true;
    const grant = grantOf(s, actor, trackId);
    return !!grant && coversLesson(grant, lessonId);
}
/** Any current grant on the track, whole or for some lessons: the creator studio and the track's files open. */
export function holdsGrant(s: Workspace, actor: Member, trackId: string): boolean {
    if (actor.status !== 'active') return false;
    return isAdmin(actor) || !!grantOf(s, actor, trackId);
}
/** An instructor's grant on the track, whole or for some lessons. */
export function teachesPart(s: Workspace, actor: Member, trackId: string): boolean {
    if (actor.status !== 'active') return false;
    if (isAdmin(actor)) return true;
    const grant = grantOf(s, actor, trackId);
    return !!grant && teachingRole(grant) === 'instructor';
}
/**
 * Who may start a new track: owners and administrators, and active instructors of at least one whole track. A track an
 * instructor starts stays unpublished, seen only by them and administrators, until an administrator publishes it.
 */
export function startsTracks(s: Workspace, actor: Member): boolean {
    if (actor.status !== 'active') return false;
    return isAdmin(actor) || s.trackInstructors.some(i => i.organizationId === actor.organizationId && i.userId === actor.userId && teachingRole(i) === 'instructor' && !i.lessonIds && s.tracks.some(t => t.id === i.trackId && t.organizationId === actor.organizationId));
}
/** A published track is open to everyone who can see its space; an unpublished one to administrators and its own grants. */
export const seesTrack = (s: Workspace, actor: Member, track: Pick<Track, 'id' | 'published'>) => track.published || holdsGrant(s, actor, track.id);
/** Tracks where this member publishes or reviews at least one lesson. */
export function taughtTracks(s: Workspace, actor: Member): Set<string> {
    return new Set(s.tracks.filter(t => t.organizationId === actor.organizationId && teachesPart(s, actor, t.id)).map(t => t.id));
}
/** Tracks whose studio and files open for this member. */
export function contributedTracks(s: Workspace, actor: Member): Set<string> {
    return new Set(s.tracks.filter(t => t.organizationId === actor.organizationId && holdsGrant(s, actor, t.id)).map(t => t.id));
}
/** Whether review opens at all: administrators, or instructors of at least one existing track or lesson. */
export const teachesAny = (s: Workspace, actor: Member) => taughtTracks(s, actor).size > 0 || (actor.status === 'active' && isAdmin(actor));
/** Whether authoring opens at all: anyone with a grant on at least one existing track. */
export const contributesAny = (s: Workspace, actor: Member) => contributedTracks(s, actor).size > 0 || (actor.status === 'active' && isAdmin(actor));

/** Grants are shown with the tracks a member can see, so learners know who teaches them. */
export function filterInstructors(s: Workspace, actor: Member): Workspace {
    const tracks = new Set(s.tracks.map(t => t.id));
    s.trackInstructors = s.trackInstructors.filter(i => i.organizationId === actor.organizationId && tracks.has(i.trackId));
    return s;
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
/** The lessons a grant names, each a lesson of this track, once and in a stable order; null for the whole track. */
function grantedLessons(s: Workspace, ctx: TenantContext, trackId: string, lessonIds: readonly string[] | null): string[] | null {
    if (!lessonIds) return null;
    const unique = [...new Set(lessonIds)].sort();
    if (unique.some(id => !s.lessons.some(l => l.id === id && l.trackId === trackId && l.organizationId === ctx.organizationId))) throw new DomainError('LESSON_UNAVAILABLE', 'Choose lessons from this track.', 409);
    return unique;
}
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
        const role = cmd.role, lessonIds = grantedLessons(s, ctx, track.id, cmd.lessonIds);
        const same = (g: TrackInstructor) => teachingRole(g) === role && JSON.stringify(g.lessonIds ?? null) === JSON.stringify(lessonIds);
        if (grant && same(grant)) return { message: role === 'instructor' ? `${member.name} already teaches this.` : `${member.name} already contributes to this.`, objectId: track.id, changed: false };
        // Grants are never rewritten: a new role or set of lessons replaces the grant, in this administrator's name.
        if (grant) s.trackInstructors = s.trackInstructors.filter(i => i !== grant);
        s.trackInstructors.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, trackId: track.id, userId: member.userId, grantedBy: ctx.userId, role, lessonIds });
        const scope = lessonIds ? `${lessonIds.length} ${lessonIds.length === 1 ? 'lesson' : 'lessons'} of ${track.title}` : track.title;
        const notice = role === 'instructor'
            ? { title: `You can now teach ${scope}`, body: `${actor.name} asked you to author lessons and review knowledge checks ${lessonIds ? 'for these lessons' : 'for this track'}.` }
            : { title: `You can now contribute to ${scope}`, body: `${actor.name} asked you to write lesson drafts ${lessonIds ? 'for these lessons' : 'for this track'}. Its instructors publish them.` };
        if (member.userId !== ctx.userId) s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId: member.userId, ...notice, href: `/learn/${track.id}/studio`, readAt: null });
        const message = role === 'instructor' ? `${member.name} can now author and review ${scope}.` : `${member.name} can now write drafts for ${scope}. Instructors publish them.`;
        return { message: grant ? `${message} Their earlier grant is replaced.` : message, objectId: track.id, changed: true, audit: true };
    }
    if (!grant) return { message: 'That member does not teach this track.', objectId: track.id, changed: false };
    s.trackInstructors = s.trackInstructors.filter(i => i !== grant);
    return { message: `${member?.name ?? 'That member'} no longer teaches ${track.title}. Their published lessons and reviews stay.`, objectId: track.id, changed: true, audit: true };
}
