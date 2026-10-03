import { z } from 'zod';

/**
 * Collections gather useful community content chosen by the community team, such as "Start here". An item points at
 * content that already exists; it never copies it, and each viewer sees an item only while they can see its content.
 */
export const COLLECTION_ITEM_KINDS = ['post', 'track', 'lesson', 'project', 'event', 'path', 'mission', 'output'] as const;
export type CollectionItemKind = typeof COLLECTION_ITEM_KINDS[number];
export const COLLECTION_KIND_LABELS: Record<CollectionItemKind, string> = {
    post: 'Conversation', track: 'Learning track', lesson: 'Lesson', project: 'Project', event: 'Event', path: 'Path', mission: 'Mission', output: 'Community output',
};
/** The property on an item that names its content, one per kind. */
export const COLLECTION_TARGET = {
    post: 'postId', track: 'trackId', lesson: 'lessonId', project: 'projectId', event: 'eventId', path: 'pathId', mission: 'missionId', output: 'outputId',
} as const satisfies Record<CollectionItemKind, string>;
export const MAX_COLLECTIONS = 30;
export const MAX_COLLECTION_ITEMS = 50;

const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const note = z.string().trim().max(280).default('');
export const collectionFields = {
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).default(''),
};
export const collectionItemFields = { kind: z.enum(COLLECTION_ITEM_KINDS), targetId: id, note };
export const collectionNote = note;
