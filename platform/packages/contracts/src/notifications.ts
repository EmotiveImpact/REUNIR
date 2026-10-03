import { z } from 'zod';

/**
 * Notices are grouped by what they are about. People can turn off the everyday topics; notices about their own access,
 * role or ownership ("community") always arrive, because they change what the person may do.
 */
export const NOTICE_TOPICS = ['conversations', 'learning', 'projects', 'events', 'community'] as const;
export type NoticeTopic = typeof NOTICE_TOPICS[number];
export const MUTABLE_TOPICS = ['conversations', 'learning', 'projects', 'events'] as const satisfies readonly NoticeTopic[];
export type MutableTopic = typeof MUTABLE_TOPICS[number];
export const TOPIC_LABELS: Record<NoticeTopic, { title: string; detail: string }> = {
    conversations: { title: 'Conversations', detail: 'Replies and comments on posts you started or joined.' },
    learning: { title: 'Learning', detail: 'Feedback on missions and knowledge checks, and teaching duties.' },
    projects: { title: 'Projects', detail: 'Tasks, contributions and reviews in projects you are part of.' },
    events: { title: 'Events', detail: 'Events you replied to and new ones in your spaces.' },
    community: { title: 'Your access', detail: 'Changes to your role, access or ownership. These always arrive.' },
};
export const DIGESTS = ['off', 'daily', 'weekly'] as const;
export type DigestFrequency = typeof DIGESTS[number];
export const DIGEST_PERIOD_MS: Record<Exclude<DigestFrequency, 'off'>, number> = { daily: 864e5, weekly: 7 * 864e5 };
/** Notices one digest email lists; the rest are counted and linked. */
export const DIGEST_ITEMS = 20;

/** What a notice is about, from where it leads. Unknown places count as community notices, which always arrive. */
export function noticeTopic(href: string): NoticeTopic {
    const path = href.split(/[?#]/)[0];
    // Being asked to teach a track changes what the person may do, so it counts as an access notice.
    if (/^\/learn\/[^/]+\/studio$/.test(path)) return 'community';
    if (/^\/(post|posts|spaces)(\/|$)/.test(path)) return 'conversations';
    if (/^\/(learn|missions|teaching)(\/|$)/.test(path) || /^\/admin\/(knowledge-checks|reviews)(\/|$)/.test(path)) return 'learning';
    if (/^\/(projects|outputs)(\/|$)/.test(path)) return 'projects';
    if (/^\/events(\/|$)/.test(path)) return 'events';
    return 'community';
}

export const notificationPreferencesInput = {
    muted: z.array(z.enum(MUTABLE_TOPICS)).max(MUTABLE_TOPICS.length).refine(xs => new Set(xs).size === xs.length, 'List each topic once.'),
    digest: z.enum(DIGESTS),
};
