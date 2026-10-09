import { useState } from 'react';
import { Ban, History, PencilLine, Scale } from 'lucide-react';
import { Modal, date } from './ui';
import { useWorkspace } from '../lib/context';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { isAdmin } from '../../../../packages/domain/src/engine';
import { canReviewEvidence, evidenceAuthor, evidenceText, historyOf, isReviewedEvidence, type EvidenceRecord } from '../../../../packages/domain/src/evidence-history';
import { isCreditedOn } from '../../../../packages/domain/src/credits';
import { isCreditedOnOutcome } from '../../../../packages/domain/src/outcome-credits';
import type { EvidenceChange, EvidenceSubject, EvidenceText } from '../../../../packages/contracts/src/index';

const LIMITS: Record<EvidenceSubject, { title: number; text: number }> = { contribution: { title: 140, text: 8000 }, outcome: { title: 160, text: 5000 } };
const noun = (subject: EvidenceSubject) => subject === 'contribution' ? 'contribution' : 'outcome';
const read = (f: FormData, k: string) => String(f.get(k) || '');

function Wording({ label, text, reviewer }: { label: string; text: EvidenceText; reviewer?: (userId: string | null) => string }) {
    const review = reviewer && text.review?.reviewerId ? text.review : null;
    return <div className="evidence-wording"><span>{label}</span><strong>{text.title}</strong><p className="preline">{text.text}</p>{text.evidenceUrl && <small>{text.evidenceUrl}</small>}
        {review && <small>Reviewed by {reviewer!(review.reviewerId)}{review.feedback ? `: ${review.feedback}` : ''}</small>}</div>;
}

function headline(c: EvidenceChange): string {
    const on = c.decidedAt ? date(c.decidedAt, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (c.kind === 'withdrawal') return `Withdrawn on ${on}`;
    if (c.status === 'accepted') return `Corrected on ${on}`;
    if (c.status === 'declined') return `Correction not accepted on ${on}`;
    return 'Correction waiting for review';
}

/**
 * The history of one piece of reviewed evidence, with the actions its author, reviewers and administrators may take.
 * Nothing here rewrites what was reviewed: a correction waits for a reviewer and keeps the earlier wording, and a
 * withdrawal keeps the record and its wording while it stops counting.
 */
export function EvidenceHistory({ subject, record }: { subject: EvidenceSubject; record: EvidenceRecord }) {
    const { data, me } = useWorkspace();
    const [open, setOpen] = useState<'correct' | 'withdraw' | EvidenceChange | null>(null);
    const history = historyOf(data, record.id);
    const author = evidenceAuthor(subject, record) === me.userId;
    const reviewed = isReviewedEvidence(subject, record);
    const pending = history.find(c => c.status === 'pending');
    const reviewer = !author && canReviewEvidence(data, subject, record, me) && !(subject === 'contribution' ? isCreditedOn(data, record.id, me.userId) : isCreditedOnOutcome(data, record.id, me.userId));
    const name = (userId: string | null) => data.members.find(m => m.userId === userId)?.name || 'Community reviewer';
    const actions = reviewed && (author || isAdmin(me));
    if (!history.length && !actions) return null;
    return <div className="evidence-history">
        {history.length > 0 && <section aria-label={`History of this ${noun(subject)}`}>
            <h4><History size={14} />History</h4>
            <ol>{history.map(c => <li key={c.id} className={'evidence-change change-' + (c.kind === 'withdrawal' ? 'withdrawn' : c.status)}>
                <strong>{headline(c)}</strong>
                <p>{c.kind === 'withdrawal' ? 'Reason' : 'Why'}: {c.reason}<small> · {name(c.requestedBy)}</small></p>
                {c.status === 'accepted' && <Wording label="Earlier wording" text={c.previous} reviewer={name} />}
                {c.kind === 'withdrawal' && <Wording label="Reviewed wording" text={c.previous} reviewer={name} />}
                {c.kind === 'correction' && c.status !== 'accepted' && c.proposed && <Wording label={c.status === 'pending' ? 'Proposed wording' : 'Wording not accepted'} text={c.proposed} />}
                {c.response && <p className="evidence-response">{name(c.decidedBy)}: {c.response}</p>}
                {c.status === 'pending' && reviewer && <Button variant="secondary" size="sm" className="button secondary compact" onClick={() => setOpen(c)}><Scale size={14} />Review correction</Button>}
            </li>)}</ol>
        </section>}
        {actions && <div className="evidence-history-actions">
            {author && <Button variant="secondary" size="sm" className="button secondary compact" disabled={!!pending} onClick={() => setOpen('correct')}><PencilLine size={14} />{pending ? 'Correction waiting' : 'Correct…'}</Button>}
            <Button variant="secondary" size="sm" className="button secondary compact" onClick={() => setOpen('withdraw')}><Ban size={14} />Withdraw…</Button>
        </div>}
        {open === 'correct' && <CorrectionModal subject={subject} record={record} onClose={() => setOpen(null)} />}
        {open === 'withdraw' && <WithdrawModal subject={subject} record={record} onClose={() => setOpen(null)} />}
        {open && typeof open === 'object' && <ReviewModal change={open} subject={subject} record={record} onClose={() => setOpen(null)} />}
    </div>;
}

function CorrectionModal({ subject, record, onClose }: { subject: EvidenceSubject; record: EvidenceRecord; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const current = evidenceText(subject, record), limit = LIMITS[subject];
    return <Modal title={`Correct this ${noun(subject)}`} onClose={onClose}><form className="form-stack" onSubmit={async e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        if (await command({ type: 'evidence.correct', subject, subjectId: record.id, title: read(f, 'title'), text: read(f, 'text'), evidenceUrl: read(f, 'url'), reason: read(f, 'reason') })) onClose();
    }}>
        <p className="sample-note">The reviewed version stays until a reviewer accepts your correction. The earlier wording stays in the history either way.</p>
        <Label>Title<Input required name="title" maxLength={limit.title} defaultValue={current.title} /></Label>
        <Label>{subject === 'contribution' ? 'What you did and what changed' : 'What happened, and what evidence supports it?'}<Textarea required name="text" rows={4} maxLength={limit.text} defaultValue={current.text} /></Label>
        <Label>Evidence link (optional)<Input name="url" type="url" maxLength={2000} defaultValue={current.evidenceUrl} placeholder="https://…" /></Label>
        <Label>Why the correction?<Textarea required name="reason" rows={2} maxLength={1000} placeholder="What was wrong or missing?" /></Label>
        <Button variant="default" className="button primary" disabled={busy}>Send correction for review</Button>
    </form></Modal>;
}

function WithdrawModal({ subject, record, onClose }: { subject: EvidenceSubject; record: EvidenceRecord; onClose: () => void }) {
    const { data, command, busy } = useWorkspace();
    const built = subject === 'contribution' ? data.outcomes.filter(o => o.contributionId === record.id && o.status === 'verified').length : 0;
    return <Modal title={`Withdraw this ${noun(subject)}`} onClose={onClose}><form className="form-stack" onSubmit={async e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        if (await command({ type: 'evidence.withdraw', subject, subjectId: record.id, reason: read(f, 'reason') })) onClose();
    }}>
        <p className="sample-note">Withdrawn evidence stays on record, marked as withdrawn, and stops counting towards paths, goals, profiles and outputs.{built > 0 && ` The ${built === 1 ? 'outcome' : `${built} outcomes`} built on it will be withdrawn too.`} This cannot be undone.</p>
        <Label>Reason<Textarea required name="reason" rows={3} maxLength={1000} placeholder="Why should this no longer count?" /></Label>
        <Button variant="default" className="button primary" disabled={busy}>Withdraw {noun(subject)}</Button>
    </form></Modal>;
}

function ReviewModal({ change, subject, record, onClose }: { change: EvidenceChange; subject: EvidenceSubject; record: EvidenceRecord; onClose: () => void }) {
    const { data, command, busy } = useWorkspace();
    const [response, setResponse] = useState('');
    const decide = async (decision: 'accepted' | 'declined') => { if (await command({ type: 'evidence.correction.review', changeId: change.id, decision, response })) onClose(); };
    return <Modal title="Review a correction" onClose={onClose}><div className="form-stack">
        <p>{data.members.find(m => m.userId === change.requestedBy)?.name || 'The author'} asked to correct this {noun(subject)}: {change.reason}</p>
        <div className="evidence-compare"><Wording label="Reviewed wording" text={evidenceText(subject, record)} /><Wording label="Proposed wording" text={change.proposed!} /></div>
        <Label>Your response<Textarea aria-label="Correction review response" maxLength={2000} rows={2} value={response} onChange={e => setResponse(e.target.value)} placeholder="What did you check?" /></Label>
        <p className="sample-note">Accepting changes the {noun(subject)}{subject === 'outcome' ? ' and any published output that repeats it' : ''}. The earlier wording stays in the history.</p>
        <div className="evidence-history-actions"><Button variant="secondary" className="button secondary" disabled={busy || !response.trim()} onClick={() => decide('declined')}>Decline</Button><Button variant="default" className="button primary" disabled={busy || !response.trim()} onClick={() => decide('accepted')}>Accept correction</Button></div>
    </div></Modal>;
}
