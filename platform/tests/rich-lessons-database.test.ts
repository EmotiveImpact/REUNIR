import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { lessonContent } from '../packages/domain/src/authoring';
import { plainLessonDocument } from '../packages/contracts/src/lesson-document';
import { seedBeforeProjectWork } from './helpers/legacy-fixture';
let db:Database,repo:WorkspaceRepository;
before(async()=>{db=await openDatabase('pglite:memory');await migrate(db);await new WorkspaceRepository(db).seed(createSeed());await new WorkspaceRepository(db).seed(createSeed('studio-north'));await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');await db.transaction(grantRuntimeTables);const runtime=Object.create(db) as Database;runtime.transaction=fn=>db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');return fn(tx);});repo=new WorkspaceRepository(runtime);});
after(async()=>db?.close());
const exec=(cmd:unknown)=>repo.execute('code-black',DEMO_ADMIN,cmd,randomUUID(),'rich-db');
test('0008 upgrade preserves every pre-existing lesson field and completion',async()=>{
    const old=await openDatabase('pglite:memory');try{
        await migrate(old,'0007');await seedBeforeProjectWork(old);
        const lessons=(await old.query('SELECT * FROM lessons ORDER BY id')).rows,completions=(await old.query('SELECT * FROM completions ORDER BY id')).rows;
        await migrate(old);await migrate(old);
        const after=(await old.query('SELECT * FROM lessons ORDER BY id')).rows;
        assert.deepEqual(after.map(({rich_body,resources,...row})=>row),lessons);assert(after.every(row=>row.rich_body===null&&row.resources===null));assert.deepEqual((await old.query('SELECT * FROM completions ORDER BY id')).rows,completions);
    }finally{await old.close();}
});
test('restricted role saves, publishes and restores rich revisions with tenant isolation',async()=>{
    let r=await exec({type:'lesson.draft.create',trackId:'track_product',lessonId:'lesson_4'}),d=r.workspace.lessonDrafts[0];
    const richBody=plainLessonDocument('PRIVATE_FORMATTED_LESSON');richBody.content[0].content![0].marks=[{type:'bold'}];
    r=await exec({type:'lesson.draft.save',draftId:d.id,expectedVersion:d.version,...lessonContent(d),richBody});d=r.workspace.lessonDrafts[0];
    assert.deepEqual(d.richBody,richBody);assert(!JSON.stringify(await repo.snapshot('code-black',DEMO_USER)).includes('PRIVATE_FORMATTED_LESSON'));assert(!JSON.stringify(await repo.snapshot('studio-north',DEMO_ADMIN)).includes('PRIVATE_FORMATTED_LESSON'));
    r=await exec({type:'lesson.draft.publish',draftId:d.id,expectedVersion:d.version});
    assert.deepEqual((await repo.snapshot('code-black',DEMO_USER)).lessons.find(l=>l.id==='lesson_4')!.richBody,richBody);
    const revision=r.workspace.lessonRevisions.at(-1)!;
    const altered=plainLessonDocument('SECOND_VERSION');
    r=await exec({type:'lesson.draft.save',draftId:d.id,expectedVersion:d.version,...lessonContent(d),richBody:altered});d=r.workspace.lessonDrafts[0];
    r=await exec({type:'lesson.draft.restore',draftId:d.id,expectedVersion:d.version,revisionId:revision.id});
    assert.deepEqual(r.workspace.lessonDrafts[0].richBody,richBody);assert.deepEqual(r.workspace.lessonRevisions.at(-1)!.richBody,richBody);
    await assert.rejects(()=>db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');await setContext(tx,'org_code_black',DEMO_ADMIN);await tx.query("UPDATE lesson_revisions SET rich_body=NULL");}));
    await db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');await setContext(tx,'org_code_black',DEMO_USER);assert.equal((await tx.query('SELECT rich_body FROM lesson_drafts')).rows.length,0);});
});
