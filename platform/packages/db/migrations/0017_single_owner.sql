-- Additive: a community has at most one owner. Handing over ownership demotes the previous owner to administrator and
-- then promotes the new one, in one transaction under the community lock, so this index never sees two owners at once.
-- Every role change other than a handover keeps the owner where they are. Nothing is backfilled.
CREATE UNIQUE INDEX members_single_owner_idx ON members (organization_id) WHERE role='owner';
