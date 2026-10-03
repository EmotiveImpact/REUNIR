import { z } from 'zod';
import { id } from './index';

/** The owner types the community's name, so a handover is never a slip of the mouse. Case and outer spaces do not matter. */
export const confirmsCommunityName = (typed: string, community: string) => typed.trim().toLowerCase() === community.trim().toLowerCase();

export const ownershipTransferRequest = z.object({
    memberId: id,
    password: z.string().min(1, 'Enter your password.').max(128),
    confirmation: z.string().min(1, 'Type the community’s name to confirm.').max(80),
}).strict();
export type OwnershipTransferRequest = z.infer<typeof ownershipTransferRequest>;

/** Who now owns the community; the previous owner stays as an administrator. */
export interface OwnershipTransferResult {
    message: string;
    ownerMemberId: string;
    previousOwnerMemberId: string;
}
