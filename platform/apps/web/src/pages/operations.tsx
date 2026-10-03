import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, CheckCircle2, CircleHelp, Download, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Empty, PageHeading, Pill } from '../components/ui';
import { ErrorState, Loading } from '../components/states';
import { manualPilotGates, RELEASE_VERSION, type PilotCheck, type PilotStatus } from '../../../../packages/contracts/src/operations';
import type { Workspace } from '../../../../packages/contracts/src/index';
import { Button } from '../components/ui/button';
/** Demo observations never impersonate a configured server. */
export function demoPilotStatus(data:Workspace):PilotStatus {
    const checks: PilotCheck[]=[
        {key:'demo',title:'This is the demonstration',state:'blocked',detail:'No live database, hosting or email service is connected to this browser preview.',action:'Use the source workspace and its deployment guide for a connected pilot.'},
        {key:'database-config',title:'Neon PostgreSQL',state:'unverified',detail:'A local preview cannot inspect or verify a Neon project.'},
        {key:'runtime-role',title:'Database isolation role',state:'unverified',detail:'The production runtime must use a non-owner role without row-security bypass.'},
        {key:'client-secrets',title:'Client environment boundary',state:'unverified',detail:'Run the release checks against the intended production configuration.'},
        {key:'email-config',title:'Transactional email',state:'unverified',detail:'No real emails are sent from this preview.'},
        {key:'worker-heartbeat',title:'Mail worker observed',state:'unverified',detail:'There is no connected worker heartbeat. A configured secret would not start a schedule.'},
        {key:'community-purpose',title:'What we are here to do',state:data.purposes.some(p=>p.status==='active')?'pass':'warning',detail:'This observation comes only from the fictional community you are exploring.'},
        {key:'moderation-cover',title:'Independent moderation cover',state:data.members.some(m=>['moderator','admin'].includes(m.role)&&m.status==='active')?'pass':'warning',detail:'These are demonstration roles, not the staffing of a live community.'},
        ...manualPilotGates(),
    ];
    return {version:RELEASE_VERSION,generatedAt:new Date().toISOString(),source:'demo',checks,overall:'blocked',community:{activeMembers:data.members.filter(m=>m.status==='active').length,independentModerators:data.members.filter(m=>['moderator','admin'].includes(m.role)&&m.status==='active').length,purposes:data.purposes.filter(p=>p.status==='active').length,paths:data.paths.filter(p=>p.status==='published').length,projects:data.projects.length},delivery:{queued:null,sending:null,failed:null,oldestQueuedAt:null,lastSentAt:null,lastWorkerAt:null}};
}
const stateText={pass:'Observed',warning:'Needs attention',blocked:'Blocked',unverified:'Not verified'};
const stamp=(value:string|null)=>value ? new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/London'}).format(new Date(value)) : 'Not observed';
export function PilotOperationsPage() {
    const {data,me,mode,slug,userId}=useWorkspace();
    const [filter,setFilter]=useState<'all'|'attention'|'unverified'|'pass'>('all');
    const [refresh,setRefresh]=useState(0);
    const owner=me.role==='owner';
    const q=useQuery<PilotStatus>({queryKey:['pilot-status',slug,userId,refresh],enabled:owner && mode==='live',refetchOnWindowFocus:false,staleTime:30000,queryFn:async({signal})=>{
        const r=await fetch(`/api/organisations/${encodeURIComponent(slug)}/pilot-status`,{credentials:'include',signal,cache:'no-store'});
        if(!r.ok)throw new Error(r.status===403 ? 'Only the community owner can view pilot operations.' : 'The server checks could not be loaded. No demonstration results have been substituted.');
        return r.json();
    }});
    if(!owner)return <Empty icon={LockKeyhole} title="Owner access only" body="Pilot operations are visible only to the community owner. Your private conversations and goals stay separate." action={<Link to="/" className="button secondary">Back to your community</Link>}/>;
    if(mode==='live' && q.isPending)return <Loading label="Reading the connected pilot checks…"/>;
    if(mode==='live' && q.isError)return <ErrorState error={q.error} onRetry={()=>setRefresh(x=>x+1)}/>;
    const status=mode==='demo' ? demoPilotStatus(data) : q.data!;
    const observed=status.checks.filter(c=>c.state==='pass').length;
    const blocked=status.checks.filter(c=>c.state==='blocked').length;
    const pending=status.checks.filter(c=>c.state==='unverified').length;
    const checks=status.checks.filter(c=>filter==='all'||filter==='attention'&&['blocked','warning'].includes(c.state)||filter==='unverified'&&c.state==='unverified'||filter==='pass'&&c.state==='pass');
    function download(){
        const blob=new Blob([JSON.stringify(status,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=`reunir-${slug}-pilot-checks.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    return <div className="pilot-console">
        <PageHeading eyebrow="A SMALL PILOT. A STRONG FOUNDATION." title="Ready for your people?" body="A clear view of what is configured, what is working, and what still needs a human check." action={<div className="pilot-actions"><Button variant="secondary" size="sm" className="button secondary compact" disabled={q.isFetching} onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15}/>Refresh checks</Button><Button variant="secondary" size="sm" className="button secondary compact" onClick={download}><Download size={15}/>Export report</Button></div>}/>
        <div className="pilot-banner"><div className="pilot-banner-icon"><ShieldCheck size={27}/></div><div><Pill tone="amber">{status.source==='demo'?'DEMONSTRATION · NOT A LIVE STATUS':'OWNER-ONLY OPERATIONS'}</Pill><h2>{blocked?'Not cleared for the pilot yet.':'Configuration is only the beginning.'}</h2><p>{status.source==='demo'?'Explore the console without creating accounts, sending emails or changing infrastructure.':'These are observations, not a launch certificate. Hosting, delivery and restore tests still require recorded verification.'}</p></div></div>
        <div className="pilot-stats" aria-label="Pilot check summary">
            <div><small>Observed checks</small><strong>{observed}<span> / {status.checks.length}</span></strong><p>Configuration or scoped data</p></div>
            <div><small>Blocking checks</small><strong>{blocked}</strong><p>Resolve before inviting members</p></div>
            <div><small>Awaiting verification</small><strong>{pending}</strong><p>Never automatically marked done</p></div>
        </div>
        <div className="pilot-layout"><section aria-labelledby="pilot-checks-title" className="pilot-checks-panel"><div className="pilot-panel-head"><div><h2 id="pilot-checks-title">The pilot checklist</h2><p>Honest status. Clear next steps.</p></div><span className="pilot-version">v{status.version}</span></div>
            <div className="pilot-filters" aria-label="Filter pilot checks">{([['all','All checks'],['attention','Needs attention'],['unverified','Not verified'],['pass','Observed']] as const).map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
            <div className="pilot-check-list">{checks.map(c=><article className={`pilot-check state-${c.state}`} key={c.key} data-check={c.key}><span className="pilot-check-icon">{c.state==='pass'?<CheckCircle2 size={20}/>:c.state==='unverified'?<CircleHelp size={20}/>:<TriangleAlert size={20}/>}</span><div><div className="pilot-check-title"><h3>{c.title}</h3><span className={`pilot-state state-${c.state}`}>{stateText[c.state]}</span></div><p>{c.detail}</p>{c.action&&<p className="pilot-next"><strong>Next:</strong> {c.action}</p>}</div></article>)}{!checks.length&&<p className="pilot-no-results" role="status">No checks in this view.</p>}</div>
        </section><aside className="pilot-side"><section className="pilot-small-panel"><div className="pilot-side-title"><Activity size={18}/><h2>Delivery watch</h2></div><p>Invitation mail for this community only. Message contents and recovery links are never shown.</p><dl className="pilot-delivery"><div><dt>Queued</dt><dd>{status.delivery.queued ?? '—'}</dd></div><div><dt>Sending</dt><dd>{status.delivery.sending ?? '—'}</dd></div><div><dt>Failed</dt><dd>{status.delivery.failed ?? '—'}</dd></div></dl><div className="pilot-timestamp"><small>Last successful worker poll</small><strong>{stamp(status.delivery.lastWorkerAt)}</strong></div><div className="pilot-timestamp"><small>Last provider-accepted invitation</small><strong>{stamp(status.delivery.lastSentAt)}</strong></div><p className="pilot-note">Provider acceptance is not proof of inbox delivery. No scheduler is started by viewing this page.</p></section>
        <section className="pilot-small-panel"><h2>{status.source==='demo'?'The community in this preview':'Your community'}</h2><div className="pilot-community-counts"><span><strong>{status.community.activeMembers}</strong> active members</span><span><strong>{status.community.purposes ?? '—'}</strong> active purposes</span><span><strong>{status.community.paths ?? '—'}</strong> published paths</span><span><strong>{status.community.projects ?? '—'}</strong> projects</span></div><Link to="/access" className="pilot-text-link">Manage member access<ArrowUpRight size={15}/></Link></section>
        <section className="pilot-privacy"><LockKeyhole size={19}/><div><strong>Operations, not surveillance.</strong><p>No private goals, inboxes, passwords, email bodies or database URLs appear in this report.</p></div></section></aside></div>
        <p className="pilot-report-time">Observed {stamp(status.generatedAt)} · London time · {status.source==='demo'?'Fictional browser-local data':'Connected application observations'}</p>
    </div>;
}
