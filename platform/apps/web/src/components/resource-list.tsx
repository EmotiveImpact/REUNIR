import { useId, useState } from 'react';
import { Download, FileImage, FileSpreadsheet, FileText, LoaderCircle, Paperclip, Presentation } from 'lucide-react';
import { Button } from './ui/button';
import { formatFileSize, resourceTypeLabel, type LessonResource } from '../../../../packages/contracts/src/lesson-resources';

export function ResourceIcon({ type, size = 18 }: { type: string; size?: number }) {
    if (type.startsWith('image/')) return <FileImage size={size} aria-hidden="true"/>;
    if (type.endsWith('spreadsheetml.sheet')) return <FileSpreadsheet size={size} aria-hidden="true"/>;
    if (type.endsWith('presentationml.presentation')) return <Presentation size={size} aria-hidden="true"/>;
    return <FileText size={size} aria-hidden="true"/>;
}
export const describeResource = (r: { contentType: string; sizeBytes: number }) => `${resourceTypeLabel(r.contentType)} · ${formatFileSize(r.sizeBytes)}`;

/** Read-only list for learners, private preview and revision history. Downloads ask the server each time. */
export function ResourceList({ resources, onDownload, available = () => true, note, compact = false }: {
    resources: LessonResource[]; onDownload: (r: LessonResource) => Promise<boolean>;
    available?: (r: LessonResource) => boolean; note?: string; compact?: boolean;
}) {
    const heading = useId();
    const [pending, setPending] = useState<string | null>(null);
    if (!resources.length) return null;
    return <section className={`lesson-resources${compact ? ' compact' : ''}`} aria-labelledby={heading}>
        <div className="lesson-resources-head"><h3 id={heading}><Paperclip size={16} aria-hidden="true"/>Lesson files</h3><span>{resources.length} {resources.length === 1 ? 'file' : 'files'}</span></div>
        <ul>{resources.map(r => <li key={r.id} className="lesson-resource">
            <span className="resource-icon"><ResourceIcon type={r.contentType}/></span>
            <div className="resource-copy"><strong>{r.name}</strong>{r.description && !compact && <p>{r.description}</p>}<small>{describeResource(r)}</small></div>
            <Button variant="outline" size="sm" aria-label={`Download ${r.name}`} disabled={!!pending || !available(r)} onClick={async () => { setPending(r.id); try { await onDownload(r); } finally { setPending(null); } }}>
                {pending === r.id ? <LoaderCircle size={15} className="spin" aria-hidden="true"/> : <Download size={15} aria-hidden="true"/>}{pending === r.id ? 'Preparing' : 'Download'}
            </Button>
        </li>)}</ul>
        {note && <p className="resource-note">{note}</p>}
    </section>;
}
