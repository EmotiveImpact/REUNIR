import type { QuizAttempt, TenantContext, Workspace } from '../../contracts/src/index';
import { learnerQuiz, questionKinds, type QuizQuestion } from '../../contracts/src/assessments';
import { actorFor } from './access';
import { answersUnlocked } from './assessments';
import { visibleWorkspace } from './engine';
import { teaches } from './instructors';

/**
 * A member's own learning in one community, as a file they can keep: tracks they joined, lessons they completed,
 * their knowledge-check attempts with marks and feedback, and their mission submissions. Every record of theirs in the
 * community is included, even where a track has since been unpublished or moved to a space they cannot open. Titles and
 * names come from the member's own view, with neutral wording where they can no longer see something; answer keys follow
 * the same reveal rule as the screen; nothing about other members is included beyond the names of people who reviewed them.
 */
export const LEARNING_RECORD_FORMAT = 'reunir.learning-record';
export interface LearningRecordAnswer {
    question: string; kind: string; points: number;
    /** Option texts the member chose, and anything they wrote. */
    chosen: string[]; text: string;
    /** Null until a reviewer marks a written answer. */
    correct: boolean | null; awarded: number | null;
    /** Present only when the reveal rule allows it for this attempt. */
    correctOptions?: string[]; acceptedAnswers?: string[]; explanation?: string;
}
export interface LearningRecordAttempt {
    track: string; lesson: string; attempt: number; submittedAt: string; status: QuizAttempt['status'];
    score: number; maxScore: number; passed: boolean | null;
    feedback: string; reviewedBy: string | null; reviewedAt: string | null;
    answers: LearningRecordAnswer[];
}
export interface LearningRecord {
    format: typeof LEARNING_RECORD_FORMAT; version: 1; generatedAt: string;
    community: { name: string; slug: string };
    member: { name: string; memberSince: string };
    enrolments: { track: string; enrolledAt: string }[];
    completedLessons: { track: string; lesson: string; completedAt: string }[];
    knowledgeChecks: LearningRecordAttempt[];
    missions: { mission: string; status: string; text: string; link: string; feedback: string; reviewedBy: string | null; updatedAt: string }[];
}

const UNAVAILABLE_TRACK = 'A track you can no longer open';
const UNAVAILABLE_LESSON = 'A lesson you can no longer open';
const chronological = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);
/** Keys travel with a question only after the reveal rule allows them; learner copies carry none of these properties. */
const keyed = (q: QuizQuestion) => q.options.some(o => 'correct' in o) || 'acceptedAnswers' in q || 'explanation' in q;

function answers(attempt: QuizAttempt): LearningRecordAnswer[] {
    return attempt.quiz.questions.map(q => {
        const given = attempt.answers.find(a => a.questionId === q.id), result = attempt.results.find(r => r.questionId === q.id);
        const entry: LearningRecordAnswer = {
            question: q.prompt, kind: questionKinds[q.kind], points: q.points,
            chosen: (given?.optionIds ?? []).map(id => q.options.find(o => o.id === id)?.text ?? 'An option that was removed'),
            text: given?.text ?? '', correct: result?.correct ?? null, awarded: result?.points ?? null,
        };
        if (keyed(q)) Object.assign(entry, { correctOptions: q.options.filter(o => o.correct).map(o => o.text), acceptedAnswers: q.acceptedAnswers ?? [], explanation: q.explanation ?? '' });
        return entry;
    });
}

export function learningRecord(state: Workspace, ctx: TenantContext, now: string): LearningRecord {
    const actor = actorFor(state, ctx);
    const s = visibleWorkspace(state, ctx), me = actor.userId, org = actor.organizationId;
    const own = <T extends { organizationId: string }>(rows: T[], owner: (row: T) => string) => rows.filter(r => r.organizationId === org && owner(r) === me);
    // The member's own attempts, with keys only where the screen would show them.
    const attempts = own(state.quizAttempts, a => a.userId);
    const shown = (a: QuizAttempt) => teaches(state, actor, a.trackId, a.lessonId) || answersUnlocked(attempts, a) ? a : { ...a, quiz: learnerQuiz(a.quiz) };
    const track = (id: string | null) => s.tracks.find(t => t.id === id)?.title ?? UNAVAILABLE_TRACK;
    const lesson = (id: string) => s.lessons.find(l => l.id === id)?.title ?? UNAVAILABLE_LESSON;
    // Names come from the member's own view of the directory, as on screen.
    const person = (id: string | null) => id ? s.members.find(m => m.userId === id)?.name ?? 'A member no longer listed' : null;
    return {
        format: LEARNING_RECORD_FORMAT, version: 1, generatedAt: now,
        community: { name: s.organisation.name, slug: s.organisation.slug },
        member: { name: actor.name, memberSince: actor.createdAt },
        enrolments: own(state.enrolments, e => e.userId).sort(chronological).map(e => ({ track: track(e.trackId), enrolledAt: e.createdAt })),
        completedLessons: own(state.completions, c => c.userId).sort(chronological).map(c => ({ track: track(c.trackId), lesson: lesson(c.lessonId), completedAt: c.createdAt })),
        knowledgeChecks: attempts.sort(chronological).map(shown).map(a => ({
            track: track(a.trackId), lesson: lesson(a.lessonId), attempt: a.attemptNumber, submittedAt: a.createdAt, status: a.status,
            score: a.score, maxScore: a.maxScore, passed: a.passed, feedback: a.feedback, reviewedBy: person(a.reviewerId), reviewedAt: a.reviewedAt,
            answers: answers(a),
        })),
        missions: own(state.submissions, x => x.authorId).sort(chronological).map(x => ({
            mission: s.missions.find(m => m.id === x.missionId)?.title ?? 'A mission you can no longer open',
            status: x.status, text: x.body, link: x.url, feedback: x.feedback, reviewedBy: person(x.reviewerId), updatedAt: x.updatedAt,
        })),
    };
}
/** A safe, dated file name for the download. */
export const learningRecordFilename = (slug: string, now: string) => `reunir-learning-record-${slug.replace(/[^a-z0-9-]/g, '')}-${now.slice(0, 10)}.json`;
