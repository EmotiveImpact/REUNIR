import type { ReactNode } from 'react';
import { Check, Circle, CircleDot, ListChecks, Square, SquareCheck } from 'lucide-react';
import type { QuizAttempt } from '../../../../packages/contracts/src/index';
import {
    MAX_SHORT_ANSWER, MAX_WRITTEN_ANSWER, quizMaxScore, quizPercentage, type LessonQuiz, type QuizAnswer, type QuizQuestion, type QuizResult,
} from '../../../../packages/contracts/src/assessments';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { OptionalRadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

/** Presentational knowledge-check views. No data access, so the same markup renders in tests and in every mode. */
export const pointsLabel = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;
const when = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

/** True when this copy carries its answer key: always for authors, for learners only once the reveal rule allows. */
export const hasAnswerKey = (quiz: LessonQuiz) => quiz.questions.some(q => q.acceptedAnswers !== undefined || q.options.some(o => o.correct !== undefined));

export function quizSummary(quiz: LessonQuiz, used = 0): string {
    const count = quiz.questions.length;
    return [
        `${count} ${count === 1 ? 'question' : 'questions'}`, pointsLabel(quizMaxScore(quiz)),
        quiz.passPercentage === null ? 'No pass mark' : `Pass mark ${quiz.passPercentage}%`,
        quiz.maxAttempts === null ? 'Unlimited attempts' : `${Math.max(0, quiz.maxAttempts - used)} of ${quiz.maxAttempts} ${quiz.maxAttempts === 1 ? 'attempt' : 'attempts'} left`,
    ].join(' · ');
}

export function attemptStatus(attempt: QuizAttempt): string {
    if (attempt.status === 'awaiting_review') return 'Waiting for feedback';
    if (attempt.passed === true) return 'Passed';
    if (attempt.passed === false) return 'Below the pass mark';
    return attempt.status === 'reviewed' ? 'Reviewed' : 'Scored';
}

function resultLabel(result: QuizResult | undefined): string {
    if (!result) return '';
    if (result.correct === true) return `Correct · ${result.points} of ${pointsLabel(result.maxPoints)}`;
    if (result.correct === false) return result.points ? `Partly right · ${result.points} of ${pointsLabel(result.maxPoints)}` : `Not correct · 0 of ${pointsLabel(result.maxPoints)}`;
    return result.points === null ? `Waiting for review · ${pointsLabel(result.maxPoints)}` : `Marked · ${result.points} of ${pointsLabel(result.maxPoints)}`;
}

/** Learner-facing questions. Without `onAnswer` every input is inert, which is how the studio preview uses it. */
export function QuizQuestions({ quiz, name, answers, onAnswer, disabled = false }: {
    quiz: LessonQuiz; name: string; answers: Record<string, QuizAnswer>; onAnswer?: (answer: QuizAnswer) => void; disabled?: boolean;
}) {
    return <ol className="quiz-questions">{quiz.questions.map((q, i) => {
        const given = answers[q.id] ?? { questionId: q.id, optionIds: [], text: '' };
        const set = (patch: Partial<QuizAnswer>) => onAnswer?.({ ...given, ...patch });
        const prompt = `${name}-${q.id}-prompt`;
        return <li key={q.id}><fieldset className="quiz-question" disabled={disabled || !onAnswer}>
            <legend><span className="quiz-question-number">Question {i + 1} · {pointsLabel(q.points)}{q.partialCredit ? ' · partial marks' : ''}</span><span id={prompt} className="quiz-question-prompt">{q.prompt}</span></legend>
            {q.kind === 'multiple' && <p className="quiz-hint">Choose every answer that applies.</p>}
            {(q.kind === 'single' || q.kind === 'multiple') && <OptionalRadioGroup when={q.kind === 'single'} name={`${name}-${q.id}`} aria-labelledby={prompt} value={given.optionIds[0] ?? ''} onValueChange={id => set({ optionIds: [id] })}><div className="quiz-choices">{q.options.map(o => <Label key={o.id} className="quiz-choice">
                {q.kind === 'single' ? <RadioGroupItem value={o.id}/> : <Checkbox checked={given.optionIds.includes(o.id)}
                    onCheckedChange={on => set({ optionIds: on === true ? [...given.optionIds, o.id] : given.optionIds.filter(id => id !== o.id) })}/>}
                <span>{o.text}</span>
            </Label>)}</div></OptionalRadioGroup>}
            {q.kind === 'short' && <Input className="quiz-text" aria-labelledby={prompt} maxLength={MAX_SHORT_ANSWER} value={given.text} placeholder="A word or short phrase" onChange={e => set({ text: e.target.value })}/>}
            {q.kind === 'written' && <>
                <Textarea className="quiz-text" rows={4} aria-labelledby={prompt} maxLength={MAX_WRITTEN_ANSWER} value={given.text} placeholder="Write your answer" onChange={e => set({ text: e.target.value })}/>
                <small className="quiz-count">{given.text.length} of {MAX_WRITTEN_ANSWER} characters · marked by a reviewer</small>
            </>}
        </fieldset></li>;
    })}</ol>;
}

/**
 * One submitted attempt. Correct options, accepted answers and explanations appear only when `revealed`;
 * learners otherwise see which questions earned points, never which option was right.
 */
export function AttemptView({ attempt, revealed, reviewerName, renderMark, chosenLabel = 'Your answer' }: {
    attempt: QuizAttempt; revealed: boolean; reviewerName?: string; renderMark?: (question: QuizQuestion) => ReactNode; chosenLabel?: string;
}) {
    const final = attempt.status !== 'awaiting_review';
    return <div className="quiz-attempt">
        <div className="quiz-attempt-summary">
            <div><strong>Attempt {attempt.attemptNumber}</strong><small>{when(attempt.createdAt)}</small></div>
            <span className="quiz-attempt-score">{final ? `${attempt.score} of ${pointsLabel(attempt.maxScore)} · ${quizPercentage(attempt.score, attempt.maxScore)}%` : `${attempt.score} of ${pointsLabel(attempt.maxScore)} so far`}</span>
            <span className="quiz-status">{attemptStatus(attempt)}</span>
        </div>
        {attempt.status === 'reviewed' && <blockquote className="quiz-feedback"><span>Feedback{reviewerName ? ` from ${reviewerName}` : ''}</span><p>{attempt.feedback}</p></blockquote>}
        <ol className="quiz-attempt-answers">{attempt.quiz.questions.map((q, i) => {
            const answer = attempt.answers.find(a => a.questionId === q.id), result = attempt.results.find(r => r.questionId === q.id);
            const choice = q.kind === 'single' || q.kind === 'multiple';
            const Chosen = q.kind === 'multiple' ? SquareCheck : CircleDot, Unchosen = q.kind === 'multiple' ? Square : Circle;
            return <li key={q.id}>
                <div className="quiz-answer-head"><span>Question {i + 1}</span><strong>{q.prompt}</strong><em>{resultLabel(result)}</em></div>
                {choice ? <ul className="quiz-answer-options">{q.options.map(o => {
                    const chosen = !!answer?.optionIds.includes(o.id);
                    return <li key={o.id} className={chosen ? 'chosen' : undefined}>
                        {chosen ? <Chosen size={15} aria-hidden="true"/> : <Unchosen size={15} aria-hidden="true"/>}<span>{o.text}</span>
                        {chosen && <small>{chosenLabel}</small>}{revealed && o.correct && <small className="quiz-correct"><Check size={12} aria-hidden="true"/>Correct answer</small>}
                    </li>;
                })}</ul> : <p className="quiz-given">{answer?.text || 'No answer'}</p>}
                {revealed && q.kind === 'short' && !!q.acceptedAnswers?.length && <p className="quiz-accepted">Accepted answers: {q.acceptedAnswers.join(', ')}</p>}
                {revealed && !!q.explanation && <p className="quiz-explanation">{q.explanation}</p>}
                {renderMark?.(q)}
            </li>;
        })}</ol>
    </div>;
}

/** The studio preview: exactly the questions learners will see, with inert inputs and no answers. */
export function QuizPreview({ quiz, name }: { quiz: LessonQuiz; name: string }) {
    return <section className="knowledge-check preview" aria-label="Knowledge check preview">
        <div className="knowledge-check-head"><span className="knowledge-check-icon"><ListChecks size={18} aria-hidden="true"/></span><div><h3>Knowledge check</h3><p>{quizSummary(quiz)}</p></div></div>
        <QuizQuestions quiz={quiz} name={name} answers={{}}/>
        <p className="knowledge-check-privacy">Learners answer after reading. Correct answers stay on the server{quiz.revealAnswers ? ' until a learner passes or uses every attempt' : ''}.</p>
    </section>;
}
