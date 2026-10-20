# Ferven build status

What has been built, checked and merged, newest first. The full evidence for each earlier release (exact checks, test counts and what was not verified) is kept word for word in [history/BUILD_STATUS_ALPHA_07_TO_65.md](history/BUILD_STATUS_ALPHA_07_TO_65.md); older files beside it cover Alpha 01 to 06. CHANGELOG.md describes every release in plain language and ROADMAP.md records each one's limits.

## Alpha 66: records and code tidied

20 October 2026, on `claude/stoic-euler-lx2zk7`. No change to how the application behaves, no decision record and no migration. Version stays 0.39.0-alpha.1.

### What changed

- SESSION_HANDOFF.md and this file were cut to the current state. Their history moved, unchanged, to `history/SESSION_HANDOFF_ALPHA_07_TO_65.md` and `history/BUILD_STATUS_ALPHA_07_TO_65.md`.
- The root and platform READMEs say Ferven, give the right migration count and point to current documents; the old Alpha 05 notes at the end of the platform README moved to `history/PLATFORM_README_ALPHA_05.md`.
- ROADMAP.md's next steps and launch steps match main (38 migration files, numbered to 0051).

### Checks run

Recorded when the checks finish.

### Publication

Recorded after the push and CI run.

## Recent releases

| Alpha | What it added | Pull request | Merge commit on main |
| --- | --- | --- | --- |
| 65 | Link previews and add to home screen | #56 | `c4923e0`; CI run 38199388783 passed on main |
| 64 | The demo calendar follows today | #55 | `6cb4249` |
| 63 | Readable text on phones | #54 | `d66e509` |
| 62 | Tidier People cards and plain covers | #53 | `c1f9500` |
| 61 | The app is called Ferven | #52 | `20eb723` |
| 60 | Usage counts that name no one (records in #51) | #50 | `4d3a75c` |
| 59 | Credits on outcomes | #49 | `a9fa260` |
| 58 | Appeals for suspensions and message reports | #48 | `22e0171` |
| 57 | Chapters in lesson videos | #47 | `ee1f17b` |
| 56 | Partial marks on multiple-choice questions | #46 | `4a019f8` |
| 55 | One confirmation box across the app | #45 | `ea77b43` |
| 54 | Leaving project teams, lesson captions and video resume | #44 | `0d14bcc` |
| 53 | Feeds paged in SQL | #43 | `cae20e1` |
| 52 | Records brought up to date | #42 | `fa3013a` |
| 51 | App, accessibility and speed fixes from the October audit | #41 | `7ffb982` |
| 50 | Security fixes from the October audit | #40 | `57fd2e6` |

Alpha 01 to 49 are listed in ROADMAP.md and CHANGELOG.md, with their evidence in the history files.

## Never yet verified

Everything below is built and tested locally and in GitHub Actions, but has never run against the real service. Each waits for the owner's staging accounts (STAGING_LAUNCH.md).

- A hosted Neon database, a Vercel deployment in connected mode and hosted Better Auth sessions.
- Real email delivery: confirmation, invitations, password reset and digests.
- Google Cloud Storage: signed uploads and downloads, IAM, bucket CORS and deletion.
- A real ClamAV scanner and scan worker host, including a clean file, the EICAR test file and a scanner outage.
- Backups and a restore rehearsal; two-person and two-community privacy checks on the hosted site.
- Enforcing the Content-Security-Policy (report-only until a clean staging run) and testing with a real screen reader.
