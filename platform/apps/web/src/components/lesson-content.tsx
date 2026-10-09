import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, ExternalLink, Image as ImageIcon, LoaderCircle, Play } from 'lucide-react';
import { isLessonDocument, lessonVideoUrl, type LessonDocument, type LessonNode } from '../../../../packages/contracts/src/lesson-document';
import { chapterTime, isLessonVideo, type LessonResource } from '../../../../packages/contracts/src/lesson-resources';
import { Button } from './ui/button';
import { describeResource } from './resource-list';
import { browserStore, clock, rememberPosition, savedPosition } from '../lib/video-position';

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

/**
 * Full-width video at the top of a lesson. An uploaded file plays in place, with any WebVTT captions the lesson carries
 * as tracks, and picks up where this browser last stopped (`resumeKey`); an embed still asks before loading.
 */
export function LessonStage({video,onPlay,onDownload,captions=[],onCaptions,resumeKey}:{video:FeaturedVideo;onPlay:(r:LessonResource)=>Promise<string|undefined>;onDownload:(r:LessonResource)=>Promise<boolean>;captions?:LessonResource[];onCaptions?:(r:LessonResource)=>Promise<string|undefined>;resumeKey?:string}) {
    const [url,setUrl]=useState<string|null>(null), [pending,setPending]=useState(false), [failed,setFailed]=useState(false);
    const [tracks,setTracks]=useState<{id:string;label:string;src:string}[]>([]), [resumed,setResumed]=useState(0), [chapter,setChapter]=useState(0);
    const owned=useRef<string|null>(null), player=useRef<HTMLVideoElement|null>(null), saved=useRef(0), seekTo=useRef<number|null>(null);
    const release=()=>{ if(owned.current) URL.revokeObjectURL(owned.current); owned.current=null; };
    const id=video.kind==='file'?video.resource.id:JSON.stringify(video.node.attrs);
    const captionIds=captions.map(c=>c.id).join(',');
    // A new lesson starts from its own poster, and a browser-local preview address is freed once it is no longer shown.
    useEffect(()=>{ setUrl(null); setFailed(false); setResumed(0); setChapter(0); seekTo.current=null; return release; },[id]);
    // Captions load once the video does, and their browser-local addresses are freed with it.
    useEffect(()=>{
        if(!url||!onCaptions||!captions.length) return;
        let live=true; const made:string[]=[];
        void Promise.all(captions.map(async c=>{ const src=await onCaptions(c); if(src) made.push(src); return src?{id:c.id,label:c.name.replace(/\.vtt$/i,''),src}:null; })).then(list=>{ if(live) setTracks(list.filter((x):x is {id:string;label:string;src:string}=>!!x)); else made.forEach(u=>URL.revokeObjectURL(u)); });
        return ()=>{ live=false; made.forEach(u=>URL.revokeObjectURL(u)); setTracks([]); };
    },[url,captionIds]);
    if(video.kind==='embed') return <ExternalMedia key={id} node={video.node} stage/>;
    const r=video.resource, chapters=r.chapters??[];
    const play=async()=>{ setPending(true); setFailed(false); try { const u=await onPlay(r); if(!u) return; release(); if(u.startsWith('blob:')) owned.current=u; setUrl(u); } finally { setPending(false); } };
    // A chapter chosen before the video loaded wins over picking up where this browser stopped.
    const loaded=()=>{ const v=player.current; if(v&&seekTo.current!==null){ v.currentTime=seekTo.current; seekTo.current=null; return; } const at=v&&resumeKey?savedPosition(browserStore(),resumeKey,v.duration):0; if(v&&at){ v.currentTime=at; setResumed(at); } };
    const jump=async(start:number)=>{ const v=player.current; setResumed(0); if(v){ v.currentTime=start; void v.play().catch(()=>undefined); return; } seekTo.current=start; await play(); };
    const progress=()=>{ const v=player.current; if(!v) return; const now=chapters.reduce((at,c,i)=>c.start<=v.currentTime?i:at,0); if(now!==chapter) setChapter(now); if(!resumeKey) return; if(Math.abs(v.currentTime-saved.current)>=5){ saved.current=v.currentTime; rememberPosition(browserStore(),resumeKey,v.currentTime); } };
    const restart=()=>{ const v=player.current; if(v) v.currentTime=0; if(resumeKey) rememberPosition(browserStore(),resumeKey,null); setResumed(0); };
    return <figure className="lesson-media lesson-stage">
        {url?<video ref={player} src={url} controls autoPlay playsInline aria-label={r.name} onLoadedMetadata={loaded} onTimeUpdate={progress} onPause={()=>{ const v=player.current; if(v&&resumeKey) rememberPosition(browserStore(),resumeKey,v.currentTime); }} onEnded={()=>{ if(resumeKey) rememberPosition(browserStore(),resumeKey,null); }} onError={()=>{ release(); setUrl(null); setFailed(true); }}>
            {tracks.map((c,i)=><track key={c.id} kind="captions" label={c.label} src={c.src} default={i===0}/>)}
        </video>:<div className="lesson-stage-poster">
            <Button variant="default" className="lesson-stage-play" aria-label={`Play ${r.name}`} disabled={pending} onClick={play}>{pending?<LoaderCircle size={22} className="spin" aria-hidden="true"/>:<Play size={22} aria-hidden="true"/>}</Button>
            <strong>{r.name}</strong><span>{describeResource(r)}{captions.length?' · Captions available':''}{chapters.length?` · ${chapters.length} chapters`:''}</span>{failed&&<span role="alert">The video stopped loading. Its link may have expired; press play to try again.</span>}
        </div>}
        {chapters.length>0&&<nav className="lesson-chapters" aria-label={`Chapters in ${r.name}`}><ol>{chapters.map((c,i)=><li key={c.start}><button type="button" aria-current={url&&i===chapter?'step':undefined} disabled={pending} onClick={()=>jump(c.start)}><span>{chapterTime(c.start)}</span>{c.title}</button></li>)}</ol></nav>}
        {url&&resumed>0&&<p className="lesson-resume" role="status">Picked up at {clock(resumed)}, where you stopped on this device. <button type="button" className="text-link" onClick={restart}>Start from the beginning</button></p>}
        <figcaption>{r.description||r.name}<button type="button" className="text-link" aria-label={`Download ${r.name}`} disabled={pending} onClick={async()=>{ setPending(true); try { await onDownload(r); } finally { setPending(false); } }}><Download size={13} aria-hidden="true"/>Download</button></figcaption>
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
