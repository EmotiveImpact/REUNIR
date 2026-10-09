import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { chapterTime, chaptersText, lessonResourcesInput, parseChapters, type LessonResourceType } from '../packages/contracts/src/lesson-resources';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { beginResourceUpload, completeResourceUpload } from '../packages/domain/src/resources';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';

// Alpha 57: chapters on uploaded lesson videos (decision 057).
const ORG = 'org_code_black', NOW = '2026-10-09T12:00:00.000Z';
let seq = 0;
const ctx = (userId = DEMO_ADMIN) => ({ organizationId: ORG, userId, requestId: 'chapters_test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_ADMIN) => applyCommand(s, ctx(user), cmd, () => NOW, () => `chap_${++seq}`).workspace;
const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap(p => typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
const webm = bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0x82, 0x84], 'webm', [0x42, 0x87, 0x81, 0x04]);
const pdf = new TextEncoder().encode('%PDF-1.4\n% fictional\n');
function stored(s: Workspace, name: string, contentType: LessonResourceType, data: Uint8Array) {
    const id = `upload_${++seq}`;
    const begun = beginResourceUpload(s, ctx(), { purpose: 'lesson_resource', trackId: 'track_product', name, contentType, sizeBytes: data.length }, { id, objectKey: `organisations/${ORG}/lesson-resources/track_product/${id}` }, NOW, () => `chap_${++seq}`);
    const done = completeResourceUpload(begun.workspace, ctx(), id, { sizeBytes: data.length, contentType, generation: '1', signatureMatches: true }, NOW, () => `chap_${++seq}`);
    assert.equal(done.outcome, 'ready');
    return { s: done.workspace, id };
}

test('chapter times read and write as m:ss or h:mm:ss', () => {
    assert.deepEqual([chapterTime(0), chapterTime(75), chapterTime(3600), chapterTime(3725)], ['0:00', '1:15', '1:00:00', '1:02:05']);
    const read = parseChapters('0:00 Welcome\n\n  1:30   Setting up \n1:02:05 Wrapping up');
    assert.deepEqual(read, { chapters: [{ start: 0, title: 'Welcome' }, { start: 90, title: 'Setting up' }, { start: 3725, title: 'Wrapping up' }], problem: null });
    assert.equal(parseChapters(chaptersText(read.chapters)).chapters.length, 3, 'the text round-trips');
    assert.deepEqual(parseChapters(''), { chapters: [], problem: null }, 'chapters are optional');
});

test('chapters must start at 0:00, run in order, have titles and stay within limits', () => {
    assert.equal(parseChapters('0:30 Late start').problem, 'Start the first chapter at 0:00.');
    assert.equal(parseChapters('0:00 A\n0:40 B\n0:20 C').problem, 'List chapters in order, each starting after the one before.');
    assert.equal(parseChapters('0:00 A\n0:00 B').problem, 'List chapters in order, each starting after the one before.');
    assert.equal(parseChapters('0:00 A\n1:75 B').problem, 'Line 2: write a start time then a title, like 1:30 Setting up.');
    assert.equal(parseChapters('0:00 A\nhalf past B').problem, 'Line 2: write a start time then a title, like 1:30 Setting up.');
    assert.equal(parseChapters(`0:00 ${'x'.repeat(81)}`).problem, 'Keep chapter titles under 80 characters.');
    assert.equal(parseChapters(Array.from({ length: 21 }, (_, i) => `${i}:00 Part ${i}`).join('\n')).problem, 'Use up to 20 chapters.');
    const entry = (chapters: unknown) => [{ id: 'r', fileId: 'f', name: 'Clip', description: '', chapters }];
    assert.equal(lessonResourcesInput.safeParse(entry([{ start: 0, title: 'Welcome' }])).success, true);
    assert.equal(lessonResourcesInput.safeParse(entry([{ start: 5, title: 'Welcome' }])).success, false);
    assert.equal(lessonResourcesInput.safeParse(entry([{ start: 0, title: 'Bell\u0007' }])).success, false, 'plain text only');
    assert.equal(lessonResourcesInput.safeParse(entry([{ start: 0, title: 'Welcome', extra: 1 }])).success, false, 'no extra fields');
});

test('a video carries its chapters from draft to learners; other files cannot have chapters', () => {
    let s = run(createSeed(), { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' });
    const video = stored(s, 'Walkthrough.webm', 'video/webm', webm); s = video.s;
    const notes = stored(s, 'Notes.pdf', 'application/pdf', pdf); s = notes.s;
    const draft = () => s.lessonDrafts.at(-1)!;
    const save = (resources: unknown) => run(s, { type: 'lesson.draft.save', draftId: draft().id, expectedVersion: draft().version, ...lessonContent(draft()), resources });
    const chapters = [{ start: 0, title: 'Welcome' }, { start: 20, title: 'Setting up' }];
    assert.throws(() => save([{ id: 'r_notes', fileId: notes.id, name: 'Notes', description: '', chapters }]), (e: { code?: string }) => e.code === 'CHAPTERS_NEED_VIDEO');
    s = save([{ id: 'r_video', fileId: video.id, name: 'Walkthrough', description: '', chapters: [{ start: 0, title: '  Welcome ' }, chapters[1]] }]);
    assert.deepEqual(draft().resources![0].chapters, chapters, 'titles are trimmed');
    s = run(s, { type: 'lesson.draft.publish', draftId: draft().id, expectedVersion: draft().version });
    const seen = visibleWorkspace(s, { ...ctx(DEMO_USER) }).lessons.find(l => l.id === 'lesson_4')!.resources!;
    assert.deepEqual(seen.find(r => r.fileId === video.id)!.chapters, chapters, 'learners receive the chapters');
    // Clearing the chapters stores none at all.
    s = run(s, { type: 'lesson.draft.create', trackId: 'track_product', lessonId: 'lesson_4' });
    s = save([{ id: 'r_video', fileId: video.id, name: 'Walkthrough', description: '', chapters: [] }]);
    assert.equal('chapters' in draft().resources![0], false);
});
