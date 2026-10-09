import { useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileUp, LoaderCircle, Paperclip, Plus, Trash2, Upload, X } from 'lucide-react';
import { Button } from './ui/button';
import { ResourceIcon, describeResource as describe } from './resource-list';
import { useWorkspace } from '../lib/context';
import { newId } from '../../../../packages/contracts/src/index';
import { MAX_LESSON_RESOURCES, MAX_VIDEO_BYTES, RESOURCE_FILE_ACCEPT, formatFileSize, isLessonVideo, type LessonResource } from '../../../../packages/contracts/src/lesson-resources';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useConfirm } from './confirm';

const displayName = (filename: string) => filename.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, 120) || 'Lesson file';

/** Studio editor for the draft's ordered files. Changes stay in the draft buffer until it is saved. */
export function ResourceEditor({ trackId, resources, saved, disabled, uploadsAvailable, videoBytes = 0, onChange }: {
    trackId: string; resources: LessonResource[]; saved: LessonResource[]; disabled: boolean; uploadsAvailable: boolean;
    /** The community's video limit; 0 when video uploads are off. */
    videoBytes?: number;
    /** Updater form, so an upload that finishes later never applies a stale list. */
    onChange: (update: (current: LessonResource[]) => LessonResource[]) => void;
}) {
    const { data, uploadResource, discardUpload } = useWorkspace();
    const confirm = useConfirm();
    const picker = useRef<HTMLInputElement>(null), replacing = useRef<string | null>(null);
    const [uploading, setUploading] = useState(false), [status, setStatus] = useState('');
    const heading = useId();
    const full = resources.length >= MAX_LESSON_RESOURCES, locked = disabled || uploading;
    const referenced = new Set([...data.lessons, ...data.lessonDrafts, ...data.lessonRevisions].flatMap(x => (x.resources ?? []).map(r => r.fileId)));
    const inDraft = new Set(resources.map(r => r.fileId));
    const unattached = data.uploads.filter(u => u.trackId === trackId && u.status === 'ready' && !referenced.has(u.id) && !inDraft.has(u.id));
    const change = (id: string, patch: Partial<LessonResource>) => onChange(current => current.map(r => r.id === id ? { ...r, ...patch } : r));
    const move = (index: number, delta: number) => onChange(current => { const next = [...current]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
    const choose = (target: string | null) => { replacing.current = target; picker.current?.click(); };
    const upload = async (file: File) => {
        const target = replacing.current;
        setUploading(true); setStatus(`Uploading ${file.name} privately and checking it…`);
        const u = await uploadResource(trackId, file, videoBytes);
        setUploading(false);
        if (u === null) { setStatus(`${file.name} is still being checked for viruses. It will be listed under uploaded files not in this draft once it is ready.`); return; }
        if (!u) { setStatus('The file was not attached. Nothing in the draft changed.'); return; }
        const fields = { fileId: u.id, contentType: u.contentType as LessonResource['contentType'], sizeBytes: u.sizeBytes };
        if (target) {
            onChange(current => current.map(r => r.id === target ? { ...r, ...fields } : r));
            setStatus('Replacement ready. Save the draft to keep it. Learners keep the current file until you publish.');
        }
        else {
            onChange(current => [...current, { id: newId(), name: displayName(u.originalName), description: '', ...fields }]);
            setStatus(`${file.name} is ready. Save the draft to attach it.`);
        }
    };
    const badge = (r: LessonResource) => { const old = saved.find(s => s.id === r.id); return !old ? 'New' : old.fileId !== r.fileId ? 'Replaced' : old.name !== r.name || old.description !== r.description ? 'Edited' : ''; };
    return <section className="resource-editor" aria-labelledby={heading}>
        <div className="resource-editor-head">
            <div><h3 id={heading}><Paperclip size={16} aria-hidden="true"/>Lesson files <small>{resources.length} of {MAX_LESSON_RESOURCES}</small></h3>
                <p>PDF, Word, PowerPoint, Excel, JPEG, PNG or WebP, up to 10 MB each.{videoBytes > 0 ? ` MP4 or WebM video up to ${formatFileSize(Math.min(videoBytes, MAX_VIDEO_BYTES)).replace('.0 MB', ' MB')}, which learners can play in the lesson.` : ''} Only people who can open the published lesson can download them.</p></div>
            <Button type="button" variant="outline" size="sm" disabled={locked || full || !uploadsAvailable} onClick={() => choose(null)}>{uploading ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <FileUp size={15} aria-hidden="true"/>}Add file</Button>
            <input ref={picker} type="file" accept={videoBytes > 0 ? RESOURCE_FILE_ACCEPT : RESOURCE_FILE_ACCEPT.split(',').filter(t => !isLessonVideo(t) && t !== '.mp4' && t !== '.webm').join(',')} hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file); }}/>
        </div>
        {!uploadsAvailable && <p className="resource-warning" role="note">Private file storage is not configured for this community, so new files cannot be uploaded. Existing files can still be arranged.</p>}
        <p className="resource-status" role="status" aria-live="polite">{status}</p>
        {resources.length ? <ol className="resource-rows">{resources.map((r, i) => <li key={r.id} className="resource-row">
            <div className="resource-row-file"><span className="resource-icon"><ResourceIcon type={r.contentType}/></span><div><strong>{r.name.trim() || 'Untitled file'}</strong><small>{describe(r)}{badge(r) && <span className="resource-badge">{badge(r)}</span>}</small></div>
                <div className="resource-row-order"><button type="button" className="icon-button" aria-label={`Move ${r.name || 'file'} up`} disabled={locked || i === 0} onClick={() => move(i, -1)}><ArrowUp size={14}/></button><button type="button" className="icon-button" aria-label={`Move ${r.name || 'file'} down`} disabled={locked || i === resources.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14}/></button></div></div>
            <Label>File name shown to learners<Input value={r.name} maxLength={120} disabled={locked} onChange={e => change(r.id, { name: e.target.value })}/></Label>
            <Label>Description for learners (optional)<Textarea rows={2} maxLength={280} value={r.description} disabled={locked} onChange={e => change(r.id, { description: e.target.value })}/></Label>
            {!r.name.trim() && <p className="resource-invalid" role="alert">Give this file a name before saving.</p>}
            <div className="resource-row-actions">
                <Button type="button" variant="ghost" size="sm" disabled={locked || !uploadsAvailable} aria-label={`Replace file for ${r.name || 'this entry'}`} onClick={() => choose(r.id)}><Upload size={14} aria-hidden="true"/>Replace file</Button>
                <Button type="button" variant="ghost" size="sm" disabled={locked} aria-label={`Remove ${r.name || 'this file'} from the draft`} onClick={() => { onChange(current => current.filter(x => x.id !== r.id)); setStatus(`Removed ${r.name || 'the file'} from the draft. Learners keep the published version until you publish again.`); }}><X size={14} aria-hidden="true"/>Remove</Button>
            </div>
        </li>)}</ol> : <p className="resource-empty">No files yet. Add a worksheet, slides, a template or a reference image.</p>}
        {unattached.length > 0 && <details className="resource-unattached"><summary>Uploaded files not in this draft <span>{unattached.length}</span></summary>
            <p>These private uploads are not part of any lesson, draft or history. Add one back, or discard it to delete the stored file.</p>
            <ul>{unattached.map(u => <li key={u.id}><span className="resource-icon"><ResourceIcon type={u.contentType} size={16}/></span><div><strong>{u.originalName}</strong><small>{describe(u)}</small></div>
                <Button type="button" variant="outline" size="sm" disabled={locked || full} aria-label={`Add ${u.originalName} to this draft`} onClick={() => { onChange(current => current.some(x => x.fileId === u.id) ? current : [...current, { id: newId(), fileId: u.id, name: displayName(u.originalName), description: '', contentType: u.contentType as LessonResource['contentType'], sizeBytes: u.sizeBytes }]); setStatus(`${u.originalName} added back. Save the draft to keep it.`); }}><Plus size={14} aria-hidden="true"/>Add</Button>
                <Button type="button" variant="ghost" size="sm" disabled={locked} aria-label={`Discard ${u.originalName}`} onClick={async () => { if (await confirm({ title: `Discard ${u.originalName}?`, body: 'The stored file will be deleted.', confirmText: 'Discard file' }) && await discardUpload(u.id)) setStatus(`${u.originalName} discarded.`); }}><Trash2 size={14} aria-hidden="true"/>Discard</Button>
            </li>)}</ul>
        </details>}
    </section>;
}
