-- Additive: the author of a contribution may credit other members of the project's team on it, with their consent.
-- A credit is invited, then accepted or declined by the person named; an accepted credit may later be withdrawn by
-- either of them. Credits are acknowledgement between people: nothing in paths, milestones, recognition, outcomes,
-- reputation or roles reads this table. No rows are created on upgrade; 0001 to 0021 are unchanged.
CREATE TABLE contribution_credits (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 contribution_id text NOT NULL, project_id text NOT NULL, user_id text NOT NULL, invited_by text NOT NULL,
 role text NOT NULL DEFAULT '' CHECK (char_length(role)<=60 AND role !~ '[[:cntrl:]]'),
 status text NOT NULL CHECK (status IN ('invited','accepted','declined','withdrawn')),
 responded_at timestamptz, withdrawn_by text, withdrawn_at timestamptz,
 PRIMARY KEY (organization_id,id),
 -- The inviter is the contribution's own author, and the credited person is on the project's team.
 FOREIGN KEY (organization_id,contribution_id,invited_by) REFERENCES contributions(organization_id,id,user_id),
 FOREIGN KEY (organization_id,contribution_id,project_id) REFERENCES contributions(organization_id,id,project_id),
 FOREIGN KEY (organization_id,project_id,user_id) REFERENCES project_members(organization_id,project_id,user_id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 CHECK (user_id<>invited_by),
 CHECK ((status='invited' AND responded_at IS NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL)
  OR (status IN ('accepted','declined') AND responded_at IS NOT NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL)
  OR (status='withdrawn' AND withdrawn_by IS NOT NULL AND withdrawn_at IS NOT NULL)),
 CHECK (withdrawn_by IS NULL OR withdrawn_by IN (user_id,invited_by))
);
-- One live credit per person per contribution.
CREATE UNIQUE INDEX contribution_credits_live_idx ON contribution_credits(organization_id,contribution_id,user_id) WHERE status IN ('invited','accepted');
CREATE INDEX contribution_credits_member_idx ON contribution_credits(organization_id,user_id);
ALTER TABLE contribution_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_credits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON contribution_credits FROM PUBLIC;
-- Accepted credits are readable in the community; invitations, refusals and withdrawals only by the two people involved.
CREATE POLICY credit_read ON contribution_credits FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND (status='accepted' OR user_id=nullif(current_setting('app.user_id',true),'') OR invited_by=nullif(current_setting('app.user_id',true),''))
);
-- Only the contribution's author, while an active member, invites, in their own name; the person named is an active member.
CREATE POLICY credit_invite ON contribution_credits FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND invited_by=nullif(current_setting('app.user_id',true),'') AND status='invited'
 AND responded_at IS NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=contribution_credits.organization_id AND m.user_id=contribution_credits.invited_by AND m.status='active')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=contribution_credits.organization_id AND m.user_id=contribution_credits.user_id AND m.status='active')
);
-- The person named answers an invitation or withdraws an accepted credit; the author withdraws an invitation or credit.
-- Both must be active members at the time. Only the answer and withdrawal columns are granted for update.
CREATE POLICY credit_answer ON contribution_credits FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status IN ('invited','accepted')
 AND (user_id=nullif(current_setting('app.user_id',true),'') OR invited_by=nullif(current_setting('app.user_id',true),''))
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=contribution_credits.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND ((status IN ('accepted','declined') AND user_id=nullif(current_setting('app.user_id',true),'') AND withdrawn_by IS NULL)
  OR (status='withdrawn' AND withdrawn_by=nullif(current_setting('app.user_id',true),'')))
);
-- A person's own credits go with their account (app.account_deletion, as in 0015). Nothing else deletes a credit.
CREATE POLICY credit_account_erasure ON contribution_credits FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.user_id',true),'')
 AND user_id=nullif(current_setting('app.account_deletion',true),'')
);
