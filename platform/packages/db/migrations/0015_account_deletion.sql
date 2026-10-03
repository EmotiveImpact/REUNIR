-- Additive: a person deletes their own account. The application marks the transaction with app.account_deletion set to
-- the acting user, and these policies admit only that user's own rows while the mark is present. Posts, comments and
-- project work stay, attributed to the scrubbed membership, so nothing here reaches them. Nothing is backfilled.
-- Every membership the person holds, whatever its status, so a suspended membership is scrubbed as well.
CREATE POLICY account_memberships ON members FOR SELECT USING (
 user_id=nullif(current_setting('app.user_id',true),'')
 AND user_id=nullif(current_setting('app.account_deletion',true),'')
);
-- Their own instructor grants end with the account. Administrators revoke other grants exactly as before.
CREATE POLICY instructor_account_erasure ON track_instructors FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.user_id',true),'')
 AND user_id=nullif(current_setting('app.account_deletion',true),'')
);
-- Their own knowledge-check attempts belong to their learning record and go with the account.
CREATE POLICY attempt_account_erasure ON quiz_attempts FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.user_id',true),'')
 AND user_id=nullif(current_setting('app.account_deletion',true),'')
);
-- The runtime role deletes attempts only in that case: never another member's, and never through the operator
-- erasure policy from 0014, which stays with the migration role.
CREATE POLICY attempt_runtime_deletion ON quiz_attempts AS RESTRICTIVE FOR DELETE USING (
 current_user<>'reunir_app'
 OR (user_id=nullif(current_setting('app.user_id',true),'') AND user_id=nullif(current_setting('app.account_deletion',true),''))
);
