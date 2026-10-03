import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List, Search, CheckCircle2, Flag, Clock, ArrowUpRight, Lock, MessageCircle, Play, Archive, RefreshCw, ClipboardCheck, ExternalLink, SearchX, ListTodo, Paperclip, Download, LoaderCircle, FileUp, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Avatar, AvatarStack, Back, CheckList, Empty, Modal, PageHeading, Pill, date } from '../components/ui';
import { isAdmin, canSeeSpace } from '../../../../packages/domain/src/access';
import { canWorkOnProject, taskStage, taskNeedsChanges, TASK_STAGES } from '../../../../packages/domain/src/project-work';
import type { CommandInput, ProjectTask, Workspace } from '../../../../packages/contracts/src/index';
import { RESOURCE_FILE_ACCEPT } from '../../../../packages/contracts/src/lesson-resources';
import { MAX_TASK_FILES } from '../../../../packages/contracts/src/task-files';
import { projectWorkVersion, taskFiles } from '../../../../packages/domain/src/task-files';
import { displayError } from '../lib/data';
import { useProjectChanges, type LiveState } from '../lib/live';
import { downloadTaskFile, forgetTaskFile, uploadTaskFile } from '../lib/task-files';
import { resourceUploadLimits } from '../lib/resources';
import { ResourceIcon, describeResource } from '../components/resource-list';
import { EvidenceReview } from './purpose';

/** What this person sees of a project's work, as one fingerprint; empty when they cannot see it. */
const localVersion = (w: Workspace | undefined, userId: string, projectId: string) => {
    try { return w ? projectWorkVersion(w, { organizationId: w.organisation.id, userId, requestId: 'local' }, projectId) : ''; }
    catch { return 'unavailable'; }
};
/** A quiet line: live, reconnecting, or when someone else's change last arrived. */
function LiveStatus({ state, updatedAt }: { state: LiveState; updatedAt: number | null }) {
    const [, tick] = useState(0);
    useEffect(() => { if (!updatedAt) return; const t = window.setInterval(() => tick(n => n + 1), 15000); return () => window.clearInterval(t); }, [updatedAt]);
    const text = state === 'retrying' ? 'Reconnecting…' : updatedAt ? (Date.now() - updatedAt < 60000 ? 'Updated just now' : 'Updated at ' + date(new Date(updatedAt).toISOString(), { hour: '2-digit', minute: '2-digit' })) : state === 'paused' ? 'Live updates paused' : 'Live updates on';
    return <p className={'work-live' + (updatedAt && state !== 'retrying' ? ' updated' : '')} role="status" aria-live="polite"><span aria-hidden="true"/>{text}</p>;
}

export function ProjectWorkPage() {
    const { id }=useParams();
    const {data,me,reload,busy,mode,slug,userId}=useWorkspace();
    const cache=useQueryClient();
    // While the board or a task is open: ask whether the project's work changed, and refresh when it did.
    const live=useProjectChanges(slug,userId,id,async()=>{
        const key=['workspace',slug,userId],before=localVersion(cache.getQueryData<Workspace>(key),userId,id!);
        await cache.refetchQueries({queryKey:key,exact:true});
        return localVersion(cache.getQueryData<Workspace>(key),userId,id!)!==before;
    });
    const [search,SearchText]=useState(''),[filter,F]=useState('all'),[view,V]=useState<'board'|'list'>('board');
    const [editing,E]=useState<ProjectTask|true|null>(null),[params,Params]=useSearchParams();
    const project=data.projects.find(p=>p.id===id);
    if(!project||!canWorkOnProject(data,me,project))return <><Back to={project?`/projects/${project.id}`:'/projects'} label="Back to project"/><Empty icon={Lock} title="A workspace for the project team." body="Join the project to take part. Access to private spaces is still required."/></>;
    const lead=isAdmin(me)||project.ownerId===me.userId;
    const all=data.projectTasks.filter(t=>t.projectId===project.id);
    const tasks=all.filter(t=>(filter==='archive'?t.archived:!t.archived)&&(filter!=='mine'||t.assigneeId===me.userId)&&(filter!=='unassigned'||t.assigneeId===null)&&(t.title+' '+t.brief).toLowerCase().includes(search.toLowerCase()));
    const team=data.members.filter(m=>m.status==='active'&&data.projectMembers.some(pm=>pm.projectId===project.id&&pm.userId===m.userId));
    const purpose=data.purposes.find(x=>x.id===project.purposeId);
    const active=all.filter(t=>!t.archived),done=active.filter(t=>taskStage(data,t)==='done').length;
    const mine=active.filter(t=>t.assigneeId===me.userId&&!['done','review'].includes(taskStage(data,t)));
    const selected=all.find(t=>t.id===params.get('task'));
    // First run: no work planned yet. Only the project lead or an administrator can add it.
    const firstRun=!all.length?<Empty icon={ListTodo} title="No tasks yet." body={lead?'Break the project into a first piece of work with clear completion criteria.':'The project lead adds the first piece of work. You can claim it here once it exists.'} action={lead?<button className="button primary" onClick={()=>E(true)}>Add the first task</button>:undefined}/>:null;
    const noMatch=<Empty icon={SearchX} title="No tasks in this view." body="Nothing matches this filter or search. Other work is still on the board." action={<button className="button secondary" onClick={()=>{F('all');SearchText('');}}>Show all work</button>}/>;
    const open=(t:ProjectTask)=>Params({task:t.id});
    const card=(t:ProjectTask)=>{
        const member=data.members.find(m=>m.userId===t.assigneeId),changes=taskNeedsChanges(data,t),stage=taskStage(data,t);
        return <button type="button" className={'work-card stage-'+stage} data-task-id={t.id} key={t.id} onClick={()=>open(t)}>
            <span className="work-card-top"><span>{t.priority==='high'?<><Flag size={12}/>Priority</>:'PROJECT TASK'}</span>{changes?<Pill tone="amber">Changes requested</Pill>:t.archived?<Pill>Archived</Pill>:<ArrowUpRight size={15}/>}</span>
            <strong className="work-card-title">{t.title}</strong><p>{t.brief}</p>
            <span className="work-card-criteria"><ClipboardCheck size={13}/>{t.criteria.length} completion {t.criteria.length===1?'criterion':'criteria'}</span>
            <span className="work-card-bottom"><span>{member?<><Avatar member={member} size="xs"/>{member.name.split(' ')[0]}</>:<><span className="work-unassigned">+</span>Open to claim</>}</span><span>{t.dueOn?<><Clock size={12}/>{date(t.dueOn+'T12:00:00Z')}</>:null}{taskFiles(data,t.id).length>0&&<><Paperclip size={12}/>{taskFiles(data,t.id).length}</>}{data.taskNotes.some(n=>n.taskId===t.id&&!n.hidden)&&<><MessageCircle size={12}/>{data.taskNotes.filter(n=>n.taskId===t.id&&!n.hidden).length}</>}</span></span>
        </button>;
    };
    return <div className="project-work-page">
        <Back to={`/projects/${project.id}`} label="Project overview"/>
        <PageHeading eyebrow="LESS TALKING ABOUT IT. MORE MAKING IT." title={project.title+' / workspace'} body="A shared plan. Clear responsibilities. Work you can point to." action={<div className="work-actions"><LiveStatus {...live}/><button className="button secondary" disabled={busy} onClick={reload}><RefreshCw size={15}/>Refresh</button>{lead&&<button className="button primary" onClick={()=>E(true)}><Plus size={16}/>Add task</button>}</div>}/>
        <section className="work-intention"><div className="work-intention-icon"><Flag size={24}/></div><div><span className="eyebrow">WHAT THIS WORK SERVES</span><h2>{purpose?.title||project.tagline}</h2><p>{project.tagline}</p></div><div className="work-team"><AvatarStack members={team}/><span>{team.length} people building</span></div></section>
        <div className="work-summary"><div><strong>{active.length}</strong><span>pieces of work</span></div><div><strong>{mine.length}</strong><span>your next steps</span></div><div><strong>{active.filter(t=>taskStage(data,t)==='review').length}</strong><span>awaiting review</span></div><div className="work-summary-proof"><strong>{done}<small> / {active.length}</small></strong><span>recognised contributions</span></div></div>
        <div className="work-toolbar"><div className="filter-tabs">{[['all','All work'],['mine','My work'],['unassigned','Open to claim'],['archive','Archive']].map(([v,l])=><button key={v} aria-pressed={filter===v} className={filter===v?'selected':''} onClick={()=>F(v)}>{l}</button>)}</div><div className="work-tools"><label className="work-search"><Search size={15}/><input aria-label="Search project tasks" placeholder="Find a task…" value={search} onChange={e=>SearchText(e.target.value)}/></label><div className="work-view"><button aria-label="Board view" aria-pressed={view==='board'} onClick={()=>V('board')}><LayoutGrid size={18}/></button><button aria-label="List view" aria-pressed={view==='list'} onClick={()=>V('list')}><List size={18}/></button></div></div></div>
        {view==='board'&&firstRun}{view==='board'?<div className="work-board">{TASK_STAGES.map((stage,i)=>{const rows=tasks.filter(t=>taskStage(data,t)===stage.id);return <section className={'work-column column-'+stage.id} key={stage.id} aria-label={stage.label}><header><span><i/>{stage.label}</span><b>{rows.length}</b></header><div className="work-column-content">{rows.map(card)}{!rows.length&&<div className="work-column-empty"><span>0{i+1}</span><p>{stage.id==='done'?'Reviewed proof belongs here.':stage.id==='review'?'Ready for a second pair of eyes.':stage.id==='doing'?'Make a useful first step.':'Leave space for the next idea.'}</p></div>}</div></section>})}</div>:<div className="work-list">{tasks.map(card)}{!tasks.length&&(firstRun??noMatch)}</div>}
        <div className="work-bottom-note"><Lock size={16}/><p>Task plans and notes are for this team and community administrators. Task proof is shared with the team; recognised work follows the project’s existing visibility. <strong>Moving a card is not proof.</strong></p><Link className="text-link" to={`/projects/${project.id}`}>Project evidence <ArrowUpRight size={15}/></Link></div>
        {mode==='demo'&&<p className="sample-note">Fictional demonstration. This work is stored in this browser, not Neon. Switch to the administrator to plan work or review another member’s proof.</p>}
        {editing&&<TaskEditor projectId={project.id} task={editing===true?undefined:editing} onClose={()=>E(null)}/>}
        {selected&&!editing&&<TaskDetail task={selected} onClose={()=>Params({})} onEdit={()=>E(selected)}/>}
        {params.get('task')&&!selected&&<p role="status">That task is not available to this account. <button className="text-link" onClick={()=>Params({})}>Return to board</button></p>}
    </div>;
}
function TaskEditor({projectId,task,onClose}:{projectId:string;task?:ProjectTask;onClose:()=>void}) {
    const {data,me,command,busy,toast,reload}=useWorkspace();
    const project=data.projects.find(p=>p.id===projectId)!;
    const team=data.members.filter(m=>m.status==='active'&&canSeeSpace(data,m,project.spaceId)&&data.projectMembers.some(x=>x.projectId===projectId&&x.userId===m.userId));
    // Optimistic concurrency: the form saves against the version it was loaded from. When someone else saves first, live
    // updates (or the refused save) bring their version here, and the person chooses; nothing is overwritten silently.
    const latest=task?data.projectTasks.find(t=>t.id===task.id):undefined;
    const [loaded,setLoaded]=useState(task),[base,setBase]=useState(task?.version),[form,setForm]=useState(0),[refused,setRefused]=useState(false);
    // The choices wait for the newer version to arrive: a refusal can come before the refresh that carries it.
    const fresh=!!latest&&latest.version!==base;
    const conflict=!!task&&(refused||fresh);
    const changedBy=latest?.updatedBy===me.userId?'You, in another window,':latest?.updatedBy?data.members.find(m=>m.userId===latest.updatedBy)?.name||'Someone else':'Someone else';
    const banner=useRef<HTMLDivElement>(null);
    useEffect(()=>{if(conflict)banner.current?.focus();},[conflict]);
    const t=loaded;
    return <Modal title={task?'Refine this piece of work':'What needs to happen next?'} onClose={onClose} wide>
    <form key={form} className="form-stack" onSubmit={async e=>{
        e.preventDefault();const f=new FormData(e.currentTarget),read=(k:string)=>String(f.get(k)||'').trim();
        const fields={title:read('title'),brief:read('brief'),criteria:read('criteria').split('\n').map(s=>s.trim()).filter(Boolean),assigneeId:read('assignee')||null,dueOn:read('due')||null,priority:read('priority') as 'normal'|'high'};
        const onError=(message:string,code?:string)=>{if(code==='STALE_TASK'){setRefused(true);reload();}else toast(message);};
        if(await command(task?{type:'task.edit',taskId:task.id,expectedVersion:base!,...fields}:{type:'task.create',projectId,...fields},{onError}))onClose();
    }}>{conflict&&<div className="task-conflict" role="alert" tabIndex={-1} ref={banner}><AlertTriangle size={18} aria-hidden="true"/><div><strong>{changedBy} changed this task while you were editing{latest?' at '+date(latest.updatedAt,{hour:'2-digit',minute:'2-digit'}):''}.</strong><p>Your edits are still in the form and have not been saved. Load the latest version to start again from it, or keep your edits and save them over it.</p>
        <div className="task-conflict-actions"><button type="button" className="button secondary" disabled={!fresh} onClick={()=>{setLoaded(latest);setBase(latest!.version);setForm(n=>n+1);setRefused(false);}}>Load the latest version</button><button type="button" className="button secondary" disabled={!fresh} onClick={()=>{setBase(latest!.version);setRefused(false);}}>Keep my edits</button></div></div></div>}<label>Task title<input name="title" required maxLength={140} defaultValue={t?.title||''} placeholder="Test the first-run experience"/></label><label>The brief<textarea name="brief" required rows={3} maxLength={4000} defaultValue={t?.brief||''} placeholder="What is needed, and why does it matter?"/></label><label>What done looks like <small>One criterion per line, up to 10</small><textarea name="criteria" required rows={3} maxLength={2410} defaultValue={t?.criteria.join('\n')||''} placeholder={'Three observed tests\nThe main friction points recorded\nA proposed next change'}/></label><div className="work-form-row"><label>Assigned to<select name="assignee" defaultValue={t?.assigneeId||''}><option value="">Open to claim</option>{team.map(m=><option key={m.id} value={m.userId}>{m.name}</option>)}</select></label><label>Target date <small>Optional</small><input type="date" name="due" defaultValue={t?.dueOn||''}/></label><label>Priority<select name="priority" defaultValue={t?.priority||'normal'}><option value="normal">Normal</option><option value="high">High</option></select></label></div><p className="sample-note">Only the assigned person submits proof. A separate authorised reviewer recognises it. Assignment and criteria lock after the first submission.</p><button className="button primary" disabled={busy||conflict}>{task?'Save task':'Create task'}</button></form></Modal>;
}
function TaskDetail({task:t,onClose,onEdit}:{task:ProjectTask;onClose:()=>void;onEdit:()=>void}) {
    const {data,me,command,busy,toast,reload}=useWorkspace();const [note,N]=useState('');
    // A change someone else saved first is refused by version; the latest version then arrives with the refresh.
    const act=(c:CommandInput)=>command(c,{onError:(message,code)=>{toast(message);if(code==='STALE_TASK')reload();}});
    const p=data.projects.find(p=>p.id===t.projectId)!,lead=isAdmin(me)||p.ownerId===me.userId,mine=t.assigneeId===me.userId;
    const assigned=data.members.find(m=>m.userId===t.assigneeId),proof=data.contributions.find(c=>c.id===t.contributionId),stage=taskStage(data,t);
    const team=data.projectMembers.some(m=>m.projectId===p.id&&m.userId===me.userId);
    const notes=data.taskNotes.filter(n=>n.taskId===t.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
    return <Modal title={t.title} onClose={onClose} wide><div className="task-detail">
        <div className="task-detail-meta"><Pill tone={stage==='done'?'mint':stage==='review'?'amber':'violet'}>{TASK_STAGES.find(s=>s.id===stage)?.label}</Pill>{t.archived&&<Pill>Archived</Pill>}<span>{assigned?.name||'Open to claim'}</span>{t.dueOn&&<span>Target {date(t.dueOn+'T12:00:00Z',{day:'numeric',month:'short',year:'numeric'})}</span>}</div>
        <p className="task-brief preline">{t.brief}</p><h3>What done looks like</h3><CheckList items={t.criteria}/>
        <div className="task-controls">{!t.archived&&!proof&&<>
            {t.assigneeId===null&&team&&<button className="button primary" disabled={busy} onClick={()=>act({type:'task.claim',taskId:t.id,expectedVersion:t.version})}>Claim this task</button>}
            {mine&&<><button className="button primary" disabled={busy} onClick={()=>act({type:'task.move',taskId:t.id,expectedVersion:t.version,workState:t.workState==='todo'?'doing':'todo'})}><Play size={14}/>{t.workState==='todo'?'Start work':'Back to planned'}</button><button className="button secondary" disabled={busy} onClick={()=>act({type:'task.release',taskId:t.id,expectedVersion:t.version})}>Release task</button></>}
            {lead&&<button className="button secondary" onClick={onEdit}>Edit task</button>}
        </>}{lead&&<button className="button secondary" disabled={busy} onClick={()=>act({type:'task.archive',taskId:t.id,expectedVersion:t.version,archived:!t.archived})}><Archive size={14}/>{t.archived?'Restore task':'Archive task'}</button>}</div>
        {proof&&<section className="task-proof"><span className="eyebrow">THE EVIDENCE</span><h3>{proof.status==='recognised'?'A contribution, recognised.':proof.status==='withdrawn'?'This proof was withdrawn.':proof.status==='changes_requested'?'A little further to go.':'Ready for a second perspective.'}</h3><p className="preline">{proof.body}</p>{proof.evidenceUrl&&<a className="text-link" target="_blank" rel="noopener noreferrer" href={proof.evidenceUrl}>Open evidence <ExternalLink size={14}/></a>}{proof.feedback&&<div className="evidence-feedback"><CheckCircle2 size={18}/><span><strong>{data.members.find(m=>m.userId===proof.reviewerId)?.name||'Community reviewer'}</strong><p>{proof.feedback}</p></span></div>}{proof.status==='submitted'&&lead&&proof.userId!==me.userId&&<EvidenceReview objectId={proof.id} kind="contribution"/>}{proof.status==='recognised'&&mine&&<Link onClick={onClose} className="text-link" to="/outputs">Turn this into an evidenced outcome <ArrowUpRight size={15}/></Link>}</section>}
        {!t.archived&&mine&&(proof?.status==='changes_requested'||proof?.status==='withdrawn'||(!proof&&t.workState==='doing'))&&<form className="form-stack task-proof-form" key={proof?.status||'new'} onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await act({type:'task.submit',taskId:t.id,expectedVersion:t.version,body:String(f.get('proof')||''),evidenceUrl:String(f.get('url')||'')});}}><h3>{proof?'Bring the next version.':'Show what changed.'}</h3><label>Proof and reflection<textarea name="proof" required rows={4} maxLength={8000} defaultValue={proof?.body||''} placeholder="Address the completion criteria. What did you do and what evidence supports it?"/></label><label>Evidence link <small>Optional</small><input name="url" type="url" pattern="https://.*" maxLength={2000} defaultValue={proof?.evidenceUrl||''} placeholder="https://…"/></label><p className="sample-note">Task proof is shared with the authorised project team and administrators. Recognised work becomes visible to the project audience. Do not include private client material.</p><button className="button primary" disabled={busy}>Submit task proof</button></form>}
        <TaskFiles task={t} lead={lead}/>
        <section className="task-notes"><h3>Conversation around the work <span>{notes.filter(n=>!n.hidden).length}</span></h3>{notes.map(n=><article key={n.id} className="task-note"><Avatar member={data.members.find(m=>m.userId===n.authorId)} size="sm"/><div><strong>{data.members.find(m=>m.userId===n.authorId)?.name||'Former member'}</strong><small>{date(n.createdAt)}</small><p className="preline">{n.hidden?'This note was removed.':n.body}</p>{!n.hidden&&(lead||n.authorId===me.userId)&&<button className="text-link" disabled={busy} onClick={()=>act({type:'task.note.hide',noteId:n.id})}>Remove note</button>}</div></article>)}{!notes.length&&<p className="muted">Decisions, questions and useful context belong with the task.</p>}{!t.archived&&<form className="form-stack" onSubmit={async e=>{e.preventDefault();if(await act({type:'task.note',taskId:t.id,body:note}))N('');}}><label>Team note<textarea required rows={2} maxLength={4000} value={note} onChange={e=>N(e.target.value)} placeholder="Ask for feedback or leave the next person some context."/></label><button className="button secondary" disabled={busy}>Add note</button></form>}</section>
    </div></Modal>;
}
/** Files the team needs for this task. Shared with the project team and administrators; never proof of the work. */
function TaskFiles({task:t,lead}:{task:ProjectTask;lead:boolean}) {
    const {data,me,slug,userId,command,busy,toast,reload,mode}=useWorkspace();
    const files=taskFiles(data,t.id),picker=useRef<HTMLInputElement>(null);
    const [pending,setPending]=useState<string|null>(null),[uploading,setUploading]=useState(false),[status,setStatus]=useState(''),[storage,setStorage]=useState(mode==='demo');
    useEffect(()=>{let on=true;resourceUploadLimits().then(l=>{if(on)setStorage(l.uploads);},()=>{});return ()=>{on=false;};},[]);
    const full=files.length>=MAX_TASK_FILES,team=!t.archived;
    const upload=async(file:File)=>{setUploading(true);setStatus('Uploading '+file.name+'…');try{setStatus(await uploadTaskFile(slug,userId,t.id,file));reload();}catch(e){setStatus(displayError(e));}finally{setUploading(false);}};
    const name=(id:string)=>data.members.find(m=>m.userId===id)?.name||'Former member';
    return <section className="task-files" aria-labelledby={'task-files-'+t.id}>
        <div className="task-files-head"><h3 id={'task-files-'+t.id}><Paperclip size={16} aria-hidden="true"/>Files <span>{files.length}</span></h3>
            {team&&<button type="button" className="button secondary" disabled={uploading||full||!storage} onClick={()=>picker.current?.click()}>{uploading?<LoaderCircle size={15} className="spin" aria-hidden="true"/>:<FileUp size={15} aria-hidden="true"/>}Attach a file</button>}
            <input ref={picker} type="file" accept={RESOURCE_FILE_ACCEPT} hidden aria-label="Choose a file to attach" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></div>
        {files.length>0&&<ul>{files.map(f=><li key={f.id} className="lesson-resource task-file">
            <span className="resource-icon"><ResourceIcon type={f.contentType}/></span>
            <div className="resource-copy"><strong>{f.originalName}</strong><small>{describeResource(f)} · {name(f.userId)} · {date(f.createdAt)}</small></div>
            <div className="task-file-actions"><button type="button" className="button secondary" aria-label={'Download '+f.originalName} disabled={!!pending} onClick={async()=>{setPending(f.id);try{toast('Downloading '+await downloadTaskFile(slug,userId,t.id,f.id)+'.');}catch(e){toast(displayError(e));}finally{setPending(null);}}}>{pending===f.id?<LoaderCircle size={15} className="spin" aria-hidden="true"/>:<Download size={15} aria-hidden="true"/>}{pending===f.id?'Preparing':'Download'}</button>
            {(lead||f.userId===me.userId)&&<button type="button" className="text-link" aria-label={'Remove '+f.originalName} disabled={busy} onClick={async()=>{if(await command({type:'task.file.remove',taskId:t.id,fileId:f.id}))await forgetTaskFile(slug,f.id);}}>Remove</button>}</div>
        </li>)}</ul>}
        {!files.length&&<p className="muted">Drafts, references and pictures the team needs for this work.</p>}
        <p className="task-files-status" role="status">{status}</p>
        {!storage&&team&&<p className="resource-warning" role="note">Private file storage is not configured for this community, so files cannot be attached yet.</p>}
        <p className="sample-note">PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP, up to 10 MB, {MAX_TASK_FILES} per task. Files are shared with this project team and community administrators. A file is not proof: proof is submitted and reviewed separately.{mode==='demo'?' In this fictional demo, files stay in this browser.':''}</p>
    </section>;
}
