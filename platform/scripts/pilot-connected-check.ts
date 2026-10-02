/** Real browser, real HTTP, real Better Auth and local PostgreSQL engine.
 * Only email transport is captured: this test never sends external email.
 */
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {build} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openDatabase} from '../packages/db/src/connection';
import {migrate} from '../packages/db/src/migrate';
import {WorkspaceRepository} from '../packages/db/src/repository';
import {createAuth} from '../apps/api/src/auth';
import {createApp} from '../apps/api/src/app';
import {MailQueue,type Mail} from '../apps/api/src/mail';
import {InvitationService} from '../apps/api/src/invitations';
const root=resolve(import.meta.dirname,'..'),dir=root+'/evidence/alpha04/connected';await mkdir(dir,{recursive:true});
process.env.VITE_DATA_MODE='live';
await build({configFile:root+'/apps/web/vite.config.ts',build:{outDir:root+'/.connected-dist',emptyOutDir:true},logLevel:'error'});
// Vite defaults NODE_ENV to production. The server test deliberately uses local test infrastructure.
process.env.NODE_ENV='test';
let handler:(r:Request)=>Response|Promise<Response>=()=>new Response('Starting',{status:503});
const server=serve({fetch:r=>handler(r),hostname:'127.0.0.1',port:0});
await new Promise<void>(r=>server.listening?r():server.once('listening',r));
const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
const db=await openDatabase('pglite:memory');await migrate(db);const repo=new WorkspaceRepository(db);
const secret='connected_browser_test_secret_72427e75baebcc859f3e04',delivered:Mail[]=[];
const queue=new MailQueue(db,secret,{send:async m=>{delivered.push(m);}});
const registrar=createAuth(db,origin,secret,true);
const owner=await registrar.api.signUpEmail({body:{name:'Pilot Owner',email:'owner@example.test',password:'Owner-pilot-password-123!'}});
await repo.createCommunity({id:owner.user.id,name:'Pilot Owner'},'pilot','Code Black Pilot');
const auth=createAuth(db,origin,secret,false,queue),invitations=new InvitationService(repo,origin,queue);
const app=createApp({repository:repo,origin,mail:queue,invitations,cronSecret:secret,
 registerInvited:async(name,email,password)=>{const r=await registrar.api.signUpEmail({body:{name,email,password}});return {id:r.user.id};},
 authHandler:r=>auth.handler(r),resolveSession:async headers=>{const s=await auth.api.getSession({headers});return s?{id:s.user.id,name:s.user.name}:null;}});
app.get('/assets/*',serveStatic({root:'.connected-dist'}));app.get('/',serveStatic({path:'.connected-dist/index.html'}));handler=app.fetch;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
const ownerContext=await browser.newContext({viewport:{width:1440,height:960}}),guestContext=await browser.newContext({viewport:{width:1440,height:960}});
const page=await ownerContext.newPage(),guest=await guestContext.newPage();page.setDefaultTimeout(10000);guest.setDefaultTimeout(10000);
const results:{name:string;passed:boolean}[]=[],errors:string[]=[];for(const p of [page,guest]){p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());}
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();results.push({name,passed:true});console.log('PASS',name);};
const a11y=async(name:string,p=guest)=>{const a=await new AxeBuilder({page:p}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();await writeFile(dir+'/a11y-'+name+'.json',JSON.stringify({violations:a.violations,incomplete:a.incomplete},null,2));expect(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);};
const signIn=async(p:typeof page,email:string,password:string)=>{await p.getByLabel('Email',{exact:true}).fill(email);await p.getByLabel('Password',{exact:true}).fill(password);await p.getByRole('button',{name:'Sign in',exact:true}).click();await expect(p.locator('.topbar')).toBeVisible();};
let url='';
try{
await check('live build requires sign-in and never substitutes the demo',async()=>{await guest.goto(origin);await expect(guest.getByRole('heading',{name:'Good to see you.'})).toBeVisible();await expect(guest.locator('.sidebar')).toHaveCount(0);await a11y('login');});
await check('owner signs in through HTTP to a genuinely empty pilot',async()=>{await page.goto(origin);await signIn(page,'owner@example.test','Owner-pilot-password-123!');await expect(page.locator('.app-footer')).toContainText('CONNECTED ALPHA');await expect(page.locator('.top-avatar img')).toHaveCount(0);await expect(page.locator('h1')).toBeVisible();});
await check('owner creates a personal invitation in the connected interface',async()=>{await page.locator('.sidebar a[href="#/access"]').click();await page.getByRole('button',{name:'Invite a member'}).click();await page.getByLabel('Email address',{exact:true}).fill('creator@example.test');await page.getByRole('button',{name:'Create invitation',exact:true}).click();url=await page.getByLabel('Personal invitation link').inputValue();expect(url).toContain('/#/invite?token=');expect((await db.query('SELECT id FROM invitations')).rows).toHaveLength(1);});
await check('queued invitation is sent through captured transport and no secrets are stored in plaintext',async()=>{const rows=await db.query<{payload:string}>('SELECT payload FROM email_outbox');expect(rows.rows[0].payload).not.toContain('creator@example.test');await queue.drain();expect(delivered[0].to).toBe('creator@example.test');expect(delivered[0].text).toContain(url);});
await check('invite screen masks email and creates a real member account',async()=>{await guest.goto(url);await expect(guest.getByRole('heading',{name:'Welcome to Code Black Pilot.'})).toBeVisible();await expect(guest.getByText('c***@example.test')).toBeVisible();await a11y('invite');await guest.getByLabel('Your name').fill('Pilot Creator');await expect(guest.getByLabel('New password',{exact:true})).toHaveAccessibleDescription('Use at least 12 characters.');await guest.getByLabel('New password',{exact:true}).fill('Creator-pilot-password-123!');await guest.getByRole('button',{name:'Create my account'}).click();await expect(guest.getByRole('status')).toContainText('Your account and community membership are ready.');});
await check('invited creator can sign in and see only their community',async()=>{await guest.getByRole('button',{name:'Go to sign in'}).click();await signIn(guest,'creator@example.test','Creator-pilot-password-123!');await expect(guest.locator('.topbar')).toContainText('Code Black Pilot');await expect(guest.locator('.sidebar a[href="#/access"]')).toHaveCount(0);});
await check('connected member sends a message that is stored outside the community feed',async()=>{await guest.locator('.sidebar a[href="#/messages"]').click();await guest.getByRole('button',{name:'New message',exact:true}).click();await guest.locator('.new-message-people .inbox-person').filter({hasText:'Pilot Owner'}).click();await expect(guest.locator('.thread-heading strong')).toHaveText('Pilot Owner');await guest.getByLabel('Your message',{exact:true}).fill('My first real message to the pilot owner.');await guest.getByRole('button',{name:'Send message',exact:true}).click();await expect(guest.locator('.message-bubble')).toContainText('My first real message');expect((await db.query('SELECT body FROM messages')).rows).toHaveLength(1);expect((await db.query('SELECT id FROM posts')).rows).toHaveLength(0);});
await check('owner receives the persisted message through the same API',async()=>{await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await page.locator('.sidebar a[href="#/messages"]').click();await page.locator('.inbox-list .inbox-person').filter({hasText:'Pilot Creator'}).click();await expect(page.locator('.message-bubble')).toContainText('My first real message');await page.screenshot({path:dir+'/connected-inbox.png',fullPage:true});});
await check('recovery UI queues an actual Better Auth reset link',async()=>{await guest.evaluate(async()=>{await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});});await guest.goto(origin);await guest.getByRole('button',{name:'Forgot your password?'}).click();await guest.getByLabel('Email',{exact:true}).fill('creator@example.test');await guest.getByRole('button',{name:'Send reset link',exact:true}).click();await expect(guest.getByRole('status')).toContainText('If there is an account');await queue.drain();expect(delivered.some(m=>m.subject.includes('Reset'))).toBe(true);});
await check('reset redirect renders the recovery form and changes the password',async()=>{const mail=delivered.find(m=>m.subject.includes('Reset'))!;const reset=mail.text.match(/http:\/\/[^\s]+/)![0];await guest.goto(reset);await expect(guest.getByRole('heading',{name:'A fresh start.'})).toBeVisible();await a11y('reset');await expect(guest.getByLabel('New password',{exact:true})).toHaveAccessibleDescription('Use at least 12 characters.');await guest.getByLabel('New password',{exact:true}).fill('Creator-replacement-password-456!');await guest.getByRole('button',{name:'Update password'}).click();await expect(guest.getByRole('status')).toContainText('Your password has been updated');await guest.getByRole('button',{name:'Go to sign in'}).click();await signIn(guest,'creator@example.test','Creator-replacement-password-456!');});
await check('used invitation is refused on the actual entry page',async()=>{await guest.goto(url);await expect(guest.getByRole('alert')).toBeVisible();await expect(guest.getByRole('button',{name:'Create my account'})).toHaveCount(0);});
await check('connected journeys produced no uncaught browser errors',async()=>{expect(errors).toEqual([]);});
await writeFile(dir+'/results.json',JSON.stringify({generatedAt:new Date().toISOString(),method:'Live Vite build + Hono HTTP + Better Auth cookies + local PGlite database; captured email transport. No Neon/Vercel/GCS/provider deployment.',results,errors},null,2));console.log(`${results.length} connected browser checks passed`);
}catch(e){await guest.screenshot({path:dir+'/failure-guest.png',fullPage:true}).catch(()=>{});await page.screenshot({path:dir+'/failure-owner.png',fullPage:true}).catch(()=>{});await writeFile(dir+'/results.json',JSON.stringify({results,errors,failure:String(e)},null,2));throw e;}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await db.close();}
