import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, Lock, Pencil, Plus, Star, StarOff, Trash2 } from 'lucide-react';
import { useWorkspace } from '../lib/context';
import { Back, Empty, Modal, PageHeading, Pill } from '../components/ui';
import { collectableContent, curates, itemTarget, resolveItem, type CollectedContent } from '../../../../packages/domain/src/collections';
import { COLLECTION_ITEM_KINDS, COLLECTION_KIND_LABELS, type CollectionItemKind } from '../../../../packages/contracts/src/collections';
import type { Collection, CollectionItem, Workspace } from '../../../../packages/contracts/src/index';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { NativeSelect } from '../components/ui/native-select';
import { Textarea } from '../components/ui/textarea';

/** Items this person can see, in the curator's order, with the content they point at. */
export function collectionEntries(data: Workspace, c: Collection): { item: CollectionItem; content: CollectedContent }[] {
    return (data.collectionItems ?? []).filter(i => i.collectionId === c.id).sort((a, b) => a.position - b.position)
        .flatMap(item => { const content = resolveItem(data, item); return content ? [{ item, content }] : []; });
}
/** Featured first, then published, newest first, then the team's drafts. */
const ordered = (xs: Collection[]) => [...xs].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.status === 'published') - Number(a.status === 'published') || (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));

function Status({ c }: { c: Collection }) {
    return <>{c.status === 'draft' && <Pill>Draft</Pill>}{c.featured && <Pill>On Home</Pill>}</>;
}
function Entry({ content, item, team }: { content: CollectedContent; item: CollectionItem; team: boolean }) {
    return <Link className="collection-entry" to={content.href}>
        <small>{COLLECTION_KIND_LABELS[item.kind]}</small>
        <strong>{content.title}</strong>
        {item.note && <span className="collection-note">{item.note}</span>}
        {team && content.restricted && <span className="collection-restricted"><Lock size={12}/>Only people with access to {content.restricted} see this</span>}
        {team && content.draft && <span className="collection-restricted"><EyeOff size={12}/>Hidden or unpublished, so members do not see it</span>}
    </Link>;
}

export function CollectionsPage() {
    const { data, me } = useWorkspace(); const [create, C] = useState(false); const team = curates(me);
    const list = ordered(data.collections ?? []);
    return <><PageHeading eyebrow="CHOSEN BY YOUR COMMUNITY TEAM" title="Useful collections." body="Conversations, lessons, paths and work the community team thinks are worth your time. You see only what you already have access to." action={team ? <Button variant="default" className="button primary" onClick={() => C(true)}><Plus size={16}/>New collection</Button> : undefined}/>
        <div className="collection-list">{list.map(c => { const entries = collectionEntries(data, c); return <section className="panel collection-card" key={c.id} aria-labelledby={`collection-${c.id}`}>
            <header><h2 id={`collection-${c.id}`}><Link to={`/collections/${c.id}`}>{c.title}</Link></h2><Status c={c}/></header>
            {c.description && <p>{c.description}</p>}
            <ol className="collection-entries">{entries.slice(0, 4).map(e => <li key={e.item.id}><Entry {...e} team={team}/></li>)}</ol>
            <Link className="text-link" to={`/collections/${c.id}`}>{team ? 'Open and manage' : 'Open collection'} · {entries.length} {entries.length === 1 ? 'item' : 'items'} <ArrowRight size={14}/></Link>
        </section>; })}</div>
        {!list.length && <Empty title="Nothing collected yet." body={team ? 'Start a collection, add a few useful things and publish it when it is ready.' : 'The community team has not published a collection yet.'}/>}
        {create && <DetailsModal onClose={() => C(false)}/>}
    </>;
}

export function CollectionPage() {
    const { id } = useParams(); const { data, me, command, busy } = useWorkspace();
    const [edit, E] = useState(false), [add, A] = useState(false), [note, N] = useState<CollectionItem | null>(null), [remove, R] = useState(false);
    const c = (data.collections ?? []).find(x => x.id === id);
    if (!c) return <><Back to="/collections" label="All collections"/><Empty title="This collection is not available." body="It may still be a draft, or hold nothing you have access to."/></>;
    const team = curates(me), entries = collectionEntries(data, c);
    const move = (i: number, d: -1 | 1) => { const ids = entries.map(e => e.item.id), next = [...ids]; [next[i], next[i + d]] = [next[i + d], next[i]]; void command({ type: 'collection.items.reorder', collectionId: c.id, expectedOrder: ids, itemIds: next }); };
    return <><Back to="/collections" label="All collections"/>
        <PageHeading eyebrow={c.status === 'draft' ? 'DRAFT · ONLY THE COMMUNITY TEAM SEES THIS' : c.featured ? 'COLLECTION · ON HOME' : 'COLLECTION'} title={c.title} body={c.description}/>
        {team && <div className="collection-actions" role="group" aria-label="Manage this collection">
            <Button variant="secondary" size="sm" className="button secondary compact" onClick={() => E(true)}><Pencil size={15}/>Edit details</Button>
            <Button variant="secondary" size="sm" className="button secondary compact" onClick={() => A(true)}><Plus size={15}/>Add an item</Button>
            <Button variant="default" size="sm" className="button primary compact" disabled={busy} onClick={() => command({ type: 'collection.publish', collectionId: c.id, published: c.status !== 'published' })}>{c.status === 'published' ? <><EyeOff size={15}/>Return to draft</> : <><Eye size={15}/>Publish</>}</Button>
            {c.status === 'published' && <Button variant="secondary" size="sm" className="button secondary compact" disabled={busy} onClick={() => command({ type: 'collection.feature', collectionId: c.id, featured: !c.featured })}>{c.featured ? <><StarOff size={15}/>Remove from Home</> : <><Star size={15}/>Feature on Home</>}</Button>}
            <Button variant="ghost" size="sm" className="button ghost compact" onClick={() => R(true)}><Trash2 size={15}/>Delete</Button>
        </div>}
        {team && <p className="sample-note collection-help">Each person sees only the items they already have access to. Drafts stay with the community team until you publish them.</p>}
        <ol className="collection-entries collection-detail">{entries.map((e, i) => <li key={e.item.id}><Entry {...e} team={team}/>
            {team && <div className="collection-item-tools">
                <button className="icon-button" aria-label={`Move ${e.content.title} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp size={16}/></button>
                <button className="icon-button" aria-label={`Move ${e.content.title} down`} disabled={busy || i === entries.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16}/></button>
                <button className="icon-button" aria-label={`Edit the note for ${e.content.title}`} disabled={busy} onClick={() => N(e.item)}><Pencil size={16}/></button>
                <button className="icon-button" aria-label={`Remove ${e.content.title} from the collection`} disabled={busy} onClick={() => command({ type: 'collection.item.remove', itemId: e.item.id })}><Trash2 size={16}/></button>
            </div>}
        </li>)}</ol>
        {!entries.length && <Empty title="Nothing here yet." body={team ? 'Add a conversation, lesson, path or piece of work people will find useful.' : 'Nothing in this collection is available to you.'}/>}
        {edit && <DetailsModal collection={c} onClose={() => E(false)}/>}
        {add && <AddItemModal collection={c} onClose={() => A(false)}/>}
        {note && <NoteModal item={note} title={resolveItem(data, note)?.title ?? 'this item'} onClose={() => N(null)}/>}
        {remove && <DeleteModal collection={c} onClose={() => R(false)}/>}
    </>;
}

function DetailsModal({ collection, onClose }: { collection?: Collection; onClose: () => void }) {
    const { command, busy } = useWorkspace(); const navigate = useNavigate();
    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        const r = await command({ type: 'collection.save', ...(collection ? { collectionId: collection.id } : {}), title: String(f.get('title') || ''), description: String(f.get('description') || '') });
        if (r) { onClose(); if (!collection && r.objectId) navigate(`/collections/${r.objectId}`); }
    };
    return <Modal title={collection ? 'Edit collection' : 'New collection'} onClose={onClose}><form className="form-stack" onSubmit={submit}>
        <Label>Title<Input name="title" required maxLength={80} defaultValue={collection?.title ?? ''} placeholder="Start here"/></Label>
        <Label>Short description<Textarea name="description" maxLength={280} defaultValue={collection?.description ?? ''} placeholder="What people will find here, in a sentence."/></Label>
        {!collection && <p className="sample-note">A new collection is a draft. Only owners, administrators and moderators see it until it is published.</p>}
        <Button variant="default" className="button primary" disabled={busy}>{collection ? 'Save collection' : 'Create draft collection'}</Button>
    </form></Modal>;
}

function AddItemModal({ collection, onClose }: { collection: Collection; onClose: () => void }) {
    const { data, command, busy } = useWorkspace(); const [kind, K] = useState<CollectionItemKind>('post');
    const already = new Set((data.collectionItems ?? []).filter(i => i.collectionId === collection.id && i.kind === kind).map(itemTarget));
    const options = collectableContent(data, kind).filter(x => !already.has(x.id));
    const submit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        const r = await command({ type: 'collection.item.add', collectionId: collection.id, kind, targetId: String(f.get('targetId') || ''), note: String(f.get('note') || '') });
        if (r) onClose();
    };
    return <Modal title={`Add to ${collection.title}`} onClose={onClose}><form className="form-stack" onSubmit={submit}>
        <Label>Kind of content<NativeSelect value={kind} onChange={e => K(e.target.value as CollectionItemKind)}>{COLLECTION_ITEM_KINDS.map(k => <option key={k} value={k}>{COLLECTION_KIND_LABELS[k]}</option>)}</NativeSelect></Label>
        <Label>Item<NativeSelect name="targetId" required key={kind} disabled={!options.length}>{options.map(o => <option key={o.id} value={o.id}>{o.title}{o.restricted ? ` (private: ${o.restricted})` : ''}</option>)}</NativeSelect></Label>
        {!options.length && <p className="sample-note" role="status">Nothing of this kind is available to add.</p>}
        <Label>Note for members (optional)<Textarea name="note" maxLength={280} placeholder="Why it is worth their time."/></Label>
        <p className="sample-note">Only live content you can see can be added. Members see an item only if they already have access to it.</p>
        <Button variant="default" className="button primary" disabled={busy || !options.length}>Add to collection</Button>
    </form></Modal>;
}

function NoteModal({ item, title, onClose }: { item: CollectionItem; title: string; onClose: () => void }) {
    const { command, busy } = useWorkspace();
    const submit = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const r = await command({ type: 'collection.item.note', itemId: item.id, note: String(new FormData(e.currentTarget).get('note') || '') }); if (r) onClose(); };
    return <Modal title="Curator’s note" onClose={onClose}><form className="form-stack" onSubmit={submit}>
        <Label>Note for {title}<Textarea name="note" maxLength={280} defaultValue={item.note}/></Label>
        <Button variant="default" className="button primary" disabled={busy}>Save note</Button>
    </form></Modal>;
}

function DeleteModal({ collection, onClose }: { collection: Collection; onClose: () => void }) {
    const { command, busy } = useWorkspace(); const navigate = useNavigate();
    const confirm = async () => { const r = await command({ type: 'collection.delete', collectionId: collection.id }); if (r) { onClose(); navigate('/collections'); } };
    return <Modal title="Delete this collection?" onClose={onClose}><div className="form-stack">
        <p>{collection.title} and its notes will be removed. The conversations, lessons and other content stay exactly where they are.</p>
        <div className="modal-actions"><Button variant="secondary" className="button secondary" onClick={onClose}>Keep it</Button><Button variant="default" className="button primary" disabled={busy} onClick={confirm}>Delete collection</Button></div>
    </div></Modal>;
}
