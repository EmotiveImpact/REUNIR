-- Alpha 54: people can leave a project team, and its lead or an administrator can remove someone (decision 054). The
-- membership row stays, because contributions and credits name it; it is marked as ended instead. Row security on tasks
-- and task notes now admits only a current team member. Earlier migrations are unchanged.
ALTER TABLE project_members ADD COLUMN left_at timestamptz, ADD COLUMN removed_by text;
ALTER TABLE project_members ADD CONSTRAINT project_members_removed_has_left CHECK (removed_by IS NULL OR left_at IS NOT NULL);
DROP POLICY project_team_scope ON project_tasks;
DROP POLICY project_team_scope ON task_notes;
CREATE POLICY project_team_scope ON project_tasks USING (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=project_tasks.project_id AND p.organization_id=project_tasks.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id AND pm.left_at IS NULL))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id)))))) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=project_tasks.project_id AND p.organization_id=project_tasks.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id AND pm.left_at IS NULL))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id))))));
CREATE POLICY project_team_scope ON task_notes USING (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=task_notes.project_id AND p.organization_id=task_notes.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id AND pm.left_at IS NULL))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id)))))) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=task_notes.project_id AND p.organization_id=task_notes.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id AND pm.left_at IS NULL))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id))))));
