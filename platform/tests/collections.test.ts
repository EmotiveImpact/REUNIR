import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { MAX_COLLECTION_ITEMS } from '../packages/contracts/src/collections';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { curates, itemTarget, resolveItem } from '../packages/domain/src/collections';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', MAYA = 'member_maya';
let seq = 0;
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'collections_test' });
const exec = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => applyCommand(s, ctx(user, s.organisation.id), cmd, () => NOW, () => `coll_${++seq}`);
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => exec(s, cmd, user).workspace;
const view = (s: Workspace, user = DEMO_USER) => visibleWorkspace(s, ctx(user, s.organisation.id));
const throwsCode = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code, code);
const member = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId && m.organizationId === ORG)!;
const titles = (s: Workspace, user = DEMO_USER) => { const v = view(s, user); return v.collectionItems.map(i => resolveItem(v, i)?.title); };
const create = (s: Workspace, title = 'Useful for new members', user = DEMO_ADMIN) => { const r = exec(s, { type: 'collection.save', title, description: 'Chosen by the team.' }, user); return { s: r.workspace, id: r.objectId! }; };

test('collection commands are strict and bounded', () => {
    const ok = (x: unknown) => commandSchema.safeParse(x).success;
    assert(ok({ type: 'collection.save', title: 'Start here' }));
    assert(ok({ type: 'collection.item.add', collectionId: 'c1', kind: 'lesson', targetId: 'lesson_4', note: 'Begin here.' }));
    assert(!ok({ type: 'collection.save', title: '' }), 'a title is required');
    assert(!ok({ type: 'collection.save', title: 'x'.repeat(81) }));
    assert(!ok({ type: 'collection.save', title: 'Start here', featured: true }), 'featuring is its own command');
    assert(!ok({ type: 'collection.item.add', collectionId: 'c1', kind: 'goal', targetId: 'goal_alex' }), 'private goals can never be collected');
    assert(!ok({ type: 'collection.item.add', collectionId: 'c1', kind: 'post', targetId: 'post_welcome', note: 'n'.repeat(281) }));
    assert(!ok({ type: 'collection.item.add', collectionId: 'c1', kind: 'post', targetId: '../post' }));
    assert(!ok({ type: 'collection.items.reorder', collectionId: 'c1', expectedOrder: [], itemIds: [], extra: 1 }));
});

test('owners, administrators and moderators curate while active, and nobody else does', () => {
    const s = createSeed();
    assert.equal(curates(member(s, DEMO_ADMIN)), true);
    assert.equal(curates(member(s, MAYA)), true, 'moderators curate');
    assert.equal(curates(member(s, DEMO_USER)), false);
    assert.equal(curates(member(s, 'member_idris')), false, 'teaching a track is not curating');
    for (const cmd of [{ type: 'collection.save', title: 'Mine' }, { type: 'collection.publish', collectionId: 'collection_start', published: false },
        { type: 'collection.item.add', collectionId: 'collection_start', kind: 'post', targetId: 'post_win' }, { type: 'collection.item.remove', itemId: 'collected_welcome' },
        { type: 'collection.delete', collectionId: 'collection_start' }])
        throwsCode(() => exec(s, cmd, DEMO_USER), 'CURATOR_REQUIRED');
    const suspended = structuredClone(s); member(suspended, MAYA).status = 'suspended';
    throwsCode(() => exec(suspended, { type: 'collection.save', title: 'Mine' }, MAYA), 'FORBIDDEN');
    assert.deepEqual(view(suspended, DEMO_ADMIN).collections.map(c => c.id).sort(), ['collection_feedback', 'collection_start'], 'a suspended curator’s drafts stay');
    const left = structuredClone(s); member(left, MAYA).status = 'left';
    throwsCode(() => exec(left, { type: 'collection.publish', collectionId: 'collection_feedback', published: true }, MAYA), 'FORBIDDEN');
    throwsCode(() => view(left, MAYA), 'FORBIDDEN');
    const demoted = structuredClone(s); member(demoted, MAYA).role = 'member';
    throwsCode(() => exec(demoted, { type: 'collection.save', title: 'Mine' }, MAYA), 'CURATOR_REQUIRED');
    assert(!view(demoted, MAYA).collections.some(c => c.status === 'draft'), 'a former moderator no longer reads drafts');
});

test('members see published items they can already see, and nothing about the rest', () => {
    const s = createSeed();
    const alex = view(s);
    assert.deepEqual(alex.collections.map(c => c.title), ['Start here'], 'the draft is the team’s alone');
    assert.deepEqual(titles(s), ['Good people. Better things.', 'From idea to something useful', 'Choose one real problem', 'Notes from the studio: issue 01']);
    const json = JSON.stringify({ c: alex.collections, i: alex.collectionItems });
    for (const secret of ['collected_team_notes', 'post_private', 'Team only', 'Feedback that helps', 'collected_maya']) assert(!json.includes(secret), secret);
    // The owner sees the team-only post; Maya moderates but is not in the private studio, so she does not.
    assert.equal(titles(s, DEMO_ADMIN).length, 7);
    assert(titles(s, DEMO_ADMIN).includes('Team notes for the open studio'));
    assert(!titles(s, MAYA).includes('Team notes for the open studio'));
    assert.deepEqual(view(s, MAYA).collections.map(c => c.title).sort(), ['Feedback that helps', 'Start here']);
    // Studio North has no collections, and none of Code Black's travel there.
    assert.deepEqual(view(createSeed('studio-north')).collections, []);
});

test('items follow the content: hidden posts, unpublished lessons and private spaces drop out for members', () => {
    let s = createSeed();
    s = run(s, { type: 'post.moderate', postId: 'post_welcome', hidden: true }, MAYA);
    assert(!titles(s).includes('Good people. Better things.'));
    s.lessons.find(l => l.id === 'lesson_4')!.published = false;
    assert(!titles(s).includes('Choose one real problem'));
    s.paths.find(p => p.id === 'path_product')!.spaceId = 'space_studio';
    assert(!titles(s).includes('From idea to something useful'));
    s.communityOutputs = [];
    assert.deepEqual(view(s).collections, [], 'a collection with nothing a member can see is left out');
    assert.equal(view(s, MAYA).collections.length, 2, 'curators still see it, to fix it');
});

test('a draft is private until published; publishing and featuring are explicit', () => {
    let { s, id } = create(createSeed(), 'Useful for new members', MAYA);
    assert.equal(s.collections.find(c => c.id === id)!.status, 'draft');
    assert(!view(s).collections.some(c => c.id === id));
    throwsCode(() => exec(s, { type: 'collection.publish', collectionId: id, published: true }, MAYA), 'EMPTY_COLLECTION');
    throwsCode(() => exec(s, { type: 'collection.feature', collectionId: id, featured: true }, MAYA), 'NOT_PUBLISHED');
    s = run(s, { type: 'collection.item.add', collectionId: id, kind: 'event', targetId: 'event_open', note: 'Come along once.' }, MAYA);
    s = run(s, { type: 'collection.item.add', collectionId: id, kind: 'track', targetId: 'track_story' }, MAYA);
    assert(!view(s).collections.some(c => c.id === id), 'adding items does not publish');
    s = run(s, { type: 'collection.publish', collectionId: id, published: true }, MAYA);
    const c = view(s).collections.find(c => c.id === id)!;
    assert.equal(c.publishedAt, NOW);
    assert.deepEqual(view(s).collectionItems.filter(i => i.collectionId === id).map(i => [i.kind, itemTarget(i), i.note]), [['event', 'event_open', 'Come along once.'], ['track', 'track_story', '']]);
    // One featured collection at a time.
    s = run(s, { type: 'collection.feature', collectionId: id, featured: true }, MAYA);
    assert.deepEqual(s.collections.filter(c => c.featured).map(c => c.id), [id]);
    assert.equal(exec(s, { type: 'collection.feature', collectionId: id, featured: true }, MAYA).workspace.revision, s.revision, 'already featured');
    s = run(s, { type: 'collection.publish', collectionId: id, published: false }, MAYA);
    assert.deepEqual(s.collections.filter(c => c.featured), [], 'returning to draft takes it off Home');
    assert(!view(s).collections.some(c => c.id === id));
});

test('curators add only content they can see that is live; duplicates and limits are refused', () => {
    let { s, id } = create(createSeed());
    const add = (kind: string, targetId: string, user = DEMO_ADMIN) => exec(s, { type: 'collection.item.add', collectionId: id, kind, targetId }, user);
    throwsCode(() => add('post', 'post_private', MAYA), 'NOT_FOUND');
    throwsCode(() => add('post', 'no_such_post'), 'NOT_FOUND');
    throwsCode(() => add('lesson', 'lesson_4', 'member_idris'), 'CURATOR_REQUIRED');
    s = run(s, { type: 'post.moderate', postId: 'post_win', hidden: true }, MAYA);
    throwsCode(() => add('post', 'post_win'), 'NOT_FOUND');
    s.tracks.find(t => t.id === 'track_brand')!.published = false;
    throwsCode(() => add('track', 'track_brand'), 'NOT_FOUND');
    throwsCode(() => add('lesson', 'lesson_7'), 'NOT_FOUND');
    s.paths.find(p => p.id === 'path_offer')!.status = 'draft';
    throwsCode(() => add('path', 'path_offer'), 'NOT_FOUND');
    // The kinds must match the record: a lesson ID is not a track.
    throwsCode(() => add('track', 'lesson_4'), 'NOT_FOUND');
    s = add('post', 'post_private').workspace;
    assert.equal(add('post', 'post_private').workspace.revision, s.revision, 'already in the collection');
    for (const [kind, targetId] of [['project', 'project_common'], ['mission', 'mission_film'], ['output', 'output_notes'], ['path', 'path_film']]) s = add(kind, targetId).workspace;
    assert.equal(s.collectionItems.filter(i => i.collectionId === id).length, 5);
    for (let i = 5; i < MAX_COLLECTION_ITEMS; i++) s.collectionItems.push({ ...s.collectionItems.at(-1)!, id: `filler_${i}`, position: i + 1, kind: 'event', eventId: `e${i}`, pathId: null });
    throwsCode(() => add('track', 'track_story'), 'COLLECTION_FULL');
});

test('notes, removal and order; a moderator orders what they can see and leaves the rest in place', () => {
    let s = createSeed();
    const start = (x: Workspace, user: string) => view(x, user).collectionItems.filter(i => i.collectionId === 'collection_start').sort((a, b) => a.position - b.position).map(i => i.id);
    s = run(s, { type: 'collection.item.note', itemId: 'collected_lesson', note: 'Ten minutes, and it changes how you start.' }, MAYA);
    assert.equal(view(s).collectionItems.find(i => i.id === 'collected_lesson')!.note, 'Ten minutes, and it changes how you start.');
    throwsCode(() => exec(s, { type: 'collection.item.note', itemId: 'collected_team_notes', note: 'Edited' }, MAYA), 'NOT_FOUND');
    throwsCode(() => exec(s, { type: 'collection.item.remove', itemId: 'collected_team_notes' }, MAYA), 'NOT_FOUND');
    const mine = start(s, MAYA);
    assert.deepEqual(mine, ['collected_welcome', 'collected_path', 'collected_lesson', 'collected_output']);
    throwsCode(() => exec(s, { type: 'collection.items.reorder', collectionId: 'collection_start', expectedOrder: start(s, DEMO_ADMIN), itemIds: start(s, DEMO_ADMIN) }, MAYA), 'STALE_COLLECTION');
    throwsCode(() => exec(s, { type: 'collection.items.reorder', collectionId: 'collection_start', expectedOrder: mine, itemIds: mine.slice(1) }, MAYA), 'INVALID_ORDER');
    s = run(s, { type: 'collection.items.reorder', collectionId: 'collection_start', expectedOrder: mine, itemIds: ['collected_output', 'collected_lesson', 'collected_path', 'collected_welcome'] }, MAYA);
    assert.deepEqual(start(s, DEMO_ADMIN), ['collected_output', 'collected_lesson', 'collected_path', 'collected_team_notes', 'collected_welcome'], 'the team-only item keeps its place');
    assert.equal(new Set(s.collectionItems.filter(i => i.collectionId === 'collection_start').map(i => i.position)).size, 5, 'positions stay unique');
    s = run(s, { type: 'collection.item.remove', itemId: 'collected_path' }, MAYA);
    assert(!s.collectionItems.some(i => i.id === 'collected_path'));
    assert(s.paths.some(p => p.id === 'path_product'), 'the content itself is untouched');
    s = run(s, { type: 'collection.delete', collectionId: 'collection_start' });
    assert(!s.collections.some(c => c.id === 'collection_start'));
    assert(!s.collectionItems.some(i => i.collectionId === 'collection_start'));
    assert(s.posts.some(p => p.id === 'post_welcome'));
});

test('curation changes are audited; unchanged commands are not', () => {
    let s = createSeed();
    const audits = (x: Workspace) => x.audit.map(a => a.action);
    s = run(s, { type: 'collection.save', collectionId: 'collection_start', title: 'Start here', description: 'Where most people begin.' }, MAYA);
    assert.deepEqual(audits(s), ['collection.save']);
    assert.equal(s.collections.find(c => c.id === 'collection_start')!.updatedBy, MAYA);
    s = run(s, { type: 'collection.save', collectionId: 'collection_start', title: 'Start here', description: 'Where most people begin.' }, MAYA);
    assert.deepEqual(audits(s), ['collection.save'], 'unchanged');
    s = run(s, { type: 'collection.feature', collectionId: 'collection_start', featured: false });
    assert.deepEqual(audits(s), ['collection.save', 'collection.feature']);
    assert(s.outbox.every(o => JSON.stringify(o.payload) === JSON.stringify({ requestId: 'collections_test' })), 'no titles or notes in outbox payloads');
    assert.deepEqual(view(s, DEMO_USER).audit, [], 'members do not read the audit trail');
});

test('another community’s collections are neither visible nor reachable', () => {
    const north = createSeed('studio-north');
    north.collections.push({ ...createSeed().collections[0] });
    north.collectionItems.push({ ...createSeed().collectionItems[0] });
    assert.deepEqual(visibleWorkspace(north, ctx(DEMO_ADMIN, 'org_studio_north')).collections, []);
    throwsCode(() => exec(north, { type: 'collection.publish', collectionId: 'collection_start', published: false }), 'NOT_FOUND');
    throwsCode(() => exec(north, { type: 'collection.item.remove', itemId: 'collected_welcome' }), 'NOT_FOUND');
});

test('moderator-level curation does not rely on administration; reaching a private space does', () => {
    const s = createSeed();
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'collection.save', title: 'From the owner' }), false);
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'collection.item.add', collectionId: 'collection_start', kind: 'post', targetId: 'post_win' }), false);
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'collection.item.remove', itemId: 'collected_team_notes' }), false, 'Amina is a member of the private studio');
    s.spaceMembers = s.spaceMembers.filter(m => m.spaceId !== 'space_studio');
    assert.equal(reliesOnAdministration(s, ctx(DEMO_ADMIN), { type: 'collection.item.remove', itemId: 'collected_team_notes' }), true, 'only her administrator role reaches it now');
});

test('a deleted account’s curation stays, as Former member; bookmarks stay private and never count', () => {
    let s = createSeed();
    s = run(s, { type: 'post.bookmark', postId: 'post_welcome' }, DEMO_USER);
    assert.equal(view(s, DEMO_ADMIN).bookmarks.length, 0, 'another person’s saved posts are never visible');
    assert.equal(view(s, DEMO_USER).bookmarks.length, 1);
    const erased = eraseFromCommunity(s, MAYA, NOW).workspace;
    assert.equal(erased.collections.find(c => c.id === 'collection_feedback')!.createdBy, MAYA);
    assert.equal(erased.members.find(m => m.userId === MAYA)!.name, 'Former member');
    assert.equal(erased.collectionItems.length, s.collectionItems.length);
});
