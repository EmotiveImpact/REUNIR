import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { Modal, Pill, date } from './ui';
import { displayError } from '../lib/data';
import { loadSuspensions, sendSuspensionAppeal, withdrawSuspensionAppealIn } from '../lib/suspensions';
import { APPEAL_TEXT_MAX, type OwnSuspensionAppeal, type SuspensionStanding } from '../../../../packages/contracts/src/appeals';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

const STATUS: Record<OwnSuspensionAppeal['status'], string> = { pending: 'Waiting for a decision', upheld: 'Kept suspended', reversed: 'Restored', withdrawn: 'Withdrawn', closed: 'Closed' };
const day = (value: string) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Communities where this person's access is suspended, from their account (decision 058). They no longer see those
 * communities, so this is the one place they can ask for the suspension to be looked at again. Renders nothing when there
 * are none, or when the list cannot be loaded, so it can sit on any account screen.
 */
export function SuspendedAccess({ userId }: { userId: string }) {
    const q = useQuery({ queryKey: ['suspensions', userId], queryFn: () => loadSuspensions(userId) });
    const heading = useId();
    if (!q.data?.length) return null;
    return <section className="panel suspended-access" aria-labelledby={heading}>
        <h2 id={heading}>Suspended access</h2>
        <p className="muted">An owner or administrator suspended your access to {q.data.length === 1 ? 'this community' : 'these communities'}. You can ask for it to be looked at again by someone who did not suspend you. Your appeal is private to you and the community’s owners and administrators.</p>
        {q.data.map(s => <SuspensionRow key={s.slug} standing={s} userId={userId}/>)}
    </section>;
}

function SuspensionRow({ standing, userId }: { standing: SuspensionStanding; userId: string }) {
    const cache = useQueryClient();
    const [appealing, setAppealing] = useState(false), [note, setNote] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    // Only appeals about this suspension: one about an earlier suspension, since lifted, says nothing about this one.
    const latest = standing.appeals.find(a => a.current);
    const refresh = () => cache.invalidateQueries({ queryKey: ['suspensions', userId] });
    const withdraw = async (appeal: OwnSuspensionAppeal) => {
        setWorking(true); setError('');
        try { setNote((await withdrawSuspensionAppealIn(standing.slug, userId, appeal.id)).message); await refresh(); }
        catch (e) { setError(displayError(e)); }
        finally { setWorking(false); }
    };
    return <article className="suspension-row" aria-label={`Suspended access to ${standing.name}`}>
        <div className="appeal-head"><strong>{standing.name}</strong><Pill>{latest ? STATUS[latest.status] : 'Suspended'}</Pill></div>
        <p className="muted small">{standing.suspendedAt ? `Suspended on ${day(standing.suspendedAt)}.` : 'Suspended.'} Your posts and work there are kept.</p>
        {latest && <div className="appeal-card">
            <p className="preline"><span className="sr-only">Your appeal: </span>{latest.reason}</p>
            <p className="muted small">You appealed on {day(latest.createdAt)}.{latest.status === 'pending' && !standing.decidable ? ' Nobody can decide it yet: the only owners or administrators are the person who suspended you. It waits until another can decide.' : ''}</p>
            {(latest.status === 'upheld' || latest.status === 'reversed') && <div className="appeal-response"><strong>Response{latest.decidedAt ? `, ${day(latest.decidedAt)}` : ''}</strong><p className="preline">{latest.response}</p></div>}
        </div>}
        {note && <p className="sample-note" role="status">{note}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="review-actions">
            {standing.canAppeal && <Button variant="default" type="button" className="button primary" onClick={() => { setNote(''); setAppealing(true); }}><Scale size={15} aria-hidden="true"/>Appeal the suspension</Button>}
            {latest?.status === 'pending' && <Button variant="secondary" type="button" className="button secondary" disabled={working} onClick={() => void withdraw(latest)}>Withdraw appeal</Button>}
        </div>
        {appealing && <SuspensionAppealDialog standing={standing} userId={userId} onClose={() => setAppealing(false)} onSent={async message => { setNote(message); setAppealing(false); await refresh(); }}/>}
    </article>;
}

function SuspensionAppealDialog({ standing, userId, onClose, onSent }: { standing: SuspensionStanding; userId: string; onClose: () => void; onSent: (message: string) => void }) {
    const [reason, setReason] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const field = useId();
    return <Modal title="Appeal your suspension" onClose={onClose}>
        <form className="form-stack" onSubmit={async e => {
            e.preventDefault(); setError(''); setWorking(true);
            try { onSent((await sendSuspensionAppeal(standing.slug, userId, reason)).message); }
            catch (err) { setError(displayError(err)); }
            finally { setWorking(false); }
        }}>
            <p className="modal-intro">An owner or administrator of <strong>{standing.name}</strong> who did not suspend you will look again. If they restore your access, you can use the community straight away.</p>
            <Label htmlFor={field}>Why should your access be restored?</Label>
            <Textarea id={field} required rows={4} maxLength={APPEAL_TEXT_MAX} value={reason} onChange={e => setReason(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button variant="default" className="button primary" disabled={working || !reason.trim()}>Send appeal</Button>
        </form>
    </Modal>;
}
