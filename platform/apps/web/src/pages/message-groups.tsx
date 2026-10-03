import {useState} from 'react';
import {LogOut,Search,UserMinus,UserPlus,Users} from 'lucide-react';
import {useWorkspace} from '../lib/context';
import {messageRequest} from '../lib/messaging';
import {displayError} from '../lib/data';
import {Avatar,Modal} from '../components/ui';
import {GROUP_LIMIT,type Conversation} from '../../../../packages/contracts/src/messaging';
import type {Member} from '../../../../packages/contracts/src/index';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function GroupAvatar(){return <span className="avatar avatar-md group-avatar" role="img" aria-label="Group"><Users size={18}/></span>;}

/** Active members other than the viewer, filtered by name or skill, as checkboxes. */
function PeoplePicker({people,picked,onPick,label}:{people:Member[];picked:string[];onPick:(ids:string[])=>void;label:string}){
 const [search,Search_]=useState('');
 const shown=people.filter(m=>(m.name+' '+m.skills.join(' ')).toLowerCase().includes(search.toLowerCase()));
 return <><Label className="inbox-search"><Search size={16}/><Input aria-label={label} value={search} onChange={e=>Search_(e.target.value)} placeholder="Name or skill…"/></Label>
 <ul className="group-people">{shown.map(m=><li key={m.id}><Label><Checkbox checked={picked.includes(m.userId)} onCheckedChange={on=>onPick(on===true?[...picked,m.userId]:picked.filter(x=>x!==m.userId))}/><Avatar member={m}/><span><strong>{m.name}</strong><small>{m.headline}</small></span></Label></li>)}{!shown.length&&<li><small>No one matches that search.</small></li>}</ul></>;
}

export function NewGroupDialog({onClose,onCreated}:{onClose:()=>void;onCreated:(id:string)=>void}){
 const {slug,userId,data,toast}=useWorkspace(),[title,Title]=useState(''),[picked,Picked]=useState<string[]>([]),[busy,Busy]=useState(false);
 const people=data.members.filter(m=>m.userId!==userId&&m.status==='active');
 const room=GROUP_LIMIT-1,ready=title.trim().length>0&&picked.length>=2&&picked.length<=room;
 async function create(){Busy(true);try{const g=await messageRequest<{id:string}>(slug,userId,'conversation-groups',{title:title.trim(),userIds:picked});onCreated(g.id);}catch(e){toast(displayError(e));}finally{Busy(false);}}
 return <Modal title="Start a group" onClose={onClose}><form className="form-stack group-editor" onSubmit={e=>{e.preventDefault();if(ready)create();}}>
  <p>Choose at least two people in {data.organisation.name}. Only the people in the group can read it, and anyone you add later reads only what is written after they join.</p>
  <Label>Group name<Input required maxLength={80} value={title} onChange={e=>Title(e.target.value)} placeholder="Open studio crew"/></Label>
  <PeoplePicker people={people} picked={picked} onPick={Picked} label="Find people for the group"/>
  <small className="muted">{picked.length} chosen{picked.length>room?` · a group holds at most ${GROUP_LIMIT} people`:''}</small>
  <Button variant="default" className="button primary" disabled={busy||!ready}><Users size={15}/>{busy?'Starting…':'Start group'}</Button>
 </form></Modal>;
}

export function GroupPeopleDialog({thread,onClose,onChanged,onLeft}:{thread:Conversation;onClose:()=>void;onChanged:()=>Promise<unknown>;onLeft:()=>void}){
 const {slug,userId,data,toast}=useWorkspace(),[title,Title]=useState(thread.title||''),[picked,Picked]=useState<string[]>([]),[adding,Adding]=useState(false),[busy,Busy]=useState(false);
 const starter=thread.createdBy===userId,inside=thread.participantIds.map(id=>({id,member:data.members.find(m=>m.userId===id)}));
 const outside=data.members.filter(m=>m.status==='active'&&!thread.participantIds.includes(m.userId));
 const room=GROUP_LIMIT-thread.participantIds.length;
 async function act(path:string,body:unknown,notice:string,after?:()=>void){Busy(true);try{await messageRequest(slug,userId,`conversations/${thread.id}/${path}`,body);await onChanged();toast(notice);after?.();}catch(e){toast(displayError(e));}finally{Busy(false);}}
 return <Modal title={adding?'Add people':'People in this group'} onClose={onClose}><div className="form-stack group-editor">
  {adding?<>
   <p>They will read only what is written after they join. {room>0?`There is room for ${room} more.`:'This group is full.'}</p>
   <PeoplePicker people={outside} picked={picked} onPick={Picked} label="Find people to add"/>
   <div className="group-actions"><Button variant="secondary" type="button" className="button secondary" onClick={()=>{Adding(false);Picked([]);}}>Back</Button><Button variant="default" type="button" className="button primary" disabled={busy||!picked.length||picked.length>room} onClick={()=>act('participants',{userIds:picked},picked.length===1?'One person added.':`${picked.length} people added.`,()=>{Adding(false);Picked([]);})}><UserPlus size={15}/>Add to group</Button></div>
  </>:<>
   <form className="group-rename" onSubmit={e=>{e.preventDefault();if(title.trim()&&title.trim()!==thread.title)act('title',{title:title.trim()},'Group renamed.');}}><Label className="sr-only" htmlFor="group-title">Group name</Label><Input id="group-title" required maxLength={80} value={title} onChange={e=>Title(e.target.value)}/><Button variant="secondary" className="button secondary" disabled={busy||!title.trim()||title.trim()===thread.title}>Rename</Button></form>
   <ul className="group-people" aria-label="Group members">{inside.map(({id,member})=><li key={id}><Avatar member={member}/><span><strong>{member?.name||'Former member'}{id===userId?' (you)':''}</strong><small>{id===thread.createdBy?'Started this group':member?.status==='left'?'This account was deleted':member?.headline||''}</small></span>{starter&&id!==userId&&<Button variant="secondary" size="sm" type="button" className="button secondary compact" disabled={busy} aria-label={`Remove ${member?.name||'former member'}`} onClick={()=>{if(window.confirm(`Remove ${member?.name||'this person'} from the group? Their messages stay.`))act(`participants/${id}/remove`,{},'Removed from the group.');}}><UserMinus size={14}/>Remove</Button>}</li>)}</ul>
   <div className="group-actions"><Button variant="secondary" type="button" className="button secondary" disabled={busy} onClick={()=>{if(window.confirm('Leave this group? You will no longer be able to read it. Your messages stay for the others.'))act('leave',{},'You left the group.',onLeft);}}><LogOut size={14}/>Leave group</Button><Button variant="default" type="button" className="button primary" disabled={busy||room<1} onClick={()=>Adding(true)}><UserPlus size={15}/>Add people</Button></div>
  </>}
 </div></Modal>;
}
