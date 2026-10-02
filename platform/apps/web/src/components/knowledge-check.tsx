import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListChecks, LockKeyhole, RotateCcw, Send } from 'lucide-react';
import { Button } from './ui/button';
import { AttemptView, QuizQuestions, hasAnswerKey, quizSummary } from './quiz-view';
import { useWorkspace } from '../lib/context';
import type { Lesson, QuizAttempt } from '../../../../packages/contracts/src/index';
import { quizFingerprint, type LessonQuiz, type QuizAnswer } from '../../../../packages/contracts/src/assessments';
import { MAX_ATTEMPT_RECORDS } from '../../../../packages/domain/src/assessments';

function nextStep(quiz: LessonQuiz | null | undefined, latest: QuizAttempt, canTry: boolean): string {
    if (latest.status === 'awaiting_review') return 'Your written answers are waiting for a reviewer. You can try again once they have been reviewed.';
    if (!quiz) return '';
    const parts = [latest.passed === true ? 'You passed.' : !canTry && quiz.maxAttempts !== null ? 'You have used every attempt.' : ''];
    if (!hasAnswerKey(latest.quiz)) parts.push(quiz.revealAnswers ? 'Correct answers appear once you pass or use every attempt.' : 'This check does not show correct answers.');
    if (canTry) parts.push(latest.passed === true ? 'You can try again to practise.' : 'You can try again when you are ready.');
    return parts.filter(Boolean).join(' ');
}

/** The learner's knowledge check for one lesson: answer, see the server's result, read feedback and try again. */
export function KnowledgeCheck({ lesson, enrolled }: { lesson: Lesson; enrolled: boolean }) {
    const { data, me, busy, command } = useWorkspace();
    const cache = useQueryClient();
    const heading = useId();
    const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
    const [retrying, setRetrying] = useState(false);
    const quiz = lesson.quiz;
    const attempts = data.quizAttempts.filter(a => a.lessonId === lesson.id && a.userId === me.userId).sort((a, b) => b.attemptNumber - a.attemptNumber);
    if (!quiz && !attempts.length) return null;
    const latest = attempts[0], waiting = latest?.status === 'awaiting_review';
    const left = quiz?.maxAttempts == null ? MAX_ATTEMPT_RECORDS - attempts.length : quiz.maxAttempts - attempts.length;
    const canTry = !!quiz && enrolled && !waiting && left > 0;
    const answering = canTry && (!latest || retrying);
    const complete = !!quiz && quiz.questions.every(q => { const a = answers[q.id]; return q.kind === 'single' || q.kind === 'multiple' ? !!a?.optionIds.length : !!a?.text.trim(); });
    const reviewer = (id: string | null) => data.members.find(m => m.userId === id)?.name;
    const earlier = attempts.slice(answering ? 0 : 1);
    const submit = async () => {
        if (!quiz) return;
        const r = await command({ type: 'quiz.attempt.submit', lessonId: lesson.id, fingerprint: quizFingerprint(quiz), answers: quiz.questions.map(q => {
            const a = answers[q.id];
            return { questionId: q.id, optionIds: (a?.optionIds ?? []).filter(id => q.options.some(o => o.id === id)), text: a?.text ?? '' };
        }) });
        if (r) { setAnswers({}); setRetrying(false); }
        // A refused attempt records nothing. Reload so a changed or closed check shows its current state.
        else await cache.invalidateQueries({ queryKey: ['workspace'] });
    };
    return <section className="knowledge-check" aria-labelledby={heading}>
        <div className="knowledge-check-head">
            <span className="knowledge-check-icon"><ListChecks size={18} aria-hidden="true"/></span>
            <div><h3 id={heading}>Knowledge check</h3><p>{quiz ? quizSummary(quiz, attempts.length) : 'This lesson no longer has a knowledge check. Your earlier attempts are kept here.'}</p></div>
        </div>
        <p className="knowledge-check-privacy"><LockKeyhole size={14} aria-hidden="true"/>Only you and your community’s owners and administrators can see your answers. They do not change your lesson completion or points.</p>
        {latest && !answering && <>
            <AttemptView attempt={latest} revealed={hasAnswerKey(latest.quiz)} reviewerName={reviewer(latest.reviewerId)}/>
            {nextStep(quiz, latest, canTry) && <p className="knowledge-check-next" role="status">{nextStep(quiz, latest, canTry)}</p>}
            {canTry && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRetrying(true)}><RotateCcw size={15} aria-hidden="true"/>Try again</Button>}
        </>}
        {quiz && !enrolled && !latest && <p className="knowledge-check-next">Join this track to answer the knowledge check.</p>}
        {answering && quiz && <form className="quiz-form" onSubmit={e => { e.preventDefault(); if (complete && !busy) void submit(); }}>
            <QuizQuestions quiz={quiz} name={`quiz-${lesson.id}`} answers={answers} disabled={busy} onAnswer={a => setAnswers(current => ({ ...current, [a.questionId]: a }))}/>
            <div className="quiz-form-foot">
                <Button type="submit" disabled={busy || !complete}><Send size={15} aria-hidden="true"/>Submit answers</Button>
                {retrying && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setRetrying(false); setAnswers({}); }}>Cancel</Button>}
                <small>{complete ? 'Your answers are checked when you submit.' : 'Answer every question to submit.'}</small>
            </div>
        </form>}
        {earlier.length > 0 && <details className="quiz-history"><summary>Earlier attempts <span>{earlier.length}</span></summary>
            {earlier.map(a => <AttemptView key={a.id} attempt={a} revealed={hasAnswerKey(a.quiz)} reviewerName={reviewer(a.reviewerId)}/>)}
        </details>}
    </section>;
}
