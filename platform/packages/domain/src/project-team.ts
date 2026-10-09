import { DomainError, type Command, type Project, type TenantContext, type Workspace } from '../../contracts/src/index';
import { actorFor, canSeeSpace, isAdmin, isFormer } from './access';

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
const commands = new Set(['project.join', 'project.leave', 'project.member.remove', 'project.member.restore']);

/**
 * Joining, leaving and removal from a project team (decision 054). A membership that ends keeps its row, because the
 * person's contributions and credits name it; `leftAt` marks the end. Tasks they had claimed without proof go back to the
 * team. Someone removed by the lead or an administrator cannot rejoin until one of them lets them back.
 */
type TeamCommand = Extract<Command, { type: 'project.join' | 'project.leave' | 'project.member.remove' | 'project.member.restore' }>;
export function applyProjectTeam(s: Workspace, ctx: TenantContext, command: Command, now: string, makeId: () => string): Result | undefined {
    if (!commands.has(command.type)) return undefined;
    const cmd = command as TeamCommand;
    const actor = actorFor(s, ctx);
    const fail = (code: string, message: string, status = 409): never => { throw new DomainError(code, message, status); };
    const project = (id: string): Project => {
        const p = s.projects.find(x => x.id === id && x.organizationId === ctx.organizationId);
        if (!p || !canSeeSpace(s, actor, p.spaceId)) return fail('NOT_FOUND', 'This project is not available.', 404);
        return p;
    };
    const row = (p: Project, userId: string) => s.projectMembers.find(x => x.organizationId === ctx.organizationId && x.projectId === p.id && x.userId === userId);
    const lead = (p: Project) => { if (p.ownerId !== ctx.userId && !isAdmin(actor)) fail('PROJECT_LEAD_REQUIRED', 'The project lead or a community administrator manages the team.', 403); };
    const name = (userId: string) => s.members.find(m => m.organizationId === ctx.organizationId && m.userId === userId)?.name ?? 'This member';
    const notify = (userId: string, title: string, body: string, href: string) => {
        if (userId !== ctx.userId && !isFormer(s, userId)) s.notifications.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId, title, body, href, readAt: null });
    };
    /** Claimed tasks without proof go back to the team; tasks with proof keep their contributor's name. */
    const release = (p: Project, userId: string) => {
        let n = 0;
        for (const t of s.projectTasks ?? []) if (t.organizationId === ctx.organizationId && t.projectId === p.id && t.assigneeId === userId && !t.contributionId && !t.archived) {
            t.assigneeId = null; t.workState = 'todo'; t.version++; t.updatedAt = now; t.updatedBy = ctx.userId; n++;
        }
        return n;
    };
    const tasksNote = (n: number) => n ? ` ${n === 1 ? 'One task they had claimed is' : `${n} tasks they had claimed are`} back with the team.` : '';
    const p = project(cmd.projectId), href = `/projects/${p.id}`;
    switch (cmd.type) {
        case 'project.join': {
            const existing = row(p, ctx.userId);
            if (existing && !existing.leftAt) return { message: 'You are already on the team.', objectId: p.id, changed: false };
            if (existing?.removedBy) fail('REMOVED_FROM_TEAM', 'The project lead removed you from this team. Ask them to let you back.', 403);
            if (existing) existing.leftAt = null;
            else s.projectMembers.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, projectId: p.id, userId: ctx.userId });
            notify(p.ownerId, 'Your team is growing', `${actor.name} joined ${p.title}.`, href);
            return { message: 'You are part of the team.', objectId: p.id, changed: true };
        }
        case 'project.leave': {
            const mine = row(p, ctx.userId);
            if (!mine || mine.leftAt) return { message: 'You are not on this team.', objectId: p.id, changed: false };
            if (p.ownerId === ctx.userId) fail('PROJECT_LEAD_STAYS', 'The project lead stays on the team. Ask an administrator if someone else should lead it.');
            const n = release(p, ctx.userId);
            mine.leftAt = now; mine.removedBy = null;
            notify(p.ownerId, 'Someone left your team', `${actor.name} left ${p.title}.${tasksNote(n)}`, href);
            return { message: n ? `You left the team. ${n === 1 ? 'Your claimed task is' : 'Your claimed tasks are'} back with the team.` : 'You left the team.', objectId: p.id, changed: true, audit: true };
        }
        case 'project.member.remove': {
            lead(p);
            if (cmd.userId === ctx.userId) fail('LEAVE_INSTEAD', 'Use Leave the team to step away yourself.');
            if (cmd.userId === p.ownerId) fail('PROJECT_LEAD_STAYS', 'The project lead stays on the team.');
            const theirs = row(p, cmd.userId);
            if (!theirs || theirs.leftAt) fail('NOT_ON_TEAM', `${name(cmd.userId)} is not on this team.`);
            const n = release(p, cmd.userId);
            theirs!.leftAt = now; theirs!.removedBy = ctx.userId;
            notify(cmd.userId, 'You are no longer on a project team', `You were removed from ${p.title}. Your recognised work stays credited to you.`, href);
            return { message: `${name(cmd.userId)} is no longer on the team.${tasksNote(n)}`, objectId: p.id, changed: true, audit: true };
        }
        case 'project.member.restore': {
            lead(p);
            const theirs = row(p, cmd.userId);
            if (!theirs?.removedBy) fail('NOT_REMOVED', `${name(cmd.userId)} was not removed from this team.`);
            const m = s.members.find(x => x.organizationId === ctx.organizationId && x.userId === cmd.userId && x.status === 'active');
            if (!m || !canSeeSpace(s, m, p.spaceId)) fail('INVALID_MEMBER', `${name(cmd.userId)} can no longer join this project.`);
            theirs!.leftAt = null; theirs!.removedBy = null;
            notify(cmd.userId, 'You are back on a project team', `You can work on ${p.title} again.`, href);
            return { message: `${name(cmd.userId)} is back on the team.`, objectId: p.id, changed: true, audit: true };
        }
    }
    return undefined;
}
