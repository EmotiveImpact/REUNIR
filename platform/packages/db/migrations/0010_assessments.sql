-- Additive knowledge checks. Existing lessons, drafts and revisions keep NULL quiz: nothing is backfilled.
ALTER TABLE lessons ADD COLUMN quiz jsonb CHECK (quiz IS NULL OR (jsonb_typeof(quiz)='object' AND octet_length(quiz::text)<=20000));
ALTER TABLE lesson_drafts ADD COLUMN quiz jsonb CHECK (quiz IS NULL OR (jsonb_typeof(quiz)='object' AND octet_length(quiz::text)<=20000));
ALTER TABLE lesson_revisions ADD COLUMN quiz jsonb CHECK (quiz IS NULL OR (jsonb_typeof(quiz)='object' AND octet_length(quiz::text)<=20000));
-- One row per submitted attempt. The quiz snapshot and answers never change; review fills the review columns once.
CREATE TABLE quiz_attempts (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 lesson_id text NOT NULL, track_id text NOT NULL, user_id text NOT NULL,
 attempt_number integer NOT NULL CHECK (attempt_number BETWEEN 1 AND 50),
 quiz jsonb NOT NULL CHECK (jsonb_typeof(quiz)='object' AND octet_length(quiz::text)<=20000),
 answers jsonb NOT NULL CHECK (jsonb_typeof(answers)='array' AND octet_length(answers::text)<=40000),
 results jsonb NOT NULL CHECK (jsonb_typeof(results)='array' AND octet_length(results::text)<=8000),
 score integer NOT NULL CHECK (score>=0), max_score integer NOT NULL CHECK (max_score>0 AND score<=max_score),
 status text NOT NULL CHECK (status IN ('scored','awaiting_review','reviewed')),
 passed boolean,
 feedback text NOT NULL CHECK (char_length(feedback)<=2000),
 reviewer_id text, reviewed_at timestamptz,
 version integer NOT NULL CHECK (version>0),
 PRIMARY KEY (organization_id,id), UNIQUE (organization_id,lesson_id,user_id,attempt_number),
 FOREIGN KEY (organization_id,track_id,lesson_id) REFERENCES lessons(organization_id,track_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,reviewer_id) REFERENCES members(organization_id,user_id),
 CHECK ((status='reviewed')=(reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK (reviewer_id IS NULL OR reviewer_id<>user_id),
 CHECK (status='reviewed' OR char_length(feedback)=0)
);
CREATE INDEX quiz_attempts_learner_idx ON quiz_attempts(organization_id,lesson_id,user_id);
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON quiz_attempts FROM PUBLIC;
-- Learners read their own attempts; active owners and admins read the tenant's attempts to review them.
CREATE POLICY attempt_read ON quiz_attempts FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (
 user_id=nullif(current_setting('app.user_id',true),'')
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=quiz_attempts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin')))
);
-- An active member submits only their own, unreviewed attempt, which always starts at version 1.
CREATE POLICY attempt_submit ON quiz_attempts FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
 AND reviewer_id IS NULL AND status<>'reviewed' AND version=1
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=quiz_attempts.organization_id AND m.user_id=quiz_attempts.user_id AND m.status='active')
);
-- Only an active owner or admin who is not the learner can review, exactly once: the row must be unreviewed before,
-- and reviewed at version 2 and attributed to them after. A finished review matches no row, so it cannot be rewritten.
CREATE POLICY attempt_review ON quiz_attempts FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id<>nullif(current_setting('app.user_id',true),'')
 AND status<>'reviewed'
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=quiz_attempts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='reviewed' AND version=2
 AND reviewer_id=nullif(current_setting('app.user_id',true),'') AND user_id<>reviewer_id
);
