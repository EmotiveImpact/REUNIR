import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Empty, PageHeading } from '../components/ui';
import { Cover } from '../components/cover';
import { QuizReviewQueue } from '../components/quiz-review';
import { useWorkspace } from '../lib/context';
import { teaches } from '../../../../packages/domain/src/instructors';

/** An instructor's own tracks and the knowledge-check answers waiting for their feedback. */
export function TeachingPage() {
    const { data, me } = useWorkspace();
    const taught = data.tracks.filter(t => teaches(data, me, t.id));
    if (!taught.length) return <Empty title="Teaching opens when you are an instructor." body="A community owner or administrator can ask you to teach a learning track."/>;
    return <section className="teaching-page">
        <PageHeading eyebrow="YOUR TEACHING" title="Teach what you know." body="Author lessons for the tracks you teach and give feedback on knowledge checks. Scores stay private to each learner."/>
        <h2 className="teaching-heading">Your tracks</h2>
        <ul className="teaching-tracks">{taught.map(t => {
            const lessons = data.lessons.filter(l => l.trackId === t.id && l.published).length;
            const drafts = data.lessonDrafts.filter(d => d.trackId === t.id && !d.archived && d.publishedVersion !== d.version).length;
            const waiting = data.quizAttempts.filter(a => a.trackId === t.id && a.status === 'awaiting_review' && a.userId !== me.userId).length;
            return <li key={t.id} className="panel teaching-track">
                <Cover kind="track" subject={t} small/>
                <div className="teaching-track-copy"><h3><Link to={`/learn/${t.id}`}>{t.title}</Link></h3><p>{lessons} published {lessons === 1 ? 'lesson' : 'lessons'} · {drafts} unpublished {drafts === 1 ? 'draft' : 'drafts'} · {waiting} waiting for feedback</p></div>
                <Link className="button secondary" to={`/learn/${t.id}/studio`} aria-label={`Open Creator studio for ${t.title}`}><Pencil size={15} aria-hidden="true"/>Creator studio</Link>
            </li>;
        })}</ul>
        <h2 className="teaching-heading">Knowledge checks</h2>
        <QuizReviewQueue/>
    </section>;
}
