-- Additive: library pictures can be renamed and tagged by active owners and administrators, and a cover upload may carry
-- a smaller copy for cards, verified with it. Earlier migrations are unchanged. Existing pictures start with no tags and
-- existing covers have no small copy, so readers get the full picture as before.
ALTER TABLE cover_library ADD COLUMN tags jsonb NOT NULL DEFAULT '[]'::jsonb;
-- At most five tags, each a lower-case string of 1 to 24 characters with no commas, control characters or outer spaces.
ALTER TABLE cover_library ADD CONSTRAINT cover_library_tags_shape CHECK (
 jsonb_typeof(tags)='array' AND jsonb_array_length(tags)<=5
 AND NOT jsonb_path_exists(tags,'$[*] ? (@.type() != "string" || !(@ like_regex "^[^[:upper:][:cntrl:][:space:],]([^[:upper:][:cntrl:],]{0,22}[^[:upper:][:cntrl:][:space:],])?$"))')
);
-- Only an active owner or administrator changes a picture's name or tags. Runtime grants limit UPDATE to those two columns.
CREATE POLICY library_update ON cover_library FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=cover_library.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=cover_library.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
-- A cover's or library picture's smaller copy lives beside it in private storage and belongs to the same upload record.
ALTER TABLE upload_intents ADD COLUMN thumbnail_object_key text;
ALTER TABLE upload_intents ADD COLUMN thumbnail_content_type text;
ALTER TABLE upload_intents ADD COLUMN thumbnail_size_bytes integer;
ALTER TABLE upload_intents ADD COLUMN thumbnail_generation text;
CREATE UNIQUE INDEX upload_intents_thumbnail_key ON upload_intents(thumbnail_object_key) WHERE thumbnail_object_key IS NOT NULL;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_thumbnail_scope CHECK (thumbnail_object_key IS NULL OR purpose IN ('cover_image','cover_library'));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_thumbnail_complete CHECK (
 (thumbnail_object_key IS NULL AND thumbnail_content_type IS NULL AND thumbnail_size_bytes IS NULL AND thumbnail_generation IS NULL)
 OR (thumbnail_object_key IS NOT NULL AND thumbnail_content_type IS NOT NULL AND thumbnail_size_bytes IS NOT NULL
  AND thumbnail_content_type IN ('image/jpeg','image/png','image/webp') AND thumbnail_size_bytes BETWEEN 1 AND 262144)
);
-- A small copy is verified with its picture: a generation only once ready, and a ready upload that keeps one has one.
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_thumbnail_verified CHECK (
 (thumbnail_generation IS NULL OR status='ready') AND (status<>'ready' OR thumbnail_object_key IS NULL OR thumbnail_generation IS NOT NULL)
);
