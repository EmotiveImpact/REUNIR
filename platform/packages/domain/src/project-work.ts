import { DomainError, type Workspace, type Member, type ProjectTask, type Project, type Command, type TenantContext } from '../../contracts/src/index';
import { actorFor, canSeeSpace, isAdmin, isFormer } from './access';
import { applyPurposeCommand } from './purpose';

export type TaskStage = 'todo' | 'doing' | 'review' | 'done';
export const TASK_STAGES: {id:TaskStage;label:string}[] = [
    {id:'todo',label:'Ready to start'},{id:'doing',label:'In progress'},
    {id:'review',label:'In review'},{id:'done',label:'Recognised'}
];
export function canWorkOnProject(s:Workspace,m:Member,p:Project):boolean {
    return m.status==='active' && m.organizationId===p.organizationId && canSeeSpace(s,m,p.spaceId)
        && (isAdmin(m) || p.ownerId===m.userId || s.projectMembers.some(x=>x.projectId===p.id&&x.userId===m.userId&&x.organizationId===p.organizationId));
}
export function taskStage(s:Workspace,t:ProjectTask):TaskStage {
    const c=t.contributionId?s.contributions.find(x=>x.id===t.contributionId&&x.projectId===t.projectId&&x.organizationId===t.organizationId):null;
    return c?.status==='recognised'?'done':c?.status==='submitted'?'review':c?.status==='changes_requested'||c?.status==='withdrawn'?'doing':t.workState;
}
export function taskNeedsChanges(s:Workspace,t:ProjectTask):boolean {return s.contributions.some(c=>c.id===t.contributionId&&c.status==='changes_requested');}
export function normaliseProjectWork(s:Workspace):Workspace {s.projectTasks??=[];s.taskNotes??=[];return s;}
export function filterProjectWork(s:Workspace,actor:Member):Workspace {
    const projects=new Set(s.projects.filter(p=>canWorkOnProject(s,actor,p)).map(p=>p.id));
    s.projectTasks=s.projectTasks.filter(t=>t.organizationId===actor.organizationId&&projects.has(t.projectId));
    const tasks=new Set(s.projectTasks.map(t=>t.id));
    s.taskNotes=s.taskNotes.filter(n=>n.organizationId===actor.organizationId&&projects.has(n.projectId)&&tasks.has(n.taskId)).map(n=>n.hidden?{...n,body:''}:n);
    return s;
}
const types=new Set(['task.create','task.edit','task.claim','task.release','task.move','task.archive','task.submit','task.note','task.note.hide']);
/** Reuses the command transaction, review engine, notification table and outbox. */
export function applyProjectWork(s:Workspace,ctx:TenantContext,cmd:Command,now:string,makeId:()=>string) {
    if(!types.has(cmd.type))return undefined;
    const actor=actorFor(s,ctx);
    const fail=(code:string,message:string,status=409):never=>{throw new DomainError(code,message,status);};
    const missing=():never=>fail('NOT_FOUND','This project work is not available.',404);
    const base=()=>({id:makeId(),organizationId:ctx.organizationId,createdAt:now});
    const project=(id:string)=>{const p=s.projects.find(x=>x.id===id&&x.organizationId===ctx.organizationId);if(!p||!canWorkOnProject(s,actor,p))return missing();return p;};
    const lead=(p:Project)=>{if(p.ownerId!==ctx.userId&&!isAdmin(actor))fail('PROJECT_LEAD_REQUIRED','The project lead or a community administrator plans this work.',403);};
    const assignee=(p:Project,userId:string|null)=>{if(userId===null)return;const m=s.members.find(x=>x.organizationId===ctx.organizationId&&x.userId===userId&&x.status==='active');
        if(!m||!canSeeSpace(s,m,p.spaceId)||!s.projectMembers.some(x=>x.organizationId===ctx.organizationId&&x.projectId===p.id&&x.userId===userId))fail('INVALID_ASSIGNEE','Choose an active, authorised member of this project.');};
    const task=(id:string)=>{const t=s.projectTasks.find(x=>x.id===id&&x.organizationId===ctx.organizationId);if(!t)return missing();project(t.projectId);return t;};
    const current=(t:ProjectTask,version:number)=>{if(t.version!==version)fail('STALE_TASK','This task changed. Refresh the workspace before trying again.');};
    const open=(t:ProjectTask)=>{if(t.archived)fail('TASK_ARCHIVED','Restore this task before changing it.');};
    const unlocked=(t:ProjectTask)=>{if(t.contributionId)fail('PROOF_LINKED','The brief and assignment stay fixed once proof is submitted. Create a follow-up task for different work.');};
    const mine=(t:ProjectTask)=>{if(t.assigneeId!==ctx.userId)fail('ASSIGNEE_REQUIRED','Only the assigned contributor can do this.',403);};
    const touch=(t:ProjectTask)=>{t.version++;t.updatedAt=now;};
    const notify=(userId:string|null,title:string,projectId:string)=>{
        if(userId&&userId!==ctx.userId&&!isFormer(s,userId))s.notifications.push({...base(),userId,title,body:'Open your project workspace to see the latest authorised details.',href:`/projects/${projectId}/work`,readAt:null});
    };
    const result=(id:string,message:string,changed=true)=>({objectId:id,message,changed,audit:true});
    switch(cmd.type){
        case 'task.create': {
            const p=project(cmd.projectId);lead(p);assignee(p,cmd.assigneeId);
            if(s.projectTasks.filter(x=>x.projectId===p.id&&!x.archived).length>=100)fail('TASK_LIMIT','Keep at most 100 active tasks in a project. Archive finished work first.');
            const {type,projectId,...data}=cmd;
            const t:ProjectTask={...base(),...data,projectId,workState:'todo',contributionId:null,createdBy:ctx.userId,updatedAt:now,version:1,archived:false};
            s.projectTasks.push(t);notify(t.assigneeId,'You have been assigned project work',p.id);return result(t.id,'Task added with a clear definition of done.');
        }
        case 'task.edit': {
            const t=task(cmd.taskId),p=project(t.projectId);lead(p);current(t,cmd.expectedVersion);open(t);unlocked(t);assignee(p,cmd.assigneeId);
            const old=t.assigneeId;const {type,taskId,expectedVersion,...data}=cmd;Object.assign(t,data);touch(t);
            if(old!==t.assigneeId){t.workState='todo';notify(t.assigneeId,'Project work assigned to you',p.id);notify(old,'Your project assignment changed',p.id);}
            return result(t.id,'Task updated.');
        }
        case 'task.claim': {
            const t=task(cmd.taskId),p=project(t.projectId);current(t,cmd.expectedVersion);open(t);unlocked(t);assignee(p,ctx.userId);
            if(t.assigneeId!==null)fail('TASK_TAKEN','This task has already been claimed.');t.assigneeId=ctx.userId;touch(t);notify(p.ownerId,'A teammate claimed project work',p.id);return result(t.id,'This task is yours. Make a useful first step.');
        }
        case 'task.release': {
            const t=task(cmd.taskId);current(t,cmd.expectedVersion);open(t);unlocked(t);mine(t);t.assigneeId=null;t.workState='todo';touch(t);return result(t.id,'Task released for another teammate.');
        }
        case 'task.move': {
            const t=task(cmd.taskId);current(t,cmd.expectedVersion);open(t);unlocked(t);mine(t);
            if(t.workState===cmd.workState)return result(t.id,'Task is already in this stage.',false);
            t.workState=cmd.workState;touch(t);return result(t.id,cmd.workState==='doing'?'Work started. Completion will follow reviewed proof.':'Returned to ready to start.');
        }
        case 'task.archive': {
            const t=task(cmd.taskId),p=project(t.projectId);lead(p);current(t,cmd.expectedVersion);
            if(t.archived===cmd.archived)return result(t.id,'Task already has this archive state.',false);
            if(!cmd.archived&&s.projectTasks.filter(x=>x.projectId===p.id&&!x.archived).length>=100)fail('TASK_LIMIT','Archive another task before restoring this one.');
            t.archived=cmd.archived;touch(t);return result(t.id,cmd.archived?'Task archived. Evidence and notes are preserved.':'Task restored.');
        }
        case 'task.submit': {
            const t=task(cmd.taskId);current(t,cmd.expectedVersion);open(t);mine(t);assignee(project(t.projectId),ctx.userId);
            if(!t.contributionId&&t.workState!=='doing')fail('START_FIRST','Start this task before submitting proof.');
            const previous=t.contributionId?s.contributions.find(c=>c.id===t.contributionId):null;
            if(t.contributionId&&previous?.status!=='changes_requested'&&previous?.status!=='withdrawn')fail('PROOF_LOCKED','This proof is already awaiting review or recognised.');
            // Withdrawn proof stays on record; new proof for the same task is a new contribution with its own review.
            const evidence=applyPurposeCommand(s,ctx,t.contributionId&&previous?.status!=='withdrawn'?{type:'contribution.resubmit',contributionId:t.contributionId,title:t.title,body:cmd.body,evidenceUrl:cmd.evidenceUrl}:{type:'contribution.submit',projectId:t.projectId,title:t.title,body:cmd.body,evidenceUrl:cmd.evidenceUrl},now,makeId)!;
            t.contributionId=evidence.objectId;touch(t);return result(t.id,'Proof sent to the existing contribution review. The task is not done until recognised.');
        }
        case 'task.note': {
            const t=task(cmd.taskId);open(t);const n={...base(),projectId:t.projectId,taskId:t.id,authorId:ctx.userId,body:cmd.body,hidden:false};s.taskNotes.push(n);
            notify(t.assigneeId,'A teammate added a task note',t.projectId);return result(n.id,'Note added for the project team.');
        }
        case 'task.note.hide': {
            const n=s.taskNotes.find(n=>n.id===cmd.noteId&&n.organizationId===ctx.organizationId);if(!n)return missing();const t=task(n.taskId),p=project(t.projectId);
            if(n.authorId!==ctx.userId)lead(p);if(n.hidden)return result(n.id,'Note already removed.',false);
            n.hidden=true;n.body='';return result(n.id,'Note removed. Its author and timestamp remain.');
        }
    }
}
