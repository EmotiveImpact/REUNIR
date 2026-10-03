-- Additive track instructors. An instructor is an explicit grant by an active owner or administrator to author and
-- review one track. Being named as a track's author grants nothing, and no rows are created: nobody gains rights on upgrade.
CREATE TABLE track_instructors (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 track_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL,
 PRIMARY KEY (organization_id,id), UNIQUE (organization_id,track_id,user_id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,granted_by) REFERENCES members(organization_id,user_id)
);
CREATE INDEX track_instructors_member_idx ON track_instructors(organization_id,user_id);
ALTER TABLE track_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_instructors FORCE ROW LEVEL SECURITY;
REVOKE ALL ON track_instructors FROM PUBLIC;
-- Members of the community can see who teaches; only an active owner or administrator grants or revokes, in their own name.
CREATE POLICY instructor_read ON track_instructors FOR SELECT USING (organization_id=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY instructor_grant ON track_instructors FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND granted_by=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=track_instructors.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
CREATE POLICY instructor_revoke ON track_instructors FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=track_instructors.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
-- The policies below add instructors alongside the existing owner/admin policies. Each requires a grant for the row's
-- own track and an active membership, so suspension ends an instructor's access at once.
CREATE POLICY instructor_drafts ON lesson_drafts USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_drafts.organization_id AND i.track_id=lesson_drafts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_drafts.organization_id AND i.track_id=lesson_drafts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
CREATE POLICY instructor_revision_read ON lesson_revisions FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_revisions.organization_id AND i.track_id=lesson_revisions.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
CREATE POLICY instructor_revision_insert ON lesson_revisions FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=lesson_revisions.organization_id AND i.track_id=lesson_revisions.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
-- Lesson files: the restrictive read policy also admits instructors of the file's own track.
DROP POLICY lesson_resource_read ON upload_intents;
CREATE POLICY lesson_resource_read ON upload_intents AS RESTRICTIVE FOR SELECT USING (
 purpose<>'lesson_resource'
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM lessons l WHERE l.organization_id=upload_intents.organization_id AND l.published AND l.resources @> jsonb_build_array(jsonb_build_object('fileId',upload_intents.id)))
 OR EXISTS(SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
  WHERE i.organization_id=upload_intents.organization_id AND i.track_id=upload_intents.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
-- Knowledge-check attempts: instructors read attempts on their track and review them exactly once, never their own.
CREATE POLICY instructor_attempt_read ON quiz_attempts FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
 WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
CREATE POLICY instructor_attempt_review ON quiz_attempts FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id<>nullif(current_setting('app.user_id',true),'')
 AND status<>'reviewed'
 AND EXISTS(SELECT 1 FROM track_instructors i JOIN members m ON m.organization_id=i.organization_id AND m.user_id=i.user_id
  WHERE i.organization_id=quiz_attempts.organization_id AND i.track_id=quiz_attempts.track_id AND i.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='reviewed' AND version=2
 AND reviewer_id=nullif(current_setting('app.user_id',true),'') AND user_id<>reviewer_id
);
