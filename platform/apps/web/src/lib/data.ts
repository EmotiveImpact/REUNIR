import { normalisePurposeState } from '../../../../packages/domain/src/purpose';
import { applyCommand, visibleWorkspace } from '../../../../packages/domain/src/engine';
import { createSeed, DEMO_USER } from '../../../../packages/domain/src/seed';
import { newId } from '../../../../packages/contracts/src/index';
import type { Workspace, CommandInput, MutationResult } from '../../../../packages/contracts/src/index';
import { clearDemoFiles } from './demo-files';
import { ApiError, OFFLINE_MESSAGE } from './errors';
export { ApiError, OFFLINE_MESSAGE, displayError, failureOf, type Failure } from './errors';
export type DataMode = 'demo' | 'live';
export const mode: DataMode = import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'demo';
const prefix = 'reunir.alpha1.v1.';
export interface Identity {
    id: string;
    name: string;
    /** Live mode: the account's sign-in address and whether it is confirmed. The demo has no addresses. */
    email?: string;
    emailVerified?: boolean;
    /** Live mode: whether two-step sign-in is on for this account. The demo has no sign-in. */
    twoFactorEnabled?: boolean;
    memberships: {
        slug: string;
        name: string;
        /** Present in live mode; the demo reads roles from its fictional communities. */
        role?: string;
    }[];
}
export async function api<T>(path: string, body?: unknown, requestKey?: string): Promise<T> {
    let res: Response;
    try { res = await fetch(path, { credentials: 'include', headers: body ? { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey || newId() } : undefined, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new ApiError(OFFLINE_MESSAGE, 0, 'OFFLINE'); }
    if (!res.headers.get('content-type')?.includes('application/json'))
        throw new ApiError('The REUNIR API is not connected. Live mode never falls back to demo data.', res.status, 'API_UNAVAILABLE');
    const data = await res.json();
    if (!res.ok)
        throw new ApiError(data.error?.message || data.message || 'Something did not go through. Please try again.', res.status, data.error?.code || 'HTTP_' + res.status);
    return data;
}
let memory: Record<string, Workspace> = {};
export function demoState(slug: string): Workspace {
    if (memory[slug])
        return memory[slug];
    try {
        const raw = localStorage.getItem(prefix + slug);
        if (raw) {
            const s = JSON.parse(raw);
            if (s.organisation?.slug === slug && Array.isArray(s.members) && Array.isArray(s.outbox) && Array.isArray(s.lessons)) {
                memory[slug] = normalisePurposeState(s);
                return memory[slug];
            }
        }
    }
    catch { /* Storage can be unavailable in a private browser. Continue in memory. */ }
    return memory[slug] = createSeed(slug);
}
/** Store fictional demo state. Returns a note when the browser keeps it only for this session. */
export function commitDemo(slug: string, workspace: Workspace): string {
    memory[slug] = workspace;
    try {
        localStorage.setItem(prefix + slug, JSON.stringify(workspace));
        return '';
    }
    catch {
        return ' Browser storage is unavailable; this change lasts for this session.';
    }
}
export function snapshot(slug: string, userId: string): Workspace { return visibleWorkspace(demoState(slug), { organizationId: demoState(slug).organisation.id, userId, requestId: newId() }); }
export function resetDemo() { memory = {}; void clearDemoFiles(); window.dispatchEvent(new Event('reunir:reset-demo'));  for (const slug of ['code-black', 'studio-north'])
    try {
        localStorage.removeItem(prefix + slug);
        localStorage.removeItem('reunir.chat.v1.' + slug);
    }
    catch { /* best effort for restricted storage */ } }
export async function loadWorkspace(slug: string, userId: string): Promise<Workspace> { return mode === 'demo' ? snapshot(slug, userId) : api(`/api/organisations/${encodeURIComponent(slug)}/workspace`); }
export async function sendCommand(slug: string, userId: string, command: CommandInput): Promise<MutationResult> {
    if (mode === 'live')
        return api(`/api/organisations/${encodeURIComponent(slug)}/commands`, command);
    const s = demoState(slug);
    const r = applyCommand(s, { organizationId: s.organisation.id, userId, requestId: newId() }, command);
    const message = r.message + commitDemo(slug, r.workspace);
    return { ...r, message, workspace: snapshot(slug, userId) };
}
export async function identity(): Promise<Identity | null> { if (mode === 'demo')
    return { id: DEMO_USER, name: 'Alex Morgan', memberships: [{ slug: 'code-black', name: 'Code Black' }, { slug: 'studio-north', name: 'Studio North' }] }; return api('/api/session'); }
