-- Private messaging is a separate paginated read/write model, not community activity.
CREATE TABLE conversations (
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, id text NOT NULL,
 participant_ids text[] NOT NULL CHECK(cardinality(participant_ids)=2 AND participant_ids[1]<>participant_ids[2]),
 pair_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,pair_key)
);
CREATE TABLE messages (
 organization_id text NOT NULL, id text NOT NULL, conversation_id text NOT NULL, sender_id text NOT NULL,
 sequence bigint GENERATED ALWAYS AS IDENTITY, body text NOT NULL CHECK(length(body) BETWEEN 1 AND 4000), created_at timestamptz NOT NULL DEFAULT now(), request_key text NOT NULL,
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,conversation_id) REFERENCES conversations(organization_id,id) ON DELETE CASCADE,
 UNIQUE(organization_id,sender_id,request_key)
);
CREATE INDEX messages_page_idx ON messages(organization_id,conversation_id,sequence DESC);
CREATE TABLE message_receipts (
 organization_id text NOT NULL, conversation_id text NOT NULL, user_id text NOT NULL, last_read_at timestamptz NOT NULL, last_read_sequence bigint NOT NULL,
 PRIMARY KEY(organization_id,conversation_id,user_id), FOREIGN KEY(organization_id,conversation_id) REFERENCES conversations(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE member_blocks (
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, user_id text NOT NULL, blocked_user_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id,blocked_user_id), CHECK(user_id<>blocked_user_id)
);
CREATE TABLE message_reports (
 organization_id text NOT NULL REFERENCES organisations(id) ON DELETE CASCADE, id text NOT NULL,
 message_id text NOT NULL, conversation_id text NOT NULL, reporter_id text NOT NULL, sender_id text NOT NULL,
 reason text NOT NULL, reported_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')), reviewed_by text, reviewed_at timestamptz,
 PRIMARY KEY(organization_id,id), UNIQUE(organization_id,message_id,reporter_id)
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY conversation_scope ON conversations USING(organization_id=nullif(current_setting('app.organization_id',true),'') AND nullif(current_setting('app.user_id',true),'')=ANY(participant_ids)) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'') AND nullif(current_setting('app.user_id',true),'')=ANY(participant_ids));
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY message_scope ON messages USING(organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM conversations c WHERE c.organization_id=messages.organization_id AND c.id=messages.conversation_id)) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'') AND sender_id=nullif(current_setting('app.user_id',true),'') AND EXISTS(SELECT 1 FROM conversations c WHERE c.organization_id=messages.organization_id AND c.id=messages.conversation_id));
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY receipt_scope ON message_receipts USING(organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),''));
ALTER TABLE member_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_blocks FORCE ROW LEVEL SECURITY;
CREATE POLICY block_read ON member_blocks FOR SELECT USING(organization_id=nullif(current_setting('app.organization_id',true),'') AND nullif(current_setting('app.user_id',true),'') IN(user_id,blocked_user_id));
CREATE POLICY block_insert ON member_blocks FOR INSERT WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),''));
CREATE POLICY block_delete ON member_blocks FOR DELETE USING(organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),''));
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY report_read ON message_reports FOR SELECT USING(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (
 reporter_id=nullif(current_setting('app.user_id',true),'') OR EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=message_reports.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN('owner','admin','moderator'))));
CREATE POLICY report_insert ON message_reports FOR INSERT WITH CHECK(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND reporter_id=nullif(current_setting('app.user_id',true),'') AND sender_id<>reporter_id);
-- The reporter can replay an existing insert idempotently; independent moderation is enforced at the API.
CREATE POLICY report_update ON message_reports FOR UPDATE USING(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND (
 reporter_id=nullif(current_setting('app.user_id',true),'') OR EXISTS(
 SELECT 1 FROM members m WHERE m.organization_id=message_reports.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role IN('owner','admin','moderator')))) WITH CHECK(organization_id=nullif(current_setting('app.organization_id',true),''));
