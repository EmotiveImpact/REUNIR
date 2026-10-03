-- Additive: an operator procedure erases one member's knowledge-check attempts on a request an active owner authorised.
-- It runs on the migration connection inside a tenant transaction whose acting user is that owner and which names the
-- member in app.erasure_subject, so forced row security still applies to the migration role. The runtime role has no
-- DELETE privilege on attempts, so the application itself can never use this policy. Nothing is backfilled.
CREATE POLICY attempt_erasure ON quiz_attempts FOR DELETE USING (
 organization_id=nullif(current_setting('app.organization_id',true),'')
 AND user_id=nullif(current_setting('app.erasure_subject',true),'')
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=quiz_attempts.organization_id AND m.user_id=nullif(current_setting('app.user_id',true),'') AND m.status='active' AND m.role='owner')
);
