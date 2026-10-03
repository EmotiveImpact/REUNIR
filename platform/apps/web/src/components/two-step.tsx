import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Copy, KeyRound, LoaderCircle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { beginTwoStep, confirmTwoStep, newBackupCodes, turnOffTwoStep, twoStepCapabilities } from '../lib/two-factor';
import { setupKey } from '../../../../packages/contracts/src/two-factor';
import { Modal, Pill } from './ui';

const looksAfter = (role?: string) => role === 'owner' || role === 'admin';

/** Owners and administrators whose server requires two-step sign-in, and who have not turned it on yet. */
export function TwoStepNotice() {
    const { mode, identity, me } = useWorkspace();
    const needed = mode === 'live' && looksAfter(me.role) && !identity.twoFactorEnabled;
    const caps = useQuery({ queryKey: ['two-step-capabilities'], queryFn: twoStepCapabilities, enabled: needed, staleTime: 300000 });
    if (!needed || caps.data?.adminTwoFactor !== 'required') return null;
    return <div className="two-step-notice" role="status">
        <ShieldAlert size={17} aria-hidden="true"/>
        <p><strong>Turn on two-step sign-in to use owner and administrator tools.</strong> This server requires it. Everything a member can do still works.</p>
        <Link className="text-link" to="/account">Open Your account <ArrowRight size={14} aria-hidden="true"/></Link>
    </div>;
}

/** Your account: turning two-step sign-in on or off, and new backup codes. */
export function TwoStepPanel({ roles }: { roles: (string | undefined)[] }) {
    const { mode, identity } = useWorkspace();
    const heading = useId();
    const [dialogue, setDialogue] = useState<'on' | 'off' | 'codes' | null>(null);
    const caps = useQuery({ queryKey: ['two-step-capabilities'], queryFn: twoStepCapabilities, enabled: mode === 'live', staleTime: 300000 });
    const responsible = roles.some(looksAfter);
    if (mode === 'demo') return <section className="panel two-step" aria-labelledby={heading}>
        <h2 id={heading}>Two-step sign-in</h2>
        <p>In a connected community you can protect your account with a six-digit code from an authenticator app as well as your password, with one-time backup codes in case you lose your phone. Owners and administrators are asked to turn it on.</p>
        <p className="sample-note">This fictional demo has no passwords or sign-in, so there is nothing to set up here. It never shows a setup key or backup codes.</p>
    </section>;
    const on = !!identity.twoFactorEnabled, required = caps.data?.adminTwoFactor === 'required';
    return <section className="panel two-step" aria-labelledby={heading}>
        <div className="two-step-head"><h2 id={heading}>Two-step sign-in</h2><Pill>{on ? <><ShieldCheck size={13} aria-hidden="true"/>On</> : 'Off'}</Pill></div>
        <p>{on ? 'Signing in asks for your password and then a six-digit code from your authenticator app, or one of your backup codes.' : 'Ask for a six-digit code from an authenticator app after your password, so a stolen password is not enough to get in.'}</p>
        {!on && responsible && <p className="two-step-emphasis">You look after a community, so your account opens its member list and settings. {required ? 'This server requires two-step sign-in before you can use owner and administrator tools.' : 'Turning this on is strongly recommended.'}</p>}
        <div className="two-step-actions">
            {on
                ? <><button type="button" className="button secondary" onClick={() => setDialogue('codes')}><KeyRound size={15} aria-hidden="true"/>New backup codes…</button><button type="button" className="button secondary" onClick={() => setDialogue('off')}>Turn off…</button></>
                : <button type="button" className="button primary" onClick={() => setDialogue('on')}><ShieldCheck size={15} aria-hidden="true"/>Turn on two-step sign-in…</button>}
        </div>
        {dialogue === 'on' && <TurnOnDialogue onClose={() => setDialogue(null)}/>}
        {dialogue === 'off' && <PasswordDialogue title="Turn off two-step sign-in?" action="Turn off" body={required && responsible ? 'Signing in will ask only for your password, and owner and administrator tools will stop working for you until you turn it on again.' : 'Signing in will ask only for your password.'} run={async password => { await turnOffTwoStep(password); return null; }} onClose={() => setDialogue(null)}/>}
        {dialogue === 'codes' && <PasswordDialogue title="New backup codes" action="Make new codes" body="Your current backup codes stop working as soon as new ones are made." run={newBackupCodes} onClose={() => setDialogue(null)}/>}
    </section>;
}

function useRefreshIdentity() {
    const cache = useQueryClient();
    return () => cache.invalidateQueries({ queryKey: ['identity'] });
}

function PasswordField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
    const id = useId();
    return <div className="account-field"><label htmlFor={id}>Your password</label><input id={id} type="password" autoComplete="current-password" required value={value} onChange={e => onChange(e.target.value)} disabled={disabled}/></div>;
}

/** Backup codes, shown once. */
function BackupCodes({ codes }: { codes: string[] }) {
    const [copied, setCopied] = useState('');
    const copy = async () => {
        try { await navigator.clipboard.writeText(codes.join('\n')); setCopied('Copied. Paste them somewhere safe now.'); }
        catch { setCopied('Copying is not available here. Select the codes and copy them, or write them down.'); }
    };
    return <div className="two-step-codes">
        <p>Save these backup codes somewhere safe, such as a password manager. Each one signs you in once if you cannot use your authenticator app. They will not be shown again.</p>
        <ul aria-label="Backup codes">{codes.map(c => <li key={c}><code>{c}</code></li>)}</ul>
        <button type="button" className="button secondary" onClick={copy}><Copy size={15} aria-hidden="true"/>Copy the codes</button>
        {copied && <p role="status" className="two-step-copied">{copied}</p>}
    </div>;
}

function PasswordDialogue({ title, action, body, run, onClose }: { title: string; action: string; body: string; run: (password: string) => Promise<string[] | null>; onClose: () => void }) {
    const refresh = useRefreshIdentity();
    const [password, setPassword] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false), [codes, setCodes] = useState<string[] | null>(null);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (!password) { setError('Enter your password.'); return; }
        setWorking(true);
        try { const result = await run(password); if (result) { setCodes(result); setWorking(false); } else { await refresh(); onClose(); } }
        catch (err) { setError(displayError(err)); setWorking(false); }
    };
    if (codes) return <Modal title={title} onClose={onClose}><div className="form-stack"><BackupCodes codes={codes}/><div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>I have saved them</button></div></div></Modal>;
    return <Modal title={title} onClose={() => { if (!working) onClose(); }}>
        <form className="form-stack" onSubmit={submit} noValidate>
            <p className="account-warning">{body}</p>
            <PasswordField value={password} onChange={setPassword} disabled={working}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={onClose} disabled={working}>Cancel</button>
                <button type="submit" className="button primary" disabled={working}>{working && <LoaderCircle size={15} className="spin" aria-hidden="true"/>}{action}</button>
            </div>
        </form>
    </Modal>;
}

/** Password, then the setup key and a six-digit code to confirm, then the backup codes once. */
function TurnOnDialogue({ onClose }: { onClose: () => void }) {
    const refresh = useRefreshIdentity();
    const [step, setStep] = useState<'password' | 'app' | 'codes'>('password');
    const [password, setPassword] = useState(''), [code, setCode] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
    const codeField = useId(), keyLabel = useId();
    const start = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (!password) { setError('Enter your password.'); return; }
        setWorking(true);
        try { setSetup(await beginTwoStep(password)); setPassword(''); setStep('app'); }
        catch (err) { setError(displayError(err)); }
        finally { setWorking(false); }
    };
    const confirm = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setWorking(true);
        try { await confirmTwoStep(code); await refresh(); setStep('codes'); }
        catch (err) { setError(displayError(err)); }
        finally { setWorking(false); }
    };
    const close = () => { if (!working) onClose(); };
    if (step === 'codes' && setup) return <Modal title="Two-step sign-in is on" onClose={onClose}><div className="form-stack"><BackupCodes codes={setup.backupCodes}/><div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>I have saved them</button></div></div></Modal>;
    if (step === 'app' && setup) return <Modal title="Add REUNIR to your authenticator app" onClose={close}>
        <form className="form-stack" onSubmit={confirm} noValidate>
            <p className="account-warning">In your authenticator app, add an account and enter this setup key, or open the link on the device that has the app. A QR code to scan can follow in a later release.</p>
            <div className="two-step-key"><span id={keyLabel}>Setup key</span><code aria-labelledby={keyLabel}>{setupKey(setup.totpURI)}</code><small>Time-based, six digits, every 30 seconds.</small></div>
            <a className="text-link" href={setup.totpURI}>Open in an authenticator app <ArrowRight size={14} aria-hidden="true"/></a>
            <div className="account-field">
                <label htmlFor={codeField}>Six-digit code from the app</label>
                <input id={codeField} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code} onChange={e => setCode(e.target.value)} disabled={working}/>
                <small>Two-step sign-in stays off until this code is accepted.</small>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={close} disabled={working}>Cancel</button>
                <button type="submit" className="button primary" disabled={working}>{working && <LoaderCircle size={15} className="spin" aria-hidden="true"/>}Confirm and turn on</button>
            </div>
        </form>
    </Modal>;
    return <Modal title="Turn on two-step sign-in" onClose={close}>
        <form className="form-stack" onSubmit={start} noValidate>
            <p className="account-warning">You will need an authenticator app on your phone or computer. Enter your password to begin.</p>
            <PasswordField value={password} onChange={setPassword} disabled={working}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={close} disabled={working}>Cancel</button>
                <button type="submit" className="button primary" disabled={working}>{working && <LoaderCircle size={15} className="spin" aria-hidden="true"/>}Continue</button>
            </div>
        </form>
    </Modal>;
}
