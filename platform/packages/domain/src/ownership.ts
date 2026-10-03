import { DomainError, newId, type Member, type TenantContext, type Workspace } from '../../contracts/src/index';
import { confirmsCommunityName } from '../../contracts/src/ownership';
import { actorFor } from './access';

export interface OwnershipTransfer {
    workspace: Workspace;
    message: string;
    owner: Member;
    previousOwner: Member;
}

/** Administrators the owner may hand the community to: active, and not the owner. */
export const ownershipCandidates = (s: Workspace, ctx: TenantContext) =>
    s.members.filter(m => m.organizationId === ctx.organizationId && m.userId !== ctx.userId && m.status === 'active' && m.role === 'admin');

/**
 * Hand a community to one of its administrators. Only the active owner may do it, after typing the community's name (and,
 * in live mode, re-entering their password, which the caller checks). The new owner must already be an active
 * administrator, so ownership only ever goes to someone the owner has deliberately trusted with running the community.
 * The previous owner stays as an administrator; the new owner can change that like any other role. A community always
 * has exactly one owner, and the audit entry names both memberships.
 */
export function transferOwnership(input: Workspace, ctx: TenantContext, memberId: string, confirmation: string, now: string, makeId: () => string = newId): OwnershipTransfer {
    const s = structuredClone(input);
    const actor = actorFor(s, ctx);
    if (actor.role !== 'owner') throw new DomainError('OWNER_REQUIRED', 'Only the community owner can hand over ownership.', 403);
    const target = s.members.find(m => m.id === memberId && m.organizationId === ctx.organizationId);
    if (!target || target.status === 'left') throw new DomainError('NOT_FOUND', 'That member is not available.', 404);
    if (target.userId === ctx.userId) throw new DomainError('ALREADY_OWNER', 'You already own this community.', 409);
    if (target.status !== 'active') throw new DomainError('INACTIVE_MEMBER', `Restore ${target.name}’s access before handing over ownership.`, 409);
    if (target.role !== 'admin') throw new DomainError('ADMIN_REQUIRED', `Make ${target.name} an administrator first. Ownership goes only to an administrator.`, 409);
    if (!confirmsCommunityName(confirmation, s.organisation.name)) throw new DomainError('CONFIRMATION_REQUIRED', `Type “${s.organisation.name}” to confirm.`, 400);
    const owners = s.members.filter(m => m.organizationId === ctx.organizationId && m.role === 'owner');
    if (owners.length !== 1) throw new DomainError('OWNERSHIP_CONFLICT', 'This community’s ownership needs attention before it can change hands.', 409);
    actor.role = 'admin';
    target.role = 'owner';
    const base = () => ({ id: makeId(), organizationId: ctx.organizationId, createdAt: now });
    s.audit.push({ ...base(), actorId: ctx.userId, action: 'member.owner.transferred', objectId: target.id, metadata: { requestId: ctx.requestId, previousOwner: actor.id } });
    s.notifications.push({ ...base(), userId: target.userId, title: `You now own ${s.organisation.name}`, body: `${actor.name} handed ownership of ${s.organisation.name} to you. ${actor.name} stays as an administrator.`, href: '/access', readAt: null });
    s.revision++;
    s.outbox.push({ ...base(), actorId: ctx.userId, type: 'member.owner.transfer', objectId: target.id, payload: { requestId: ctx.requestId } });
    return { workspace: s, message: `${target.name} now owns ${s.organisation.name}. You are an administrator.`, owner: target, previousOwner: actor };
}
