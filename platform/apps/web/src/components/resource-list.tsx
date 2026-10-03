import { useEffect, useId, useRef, useState } from 'react';
import { Download, FileImage, FileSpreadsheet, FileText, FileVideo, LoaderCircle, Paperclip, Play, Presentation, X } from 'lucide-react';
import { Button } from './ui/button';
import { formatFileSize, isLessonVideo, resourceTypeLabel, type LessonResource } from '../../../../packages/contracts/src/lesson-resources';

export function ResourceIcon({ type, size = 18 }: { type: string; size?: number }) {
    if (type.startsWith('image/')) return <FileImage size={size} aria-hidden="true"/>;
    if (type.startsWith('video/')) return <FileVideo size={size} aria-hidden="true"/>;
    if (type.endsWith('spreadsheetml.sheet')) return <FileSpreadsheet size={size} aria-hidden="true"/>;
    if (type.endsWith('presentationml.presentation')) return <Presentation size={size} aria-hidden="true"/>;
    return <FileText size={size} aria-hidden="true"/>;
}
export const describeResource = (r: { contentType: string; sizeBytes: number }) => `${resourceTypeLabel(r.contentType)} · ${formatFileSize(r.sizeBytes)}`;

/** Read-only list for learners, private preview and revision history. Downloads and playback ask the server each time. */
export function ResourceList({ resources, onDownload, onPlay, available = () => true, note, compact = false }: {
    resources: LessonResource[]; onDownload: (r: LessonResource) => Promise<boolean>;
    /** Lesson videos play in the page when given; otherwise they download like any other file. */
    onPlay?: (r: LessonResource) => Promise<string | undefined>;
    available?: (r: LessonResource) => boolean; note?: string; compact?: boolean;
}) {
    const heading = useId();
    const [pending, setPending] = useState<string | null>(null);
    const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
    const [failed, setFailed] = useState('');
    const owned = useRef<string | null>(null);
    // Browser-local preview addresses hold the bytes in memory, so each is released once it is no longer shown.
    const release = () => { if (owned.current) URL.revokeObjectURL(owned.current); owned.current = null; };
    useEffect(() => release, []);
    const play = async (r: LessonResource) => {
        setPending(r.id); setFailed('');
        try {
            const url = await onPlay!(r);
            if (!url) return;
            release();
            if (url.startsWith('blob:')) owned.current = url;
            setPlaying({ id: r.id, url });
        } finally { setPending(null); }
    };
    const stop = () => { release(); setPlaying(null); };
    if (!resources.length) return null;
    return <section className={`lesson-resources${compact ? ' compact' : ''}`} aria-labelledby={heading}>
        <div className="lesson-resources-head"><h3 id={heading}><Paperclip size={16} aria-hidden="true"/>Lesson files</h3><span>{resources.length} {resources.length === 1 ? 'file' : 'files'}</span></div>
        <ul>{resources.map(r => <li key={r.id} className="lesson-resource">
            <span className="resource-icon"><ResourceIcon type={r.contentType}/></span>
            <div className="resource-copy"><strong>{r.name}</strong>{r.description && !compact && <p>{r.description}</p>}<small>{describeResource(r)}</small></div>
            {onPlay && isLessonVideo(r.contentType) ? <div className="resource-actions">
                {playing?.id === r.id
                    ? <Button variant="outline" size="sm" aria-label={`Close video ${r.name}`} onClick={stop}><X size={15} aria-hidden="true"/>Close</Button>
                    : <Button variant="outline" size="sm" aria-label={`Play ${r.name}`} disabled={!!pending || !available(r)} onClick={() => play(r)}>
                        {pending === r.id ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Play size={15} aria-hidden="true"/>}{pending === r.id ? 'Preparing' : 'Play'}
                    </Button>}
                <Button variant="ghost" size="sm" aria-label={`Download ${r.name}`} disabled={!!pending || !available(r)} onClick={async () => { setPending(r.id); try { await onDownload(r); } finally { setPending(null); } }}><Download size={15} aria-hidden="true"/>Download</Button>
            </div> : <Button variant="outline" size="sm" aria-label={`Download ${r.name}`} disabled={!!pending || !available(r)} onClick={async () => { setPending(r.id); try { await onDownload(r); } finally { setPending(null); } }}>
                {pending === r.id ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Download size={15} aria-hidden="true"/>}{pending === r.id ? 'Preparing' : 'Download'}
            </Button>}
            {playing?.id === r.id && <video className="resource-video" controls autoPlay preload="metadata" playsInline src={playing.url} aria-label={r.name} onError={() => { stop(); setFailed(`${r.name} could not be played here. Try again, or download it instead.`); }}/>}
        </li>)}</ul>
        {failed && <p className="resource-note" role="alert">{failed}</p>}
        {note && <p className="resource-note">{note}</p>}
    </section>;
}
