import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LoaderCircle, Trash2 } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { demoState, displayError } from '../lib/data';
import { deleteAccount, ownedCommunities, DEMO_COMMUNITIES } from '../lib/account';
import { Modal, PageHeading, Pill } from '../components/ui';
import { ACCOUNT_DELETION_PHRASE, FORMER_MEMBER, listNames, ownerRefusal } from '../../../../packages/contracts/src/account';

const KEPT = ['Posts and comments, so conversations still make sense', 'Projects, updates, task notes and the proof you submitted', 'Lessons, files and covers you added for a community', 'Messages you sent, for the people you wrote to'];
const GONE = ['Your name, photo, headline, bio and skills', 'Private goals, saved posts, notifications, reactions and event replies', 'Your learning record: tracks, completed lessons, knowledge-check answers and points', 'Your sign-in, sessions and email address'];

/** One sign-in across communities: where you belong, and deleting the account everywhere at once. */
export function AccountPage() {
    const { identity, mode, userId } = useWorkspace();
    const [confirming, setConfirming] = useState(false);
    const heading = useId();
    // The demo's communities are fictional and local, so the persona's memberships come from them.
    const communities = mode === 'demo'
        ? DEMO_COMMUNITIES.map(demoState).flatMap(s => s.members.filter(m => m.userId === userId && m.status === 'active').map(m => ({ slug: s.organisation.slug, name: s.organisation.name, role: m.role })))
        : identity.memberships;
    const owned = ownedCommunities(userId, identity.memberships);
    return <>
        <PageHeading eyebrow="ONE SIGN-IN, EVERY COMMUNITY" title="Your account." body="Where you belong, and what happens if you leave REUNIR altogether."/>
        <div className="reading-width account-page">
            <section className="panel">
                <h2>Your communities</h2>
                <ul className="account-communities">{communities.map(c => <li key={c.slug}><span>{c.name}</span>{c.role && <Pill>{c.role}</Pill>}</li>)}</ul>
            </section>
            <section className="panel account-delete" aria-labelledby={heading}>
                <h2 id={heading}>Delete your account</h2>
                <p>Deleting your account applies to every community you belong to, and it cannot be undone.</p>
                <div className="account-outcomes">
                    <div><h3>What stays, shown as {FORMER_MEMBER}</h3><ul>{KEPT.map(x => <li key={x}>{x}</li>)}</ul></div>
                    <div><h3>What goes</h3><ul>{GONE.map(x => <li key={x}>{x}</li>)}</ul></div>
                </div>
                <p>Want a copy of your learning first? Download your learning record from your profile in each community.</p>
                <Link className="text-link" to="/profile">Open your profile <ArrowRight size={14} aria-hidden="true"/></Link>
                {owned.length
                    ? <><p className="account-owner-note">{ownerRefusal(owned)} Hand each one to an administrator first, from that person’s access settings.</p><Link className="text-link" to="/access">Open members and access <ArrowRight size={14} aria-hidden="true"/></Link></>
                    : <div><button type="button" className="button secondary" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden="true"/>Delete your account…</button></div>}
            </section>
        </div>
        {confirming && <DeleteAccountDialogue communities={communities.map(c => c.name)} onClose={() => setConfirming(false)}/>}
    </>;
}

function DeleteAccountDialogue({ communities, onClose }: { communities: string[]; onClose: () => void }) {
    const { mode, userId, accountDeleted } = useWorkspace();
    const [password, setPassword] = useState(''), [phrase, setPhrase] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const passwordField = useId(), phraseField = useId(), phraseHint = useId();
    const submit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setWorking(true);
        try { await deleteAccount(userId, password, phrase); accountDeleted(); }
        catch (err) { setError(displayError(err)); setWorking(false); }
    };
    return <Modal title="Delete your account?" onClose={() => { if (!working) onClose(); }}>
        <form className="form-stack" onSubmit={submit} noValidate>
            <p className="account-warning">This deletes your account in every community you belong to{communities.length ? `, including ${listNames(communities)},` : ''} and cannot be undone. Your posts, comments and project work stay, shown as {FORMER_MEMBER}.</p>
            {mode === 'live'
                ? <div className="account-field"><label htmlFor={passwordField}>Your password</label><input id={passwordField} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={working}/></div>
                : <p className="sample-note">This fictional demo has no passwords. A connected community asks for yours here.</p>}
            <div className="account-field">
                <label htmlFor={phraseField}>Type <strong>{ACCOUNT_DELETION_PHRASE}</strong> to confirm</label>
                <input id={phraseField} aria-describedby={phraseHint} autoComplete="off" autoCapitalize="none" spellCheck={false} required value={phrase} onChange={e => setPhrase(e.target.value)} disabled={working}/>
                <small id={phraseHint}>Typing it guards against deleting by accident.</small>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" onClick={onClose} disabled={working}>Keep my account</button>
                <button type="submit" className="button primary" disabled={working}>{working ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Trash2 size={15} aria-hidden="true"/>}Delete my account</button>
            </div>
        </form>
    </Modal>;
}
