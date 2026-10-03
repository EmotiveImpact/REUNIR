import { api, commitDemo, demoState, mode } from './data';
import { forgetDemoChat } from './messaging';
import { removeDemoFile } from './demo-files';
import { confirmsAccountDeletion, ownerRefusal, ACCOUNT_DELETION_PHRASE, type AccountDeletionSummary } from '../../../../packages/contracts/src/account';
import { eraseFromCommunity } from '../../../../packages/domain/src/account-deletion';

/** The fictional demo's communities; a demo account belongs to each it has a membership in. */
export const DEMO_COMMUNITIES = ['code-black', 'studio-north'];
const deletedKey = 'reunir.demo.deleted-accounts', noticeKey = 'reunir.account-deleted';
let deletedInMemory: string[] = [];
window.addEventListener('reunir:reset-demo', () => forgetDeletedDemoAccounts());

function deletedDemoAccounts(): string[] {
    try { const raw = localStorage.getItem(deletedKey); if (raw) { const list = JSON.parse(raw); if (Array.isArray(list)) return list.filter(x => typeof x === 'string'); } }
    catch { /* Restricted storage: the session keeps its own list. */ }
    return deletedInMemory;
}
export const demoAccountDeleted = (userId: string) => mode === 'demo' && deletedDemoAccounts().includes(userId);
export function forgetDeletedDemoAccounts() {
    deletedInMemory = [];
    try { localStorage.removeItem(deletedKey); } catch { /* best effort */ }
}

/** Communities this account owns. Owners cannot delete their account while they own one. */
export function ownedCommunities(userId: string, memberships: { slug: string; name: string; role?: string }[]): string[] {
    if (mode === 'live') return memberships.filter(m => m.role === 'owner').map(m => m.name);
    return DEMO_COMMUNITIES.map(demoState).filter(s => s.members.some(m => m.userId === userId && m.role === 'owner')).map(s => s.organisation.name);
}

/** In the demo, the same rules run in the browser on fictional data, in every demo community the persona belongs to. */
function deleteDemoAccount(userId: string): AccountDeletionSummary {
    const owned = ownedCommunities(userId, []);
    if (owned.length) throw new Error(ownerRefusal(owned));
    const now = new Date().toISOString(), removed: Record<string, number> = {};
    let communities = 0, releasedTasks = 0, rewordedNotices = 0;
    for (const slug of DEMO_COMMUNITIES) {
        const state = demoState(slug);
        if (!state.members.some(m => m.userId === userId)) continue;
        const erasure = eraseFromCommunity(state, userId, now);
        commitDemo(slug, erasure.workspace);
        forgetDemoChat(slug, userId);
        for (const u of erasure.unfinishedUploads) void removeDemoFile(slug, u.id);
        for (const [key, n] of Object.entries(erasure.removed)) if (n) removed[key] = (removed[key] ?? 0) + n;
        communities++; releasedTasks += erasure.releasedTasks; rewordedNotices += erasure.rewordedNotices;
    }
    deletedInMemory = [...new Set([...deletedDemoAccounts(), userId])];
    try { localStorage.setItem(deletedKey, JSON.stringify(deletedInMemory)); } catch { /* the session list still applies */ }
    return { communities, removed, releasedTasks, rewordedNotices };
}

/** Delete the signed-in account. Live mode checks the password on the server; the demo has no passwords. */
export async function deleteAccount(userId: string, password: string, confirmation: string): Promise<AccountDeletionSummary> {
    if (!confirmsAccountDeletion(confirmation)) throw new Error(`Type “${ACCOUNT_DELETION_PHRASE}” to confirm.`);
    if (mode === 'demo') return deleteDemoAccount(userId);
    if (!password) throw new Error('Enter your password.');
    const result = await api<{ deleted: boolean; summary: AccountDeletionSummary }>('/api/account/delete', { password, confirmation });
    try { sessionStorage.setItem(noticeKey, '1'); } catch { /* the sign-in page simply shows no notice */ }
    return result.summary;
}

/** Shown once on the sign-in page after a live deletion. */
export function takeDeletionNotice(): boolean {
    try { const shown = sessionStorage.getItem(noticeKey) === '1'; sessionStorage.removeItem(noticeKey); return shown; }
    catch { return false; }
}
