import { Avatar as AvatarRoot, AvatarImage, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { mode } from '../lib/data';
import { demoPortraits } from '../lib/portraits';
import { useEffect, useRef, type ReactNode } from 'react';
import { UserRound, X, Lock, ArrowLeft, Check, Inbox, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Member, Track, Project } from '../../../../packages/contracts/src/index';
export function Mark({size=27}:{size?:number}) {return <span className="brand-mark" style={{width:size,height:size,fontSize:size*.67}} aria-hidden="true">R</span>;}
export function Avatar({member,size='md'}:{member?:Member;size?:'xs'|'sm'|'md'|'lg'|'xl'}) {
 // A former member has no photo: their account is gone, and demo portraits never stand in for one.
 const photo=member?.status==='left'?undefined:member?.avatar || (mode==='demo'&&member?demoPortraits[member.userId]:undefined);
 return <AvatarRoot role="img" className={`avatar avatar-${size}`} aria-label={member?.name||'Member'}>
  {photo&&<AvatarImage src={photo} alt=""/>}<AvatarFallback><UserRound size={size==='xs'?12:18}/></AvatarFallback>
 </AvatarRoot>;
}
/** A person's name, linking to their profile. A former member's name is plain text: there is no profile to open. */
export function PersonLink({ member, fallback = 'Community member', children }: { member?: Member; fallback?: string; children?: ReactNode }) {
    if (!member) return <span>{fallback}</span>;
    if (member.status === 'left') return <span className="former-member">{member.name}</span>;
    return <Link to={`/members/${member.userId}`}>{children ?? member.name}</Link>;
}
/** People who are here now: directories, pickers and avatar rows leave former members out. */
export const present = (members: Member[]) => members.filter(m => m.status !== 'left');
export function AvatarStack({ members, limit = 4 }: {
    members: Member[];
    limit?: number;
}) { return <span className="avatar-stack">{members.slice(0, limit).map(m => <Avatar key={m.id} member={m} size="xs"/>)}{members.length > limit && <span className="avatar avatar-xs stack-extra">+{members.length - limit}</span>}</span>; }
export function Pill({ children, tone = 'neutral' }: {
    children: ReactNode;
    tone?: string;
}) { return <span className={`pill tone-${tone}`}>{children}</span>; }
/**
 * Nothing to show yet, or nothing matches. Choose an icon for the context and offer a next action only when this
 * viewer's role actually permits it. Conventions: platform/docs/STATES.md.
 */
export function Empty({ title, body, action, icon: Icon = Inbox }: {
    title: string;
    body: string;
    action?: ReactNode;
    icon?: LucideIcon;
}) { return <div className="empty-state"><div className="empty-icon" aria-hidden="true"><Icon size={25}/></div><h3>{title}</h3><p>{body}</p>{action && <div className="empty-actions">{action}</div>}</div>; }
export function PageHeading({ eyebrow, title, body, action }: {
    eyebrow?: string;
    title: string;
    body?: string;
    action?: ReactNode;
}) { return <header className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{body && <p>{body}</p>}</div>{action}</header>; }
export function Modal({ title, children, onClose, wide = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const d = ref.current; const prior = document.activeElement as HTMLElement; d?.showModal(); return () => { d?.close(); prior?.focus?.(); }; }, []);
    return <dialog ref={ref} data-slot="dialog-content" className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) {
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            onClose();
    } }}><div className="modal-head" data-slot="dialog-header"><h2 id="modal-title" data-slot="dialog-title">{title}</h2><Button type="button" variant="ghost" size="icon" className="icon-button" aria-label="Close dialogue" onClick={onClose}><X size={20}/></Button></div>{children}</dialog>;
}
export function Back({ to, label }: {
    to: string;
    label: string;
}) { return <Link to={to} className="back-link"><ArrowLeft size={15}/>{label}</Link>; }
export function CheckList({ items }: {
    items: string[];
}) { return <ul className="check-list">{items.map(x => <li key={x}><Check size={15}/><span>{x}</span></li>)}</ul>; }
export const date = (value: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', ...opts }).format(new Date(value));
export const dayParts = (value: string) => ({ day: date(value, { day: '2-digit' }), month: date(value, { month: 'short' }).toUpperCase() });
export function RelativeTime({ value }: {
    value: string;
}) { const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return <time dateTime={value}>{mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : date(value)}</time>; }
