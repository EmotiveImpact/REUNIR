import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, ListChecks, Mail, UserMinus, UserPlus } from 'lucide-react';
import { Avatar, Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { createInvitation } from '../lib/invitations';
import { isAdmin } from '../../../../packages/domain/src/access';
import type { Lesson, TeachingRole, Track } from '../../../../packages/contracts/src/index';
import { teachingRole } from '../../../../packages/domain/src/instructors';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';

/** Owners and administrators choose who teaches a track. Instructors author and review that track only. */
export function InstructorsButton({ track }: { track: Track }) {
    const { me } = useWorkspace();
    const [open, setOpen] = useState(false);
    if (!isAdmin(me)) return null;
    return <>
        <Button variant="secondary" type="button" className="button secondary" onClick={() => setOpen(true)}><GraduationCap size={16} aria-hidden="true"/>Instructors</Button>
        {open && createPortal(<InstructorsDialog track={track} onClose={() => setOpen(false)}/>, document.body)}
    </>;
}

function InstructorsDialog({ track, onClose }: { track: Track; onClose: () => void }) {
    const { data, command, busy } = useWorkspace();
    const [choice, setChoice] = useState(''), [role, setRole] = useState<TeachingRole>('instructor'), [error, setError] = useState('');
    // Empty means the whole track; otherwise the grant covers only the chosen lessons.
    const [some, setSome] = useState(false), [chosen, setChosen] = useState<string[]>([]);
    // The grant whose lessons are being changed, if any.
    const [editing, setEditing] = useState<{ userId: string; some: boolean; chosen: string[] } | null>(null);
    const select = useId(), roleSelect = useId(), intro = useId();
    const lessons = data.lessons.filter(l => l.trackId === track.id).sort((a, b) => a.position - b.position);
    const lessonTitle = (id: string) => lessons.find(l => l.id === id)?.title ?? 'A lesson';
    const grants = data.trackInstructors.filter(i => i.trackId === track.id);
    const name = (userId: string) => data.members.find(m => m.userId === userId)?.name ?? 'Former member';
    // Administrators already teach every track, so only other active members are offered.
    const candidates = data.members.filter(m => m.status === 'active' && !isAdmin(m) && !grants.some(g => g.userId === m.userId)).sort((a, b) => a.name.localeCompare(b.name));
    const add = async () => {
        if (!choice) return;
        setError('');
        if (await command({ type: 'track.instructor.add', trackId: track.id, userId: choice, role, lessonIds: some ? chosen : null }, { onError: setError })) { setChoice(''); setSome(false); setChosen([]); }
    };
    const change = async (userId: string, next: TeachingRole, lessonIds: string[] | null) => { setError(''); return command({ type: 'track.instructor.add', trackId: track.id, userId, role: next, lessonIds }, { onError: setError }); };
    return <Modal title="Track instructors" onClose={onClose}>
        <div className="form-stack instructors-editor">
            <p id={intro}>Instructors author, publish and order lessons, files and knowledge checks for <strong>{track.title}</strong> and give feedback on its knowledge checks. Contributors write drafts and attach files for the instructors to publish. Neither can change other tracks or community settings. Owners and administrators can already do all of this.</p>
            {grants.length ? <ul className="instructor-list" aria-label="Current instructors and contributors">{grants.map(g => <li key={g.id}>
                <Avatar member={data.members.find(m => m.userId === g.userId)} size="sm"/><span className="instructor-name"><strong>{name(g.userId)}</strong><small>{teachingRole(g) === 'instructor' ? 'Instructor' : 'Contributor'}{g.lessonIds ? ` for ${g.lessonIds.map(lessonTitle).join(', ')}` : ', whole track'} · added by {name(g.grantedBy)}</small></span>
                <NativeSelect aria-label={`Role for ${name(g.userId)}`} value={teachingRole(g)} disabled={busy} onChange={e => void change(g.userId, e.target.value as TeachingRole, g.lessonIds ?? null)}><option value="instructor">Instructor</option><option value="contributor">Contributor</option></NativeSelect>
                <Button variant="secondary" type="button" className="button secondary" disabled={busy || !lessons.length} aria-expanded={editing?.userId === g.userId} aria-label={`Change lessons for ${name(g.userId)}`} onClick={() => setEditing(e => e?.userId === g.userId ? null : { userId: g.userId, some: !!g.lessonIds, chosen: g.lessonIds ?? [] })}><ListChecks size={15} aria-hidden="true"/>Lessons</Button>
                <Button variant="secondary" type="button" className="button secondary" disabled={busy} aria-label={`Remove ${name(g.userId)} from this track`} onClick={() => { setError(''); void command({ type: 'track.instructor.remove', trackId: track.id, userId: g.userId }, { onError: setError }); }}><UserMinus size={15} aria-hidden="true"/>Remove</Button>
                {editing?.userId === g.userId && <div className="instructor-grant-scope">
                    <LessonScope legend={`What ${name(g.userId)} works on`} lessons={lessons} some={editing.some} chosen={editing.chosen} onSome={v => setEditing({ ...editing, some: v })} onChosen={c => setEditing({ ...editing, chosen: c })}/>
                    <div><Button variant="default" type="button" className="button primary" disabled={busy || (editing.some && !editing.chosen.length)} onClick={async () => { if (await change(g.userId, teachingRole(g), editing.some ? editing.chosen : null)) setEditing(null); }}>Save lessons</Button>
                    <Button variant="secondary" type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</Button></div>
                </div>}
            </li>)}</ul> : <p className="muted">No instructors yet. Owners and administrators author this track.</p>}
            <div className="instructor-add">
                <Label htmlFor={select}>Add someone to teach</Label>
                <div><NativeSelect id={select} value={choice} aria-describedby={intro} onChange={e => setChoice(e.target.value)}>
                    <option value="">Choose a member</option>
                    {candidates.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                </NativeSelect>
                <NativeSelect id={roleSelect} aria-label="Role" value={role} onChange={e => setRole(e.target.value as TeachingRole)}><option value="instructor">Instructor</option><option value="contributor">Contributor</option></NativeSelect>
                <Button variant="default" type="button" className="button primary" disabled={busy || !choice || (some && !chosen.length)} onClick={() => void add()}><UserPlus size={15} aria-hidden="true"/>Add</Button></div>
                <LessonScope legend="What they work on" lessons={lessons} some={some} chosen={chosen} onSome={setSome} onChosen={setChosen}/>
            </div>
            <InviteToTeach track={track}/>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions"><Button variant="secondary" type="button" className="button secondary" onClick={onClose}>Done</Button></div>
        </div>
    </Modal>;
}

/** The whole track, or only the chosen lessons. Used when adding someone and when changing an existing grant. */
function LessonScope({ legend, lessons, some, chosen, onSome, onChosen }: { legend: string; lessons: Lesson[]; some: boolean; chosen: string[]; onSome: (some: boolean) => void; onChosen: (chosen: string[]) => void }) {
    const scopeName = useId();
    return <RadioGroup asChild name={scopeName} value={some ? 'some' : 'all'} onValueChange={v => onSome(v === 'some')}><fieldset className="instructor-scope"><legend>{legend}</legend>
        <Label><RadioGroupItem value="all"/>The whole track, including new lessons</Label>
        <Label><RadioGroupItem value="some" disabled={!lessons.length}/>Only the lessons I choose</Label>
        {some && <div className="instructor-lessons">{lessons.map(l => <Label key={l.id}><Checkbox checked={chosen.includes(l.id)} onCheckedChange={on => onChosen(on === true ? [...chosen, l.id] : chosen.filter(x => x !== l.id))}/>{l.title}</Label>)}</div>}
    </fieldset></RadioGroup>;
}

/**
 * Someone who is not yet a member can be invited by email to teach this track. Accepting makes them a member and an
 * instructor of this track only, recorded in the inviting administrator's name.
 */
function InviteToTeach({ track }: { track: Track }) {
    const { data, slug, mode, toast } = useWorkspace();
    const [email, setEmail] = useState(''), [link, setLink] = useState<string | null>(null), [sent, setSent] = useState(''), [working, setWorking] = useState(false), [error, setError] = useState('');
    const field = useId(), note = useId();
    const send = async () => {
        setWorking(true); setError('');
        try {
            const r = await createInvitation(slug, email, { id: track.id, title: track.title });
            setSent(email); setLink(r.url); setEmail('');
            if (r.url) toast(r.emailConfigured ? 'Invitation queued for email delivery.' : 'Invitation created. Email delivery needs configuration.');
        } catch (e) { setError(displayError(e)); } finally { setWorking(false); }
    };
    return <form className="instructor-invite" onSubmit={e => { e.preventDefault(); void send(); }}>
        <Label htmlFor={field}>Invite someone new to teach</Label>
        <div><Input id={field} type="email" required autoComplete="off" value={email} aria-describedby={note} onChange={e => setEmail(e.target.value.trim().toLowerCase())} placeholder="name@example.com"/>
        <Button variant="secondary" type="submit" className="button secondary" disabled={working || !email}><Mail size={15} aria-hidden="true"/>{working ? 'Inviting…' : 'Invite'}</Button></div>
        <small id={note}>They join {data.organisation.name} as a member and teach {track.title} only. Invite people who are expecting to hear from you.</small>
        {sent && <p role="status">{mode === 'demo' ? `A fictional invitation for ${sent} was recorded. The preview never sends email.` : `Invitation created for ${sent}. This personal link is shown once:`}</p>}
        {link && <Input readOnly aria-label="Personal invitation link" value={link} onFocus={e => e.target.select()}/>}
        {error && <p className="form-error" role="alert">{error}</p>}
    </form>;
}
