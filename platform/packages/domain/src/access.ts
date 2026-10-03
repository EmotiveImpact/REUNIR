import { DomainError, type Workspace, type TenantContext, type Member } from '../../contracts/src/index';
export const isAdmin = (m: Member) => m.role === 'owner' || m.role === 'admin';
export const isModerator = (m: Member) => isAdmin(m) || m.role === 'moderator';
/** A former member deleted their account. They receive no new notices, recognition or assignments. */
export const isFormer = (s: Workspace, userId: string | null | undefined) => !!userId && s.members.some(m => m.userId === userId && m.organizationId === s.organisation.id && m.status === 'left');
export function actorFor(state: Workspace, ctx: TenantContext): Member {
    if (state.organisation.id !== ctx.organizationId)
        throw new DomainError('NOT_FOUND', 'Community not found.', 404);
    const actor = state.members.find(m => m.userId === ctx.userId && m.organizationId === ctx.organizationId && m.status === 'active');
    if (!actor)
        throw new DomainError('FORBIDDEN', 'You do not have access to this community.', 403);
    return actor;
}
export function canSeeSpace(state: Workspace, actor: Member, spaceId: string | null): boolean {
    if (spaceId === null)
        return true;
    const space = state.spaces.find(s => s.id === spaceId && s.organizationId === actor.organizationId);
    return !!space && (space.visibility === 'members' || isAdmin(actor) || state.spaceMembers.some(m => m.spaceId === spaceId && m.userId === actor.userId && m.organizationId === actor.organizationId));
}
