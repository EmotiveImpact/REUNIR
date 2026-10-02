const AccountAccessPage = lazy(()=>import('../pages/access').then(m=>({default:m.AccountAccessPage})));
import {useLocation} from 'react-router-dom';
import {api} from './data';
import { createContext, useContext, useState, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Workspace, Member, CommandInput, MutationResult } from '../../../../packages/contracts/src/index';
import { DEMO_USER } from '../../../../packages/domain/src/seed';
import { loadWorkspace, sendCommand, displayError, mode, identity, type Identity } from './data';
interface Ctx {
    data: Workspace;
    me: Member;
    slug: string;
    setSlug: (s: string) => void;
    userId: string;
    setUserId: (s: string) => void;
    busy: boolean;
    command: (c: CommandInput) => Promise<MutationResult | undefined>;
    toast: (s: string) => void;
    reload: () => void;
    mode: typeof mode;
    identity: Identity;
}
const Context = createContext<Ctx | null>(null);
export function useWorkspace() { const c = useContext(Context); if (!c)
    throw new Error('Workspace context missing'); return c; }
export function WorkspaceProvider({ children }: {
    children: ReactNode;
}) {
    const location=useLocation();
    const [slug, setSlug] = useState('code-black');
    const [demoUser, setDemoUser] = useState(DEMO_USER);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const cache = useQueryClient();
    const ident = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false });
    const userId = mode === 'demo' ? demoUser : ident.data?.id || '';
    const activeSlug = ident.data?.memberships.some(m => m.slug === slug) ? slug : ident.data?.memberships[0]?.slug || slug;
    const key = ['workspace', activeSlug, userId];
    const query = useQuery({ queryKey: key, queryFn: () => loadWorkspace(activeSlug, userId), enabled: !!ident.data && !!userId, retry: false, refetchInterval: mode==='live'?30000:false, refetchOnWindowFocus: mode === 'live' });
    const toast = useCallback((s: string) => { setNotice(s); window.setTimeout(() => setNotice(n => n === s ? '' : n), 4800); }, []);
    const command = async (c: CommandInput) => { if (busy)
        return; setBusy(true); try {
        const r = await sendCommand(activeSlug, userId, c);
        cache.removeQueries({ queryKey: ['workspace', activeSlug], predicate: q => q.queryKey[2] !== userId });
        cache.setQueryData(key, r.workspace);
        toast(r.message);
        return r;
    }
    catch (e) {
        toast(displayError(e));
        return undefined;
    }
    finally {
        setBusy(false);
    } };
    if(mode==='live'&&['/invite','/reset-password'].includes(location.pathname))return <Suspense fallback={<div role="status" className="loading-page">Opening account access…</div>}><AccountAccessPage identity={ident.data} onDone={()=>{cache.removeQueries({queryKey:['workspace']});ident.refetch();}}/></Suspense>;
    if (ident.isPending)
        return <div className="loading-page"><div className="loading-mark">R</div><p>Finding your people…</p></div>;
    if (ident.error)
        return <div className="loading-page"><h1>Connection needs attention.</h1><p>{displayError(ident.error)}</p><button onClick={() => ident.refetch()}>Try again</button></div>;
    if (!ident.data)
        return <Login onDone={() => ident.refetch()}/>;
    if (!ident.data.memberships.length)
        return <div className="loading-page"><h1>Your account is ready.</h1><p>Open the personal invitation from your community owner to join. No community content is visible until your membership is active.</p></div>;
    if (query.isPending)
        return <div className="loading-page"><div className="loading-mark">R</div><p>Opening your community…</p></div>;
    if (query.error || !query.data)
        return <div className="loading-page"><h1>Let’s reconnect.</h1><p>{displayError(query.error)}</p><button onClick={() => query.refetch()}>Try again</button><small>No demo data has been substituted.</small></div>;
    const me = query.data.members.find(m => m.userId === userId)!;
    return <Context.Provider value={{ data: query.data, me, slug: activeSlug, setSlug, userId, setUserId: (id) => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); setDemoUser(id); }, busy, command, toast, reload: () => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); query.refetch(); }, mode, identity: ident.data }}>{children}<div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">{notice}</div></Context.Provider>;
}
function Login({ onDone }: {
    onDone: () => void;
}) { const [email, E] = useState(''); const [password, P] = useState(''); const [error, Err] = useState(''); const [busy, B] = useState(false); const [recover,R]=useState(false);const [sent,Sent]=useState(false);return <main className="login-page"><div className="login-art"><span className="eyebrow">REUNIR</span><h1>Your people.<br />Real progress.</h1><p>A space for the conversations, ideas and work that move you forward.</p></div><form className="form-stack" onSubmit={async (e) => { e.preventDefault(); B(true); Err(''); try {
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
} }}><h2>{recover?'Find your way back.':'Good to see you.'}</h2><p>{recover?'We’ll send a reset link if the account exists.':'Sign in to your community.'}</p>{sent&&<p role="status">If there is an account with that email, a reset link has been queued. Check your inbox.</p>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={e => E(e.target.value)}/></label>{!recover&&<label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => P(e.target.value)}/></label>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Working…' : recover?'Send reset link':'Sign in'}</button><button type="button" className="button secondary" onClick={()=>{R(!recover);Sent(false);Err('');}}>{recover?'Back to sign in':'Forgot your password?'}</button><small>Invitation-only pilot. New here? Open the personal invitation from your community owner.</small></form></main>; }
