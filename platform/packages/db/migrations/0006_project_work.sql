-- Alpha 05: additive project planning, proof-linked completion and task notes.
-- No changes to 0001-0005. Task stages are derived from existing contribution reviews.
CREATE TABLE project_tasks (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL, project_id text NOT NULL, title text NOT NULL, brief text NOT NULL,
 criteria jsonb NOT NULL CHECK(jsonb_typeof(criteria)='array' AND jsonb_array_length(criteria) BETWEEN 1 AND 10),
 assignee_id text, due_on text CHECK(due_on IS NULL OR due_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 priority text NOT NULL CHECK(priority IN ('normal','high')), work_state text NOT NULL CHECK(work_state IN ('todo','doing')),
 contribution_id text, created_by text NOT NULL, updated_at timestamptz NOT NULL,
 version integer NOT NULL CHECK(version>0), archived boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,id,project_id), UNIQUE(organization_id,contribution_id),
 FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY(organization_id,created_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY(organization_id,project_id,assignee_id) REFERENCES project_members(organization_id,project_id,user_id),
 FOREIGN KEY(organization_id,contribution_id,project_id) REFERENCES contributions(organization_id,id,project_id),
 FOREIGN KEY(organization_id,contribution_id,assignee_id) REFERENCES contributions(organization_id,id,user_id),
 CHECK(contribution_id IS NULL OR assignee_id IS NOT NULL)
);
CREATE INDEX project_tasks_project_idx ON project_tasks(organization_id,project_id,archived,created_at,id);
CREATE TABLE task_notes (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL, project_id text NOT NULL, task_id text NOT NULL, author_id text NOT NULL,
 body text NOT NULL, hidden boolean NOT NULL DEFAULT false,
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,task_id,project_id) REFERENCES project_tasks(organization_id,id,project_id),
 FOREIGN KEY(organization_id,author_id) REFERENCES members(organization_id,user_id)
);
CREATE INDEX task_notes_task_idx ON task_notes(organization_id,task_id,created_at,id);
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes FORCE ROW LEVEL SECURITY;
REVOKE ALL ON project_tasks,task_notes FROM PUBLIC;
CREATE POLICY project_team_scope ON project_tasks USING (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=project_tasks.project_id AND p.organization_id=project_tasks.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id)))))) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=project_tasks.project_id AND p.organization_id=project_tasks.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id))))));
CREATE POLICY project_team_scope ON task_notes USING (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=task_notes.project_id AND p.organization_id=task_notes.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id)))))) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')
AND EXISTS (SELECT 1 FROM projects p JOIN members m ON m.organization_id=p.organization_id
WHERE p.id=task_notes.project_id AND p.organization_id=task_notes.organization_id
AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active'
AND (m.role IN ('owner','admin') OR p.owner_id=m.user_id OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.organization_id=p.organization_id AND pm.project_id=p.id AND pm.user_id=m.user_id))
AND (p.space_id IS NULL OR m.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM spaces sp WHERE sp.organization_id=p.organization_id AND sp.id=p.space_id AND (sp.visibility='members' OR EXISTS(SELECT 1 FROM space_members sm WHERE sm.organization_id=sp.organization_id AND sm.space_id=sp.id AND sm.user_id=m.user_id))))));
