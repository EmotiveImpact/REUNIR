import {api,mode,demoState} from './data';
import {newId} from '../../../../packages/contracts/src/index';
import {sendMessage,reportMessage,type Conversation,type DirectMessage,type MessageReport,type ConversationPage,type MessagePage} from '../../../../packages/contracts/src/messaging';
import {actorFor,isModerator} from '../../../../packages/domain/src/access';
interface DemoChat {threads:Conversation[];messages:DirectMessage[];read:Record<string,string>;blocks:[string,string][];reports:MessageReport[];keys:Record<string,{id:string;body:string;thread:string}>}
const memory:Record<string,DemoChat>={};
window.addEventListener('reunir:reset-demo',()=>{for(const key of Object.keys(memory))delete memory[key];});
function store(slug:string):DemoChat {
 if(memory[slug])return memory[slug];
 try {const raw=localStorage.getItem('reunir.chat.v1.'+slug);if(raw){memory[slug]=JSON.parse(raw);return memory[slug];}}catch{}
 const now=new Date().toISOString();
 return memory[slug]={threads:[{id:'conversation_welcome',participantIds:['member_alex','member_amina'],createdAt:now,updatedAt:now,lastBody:'',unread:1,blocked:false,blockedByMe:false}],messages:[{id:'message_welcome',conversationId:'conversation_welcome',senderId:'member_amina',body:'Welcome, Alex. What are you working towards, and what would help you take your next step?',createdAt:now}],read:{},blocks:[],reports:[],keys:{}};
}
/** A deleted demo account's read state, blocks and request keys go. Its messages stay with the people it wrote to. */
export function forgetDemoChat(slug:string,userId:string){
 const s=store(slug),mine=(key:string)=>key.startsWith(userId+':');
 for(const key of Object.keys(s.read))if(mine(key))delete s.read[key];
 for(const key of Object.keys(s.keys))if(mine(key))delete s.keys[key];
 s.blocks=s.blocks.filter(([blocker])=>blocker!==userId);
 try{localStorage.setItem('reunir.chat.v1.'+slug,JSON.stringify(s));}catch{}
}
export async function messageRequest<T>(slug:string,userId:string,path:string,body?:unknown,key?:string):Promise<T>{
 if(mode==='live')return api<T>(`/api/organisations/${encodeURIComponent(slug)}/${path}`,body,key);
 const w=demoState(slug),actor=actorFor(w,{organizationId:w.organisation.id,userId,requestId:newId()}),s=store(slug);
 const u=new URL(path,'https://local.invalid/'),parts=u.pathname.slice(1).split('/');
 const thread=(id:string)=>{const t=s.threads.find(t=>t.id===id&&t.participantIds.includes(userId));if(!t)throw new Error('Conversation not found.');return t;};
 const peerActive=(peer:string)=>{if(peer===userId||!w.members.some(m=>m.userId===peer&&m.status==='active'))throw new Error('This member is not available.');if(s.blocks.some(([a,b])=>(a===userId&&b===peer)||(a===peer&&b===userId)))throw new Error('Messaging is not available between these members.');};
 let result:any;
 if(parts[0]==='conversations'&&parts.length===1){
  if(body){const peer=(body as {userId:string}).userId;peerActive(peer);let t=s.threads.find(t=>t.participantIds.includes(userId)&&t.participantIds.includes(peer));if(!t){const now=new Date().toISOString();t={id:newId(),participantIds:[userId,peer],createdAt:now,updatedAt:now,lastBody:'',unread:0,blocked:false,blockedByMe:false};s.threads.unshift(t);}result={id:t.id};}
  else result={items:s.threads.filter(t=>t.participantIds.includes(userId)).map(t=>{const messages=s.messages.filter(m=>m.conversationId===t.id);return {...t,lastBody:messages.at(-1)?.body||'',unread:messages.filter((m,i)=>m.senderId!==userId&&i>messages.findIndex(x=>x.id===s.read[userId+':'+t.id])).length,blocked:s.blocks.some(([a,b])=>t.participantIds.includes(a)&&t.participantIds.includes(b)),blockedByMe:s.blocks.some(([a,b])=>a===userId&&t.participantIds.includes(b))};}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),nextCursor:null} satisfies ConversationPage;
 }else if(parts[0]==='conversations'){
  const t=thread(parts[1]);
  if(parts.length===2)result={...t,blocked:s.blocks.some(([a,b])=>t.participantIds.includes(a)&&t.participantIds.includes(b)),blockedByMe:s.blocks.some(([a,b])=>a===userId&&t.participantIds.includes(b))};
  else if(parts[2]==='messages'&&parts.length===3){
   if(body){const text=sendMessage.parse(body).body;peerActive(t.participantIds.find(x=>x!==userId)!);const old=s.keys[userId+':'+key];if(old){if(old.thread!==t.id||old.body!==text)throw new Error('This request key was used for another message.');result={id:old.id};}else{const m={id:newId(),conversationId:t.id,senderId:userId,body:text,createdAt:new Date().toISOString()};s.messages.push(m);t.updatedAt=m.createdAt;if(key)s.keys[userId+':'+key]={id:m.id,body:text,thread:t.id};result={id:m.id};}}
   else result={items:s.messages.filter(m=>m.conversationId===t.id).slice(-50),nextCursor:null} satisfies MessagePage;
  }else if(parts[2]==='read'){
   const m=s.messages.find(m=>m.id===(body as {messageId:string}).messageId&&m.conversationId===t.id);if(!m)throw new Error('Message not found.');s.read[userId+':'+t.id]=m.id;result={ok:true};
  }else if(parts[4]==='report'){
   const reason=reportMessage.parse(body).reason,m=s.messages.find(m=>m.id===parts[3]&&m.conversationId===t.id);if(!m||m.senderId===userId)throw new Error('Choose a received message.');let r=s.reports.find(r=>r.messageId===m.id&&r.reporterId===userId);if(!r){r={id:newId(),messageId:m.id,reporterId:userId,senderId:m.senderId,reason,reportedBody:m.body,status:'open',createdAt:new Date().toISOString()};s.reports.push(r);}result={id:r.id};
  }
 }else if(parts[0]==='member-blocks'){
  const b=body as {userId:string;blocked:boolean};if(b.userId===userId)throw new Error('You cannot block yourself.');s.blocks=s.blocks.filter(([a,p])=>!(a===userId&&p===b.userId));if(b.blocked)s.blocks.push([userId,b.userId]);result={ok:true};
 }else if(parts[0]==='message-reports'){
  if(!isModerator(actor))throw new Error('A moderator is required.');
  if(parts.length===1)result=s.reports;
  else{const r=s.reports.find(r=>r.id===parts[1]);if(!r||r.reporterId===userId||r.senderId===userId)throw new Error('An independent moderator must review this report.');r.status='resolved';result={ok:true};}
 }
 if(result===undefined)throw new Error('Messaging action not found.');
 if(body)try{localStorage.setItem('reunir.chat.v1.'+slug,JSON.stringify(s));}catch{}
 return structuredClone(result) as T;
}
