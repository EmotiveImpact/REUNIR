-- Additive uploaded covers for tracks and projects. Existing records keep NULL covers and show the plain panel.
-- Nothing is backfilled; the legacy cover art names stay as stored.
ALTER TABLE tracks ADD COLUMN cover_image jsonb CHECK (cover_image IS NULL OR (jsonb_typeof(cover_image)='object' AND octet_length(cover_image::text)<=1000));
ALTER TABLE projects ADD COLUMN cover_image jsonb CHECK (cover_image IS NULL OR (jsonb_typeof(cover_image)='object' AND octet_length(cover_image::text)<=1000));
-- Covers reuse the verified upload intents. Widening the allowed purposes keeps every existing row valid.
ALTER TABLE upload_intents DROP CONSTRAINT upload_intents_purpose_check;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_purpose_check CHECK (purpose IN ('member','lesson_resource','cover_image'));
ALTER TABLE upload_intents ADD COLUMN cover_track_id text;
ALTER TABLE upload_intents ADD COLUMN cover_project_id text;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_cover_scope CHECK (CASE WHEN purpose='cover_image' THEN num_nonnulls(cover_track_id,cover_project_id)=1 ELSE cover_track_id IS NULL AND cover_project_id IS NULL END);
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_verified_cover CHECK (purpose<>'cover_image' OR status<>'ready' OR (completed_at IS NOT NULL AND generation IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_cover_size CHECK (purpose<>'cover_image' OR size_bytes<=3145728);
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_cover_track_fk FOREIGN KEY (organization_id,cover_track_id) REFERENCES tracks(organization_id,id);
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_cover_project_fk FOREIGN KEY (organization_id,cover_project_id) REFERENCES projects(organization_id,id);
CREATE INDEX upload_intents_cover_idx ON upload_intents(organization_id,purpose,cover_track_id,cover_project_id);
-- Restrictive, so it narrows the existing tenant policy rather than widening it.
-- A cover upload is readable by its uploader and active owners/admins, or while a published track or a project shows it.
CREATE POLICY cover_image_read ON upload_intents AS RESTRICTIVE FOR SELECT USING (
 purpose<>'cover_image'
 OR (user_id=nullif(current_setting('app.user_id',true),'') AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=upload_intents.user_id AND m.status='active'))
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM tracks t WHERE t.organization_id=upload_intents.organization_id AND t.id=upload_intents.cover_track_id AND t.published AND t.cover_image->>'fileId'=upload_intents.id)
 OR EXISTS(SELECT 1 FROM projects p WHERE p.organization_id=upload_intents.organization_id AND p.id=upload_intents.cover_project_id AND p.cover_image->>'fileId'=upload_intents.id)
);
