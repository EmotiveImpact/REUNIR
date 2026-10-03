-- Additive: deleting an account removes every invitation to the person's address, including invitations to communities
-- they never joined. While the transaction is marked as the acting person's own deletion, these policies admit only
-- invitations sent to that person's own account email, whichever community sent them. Queued invitation mail goes with
-- each invitation (ON DELETE CASCADE). Nothing is backfilled.
CREATE POLICY account_invitations ON invitations FOR SELECT USING (
 email=(SELECT lower(a.email) FROM auth_user a WHERE a.id=nullif(current_setting('app.user_id',true),'') AND a.id=nullif(current_setting('app.account_deletion',true),''))
);
CREATE POLICY account_invitation_erasure ON invitations FOR DELETE USING (
 email=(SELECT lower(a.email) FROM auth_user a WHERE a.id=nullif(current_setting('app.user_id',true),'') AND a.id=nullif(current_setting('app.account_deletion',true),''))
);
