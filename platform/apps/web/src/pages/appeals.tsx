import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Empty, Modal, PageHeading, PersonLink, Pill, date } from '../components/ui';
import { AppealDialog, currentAppeal } from '../components/appeals';
import { appealDeciders, appealIsCurrent, appealPost, decisionBlock } from '../../../../packages/domain/src/appeals';
import { isAdmin } from '../../../../packages/domain/src/access';
import { APPEAL_TEXT_MAX } from '../../../../packages/contracts/src/appeals';
import type { ModerationAppeal, Post } from '../../../../packages/contracts/src/index';

const STATUS: Record<ModerationAppeal['status'], string> = { pending: 'Waiting for a decision', upheld: 'Kept hidden', reversed: 'Restored', withdrawn: 'Withdrawn' };
const newest = (a: ModerationAppeal, b: ModerationAppeal) => b.createdAt.localeCompare(a.createdAt);

/** A person's own appeals and hidden posts, and, for owners and administrators, the appeals waiting for a decision. */
export function AppealsPage() {
    const { data, me } = useWorkspace();
    const mine = data.moderationAppeals.filter(a => a.appellantId === me.userId).sort(newest);
    const hidden = data.posts.filter(p => p.hidden && p.authorId === me.userId && !currentAppeal(mine, p));
    const others = isAdmin(me) ? data.moderationAppeals.filter(a => a.appellantId !== me.userId).sort(newest) : [];
    const waiting = others.filter(a => a.status === 'pending'), closed = others.filter(a => a.status !== 'pending');
    const current = waiting.filter(a => appealIsCurrent(data, a)).length;
    return <>
        <PageHeading eyebrow="A SECOND LOOK" title="Appeals" body="When a moderator hides your post, you can ask for a second look. An owner or administrator who did not hide it decides. Appeals are private to you and the community’s owners and administrators."/>
        <div className="reading-width appeals-page">
            {hidden.length > 0 && <section className="panel" aria-labelledby="appeals-hidden">
                <h2 id="appeals-hidden">Your hidden posts</h2>
                {hidden.map(p => <HiddenPostRow key={p.id} post={p}/>)}
            </section>}
            <section className="panel" aria-labelledby="appeals-mine">
                <h2 id="appeals-mine">Your appeals</h2>
                {mine.length ? mine.map(a => <AppealCard key={a.id} appeal={a} own/>) : <p className="muted">You have not appealed anything. Suspension of community access is not appealed here.</p>}
            </section>
            {isAdmin(me) && <section className="panel" aria-labelledby="appeals-queue">
                <h2 id="appeals-queue">Appeals to decide <span className="muted">{current}</span></h2>
                {waiting.length ? waiting.map(a => <AppealCard key={a.id} appeal={a}/>) : <Empty title="No appeals are waiting." body="When a member appeals a hidden post, it appears here."/>}
                {closed.length > 0 && <><h3>Decided appeals</h3>{closed.map(a => <AppealCard key={a.id} appeal={a}/>)}</>}
            </section>}
        </div>
    </>;
}

function HiddenPostRow({ post }: { post: Post }) {
    const [open, setOpen] = useState(false);
    return <div className="appeal-row">
        <div><strong>{post.title || 'A post without a title'}</strong><p className="muted">{post.moderatedAt ? `Hidden on ${date(post.moderatedAt, { day: 'numeric', month: 'long', year: 'numeric' })}. ` : ''}Only you can see it.</p></div>
        <div className="review-actions"><Link className="button secondary" to={`/post/${post.id}`}>Read the post</Link><button type="button" className="button primary" onClick={() => setOpen(true)}><Scale size={15} aria-hidden="true"/>Appeal</button></div>
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
            {own && appeal.status === 'pending' && <button type="button" className="button secondary" disabled={busy} onClick={() => void command({ type: 'moderation.appeal.withdraw', appealId: appeal.id })}>Withdraw appeal</button>}
            {!own && appeal.status === 'pending' && !block && <button type="button" className="button primary" onClick={() => setDeciding(true)}>Decide</button>}
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
            <label htmlFor={field}>Response to the member</label>
            <textarea id={field} required rows={4} maxLength={APPEAL_TEXT_MAX} value={response} onChange={e => setResponse(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="review-actions">
                <button type="button" className="button secondary" disabled={busy || !response.trim()} onClick={() => void decide('upheld')}>Keep hidden</button>
                <button type="button" className="button primary" disabled={busy || !response.trim()} onClick={() => void decide('reversed')}>Restore the post</button>
            </div>
        </div>
    </Modal>;
}
