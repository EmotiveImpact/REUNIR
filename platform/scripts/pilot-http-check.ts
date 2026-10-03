import {RELEASE_VERSION} from '../packages/contracts/src/operations';
/** Local HTTP integration smoke test. No remote mail, Neon or deployment involved. */
import {strict as assert} from 'node:assert';
import {randomUUID} from 'node:crypto';
import {serve} from '@hono/node-server';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openDatabase} from '../packages/db/src/connection';
import {migrate} from '../packages/db/src/migrate';
import {WorkspaceRepository} from '../packages/db/src/repository';
import {createAuth,passwordCheck} from '../apps/api/src/auth';
import {createApp} from '../apps/api/src/app';
import {MailQueue,type Mail} from '../apps/api/src/mail';
import {PilotOperations} from '../apps/api/src/operations';
import {InvitationService} from '../apps/api/src/invitations';
const dir=resolve(import.meta.dirname,'../evidence/alpha04');await mkdir(dir,{recursive:true});
let handler:(r:Request)=>Response|Promise<Response>=()=>new Response('Starting',{status:503});
const server=serve({fetch:r=>handler(r),hostname:'127.0.0.1',port:0});
await new Promise<void>(r=>server.listening?r():server.once('listening',r));
const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
const db=await openDatabase('pglite:memory');await migrate(db);const repo=new WorkspaceRepository(db);
const secret='http_pilot_test_only_72427e75baebcc859f3e04',sent:Mail[]=[];
const queue=new MailQueue(db,secret,{send:async m=>{sent.push(m);}});
const registrar=createAuth(db,origin,secret,true),owner=await registrar.api.signUpEmail({body:{name:'HTTP Owner',email:'owner@example.test',password:'Owner-test-password-123!'}});
await repo.createCommunity({id:owner.user.id,name:'HTTP Owner'},'pilot','HTTP Pilot');
const auth=createAuth(db,origin,secret,false,queue),invitations=new InvitationService(repo,origin,queue);
const ops=new PilotOperations(repo,{NODE_ENV:'test',APP_ORIGIN:origin,DATABASE_URL:'pglite:memory',BETTER_AUTH_SECRET:secret,VITE_DATA_MODE:'live'});
const app=createApp({repository:repo,origin,operations:ops,mail:queue,invitations,cronSecret:secret,verifyPassword:passwordCheck(auth),
 registerInvited:async(name,email,password)=>{const r=await registrar.api.signUpEmail({body:{name,email,password}});return {id:r.user.id};},
 authHandler:r=>auth.handler(r),resolveSession:async headers=>{const s=await auth.api.getSession({headers});return s?{id:s.user.id,name:s.user.name}:null;}});handler=app.fetch;
const results:{name:string;passed:boolean}[]=[];
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();results.push({name,passed:true});console.log('PASS',name);};
const call=(path:string,body?:unknown,cookie='')=>fetch(origin+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()}: {})},body:body?JSON.stringify(body):undefined});
const cookies=(r:Response)=>r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
let ownerCookie='',guestCookie='',token='',guestId='',threadId='';
try{
await check('Node server responds over a real HTTP socket',async()=>{const r=await call('/api/health');assert.equal(r.status,200);assert.equal((await r.json()).version,RELEASE_VERSION);});
await check('owner signs in with an HttpOnly session cookie',async()=>{const r=await call('/api/auth/sign-in/email',{email:'owner@example.test',password:'Owner-test-password-123!'});assert.equal(r.status,200);assert(r.headers.getSetCookie().some(c=>/HttpOnly/i.test(c)));ownerCookie=cookies(r);});
await check('public signup is disabled on the actual HTTP endpoint',async()=>{const r=await call('/api/auth/sign-up/email',{name:'No invitation',email:'no@example.test',password:'No-invitation-password-123!'});assert(r.status>=400);});
await check('owner creates a member-only invitation over HTTP',async()=>{const r=await call('/api/organisations/pilot/invitations',{email:'creator@example.test'},ownerCookie);assert.equal(r.status,201);const j=await r.json();token=new URLSearchParams(new URL(j.url).hash.split('?')[1]).get('token')!;assert.equal(token.length,43);});
await check('invited creator registers with a real Better Auth account',async()=>{const r=await call('/api/invitations/register',{token,name:'HTTP Creator',password:'Creator-test-password-123!'});assert.equal(r.status,201);const login=await call('/api/auth/sign-in/email',{email:'creator@example.test',password:'Creator-test-password-123!'});assert.equal(login.status,200);guestCookie=cookies(login);const session=await(await call('/api/session',undefined,guestCookie)).json();guestId=session.id;assert.equal(session.memberships.length,1);});
await check('connected membership can read only its community',async()=>{assert.equal((await call('/api/organisations/pilot/workspace',undefined,guestCookie)).status,200);assert.equal((await call('/api/organisations/another/workspace',undefined,guestCookie)).status,404);});
await check('messages persist through the public API without becoming posts',async()=>{const r=await call('/api/organisations/pilot/conversations',{userId:owner.user.id},guestCookie);assert.equal(r.status,201);threadId=(await r.json()).id;assert.equal((await call(`/api/organisations/pilot/conversations/${threadId}/messages`,{body:'My real HTTP message.'},guestCookie)).status,201);assert.equal((await db.query('SELECT id FROM posts')).rows.length,0);});
await check('recipient reads the persisted message using their own session',async()=>{const r=await call(`/api/organisations/pilot/conversations/${threadId}/messages`,undefined,ownerCookie);assert.equal(r.status,200);const j=await r.json();assert.equal(j.items[0].senderId,guestId);assert.equal(j.items[0].body,'My real HTTP message.');});
await check('password recovery queues delivery rather than doing remote mail in the request',async()=>{const r=await call('/api/auth/request-password-reset',{email:'creator@example.test',redirectTo:origin+'/#/reset-password'});assert.equal(r.status,200);assert.equal(sent.length,0);await queue.drain();assert(sent.some(m=>m.subject.includes('Reset')));});
let resetToken='';
await check('reset link redirects to the SPA in a form its token parser supports',async()=>{const url=sent.find(m=>m.subject.includes('Reset'))!.text.match(/http:\/\/[^\s]+/)![0];const r=await fetch(url,{redirect:'manual'});assert(r.status>=300&&r.status<400);const target=new URL(r.headers.get('location')!);assert.equal(target.origin,origin);assert.equal(target.hash.split('?')[0],'#/reset-password');resetToken=new URLSearchParams(target.hash.split('?')[1]).get('token')||target.searchParams.get('token')||'';assert(resetToken);});
await check('password reset changes credentials and revokes the previous cookie',async()=>{assert.equal((await call('/api/auth/reset-password',{token:resetToken,newPassword:'Replacement-test-password-456!'})).status,200);assert.equal(await(await call('/api/session',undefined,guestCookie)).json(),null);assert.equal((await call('/api/auth/sign-in/email',{email:'creator@example.test',password:'Replacement-test-password-456!'})).status,200);});
await check('used personal invitation cannot create another account or membership',async()=>{assert.equal((await call('/api/invitations/inspect',{token})).status,410);assert.equal((await db.query('SELECT id FROM members')).rows.length,2);});
await check('owner receives real redacted operational observations over HTTP',async()=>{const r=await call('/api/organisations/pilot/pilot-status',undefined,ownerCookie);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const j=await r.json();assert.equal(j.source,'server');assert.equal(j.version,RELEASE_VERSION);assert.equal(j.overall,'blocked');assert.equal(j.community.activeMembers,2);assert.equal(j.checks.find((c:any)=>c.key==='delivery-receipt').state,'unverified');});
await check('unauthenticated requests cannot inspect pilot operations',async()=>{assert.equal((await call('/api/organisations/pilot/pilot-status')).status,401);});
await check('ordinary active member cannot inspect owner operations',async()=>{const sign=await call('/api/auth/sign-in/email',{email:'creator@example.test',password:'Replacement-test-password-456!'});assert.equal(sign.status,200);assert.equal((await call('/api/organisations/pilot/pilot-status',undefined,cookies(sign))).status,403);});
await check('operational report excludes actual account addresses and reset credentials',async()=>{const r=await call('/api/organisations/pilot/pilot-status',undefined,ownerCookie),raw=await r.text();for(const sensitive of [origin,secret,'owner@example.test','creator@example.test',resetToken,'My real HTTP message.'])assert(!raw.includes(sensitive));});
await check('account deletion checks the password with Better Auth and refuses the owner',async()=>{const sign=await call('/api/auth/sign-in/email',{email:'creator@example.test',password:'Replacement-test-password-456!'});guestCookie=cookies(sign);const wrong=await call('/api/account/delete',{password:'Not-the-password-789!',confirmation:'delete my account'},guestCookie);assert.equal(wrong.status,403);assert.equal((await wrong.json()).error.code,'WRONG_PASSWORD');const owned=await call('/api/account/delete',{password:'Owner-test-password-123!',confirmation:'delete my account'},ownerCookie);assert.equal(owned.status,409);assert.match((await owned.json()).error.message,/You own HTTP Pilot/);});
await check('a member deletes their own account: the session ends, sign-in fails and their messages read as from a former member',async()=>{const r=await call('/api/account/delete',{password:'Replacement-test-password-456!',confirmation:'delete my account'},guestCookie);assert.equal(r.status,200);assert.equal((await r.json()).deleted,true);assert.match(r.headers.getSetCookie().join('\n'),/reunir\.session_token=; Path=\/; Max-Age=0/);assert.equal(await(await call('/api/session',undefined,guestCookie)).json(),null);assert.equal((await call('/api/organisations/pilot/workspace',undefined,guestCookie)).status,401);assert.equal((await call('/api/auth/sign-in/email',{email:'creator@example.test',password:'Replacement-test-password-456!'})).status,401);const seen=await(await call('/api/organisations/pilot/workspace',undefined,ownerCookie)).json();assert.deepEqual(seen.members.filter((m:{userId:string})=>m.userId===guestId).map((m:{name:string;status:string})=>[m.name,m.status]),[['Former member','left']]);const thread=await(await call(`/api/organisations/pilot/conversations/${threadId}/messages`,undefined,ownerCookie)).json();assert(thread.items.some((m:{senderId:string})=>m.senderId===guestId),'the conversation stays with the owner');assert.equal((await db.query('SELECT count(*)::int AS n FROM auth_user WHERE email=$1',['creator@example.test'])).rows[0].n,0);});
await check('public liveness reveals only version and process response',async()=>{const r=await call('/api/health/live');assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'ok',version:RELEASE_VERSION});});
await writeFile(dir+'/http-results.json',JSON.stringify({generatedAt:new Date().toISOString(),method:'Node HTTP server + fetch clients + Better Auth cookies + PGlite. Captured email transport; no external email or cloud deployment.',results},null,2));console.log(`${results.length} real HTTP checks passed`);
}catch(e){await writeFile(dir+'/http-results.json',JSON.stringify({results,failure:String(e)},null,2));throw e;}finally{await new Promise<void>(r=>server.close(()=>r()));await db.close();}
