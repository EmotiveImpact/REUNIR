-- Group conversations (Alpha 24). A conversation is either the one direct thread for a member pair, or a named group of up to
-- twenty members. participant_ids stays the access list, so the participant policies from 0004 cover groups unchanged.
ALTER TABLE conversations ADD COLUMN kind text NOT NULL DEFAULT 'direct' CHECK(kind IN('direct','group'));
ALTER TABLE conversations ADD COLUMN title text;
ALTER TABLE conversations ADD COLUMN created_by text;
ALTER TABLE conversations DROP CONSTRAINT conversations_participant_ids_check;
ALTER TABLE conversations ADD CONSTRAINT conversation_shape CHECK(
 (kind='direct' AND cardinality(participant_ids)=2 AND participant_ids[1]<>participant_ids[2] AND title IS NULL)
 OR (kind='group' AND coalesce(cardinality(participant_ids),0)<=20 AND title IS NOT NULL AND length(title) BETWEEN 1 AND 80 AND created_by IS NOT NULL));
-- Leaving removes the acting member from participant_ids, which the 0004 policy refuses because the new row no longer
-- names them. This policy admits exactly that update for a group they belong to; other group changes keep them in the list.
-- PostgreSQL also checks an updated row against the SELECT policies, so the API marks the one group being left for the
-- rest of that transaction (app.leaving_conversation), after confirming under the participant policy that they are in it.
CREATE POLICY conversation_leave ON conversations FOR UPDATE USING(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND kind='group' AND nullif(current_setting('app.user_id',true),'')=ANY(participant_ids)
) WITH CHECK(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND kind='group' AND NOT(coalesce(nullif(current_setting('app.user_id',true),'')=ANY(participant_ids),false)));
CREATE POLICY conversation_leaving ON conversations FOR SELECT USING(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND kind='group' AND id=nullif(current_setting('app.leaving_conversation',true),''));
-- Someone added to a group later reads only what was written after they joined: earlier messages were written to a
-- smaller audience. after_sequence is the newest message sequence when they were added.
CREATE TABLE conversation_joins (
 organization_id text NOT NULL, conversation_id text NOT NULL, user_id text NOT NULL, after_sequence bigint NOT NULL,
 added_by text NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,conversation_id,user_id),
 FOREIGN KEY(organization_id,conversation_id) REFERENCES conversations(organization_id,id) ON DELETE CASCADE
);
ALTER TABLE conversation_joins ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_joins FORCE ROW LEVEL SECURITY;
CREATE POLICY join_scope ON conversation_joins USING(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND EXISTS(SELECT 1 FROM conversations c WHERE c.organization_id=conversation_joins.organization_id AND c.id=conversation_joins.conversation_id)
) WITH CHECK(
 organization_id=nullif(current_setting('app.organization_id',true),'') AND added_by=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM conversations c WHERE c.organization_id=conversation_joins.organization_id AND c.id=conversation_joins.conversation_id AND c.kind='group'));
CREATE POLICY message_group_history ON messages AS RESTRICTIVE FOR SELECT USING(NOT EXISTS(
 SELECT 1 FROM conversation_joins j WHERE j.organization_id=messages.organization_id AND j.conversation_id=messages.conversation_id
 AND j.user_id=nullif(current_setting('app.user_id',true),'') AND messages.sequence<=j.after_sequence));
