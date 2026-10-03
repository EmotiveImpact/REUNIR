import { Link } from 'react-router-dom';
import { GraduationCap, Pencil, Plus } from 'lucide-react';
import { Empty, PageHeading } from '../components/ui';
import { Cover } from '../components/cover';
import { QuizReviewQueue } from '../components/quiz-review';
import { useWorkspace } from '../lib/context';
import { holdsGrant, startsTracks, teachesPart, teachesAny } from '../../../../packages/domain/src/instructors';
import { CreateModal } from '../components/forms';
import { useState } from 'react';

/** An instructor's own tracks and the knowledge-check answers waiting for their feedback. */
export function TeachingPage() {
    const { data, me } = useWorkspace();
    const [starting, setStarting] = useState(false);
    const taught = data.tracks.filter(t => holdsGrant(data, me, t.id));
    if (!taught.length) return <Empty icon={GraduationCap} title="Teaching opens when you are an instructor or contributor." body="A community owner or administrator can ask you to teach or contribute to a learning track."/>;
    const reviews = teachesAny(data, me);
    return <section className="teaching-page">
        <PageHeading eyebrow="YOUR TEACHING" title="Teach what you know." body={reviews ? 'Author lessons for the tracks you teach and give feedback on knowledge checks. Scores stay private to each learner.' : 'Write lesson drafts for the tracks you contribute to. Their instructors publish them.'}/>
        <div className="teaching-heading-row"><h2 className="teaching-heading">Your tracks</h2>{startsTracks(data, me) && <button type="button" className="button secondary" onClick={() => setStarting(true)}><Plus size={15} aria-hidden="true"/>Start a track</button>}</div>
        <ul className="teaching-tracks">{taught.map(t => {
            const lessons = data.lessons.filter(l => l.trackId === t.id && l.published).length;
            const drafts = data.lessonDrafts.filter(d => d.trackId === t.id && !d.archived && d.publishedVersion !== d.version).length;
            const waiting = data.summary?.waitingByTrack[t.id] ?? 0, instructor = teachesPart(data, me, t.id);
            const some = data.trackInstructors.find(i => i.trackId === t.id && i.userId === me.userId)?.lessonIds;
            return <li key={t.id} className="panel teaching-track">
                <Cover kind="track" subject={t} small/>
                <div className="teaching-track-copy"><h3><Link to={`/learn/${t.id}`}>{t.title}</Link></h3><p>{!t.published && 'Not published · '}{instructor ? 'Instructor' : 'Contributor'}{some && ` for ${some.length} ${some.length === 1 ? 'lesson' : 'lessons'}`} · {lessons} published {lessons === 1 ? 'lesson' : 'lessons'} · {drafts} unpublished {drafts === 1 ? 'draft' : 'drafts'}{instructor && ` · ${waiting} waiting for feedback`}</p></div>
                <Link className="button secondary" to={`/learn/${t.id}/studio`} aria-label={`Open Creator studio for ${t.title}`}><Pencil size={15} aria-hidden="true"/>Creator studio</Link>
            </li>;
        })}</ul>
        {reviews && <><h2 className="teaching-heading">Knowledge checks</h2>
        <QuizReviewQueue/></>}
        {starting && <CreateModal kind="track" onClose={() => setStarting(false)}/>}
    </section>;
}
