import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Empty, Modal, PageHeading, PersonLink, Pill, date } from '../components/ui';
import { AppealDialog, currentAppeal } from '../components/appeals';
import { appealDeciders, appealIsCurrent, appealPost, decisionBlock } from '../../../../packages/domain/src/appeals';
import { suspensionAppealIsCurrent, suspensionDeciders, suspensionDecisionBlock } from '../../../../packages/domain/src/suspension-appeals';
import { messageRequest } from '../lib/messaging';
import { displayError } from '../lib/data';
import { InlineError, Loading } from '../components/states';
import type { OwnMessageReport } from '../../../../packages/contracts/src/messaging';
import { isAdmin } from '../../../../packages/domain/src/access';
import { APPEAL_TEXT_MAX } from '../../../../packages/contracts/src/appeals';
import type { ModerationAppeal, Post, SuspensionAppeal } from '../../../../packages/contracts/src/index';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const STATUS: Record<ModerationAppeal['status'], string> = { pending: 'Waiting for a decision', upheld: 'Kept hidden', reversed: 'Restored', withdrawn: 'Withdrawn' };
const ACCESS_STATUS: Record<SuspensionAppeal['status'], string> = { pending: 'Waiting for a decision', upheld: 'Kept suspended', reversed: 'Restored', withdrawn: 'Withdrawn', closed: 'Closed: access restored' };
const newest = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt);
const day = (value: string) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * A person's own appeals, hidden posts and message reports, and, for owners and administrators, the appeals waiting for a
 * decision: about hidden posts, and about suspended access (decision 058).
 */
export function AppealsPage() {
    const { data, me } = useWorkspace();
    const mine = data.moderationAppeals.filter(a => a.appellantId === me.userId).sort(newest);
    const myAccess = data.suspensionAppeals.filter(a => a.appellantId === me.userId).sort(newest);
    const hidden = data.posts.filter(p => p.hidden && p.authorId === me.userId && !currentAppeal(mine, p));
    const others = isAdmin(me) ? data.moderationAppeals.filter(a => a.appellantId !== me.userId).sort(newest) : [];
    const waiting = others.filter(a => a.status === 'pending'), closed = others.filter(a => a.status !== 'pending');
    const current = waiting.filter(a => appealIsCurrent(data, a)).length;
    const access = isAdmin(me) ? data.suspensionAppeals.filter(a => a.appellantId !== me.userId).sort(newest) : [];
    const accessWaiting = access.filter(a => a.status === 'pending' && suspensionAppealIsCurrent(data, a)), accessClosed = access.filter(a => !accessWaiting.includes(a));
    return <>
        <PageHeading eyebrow="A SECOND LOOK" title="Appeals" body="When a moderator hides your post, or a report you made is closed, you can ask for a second look. Someone who did not make the first decision looks again. Appeals are private to you and the community’s owners and administrators."/>
        <div className="reading-width appeals-page">
            {hidden.length > 0 && <section className="panel" aria-labelledby="appeals-hidden">
                <h2 id="appeals-hidden">Your hidden posts</h2>
                {hidden.map(p => <HiddenPostRow key={p.id} post={p}/>)}
            </section>}
            <section className="panel" aria-labelledby="appeals-mine">
                <h2 id="appeals-mine">Your appeals</h2>
                {mine.length || myAccess.length ? <>{mine.map(a => <AppealCard key={a.id} appeal={a} own/>)}{myAccess.map(a => <AccessAppealCard key={a.id} appeal={a} own/>)}</> : <p className="muted">You have not appealed anything. If your access to a community is ever suspended, you can appeal from your account.</p>}
            </section>
            <MyMessageReports/>
            {isAdmin(me) && <section className="panel" aria-labelledby="appeals-queue">
                <h2 id="appeals-queue">Appeals to decide <span className="muted">{current}</span></h2>
                {waiting.length ? waiting.map(a => <AppealCard key={a.id} appeal={a}/>) : <Empty title="No appeals are waiting." body="When a member appeals a hidden post, it appears here."/>}
                {closed.length > 0 && <><h3>Decided appeals</h3>{closed.map(a => <AppealCard key={a.id} appeal={a}/>)}</>}
            </section>}
            {isAdmin(me) && <section className="panel" aria-labelledby="appeals-access">
                <h2 id="appeals-access">Access appeals <span className="muted">{accessWaiting.length}</span></h2>
                <p className="muted small">A suspended member appeals from their account. An owner or administrator who did not suspend them decides, and restoring access here takes effect at once.</p>
                {accessWaiting.length ? accessWaiting.map(a => <AccessAppealCard key={a.id} appeal={a}/>) : <Empty title="No access appeals are waiting." body="When a suspended member appeals, it appears here."/>}
                {accessClosed.length > 0 && <><h3>Closed access appeals</h3>{accessClosed.map(a => <AccessAppealCard key={a.id} appeal={a}/>)}</>}
            </section>}
        </div>
    </>;
}

function HiddenPostRow({ post }: { post: Post }) {
    const [open, setOpen] = useState(false);
    return <div className="appeal-row">
        <div><strong>{post.title || 'A post without a title'}</strong><p className="muted">{post.moderatedAt ? `Hidden on ${date(post.moderatedAt, { day: 'numeric', month: 'long', year: 'numeric' })}. ` : ''}Only you can see it.</p></div>
        <div className="review-actions"><Link className="button secondary" to={`/post/${post.id}`}>Read the post</Link><Button variant="default" type="button" className="button primary" onClick={() => setOpen(true)}><Scale size={15} aria-hidden="true"/>Appeal</Button></div>
        {open && <AppealDialog post={post} onClose={() => setOpen(false)}/>}
    </div>;
}

function AppealCard({ appeal, own = false }: { appeal: ModerationAppeal; own?: boolean }) {
    const { data, me, command, busy } = useWorkspace();
    const [deciding, setDeciding] = useState(false);
    const post = appealPost(data, appeal);
    const person = (userId: string | null | undefined) => data.members.find(m => m.userId === userId);
    const block = own ? null : decisionBlock(data, me, appeal);
    const outdated = appeal.status === 'pending' && !appealIsCurrent(data, appeal);
    const nobody = appeal.status === 'pending' && !outdated && appealDeciders(data, appeal).length === 0;
    const day = (value: string) => date(value, { day: 'numeric', month: 'long', year: 'numeric' });
    return <article className="appeal-card" aria-label={`Appeal about ${post?.title || 'a post'}`}>
        <div className="appeal-head"><strong>{post?.title || (post ? 'A post without a title' : 'A post you can no longer see')}</strong><Pill>{STATUS[appeal.status]}</Pill></div>
        <p className="muted small">{own ? 'You appealed' : <><PersonLink member={person(appeal.appellantId)}/> appealed</>} on {day(appeal.createdAt)}.{appeal.hiddenBy ? <> Hidden by <PersonLink member={person(appeal.hiddenBy)}/>{appeal.hiddenAt ? ` on ${day(appeal.hiddenAt)}` : ''}.</> : ''}</p>
        {!own && post && <blockquote className="appeal-quote preline">{post.body}</blockquote>}
        <p className="preline"><span className="sr-only">Reason: </span>{appeal.reason}</p>
        {appeal.status === 'pending' && <p className="sample-note" role="status">{[
            own ? (outdated ? 'The post was moderated again after you appealed, so this appeal no longer applies. You can withdraw it, or appeal the current decision.' : null) : block,
            nobody ? 'Nobody can decide this yet: the only owners or administrators are the person who hid the post or the person appealing. It waits until another owner or administrator can decide.' : null,
        ].filter(Boolean).join(' ') || (own ? 'Waiting for an owner or administrator who did not hide the post.' : 'You can decide this appeal.')}</p>}
        {(appeal.status === 'upheld' || appeal.status === 'reversed') && <div className="appeal-response"><strong>{appeal.decidedBy === me.userId ? 'Your response' : <>Response from <PersonLink member={person(appeal.decidedBy)}/></>}{appeal.decidedAt ? `, ${day(appeal.decidedAt)}` : ''}</strong><p className="preline">{appeal.response}</p></div>}
        <div className="review-actions">
            {own && appeal.status === 'pending' && <Button variant="secondary" type="button" className="button secondary" disabled={busy} onClick={() => void command({ type: 'moderation.appeal.withdraw', appealId: appeal.id })}>Withdraw appeal</Button>}
            {!own && appeal.status === 'pending' && !block && <Button variant="default" type="button" className="button primary" onClick={() => setDeciding(true)}>Decide</Button>}
            {post && (!post.hidden || own || isAdmin(me)) && <Link className="text-link" to={`/post/${post.id}`}>Read the post</Link>}
        </div>
        {deciding && <DecideDialog appeal={appeal} onClose={() => setDeciding(false)}/>}
    </article>;
}

function DecideDialog({ appeal, onClose }: { appeal: ModerationAppeal; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const [response, setResponse] = useState(''), [error, setError] = useState('');
    const field = useId();
    const decide = async (decision: 'upheld' | 'reversed') => {
        setError('');
        if (await command({ type: 'moderation.appeal.decide', appealId: appeal.id, decision, response }, { onError: setError })) onClose();
    };
    return <Modal title="Decide this appeal" onClose={onClose}>
        <div className="form-stack">
            <p className="modal-intro">Restoring makes the post visible to members again. Keeping it hidden leaves it visible only to its author. Your response goes to the member, and the decision is recorded in the audit trail.</p>
            <Label htmlFor={field}>Response to the member</Label>
            <Textarea id={field} required rows={4} maxLength={APPEAL_TEXT_MAX} value={response} onChange={e => setResponse(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="review-actions">
                <Button variant="secondary" type="button" className="button secondary" disabled={busy || !response.trim()} onClick={() => void decide('upheld')}>Keep hidden</Button>
                <Button variant="default" type="button" className="button primary" disabled={busy || !response.trim()} onClick={() => void decide('reversed')}>Restore the post</Button>
            </div>
        </div>
    </Modal>;
}

/** An appeal against a suspension, for owners and administrators, or for the member once their access is back. */
function AccessAppealCard({ appeal, own = false }: { appeal: SuspensionAppeal; own?: boolean }) {
    const { data, me } = useWorkspace();
    const [deciding, setDeciding] = useState(false);
    const person = (userId: string | null | undefined) => data.members.find(m => m.userId === userId);
    const block = own ? null : suspensionDecisionBlock(data, me, appeal);
    const outdated = appeal.status === 'pending' && !suspensionAppealIsCurrent(data, appeal);
    const nobody = appeal.status === 'pending' && !outdated && suspensionDeciders(data, appeal).length === 0;
    return <article className="appeal-card" aria-label={own ? 'Your appeal about your access' : `Access appeal from ${person(appeal.appellantId)?.name ?? 'a member'}`}>
        <div className="appeal-head"><strong>{own ? 'Your suspended access' : <><PersonLink member={person(appeal.appellantId)}/>’s access</>}</strong><Pill>{ACCESS_STATUS[appeal.status]}</Pill></div>
        <p className="muted small">{own ? 'You appealed' : 'Appealed'} on {day(appeal.createdAt)}.{!own && appeal.suspendedBy ? <> Suspended by <PersonLink member={person(appeal.suspendedBy)}/>{appeal.suspendedAt ? ` on ${day(appeal.suspendedAt)}` : ''}.</> : ''}</p>
        <p className="preline"><span className="sr-only">Reason: </span>{appeal.reason}</p>
        {appeal.status === 'pending' && !own && <p className="sample-note" role="status">{[block, nobody ? 'Nobody can decide this yet: the only owners or administrators are the person who suspended them. It waits until another owner or administrator can decide.' : null].filter(Boolean).join(' ') || 'You can decide this appeal.'}</p>}
        {(appeal.status === 'upheld' || appeal.status === 'reversed') && <div className="appeal-response"><strong>{appeal.decidedBy === me.userId ? 'Your response' : <>Response from <PersonLink member={person(appeal.decidedBy)}/></>}{appeal.decidedAt ? `, ${day(appeal.decidedAt)}` : ''}</strong><p className="preline">{appeal.response}</p></div>}
        {!own && appeal.status === 'pending' && !block && <div className="review-actions"><Button variant="default" type="button" className="button primary" onClick={() => setDeciding(true)}>Decide</Button></div>}
        {deciding && <DecideAccessDialog appeal={appeal} name={person(appeal.appellantId)?.name ?? 'this member'} onClose={() => setDeciding(false)}/>}
    </article>;
}

function DecideAccessDialog({ appeal, name, onClose }: { appeal: SuspensionAppeal; name: string; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const [response, setResponse] = useState(''), [error, setError] = useState('');
    const field = useId();
    const decide = async (decision: 'upheld' | 'reversed') => {
        setError('');
        if (await command({ type: 'suspension.appeal.decide', appealId: appeal.id, decision, response }, { onError: setError })) onClose();
    };
    return <Modal title="Decide this access appeal" onClose={onClose}>
        <div className="form-stack">
            <p className="modal-intro">Restoring gives {name} their access back at once. Keeping it suspended leaves them outside the community. Your response goes to them, and the decision is recorded in the audit trail.</p>
            <Label htmlFor={field}>Response to the member</Label>
            <Textarea id={field} required rows={4} maxLength={APPEAL_TEXT_MAX} value={response} onChange={e => setResponse(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="review-actions">
                <Button variant="secondary" type="button" className="button secondary" disabled={busy || !response.trim()} onClick={() => void decide('upheld')}>Keep suspended</Button>
                <Button variant="default" type="button" className="button primary" disabled={busy || !response.trim()} onClick={() => void decide('reversed')}>Restore access</Button>
            </div>
        </div>
    </Modal>;
}

const REPORT_STATUS = (r: OwnMessageReport) => r.status === 'open' ? (r.secondLook ? 'Second look requested' : 'Waiting for a moderator') : (r.secondLook ? 'Looked at again' : 'Reviewed');
/** Private messages this person reported, and a second look once a report is closed (decision 058). */
function MyMessageReports() {
    const { slug, userId } = useWorkspace();
    const q = useQuery({ queryKey: ['message-reports-mine', slug, userId], queryFn: () => messageRequest<OwnMessageReport[]>(slug, userId, 'message-reports/mine'), staleTime: 0 });
    const [asking, setAsking] = useState<OwnMessageReport | null>(null);
    if (q.isPending) return <section className="panel"><Loading label="Loading your reports…" lines={1}/></section>;
    if (q.error) return <section className="panel"><InlineError error={q.error} onRetry={() => q.refetch()}/></section>;
    if (!q.data?.length) return null;
    return <section className="panel" aria-labelledby="appeals-reports">
        <h2 id="appeals-reports">Your message reports</h2>
        <p className="muted small">Private messages you reported to the moderators. When a report is closed you can ask once for another moderator to look again.</p>
        {q.data.map(r => <article key={r.id} className="appeal-card" aria-label={`Your report from ${day(r.createdAt)}`}>
            <div className="appeal-head"><strong>Reported on {day(r.createdAt)}</strong><Pill>{REPORT_STATUS(r)}</Pill></div>
            <blockquote className="appeal-quote preline">{r.reportedBody}</blockquote>
            <p className="preline"><span className="sr-only">Your reason: </span>{r.reason}</p>
            {r.secondLook && <p className="muted small preline">You asked for a second look: {r.secondLook}</p>}
            {r.status === 'resolved' && !r.secondLook && <div className="review-actions"><Button variant="secondary" type="button" className="button secondary" onClick={() => setAsking(r)}><Scale size={15} aria-hidden="true"/>Ask for a second look</Button></div>}
        </article>)}
        {asking && <SecondLookDialog report={asking} onClose={() => setAsking(null)} onDone={() => { setAsking(null); void q.refetch(); }}/>}
    </section>;
}

function SecondLookDialog({ report, onClose, onDone }: { report: OwnMessageReport; onClose: () => void; onDone: () => void }) {
    const { slug, userId, toast } = useWorkspace();
    const [reason, setReason] = useState(''), [error, setError] = useState(''), [working, setWorking] = useState(false);
    const field = useId();
    return <Modal title="Ask for a second look" onClose={onClose}>
        <form className="form-stack" onSubmit={async e => {
            e.preventDefault(); setError(''); setWorking(true);
            try { await messageRequest(slug, userId, `message-reports/${report.id}/second-look`, { reason }); toast('Report reopened. Another moderator will look again.'); onDone(); }
            catch (err) { setError(displayError(err)); }
            finally { setWorking(false); }
        }}>
            <p className="modal-intro">The report goes back to the moderators, and the moderator who closed it cannot close it again. You can ask once.</p>
            <Label htmlFor={field}>What should they look at again?</Label>
            <Textarea id={field} required minLength={5} rows={4} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <Button variant="default" className="button primary" disabled={working || reason.trim().length < 5}>Ask again</Button>
        </form>
    </Modal>;
}
