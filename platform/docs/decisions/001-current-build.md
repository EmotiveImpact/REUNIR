# ADR 001: Lean deployable alpha

Status: accepted for this build based on the owner's 24 September instructions.

Keep React/Vite, a TypeScript Hono API, PostgreSQL, tenant isolation and Code Black as the first organisation. Use mature libraries. Replace the earlier blanket clean-room policy with explicit, recorded selective reuse. Keep all uncleared research source out of the shipping application.

Start with a transactional Postgres outbox rather than making Redis compulsory. Add Redis or a managed realtime service only when chat/presence or measured workload justifies it. Google Cloud Storage is the first optional object-store adapter; the provider interface remains replaceable.

A visible local demo is useful for design review. It must never masquerade as a configured Neon account, live members, real messages, real email delivery or a production deployment.
