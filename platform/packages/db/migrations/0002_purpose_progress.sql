-- REUNIR Alpha 02: additive purpose and evidence model.
-- 0001 remains byte-for-byte unchanged. Existing content receives no fabricated purpose.
-- New tables use tenant keys. Private visibility and review authority are additionally enforced in the domain.
ALTER TABLE submissions ADD CONSTRAINT submissions_evidence_author_key UNIQUE(organization_id,id,author_id);

CREATE TABLE purposes (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN ('become','build','achieve')), title text NOT NULL, description text NOT NULL, status text NOT NULL CHECK(status IN ('active','archived')),
 PRIMARY KEY (organization_id,id)
);
CREATE INDEX purposes_tenant_time_idx ON purposes(organization_id,created_at DESC);
ALTER TABLE projects ADD COLUMN purpose_id text;
ALTER TABLE projects ADD CONSTRAINT projects_purpose_fk FOREIGN KEY(organization_id,purpose_id) REFERENCES purposes(organization_id,id);

CREATE TABLE paths (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 purpose_id text NOT NULL, space_id text, title text NOT NULL, summary text NOT NULL, status text NOT NULL CHECK(status IN ('draft','published','archived')),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,purpose_id) REFERENCES purposes(organization_id,id),
 FOREIGN KEY (organization_id,space_id) REFERENCES spaces(organization_id,id),
 UNIQUE(organization_id,id,purpose_id)
);
CREATE INDEX paths_tenant_time_idx ON paths(organization_id,created_at DESC);

CREATE TABLE milestones (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 path_id text NOT NULL, title text NOT NULL, description text NOT NULL, position integer NOT NULL CHECK(position>0), lesson_id text, mission_id text, project_id text,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,path_id) REFERENCES paths(organization_id,id),
 FOREIGN KEY (organization_id,lesson_id) REFERENCES lessons(organization_id,id),
 FOREIGN KEY (organization_id,mission_id) REFERENCES missions(organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 CHECK(num_nonnulls(lesson_id,mission_id,project_id)=1),
 UNIQUE(organization_id,path_id,position),
 UNIQUE(organization_id,path_id,lesson_id),
 UNIQUE(organization_id,path_id,mission_id),
 UNIQUE(organization_id,path_id,project_id)
);
CREATE INDEX milestones_tenant_time_idx ON milestones(organization_id,created_at DESC);

CREATE TABLE path_enrolments (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 path_id text NOT NULL, user_id text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,path_id) REFERENCES paths(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 UNIQUE(organization_id,path_id,user_id)
);
CREATE INDEX path_enrolments_tenant_time_idx ON path_enrolments(organization_id,created_at DESC);

CREATE TABLE contributions (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 project_id text NOT NULL, user_id text NOT NULL, title text NOT NULL, body text NOT NULL, evidence_url text NOT NULL, status text NOT NULL CHECK(status IN ('submitted','recognised','changes_requested')), reviewer_id text, reviewed_at timestamptz, feedback text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,reviewer_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,project_id,user_id) REFERENCES project_members(organization_id,project_id,user_id),
 CHECK((status='submitted' AND reviewer_id IS NULL AND reviewed_at IS NULL) OR (status<>'submitted' AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND reviewer_id<>user_id)),
 UNIQUE(organization_id,id,user_id),
 UNIQUE(organization_id,id,project_id)
);
CREATE INDEX contributions_tenant_time_idx ON contributions(organization_id,created_at DESC);

CREATE TABLE outcomes (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 purpose_id text NOT NULL, project_id text, submission_id text, contribution_id text, author_id text NOT NULL, title text NOT NULL, summary text NOT NULL, evidence_url text NOT NULL, status text NOT NULL CHECK(status IN ('submitted','verified','changes_requested')), reviewer_id text, reviewed_at timestamptz, feedback text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,purpose_id) REFERENCES purposes(organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,author_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,reviewer_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY(organization_id,submission_id,author_id) REFERENCES submissions(organization_id,id,author_id),
 FOREIGN KEY(organization_id,contribution_id,author_id) REFERENCES contributions(organization_id,id,user_id),
 FOREIGN KEY(organization_id,contribution_id,project_id) REFERENCES contributions(organization_id,id,project_id),
 CHECK(num_nonnulls(submission_id,contribution_id)=1),
 CHECK((submission_id IS NOT NULL AND project_id IS NULL) OR (contribution_id IS NOT NULL AND project_id IS NOT NULL)),
 CHECK((status='submitted' AND reviewer_id IS NULL AND reviewed_at IS NULL) OR (status<>'submitted' AND reviewer_id IS NOT NULL AND reviewed_at IS NOT NULL AND reviewer_id<>author_id)),
 UNIQUE(organization_id,id,purpose_id),
 UNIQUE(organization_id,id,project_id),
 UNIQUE(organization_id,submission_id),
 UNIQUE(organization_id,contribution_id),
 UNIQUE(organization_id,id,author_id)
);
CREATE INDEX outcomes_tenant_time_idx ON outcomes(organization_id,created_at DESC);

CREATE TABLE community_outputs (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 purpose_id text NOT NULL, outcome_id text NOT NULL, project_id text, title text NOT NULL, summary text NOT NULL, kind text NOT NULL CHECK(kind IN ('film','software','research','event','music','book','company','campaign','other')), evidence_url text NOT NULL, published_by text NOT NULL,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,purpose_id) REFERENCES purposes(organization_id,id),
 FOREIGN KEY (organization_id,project_id) REFERENCES projects(organization_id,id),
 FOREIGN KEY (organization_id,published_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY(organization_id,outcome_id,purpose_id) REFERENCES outcomes(organization_id,id,purpose_id),
 FOREIGN KEY(organization_id,outcome_id,project_id) REFERENCES outcomes(organization_id,id,project_id),
 UNIQUE(organization_id,outcome_id)
);
CREATE INDEX community_outputs_tenant_time_idx ON community_outputs(organization_id,created_at DESC);

CREATE TABLE member_goals (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 user_id text NOT NULL, purpose_id text NOT NULL, path_id text, title text NOT NULL, visibility text NOT NULL CHECK(visibility IN ('private','members')), status text NOT NULL CHECK(status IN ('active','paused','completed')), completed_at timestamptz, outcome_id text,
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,purpose_id) REFERENCES purposes(organization_id,id),
 FOREIGN KEY(organization_id,path_id,purpose_id) REFERENCES paths(organization_id,id,purpose_id),
 FOREIGN KEY(organization_id,outcome_id,purpose_id) REFERENCES outcomes(organization_id,id,purpose_id),
 FOREIGN KEY(organization_id,outcome_id,user_id) REFERENCES outcomes(organization_id,id,author_id),
 CHECK(status='completed' OR outcome_id IS NULL),
 UNIQUE(organization_id,user_id,purpose_id),
 CHECK((status='completed' AND completed_at IS NOT NULL) OR (status<>'completed' AND completed_at IS NULL))
);
CREATE INDEX member_goals_tenant_time_idx ON member_goals(organization_id,created_at DESC);

ALTER TABLE purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE purposes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON purposes USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON purposes FROM PUBLIC;

ALTER TABLE paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE paths FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON paths USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON paths FROM PUBLIC;

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON milestones USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON milestones FROM PUBLIC;

ALTER TABLE path_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_enrolments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON path_enrolments USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON path_enrolments FROM PUBLIC;

ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON contributions USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON contributions FROM PUBLIC;

ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON outcomes USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON outcomes FROM PUBLIC;

ALTER TABLE community_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_outputs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON community_outputs USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON community_outputs FROM PUBLIC;

ALTER TABLE member_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_goals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON member_goals USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON member_goals FROM PUBLIC;

CREATE INDEX contributions_project_idx ON contributions(organization_id,project_id,user_id);
CREATE INDEX outcomes_purpose_idx ON outcomes(organization_id,purpose_id,status);
CREATE INDEX member_goals_owner_idx ON member_goals(organization_id,user_id);
