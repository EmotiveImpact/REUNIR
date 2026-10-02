import { useState, type FormEvent } from 'react';
import { Plus, Send, Link as LinkIcon, Sparkles, FileText, MessageCircle, FolderPlus, BookOpen, Calendar, Flag, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib/context';
import { Modal } from './ui';
import type { CommandInput } from '../../../../packages/contracts/src/index';
export type CreateKind = 'post' | 'project' | 'space' | 'track' | 'lesson' | 'mission' | 'event';
export function CreateModal({ kind, onClose, spaceId, trackId }: {
    kind: CreateKind;
    onClose: () => void;
    spaceId?: string;
    trackId?: string;
}) {
    const { data, command, busy } = useWorkspace();
    const navigate = useNavigate();
    const [error, E] = useState('');
    const title = { post: 'Start a conversation', project: 'Give your idea a home', space: 'Create a space', track: 'Create a learning track', lesson: 'Add a lesson', mission: 'Create a mission', event: 'Bring people together' }[kind];
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        E('');
        const f = new FormData(e.currentTarget);
        const get = (s: string) => String(f.get(s) || '').trim();
        const list = (s: string) => get(s).split('\n').map(x => x.trim()).filter(Boolean);
        let c: CommandInput;
        try {
            switch (kind) {
                case 'post':
                    c = { type: 'post.create', spaceId: get('spaceId'), kind: get('kind') as 'update', title: get('title'), body: get('body') };
                    break;
                case 'project':
                    c = { type: 'project.create', title: get('title'), tagline: get('tagline'), summary: get('body'), category: get('category'), skills: get('skills').split(',').map(x => x.trim()).filter(Boolean), spaceId: get('spaceId') || null };
                    break;
                case 'space':
                    c = { type: 'space.create', name: get('title'), description: get('body'), visibility: get('visibility') as 'members', kind: get('kind') as 'discussion' };
                    break;
                case 'track':
                    c = { type: 'track.create', title: get('title'), summary: get('summary'), description: get('body'), category: get('category'), spaceId: get('spaceId') || null };
                    break;
                case 'lesson':
                    c = { type: 'lesson.create', trackId: get('trackId'), title: get('title'), summary: get('summary'), body: get('body'), minutes: Number(get('minutes')), resourceUrl: get('url') };
                    break;
                case 'mission':
                    c = { type: 'mission.create', title: get('title'), brief: get('body'), criteria: list('criteria'), category: get('category'), points: Number(get('points')), dueAt: new Date(get('date')).toISOString(), spaceId: get('spaceId') || null, trackId: get('trackId') || null };
                    break;
                case 'event':
                    c = { type: 'event.create', title: get('title'), summary: get('body'), startsAt: new Date(get('date')).toISOString(), duration: Number(get('minutes')), format: get('format') as 'workshop', location: get('location'), meetingUrl: get('url'), spaceId: get('spaceId') || null };
                    break;
            }
            const r = await command(c);
            if (r) {
                onClose();
                if (kind === 'project')
                    navigate(`/projects/${r.objectId}`);
                if (kind === 'track')
                    navigate(`/learn/${r.objectId}`);
                if (kind === 'mission')
                    navigate(`/missions/${r.objectId}`);
                if (kind === 'event')
                    navigate(`/events/${r.objectId}`);
            }
            else
                E('Please check the details above. Your changes have not been published.');
        }
        catch (e) {
            E(e instanceof Error ? e.message : 'Please check the form.');
        }
    }
    return <Modal title={title} onClose={onClose}><p className="modal-intro">{kind === 'post' ? 'An unfinished thought can start something good.' : 'Keep it clear, useful and easy for your people to act on.'}</p><form className="form-stack" onSubmit={submit}>
 {['post', 'project', 'track', 'mission', 'event'].includes(kind) && <label>Space<select name="spaceId" defaultValue={spaceId || (kind === 'post' ? (data.spaces[0]?.id || '') : '')}>{kind !== 'post' && <option value="">Whole community</option>}{data.spaces.map(s => <option value={s.id} key={s.id}>{s.name}{s.visibility === 'private' ? ' · Private' : ''}</option>)}</select></label>}
 {kind === 'post' && <label>Post type<select name="kind"><option value="update">Update</option><option value="question">Question</option><option value="resource">Resource</option><option value="project">Work in progress</option></select></label>}
 <label>{kind === 'space' ? 'Name' : 'Title'}{kind === 'post' && <small>Optional</small>}<input name="title" placeholder={{ post: 'What is on your mind?', project: 'What are you building?', space: 'A place for…', track: 'A useful new direction', lesson: 'One clear learning step', mission: 'Something worth doing', event: 'Name your gathering' }[kind]} required={kind !== 'post'} maxLength={kind === 'project' ? 100 : kind === 'space' ? 60 : 120}/></label>
 {kind === 'project' && <label>In one sentence<input name="tagline" required maxLength={180} placeholder="The idea, in plain English."/></label>}
 {['track', 'lesson'].includes(kind) && <label>Short description<input name="summary" maxLength={240} required placeholder="What will somebody take away?"/></label>}
 <label>{kind === 'post' ? 'Your post' : kind === 'lesson' ? 'Lesson content' : kind === 'mission' ? 'The brief' : 'Description'}<textarea name="body" required rows={kind === 'lesson' ? 10 : 5} maxLength={kind === 'lesson' ? 20000 : kind === 'space' ? 500 : 8000} placeholder={kind === 'post' ? 'Share an idea, ask a question, or show us your work…' : 'The context, the purpose, and a clear next step.'}/></label>
 {['track', 'project', 'mission'].includes(kind) && <label>Category<input name="category" maxLength={40} required placeholder="e.g. Storytelling"/></label>}
 {kind === 'project' && <label>Skills you are looking for<input name="skills" maxLength={250} placeholder="Design, development, storytelling"/><small>Separate skills with commas. Up to 8.</small></label>}
 {kind === 'space' && <div className="form-row"><label>Visibility<select name="visibility"><option value="members">Community members</option><option value="private">Private</option></select></label><label>Focus<select name="kind"><option value="discussion">Discussion</option><option value="learning">Learning</option><option value="project">Projects</option></select></label></div>}
 {['lesson', 'mission'].includes(kind) && <label>Learning track<select name="trackId" defaultValue={trackId || ''} required={kind === 'lesson'}>{kind === 'mission' && <option value="">Not linked to a track</option>}{data.tracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
 {kind === 'mission' && <><label>What good looks like<textarea name="criteria" rows={3} required placeholder={'One clear requirement per line'}/></label><label>Building points<input name="points" type="number" min="0" max="500" defaultValue="100" required/></label></>}
 {['mission', 'event'].includes(kind) && <label>{kind === 'mission' ? 'Deadline' : 'Starts at'}<input name="date" type="datetime-local" required/><small>Entered in your device’s local time.</small></label>}
 {['event', 'lesson'].includes(kind) && <><label>Duration in minutes<input name="minutes" type="number" min={kind === 'event' ? 15 : 1} max={kind === 'event' ? 1440 : 240} defaultValue={kind === 'event' ? 60 : 10} required/></label><label>{kind === 'event' ? 'Meeting link' : 'Further reading link'}<input name="url" type="url" pattern="https://.*" placeholder="https://…"/><small>Optional. HTTPS only.</small></label></>}
 {kind === 'event' && <div className="form-row"><label>Format<select name="format"><option value="workshop">Workshop</option><option value="critique">Critique</option><option value="coworking">Co-working</option><option value="social">Social</option></select></label><label>Location<input name="location" maxLength={120} defaultValue="Online" required/></label></div>}
 {error && <p role="alert" className="form-error">{error}</p>}<footer className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Not now</button><button className="button primary" disabled={busy}><Plus size={16}/>{busy ? 'Saving…' : kind === 'post' ? 'Publish post' : 'Create ' + kind}</button></footer></form></Modal>;
}
