-- Additive pilot access layer. Invitation secrets are hashed. Email payloads are encrypted.
CREATE TABLE invitations (
 id text PRIMARY KEY, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 email text NOT NULL, token_hash text NOT NULL UNIQUE, created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 accepted_by text, accepted_at timestamptz, CHECK(email=lower(email)), CHECK(expires_at>created_at)
);
CREATE INDEX invitations_org_idx ON invitations(organization_id,created_at DESC);
CREATE UNIQUE INDEX invitations_pending_idx ON invitations(organization_id,email) WHERE status='pending';
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY invite_scope ON invitations USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') OR token_hash=nullif(current_setting('app.invitation_hash',true),'')
) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),''));
CREATE TABLE email_outbox (
 id text PRIMARY KEY, organization_id text, invitation_id text REFERENCES invitations(id) ON DELETE CASCADE,
 payload text NOT NULL, status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, sent_at timestamptz, last_error text
);
CREATE INDEX email_outbox_pending_idx ON email_outbox(status,available_at);
-- Operational queue, never a workspace collection or exposed directly to members.
