import { Fragment, useState, type ReactNode } from 'react';
import { ExternalLink, Image as ImageIcon, Play } from 'lucide-react';
import { isLessonDocument, lessonVideoUrl, type LessonDocument, type LessonNode } from '../../../../packages/contracts/src/lesson-document';
import { Button } from './ui/button';

function ExternalMedia({node}:{node:LessonNode}) {
    const [loaded,load] = useState(false);
    const src=String(node.attrs?.src), title=String(node.attrs?.alt ?? node.attrs?.title), video=node.type==='video';
    return <figure className="lesson-media">
        {loaded ? video ? <iframe src={lessonVideoUrl(src)!} title={title} sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" allow="fullscreen; picture-in-picture" allowFullScreen/> : <img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer"/> : <div className="lesson-media-consent">{video?<Play size={24}/>:<ImageIcon size={24}/>}<strong>{title}</strong><span>Load from {new URL(src).hostname}. This shares your IP address with the provider.</span><Button variant="outline" onClick={()=>load(true)}>Load {video?'video':'image'}</Button></div>}
        <figcaption>{title} <a href={src} target="_blank" rel="noopener noreferrer">Open source <ExternalLink size={13}/></a></figcaption>
    </figure>;
}
/** Render only validated JSON via React elements. Raw HTML is always text. */
export function LessonBody({body,richBody}:{body:string;richBody?:LessonDocument|null}) {
    if(!richBody||!isLessonDocument(richBody)) return <div className="lesson-body">{body.split(/\n\s*\n/).map((p,i)=><p key={i}>{p}</p>)}</div>;
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
            case 'paragraph':return <p key={key}>{children?.length?children:<br/>}</p>;
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
    return <div className="lesson-body rich-lesson">{richBody.content.map((n,i)=>render(n,String(i)))}</div>;
}
