import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USAGE_AREAS, USAGE_KEEP_DAYS, USAGE_THRESHOLD, USAGE_WEEKS, usageArea, usageReport, usageVisit, weekStart } from '../packages/contracts/src/usage';
import { RETENTION_DAYS, RETENTION_POLICY } from '../packages/contracts/src/retention';

// Alpha 60: usage stats that respect privacy (decision 060).
test('each page belongs to one counted part of the community, and personal or management pages are not counted', () => {
    const cases: [string, string | null][] = [
        ['/', 'home'], ['/discussions', 'discussions'], ['/spaces/space_build', 'discussions'], ['/post/post_1', 'discussions'], ['/community', 'discussions'],
        ['/paths/path_film', 'learning'], ['/learn/track_product/lesson_1', 'learning'], ['/missions/mission_film', 'missions'],
        ['/projects/project_common/work', 'projects'], ['/events/e1', 'events'], ['/members/member_nia', 'people'], ['/messages/t1', 'messages'],
        ['/knowledge', 'knowledge'], ['/collections/c1', 'knowledge'], ['/outputs', 'outputs'], ['/profile', 'profile'],
        ['/notifications', 'notifications'], ['/saved', 'saved'], ['/projects/', 'projects'], ['/outputs?x=1', 'outputs'],
        ['/account', null], ['/admin', null], ['/admin/usage', null], ['/access', null], ['/settings', null], ['/operations', null],
        ['/appeals', null], ['/teaching', null], ['/learn/track_product/studio', null], ['/learn', 'learning'], ['/nowhere', null],
    ];
    for (const [path, area] of cases) assert.equal(usageArea(path), area, path);
});

test('a visit carries only a known part of the community', () => {
    for (const area of USAGE_AREAS) assert.equal(usageVisit.safeParse({ area }).success, true);
    assert.equal(usageVisit.safeParse({ area: 'admin' }).success, false);
    assert.equal(usageVisit.safeParse({ area: 'home', userId: 'member_alex' }).success, false, 'nothing about the person is accepted');
    assert.equal(usageVisit.safeParse({ area: 'home', path: '/members/member_nia' }).success, false, 'nor the page itself');
});

test('weeks start on Monday, in UTC', () => {
    assert.equal(weekStart('2026-10-09'), '2026-10-05');
    assert.equal(weekStart('2026-10-05'), '2026-10-05');
    assert.equal(weekStart('2026-10-04'), '2026-09-28');
    assert.equal(weekStart(new Date('2026-10-11T23:59:00Z')), '2026-10-05');
});

test('the report adds days into weeks and never shows a count below the threshold', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    const r = usageReport([
        { day: '2026-10-05', area: 'projects', count: 3 }, { day: '2026-10-08', area: 'projects', count: 4 },
        { day: '2026-10-06', area: 'messages', count: 2 },
        { day: '2026-09-29', area: 'home', count: USAGE_THRESHOLD },
        { day: '2026-08-01', area: 'home', count: 50 },
        { day: '2026-10-07', area: 'admin', count: 9 },
    ], now);
    assert.equal(r.weeks.length, USAGE_WEEKS);
    assert.deepEqual([r.weeks[0], r.weeks.at(-1)], ['2026-08-17', '2026-10-05']);
    const row = (area: string) => r.areas.find(a => a.area === area)!.counts;
    assert.equal(row('projects').at(-1), 7, 'days in one week add up');
    assert.equal(row('messages').at(-1), null, 'two is shown only as fewer than the threshold');
    assert.equal(row('home').at(-2), USAGE_THRESHOLD);
    assert.equal(row('home').reduce<number>((a, n) => a + (n ?? 0), 0), USAGE_THRESHOLD, 'older weeks fall outside the report');
    assert.equal(row('events').every(n => n === 0), true);
    assert.equal(r.areas.some(a => (a.area as string) === 'admin'), false, 'unknown parts are ignored');
    assert.deepEqual(r.areas.map(a => a.area), [...USAGE_AREAS]);
    assert.deepEqual(Object.keys(r).sort(), ['areas', 'keptDays', 'threshold', 'weeks']);
});

test('counts are kept as long as the retention job says, and Your account says so', () => {
    assert.equal(USAGE_KEEP_DAYS, RETENTION_DAYS.usageCounts);
    assert.ok(RETENTION_POLICY.some(p => /usage/i.test(p.what) && p.kept.includes(String(USAGE_KEEP_DAYS))));
});
