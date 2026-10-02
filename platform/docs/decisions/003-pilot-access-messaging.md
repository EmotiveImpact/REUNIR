# ADR 003: safe access and private communication

Status: implemented in Alpha 03; cloud acceptance not completed.

Keep the purpose-led modular monolith and existing provider-based authentication. Add personal invitation redemption around the provider, not a replacement account system. Public signup stays disabled. Reuse Better Auth reset/session revocation rather than implementing password tokens ourselves.

Use a small encrypted transactional mail outbox with a transport boundary. Resend is the first optional provider. An operator-configured worker is necessary for delivery. Do not introduce Redis or synchronous external mail into registration/recovery requests.

Keep private messages outside community snapshots and the activity/progress event stream. One-to-one text, pagination, monotonically advancing read markers, sender-scoped retry keys, blocking and selected-message reports are the current product. The schema can gain new conversation types later through a deliberate migration; it does not label unfinished group chat as implemented.

Membership suspension is non-destructive and requires a reason. Only an owner grants elevated roles. Ownership transfer and deletion remain explicit future operations, not destructive shortcuts hidden in an admin dropdown.

Do not deploy to an arbitrary existing Neon project. Obtain the intended binding, test migration and pooled role behaviour on staging, then configure the hosted environment. Local PGlite tests and in-memory browser demonstrations do not establish live cloud readiness.
