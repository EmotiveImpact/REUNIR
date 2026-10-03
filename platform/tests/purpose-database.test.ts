import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { openDatabase, type Database } from '../packages/db/src/connection';
import { migrate } from '../packages/db/src/migrate';
import { grantRuntimeTables } from '../packages/db/src/runtime-role';
import { WorkspaceRepository, setContext } from '../packages/db/src/repository';
import { createSeed, DEMO_USER, DEMO_ADMIN } from '../packages/domain/src/seed';
import { createApp } from '../apps/api/src/app';
const newTables=['purposes','paths','milestones','path_enrolments','contributions','outcomes','community_outputs','member_goals'];
let db:Database, repo:WorkspaceRepository;
before(async()=>{db=await openDatabase('pglite:memory');await migrate(db);repo=new WorkspaceRepository(db);await repo.seed(createSeed());await repo.seed(createSeed('studio-north'));});
after(async()=>db?.close());
const exec=(cmd:unknown,user=DEMO_USER)=>repo.execute('code-black',user,cmd,randomUUID(),'purpose_db_test');

test('populated Alpha 01 upgrades in place without fabricated purpose or content loss',async()=>{
    const old=await openDatabase('pglite:memory');
    try{
        await migrate(old,'0001');
        const before=await old.query<{digest:string}>('SELECT digest FROM schema_migrations WHERE version=$1',['0001']);
        await old.query("INSERT INTO organisations VALUES('old_org','old-community','Existing Community','Keep the work','mint',now(),7)");
        await old.query("INSERT INTO members VALUES('old_member','old_org',now(),'old_user','Existing Owner','Creator','Original bio','[]','mint','','owner','active')");
        await old.query("INSERT INTO spaces VALUES('old_space','old_org',now(),'General','general','Original space','mint','discussion','members')");
        await old.query("INSERT INTO posts VALUES('old_post','old_org',now(),'old_space','old_user','update','Original post','Keep this exact text',false,false,'')");
        await old.query("INSERT INTO projects VALUES('old_project','old_org',now(),null,'An existing film','Not a new demo','Original project','Film','[]','old_user','building','')");
        await migrate(old);await migrate(old);
        assert.equal((await old.query('SELECT version FROM schema_migrations')).rows.length, 20);
        assert.deepEqual((await old.query('SELECT digest FROM schema_migrations WHERE version=$1',['0001'])).rows,before.rows);
        const upgraded=await new WorkspaceRepository(old).snapshot('old-community','old_user');
        assert.equal(upgraded.posts[0].body,'Keep this exact text');assert.equal(upgraded.projects[0].title,'An existing film');assert.equal(upgraded.projects[0].purposeId,null);assert.equal(upgraded.revision,7);
        assert.equal(upgraded.purposes.length,0);assert.equal(upgraded.outcomes.length,0);assert.equal(upgraded.members[0].bio,'Original bio');
    }finally{await old.close();}
});
test('migration 0001 remains unchanged from Alpha 01',async()=>{
    const sql=await readFile(new URL('../packages/db/migrations/0001_foundation.sql',import.meta.url));
    assert.equal(createHash('sha256').update(sql).digest('hex'),'a7e48a65603c391acc0d04df4c793a9aa977f4a34a6b3b74e93c8972524f991b');
});
test('eight explicit purpose tables all round-trip through SQL snapshots',async()=>{const s=await repo.snapshot('code-black',DEMO_USER);assert.equal(s.purposes.length,3);assert.equal(s.paths.length,3);assert.equal(s.milestones.length,9);assert.equal(s.memberGoals.length,1);assert.equal(s.communityOutputs.length,1);assert.equal(s.contributions[0].reviewerId,DEMO_ADMIN);});
test('private goals are filtered from admin API snapshots too',async()=>{const s=await repo.snapshot('code-black',DEMO_ADMIN);assert(!s.memberGoals.some(x=>x.userId===DEMO_USER));});
test('goal updates persist and do not leak into another community',async()=>{await exec({type:'goal.set',purposeId:'purpose_build',title:'A private SQL goal',visibility:'private'});const a=await repo.snapshot('code-black',DEMO_USER),b=await repo.snapshot('studio-north',DEMO_USER);assert.equal(a.memberGoals.find(g=>g.id==='goal_alex')!.title,'A private SQL goal');assert.notEqual(b.memberGoals[0].title,'A private SQL goal');});
test('SQL goal/path composite key rejects mixed purposes',async()=>{await assert.rejects(()=>db.query("UPDATE member_goals SET path_id='path_film' WHERE organization_id='org_code_black' AND id='goal_alex'"));});
test('SQL milestone must link exactly one real target',async()=>{await assert.rejects(()=>db.query("UPDATE milestones SET project_id='project_common' WHERE organization_id='org_code_black' AND id='step_product_1'"));await assert.rejects(()=>db.query("UPDATE milestones SET lesson_id=null WHERE organization_id='org_code_black' AND id='step_product_1'"));});
test('SQL contribution reviewer cannot be its author',async()=>{await assert.rejects(()=>db.query("UPDATE contributions SET reviewer_id=user_id WHERE organization_id='org_code_black' AND id='contribution_notes'"));});
test('SQL outcome reviewer cannot be its author',async()=>{await assert.rejects(()=>db.query("UPDATE outcomes SET reviewer_id=author_id WHERE organization_id='org_code_black' AND id='outcome_notes'"));});
test('SQL outcome cannot claim a different member’s contribution',async()=>{await assert.rejects(()=>db.query("UPDATE outcomes SET author_id=$1 WHERE organization_id='org_code_black' AND id='outcome_notes'",[DEMO_USER]));});
test('SQL output must refer to its outcome’s actual purpose',async()=>{await assert.rejects(()=>db.query("UPDATE community_outputs SET purpose_id='purpose_become' WHERE organization_id='org_code_black' AND id='output_notes'"));});
test('SQL prevents a second publication of the same outcome',async()=>{await assert.rejects(()=>db.query("INSERT INTO community_outputs SELECT 'duplicate_output',organization_id,created_at,purpose_id,outcome_id,project_id,title,summary,kind,evidence_url,published_by FROM community_outputs WHERE organization_id='org_code_black' AND id='output_notes'"));});
test('runtime grants are explicit, repeatable, non-owner and omit migration history',async()=>{
    await db.query('CREATE ROLE reunir_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS');
    await db.transaction(grantRuntimeTables);await db.transaction(grantRuntimeTables);
    for(const name of newTables)assert.equal((await db.query<{allowed:boolean}>("SELECT has_table_privilege('reunir_app',$1,'SELECT,INSERT,UPDATE,DELETE') AS allowed",[name])).rows[0].allowed,true);
    assert.equal((await db.query<{allowed:boolean}>("SELECT has_table_privilege('reunir_app','schema_migrations','SELECT') AS allowed")).rows[0].allowed,false);
});
test('all eight new tables use forced RLS and deny missing tenant context',async()=>{
    const r=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>('SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)',[newTables]);assert.equal(r.rows.length,8);assert(r.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
    await db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');await setContext(tx,'','');for(const name of newTables)assert.equal((await tx.query(`SELECT id FROM ${name}`)).rows.length,0);});
});
test('new-table RLS contains reads within the chosen tenant',async()=>{await db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');await setContext(tx,'org_code_black',DEMO_USER);for(const name of newTables){const rows=await tx.query<{organization_id:string}>(`SELECT organization_id FROM ${name}`);assert(rows.rows.length>0);assert(rows.rows.every(x=>x.organization_id==='org_code_black'));}});});
test('new-table RLS blocks foreign-tenant purpose writes',async()=>{await assert.rejects(()=>db.transaction(async tx=>{await tx.query('SET LOCAL ROLE reunir_app');await setContext(tx,'org_code_black',DEMO_USER);await tx.query("INSERT INTO purposes VALUES('foreign_write','org_studio_north',now(),'build','Bad write','','active')");}));});
test('purpose commands use idempotent receipts and atomic event writes',async()=>{const key=randomUUID(),cmd={type:'purpose.save',kind:'achieve',title:'Ship a working pilot'};const a=await repo.execute('code-black',DEMO_ADMIN,cmd,key,'a'),b=await repo.execute('code-black',DEMO_ADMIN,cmd,key,'b');assert.equal(a.objectId,b.objectId);assert.equal(a.workspace.revision,b.workspace.revision);assert.equal((await db.query('SELECT id FROM outbox WHERE organization_id=$1 AND object_id=$2',['org_code_black',a.objectId])).rows.length,1);});
test('database contribution → review → outcome → review → output chain persists',async()=>{
    await exec({type:'project.join',projectId:'project_common'});
    const c=await exec({type:'contribution.submit',projectId:'project_common',title:'A tested contribution',body:'An actual persisted record.',evidenceUrl:'https://example.com/evidence'});
    await exec({type:'contribution.review',contributionId:c.objectId,decision:'recognised',feedback:'Reviewed the submitted evidence.'},DEMO_ADMIN);
    const o=await exec({type:'outcome.submit',purposeId:'purpose_build',contributionId:c.objectId,title:'A usable first version',summary:'Verified within our community.'});
    await exec({type:'outcome.review',outcomeId:o.objectId,decision:'verified',feedback:'Checked the linked work.'},DEMO_ADMIN);
    await exec({type:'output.publish',outcomeId:o.objectId,kind:'software'},DEMO_ADMIN);
    const s=await repo.snapshot('code-black',DEMO_USER);assert(s.communityOutputs.some(x=>x.outcomeId===o.objectId));assert.equal(s.outcomes.find(x=>x.id===o.objectId)!.reviewerId,DEMO_ADMIN);
});
test('purpose HTTP endpoint keeps session identity, permissions and privacy intact',async()=>{
    let user=DEMO_USER;
    const origin='https://reunir.test',app=createApp({repository:repo,origin,resolveSession:async()=>({id:user,name:'Test member'})});
    const post=(body:object)=>app.request('/api/organisations/code-black/commands',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'Idempotency-Key':randomUUID()},body:JSON.stringify(body)});
    const forbidden=await post({type:'purpose.save',kind:'build',title:'Not an admin'});assert.equal(forbidden.status,403);
    const privateGoal=await post({type:'goal.set',purposeId:'purpose_achieve',title:'A confidential ambition'});assert.equal(privateGoal.status,200);
    user=DEMO_ADMIN;const snap=await app.request('/api/organisations/code-black/workspace');const s=await snap.json();assert(!s.memberGoals.some((g:any)=>g.title==='A confidential ambition'));
    const spoofed=await post({type:'goal.set',purposeId:'purpose_build',title:'Spoofing a member',userId:DEMO_USER});assert.equal(spoofed.status,400);
    const invalidSource=await post({type:'outcome.submit',purposeId:'purpose_build',title:'No proof',summary:'A claim is not evidence'});assert.equal(invalidSource.status,409);
});
test('new production community has no imaginary purposes, goals or outputs',async()=>{await repo.createCommunity({id:'new_owner',name:'Actual Owner'},'blank-purpose','A new community');const s=await repo.snapshot('blank-purpose','new_owner');assert.equal(s.purposes.length,0);assert.equal(s.memberGoals.length,0);assert.equal(s.outcomes.length,0);assert.equal(s.communityOutputs.length,0);});
test('SQL goal evidence must belong to the goal’s member',async()=>{await assert.rejects(()=>db.query("UPDATE member_goals SET status='completed',completed_at=now(),outcome_id='outcome_notes' WHERE organization_id='org_code_black' AND id='goal_alex'"));});
