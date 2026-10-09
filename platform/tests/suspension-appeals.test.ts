import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { appealSuspension, suspensionStanding, withdrawSuspensionAppeal } from '../packages/domain/src/suspension-appeals';
import { eraseFromCommunity } from '../packages/domain/src/account-deletion';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 58: appeals against a suspension (decision 058).
const ORG = 'org_code_black', IDRIS = 'member_idris', SOFIA = 'member_sofia', NOW = '2026-10-09T12:00:00.000Z', LATER = '2026-10-10T12:00:00.000Z';
let seq = 0;
const ctx = (userId: string) => ({ organizationId: ORG, userId, requestId: 'suspension_test' });
const ids = () => `susp_${++seq}`;
const run = (s: Workspace, user: string, cmd: unknown, at = NOW) => applyCommand(s, ctx(user), cmd, () => at, ids);
const memberId = (s: Workspace, userId: string) => s.members.find(m => m.userId === userId)!.id;
const suspend = (s: Workspace, by: string, userId: string, at = NOW) => run(s, by, { type: 'member.status', memberId: memberId(s, userId), status: 'suspended', reason: 'Repeated off-topic selling.' }, at).workspace;
const restore = (s: Workspace, by: string, userId: string) => run(s, by, { type: 'member.status', memberId: memberId(s, userId), status: 'active', reason: 'Spoke with them.' }).workspace;
const appeal = (s: Workspace, userId = DEMO_USER, reason = 'I sold one thing once, and have stopped.') => appealSuspension(s, ctx(userId), reason, NOW, ids);
const decide = (s: Workspace, by: string, appealId: string, decision: 'upheld' | 'reversed', response = 'We looked again.') => run(s, by, { type: 'suspension.appeal.decide', appealId, decision, response });
const alex = (s: Workspace) => s.members.find(m => m.userId === DEMO_USER)!;
/** Idris made an administrator by the owner, so the community has two people who can suspend and decide. */
const twoAdmins = () => run(createSeed(), DEMO_ADMIN, { type: 'member.role', memberId: memberId(createSeed(), IDRIS), role: 'admin' }).workspace;

test('a suspension records who made it and when; restoring clears it', () => {
    let s = suspend(twoAdmins(), IDRIS, DEMO_USER);
    assert.deepEqual([alex(s).status, alex(s).suspendedBy, alex(s).suspendedAt], ['suspended', IDRIS, NOW]);
    s = restore(s, DEMO_ADMIN, DEMO_USER);
    assert.deepEqual([alex(s).status, alex(s).suspendedBy, alex(s).suspendedAt], ['active', null, null]);
});

test('only a suspended member appeals, once per suspension, and the owner who did not suspend them is told', () => {
    let s = twoAdmins();
    assert.throws(() => appeal(s), (e: { code?: string }) => e.code === 'NOT_FOUND', 'an active member learns nothing from this path');
    s = suspend(s, IDRIS, DEMO_USER);
    const sent = appeal(s);
    assert.match(sent.message, /did not suspend you will decide/);
    s = sent.workspace;
    const a = s.suspensionAppeals[0];
    assert.deepEqual([a.appellantId, a.suspendedBy, a.suspendedAt, a.status], [DEMO_USER, IDRIS, NOW, 'pending']);
    const notices = s.notifications.filter(n => n.title === 'An access appeal to decide');
    assert.deepEqual(notices.map(n => [n.userId, n.href]), [[DEMO_ADMIN, '/appeals']], 'the suspender is not asked to judge their own decision');
    assert.throws(() => appeal(s), (e: { code?: string }) => e.code === 'APPEAL_OPEN');
    assert.equal(s.audit.at(-1)!.action, 'suspension.appeal');
    // Withdrawing frees the way to appeal again, while the suspension stands.
    s = withdrawSuspensionAppeal(s, ctx(DEMO_USER), a.id, NOW, ids).workspace;
    assert.deepEqual([s.suspensionAppeals[0].status, s.suspensionAppeals[0].decidedBy], ['withdrawn', null]);
    assert.equal(suspensionStanding(s, DEMO_USER)!.canAppeal, true);
    assert.throws(() => withdrawSuspensionAppeal(s, ctx(SOFIA), a.id, NOW, ids), (e: { code?: string }) => e.code === 'NOT_FOUND');
    s = appeal(s).workspace;
    // Upholding keeps access suspended and ends appeals about this suspension.
    s = decide(s, DEMO_ADMIN, s.suspensionAppeals.at(-1)!.id, 'upheld').workspace;
    assert.equal(alex(s).status, 'suspended');
    assert.throws(() => appeal(s), (e: { code?: string }) => e.code === 'APPEAL_DECIDED');
    assert.equal(suspensionStanding(s, DEMO_USER)!.canAppeal, false);
    assert.equal(s.notifications.at(-1)!.title, 'Your access stays suspended');
    // A later suspension, after access came back, can be appealed afresh.
    s = suspend(restore(s, DEMO_ADMIN, DEMO_USER), IDRIS, DEMO_USER, LATER);
    assert.equal(suspensionStanding(s, DEMO_USER)!.canAppeal, true);
    assert.equal(appeal(s).workspace.suspensionAppeals.filter(x => x.status === 'pending').length, 1);
});

test('an independent owner or administrator reverses, which restores access at once', () => {
    let s = appeal(suspend(twoAdmins(), IDRIS, DEMO_USER)).workspace;
    const id = s.suspensionAppeals[0].id;
    assert.throws(() => decide(s, IDRIS, id, 'reversed'), (e: { code?: string }) => e.code === 'SUSPENDER_CANNOT_DECIDE');
    assert.throws(() => decide(s, 'member_maya', id, 'reversed'), (e: { code?: string }) => e.code === 'NOT_FOUND', 'a moderator does not know the appeal exists');
    assert.throws(() => run(s, DEMO_ADMIN, { type: 'suspension.appeal.decide', appealId: id, decision: 'reversed', response: ' ' }));
    const r = decide(s, DEMO_ADMIN, id, 'reversed', 'You are welcome back.');
    s = r.workspace;
    assert.match(r.message, /restored/);
    assert.deepEqual([alex(s).status, alex(s).suspendedBy, alex(s).suspendedAt], ['active', null, null]);
    assert.deepEqual([s.suspensionAppeals[0].status, s.suspensionAppeals[0].decidedBy, s.suspensionAppeals[0].response], ['reversed', DEMO_ADMIN, 'You are welcome back.']);
    assert.deepEqual(s.audit.slice(-2).map(x => x.action), ['suspension.appeal.reversed', 'member.active']);
    assert.throws(() => decide(s, DEMO_ADMIN, id, 'upheld'), (e: { code?: string }) => e.code === 'NOT_PENDING');
    // Back in the community, they see their own appeal and its answer; other members see none.
    const own = visibleWorkspace(s, ctx(DEMO_USER));
    assert.deepEqual(own.suspensionAppeals.map(a => a.id), [id]);
    assert.equal(own.notifications.some(n => n.title === 'Your access is restored' && n.body === 'You are welcome back.'), true);
    assert.equal(visibleWorkspace(s, ctx(SOFIA)).suspensionAppeals.length, 0);
    assert.equal(visibleWorkspace(s, ctx(DEMO_ADMIN)).suspensionAppeals.length, 1);
});

test('restoring access another way closes the open appeal; an appeal outlives nothing it challenged', () => {
    let s = appeal(suspend(twoAdmins(), IDRIS, DEMO_USER)).workspace;
    const id = s.suspensionAppeals[0].id;
    s = restore(s, IDRIS, DEMO_USER);
    assert.deepEqual([s.suspensionAppeals[0].status, s.suspensionAppeals[0].decidedBy, s.suspensionAppeals[0].decidedAt], ['closed', null, NOW]);
    assert.equal(s.audit.at(-1)!.action, 'suspension.appeal.closed');
    assert.throws(() => decide(s, DEMO_ADMIN, id, 'reversed'), (e: { code?: string }) => e.code === 'NOT_PENDING');
});

test('when the only owner suspended someone, nobody can decide yet, and the person is told so', () => {
    let s = suspend(createSeed(), DEMO_ADMIN, DEMO_USER);
    const standing = suspensionStanding(s, DEMO_USER)!;
    assert.deepEqual([standing.slug, standing.name, standing.suspendedAt, standing.decidable, standing.canAppeal], ['code-black', 'Code Black', NOW, false, true]);
    const sent = appeal(s);
    assert.match(sent.message, /Nobody can decide it yet/);
    s = sent.workspace;
    assert.equal(s.notifications.filter(n => n.title === 'An access appeal to decide').length, 0);
    assert.throws(() => decide(s, DEMO_ADMIN, s.suspensionAppeals[0].id, 'reversed'), (e: { code?: string }) => e.code === 'SUSPENDER_CANNOT_DECIDE');
    // What the person sees carries no names: they no longer see the community's people.
    const seen = suspensionStanding(s, DEMO_USER)!.appeals[0] as unknown as Record<string, unknown>;
    assert.deepEqual(Object.keys(seen).sort(), ['createdAt', 'current', 'decidedAt', 'id', 'reason', 'response', 'status']);
    assert.equal(suspensionStanding(s, SOFIA), null, 'someone not suspended has no standing to see');
});

test('deleting the account removes the person’s own appeals and the record of who suspended them', () => {
    const s = appeal(suspend(twoAdmins(), IDRIS, DEMO_USER)).workspace;
    const erased = eraseFromCommunity(s, DEMO_USER, NOW, ids);
    assert.equal(erased.removed.suspensionAppeals, 1);
    assert.equal(erased.workspace.suspensionAppeals.length, 0);
    assert.deepEqual([alex(erased.workspace).status, alex(erased.workspace).suspendedBy, alex(erased.workspace).suspendedAt], ['left', null, null]);
});
