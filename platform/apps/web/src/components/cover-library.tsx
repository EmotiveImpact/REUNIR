import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { Modal } from './ui';
import { LibraryThumb } from './cover';
import { useWorkspace } from '../lib/context';
import { displayError } from '../lib/data';
import { coverUploadsAvailable, prepareCover, removeLibraryPicture, uploadLibraryPicture, type PreparedCover } from '../lib/covers';
import { MAX_COVER_LIBRARY_ITEMS } from '../../../../packages/contracts/src/covers';
import type { CoverLibraryItem } from '../../../../packages/contracts/src/index';

/**
 * Community settings: owners and administrators keep a small set of pictures that anyone who changes a track or
 * project cover can choose. A picture that a cover shows stays until those covers change.
 */
export function CoverLibrarySettings() {
    const { data, slug, userId, toast, reload } = useWorkspace();
    const library = data.coverLibrary ?? [];
    const uploads = useQuery({ queryKey: ['cover-uploads'], queryFn: coverUploadsAvailable, staleTime: 300000, retry: false });
    const [adding, setAdding] = useState(false), [removing, setRemoving] = useState('');
    const heading = useId();
    const uses = (item: CoverLibraryItem) => [...data.tracks, ...data.projects].filter(r => r.coverImage?.fileId === item.fileId).length;
    const full = library.length >= MAX_COVER_LIBRARY_ITEMS;
    const remove = async (item: CoverLibraryItem) => {
        if (!window.confirm(`Remove ${item.label} from the cover library? The stored picture is deleted.`)) return;
        setRemoving(item.id);
        try { toast(await removeLibraryPicture(slug, userId, item)); reload(); }
        catch (e) { toast(displayError(e)); }
        finally { setRemoving(''); }
    };
    return <section className="panel settings-form cover-library-settings" aria-labelledby={heading}>
        <h2 id={heading}>Cover library</h2>
        <p>Pictures that anyone who changes a track or project cover can choose, so covers can share a look without everyone finding their own. Everyone in the community can see them. Use pictures without words on them; titles are always written below.</p>
        {library.length ? <ul className="cover-library-list">
            {library.map(item => {
                const count = uses(item);
                return <li key={item.id}>
                    <LibraryThumb item={item}/>
                    <div className="cover-library-entry">
                        <strong>{item.label}</strong>
                        <small>{count ? `The cover of ${count} ${count === 1 ? 'track or project' : 'tracks or projects'}. Change ${count === 1 ? 'it' : 'them'} before removing this picture.` : 'Not used as a cover yet.'}</small>
                    </div>
                    <button type="button" className="button secondary" disabled={!!removing || count > 0} aria-label={`Remove ${item.label}`} onClick={() => void remove(item)}>{removing === item.id ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Trash2 size={15} aria-hidden="true"/>}Remove</button>
                </li>;
            })}
        </ul> : <p className="cover-library-empty">No pictures yet. Covers can still be uploaded one at a time.</p>}
        {uploads.isError ? <p className="resource-warning" role="note">Upload availability could not be checked, so pictures cannot be added right now. Try again shortly.</p>
            : uploads.isFetched && uploads.data !== true && <p className="resource-warning" role="note">Private file storage is not configured for this community, so pictures cannot be added.</p>}
        <div className="cover-library-actions">
            <button type="button" className="button primary" disabled={full || uploads.data !== true} onClick={() => setAdding(true)}><ImagePlus size={16} aria-hidden="true"/>Add a picture</button>
            <span>{library.length} of {MAX_COVER_LIBRARY_ITEMS} pictures{full ? '. Remove one to add another.' : ''}</span>
        </div>
        {adding && createPortal(<AddPictureDialog onClose={() => setAdding(false)}/>, document.body)}
    </section>;
}

function AddPictureDialog({ onClose }: { onClose: () => void }) {
    const { slug, userId, command } = useWorkspace();
    const [prepared, setPrepared] = useState<PreparedCover | null>(null);
    const [label, setLabel] = useState('');
    const [working, setWorking] = useState<'' | 'reading' | 'saving'>('');
    const [status, setStatus] = useState(''), [error, setError] = useState('');
    const picker = useRef<HTMLInputElement>(null);
    const help = useId(), hint = useId(), field = useId();
    useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
    const choose = async (file: File | undefined) => {
        if (!file || working) return;
        setError(''); setWorking('reading'); setStatus('Preparing the image in your browser…');
        try {
            const next = await prepareCover(file);
            setPrepared(next);
            setStatus(next.soft ? `Ready. At ${next.width} × ${next.height} pixels it may look soft on large screens.` : 'Ready. Give it a short name, then add it.');
        }
        catch (e) { setError(displayError(e)); setStatus(''); }
        finally { setWorking(''); }
    };
    const save = async () => {
        const name = label.trim();
        if (!prepared) return;
        if (!name) { setError('Give the picture a short name.'); return; }
        setError(''); setWorking('saving');
        try {
            setStatus('Uploading the picture privately…');
            const { fileId } = await uploadLibraryPicture(slug, userId, prepared);
            setStatus('Adding it to the library…');
            const r = await command({ type: 'cover.library.add', fileId, label: name }, { onError: setError });
            if (r) onClose(); else setStatus('');
        }
        catch (e) { setError(displayError(e)); setStatus(''); }
        finally { setWorking(''); }
    };
    return <Modal title="Add a library picture" onClose={onClose} wide>
        <div className="form-stack cover-editor">
            <p className="cover-editor-intro" id={help}>Use a JPEG, PNG or WebP picture with no words on it. Your browser resizes it to 1,600 pixels on the longest side before upload, which also removes photo details such as location. Everyone in the community can see library pictures.</p>
            <div className="cover-stage" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void choose(e.dataTransfer.files[0]); }}>
                {prepared ? <div className="cover-stage-frame"><img src={prepared.url} alt="" draggable={false}/></div>
                    : <div className="cover-stage-empty"><ImagePlus size={28} strokeWidth={1.5} aria-hidden="true"/><span>Choose an image or drop one here.</span></div>}
            </div>
            <div className="cover-editor-pick">
                <button type="button" className="button secondary" aria-describedby={help} disabled={!!working} onClick={() => picker.current?.click()}>{working === 'reading' ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Upload size={15} aria-hidden="true"/>}{prepared ? 'Choose another image' : 'Choose an image'}</button>
                <input ref={picker} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void choose(file); }}/>
            </div>
            <div className="cover-library-name">
                <label htmlFor={field}>Name</label>
                <input id={field} value={label} onChange={e => setLabel(e.target.value)} maxLength={80} required aria-describedby={hint} disabled={working === 'saving'}/>
                <small id={hint} className="cover-library-hint">Shown beside the picture when people choose a cover, for example “Harbour at dawn”.</small>
            </div>
            <p className="cover-editor-status" role="status" aria-live="polite">{status}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
                <button type="button" className="button secondary" disabled={working === 'saving'} onClick={onClose}>Cancel</button>
                <button type="button" className="button primary" disabled={!!working || !prepared || !label.trim()} onClick={() => void save()}>{working === 'saving' ? 'Adding…' : 'Add to library'}</button>
            </div>
        </div>
    </Modal>;
}
