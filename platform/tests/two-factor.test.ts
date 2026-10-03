import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { reliesOnAdministration } from '../packages/domain/src/administration';
import { adminTwoFactorSetting, isAppCode, normaliseAppCode, setupKey } from '../packages/contracts/src/two-factor';

const state = createSeed(), ctx = (userId: string) => ({ organizationId: state.organisation.id, userId, requestId: 'two-step' });
const space = { type: 'space.create', name: 'A new space', description: 'Checking which commands need an administrator.', visibility: 'members', kind: 'discussion' };

test('a command relies on administration only when a moderator could not do it', () => {
    assert.equal(reliesOnAdministration(state, ctx(DEMO_ADMIN), space), true);
    assert.equal(reliesOnAdministration(state, ctx(DEMO_ADMIN), { type: 'member.role', memberId: 'member_sofia', role: 'admin' }), true);
    assert.equal(reliesOnAdministration(state, ctx(DEMO_ADMIN), { type: 'post.create', spaceId: 'space_general', kind: 'update', title: '', body: 'An ordinary post.' }), false);
    assert.equal(reliesOnAdministration(state, ctx(DEMO_ADMIN), { type: 'post.moderate', postId: 'post_common', hidden: true }), false, 'moderators moderate');
    assert.equal(reliesOnAdministration(state, ctx(DEMO_USER), space), false, 'a member has no administration to rely on');
});

test('the check works on a copy and leaves the workspace as it was', () => {
    const before = JSON.stringify(state);
    reliesOnAdministration(state, ctx(DEMO_ADMIN), space);
    assert.equal(JSON.stringify(state), before);
});

test('setting, codes and setup key', () => {
    assert.equal(adminTwoFactorSetting({}), 'optional');
    assert.equal(adminTwoFactorSetting({ NODE_ENV: 'production' }), 'required');
    assert.equal(adminTwoFactorSetting({ NODE_ENV: 'production', ADMIN_TWO_FACTOR: ' optional ' }), 'optional');
    assert.equal(adminTwoFactorSetting({ ADMIN_TWO_FACTOR: 'sometimes' }), null);
    assert.equal(normaliseAppCode('123 456'), '123456');
    assert.equal(isAppCode('123 456'), true);
    assert.equal(isAppCode('12345'), false);
    assert.equal(isAppCode('abcdef'), false);
    assert.equal(setupKey('otpauth://totp/REUNIR:a%40example.test?secret=ABCDEFGHIJKLMNOPQ&issuer=REUNIR'), 'ABCD EFGH IJKL MNOP Q');
    assert.equal(setupKey('not a link'), '');
});
