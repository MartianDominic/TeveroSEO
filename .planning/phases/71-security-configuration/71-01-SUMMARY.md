# Phase 71 Plan 01: Configuration Consolidation Summary

```yaml
---
phase: 71-security-configuration
plan: 01
subsystem: configuration
tags: [env-vars, validation, docker, security]
dependency_graph:
  requires: [67-03]
  provides: [standardized-env-vars, startup-validation]
  affects: [apps/web, AI-Writer, open-seo-main, docker-compose]
tech_stack:
  added: []
  patterns: [zod-env-validation, fail-fast-startup]
key_files:
  created: []
  modified:
    - docker-compose.vps.yml
    - .env.vps.example
    - apps/web/src/lib/env.ts
    - apps/web/src/app/api/connections/route.ts
    - apps/web/src/app/api/connections/[id]/route.ts
    - apps/web/src/app/api/connections/[id]/sync/route.ts
    - apps/web/src/app/api/connections/wordpress/connect/route.ts
    - apps/web/src/lib/api/onboarding.ts
    - open-seo-main/src/server/services/client-sync/ClientSyncService.ts
    - open-seo-main/src/server/features/briefs/services/AIWriterClient.ts
    - AI-Writer/backend/config/env_validator.py
decisions:
  - BACKEND_URL migrated to OPEN_SEO_URL for clarity
  - AIWRITER_INTERNAL_URL migrated to AI_WRITER_URL for consistency
  - Legacy fallbacks removed to enforce standardized naming
  - Zod refine() used for production-only required validation
metrics:
  duration: 3m 8s
  completed: 2026-05-04T11:02:59Z
---
```

## One-liner

Standardized env var naming (BACKEND_URL -> OPEN_SEO_URL, AIWRITER_INTERNAL_URL -> AI_WRITER_URL) with Zod startup validation requiring 32-char INTERNAL_API_KEY and production-enforced secrets.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Standardize Env Var Names | cc09b67 | 9 files (apps/web routes, docker-compose, open-seo services, AI-Writer validator) |
| 2 | Add Missing Env Vars | b6849f0 | docker-compose.vps.yml |
| 3 | Add Startup Validation | efad187 | apps/web/src/lib/env.ts |
| 4 | Document All Env Vars | ec50601 | .env.vps.example |

## Key Changes

### Task 1: Standardized Env Var Names

Migrated inconsistent env var names to standardized convention:

| Old Name | New Name | Used By |
|----------|----------|---------|
| BACKEND_URL | OPEN_SEO_URL | apps/web API routes |
| AIWRITER_INTERNAL_URL | AI_WRITER_URL | docker-compose, open-seo services |
| OPEN_SEO_API_URL | OPEN_SEO_URL | AI-Writer env validator |

Removed legacy fallbacks to enforce single naming convention.

### Task 2: Added Missing Env Vars

Added to docker-compose.vps.yml:

| Variable | Service | Purpose |
|----------|---------|---------|
| ANTHROPIC_API_KEY | ai-writer-backend, tevero-web | AI features |
| STRIPE_SECRET_KEY | tevero-web | Payment processing |
| STRIPE_WEBHOOK_SECRET | tevero-web | Webhook verification |
| RESEND_API_KEY | tevero-web | Email notifications |
| ASSET_SIGNING_KEY | ai-writer-backend, tevero-web | Secure URL signing |

### Task 3: Startup Validation

Enhanced apps/web env.ts with Zod validation:

- INTERNAL_API_KEY: min 32 chars, required in production
- ANTHROPIC_API_KEY: min 20 chars, required in production
- STRIPE_SECRET_KEY: must start with `sk_`, required in production
- STRIPE_WEBHOOK_SECRET: must start with `whsec_`, required in production
- RESEND_API_KEY: required in production
- ASSET_SIGNING_KEY: min 32 chars, required in production

All validations use `refine()` to fail fast with clear error messages.

### Task 4: Documentation

Updated .env.vps.example:

- Added NEXT_PUBLIC_WS_URL for client WebSocket connections
- Fixed WS_PORT to 3003 (matches docker-compose.vps.yml)
- All variables documented with descriptions and generation commands

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation passes (`npx tsc --noEmit --skipLibCheck`)
- All modified files follow naming convention
- docker-compose.vps.yml has all required variables
- .env.vps.example documents all variables

## Self-Check: PASSED

- [x] cc09b67 commit exists
- [x] b6849f0 commit exists
- [x] efad187 commit exists
- [x] ec50601 commit exists
- [x] All modified files exist and contain expected changes
