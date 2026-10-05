import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LessonDocument } from '../packages/contracts/src/lesson-document';
import type { LessonResource } from '../packages/contracts/src/lesson-resources';
import { createSeed } from '../packages/domain/src/seed';
import { featuredVideo, LessonBody, LessonStage } from '../apps/web/src/components/lesson-content';

const embed = { type: 'video', attrs: { src: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', title: 'Open film' } };
const doc: LessonDocument = { type: 'doc', content: [embed, { type: 'paragraph', content: [{ type: 'text', text: 'Read this.' }] }] };
const file = { id: 'res_video', name: 'Walkthrough', contentType: 'video/mp4', bytes: 2048 } as unknown as LessonResource;
const pdf = { id: 'res_pdf', name: 'Worksheet', contentType: 'application/pdf', bytes: 1024 } as unknown as LessonResource;
const noop = async () => undefined, no = async () => false;

test('a lesson leads with its uploaded video first, otherwise its first embedded video, otherwise nothing', () => {
    assert.deepEqual(featuredVideo({ resources: [pdf, file], richBody: doc }), { kind: 'file', resource: file });
    assert.equal(featuredVideo({ resources: [pdf], richBody: doc })?.kind, 'embed');
    assert.equal(featuredVideo({ resources: null, richBody: null }), null);
    assert.equal(featuredVideo({ resources: [pdf], richBody: { type: 'doc', content: [{ type: 'paragraph' }] } }), null);
});

test('the stage keeps embeds behind consent and never autoloads an uploaded file', () => {
    const e = renderToStaticMarkup(createElement(LessonStage, { video: { kind: 'embed', node: embed }, onPlay: noop, onDownload: no }));
    assert(e.includes('lesson-stage')); assert(!e.includes('<iframe')); assert(e.includes('Load video'));
    const f = renderToStaticMarkup(createElement(LessonStage, { video: { kind: 'file', resource: file }, onPlay: noop, onDownload: no }));
    assert(f.includes('Play Walkthrough')); assert(!f.includes('<video')); assert(f.includes('Download'));
});

test('the body skips the video already on the stage and turns practice prompts into callouts', () => {
    const body = renderToStaticMarkup(createElement(LessonBody, { body: '', richBody: doc, skip: embed }));
    assert(!body.includes('Load video')); assert(body.includes('Read this.'));
    const plain = renderToStaticMarkup(createElement(LessonBody, { body: 'Intro.\n\nTry this: write one line.\n\nYour task\nName one person.' }));
    assert.equal(plain.match(/class="lesson-try"/g)?.length, 2);
    assert(plain.includes('<strong>Try this</strong><p>write one line.</p>')); assert(plain.includes('<strong>Your task</strong><p>Name one person.</p>'));
});

test('the demo storytelling lesson opens with a licensed open film', () => {
    const lesson = createSeed().lessons.find(l => l.id === 'lesson_1')!;
    const v = featuredVideo(lesson);
    assert.equal(v?.kind, 'embed'); assert.match(String(v?.kind === 'embed' && v.node.attrs?.title), /CC BY 3\.0/);
});
