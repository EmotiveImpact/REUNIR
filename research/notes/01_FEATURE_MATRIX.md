# REUNIR Feature Matrix

Legend: **Strong** = substantial/native capability; **Some** = present but secondary/limited; **No** = not a meaningful native capability; **N/A** = not the product's concern.

| Capability | Roost | OpenCircle | ClassroomIO | LearnHouse | Frappe Learning | HumHub | REUNIR direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Community feed | **Strong** | **Strong** | Some | Some | Some | **Strong** | **Strong** |
| Spaces/groups/channels | **Strong** | **Strong** | Some | **Strong** communities/user groups | Some batches | **Strong** | **Strong** universal Spaces |
| Profiles/member directory | **Strong** | Some | **Strong** learner/org membership | **Strong** | **Strong** learners | **Strong** | **Strong** identity + portfolio |
| Following/social graph | **Strong** | Some | No/limited | Some | No | **Strong** | Some, not required for v1 |
| Comments/reactions | **Strong** | **Strong** | Some | **Strong** | **Strong** discussions | **Strong** | **Strong** |
| Direct messaging | **Strong** | Limited | No/limited | Limited | No | **Strong** via module | **Strong** |
| Notifications/preferences | **Strong** | **Strong** | **Strong** | **Strong** | **Strong** | **Strong** | **Strong** + digest |
| Moderation/reporting | Some | Some | **Strong** reports | **Strong** configurable moderation | Some | **Strong** | **Strong** |
| Courses/tracks | **Strong** | **Strong** | **Strong** | **Strong** | **Strong** | No | **Strong** |
| Block content editor | Basic | Basic | **Strong** | **Strong** | **Strong** | Some | **Strong** |
| Quizzes | Some | **Strong** | **Strong** | **Strong** | **Strong** | No | **Strong** |
| Assignments/submissions | Some | **Strong** | **Strong** | **Strong** | **Strong** | Tasks via module | **Strong**, surfaced as Missions |
| Course progress | **Strong** | **Strong** | **Strong** | **Strong** | **Strong** | No | **Strong** |
| Cohorts/batches | Group-led | Limited | **Strong** | Some user groups | **Strong** | Spaces can approximate | **Strong** |
| Cohort goals | No | No | **Strong** | No | Some | No | **Strong** |
| Certificates | No/limited | No | **Strong** | **Strong** verification | **Strong** evaluations | No | Later |
| Live classes/sessions | **Strong** live room | Limited | Some | Some | **Strong** Zoom | Events/modules | **Strong** events/live |
| Events + RSVP | **Strong** | Limited | Some | Some | Some | Module | **Strong** |
| Project/showcase | **Strong** | No | No | Showcase discussion label + boards | No | Project spaces possible | **Core differentiator** |
| Collaborative boards | No | No | No | **Strong** Yjs boards | No | OnlyOffice/module | Later/optional |
| Missions/challenges | No | Assignment-like | Assignment-like | Assignment-like | Assignment-like | Tasks module | **Core differentiator** |
| Opportunity/job board | No | No | No | No | **Strong** | Possible module | **Strong** after core |
| Points | **Strong** | No | No | No | Badges | No | **Ledger from day one** |
| Badges | Limited | No | Certificates | Some | **Strong** | Module ecosystem | **Strong** |
| Leaderboard | **Strong** | No | No | No | No/limited | No | **Configurable** |
| Payments | **Strong** scaffolding | No | Some course payment flows | **Strong**, enterprise | **Strong** gateway workflow | Modules | **Strong** platform commerce |
| Multi-tenant SaaS model | No | No | **Strong** | **Strong**, enterprise | Per-site rather than shared tenant model | No | **Mandatory** |
| Custom branding/domain | Some | Some | Enterprise-gated | **Strong**, enterprise | Some | **Strong** themes | **Strong** |
| API/webhooks | Some | API | **Strong** | API | Frappe APIs | REST module | **Strong** |
| AI authoring/tutor | No | No | **Strong** | **Strong** | Some/expanding | No | Provider-agnostic, optional |
| Self-host installer | **Strong** | Docker | **Strong** docs | **Strong** CLI | **Strong** install | **Strong** | **Strong** |
| Modular extension system | Feature flags | Service modules | Monorepo packages | App/services | Frappe apps | **Strong** modules | **Strong internal modules** |

## What REUNIR should treat as v1

### Member product

- Home/feed
- Spaces
- Profiles + member directory
- Posts/comments/reactions
- Tracks/courses
- Lessons/progress
- Missions/submissions
- Projects/project updates/proof
- Events/RSVP
- Notifications
- Search
- Basic points/reputation

### Community operator

- Organisation settings
- Roles/permissions
- Member management
- Space management
- Track/course builder
- Mission builder
- Project/showcase configuration
- Event management
- Moderation/report queue
- Appearance/terminology
- Basic analytics

### Platform/operator

- tenant creation
- plans/entitlements
- billing hooks
- domain/branding controls
- audit log
- webhook delivery
- worker/queue monitoring
- storage controls

## What should wait

- full collaborative whiteboards
- SCORM compatibility
- advanced certificates
- sophisticated AI agents
- marketplace/plugin ecosystem
- enterprise SSO/SAML
- advanced recommendation engine
- mobile native apps
- built-in live video infrastructure

The architecture should leave room for these without making v1 dependent on them.
