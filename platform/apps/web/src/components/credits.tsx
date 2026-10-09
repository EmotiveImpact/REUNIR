import { useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Flag, Handshake, UserMinus, UserPlus, X } from 'lucide-react';
import { Avatar, Modal, Pill } from './ui';
import { useWorkspace } from '../lib/context';
import { CREDIT_LIMIT, CREDIT_ROLE_MAX } from '../../../../packages/contracts/src/credits';
import type { CommandInput, Contribution, ContributionCredit, Member, Outcome, OutcomeCredit } from '../../../../packages/contracts/src/index';
import { creditLine, creditedOn } from '../../../../packages/domain/src/credits';
import { creditedOnOutcomes, outcomeCreditLine } from '../../../../packages/domain/src/outcome-credits';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { useConfirm } from './confirm';

const STATUS: Record<ContributionCredit['status'], string> = { invited: 'Waiting for an answer', accepted: 'Credited', declined: 'Declined', withdrawn: 'Withdrawn' };

/** What the shared credit panel needs to know about one contribution or outcome. */
interface CreditSubject {
    noun: 'contribution' | 'outcome';
    authorId: string;
    credits: (ContributionCredit | OutcomeCredit)[];
    line: string;
    /** People who can still be asked, sorted by name. */
    candidates: Member[];
    /** "teammate" when the work belongs to a project's team, otherwise "member". */
    person: 'teammate' | 'member';
    intro: ReactNode;
    noCandidates: string;
    /** No new credits: the outcome was withdrawn. Existing credits can still be answered or removed. */
    closed?: boolean;
    invite: (userId: string, role: string) => CommandInput;
    respond: (creditId: string, decision: 'accepted' | 'declined') => CommandInput;
    withdraw: (creditId: string) => CommandInput;
}

/** People who have said no, or already hold a live credit, are not asked again. */
const closedTo = (credits: CreditSubject['credits']) => new Set(credits.filter(k => k.status === 'invited' || k.status === 'accepted' || k.status === 'declined' || (k.status === 'withdrawn' && k.withdrawnBy === k.userId)).map(k => k.userId));
const byName = (a: Member, b: Member) => a.name.localeCompare(b.name);

/**
 * Credits on one contribution. Everyone who can read the contribution sees "With A and B" once people accept. The author
 * sees every invitation and answer, and can credit teammates; the person invited sees an answer prompt. Nobody else sees
 * an invitation or a refusal.
 */
export function ContributionCredits({ contribution: c }: { contribution: Contribution }) {
    const { data } = useWorkspace();
    const credits = (data.contributionCredits ?? []).filter(k => k.contributionId === c.id);
    // Active teammates on this project, other than the author, without a live credit and who have not said no.
    const team = new Set(data.projectMembers.filter(x => x.projectId === c.projectId && !x.leftAt).map(x => x.userId)), closed = closedTo(credits);
    const candidates = data.members.filter(m => m.status === 'active' && team.has(m.userId) && m.userId !== c.userId && !closed.has(m.userId)).sort(byName);
    return <CreditPanel subject={{
        noun: 'contribution', authorId: c.userId, credits, line: creditLine(data, c.id), candidates, person: 'teammate',
        intro: <>Choose a teammate who worked on <strong>{c.title}</strong> with you. They are asked first, and nothing is shown until they accept. Credits acknowledge shared work; they do not count towards paths, recognition or any credential, and the review stays about this contribution.</>,
        noCandidates: "Everyone on this project's team has already been asked. Teammates join from the project page.",
        invite: (userId, role) => ({ type: 'credit.invite', contributionId: c.id, userId, role }),
        respond: (creditId, decision) => ({ type: 'credit.respond', creditId, decision }),
        withdraw: creditId => ({ type: 'credit.withdraw', creditId }),
    }}/>;
}

/**
 * Credits on one outcome (decision 059), on the same terms. An outcome from project work credits its project's team; one
 * from a mission proof, any active member who can see the mission, which the server checks.
 */
export function OutcomeCredits({ outcome: o }: { outcome: Outcome }) {
    const { data } = useWorkspace();
    const credits = (data.outcomeCredits ?? []).filter(k => k.outcomeId === o.id), closed = closedTo(credits);
    const team = o.projectId ? new Set(data.projectMembers.filter(x => x.projectId === o.projectId && !x.leftAt).map(x => x.userId)) : null;
    const candidates = data.members.filter(m => m.status === 'active' && (!team || team.has(m.userId)) && m.userId !== o.authorId && m.userId !== o.reviewerId && !closed.has(m.userId)).sort(byName);
    if (o.status === 'withdrawn' && !credits.length) return null;
    return <CreditPanel subject={{
        noun: 'outcome', authorId: o.authorId, credits, line: outcomeCreditLine(data, o.id), candidates, person: team ? 'teammate' : 'member', closed: o.status === 'withdrawn',
        intro: <>Choose {team ? 'a teammate' : 'a member'} who helped bring about <strong>{o.title}</strong>. They are asked first, and nothing is shown until they accept. Credits acknowledge shared work; they do not count towards goals, paths, review or any credential, and someone credited on this outcome cannot also review it.</>,
        noCandidates: team ? "Everyone on this project's team has already been asked. Teammates join from the project page." : 'Everyone who can be credited has already been asked.',
        invite: (userId, role) => ({ type: 'outcome.credit.invite', outcomeId: o.id, userId, role }),
        respond: (creditId, decision) => ({ type: 'outcome.credit.respond', creditId, decision }),
        withdraw: creditId => ({ type: 'outcome.credit.withdraw', creditId }),
    }}/>;
}

function CreditPanel({ subject: x }: { subject: CreditSubject }) {
    const { data, me, command, busy } = useWorkspace();
    const confirm = useConfirm();
    const [open, setOpen] = useState(false), [error, setError] = useState('');
    const name = (userId: string) => data.members.find(m => m.userId === userId)?.name ?? 'A member';
    const author = x.authorId === me.userId;
    const mine = x.credits.find(k => k.userId === me.userId && (k.status === 'invited' || k.status === 'accepted'));
    const run = (cmd: CommandInput) => { setError(''); void command(cmd, { onError: setError }); };
    const live = x.credits.filter(k => k.status === 'invited' || k.status === 'accepted');
    return <div className="contribution-credits">
        {x.line && <p className="credit-line"><Handshake size={14} aria-hidden="true"/>{x.line}</p>}
        {mine?.status === 'invited' && <div className="credit-prompt" role="group" aria-label="Credit invitation">
            <p><strong>{name(mine.invitedBy)}</strong> would like to credit you on this {x.noun}{mine.role ? <> as <strong>{mine.role}</strong></> : null}. Nothing is shown until you accept. A credit is acknowledgement from {x.person === 'teammate' ? 'a teammate' : 'another member'}; it does not count as your own reviewed work.</p>
            <div><Button type="button" variant="default" size="sm" className="button primary compact" disabled={busy} onClick={() => run(x.respond(mine.id, 'accepted'))}><Check size={14} aria-hidden="true"/>Accept credit</Button>
            <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} onClick={() => run(x.respond(mine.id, 'declined'))}><X size={14} aria-hidden="true"/>Decline</Button></div>
        </div>}
        {mine?.status === 'accepted' && !author && <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} onClick={async () => { if (await confirm({ title: `Remove your credit from this ${x.noun}?`, body: `The ${x.noun} stays, and its author is told.`, confirmText: 'Remove my credit' })) run(x.withdraw(mine.id)); }}><UserMinus size={14} aria-hidden="true"/>Remove my credit</Button>}
        {author && <div className="credit-manage">
            {x.credits.length > 0 && <ul className="credit-list" aria-label="People you have credited">{x.credits.map(k => <li key={k.id}>
                <Avatar member={data.members.find(m => m.userId === k.userId)} size="xs"/>
                <span><strong>{name(k.userId)}</strong>{k.role && <small>{k.role}</small>}</span>
                <Pill>{STATUS[k.status]}</Pill>
                {(k.status === 'invited' || k.status === 'accepted') && <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy} aria-label={`${k.status === 'invited' ? 'Withdraw the invitation to' : 'Remove the credit for'} ${name(k.userId)}`} onClick={() => run(x.withdraw(k.id))}>{k.status === 'invited' ? 'Withdraw' : 'Remove'}</Button>}
            </li>)}</ul>}
            {!x.closed && <Button type="button" variant="secondary" size="sm" className="button secondary compact" disabled={busy || live.length >= CREDIT_LIMIT} onClick={() => setOpen(true)}><UserPlus size={14} aria-hidden="true"/>Credit someone…</Button>}
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {open && createPortal(<CreditDialog subject={x} onClose={() => setOpen(false)}/>, document.body)}
    </div>;
}

function CreditDialog({ subject: x, onClose }: { subject: CreditSubject; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const [choice, setChoice] = useState(''), [role, setRole] = useState(''), [error, setError] = useState('');
    const select = useId(), intro = useId();
    const Person = x.person === 'teammate' ? 'Teammate' : 'Member';
    const send = async () => {
        if (!choice) return;
        setError('');
        if (await command(x.invite(choice, role.trim()), { onError: setError })) onClose();
    };
    return <Modal title={`Credit someone on this ${x.noun === 'outcome' ? 'outcome' : 'work'}`} onClose={onClose}>
        <div className="form-stack credit-editor">
            <p id={intro}>{x.intro}</p>
            <Label htmlFor={select}>{Person}</Label>
            <NativeSelect id={select} value={choice} aria-describedby={intro} onChange={e => setChoice(e.target.value)}>
                <option value="">Choose a {x.person}</option>
                {x.candidates.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
            </NativeSelect>
            {!x.candidates.length && <small className="muted">{x.noCandidates}</small>}
            <Label>What they did (optional)<Input value={role} maxLength={CREDIT_ROLE_MAX} onChange={e => setRole(e.target.value)} placeholder="Co-author, photography, sound…"/></Label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions"><Button type="button" variant="secondary" className="button secondary" onClick={onClose}>Cancel</Button><Button type="button" variant="default" className="button primary" disabled={busy || !choice} onClick={() => void send()}>Ask to credit</Button></div>
        </div>
    </Modal>;
}

/** Work and outcomes a person is credited on, on their profile and apart from their own. */
export function CreditedOn({ userId }: { userId: string }) {
    const { data, me } = useWorkspace();
    const items = creditedOn({ ...data, contributionCredits: data.contributionCredits ?? [] }, userId);
    const outcomes = creditedOnOutcomes(data, userId);
    const count = items.length + outcomes.length, own = me.userId === userId;
    if (!count && !own) return null;
    const recordedBy = (id: string) => data.members.find(m => m.userId === id)?.name ?? 'a member';
    return <section className="panel credited-on">
        <div className="purpose-section-title"><h2>Credited on</h2><Pill>{count} {count === 1 ? 'credit' : 'credits'}</Pill></div>
        <p className="muted">Work and outcomes {own ? 'others' : 'other people'} recorded and credited {own ? 'you' : 'this person'} on, with {own ? 'your' : 'their'} agreement. These are not {own ? 'your' : 'their'} own reviewed contributions or outcomes.</p>
        {items.map(({ credit: k, contribution: c }) => <Link key={k.id} to={`/projects/${c.projectId}`} className="proof-item"><Handshake size={20} aria-hidden="true"/><span><strong>{c.title}</strong><small>{data.projects.find(p => p.id === c.projectId)?.title} · Recorded by {recordedBy(c.userId)}{k.role ? ` · ${k.role}` : ''}</small></span><ArrowUpRight size={16} aria-hidden="true"/></Link>)}
        {outcomes.map(({ credit: k, outcome: o }) => <Link key={k.id} to="/outputs" className="proof-item"><Flag size={20} aria-hidden="true"/><span><strong>{o.title}</strong><small>Outcome recorded by {recordedBy(o.authorId)}{o.status === 'verified' ? '' : ` · ${o.status === 'withdrawn' ? 'withdrawn' : 'not yet reviewed'}`}{k.role ? ` · ${k.role}` : ''}</small></span><ArrowUpRight size={16} aria-hidden="true"/></Link>)}
        {!count && <p className="muted">When someone credits you and you accept, the work appears here.</p>}
    </section>;
}
