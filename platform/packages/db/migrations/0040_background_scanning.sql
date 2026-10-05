-- Alpha 42: virus scanning moves out of the upload request (decision 042). When a person completes an upload that passes
-- its type, size and signature checks, the server records which stored generation it is waiting to have scanned, and a
-- separate scan worker beside clamd streams that generation to the scanner and records the verdict. Earlier migrations
-- are unchanged; uploads that were already ready or rejected need no row here.
CREATE TABLE upload_scans (
 organization_id text NOT NULL,
 upload_id text NOT NULL,
 -- Copied from the upload when the scan is asked for, so the worker never reads upload records across communities.
 user_id text NOT NULL,
 object_key text NOT NULL,
 generation text NOT NULL CHECK (generation ~ '^[0-9]{1,20}$'),
 size_bytes bigint NOT NULL CHECK (size_bytes>0),
 thumbnail_object_key text,
 thumbnail_generation text CHECK (thumbnail_generation IS NULL OR thumbnail_generation ~ '^[0-9]{1,20}$'),
 thumbnail_size_bytes integer CHECK (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes>0),
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','scanning','clean','flagged')),
 -- Only for a cover's small copy: false when the copy was flagged or had gone, so it is dropped and the picture kept.
 thumbnail_clean boolean,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
 queued_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 lease_token text,
 scanned_at timestamptz,
 PRIMARY KEY (organization_id,upload_id),
 FOREIGN KEY (organization_id,upload_id) REFERENCES upload_intents(organization_id,id) ON DELETE CASCADE,
 CONSTRAINT upload_scans_thumbnail_complete CHECK (num_nulls(thumbnail_object_key,thumbnail_generation,thumbnail_size_bytes) IN (0,3)),
 CONSTRAINT upload_scans_lease CHECK ((status='scanning')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)),
 CONSTRAINT upload_scans_verdict CHECK ((status IN ('clean','flagged'))=(scanned_at IS NOT NULL) AND (thumbnail_clean IS NULL OR status IN ('clean','flagged')))
);
CREATE INDEX upload_scans_waiting_idx ON upload_scans (available_at) WHERE status IN ('queued','scanning');
ALTER TABLE upload_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_scans FORCE ROW LEVEL SECURITY;
-- Requests read and ask for scans only inside their own community.
CREATE POLICY tenant_scope ON upload_scans
 USING (organization_id=nullif(current_setting('app.organization_id',true),''))
 WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),''));
-- The scan worker's own transactions, and only those, set app.worker to 'scanner'. It sees scan rows and community
-- slugs, and nothing else across communities; completing a scanned upload runs inside that community as its uploader.
CREATE POLICY scan_worker ON upload_scans
 USING (current_setting('app.worker',true)='scanner')
 WITH CHECK (current_setting('app.worker',true)='scanner');
CREATE POLICY organisations_scanner ON organisations FOR SELECT USING (current_setting('app.worker',true)='scanner');
