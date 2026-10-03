import { DomainError, type Command, type NotificationPreference, type TenantContext, type Workspace } from '../../contracts/src/index';
import { noticeTopic, type DigestFrequency, type MutableTopic } from '../../contracts/src/notifications';
import { actorFor } from './access';

/** A member's settings, or the defaults: every topic on and no digest. */
export function preferenceFor(s: Workspace, organizationId: string, userId: string): Pick<NotificationPreference, 'muted' | 'digest'> {
    return s.notificationPreferences.find(p => p.organizationId === organizationId && p.userId === userId) ?? { muted: [], digest: 'off' };
}

/**
 * Notices a command just created for people who turned that topic off are not kept. Notices about a person's own access,
 * role or ownership have no switch. Existing notices are never touched.
 */
export function dropMutedNotices(s: Workspace, existing: Set<string>, organizationId: string): void {
    s.notifications = s.notifications.filter(n => existing.has(n.id) || !(preferenceFor(s, organizationId, n.userId).muted as string[]).includes(noticeTopic(n.href)));
}

export function applyNotificationSettings(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string) {
    if (cmd.type !== 'notification.preferences.save') return undefined;
    const actor = actorFor(s, ctx);
    if (actor.status !== 'active') throw new DomainError('FORBIDDEN', 'Your community access is not active.', 403);
    const muted = [...cmd.muted].sort() as MutableTopic[], digest: DigestFrequency = cmd.digest;
    const current = s.notificationPreferences.find(p => p.organizationId === ctx.organizationId && p.userId === ctx.userId);
    if (current && JSON.stringify(current.muted) === JSON.stringify(muted) && current.digest === digest)
        return { message: 'Your notification settings are unchanged.', objectId: current.id, changed: false, audit: false };
    if (current) Object.assign(current, { muted, digest, updatedAt: now });
    else s.notificationPreferences.push({ id: makeId(), organizationId: ctx.organizationId, createdAt: now, userId: ctx.userId, muted, digest, updatedAt: now, lastDigestAt: null });
    const id = current?.id ?? s.notificationPreferences.at(-1)!.id;
    return { message: digest === 'off' ? 'Notification settings saved.' : `Notification settings saved. A ${digest} email digest will list notices you have not read.`, objectId: id, changed: true, audit: false };
}
