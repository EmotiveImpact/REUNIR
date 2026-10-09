import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Handshake, UserMinus, UserPlus, X } from 'lucide-react';
import { Avatar, Modal, Pill } from './ui';
import { useWorkspace } from '../lib/context';
import { CREDIT_LIMIT, CREDIT_ROLE_MAX } from '../../../../packages/contracts/src/credits';
import type { Contribution, ContributionCredit } from '../../../../packages/contracts/src/index';
import { creditLine, creditedOn } from '../../../../packages/domain/src/credits';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';

const STATUS: Record<ContributionCredit['status'], string> = { invited: 'Waiting for an answer', accepted: 'Credited', declined: 'Declined', withdrawn: 'Withdrawn' };

/**
 * Credits on one contribution. Everyone who can read the contribution sees "With A and B" once people accept. The author
 * sees every invitation and answer, and can credit teammates; the person invited sees an answer prompt. Nobody else sees
 * an invitation or a refusal.
 */
export function ContributionCredits({ contribution: c }: { contribution: Contribution }) {
    const { data, me, command, busy } = useWorkspace();
    const [open, setOpen] = useState(false), [error, setError] = useState('');
    const credits = (data.contributionCredits ?? []).filter(k => k.contributionId === c.id);
    const name = (userId: string) => data.members.find(m => m.userId === userId)?.name ?? 'A member';
    const line = creditLine(data, c.id);
    const author = c.userId === me.userId;
    const mine = credits.find(k => k.userId === me.userId && (k.status === 'invited' || k.status === 'accepted'));
    const run = (cmd: Parameters<typeof command>[0]) => { setError(''); void command(cmd, { onError: setError }); };
    const live = credits.filter(k => k.status === 'invited' || k.status === 'accepted');
    return <div className="contribution-credits">
        {line && <p className="credit-line"><Handshake size={14} aria-hidden="true"/>{line}</p>}
        {mine?.status === 'invited' && <div className="credit-prompt" role="group" aria-label="Credit invitation">
            <p><strong>{name(mine.invitedBy)}</strong> would like to credit you on this contribution{mine.role ? <> as <strong>{mine.role}</strong></> : null}. Nothing is shown until you accept. A credit is acknowledgement from a teammate; it does not count as your own reviewed work.</p>
            <div><Button type="button" variant="default" size="sm" className="button primary compact" disabled={busy} onClick={() => run({ type: 'credit.respond', creditId: mine.id, decision: 'accepted' })}><Check size={14} aria-hidden="true"/>Accept credit</Button>
            <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} onClick={() => run({ type: 'credit.respond', creditId: mine.id, decision: 'declined' })}><X size={14} aria-hidden="true"/>Decline</Button></div>
        </div>}
        {mine?.status === 'accepted' && !author && <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} onClick={() => { if (window.confirm('Remove your credit from this contribution?')) run({ type: 'credit.withdraw', creditId: mine.id }); }}><UserMinus size={14} aria-hidden="true"/>Remove my credit</Button>}
        {author && <div className="credit-manage">
            {credits.length > 0 && <ul className="credit-list" aria-label="People you have credited">{credits.map(k => <li key={k.id}>
                <Avatar member={data.members.find(m => m.userId === k.userId)} size="xs"/>
                <span><strong>{name(k.userId)}</strong>{k.role && <small>{k.role}</small>}</span>
                <Pill>{STATUS[k.status]}</Pill>
                {(k.status === 'invited' || k.status === 'accepted') && <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} aria-label={`${k.status === 'invited' ? 'Withdraw the invitation to' : 'Remove the credit for'} ${name(k.userId)}`} onClick={() => run({ type: 'credit.withdraw', creditId: k.id })}>{k.status === 'invited' ? 'Withdraw' : 'Remove'}</Button>}
            </li>)}</ul>}
            <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy || live.length >= CREDIT_LIMIT} onClick={() => setOpen(true)}><UserPlus size={14} aria-hidden="true"/>Credit someone…</Button>
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {open && createPortal(<CreditDialog contribution={c} onClose={() => setOpen(false)}/>, document.body)}
    </div>;
}

function CreditDialog({ contribution: c, onClose }: { contribution: Contribution; onClose: () => void }) {
    const { data, command, busy } = useWorkspace();
    const [choice, setChoice] = useState(''), [role, setRole] = useState(''), [error, setError] = useState('');
    const select = useId(), intro = useId();
    const credits = (data.contributionCredits ?? []).filter(k => k.contributionId === c.id);
    // Active teammates on this project, other than the author, without a live credit and who have not said no.
    const team = new Set(data.projectMembers.filter(x => x.projectId === c.projectId && !x.leftAt).map(x => x.userId));
    const closed = new Set(credits.filter(k => k.status === 'invited' || k.status === 'accepted' || k.status === 'declined' || (k.status === 'withdrawn' && k.withdrawnBy === k.userId)).map(k => k.userId));
    const candidates = data.members.filter(m => m.status === 'active' && team.has(m.userId) && m.userId !== c.userId && !closed.has(m.userId)).sort((a, b) => a.name.localeCompare(b.name));
    const send = async () => {
        if (!choice) return;
        setError('');
        if (await command({ type: 'credit.invite', contributionId: c.id, userId: choice, role: role.trim() }, { onError: setError })) onClose();
    };
    return <Modal title="Credit someone on this work" onClose={onClose}>
        <div className="form-stack credit-editor">
            <p id={intro}>Choose a teammate who worked on <strong>{c.title}</strong> with you. They are asked first, and nothing is shown until they accept. Credits acknowledge shared work; they do not count towards paths, recognition or any credential, and the review stays about this contribution.</p>
            <Label htmlFor={select}>Teammate</Label>
            <NativeSelect id={select} value={choice} aria-describedby={intro} onChange={e => setChoice(e.target.value)}>
                <option value="">Choose a teammate</option>
                {candidates.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </NativeSelect>
            {!candidates.length && <small className="muted">Everyone on this project's team has already been asked. Teammates join from the project page.</small>}
            <Label>What they did (optional)<Input value={role} maxLength={CREDIT_ROLE_MAX} onChange={e => setRole(e.target.value)} placeholder="Co-author, photography, sound…"/></Label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions"><Button type="button" variant="secondary" className="button secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="default" className="button primary" disabled={busy || !choice} onClick={() => void send()}>Ask to credit</Button></div>
        </div>
    </Modal>;
}

/** Work a person is credited on, on their profile and apart from their own contributions. */
export function CreditedOn({ userId }: { userId: string }) {
    const { data, me } = useWorkspace();
    const items = creditedOn({ ...data, contributionCredits: data.contributionCredits ?? [] }, userId);
    if (!items.length && me.userId !== userId) return null;
    return <section className="panel credited-on">
        <div className="purpose-section-title"><h2>Credited on</h2><Pill>{items.length} {items.length === 1 ? 'credit' : 'credits'}</Pill></div>
        <p className="muted">Work a teammate recorded and credited {me.userId === userId ? 'you' : 'this person'} on, with {me.userId === userId ? 'your' : 'their'} agreement. These are not {me.userId === userId ? 'your' : 'their'} own reviewed contributions.</p>
        {items.map(({ credit: k, contribution: c }) => <Link key={k.id} to={`/projects/${c.projectId}`} className="proof-item"><Handshake size={20} aria-hidden="true"/><span><strong>{c.title}</strong><small>{data.projects.find(p => p.id === c.projectId)?.title} · Recorded by {data.members.find(m => m.userId === c.userId)?.name ?? 'a member'}{k.role ? ` · ${k.role}` : ''}</small></span><ArrowUpRight size={16} aria-hidden="true"/></Link>)}
        {!items.length && <p className="muted">When a teammate credits you and you accept, the work appears here.</p>}
    </section>;
}
