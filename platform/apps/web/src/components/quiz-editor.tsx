import { useId } from 'react';
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { pointsLabel } from './quiz-view';
import { newId } from '../../../../packages/contracts/src/index';
import {
    MAX_QUIZ_ATTEMPTS, MAX_QUIZ_OPTIONS, MAX_QUIZ_QUESTIONS, lessonQuizSchema, questionKinds, quizMaxScore, type AuthoredQuiz, type QuestionKind,
} from '../../../../packages/contracts/src/assessments';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { OptionalRadioGroup, RadioGroupItem } from './ui/radio-group';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { useConfirm } from './confirm';

type Question = AuthoredQuiz['questions'][number];
type Option = Question['options'][number];
const isChoice = (kind: QuestionKind) => kind === 'single' || kind === 'multiple';
const nextOptionId = (options: Option[]) => [...'abcdefghijklmnopqrstuvwxyz'].find(l => !options.some(o => o.id === l)) ?? newId();

export function blankQuestion(kind: QuestionKind = 'single'): Question {
    return {
        id: `q_${newId().replaceAll('-', '').slice(0, 12)}`, kind, prompt: '', points: 1,
        options: isChoice(kind) ? [{ id: 'a', text: '', correct: true }, { id: 'b', text: '', correct: false }] : [],
        acceptedAnswers: kind === 'short' ? [''] : [], explanation: '',
    };
}
/** Change a question's type and keep whatever still applies, so switching back and forth loses little. */
export function convertQuestion(q: Question, kind: QuestionKind): Question {
    if (kind === q.kind) return q;
    if (isChoice(kind)) {
        const options = isChoice(q.kind) ? q.options : blankQuestion(kind).options;
        const first = Math.max(0, options.findIndex(o => o.correct));
        return { ...q, kind, acceptedAnswers: [], options: kind === 'single' ? options.map((o, i) => ({ ...o, correct: i === first })) : options };
    }
    return { ...q, kind, options: [], acceptedAnswers: kind === 'short' ? (q.acceptedAnswers.length ? q.acceptedAnswers : ['']) : [] };
}
/** The same rules the server applies, phrased for authors. Empty when the check can be saved. */
export function quizProblems(quiz: AuthoredQuiz | null): string[] {
    if (!quiz) return [];
    const parsed = lessonQuizSchema.safeParse(quiz);
    return parsed.success ? [] : [...new Set(parsed.error.issues.map(i => i.message))];
}

/** Studio editor for the draft's optional knowledge check. Changes stay in the draft buffer until it is saved. */
export function QuizEditor({ quiz, disabled, onChange }: {
    quiz: AuthoredQuiz | null; disabled: boolean; onChange: (update: (current: AuthoredQuiz | null) => AuthoredQuiz | null) => void;
}) {
    const heading = useId(), confirm = useConfirm();
    const problems = quizProblems(quiz);
    const edit = (update: (current: AuthoredQuiz) => AuthoredQuiz) => onChange(current => current ? update(current) : current);
    const editQuestion = (id: string, update: (q: Question) => Question) => edit(current => ({ ...current, questions: current.questions.map(q => q.id === id ? update(q) : q) }));
    const move = (index: number, delta: number) => edit(current => { const next = [...current.questions]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return { ...current, questions: next }; });
    return <section className="quiz-editor" aria-labelledby={heading}>
        <div className="quiz-editor-head">
            <div><h3 id={heading}><ListChecks size={16} aria-hidden="true"/>Knowledge check <small>{quiz ? `${quiz.questions.length} of ${MAX_QUIZ_QUESTIONS} questions · ${pointsLabel(quizMaxScore(quiz))}` : 'Optional'}</small></h3>
                <p>Questions learners answer after the lesson. Answers are checked on the server, and learners never receive the answer key unless you choose to show it once they finish. Scores are private feedback, not completion, points or a credential.</p></div>
            {!quiz && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(() => ({ questions: [blankQuestion()], passPercentage: null, maxAttempts: null, revealAnswers: true }))}><Plus size={15} aria-hidden="true"/>Add a knowledge check</Button>}
        </div>
        {quiz && <>
            <div className="quiz-settings">
                <Label>Pass mark (%)<Input type="number" min={1} max={100} step={1} inputMode="numeric" placeholder="None" value={quiz.passPercentage ?? ''} disabled={disabled}
                    onChange={e => { const value = e.target.value; edit(current => ({ ...current, passPercentage: value === '' ? null : Math.round(Number(value)) })); }}/></Label>
                <Label>Attempts<NativeSelect value={quiz.maxAttempts ?? ''} disabled={disabled} onChange={e => { const value = e.target.value; edit(current => ({ ...current, maxAttempts: value === '' ? null : Number(value) })); }}>
                    <option value="">Unlimited</option>{Array.from({ length: MAX_QUIZ_ATTEMPTS }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                </NativeSelect></Label>
                <Label className="quiz-toggle"><Switch checked={quiz.revealAnswers} disabled={disabled} onCheckedChange={checked => { edit(current => ({ ...current, revealAnswers: checked })); }}/>
                    <span>Show correct answers and explanations once a learner passes or uses every attempt. With no pass mark, they appear after each attempt is marked.</span></Label>
            </div>
            <ol className="quiz-question-list">{quiz.questions.map((q, i) => <QuestionEditor key={q.id} question={q} index={i} count={quiz.questions.length} disabled={disabled}
                onChange={update => editQuestion(q.id, update)} onMove={delta => move(i, delta)}
                onRemove={() => edit(current => ({ ...current, questions: current.questions.filter(x => x.id !== q.id) }))}/>)}</ol>
            <div className="quiz-editor-foot">
                <Button type="button" variant="outline" size="sm" disabled={disabled || quiz.questions.length >= MAX_QUIZ_QUESTIONS} onClick={() => edit(current => ({ ...current, questions: [...current.questions, blankQuestion()] }))}><Plus size={15} aria-hidden="true"/>Add question</Button>
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={async () => { if (await confirm({ title: 'Remove the knowledge check from this draft?', body: 'Learners keep their earlier attempts, and nothing changes for them until you publish.', confirmText: 'Remove knowledge check' })) onChange(() => null); }}><Trash2 size={15} aria-hidden="true"/>Remove knowledge check</Button>
            </div>
            <p className="quiz-editor-note">Learners who already answered keep their attempts and feedback. Changes apply to new attempts once you publish.</p>
            {problems.length > 0 && <div className="quiz-problems" role="status"><strong>Before you save</strong><ul>{problems.map(p => <li key={p}>{p}</li>)}</ul></div>}
        </>}
    </section>;
}

function QuestionEditor({ question: q, index, count, disabled, onChange, onMove, onRemove }: {
    question: Question; index: number; count: number; disabled: boolean;
    onChange: (update: (q: Question) => Question) => void; onMove: (delta: number) => void; onRemove: () => void;
}) {
    const label = `question ${index + 1}`;
    const markCorrect = (id: string, checked: boolean) => onChange(x => ({ ...x, options: x.options.map(o => x.kind === 'single' ? { ...o, correct: o.id === id } : o.id === id ? { ...o, correct: checked } : o) }));
    const removeOption = (id: string) => onChange(x => {
        const options = x.options.filter(o => o.id !== id);
        return { ...x, options: x.kind === 'single' && !options.some(o => o.correct) ? options.map((o, i) => ({ ...o, correct: i === 0 })) : options };
    });
    return <li className="quiz-question-editor">
        <div className="quiz-question-editor-head">
            <strong>Question {index + 1}</strong>
            <Label>Type<NativeSelect value={q.kind} disabled={disabled} onChange={e => { const kind = e.target.value as QuestionKind; onChange(x => convertQuestion(x, kind)); }}>
                {Object.entries(questionKinds).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}
            </NativeSelect></Label>
            <Label>Points<NativeSelect value={q.points} disabled={disabled} onChange={e => { const points = Number(e.target.value); onChange(x => ({ ...x, points })); }}>
                {Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </NativeSelect></Label>
            <div className="resource-row-order">
                <button type="button" className="icon-button" aria-label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14}/></button>
                <button type="button" className="icon-button" aria-label={`Move ${label} down`} disabled={disabled || index === count - 1} onClick={() => onMove(1)}><ArrowDown size={14}/></button>
            </div>
        </div>
        <Label>Question<Textarea rows={2} maxLength={300} value={q.prompt} disabled={disabled} placeholder="What should a learner be able to answer after this lesson?" onChange={e => { const prompt = e.target.value; onChange(x => ({ ...x, prompt })); }}/></Label>
        {isChoice(q.kind) && <OptionalRadioGroup when={q.kind === 'single'} value={q.options.find(o => o.correct)?.id ?? ''} onValueChange={id => markCorrect(id, true)}><fieldset className="quiz-option-list" disabled={disabled}>
            <legend>{q.kind === 'single' ? 'Options · select the correct answer' : 'Options · tick every correct answer'}</legend>
            {q.options.map((o, j) => <div key={o.id} className="quiz-option-editor">
                {q.kind === 'single' ? <RadioGroupItem value={o.id} aria-label={`Option ${j + 1} of ${label} is correct`}/> : <Checkbox checked={o.correct} aria-label={`Option ${j + 1} of ${label} is correct`} onCheckedChange={on => markCorrect(o.id, on === true)}/>}
                <Input value={o.text} maxLength={150} aria-label={`Option ${j + 1} of ${label}`} placeholder={`Option ${j + 1}`} onChange={e => { const text = e.target.value; onChange(x => ({ ...x, options: x.options.map(y => y.id === o.id ? { ...y, text } : y) })); }}/>
                <button type="button" className="icon-button" aria-label={`Remove option ${j + 1} of ${label}`} disabled={q.options.length <= 2} onClick={() => removeOption(o.id)}><X size={14}/></button>
            </div>)}
            <Button type="button" variant="ghost" size="sm" disabled={q.options.length >= MAX_QUIZ_OPTIONS} onClick={() => onChange(x => ({ ...x, options: [...x.options, { id: nextOptionId(x.options), text: '', correct: false }] }))}><Plus size={14} aria-hidden="true"/>Add option</Button>
        </fieldset></OptionalRadioGroup>}
        {q.kind === 'short' && <fieldset className="quiz-option-list" disabled={disabled}>
            <legend>Accepted answers · matched ignoring capital letters and extra spaces</legend>
            {q.acceptedAnswers.map((answer, j) => <div key={j} className="quiz-option-editor">
                <Input value={answer} maxLength={120} aria-label={`Accepted answer ${j + 1} for ${label}`} placeholder="An answer you accept" onChange={e => { const text = e.target.value; onChange(x => ({ ...x, acceptedAnswers: x.acceptedAnswers.map((y, k) => k === j ? text : y) })); }}/>
                <button type="button" className="icon-button" aria-label={`Remove accepted answer ${j + 1} for ${label}`} disabled={q.acceptedAnswers.length <= 1} onClick={() => onChange(x => ({ ...x, acceptedAnswers: x.acceptedAnswers.filter((_, k) => k !== j) }))}><X size={14}/></button>
            </div>)}
            <Button type="button" variant="ghost" size="sm" disabled={q.acceptedAnswers.length >= 10} onClick={() => onChange(x => ({ ...x, acceptedAnswers: [...x.acceptedAnswers, ''] }))}><Plus size={14} aria-hidden="true"/>Add accepted answer</Button>
        </fieldset>}
        {q.kind === 'written' && <p className="quiz-editor-note">An owner or administrator marks written responses and sends feedback. The learner can try again once it is reviewed.</p>}
        <Label>Explanation shown with the answers (optional)<Textarea rows={2} maxLength={300} value={q.explanation} disabled={disabled} onChange={e => { const explanation = e.target.value; onChange(x => ({ ...x, explanation })); }}/></Label>
        <div className="resource-row-actions"><Button type="button" variant="ghost" size="sm" disabled={disabled || count <= 1} aria-label={`Remove ${label}`} onClick={onRemove}><Trash2 size={14} aria-hidden="true"/>Remove question</Button></div>
    </li>;
}
