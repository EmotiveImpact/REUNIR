import { api, mode } from './data';
import { newId } from '../../../../packages/contracts/src/index';

export interface Invite { id: string; email: string; status: string; createdAt: string; expiresAt: string; delivery: string; trackId?: string | null; trackTitle?: string | null }

/** Fictional demo only: invitations live in this page and are never emailed. */
const demoInvites: Record<string, Invite[]> = {};
window.addEventListener('reunir:reset-demo', () => { for (const key of Object.keys(demoInvites)) delete demoInvites[key]; });

export const listInvitations = async (slug: string) => mode === 'live' ? api<Invite[]>(`/api/organisations/${slug}/invitations`) : demoInvites[slug] || [];

/**
 * Creates an invitation, optionally asking the person to teach one track. Live mode returns the personal link, shown once;
 * the demo records a fictional invitation and returns no link.
 */
export async function createInvitation(slug: string, email: string, track?: { id: string; title: string }): Promise<{ url: string | null; emailConfigured: boolean }> {
    if (mode === 'demo') {
        const now = new Date().toISOString();
        demoInvites[slug] = [{ id: newId(), email, status: 'pending', createdAt: now, expiresAt: new Date(Date.now() + 604800000).toISOString(), delivery: 'demo-only', trackId: track?.id ?? null, trackTitle: track?.title ?? null }, ...(demoInvites[slug] || []).filter(i => i.email !== email)];
        return { url: null, emailConfigured: false };
    }
    const r = await api<{ url: string; emailConfigured: boolean }>(`/api/organisations/${slug}/invitations`, track ? { email, trackId: track.id } : { email });
    return { url: r.url, emailConfigured: r.emailConfigured };
}

export async function revokeInvitation(slug: string, id: string) {
    if (mode === 'demo') { demoInvites[slug] = (demoInvites[slug] || []).map(x => x.id === id ? { ...x, status: 'revoked', delivery: 'cancelled' } : x); return; }
    await api(`/api/organisations/${slug}/invitations/${id}/revoke`, {});
}
