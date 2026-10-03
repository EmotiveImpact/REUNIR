import { api, commitDemo, demoState, mode, snapshot } from './data';
import { newId, type Workspace } from '../../../../packages/contracts/src/index';
import type { OwnershipTransferResult } from '../../../../packages/contracts/src/ownership';
import { transferOwnership } from '../../../../packages/domain/src/ownership';

/** Hand the community to an administrator. Live mode checks the password on the server; the demo has no passwords. */
export async function handOverOwnership(slug: string, userId: string, memberId: string, password: string, confirmation: string): Promise<OwnershipTransferResult & { workspace: Workspace }> {
    if (mode === 'demo') {
        const s = demoState(slug);
        const t = transferOwnership(s, { organizationId: s.organisation.id, userId, requestId: newId() }, memberId, confirmation, new Date().toISOString());
        const note = commitDemo(slug, t.workspace);
        return { message: t.message + note, ownerMemberId: t.owner.id, previousOwnerMemberId: t.previousOwner.id, workspace: snapshot(slug, userId) };
    }
    if (!password) throw new Error('Enter your password.');
    return api(`/api/organisations/${encodeURIComponent(slug)}/ownership`, { memberId, password, confirmation });
}
