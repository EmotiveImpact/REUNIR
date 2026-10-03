import { DomainError, type TenantContext, type Workspace } from '../../contracts/src/index';
import { actorFor, isAdmin } from './access';
import { applyCommand } from './engine';

/**
 * Whether a command succeeds only because the actor is an owner or administrator: it is tried again, on a copy, with the
 * actor as a moderator. Moderators are not owners or administrators, so whatever a moderator could do is not owner or
 * administrator authority. A command that a moderator may also run, but with a different outcome (an instructor's new
 * track waits for publication; an administrator's is published at once), relies on administration too. Pure and
 * unaware of how anyone signed in; the API decides what to do with the answer.
 */
export function reliesOnAdministration(state: Workspace, ctx: TenantContext, command: unknown): boolean {
    const actor = actorFor(state, ctx);
    if (!isAdmin(actor)) return false;
    const lowered: Workspace = { ...state, members: state.members.map(m => m.id === actor.id ? { ...m, role: 'moderator' } : m) };
    // The same clock and identifiers for both runs, so only authority can make the outcomes differ.
    const outcome = (s: Workspace) => { let n = 0; const r = applyCommand(s, ctx, command, () => '1970-01-01T00:00:00.000Z', () => `same_${++n}`).workspace; return JSON.stringify({ ...r, members: [] }); };
    let asModerator: string;
    try { asModerator = outcome(lowered); }
    catch (error) {
        if (error instanceof DomainError) return true;
        throw error;
    }
    return asModerator !== outcome(state);
}
