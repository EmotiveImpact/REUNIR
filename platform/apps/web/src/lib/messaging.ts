import {api,mode,demoState,commitDemo} from './data';
import {newId} from '../../../../packages/contracts/src/index';
import {sendMessage,reportMessage,askSecondLook,startGroup,renameGroup,addToGroup,GROUP_LIMIT,type Conversation,type DirectMessage,type MessageReport,type ConversationPage,type MessagePage} from '../../../../packages/contracts/src/messaging';
import {actorFor,isModerator} from '../../../../packages/domain/src/access';
import {APPEALS_HREF} from '../../../../packages/contracts/src/appeals';
/** In the demo a report also remembers who closed it, which the moderators' list and the reporter's own list never show. */
type DemoReport=MessageReport&{reviewedBy?:string|null};
/** `joined` counts the messages a thread already had when someone was added to a group; they read only what follows. */
interface DemoChat {threads:Conversation[];messages:DirectMessage[];read:Record<string,string>;blocks:[string,string][];reports:DemoReport[];keys:Record<string,{id:string;body:string;thread:string}>;joined?:Record<string,number>}
const memory:Record<string,DemoChat>={};
window.addEventListener('reunir:reset-demo',()=>{for(const key of Object.keys(memory))delete memory[key];});
/** Demo inboxes saved before Alpha 24 hold only direct threads. */
const upgrade=(s:DemoChat):DemoChat=>({...s,joined:s.joined||{},threads:s.threads.map(t=>({...t,kind:t.kind||'direct',title:t.title??null,createdBy:t.createdBy??null}))});
function store(slug:string):DemoChat {
 if(memory[slug])return memory[slug];
 try {const raw=localStorage.getItem('reunir.chat.v1.'+slug);if(raw){memory[slug]=upgrade(JSON.parse(raw));return memory[slug];}}catch{}
 const now=new Date().toISOString();
 return memory[slug]={joined:{},threads:[{id:'conversation_welcome',kind:'direct',title:null,createdBy:null,participantIds:['member_alex','member_amina'],createdAt:now,updatedAt:now,lastBody:'',unread:1,blocked:false,blockedByMe:false}],messages:[{id:'message_welcome',conversationId:'conversation_welcome',senderId:'member_amina',body:'Welcome, Alex. What are you working towards, and what would help you take your next step?',createdAt:now}],read:{},blocks:[],reports:[],keys:{}};
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
 // Blocks pause only direct threads, as on the server.
 const blocks=(t:Conversation)=>t.kind==='group'?{blocked:false,blockedByMe:false}:{blocked:s.blocks.some(([a,b])=>t.participantIds.includes(a)&&t.participantIds.includes(b)),blockedByMe:s.blocks.some(([a,b])=>a===userId&&t.participantIds.includes(b))};
 const visible=(t:Conversation)=>s.messages.filter(m=>m.conversationId===t.id).slice(s.joined![userId+':'+t.id]||0);
 const group=(t:Conversation)=>{if(t.kind!=='group')throw new Error('This is a conversation between two people.');return t;};
 const addable=(ids:string[])=>{for(const peer of ids){if(peer===userId)throw new Error('You are already in this group.');try{peerActive(peer);}catch(e){throw (e as Error).message.startsWith('Messaging')?new Error('One of the people you chose cannot be added by you.'):e;}}};
 let result:any;
 if(parts[0]==='conversation-groups'&&body){
  const b=startGroup.parse(body),others=[...new Set(b.userIds)];if(others.length<2)throw new Error('Choose at least two people.');addable(others);
  const now=new Date().toISOString(),t:Conversation={id:newId(),kind:'group',title:b.title,createdBy:userId,participantIds:[userId,...others],createdAt:now,updatedAt:now,lastBody:'',unread:0,blocked:false,blockedByMe:false};s.threads.unshift(t);result={id:t.id};
 }else if(parts[0]==='conversations'&&parts.length===1){
  if(body){const peer=(body as {userId:string}).userId;peerActive(peer);let t=s.threads.find(t=>t.kind==='direct'&&t.participantIds.includes(userId)&&t.participantIds.includes(peer));if(!t){const now=new Date().toISOString();t={id:newId(),kind:'direct',title:null,createdBy:null,participantIds:[userId,peer],createdAt:now,updatedAt:now,lastBody:'',unread:0,blocked:false,blockedByMe:false};s.threads.unshift(t);}result={id:t.id};}
  else result={items:s.threads.filter(t=>t.participantIds.includes(userId)).map(t=>{const messages=visible(t);return {...t,lastBody:messages.at(-1)?.body||'',unread:messages.filter((m,i)=>m.senderId!==userId&&i>messages.findIndex(x=>x.id===s.read[userId+':'+t.id])).length,...blocks(t)};}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),nextCursor:null} satisfies ConversationPage;
 }else if(parts[0]==='conversations'){
  const t=thread(parts[1]);
  if(parts.length===2)result={...t,...blocks(t)};
  else if(parts[2]==='title'&&body){group(t).title=renameGroup.parse(body).title;result={ok:true};}
  else if(parts[2]==='leave'){group(t).participantIds=t.participantIds.filter(x=>x!==userId);result={ok:true};}
  else if(parts[2]==='participants'&&parts[4]==='remove'){
   const peer=parts[3];group(t);if(peer===userId)throw new Error('Leave the group instead.');if(t.createdBy!==userId)throw new Error('Only the person who started this group can remove people.');if(!t.participantIds.includes(peer))throw new Error('This person is not in the group.');t.participantIds=t.participantIds.filter(x=>x!==peer);result={ok:true};
  }else if(parts[2]==='participants'&&body){
   const fresh=[...new Set(addToGroup.parse(body).userIds)].filter(x=>!group(t).participantIds.includes(x));
   if(fresh.length){if(t.participantIds.length+fresh.length>GROUP_LIMIT)throw new Error(`A group holds at most ${GROUP_LIMIT} people.`);addable(fresh);const count=s.messages.filter(m=>m.conversationId===t.id).length;for(const peer of fresh)s.joined![peer+':'+t.id]=count;t.participantIds=[...t.participantIds,...fresh];}
   result={ok:true,added:fresh.length};
  }
  else if(parts[2]==='messages'&&parts.length===3){
   if(body){const text=sendMessage.parse(body).body;if(t.kind==='direct')peerActive(t.participantIds.find(x=>x!==userId)!);const old=s.keys[userId+':'+key];if(old){if(old.thread!==t.id||old.body!==text)throw new Error('This request key was used for another message.');result={id:old.id};}else{const m={id:newId(),conversationId:t.id,senderId:userId,body:text,createdAt:new Date().toISOString()};s.messages.push(m);t.updatedAt=m.createdAt;if(key)s.keys[userId+':'+key]={id:m.id,body:text,thread:t.id};result={id:m.id};}}
   else result={items:visible(t).slice(-50),nextCursor:null} satisfies MessagePage;
  }else if(parts[2]==='read'){
   const m=visible(t).find(m=>m.id===(body as {messageId:string}).messageId&&m.conversationId===t.id);if(!m)throw new Error('Message not found.');s.read[userId+':'+t.id]=m.id;result={ok:true};
  }else if(parts[4]==='report'){
   const reason=reportMessage.parse(body).reason,m=visible(t).find(m=>m.id===parts[3]&&m.conversationId===t.id);if(!m||m.senderId===userId)throw new Error('Choose a received message.');let r=s.reports.find(r=>r.messageId===m.id&&r.reporterId===userId);if(!r){r={id:newId(),messageId:m.id,reporterId:userId,senderId:m.senderId,reason,reportedBody:m.body,status:'open',createdAt:new Date().toISOString()};s.reports.push(r);}result={id:r.id};
  }
 }else if(parts[0]==='member-blocks'){
  const b=body as {userId:string;blocked:boolean};if(b.userId===userId)throw new Error('You cannot block yourself.');s.blocks=s.blocks.filter(([a,p])=>!(a===userId&&p===b.userId));if(b.blocked)s.blocks.push([userId,b.userId]);result={ok:true};
 }else if(parts[0]==='message-reports'&&parts[1]==='mine'){
  result=s.reports.filter(r=>r.reporterId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(({reporterId:_,reviewedBy:__,firstReviewedBy:___,...own})=>own);
 }else if(parts[0]==='message-reports'&&parts[2]==='second-look'){
  const reason=askSecondLook.parse(body).reason,r=s.reports.find(r=>r.id===parts[1]&&r.reporterId===userId);
  if(!r)throw new Error('That report is not available.');
  if(r.secondLook)throw new Error('You have already asked for a second look at this report.');
  if(r.status!=='resolved')throw new Error('This report is still waiting for a moderator.');
  Object.assign(r,{status:'open',secondLook:reason,secondLookAt:new Date().toISOString(),firstReviewedBy:r.reviewedBy??null,reviewedBy:null,reviewedAt:null});result={ok:true};
 }else if(parts[0]==='message-reports'){
  if(!isModerator(actor))throw new Error('A moderator is required.');
  if(parts.length===1)result=[...s.reports].sort((a,b)=>Number(b.status==='open')-Number(a.status==='open')||b.createdAt.localeCompare(a.createdAt)).map(({reviewedBy:_,...r})=>r);
  else{const r=s.reports.find(r=>r.id===parts[1]);if(!r||r.reporterId===userId||r.senderId===userId)throw new Error('An independent moderator must review this report.');
   if(r.firstReviewedBy===userId)throw new Error('You closed this report the first time, so another moderator takes the second look.');
   if(r.status==='open'){Object.assign(r,{status:'resolved',reviewedBy:userId,reviewedAt:new Date().toISOString()});
    // The person who reported it is told, without naming the moderator.
    const again=!!r.secondLook,next=structuredClone(w);
    if(next.members.some(m=>m.userId===r.reporterId&&m.status!=='left')){next.notifications.push({id:newId(),organizationId:w.organisation.id,createdAt:new Date().toISOString(),userId:r.reporterId,title:again?'Your report was looked at again':'Your report was reviewed',body:again?'Another moderator looked again at the private message you reported and closed the report.':'A moderator reviewed the private message you reported and closed the report. If you think it needs another look, you can ask once.',href:APPEALS_HREF,readAt:null});next.revision++;commitDemo(slug,next);}}
   result={ok:true};}
 }
 if(result===undefined)throw new Error('Messaging action not found.');
 if(body)try{localStorage.setItem('reunir.chat.v1.'+slug,JSON.stringify(s));}catch{}
 return structuredClone(result) as T;
}
