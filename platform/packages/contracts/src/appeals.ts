import { z } from 'zod';

/**
 * Appeals against moderation. A member whose post a moderator hid can ask, once per hiding, for an owner or administrator
 * who neither hid the post nor wrote it to look again. A suspended member can do the same about their suspension (decision
 * 058), from their account, since they no longer see the community. An appeal is private to the person who made it and to
 * the community's owners and administrators; it is never community activity.
 */
export const APPEAL_SUBJECTS = ['post'] as const;
export type AppealSubject = typeof APPEAL_SUBJECTS[number];
export const APPEAL_STATUSES = ['pending', 'upheld', 'reversed', 'withdrawn'] as const;
export type AppealStatus = typeof APPEAL_STATUSES[number];
/** Upheld keeps the post hidden; reversed restores it. */
export const APPEAL_DECISIONS = ['upheld', 'reversed'] as const;
export type AppealDecision = typeof APPEAL_DECISIONS[number];
export const APPEAL_TEXT_MAX = 2000;
/** Where every appeal notice leads. Notices about moderation of a person's own work always arrive. */
export const APPEALS_HREF = '/appeals';

/** Closed: access was restored some other way before anyone decided the appeal. */
export const SUSPENSION_APPEAL_STATUSES = [...APPEAL_STATUSES, 'closed'] as const;
export type SuspensionAppealStatus = typeof SUSPENSION_APPEAL_STATUSES[number];
/** What a suspended person sends. They appeal from their account, outside the community, so this is not a command. */
export const suspensionAppealInput = z.object({ reason: z.string().trim().min(1, 'Say briefly why your access should be looked at again.').max(APPEAL_TEXT_MAX) }).strict();
/** One of a suspended person's own appeals, as they see it: no names, since they no longer see the community's people. */
export interface OwnSuspensionAppeal { id: string; createdAt: string; reason: string; status: SuspensionAppealStatus; decidedAt: string | null; response: string; current: boolean }
/** A community where this person's access is suspended: its name, since when, and what they can do about it. */
export interface SuspensionStanding {
    slug: string; name: string; suspendedAt: string | null;
    appeals: OwnSuspensionAppeal[];
    /** Whether they can appeal now: no appeal about this suspension is open or has been decided. */
    canAppeal: boolean;
    /** Whether anyone can decide an appeal about this suspension now. */
    decidable: boolean;
}

const appealText = z.string().trim().min(1, 'Say briefly why the post should be looked at again.').max(APPEAL_TEXT_MAX);
const ref = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const appealCommands = [
    z.object({ type: z.literal('moderation.appeal'), postId: ref, reason: appealText }).strict(),
    z.object({ type: z.literal('moderation.appeal.decide'), appealId: ref, decision: z.enum(APPEAL_DECISIONS), response: z.string().trim().min(1, 'Write a short response for the member.').max(APPEAL_TEXT_MAX) }).strict(),
    z.object({ type: z.literal('moderation.appeal.withdraw'), appealId: ref }).strict(),
    z.object({ type: z.literal('suspension.appeal.decide'), appealId: ref, decision: z.enum(APPEAL_DECISIONS), response: z.string().trim().min(1, 'Write a short response for the member.').max(APPEAL_TEXT_MAX) }).strict(),
] as const;
