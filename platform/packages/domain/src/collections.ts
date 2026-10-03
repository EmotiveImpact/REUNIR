import { DomainError, type Collection, type CollectionItem, type Command, type Member, type TenantContext, type Workspace } from '../../contracts/src/index';
import { COLLECTION_TARGET, MAX_COLLECTIONS, MAX_COLLECTION_ITEMS, type CollectionItemKind } from '../../contracts/src/collections';
import { actorFor, isModerator } from './access';
import { visibleRecords } from './engine';

/** Owners, administrators and moderators curate, while their membership is active. Curating grants nothing else. */
export const curates = (actor: Member) => actor.status === 'active' && isModerator(actor);

/** The content an item points at. Exactly one property is set, the one for its kind. */
export const itemTarget = (item: CollectionItem): string => item[COLLECTION_TARGET[item.kind]] ?? '';

/**
 * What a person sees of an item's content. `draft` marks content that is hidden, unpublished or a draft, which only
 * curators can see and which cannot be added. `restricted` names the private space whose members alone see it.
 */
export interface CollectedContent { id: string; title: string; href: string; detail: string; draft: boolean; restricted: string }
/** Records of each kind in a workspace that is already filtered for one person. */
function targets(view: Workspace): Record<CollectionItemKind, Map<string, CollectedContent>> {
    const privateSpace = (id: string | null | undefined) => { const sp = id ? view.spaces.find(s => s.id === id) : undefined; return sp?.visibility === 'private' ? sp.name : ''; };
    const map = <T extends { id: string }>(xs: T[], f: (x: T) => { title: string; href: string; detail: string; draft?: boolean; spaceId?: string | null }) =>
        new Map(xs.map(x => { const { spaceId, ...r } = f(x); return [x.id, { id: x.id, ...r, draft: !!r.draft, restricted: privateSpace(spaceId) }]; }));
    const space = (id: string | null) => id ? view.spaces.find(s => s.id === id)?.name ?? '' : '';
    const track = (id: string) => view.tracks.find(t => t.id === id);
    const project = (id: string | null) => id ? view.projects.find(p => p.id === id) : undefined;
    return {
        post: map(view.posts, p => ({ title: p.title || p.body.slice(0, 80), href: `/post/${p.id}`, detail: space(p.spaceId) || 'Conversation', draft: p.hidden, spaceId: p.spaceId })),
        track: map(view.tracks, t => ({ title: t.title, href: `/learn/${t.id}`, detail: t.summary, draft: !t.published, spaceId: t.spaceId })),
        lesson: map(view.lessons, l => ({ title: l.title, href: `/learn/${l.trackId}/${l.id}`, detail: track(l.trackId)?.title ?? 'Lesson', draft: !l.published || !track(l.trackId)?.published, spaceId: track(l.trackId)?.spaceId })),
        project: map(view.projects, p => ({ title: p.title, href: `/projects/${p.id}`, detail: p.tagline, spaceId: p.spaceId })),
        event: map(view.events, e => ({ title: e.title, href: `/events/${e.id}`, detail: e.summary, spaceId: e.spaceId })),
        path: map(view.paths, p => ({ title: p.title, href: `/paths/${p.id}`, detail: p.summary, draft: p.status !== 'published', spaceId: p.spaceId })),
        mission: map(view.missions, m => ({ title: m.title, href: `/missions/${m.id}`, detail: m.category, spaceId: m.spaceId })),
        output: map(view.communityOutputs, o => ({ title: o.title, href: '/outputs', detail: o.summary, spaceId: project(o.projectId)?.spaceId })),
    };
}

/** Title, link and detail of an item's content in an already filtered workspace, or nothing when it is not visible there. */
export function resolveItem(view: Workspace, item: CollectionItem): CollectedContent | undefined {
    return targets(view)[item.kind].get(itemTarget(item));
}

/** Content of one kind a curator could add: what they can see that is live. Input is their own filtered workspace. */
export function collectableContent(view: Workspace, kind: CollectionItemKind): CollectedContent[] {
    return [...targets(view)[kind].values()].filter(x => !x.draft);
}

/**
 * Runs after every other filter. Drafts are shown only to curators. An item is kept only when this person can already see
 * its content, so a collection never reveals the title, note or existence of something private, hidden or unpublished.
 * Published collections with nothing this person can see are left out for everyone but curators.
 */
export function filterCollections(s: Workspace, actor: Member): Workspace {
    const team = curates(actor), visible = targets(s);
    s.collections = (s.collections ?? []).filter(c => c.organizationId === actor.organizationId && (c.status === 'published' || team));
    const ids = new Set(s.collections.map(c => c.id));
    s.collectionItems = (s.collectionItems ?? []).filter(i => i.organizationId === actor.organizationId && ids.has(i.collectionId) && visible[i.kind].has(itemTarget(i)));
    if (!team) {
        const used = new Set(s.collectionItems.map(i => i.collectionId));
        s.collections = s.collections.filter(c => used.has(c.id));
    }
    return s;
}

type Result = { message: string; objectId: string; changed: boolean; audit?: boolean };
export function applyCollections(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (!cmd.type.startsWith('collection.')) return undefined;
    const actor = actorFor(s, ctx);
    if (!curates(actor)) throw new DomainError('CURATOR_REQUIRED', 'Only community owners, administrators and moderators can curate collections.', 403);
    s.collections ??= []; s.collectionItems ??= [];
    const missing = (): never => { throw new DomainError('NOT_FOUND', 'That collection is not available.', 404); };
    const collection = (id: string) => s.collections.find(c => c.id === id && c.organizationId === ctx.organizationId) ?? missing();
    // What this curator can see, by the same rules as their own snapshot.
    const view = visibleRecords(s, ctx);
    const seen = new Set(view.collectionItems.map(i => i.id));
    const item = (id: string) => s.collectionItems.find(i => i.id === id && i.organizationId === ctx.organizationId && seen.has(i.id)) ?? missing();
    const itemsOf = (c: Collection) => s.collectionItems.filter(i => i.collectionId === c.id && i.organizationId === ctx.organizationId).sort((a, b) => a.position - b.position);
    const touch = (c: Collection) => { c.updatedBy = ctx.userId; c.updatedAt = now; };
    const done = (objectId: string, message: string, changed = true): Result => ({ objectId, message, changed, audit: changed });
    switch (cmd.type) {
        case 'collection.save': {
            if (cmd.collectionId) {
                const c = collection(cmd.collectionId);
                if (c.title === cmd.title && c.description === cmd.description) return done(c.id, 'This collection is unchanged.', false);
                c.title = cmd.title; c.description = cmd.description; touch(c);
                return done(c.id, 'Collection saved.');
            }
            if (s.collections.filter(c => c.organizationId === ctx.organizationId).length >= MAX_COLLECTIONS) throw new DomainError('COLLECTION_LIMIT', `A community can keep up to ${MAX_COLLECTIONS} collections.`, 409);
            const c: Collection = { id: makeId(), organizationId: ctx.organizationId, createdAt: now, title: cmd.title, description: cmd.description, status: 'draft', featured: false, createdBy: ctx.userId, updatedBy: ctx.userId, updatedAt: now, publishedAt: null };
            s.collections.push(c);
            return done(c.id, 'Draft collection created. Only the community team can see it until you publish it.');
        }
        case 'collection.publish': {
            const c = collection(cmd.collectionId);
            const status = cmd.published ? 'published' : 'draft';
            if (c.status === status) return done(c.id, cmd.published ? 'This collection is already published.' : 'This collection is already a draft.', false);
            if (cmd.published && !itemsOf(c).length) throw new DomainError('EMPTY_COLLECTION', 'Add something to the collection before publishing it.', 409);
            c.status = status; if (cmd.published) c.publishedAt = now; else c.featured = false; touch(c);
            return done(c.id, cmd.published ? 'Collection published. Members see the items they already have access to.' : 'Collection returned to draft. Only the community team can see it.');
        }
        case 'collection.feature': {
            const c = collection(cmd.collectionId);
            if (cmd.featured && c.status !== 'published') throw new DomainError('NOT_PUBLISHED', 'Publish the collection before featuring it on Home.', 409);
            if (c.featured === cmd.featured) return done(c.id, cmd.featured ? 'This collection is already on Home.' : 'This collection is not on Home.', false);
            if (cmd.featured) for (const other of s.collections.filter(x => x.organizationId === ctx.organizationId && x.featured)) { other.featured = false; touch(other); }
            c.featured = cmd.featured; touch(c);
            return done(c.id, cmd.featured ? 'Featured on Home.' : 'No longer featured on Home.');
        }
        case 'collection.delete': {
            const c = collection(cmd.collectionId);
            s.collectionItems = s.collectionItems.filter(i => !(i.collectionId === c.id && i.organizationId === ctx.organizationId));
            s.collections = s.collections.filter(x => x !== c);
            return done(c.id, 'Collection deleted. The content it pointed to is unchanged.');
        }
        case 'collection.item.add': {
            const c = collection(cmd.collectionId);
            const found = resolveItem(view, { kind: cmd.kind, [COLLECTION_TARGET[cmd.kind]]: cmd.targetId } as unknown as CollectionItem);
            // Only content the curator can see, and nothing hidden, unpublished or still a draft.
            if (!found || found.draft) throw new DomainError('NOT_FOUND', 'That item is not available to add.', 404);
            const items = itemsOf(c);
            if (items.some(i => i.kind === cmd.kind && itemTarget(i) === cmd.targetId)) return done(c.id, 'That is already in this collection.', false);
            if (items.length >= MAX_COLLECTION_ITEMS) throw new DomainError('COLLECTION_FULL', `A collection holds up to ${MAX_COLLECTION_ITEMS} items.`, 409);
            const none = { postId: null, trackId: null, lessonId: null, projectId: null, eventId: null, pathId: null, missionId: null, outputId: null };
            const added: CollectionItem = { id: makeId(), organizationId: ctx.organizationId, createdAt: now, collectionId: c.id, kind: cmd.kind, position: Math.max(0, ...items.map(i => i.position)) + 1, note: cmd.note, addedBy: ctx.userId, ...none, [COLLECTION_TARGET[cmd.kind]]: cmd.targetId };
            s.collectionItems.push(added); touch(c);
            return done(added.id, `Added to ${c.title}.`);
        }
        case 'collection.item.note': {
            const i = item(cmd.itemId);
            if (i.note === cmd.note) return done(i.id, 'The note is unchanged.', false);
            i.note = cmd.note; touch(collection(i.collectionId));
            return done(i.id, cmd.note ? 'Note saved.' : 'Note removed.');
        }
        case 'collection.item.remove': {
            const i = item(cmd.itemId);
            s.collectionItems = s.collectionItems.filter(x => x !== i); touch(collection(i.collectionId));
            return done(i.id, 'Removed from the collection. The content itself is unchanged.');
        }
        case 'collection.items.reorder': {
            const c = collection(cmd.collectionId);
            // A curator orders the items they can see. Items they cannot see keep their places.
            const mine = itemsOf(c).filter(i => seen.has(i.id)), current = mine.map(i => i.id);
            if (JSON.stringify(current) !== JSON.stringify(cmd.expectedOrder)) throw new DomainError('STALE_COLLECTION', 'The collection changed. Refresh before reordering.', 409);
            if (cmd.itemIds.length !== current.length || new Set(cmd.itemIds).size !== current.length || cmd.itemIds.some(id => !current.includes(id))) throw new DomainError('INVALID_ORDER', 'Include every item exactly once.');
            if (JSON.stringify(current) === JSON.stringify(cmd.itemIds)) return done(c.id, 'The collection is already in this order.', false);
            const places = mine.map(i => i.position);
            for (const i of mine) i.position = places[cmd.itemIds.indexOf(i.id)];
            touch(c);
            return done(c.id, 'Order saved.');
        }
    }
    return undefined;
}
