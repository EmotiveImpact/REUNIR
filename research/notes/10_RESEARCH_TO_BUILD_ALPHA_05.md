# Research into working product: Alpha 05

24 September 2026. REUNIR remains the working product name. This is a targeted return to the research, not a claim that every upstream commit has been continuously audited.

## The honest answer

The first reference pass shaped REUNIR. Alpha 03 and Alpha 04 then concentrated on account access, private messaging and pilot operations. That work mattered, but a collection of research notes is not evidence of a continuing implementation feedback loop. From this release onwards, the concrete loop is recorded in `research/reuse-register.json`: source -> decision -> implementation -> tests -> limitations.

Do not equate reading a README with auditing a feature. Do not equate a large test suite with mature production use. This release re-read selected source and product files from the six reference projects and one official HumHub module. Where prior commits were already known, those snapshots were intentionally used; they are not labelled current HEAD.

## Where each reference helps

| Project | What we value | What we are doing with it | What we will not import blindly |
| --- | --- | --- | --- |
| HumHub and its Tasks module | Spaces as permission/content contexts; assigned work, responsible review, states, deadlines and checkpoints | A project-owned workboard with clear assignments and review. The most direct product influence on Alpha 05 | Its PHP/Yii runtime, a second permission system, module dependencies or its entire task model |
| Frappe Learning | Submission ownership, instructor review, validation and feedback as one lifecycle | Reuse our existing contribution lifecycle. A card move cannot certify completion; separate community review recognises proof | An entire Frappe deployment, course hierarchy or new certificate system |
| ClassroomIO | Shared validation and clear transport/service/database layers | Reuse the existing Hono/strict-command/transaction boundary instead of a parallel task backend | Svelte application code, deployment assumptions, or licence metadata taken out of context |
| OpenCircle | Conversations organised around a channel/context instead of an unstructured feed | Notes live with the work; authorised task briefs can be found without indexing private notes | Global aggregation of restricted project discussion, or an alpha backend migration |
| LearnHouse | Explicit discussion identities and state; a useful next benchmark for course authoring | Typed task notes and clear resource ownership; authoring is queued for a focused code review | Whole enterprise features, a second organisation model or a collaborative editor server before needed |
| Roost | A coherent combined community/learning/showcase surface | Keep work, evidence and project presentation in the same application; retain the project overview rather than replace it | Source imports based only on its README's MIT statement; its media assets or alternate database stack |

These are our assessments, not comparative certifications. Each source's exact path and commit or blob is in the register.

## What is actually reused in this release

**No donor application's source file was copied into the REUNIR runtime in Alpha 05.** The HumHub task state concepts and Frappe submission controls are behavioural references. Translating their implementation into another language would not automatically remove licence obligations, so that is not what this release claims to do.

The substantial code reuse is of REUNIR's already tested implementation: contribution submission/resubmission/review; the shared EvidenceReview React component; tenant transactions; request idempotency; command validation; notifications; audit/outbox; project membership; existing purpose milestones and outcomes; database driver and schema tooling. The new task references one existing contribution. There is no duplicate approval engine, duplicate completion table or invented reputation award.

Existing locked libraries continue handling authentication, routing, query state, validation, SQL transport and browser behaviour. We added no runtime dependency. This is selective extension, not building every primitive ourselves.

## Direct imports are allowed, with evidence

We are not adopting a blanket clean-room-only policy. Before copying a file, record its upstream commit, exact licence grant and notices, dependency and asset licences, security review, modifications and tests. AGPL permits commercial use; it can entail source-sharing obligations for covered work. A service/API boundary is not, by itself, a legal clearance. Select the commercial/licensing model deliberately before importing copyleft application code.

Primary licence text: https://www.gnu.org/licenses/agpl-3.0.en.html

Roost's advertised MIT classification remains a hold for direct source import until applicable licence and notice evidence has been confirmed. It is still usable as a product reference. This register is engineering provenance, not legal advice or a licence audit.

## Next focused comparisons

1. **Creator authoring**: lesson drafts, publish states, structured content, safe rendering and assessment delivery. Inspect LearnHouse's actual editor/activity code, ClassroomIO's course services and Frappe's evaluation flows. Evaluate small permissive editor libraries separately.
2. **Knowledge that survives the feed**: curated answers, revisions, author attribution and access inheritance. Inspect HumHub Wiki and Discourse's accepted-answer mechanisms only when that slice is selected.
3. **Private evidence attachments**: finish the existing storage capability flow rather than create another uploader. Compare upstream ownership and attachment validation and test actual storage integration.
4. **Read-model scale**: replace bounded workspace snapshots with focused pagination before large communities; task boards currently cap active work at 100 tasks per project, not an unlimited project-management system.

Source publication, a dedicated Neon staging environment, hosted account/browser tests, real email receipt and restore rehearsal remain pilot gates. This workboard does not make them complete.

## Repeatable research discipline

For each significant feature: select no more than two or three relevant implementations; inspect source beyond marketing; classify borrow/reuse/import/skip; record our adaptation and acceptance tests; ship the smallest coherent slice; revisit actual usage. `python3 scripts/check_research.py` verifies the register's structure and that implemented decisions point to real files and tests. It cannot decide whether a legal interpretation is correct or whether the referenced tests pass. The supplied CI runs the checker; CI itself has not run remotely.
