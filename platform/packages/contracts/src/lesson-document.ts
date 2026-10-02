import { z } from 'zod';

export interface LessonNode {
    type: string;
    text?: string;
    attrs?: Record<string, string | number | null>;
    marks?: {type: string; attrs?: Record<string, string | null>}[];
    content?: LessonNode[];
}
export interface LessonDocument { type: 'doc'; content: LessonNode[] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
export function lessonHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2000) return false;
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}
/** No arbitrary iframe URLs, query options, autoplay or pasted embed HTML. */
export function lessonVideoUrl(value: string): string | null {
    if (!lessonHttpsUrl(value)) return null;
    const u = new URL(value);
    if (u.port) return null;
    let id: string | null = null;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) {
        id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(?:embed|shorts)\/([\w-]{11})$/.exec(u.pathname)?.[1] ?? null;
    } else if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
    else if (u.hostname === 'www.youtube-nocookie.com') id = /^\/embed\/([\w-]{11})$/.exec(u.pathname)?.[1] ?? null;
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(u.hostname)) {
        const match = /^\/(?:video\/)?([0-9]{1,12})$/.exec(u.pathname);
        if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
    return null;
}
const inline = ['text', 'hardBreak'];
const block = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'codeBlock', 'horizontalRule', 'image', 'video'];
/** Bounded, strict schema shared by API, demo and renderer. Never accept arbitrary HTML. */
export function isLessonDocument(value: unknown): value is LessonDocument {
    if (!record(value) || value.type !== 'doc' || !keys(value, ['type','content']) || !Array.isArray(value.content) || !value.content.length) return false;
    let count = 0;
    const queue: {node: unknown; parent: string; depth: number}[] = value.content.map(node => ({node,parent:'doc',depth:1}));
    while (queue.length) {
        const {node:n,parent,depth} = queue.pop()!;
        if (++count > 600 || depth > 8 || !record(n) || typeof n.type !== 'string' || !keys(n,['type','attrs','content','text','marks'])) return false;
        const type = n.type;
        const allowed = ['paragraph','heading'].includes(parent) ? inline : parent === 'codeBlock' ? ['text'] : ['bulletList','orderedList'].includes(parent) ? ['listItem'] : block;
        if (!allowed.includes(type)) return false;
        const attrs = n.attrs === undefined ? {} : n.attrs;
        if (!record(attrs)) return false;
        if (type === 'heading') { if (!keys(attrs,['level']) || ![2,3].includes(attrs.level as number)) return false; }
        else if (type === 'orderedList') { if (!keys(attrs,['start','type']) || (attrs.start !== undefined && (!Number.isInteger(attrs.start) || Number(attrs.start)<1 || Number(attrs.start)>10000)) || (attrs.type != null && attrs.type !== '1')) return false; }
        else if (type === 'codeBlock') { if (!keys(attrs,['language']) || (attrs.language != null && attrs.language !== '')) return false; }
        else if (type === 'image') { if (!keys(attrs,['src','alt']) || !lessonHttpsUrl(attrs.src) || typeof attrs.alt !== 'string' || !attrs.alt.trim() || attrs.alt.length>500) return false; }
        else if (type === 'video') { if (!keys(attrs,['src','title']) || typeof attrs.src !== 'string' || lessonVideoUrl(attrs.src)!==attrs.src || typeof attrs.title !== 'string' || !attrs.title.trim() || attrs.title.length>240) return false; }
        else if (Object.keys(attrs).length) return false;
        if (type === 'text') {
            if (typeof n.text !== 'string' || !n.text.length || n.text.length>20000 || n.content !== undefined || n.attrs !== undefined) return false;
            if (n.marks !== undefined) {
                if (parent === 'codeBlock' || !Array.isArray(n.marks) || n.marks.length>6) return false;
                const seen = new Set<string>();
                for (const m of n.marks) {
                    if (!record(m) || !keys(m,['type','attrs']) || typeof m.type!=='string' || seen.has(m.type)) return false;
                    seen.add(m.type);
                    if (m.type==='link') {
                        if (!record(m.attrs) || !keys(m.attrs,['href','target','rel','class']) || !lessonHttpsUrl(m.attrs.href) || ![undefined,null,'_blank'].includes(m.attrs.target as never) || ![undefined,null,'noopener noreferrer','noopener noreferrer nofollow'].includes(m.attrs.rel as never) || m.attrs.class!=null) return false;
                    } else if (!['bold','italic','underline','strike','code'].includes(m.type) || m.attrs !== undefined) return false;
                }
            }
        } else if (n.text!==undefined || n.marks!==undefined) return false;
        if (['text','hardBreak','horizontalRule','image','video'].includes(type)) { if(n.content!==undefined) return false; }
        else {
            const children = n.content ?? [];
            if (!Array.isArray(children) || children.length>600 || (['bulletList','orderedList','listItem','blockquote'].includes(type)&&!children.length)) return false;
            if (type==='listItem' && (!record(children[0]) || children[0].type!=='paragraph')) return false;
            for (const node of children) queue.push({node,parent:type,depth:depth+1});
        }
    }
    return new TextEncoder().encode(JSON.stringify(value)).length<=28000 && lessonDocumentText(value as unknown as LessonDocument).length<=20000;
}
export const lessonDocumentSchema = z.custom<LessonDocument>(isLessonDocument, 'Use supported lesson blocks, HTTPS links and a document under 28 KB.');
export function lessonDocumentText(doc: LessonDocument): string {
    const text = (n: LessonNode): string => {
        if(n.type==='text') return n.text ?? '';
        if(n.type==='hardBreak') return '\n';
        if(n.type==='image') return String(n.attrs?.alt ?? '');
        if(n.type==='video') return String(n.attrs?.title ?? '');
        return (n.content ?? []).map(text).join(['doc','blockquote','listItem','bulletList','orderedList'].includes(n.type)?'\n\n':'');
    };
    return text(doc).trim();
}
/** Use JSON text nodes so legacy angle brackets remain literal text. */
export function plainLessonDocument(body: string): LessonDocument {
    return {type:'doc',content:body.split(/\n\s*\n/).map(p=>({type:'paragraph',...(p?{content:[{type:'text',text:p}]}:{})}))};
}
