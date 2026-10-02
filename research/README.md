# REUNIR research workspace

The reference clones are disposable. Our notes, provenance register and implementation decisions are not.

Start with **notes/10_RESEARCH_TO_BUILD_ALPHA_05.md** and **reuse-register.json**. The register connects upstream source to decisions, implemented files, tests and explicit holds. Run `python3 scripts/check_research.py` from the REUNIR root to validate those links.

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

This runtime could inspect files through the GitHub connector, but direct GitHub DNS/clone access failed. No complete clone/download of all repositories is claimed or included in the release. The documented reads are narrower than a whole-repository audit. No repository code, install hooks or unknown setup scripts were executed to perform this review.

## Build discipline

A significant new slice should identify a relevant reference, classify what is reused, pin evidence, connect it to tests, and document differences. A tick in the register does not certify production maturity. The next queued product investigation is creator authoring, not an indefinite broad search for more platforms.
