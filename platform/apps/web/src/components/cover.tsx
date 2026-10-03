import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Image as ImageIcon, ImagePlus, Layers, LoaderCircle, Search, Trash2, Upload, X } from 'lucide-react';
import { Modal } from './ui';
import { useWorkspace } from '../lib/context';
import { displayError, mode } from '../lib/data';
import { coverUploadsAvailable, demoCoverUrl, liveCoverUrl, liveLibraryUrl, peekDemoCoverUrl, prepareCover, uploadCover, type PreparedCover } from '../lib/covers';
import { MAX_COVER_DESCRIPTION, coverLibraryMatches, coverPosition, type CoverSubject, type CoverVariant } from '../../../../packages/contracts/src/covers';
import { canEditCover } from '../../../../packages/domain/src/covers';
import type { CoverLibraryItem, Project, Track } from '../../../../packages/contracts/src/index';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Input } from './ui/input';

type Subject = Track | Project;
const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** Fictional demo only: the object URL for a picture stored in this browser, or the bundled library photograph. */
function useDemoUrl(fileId: string, variant: CoverVariant): string | null {
    const { slug } = useWorkspace();
    const key = `${slug}/${fileId}/${variant}`;
    const [demo, setDemo] = useState<{ key: string; url: string | null }>({ key: '', url: null });
    useEffect(() => {
        if (mode === 'live' || !fileId) return;
        let current = true;
        void demoCoverUrl(slug, fileId, variant).then(url => { if (current) setDemo({ key, url }); });
        return () => { current = false; };
    }, [slug, fileId, key, variant]);
    if (mode === 'live' || !fileId) return null;
    return demo.key === key ? demo.url : peekDemoCoverUrl(slug, fileId, variant) ?? null;
}
/**
 * The address of a stored cover, or null for the plain panel. Live covers come through the access-checked route; the
 * thumbnail address gives cards the small copy, or the full picture when a cover has none.
 */
function useCoverSource(kind: CoverSubject, subject: Subject, variant: CoverVariant = 'full'): string | null {
    const { slug } = useWorkspace();
    const fileId = subject.coverImage?.fileId ?? '', demo = useDemoUrl(fileId, variant);
    if (!fileId) return null;
    return mode === 'live' ? liveCoverUrl(slug, kind, subject.id, fileId, variant) : demo;
}
/** The address of a library picture, served to every active member. */
export function useLibrarySource(item: CoverLibraryItem | null, variant: CoverVariant = 'full'): string | null {
    const { slug } = useWorkspace();
    const demo = useDemoUrl(item?.fileId ?? '', variant);
    if (!item) return null;
    return mode === 'live' ? liveLibraryUrl(slug, item.id, variant) : demo;
}
/** A library picture as a small square, from its small copy. Decorative: its name is always written beside it. */
export function LibraryThumb({ item }: { item: CoverLibraryItem }) {
    const src = useLibrarySource(item, 'thumbnail');
    const [failed, setFailed] = useState<string | null>(null);
    return <span className="cover-library-thumb" aria-hidden="true">
        {src && failed !== src ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} data-cover-variant="thumbnail" onError={() => setFailed(src)}/> : <ImageIcon size={18} strokeWidth={1.5}/>}
    </span>;
}

/**
 * An uploaded picture cropped around its focal point, or a plain panel. Decorative unless `described` and the editor gave
 * it a description. Cards and lists load the small copy; a track's or project's own page, and `full`, load the picture.
 */
export function Cover({ kind, subject, small = false, described = false, full = false }: { kind: CoverSubject; subject: Subject; small?: boolean; described?: boolean; full?: boolean }) {
    const variant: CoverVariant = described || full ? 'full' : 'thumbnail';
    const src = useCoverSource(kind, subject, variant);
    const [failed, setFailed] = useState<string | null>(null);
    const cover = subject.coverImage;
    const shown = !!src && !!cover && failed !== src;
    const Icon = kind === 'track' ? BookOpen : Layers;
    // On a track or project's own page a described picture is announced; everywhere else covers stay decorative.
    const label = described && shown ? cover.description : undefined;
    return <div className={`cover-media${small ? ' cover-small' : ''}${shown ? '' : ' cover-plain'}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
        {shown ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} data-cover-variant={variant} style={{ objectPosition: coverPosition(cover) }} onError={() => setFailed(src)}/> : <Icon size={small ? 16 : 26} strokeWidth={1.5}/>}
    </div>;
}

/** Only people who may change this cover see the button: administrators, a track's instructors and a project's own owner. */
export function CoverButton({ kind, subject }: { kind: CoverSubject; subject: Subject }) {
    const { data, me } = useWorkspace();
    const [open, setOpen] = useState(false);
    if (!canEditCover(data, me, kind, subject)) return null;
    return <>
        <Button variant="secondary" type="button" className="button secondary" onClick={() => setOpen(true)}><ImagePlus size={16} aria-hidden="true"/>{subject.coverImage ? 'Change cover' : 'Add a cover'}</Button>
        {/* Rendered at the document root so heading and toolbar styles do not reach into the dialogue. */}
        {open && createPortal(<CoverDialog kind={kind} subject={subject} onClose={() => setOpen(false)}/>, document.body)}
    </>;
}

function CoverDialog({ kind, subject, onClose }: { kind: CoverSubject; subject: Subject; onClose: () => void }) {
    const { data, slug, userId, command } = useWorkspace();
    const current = subject.coverImage ?? null, currentSrc = useCoverSource(kind, subject);
    const library = data.coverLibrary ?? [], currentItem = current ? library.find(i => i.fileId === current.fileId) : undefined;
    const uploads = useQuery({ queryKey: ['cover-uploads'], queryFn: coverUploadsAvailable, staleTime: 300000, retry: false });
    const [source, setSource] = useState<'upload' | 'library'>(currentItem ? 'library' : 'upload');
    const [prepared, setPrepared] = useState<PreparedCover | null>(null);
    const [picked, setPicked] = useState<CoverLibraryItem | null>(null);
    const [focus, setFocus] = useState({ x: current?.focusX ?? 50, y: current?.focusY ?? 50 });
    const [description, setDescription] = useState(current?.description ?? '');
    const [working, setWorking] = useState<'' | 'reading' | 'saving' | 'removing'>('');
    const [status, setStatus] = useState(''), [error, setError] = useState('');
    const picker = useRef<HTMLInputElement>(null);
    const help = useId(), across = useId(), down = useId(), choice = useId(), describe = useId(), describeHelp = useId();
    const pickedSrc = useLibrarySource(picked);
    const [query, setQuery] = useState(''), [tag, setTag] = useState('');
    const filter = useId();
    const tags = [...new Set(library.flatMap(i => i.tags ?? []))].sort();
    const shownLibrary = library.filter(i => coverLibraryMatches(i, query, tag));
    // A filter helps once there is something to sort through: more than a handful of pictures, or any tags.
    const filterable = library.length > 4 || tags.length > 0;
    useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
    const src = prepared?.url ?? (picked ? pickedSrc : currentSrc), canUpload = uploads.data === true;
    const chosenFile = prepared ? null : picked?.fileId ?? current?.fileId ?? null;
    const changed = !!prepared || (!!picked && picked.fileId !== current?.fileId) || (!!current && (current.focusX !== focus.x || current.focusY !== focus.y || (current.description ?? '') !== description.trim()));
    const position = `${focus.x}% ${focus.y}%`;
    const choose = async (file: File | undefined) => {
        if (!file || working || !canUpload) return;
        setSource('upload'); setError(''); setWorking('reading'); setStatus('Preparing the image in your browser…');
        try {
            const next = await prepareCover(file);
            setPrepared(next); setPicked(null); setFocus({ x: 50, y: 50 }); setDescription('');
            setStatus(next.soft ? `Ready. At ${next.width} × ${next.height} pixels it may look soft on large screens.` : 'Ready. Choose the part of the picture to keep in view, then save.');
        }
        catch (e) { setError(displayError(e)); setStatus(''); }
        finally { setWorking(''); }
    };
    const pick = (item: CoverLibraryItem) => {
        setPrepared(null); setPicked(item); setError('');
        // The current picture keeps its focal point; a new one starts centred.
        setFocus(item.fileId === current?.fileId ? { x: current.focusX, y: current.focusY } : { x: 50, y: 50 });
        setDescription(item.fileId === current?.fileId ? current.description ?? '' : '');
        setStatus(`${item.label} chosen. Choose the part of the picture to keep in view, then save.`);
    };
    const point = (e: PointerEvent<HTMLDivElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setFocus({ x: clamp((e.clientX - r.left) / r.width * 100), y: clamp((e.clientY - r.top) / r.height * 100) });
    };
    const set = (fileId: string | null) => command(kind === 'track'
        ? { type: 'track.cover.set', trackId: subject.id, fileId, focusX: focus.x, focusY: focus.y, ...(fileId ? { description: description.trim() } : {}) }
        : { type: 'project.cover.set', projectId: subject.id, fileId, focusX: focus.x, focusY: focus.y, ...(fileId ? { description: description.trim() } : {}) }, { onError: setError });
    const save = async () => {
        setError(''); setWorking('saving');
        try {
            let fileId = chosenFile;
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
    const selected = prepared ? null : picked?.id ?? currentItem?.id ?? null;
    const empty = source === 'library' ? 'No cover yet. Choose a picture from the library below. A plain panel shows until then.' : 'No cover yet. Choose an image or drop one here. A plain panel shows until then.';
    return <Modal title={kind === 'track' ? 'Track cover' : 'Project cover'} onClose={onClose} wide>
        <div className="form-stack cover-editor">
            <p className="cover-editor-intro" id={help}>Use a JPEG, PNG or WebP picture. Your browser resizes it to 1,600 pixels on the longest side before upload, which also removes photo details such as location. Titles stay below the picture, so it needs no words of its own.</p>
            {library.length > 0 && <RadioGroup asChild name={choice} value={source} onValueChange={v => setSource(v as 'upload' | 'library')}><fieldset className="cover-source" disabled={!!working}>
                <legend>Picture</legend>
                <Label><RadioGroupItem value="upload"/>Upload your own</Label>
                <Label><RadioGroupItem value="library"/>Community library</Label>
            </fieldset></RadioGroup>}
            {source === 'upload' && (uploads.isError ? <p className="resource-warning" role="note">Upload availability could not be checked, so new pictures cannot be uploaded right now. Close this and try again shortly.</p>
                : uploads.isFetched && !canUpload && <p className="resource-warning" role="note">Private file storage is not configured for this community, so new pictures cannot be uploaded. You can still move the focal point or remove the current cover.</p>)}
            <div className="cover-stage" onDragOver={e => { if (canUpload) e.preventDefault(); }} onDrop={e => { e.preventDefault(); void choose(e.dataTransfer.files[0]); }}>
                {src ? <div className="cover-stage-frame" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); point(e); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e); }}>
                    <img src={src} alt="" draggable={false}/>
                    <span className="cover-focus-mark" style={{ left: `${focus.x}%`, top: `${focus.y}%` }} aria-hidden="true"/>
                </div> : <div className="cover-stage-empty"><ImagePlus size={28} strokeWidth={1.5} aria-hidden="true"/><span>{empty}</span></div>}
            </div>
            {source === 'upload' ? <div className="cover-editor-pick">
                <Button variant="secondary" type="button" className="button secondary" aria-describedby={help} disabled={!!working || !canUpload} onClick={() => picker.current?.click()}>{working === 'reading' ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Upload size={15} aria-hidden="true"/>}{src ? 'Choose another image' : 'Choose an image'}</Button>
                <input ref={picker} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void choose(file); }}/>
            </div> : <RadioGroup asChild name={`${choice}-picture`} value={selected ?? ''} onValueChange={id => { const item = library.find(x => x.id === id); if (item) pick(item); }}><fieldset className="cover-library-picker" disabled={!!working}>
                <legend>Community library</legend>
                <p>Pictures your community’s owners and administrators have added. Choosing one does not copy it.</p>
                {filterable && <div className="cover-library-filter">
                    <Label htmlFor={filter}>Find a picture</Label>
                    <div className="cover-library-search"><Search size={14} aria-hidden="true"/><Input id={filter} type="search" value={query} placeholder="Name or tag" autoComplete="off" onChange={e => setQuery(e.target.value)}/></div>
                    {tags.length > 0 && <div className="cover-tag-filters" role="group" aria-label="Show pictures tagged">
                        {tags.map(t => <button key={t} type="button" className="cover-tag" aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>{t}</button>)}
                    </div>}
                    <p className="cover-library-count" aria-live="polite">{shownLibrary.length === library.length ? `${library.length} ${library.length === 1 ? 'picture' : 'pictures'}` : `Showing ${shownLibrary.length} of ${library.length} pictures`}</p>
                </div>}
                {shownLibrary.length ? <div className="cover-library-grid">
                    {shownLibrary.map(item => {
                        // Named by the picture's name alone; its tags are read as the description.
                        const name = `${choice}-${item.id}-name`, tagged = `${choice}-${item.id}-tags`, hasTags = !!item.tags?.length;
                        return <Label key={item.id} className="cover-library-option">
                            <RadioGroupItem value={item.id} aria-labelledby={name} aria-describedby={hasTags ? tagged : undefined}/>
                            <LibraryThumb item={item}/>
                            <span className="cover-library-label"><span id={name}>{item.label}</span>{hasTags && <small id={tagged} className="cover-library-tags">Tags: {item.tags.join(', ')}</small>}</span>
                        </Label>;
                    })}
                </div> : <div className="cover-library-none"><p>No pictures match. Try another word or tag.</p><Button variant="secondary" type="button" className="button secondary" onClick={() => { setQuery(''); setTag(''); }}><X size={15} aria-hidden="true"/>Clear the filter</Button></div>}
            </fieldset></RadioGroup>}
            {src && <fieldset className="cover-focus-controls" disabled={!!working}>
                <legend>Focal point</legend>
                <p>Click or drag on the picture, or use the sliders. Every card keeps this point in view.</p>
                <div className="cover-slider"><Label htmlFor={across}>Left to right</Label><input id={across} type="range" min={0} max={100} step={1} value={focus.x} onChange={e => setFocus(f => ({ ...f, x: clamp(Number(e.target.value)) }))}/><span className="cover-slider-value" aria-hidden="true">{focus.x}%</span></div>
                <div className="cover-slider"><Label htmlFor={down}>Top to bottom</Label><input id={down} type="range" min={0} max={100} step={1} value={focus.y} onChange={e => setFocus(f => ({ ...f, y: clamp(Number(e.target.value)) }))}/><span className="cover-slider-value" aria-hidden="true">{focus.y}%</span></div>
            </fieldset>}
            {src && <div className="cover-description">
                <Label htmlFor={describe}>Describe the picture <span className="muted">(optional)</span></Label>
                <Input id={describe} type="text" value={description} disabled={!!working} aria-describedby={describeHelp} onChange={e => setDescription(e.target.value)} placeholder="For example: hands sketching on a notebook beside a laptop"/>
                <small id={describeHelp}>Read aloud on the {kind === 'track' ? 'track' : 'project'} page for people who cannot see it. Say what it shows, not that it is a picture. Leave empty if it is only decoration. {MAX_COVER_DESCRIPTION - Array.from(description.trim()).length} characters left.</small>
            </div>}
            {src && <div className="cover-previews" aria-hidden="true">
                {(['Banner', 'Card', 'Small'] as const).map(name => <figure key={name} className={`cover-preview cover-preview-${name.toLowerCase()}`}><div><img src={src} alt="" draggable={false} style={{ objectPosition: position }}/></div><figcaption>{name}</figcaption></figure>)}
            </div>}
            <p className="cover-editor-status" role="status" aria-live="polite">{status}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                {current && <Button variant="secondary" type="button" className="button secondary cover-remove" disabled={!!working} onClick={() => void remove()}><Trash2 size={15} aria-hidden="true"/>Remove cover</Button>}
                <Button variant="secondary" type="button" className="button secondary" disabled={working === 'saving'} onClick={onClose}>Cancel</Button>
                <Button variant="default" type="button" className="button primary" disabled={!!working || !changed} onClick={() => void save()}>{working === 'saving' ? 'Saving…' : 'Save cover'}</Button>
            </div>
        </div>
    </Modal>;
}
