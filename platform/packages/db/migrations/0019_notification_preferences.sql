-- Additive: each member's notice settings in a community. Absent rows mean every topic on and no email digest, which is
-- how every existing member continues. Nothing is backfilled; 0001 to 0018 are unchanged.
CREATE TABLE notification_preferences (
 id text NOT NULL, organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, created_at timestamptz NOT NULL,
 user_id text NOT NULL,
 muted jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(muted)='array' AND jsonb_array_length(muted)<=4
  AND muted <@ '["conversations","learning","projects","events"]'::jsonb),
 digest text NOT NULL DEFAULT 'off' CHECK (digest IN ('off','daily','weekly')),
 updated_at timestamptz NOT NULL, last_digest_at timestamptz,
 PRIMARY KEY (organization_id,id), UNIQUE (organization_id,user_id),
 FOREIGN KEY (organization_id,user_id) REFERENCES members(organization_id,user_id)
);
CREATE INDEX notification_preferences_digest_idx ON notification_preferences(digest,last_digest_at) WHERE digest<>'off';
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON notification_preferences FROM PUBLIC;
-- Notices are filtered when they are created, so the community's rules read every member's settings in that community.
CREATE POLICY preferences_read ON notification_preferences FOR SELECT USING (organization_id=nullif(current_setting('app.organization_id',true),''));
-- Only the member writes their own row, while their membership is active; their own account deletion removes it.
CREATE POLICY preferences_own_insert ON notification_preferences FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=notification_preferences.organization_id AND m.user_id=notification_preferences.user_id AND m.status='active')
);
CREATE POLICY preferences_own_update ON notification_preferences FOR UPDATE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
) WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
);
CREATE POLICY preferences_own_delete ON notification_preferences FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
);
-- The scheduled digest job lists who is due, across communities, and nothing else: it then works inside each member's own
-- tenant context. Only the job's own transaction sets app.worker.
CREATE POLICY preferences_digest_due ON notification_preferences FOR SELECT USING (
 current_setting('app.worker',true)='digest' AND digest<>'off'
);
