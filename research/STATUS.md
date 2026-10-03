# Research status: Alpha 14

Alpha 14 (learner records) reviewed how LearnHouse exports, anonymises and deletes a user's data and how Frappe Learning pages quiz submissions, at the same pinned commits; ClassroomIO's account code was searched and offers workspace deletion only. See notes/19_LEARNER_RECORDS.md and the `learner-records` decision in reuse-register.json. Both cited projects are behavioural references only. Imported donor files: zero. New runtime dependencies: none.

## Alpha 13 record

Alpha 13 (cover library) reviewed how Frappe Learning (cover popover and stock photo requests), ClassroomIO (image dialogue, stock photo route and cover widget) and LearnHouse (course thumbnail editor and media library picker) let people choose a cover as well as upload one, at the same pinned commits; see notes/18_COVER_LIBRARY.md and the `cover-library` decision in reuse-register.json. All three are behavioural references only. Imported donor files: zero. New runtime dependencies: none.

## Alpha 12 record

Alpha 12 (track instructors) reviewed how Frappe Learning (course instructors and modify rules), LearnHouse (resource authors and contributor management) and ClassroomIO (course team middleware) scope course staff, at the same pinned commits; see notes/17_TRACK_INSTRUCTORS.md and the `track-instructors` decision in reuse-register.json. All three are behavioural references only. Imported donor files: zero. New runtime dependencies: none.

## Alpha 11 record

Alpha 11 (cover images) reviewed the course card files of Frappe Learning, LearnHouse and ClassroomIO at the same pinned commits, the contrast code of axe-core 4.13.0 (the installed version) and WCAG failure F83 with the contrast understanding document; see notes/16_COVER_IMAGES.md and the `cover-images` decision in reuse-register.json. The learning projects are AGPL at their roots, so they are behavioural references only; axe-core and WCAG were read to understand the checks, not copied. Imported donor files: zero. New runtime dependencies: none.

## Alpha 10 record

Alpha 10 (knowledge checks) reviewed specific files in Frappe Learning, LearnHouse and ClassroomIO at the same pinned commits; see notes/15_ASSESSMENTS.md and the `knowledge-checks` decision in reuse-register.json. All three are AGPL at their roots, so they are behavioural references only. Imported donor files: zero. New runtime dependencies: none. Question banks, partial credit, timers and file answers stay queued under `authoring-next`.

## Alpha 09 record

Alpha 09 (private lesson resources) reviewed specific files in LearnHouse, Frappe Learning and ClassroomIO at pinned commits; see notes/14_LESSON_RESOURCES.md and the `lesson-resources` decision in reuse-register.json. All three are AGPL at their roots, so they are behavioural references only. Imported donor files: zero. New runtime dependencies: none. Assessments followed in Alpha 10.

## Alpha 05 record

The original comparative notes are retained as historical research. This release performed targeted re-reads through the GitHub connector of Roost, OpenCircle, ClassroomIO, LearnHouse, Frappe Learning and the official HumHub Tasks module. Exact files and known snapshots are in reuse-register.json. No complete new clone or whole-repository audit was performed.

Implemented result: project workboard, responsibilities, criteria, team conversation and proof-linked review. New runtime dependencies: none. Imported donor application files: zero. Reused existing REUNIR proof handlers, review interface, policies, transactions, notifications, outbox and idempotency.

Next source investigation: creator authoring, followed by focused knowledge/attachment and read-model work. Source provenance is now checked by scripts/check_research.py and included in the supplied CI configuration. CI has not yet run remotely. The older notes do not override current platform/docs/PRD.md or the Alpha 05 implementation.
