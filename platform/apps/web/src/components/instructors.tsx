import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, UserMinus, UserPlus } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { isAdmin } from '../../../../packages/domain/src/access';
import type { Track } from '../../../../packages/contracts/src/index';

/** Owners and administrators choose who teaches a track. Instructors author and review that track only. */
export function InstructorsButton({ track }: { track: Track }) {
    const { me } = useWorkspace();
    const [open, setOpen] = useState(false);
    if (!isAdmin(me)) return null;
    return <>
        <button type="button" className="button secondary" onClick={() => setOpen(true)}><GraduationCap size={16} aria-hidden="true"/>Instructors</button>
        {open && createPortal(<InstructorsDialog track={track} onClose={() => setOpen(false)}/>, document.body)}
    </>;
}

function InstructorsDialog({ track, onClose }: { track: Track; onClose: () => void }) {
    const { data, command, busy } = useWorkspace();
    const [choice, setChoice] = useState(''), [error, setError] = useState('');
    const select = useId(), intro = useId();
    const grants = data.trackInstructors.filter(i => i.trackId === track.id);
    const name = (userId: string) => data.members.find(m => m.userId === userId)?.name ?? 'Former member';
    // Administrators already teach every track, so only other active members are offered.
    const candidates = data.members.filter(m => m.status === 'active' && !isAdmin(m) && !grants.some(g => g.userId === m.userId)).sort((a, b) => a.name.localeCompare(b.name));
    const add = async () => {
        if (!choice) return;
        setError('');
        if (await command({ type: 'track.instructor.add', trackId: track.id, userId: choice }, { onError: setError })) setChoice('');
    };
    return <Modal title="Track instructors" onClose={onClose}>
        <div className="form-stack instructors-editor">
            <p id={intro}>Instructors author lessons, files and knowledge checks for <strong>{track.title}</strong> and give feedback on its knowledge checks. They cannot change other tracks or community settings. Owners and administrators can already do all of this.</p>
            {grants.length ? <ul className="instructor-list" aria-label="Current instructors">{grants.map(g => <li key={g.id}>
                <Avatar member={data.members.find(m => m.userId === g.userId)} size="sm"/><span className="instructor-name"><strong>{name(g.userId)}</strong><small>Added by {name(g.grantedBy)}</small></span>
                <button type="button" className="button secondary" disabled={busy} aria-label={`Remove ${name(g.userId)} as an instructor`} onClick={() => { setError(''); void command({ type: 'track.instructor.remove', trackId: track.id, userId: g.userId }, { onError: setError }); }}><UserMinus size={15} aria-hidden="true"/>Remove</button>
            </li>)}</ul> : <p className="muted">No instructors yet. Owners and administrators author this track.</p>}
            <div className="instructor-add">
                <label htmlFor={select}>Add an instructor</label>
                <div><select id={select} value={choice} aria-describedby={intro} onChange={e => setChoice(e.target.value)}>
                    <option value="">Choose a member</option>
                    {candidates.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                </select>
                <button type="button" className="button primary" disabled={busy || !choice} onClick={() => void add()}><UserPlus size={15} aria-hidden="true"/>Add</button></div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Done</button></div>
        </div>
    </Modal>;
}
