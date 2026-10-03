import type { CollectionItem, Workspace } from '../../contracts/src/index';
import { COLLECTION_TARGET, type CollectionItemKind } from '../../contracts/src/collections';
/**
 * Fictional sample collections for the browser demo and tests. "Start here" is published and featured, and includes one
 * team-only post that members never see. "Feedback that helps" is a moderator's private draft.
 */
export function seedCollections(s: Workspace, include: boolean): Workspace {
    s.collections = []; s.collectionItems = [];
    if (!include) return s;
    const org = s.organisation.id, at = '2026-09-24T09:00:00.000Z';
    s.collections = [
        { id: 'collection_start', organizationId: org, createdAt: at, title: 'Start here', description: 'A few useful places to begin in your first week.', status: 'published', featured: true, createdBy: 'member_amina', updatedBy: 'member_amina', updatedAt: at, publishedAt: at },
        { id: 'collection_feedback', organizationId: org, createdAt: at, title: 'Feedback that helps', description: 'Conversations and missions that show useful critique.', status: 'draft', featured: false, createdBy: 'member_maya', updatedBy: 'member_maya', updatedAt: at, publishedAt: null },
    ];
    const none = { postId: null, trackId: null, lessonId: null, projectId: null, eventId: null, pathId: null, missionId: null, outputId: null };
    const item = (id: string, collectionId: string, position: number, kind: CollectionItemKind, target: string, note: string, addedBy: string): CollectionItem =>
        ({ id, organizationId: org, createdAt: at, collectionId, kind, position, note, addedBy, ...none, [COLLECTION_TARGET[kind]]: target });
    s.collectionItems = [
        item('collected_welcome', 'collection_start', 1, 'post', 'post_welcome', 'Read this first: how we look after each other here.', 'member_amina'),
        item('collected_path', 'collection_start', 2, 'path', 'path_product', 'The path most new members start with.', 'member_amina'),
        item('collected_lesson', 'collection_start', 3, 'lesson', 'lesson_4', '', 'member_amina'),
        item('collected_team_notes', 'collection_start', 4, 'post', 'post_private', 'Team only: how we run the open studio.', 'member_amina'),
        item('collected_output', 'collection_start', 5, 'output', 'output_notes', 'What a finished community project looks like.', 'member_amina'),
        item('collected_maya', 'collection_feedback', 1, 'post', 'post_maya', 'A good question to borrow.', 'member_maya'),
        item('collected_brand', 'collection_feedback', 2, 'mission', 'mission_brand', '', 'member_maya'),
    ];
    return s;
}
