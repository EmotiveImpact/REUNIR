-- Additive private lesson resources. Existing uploads stay member-private files.
-- Existing lessons, drafts and revisions keep NULL resources: nothing is backfilled or rewritten.
ALTER TABLE upload_intents ADD COLUMN purpose text NOT NULL DEFAULT 'member' CHECK (purpose IN ('member','lesson_resource'));
ALTER TABLE upload_intents ADD COLUMN track_id text;
ALTER TABLE upload_intents ADD COLUMN completed_at timestamptz;
ALTER TABLE upload_intents ADD COLUMN generation text CHECK (generation IS NULL OR generation ~ '^[0-9]{1,20}$');
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_resource_scope CHECK ((purpose='lesson_resource')=(track_id IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_verified_resource CHECK (purpose<>'lesson_resource' OR status<>'ready' OR (completed_at IS NOT NULL AND generation IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_track_fk FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id);
CREATE INDEX upload_intents_resource_idx ON upload_intents(organization_id,purpose,track_id);
ALTER TABLE lessons ADD COLUMN resources jsonb CHECK (resources IS NULL OR (jsonb_typeof(resources)='array' AND jsonb_array_length(resources)<=12 AND octet_length(resources::text)<=16000));
ALTER TABLE lesson_drafts ADD COLUMN resources jsonb CHECK (resources IS NULL OR (jsonb_typeof(resources)='array' AND jsonb_array_length(resources)<=12 AND octet_length(resources::text)<=16000));
ALTER TABLE lesson_revisions ADD COLUMN resources jsonb CHECK (resources IS NULL OR (jsonb_typeof(resources)='array' AND jsonb_array_length(resources)<=12 AND octet_length(resources::text)<=16000));
-- Restrictive, so it narrows the existing tenant policy rather than widening it.
-- Lesson files are readable by active owners/admins, or when a published lesson in the same tenant references them.
CREATE POLICY lesson_resource_read ON upload_intents AS RESTRICTIVE FOR SELECT USING (
 purpose<>'lesson_resource'
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM lessons l WHERE l.organization_id=upload_intents.organization_id AND l.published AND l.resources @> jsonb_build_array(jsonb_build_object('fileId',upload_intents.id)))
);
