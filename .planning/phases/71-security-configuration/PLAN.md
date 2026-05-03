# Phase 71: Security & Configuration

**Milestone:** v8.0 SaaS Hardening
**Duration:** 2 weeks
**Priority:** HIGH - Security hardening

## Overview

Configuration consolidation, security hardening, and migration safety improvements.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 71-01 | Configuration Consolidation | 1 | 67-03 |
| 71-02 | Security Hardening | 1 | 71-01 |
| 71-03 | Migration Safety | 2 | 67-03 |

## Issues Resolved

- ENV naming inconsistencies
- Missing env var validation
- ToBeMigrated/ folder risk
- Security dependencies unpinned
- Migration rollback gaps

---

## Plan 71-01: Configuration Consolidation

```yaml
---
phase: 71-security-configuration
plan: 01
type: execute
wave: 1
depends_on: [67-03]
files_modified:
  - docker-compose.vps.yml
  - .env.vps.example
  - apps/web/src/lib/env.ts
  - AI-Writer/backend/app/core/config.py
autonomous: true
requirements:
  - CONFIG-01
  - CONFIG-02
must_haves:
  truths:
    - Env var naming follows convention (SERVICE_URL, SERVICE_API_KEY)
    - All required env vars validated at startup
    - docker-compose.vps.yml has all required variables
    - INTERNAL_API_KEY requires 32-char minimum
  artifacts:
    - .env.vps.example (documented with all vars)
    - apps/web/src/lib/env.ts (Zod validation)
  key_links:
    - Zod for env validation
---
```

<objective>
Standardize environment variable naming, add startup validation, and complete docker-compose configuration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Standardize Env Var Names

Migrate:
- BACKEND_URL -> AI_WRITER_URL
- AIWRITER_INTERNAL_URL -> AI_WRITER_URL

Files: `docker-compose.vps.yml`, related configs

Acceptance:
- [ ] Consistent naming across services

### Task 2: Add Missing Env Vars to docker-compose

Add:
- ANTHROPIC_API_KEY
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- ASSET_SIGNING_KEY

Files: `docker-compose.vps.yml`

Acceptance:
- [ ] All services have required vars

### Task 3: Add Startup Validation

Files: `apps/web/src/lib/env.ts`, `AI-Writer/backend/app/core/config.py`

Acceptance:
- [ ] Missing vars fail startup with clear message
- [ ] INTERNAL_API_KEY min 32 chars

### Task 4: Document All Env Vars

Files: `.env.vps.example`

Acceptance:
- [ ] All vars listed with descriptions
- [ ] Placeholder values for secrets

---

## Plan 71-02: Security Hardening

```yaml
---
phase: 71-security-configuration
plan: 02
type: execute
wave: 1
depends_on: [71-01]
files_modified:
  - .husky/pre-commit
  - .github/workflows/security.yml
  - apps/web/package.json
  - open-seo-main/src/server/middleware/security-headers.ts
autonomous: true
requirements:
  - SEC-01
  - SEC-02
  - SEC-03
must_haves:
  truths:
    - Pre-commit hook detects secret commits
    - CI runs Gitleaks on every PR
    - Security-critical deps pinned (dompurify, clerk, jose)
    - CSP nonces applied in Next.js middleware
  artifacts:
    - .husky/pre-commit (secret detection)
    - .github/workflows/security.yml (Gitleaks)
  key_links:
    - gitleaks/gitleaks-action
---
```

<objective>
Add secret detection, pin security dependencies, and complete CSP implementation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Add Pre-commit Secret Detection

Files: `.husky/pre-commit`

Acceptance:
- [ ] Blocks .env commits
- [ ] Runs gitleaks if available

### Task 2: Add CI Secret Scanning

Files: `.github/workflows/security.yml`

Acceptance:
- [ ] Gitleaks runs on push/PR
- [ ] Fails on detected secrets

### Task 3: Pin Security Dependencies

Pin exact versions:
- dompurify@3.4.1
- @clerk/nextjs (exact)
- jose (exact)

Files: `apps/web/package.json`

Acceptance:
- [ ] No caret (^) on security deps

### Task 4: Add CSP Nonces to Next.js

Files: `apps/web/src/middleware.ts`

Acceptance:
- [ ] Nonce generated per request
- [ ] Applied to inline scripts

### Task 5: Delete ToBeMigrated Folder

Verify no imports, then delete.

Files: `AI-Writer/ToBeMigrated/`

Acceptance:
- [ ] No references in codebase
- [ ] Folder deleted

---

## Plan 71-03: Migration Safety

```yaml
---
phase: 71-security-configuration
plan: 03
type: execute
wave: 2
depends_on: [67-03]
files_modified:
  - AI-Writer/backend/migrations/0034_client_id_to_uuid.sql
  - AI-Writer/alembic/versions/*.py
  - docs/runbooks/database-migrations.md
  - open-seo-main/drizzle/test/migration-test.sh
autonomous: true
requirements:
  - MIG-01
  - MIG-02
must_haves:
  truths:
    - 0034 migration wrapped in BEGIN/COMMIT
    - All Alembic migrations have downgrade()
    - Migration runbook documents rollback
    - Pre-migration backup automated
  artifacts:
    - docs/runbooks/database-migrations.md
    - open-seo-main/drizzle/test/migration-test.sh
  key_links:
    - pg_dump for backups
---
```

<objective>
Add transaction wrappers to migrations, create rollback procedures, and document migration runbook.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Wrap 0034 Migration in Transaction

Files: `AI-Writer/backend/migrations/0034_client_id_to_uuid.sql`

Acceptance:
- [ ] BEGIN at start
- [ ] COMMIT at end

### Task 2: Add downgrade() to Alembic Migrations

Review 18 migrations missing downgrade.

Files: `AI-Writer/alembic/versions/*.py`

Acceptance:
- [ ] All migrations have downgrade()
- [ ] Tested with alembic downgrade -1

### Task 3: Create Migration Testing Script

Files: `open-seo-main/drizzle/test/migration-test.sh`

Acceptance:
- [ ] Tests against fresh database
- [ ] Verifies schema matches expected
- [ ] Cleans up after test

### Task 4: Create Migration Runbook

Files: `docs/runbooks/database-migrations.md`

Acceptance:
- [ ] Pre-migration checklist
- [ ] Step-by-step execution
- [ ] Rollback procedure
- [ ] Emergency contacts
