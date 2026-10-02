-- Additive operational support. No community, member or evidence data is reset.
ALTER TABLE email_outbox ADD COLUMN lease_token text;
CREATE TABLE service_observations (
 name text PRIMARY KEY,
 last_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_success_at timestamptz,
 state text NOT NULL CHECK(state IN ('running','ok','unconfigured','error'))
);
-- Server operational metadata only. Never granted to browser roles or exposed as raw rows.
REVOKE ALL ON TABLE service_observations FROM PUBLIC;
