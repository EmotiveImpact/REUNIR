# Rich lesson authoring, 2 October 2026

The existing research register recommends a small permissive editor while retaining REUNIR's validation/domain/database separation. We selected Tiptap 3.31.4 after reviewing official React/StarterKit documentation, the installed StarterKit extension registry and its included MIT licence. The exact source blob is recorded in reuse-register.json, with npm integrity pins in package-lock.json.

References: https://tiptap.dev/docs/editor/getting-started/install/react and https://tiptap.dev/docs/editor/extensions/functionality/starterkit. This is a targeted integration review, not an audit of every upstream editor or a new comparative study of LMS products.

Reuse the existing draft/publish/revision system, RLS and shadcn Button. Store bounded JSON, retain server-derived plaintext for existing search/compatibility, and render through an independent allowlist. No arbitrary HTML, script attributes, arbitrary embeds or automatic media requests. YouTube/Vimeo URLs become fixed embed URLs with query options removed. Public image URLs require alternative text. Public media URLs are not private resources; private upload/access inheritance remains a separate slice.

The nullable migration preserves old content and completion IDs. A stale pre-rich editor cannot silently drop a stored rich document by omitting the field. Restoring old plaintext is explicit and clears structured draft content without publishing.
