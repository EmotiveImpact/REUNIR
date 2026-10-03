import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Button } from './ui/button';
import { Avatar, Empty } from './ui';
import { AttemptView, attemptStatus } from './quiz-view';
import { useWorkspace } from '../lib/context';
import type { QuizAttempt } from '../../../../packages/contracts/src/index';
import { teaches } from '../../../../packages/domain/src/instructors';

const oldestFirst = (a: QuizAttempt, b: QuizAttempt) => a.createdAt.localeCompare(b.createdAt);
const newestFirst = (a: QuizAttempt, b: QuizAttempt) => b.createdAt.localeCompare(a.createdAt);
/** Long lists open a page at a time. The counts beside each heading are always the full totals. */
export const REVIEW_PAGE = 20;
const reviewHeading = (attempt: QuizAttempt) => `quiz-review-${attempt.id}`;

/**
 * Shows the first page of a list and a button for the next. After more appear, focus moves to the first new item, so
 * keyboard and screen reader users continue where the new items begin.
 */
export function Paged({ items, noun, children }: { items: QuizAttempt[]; noun: string; children: (shown: QuizAttempt[]) => ReactNode }) {
    const [count, setCount] = useState(REVIEW_PAGE);
    const firstNew = useRef<string | null>(null);
    useEffect(() => {
        if (!firstNew.current) return;
        document.getElementById(firstNew.current)?.focus();
        firstNew.current = null;
    }, [count]);
    const shown = items.slice(0, count), rest = items.length - shown.length;
    const more = () => { firstNew.current = reviewHeading(items[count]); setCount(c => c + REVIEW_PAGE); };
    return <>
        {children(shown)}
        {rest > 0 && <div className="review-more">
            <span>Showing {shown.length} of {items.length} {noun}.</span>
            <button type="button" className="button secondary" onClick={more}>Show {Math.min(REVIEW_PAGE, rest)} more</button>
        </div>}
    </>;
}

/** Mark written answers and send feedback: for owners and administrators in Community studio, and for instructors on their teaching page. */
export function QuizReviewQueue() {
    const { data, me } = useWorkspace();
    // Only attempts on tracks this person teaches, and never their own.
    const reviewable = data.quizAttempts.filter(a => teaches(data, me, a.trackId) && a.userId !== me.userId);
    const waiting = reviewable.filter(a => a.status === 'awaiting_review').sort(oldestFirst);
    const scored = reviewable.filter(a => a.status === 'scored').sort(newestFirst);
    const reviewed = reviewable.filter(a => a.status === 'reviewed').sort(newestFirst);
    const name = (id: string | null) => data.members.find(m => m.userId === id)?.name;
    return <div className="quiz-review">
        <p className="quiz-review-intro">Written answers wait here for marks and feedback. You can also send feedback on an attempt that was scored automatically. Scores are private feedback for the learner, not points, completion or a credential.</p>
        <h2 className="quiz-review-heading">Waiting for feedback <span>{waiting.length}</span></h2>
        {waiting.length ? <Paged items={waiting} noun="waiting answers">{shown => <div className="review-grid">{shown.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div>}</Paged>
            : <Empty title="No written answers are waiting." body="Knowledge-check answers that need marking will appear here."/>}
        <details className="quiz-history"><summary>Scored automatically <span>{scored.length}</span></summary>
            {scored.length ? <Paged items={scored} noun="scored attempts">{shown => <div className="review-grid">{shown.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div>}</Paged> : <p className="muted">No automatically scored attempts yet.</p>}
        </details>
        <details className="quiz-history"><summary>Reviewed <span>{reviewed.length}</span></summary>
            {reviewed.length ? <Paged items={reviewed} noun="reviewed attempts">{shown => shown.map(a => <div className="quiz-reviewed" key={a.id}>
                <p id={reviewHeading(a)} tabIndex={-1}><strong>{name(a.userId) ?? 'Former member'}</strong> · {data.lessons.find(l => l.id === a.lessonId)?.title ?? 'Lesson'}</p>
                <AttemptView attempt={a} revealed reviewerName={name(a.reviewerId)} chosenLabel="Chosen"/>
            </div>)}</Paged> : <p className="muted">Reviewed attempts will appear here.</p>}
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
    const heading = reviewHeading(attempt);
    const send = () => command({ type: 'quiz.attempt.review', attemptId: attempt.id, expectedVersion: attempt.version, marks: written.map(q => ({ questionId: q.id, points: Number(marks[q.id]) })), feedback });
    return <section className="panel review-card quiz-review-card" aria-labelledby={heading}>
        <div className="teacher-row"><Avatar member={learner}/><span><strong>{learner?.name ?? 'Former member'}</strong><small>{track?.title ?? 'Learning track'} · Attempt {attempt.attemptNumber}</small></span><span className="quiz-status">{attemptStatus(attempt)}</span></div>
        <h2 id={heading} tabIndex={-1}><Link to={`/learn/${attempt.trackId}/${attempt.lessonId}`}>{lesson?.title ?? 'Lesson'}</Link></h2>
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
