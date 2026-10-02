# REUNIR build continuity

Read SESSION_HANDOFF.md, platform/docs/BUILD_STATUS.md, platform/docs/PRD.md, platform/docs/PRODUCT_DOCTRINE.md and platform/docs/UI_DESIGN_DIRECTION.md before extending the application. Inspect the real working tree, branches and remote first. The default GitHub branch has not historically been the complete application; never assume a preparatory workflow is the source.

Preserve the modular React/Vite + Hono + Better Auth + PostgreSQL architecture. Keep ordinary community features and the purpose/evidence layer. Do not turn private goals or messages into public activity, infer credentials from engagement, or rewrite reviewed history.

Use additive migrations and explicit runtime grants. Preserve earlier migration bytes. Keep cross-tenant and inactive-role tests. Treat community review as community review, not external accreditation. Never put secrets or real personal data into the browser demonstration.

Before a risky or long-running step: inspect git status, make a coherent local source commit and create a recovery bundle. Commit only reviewed source, documentation and tests. Exclude dependencies, environment secrets, local databases, build output and generated screenshots unless intentionally packaged separately.

After an authorised push: read the remote ref back and compare it to the intended commit. Record what actually reached GitHub. A note, patch, dependency workflow or branch name is not the full application. Never force-push or merge main without explicit approval. If transport fails, preserve the source and state the precise failed operation. Do not conceal the gap by creating another release label.

Keep SESSION_HANDOFF.md and BUILD_STATUS.md current with exact tests, failed attempts, unverified infrastructure and next actions. A long conversation is not the source of truth; the verified source and its status records are.

No new external deployment, database, email sender or scheduler should affect another project. Do not ask users to paste credentials into chat.

The current interface contract is black, white and neutral grey. Earlier coloured moodboards are historical, not authority to restore decorative accents. Keep original user evidence intact. Run `python3 -m unittest discover -s scripts -p "test_*.py"` and the monochrome browser check for presentation changes.


Approved v4 is integrated as Alpha 07. The second sidebar has neither search nor a community switcher, and there is one top-right account menu. Do not restore duplicate bottom account avatars. Use actual shadcn/Radix components and Lucide icons where appropriate, retain natural portraits in content, and never assign fictional demo portraits to connected users. Run `npm run test:browser:v4` after shell changes. The latest user requested merging completed work; this does not authorise force-pushing, ignoring failing tests or merging incomplete transport branches.
