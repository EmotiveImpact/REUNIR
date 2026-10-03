import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { confirmsCommunityName, ownershipTransferRequest } from '../packages/contracts/src/ownership';
import { applyCommand } from '../packages/domain/src/engine';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { ownershipCandidates, transferOwnership } from '../packages/domain/src/ownership';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z', MAYA = 'member_maya', SOFIA = 'member_sofia';
let seq = 0;
const ids = () => `ownership_${++seq}`;
const ctx = (userId = DEMO_ADMIN, organizationId = ORG) => ({ organizationId, userId, requestId: 'ownership-test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => applyCommand(s, ctx(user), cmd, () => NOW, ids).workspace;
const promote = (s: Workspace, memberId = MAYA) => run(s, { type: 'member.role', memberId, role: 'admin' });
const hand = (s: Workspace, memberId = MAYA, user = DEMO_ADMIN, typed = 'Code Black') => transferOwnership(s, ctx(user), memberId, typed, NOW, ids);
const role = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId)!.role;
const refused = (fn: () => unknown, code: string) => assert.throws(fn, (e: { code?: string }) => e.code === code);

test('the request needs a member, a password and the typed name, and nothing else', () => {
    assert(confirmsCommunityName('  code black ', 'Code Black') && !confirmsCommunityName('Code', 'Code Black') && !confirmsCommunityName('Code Black!', 'Code Black'));
    assert.equal(ownershipTransferRequest.safeParse({ memberId: MAYA, password: 'x', confirmation: 'Code Black' }).success, true);
    assert.equal(ownershipTransferRequest.safeParse({ memberId: MAYA, password: '', confirmation: 'Code Black' }).success, false);
    assert.equal(ownershipTransferRequest.safeParse({ memberId: MAYA, password: 'x', confirmation: '' }).success, false);
    assert.equal(ownershipTransferRequest.safeParse({ memberId: MAYA, password: 'x', confirmation: 'Code Black', role: 'owner' }).success, false);
});

test('the owner hands the community to an administrator and stays as an administrator', () => {
    const before = promote(createSeed());
    assert.deepEqual(ownershipCandidates(before, ctx()).map(m => m.userId), [MAYA]);
    const t = hand(before);
    const after = t.workspace;
    assert.equal(role(after, MAYA), 'owner');
    assert.equal(role(after, DEMO_ADMIN), 'admin');
    assert.equal(after.members.filter(m => m.role === 'owner').length, 1, 'a community always has exactly one owner');
    assert.equal(after.revision, before.revision + 1);
    assert.equal(t.message, 'Maya Bennett now owns Code Black. You are an administrator.');
    const entry = after.audit.at(-1)!;
    assert.deepEqual([entry.action, entry.actorId, entry.objectId, entry.metadata.previousOwner], ['member.owner.transferred', DEMO_ADMIN, MAYA, DEMO_ADMIN]);
    const notice = after.notifications.at(-1)!;
    assert.deepEqual([notice.userId, notice.title], [MAYA, 'You now own Code Black']);
    assert.equal(after.outbox.at(-1)!.type, 'member.owner.transfer');
    assert.equal(role(before, DEMO_ADMIN), 'owner', 'the input is not changed');
});

test('afterwards the new owner assigns roles and the previous owner no longer can', () => {
    const after = hand(promote(createSeed())).workspace;
    refused(() => run(after, { type: 'member.role', memberId: SOFIA, role: 'moderator' }), 'OWNER_REQUIRED');
    assert.equal(role(run(after, { type: 'member.role', memberId: DEMO_ADMIN, role: 'member' }, MAYA), DEMO_ADMIN), 'member');
    refused(() => hand(after, DEMO_ADMIN), 'OWNER_REQUIRED');
    assert.equal(role(hand(after, DEMO_ADMIN, MAYA).workspace, DEMO_ADMIN), 'owner', 'the new owner can hand it back');
});

test('only the owner hands over, only to an active administrator, and only with the name typed', () => {
    const s = promote(promote(createSeed()), SOFIA);
    refused(() => hand(s, SOFIA, MAYA), 'OWNER_REQUIRED');
    refused(() => hand(s, MAYA, DEMO_USER), 'OWNER_REQUIRED');
    refused(() => hand(s, DEMO_USER), 'ADMIN_REQUIRED');
    refused(() => hand(s, 'member_idris'), 'ADMIN_REQUIRED');
    refused(() => hand(s, DEMO_ADMIN), 'ALREADY_OWNER');
    refused(() => hand(s, 'member_nobody'), 'NOT_FOUND');
    refused(() => hand(s, MAYA, DEMO_ADMIN, 'Studio North'), 'CONFIRMATION_REQUIRED');
    refused(() => hand(s, MAYA, DEMO_ADMIN, ''), 'CONFIRMATION_REQUIRED');
    const suspended = structuredClone(s); suspended.members.find(m => m.userId === MAYA)!.status = 'suspended';
    refused(() => hand(suspended, MAYA), 'INACTIVE_MEMBER');
    assert.deepEqual(ownershipCandidates(suspended, ctx()).map(m => m.userId), [SOFIA]);
    const former = eraseFromCommunity(s, MAYA, NOW, ids).workspace;
    refused(() => hand(former, MAYA), 'NOT_FOUND');
    const inactiveOwner = structuredClone(s); inactiveOwner.members.find(m => m.userId === DEMO_ADMIN)!.status = 'suspended';
    refused(() => hand(inactiveOwner, MAYA), 'FORBIDDEN');
});

test('another community’s members and contexts are never reachable', () => {
    const north = createSeed('studio-north');
    refused(() => transferOwnership(promote(createSeed()), ctx(DEMO_ADMIN, 'org_studio_north'), MAYA, 'Code Black', NOW, ids), 'NOT_FOUND');
    const foreign = structuredClone(promote(createSeed()));
    foreign.members.push({ ...north.members.find(m => m.userId === MAYA)!, id: 'north_maya', organizationId: 'org_studio_north' });
    refused(() => hand(foreign, 'north_maya'), 'NOT_FOUND');
});

test('a community that somehow has two owners is not changed', () => {
    const s = promote(createSeed()); s.members.find(m => m.userId === SOFIA)!.role = 'owner';
    refused(() => hand(s), 'OWNERSHIP_CONFLICT');
});

test('the role command still cannot make or unmake an owner', () => {
    const s = promote(createSeed());
    assert.throws(() => run(s, { type: 'member.role', memberId: MAYA, role: 'owner' }));
    refused(() => run(s, { type: 'member.role', memberId: DEMO_ADMIN, role: 'admin' }), 'PROTECTED_MEMBER');
});

test('once the owner has handed it over, their own deletion no longer refuses them', () => {
    const s = promote(createSeed());
    refused(() => eraseFromCommunity(s, DEMO_ADMIN, NOW, ids), 'OWNER_CANNOT_DELETE');
    const after = hand(s).workspace;
    const erased = eraseFromCommunity(after, DEMO_ADMIN, NOW, ids).workspace;
    assert.equal(erased.members.find(m => m.userId === DEMO_ADMIN)!.status, 'left');
    assert.equal(role(erased, MAYA), 'owner');
});
