-- Alpha 37: uploaded lesson video. Only lesson files declared as MP4 or WebM may exceed 10 MB, and never 500 MB.
-- The server sets its own lower limit and leaves video off until it is switched on. 0001 to 0035 are unchanged.
ALTER TABLE upload_intents DROP CONSTRAINT upload_intents_size_bytes_check;
ALTER TABLE upload_intents ADD CONSTRAINT upload_intents_size_bytes_check CHECK (
 size_bytes>0 AND (size_bytes<=10485760 OR (purpose='lesson_resource' AND content_type IN ('video/mp4','video/webm') AND size_bytes<=524288000))
);
