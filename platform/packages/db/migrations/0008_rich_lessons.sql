-- No backfill or rewrite of published text, revision history or completion evidence.
ALTER TABLE lessons ADD COLUMN rich_body jsonb CHECK (rich_body IS NULL OR (jsonb_typeof(rich_body)='object' AND rich_body->>'type'='doc' AND octet_length(rich_body::text)<=40000));
ALTER TABLE lesson_drafts ADD COLUMN rich_body jsonb CHECK (rich_body IS NULL OR (jsonb_typeof(rich_body)='object' AND rich_body->>'type'='doc' AND octet_length(rich_body::text)<=40000));
ALTER TABLE lesson_revisions ADD COLUMN rich_body jsonb CHECK (rich_body IS NULL OR (jsonb_typeof(rich_body)='object' AND rich_body->>'type'='doc' AND octet_length(rich_body::text)<=40000));
