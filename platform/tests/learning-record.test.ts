import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Workspace } from '../packages/contracts/src/index';
import { quizFingerprint, type QuizAnswer } from '../packages/contracts/src/assessments';
import { applyCommand, visibleWorkspace } from '../packages/domain/src/engine';
import { createSeed, DEMO_ADMIN, DEMO_USER } from '../packages/domain/src/seed';
import { LEARNING_RECORD_FORMAT, learningRecord, learningRecordFilename } from '../packages/domain/src/learning-record';

const ORG = 'org_code_black', NOW = '2026-10-03T12:00:00.000Z';
let seq = 0;
const ctx = (userId = DEMO_USER, organizationId = ORG) => ({ organizationId, userId, requestId: 'learning-record-test' });
const run = (s: Workspace, cmd: unknown, user = DEMO_USER) => applyCommand(s, ctx(user), cmd, () => NOW, () => `record_${++seq}`).workspace;
function submit(s: Workspace, lessonId: string, answers: QuizAnswer[], user = DEMO_USER) {
    const seen = visibleWorkspace(s, ctx(user)).lessons.find(l => l.id === lessonId)!.quiz!;
    return run(s, { type: 'quiz.attempt.submit', lessonId, fingerprint: quizFingerprint(seen), answers }, user);
}
const right: QuizAnswer[] = [
    { questionId: 'q5_feedback', optionIds: ['a'], text: '' },
    { questionId: 'q5_essentials', optionIds: ['a', 'b'], text: '' },
    { questionId: 'q5_outcome', optionIds: [], text: 'useful' },
];
const wrong: QuizAnswer[] = [
    { questionId: 'q5_feedback', optionIds: ['b'], text: '' },
    { questionId: 'q5_essentials', optionIds: ['c'], text: '' },
    { questionId: 'q5_outcome', optionIds: [], text: 'impressive' },
];

test('a member’s record holds their own enrolments, completed lessons and community, with a dated file name', () => {
    const r = learningRecord(createSeed(), ctx(), NOW);
    assert.equal(r.format, LEARNING_RECORD_FORMAT); assert.equal(r.version, 1); assert.equal(r.generatedAt, NOW);
    assert.deepEqual(r.community, { name: 'Code Black', slug: 'code-black' });
    assert.equal(r.member.name, 'Alex Morgan');
    assert.deepEqual(r.enrolments.map(e => e.track), ['From idea to first version']);
    assert.deepEqual(r.completedLessons.map(c => [c.track, c.lesson]), [['From idea to first version', 'Choose one real problem']]);
    assert.deepEqual([r.knowledgeChecks, r.missions], [[], []]);
    assert.equal(learningRecordFilename('code-black', NOW), 'reunir-learning-record-code-black-2026-10-03.json');
    assert.equal(learningRecordFilename('../evil', NOW), 'reunir-learning-record-evil-2026-10-03.json');
});
test('nothing about other members travels, apart from the name of whoever reviewed you', () => {
    const s = createSeed();
    const alex = JSON.stringify(learningRecord(s, ctx(), NOW));
    for (const other of ['Sofia', 'save progress automatically', 'attempt_sofia', 'member_sofia', 'enrol_sofia', 'organisation', 'org_code_black']) assert(!alex.includes(other), other);
    const sofia = learningRecord(s, ctx('member_sofia'), NOW);
    assert.equal(sofia.knowledgeChecks.length, 1);
    assert.equal(sofia.knowledgeChecks[0].status, 'awaiting_review');
    assert(!JSON.stringify(sofia).includes('Alex'), 'not another learner’s enrolment or completion');
});
test('attempts carry the member’s answers and marks; keys appear only once the reveal rule allows them', () => {
    let s = createSeed();
    s = submit(s, 'lesson_5', wrong);
    let attempt = learningRecord(s, ctx(), NOW).knowledgeChecks[0];
    assert.deepEqual([attempt.lesson, attempt.attempt, attempt.status, attempt.passed], ['Cut it down to the useful part', 1, 'scored', false]);
    assert.deepEqual(attempt.answers.map(a => [a.kind, a.chosen, a.text, a.correct]), [['Single choice', ['How many features are planned'], '', false], ['Multiple choice', ['Five half-finished features'], '', false], ['Short answer', [], 'impressive', false]]);
    assert(attempt.answers.every(a => !('correctOptions' in a) && !('acceptedAnswers' in a) && !('explanation' in a)), 'not passed and attempts remain: no keys');
    s = submit(s, 'lesson_5', right);
    const [first, second] = learningRecord(s, ctx(), NOW).knowledgeChecks;
    assert.equal(second.passed, true);
    assert.deepEqual(second.answers[1].correctOptions, ['One complete path to a useful outcome', 'The essentials for the person’s problem']);
    assert.deepEqual(second.answers[2].acceptedAnswers, ['useful']);
    assert.equal(second.answers[2].explanation, 'The path ends in a useful outcome for one real person.');
    assert(first.answers.every(a => 'correctOptions' in a), 'once passed, earlier attempts unlock too, as on screen');
    attempt = learningRecord(s, ctx(), NOW).knowledgeChecks[1];
    assert.equal(attempt.score, attempt.maxScore);
});
test('a written answer shows its feedback and reviewer once marked, and a hidden check never reveals its key', () => {
    let s = createSeed();
    let sofia = learningRecord(s, ctx('member_sofia'), NOW).knowledgeChecks[0];
    assert.deepEqual([sofia.feedback, sofia.reviewedBy, sofia.answers[1].correct, sofia.answers[1].awarded], ['', null, null, null]);
    s = run(s, { type: 'quiz.attempt.review', attemptId: 'attempt_sofia', expectedVersion: 1, marks: [{ questionId: 'q6_change', points: 3 }], feedback: 'Specific and observed.' }, DEMO_ADMIN);
    sofia = learningRecord(s, ctx('member_sofia'), NOW).knowledgeChecks[0];
    assert.deepEqual([sofia.status, sofia.feedback, sofia.reviewedBy, sofia.answers[1].awarded], ['reviewed', 'Specific and observed.', 'Amina Okafor', 3]);
    assert(sofia.answers.every(a => !('correctOptions' in a)), 'lesson 6 never reveals answers to learners');
});
test('records keep everything that is the member’s own, naming only what they can still open', () => {
    let s = submit(createSeed(), 'lesson_5', wrong);
    s.tracks.find(t => t.id === 'track_product')!.published = false;
    const r = learningRecord(s, ctx(), NOW);
    assert.deepEqual(r.enrolments.map(e => e.track), ['A track you can no longer open']);
    assert.equal(r.completedLessons.length, 1);
    assert.equal(r.knowledgeChecks.length, 1, 'an attempt on a lesson they can no longer open is still theirs');
    assert(r.knowledgeChecks[0].answers.every(a => !('correctOptions' in a)), 'and its keys stay hidden by the same rule');
    assert(!JSON.stringify(r).includes('From idea to first version'));
    s = submit(run(createSeed(), { type: 'track.enrol', trackId: 'track_product' }, 'member_jordan'), 'lesson_5', wrong, 'member_jordan');
    assert.deepEqual(learningRecord(s, ctx(), NOW).knowledgeChecks, [], 'another member’s attempt never appears');
    assert.throws(() => learningRecord(createSeed(), ctx(DEMO_USER, 'org_studio_north'), NOW), { code: 'NOT_FOUND' });
    const suspended = createSeed(); suspended.members.find(m => m.userId === DEMO_USER)!.status = 'suspended';
    assert.throws(() => learningRecord(suspended, ctx(), NOW), { code: 'FORBIDDEN' });
});
test('mission submissions carry their text, link, status and feedback', () => {
    let s = createSeed();
    s = run(s, { type: 'mission.submit', missionId: 'mission_prototype', body: 'A paper prototype tried by one person; I removed the sign-up step after watching.', url: 'https://example.test/prototype' });
    const [mission] = learningRecord(s, ctx(), NOW).missions;
    assert.deepEqual([mission.mission, mission.status, mission.link, mission.feedback, mission.reviewedBy], ['Put your first version in somebody’s hands.', 'pending', 'https://example.test/prototype', '', null]);
    assert.match(mission.text, /removed the sign-up step/);
});
