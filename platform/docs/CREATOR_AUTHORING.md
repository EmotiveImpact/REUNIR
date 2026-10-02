# Current authoring continuation

Alpha 08 implements rich lesson editing and safe external media (RICH_LESSONS.md). Alpha 09 adds private lesson files that follow the same draft, preview, publication and revision workflow (LESSON_RESOURCES.md). The Alpha 06 text below documents the preserved publication foundation; its plaintext-only and no-attachment limitations are historical.

# Creator authoring: recovered Alpha 06 slice

Application `0.6.0-alpha.1`. This is new work built on the verified Alpha 05 source after the interrupted authoring attempt. It is not a recovered copy of the missing attempt, a rich-text editor release, or a hosted pilot.

## What an owner can do

Open a learning track and choose **Creator studio**. Open an existing lesson or create a new draft. Write a title, summary, plain-text body, reading time and optional HTTPS resource link. Save privately, switch to a learner-style preview, then deliberately publish the saved version. Existing lessons retain their IDs and completion evidence.

New drafts do not appear in the live curriculum. Publishing a new lesson appends it to the track. Owners can move lessons up or down without changing their IDs or resetting completion rows. A published lesson's previous contents can be copied back into a draft from revision history. That restoration does not publish anything until the owner explicitly chooses publication again.

Drafts can be archived and restored. Archiving a draft is not unpublishing or deleting a lesson. Members retain access to the published material and their evidence.

## Permission and privacy boundary

Authoring is restricted to an active owner or administrator of the current community with access to the track. An instructor-specific scope is not yet implemented. Moderator is not a curriculum-authoring role.

Draft and revision records are filtered out of ordinary member workspace responses and are not included in general search. Forced row-level policies also restrict reads and writes to the appropriate tenant and active authoring membership. A UI link is not an authorisation control. Server/database operators still have privileged access: this is not encryption against those operators.

The fictional downloadable demo uses the existing browser-local dataset. Do not enter real private or client material. The unsaved editor buffer is not stored separately; saving a fictional draft uses the same deliberately local demonstration store as the rest of the preview. Live mode uses the backend and never substitutes demo data on error.

## Model and migration

Migration `0007_creator_authoring.sql` adds `lesson_drafts` and `lesson_revisions`. The six earlier migration files remain unchanged. No fabricated draft, publication date or author is backfilled into an upgraded community.

A draft is versioned, tenant-scoped and belongs to one track. It optionally points to its existing live lesson. At most one draft is associated with an existing lesson. New unpublished drafts have no live lesson record.

A revision is an append-only content snapshot for the specific lesson, draft and track. It records an authenticated actor, sequence and time. Opening an older lesson captures its actual current contents as `captured`, not as an invented original publication. Subsequent snapshots are `published`. The UI explains that distinction.

Composite foreign keys enforce same-community, same-track and same-lesson relationships. Runtime grants revoke revision UPDATE and DELETE. Repository persistence inserts immutable revision rows rather than upserting them. The existing per-community transactional lock and command receipts provide serialised writes and retry safety.

The curriculum-position uniqueness constraint becomes deferred until transaction end, allowing a complete position swap without transient duplicate failures. Committed duplicate positions remain invalid. Reordering requires the complete expected current order and a permutation containing every lesson exactly once.

## Commands and invariants

- `lesson.draft.create`: open the unique existing draft or create one; capture an older lesson's real baseline when required.
- `lesson.draft.save`: require the expected version; persist only whitelisted learner content, never client-supplied review/publisher metadata.
- `lesson.draft.publish`: require the expected saved version, active draft and nonempty title/summary/body; explicitly copy allowed fields to the live lesson and add one history snapshot.
- `lesson.draft.restore`: copy a matching historical revision into a newer draft, not the live lesson.
- `lesson.draft.archive`: version-check and archive/restore without unpublishing.
- `track.lessons.reorder`: reject stale, incomplete, duplicate or foreign lesson IDs before changing positions.

Unchanged saves/publications do not add duplicate history or activity. Draft text does not enter public activity or notification payloads. Publication does not award learning points, complete a mission or reset old completion rows.

## Evidence and limitations

Existing completion records identify a lesson, not the exact publication revision a person read. This slice deliberately preserves that older meaning. Do not describe them as revision-specific credentials. Adding a new published lesson can change a track's denominator and calculated percentage; existing completed lessons still count and are not revoked.

Older administrative `lesson.create` callers remain for compatibility and retain their existing privileges. The new studio offers a deliberate draft/publish workflow, but it is not a global ban on the older one-step creation command.

The editor handles common link/button navigation and browser unload warnings for unsaved edits. It is not a complete guarantee against every browser-back, programmatic navigation or process crash. No live collaborative editing, conflict-merging, autosave, shared cursor, rich text, attachment, video, quiz or individual teaching role is added here.

## Reuse in this slice

The existing validated command bus, owner/space access checks, workspace repository, SQL transactions, outbox, command receipts, theme, preview bundling and authentication are reused. No upstream application source or new runtime dependency is imported. Earlier research remains a benchmark; this recovery is not a newly completed audit of every donor repository and does not claim Tiptap was integrated.

## Acceptance

The executable coverage is in `tests/authoring.test.ts`, `tests/authoring-database.test.ts` and `scripts/authoring-browser-check.ts`. It includes active-role checks, cross-tenant/private reads, stale edits, baseline attribution, publication idempotency, upgrade preservation, append-only runtime history, database-backed restricted-role publication, curriculum swaps, learner visibility, restore/archive and responsive controls. Consult BUILD_STATUS.md for completed runs and their limits rather than treating this specification as evidence that tests ran.
