-- Additive: reviewed evidence can be corrected or withdrawn without rewriting its history. Contributions and outcomes gain
-- a 'withdrawn' status (the column checks named by PostgreSQL in 0002 are replaced with the same list plus that value), and
-- every correction or withdrawal is kept in evidence_changes with the reviewed wording it replaced. Existing rows are
-- unchanged and nothing is backfilled; 0001 to 0021 are unchanged.
ALTER TABLE contributions DROP CONSTRAINT contributions_status_check;
ALTER TABLE contributions ADD CONSTRAINT contributions_status_check CHECK (status IN ('submitted','recognised','changes_requested','withdrawn'));
ALTER TABLE outcomes DROP CONSTRAINT outcomes_status_check;
ALTER TABLE outcomes ADD CONSTRAINT outcomes_status_check CHECK (status IN ('submitted','verified','changes_requested','withdrawn'));

CREATE TABLE evidence_changes (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 subject text NOT NULL CHECK (subject IN ('contribution','outcome')), subject_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('correction','withdrawal')),
 requested_by text NOT NULL, reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
 previous jsonb NOT NULL CHECK (jsonb_typeof(previous)='object' AND previous ?& ARRAY['title','text','evidenceUrl']),
 proposed jsonb CHECK (proposed IS NULL OR (jsonb_typeof(proposed)='object' AND proposed ?& ARRAY['title','text','evidenceUrl'])),
 previous_status text NOT NULL CHECK ((subject='contribution' AND previous_status='recognised') OR (subject='outcome' AND previous_status='verified')),
 status text NOT NULL CHECK (status IN ('pending','accepted','declined','applied')),
 decided_by text, decided_at timestamptz, response text NOT NULL DEFAULT '' CHECK (length(response)<=2000),
 PRIMARY KEY (organization_id,id),
 FOREIGN KEY (organization_id,requested_by) REFERENCES members(organization_id,user_id),
 FOREIGN KEY (organization_id,decided_by) REFERENCES members(organization_id,user_id),
-- A correction proposes new wording and waits for a decision. A withdrawal has no new wording and applies at once.
 CHECK ((kind='correction' AND proposed IS NOT NULL AND status IN ('pending','accepted','declined'))
  OR (kind='withdrawal' AND proposed IS NULL AND status='applied')),
 CHECK ((status='pending' AND decided_by IS NULL AND decided_at IS NULL) OR (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
-- One correction waits for review at a time for each piece of evidence.
CREATE UNIQUE INDEX evidence_changes_one_pending_idx ON evidence_changes(organization_id,subject,subject_id) WHERE status='pending';
CREATE INDEX evidence_changes_subject_idx ON evidence_changes(organization_id,subject_id,created_at);
ALTER TABLE evidence_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON evidence_changes USING (organization_id = nullif(current_setting('app.organization_id',true),'')) WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),''));
REVOKE ALL ON evidence_changes FROM PUBLIC;
