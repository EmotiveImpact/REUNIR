import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeed } from '../packages/domain/src/seed';
import { freshenDemoDates, DEMO_SEED_DAY } from '../packages/domain/src/demo-calendar';

const DAY = 86_400_000;

test('a demo opened on its own day is unchanged', () => {
    const seed = createSeed();
    assert.deepEqual(freshenDemoDates(seed, DEMO_SEED_DAY + 9 * 3_600_000), seed);
});

test('a demo opened later moves every date forward by whole days and keeps the times of day', () => {
    const seed = createSeed();
    const later = freshenDemoDates(seed, DEMO_SEED_DAY + 18 * DAY + 3_600_000);
    const before = seed.events.map(e => e.startsAt), after = later.events.map(e => e.startsAt);
    assert.deepEqual(after.map((s, i) => Date.parse(s) - Date.parse(before[i])), before.map(() => 18 * DAY));
    assert.ok(after.every(s => Date.parse(s) > DEMO_SEED_DAY + 18 * DAY), 'the seed events are still upcoming');
    assert.equal(later.members.length, seed.members.length);
    assert.equal(later.organisation.name, seed.organisation.name);
});

test('date-only values move too, and the original seed is not modified', () => {
    const value = { due: '2026-10-02', note: '2026 plans', when: '2026-09-24T08:00:00.000Z' };
    assert.deepEqual(freshenDemoDates(value, DEMO_SEED_DAY + 2 * DAY), { due: '2026-10-04', note: '2026 plans', when: '2026-09-26T08:00:00.000Z' });
    assert.equal(value.due, '2026-10-02');
});
