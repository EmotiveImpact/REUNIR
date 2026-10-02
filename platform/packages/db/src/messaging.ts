import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {DomainError,id} from '../../contracts/src/index';
import {sendMessage,reportMessage,type Conversation,type DirectMessage,type ConversationPage,type MessagePage,type MessageReport} from '../../contracts/src/messaging';
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
const keySchema=z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
export class MessagingRepository {
 constructor(readonly repo:WorkspaceRepository){}
 private async thread(sql:SQL,orgId:string,userId:string,threadId:string,lock=false){
  id.parse(threadId);
  const r=await sql.query<{id:string;participant_ids:string[]}>('SELECT id,participant_ids FROM conversations WHERE organization_id=$1 AND id=$2 AND $3=ANY(participant_ids)'+(lock?' FOR UPDATE':''),[orgId,threadId,userId]);
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
  const r=await sql.query<Record<string,any>>(`SELECT c.*,EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=ANY(c.participant_ids) AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked,EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=$3 AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked_by_me FROM conversations c WHERE c.organization_id=$1 AND c.id=$2`,[org.id,row.id,userId]);
  const x=r.rows[0];return {id:x.id,participantIds:x.participant_ids,createdAt:stamp(x.created_at),updatedAt:stamp(x.updated_at),lastBody:'',unread:0,blocked:x.blocked,blockedByMe:x.blocked_by_me};
 });}
 async list(slug:string,userId:string,before?:string|null):Promise<ConversationPage>{const [at,afterId]=cursor(before);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const r=await sql.query<Record<string,any>>(`SELECT c.*,(SELECT body FROM messages m WHERE m.organization_id=c.organization_id AND m.conversation_id=c.id ORDER BY sequence DESC LIMIT 1) AS last_body,(SELECT count(*)::int FROM messages m WHERE m.organization_id=c.organization_id AND m.conversation_id=c.id AND m.sender_id<>$2 AND m.sequence>coalesce((SELECT last_read_sequence FROM message_receipts r WHERE r.organization_id=c.organization_id AND r.conversation_id=c.id AND r.user_id=$2),0)) AS unread,EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=ANY(c.participant_ids) AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked,EXISTS(SELECT 1 FROM member_blocks b WHERE b.organization_id=c.organization_id AND b.user_id=$2 AND b.blocked_user_id=ANY(c.participant_ids)) AS blocked_by_me FROM conversations c WHERE c.organization_id=$1 AND $2=ANY(c.participant_ids) AND ($3::timestamptz IS NULL OR (c.updated_at,c.id)<($3,$4)) ORDER BY c.updated_at DESC,c.id DESC LIMIT 51`,[org.id,userId,at,afterId]);
  const rows=r.rows.slice(0,50);return {items:rows.map(x=>({id:x.id,participantIds:x.participant_ids,createdAt:stamp(x.created_at),updatedAt:stamp(x.updated_at),lastBody:x.last_body||'',unread:x.unread,blocked:x.blocked,blockedByMe:x.blocked_by_me})),nextCursor:r.rows.length>50?next(rows.at(-1)!.updated_at,rows.at(-1)!.id):null};
 });}
 async messages(slug:string,userId:string,threadId:string,before?:string|null):Promise<MessagePage>{const beforeSequence=messageCursor(before);return this.repo.within(slug,userId,false,async(sql,org)=>{
  await this.thread(sql,String(org.id),userId,threadId);
  const r=await sql.query<Record<string,any>>('SELECT id,conversation_id,sender_id,body,created_at,sequence::text AS sequence_text FROM messages WHERE organization_id=$1 AND conversation_id=$2 AND ($3::bigint IS NULL OR sequence<$3) ORDER BY sequence DESC LIMIT 51',[org.id,threadId,beforeSequence]);
  const rows=r.rows.slice(0,50);return {items:rows.map(x=>({id:x.id,conversationId:x.conversation_id,senderId:x.sender_id,body:x.body,createdAt:stamp(x.created_at)})).reverse(),nextCursor:r.rows.length>50?Buffer.from(rows.at(-1)!.sequence_text).toString('base64url'):null};
 });}
 async send(slug:string,userId:string,threadId:string,body:string,requestKey:string){body=sendMessage.parse({body}).body;keySchema.parse(requestKey);return this.repo.within(slug,userId,false,async(sql,org)=>{
  const t=await this.thread(sql,String(org.id),userId,threadId,true),peer=t.participant_ids.find(x=>x!==userId)!;
  await this.activePeer(sql,String(org.id),userId,peer);
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
  await sql.query('SELECT id FROM conversations WHERE organization_id=$1 AND $2=ANY(participant_ids) AND $3=ANY(participant_ids) FOR UPDATE',[org.id,userId,peerId]);
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
 private async moderator(sql:SQL,orgId:string,userId:string){const m=await sql.query<{role:string}>("SELECT role FROM members WHERE organization_id=$1 AND user_id=$2 AND status='active'",[orgId,userId]);if(!['owner','admin','moderator'].includes(m.rows[0]?.role))throw new DomainError('FORBIDDEN','A moderator is required.',403);}
 async reports(slug:string,userId:string):Promise<MessageReport[]>{return this.repo.within(slug,userId,false,async(sql,org)=>{await this.moderator(sql,String(org.id),userId);return (await sql.query<Record<string,any>>('SELECT * FROM message_reports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100',[org.id])).rows.map(x=>({id:x.id,messageId:x.message_id,senderId:x.sender_id,reporterId:x.reporter_id,reason:x.reason,reportedBody:x.reported_body,status:x.status,createdAt:stamp(x.created_at)}));});}
 async resolve(slug:string,userId:string,reportId:string){return this.repo.within(slug,userId,false,async(sql,org)=>{await this.moderator(sql,String(org.id),userId);const r=await sql.query("UPDATE message_reports SET status='resolved',reviewed_by=$3,reviewed_at=now() WHERE organization_id=$1 AND id=$2 AND sender_id<>$3 AND reporter_id<>$3 RETURNING id",[org.id,reportId,userId]);if(!r.rows.length)throw new DomainError('INDEPENDENT_REVIEW','An independent moderator must review this report.',403);return {ok:true};});}
}
