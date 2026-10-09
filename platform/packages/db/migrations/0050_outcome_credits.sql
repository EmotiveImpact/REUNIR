-- Additive: the author of an outcome may credit other members on it, with their consent (decision 059), on the same terms
-- as credits on a contribution (0033). For an outcome from project work, the person credited is on the project's team.
-- Credits are acknowledgement between people: nothing in goals, paths, review, community outputs, reputation or roles
-- reads this table. No rows are created on upgrade; 0001 to 0049 are unchanged.
CREATE TABLE outcome_credits (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 outcome_id text NOT NULL, project_id text, user_id text NOT NULL, invited_by text NOT NULL,
 role text NOT NULL DEFAULT '' CHECK (char_length(role)<=60 AND role !~ '[[:cntrl:]]'),
 status text NOT NULL CHECK (status IN ('invited','accepted','declined','withdrawn')),
 responded_at timestamptz, withdrawn_by text, withdrawn_at timestamptz,
 PRIMARY KEY (organization_id,id),
 -- The inviter is the outcome's own author. When the outcome came from project work, the credited person is on that
 -- project's team. The insert policy below keeps the project the outcome's own, including when it has none.
 FOREIGN KEY (organization_id,outcome_id,invited_by) REFERENCES outcomes(organization_id,id,author_id),
 FOREIGN KEY (organization_id,outcome_id,project_id) REFERENCES outcomes(organization_id,id,project_id),
 FOREIGN KEY (organization_id,project_id,user_id) REFERENCES project_members(organization_id,project_id,user_id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 CHECK (user_id<>invited_by),
 CHECK ((status='invited' AND responded_at IS NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL)
  OR (status IN ('accepted','declined') AND responded_at IS NOT NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL)
  OR (status='withdrawn' AND withdrawn_by IS NOT NULL AND withdrawn_at IS NOT NULL)),
 CHECK (withdrawn_by IS NULL OR withdrawn_by IN (user_id,invited_by))
);
-- One live credit per person per outcome.
CREATE UNIQUE INDEX outcome_credits_live_idx ON outcome_credits(organization_id,outcome_id,user_id) WHERE status IN ('invited','accepted');
CREATE INDEX outcome_credits_member_idx ON outcome_credits(organization_id,user_id);
ALTER TABLE outcome_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_credits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON outcome_credits FROM PUBLIC;
-- Accepted credits are readable in the community; invitations, refusals and withdrawals only by the two people involved.
CREATE POLICY outcome_credit_read ON outcome_credits FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND (status='accepted' OR user_id=nullif(current_setting('app.user_id',true),'') OR invited_by=nullif(current_setting('app.user_id',true),''))
);
-- Only the outcome's author, while an active member, invites, in their own name, on an outcome that is not withdrawn;
-- the person named is an active member, and the credit carries the outcome's own project or none.
CREATE POLICY outcome_credit_invite ON outcome_credits FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND invited_by=nullif(current_setting('app.user_id',true),'') AND status='invited'
 AND responded_at IS NULL AND withdrawn_by IS NULL AND withdrawn_at IS NULL
 AND EXISTS(SELECT 1 FROM outcomes o WHERE o.organization_id=outcome_credits.organization_id AND o.id=outcome_credits.outcome_id
  AND o.author_id=outcome_credits.invited_by AND o.status<>'withdrawn' AND o.project_id IS NOT DISTINCT FROM outcome_credits.project_id)
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=outcome_credits.organization_id AND m.user_id=outcome_credits.invited_by AND m.status='active')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=outcome_credits.organization_id AND m.user_id=outcome_credits.user_id AND m.status='active')
);
-- The person named answers an invitation or withdraws an accepted credit; the author withdraws an invitation or credit.
-- Both must be active members at the time. Only the answer and withdrawal columns are granted for update.
CREATE POLICY outcome_credit_answer ON outcome_credits FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND status IN ('invited','accepted')
 AND (user_id=nullif(current_setting('app.user_id',true),'') OR invited_by=nullif(current_setting('app.user_id',true),''))
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=outcome_credits.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND ((status IN ('accepted','declined') AND user_id=nullif(current_setting('app.user_id',true),'') AND withdrawn_by IS NULL)
  OR (status='withdrawn' AND withdrawn_by=nullif(current_setting('app.user_id',true),'')))
);
-- A person's own credits go with their account (app.account_deletion, as in 0015). Nothing else deletes a credit.
CREATE POLICY outcome_credit_account_erasure ON outcome_credits FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.user_id',true),'')
 AND user_id=nullif(current_setting('app.account_deletion',true),'')
);
