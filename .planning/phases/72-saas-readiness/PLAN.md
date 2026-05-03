# Phase 72: SaaS Readiness

**Milestone:** v8.0 SaaS Hardening
**Duration:** 1.5 weeks
**Priority:** HIGH - Production readiness

## Overview

Multi-tenancy verification, SEO checks validation, and monitoring setup.

## Sub-Plans

| Plan | Name | Wave | Depends On |
|------|------|------|------------|
| 72-01 | Multi-Tenancy Verification | 1 | 67-03, 68-04, 69-04 |
| 72-02 | SEO Checks Validation | 1 | 69-03 |
| 72-03 | Monitoring & Observability | 2 | All prior phases |

## Issues Resolved

- Tenant isolation gaps
- SEO check scoring inconsistencies
- Missing production monitoring

---

## Plan 72-01: Multi-Tenancy Verification

```yaml
---
phase: 72-saas-readiness
plan: 01
type: execute
wave: 1
depends_on: [67-03, 68-04, 69-04]
files_modified:
  - e2e/multi-tenant.spec.ts
  - open-seo-main/src/server/lib/tenant-isolation.ts
autonomous: true
requirements:
  - TENANT-01
  - TENANT-02
must_haves:
  truths:
    - All queries filter by workspace_id
    - Cross-tenant data access returns 403
    - Rate limits are per-tenant
    - E2E tests verify tenant isolation
  artifacts:
    - e2e/multi-tenant.spec.ts
    - open-seo-main/src/server/lib/tenant-isolation.ts (assertTenantAccess)
  key_links:
    - workspace_id NOT NULL constraint
---
```

<objective>
Verify and test complete tenant isolation across all data access paths.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Create Tenant Isolation Helper

Files: `open-seo-main/src/server/lib/tenant-isolation.ts`

Acceptance:
- [ ] assertTenantAccess throws 403 on mismatch
- [ ] Used in all service methods

### Task 2: Audit All Data Queries

Review all repository methods for workspace_id filter.

Acceptance:
- [ ] Every query filters by workspace
- [ ] No global queries without admin check

### Task 3: Create Multi-Tenant E2E Tests

Files: `e2e/multi-tenant.spec.ts`

Acceptance:
- [ ] User A cannot access User B data
- [ ] Cross-tenant API calls return 403
- [ ] Rate limits isolated per tenant

---

## Plan 72-02: SEO Checks Validation

```yaml
---
phase: 72-saas-readiness
plan: 02
type: execute
wave: 1
depends_on: [69-03]
files_modified:
  - open-seo-main/src/server/features/seo-checks/check-runner.ts
  - open-seo-main/src/server/features/seo-checks/check-registry.ts
  - tests/seo-checks/*.spec.ts
autonomous: true
requirements:
  - SEO-01
  - SEO-02
must_haves:
  truths:
    - All 109 checks have consistent scoring
    - Tier weights applied correctly
    - Check results include actionable recommendations
    - Unit tests cover all check categories
  artifacts:
    - tests/seo-checks/*.spec.ts (unit tests for each category)
  key_links:
    - Tier 1-4 check structure
---
```

<objective>
Validate all 109 SEO checks for consistent scoring and actionable output.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Audit Check Scoring Consistency

Review check-runner.ts for score calculation.

Acceptance:
- [ ] All checks use same severity->score mapping
- [ ] Tier weights documented

### Task 2: Verify Recommendation Quality

Review all check implementations for actionable recommendations.

Acceptance:
- [ ] Each check has specific fix guidance
- [ ] No generic "fix this issue" messages

### Task 3: Create Check Unit Tests

Files: `tests/seo-checks/*.spec.ts`

Acceptance:
- [ ] Tests cover all 4 tiers
- [ ] Edge cases tested
- [ ] Score calculations verified

---

## Plan 72-03: Monitoring & Observability

```yaml
---
phase: 72-saas-readiness
plan: 03
type: execute
wave: 2
depends_on: [72-01, 72-02]
files_modified:
  - .github/dependabot.yml
  - open-seo-main/src/server/services/audit-log.ts
  - open-seo-main/src/db/schema.ts
  - docker-compose.vps.yml
autonomous: true
requirements:
  - MON-01
  - MON-02
must_haves:
  truths:
    - Dependabot configured for npm, pip, Docker
    - Audit logging for sensitive operations
    - Rate limiting on admin endpoints
    - Health check endpoints exposed
  artifacts:
    - .github/dependabot.yml
    - open-seo-main/src/server/services/audit-log.ts
    - open-seo-main/src/db/schema/audit-logs.ts
  key_links:
    - audit_logs table schema
---
```

<objective>
Set up dependency monitoring, audit logging, and production health checks.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

### Task 1: Configure Dependabot

Files: `.github/dependabot.yml`

Acceptance:
- [ ] npm for apps/web, open-seo-main
- [ ] pip for AI-Writer
- [ ] Docker for containers

### Task 2: Implement Audit Logging

Files: `open-seo-main/src/server/services/audit-log.ts`, schema

Acceptance:
- [ ] Logs user, action, resource, timestamp
- [ ] Covers client create/delete, settings changes
- [ ] 90-day retention policy

### Task 3: Add Rate Limiting to Admin Endpoints

Files: Admin API routes

Acceptance:
- [ ] 10 req/min per user on admin routes
- [ ] 429 response on exceed

### Task 4: Create Health Check Endpoints

Files: API routes

Acceptance:
- [ ] /health returns service status
- [ ] /health/db checks database
- [ ] /health/redis checks cache
