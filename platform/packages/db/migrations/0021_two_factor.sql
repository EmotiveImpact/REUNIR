-- Additive: two-step sign-in (an authenticator app's six-digit codes, and one-time backup codes) through Better Auth's
-- two-factor plugin. 0001 to 0020 are unchanged. The plugin encrypts the authenticator secret and the backup codes with
-- the server's session secret before they reach this table; nothing here is readable through a community workspace.
ALTER TABLE auth_user ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
-- One row per account. Deleting the account removes it with the account's other sign-in rows.
CREATE TABLE auth_two_factor (
 id text PRIMARY KEY,
 secret text NOT NULL,
 backup_codes text NOT NULL,
 user_id text NOT NULL UNIQUE REFERENCES auth_user(id) ON DELETE CASCADE,
 verified boolean NOT NULL DEFAULT true,
 failed_verification_count integer NOT NULL DEFAULT 0,
 locked_until timestamptz
);
