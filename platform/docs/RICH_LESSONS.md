# Creator Studio 2: rich lesson authoring

Version 0.8.0-alpha.1 (current release 0.9.0-alpha.1). Built on merged Alpha 07, retaining UI_DESIGN_DIRECTION.md.

Owners/admins can format private lesson drafts using paragraphs, H2/H3 headings, bold/italic, lists, quotes, code and dividers, add HTTPS links to selected text, and insert public HTTPS images with descriptions or YouTube/Vimeo videos with titles. The same content appears in private preview and the learner view after explicit publication. Undo/redo uses the editor history. Existing saved-version checks, unsaved-navigation protection, archive, revision restoration and completion records remain.

Tiptap is the editor, not the publication or permission system. A bounded shared JSON validator accepts only supported nodes/attributes/marks, with maximum depth 8, 600 nodes, 28 KB UTF-8 JSON and 20,000 plaintext characters. The server derives plaintext rather than trusting a separate submitted body. Unsupported/oversized content blocks saving without discarding the editor buffer. Invalid persisted JSON renders its escaped plaintext fallback. No raw HTML is rendered.

Images/videos do not load during authoring or automatically in preview/reading. Learners choose Load image/video before contacting the external host; that shares their IP with the provider. YouTube uses youtube-nocookie.com; Vimeo uses player.vimeo.com. This is not a guarantee of provider privacy or resource availability. Image URLs are public external resources, not private uploads. Credentials, data URLs, arbitrary iframes and autoplay parameters are not accepted.

## Upgrade before running the new server

Run `npm ci`, then `npm run db:migrate` using the direct administrative MIGRATION_DATABASE_URL. The new migration is `0008_rich_lessons.sql`; migrations 0001–0007 are unchanged. It adds nullable rich_body columns to lessons, drafts and immutable revisions without backfill. Existing table-level runtime grants cover these columns; run `npm run db:grant-runtime` as part of the normal documented upgrade. Keep all administrative credentials off the application runtime.

Restore or clone this feature branch (or main after merge), then `cd platform`, `npm ci`, `npm run dev` for the fictional demo. Live deployment still requires the independent staging gates in SETUP.md and RELEASE_GATES.md. The user is deferring deployment and hosted testing.

Tests: `npm test`, `npm run test:browser:authoring`, `npm run test:browser:rich-lessons`, `npm run test:browser:monochrome`, and `npm run test:postgres` in its disposable local database. CI also retains the existing full regression suites. On restricted environments, `node --import tsx --test --test-concurrency=1 tests/*.test.ts` avoids the tsx CLI's optional IPC listener. It does not bypass blocked HTTP/browser tests.

## Remaining Creator Studio work

Private lesson resources with lesson/space access inheritance are implemented in Alpha 09; see LESSON_RESOURCES.md. Remaining: assessments and assignments, and instructor-specific authoring permissions. No collaboration server, autosave or assessment engine is included.
