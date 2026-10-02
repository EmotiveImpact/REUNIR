import {z} from 'zod';
import {id} from './index';
export const startConversation=z.object({userId:id}).strict();
export const sendMessage=z.object({body:z.string().trim().min(1).max(4000)}).strict();
export const reportMessage=z.object({reason:z.string().trim().min(5).max(1000)}).strict();
export interface DirectMessage {id:string;conversationId:string;senderId:string;body:string;createdAt:string}
export interface Conversation {id:string;participantIds:string[];createdAt:string;updatedAt:string;lastBody:string;unread:number;blocked:boolean;blockedByMe:boolean}
export interface MessagePage {items:DirectMessage[];nextCursor:string|null}
export interface ConversationPage {items:Conversation[];nextCursor:string|null}
export interface MessageReport {id:string;messageId:string;senderId:string;reporterId:string;reason:string;reportedBody:string;status:'open'|'resolved';createdAt:string}
