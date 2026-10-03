-- Additive: appeals against a moderator hiding a post. Posts now record who last hid or restored them and when. Existing
-- rows keep NULL, because who moderated them was never recorded, and nothing is backfilled. 0001 to 0021 are unchanged.
ALTER TABLE posts ADD COLUMN moderated_by text;
ALTER TABLE posts ADD COLUMN moderated_at timestamptz;
ALTER TABLE posts ADD CONSTRAINT posts_moderated_by_fk FOREIGN KEY (organization_id,moderated_by) REFERENCES members(organization_id,user_id);
-- One row per appeal. Only the decision fields change afterwards (the runtime role has column-level UPDATE on them only).
CREATE TABLE moderation_appeals (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 subject text NOT NULL CHECK (subject IN ('post')), subject_id text NOT NULL, appellant_id text NOT NULL,
 reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','reversed','withdrawn')),
 decided_by text, decided_at timestamptz, response text NOT NULL DEFAULT '' CHECK (char_length(response)<=2000),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,subject_id) REFERENCES posts(organization_id,id),
 FOREIGN KEY (organization_id,appellant_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,decided_by) REFERENCES members(organization_id,user_id),
 CHECK ((status='pending')=(decided_at IS NULL)),
 CHECK ((status IN ('upheld','reversed'))=(decided_by IS NOT NULL)),
 CHECK (decided_by IS NULL OR decided_by<>appellant_id)
);
-- At most one open appeal per item.
CREATE UNIQUE INDEX moderation_appeals_one_open ON moderation_appeals(organization_id,subject,subject_id) WHERE status='pending';
CREATE INDEX moderation_appeals_appellant_idx ON moderation_appeals(organization_id,appellant_id);
ALTER TABLE moderation_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_appeals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON moderation_appeals FROM PUBLIC;
-- The appellant and the community's active owners and administrators read appeals. Nobody else, and never another community.
CREATE POLICY appeal_read ON moderation_appeals FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (
  appellant_id=nullif(current_setting('app.user_id',true),'')
  OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=moderation_appeals.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin')))
);
-- Only an active member appeals, in their own name, about their own hidden post, and the appeal starts open.
CREATE POLICY appeal_insert ON moderation_appeals FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND appellant_id=nullif(current_setting('app.user_id',true),'')
 AND status='pending' AND decided_by IS NULL AND decided_at IS NULL AND response=''
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=moderation_appeals.organization_id AND m.user_id=moderation_appeals.appellant_id AND m.status='active')
 AND EXISTS(SELECT 1 FROM posts p WHERE p.organization_id=moderation_appeals.organization_id AND p.id=moderation_appeals.subject_id AND p.author_id=moderation_appeals.appellant_id AND p.hidden)
);
-- The appellant withdraws their own open appeal while their membership is active.
CREATE POLICY appeal_withdraw ON moderation_appeals FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='pending'
 AND appellant_id=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=moderation_appeals.organization_id AND m.user_id=moderation_appeals.appellant_id AND m.status='active')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='withdrawn' AND decided_by IS NULL
 AND appellant_id=nullif(current_setting('app.user_id',true),'')
);
-- An active owner or administrator who is neither the appellant nor the post's moderator decides an open appeal, in their own name.
CREATE POLICY appeal_decide ON moderation_appeals FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='pending'
 AND appellant_id<>nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=moderation_appeals.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
 AND NOT EXISTS(SELECT 1 FROM posts p WHERE p.organization_id=moderation_appeals.organization_id AND p.id=moderation_appeals.subject_id AND p.moderated_by=nullif(current_setting('app.user_id',true),''))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status IN ('upheld','reversed')
 AND decided_by=nullif(current_setting('app.user_id',true),'') AND decided_at IS NOT NULL
);
-- Appeals go with the appellant's own account deletion (0015 marks that transaction), and in no other way.
CREATE POLICY appeal_account_erasure ON moderation_appeals FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND appellant_id=nullif(current_setting('app.user_id',true),'')
 AND appellant_id=nullif(current_setting('app.account_deletion',true),'')
);
