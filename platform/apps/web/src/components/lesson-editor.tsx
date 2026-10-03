import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Code, Minus, Link, Unlink, Undo2, Redo2, Image, Video } from 'lucide-react';
import { lessonDocumentText, lessonHttpsUrl, lessonVideoUrl, plainLessonDocument, type LessonDocument } from '../../../../packages/contracts/src/lesson-document';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Media stays a labelled, non-fetching block while writing. Preview/learner rendering
// asks for a click before contacting the external host. Pasted HTML cannot add media.
const ImageBlock=Node.create({name:'image',group:'block',atom:true,addAttributes(){return {src:{default:''},alt:{default:''}};},parseHTML(){return [];},renderHTML({node}){return ['div',{'data-lesson-media':'image',class:'editor-media-block'},`Image · ${node.attrs.alt}`];}});
const VideoBlock=Node.create({name:'video',group:'block',atom:true,addAttributes(){return {src:{default:''},title:{default:''}};},parseHTML(){return [];},renderHTML({node}){return ['div',{'data-lesson-media':'video',class:'editor-media-block'},`Video · ${node.attrs.title}`];}});

export function LessonEditor({body,richBody,disabled,onChange}:{body:string;richBody?:LessonDocument|null;disabled:boolean;onChange:(doc:LessonDocument,text:string)=>void}) {
    const callback=useRef(onChange);callback.current=onChange;
    const [insert,setInsert]=useState<'link'|'image'|'video'|null>(null),[url,setUrl]=useState(''),[label,setLabel]=useState(''),[error,setError]=useState('');
    const editor=useEditor({
        extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:false,linkOnPaste:false,protocols:['https'],isAllowedUri:href=>lessonHttpsUrl(href)},codeBlock:{defaultLanguage:null}}),ImageBlock,VideoBlock],
        content:richBody??plainLessonDocument(body),editable:!disabled,
        editorProps:{attributes:{role:'textbox','aria-label':'Lesson body','aria-multiline':'true',class:'rich-lesson lesson-editor-body'}},
        onUpdate:({editor})=>{const doc=editor.getJSON() as LessonDocument;callback.current(doc,lessonDocumentText(doc));},
        shouldRerenderOnTransaction:true,
    });
    useEffect(()=>{editor?.setEditable(!disabled,false);},[editor,disabled]);
    useEffect(()=>{if(!editor)return;const doc=richBody??plainLessonDocument(body);if(JSON.stringify(editor.getJSON())!==JSON.stringify(doc))editor.commands.setContent(doc,{emitUpdate:false});},[editor,richBody,body]);
    if(!editor)return <p>Opening lesson editor…</p>;
    const tools=[
        {name:'Bold',icon:Bold,active:editor.isActive('bold'),run:()=>editor.chain().focus().toggleBold().run()},
        {name:'Italic',icon:Italic,active:editor.isActive('italic'),run:()=>editor.chain().focus().toggleItalic().run()},
        {name:'Heading 2',icon:Heading2,active:editor.isActive('heading',{level:2}),run:()=>editor.chain().focus().toggleHeading({level:2}).run()},
        {name:'Heading 3',icon:Heading3,active:editor.isActive('heading',{level:3}),run:()=>editor.chain().focus().toggleHeading({level:3}).run()},
        {name:'Bullet list',icon:List,active:editor.isActive('bulletList'),run:()=>editor.chain().focus().toggleBulletList().run()},
        {name:'Numbered list',icon:ListOrdered,active:editor.isActive('orderedList'),run:()=>editor.chain().focus().toggleOrderedList().run()},
        {name:'Quote',icon:Quote,active:editor.isActive('blockquote'),run:()=>editor.chain().focus().toggleBlockquote().run()},
        {name:'Code block',icon:Code,active:editor.isActive('codeBlock'),run:()=>editor.chain().focus().toggleCodeBlock().run()},
        {name:'Divider',icon:Minus,run:()=>editor.chain().focus().setHorizontalRule().run()},
    ];
    const open=(kind:typeof insert)=>{setInsert(kind);setUrl(kind==='link'?editor.getAttributes('link').href??'':'');setLabel('');setError('');};
    const add=()=>{
        if(!lessonHttpsUrl(url)){setError('Enter a complete HTTPS address without credentials.');return;}
        if(insert==='link') {
            if(editor.state.selection.empty&&!editor.isActive('link')){setError('Select the words you want to link first.');return;}
            editor.chain().focus().extendMarkRange('link').setLink({href:url}).run();
        } else {
            if(!label.trim()){setError(insert==='image'?'Describe the image for people who cannot see it.':'Give the video a descriptive title.');return;}
            const src=insert==='video'?lessonVideoUrl(url):url;
            if(!src){setError('Use a YouTube or Vimeo video link.');return;}
            // Append after the current selection instead of replacing a selected media block.
            editor.chain().focus().insertContentAt(editor.state.selection.to,[{type:insert!,attrs:insert==='image'?{src,alt:label.trim()}:{src,title:label.trim()}},{type:'paragraph'}]).run();
        }
        setInsert(null);setError('');
    };
    return <div className="lesson-editor"><div className="lesson-formatting" role="group" aria-label="Lesson formatting">
        {tools.map(t=><Button key={t.name} variant="ghost" size="icon" type="button" aria-label={t.name} title={t.name} aria-pressed={t.active} disabled={disabled} onClick={t.run}><t.icon size={16}/></Button>)}
        <Button variant="ghost" size="icon" type="button" aria-label="Add link" title="Add link" disabled={disabled} onClick={()=>open('link')}><Link size={16}/></Button>
        <Button variant="ghost" size="icon" type="button" aria-label="Remove link" title="Remove link" disabled={disabled||!editor.isActive('link')} onClick={()=>editor.chain().focus().unsetLink().run()}><Unlink size={16}/></Button>
        <Button variant="ghost" size="icon" type="button" aria-label="Add image" title="Add image" disabled={disabled} onClick={()=>open('image')}><Image size={16}/></Button>
        <Button variant="ghost" size="icon" type="button" aria-label="Add video" title="Add video" disabled={disabled} onClick={()=>open('video')}><Video size={16}/></Button>
        <Button variant="ghost" size="icon" type="button" aria-label="Undo" title="Undo" disabled={disabled||!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}><Undo2 size={16}/></Button>
        <Button variant="ghost" size="icon" type="button" aria-label="Redo" title="Redo" disabled={disabled||!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}><Redo2 size={16}/></Button>
    </div>
    {insert&&<div className="lesson-insert"><Label>{insert==='link'?'Link URL':insert==='image'?'Image URL':'Video URL'}<Input type="url" autoFocus value={url} maxLength={2000} disabled={disabled} onChange={e=>setUrl(e.target.value)} placeholder="https://"/></Label>{insert!=='link'&&<Label>{insert==='image'?'Image description':'Video title'}<Input value={label} maxLength={insert==='image'?500:240} disabled={disabled} onChange={e=>setLabel(e.target.value)}/></Label>}<div><Button type="button" disabled={disabled} onClick={add}>Insert {insert}</Button><Button type="button" variant="ghost" onClick={()=>setInsert(null)}>Cancel</Button></div>{error&&<p role="alert">{error}</p>}{insert!=='link'&&<small>Use a public resource you have permission to share. Learners choose when to load external media. Private uploads come later.</small>}</div>}
    <EditorContent editor={editor}/></div>;
}
