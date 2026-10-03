-- Additive: the scheduled retention job lists communities, and nothing else, across tenants. It then clears each
-- community's housekeeping (request receipts, change events, read notices) inside that community's own tenant context,
-- where the existing tenant policies apply. Only the job's own transaction sets app.worker. 0001 to 0022 are unchanged.
CREATE POLICY organisations_retention ON organisations FOR SELECT USING (current_setting('app.worker',true)='retention');
-- Read notices are cleared by when they were read.
CREATE INDEX notifications_read_idx ON notifications (organization_id,read_at) WHERE read_at IS NOT NULL;
