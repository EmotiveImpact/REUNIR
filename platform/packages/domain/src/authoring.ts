import { lessonDocumentText } from '../../contracts/src/lesson-document';
import { DomainError, type Command, type Workspace, type TenantContext, type Member, type Lesson, type LessonDraft, type LessonContent } from '../../contracts/src/index';
import { actorFor, canSeeSpace } from './access';
import { contributedTracks, contributes, contributesAny, teaches } from './instructors';
import { assertResourcesAvailable, normaliseResources, resolveResources } from './resources';
import type { LessonResource } from '../../contracts/src/lesson-resources';
import type { AuthoredQuiz } from '../../contracts/src/assessments';
import { normaliseQuiz } from './assessments';

/** Content as edited and published. Resources are always an ordered array here, never NULL. */
export type EditableLessonContent = LessonContent & { resources: LessonResource[]; quiz: AuthoredQuiz | null };
/** Whitelist learner-facing content. Internal draft state never crosses the publication boundary. */
export function lessonContent(value: LessonContent): EditableLessonContent {
    return {title:value.title, summary:value.summary, body:value.richBody?lessonDocumentText(value.richBody):value.body, minutes:value.minutes, resourceUrl:value.resourceUrl, richBody:value.richBody?structuredClone(value.richBody):null, resources:normaliseResources(value.resources), quiz:normaliseQuiz(value.quiz)};
}
export function filterAuthoring(state: Workspace, actor: Member): Workspace {
    // Drafts and history are private to the people who teach the track: its instructors, its contributors and the community's administrators.
    const tracks=contributedTracks(state,actor);
    state.lessonDrafts=state.lessonDrafts.filter(d=>d.organizationId===actor.organizationId&&tracks.has(d.trackId));
    state.lessonRevisions=state.lessonRevisions.filter(d=>d.organizationId===actor.organizationId&&tracks.has(d.trackId));
    return state;
}
export function applyAuthoring(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId:()=>string) {
    if(!cmd.type.startsWith('lesson.draft.')&&cmd.type!=='track.lessons.reorder')return undefined;
    const actor=actorFor(s,ctx);
    if(!contributesAny(s,actor))throw new DomainError('AUTHOR_REQUIRED','Only a track instructor or contributor, or a community owner or administrator, can manage lesson drafts.',403);
    const missing=():never=>{throw new DomainError('NOT_FOUND','That learning material is not available.',404);};
    // An instructor or contributor of another track is told nothing about this one.
    const track=(id:string)=>{const t=s.tracks.find(t=>t.id===id&&t.organizationId===ctx.organizationId);if(!t||!canSeeSpace(s,actor,t.spaceId)||!contributes(s,actor,t.id))return missing();return t;};
    // Contributors write drafts. What learners see (publication and order) and archiving stay with the track's instructors.
    const lead=(id:string)=>{const t=track(id);if(!teaches(s,actor,t.id))throw new DomainError('INSTRUCTOR_REQUIRED','Only this track’s instructors or a community owner or administrator can publish, archive or reorder its lessons.',403);return t;};
    const base=()=>({id:makeId(),organizationId:ctx.organizationId,createdAt:now});
    const result=(objectId:string,message:string,changed=true)=>({objectId,message,changed,audit:changed});
    const snapshot=(lesson:Lesson,draft:LessonDraft,kind:'captured'|'published')=>{
        const sequence=Math.max(0,...s.lessonRevisions.filter(r=>r.lessonId===lesson.id&&r.organizationId===ctx.organizationId).map(r=>r.sequence))+1;
        s.lessonRevisions.push({...base(),...lessonContent(lesson),trackId:lesson.trackId,lessonId:lesson.id,draftId:draft.id,sequence,kind,actorId:ctx.userId});
    };
    if(cmd.type==='track.lessons.reorder'){
        lead(cmd.trackId);
        const lessons=s.lessons.filter(l=>l.trackId===cmd.trackId&&l.organizationId===ctx.organizationId).sort((a,b)=>a.position-b.position);
        const current=lessons.map(l=>l.id);
        if(JSON.stringify(current)!==JSON.stringify(cmd.expectedOrder))throw new DomainError('STALE_CURRICULUM','The curriculum changed. Refresh before reordering.',409);
        if(cmd.lessonIds.length!==current.length||new Set(cmd.lessonIds).size!==current.length||cmd.lessonIds.some(id=>!current.includes(id)))throw new DomainError('INVALID_ORDER','Include every existing lesson exactly once.');
        if(JSON.stringify(current)===JSON.stringify(cmd.lessonIds))return result(cmd.trackId,'The curriculum is already in this order.',false);
        for(const lesson of lessons)lesson.position=cmd.lessonIds.indexOf(lesson.id)+1;
        return result(cmd.trackId,'Curriculum order saved. Existing completion records are unchanged.');
    }
    if(cmd.type==='lesson.draft.create'){
        track(cmd.trackId);
        const lesson=cmd.lessonId?s.lessons.find(l=>l.id===cmd.lessonId&&l.trackId===cmd.trackId&&l.organizationId===ctx.organizationId):undefined;
        if(cmd.lessonId&&!lesson)return missing();
        const existing=lesson?s.lessonDrafts.find(d=>d.lessonId===lesson.id&&d.organizationId===ctx.organizationId):undefined;
        if(existing)return result(existing.id,existing.archived?'This lesson has an archived draft. Restore it to continue.':'Opened the existing draft.',false);
        const draft:LessonDraft={...base(),...(lesson?lessonContent(lesson):{title:'Untitled lesson',summary:'',body:'',minutes:5,resourceUrl:''}),trackId:cmd.trackId,lessonId:lesson?.id??null,version:1,publishedVersion:lesson?.published?1:null,archived:false,createdBy:ctx.userId,updatedBy:ctx.userId,updatedAt:now};
        s.lessonDrafts.push(draft);
        if(lesson&&!s.lessonRevisions.some(r=>r.lessonId===lesson.id&&r.organizationId===ctx.organizationId))snapshot(lesson,draft,'captured');
        return result(draft.id,'Private draft opened. Learners still see the published lesson.');
    }
    if(!('draftId' in cmd)||!('expectedVersion' in cmd))return undefined;
    const draft=s.lessonDrafts.find(d=>d.id===cmd.draftId&&d.organizationId===ctx.organizationId)??missing();
    if(cmd.type==='lesson.draft.publish'||cmd.type==='lesson.draft.archive')lead(draft.trackId);else track(draft.trackId);
    if(draft.version!==cmd.expectedVersion)throw new DomainError('STALE_DRAFT','Someone saved a newer draft. Reload it before saving or publishing.',409);
    if(cmd.type==='lesson.draft.archive'){
        if(draft.archived===cmd.archived)return result(draft.id,'The draft is already in this state.',false);
        const clean=draft.publishedVersion===draft.version;
        draft.archived=cmd.archived;draft.version++;if(clean)draft.publishedVersion=draft.version;draft.updatedAt=now;draft.updatedBy=ctx.userId;
        return result(draft.id,cmd.archived?'Draft archived. The published lesson and evidence remain.':'Draft restored. Nothing was republished.');
    }
    if(draft.archived)throw new DomainError('DRAFT_ARCHIVED','Restore this draft before changing or publishing it.',409);
    if(cmd.type==='lesson.draft.save'){
        if(draft.richBody && cmd.richBody===undefined)throw new DomainError('RICH_CONTENT_REQUIRED','Reload the updated editor before saving this formatted lesson.',409);
        // An editor that predates lesson files must not silently drop them by omission.
        if(draft.resources?.length && cmd.resources===undefined)throw new DomainError('RESOURCES_REQUIRED','Reload the updated editor before saving this lesson’s files.',409);
        if(draft.quiz && cmd.quiz===undefined)throw new DomainError('QUIZ_REQUIRED','Reload the updated editor before saving this lesson’s knowledge check.',409);
        const content=lessonContent({...cmd,resources:resolveResources(s,ctx,draft.trackId,cmd.resources??[]),quiz:cmd.quiz??null});
        if(JSON.stringify(content)===JSON.stringify(lessonContent(draft)))return result(draft.id,'The draft is already saved.',false);
        Object.assign(draft,content,{version:draft.version+1,updatedAt:now,updatedBy:ctx.userId});
        return result(draft.id,'Draft saved privately. No live content changed.');
    }
    if(cmd.type==='lesson.draft.restore'){
        const revision=s.lessonRevisions.find(r=>r.id===cmd.revisionId&&r.organizationId===ctx.organizationId&&r.lessonId===draft.lessonId&&r.trackId===draft.trackId)??missing();
        Object.assign(draft,lessonContent(revision),{version:draft.version+1,updatedAt:now,updatedBy:ctx.userId});
        return result(draft.id,'Revision copied into the draft. Preview and publish when ready.');
    }
    if(cmd.type==='lesson.draft.publish'){
        if(!draft.title.trim()||!draft.summary.trim()||!draft.body.trim())throw new DomainError('INCOMPLETE_LESSON','Add a title, summary and lesson body before publishing.');
        if(draft.publishedVersion===draft.version)return result(draft.id,'This saved version is already published.',false);
        assertResourcesAvailable(s,ctx,draft.trackId,draft.resources);
        let lesson=draft.lessonId?s.lessons.find(l=>l.id===draft.lessonId&&l.organizationId===ctx.organizationId&&l.trackId===draft.trackId):undefined;
        if(draft.lessonId&&!lesson)return missing();
        if(!lesson){lesson={...base(),...lessonContent(draft),trackId:draft.trackId,position:Math.max(0,...s.lessons.filter(l=>l.trackId===draft.trackId&&l.organizationId===ctx.organizationId).map(l=>l.position))+1,published:true};s.lessons.push(lesson);draft.lessonId=lesson.id;}
        else Object.assign(lesson,lessonContent(draft),{published:true});
        snapshot(lesson,draft,'published');
        draft.publishedVersion=draft.version;draft.updatedAt=now;draft.updatedBy=ctx.userId;
        return result(draft.id,'Saved lesson published. Existing completions and points are preserved.');
    }
    return undefined;
}
