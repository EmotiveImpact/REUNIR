-- Additive: an invitation may also ask the person to teach one track. Existing invitations keep NULL and grant ordinary
-- membership only, as before. 0001 to 0019 are unchanged.
ALTER TABLE invitations ADD COLUMN track_id text;
ALTER TABLE invitations ADD CONSTRAINT invitations_track_fk FOREIGN KEY (organization_id,track_id) REFERENCES tracks(organization_id,id);
-- The grant made when such an invitation is accepted. It is recorded in the inviting administrator's name and admitted
-- only for the accepting person, whose account has the invited address, for the track the invitation names, while that
-- invitation is pending and its sender is still an active owner or administrator. Nothing else changes who may grant.
CREATE POLICY instructor_invited ON track_instructors FOR INSERT WITH CHECK (
 organization_id=nullif(current_setting('app.organization_id',true),'') AND user_id=nullif(current_setting('app.user_id',true),'')
 AND EXISTS(SELECT 1 FROM invitations i WHERE i.token_hash=nullif(current_setting('app.invitation_hash',true),'')
  AND i.status='pending' AND i.expires_at>now() AND i.organization_id=track_instructors.organization_id
  AND i.track_id=track_instructors.track_id AND i.created_by=track_instructors.granted_by
  AND EXISTS(SELECT 1 FROM auth_user a WHERE a.id=track_instructors.user_id AND lower(a.email)=i.email))
 AND EXISTS(SELECT 1 FROM members m WHERE m.organization_id=track_instructors.organization_id AND m.user_id=track_instructors.granted_by
  AND m.status='active' AND m.role IN ('owner','admin'))
);
