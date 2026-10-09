import { api, commitDemo, demoState, mode } from './data';
import { DEMO_COMMUNITIES } from './account';
import { newId } from '../../../../packages/contracts/src/index';
import { suspensionAppealInput, type SuspensionStanding } from '../../../../packages/contracts/src/appeals';
import { appealSuspension, suspensionStanding, withdrawSuspensionAppeal } from '../../../../packages/domain/src/suspension-appeals';

/**
 * Where this person's access is suspended, and their own appeals there (decision 058). In the demo the same rules run on
 * the fictional communities; connected, the account endpoints answer, which reveal nothing else about those communities.
 */
export type SuspensionChange = { message: string; standing: SuspensionStanding | null };

export async function loadSuspensions(userId: string): Promise<SuspensionStanding[]> {
    if (mode === 'live') return api<SuspensionStanding[]>('/api/account/suspensions');
    return DEMO_COMMUNITIES.map(slug => suspensionStanding(demoState(slug), userId)).filter((s): s is SuspensionStanding => !!s);
}

const demoContext = (slug: string, userId: string) => ({ organizationId: demoState(slug).organisation.id, userId, requestId: newId() });

export async function sendSuspensionAppeal(slug: string, userId: string, reason: string): Promise<SuspensionChange> {
    if (mode === 'live') return api<SuspensionChange>(`/api/account/suspensions/${encodeURIComponent(slug)}/appeal`, { reason });
    const parsed = suspensionAppealInput.parse({ reason });
    const result = appealSuspension(demoState(slug), demoContext(slug, userId), parsed.reason, new Date().toISOString(), newId);
    return { message: result.message + commitDemo(slug, result.workspace), standing: suspensionStanding(result.workspace, userId) };
}

export async function withdrawSuspensionAppealIn(slug: string, userId: string, appealId: string): Promise<SuspensionChange> {
    if (mode === 'live') return api<SuspensionChange>(`/api/account/suspensions/${encodeURIComponent(slug)}/appeals/${encodeURIComponent(appealId)}/withdraw`, {});
    const result = withdrawSuspensionAppeal(demoState(slug), demoContext(slug, userId), appealId, new Date().toISOString(), newId);
    return { message: result.message + commitDemo(slug, result.workspace), standing: suspensionStanding(result.workspace, userId) };
}
