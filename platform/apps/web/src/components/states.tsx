import { Component, useSyncExternalStore, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Home, KeyRound, Lock, RefreshCw, ServerCrash, ShieldAlert, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { mode } from '../lib/data';
import { ApiError, displayError, failureOf, type Failure } from '../lib/errors';
import { Button } from './ui/button';

/**
 * Loading, error and empty screens share these pieces so every part of REUNIR says the same honest thing in the same way.
 * See platform/docs/STATES.md for the conventions.
 */

const failures: Record<Failure, { icon: LucideIcon; title: string; body: string }> = {
    offline: { icon: WifiOff, title: 'You appear to be offline.', body: 'REUNIR could not be reached. Check your connection, then try again.' },
    session: { icon: KeyRound, title: 'Your session has ended.', body: 'Sign in again to carry on. Nothing you saved has been lost.' },
    'two-factor': { icon: ShieldAlert, title: 'Two-step sign-in comes first.', body: 'Owner and administrator tools need two-step sign-in. Turn it on from Your account, then try again.' },
    forbidden: { icon: Lock, title: 'This is not open to your account.', body: 'Your role in this community does not include it. If you think it should, ask an owner or administrator.' },
    'not-found': { icon: Compass, title: 'We could not find that.', body: 'It may have been removed, or the link may be out of date.' },
    outdated: { icon: RefreshCw, title: 'This part of REUNIR did not load.', body: 'REUNIR may have been updated since you opened it. Reloading fetches the latest version.' },
    unknown: { icon: TriangleAlert, title: 'This page ran into a problem.', body: 'The rest of REUNIR still works. Try again, or head back to your home.' },
};
/** The reassurance that goes with a page that failed to display. */
export const SAVED_NOTE = mode === 'demo' ? 'Your saved demo data has not been deleted.' : 'A page that fails to display does not change anything you have saved.';

/** A calm skeleton for a page or panel that is on its way. The words are read out; the shapes are not. */
export function Loading({ label = 'Loading…', lines = 3, className = '' }: { label?: string; lines?: number; className?: string }) {
    return <div className={`state-loading ${className}`} role="status" aria-busy="true" aria-live="polite">
        <div className="skeleton" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i}/>)}</div>
        <p>{label}</p>
    </div>;
}
/** A panel or list that could not load: the message, and a way to try again, in place. */
export function InlineError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    const Icon = failures[failureOf(error)].icon;
    return <div className="state-inline-error" role="alert"><Icon size={16} aria-hidden="true"/><p>{displayError(error)}</p>{onRetry && <Button variant="secondary" size="sm" type="button" className="button secondary compact" onClick={onRetry}>Try again</Button>}</div>;
}
/** A route's code or data is on its way: the shell stays, the page area shows its outline. */
export function PageLoading({ label = 'Opening your next step…' }: { label?: string }) {
    return <div className="page-loading" role="status" aria-busy="true" aria-live="polite">
        <div className="skeleton skeleton-heading" aria-hidden="true"><span/><span/><span/></div>
        <div className="skeleton-cards" aria-hidden="true"><span/><span/><span/></div>
        <p>{label}</p>
    </div>;
}
/** Before the workspace exists there is no navigation to show, so the outline of the shell stands in for it. */
export function ShellLoading({ label }: { label: string }) {
    return <div className="shell-loading" role="status" aria-busy="true" aria-live="polite">
        <div className="shell-loading-rail" aria-hidden="true"><span className="brand-mark" style={{ width: 30, height: 30, fontSize: 20 }}>R</span></div>
        <div className="shell-loading-nav skeleton" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i}/>)}</div>
        <div className="shell-loading-main"><div className="shell-loading-top" aria-hidden="true"/><div className="shell-loading-body"><div className="skeleton skeleton-heading" aria-hidden="true"><span/><span/><span/></div><p>{label}</p></div></div>
    </div>;
}

/** A plain-language failure with a way forward. Technical detail is kept, but tucked away. */
export function ErrorState({ error, onRetry, retryLabel, home = true, saved = false, level = 2 }: { error: unknown; onRetry?: () => void; retryLabel?: string; home?: boolean; saved?: boolean; level?: 1 | 2 }) {
    const kind = failureOf(error), copy = failures[kind], Icon = copy.icon, Heading = level === 1 ? 'h1' : 'h2';
    const detail = error instanceof ApiError ? `${displayError(error)} (${error.code}${error.status ? ', HTTP ' + error.status : ''})` : displayError(error);
    const retry = kind === 'session' || kind === 'outdated' ? () => window.location.reload() : onRetry;
    return <div className="state-error" role="alert" data-failure={kind}>
        <div className="empty-icon" aria-hidden="true"><Icon size={25}/></div>
        <Heading>{copy.title}</Heading>
        <p>{copy.body}</p>
        {saved && <p className="state-note">{SAVED_NOTE}</p>}
        <div className="empty-actions">
            {retry && <Button variant="default" type="button" className="button primary" onClick={retry}><RefreshCw size={16} aria-hidden="true"/>{retryLabel ?? (kind === 'session' ? 'Sign in again' : kind === 'outdated' ? 'Reload REUNIR' : 'Try again')}</Button>}
            {kind === 'two-factor' && <Link className="button secondary" to="/account">Open Your account</Link>}
            {home && <Link className="button secondary" to="/"><Home size={16} aria-hidden="true"/>Go to your home</Link>}
        </div>
        <details className="state-detail"><summary>Technical detail</summary><code>{detail}</code></details>
    </div>;
}

/** Catches a page that fails to display, keeping the shell and navigation around it. */
class Boundary extends Component<{ children: ReactNode; path: string; onRetry: () => void }, { error: unknown; path: string }> {
    state = { error: null as unknown, path: this.props.path };
    static getDerivedStateFromError(error: unknown) { return { error }; }
    static getDerivedStateFromProps(props: { path: string }, state: { error: unknown; path: string }) {
        // Moving to another page clears the failure: the next page gets its own chance.
        return props.path !== state.path ? { error: null, path: props.path } : null;
    }
    componentDidCatch(error: unknown, info: ErrorInfo) { console.error('REUNIR page error', error, info.componentStack); }
    render() {
        if (this.state.error === null) return this.props.children;
        return <ErrorState error={this.state.error} saved level={1} onRetry={() => { simulatedFault.armed = false; this.props.onRetry(); this.setState({ error: null }); }}/>;
    }
}
export function PageBoundary({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
    const { pathname } = useLocation();
    return <Boundary path={pathname} onRetry={onRetry}>{children}</Boundary>;
}

/** An address that matches no page. */
export function NotFound() {
    const { pathname } = useLocation();
    return <div className="state-error not-found" data-failure="not-found">
        <div className="empty-icon" aria-hidden="true"><Compass size={25}/></div>
        <h1>We could not find that page.</h1>
        <p>The link may be out of date, or the page may have moved. Nothing you saved has changed.</p>
        <p className="state-note">You asked for <code>{pathname}</code></p>
        <div className="empty-actions"><Link className="button primary" to="/"><Home size={16} aria-hidden="true"/>Go to your home</Link><Link className="button secondary" to="/members">Find your people</Link></div>
    </div>;
}

/** Whether the browser believes it has a connection. */
const subscribe = (change: () => void) => { window.addEventListener('online', change); window.addEventListener('offline', change); return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); }; };
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

/** A quiet line under the top bar when the connection, or the latest refresh, needs attention. */
export function ConnectionNotice({ online, refreshError, onRetry }: { online: boolean; refreshError: unknown; onRetry: () => void }) {
    if (!online) return <div className="state-banner" role="status" data-state="offline"><WifiOff size={17} aria-hidden="true"/>
        <p><strong>You are offline.</strong> {mode === 'demo' ? 'This fictional demo keeps working in your browser. Nothing is sent anywhere.' : 'You can keep reading what has loaded. Changes cannot be saved until you reconnect.'}</p></div>;
    if (!refreshError) return null;
    const kind = failureOf(refreshError);
    return <div className="state-banner" role="status" data-state={kind}>{kind === 'session' ? <KeyRound size={17} aria-hidden="true"/> : <ServerCrash size={17} aria-hidden="true"/>}
        <p>{kind === 'session' ? <><strong>Your session has ended.</strong> Sign in again to carry on. What you see may be out of date.</> : kind === 'forbidden' ? <><strong>Your access has changed.</strong> Reload to see what this account can open now.</> : <><strong>The latest changes could not be loaded.</strong> You are seeing what was loaded earlier.</>}</p>
        <Button variant="secondary" size="sm" type="button" className="button secondary compact" onClick={kind === 'session' || kind === 'forbidden' ? () => window.location.reload() : onRetry}>{kind === 'session' ? 'Sign in again' : kind === 'forbidden' ? 'Reload' : 'Try again'}</Button></div>;
}

/** Demo only: set by the simulated fault page (components/simulated-fault.tsx) and cleared by Retry. */
export const simulatedFault = { armed: true };
