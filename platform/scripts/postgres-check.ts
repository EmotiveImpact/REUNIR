/** Opt-in integration test against a disposable local PostgreSQL CI service, never Neon/customer data. */
import {strict as assert} from 'node:assert';
import {mkdir,writeFile} from 'node:fs/promises';
import {openDatabase} from '../packages/db/src/connection';
import {migrate} from '../packages/db/src/migrate';
import {grantRuntimeTables} from '../packages/db/src/runtime-role';
import {runtimeRoleIsSafe} from '../packages/db/src/runtime-safety';
import {WorkspaceRepository,setContext} from '../packages/db/src/repository';
import {createSeed,DEMO_USER,DEMO_ADMIN} from '../packages/domain/src/seed';
import {PilotOperations} from '../apps/api/src/operations';
import {inspectMigrations} from '../packages/db/src/inspection';
const url=new URL(process.env.POSTGRES_TEST_URL||'http://unconfigured');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.pathname!=='/reunir_ci')throw new Error('This test requires a disposable loopback database named reunir_ci. It cannot target remote or customer databases.');
const admin=await openDatabase(url.toString());
const results:{name:string;passed:boolean}[]=[];const check=async(name:string,fn:()=>Promise<void>)=>{await fn();results.push({name,passed:true});console.log('PASS',name);};
let runtime:Awaited<ReturnType<typeof openDatabase>>|undefined;
try{
    const existing=await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(existing.rows.length,0,'CI database must be empty; existing data has not been overwritten.');
    await check('ordered migrations apply on actual PostgreSQL',async()=>{await migrate(admin);assert((await inspectMigrations(admin)).every(r=>r.state==='matching'));});
    const seed=new WorkspaceRepository(admin);await seed.seed(createSeed());await seed.seed(createSeed('studio-north'));
    await admin.query("CREATE ROLE reunir_app LOGIN PASSWORD 'LOCAL_CI_TEST_ONLY_12345678901234567890' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS");
    await admin.transaction(grantRuntimeTables);url.username='reunir_app';url.password='LOCAL_CI_TEST_ONLY_12345678901234567890';runtime=await openDatabase(url.toString());
    await check('separate runtime connection is non-owner and cannot bypass RLS',async()=>{assert(await runtimeRoleIsSafe(runtime!));await assert.rejects(()=>runtime!.query('SELECT * FROM schema_migrations'));});
    await check('missing tenant context denies rows on a fresh connection',async()=>{assert.equal((await runtime!.query('SELECT id FROM posts')).rows.length,0);});
    await check('parallel connection-pool reads keep two tenant contexts separate',async()=>{const repo=new WorkspaceRepository(runtime!);const slugs=Array.from({length:20},(_,i)=>i%2?'code-black':'studio-north');const rows=await Promise.all(slugs.map(s=>repo.snapshot(s,DEMO_USER)));rows.forEach((r,i)=>assert.equal(r.organisation.slug,slugs[i]));});
    await check('transaction context is reset before a pooled connection is reused',async()=>{await runtime!.transaction(async tx=>{await setContext(tx,'org_code_black',DEMO_USER);assert((await tx.query('SELECT id FROM posts')).rows.length>0);});assert.equal((await runtime!.query('SELECT id FROM posts')).rows.length,0);});
    await check('owner console runs through the restricted PostgreSQL connection',async()=>{const ops=new PilotOperations(new WorkspaceRepository(runtime!),{NODE_ENV:'test',DATABASE_URL:url.toString()});const status=await ops.snapshot('code-black',DEMO_ADMIN);assert.equal(status.checks.find(x=>x.key==='runtime-role')!.state,'pass');assert.equal(status.community.activeMembers,8);});
    await mkdir('evidence/alpha04',{recursive:true});await writeFile('evidence/alpha04/postgres-results.json',JSON.stringify({generatedAt:new Date().toISOString(),method:'Disposable local PostgreSQL service, not Neon.',results},null,2));
}finally{await runtime?.close();await admin.close();}
