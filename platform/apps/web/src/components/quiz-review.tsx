import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { InlineError, Loading } from './states';
import { Button } from './ui/button';
import { Avatar, Empty } from './ui';
import { AttemptView, attemptStatus } from './quiz-view';
import { useWorkspace } from '../lib/context';
import type { QuizAttempt } from '../../../../packages/contracts/src/index';
import { PAGE_SIZE } from '../../../../packages/contracts/src/pages';
import { usePagedList } from '../lib/pages';
import { displayError } from '../lib/data';

/** Long lists open a page at a time from the server. The counts beside each heading are always the full totals. */
export const REVIEW_PAGE = PAGE_SIZE;
const reviewHeading = (attempt: QuizAttempt) => `quiz-review-${attempt.id}`;
type Review = 'review-waiting' | 'review-scored' | 'review-reviewed';

/**
 * Shows the first page of a list and a button for the next, which the server sends. After more appear, focus moves to the
 * first new item, so keyboard and screen reader users continue where the new items begin.
 */
export function Paged({ list, noun, empty, children }: { list: ReturnType<typeof usePagedList<Review>>; noun: string; empty: ReactNode; children: (shown: QuizAttempt[]) => ReactNode }) {
    const firstNew = useRef<string | null>(null);
    useEffect(() => {
        if (!firstNew.current || list.loadingMore) return;
        document.getElementById(firstNew.current)?.focus();
        firstNew.current = null;
    }, [list.items.length, list.loadingMore]);
    if (list.loading) return <Loading label={`Loading ${noun}…`}/>;
    if (list.error) return <InlineError error={list.error} onRetry={list.retry}/>;
    if (!list.items.length) return <>{empty}</>;
    const shown = list.items, rest = list.total - shown.length;
    const more = async () => { const r = await list.more(); const page = r.data?.pages.at(-1)?.items[0]; if (page) firstNew.current = reviewHeading(page as QuizAttempt); };
    return <>
        {children(shown)}
        {list.hasMore && <div className="review-more">
            <span>Showing {shown.length} of {list.total} {noun}.</span>
            <button type="button" className="button secondary" disabled={list.loadingMore} aria-busy={list.loadingMore || undefined} onClick={() => void more()}>{list.loadingMore ? 'Loading…' : `Show ${Math.min(REVIEW_PAGE, Math.max(rest, 0))} more`}</button>
        </div>}
    </>;
}

/** Mark written answers and send feedback: for owners and administrators in Community studio, and for instructors on their teaching page. */
export function QuizReviewQueue() {
    const { data } = useWorkspace();
    // Only attempts on tracks this person teaches, and never their own: the server applies the rule and sends pages.
    const [scoredOpen, setScoredOpen] = useState(false), [reviewedOpen, setReviewedOpen] = useState(false);
    const waiting = usePagedList('review-waiting'), scored = usePagedList('review-scored', { enabled: scoredOpen }), reviewed = usePagedList('review-reviewed', { enabled: reviewedOpen });
    const totals = data.summary?.review ?? { waiting: waiting.total, scored: scored.total, reviewed: reviewed.total };
    const name = (id: string | null) => data.members.find(m => m.userId === id)?.name;
    return <div className="quiz-review">
        <p className="quiz-review-intro">Written answers wait here for marks and feedback. You can also send feedback on an attempt that was scored automatically. Scores are private feedback for the learner, not points, completion or a credential.</p>
        <h2 className="quiz-review-heading">Waiting for feedback <span>{totals.waiting}</span></h2>
        <Paged list={waiting} noun="waiting answers" empty={<Empty icon={CheckCircle2} title="No written answers are waiting." body="Knowledge-check answers that need marking will appear here."/>}>{shown => <div className="review-grid">{shown.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div>}</Paged>
        <details className="quiz-history" onToggle={e => setScoredOpen((e.target as HTMLDetailsElement).open)}><summary>Scored automatically <span>{totals.scored}</span></summary>
            {scoredOpen && <Paged list={scored} noun="scored attempts" empty={<p className="muted">No automatically scored attempts yet.</p>}>{shown => <div className="review-grid">{shown.map(a => <ReviewCard key={a.id} attempt={a}/>)}</div>}</Paged>}
        </details>
        <details className="quiz-history" onToggle={e => setReviewedOpen((e.target as HTMLDetailsElement).open)}><summary>Reviewed <span>{totals.reviewed}</span></summary>
            {reviewedOpen && <Paged list={reviewed} noun="reviewed attempts" empty={<p className="muted">Reviewed attempts will appear here.</p>}>{shown => shown.map(a => <div className="quiz-reviewed" key={a.id}>
                <p id={reviewHeading(a)} tabIndex={-1}><strong>{name(a.userId) ?? 'Former member'}</strong> · {data.lessons.find(l => l.id === a.lessonId)?.title ?? 'Lesson'}</p>
                <AttemptView attempt={a} revealed reviewerName={name(a.reviewerId)} chosenLabel="Chosen"/>
            </div>)}</Paged>}
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
