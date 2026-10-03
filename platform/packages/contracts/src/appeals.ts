import { z } from 'zod';

/**
 * Appeals against moderation. A member whose post a moderator hid can ask, once per hiding, for an owner or administrator
 * who neither hid the post nor wrote it to look again. Suspension is not appealed here: it is an access decision with its
 * own reason and restore action. An appeal is private to the person who made it and to the community's owners and
 * administrators; it is never community activity.
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

const appealText = z.string().trim().min(1, 'Say briefly why the post should be looked at again.').max(APPEAL_TEXT_MAX);
const ref = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const appealCommands = [
    z.object({ type: z.literal('moderation.appeal'), postId: ref, reason: appealText }).strict(),
    z.object({ type: z.literal('moderation.appeal.decide'), appealId: ref, decision: z.enum(APPEAL_DECISIONS), response: z.string().trim().min(1, 'Write a short response for the member.').max(APPEAL_TEXT_MAX) }).strict(),
    z.object({ type: z.literal('moderation.appeal.withdraw'), appealId: ref }).strict(),
] as const;
