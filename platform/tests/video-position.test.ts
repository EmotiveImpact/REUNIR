import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clock, rememberPosition, savedPosition, type PositionStore } from '../apps/web/src/lib/video-position';

// Alpha 54: a lesson video picks up where this browser stopped. Nothing is sent anywhere.
const memory = (): PositionStore & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } }; };

test('a place in the middle of a video is remembered in whole seconds and picked up', () => {
    const store = memory();
    rememberPosition(store, 'code-black.lesson_4.resource_video', 192.7);
    assert.deepEqual([...store.data], [['reunir.resume.code-black.lesson_4.resource_video', '192']]);
    assert.equal(savedPosition(store, 'code-black.lesson_4.resource_video', 600), 192);
    assert.equal(clock(192), '3:12');
    assert.equal(savedPosition(store, 'code-black.lesson_5.resource_video', 600), 0, 'each lesson keeps its own place');
});

test('the very start and end are not picked up, and the place is forgotten on request', () => {
    const store = memory();
    rememberPosition(store, 'k', 10); assert.equal(savedPosition(store, 'k', 600), 0);
    rememberPosition(store, 'k', 590); assert.equal(savedPosition(store, 'k', 600), 0);
    store.setItem('reunir.resume.k', 'not a number'); assert.equal(savedPosition(store, 'k', 600), 0);
    rememberPosition(store, 'k', 300); rememberPosition(store, 'k', null);
    assert.equal(store.data.size, 0);
});

test('storage that is missing or refused means starting at the beginning, never an error', () => {
    const refusing: PositionStore = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('SecurityError'); } };
    assert.doesNotThrow(() => rememberPosition(refusing, 'k', 300));
    assert.equal(savedPosition(refusing, 'k', 600), 0);
    assert.equal(savedPosition(null, 'k', 600), 0);
    assert.doesNotThrow(() => rememberPosition(null, 'k', null));
});
