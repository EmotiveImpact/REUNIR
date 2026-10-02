import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, Empty } from './ui';
import { AttemptView, attemptStatus } from './quiz-view';
import { useWorkspace } from '../lib/context';
import type { QuizAttempt } from '../../../../packages/contracts/src/index';

const oldestFirst = (a: QuizAttempt, b: QuizAttempt) => a.createdAt.localeCompare(b.createdAt);
const newestFirst = (a: QuizAttempt, b: QuizAttempt) => b.createdAt.localeCompare(a.createdAt);

/** Community studio queue: mark written answers and send feedback. Owners and administrators only. */
export function QuizReviewQueue() {
    const { data } = useWorkspace();
    const waiting = data.quizAttempts.filter(a => a.status === 'awaiting_review').sort(oldestFirst);
    const scored = data.quizAttempts.filter(a => a.status === 'scored').sort(newestFirst).slice(0, 30);
    const reviewed = data.quizAttempts.filter(a => a.status === 'reviewed').sort(newestFirst).slice(0, 30);
    const name = (id: string | null) => data.members.find(m => m.userId === id)?.name;
    return <div className="quiz-review">
        <p className="quiz-review-intro">Written answers wait here for marks and feedback. You can also send feedback on an attempt that was scored automatically. Scores are private feedback for the learner, not points, completion or a credential.</p>
        <h2 className="quiz-review-heading">Waiting for feedback <span>{waiting.length}</span></h2>
        {waiting.length ? <div className="review-grid">{waiting.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div>
            : <Empty title="No written answers are waiting." body="Knowledge-check answers that need marking will appear here."/>}
        <details className="quiz-history"><summary>Scored automatically <span>{scored.length}</span></summary>
            {scored.length ? <div className="review-grid">{scored.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div> : <p className="muted">No automatically scored attempts yet.</p>}
        </details>
        <details className="quiz-history"><summary>Reviewed <span>{reviewed.length}</span></summary>
            {reviewed.length ? reviewed.map(a => <div className="quiz-reviewed" key={a.id}>
                <p><strong>{name(a.userId) ?? 'Former member'}</strong> · {data.lessons.find(l => l.id === a.lessonId)?.title ?? 'Lesson'}</p>
                <AttemptView attempt={a} revealed reviewerName={name(a.reviewerId)} chosenLabel="Chosen"/>
            </div>) : <p className="muted">Reviewed attempts will appear here.</p>}
        </details>
    </div>;
}

function ReviewCard({ attempt }: { attempt: QuizAttempt }) {
    const { data, me, busy, command } = useWorkspace();
    const [marks, setMarks] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState('');
    const learner = data.members.find(m => m.userId === attempt.userId);
    const lesson = data.lessons.find(l => l.id === attempt.lessonId), track = data.tracks.find(t => t.id === attempt.trackId);
    const written = attempt.quiz.questions.filter(q => q.kind === 'written');
    const own = attempt.userId === me.userId;
    const marked = (id: string, max: number) => /^\d+$/.test(marks[id] ?? '') && Number(marks[id]) <= max;
    const ready = !own && !!feedback.trim() && written.every(q => marked(q.id, q.points));
    const heading = `quiz-review-${attempt.id}`;
    const send = () => command({ type: 'quiz.attempt.review', attemptId: attempt.id, expectedVersion: attempt.version, marks: written.map(q => ({ questionId: q.id, points: Number(marks[q.id]) })), feedback });
    return <section className="panel review-card quiz-review-card" aria-labelledby={heading}>
        <div className="teacher-row"><Avatar member={learner}/><span><strong>{learner?.name ?? 'Former member'}</strong><small>{track?.title ?? 'Learning track'} · Attempt {attempt.attemptNumber}</small></span><span className="quiz-status">{attemptStatus(attempt)}</span></div>
        <h2 id={heading}><Link to={`/learn/${attempt.trackId}/${attempt.lessonId}`}>{lesson?.title ?? 'Lesson'}</Link></h2>
        <AttemptView attempt={attempt} revealed chosenLabel="Chosen" renderMark={q => q.kind === 'written' ? <label className="quiz-mark">
            <span>Points for this answer (0 to {q.points})</span>
            <input type="number" inputMode="numeric" min={0} max={q.points} step={1} value={marks[q.id] ?? ''} disabled={own || busy} onChange={e => { const value = e.target.value; setMarks(current => ({ ...current, [q.id]: value })); }}/>
            {marks[q.id] !== undefined && marks[q.id] !== '' && !marked(q.id, q.points) && <small role="alert">Enter a whole number from 0 to {q.points}.</small>}
        </label> : null}/>
        <label className="quiz-review-feedback">Feedback for {learner?.name ?? 'the learner'}<textarea rows={3} maxLength={2000} value={feedback} disabled={own || busy} placeholder="What is strong? What would make the answer stronger?" onChange={e => setFeedback(e.target.value)}/></label>
        <div className="review-actions"><Button type="button" disabled={busy || !ready} onClick={() => void send()}><Send size={15} aria-hidden="true"/>{written.length ? 'Send marks and feedback' : 'Send feedback'}</Button></div>
        {own && <p className="sample-note">Another owner or administrator must review your own answers.</p>}
    </section>;
}
