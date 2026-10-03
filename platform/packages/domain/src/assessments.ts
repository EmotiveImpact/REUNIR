import { DomainError, type Command, type Member, type QuizAttempt, type TenantContext, type Workspace } from '../../contracts/src/index';
import { MAX_SHORT_ANSWER, learnerQuiz, quizFingerprint, quizPercentage, scoreQuiz, type AuthoredQuiz, type LessonQuiz, type QuizAnswer } from '../../contracts/src/assessments';
import { actorFor, canSeeSpace, isAdmin, isFormer } from './access';
import { taughtTracks, teaches, teachesAny } from './instructors';

/** A learner's records per lesson are bounded even when a quiz allows unlimited attempts. */
export const MAX_ATTEMPT_RECORDS = 50;

/** Canonical key order, so stored and submitted quizzes compare equal whatever order the database returns. */
export function normaliseQuiz(quiz: LessonQuiz | null | undefined): AuthoredQuiz | null {
    if (!quiz) return null;
    return {
        questions: quiz.questions.map(q => ({ id: q.id, kind: q.kind, prompt: q.prompt, points: q.points, options: q.options.map(o => ({ id: o.id, text: o.text, correct: !!o.correct })), acceptedAnswers: [...(q.acceptedAnswers ?? [])], explanation: q.explanation ?? '' })),
        passPercentage: quiz.passPercentage, maxAttempts: quiz.maxAttempts, revealAnswers: quiz.revealAnswers,
    };
}

/**
 * Correct answers and explanations for a final attempt appear only when the author allows it and the learner
 * has passed, has used every attempt, or the check has no pass mark to reach.
 */
export function answersUnlocked(attempts: QuizAttempt[], attempt: QuizAttempt): boolean {
    if (!attempt.quiz.revealAnswers || attempt.status === 'awaiting_review') return false;
    const same = attempts.filter(a => a.organizationId === attempt.organizationId && a.userId === attempt.userId && a.lessonId === attempt.lessonId);
    return attempt.quiz.passPercentage === null || same.some(a => a.passed === true) || (attempt.quiz.maxAttempts !== null && same.length >= attempt.quiz.maxAttempts);
}

/**
 * Learners never receive answer keys from lessons; their own attempts carry keys only once unlocked. People who teach
 * a track (its instructors and the community's administrators) see its keys and every attempt on its lessons.
 */
export function filterAssessments(state: Workspace, actor: Member): Workspace {
    const taught = taughtTracks(state, actor);
    for (const lesson of state.lessons) if (lesson.quiz && !taught.has(lesson.trackId)) lesson.quiz = learnerQuiz(lesson.quiz);
    const lessons = new Set(state.lessons.map(l => l.id));
    const tenant = state.quizAttempts.filter(a => a.organizationId === actor.organizationId && lessons.has(a.lessonId));
    state.quizAttempts = tenant.filter(a => taught.has(a.trackId) || a.userId === actor.userId)
        .map(a => taught.has(a.trackId) || answersUnlocked(tenant, a) ? a : { ...a, quiz: learnerQuiz(a.quiz) });
    return state;
}

export function applyAssessment(s: Workspace, ctx: TenantContext, cmd: Command, now: string, makeId: () => string) {
    if (cmd.type !== 'quiz.attempt.submit' && cmd.type !== 'quiz.attempt.review') return undefined;
    const actor = actorFor(s, ctx), org = ctx.organizationId;
    const gone = (message = 'That knowledge check is not available.'): never => { throw new DomainError('NOT_FOUND', message, 404); };
    const open = (lessonId: string) => {
        const lesson = s.lessons.find(l => l.id === lessonId && l.organizationId === org);
        const track = lesson && s.tracks.find(t => t.id === lesson.trackId && t.organizationId === org);
        if (!lesson || !track || !(lesson.published || isAdmin(actor)) || !(track.published || isAdmin(actor)) || !canSeeSpace(s, actor, track.spaceId)) return gone();
        return { lesson, track };
    };
    const notify = (userId: string, title: string, body: string, href: string) => { if (userId !== ctx.userId && !isFormer(s, userId)) s.notifications.push({ id: makeId(), organizationId: org, createdAt: now, userId, title, body, href, readAt: null }); };
    if (cmd.type === 'quiz.attempt.submit') {
        const { lesson, track } = open(cmd.lessonId);
        const quiz = lesson.quiz ?? gone('This lesson has no knowledge check.');
        if (!s.enrolments.some(e => e.organizationId === org && e.trackId === track.id && e.userId === ctx.userId)) throw new DomainError('ENROL_FIRST', 'Join this learning track first.', 409);
        const mine = s.quizAttempts.filter(a => a.organizationId === org && a.lessonId === lesson.id && a.userId === ctx.userId);
        if (mine.some(a => a.status === 'awaiting_review')) throw new DomainError('AWAITING_REVIEW', 'Your last attempt is waiting for feedback. You can try again once it has been reviewed.', 409);
        if (mine.length >= (quiz.maxAttempts ?? MAX_ATTEMPT_RECORDS)) throw new DomainError('NO_ATTEMPTS_LEFT', 'You have used every attempt for this knowledge check.', 409);
        const stale = (): never => { throw new DomainError('STALE_QUIZ', 'This knowledge check changed after you opened it. Check the latest version and submit again.', 409); };
        if (cmd.fingerprint !== quizFingerprint(quiz) || cmd.answers.length !== quiz.questions.length) stale();
        const answers: QuizAnswer[] = quiz.questions.map(q => {
            const given = cmd.answers.find(a => a.questionId === q.id) ?? stale();
            const optionIds = [...new Set(given.optionIds)], text = given.text.trim();
            if (q.kind === 'single' || q.kind === 'multiple') {
                if (text || optionIds.some(id => !q.options.some(o => o.id === id))) stale();
                if (!optionIds.length || (q.kind === 'single' && optionIds.length > 1)) throw new DomainError('INCOMPLETE_ATTEMPT', q.kind === 'single' ? 'Choose one option for each single-choice question.' : 'Choose at least one option for each multiple-choice question.');
                return { questionId: q.id, optionIds, text: '' };
            }
            if (optionIds.length) stale();
            if (!text) throw new DomainError('INCOMPLETE_ATTEMPT', 'Answer every question before submitting.');
            if (q.kind === 'short' && text.length > MAX_SHORT_ANSWER) throw new DomainError('INCOMPLETE_ATTEMPT', `Keep short answers under ${MAX_SHORT_ANSWER} characters.`);
            return { questionId: q.id, optionIds: [], text };
        });
        const scored = scoreQuiz(quiz, answers), status = scored.needsReview ? 'awaiting_review' as const : 'scored' as const;
        const percentage = quizPercentage(scored.autoScore, scored.maxScore);
        const passed = status === 'scored' && quiz.passPercentage !== null ? percentage >= quiz.passPercentage : null;
        const attempt: QuizAttempt = { id: makeId(), organizationId: org, createdAt: now, lessonId: lesson.id, trackId: track.id, userId: ctx.userId, attemptNumber: mine.length + 1, quiz: normaliseQuiz(quiz)!, answers, results: scored.results, score: scored.autoScore, maxScore: scored.maxScore, status, passed, feedback: '', reviewerId: null, reviewedAt: null, version: 1 };
        s.quizAttempts.push(attempt);
        if (status === 'awaiting_review') for (const m of s.members.filter(m => m.organizationId === org && m.status === 'active' && teaches(s, m, track.id))) notify(m.userId, 'A knowledge check needs feedback', `${actor.name} answered the check in ${lesson.title}.`, isAdmin(m) ? '/admin/knowledge-checks' : '/teaching');
        const message = status === 'awaiting_review' ? 'Submitted. A reviewer will mark your written answers and send feedback.'
            : `You scored ${scored.autoScore} of ${scored.maxScore} (${percentage}%).${passed === true ? ' You passed.' : passed === false ? ` The pass mark is ${quiz.passPercentage}%.` : ''}`;
        return { objectId: attempt.id, message, changed: true, audit: false };
    }
    if (!teachesAny(s, actor)) throw new DomainError('REVIEWER_REQUIRED', 'Only a track instructor or a community owner or administrator can review knowledge checks.', 403);
    const attempt = s.quizAttempts.find(a => a.id === cmd.attemptId && a.organizationId === org) ?? gone();
    // An instructor of another track is told nothing about this attempt.
    if (!teaches(s, actor, attempt.trackId)) gone();
    open(attempt.lessonId);
    if (attempt.userId === ctx.userId) throw new DomainError('SELF_REVIEW', 'You cannot review your own knowledge check.', 403);
    if (attempt.version !== cmd.expectedVersion) throw new DomainError('STALE_ATTEMPT', 'This attempt changed. Reload it before reviewing.', 409);
    if (attempt.status === 'reviewed') throw new DomainError('ALREADY_REVIEWED', 'This attempt has already been reviewed.', 409);
    const written = attempt.quiz.questions.filter(q => q.kind === 'written');
    if (cmd.marks.length !== written.length || new Set(cmd.marks.map(m => m.questionId)).size !== cmd.marks.length || cmd.marks.some(m => !written.some(q => q.id === m.questionId))) throw new DomainError('INVALID_MARKS', 'Mark every written answer, and only written answers.');
    for (const m of cmd.marks) { const max = written.find(q => q.id === m.questionId)!.points; if (m.points > max) throw new DomainError('INVALID_MARKS', `A written answer here can earn at most ${max} ${max === 1 ? 'point' : 'points'}.`); }
    attempt.results = attempt.results.map(r => { const mark = cmd.marks.find(m => m.questionId === r.questionId); return mark ? { ...r, points: mark.points } : r; });
    attempt.score = attempt.results.reduce((total, r) => total + (r.points ?? 0), 0);
    attempt.passed = attempt.quiz.passPercentage !== null ? quizPercentage(attempt.score, attempt.maxScore) >= attempt.quiz.passPercentage : null;
    Object.assign(attempt, { status: 'reviewed', feedback: cmd.feedback, reviewerId: ctx.userId, reviewedAt: now, version: attempt.version + 1 });
    notify(attempt.userId, 'Feedback on your knowledge check', `${actor.name} reviewed your answers.`, `/learn/${attempt.trackId}/${attempt.lessonId}`);
    return { objectId: attempt.id, message: 'Feedback sent. The learner sees it with their answers.', changed: true, audit: true };
}
