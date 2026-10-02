> HISTORICAL PLANNING DOCUMENT. Superseded for the current build by PRD.md, ARCHITECTURE.md and decisions/001-current-build.md. This is not a claim of shipped features.

# REUNIR Architecture v0.1

## Shape

Modular monolith with separate web/API/worker processes and shared typed packages.

```text
Browser
  |
  v
Web app  ---> API
             | \
             |  ---> Redis / realtime / jobs
             |
             ---> PostgreSQL
             ---> S3-compatible object storage
             ---> email/payment/integration providers

Worker <--- Redis jobs ---> API/domain services
```

## Domain modules

```text
identity
organizations
tenancy
permissions
community
spaces
messaging
learning
cohorts
missions
projects
events
reputation
notifications
moderation
search
media
commerce
integrations
analytics
```

## Boundary rules

- routes validate/authenticate and call services
- services own business rules and transactions
- query modules own database access
- cross-domain interactions prefer domain events or explicit service interfaces
- all tenant-owned service calls require tenant context
- external providers sit behind adapters
