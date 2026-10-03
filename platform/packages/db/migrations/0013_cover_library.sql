-- Additive cover library: pictures a community's owners and administrators supply, which anyone who edits a track or
-- project cover can choose. Nothing is backfilled; existing covers and uploads are unchanged.
ALTER TABLE upload_intents DROP CONSTRAINT upload_intents_purpose_check;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_purpose_check CHECK (purpose IN ('member','lesson_resource','cover_image','cover_library'));
-- The cover scope check already requires library uploads to name no track or project.
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_verified_library CHECK (purpose<>'cover_library' OR status<>'ready' OR (completed_at IS NOT NULL AND generation IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_library_size CHECK (purpose<>'cover_library' OR size_bytes<=3145728);
CREATE TABLE cover_library (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 file_id text NOT NULL, label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
 content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 3145728), added_by text NOT NULL,
 PRIMARY KEY (organization_id,id), UNIQUE (organization_id,file_id),
 FOREIGN KEY (organization_id,file_id) REFERENCES upload_intents(organization_id,id),
 FOREIGN KEY (organization_id,added_by) REFERENCES members(organization_id,user_id)
);
ALTER TABLE cover_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_library FORCE ROW LEVEL SECURITY;
REVOKE ALL ON cover_library FROM PUBLIC;
-- Every member of the community can see the library; only an active owner or administrator adds, in their own name, or removes.
CREATE POLICY library_read ON cover_library FOR SELECT USING (organization_id=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY library_add ON cover_library FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND added_by=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=cover_library.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
CREATE POLICY library_remove ON cover_library FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=cover_library.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
-- Restrictive, so it narrows the tenant policy: a library upload is readable by its active uploader and active
-- owners/admins, or once it is in the library, where every member may see it and covers may show it.
CREATE POLICY cover_library_read ON upload_intents AS RESTRICTIVE FOR SELECT USING (
 purpose<>'cover_library'
 OR (user_id=nullif(current_setting('app.user_id',true),'') AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=upload_intents.user_id AND m.status='active'))
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
 OR EXISTS(SELECT 1 FROM cover_library l WHERE l.organization_id=upload_intents.organization_id AND l.file_id=upload_intents.id)
);
