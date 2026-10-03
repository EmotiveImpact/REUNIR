# REUNIR research workspace

The reference clones are disposable. Our notes, provenance register and implementation decisions are not.

Start with **notes/10_RESEARCH_TO_BUILD_ALPHA_05.md** and **reuse-register.json**. The latest targeted review is **notes/16_COVER_IMAGES.md** (cover images: course cards in Frappe Learning, LearnHouse and ClassroomIO, axe-core's contrast code and WCAG failure F83, at pinned commits), after **notes/15_ASSESSMENTS.md** (knowledge checks) and **notes/14_LESSON_RESOURCES.md** (private lesson files). The register connects upstream source to decisions, implemented files, tests and explicit holds. Run `python3 scripts/check_research.py` from the REUNIR root to validate those links.

No whole upstream application source was copied into Alpha 05. That is not a blanket ban on imports: clear individual licences, notices, dependencies and tests before adapting code. AGPL allows commercial use under its terms, not unrestricted proprietary relicensing.

## Sources

The six core projects remain Roost, OpenCircle, ClassroomIO, LearnHouse, Frappe Learning and HumHub. Their roles and reviewed snapshots are in the register. Optional projects include Discourse, Forem, Flarum, BuddyPress, Moodle, Open edX and now the official HumHub Tasks module.

Historical repository sizes and stars in notes/repo_snapshot.tsv are historical observations, not live facts or deployment-size estimates.

## Commands

```sh
cd research
./clone-research.sh              # Six core repositories
./clone-research.sh optional humhub-tasks
./clone-research.sh list
./cleanup-research.sh all        # Deletes clones, preserves our notes/manifest
```

Earlier runtimes inspected files through the GitHub connector because direct clones failed. On 2 and 3 October 2026 the Alpha 09, Alpha 10 and Alpha 11 reviews made shallow clones of LearnHouse, Frappe Learning and ClassroomIO, and for Alpha 11 of axe-core and the W3C WCAG source, outside this repository and read specific files only. No clone is included in the release, and no repository code was executed. The documented reads are narrower than a whole-repository audit. No repository code, install hooks or unknown setup scripts were executed to perform this review.

## Build discipline

A significant new slice should identify a relevant reference, classify what is reused, pin evidence, connect it to tests, and document differences. A tick in the register does not certify production maturity. The next queued product investigation is creator authoring, not an indefinite broad search for more platforms.
