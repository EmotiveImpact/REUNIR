import {z} from 'zod';
import {id} from './index';
/** A group holds at most this many people, the person who started it included. */
export const GROUP_LIMIT=20;
const groupTitle=z.string().trim().min(1,'Give the group a name.').max(80);
export const startConversation=z.object({userId:id}).strict();
export const startGroup=z.object({title:groupTitle,userIds:z.array(id).min(2,'Choose at least two people.').max(GROUP_LIMIT-1)}).strict();
export const renameGroup=z.object({title:groupTitle}).strict();
export const addToGroup=z.object({userIds:z.array(id).min(1).max(GROUP_LIMIT-1)}).strict();
export const sendMessage=z.object({body:z.string().trim().min(1).max(4000)}).strict();
export const reportMessage=z.object({reason:z.string().trim().min(5).max(1000)}).strict();
/** A reporter asks once for a closed report to be looked at again, by a moderator other than the one who closed it (decision 058). */
export const askSecondLook=z.object({reason:z.string().trim().min(5,'Say in a few words why the report needs another look.').max(1000)}).strict();
export interface DirectMessage {id:string;conversationId:string;senderId:string;body:string;createdAt:string}
/** `kind` is 'direct' for the one thread between two members and 'group' for a named group; groups never report blocks. */
export interface Conversation {id:string;kind:'direct'|'group';title:string|null;createdBy:string|null;participantIds:string[];createdAt:string;updatedAt:string;lastBody:string;unread:number;blocked:boolean;blockedByMe:boolean}
export interface MessagePage {items:DirectMessage[];nextCursor:string|null}
export interface ConversationPage {items:Conversation[];nextCursor:string|null}
export interface MessageReport {id:string;messageId:string;senderId:string;reporterId:string;reason:string;reportedBody:string;status:'open'|'resolved';createdAt:string;
 /** When it was last closed. A second look reopens it: `secondLook` is the reporter's reason and `firstReviewedBy` the moderator who closed it first. */
 reviewedAt?:string|null;secondLook?:string|null;secondLookAt?:string|null;firstReviewedBy?:string|null}
/** A report as the person who made it sees it: never who reviewed it. */
export type OwnMessageReport=Pick<MessageReport,'id'|'messageId'|'senderId'|'reason'|'reportedBody'|'status'|'createdAt'|'reviewedAt'|'secondLook'|'secondLookAt'>;
