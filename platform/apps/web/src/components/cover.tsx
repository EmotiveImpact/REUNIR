import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ImagePlus, Layers, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { displayError, mode } from '../lib/data';
import { coverUploadsAvailable, demoCoverUrl, liveCoverUrl, peekDemoCoverUrl, prepareCover, uploadCover, type PreparedCover } from '../lib/covers';
import { coverPosition, type CoverSubject } from '../../../../packages/contracts/src/covers';
import { canEditCover } from '../../../../packages/domain/src/covers';
import type { Project, Track } from '../../../../packages/contracts/src/index';

type Subject = Track | Project;
const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** The address of a stored cover, or null for the plain panel. Live covers come through the access-checked route. */
function useCoverSource(kind: CoverSubject, subject: Subject): string | null {
    const { slug } = useWorkspace();
    const fileId = subject.coverImage?.fileId ?? '', key = `${slug}/${fileId}`;
    const [demo, setDemo] = useState<{ key: string; url: string | null }>({ key: '', url: null });
    useEffect(() => {
        if (mode === 'live' || !fileId) return;
        let current = true;
        void demoCoverUrl(slug, fileId).then(url => { if (current) setDemo({ key, url }); });
        return () => { current = false; };
    }, [slug, fileId, key]);
    if (!fileId) return null;
    if (mode === 'live') return liveCoverUrl(slug, kind, subject.id, fileId);
    return demo.key === key ? demo.url : peekDemoCoverUrl(slug, fileId) ?? null;
}

/** An uploaded picture cropped around its focal point, or a plain panel. Decorative: titles always sit outside it. */
export function Cover({ kind, subject, small = false }: { kind: CoverSubject; subject: Subject; small?: boolean }) {
    const src = useCoverSource(kind, subject);
    const [failed, setFailed] = useState<string | null>(null);
    const cover = subject.coverImage;
    const shown = !!src && !!cover && failed !== src;
    const Icon = kind === 'track' ? BookOpen : Layers;
    return <div className={`cover-media${small ? ' cover-small' : ''}${shown ? '' : ' cover-plain'}`} aria-hidden="true">
        {shown ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} style={{ objectPosition: coverPosition(cover) }} onError={() => setFailed(src)}/> : <Icon size={small ? 16 : 26} strokeWidth={1.5}/>}
    </div>;
}

/** Only people who may change this cover see the button: administrators, and a project's own owner. */
export function CoverButton({ kind, subject }: { kind: CoverSubject; subject: Subject }) {
    const { me } = useWorkspace();
    const [open, setOpen] = useState(false);
    if (!canEditCover(me, kind, subject)) return null;
    return <>
        <button type="button" className="button secondary" onClick={() => setOpen(true)}><ImagePlus size={16} aria-hidden="true"/>{subject.coverImage ? 'Change cover' : 'Add a cover'}</button>
        {/* Rendered at the document root so heading and toolbar styles do not reach into the dialogue. */}
        {open && createPortal(<CoverDialog kind={kind} subject={subject} onClose={() => setOpen(false)}/>, document.body)}
    </>;
}

function CoverDialog({ kind, subject, onClose }: { kind: CoverSubject; subject: Subject; onClose: () => void }) {
    const { slug, userId, command } = useWorkspace();
    const current = subject.coverImage ?? null, currentSrc = useCoverSource(kind, subject);
    const uploads = useQuery({ queryKey: ['cover-uploads'], queryFn: coverUploadsAvailable, staleTime: 300000, retry: false });
    const [prepared, setPrepared] = useState<PreparedCover | null>(null);
    const [focus, setFocus] = useState({ x: current?.focusX ?? 50, y: current?.focusY ?? 50 });
    const [working, setWorking] = useState<'' | 'reading' | 'saving' | 'removing'>('');
    const [status, setStatus] = useState(''), [error, setError] = useState('');
    const picker = useRef<HTMLInputElement>(null);
    const help = useId(), across = useId(), down = useId();
    useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
    const src = prepared?.url ?? currentSrc, canUpload = uploads.data === true;
    const changed = !!prepared || (!!current && (current.focusX !== focus.x || current.focusY !== focus.y));
    const position = `${focus.x}% ${focus.y}%`;
    const choose = async (file: File | undefined) => {
        if (!file || working || !canUpload) return;
        setError(''); setWorking('reading'); setStatus('Preparing the image in your browser…');
        try {
            const next = await prepareCover(file);
            setPrepared(next); setFocus({ x: 50, y: 50 });
            setStatus(next.soft ? `Ready. At ${next.width} × ${next.height} pixels it may look soft on large screens.` : 'Ready. Choose the part of the picture to keep in view, then save.');
        }
        catch (e) { setError(displayError(e)); setStatus(''); }
        finally { setWorking(''); }
    };
    const point = (e: PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setFocus({ x: clamp((e.clientX - r.left) / r.width * 100), y: clamp((e.clientY - r.top) / r.height * 100) });
    };
    const set = (fileId: string | null) => command(kind === 'track'
        ? { type: 'track.cover.set', trackId: subject.id, fileId, focusX: focus.x, focusY: focus.y }
        : { type: 'project.cover.set', projectId: subject.id, fileId, focusX: focus.x, focusY: focus.y }, { onError: setError });
    const save = async () => {
        setError(''); setWorking('saving');
        try {
            let fileId = current?.fileId ?? null;
            if (prepared) { setStatus('Uploading the image privately…'); ({ fileId } = await uploadCover(slug, userId, kind, subject.id, prepared)); }
            if (!fileId) return;
            setStatus('Saving the cover…');
            const r = await set(fileId);
            // The command's own message already says when demo storage lasts only for this session.
            if (r) onClose(); else setStatus('');
        }
        catch (e) { setError(displayError(e)); setStatus(''); }
        finally { setWorking(''); }
    };
    const remove = async () => {
        setError(''); setWorking('removing'); setStatus('Removing the cover…');
        const r = await set(null);
        setWorking('');
        if (r) onClose(); else setStatus('');
    };
    return <Modal title={kind === 'track' ? 'Track cover' : 'Project cover'} onClose={onClose} wide>
        <div className="form-stack cover-editor">
            <p className="cover-editor-intro" id={help}>Use a JPEG, PNG or WebP picture. Your browser resizes it to 1,600 pixels on the longest side before upload, which also removes photo details such as location. Titles stay below the picture, so it needs no words of its own.</p>
            {uploads.isError ? <p className="resource-warning" role="note">Upload availability could not be checked, so new pictures cannot be uploaded right now. Close this and try again shortly.</p>
                : uploads.isFetched && !canUpload && <p className="resource-warning" role="note">Private file storage is not configured for this community, so new pictures cannot be uploaded. You can still move the focal point or remove the current cover.</p>}
            <div className="cover-stage" onDragOver={e => { if (canUpload) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void choose(e.dataTransfer.files[0]); }}>
                {src ? <div className="cover-stage-frame" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); point(e); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e); }}>
                    <img src={src} alt="" draggable={false}/>
                    <span className="cover-focus-mark" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true"/>
                </div> : <div className="cover-stage-empty"><ImagePlus size={28} strokeWidth={1.5} aria-hidden="true"/><span>No cover yet. Choose an image or drop one here. A plain panel shows until then.</span></div>}
            </div>
            <div className="cover-editor-pick">
                <button type="button" className="button secondary" aria-describedby={help} disabled={!!working || !canUpload} onClick={() => picker.current?.click()}>{working === 'reading' ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Upload size={15} aria-hidden="true"/>}{src ? 'Choose another image' : 'Choose an image'}</button>
                <input ref={picker} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void choose(file); }}/>
            </div>
            {src && <fieldset className="cover-focus-controls" disabled={!!working}>
                <legend>Focal point</legend>
                <p>Click or drag on the picture, or use the sliders. Every card keeps this point in view.</p>
                <div className="cover-slider"><label htmlFor={across}>Left to right</label><input id={across} type="range" min={0} max={100} step={1} value={focus.x} onChange={e => setFocus(f => ({ ...f, x: clamp(Number(e.target.value)) }))}/><span className="cover-slider-value" aria-hidden="true">{focus.x}%</span></div>
                <div className="cover-slider"><label htmlFor={down}>Top to bottom</label><input id={down} type="range" min={0} max={100} step={1} value={focus.y} onChange={e => setFocus(f => ({ ...f, y: clamp(Number(e.target.value)) }))}/><span className="cover-slider-value" aria-hidden="true">{focus.y}%</span></div>
            </fieldset>}
            {src && <div className="cover-previews" aria-hidden="true">
                {(['Banner', 'Card', 'Small'] as const).map(name => <figure key={name} className={`cover-preview cover-preview-${name.toLowerCase()}`}><div><img src={src} alt="" draggable={false} style={{ objectPosition: position }}/></div><figcaption>{name}</figcaption></figure>)}
            </div>}
            <p className="cover-editor-status" role="status" aria-live="polite">{status}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                {current && <button type="button" className="button secondary cover-remove" disabled={!!working} onClick={() => void remove()}><Trash2 size={15} aria-hidden="true"/>Remove cover</button>}
                <button type="button" className="button secondary" disabled={working === 'saving'} onClick={onClose}>Cancel</button>
                <button type="button" className="button primary" disabled={!!working || !changed} onClick={() => void save()}>{working === 'saving' ? 'Saving…' : 'Save cover'}</button>
            </div>
        </div>
    </Modal>;
}
