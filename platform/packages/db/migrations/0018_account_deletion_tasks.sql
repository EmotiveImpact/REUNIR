-- Additive: deleting your own account hands back the tasks you had claimed without submitting proof, in every community,
-- including one where you were suspended. Suspension closes project work to the person, so the team policy from 0006
-- no longer admits their own claimed tasks. While the transaction is marked as their own account deletion
-- (app.account_deletion, as in 0015), these policies admit exactly those tasks, and an update may only leave them
-- unassigned and without proof. PostgreSQL also requires an updated row to stay readable, so the read policy admits the
-- tasks the transaction names in app.released_tasks once they are unassigned. Nothing is backfilled; 0001 to 0017 are
-- unchanged.
CREATE POLICY task_account_release_read ON project_tasks FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND nullif(current_setting('app.account_deletion',true),'')=nullif(current_setting('app.user_id',true),'')
 AND contribution_id IS NULL AND NOT archived
 AND (assignee_id=nullif(current_setting('app.user_id',true),'')
  OR (assignee_id IS NULL AND id=ANY(string_to_array(nullif(current_setting('app.released_tasks',true),''),','))))
);
CREATE POLICY task_account_release ON project_tasks FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND assignee_id=nullif(current_setting('app.user_id',true),'')
 AND assignee_id=nullif(current_setting('app.account_deletion',true),'')
 AND contribution_id IS NULL AND NOT archived
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND nullif(current_setting('app.account_deletion',true),'')=nullif(current_setting('app.user_id',true),'')
 AND assignee_id IS NULL AND contribution_id IS NULL AND work_state='todo' AND NOT archived
);
