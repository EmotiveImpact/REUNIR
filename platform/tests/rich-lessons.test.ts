import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { commandSchema, type Workspace } from '../packages/contracts/src/index';
import { isLessonDocument, lessonDocumentText, lessonVideoUrl, plainLessonDocument, type LessonDocument } from '../packages/contracts/src/lesson-document';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { lessonContent } from '../packages/domain/src/authoring';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { LessonBody } from '../apps/web/src/components/lesson-content';
const doc:LessonDocument={type:'doc',content:[
    {type:'heading',attrs:{level:2},content:[{type:'text',text:'Observe first'}]},
    {type:'paragraph',content:[{type:'text',text:'PRIVATE_RICH_DRAFT',marks:[{type:'bold'},{type:'link',attrs:{href:'https://example.com',target:'_blank',rel:'noopener noreferrer nofollow',class:null}}]}]},
    {type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'One useful action'}]}]}]},
    {type:'image',attrs:{src:'https://images.example.com/photo.jpg',alt:'A creative team'}},
    {type:'video',attrs:{src:'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',title:'Film workshop'}},
]};
let id=0;
const ctx=(userId=DEMO_ADMIN)=>({userId,organizationId:'org_code_black',requestId:'rich_lesson_test'});
const run=(s:Workspace,c:unknown,user=DEMO_ADMIN)=>applyCommand(s,ctx(user),c,()=>new Date().toISOString(),()=>`rich_${++id}`).workspace;
const draft=(s:Workspace)=>s.lessonDrafts[0];
const open=()=>run(createSeed(),{type:'lesson.draft.create',trackId:'track_product',lessonId:'lesson_4'});
const save=(s:Workspace,richBody:LessonDocument|null=doc)=>run(s,{type:'lesson.draft.save',draftId:draft(s).id,expectedVersion:draft(s).version,...lessonContent(draft(s)),body:'Untrusted alternate body',richBody});
const publish=(s:Workspace)=>run(s,{type:'lesson.draft.publish',draftId:draft(s).id,expectedVersion:draft(s).version});

test('supported structured content and plaintext conversion preserve literal text',()=>{assert(isLessonDocument(doc));assert(isLessonDocument(plainLessonDocument('<script>alert(1)</script>')));assert.equal(lessonDocumentText(plainLessonDocument('One\n\nTwo')),'One\n\nTwo');assert(isLessonDocument(plainLessonDocument('')));});
test('untrusted rich content cannot smuggle arbitrary elements, attributes or URLs',()=>{
    for(const node of [
        {type:'iframe',attrs:{src:'https://evil.test'}},
        {type:'paragraph',attrs:{onclick:'alert(1)'}},
        {type:'image',attrs:{src:'data:image/svg+xml,<svg/>',alt:'Unsafe'}},
        {type:'image',attrs:{src:'https://u:p@host.test/a.png',alt:'Unsafe'}},
        {type:'video',attrs:{src:'https://evil.test/embed/x',title:'Unsafe'}},
        {type:'paragraph',content:[{type:'text',text:'Click',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]},
        {type:'heading',attrs:{level:1},content:[]},
        {type:'bulletList',content:[{type:'text',text:'Broken grammar'}]},
    ]) assert.equal(isLessonDocument({type:'doc',content:[node]}),false);
});
test('depth, node and byte limits reject resource-exhaustion documents',()=>{
    let node:any={type:'paragraph',content:[{type:'text',text:'Hello'}]};
    for(let i=0;i<10;i++)node={type:'blockquote',content:[node]};
    for(const value of [{type:'doc',content:[node]},{type:'doc',content:Array.from({length:601},()=>({type:'paragraph'}))},plainLessonDocument('a'.repeat(20001)),plainLessonDocument('界'.repeat(10000))])assert.equal(isLessonDocument(value),false);
});
test('video allowlist canonicalises supported links and strips tracking/autoplay',()=>{
    assert.equal(lessonVideoUrl('https://youtu.be/dQw4w9WgXcQ?autoplay=1'),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    assert.equal(lessonVideoUrl('https://vimeo.com/123456?autoplay=1'),'https://player.vimeo.com/video/123456');
    for(const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://youtube.com:444/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://vimeo.com/not-a-video'])assert.equal(lessonVideoUrl(url),null);
});
test('server derives searchable plain text and excludes drafts from member responses/events',()=>{
    const s=save(open());assert.equal(draft(s).body,lessonDocumentText(doc));assert(!JSON.stringify(visibleWorkspace(s,ctx(DEMO_USER))).includes('PRIVATE_RICH_DRAFT'));assert(!JSON.stringify(s.outbox).includes('PRIVATE_RICH_DRAFT'));assert(!JSON.stringify(s.audit).includes('PRIVATE_RICH_DRAFT'));
});
test('rich publication snapshots content while preserving identity and completion evidence',()=>{
    const s=save(open()),p=publish(s);assert.deepEqual(p.lessons.find(l=>l.id==='lesson_4')!.richBody,doc);assert.deepEqual(p.lessonRevisions.at(-1)!.richBody,doc);assert.deepEqual(p.completions,s.completions);assert.deepEqual(p.reputation,s.reputation);assert.equal(publish(p).lessonRevisions.length,p.lessonRevisions.length);
});
test('restoring plaintext clears rich draft but does not change the live rich lesson',()=>{
    const p=publish(save(open()));const r=run(p,{type:'lesson.draft.restore',draftId:draft(p).id,expectedVersion:draft(p).version,revisionId:p.lessonRevisions[0].id});assert.equal(draft(r).richBody,null);assert.deepEqual(r.lessons.find(l=>l.id==='lesson_4')!.richBody,doc);assert.equal(publish(r).lessons.find(l=>l.id==='lesson_4')!.richBody,null);
});
test('older clients cannot accidentally erase formatting by omitting the document',()=>{
    const s=save(open());const {richBody,...legacy}=lessonContent(draft(s));assert.throws(()=>run(s,{type:'lesson.draft.save',draftId:draft(s).id,expectedVersion:draft(s).version,...legacy}),{code:'RICH_CONTENT_REQUIRED'});assert.equal(draft(save(s,null)).richBody,null);
});
test('member, stale and foreign-tenant writes retain the original authoring boundary',()=>{
    const s=save(open()),c={type:'lesson.draft.save',draftId:draft(s).id,expectedVersion:draft(s).version,...lessonContent(draft(s))};assert.throws(()=>run(s,c,DEMO_USER),{code:'AUTHOR_REQUIRED'});assert.throws(()=>run(s,{...c,expectedVersion:1}),{code:'STALE_DRAFT'});assert.throws(()=>applyCommand(s,{...ctx(),organizationId:'foreign'},c),{code:'NOT_FOUND'});
});
test('invalid rich documents fail shared command validation',()=>{assert.equal(commandSchema.safeParse({type:'lesson.draft.save',draftId:'draft',expectedVersion:1,title:'Title',summary:'Summary',body:'Text',minutes:2,resourceUrl:'',richBody:{type:'doc',content:[{type:'script'}]}}).success,false);});
test('lesson rendering escapes HTML, uses real block elements and never fetches media initially',()=>{
    const html=renderToStaticMarkup(createElement(LessonBody,{body:'',richBody:doc}));assert(html.includes('<h2>Observe first</h2>'));assert(html.includes('<ul>'));assert(html.includes('<strong>PRIVATE_RICH_DRAFT</strong>'));assert(!html.includes('<iframe'));assert(!html.includes('<img'));assert(html.includes('Load video'));assert(html.includes('Load image'));
    const escaped=renderToStaticMarkup(createElement(LessonBody,{body:'<script>alert(1)</script>',richBody:null}));assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));
});
test('unexpected persisted document falls back to escaped plain text',()=>{const html=renderToStaticMarkup(createElement(LessonBody,{body:'Readable fallback',richBody:{type:'doc',content:[{type:'script',text:'bad'}]}}));assert(html.includes('Readable fallback'));assert(!html.includes('<script>'));});
