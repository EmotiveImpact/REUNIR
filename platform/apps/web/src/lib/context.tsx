import {useLocation,useNavigate} from 'react-router-dom';
import {api} from './data';
import { createContext, useContext, useState, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Workspace, Member, CommandInput, MutationResult, Upload } from '../../../../packages/contracts/src/index';
import type { ResourceRef } from '../../../../packages/contracts/src/lesson-resources';
import { discardLessonUpload, downloadLessonResource, uploadLessonResource } from './resources';
import { DEMO_ADMIN, DEMO_USER } from '../../../../packages/domain/src/seed';
import { loadWorkspace, sendCommand, displayError, mode, identity, resetDemo, demoState, type Identity } from './data';
import { demoAccountDeleted, takeDeletionNotice } from './account';
// Declared after the imports: Vite's development server turns React's named imports into constants in place.
const AccountAccessPage = lazy(()=>import('../pages/access').then(m=>({default:m.AccountAccessPage})));
interface Ctx {
    data: Workspace;
    me: Member;
    slug: string;
    setSlug: (s: string) => void;
    userId: string;
    setUserId: (s: string) => void;
    busy: boolean;
    /** Reports failure through `onError` when given (for example inside a dialogue), otherwise as a toast. */
    command: (c: CommandInput, options?: { onError?: (message: string) => void }) => Promise<MutationResult | undefined>;
    /** Private lesson files. Each reports its own outcome and leaves the global busy state alone. */
    uploadResource: (trackId: string, file: File) => Promise<Upload | undefined>;
    discardUpload: (uploadId: string) => Promise<boolean>;
    downloadResource: (ref: ResourceRef) => Promise<boolean>;
    toast: (s: string) => void;
    reload: () => void;
    mode: typeof mode;
    identity: Identity;
    /** After the account is deleted: live mode returns to sign-in; the demo shows what happened. */
    accountDeleted: () => void;
}
const Context = createContext<Ctx | null>(null);
export function useWorkspace() { const c = useContext(Context); if (!c)
    throw new Error('Workspace context missing'); return c; }
export function WorkspaceProvider({ children }: {
    children: ReactNode;
}) {
    const location=useLocation(), navigate=useNavigate();
    const [slug, setSlug] = useState('code-black');
    const [demoUser, setDemoUser] = useState(DEMO_USER);
    const [, setDeletions] = useState(0);
    const deletedPersona = mode === 'demo' && demoAccountDeleted(demoUser);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const cache = useQueryClient();
    const ident = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false });
    const userId = mode === 'demo' ? demoUser : ident.data?.id || '';
    const activeSlug = ident.data?.memberships.some(m => m.slug === slug) ? slug : ident.data?.memberships[0]?.slug || slug;
    const key = ['workspace', activeSlug, userId];
    const query = useQuery({ queryKey: key, queryFn: () => loadWorkspace(activeSlug, userId), enabled: !!ident.data && !!userId && !deletedPersona, retry: false, refetchInterval: mode==='live'?30000:false, refetchOnWindowFocus: mode === 'live' });
    const toast = useCallback((s: string) => { setNotice(s); window.setTimeout(() => setNotice(n => n === s ? '' : n), 4800); }, []);
    const command = async (c: CommandInput, options: { onError?: (message: string) => void } = {}) => { if (busy)
        return; setBusy(true); try {
        const r = await sendCommand(activeSlug, userId, c);
        cache.removeQueries({ queryKey: ['workspace', activeSlug], predicate: q => q.queryKey[2] !== userId });
        cache.setQueryData(key, r.workspace);
        toast(r.message);
        return r;
    }
    catch (e) {
        if (options.onError) options.onError(displayError(e));
        else toast(displayError(e));
        return undefined;
    }
    finally {
        setBusy(false);
    } };
    const refresh = async (workspace?: Workspace) => { if (workspace) cache.setQueryData(key, workspace); else await query.refetch(); };
    const uploadResource = async (trackId: string, file: File) => { try {
        const r = await uploadLessonResource(activeSlug, userId, trackId, file);
        await refresh(r.workspace);
        toast(r.message);
        return r.upload;
    }
    catch (e) {
        toast(displayError(e));
        return undefined;
    } };
    const discardUpload = async (uploadId: string) => { try {
        const r = await discardLessonUpload(activeSlug, userId, uploadId);
        await refresh(r.workspace);
        toast(r.message);
        return true;
    }
    catch (e) {
        toast(displayError(e));
        return false;
    } };
    const downloadResource = async (ref: ResourceRef) => { try {
        toast(`Downloading ${await downloadLessonResource(activeSlug, userId, ref)}.`);
        return true;
    }
    catch (e) {
        toast(displayError(e));
        return false;
    } };
    const accountDeleted = () => {
        if (mode === 'live') { cache.clear(); window.location.replace(window.location.origin + window.location.pathname); return; }
        cache.removeQueries({ queryKey: ['workspace'] }); setDeletions(n => n + 1);
    };
    if(mode==='live'&&['/invite','/reset-password'].includes(location.pathname))return <Suspense fallback={<div role="status" className="loading-page">Opening account access…</div>}><AccountAccessPage identity={ident.data} onDone={()=>{cache.removeQueries({queryKey:['workspace']});ident.refetch();}}/></Suspense>;
    if (ident.isPending)
        return <div className="loading-page"><div className="loading-mark">R</div><p>Finding your people…</p></div>;
    if (ident.error)
        return <div className="loading-page"><h1>Connection needs attention.</h1><p>{displayError(ident.error)}</p><button onClick={() => ident.refetch()}>Try again</button></div>;
    if (!ident.data)
        return <Login onDone={() => ident.refetch()}/>;
    if (!ident.data.memberships.length)
        return <div className="loading-page"><h1>Your account is ready.</h1><p>Open the personal invitation from your community owner to join. No community content is visible until your membership is active.</p></div>;
    if (deletedPersona)
        return <DemoFarewell owner={demoState('code-black').members.find(m => m.userId === DEMO_ADMIN)?.name ?? 'the owner'} onSee={() => { setDemoUser(DEMO_ADMIN); navigate('/'); }} onRestart={() => { resetDemo(); cache.removeQueries({ queryKey: ['workspace'] }); setDemoUser(DEMO_USER); setDeletions(n => n + 1); navigate('/'); }}/>;
    if (query.isPending)
        return <div className="loading-page"><div className="loading-mark">R</div><p>Opening your community…</p></div>;
    if (query.error || !query.data)
        return <div className="loading-page"><h1>Let’s reconnect.</h1><p>{displayError(query.error)}</p><button onClick={() => query.refetch()}>Try again</button><small>No demo data has been substituted.</small></div>;
    const me = query.data.members.find(m => m.userId === userId)!;
    return <Context.Provider value={{ data: query.data, me, slug: activeSlug, setSlug, userId, setUserId: (id) => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); setDemoUser(id); }, busy, command, uploadResource, discardUpload, downloadResource, toast, reload: () => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); query.refetch(); }, mode, identity: ident.data, accountDeleted }}>{children}<div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div></Context.Provider>;
}
function Login({ onDone }: {
    onDone: () => void;
}) { const [email, E] = useState(''); const [password, P] = useState(''); const [error, Err] = useState(''); const [busy, B] = useState(false); const [recover,R]=useState(false);const [sent,Sent]=useState(false);const [farewell]=useState(takeDeletionNotice);return <main className="login-page"><div className="login-art"><span className="eyebrow">REUNIR</span><h1>Your people.<br />Real progress.</h1><p>A space for the conversations, ideas and work that move you forward.</p></div><form className="form-stack" onSubmit={async (e) => { e.preventDefault(); B(true); Err(''); try {
    if(recover){await api('/api/auth/request-password-reset',{email,redirectTo:window.location.origin+'/#/reset-password'});Sent(true);return;}
    const res = await fetch('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    const j = await res.json();
    if (!res.ok)
        throw new Error(j.message || 'Unable to sign in.');
    onDone();
}
catch (e) {
    Err(displayError(e));
}
finally {
    B(false);
} }}>{farewell&&<p className="account-deleted-notice" role="status">Your account has been deleted. Thank you for being part of the community.</p>}<h2>{recover?'Find your way back.':'Good to see you.'}</h2><p>{recover?'We’ll send a reset link if the account exists.':'Sign in to your community.'}</p>{sent&&<p role="status">If there is an account with that email, a reset link has been queued. Check your inbox.</p>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={e => E(e.target.value)}/></label>{!recover&&<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => P(e.target.value)}/></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Working…' : recover?'Send reset link':'Sign in'}</button><button type="button" className="button secondary" onClick={()=>{R(!recover);Sent(false);Err('');}}>{recover?'Back to sign in':'Forgot your password?'}</button><small>Invitation-only pilot. New here? Open the personal invitation from your community owner.</small></form></main>; }
/** The demo after its persona deleted their account: what a connected community would keep, and where to go next. */
function DemoFarewell({ owner, onSee, onRestart }: { owner: string; onSee: () => void; onRestart: () => void }) {
    return <main className="loading-page account-farewell"><div className="loading-mark" aria-hidden="true">R</div><h1>Your fictional account has been deleted.</h1>
        <p>In a connected community your posts, comments and project work would stay, shown as Former member, while your profile, private goals, learning record and sign-in would be gone. This demo did the same in your browser.</p>
        <div className="farewell-actions"><button type="button" className="button primary" onClick={onSee}>See the community as {owner}</button><button type="button" className="button secondary" onClick={onRestart}>Restart the demo</button></div></main>;
}
