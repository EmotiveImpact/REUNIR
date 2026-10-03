import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { resolveItem } from '../../../../packages/domain/src/collections';
import { COLLECTION_KIND_LABELS } from '../../../../packages/contracts/src/collections';

/** Home's compact view of the featured collection: its first few items this person can see, or nothing at all. */
export function FeaturedCollection() {
    const { data } = useWorkspace();
    const c = (data.collections ?? []).find(x => x.featured && x.status === 'published');
    if (!c) return null;
    const entries = (data.collectionItems ?? []).filter(i => i.collectionId === c.id).sort((a, b) => a.position - b.position)
        .flatMap(item => { const content = resolveItem(data, item); return content && !content.draft ? [{ item, content }] : []; }).slice(0, 4);
    if (!entries.length) return null;
    return <section className="panel featured-collection" aria-labelledby="featured-collection-title">
        <div className="featured-collection-head"><span className="eyebrow">CHOSEN BY YOUR COMMUNITY TEAM</span><h2 id="featured-collection-title">{c.title}</h2>{c.description && <p>{c.description}</p>}<Link className="text-link" to={`/collections/${c.id}`}>See the whole collection <ArrowUpRight size={14}/></Link></div>
        <ol className="featured-collection-items">{entries.map(({ item, content }) => <li key={item.id}><Link to={content.href}><small>{COLLECTION_KIND_LABELS[item.kind]}</small><strong>{content.title}</strong></Link></li>)}</ol>
    </section>;
}
