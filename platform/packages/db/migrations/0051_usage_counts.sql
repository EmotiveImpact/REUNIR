-- Additive: usage stats that respect privacy (decision 060). One count per community, day and part of the community,
-- and nothing else: no person, session, device, address, time of day or page. Only the API's own counting step, which
-- marks its transaction with app.usage_count, adds to today's count, and only for an active member of that community.
-- Active owners and administrators read the counts, and the retention job clears days past keeping. Days are UTC days.
-- 0001 to 0050 are unchanged.
CREATE TABLE usage_counts (
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 day date NOT NULL,
 area text NOT NULL CHECK (area IN ('home','discussions','learning','missions','projects','events','people','messages','knowledge','outputs','profile','notifications','saved')),
 count integer NOT NULL CHECK (count>0),
 PRIMARY KEY (organization_id,day,area)
);
ALTER TABLE usage_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON usage_counts FROM PUBLIC;
-- Active owners and administrators read their own community's counts. The counting step reads today's row to add to
-- it, and the retention job, whose own transaction alone sets app.worker, reads only the days it clears.
CREATE POLICY usage_count_read ON usage_counts FOR SELECT USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND (EXISTS(SELECT 1 FROM members m WHERE m.organization_id=usage_counts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN ('owner','admin'))
  OR (day=(now() AT TIME ZONE 'UTC')::date AND current_setting('app.usage_count',true)=organization_id)
  OR (current_setting('app.worker',true)='retention' AND day<(now() AT TIME ZONE 'UTC')::date-183))
);
-- The counting step starts today's count at one, for an active member of the community.
CREATE POLICY usage_count_start ON usage_counts FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND current_setting('app.usage_count',true)=organization_id
 AND day=(now() AT TIME ZONE 'UTC')::date AND count=1
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=usage_counts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
-- ...or adds one to it. Only count is granted for update, and only today's row can change.
CREATE POLICY usage_count_add ON usage_counts FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND current_setting('app.usage_count',true)=organization_id AND day=(now() AT TIME ZONE 'UTC')::date
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND current_setting('app.usage_count',true)=organization_id AND day=(now() AT TIME ZONE 'UTC')::date
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=usage_counts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active')
);
-- Only the retention job clears counts, and only once they are past keeping (183 days, RETENTION_DAYS.usageCounts).
CREATE POLICY usage_count_retention ON usage_counts FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND current_setting('app.worker',true)='retention'
 AND day<(now() AT TIME ZONE 'UTC')::date-183
);
