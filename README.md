# REUNIR

**Alpha 07: the approved v4 interface integrated into the existing application.**

Start with SESSION_HANDOFF.md, platform/docs/BUILD_STATUS.md and platform/docs/ROADMAP.md. The complete source is here, including previous purpose, community, learning, work, messaging and creator functionality. This is not the old standalone HTML reference.

From `platform/`: `npm ci`, then `npm run dev`. Demo mode needs no credentials and uses fictional local data. Connected mode must follow platform/docs/SETUP.md and RELEASE_GATES.md. Do not enter real private data into the demo.

A local release or preview is not GitHub publication or a deployment. See the delivery receipt and BUILD_STATUS.md for precise verified boundaries.

## Earlier project overview · Creator-authoring recovery

**Where people come together to become something, build something or achieve something.**

People + Purpose + Progress + Projects + Proof. Application `0.6.0-alpha.1`, extending the verified Alpha 05 source rather than restarting the product.

Start with **SESSION_HANDOFF.md**. It distinguishes recovered source, new work, local Git, the remote recovery note and the still-unfinished full-source publication. The complete application lives under `platform/`, and research provenance under `research/`.

This slice adds a private Creator studio: lesson drafts, save and preview, deliberate publishing, captured/published revision history, restore-as-draft, archive/restore and version-checked lesson ordering. The existing social, purpose, project, proof, messaging and pilot functions remain. No rich editor, new runtime package or imported donor application file is claimed.

In the accompanying standalone preview, choose Preview as admin, Paths & learning, Course library, a track, then Creator studio. The demonstration is fictional and browser-local. Do not put confidential information into it. Live mode uses the existing API and never substitutes fictional data silently.

Verified in the recovery build: 369 application tests, 158 demonstration-browser checks, 17 local HTTP checks and 21 helper tests; TypeScript and builds passed. See `platform/docs/BUILD_STATUS.md` for exact scope. Earlier migrations 0001–0006 are unchanged; migration 0007 extends authoring.

Full GitHub source publication, remote application CI, Neon/Vercel integration, real email and hosted-browser/restore acceptance remain unverified. A remote recovery note is not the app. A source archive and full-history Git bundle provide a recoverable handover.

From this root, `python3 scripts/publish_source.py` verifies the source manifest offline. In an authorised network-capable Git environment, `--prepare` stages a non-destructive reviewed import; `--push` publishes a new integration branch and verifies its remote commit. It never force-pushes or merges main.

Read `platform/README.md` for development commands, `platform/docs/PRD.md` for scope and `platform/docs/CREATOR_AUTHORING.md` for this change. Read AGENTS.md before continuing the build.


### Current interface continuation

Black, white and neutral grey are the current interface direction; see `platform/docs/UI_DESIGN_DIRECTION.md`. Read `SESSION_HANDOFF.md` before continuing. The original full Alpha 06 baseline is preserved in Git history; this local patch is not a claim of GitHub publication or deployment.
