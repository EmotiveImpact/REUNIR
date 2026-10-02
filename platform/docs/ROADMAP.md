# REUNIR roadmap after Alpha 07 UI integration

## Product mission, not a new scope

People + Purpose + Progress + Projects + Proof. People join to become, build or achieve something. Code Black is the first tenant, not a hard-coded fork. Keep the full product doctrine in PRODUCT_DOCTRINE.md and the researched reuse decisions. No artificial engagement score grants permissions or credentials.

## Built and preserved

| Wave | Delivered implementation | Remaining boundary |
| --- | --- | --- |
| Alpha 01 | Communities, spaces/posts/comments, learning, missions, projects, events, notifications, search and moderation | Local engineering alpha, not a hosted launch |
| Alpha 02 | Purpose, paths, milestones, private goals, contributions, reviewed outcomes and outputs | Community review, not accreditation or portable credentials |
| Alpha 03 | Invitations/recovery, durable mail queue, participant-private 1:1 messaging, blocking/reporting and member access | Email needs configured delivery; no group chat/MFA |
| Alpha 04 | Pilot console, runtime privilege guards, fenced retries and release tooling | Observations are not production certification |
| Alpha 05 | Project workboards, assignments, task discussion and existing proof review | No task file uploads or realtime collaboration |
| Alpha 06 | Private lesson drafts, explicit publishing, revision history, restore-as-draft and ordering | Plain text/resource links; no rich blocks/private attachments |
| Alpha 07 | Approved v4 shell/Home in the actual React application, shadcn Button/Avatar/Menu, photo fixtures and responsive navigation | Not a full replacement of every form with shadcn; hosted pilot remains separate |

UI_DESIGN_DIRECTION.md records the approved interface. Do not restart design exploration or discard existing routes while implementing the next feature.

## Immediate release work: make the pilot operable

1. **Source publication completed:** PR #1 contains the full Alpha 07 tree, verified against recovered checkpoint `76b31ab` and fetched back without differences. Preserve historical transport/dependency branches without merging them into the app. Never force-push or overwrite parallel work.
2. **Application and PostgreSQL CI completed:** run 36964804738 passed all application, HTTP, demo-browser, connected-browser and PostgreSQL checks on commit `75b3f2b`. PR #1 tracks the final source integration. Dependency-resolution CI is no longer the only remote evidence.
3. Connect the intended dedicated Neon staging database, run the seven existing migrations and restricted-runtime grants. Do not reuse another application's database or put migration credentials on the web server.
4. Connect a live-mode Vercel staging build, verified transactional sender and scheduled mail worker. Provision the real owner, use approved Code Black content and receive actual invitation/recovery messages.
5. Complete hosted-browser two-person/two-tenant privacy tests, backups and restore rehearsal, monitoring and support/moderation responsibility. Only then invite a small consented Code Black pilot.

## Next product slices

**Creator Studio 2:** choose a suitable permissively licensed block editor; add headings/lists/links/images and safe video embedding incrementally, private resource upload lifecycle and assessments. Preserve plaintext compatibility, draft versus published separation and immutable review attribution.

**Everyday reliability:** page-level cursor pagination beyond messages, notification preferences/digests, role-scoped instructor workflows and useful content curation. Replace placeholder course/project art with authorised original content. Improve loading/error/empty states through real pilot observations.

**Account and trust operations:** privileged MFA, general email verification/change, export/deletion and retention, ownership transfer, moderator appeals/escalation, reviewed-evidence correction/revocation history and consented multi-contributor credits.

## Commercial platform stage

Owner onboarding, custom-domain verification, paid memberships and entitlements, tenant quotas, operational billing/support, migrations between hosting options and independently reviewed security/privacy. A reusable tenant model is already present; it does not mean these commercial operations are finished.

## Preserved long-term mission, deliberately deferred

Curated institutional knowledge; programme/cohort rituals; mentorship, apprenticeships, alumni and leadership succession; contribution relationships and consented portable proof profiles; outcome-based reporting; AI that helps people find relevant human collaborators and work. Funding, marketplaces, cross-community discovery and sophisticated credentials are not this release's completion criteria.

No arbitrary percentage describes the entire vision. Track each slice as implemented, verified locally, verified remotely, deployed or operated with real members.
