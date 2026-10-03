import { z } from 'zod';

/** The words a person types to confirm that they want their account deleted. */
export const ACCOUNT_DELETION_PHRASE = 'delete my account';
/** How a deleted person's kept posts and work are attributed. */
export const FORMER_MEMBER = 'Former member';

export const confirmsAccountDeletion = (value: string) => value.trim().toLowerCase() === ACCOUNT_DELETION_PHRASE;

export const accountDeletionRequest = z.object({
    password: z.string().min(1, 'Enter your password.').max(128),
    confirmation: z.string().max(80).refine(confirmsAccountDeletion, `Type “${ACCOUNT_DELETION_PHRASE}” to confirm.`),
}).strict();
export type AccountDeletionRequest = z.infer<typeof accountDeletionRequest>;

/** What deletion changed, in counts only. */
export interface AccountDeletionSummary {
    communities: number;
    /** Rows removed, by kind, across every community. */
    removed: Record<string, number>;
    /** Open tasks the person had claimed, returned to their teams. */
    releasedTasks: number;
    /** Notices in other people's inboxes reworded so they no longer carry the person's name. */
    rewordedNotices: number;
}
