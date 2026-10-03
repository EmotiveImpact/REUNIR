import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {DomainError,id} from '../../contracts/src/index';
import {sendMessage,reportMessage,startGroup,renameGroup,addToGroup,GROUP_LIMIT,type Conversation,type DirectMessage,type ConversationPage,type MessagePage,type MessageReport} from '../../contracts/src/messaging';
import {WorkspaceRepository} from './repository';
import type {SQL} from './connection';
const stamp=(x:unknown)=>x instanceof Date?x.toISOString():String(x);
function cursor(raw?:string|null):[string|null,string|null] {
 if(!raw)return [null,null];
 try {if(raw.length>400)throw 0;const x=z.object({at:z.string().datetime(),id}).strict().parse(JSON.parse(Buffer.from(raw,'base64url').toString('utf8')));return [x.at,x.id];}
 catch {throw new DomainError('BAD_CURSOR','Invalid pagination cursor.');}
}
const next=(at:unknown,id:unknown)=>Buffer.from(JSON.stringify({at:stamp(at),id})).toString('base64url');
function messageCursor(raw?:string|null):string|null {
 if(!raw)return null;
 try { if(raw.length>100)throw 0;return z.string().regex(/^[0-9]{1,20}$/).parse(Buffer.from(raw,'base64url').toString('utf8')); }
 catch {throw new DomainError('BAD_CURSOR','Invalid message pagination cursor.');}
}
/** Groups never report blocks: a block pauses only the direct thread between the two people. */
const BLOCKED="c.kind='direct' AND EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=ANY(c.participant_ids) AND b.blocked_user_id=ANY(c.participant_ids))";
const shape=(x:Record<string,any>):Conversation=>({id:x.id,kind:x.kind,title:x.title??null,createdBy:x.created_by??null,participantIds:x.participant_ids,createdAt:stamp(x.created_at),updatedAt:stamp(x.updated_at),lastBody:x.last_body||'',unread:x.unread??0,blocked:x.blocked,blockedByMe:x.blocked_by_me});
const keySchema=z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
export class MessagingRepository {
 constructor(readonly repo:WorkspaceRepository){}
 private async thread(sql:SQL,orgId:string,userId:string,threadId:string,lock=false){
  id.parse(threadId);
  const r=await sql.query<{id:string;kind:'direct'|'group';participant_ids:string[];created_by:string|null}>('SELECT id,kind,participant_ids,created_by FROM conversations WHERE organization_id=$1 AND id=$2 AND $3=ANY(participant_ids)'+(lock?' FOR UPDATE':''),[orgId,threadId,userId]);
  if(!r.rows[0])throw new DomainError('NOT_FOUND','Conversation not found.',404);return r.rows[0];
 }
 private async activePeer(sql:SQL,orgId:string,userId:string,peerId:string){
  if(peerId===userId)throw new DomainError('SELF_MESSAGE','Choose another member.');
  const m=await sql.query("SELECT user_id FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'",[orgId,peerId]);
  if(!m.rows.length)throw new DomainError('NOT_FOUND','This member is not available.',404);
  const b=await sql.query('SELECT 1 FROM member_blocks WHERE organization_id=$1 AND ((user_id=$2 AND blocked_user_id=$3) OR (user_id=$3 AND blocked_user_id=$2))',[orgId,userId,peerId]);
  if(b.rows.length)throw new DomainError('MESSAGING_UNAVAILABLE','Messaging is not available between these members.',403);
 }
 async start(slug:string,userId:string,peerId:string){id.parse(peerId);return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.activePeer(sql,String(org.id),userId,peerId);const pair=[userId,peerId].sort();
  const key=createHash('sha256').update(JSON.stringify(pair)).digest('hex');
  const r=await sql.query<{id:string}>('INSERT INTO conversations(organization_id,id,participant_ids,pair_key) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,pair_key) DO UPDATE SET pair_key=EXCLUDED.pair_key RETURNING id',[org.id,randomUUID(),pair,key]);return r.rows[0];
 });}
 async detail(slug:string,userId:string,threadId:string):Promise<Conversation>{return this.repo.within(slug,userId,false,async(sql,org)=>{
  const row=await this.thread(sql,String(org.id),userId,threadId);
  const r=await sql.query<Record<string,any>>(`SELECT c.*,${BLOCKED} AS blocked,c.kind='direct' AND EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=$3 AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked_by_me FROM conversations c WHERE c.organization_id=$1 AND c.id=$2`,[org.id,row.id,userId]);
  return shape({...r.rows[0],last_body:'',unread:0});
 });}
 async list(slug:string,userId:string,before?:string|null):Promise<ConversationPage>{const [at,afterId]=cursor(before);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const r=await sql.query<Record<string,any>>(`SELECT c.*,(SELECT body FROM messages m WHERE m.organization_id=c.organization_id AND m.conversation_id=c.id ORDER BY sequence DESC LIMIT 1) AS last_body,(SELECT count(*)::int FROM messages m WHERE m.organization_id=c.organization_id AND m.conversation_id=c.id AND m.sender_id<>$2 AND m.sequence>coalesce((SELECT last_read_sequence FROM message_receipts r WHERE r.organization_id=c.organization_id AND r.conversation_id=c.id AND r.user_id=$2),0)) AS unread,${BLOCKED} AS blocked,c.kind='direct' AND EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=$2 AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked_by_me FROM conversations c WHERE c.organization_id=$1 AND $2=ANY(c.participant_ids) AND ($3::timestamptz IS NULL OR (c.updated_at,c.id)<($3,$4)) ORDER BY c.updated_at DESC,c.id DESC LIMIT 51`,[org.id,userId,at,afterId]);
  const rows=r.rows.slice(0,50);return {items:rows.map(shape),nextCursor:r.rows.length>50?next(rows.at(-1)!.updated_at,rows.at(-1)!.id):null};
 });}
 async messages(slug:string,userId:string,threadId:string,before?:string|null):Promise<MessagePage>{const beforeSequence=messageCursor(before);return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.thread(sql,String(org.id),userId,threadId);
  const r=await sql.query<Record<string,any>>('SELECT id,conversation_id,sender_id,body,created_at,sequence::text AS sequence_text FROM messages WHERE organization_id=$1 AND conversation_id=$2 AND ($3::bigint IS NULL OR sequence<$3) ORDER BY sequence DESC LIMIT 51',[org.id,threadId,beforeSequence]);
  const rows=r.rows.slice(0,50);return {items:rows.map(x=>({id:x.id,conversationId:x.conversation_id,senderId:x.sender_id,body:x.body,createdAt:stamp(x.created_at)})).reverse(),nextCursor:r.rows.length>50?Buffer.from(rows.at(-1)!.sequence_text).toString('base64url'):null};
 });}
 async send(slug:string,userId:string,threadId:string,body:string,requestKey:string){body=sendMessage.parse({body}).body;keySchema.parse(requestKey);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const t=await this.thread(sql,String(org.id),userId,threadId,true);
  // A direct thread needs the other person active and unblocked; a group carries on for whoever is still in it.
  if(t.kind==='direct')await this.activePeer(sql,String(org.id),userId,t.participant_ids.find(x=>x!==userId)!);
  const old=await sql.query<{id:string;body:string;conversation_id:string}>('SELECT id,body,conversation_id FROM messages WHERE organization_id=$1 AND sender_id=$2 AND request_key=$3',[org.id,userId,requestKey]);
  if(old.rows[0]){if(old.rows[0].body!==body||old.rows[0].conversation_id!==threadId)throw new DomainError('KEY_REUSED','This request key was used for another message.',409);return {id:old.rows[0].id};}
  const messageId=randomUUID();await sql.query('INSERT INTO messages(organization_id,id,conversation_id,sender_id,body,request_key) VALUES($1,$2,$3,$4,$5,$6)',[org.id,messageId,threadId,userId,body,requestKey]);
  await sql.query('UPDATE conversations SET updated_at=now() WHERE organization_id=$1 AND id=$2',[org.id,threadId]);
  return {id:messageId};
 });}
 async read(slug:string,userId:string,threadId:string,messageId:string){id.parse(messageId);return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.thread(sql,String(org.id),userId,threadId);
  const m=await sql.query<{created_at:Date;sequence:string}>('SELECT created_at,sequence::text FROM messages WHERE organization_id=$1 AND conversation_id=$2 AND id=$3',[org.id,threadId,messageId]);
  if(!m.rows[0])throw new DomainError('NOT_FOUND','Message not found.',404);
  await sql.query('INSERT INTO message_receipts(organization_id,conversation_id,user_id,last_read_at,last_read_sequence) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,conversation_id,user_id) DO UPDATE SET last_read_at=greatest(message_receipts.last_read_at,EXCLUDED.last_read_at),last_read_sequence=greatest(message_receipts.last_read_sequence,EXCLUDED.last_read_sequence)',[org.id,threadId,userId,m.rows[0].created_at,m.rows[0].sequence]);return {ok:true};
 });}
 async block(slug:string,userId:string,peerId:string,blocked:boolean){id.parse(peerId);if(userId===peerId)throw new DomainError('SELF_BLOCK','You cannot block yourself.');return this.repo.within(slug,userId,false,async(sql,org)=>{
  await sql.query("SELECT id FROM conversations WHERE organization_id=$1 AND kind='direct' AND $2=ANY(participant_ids) AND $3=ANY(participant_ids) FOR UPDATE",[org.id,userId,peerId]);
  if(blocked){const m=await sql.query('SELECT 1 FROM members WHERE organization_id=$1 AND user_id=$2',[org.id,peerId]);if(!m.rows.length)throw new DomainError('NOT_FOUND','Member not found.',404);
   await sql.query('INSERT INTO member_blocks(organization_id,user_id,blocked_user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[org.id,userId,peerId]);
  }else await sql.query('DELETE FROM member_blocks WHERE organization_id=$1 AND user_id=$2 AND blocked_user_id=$3',[org.id,userId,peerId]);return {ok:true};
 });}
 async report(slug:string,userId:string,threadId:string,messageId:string,reason:string){reason=reportMessage.parse({reason}).reason;return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.thread(sql,String(org.id),userId,threadId);
  const m=(await sql.query<{id:string;body:string;sender_id:string}>('SELECT id,body,sender_id FROM messages WHERE organization_id=$1 AND conversation_id=$2 AND id=$3',[org.id,threadId,messageId])).rows[0];
  if(!m)throw new DomainError('NOT_FOUND','Message not found.',404);
  if(m.sender_id===userId)throw new DomainError('OWN_REPORT','Choose a received message.');
  const r=await sql.query<{id:string}>(`INSERT INTO message_reports(organization_id,id,message_id,conversation_id,reporter_id,sender_id,reason,reported_body) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,message_id,reporter_id) DO UPDATE SET message_id=EXCLUDED.message_id RETURNING id`,[org.id,randomUUID(),m.id,threadId,userId,m.sender_id,reason,m.body]);return r.rows[0];
 });}
 /** Someone can be put in a group by a member they have no block with, either way round, while both are active. */
 private async addable(sql:SQL,orgId:string,userId:string,ids:string[]){
  for(const peer of ids){
   if(peer===userId)throw new DomainError('SELF_MESSAGE','You are already in this group.');
   await this.activePeer(sql,orgId,userId,peer).catch(e=>{throw e instanceof DomainError&&e.code==='MESSAGING_UNAVAILABLE'?new DomainError('MESSAGING_UNAVAILABLE','One of the people you chose cannot be added by you.',403):e;});
  }
 }
 private async group(sql:SQL,orgId:string,userId:string,threadId:string){
  const t=await this.thread(sql,orgId,userId,threadId,true);
  if(t.kind!=='group')throw new DomainError('NOT_A_GROUP','This is a conversation between two people.');return t;
 }
 async startGroup(slug:string,userId:string,raw:unknown){const b=startGroup.parse(raw),others=[...new Set(b.userIds)];if(others.length<2)throw new DomainError('VALIDATION','Choose at least two people.');return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.addable(sql,String(org.id),userId,others);const groupId=randomUUID();
  await sql.query("INSERT INTO conversations(organization_id,id,kind,title,created_by,participant_ids,pair_key) VALUES($1,$2,'group',$3,$4,$5,$6)",[org.id,groupId,b.title,userId,[userId,...others],'group:'+groupId]);
  return {id:groupId};
 });}
 async rename(slug:string,userId:string,threadId:string,raw:unknown){const b=renameGroup.parse(raw);return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.group(sql,String(org.id),userId,threadId);
  await sql.query('UPDATE conversations SET title=$3 WHERE organization_id=$1 AND id=$2',[org.id,threadId,b.title]);return {ok:true};
 });}
 /** People added later read only what is written after they join; see migration 0022. */
 async add(slug:string,userId:string,threadId:string,raw:unknown){const b=addToGroup.parse(raw);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const t=await this.group(sql,String(org.id),userId,threadId),fresh=[...new Set(b.userIds)].filter(x=>!t.participant_ids.includes(x));
  if(!fresh.length)return {ok:true,added:0};
  if(t.participant_ids.length+fresh.length>GROUP_LIMIT)throw new DomainError('GROUP_FULL',`A group holds at most ${GROUP_LIMIT} people.`);
  await this.addable(sql,String(org.id),userId,fresh);
  // Anything this member cannot read is at or before their own join point, so the larger of the two is the newest message.
  const newest=(await sql.query<{n:string}>('SELECT greatest(coalesce((SELECT max(sequence) FROM messages WHERE organization_id=$1 AND conversation_id=$2),0),coalesce((SELECT after_sequence FROM conversation_joins WHERE organization_id=$1 AND conversation_id=$2 AND user_id=$3),0))::text AS n',[org.id,threadId,userId])).rows[0].n;
  for(const peer of fresh)await sql.query('INSERT INTO conversation_joins(organization_id,conversation_id,user_id,after_sequence,added_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,conversation_id,user_id) DO UPDATE SET after_sequence=EXCLUDED.after_sequence,added_by=EXCLUDED.added_by,joined_at=now()',[org.id,threadId,peer,newest,userId]);
  await sql.query('UPDATE conversations SET participant_ids=participant_ids||$3::text[] WHERE organization_id=$1 AND id=$2',[org.id,threadId,fresh]);
  return {ok:true,added:fresh.length};
 });}
 /** Leaving takes the member out of the list; their messages stay for the others. No RETURNING: they can no longer read the row. */
 async leave(slug:string,userId:string,threadId:string){return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.group(sql,String(org.id),userId,threadId);
  // The updated row no longer names them, so it must stay readable for this statement (migration 0022), and only this one.
  await sql.query("SELECT set_config('app.leaving_conversation',$1,true)",[threadId]);
  await sql.query('UPDATE conversations SET participant_ids=array_remove(participant_ids,$3) WHERE organization_id=$1 AND id=$2',[org.id,threadId,userId]);
  await sql.query("SELECT set_config('app.leaving_conversation','',true)");return {ok:true};
 });}
 /** Only the person who started the group removes others, while they are still in it. */
 async remove(slug:string,userId:string,threadId:string,peerId:string){id.parse(peerId);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const t=await this.group(sql,String(org.id),userId,threadId);
  if(peerId===userId)throw new DomainError('USE_LEAVE','Leave the group instead.');
  if(t.created_by!==userId)throw new DomainError('FORBIDDEN','Only the person who started this group can remove people.',403);
  if(!t.participant_ids.includes(peerId))throw new DomainError('NOT_FOUND','This person is not in the group.',404);
  await sql.query('UPDATE conversations SET participant_ids=array_remove(participant_ids,$3) WHERE organization_id=$1 AND id=$2',[org.id,threadId,peerId]);return {ok:true};
 });}
 private async moderator(sql:SQL,orgId:string,userId:string){const m=await sql.query<{role:string}>("SELECT role FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'",[orgId,userId]);if(!['owner','admin','moderator'].includes(m.rows[0]?.role))throw new DomainError('FORBIDDEN','A moderator is required.',403);}
 async reports(slug:string,userId:string):Promise<MessageReport[]>{return this.repo.within(slug,userId,false,async(sql,org)=>{await this.moderator(sql,String(org.id),userId);return (await sql.query<Record<string,any>>('SELECT * FROM message_reports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100',[org.id])).rows.map(x=>({id:x.id,messageId:x.message_id,senderId:x.sender_id,reporterId:x.reporter_id,reason:x.reason,reportedBody:x.reported_body,status:x.status,createdAt:stamp(x.created_at)}));});}
 async resolve(slug:string,userId:string,reportId:string){return this.repo.within(slug,userId,false,async(sql,org)=>{await this.moderator(sql,String(org.id),userId);const r=await sql.query("UPDATE message_reports SET status='resolved',reviewed_by=$3,reviewed_at=now() WHERE organization_id=$1 AND id=$2 AND sender_id<>$3 AND reporter_id<>$3 RETURNING id",[org.id,reportId,userId]);if(!r.rows.length)throw new DomainError('INDEPENDENT_REVIEW','An independent moderator must review this report.',403);return {ok:true};});}
}
