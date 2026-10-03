import { lessonDocumentSchema, type LessonDocument } from './lesson-document';
import { lessonResourcesInput, type LessonResource } from './lesson-resources';
import { lessonQuizSchema, quizAnswersInput, quizFingerprintInput, quizMarksInput, type LessonQuiz, type QuizAnswer, type QuizResult } from './assessments';
import { coverChange, coverLibraryLabel, coverLibraryTags, type CoverImage, type CoverImageType } from './covers';
import { z } from 'zod';
import type { WorkspaceSummary } from './pages';
import { notificationPreferencesInput, type DigestFrequency, type MutableTopic } from './notifications';
import { appealCommands, type AppealStatus, type AppealSubject } from './appeals';
export type Id = string;
export type Role = 'owner' | 'admin' | 'moderator' | 'member';
export interface TenantContext {
    organizationId: Id;
    userId: Id;
    requestId: Id;
}
export interface DomainEvent<T extends Record<string, unknown> = Record<string, unknown>> {
    id: Id;
    organizationId: Id;
    type: string;
    actorUserId?: Id;
    objectType?: string;
    objectId?: Id;
    contextType?: string;
    contextId?: Id;
    payload: T;
    occurredAt: string;
}
export type Visibility = 'members' | 'private';
export type MembershipStatus = 'active' | 'suspended' | 'left';
export interface Organisation {
    id: Id;
    slug: string;
    name: string;
    tagline: string;
    accent: string;
    createdAt: string;
}
export interface TenantRecord {
    id: Id;
    organizationId: Id;
    createdAt: string;
}
export interface Member extends TenantRecord {
    userId: Id;
    name: string;
    headline: string;
    bio: string;
    skills: string[];
    colour: string;
    avatar: string;
    role: Role;
    status: MembershipStatus;
}
export interface Space extends TenantRecord {
    name: string;
    slug: string;
    description: string;
    colour: string;
    kind: 'discussion' | 'learning' | 'project';
    visibility: Visibility;
}
export interface SpaceMember extends TenantRecord {
    spaceId: Id;
    userId: Id;
}
export interface Post extends TenantRecord {
    spaceId: Id;
    authorId: Id;
    kind: 'update' | 'question' | 'resource' | 'project';
    title: string;
    body: string;
    pinned: boolean;
    hidden: boolean;
    cover: string;
    /** Who last hid or restored the post through moderation, and when. NULL on posts moderated before this was recorded. */
    moderatedBy?: Id | null;
    moderatedAt?: string | null;
}
export interface Comment extends TenantRecord {
    postId: Id;
    authorId: Id;
    body: string;
}
export interface Reaction extends TenantRecord {
    postId: Id;
    userId: Id;
}
export interface Bookmark extends TenantRecord {
    postId: Id;
    userId: Id;
}
export interface Track extends TenantRecord {
    spaceId: Id | null;
    title: string;
    summary: string;
    description: string;
    category: string;
    level: string;
    colour: string;
    /** Legacy art name, kept for stored data. Covers now come only from `coverImage`. */
    cover: string;
    /** Uploaded cover, or none for the plain panel. */
    coverImage?: CoverImage | null;
    authorId: Id;
    published: boolean;
}
export interface Lesson extends TenantRecord {
    richBody?: LessonDocument | null;
    /** Ordered private files. NULL on lessons published before resources existed. */
    resources?: LessonResource[] | null;
    /** Optional knowledge check. Learners receive it without answers. */
    quiz?: LessonQuiz | null;
    trackId: Id;
    title: string;
    summary: string;
    body: string;
    position: number;
    minutes: number;
    resourceUrl: string;
    published: boolean;
}
export interface LessonContent {
    title: string; summary: string; body: string; minutes: number; resourceUrl: string; richBody?: LessonDocument | null;
    resources?: LessonResource[] | null; quiz?: LessonQuiz | null;
}
/** Private to active community owners and administrators. Never learner content. */
export interface LessonDraft extends TenantRecord, LessonContent {
    trackId: Id; lessonId: Id | null; version: number; publishedVersion: number | null;
    archived: boolean; createdBy: Id; updatedBy: Id; updatedAt: string;
}
/** A captured baseline is not a claim about who originally published a legacy lesson. */
export interface LessonRevision extends TenantRecord, LessonContent {
    trackId: Id; lessonId: Id; draftId: Id; sequence: number;
    kind: 'captured' | 'published'; actorId: Id;
}
/** The existing upload intent. Lesson files are scoped to one track and covers to one track or project; storage keys never leave the server. */
export interface Upload extends TenantRecord {
    userId: Id; purpose: 'member' | 'lesson_resource' | 'cover_image' | 'cover_library'; trackId: Id | null;
    coverTrackId?: Id | null; coverProjectId?: Id | null;
    originalName: string; contentType: string; sizeBytes: number;
    status: 'pending' | 'ready' | 'rejected';
    objectKey: string; completedAt: string | null; generation: string | null;
    /**
     * Covers only: a smaller copy for cards, stored beside the full picture and verified with it. All null when there is
     * none, as for every cover uploaded before migration 0038; readers then get the full picture.
     */
    thumbnailObjectKey?: string | null; thumbnailContentType?: string | null; thumbnailSizeBytes?: number | null; thumbnailGeneration?: string | null;
}
/**
 * One submitted knowledge check. Immutable apart from review fields. Scores are private feedback,
 * not reputation, completion or a credential.
 */
export interface QuizAttempt extends TenantRecord {
    lessonId: Id; trackId: Id; userId: Id; attemptNumber: number;
    /** The quiz exactly as scored. Answer keys are removed in learner views unless the reveal rule allows them. */
    quiz: LessonQuiz; answers: QuizAnswer[]; results: QuizResult[];
    score: number; maxScore: number; status: 'scored' | 'awaiting_review' | 'reviewed'; passed: boolean | null;
    feedback: string; reviewerId: Id | null; reviewedAt: string | null; version: number;
}
export interface Enrolment extends TenantRecord {
    trackId: Id;
    userId: Id;
}
/**
 * An explicit grant, made by an active owner or administrator, to author and review one track. It never follows from
 * being named as a track's author, and it ends while the member is inactive.
 */
export interface TrackInstructor extends TenantRecord {
    trackId: Id;
    userId: Id;
    grantedBy: Id;
    /** Instructors publish and review; contributors write drafts and files for an instructor to publish. Absent means instructor. */
    role?: TeachingRole;
}
export const teachingRoles = ['instructor', 'contributor'] as const;
export type TeachingRole = typeof teachingRoles[number];
export interface Completion extends TenantRecord {
    trackId: Id;
    lessonId: Id;
    userId: Id;
}
export interface Mission extends TenantRecord {
    spaceId: Id | null;
    trackId: Id | null;
    title: string;
    brief: string;
    criteria: string[];
    category: string;
    points: number;
    dueAt: string;
    difficulty: string;
}
export interface Submission extends TenantRecord {
    missionId: Id;
    authorId: Id;
    body: string;
    url: string;
    status: 'pending' | 'approved' | 'changes_requested';
    feedback: string;
    reviewerId: Id | null;
    updatedAt: string;
}
export interface Project extends TenantRecord {
    purposeId: Id | null;
    spaceId: Id | null;
    title: string;
    tagline: string;
    summary: string;
    category: string;
    skills: string[];
    ownerId: Id;
    status: 'idea' | 'building' | 'launched';
    /** Legacy art name, kept for stored data. Covers now come only from `coverImage`. */
    cover: string;
    /** Uploaded cover, or none for the plain panel. */
    coverImage?: CoverImage | null;
}
export interface ProjectMember extends TenantRecord {
    projectId: Id;
    userId: Id;
}
export interface ProjectUpdate extends TenantRecord {
    projectId: Id;
    authorId: Id;
    body: string;
}
/** A task plans work; completion is derived from its linked reviewed contribution. */
export interface ProjectTask extends TenantRecord {
    projectId: Id; title: string; brief: string; criteria: string[];
    assigneeId: Id | null; dueOn: string | null; priority: 'normal' | 'high';
    workState: 'todo' | 'doing'; contributionId: Id | null;
    createdBy: Id; updatedAt: string; version: number; archived: boolean;
}
export interface TaskNote extends TenantRecord {
    projectId: Id; taskId: Id; authorId: Id; body: string; hidden: boolean;
}
export interface CommunityEvent extends TenantRecord {
    spaceId: Id | null;
    title: string;
    summary: string;
    startsAt: string;
    duration: number;
    hostId: Id;
    format: 'workshop' | 'critique' | 'coworking' | 'social';
    location: string;
    meetingUrl: string;
}
export interface RSVP extends TenantRecord {
    eventId: Id;
    userId: Id;
}
export interface Notification extends TenantRecord {
    userId: Id;
    title: string;
    body: string;
    href: string;
    readAt: string | null;
}
export interface Report extends TenantRecord {
    postId: Id;
    userId: Id;
    reason: string;
    status: 'open' | 'resolved';
}
export interface Reputation extends TenantRecord {
    userId: Id;
    dimension: 'learning' | 'building' | 'contribution';
    points: number;
    sourceId: Id;
    description: string;
}
export interface AuditEvent extends TenantRecord {
    actorId: Id;
    action: string;
    objectId: Id;
    metadata: Record<string, unknown>;
}
export interface OutboxEvent extends TenantRecord {
    actorId: Id;
    type: string;
    objectId: Id;
    payload: Record<string, unknown>;
}
/** Purpose and progress are domain records, not posts or unvalidated metadata. */
export type PurposeKind = 'become' | 'build' | 'achieve';
export interface Purpose extends TenantRecord {
    kind: PurposeKind; title: string; description: string; status: 'active' | 'archived';
}
export interface Path extends TenantRecord {
    purposeId: Id; spaceId: Id | null; title: string; summary: string;
    status: 'draft' | 'published' | 'archived';
}
export interface PathEnrolment extends TenantRecord { pathId: Id; userId: Id; }
/** Exactly one explicit target. Progress derives from existing evidence, never a client boolean. */
export interface Milestone extends TenantRecord {
    pathId: Id; title: string; description: string; position: number;
    lessonId: Id | null; missionId: Id | null; projectId: Id | null;
}
/** A reviewed contribution or outcome can later be withdrawn. Withdrawn evidence stays on record but no longer counts. */
export type ReviewStatus = 'submitted' | 'recognised' | 'changes_requested' | 'withdrawn';
export interface Contribution extends TenantRecord {
    projectId: Id; userId: Id; title: string; body: string; evidenceUrl: string;
    status: ReviewStatus; reviewerId: Id | null; reviewedAt: string | null; feedback: string;
}
export interface Outcome extends TenantRecord {
    purposeId: Id; projectId: Id | null; submissionId: Id | null; contributionId: Id | null;
    authorId: Id; title: string; summary: string; evidenceUrl: string;
    status: 'submitted' | 'verified' | 'changes_requested' | 'withdrawn'; reviewerId: Id | null;
    reviewedAt: string | null; feedback: string;
}
/** The wording of a piece of evidence: a contribution's title, body and link, or an outcome's title, summary and link. */
export interface EvidenceText { title: string; text: string; evidenceUrl: string; }
export type EvidenceSubject = 'contribution' | 'outcome';
/**
 * One step in the history of reviewed evidence. A correction proposes new wording that a reviewer accepts or declines; a
 * withdrawal is applied at once. Either way the reviewed wording it replaced stays here, so history is never rewritten.
 */
export interface EvidenceChange extends TenantRecord {
    subject: EvidenceSubject; subjectId: Id; kind: 'correction' | 'withdrawal';
    requestedBy: Id; reason: string; previous: EvidenceText; proposed: EvidenceText | null;
    previousStatus: 'recognised' | 'verified'; status: 'pending' | 'accepted' | 'declined' | 'applied';
    decidedBy: Id | null; decidedAt: string | null; response: string;
}
export type OutputKind = 'film' | 'software' | 'research' | 'event' | 'music' | 'book' | 'company' | 'campaign' | 'other';
export interface CommunityOutput extends TenantRecord {
    purposeId: Id; outcomeId: Id; projectId: Id | null; title: string; summary: string;
    kind: OutputKind; evidenceUrl: string; publishedBy: Id;
}
export interface MemberGoal extends TenantRecord {
    userId: Id; purposeId: Id; pathId: Id | null; outcomeId: Id | null; title: string;
    visibility: 'private' | 'members'; status: 'active' | 'paused' | 'completed'; completedAt: string | null;
}
/** A picture in the community's cover library. Type and size are copied from the verified upload. */
export interface CoverLibraryItem extends TenantRecord {
    fileId: Id;
    label: string;
    contentType: CoverImageType;
    sizeBytes: number;
    addedBy: Id;
    /** Up to five short lower-case words for finding the picture. Owners and administrators change them with the name. */
    tags: string[];
}
/**
 * A member's request for a second look at a moderation decision about their own work. Private to the appellant and the
 * community's owners and administrators. Only the decision fields change after it is made.
 */
export interface ModerationAppeal extends TenantRecord {
    subject: AppealSubject;
    subjectId: Id;
    appellantId: Id;
    /** The hiding this appeal challenges: who hid the post and when, as recorded on the post when the appeal was made. */
    hiddenBy: Id | null;
    hiddenAt: string | null;
    reason: string;
    status: AppealStatus;
    decidedBy: Id | null;
    decidedAt: string | null;
    response: string;
}
/** One member's notice settings in one community. Absent means every topic on and no digest. */
export interface NotificationPreference extends TenantRecord {
    userId: Id;
    muted: MutableTopic[];
    digest: DigestFrequency;
    updatedAt: string;
    /** When the last digest email was queued, by the digest job only. */
    lastDigestAt: string | null;
}
export interface Workspace {
    moderationAppeals: ModerationAppeal[];
    evidenceChanges: EvidenceChange[];
    notificationPreferences: NotificationPreference[];
    /** Exact totals for lists the snapshot shortens (see pages.ts). Absent on stored state. */
    summary?: WorkspaceSummary;
    coverLibrary: CoverLibraryItem[];
    trackInstructors: TrackInstructor[];
    quizAttempts: QuizAttempt[];
    uploads: Upload[];
    lessonDrafts: LessonDraft[];
    lessonRevisions: LessonRevision[];
    projectTasks: ProjectTask[];
    taskNotes: TaskNote[];
    purposes: Purpose[];
    paths: Path[];
    milestones: Milestone[];
    pathEnrolments: PathEnrolment[];
    contributions: Contribution[];
    outcomes: Outcome[];
    communityOutputs: CommunityOutput[];
    memberGoals: MemberGoal[];
    organisation: Organisation;
    revision: number;
    members: Member[];
    spaces: Space[];
    spaceMembers: SpaceMember[];
    posts: Post[];
    comments: Comment[];
    reactions: Reaction[];
    bookmarks: Bookmark[];
    tracks: Track[];
    lessons: Lesson[];
    enrolments: Enrolment[];
    completions: Completion[];
    missions: Mission[];
    submissions: Submission[];
    projects: Project[];
    projectMembers: ProjectMember[];
    projectUpdates: ProjectUpdate[];
    events: CommunityEvent[];
    rsvps: RSVP[];
    notifications: Notification[];
    reports: Report[];
    reputation: Reputation[];
    audit: AuditEvent[];
    outbox: OutboxEvent[];
}
export const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max);
export function safeUrl(value: string): boolean { try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password;
}
catch {
    return false;
} }
const link = z.string().trim().max(2000).refine(v => v === '' || safeUrl(v), 'Use a complete https:// link.');
const optionalSpace = z.union([id, z.null()]);
const dueOn = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const d = new Date(v + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v;
}, 'Use a real calendar date.').nullable();
const taskFields = {
    title: text(140), brief: text(4000), criteria: z.array(text(240)).min(1).max(10),
    assigneeId: optionalSpace.default(null), dueOn: dueOn.default(null), priority: z.enum(['normal','high']).default('normal')
};
const expectedVersion = z.number().int().min(1);
export const commandSchema = z.discriminatedUnion('type', [
    z.object({type:z.literal('lesson.draft.create'),trackId:id,lessonId:optionalSpace.default(null)}).strict(),
    z.object({type:z.literal('lesson.draft.save'),draftId:id,expectedVersion,
        title:z.string().trim().max(120),summary:z.string().trim().max(240),body:z.string().trim().max(20000),
        minutes:z.number().int().min(1).max(240),resourceUrl:link.default(''),richBody:lessonDocumentSchema.nullable().optional(),
        resources:lessonResourcesInput.optional(),quiz:lessonQuizSchema.nullable().optional()}).strict(),
    z.object({type:z.literal('quiz.attempt.submit'),lessonId:id,fingerprint:quizFingerprintInput,answers:quizAnswersInput}).strict(),
    z.object({type:z.literal('quiz.attempt.review'),attemptId:id,expectedVersion,marks:quizMarksInput.default([]),feedback:text(2000)}).strict(),
    z.object({type:z.literal('lesson.draft.publish'),draftId:id,expectedVersion}).strict(),
    z.object({type:z.literal('lesson.draft.archive'),draftId:id,expectedVersion,archived:z.boolean()}).strict(),
    z.object({type:z.literal('lesson.draft.restore'),draftId:id,expectedVersion,revisionId:id}).strict(),
    z.object({type:z.literal('track.lessons.reorder'),trackId:id,
        expectedOrder:z.array(id).max(200),lessonIds:z.array(id).max(200)}).strict(),
    z.object({type:z.literal('track.cover.set'),trackId:id,...coverChange}).strict(),
    z.object({type:z.literal('track.instructor.add'),trackId:id,userId:id,role:z.enum(teachingRoles).default('instructor')}).strict(),
    z.object({type:z.literal('cover.library.add'),fileId:id,label:coverLibraryLabel,tags:coverLibraryTags.default([])}).strict(),
    z.object({type:z.literal('track.instructor.remove'),trackId:id,userId:id}).strict(),
    z.object({type:z.literal('project.cover.set'),projectId:id,...coverChange}).strict(),
    z.object({type:z.literal('task.create'),projectId:id,...taskFields}).strict(),
    z.object({type:z.literal('task.edit'),taskId:id,expectedVersion,...taskFields}).strict(),
    z.object({type:z.literal('task.claim'),taskId:id,expectedVersion}).strict(),
    z.object({type:z.literal('task.release'),taskId:id,expectedVersion}).strict(),
    z.object({type:z.literal('task.move'),taskId:id,expectedVersion,workState:z.enum(['todo','doing'])}).strict(),
    z.object({type:z.literal('task.archive'),taskId:id,expectedVersion,archived:z.boolean()}).strict(),
    z.object({type:z.literal('task.submit'),taskId:id,expectedVersion,body:text(8000),evidenceUrl:link.default('')}).strict(),
    z.object({type:z.literal('task.note'),taskId:id,body:text(4000)}).strict(),
    z.object({type:z.literal('task.note.hide'),noteId:id}).strict(),
    z.object({ type: z.literal('member.status'), memberId: id, status: z.enum(['active','suspended']), reason: text(500) }).strict(),
    z.object({ type: z.literal('member.role'), memberId: id, role: z.enum(['member','moderator','admin']) }).strict(),
    z.object({ type: z.literal('space.access'), spaceId: id, userId: id, granted: z.boolean() }).strict(),
    z.object({ type: z.literal('purpose.save'), purposeId: id.optional(), kind: z.enum(['become', 'build', 'achieve']), title: text(120), description: z.string().trim().max(2000).default(''), status: z.enum(['active', 'archived']).default('active') }).strict(),
    z.object({ type: z.literal('path.create'), purposeId: id, title: text(120), summary: text(1000), spaceId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('path.publish'), pathId: id }).strict(),
    z.object({ type: z.literal('path.enrol'), pathId: id }).strict(),
    z.object({ type: z.literal('milestone.create'), pathId: id, title: text(120), description: z.string().trim().max(1000).default(''), lessonId: optionalSpace.default(null), missionId: optionalSpace.default(null), projectId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('goal.set'), purposeId: id, pathId: optionalSpace.default(null), title: text(180), visibility: z.enum(['private', 'members']).default('private') }).strict(),
    z.object({ type: z.literal('goal.status'), goalId: id, status: z.enum(['active', 'paused', 'completed']), outcomeId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('project.purpose'), projectId: id, purposeId: optionalSpace }).strict(),
    z.object({ type: z.literal('contribution.submit'), projectId: id, title: text(140), body: text(8000), evidenceUrl: link.default('') }).strict(),
    z.object({ type: z.literal('contribution.resubmit'), contributionId: id, title: text(140), body: text(8000), evidenceUrl: link.default('') }).strict(),
    z.object({ type: z.literal('contribution.review'), contributionId: id, decision: z.enum(['recognised', 'changes_requested']), feedback: text(2000) }).strict(),
    z.object({ type: z.literal('outcome.submit'), purposeId: id, submissionId: optionalSpace.default(null), contributionId: optionalSpace.default(null), title: text(160), summary: text(5000), evidenceUrl: link.default('') }).strict(),
    z.object({ type: z.literal('outcome.resubmit'), outcomeId: id, title: text(160), summary: text(5000), evidenceUrl: link.default('') }).strict(),
    z.object({ type: z.literal('outcome.review'), outcomeId: id, decision: z.enum(['verified', 'changes_requested']), feedback: text(2000) }).strict(),
    z.object({ type: z.literal('evidence.correct'), subject: z.enum(['contribution', 'outcome']), subjectId: id, title: text(160), text: text(8000), evidenceUrl: link.default(''), reason: text(1000) }).strict(),
    z.object({ type: z.literal('evidence.correction.review'), changeId: id, decision: z.enum(['accepted', 'declined']), response: text(2000) }).strict(),
    z.object({ type: z.literal('evidence.withdraw'), subject: z.enum(['contribution', 'outcome']), subjectId: id, reason: text(1000) }).strict(),
    z.object({ type: z.literal('output.publish'), outcomeId: id, kind: z.enum(['film', 'software', 'research', 'event', 'music', 'book', 'company', 'campaign', 'other']) }).strict(),

    z.object({ type: z.literal('post.create'), spaceId: id, kind: z.enum(['update', 'question', 'resource', 'project']), title: z.string().trim().max(160).default(''), body: text(10000) }).strict(),
    z.object({ type: z.literal('post.comment'), postId: id, body: text(4000) }).strict(),
    z.object({ type: z.literal('post.react'), postId: id }).strict(),
    z.object({ type: z.literal('post.bookmark'), postId: id }).strict(),
    z.object({ type: z.literal('post.report'), postId: id, reason: text(1000) }).strict(),
    z.object({ type: z.literal('post.moderate'), postId: id, hidden: z.boolean() }).strict(),
    ...appealCommands,
    z.object({ type: z.literal('track.enrol'), trackId: id }).strict(),
    z.object({ type: z.literal('lesson.complete'), trackId: id, lessonId: id }).strict(),
    z.object({ type: z.literal('mission.submit'), missionId: id, body: text(10000), url: link.default('') }).strict(),
    z.object({ type: z.literal('submission.review'), submissionId: id, decision: z.enum(['approved', 'changes_requested']), feedback: text(4000) }).strict(),
    z.object({ type: z.literal('project.join'), projectId: id }).strict(),
    z.object({ type: z.literal('project.create'), title: text(100), tagline: text(180), summary: text(8000), category: text(40), skills: z.array(text(40)).max(8), spaceId: optionalSpace.default(null), purposeId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('project.update'), projectId: id, body: text(5000) }).strict(),
    z.object({ type: z.literal('event.rsvp'), eventId: id }).strict(),
    z.object({ type: z.literal('profile.update'), name: text(80), headline: z.string().trim().max(160), bio: z.string().trim().max(2000), skills: z.array(text(40)).max(12) }).strict(),
    z.object({ type: z.literal('notification.read'), notificationId: id.optional() }).strict(),
    z.object({ type: z.literal('notification.preferences.save'), ...notificationPreferencesInput }).strict(),
    z.object({ type: z.literal('organisation.update'), name: text(80), tagline: text(180), accent: z.enum(['violet', 'mint', 'blue', 'amber']) }).strict(),
    z.object({ type: z.literal('space.create'), name: text(60), description: text(500), visibility: z.enum(['members', 'private']), kind: z.enum(['discussion', 'learning', 'project']) }).strict(),
    z.object({ type: z.literal('track.create'), title: text(120), summary: text(240), description: text(4000), category: text(40), spaceId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('lesson.create'), trackId: id, title: text(120), summary: text(240), body: text(20000), minutes: z.number().int().min(1).max(240), resourceUrl: link.default('') }).strict(),
    z.object({ type: z.literal('mission.create'), title: text(120), brief: text(8000), criteria: z.array(text(240)).min(1).max(10), category: text(40), points: z.number().int().min(0).max(500), dueAt: z.string().datetime(), spaceId: optionalSpace.default(null), trackId: optionalSpace.default(null) }).strict(),
    z.object({ type: z.literal('event.create'), title: text(120), summary: text(4000), startsAt: z.string().datetime(), duration: z.number().int().min(15).max(1440), format: z.enum(['workshop', 'critique', 'coworking', 'social']), location: text(120), meetingUrl: link.default(''), spaceId: optionalSpace.default(null) }).strict(),
]);
export type Command = z.infer<typeof commandSchema>;
export type CommandInput = z.input<typeof commandSchema>;
export interface MutationResult {
    workspace: Workspace;
    message: string;
    objectId?: string;
}
export class DomainError extends Error {
    constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'DomainError'; }
}
/** Cryptographically random identifiers also work in offline preview documents. */
export function newId(): string {
    if (typeof globalThis.crypto.randomUUID === 'function')
        return globalThis.crypto.randomUUID();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const h = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
