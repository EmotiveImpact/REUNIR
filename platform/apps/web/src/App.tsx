import { Button } from './components/ui/button';
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { Routes, Route, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Bookmark, BookOpen, Calendar, Check, ChevronDown, ChevronRight, Command, Compass, Folder, HelpCircle, Home, Layers, Lock, Menu, MessageCircle, Mail, Plus, Search, Settings, Shield, Sparkles, Target, Users, X, LogOut, UserRound, SearchX, SlidersHorizontal, GraduationCap, KeyRound, LibraryBig } from 'lucide-react';
import { useWorkspace } from './lib/context';
import { Avatar, Empty, Mark, Modal, Pill, present } from './components/ui';
import { CreateModal, type CreateKind } from './components/forms';
import { isAdmin, isModerator } from '../../../packages/domain/src/engine';
import { resetDemo, mode as dataMode } from './lib/data';
import { demoAccountDeleted } from './lib/account';
import { DEMO_USER, DEMO_ADMIN, DEMO_INSTRUCTOR } from '../../../packages/domain/src/seed';
import { contributesAny } from '../../../packages/domain/src/instructors';
import { TwoStepNotice } from './components/two-step';
import { ConnectionNotice, NotFound, PageBoundary, PageLoading, useOnline } from './components/states';
import { SimulatedFault } from './components/simulated-fault';
const AuthoringPage=lazy(()=>import('./pages/authoring').then(m=>({default:m.AuthoringPage})));
const MessagesPage=lazy(()=>import('./pages/messages').then(m=>({default:m.MessagesPage})));
const AccountPage=lazy(()=>import('./pages/account').then(m=>({default:m.AccountPage})));
const MemberAccessPage=lazy(()=>import('./pages/access').then(m=>({default:m.MemberAccessPage})));
const PurposeHome=lazy(()=>import('./pages/purpose').then(m=>({default:m.PurposeHome})));
const PathsPage=lazy(()=>import('./pages/purpose').then(m=>({default:m.PathsPage})));
const PathPage=lazy(()=>import('./pages/purpose').then(m=>({default:m.PathPage})));
const DiscussionsPage=lazy(()=>import('./pages/purpose').then(m=>({default:m.DiscussionsPage})));
const KnowledgePage=lazy(()=>import('./pages/purpose').then(m=>({default:m.KnowledgePage})));
const OutputsPage=lazy(()=>import('./pages/purpose').then(m=>({default:m.OutputsPage})));
const PostPage=lazy(()=>import('./pages/community').then(m=>({default:m.PostPage})));
const CollectionsPage=lazy(()=>import('./pages/collections').then(m=>({default:m.CollectionsPage})));
const CollectionPage=lazy(()=>import('./pages/collections').then(m=>({default:m.CollectionPage})));
const SavedPage=lazy(()=>import('./pages/community').then(m=>({default:m.SavedPage})));
const SpacePage=lazy(()=>import('./pages/community').then(m=>({default:m.SpacePage})));
const LearnPage=lazy(()=>import('./pages/learning').then(m=>({default:m.LearnPage})));
const TrackPage=lazy(()=>import('./pages/learning').then(m=>({default:m.TrackPage})));
const MissionsPage=lazy(()=>import('./pages/doing').then(m=>({default:m.MissionsPage})));
const MissionPage=lazy(()=>import('./pages/doing').then(m=>({default:m.MissionPage})));
const ProjectsPage=lazy(()=>import('./pages/doing').then(m=>({default:m.ProjectsPage})));
const ProjectWorkPage=lazy(()=>import('./pages/project-work').then(m=>({default:m.ProjectWorkPage})));
const ProjectPage=lazy(()=>import('./pages/doing').then(m=>({default:m.ProjectPage})));
const EventsPage=lazy(()=>import('./pages/events').then(m=>({default:m.EventsPage})));
const EventPage=lazy(()=>import('./pages/events').then(m=>({default:m.EventPage})));
const MembersPage=lazy(()=>import('./pages/people').then(m=>({default:m.MembersPage})));
const ProfilePage=lazy(()=>import('./pages/people').then(m=>({default:m.ProfilePage})));
const NotificationsPage=lazy(()=>import('./pages/people').then(m=>({default:m.NotificationsPage})));
const AdminPage=lazy(()=>import('./pages/people').then(m=>({default:m.AdminPage})));
const SettingsPage=lazy(()=>import('./pages/people').then(m=>({default:m.SettingsPage})));
const PilotOperationsPage=lazy(()=>import('./pages/operations').then(m=>({default:m.PilotOperationsPage})));
const TeachingPage=lazy(()=>import('./pages/teaching').then(m=>({default:m.TeachingPage})));
const AppealsPage=lazy(()=>import('./pages/appeals').then(m=>({default:m.AppealsPage})));
const nav = [['/', 'Your home', Home], ['/paths', 'Paths & learning', BookOpen], ['/projects', 'Projects', Layers], ['/events', 'Events', Calendar], ['/members', 'Your people', Users], ['/discussions', 'Discussions', MessageCircle], ['/messages', 'Messages', Mail], ['/knowledge', 'Knowledge', Folder], ['/collections', 'Collections', LibraryBig]] as const;
export default function App() {
    const { data, me, slug, setSlug, userId, setUserId, mode, reload, toast, identity, busy, refreshError } = useWorkspace();
    const online = useOnline();
    const wasOnline = useRef(online);
    const [search, S] = useState(false);
    const [help, H] = useState(false);
    const [mobile, M] = useState(false);
    const [create, C] = useState<CreateKind | null>(null);
    const [chooser, Q] = useState(false);
    const [communities, Cm] = useState(false);
    const loc = useLocation();
    const navigate = useNavigate();
    const navPanel=useRef<HTMLElement>(null);
    useEffect(()=>{if(!mobile)return;const before=document.activeElement as HTMLElement;const panel=navPanel.current;const targets=()=>Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')||[]);targets()[0]?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){M(false);return;}if(e.key!=='Tab')return;const t=targets();const first=t[0],last=t[t.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);before?.focus();};},[mobile]);
    useEffect(() => { M(false); document.querySelector('.main-content')?.scrollTo(0, 0); window.scrollTo(0, 0); }, [loc.pathname]);
    useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        S(s => !s);
    } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
    useEffect(() => { document.documentElement.dataset.accent = data.organisation.accent; }, [data.organisation.accent]);
    // Coming back online: say so, and fetch anything that changed meanwhile.
    useEffect(() => { if (online && !wasOnline.current) { toast('You are back online.'); reload(); } wasOnline.current = online; }, [online]);
    const unread = data.summary?.unreadNotifications ?? data.notifications.filter(n => !n.readAt).length;
    const area = loc.pathname.startsWith('/appeals') ? 'Appeals' : loc.pathname.startsWith('/teaching') ? 'Teaching' : loc.pathname.startsWith('/operations') ? 'Pilot console' : loc.pathname.startsWith('/messages') ? 'Messages' : loc.pathname.startsWith('/access') ? 'Member access' : loc.pathname.startsWith('/paths') ? 'Paths & learning' : loc.pathname.startsWith('/outputs') ? 'Community outputs' : loc.pathname.startsWith('/discussions') ? 'Discussions' : loc.pathname.startsWith('/knowledge') ? 'Knowledge' : loc.pathname.startsWith('/collections') ? 'Collections' : loc.pathname.startsWith('/learn') ? 'Learning' : loc.pathname.startsWith('/missions') ? 'Missions' : loc.pathname.startsWith('/projects') ? 'Projects' : loc.pathname.startsWith('/events') ? 'Events' : loc.pathname.startsWith('/members') ? 'Your people' : loc.pathname.startsWith('/admin') ? 'Community studio' : loc.pathname.startsWith('/settings') ? 'Settings' : loc.pathname.startsWith('/profile') ? 'Your profile' : loc.pathname.startsWith('/saved') ? 'Saved' : loc.pathname.startsWith('/notifications') ? 'Notifications' : 'Your home';
    async function signOut(){try{const r=await fetch('/api/auth/sign-out',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw new Error('Sign out did not complete. Please try again.');window.location.reload();}catch(e){toast(e instanceof Error?e.message:'Unable to sign out.','error');}}
    return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a>
    <aside className="workspace-rail" aria-label="Workspace switcher">
      <Link to="/" className="rail-brand" aria-label="REUNIR home"><Mark size={30}/></Link>
      <div className="rail-communities">{identity.memberships.map(m=><button key={m.slug} className={`workspace-icon ${m.slug===slug?'current':''}`} title={m.name} aria-label={mode==='demo'?(m.slug==='code-black'?'Open Code Black':'Open Studio North demo community'):`Open ${m.name}`} aria-current={m.slug===slug?'true':undefined} onClick={()=>{setSlug(m.slug);navigate('/');}}>{m.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</button>)}</div>
      <button className="rail-add" aria-label="Your communities" title="Your communities" onClick={()=>Cm(true)}><Plus size={18}/></button>
      <div className="rail-bottom"><button className="icon-button" aria-label="About this alpha" title="Help and demo information" onClick={()=>H(true)}><HelpCircle size={18}/></button></div>
    </aside>
    {mobile&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>M(false)}/>}
    <aside ref={navPanel} role={mobile?'dialog':undefined} aria-modal={mobile||undefined} className={`sidebar ${mobile?'open':''}`} aria-label="Main navigation" onClick={e=>{if((e.target as HTMLElement).closest('a'))M(false);}}>
      <button className="icon-button sidebar-close" aria-label="Close navigation panel" onClick={()=>M(false)}><X size={18}/></button><Link to="/" className="sidebar-brand"><strong>REUNIR</strong><small>A place to become.</small></Link>
      <nav className="primary-nav">{nav.map(([to,label,Icon])=><NavLink key={to} to={to} end={to==='/'}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-section-label"><span>YOUR SPACES</span>{isAdmin(me)&&<button className="icon-button" aria-label="Create a space" onClick={()=>C('space')}><Plus size={14}/></button>}</div>
      <nav className="spaces-nav">{data.spaces.map(s=><NavLink to={`/spaces/${s.id}`} key={s.id}><span className="space-icon">{s.kind==='learning'?<BookOpen size={17}/>:s.kind==='project'?<Layers size={17}/>:<MessageCircle size={17}/>}</span><span>{s.name}</span>{s.visibility==='private'&&<Lock size={12}/>}</NavLink>)}</nav>
      <div className="sidebar-section-label"><span>YOUR PROGRESS</span></div>
      <div className="sidebar-lower"><NavLink to="/missions"><Target size={17}/>Missions</NavLink><NavLink to="/outputs"><Layers size={17}/>Community outputs</NavLink><NavLink to="/saved"><Bookmark size={17}/>Saved for later</NavLink>
      {isModerator(me)&&<div className="management-nav"><span className="sidebar-section-label">MANAGE COMMUNITY</span><NavLink to="/admin"><Shield size={17}/>Community studio</NavLink>{isAdmin(me)&&<><NavLink to="/access"><Users size={17}/>Member access</NavLink><NavLink to="/settings"><Settings size={17}/>Community settings</NavLink></>}{me.role==='owner'&&<NavLink to="/operations"><SlidersHorizontal size={17}/>Pilot console</NavLink>}</div>}{!isAdmin(me)&&contributesAny(data,me)&&<div className="management-nav"><span className="sidebar-section-label">YOUR TEACHING</span><NavLink to="/teaching"><GraduationCap size={17}/>Teaching</NavLink></div>}</div>
    </aside>
    <div className="app-main"><header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobile} onClick={()=>M(!mobile)}><Menu size={21}/></button>
      <div className="breadcrumb"><span>{data.organisation.name}</span><ChevronRight size={13}/><strong>{area==='Your home'?'Home':area}</strong></div>
      <div className="topbar-actions"><button className="header-search" aria-label="Search" onClick={()=>S(true)}><Search size={16}/><span>Search anything…</span><kbd>⌘ K</kbd></button>
      <Button onClick={()=>Q(true)} size="sm" className="create-button"><Plus size={16}/><span>Create</span></Button>
      <Link to="/notifications" aria-label={`${unread} unread notifications`} className="icon-button notification-button"><Bell size={18}/>{unread>0&&<span/>}</Link>
      <DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="top-avatar" aria-label="Account menu"><Avatar member={me} size="sm"/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="account-menu"><DropdownMenuLabel><strong>{me.name}</strong><small>{data.organisation.name} · {me.role}</small></DropdownMenuLabel><DropdownMenuSeparator/>
      <DropdownMenuItem onSelect={()=>navigate('/profile')}><UserRound size={16}/>Your profile</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>navigate('/saved')}><Bookmark size={16}/>Saved for later</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>navigate('/notifications')}><Bell size={16}/>Notifications</DropdownMenuItem>
      {isAdmin(me)&&<DropdownMenuItem onSelect={()=>navigate('/settings')}><Settings size={16}/>Community settings</DropdownMenuItem>}
      <DropdownMenuItem onSelect={()=>Cm(true)}><Layers size={16}/>Your communities</DropdownMenuItem>
      <DropdownMenuItem onSelect={()=>navigate('/account')}><KeyRound size={16}/>Your account</DropdownMenuItem><DropdownMenuSeparator/>
      {mode==='demo'?([[DEMO_USER,'member'],[DEMO_ADMIN,'admin'],[DEMO_INSTRUCTOR,'instructor']] as const).filter(([id])=>id!==userId&&!demoAccountDeleted(id)).map(([id,label])=><DropdownMenuItem key={id} onSelect={()=>{M(false);setUserId(id);navigate('/');}}>Preview as {label}<ArrowRight size={16}/></DropdownMenuItem>):<DropdownMenuItem onSelect={signOut}><LogOut size={16}/>Sign out</DropdownMenuItem>}
      <DropdownMenuItem onSelect={()=>H(true)}><HelpCircle size={16}/>{mode==='demo'?'About this fictional demo':'Help and information'}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu></div></header>{busy&&<div className="command-progress" aria-hidden="true"><span/></div>}<main id="main" className="main-content" aria-busy={busy||undefined}><ConnectionNotice online={online} refreshError={refreshError} onRetry={reload}/>{loc.pathname!=='/account'&&<TwoStepNotice/>}<PageBoundary onRetry={reload}><Suspense fallback={<PageLoading/>}><Routes><Route path="/" element={<PurposeHome />}/><Route path="/paths" element={<PathsPage />}/><Route path="/paths/:id" element={<PathPage />}/><Route path="/discussions" element={<DiscussionsPage />}/><Route path="/community" element={<DiscussionsPage />}/><Route path="/knowledge" element={<KnowledgePage />}/><Route path="/outputs" element={<OutputsPage />}/><Route path="/spaces/:id" element={<SpacePage />}/><Route path="/post/:id" element={<PostPage />}/><Route path="/learn" element={<LearnPage />}/><Route path="/learn/:id" element={<TrackPage />}/><Route path="/learn/:id/studio" element={<AuthoringPage key={slug+userId+loc.pathname}/>}/><Route path="/learn/:id/:lessonId" element={<TrackPage />}/><Route path="/missions" element={<MissionsPage />}/><Route path="/missions/:id" element={<MissionPage />}/><Route path="/projects" element={<ProjectsPage />}/><Route path="/projects/:id" element={<ProjectPage />}/><Route path="/projects/:id/work" element={<ProjectWorkPage />}/><Route path="/events" element={<EventsPage />}/><Route path="/events/:id" element={<EventPage />}/><Route path="/members" element={<MembersPage />}/><Route path="/members/:id" element={<ProfilePage />}/><Route path="/profile" element={<ProfilePage />}/><Route path="/notifications" element={<NotificationsPage />}/><Route path="/saved" element={<SavedPage />}/><Route path="/collections" element={<CollectionsPage />}/><Route path="/collections/:id" element={<CollectionPage />}/><Route path="/messages" element={<MessagesPage key={slug+userId+loc.pathname}/>}/><Route path="/messages/:id" element={<MessagesPage key={slug+userId+loc.pathname}/>}/><Route path="/operations" element={<PilotOperationsPage/>}/><Route path="/access" element={<MemberAccessPage/>}/><Route path="/admin/*" element={<AdminPage />}/><Route path="/teaching" element={<TeachingPage />}/><Route path="/appeals" element={<AppealsPage />}/><Route path="/settings" element={<SettingsPage />}/><Route path="/account" element={<AccountPage />}/>{/* Demo only: the build constant leaves this route out of the connected application. */dataMode==='demo'&&<Route path="/states/fault" element={<SimulatedFault/>}/>}<Route path="*" element={<NotFound/>}/></Routes></Suspense></PageBoundary><footer className="app-footer"><Mark size={13}/><span>REUNIR</span><i>·</i><span>Your people. Real progress.</span><small>{mode==='demo'?'FICTIONAL DEMO · BROWSER-LOCAL':'CONNECTED ALPHA'} · 07</small></footer></main></div>
 <nav className="mobile-bottom" aria-label="Mobile navigation">{nav.slice(0, 5).map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'}><Icon size={20}/><span>{to === '/' ? 'Home' : to === '/paths' ? 'Paths' : to === '/members' ? 'People' : label}</span></NavLink>)}</nav>
 {communities && <Modal title="Your communities" onClose={() => Cm(false)}><div className="create-options">{identity.memberships.map(m => <button key={m.slug} onClick={() => { setSlug(m.slug); navigate('/'); Cm(false); }}><span className="community-monogram">{m.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span><span><strong>{m.name}</strong><small>{m.slug === slug ? 'You are here' : 'Open your community'}</small></span>{m.slug === slug ? <Check size={18}/> : <ArrowRight size={18}/>}</button>)}</div></Modal>}{search && <SearchModal onClose={() => S(false)}/>}{create && <CreateModal kind={create} onClose={() => C(null)}/>}{chooser && <Modal title="Start something good." onClose={() => Q(false)}><div className="create-options">{([['post', 'Start a conversation', 'An idea, question or a small win.', MessageCircle], ['project', 'Start a project', 'Give a good idea somewhere to grow.', Layers], ...(isAdmin(me) ? [['track', 'Create a learning track', 'Give somebody a useful next step.', BookOpen], ['mission', 'Create a mission', 'Turn learning into something real.', Target], ['event', 'Create an event', 'Make time for your people.', Calendar]] : [])] as [
        CreateKind,
        string,
        string,
        typeof Home
    ][]).map(([k, t, b, I]) => <button key={k} onClick={() => { Q(false); C(k); }}><span className="option-icon"><I size={21}/></span><span><strong>{t}</strong><small>{b}</small></span><ArrowUpRight size={17}/></button>)}</div></Modal>}
 {help && <Modal title="Welcome to REUNIR, creator preview." onClose={() => H(false)}><div className="help-content"><Pill tone="amber">{mode === 'demo' ? 'FICTIONAL DATA · REAL INTERACTIONS' : 'CONNECTED API MODE'}</Pill><h3>People. Purpose. Progress. Projects. Proof.</h3><p>Community stays at the heart of the experience. Paths connect learning, missions and recognised work to what people are here to become, build or achieve.</p><p>{mode === 'demo' ? 'You are exploring a fictional Code Black community. Changes are saved in this browser, not to Neon. Use “Preview as admin” to create content, review proof and try the community tools, or “Preview as instructor” to teach one track.' : 'Your data is coming from the configured server. Only your verified community permissions determine what you can access.'}</p><p>Private messages and member access are available. In this preview, messaging is browser-local and invitations never send email. Connected email and password recovery need a configured provider and mail worker. Payments, AI and native video remain outside this release.</p>{mode === 'demo' && <><p>The second workspace in the left rail demonstrates independent communities. It is also fictional.</p><button className="button secondary" onClick={() => { if (window.confirm('Reset all fictional demo activity in this browser?')) {
        resetDemo();
        reload();
        H(false);
    } }}>Reset the fictional demo</button></>}<span className="sample-note">Never put private, client or sensitive data into this preview.</span></div></Modal>}
 </div>;
}
function SearchModal({ onClose }: {
    onClose: () => void;
}) { const { data } = useWorkspace(); const [q, Q] = useState(''); const navigate = useNavigate(); const items = [...data.projectTasks.filter(t=>!t.archived).map(t=>({id:t.id,title:t.title,text:t.brief,kind:'Task',href:`/projects/${t.projectId}/work?task=${t.id}`})), ...data.paths.map(x=>({id:x.id,title:x.title,text:x.summary,kind:'Path',href:`/paths/${x.id}`})), ...data.communityOutputs.map(x=>({id:x.id,title:x.title,text:x.summary,kind:'Output',href:'/outputs'})), ...(data.collections??[]).map(x=>({id:x.id,title:x.title,text:x.description,kind:'Collection',href:'/collections/'+x.id})), ...data.posts.map(x => ({ id: x.id, title: x.title || x.body.slice(0, 60), text: x.body, kind: 'Conversation', href: `/post/${x.id}` })), ...data.tracks.map(x => ({ id: x.id, title: x.title, text: x.summary, kind: 'Learning', href: `/learn/${x.id}` })), ...data.missions.map(x => ({ id: x.id, title: x.title, text: x.brief, kind: 'Mission', href: `/missions/${x.id}` })), ...data.projects.map(x => ({ id: x.id, title: x.title, text: x.tagline, kind: 'Project', href: `/projects/${x.id}` })), ...data.events.map(x => ({ id: x.id, title: x.title, text: x.summary, kind: 'Event', href: `/events/${x.id}` })), ...present(data.members).map(x => ({ id: x.id, title: x.name, text: x.headline + ' ' + x.skills.join(' '), kind: 'Person', href: `/members/${x.userId}` }))]; const result = (q ? items.filter(x => (x.title + ' ' + x.text).toLowerCase().includes(q.toLowerCase())) : items.filter(x => ['Path', 'Learning', 'Project', 'Mission'].includes(x.kind))).slice(0, 12); return <Modal title="Find something good." onClose={onClose}><div className="global-search"><Search size={20}/><input autoFocus aria-label="Search your community" placeholder="People, ideas, projects or a useful next step…" value={q} onChange={e => Q(e.target.value)}/></div><p className="search-note">{q ? `${result.length} matching items` : 'A few places to start'} · Only content you can access</p><div className="search-results">{result.map(r => <button key={r.kind + r.id} onClick={() => { navigate(r.href); onClose(); }}><span><small>{r.kind}</small><strong>{r.title}</strong></span><ArrowUpRight size={17}/></button>)}{!result.length && <Empty icon={SearchX} title="Nothing quite matches yet." body="Try a name, a skill or a different phrase. Search covers only what you can open."/>}</div></Modal>; }
