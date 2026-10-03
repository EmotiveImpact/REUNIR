-- Additive: collections of useful community content, such as "Start here", chosen by active owners, administrators and
-- moderators. An item points at one existing post, track, lesson, project, event, path, mission or community output and
-- never copies it. Whether a viewer may see that content is still decided by the domain rules, so an item is shown only to
-- people who can already see its content. Nothing is backfilled and earlier migrations are unchanged.
CREATE TABLE collections (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80), description text NOT NULL CHECK (char_length(description)<=280),
 status text NOT NULL CHECK (status IN ('draft','published')), featured boolean NOT NULL DEFAULT false,
 created_by text NOT NULL, updated_by text NOT NULL, updated_at timestamptz NOT NULL, published_at timestamptz,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,created_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,updated_by) REFERENCES members(organization_id,user_id),
 CHECK (NOT featured OR status='published'), CHECK (status='draft' OR published_at IS NOT NULL),
 CONSTRAINT collections_one_featured EXCLUDE USING btree (organization_id WITH =) WHERE (featured) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE collection_items (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id), created_at timestamptz NOT NULL,
 collection_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('post','track','lesson','project','event','path','mission','output')),
 position integer NOT NULL CHECK (position>0), note text NOT NULL CHECK (char_length(note)<=280), added_by text NOT NULL,
 post_id text, track_id text, lesson_id text, project_id text, event_id text, path_id text, mission_id text, output_id text,
 PRIMARY KEY (organization_id,id),
 CONSTRAINT collection_items_position_key UNIQUE (organization_id,collection_id,position) DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY (organization_id,collection_id) REFERENCES collections(organization_id,id),
 FOREIGN KEY (organization_id,added_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,post_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id),
 FOREIGN KEY (organization_id,lesson_id) REFERENCES lessons(organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,event_id) REFERENCES events(organization_id,id),
 FOREIGN KEY (organization_id,path_id) REFERENCES paths(organization_id,id),
 FOREIGN KEY (organization_id,mission_id) REFERENCES missions(organization_id,id),
 FOREIGN KEY (organization_id,output_id) REFERENCES community_outputs(organization_id,id),
 CHECK (num_nonnulls(post_id,track_id,lesson_id,project_id,event_id,path_id,mission_id,output_id)=1),
 CHECK ((kind='post')=(post_id IS NOT NULL) AND (kind='track')=(track_id IS NOT NULL) AND (kind='lesson')=(lesson_id IS NOT NULL)
  AND (kind='project')=(project_id IS NOT NULL) AND (kind='event')=(event_id IS NOT NULL) AND (kind='path')=(path_id IS NOT NULL)
  AND (kind='mission')=(mission_id IS NOT NULL) AND (kind='output')=(output_id IS NOT NULL))
);
-- One entry per piece of content in a collection.
CREATE UNIQUE INDEX collection_items_target_key ON collection_items(organization_id,collection_id,kind,coalesce(post_id,track_id,lesson_id,project_id,event_id,path_id,mission_id,output_id));
CREATE INDEX collection_items_collection_idx ON collection_items(organization_id,collection_id,position);
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections FORCE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON collections,collection_items FROM PUBLIC;
-- Members of the community read published collections. Drafts are read only by active owners, administrators and moderators.
CREATE POLICY collection_read ON collections FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (status='published' OR EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=collections.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator')))
);
-- Only an active owner, administrator or moderator creates, edits or deletes, and records themselves as the editor.
CREATE POLICY collection_create ON collections FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND created_by=nullif(current_setting('app.user_id',true),'') AND updated_by=created_by
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collections.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
);
CREATE POLICY collection_edit ON collections FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collections.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND updated_by=nullif(current_setting('app.user_id',true),'')
);
CREATE POLICY collection_remove ON collections FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collections.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
);
-- Items are read with their collection: the subquery is itself subject to collection_read.
CREATE POLICY collection_item_read ON collection_items FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM collections c WHERE c.organization_id=collection_items.organization_id AND c.id=collection_items.collection_id)
);
CREATE POLICY collection_item_add ON collection_items FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND added_by=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collection_items.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
);
CREATE POLICY collection_item_edit ON collection_items FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collection_items.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
) WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),''));
CREATE POLICY collection_item_remove ON collection_items FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=collection_items.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin','moderator'))
);
