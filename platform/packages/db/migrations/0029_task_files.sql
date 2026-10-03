-- Additive: files on project tasks, and who made a task's latest change. Earlier migrations are unchanged and nothing
-- is backfilled. A task file is an upload intent with purpose task_file, bound to exactly one task and verified like a
-- lesson file. The project team (the policy on project_tasks from 0006) sees it once verified.
ALTER TABLE upload_intents DROP CONSTRAINT upload_intents_purpose_check;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_purpose_check CHECK (purpose IN ('member','lesson_resource','cover_image','cover_library','task_file'));
ALTER TABLE upload_intents ADD COLUMN task_id text;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_task_scope CHECK ((purpose='task_file')=(task_id IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_verified_task_file CHECK (purpose<>'task_file' OR status<>'ready' OR (completed_at IS NOT NULL AND generation IS NOT NULL));
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_task_fk FOREIGN KEY (organization_id,task_id) REFERENCES project_tasks(organization_id,id);
CREATE INDEX upload_intents_task_idx ON upload_intents(organization_id,purpose,task_id);
-- Who saved the latest change, so a conflicting edit can say who changed the task. NULL for older rows.
ALTER TABLE project_tasks ADD COLUMN updated_by text;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_updated_by_fk FOREIGN KEY (organization_id,updated_by) REFERENCES members(organization_id,user_id);
-- Reading a task file: a verified file on a task the reader's own policy admits (an active team member, owner or
-- administrator who can open the project's space), or the uploader's own unfinished upload while they are active, or
-- the uploader's own rows while they delete their own account, or an active owner or administrator.
CREATE POLICY task_file_read ON upload_intents AS RESTRICTIVE FOR SELECT USING (
 purpose<>'task_file'
 OR (status='ready' AND EXISTS(SELECT 1 FROM project_tasks t WHERE t.organization_id=upload_intents.organization_id AND t.id=upload_intents.task_id))
 OR (status<>'ready' AND user_id=nullif(current_setting('app.user_id',true),'') AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=upload_intents.user_id AND m.status='active'))
 OR (user_id=nullif(current_setting('app.user_id',true),'') AND user_id=nullif(current_setting('app.account_deletion',true),''))
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
-- Starting one: in the uploader's own name, on a task their team policy admits and that is not archived.
CREATE POLICY task_file_insert ON upload_intents AS RESTRICTIVE FOR INSERT WITH CHECK (
 purpose<>'task_file'
 OR (user_id=nullif(current_setting('app.user_id',true),'') AND EXISTS(SELECT 1 FROM project_tasks t WHERE t.organization_id=upload_intents.organization_id AND t.id=upload_intents.task_id AND NOT t.archived))
);
-- Completing one: only the uploader.
CREATE POLICY task_file_update ON upload_intents AS RESTRICTIVE FOR UPDATE USING (
 purpose<>'task_file' OR user_id=nullif(current_setting('app.user_id',true),'')
) WITH CHECK (
 purpose<>'task_file' OR user_id=nullif(current_setting('app.user_id',true),'')
);
-- Removing one: the uploader, the project's lead, or an active owner or administrator.
CREATE POLICY task_file_delete ON upload_intents AS RESTRICTIVE FOR DELETE USING (
 purpose<>'task_file'
 OR user_id=nullif(current_setting('app.user_id',true),'')
 OR EXISTS(SELECT 1 FROM project_tasks t JOIN projects p ON p.organization_id=t.organization_id AND p.id=t.project_id WHERE t.organization_id=upload_intents.organization_id AND t.id=upload_intents.task_id AND p.owner_id=nullif(current_setting('app.user_id',true),''))
 OR EXISTS(SELECT 1 FROM members m WHERE m.organization_id=upload_intents.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
);
