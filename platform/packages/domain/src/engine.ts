import { commandSchema, DomainError, newId, type Command, type Workspace, type TenantContext, type TenantRecord, type Member, type MutationResult } from '../../contracts/src/index';
import { isAdmin, isModerator, actorFor, canSeeSpace, isFormer, formerMember } from './access';
export { isAdmin, isModerator, actorFor, canSeeSpace, isFormer } from './access';
import { applyProjectWork, filterProjectWork } from './project-work';
import { applyAuthoring, filterAuthoring } from './authoring';
import { normalisePurposeState, filterPurposeWorkspace, applyPurposeCommand } from './purpose';
import { visibleUploads } from './resources';
import { visibleTaskFiles } from './task-files';
import { applyCovers, filterCoverLibrary } from './covers';
import { applyInstructors, filterInstructors } from './instructors';
import { applyAssessment, filterAssessments } from './assessments';
import { windowWorkspace } from './pages';
import { applyNotificationSettings, dropMutedNotices } from './notifications';
import { applyAppeals, filterAppeals } from './appeals';
import { APPEALS_HREF } from '../../contracts/src/appeals';
import { applyCollections, filterCollections } from './collections';
/**
 * What this person may see, shortened for the browser: recent notices and audit entries and only their own attempts, with
 * exact totals in `summary`. The rest of those lists comes a page at a time (`pageOf`). `auditTotal` is the full trail's
 * length when the caller read only its newest entries.
 */
export function visibleWorkspace(state: Workspace, ctx: TenantContext, auditTotal?: number): Workspace {
    return windowWorkspace(visibleRecords(state, ctx), ctx, auditTotal);
}
/** Everything this person may see, unshortened. Pages are cut from this. */
export function visibleRecords(state: Workspace, ctx: TenantContext): Workspace {
    const actor = actorFor(state, ctx);
    const s = normalisePurposeState(structuredClone(state));
    s.spaces = s.spaces.filter(x => canSeeSpace(s, actor, x.id));
    const spaces = new Set(s.spaces.map(x => x.id));
    s.spaceMembers = s.spaceMembers.filter(x => spaces.has(x.spaceId));
    // A hidden post stays visible to its author, so they know what was hidden and can appeal.
    s.posts = s.posts.filter(p => spaces.has(p.spaceId) && (!p.hidden || isModerator(actor) || p.authorId === ctx.userId));
    const posts = new Set(s.posts.map(p => p.id));
    s.comments = s.comments.filter(x => posts.has(x.postId));
    s.reactions = s.reactions.filter(x => posts.has(x.postId));
    s.bookmarks = s.bookmarks.filter(x => posts.has(x.postId) && x.userId === ctx.userId);
    s.tracks = s.tracks.filter(x => (!x.spaceId || spaces.has(x.spaceId)) && (x.published || isAdmin(actor)));
    const tracks = new Set(s.tracks.map(x => x.id));
    s.lessons = s.lessons.filter(x => tracks.has(x.trackId) && (x.published || isAdmin(actor)));
    s.enrolments = s.enrolments.filter(x => tracks.has(x.trackId) && x.userId === ctx.userId);
    s.completions = s.completions.filter(x => tracks.has(x.trackId) && x.userId === ctx.userId);
    s.missions = s.missions.filter(x => (!x.spaceId || spaces.has(x.spaceId)) && (!x.trackId || tracks.has(x.trackId)));
    const missions = new Set(s.missions.map(x => x.id));
    s.submissions = s.submissions.filter(x => missions.has(x.missionId) && (x.authorId === ctx.userId || isAdmin(actor) || x.status === 'approved'));
    s.projects = s.projects.filter(x => !x.spaceId || spaces.has(x.spaceId));
    const projects = new Set(s.projects.map(x => x.id));
    s.projectMembers = s.projectMembers.filter(x => projects.has(x.projectId));
    s.projectUpdates = s.projectUpdates.filter(x => projects.has(x.projectId));
    s.events = s.events.filter(x => !x.spaceId || spaces.has(x.spaceId));
    const events = new Set(s.events.map(x => x.id));
    s.rsvps = s.rsvps.filter(x => events.has(x.eventId));
    s.notifications = s.notifications.filter(x => x.userId === ctx.userId);
    s.notificationPreferences = s.notificationPreferences.filter(x => x.userId === ctx.userId && x.organizationId === ctx.organizationId);
    s.reports = isModerator(actor) ? s.reports.filter(x => posts.has(x.postId)) : [];
    s.audit = isAdmin(actor) ? s.audit.slice(-100) : [];
    s.outbox = [];
    const visibleLessons = new Set(s.lessons.map(x => x.id));
    s.completions = s.completions.filter(x => visibleLessons.has(x.lessonId));
    // Keep recognition totals without exposing titles/identifiers from private learning or missions.
    s.reputation = s.reputation.map(r => { const [kind, target] = r.sourceId.split(':'); const hidden = kind === 'lesson' ? !visibleLessons.has(target) : kind === 'mission' ? !missions.has(target) : false; return hidden ? { ...r, sourceId: r.id, description: 'Recognised community activity' } : r; });
    // Do not expose suspended members as active directory entries. Retain authors already visible. Former members stay
    // visible to everyone as scrubbed records, so their kept posts and work read "Former member"; directories skip them.
    // A membership that left before account deletion existed may still hold its details, so every one is scrubbed here.
    s.members = s.members.filter(x => x.status !== 'suspended' || isAdmin(actor)).map(x => x.status === 'left' ? formerMember(x) : x);
    s.uploads = [...visibleUploads(s, actor), ...visibleTaskFiles(s, actor)];
    // Collections last: an item is kept only when its content survived every filter above.
    return filterCollections(filterAppeals(filterAssessments(filterAuthoring(filterCoverLibrary(filterInstructors(filterProjectWork(filterPurposeWorkspace(s, ctx, actor), actor), actor), actor), actor), actor), actor), actor);
}
export function progress(state: Workspace, userId: string, trackId: string) {
    const lessons = state.lessons.filter(l => l.trackId === trackId && l.published);
    const done = new Set(state.completions.filter(c => c.userId === userId && c.trackId === trackId).map(c => c.lessonId));
    const completed = lessons.filter(l => done.has(l.id)).length;
    return { completed, total: lessons.length, percent: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
}
export function reputationTotals(state: Workspace, userId: string) {
    const totals = { learning: 0, building: 0, contribution: 0, total: 0 };
    for (const r of state.reputation.filter(x => x.userId === userId)) {
        totals[r.dimension] += r.points;
        totals.total += r.points;
    }
    return totals;
}
export function applyCommand(input: Workspace, ctx: TenantContext, raw: unknown, clock = () => new Date().toISOString(), makeId = () => newId()): MutationResult {
    const cmd = commandSchema.parse(raw);
    const actor = actorFor(input, ctx);
    const s = normalisePurposeState(structuredClone(input));
    const now = clock();
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    const fail = (message = 'That item is not available.') => { throw new DomainError('NOT_FOUND', message, 404); };
    const find = <T extends TenantRecord>(rows: T[], id: string): T => rows.find(r => r.id === id && r.organizationId === ctx.organizationId) ?? fail();
    const scope = (spaceId: string | null) => { if (!canSeeSpace(s, actor, spaceId))
        fail(); };
    const admin = () => { if (!isAdmin(actor))
        throw new DomainError('FORBIDDEN', 'An administrator is required.', 403); };
    const post = (id: string) => { const p = find(s.posts, id); scope(p.spaceId); if (p.hidden && !isModerator(actor))
        fail(); return p; };
    const track = (id: string) => { const t = find(s.tracks, id); scope(t.spaceId); if (!t.published && !isAdmin(actor))
        fail(); return t; };
    const mission = (id: string) => { const m = find(s.missions, id); scope(m.spaceId); if (m.trackId)
        track(m.trackId); return m; };
    const project = (id: string) => { const p = find(s.projects, id); scope(p.spaceId); return p; };
    const notify = (userId: string, title: string, body: string, href: string) => { if (userId !== ctx.userId && !isFormer(s, userId))
        s.notifications.push({ ...base(), userId, title, body, href, readAt: null }); };
    const award = (userId: string, dimension: 'learning' | 'building' | 'contribution', points: number, sourceId: string, description: string) => {
        if (!isFormer(s, userId) && !s.reputation.some(r => r.userId === userId && r.sourceId === sourceId))
            s.reputation.push({ ...base(), userId, dimension, points, sourceId, description });
    };
    const audit = (action: string, objectId: string) => s.audit.push({ ...base(), actorId: ctx.userId, action, objectId, metadata: { requestId: ctx.requestId } });
    let message = 'Saved.';
    let objectId: string | undefined;
    let changed = true;
    const noticesBefore = new Set(s.notifications.map(n => n.id));
    const purposeResult = applyNotificationSettings(s, ctx, cmd, now, makeId) ?? applyAuthoring(s, ctx, cmd, now, makeId) ?? applyAssessment(s, ctx, cmd, now, makeId) ?? applyProjectWork(s, ctx, cmd, now, makeId) ?? applyCovers(s, ctx, cmd, now, makeId) ?? applyInstructors(s, ctx, cmd, now, makeId) ?? applyAppeals(s, ctx, cmd, now, makeId) ?? applyCollections(s, ctx, cmd, now, makeId) ?? applyPurposeCommand(s, ctx, cmd, now, makeId);
    if (purposeResult) {
        message = purposeResult.message;
        objectId = purposeResult.objectId;
        changed = purposeResult.changed;
        if (changed && purposeResult.audit) audit(cmd.type, objectId!);
    } else switch (cmd.type) {
        case 'member.status': {
            admin(); const target = find(s.members, cmd.memberId);
            if (target.userId === ctx.userId || target.role === 'owner' || (actor.role !== 'owner' && target.role === 'admin'))
                throw new DomainError('PROTECTED_MEMBER', 'You cannot change access for this member.', 403);
            if (target.status === 'left') throw new DomainError('REJOIN_REQUIRED', 'A former member must accept a new invitation.', 409);
            changed = target.status !== cmd.status; target.status = cmd.status; objectId = target.id;
            if (changed) { audit('member.' + cmd.status, target.id); s.audit[s.audit.length-1].metadata.reason=cmd.reason; }
            message = cmd.status === 'suspended' ? 'Community access suspended. Existing work is preserved.' : 'Community access restored.'; break;
        }
        case 'member.role': {
            if (actor.role !== 'owner') throw new DomainError('OWNER_REQUIRED', 'Only the community owner can assign roles.', 403);
            const target = find(s.members, cmd.memberId);
            if (target.role === 'owner' || target.userId === ctx.userId) throw new DomainError('PROTECTED_MEMBER', 'Owner transfer is a separate, deliberate process.', 403);
            if (target.status !== 'active') throw new DomainError('INACTIVE_MEMBER', 'Restore membership before assigning a role.', 409);
            changed = target.role !== cmd.role; target.role=cmd.role; objectId=target.id;
            if(changed) audit('member.role.'+cmd.role,target.id); message='Community role updated.'; break;
        }
        case 'space.access': {
            admin(); const space=find(s.spaces,cmd.spaceId);
            const target=s.members.find(m=>m.userId===cmd.userId && m.organizationId===ctx.organizationId && m.status==='active');
            if(!target) fail();
            if(space.visibility!=='private') throw new DomainError('NOT_PRIVATE','This space is already open to members.');
            const old=s.spaceMembers.find(m=>m.spaceId===space.id && m.userId===cmd.userId);
            changed=cmd.granted ? !old : !!old;
            if(cmd.granted && !old) s.spaceMembers.push({...base(),spaceId:space.id,userId:cmd.userId});
            if(!cmd.granted) s.spaceMembers=s.spaceMembers.filter(m=>!(m.spaceId===space.id && m.userId===cmd.userId));
            objectId=space.id; if(changed) audit(cmd.granted?'space.access.granted':'space.access.revoked',space.id);
            message=cmd.granted?'Private-space access granted.':'Private-space access removed.'; break;
        }
        case 'post.create': {
            scope(cmd.spaceId);
            const p = { ...base(), spaceId: cmd.spaceId, authorId: ctx.userId, kind: cmd.kind, title: cmd.title, body: cmd.body, pinned: false, hidden: false, cover: '', moderatedBy: null, moderatedAt: null };
            s.posts.unshift(p);
            objectId = p.id;
            message = 'Your post is in the conversation.';
            break;
        }
        case 'post.comment': {
            const p = post(cmd.postId);
            const c = { ...base(), postId: p.id, authorId: ctx.userId, body: cmd.body };
            s.comments.push(c);
            objectId = c.id;
            notify(p.authorId, 'A new perspective', `${actor.name} replied to your post.`, `/post/${p.id}`);
            message = 'Reply added.';
            break;
        }
        case 'post.react': {
            const p = post(cmd.postId);
            const i = s.reactions.findIndex(x => x.postId === p.id && x.userId === ctx.userId);
            if (i >= 0) {
                s.reactions.splice(i, 1);
                message = 'Reaction removed.';
            }
            else {
                s.reactions.push({ ...base(), postId: p.id, userId: ctx.userId });
                message = 'A little appreciation goes a long way.';
            }
            objectId = p.id;
            break;
        }
        case 'post.bookmark': {
            const p = post(cmd.postId);
            const i = s.bookmarks.findIndex(x => x.postId === p.id && x.userId === ctx.userId);
            if (i >= 0) {
                s.bookmarks.splice(i, 1);
                message = 'Removed from saved.';
            }
            else {
                s.bookmarks.push({ ...base(), postId: p.id, userId: ctx.userId });
                message = 'Saved for a quieter moment.';
            }
            objectId = p.id;
            break;
        }
        case 'post.report': {
            const p = post(cmd.postId);
            if (s.reports.some(x => x.postId === p.id && x.userId === ctx.userId && x.status === 'open')) {
                changed = false;
                message = 'Your report is already with the moderators.';
                break;
            }
            s.reports.push({ ...base(), postId: p.id, userId: ctx.userId, reason: cmd.reason, status: 'open' });
            objectId = p.id;
            message = 'Reported privately to the community team.';
            break;
        }
        case 'post.moderate': {
            if (!isModerator(actor))
                throw new DomainError('FORBIDDEN', 'A moderator is required.', 403);
            const p = post(cmd.postId);
            // Who changed the post's visibility, and when, is recorded when it changes.
            if (p.hidden !== cmd.hidden) {
                p.moderatedBy = ctx.userId;
                p.moderatedAt = now;
                if (cmd.hidden)
                    notify(p.authorId, 'Your post was hidden', `${p.title ? `A moderator hid your post “${p.title}” from members.` : 'A moderator hid one of your posts from members.'} Only you can still see it, and you can appeal.`, APPEALS_HREF);
            }
            p.hidden = cmd.hidden;
            for (const r of s.reports.filter(x => x.postId === p.id))
                r.status = 'resolved';
            audit(cmd.hidden ? 'post.hidden' : 'post.restored', p.id);
            objectId = p.id;
            message = cmd.hidden ? 'Post hidden from members.' : 'Post restored.';
            break;
        }
        case 'track.enrol': {
            const t = track(cmd.trackId);
            if (s.enrolments.some(x => x.trackId === t.id && x.userId === ctx.userId)) {
                changed = false;
                message = 'You are already on this track.';
            }
            else {
                s.enrolments.push({ ...base(), trackId: t.id, userId: ctx.userId });
                message = 'A new direction. Let’s begin.';
            }
            objectId = t.id;
            break;
        }
        case 'lesson.complete': {
            const t = track(cmd.trackId);
            const l = find(s.lessons, cmd.lessonId);
            if (l.trackId !== t.id || !l.published)
                fail();
            if (!s.enrolments.some(x => x.userId === ctx.userId && x.trackId === t.id))
                throw new DomainError('ENROL_FIRST', 'Join this learning track first.', 409);
            if (s.completions.some(x => x.userId === ctx.userId && x.lessonId === l.id)) {
                changed = false;
                message = 'This lesson is already complete.';
            }
            else {
                s.completions.push({ ...base(), trackId: t.id, lessonId: l.id, userId: ctx.userId });
                award(ctx.userId, 'learning', 20, `lesson:${l.id}:${ctx.userId}`, `Completed ${l.title}`);
                message = 'One useful step forward. +20 learning points.';
            }
            objectId = l.id;
            break;
        }
        case 'mission.submit': {
            const m = mission(cmd.missionId);
            const old = s.submissions.find(x => x.missionId === m.id && x.authorId === ctx.userId);
            if (old?.status === 'approved')
                throw new DomainError('ALREADY_APPROVED', 'This proof has already been approved.', 409);
            if (old?.status === 'pending')
                throw new DomainError('IN_REVIEW', 'Your proof is already awaiting review.', 409);
            if (old) {
                old.body = cmd.body;
                old.url = cmd.url;
                old.status = 'pending';
                old.feedback = '';
                old.reviewerId = null;
                old.updatedAt = now;
                objectId = old.id;
            }
            else {
                const sub = { ...base(), missionId: m.id, authorId: ctx.userId, body: cmd.body, url: cmd.url, status: 'pending' as const, feedback: '', reviewerId: null, updatedAt: now };
                s.submissions.push(sub);
                objectId = sub.id;
            }
            for (const a of s.members.filter(isAdmin))
                notify(a.userId, 'New proof to review', `${actor.name} submitted ${m.title}`, '/admin/reviews');
            message = 'Proof submitted. Your community team will review it.';
            break;
        }
        case 'submission.review': {
            admin();
            const sub = find(s.submissions, cmd.submissionId);
            const m = mission(sub.missionId);
            if (sub.authorId === ctx.userId)
                throw new DomainError('SELF_REVIEW', 'You cannot review your own proof.', 403);
            if (sub.status !== 'pending')
                throw new DomainError('NOT_PENDING', 'This proof is no longer awaiting review.', 409);
            sub.status = cmd.decision;
            sub.feedback = cmd.feedback;
            sub.reviewerId = ctx.userId;
            sub.updatedAt = now;
            if (cmd.decision === 'approved')
                award(sub.authorId, 'building', m.points, `mission:${m.id}:${sub.authorId}`, `Approved proof: ${m.title}`);
            notify(sub.authorId, cmd.decision === 'approved' ? 'Your work was recognised' : 'A little feedback on your proof', cmd.feedback, `/missions/${m.id}`);
            audit(`submission.${cmd.decision}`, sub.id);
            objectId = sub.id;
            message = cmd.decision === 'approved' ? 'Proof approved. Building points awarded once.' : 'Feedback sent for another iteration.';
            break;
        }
        case 'project.join': {
            const p = project(cmd.projectId);
            if (s.projectMembers.some(x => x.projectId === p.id && x.userId === ctx.userId)) {
                changed = false;
                message = 'You are already on the team.';
            }
            else {
                s.projectMembers.push({ ...base(), projectId: p.id, userId: ctx.userId });
                notify(p.ownerId, 'Your team is growing', `${actor.name} joined ${p.title}.`, `/projects/${p.id}`);
                message = 'You are part of the team.';
            }
            objectId = p.id;
            break;
        }
        case 'project.create': {
            scope(cmd.spaceId);
            if (cmd.purposeId && !s.purposes.some(p => p.id === cmd.purposeId && p.organizationId === ctx.organizationId && p.status === 'active')) fail();
            const p = { ...base(), purposeId: cmd.purposeId, spaceId: cmd.spaceId, title: cmd.title, tagline: cmd.tagline, summary: cmd.summary, category: cmd.category, skills: cmd.skills, ownerId: ctx.userId, status: 'idea' as const, cover: 'custom' };
            s.projects.unshift(p);
            s.projectMembers.push({ ...base(), projectId: p.id, userId: ctx.userId });
            objectId = p.id;
            message = 'Your idea now has a place to grow.';
            break;
        }
        case 'project.update': {
            const p = project(cmd.projectId);
            if (!isAdmin(actor) && !s.projectMembers.some(x => x.projectId === p.id && x.userId === ctx.userId))
                throw new DomainError('JOIN_PROJECT', 'Join the project before publishing an update.', 403);
            s.projectUpdates.push({ ...base(), projectId: p.id, authorId: ctx.userId, body: cmd.body });
            objectId = p.id;
            message = 'Project update published.';
            break;
        }
        case 'event.rsvp': {
            const e = find(s.events, cmd.eventId);
            scope(e.spaceId);
            if (new Date(e.startsAt).getTime() + e.duration * 60000 < new Date(now).getTime())
                throw new DomainError('EVENT_ENDED', 'This event has already ended.', 409);
            const i = s.rsvps.findIndex(x => x.eventId === e.id && x.userId === ctx.userId);
            if (i >= 0) {
                s.rsvps.splice(i, 1);
                message = 'Your RSVP has been cancelled.';
            }
            else {
                s.rsvps.push({ ...base(), eventId: e.id, userId: ctx.userId });
                message = 'You are on the guest list.';
            }
            objectId = e.id;
            break;
        }
        case 'profile.update': {
            const m = find(s.members, actor.id);
            m.name = cmd.name;
            m.headline = cmd.headline;
            m.bio = cmd.bio;
            m.skills = cmd.skills;
            objectId = m.id;
            message = 'Your profile is up to date.';
            break;
        }
        case 'notification.read': {
            if (cmd.notificationId) {
                const n = find(s.notifications, cmd.notificationId);
                if (n.userId !== ctx.userId)
                    fail();
                n.readAt = now;
            }
            else
                for (const n of s.notifications.filter(n => n.userId === ctx.userId))
                    n.readAt = now;
            message = 'You are all caught up.';
            break;
        }
        case 'organisation.update': {
            admin();
            s.organisation.name = cmd.name;
            s.organisation.tagline = cmd.tagline;
            s.organisation.accent = cmd.accent;
            audit('organisation.updated', s.organisation.id);
            objectId = s.organisation.id;
            message = 'Community settings saved.';
            break;
        }
        case 'space.create': {
            admin();
            const slug = cmd.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (!slug)
                throw new DomainError('INVALID_NAME', 'Use at least one letter or number.');
            if (s.spaces.some(x => x.slug === slug))
                throw new DomainError('DUPLICATE_SPACE', 'A space with this name already exists.', 409);
            const sp = { ...base(), name: cmd.name, slug, description: cmd.description, colour: 'violet', visibility: cmd.visibility, kind: cmd.kind };
            s.spaces.push(sp);
            s.spaceMembers.push({ ...base(), spaceId: sp.id, userId: ctx.userId });
            audit('space.created', sp.id);
            objectId = sp.id;
            message = 'A new space for your people.';
            break;
        }
        case 'track.create': {
            admin();
            scope(cmd.spaceId);
            const t = { ...base(), ...cmd, level: 'All levels', colour: 'violet', cover: 'custom', authorId: ctx.userId, published: true };
            const { type, ...record } = t;
            s.tracks.push(record);
            objectId = t.id;
            audit('track.created', t.id);
            message = 'Track created. Add its first lesson next.';
            break;
        }
        case 'lesson.create': {
            admin();
            const t = track(cmd.trackId);
            const l = { ...base(), trackId: t.id, title: cmd.title, summary: cmd.summary, body: cmd.body, minutes: cmd.minutes, resourceUrl: cmd.resourceUrl, position: Math.max(0, ...s.lessons.filter(l => l.trackId === t.id).map(l => l.position)) + 1, published: true };
            s.lessons.push(l);
            audit('lesson.created', l.id);
            objectId = l.id;
            message = 'Lesson published.';
            break;
        }
        case 'mission.create': {
            admin();
            scope(cmd.spaceId);
            if (cmd.trackId)
                track(cmd.trackId);
            const { type, ...data } = cmd;
            const m = { ...base(), ...data, difficulty: 'Open to everyone' };
            s.missions.push(m);
            audit('mission.created', m.id);
            objectId = m.id;
            message = 'Mission published. Give people something worth doing.';
            break;
        }
        case 'event.create': {
            admin();
            scope(cmd.spaceId);
            if (new Date(cmd.startsAt) <= new Date(now))
                throw new DomainError('PAST_EVENT', 'Choose a future start time.');
            const { type, ...data } = cmd;
            const e = { ...base(), ...data, hostId: ctx.userId };
            s.events.push(e);
            audit('event.created', e.id);
            objectId = e.id;
            message = 'Your event is on the calendar.';
            break;
        }
        default: {
            throw new DomainError('UNKNOWN_COMMAND', 'This command is not implemented.');
        }
    }
    dropMutedNotices(s, noticesBefore, ctx.organizationId);
    if (changed) {
        s.revision++;
        s.outbox.push({ ...base(), actorId: ctx.userId, type: cmd.type, objectId: objectId ?? s.organisation.id, payload: { requestId: ctx.requestId } });
    }
    return { workspace: s, message, objectId };
}
export const commandsForReference: Command['type'][] = ['collection.save','collection.publish','collection.feature','collection.delete','collection.item.add','collection.item.note','collection.item.remove','collection.items.reorder','notification.preferences.save','cover.library.add','track.instructor.add','track.instructor.remove','track.cover.set','project.cover.set','quiz.attempt.submit','quiz.attempt.review','lesson.draft.create','lesson.draft.save','lesson.draft.publish','lesson.draft.archive','lesson.draft.restore','track.lessons.reorder','task.create','task.edit','task.claim','task.release','task.move','task.archive','task.submit','task.note','task.note.hide', 'member.status', 'member.role', 'space.access', 'post.create', 'post.comment', 'post.react', 'post.bookmark', 'post.report', 'post.moderate', 'task.file.remove','moderation.appeal', 'moderation.appeal.decide', 'moderation.appeal.withdraw', 'track.enrol', 'lesson.complete', 'mission.submit', 'submission.review', 'project.join', 'project.create', 'project.update', 'event.rsvp', 'profile.update', 'notification.read', 'organisation.update', 'space.create', 'track.create', 'lesson.create', 'mission.create', 'event.create', 'purpose.save', 'path.create', 'path.publish', 'path.enrol', 'milestone.create', 'goal.set', 'goal.status', 'project.purpose', 'contribution.submit', 'contribution.resubmit', 'contribution.review', 'outcome.submit', 'outcome.resubmit', 'outcome.review', 'output.publish'];
