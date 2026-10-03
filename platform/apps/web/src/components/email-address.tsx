import { useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Mail, MailCheck } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { emailCapabilities, requestEmailChange, sendConfirmation } from '../lib/email';
import { Modal, Pill } from './ui';

/** Your account: the sign-in address, whether it is confirmed, a fresh confirmation link and changing the address. */
export function EmailAddressPanel() {
    const { mode, identity } = useWorkspace();
    const heading = useId();
    const location = useLocation();
    const cache = useQueryClient();
    const [changing, setChanging] = useState(false), [sent, setSent] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const caps = useQuery({ queryKey: ['email-capabilities'], queryFn: emailCapabilities, enabled: mode === 'live', staleTime: 300000 });
    if (mode === 'demo') return <section className="panel email-address" aria-labelledby={heading}>
        <h2 id={heading}>Email address</h2>
        <p>In a connected community your email address signs you in. A link sent to it confirms that it is yours; accepting an invitation confirms it too. You can move your account to a new address: the change happens only when you open the link sent there, and your current address is told about it.</p>
        <p className="sample-note">This fictional demo has no email addresses or sign-in, so there is nothing to confirm or change here.</p>
    </section>;
    const outcome = new URLSearchParams(location.search).get('email');
    const confirmed = !!identity.emailVerified, justConfirmed = outcome === 'confirmed';
    const resend = async () => {
        setError(''); setSent(''); setWorking(true);
        try { await sendConfirmation(identity.email ?? ''); setSent('A confirmation link is on its way. It works for 24 hours.'); }
        catch (err) { setError(displayError(err)); }
        finally { setWorking(false); }
    };
    return <section className="panel email-address" aria-labelledby={heading}>
        <div className="two-step-head"><h2 id={heading}>Email address</h2><Pill>{confirmed ? <><MailCheck size={13} aria-hidden="true"/>Confirmed</> : 'Not confirmed'}</Pill></div>
        <p className="email-current">{identity.email}</p>
        {justConfirmed && confirmed && <p className="email-confirmed" role="status">Thank you. This address is confirmed.</p>}
        {outcome === 'refused' && <p className="email-confirmed" role="status">That link no longer works because the password changed after it was sent. Your address has not changed.</p>}
        <p>{confirmed
            ? 'You sign in with this address, and password resets and invitations go to it.'
            : caps.data?.verification === 'required' ? 'Confirm this address so you can keep signing in. The link goes to the address above.' : 'Confirm this address so password resets and notices reach you. The link goes to the address above.'}</p>
        <div className="two-step-actions">
            {!confirmed && caps.data?.confirmation && <button type="button" className="button primary" onClick={resend} disabled={working}>{working ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Mail size={15} aria-hidden="true"/>}Send a confirmation link</button>}
            {caps.data?.change && <button type="button" className="button secondary" onClick={() => setChanging(true)}>Change email address…</button>}
        </div>
        {caps.data && !caps.data.change && <p className="sample-note">Changing your address needs email to be set up on this server. Ask the community owner.</p>}
        {sent && <p role="status" className="two-step-copied">{sent}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {changing && <ChangeEmailDialogue onClose={() => { setChanging(false); void cache.invalidateQueries({ queryKey: ['identity'] }); }}/>}
    </section>;
}

function ChangeEmailDialogue({ onClose }: { onClose: () => void }) {
    const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false), [done, setDone] = useState('');
    const emailField = useId(), passwordField = useId(), hint = useId();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError('');
        if (!email.trim()) { setError('Enter the new email address.'); return; }
        if (!password) { setError('Enter your password.'); return; }
        setWorking(true);
        try { setDone((await requestEmailChange(email, password)).message); }
        catch (err) { setError(displayError(err)); }
        finally { setWorking(false); }
    };
    if (done) return <Modal title="Check the new address" onClose={onClose}><div className="form-stack"><p className="account-warning">{done}</p><p className="account-warning">We have also told your current address about the change.</p><div className="modal-actions"><button type="button" className="button primary" onClick={onClose}>Done</button></div></div></Modal>;
    return <Modal title="Change your email address" onClose={() => { if (!working) onClose(); }}>
        <form className="form-stack" onSubmit={submit} noValidate>
            <p className="account-warning">We will send a confirmation link to the new address. Your address changes only when you open it, and until then your current address still signs you in.</p>
            <div className="account-field">
                <label htmlFor={emailField}>New email address</label>
                <input id={emailField} type="email" autoComplete="email" aria-describedby={hint} required value={email} onChange={e => setEmail(e.target.value)} disabled={working}/>
                <small id={hint}>Invitations already sent to your current address still need it.</small>
            </div>
            <div className="account-field"><label htmlFor={passwordField}>Your password</label><input id={passwordField} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={working}/></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={onClose} disabled={working}>Cancel</button>
                <button type="submit" className="button primary" disabled={working}>{working && <LoaderCircle size={15} className="spin" aria-hidden="true"/>}Send confirmation link</button>
            </div>
        </form>
    </Modal>;
}
