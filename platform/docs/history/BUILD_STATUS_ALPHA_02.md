# Build status · REUNIR Alpha 02

24 September 2026. This describes the delivered files and locally verified behaviour, not an eventual roadmap or a live deployment.

## Delivery

The existing Alpha 01 React/Vite + Hono + Better Auth + PostgreSQL architecture is retained. Alpha 02 adds purpose-led Home, Paths, milestones derived from existing learning/mission/project evidence, private-by-default member goals, contribution review, separately reviewed outcomes, community outputs, profile evidence and Knowledge navigation. Discussions remain fully accessible, without being the mandatory home screen.

Eight new domain collections extend the previous 23 to 31. Fifteen validated commands extend the existing 22 to 37. Project gains a nullable purpose link. Purpose kinds are Become, Build and Achieve, and a community may define only one. No forced all-three onboarding, graph engine, numeric reputation graph or automated credential is introduced.

The updated PRD, doctrine, architecture, direction audit, ADR, migration instructions and roadmap accompany source and actual screenshots. Prior product documents are preserved under `docs/history/`.

## Verification

| Check | Result in this pass |
| --- | --- |
| Recovered Alpha 01 baseline | Original 107 tests passed before changes |
| Full current automated suite | 177 passed, 0 failed, 0 cancelled, 0 skipped |
| New purpose-domain coverage | 49 tests |
| New database, upgrade and API coverage | 21 tests |
| Retained browser regression suite | 24 checks passed |
| New purpose browser suite | 34 checks passed |
| Total completed browser checks | 58 across the two suites |
| Automated accessibility | No reported violations on Home, Paths, Outputs, Profile and Knowledge in the tested states |
| Strict TypeScript | Passed |
| Vite production build and self-contained React bundle | Passed |

Evidence is in `evidence/alpha02/summary.json`, `all-tests.tap`, `build.log`, `regression/browser-tests.json`, `purpose/results.json`, the respective accessibility reports and screenshots. The browser suites each completed successfully; they were run separately because the combined command exceeded a single execution-call limit in this environment. The final reports are not inferred from a partially completed run.

The upgrade test populated migration 0001 with existing members, posts and projects, applied 0002, and verified preservation rather than an empty-install-only success. The original migration is unchanged, SHA-256 `a7e48a65603c391acc0d04df4c793a9aa977f4a34a6b3b74e93c8972524f991b`.

Other tests cover ordinary-member and administrator goal privacy; role/source ownership; private-space nesting; no self-review even for admins; changes-requested/resubmission; actual evidence-derived milestone progress; explicit goal completion evidence; relational tenant constraints; non-owner RLS on the new tables; safe repeatable runtime grants; event idempotency; and the persisted contribution-to-outcome-to-output flow. Browser checks include 390px and 360px layouts and same-route mobile drawer closure.

## Evidence limitations

SQL tests use PGlite, an embedded PostgreSQL runtime. They do not establish live Neon pooling, production concurrency, restore reliability, regional performance or a deployed customer's data integrity. Browser tests render the actual compiled React bundle with isolated fictional state in an in-memory document. The constrained environment uses MemoryRouter for this embedding; ordinary web/file origins use HashRouter. Hosted routing and cookies need a staging check.

The five accessibility scans are automated observations on specified states, not a full accessibility certification. Reports retain incomplete/manual-review checks. Storage boundaries still use an explicitly fake provider, not a real Google bucket transfer. Alpha 01's separate four-check local Node HTTP smoke remains historical and was not independently rerun as a new Alpha 02 result.

The current main JavaScript chunk is approximately 570 kB minified, 170 kB gzip; CSS approximately 79 kB, 17 kB gzip. Vite emits a chunk-size advisory and ignores library-level directives/annotations. This is a successful build, not a warning-free build or dependency vulnerability audit. Route splitting remains optimisation work.

## Source-control and external status

The deliverable is a local source archive and browser demonstration. The latest inspected GitHub main branch still contained its README; the Alpha 01 and Alpha 02 remote build branches contained preparatory toolchain/asset workflows, not the complete app. No source push, pull request, merge or remote application CI run was performed in this pass. Supplied CI configuration is reproducible but not evidence of a remotely green application build.

No live Neon database, Vercel deployment, Google bucket, IAM configuration, domain or production account was created or changed in this pass. Do not present the preview as a hosted community or store real member information in it.

## Remaining release gates

The next milestone is a connected invitation-only Code Black pilot: independently inspect and push the source, run application CI, select the intended Neon project, rehearse the additive migration and runtime role permissions, configure Vercel staging and secure owner provisioning, test live isolation/cookies, and rehearse backups and restore. Never put migration credentials in the runtime application.

Core missing capabilities still include invitation email, email verification/recovery and privileged MFA; messaging; wider member administration and lifecycle export/deletion; operational monitoring; worker delivery; richer authoring and private attachments; pagination; paid memberships; abuse controls and independent security review.

Existing snapshot bounds remain 5,000 rows per collection and 20,000 total rows. A per-community write lock remains. This engineering alpha is not a mature high-concurrency service or public-launch approval.

Reviewed contributions and verified outcomes mean community review by an identified member, not accreditation or independent real-world verification. Published outputs are a member-visible community archive, not automatic public internet publication. Private goals are protected through application permissions, not encrypted from the database operator. Multi-contributor credit, revocation and sophisticated proof standards remain future work.
