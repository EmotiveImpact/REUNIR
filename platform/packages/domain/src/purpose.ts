import { DomainError, type Command, type Workspace, type TenantContext, type Member, type Milestone, type Purpose } from '../../contracts/src/index';
import { actorFor, canSeeSpace, isAdmin } from './access';

/** Additive browser-state upgrade. Never invent a purpose or evidence for existing user data. */
export function normalisePurposeState(s: Workspace): Workspace {
    s.coverLibrary ??= []; s.trackInstructors ??= []; s.quizAttempts ??= []; s.uploads ??= []; s.lessonDrafts ??= []; s.lessonRevisions ??= [];
    s.projectTasks ??= []; s.taskNotes ??= [];
    s.purposes ??= []; s.paths ??= []; s.milestones ??= []; s.pathEnrolments ??= [];
    s.contributions ??= []; s.outcomes ??= []; s.communityOutputs ??= []; s.memberGoals ??= [];
    for (const p of s.projects) p.purposeId ??= null;
    for (const g of s.memberGoals) g.outcomeId ??= null;
    return s;
}

/** Run after existing fine-grained resource filtering; never return the internal event outbox. */
export function filterPurposeWorkspace(s: Workspace, ctx: TenantContext, actor: Member): Workspace {
    const tenant = <T extends {organizationId: string}>(xs: T[]) => xs.filter(x => x.organizationId === ctx.organizationId);
    s.purposes = tenant(s.purposes);
    const purposes = new Set(s.purposes.map(x => x.id));
    const lessons = new Set(s.lessons.map(x => x.id)), missions = new Set(s.missions.map(x => x.id)), projects = new Set(s.projects.map(x => x.id));
    const targetVisible = (m: Milestone) => m.lessonId ? lessons.has(m.lessonId) : m.missionId ? missions.has(m.missionId) : m.projectId ? projects.has(m.projectId) : false;
    s.paths = tenant(s.paths).filter(p => purposes.has(p.purposeId) && canSeeSpace(s, actor, p.spaceId) && (p.status === 'published' || isAdmin(actor)) && s.milestones.filter(m => m.pathId === p.id).every(targetVisible));
    const paths = new Set(s.paths.map(x => x.id));
    s.milestones = tenant(s.milestones).filter(m => paths.has(m.pathId) && targetVisible(m));
    s.pathEnrolments = tenant(s.pathEnrolments).filter(x => paths.has(x.pathId) && x.userId === ctx.userId);
    s.memberGoals = tenant(s.memberGoals).filter(g => purposes.has(g.purposeId) && (!g.pathId || paths.has(g.pathId)) && (g.userId === ctx.userId || g.visibility === 'members'));
    const teamProof = new Set(s.projectTasks.filter(t => t.organizationId === ctx.organizationId && projects.has(t.projectId) && (isAdmin(actor) || s.projects.some(p=>p.id===t.projectId&&p.ownerId===ctx.userId) || s.projectMembers.some(m=>m.projectId===t.projectId&&m.userId===ctx.userId&&m.organizationId===ctx.organizationId))).map(t=>t.contributionId));
    s.contributions = tenant(s.contributions).filter(c => projects.has(c.projectId) && (teamProof.has(c.id) || c.status === 'recognised' || c.userId === ctx.userId || isAdmin(actor) || s.projects.some(p => p.id === c.projectId && p.ownerId === ctx.userId)));
    const contributions = new Set(s.contributions.map(x => x.id)), submissions = new Set(s.submissions.map(x => x.id));
    s.outcomes = tenant(s.outcomes).filter(o => purposes.has(o.purposeId) && (!o.projectId || projects.has(o.projectId)) && (o.contributionId ? contributions.has(o.contributionId) : !!o.submissionId && submissions.has(o.submissionId)) && (o.status === 'verified' || o.authorId === ctx.userId || isAdmin(actor)));
    const outcomes = new Set(s.outcomes.filter(o => o.status === 'verified').map(x => x.id));
    s.memberGoals = s.memberGoals.filter(g=>!g.outcomeId || outcomes.has(g.outcomeId));
    s.communityOutputs = tenant(s.communityOutputs).filter(o => outcomes.has(o.outcomeId) && purposes.has(o.purposeId) && (!o.projectId || projects.has(o.projectId)));
    return s;
}

export function milestoneEvidence(s: Workspace, userId: string, m: Milestone) {
    if (m.lessonId) {
        const lesson = s.lessons.find(l => l.id === m.lessonId);
        const done = s.completions.some(c => c.userId === userId && c.lessonId === m.lessonId);
        return { done, label: 'Lesson completion', href: lesson ? `/learn/${lesson.trackId}/${lesson.id}` : '/learn' };
    }
    if (m.missionId) return { done: s.submissions.some(x => x.authorId === userId && x.missionId === m.missionId && x.status === 'approved'), label: 'Reviewed mission proof', href: `/missions/${m.missionId}` };
    return { done: s.contributions.some(x => x.userId === userId && x.projectId === m.projectId && x.status === 'recognised'), label: 'Recognised project contribution', href: `/projects/${m.projectId}` };
}
export function pathProgress(s: Workspace, userId: string, pathId: string) {
    const milestones = s.milestones.filter(m => m.pathId === pathId).sort((a,b) => a.position-b.position).map(m => ({...m, ...milestoneEvidence(s, userId, m)}));
    const completed = milestones.filter(m => m.done).length, total = milestones.length;
    return {milestones, completed, total, percent: total ? Math.round(100*completed/total) : 0, next: milestones.find(m => !m.done)};
}

type Result = {message: string; objectId: string; changed: boolean; audit?: boolean};
const purposeCommands = new Set(['purpose.save','path.create','path.publish','path.enrol','milestone.create','goal.set','goal.status','project.purpose','contribution.submit','contribution.resubmit','contribution.review','outcome.submit','outcome.resubmit','outcome.review','output.publish']);
export function applyPurposeCommand(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string): Result | undefined {
    if (!purposeCommands.has(cmd.type)) return undefined;
    const actor = actorFor(s,ctx);
    const base = () => ({id:makeId(), organizationId:ctx.organizationId, createdAt:now});
    const missing = (): never => { throw new DomainError('NOT_FOUND','That item is not available.',404); };
    const forbidden = (msg='An administrator is required.'): never => {throw new DomainError('FORBIDDEN',msg,403);};
    const conflict = (code:string,msg:string): never => {throw new DomainError(code,msg,409);};
    const find = <T extends {id:string;organizationId:string}>(xs:T[],id:string):T => xs.find(x=>x.id===id && x.organizationId===ctx.organizationId) ?? missing();
    const admin = () => {if (!isAdmin(actor)) forbidden();};
    const purpose = (id:string, active=true) => {const p=find(s.purposes,id); if(active && p.status!=='active') conflict('PURPOSE_ARCHIVED','Choose an active community purpose.'); return p;};
    const space = (id:string|null) => {if(!canSeeSpace(s,actor,id)) missing();};
    const project = (id:string) => {const p=find(s.projects,id); space(p.spaceId); return p;};
    const path = (id:string) => {const p=find(s.paths,id); space(p.spaceId); if(p.status!=='published'&&!isAdmin(actor)) missing(); return p;};
    const result = (objectId:string,message:string,audit=false,changed=true):Result=>({objectId,message,audit,changed});
    const notify = (userId:string,title:string,body:string,href:string) => {if(userId!==ctx.userId) s.notifications.push({...base(),userId,title,body,href,readAt:null});};
    const teamMember = (projectId:string) => s.projectMembers.some(m=>m.projectId===projectId&&m.userId===ctx.userId);
    const approvedSubmission = (id:string) => {const x=find(s.submissions,id); const m=find(s.missions,x.missionId); space(m.spaceId); if(m.trackId) space(find(s.tracks,m.trackId).spaceId); return x;};
    const sourceSpaces = (m: Pick<Milestone,'lessonId'|'missionId'|'projectId'>): (string|null)[] => {
        if(m.lessonId){const l=find(s.lessons,m.lessonId),t=find(s.tracks,l.trackId);if(!l.published||!t.published)missing();return [t.spaceId];}
        if(m.missionId){const x=find(s.missions,m.missionId);const t=x.trackId?find(s.tracks,x.trackId):null;if(t&&!t.published)missing();return [x.spaceId,t?.spaceId??null];}
        if(m.projectId)return [project(m.projectId).spaceId];
        return missing();
    };
    const sourceAccessible = (m: Milestone) => {sourceSpaces(m).forEach(space);};
    const audienceSafe = (m: Pick<Milestone,'lessonId'|'missionId'|'projectId'>,pathSpaceId:string|null) => {
        for(const id of sourceSpaces(m)){space(id);if(id && find(s.spaces,id).visibility==='private' && pathSpaceId!==id)conflict('AUDIENCE_MISMATCH','The path audience cannot be wider than its milestone content.');}
    };
    const outcomeAccessible = (o: Workspace['outcomes'][number]) => {
        if(o.projectId)project(o.projectId);
        if(o.submissionId)approvedSubmission(o.submissionId);
        if(o.contributionId){const c=find(s.contributions,o.contributionId);project(c.projectId);}
    };
    switch(cmd.type) {
        case 'purpose.save': {
            admin(); let p:Purpose;
            if(cmd.purposeId) {p=find(s.purposes,cmd.purposeId);Object.assign(p,{kind:cmd.kind,title:cmd.title,description:cmd.description,status:cmd.status});}
            else {if(s.purposes.filter(x=>x.status==='active').length>=12)conflict('PURPOSE_LIMIT','Keep the active purposes focused. Archive one before adding another.');p={...base(),kind:cmd.kind,title:cmd.title,description:cmd.description,status:cmd.status};s.purposes.push(p);}
            return result(p.id,'Community purpose saved.',true);
        }
        case 'path.create': {
            admin(); purpose(cmd.purposeId);space(cmd.spaceId);
            const p={...base(),purposeId:cmd.purposeId,spaceId:cmd.spaceId,title:cmd.title,summary:cmd.summary,status:'draft' as const};s.paths.push(p);
            return result(p.id,'Path drafted. Add an evidence-backed milestone before publishing.',true);
        }
        case 'milestone.create': {
            admin();const p=path(cmd.pathId);purpose(p.purposeId);
            if(p.status!=='draft')conflict('PATH_LOCKED','Published paths keep their milestones stable. Create a new path for a different journey.');
            if([cmd.lessonId,cmd.missionId,cmd.projectId].filter(Boolean).length!==1)conflict('ONE_TARGET','A milestone must reference exactly one lesson, mission or project.');
            audienceSafe(cmd,p.spaceId);
            if(s.milestones.some(m=>m.pathId===p.id&&m.lessonId===cmd.lessonId&&m.missionId===cmd.missionId&&m.projectId===cmd.projectId))conflict('DUPLICATE_MILESTONE','That evidence is already part of this path.');
            const m={...base(),pathId:p.id,title:cmd.title,description:cmd.description,position:1+Math.max(0,...s.milestones.filter(x=>x.pathId===p.id).map(x=>x.position)),lessonId:cmd.lessonId,missionId:cmd.missionId,projectId:cmd.projectId};s.milestones.push(m);
            return result(m.id,'Milestone added. Completion follows the evidence.',true);
        }
        case 'path.publish': {
            admin();const p=path(cmd.pathId);purpose(p.purposeId);
            if(p.status==='published')return result(p.id,'This path is already published.',false,false);
            const milestones=s.milestones.filter(m=>m.pathId===p.id);if(!milestones.length)conflict('EMPTY_PATH','Add at least one milestone before publishing.');milestones.forEach(m=>audienceSafe(m,p.spaceId));
            p.status='published';return result(p.id,'Path published.',true);
        }
        case 'path.enrol': {
            const p=path(cmd.pathId);purpose(p.purposeId);if(p.status!=='published')conflict('PATH_DRAFT','Publish the path before members join.');s.milestones.filter(m=>m.pathId===p.id).forEach(sourceAccessible);
            if(s.pathEnrolments.some(x=>x.pathId===p.id&&x.userId===ctx.userId))return result(p.id,'You have already joined this path.',false,false);
            s.pathEnrolments.push({...base(),pathId:p.id,userId:ctx.userId});return result(p.id,'Your next chapter starts here.');
        }
        case 'goal.set': {
            purpose(cmd.purposeId);if(cmd.pathId){const p=path(cmd.pathId);if(p.purposeId!==cmd.purposeId)conflict('PURPOSE_MISMATCH','Choose a path for this purpose.');if(p.status!=='published')conflict('PATH_DRAFT','Choose a published path.');}
            let g=s.memberGoals.find(g=>g.userId===ctx.userId&&g.purposeId===cmd.purposeId);
            if(g){Object.assign(g,{title:cmd.title,pathId:cmd.pathId,visibility:cmd.visibility,status:'active',completedAt:null,outcomeId:null});}
            else {g={...base(),userId:ctx.userId,purposeId:cmd.purposeId,pathId:cmd.pathId,title:cmd.title,visibility:cmd.visibility,status:'active',completedAt:null,outcomeId:null};s.memberGoals.push(g);}
            return result(g.id,cmd.visibility==='private'?'Your goal is saved privately.':'Your goal is shared with this community.');
        }
        case 'goal.status': {
            const g=find(s.memberGoals,cmd.goalId);if(g.userId!==ctx.userId)missing();
            if(cmd.status==='completed'){
                let outcome=false;
                if(cmd.outcomeId){const o=find(s.outcomes,cmd.outcomeId);if(o.authorId!==ctx.userId)missing();if(o.purposeId!==g.purposeId)conflict('PURPOSE_MISMATCH','Choose an outcome for this goal’s purpose.');outcomeAccessible(o);if(o.status!=='verified')conflict('UNVERIFIED_OUTCOME','Choose a reviewed outcome.');outcome=true;}
                const p=g.pathId?path(g.pathId):null;if(p)s.milestones.filter(m=>m.pathId===p.id).forEach(sourceAccessible);
                const progress=p?pathProgress(s,ctx.userId,p.id):null;
                const pathDone=!!p&&s.pathEnrolments.some(e=>e.pathId===p.id&&e.userId===ctx.userId)&&!!progress?.total&&progress.percent===100;
                if(!outcome&&!pathDone)conflict('EVIDENCE_REQUIRED','Complete the linked path or record a reviewed outcome first.');
            }
            g.status=cmd.status;g.completedAt=cmd.status==='completed'?now:null;g.outcomeId=cmd.status==='completed'?cmd.outcomeId:null;return result(g.id,'Goal updated.');
        }
        case 'project.purpose': {
            const p=project(cmd.projectId);if(p.ownerId!==ctx.userId&&!isAdmin(actor))forbidden('Only the project owner or a community administrator can link its purpose.');
            if(cmd.purposeId)purpose(cmd.purposeId);
            if(s.outcomes.some(o=>o.projectId===p.id&&o.purposeId!==cmd.purposeId))conflict('EVIDENCE_LINKED','This project already has outcome evidence for its current purpose.');
            p.purposeId=cmd.purposeId;return result(p.id,'Project purpose updated.',true);
        }
        case 'contribution.submit': {
            const p=project(cmd.projectId);if(!teamMember(p.id))forbidden('Join this project before recording a contribution.');
            const c={...base(),projectId:p.id,userId:ctx.userId,title:cmd.title,body:cmd.body,evidenceUrl:cmd.evidenceUrl,status:'submitted' as const,reviewerId:null,reviewedAt:null,feedback:''};s.contributions.push(c);
            const reviewers = new Set([p.ownerId,...s.members.filter(m=>isAdmin(m)&&m.status==='active').map(m=>m.userId)]);
            for(const u of reviewers)notify(u,'A contribution to recognise',`${actor.name} contributed to ${p.title}.`,`/projects/${p.id}`);
            return result(c.id,'Contribution recorded for review. Joining alone is not proof.');
        }
        case 'contribution.resubmit': {
            const c=find(s.contributions,cmd.contributionId);project(c.projectId);if(c.userId!==ctx.userId)missing();if(c.status!=='changes_requested')conflict('NOT_REVISION','Only feedback-requested contributions can be resubmitted.');
            Object.assign(c,{title:cmd.title,body:cmd.body,evidenceUrl:cmd.evidenceUrl,status:'submitted',feedback:'',reviewerId:null,reviewedAt:null});return result(c.id,'Contribution resubmitted for review.');
        }
        case 'contribution.review': {
            const c=find(s.contributions,cmd.contributionId),p=project(c.projectId);if(p.ownerId!==ctx.userId&&!isAdmin(actor))forbidden('A project owner or community administrator is required.');
            if(c.userId===ctx.userId)forbidden('You cannot recognise your own contribution.');if(c.status!=='submitted')conflict('NOT_PENDING','This contribution is no longer awaiting review.');
            c.status=cmd.decision;c.reviewerId=ctx.userId;c.reviewedAt=now;c.feedback=cmd.feedback;notify(c.userId,cmd.decision==='recognised'?'Your contribution was recognised':'Feedback on your contribution',cmd.feedback,`/projects/${p.id}`);
            return result(c.id,cmd.decision==='recognised'?'Contribution recognised. Its evidence now counts towards the path.':'Feedback sent. The author can revise the contribution.',true);
        }
        case 'outcome.submit': {
            purpose(cmd.purposeId);if([cmd.submissionId,cmd.contributionId].filter(Boolean).length!==1)conflict('ONE_SOURCE','Link exactly one approved mission proof or recognised contribution.');
            let projectId:string|null=null;
            if(cmd.submissionId){const x=approvedSubmission(cmd.submissionId);if(x.authorId!==ctx.userId)missing();if(x.status!=='approved')conflict('UNREVIEWED_SOURCE','Get the mission proof approved before recording an outcome.');}
            if(cmd.contributionId){const c=find(s.contributions,cmd.contributionId),p=project(c.projectId);if(c.userId!==ctx.userId)missing();if(c.status!=='recognised')conflict('UNREVIEWED_SOURCE','Get the contribution recognised before recording an outcome.');if(p.purposeId&&p.purposeId!==cmd.purposeId)conflict('PURPOSE_MISMATCH','The project and outcome must have the same purpose.');projectId=p.id;}
            if(s.outcomes.some(o=>o.authorId===ctx.userId&&o.submissionId===cmd.submissionId&&o.contributionId===cmd.contributionId))conflict('DUPLICATE_OUTCOME','An outcome already uses this evidence. Revise it instead of counting it twice.');
            const o={...base(),purposeId:cmd.purposeId,projectId,submissionId:cmd.submissionId,contributionId:cmd.contributionId,authorId:ctx.userId,title:cmd.title,summary:cmd.summary,evidenceUrl:cmd.evidenceUrl,status:'submitted' as const,reviewerId:null,reviewedAt:null,feedback:''};s.outcomes.push(o);
            for(const a of s.members.filter(m=>isAdmin(m)&&m.status==='active'))notify(a.userId,'Outcome awaiting review',`${actor.name} recorded ${o.title}.`,'/outputs');
            return result(o.id,'Outcome submitted. It is not a verified result until reviewed.');
        }
        case 'outcome.resubmit': {
            const o=find(s.outcomes,cmd.outcomeId);if(o.authorId!==ctx.userId)missing();outcomeAccessible(o);if(o.status!=='changes_requested')conflict('NOT_REVISION','Only feedback-requested outcomes can be resubmitted.');
            Object.assign(o,{title:cmd.title,summary:cmd.summary,evidenceUrl:cmd.evidenceUrl,status:'submitted',reviewerId:null,reviewedAt:null,feedback:''});return result(o.id,'Outcome resubmitted.');
        }
        case 'outcome.review': {
            admin();const o=find(s.outcomes,cmd.outcomeId);if(o.authorId===ctx.userId)forbidden('You cannot verify your own outcome.');outcomeAccessible(o);if(o.status!=='submitted')conflict('NOT_PENDING','This outcome is no longer awaiting review.');
            if(o.submissionId&&approvedSubmission(o.submissionId).status!=='approved')conflict('UNREVIEWED_SOURCE','The underlying proof is not approved.');
            if(o.contributionId&&find(s.contributions,o.contributionId).status!=='recognised')conflict('UNREVIEWED_SOURCE','The underlying contribution is not recognised.');
            o.status=cmd.decision;o.reviewerId=ctx.userId;o.reviewedAt=now;o.feedback=cmd.feedback;notify(o.authorId,cmd.decision==='verified'?'Your outcome was reviewed':'Feedback on your outcome',cmd.feedback,'/outputs');
            return result(o.id,cmd.decision==='verified'?'Outcome reviewed and verified within this community.':'Feedback sent to the author.',true);
        }
        case 'output.publish': {
            admin();const o=find(s.outcomes,cmd.outcomeId);if(o.status!=='verified')conflict('UNVERIFIED_OUTCOME','Review and verify the outcome before publishing an output.');
            if(o.projectId){const p=project(o.projectId);if(p.spaceId&&find(s.spaces,p.spaceId).visibility==='private')conflict('PRIVATE_EVIDENCE','Private-project evidence cannot be published to the whole community.');}
            if(o.submissionId){const sub=approvedSubmission(o.submissionId),m=find(s.missions,sub.missionId);const spaces=[m.spaceId,m.trackId?find(s.tracks,m.trackId).spaceId:null];if(spaces.some(id=>id&&find(s.spaces,id).visibility==='private'))conflict('PRIVATE_EVIDENCE','Private mission evidence cannot be published to the whole community.');}
            const old=s.communityOutputs.find(x=>x.outcomeId===o.id);if(old)return result(old.id,'This outcome is already in the community archive.',false,false);
            const out={...base(),purposeId:o.purposeId,outcomeId:o.id,projectId:o.projectId,title:o.title,summary:o.summary,kind:cmd.kind,evidenceUrl:o.evidenceUrl,publishedBy:ctx.userId};s.communityOutputs.push(out);
            return result(out.id,'A real output added to the community archive.',true);
        }
        default: return undefined;
    }
}
