import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Search, CheckCircle2, Flag, Clock, ArrowUpRight, Lock, MessageCircle, Play, Archive, RefreshCw, ClipboardCheck, ExternalLink } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Avatar, AvatarStack, Back, CheckList, Empty, Modal, PageHeading, Pill, date } from '../components/ui';
import { isAdmin, canSeeSpace } from '../../../../packages/domain/src/access';
import { canWorkOnProject, taskStage, taskNeedsChanges, TASK_STAGES } from '../../../../packages/domain/src/project-work';
import type { ProjectTask } from '../../../../packages/contracts/src/index';
import { EvidenceReview } from './purpose';

export function ProjectWorkPage() {
    const { id }=useParams();
    const {data,me,reload,busy,mode}=useWorkspace();
    const [search,SearchText]=useState(''),[filter,F]=useState('all'),[view,V]=useState<'board'|'list'>('board');
    const [editing,E]=useState<ProjectTask|true|null>(null),[params,Params]=useSearchParams();
    const project=data.projects.find(p=>p.id===id);
    if(!project||!canWorkOnProject(data,me,project))return <><Back to={project?`/projects/${project.id}`:'/projects'} label="Back to project"/><Empty title="A workspace for the project team." body="Join the project to take part. Access to private spaces is still required."/></>;
    const lead=isAdmin(me)||project.ownerId===me.userId;
    const all=data.projectTasks.filter(t=>t.projectId===project.id);
    const tasks=all.filter(t=>(filter==='archive'?t.archived:!t.archived)&&(filter!=='mine'||t.assigneeId===me.userId)&&(filter!=='unassigned'||t.assigneeId===null)&&(t.title+' '+t.brief).toLowerCase().includes(search.toLowerCase()));
    const team=data.members.filter(m=>m.status==='active'&&data.projectMembers.some(pm=>pm.projectId===project.id&&pm.userId===m.userId));
    const purpose=data.purposes.find(x=>x.id===project.purposeId);
    const active=all.filter(t=>!t.archived),done=active.filter(t=>taskStage(data,t)==='done').length;
    const mine=active.filter(t=>t.assigneeId===me.userId&&!['done','review'].includes(taskStage(data,t)));
    const selected=all.find(t=>t.id===params.get('task'));
    const open=(t:ProjectTask)=>Params({task:t.id});
    const card=(t:ProjectTask)=>{
        const member=data.members.find(m=>m.userId===t.assigneeId),changes=taskNeedsChanges(data,t),stage=taskStage(data,t);
        return <button type="button" className={'work-card stage-'+stage} data-task-id={t.id} key={t.id} onClick={()=>open(t)}>
            <span className="work-card-top"><span>{t.priority==='high'?<><Flag size={12}/>Priority</>:'PROJECT TASK'}</span>{changes?<Pill tone="amber">Changes requested</Pill>:t.archived?<Pill>Archived</Pill>:<ArrowUpRight size={15}/>}</span>
            <strong className="work-card-title">{t.title}</strong><p>{t.brief}</p>
            <span className="work-card-criteria"><ClipboardCheck size={13}/>{t.criteria.length} completion {t.criteria.length===1?'criterion':'criteria'}</span>
            <span className="work-card-bottom"><span>{member?<><Avatar member={member} size="xs"/>{member.name.split(' ')[0]}</>:<><span className="work-unassigned">+</span>Open to claim</>}</span><span>{t.dueOn?<><Clock size={12}/>{date(t.dueOn+'T12:00:00Z')}</>:null}{data.taskNotes.some(n=>n.taskId===t.id&&!n.hidden)&&<><MessageCircle size={12}/>{data.taskNotes.filter(n=>n.taskId===t.id&&!n.hidden).length}</>}</span></span>
        </button>;
    };
    return <div className="project-work-page">
        <Back to={`/projects/${project.id}`} label="Project overview"/>
        <PageHeading eyebrow="LESS TALKING ABOUT IT. MORE MAKING IT." title={project.title+' / workspace'} body="A shared plan. Clear responsibilities. Work you can point to." action={<div className="work-actions"><button className="button secondary" disabled={busy} onClick={reload}><RefreshCw size={15}/>Refresh</button>{lead&&<button className="button primary" onClick={()=>E(true)}><Plus size={16}/>Add task</button>}</div>}/>
        <section className="work-intention"><div className="work-intention-icon"><Flag size={24}/></div><div><span className="eyebrow">WHAT THIS WORK SERVES</span><h2>{purpose?.title||project.tagline}</h2><p>{project.tagline}</p></div><div className="work-team"><AvatarStack members={team}/><span>{team.length} people building</span></div></section>
        <div className="work-summary"><div><strong>{active.length}</strong><span>pieces of work</span></div><div><strong>{mine.length}</strong><span>your next steps</span></div><div><strong>{active.filter(t=>taskStage(data,t)==='review').length}</strong><span>awaiting review</span></div><div className="work-summary-proof"><strong>{done}<small> / {active.length}</small></strong><span>recognised contributions</span></div></div>
        <div className="work-toolbar"><div className="filter-tabs">{[['all','All work'],['mine','My work'],['unassigned','Open to claim'],['archive','Archive']].map(([v,l])=><button key={v} aria-pressed={filter===v} className={filter===v?'selected':''} onClick={()=>F(v)}>{l}</button>)}</div><div className="work-tools"><label className="work-search"><Search size={15}/><input aria-label="Search project tasks" placeholder="Find a task…" value={search} onChange={e=>SearchText(e.target.value)}/></label><div className="work-view"><button aria-label="Board view" aria-pressed={view==='board'} onClick={()=>V('board')}><LayoutGrid size={18}/></button><button aria-label="List view" aria-pressed={view==='list'} onClick={()=>V('list')}><List size={18}/></button></div></div></div>
        {view==='board'?<div className="work-board">{TASK_STAGES.map((stage,i)=>{const rows=tasks.filter(t=>taskStage(data,t)===stage.id);return <section className={'work-column column-'+stage.id} key={stage.id} aria-label={stage.label}><header><span><i/>{stage.label}</span><b>{rows.length}</b></header><div className="work-column-content">{rows.map(card)}{!rows.length&&<div className="work-column-empty"><span>0{i+1}</span><p>{stage.id==='done'?'Reviewed proof belongs here.':stage.id==='review'?'Ready for a second pair of eyes.':stage.id==='doing'?'Make a useful first step.':'Leave space for the next idea.'}</p></div>}</div></section>})}</div>:<div className="work-list">{tasks.map(card)}{!tasks.length&&<Empty title="No tasks in this view." body="Try another filter or ask the project lead to add the next piece of work."/>}</div>}
        <div className="work-bottom-note"><Lock size={16}/><p>Task plans and notes are for this team and community administrators. Task proof is shared with the team; recognised work follows the project’s existing visibility. <strong>Moving a card is not proof.</strong></p><Link className="text-link" to={`/projects/${project.id}`}>Project evidence <ArrowUpRight size={15}/></Link></div>
        {mode==='demo'&&<p className="sample-note">Fictional demonstration. This work is stored in this browser, not Neon. Switch to the administrator to plan work or review another member’s proof.</p>}
        {editing&&<TaskEditor projectId={project.id} task={editing===true?undefined:editing} onClose={()=>E(null)}/>}
        {selected&&!editing&&<TaskDetail task={selected} onClose={()=>Params({})} onEdit={()=>E(selected)}/>}
        {params.get('task')&&!selected&&<p role="status">That task is not available to this account. <button className="text-link" onClick={()=>Params({})}>Return to board</button></p>}
    </div>;
}
function TaskEditor({projectId,task,onClose}:{projectId:string;task?:ProjectTask;onClose:()=>void}) {
    const {data,command,busy}=useWorkspace();
    const project=data.projects.find(p=>p.id===projectId)!;
    const team=data.members.filter(m=>m.status==='active'&&canSeeSpace(data,m,project.spaceId)&&data.projectMembers.some(x=>x.projectId===projectId&&x.userId===m.userId));
    return <Modal title={task?'Refine this piece of work':'What needs to happen next?'} onClose={onClose} wide><form className="form-stack" onSubmit={async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget),read=(k:string)=>String(f.get(k)||'').trim();
        const fields={title:read('title'),brief:read('brief'),criteria:read('criteria').split('\n').map(s=>s.trim()).filter(Boolean),assigneeId:read('assignee')||null,dueOn:read('due')||null,priority:read('priority') as 'normal'|'high'};
        if(await command(task?{type:'task.edit',taskId:task.id,expectedVersion:task.version,...fields}:{type:'task.create',projectId,...fields}))onClose();
    }}><label>Task title<input name="title" required maxLength={140} defaultValue={task?.title||''} placeholder="Test the first-run experience"/></label><label>The brief<textarea name="brief" required rows={3} maxLength={4000} defaultValue={task?.brief||''} placeholder="What is needed, and why does it matter?"/></label><label>What done looks like <small>One criterion per line, up to 10</small><textarea name="criteria" required rows={3} maxLength={2410} defaultValue={task?.criteria.join('\n')||''} placeholder={'Three observed tests\nThe main friction points recorded\nA proposed next change'}/></label><div className="work-form-row"><label>Assigned to<select name="assignee" defaultValue={task?.assigneeId||''}><option value="">Open to claim</option>{team.map(m=><option key={m.id} value={m.userId}>{m.name}</option>)}</select></label><label>Target date <small>Optional</small><input type="date" name="due" defaultValue={task?.dueOn||''}/></label><label>Priority<select name="priority" defaultValue={task?.priority||'normal'}><option value="normal">Normal</option><option value="high">High</option></select></label></div><p className="sample-note">Only the assigned person submits proof. A separate authorised reviewer recognises it. Assignment and criteria lock after the first submission.</p><button className="button primary" disabled={busy}>{task?'Save task':'Create task'}</button></form></Modal>;
}
function TaskDetail({task:t,onClose,onEdit}:{task:ProjectTask;onClose:()=>void;onEdit:()=>void}) {
    const {data,me,command,busy}=useWorkspace();const [note,N]=useState('');
    const p=data.projects.find(p=>p.id===t.projectId)!,lead=isAdmin(me)||p.ownerId===me.userId,mine=t.assigneeId===me.userId;
    const assigned=data.members.find(m=>m.userId===t.assigneeId),proof=data.contributions.find(c=>c.id===t.contributionId),stage=taskStage(data,t);
    const team=data.projectMembers.some(m=>m.projectId===p.id&&m.userId===me.userId);
    const notes=data.taskNotes.filter(n=>n.taskId===t.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    return <Modal title={t.title} onClose={onClose} wide><div className="task-detail">
        <div className="task-detail-meta"><Pill tone={stage==='done'?'mint':stage==='review'?'amber':'violet'}>{TASK_STAGES.find(s=>s.id===stage)?.label}</Pill>{t.archived&&<Pill>Archived</Pill>}<span>{assigned?.name||'Open to claim'}</span>{t.dueOn&&<span>Target {date(t.dueOn+'T12:00:00Z',{day:'numeric',month:'short',year:'numeric'})}</span>}</div>
        <p className="task-brief preline">{t.brief}</p><h3>What done looks like</h3><CheckList items={t.criteria}/>
        <div className="task-controls">{!t.archived&&!proof&&<>
            {t.assigneeId===null&&team&&<button className="button primary" disabled={busy} onClick={()=>command({type:'task.claim',taskId:t.id,expectedVersion:t.version})}>Claim this task</button>}
            {mine&&<><button className="button primary" disabled={busy} onClick={()=>command({type:'task.move',taskId:t.id,expectedVersion:t.version,workState:t.workState==='todo'?'doing':'todo'})}><Play size={14}/>{t.workState==='todo'?'Start work':'Back to planned'}</button><button className="button secondary" disabled={busy} onClick={()=>command({type:'task.release',taskId:t.id,expectedVersion:t.version})}>Release task</button></>}
            {lead&&<button className="button secondary" onClick={onEdit}>Edit task</button>}
        </>}{lead&&<button className="button secondary" disabled={busy} onClick={()=>command({type:'task.archive',taskId:t.id,expectedVersion:t.version,archived:!t.archived})}><Archive size={14}/>{t.archived?'Restore task':'Archive task'}</button>}</div>
        {proof&&<section className="task-proof"><span className="eyebrow">THE EVIDENCE</span><h3>{proof.status==='recognised'?'A contribution, recognised.':proof.status==='changes_requested'?'A little further to go.':'Ready for a second perspective.'}</h3><p className="preline">{proof.body}</p>{proof.evidenceUrl&&<a className="text-link" target="_blank" rel="noopener noreferrer" href={proof.evidenceUrl}>Open evidence <ExternalLink size={14}/></a>}{proof.feedback&&<div className="evidence-feedback"><CheckCircle2 size={18}/><span><strong>{data.members.find(m=>m.userId===proof.reviewerId)?.name||'Community reviewer'}</strong><p>{proof.feedback}</p></span></div>}{proof.status==='submitted'&&lead&&proof.userId!==me.userId&&<EvidenceReview objectId={proof.id} kind="contribution"/>}{proof.status==='recognised'&&mine&&<Link onClick={onClose} className="text-link" to="/outputs">Turn this into an evidenced outcome <ArrowUpRight size={15}/></Link>}</section>}
        {!t.archived&&mine&&(proof?.status==='changes_requested'||(!proof&&t.workState==='doing'))&&<form className="form-stack task-proof-form" key={proof?.status||'new'} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await command({type:'task.submit',taskId:t.id,expectedVersion:t.version,body:String(f.get('proof')||''),evidenceUrl:String(f.get('url')||'')});}}><h3>{proof?'Bring the next version.':'Show what changed.'}</h3><label>Proof and reflection<textarea name="proof" required rows={4} maxLength={8000} defaultValue={proof?.body||''} placeholder="Address the completion criteria. What did you do and what evidence supports it?"/></label><label>Evidence link <small>Optional</small><input name="url" type="url" pattern="https://.*" maxLength={2000} defaultValue={proof?.evidenceUrl||''} placeholder="https://…"/></label><p className="sample-note">Task proof is shared with the authorised project team and administrators. Recognised work becomes visible to the project audience. Do not include private client material.</p><button className="button primary" disabled={busy}>Submit task proof</button></form>}
        <section className="task-notes"><h3>Conversation around the work <span>{notes.filter(n=>!n.hidden).length}</span></h3>{notes.map(n=><article key={n.id} className="task-note"><Avatar member={data.members.find(m=>m.userId===n.authorId)} size="sm"/><div><strong>{data.members.find(m=>m.userId===n.authorId)?.name||'Former member'}</strong><small>{date(n.createdAt)}</small><p className="preline">{n.hidden?'This note was removed.':n.body}</p>{!n.hidden&&(lead||n.authorId===me.userId)&&<button className="text-link" disabled={busy} onClick={()=>command({type:'task.note.hide',noteId:n.id})}>Remove note</button>}</div></article>)}{!notes.length&&<p className="muted">Decisions, questions and useful context belong with the task.</p>}{!t.archived&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();if(await command({type:'task.note',taskId:t.id,body:note}))N('');}}><label>Team note<textarea required rows={2} maxLength={4000} value={note} onChange={e=>N(e.target.value)} placeholder="Ask for feedback or leave the next person some context."/></label><button className="button secondary" disabled={busy}>Add note</button></form>}</section>
    </div></Modal>;
}
