import {useLocation,useNavigate} from 'react-router-dom';
import {api} from './data';
import { createContext, useContext, useState, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Workspace, Member, CommandInput, MutationResult, Upload } from '../../../../packages/contracts/src/index';
import type { ResourceRef } from '../../../../packages/contracts/src/lesson-resources';
import { discardLessonUpload, downloadLessonResource, playLessonResource, uploadLessonResource } from './resources';
import { DEMO_ADMIN, DEMO_USER } from '../../../../packages/domain/src/seed';
import { loadWorkspace, sendCommand, displayError, errorCode, mode, identity, resetDemo, demoState, type Identity } from './data';
import { demoAccountDeleted, takeDeletionNotice } from './account';
import { signInWithPassword } from './two-factor';
import { SecondStepForm } from '../components/second-step';
import { ErrorState, ShellLoading } from '../components/states';
import { CircleAlert } from 'lucide-react';
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
    command: (c: CommandInput, options?: { onError?: (message: string, code?: string) => void }) => Promise<MutationResult | undefined>;
    /** Private lesson files. Each reports its own outcome and leaves the global busy state alone. */
    uploadResource: (trackId: string, file: File, videoBytes?: number) => Promise<Upload | undefined>;
    discardUpload: (uploadId: string) => Promise<boolean>;
    downloadResource: (ref: ResourceRef) => Promise<boolean>;
    /** A playable address for a lesson video, or undefined after showing why not. */
    playResource: (ref: ResourceRef) => Promise<string | undefined>;
    /** A short message for everyone; `error` marks a failure so it is not mistaken for a success. */
    toast: (s: string, tone?: 'error') => void;
    reload: () => void;
    /** The latest background refresh failed while earlier data is still on screen. */
    refreshError: unknown;
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
    const [notice, setNotice] = useState<{ text: string; tone?: 'error' }>({ text: '' });
    const cache = useQueryClient();
    const ident = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false });
    const userId = mode === 'demo' ? demoUser : ident.data?.id || '';
    const activeSlug = ident.data?.memberships.some(m => m.slug === slug) ? slug : ident.data?.memberships[0]?.slug || slug;
    const key = ['workspace', activeSlug, userId];
    const query = useQuery({ queryKey: key, queryFn: () => loadWorkspace(activeSlug, userId), enabled: !!ident.data && !!userId && !deletedPersona, retry: false, refetchInterval: mode==='live'?30000:false, refetchOnWindowFocus: mode === 'live' });
    // A failure stays a little longer: it usually asks the person to do something.
    const toast = useCallback((s: string, tone?: 'error') => { const next = { text: s, tone }; setNotice(next); window.setTimeout(() => setNotice(n => n === next ? { text: '' } : n), tone === 'error' ? 8000 : 4800); }, []);
    const command = async (c: CommandInput, options: { onError?: (message: string, code?: string) => void } = {}) => { if (busy)
        return; setBusy(true); try {
        const r = await sendCommand(activeSlug, userId, c);
        cache.removeQueries({ queryKey: ['workspace', activeSlug], predicate: q => q.queryKey[2] !== userId });
        cache.setQueryData(key, r.workspace);
        toast(r.message);
        return r;
    }
    catch (e) {
        if (options.onError) options.onError(displayError(e), errorCode(e));
        else toast(displayError(e), 'error');
        return undefined;
    }
    finally {
        setBusy(false);
    } };
    const refresh = async (workspace?: Workspace) => { if (workspace) cache.setQueryData(key, workspace); else await query.refetch(); };
    const uploadResource = async (trackId: string, file: File, videoBytes?: number) => { try {
        const r = await uploadLessonResource(activeSlug, userId, trackId, file, videoBytes);
        await refresh(r.workspace);
        toast(r.message);
        return r.upload;
    }
    catch (e) {
        toast(displayError(e), 'error');
        return undefined;
    } };
    const discardUpload = async (uploadId: string) => { try {
        const r = await discardLessonUpload(activeSlug, userId, uploadId);
        await refresh(r.workspace);
        toast(r.message);
        return true;
    }
    catch (e) {
        toast(displayError(e), 'error');
        return false;
    } };
    const playResource = async (ref: ResourceRef) => { try {
        return await playLessonResource(activeSlug, userId, ref);
    }
    catch (e) {
        toast(displayError(e), 'error');
        return undefined;
    } };
    const downloadResource = async (ref: ResourceRef) => { try {
        toast(`Downloading ${await downloadLessonResource(activeSlug, userId, ref)}.`);
        return true;
    }
    catch (e) {
        toast(displayError(e), 'error');
        return false;
    } };
    const accountDeleted = () => {
        if (mode === 'live') { cache.clear(); window.location.replace(window.location.origin + window.location.pathname); return; }
        cache.removeQueries({ queryKey: ['workspace'] }); setDeletions(n => n + 1);
    };
    if(mode==='live'&&['/invite','/reset-password'].includes(location.pathname))return <Suspense fallback={<ShellLoading label="Opening account access…"/>}><AccountAccessPage identity={ident.data} onDone={()=>{cache.removeQueries({queryKey:['workspace']});ident.refetch();}}/></Suspense>;
    if (ident.isPending)
        return <ShellLoading label="Finding your people…"/>;
    if (ident.error)
        return <main className="loading-page"><ErrorState error={ident.error} level={1} home={false} onRetry={() => ident.refetch()}/></main>;
    if (!ident.data)
        return <Login onDone={() => ident.refetch()}/>;
    if (!ident.data.memberships.length)
        return <div className="loading-page"><h1>Your account is ready.</h1><p>Open the personal invitation from your community owner to join. No community content is visible until your membership is active.</p></div>;
    if (deletedPersona)
        return <DemoFarewell owner={demoState('code-black').members.find(m => m.userId === DEMO_ADMIN)?.name ?? 'the owner'} onSee={() => { setDemoUser(DEMO_ADMIN); navigate('/'); }} onRestart={() => { resetDemo(); cache.removeQueries({ queryKey: ['workspace'] }); setDemoUser(DEMO_USER); setDeletions(n => n + 1); navigate('/'); }}/>;
    if (query.isPending)
        return <ShellLoading label="Opening your community…"/>;
    // Nothing loaded yet. Once a workspace has loaded, a failed refresh keeps it on screen and says so instead.
    if (!query.data)
        return <main className="loading-page"><ErrorState error={query.error} level={1} home={false} saved={mode === 'demo'} onRetry={() => query.refetch()}/>
            {ident.data.memberships.length > 1 && <div className="empty-actions">{ident.data.memberships.filter(m => m.slug !== activeSlug).map(m => <button key={m.slug} type="button" className="button secondary" onClick={() => setSlug(m.slug)}>Open {m.name}</button>)}</div>}
            {mode === 'live' && <small>No demo data has been substituted.</small>}</main>;
    const me = query.data.members.find(m => m.userId === userId)!;
    return <Context.Provider value={{ data: query.data, me, slug: activeSlug, setSlug, userId, setUserId: (id) => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); setDemoUser(id); }, busy, command, uploadResource, discardUpload, downloadResource, playResource, toast, reload: () => { cache.removeQueries({ queryKey: ['workspace'], type: 'inactive' }); query.refetch(); }, mode, identity: ident.data, accountDeleted, refreshError: query.error }}>{children}<div className={`toast ${notice.text ? 'visible' : ''} ${notice.tone === 'error' ? 'error' : ''}`} role="status" aria-live="polite" data-tone={notice.tone}>{notice.tone === 'error' && <CircleAlert size={16} aria-hidden="true"/>}<span>{notice.text}</span></div></Context.Provider>;
}
function Login({ onDone }: {
    onDone: () => void;
}) { const [email, E] = useState(''); const [password, P] = useState(''); const [error, Err] = useState(''); const [busy, B] = useState(false); const [recover,R]=useState(false);const [sent,Sent]=useState(false);const [secondStep,Second]=useState(false);const [farewell]=useState(takeDeletionNotice);
    const art=<div className="login-art"><span className="eyebrow">REUNIR</span><h1>Your people.<br />Real progress.</h1><p>A space for the conversations, ideas and work that move you forward.</p></div>;
    // Two-step sign-in: the password was right, and the account asks for its second step before a session exists.
    if(secondStep)return <main className="login-page">{art}<SecondStepForm onDone={onDone} onRestart={()=>{Second(false);P('');}}/></main>;
    return <main className="login-page">{art}<form className="form-stack" onSubmit={async (e) => { e.preventDefault(); B(true); Err(''); try {
    if(recover){await api('/api/auth/request-password-reset',{email,redirectTo:window.location.origin+'/#/reset-password'});Sent(true);return;}
    if(await signInWithPassword(email,password)==='second-step'){Second(true);return;}
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
