-- Alpha 58: a suspended member can appeal their suspension, and someone who reported a private message can ask for a
-- second look once it is closed (decision 058). Additive; earlier migrations are unchanged and nothing is backfilled, so
-- suspensions made before this migration have no recorded suspender and can be decided by any owner or administrator.
ALTER TABLE members ADD COLUMN suspended_by text, ADD COLUMN suspended_at timestamptz;
ALTER TABLE members ADD CONSTRAINT members_suspended_by_fk FOREIGN KEY (organization_id,suspended_by) REFERENCES members(organization_id,user_id);
-- A suspended person finds their own suspended memberships, and the communities they belong to, and nothing else there.
CREATE POLICY own_suspended_memberships ON members FOR SELECT USING (user_id=nullif(current_setting('app.user_id',true),'') AND status='suspended');
CREATE POLICY suspended_discovery ON organisations FOR SELECT USING (EXISTS(SELECT 1 FROM members m WHERE m.organization_id=organisations.id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='suspended'));
-- One row per appeal against a suspension. Only the decision fields change afterwards. An appeal still open when access is
-- restored some other way is closed, so an open appeal always concerns a suspension in force.
CREATE TABLE suspension_appeals (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 appellant_id text NOT NULL,
-- The suspension the appeal challenges, copied from the membership when the appeal is made.
 suspended_by text, suspended_at timestamptz,
 reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','upheld','reversed','withdrawn','closed')),
 decided_by text, decided_at timestamptz, response text NOT NULL DEFAULT '' CHECK (char_length(response)<=2000),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,appellant_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,suspended_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,decided_by) REFERENCES members(organization_id,user_id),
 CHECK ((status='pending')=(decided_at IS NULL)),
 CHECK ((status IN ('upheld','reversed'))=(decided_by IS NOT NULL)),
 CHECK (decided_by IS NULL OR (decided_by<>appellant_id AND decided_by IS DISTINCT FROM suspended_by))
);
CREATE UNIQUE INDEX suspension_appeals_one_open ON suspension_appeals(organization_id,appellant_id) WHERE status='pending';
CREATE INDEX suspension_appeals_appellant_idx ON suspension_appeals(organization_id,appellant_id,created_at DESC);
ALTER TABLE suspension_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspension_appeals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON suspension_appeals FROM PUBLIC;
-- The appellant and the community's active owners and administrators read appeals; never another community.
CREATE POLICY suspension_appeal_read ON suspension_appeals FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (
  appellant_id=nullif(current_setting('app.user_id',true),'')
  OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=suspension_appeals.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin')))
);
-- Only a suspended member appeals, in their own name, about the suspension their membership records now.
CREATE POLICY suspension_appeal_insert ON suspension_appeals FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND appellant_id=nullif(current_setting('app.user_id',true),'')
 AND status='pending' AND decided_by IS NULL AND decided_at IS NULL AND response=''
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=suspension_appeals.organization_id AND m.user_id=suspension_appeals.appellant_id AND m.status='suspended'
  AND m.suspended_by IS NOT DISTINCT FROM suspension_appeals.suspended_by AND m.suspended_at IS NOT DISTINCT FROM suspension_appeals.suspended_at)
);
-- The appellant withdraws their own open appeal.
CREATE POLICY suspension_appeal_withdraw ON suspension_appeals FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='pending' AND appellant_id=nullif(current_setting('app.user_id',true),'')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='withdrawn' AND decided_by IS NULL AND appellant_id=nullif(current_setting('app.user_id',true),'')
);
-- An active owner or administrator who neither appealed nor suspended decides an open appeal, in their own name. That the
-- member is still under the suspension it challenges is checked by the application, because a reversal restores the
-- membership in the same transaction.
CREATE POLICY suspension_appeal_decide ON suspension_appeals FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='pending'
 AND appellant_id<>nullif(current_setting('app.user_id',true),'')
 AND suspended_by IS DISTINCT FROM nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=suspension_appeals.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status IN ('upheld','reversed') AND decided_by=nullif(current_setting('app.user_id',true),'')
);
-- Restoring access without deciding the appeal closes it. Only once the appellant's membership is active again, so an
-- appeal cannot be closed while the suspension it challenges is in force.
CREATE POLICY suspension_appeal_close ON suspension_appeals FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='pending'
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=suspension_appeals.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status='closed' AND decided_by IS NULL
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=suspension_appeals.organization_id AND m.user_id=suspension_appeals.appellant_id AND m.status='active')
);
-- Appeals go with the appellant's own account deletion (0015 marks that transaction), and in no other way.
CREATE POLICY suspension_appeal_account_erasure ON suspension_appeals FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND appellant_id=nullif(current_setting('app.user_id',true),'')
 AND appellant_id=nullif(current_setting('app.account_deletion',true),'')
);
-- A closed message report can be looked at once more, by a moderator other than the one who closed it.
ALTER TABLE message_reports ADD COLUMN second_look text CHECK (second_look IS NULL OR char_length(second_look) BETWEEN 5 AND 1000),
 ADD COLUMN second_look_at timestamptz, ADD COLUMN first_reviewed_by text;
ALTER TABLE message_reports ADD CONSTRAINT message_reports_second_look_once CHECK ((second_look IS NULL)=(second_look_at IS NULL) AND (second_look_at IS NULL)=(first_reviewed_by IS NULL));
