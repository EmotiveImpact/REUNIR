-- Additive authoring. Drafts and history are not exposed to learners.
-- Defer curriculum position checks until all reordered lessons have been persisted.
ALTER TABLE lessons DROP CONSTRAINT lessons_organization_id_track_id_position_key;
ALTER TABLE lessons ADD CONSTRAINT lessons_curriculum_position_key UNIQUE(organization_id,track_id,position) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE lesson_drafts (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 track_id text NOT NULL, lesson_id text, title text NOT NULL, summary text NOT NULL, body text NOT NULL,
 minutes integer NOT NULL CHECK(minutes BETWEEN 1 AND 240), resource_url text NOT NULL,
 version integer NOT NULL CHECK(version>0), published_version integer CHECK(published_version>0 AND published_version<=version),
 archived boolean NOT NULL, created_by text NOT NULL, updated_by text NOT NULL, updated_at timestamptz NOT NULL,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,lesson_id), UNIQUE(organization_id,id,track_id,lesson_id),
 FOREIGN KEY(organization_id,track_id) REFERENCES tracks(organization_id,id),
 FOREIGN KEY(organization_id,track_id,lesson_id) REFERENCES lessons(organization_id,track_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY(organization_id,updated_by) REFERENCES members(organization_id,user_id),
 CHECK(char_length(title)<=120 AND char_length(summary)<=240 AND char_length(body)<=20000 AND char_length(resource_url)<=2000),
 CHECK(published_version IS NULL OR lesson_id IS NOT NULL)
);
CREATE TABLE lesson_revisions (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 track_id text NOT NULL, lesson_id text NOT NULL, draft_id text NOT NULL,
 title text NOT NULL, summary text NOT NULL, body text NOT NULL, minutes integer NOT NULL CHECK(minutes BETWEEN 1 AND 240), resource_url text NOT NULL,
 sequence integer NOT NULL CHECK(sequence>0), kind text NOT NULL CHECK(kind IN ('captured','published')), actor_id text NOT NULL,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,lesson_id,sequence),
 FOREIGN KEY(organization_id,track_id,lesson_id) REFERENCES lessons(organization_id,track_id,id),
 FOREIGN KEY(organization_id,draft_id,track_id,lesson_id) REFERENCES lesson_drafts(organization_id,id,track_id,lesson_id),
 FOREIGN KEY(organization_id,actor_id) REFERENCES members(organization_id,user_id)
);
CREATE INDEX lesson_drafts_track_idx ON lesson_drafts(organization_id,track_id,archived);
CREATE INDEX lesson_revisions_lesson_idx ON lesson_revisions(organization_id,lesson_id,sequence);
ALTER TABLE lesson_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE lesson_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_revisions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON lesson_drafts,lesson_revisions FROM PUBLIC;
CREATE POLICY author_only ON lesson_drafts USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=lesson_drafts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=lesson_drafts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
CREATE POLICY author_read ON lesson_revisions FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=lesson_revisions.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
CREATE POLICY author_insert ON lesson_revisions FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=lesson_revisions.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
