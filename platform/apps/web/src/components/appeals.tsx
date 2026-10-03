import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { EyeOff, Scale } from 'lucide-react';
import { Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { APPEAL_TEXT_MAX } from '../../../../packages/contracts/src/appeals';
import type { ModerationAppeal, Post } from '../../../../packages/contracts/src/index';

/** The appeal about this post that is open, or decided for its current hiding, if any. */
export function currentAppeal(appeals: ModerationAppeal[], post: Post): ModerationAppeal | undefined {
    const mine = appeals.filter(a => a.subject === 'post' && a.subjectId === post.id);
    return mine.find(a => a.status === 'pending')
        ?? mine.filter(a => (a.status === 'upheld' || a.status === 'reversed') && (!post.moderatedAt || a.createdAt >= post.moderatedAt)).at(-1);
}

/** Shown on the author's own hidden post: only they can see it, and they can ask for a second look. */
export function HiddenPostNote({ post }: { post: Post }) {
    const { data, me } = useWorkspace();
    const [open, setOpen] = useState(false);
    if (!post.hidden || post.authorId !== me.userId) return null;
    const appeal = currentAppeal(data.moderationAppeals, post);
    return <div className="hidden-post-note" role="note">
        <EyeOff size={15} aria-hidden="true"/>
        <span>A moderator hid this post. It is hidden only to you: other members cannot see it.</span>
        {appeal?.status === 'pending' ? <Link to="/appeals" className="text-link">Your appeal is waiting</Link>
            : appeal ? <Link to="/appeals" className="text-link">See the decision</Link>
            : <button type="button" className="button secondary" onClick={() => setOpen(true)}><Scale size={15} aria-hidden="true"/>Appeal</button>}
        {open && createPortal(<AppealDialog post={post} onClose={() => setOpen(false)}/>, document.body)}
    </div>;
}

export function AppealDialog({ post, onClose }: { post: Post; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const [reason, setReason] = useState(''), [error, setError] = useState('');
    const field = useId();
    return <Modal title="Appeal this decision" onClose={onClose}>
        <form className="form-stack" onSubmit={async e => {
            e.preventDefault(); setError('');
            if (await command({ type: 'moderation.appeal', postId: post.id, reason }, { onError: setError })) onClose();
        }}>
            <p className="modal-intro">An owner or administrator who did not hide <strong>{post.title || 'your post'}</strong> will look again. Only you and the community’s owners and administrators can see your appeal.</p>
            <label htmlFor={field}>Why should it be visible again?</label>
            <textarea id={field} required rows={4} maxLength={APPEAL_TEXT_MAX} value={reason} onChange={e => setReason(e.target.value)}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button primary" disabled={busy || !reason.trim()}>Send appeal</button>
        </form>
    </Modal>;
}
