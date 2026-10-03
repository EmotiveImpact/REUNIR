-- Additive teaching roles. A grant is for an instructor, who publishes and reviews, or a contributor, who writes the
-- track's drafts and files for an instructor to publish. Every existing grant stays an instructor's: nobody loses or gains
-- anything on upgrade. Grants are still never updated in place; changing a role replaces the row. 0001 to 0021 are unchanged.
ALTER TABLE track_instructors ADD COLUMN role text NOT NULL DEFAULT 'instructor' CHECK (role IN ('instructor','contributor'));
-- Drafts, history reads and lesson files keep the 0012 policies, which admit any grant for the row's own track.
-- Publishing writes a published revision: instructors only. A contributor opening the first draft of an existing lesson
-- records its captured baseline, which publishes nothing.
DROP POLICY instructor_revision_insert ON lesson_revisions;
CREATE POLICY instructor_revision_insert ON lesson_revisions FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_revisions.organization_id AND i.track_id=lesson_revisions.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
  AND (i.role='instructor' OR lesson_revisions.kind='captured'))
);
-- Knowledge-check attempts and their review stay with instructors.
DROP POLICY instructor_attempt_read ON quiz_attempts;
CREATE POLICY instructor_attempt_read ON quiz_attempts FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND i.role='instructor')
);
DROP POLICY instructor_attempt_review ON quiz_attempts;
CREATE POLICY instructor_attempt_review ON quiz_attempts FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id<>nullif(current_setting('app.user_id',true),'')
 AND status<>'reviewed'
 AND EXISTS(SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
  WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND i.role='instructor')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='reviewed' AND version=2
 AND reviewer_id=nullif(current_setting('app.user_id',true),'') AND user_id<>reviewer_id
);
-- An invitation to teach still makes an instructor, exactly as in 0020; it cannot be accepted as any other role.
DROP POLICY instructor_invited ON track_instructors;
CREATE POLICY instructor_invited ON track_instructors FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
 AND role='instructor'
 AND EXISTS(SELECT 1 FROM invitations i WHERE i.token_hash=nullif(current_setting('app.invitation_hash',true),'')
  AND i.status='pending' AND i.expires_at>now() AND i.organization_id=track_instructors.organization_id
  AND i.track_id=track_instructors.track_id AND i.created_by=track_instructors.granted_by
  AND EXISTS(SELECT 1 FROM auth_user a WHERE a.id=track_instructors.user_id AND lower(a.email)=i.email))
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=track_instructors.organization_id AND m.user_id=track_instructors.granted_by
  AND m.status='active' AND m.role IN ('owner','admin'))
);
