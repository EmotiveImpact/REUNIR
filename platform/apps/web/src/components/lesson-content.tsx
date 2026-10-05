import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, ExternalLink, Image as ImageIcon, LoaderCircle, Play } from 'lucide-react';
import { isLessonDocument, lessonVideoUrl, type LessonDocument, type LessonNode } from '../../../../packages/contracts/src/lesson-document';
import { isLessonVideo, type LessonResource } from '../../../../packages/contracts/src/lesson-resources';
import { Button } from './ui/button';
import { describeResource } from './resource-list';

function ExternalMedia({node,stage=false}:{node:LessonNode;stage?:boolean}) {
    const [loaded,load] = useState(false);
    const src=String(node.attrs?.src), title=String(node.attrs?.alt ?? node.attrs?.title), video=node.type==='video';
    return <figure className={stage?'lesson-media lesson-stage':'lesson-media'}>
        {loaded ? video ? <iframe src={lessonVideoUrl(src)!} title={title} sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" allow="fullscreen; picture-in-picture" allowFullScreen/> : <img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer"/> : <div className="lesson-media-consent">{video?<Play size={24}/>:<ImageIcon size={24}/>}<strong>{title}</strong><span>Load from {new URL(src).hostname}. This shares your IP address with the provider.</span><Button variant="outline" onClick={()=>load(true)}>Load {video?'video':'image'}</Button></div>}
        <figcaption>{title} <a href={src} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={13}/></a></figcaption>
    </figure>;
}
/** The video a lesson leads with: its first uploaded video file, otherwise its first embedded video. */
export type FeaturedVideo = {kind:'file';resource:LessonResource}|{kind:'embed';node:LessonNode};
export function featuredVideo(lesson:{resources?:LessonResource[]|null;richBody?:LessonDocument|null}):FeaturedVideo|null {
    const file=(lesson.resources??[]).find(r=>isLessonVideo(r.contentType));
    if(file) return {kind:'file',resource:file};
    const node=lesson.richBody&&isLessonDocument(lesson.richBody)?lesson.richBody.content.find(n=>n.type==='video'):undefined;
    return node?{kind:'embed',node}:null;
}

/** Full-width video at the top of a lesson. An uploaded file plays in place; an embed still asks before loading. */
export function LessonStage({video,onPlay,onDownload}:{video:FeaturedVideo;onPlay:(r:LessonResource)=>Promise<string|undefined>;onDownload:(r:LessonResource)=>Promise<boolean>}) {
    const [url,setUrl]=useState<string|null>(null), [pending,setPending]=useState(false);
    const owned=useRef<string|null>(null);
    const release=()=>{ if(owned.current) URL.revokeObjectURL(owned.current); owned.current=null; };
    const id=video.kind==='file'?video.resource.id:JSON.stringify(video.node.attrs);
    // A new lesson starts from its own poster, and a browser-local preview address is freed once it is no longer shown.
    useEffect(()=>{ setUrl(null); return release; },[id]);
    if(video.kind==='embed') return <ExternalMedia key={id} node={video.node} stage/>;
    const r=video.resource;
    const play=async()=>{ setPending(true); try { const u=await onPlay(r); if(!u) return; release(); if(u.startsWith('blob:')) owned.current=u; setUrl(u); } finally { setPending(false); } };
    return <figure className="lesson-media lesson-stage">
        {url?<video src={url} controls autoPlay playsInline aria-label={r.name}/>:<div className="lesson-stage-poster">
            <Button variant="default" className="lesson-stage-play" aria-label={`Play ${r.name}`} disabled={pending} onClick={play}>{pending?<LoaderCircle size={22} className="spin" aria-hidden="true"/>:<Play size={22} aria-hidden="true"/>}</Button>
            <strong>{r.name}</strong><span>{describeResource(r)}</span>
        </div>}
        <figcaption>{r.description||r.name}<button type="button" className="text-link" disabled={pending} onClick={async()=>{ setPending(true); try { await onDownload(r); } finally { setPending(false); } }}><Download size={13} aria-hidden="true"/>Download</button></figcaption>
    </figure>;
}

/** A plain paragraph that opens with "Try this" or "Your task" becomes a small practice prompt. */
const TRY=/^(Try this|Your task)[:.]?\s+/;
function PlainParagraph({text}:{text:string}) {
    const m=TRY.exec(text);
    if(!m) return <p>{text}</p>;
    return <aside className="lesson-try"><strong>{m[1]}</strong><p>{text.replace(TRY,'')}</p></aside>;
}

/** Render only validated JSON via React elements. Raw HTML is always text. `skip` leaves out the video already shown on the stage. */
export function LessonBody({body,richBody,skip}:{body:string;richBody?:LessonDocument|null;skip?:LessonNode}) {
    if(!richBody||!isLessonDocument(richBody)) return <div className="lesson-body">{body.split(/\n\s*\n/).map((p,i)=><PlainParagraph key={i} text={p}/>)}</div>;
    const render=(n:LessonNode,key:string):ReactNode=>{
        const children=n.content?.map((c,i)=>render(c,`${key}.${i}`));
        if(n.type==='text') {
            let text:ReactNode=n.text;
            for(const m of n.marks??[]) {
                if(m.type==='bold')text=<strong>{text}</strong>;
                if(m.type==='italic')text=<em>{text}</em>;
                if(m.type==='underline')text=<u>{text}</u>;
                if(m.type==='strike')text=<s>{text}</s>;
                if(m.type==='code')text=<code>{text}</code>;
                if(m.type==='link')text=<a href={String(m.attrs?.href)} target="_blank" rel="noopener noreferrer">{text}</a>;
            }
            return <Fragment key={key}>{text}</Fragment>;
        }
        switch(n.type) {
            case 'paragraph': {
                const first=n.content?.[0];
                const m=first?.type==='text'&&!first.marks?.length?TRY.exec(first.text??''):null;
                if(m) return <aside key={key} className="lesson-try"><strong>{m[1]}</strong><p>{first!.text!.replace(TRY,'')}{children?.slice(1)}</p></aside>;
                return <p key={key}>{children?.length?children:<br/>}</p>;
            }
            case 'heading':return n.attrs?.level===2?<h2 key={key}>{children}</h2>:<h3 key={key}>{children}</h3>;
            case 'bulletList':return <ul key={key}>{children}</ul>;
            case 'orderedList':return <ol key={key} start={Number(n.attrs?.start??1)}>{children}</ol>;
            case 'listItem':return <li key={key}>{children}</li>;
            case 'blockquote':return <blockquote key={key}>{children}</blockquote>;
            case 'codeBlock':return <pre key={key}><code>{children}</code></pre>;
            case 'horizontalRule':return <hr key={key}/>;
            case 'hardBreak':return <br key={key}/>;
            case 'image':case 'video':return <ExternalMedia key={key+JSON.stringify(n.attrs)} node={n}/>;
            default:return null;
        }
    };
    return <div className="lesson-body rich-lesson">{richBody.content.map((n,i)=>n===skip?null:render(n,String(i)))}</div>;
}
