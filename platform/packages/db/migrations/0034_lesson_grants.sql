-- Additive per-lesson grants. A teaching grant may list the lessons it covers; NULL keeps the whole track, so every
-- existing grant is unchanged. A grant for some lessons never covers a new lesson, the order or the cover: those belong to
-- the whole track. 0001 to 0023 are unchanged; the 0012 and 0023 policies below are replaced with scoped versions.
ALTER TABLE track_instructors ADD COLUMN lesson_ids jsonb CHECK (lesson_ids IS NULL OR (jsonb_typeof(lesson_ids)='array' AND jsonb_array_length(lesson_ids) BETWEEN 1 AND 200));
-- Drafts: a draft of a new lesson has no lesson, so only a whole-track grant reaches it.
DROP POLICY instructor_drafts ON lesson_drafts;
CREATE POLICY instructor_drafts ON lesson_drafts USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_drafts.organization_id AND i.track_id=lesson_drafts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(lesson_drafts.lesson_id)))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_drafts.organization_id AND i.track_id=lesson_drafts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(lesson_drafts.lesson_id)))
);
DROP POLICY instructor_revision_read ON lesson_revisions;
CREATE POLICY instructor_revision_read ON lesson_revisions FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_revisions.organization_id AND i.track_id=lesson_revisions.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(lesson_revisions.lesson_id)))
);
DROP POLICY instructor_revision_insert ON lesson_revisions;
CREATE POLICY instructor_revision_insert ON lesson_revisions FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_revisions.organization_id AND i.track_id=lesson_revisions.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
  AND (i.role='instructor' OR lesson_revisions.kind='captured')
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(lesson_revisions.lesson_id)))
);
DROP POLICY instructor_attempt_read ON quiz_attempts;
CREATE POLICY instructor_attempt_read ON quiz_attempts FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND i.role='instructor'
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(quiz_attempts.lesson_id)))
);
DROP POLICY instructor_attempt_review ON quiz_attempts;
CREATE POLICY instructor_attempt_review ON quiz_attempts FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id<>nullif(current_setting('app.user_id',true),'')
 AND status<>'reviewed'
 AND EXISTS(SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
  WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND i.role='instructor'
  AND (i.lesson_ids IS NULL OR i.lesson_ids @> jsonb_build_array(quiz_attempts.lesson_id)))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='reviewed' AND version=2
 AND reviewer_id=nullif(current_setting('app.user_id',true),'') AND user_id<>reviewer_id
);
-- An invitation to teach still grants the whole track.
DROP POLICY instructor_invited ON track_instructors;
CREATE POLICY instructor_invited ON track_instructors FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
 AND role='instructor' AND lesson_ids IS NULL
 AND EXISTS(SELECT 1 FROM invitations i WHERE i.token_hash=nullif(current_setting('app.invitation_hash',true),'')
  AND i.status='pending' AND i.expires_at>now() AND i.organization_id=track_instructors.organization_id
  AND i.track_id=track_instructors.track_id AND i.created_by=track_instructors.granted_by
  AND EXISTS(SELECT 1 FROM auth_user a WHERE a.id=track_instructors.user_id AND lower(a.email)=i.email))
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=track_instructors.organization_id AND m.user_id=track_instructors.granted_by
  AND m.status='active' AND m.role IN ('owner','admin'))
);
