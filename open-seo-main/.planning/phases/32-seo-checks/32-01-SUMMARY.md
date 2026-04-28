---
phase: 32-seo-checks
plan: 01
subsystem: seo-checks
tags: [infrastructure, schema, scoring]
dependency_graph:
  requires: []
  provides: [audit_findings, CheckRunner, SeoScoreCalculator]
  affects: [tier-1-checks, tier-2-checks, tier-3-checks, tier-4-checks]
tech_stack:
  added: []
  patterns: [check-registry, shared-cheerio, hard-gate-scoring]
key_files:
  created:
    - src/server/lib/audit/checks/types.ts
    - src/server/lib/audit/checks/registry.ts
    - src/server/lib/audit/checks/runner.ts
    - src/server/lib/audit/checks/scoring.ts
    - src/server/lib/audit/checks/scoring.test.ts
  modified:
    - src/db/dashboard-schema.ts
decisions:
  - "Check IDs use T{tier}-{num} format (e.g., T1-01) for tier extraction in scoring"
  - "Hard gates applied in order: noindex->duplicate->ymyl->cwv for deterministic caps"
  - "DoS protection: 5MB max HTML size before Cheerio parsing"
metrics:
  duration_minutes: 5
  completed_at: "2026-04-22T14:45:00Z"
---

# Phase 32 Plan 01: Check Infrastructure Summary

Foundation for 107 SEO checks: audit_findings schema, type definitions, check runner with shared Cheerio instance, and scoring calculator with hard gates.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-3 | Schema, types, registry, runner, scoring | 3373b8c | 6 files |

## Implementation Details

### audit_findings Schema

Added `auditFindings` table to `dashboard-schema.ts`:
- Columns: id, auditId, pageId, checkId, tier, category, passed, severity, message, details (jsonb), autoEditable, editRecipe, createdAt
- Indexes: audit, page, check, severity+passed

### Type System

Created comprehensive types in `types.ts`:
- `CheckDefinition`: id, name, tier, category, severity, autoEditable, editRecipe, run function
- `CheckContext`: $, html, url, keyword, pageAnalysis, siteContext
- `CheckResult`: checkId, passed, severity, message, details, autoEditable, editRecipe
- `ScoreResult`: score, gates, breakdown

### Check Registry

Map-based registry in `registry.ts`:
- `registerCheck(check)` - add check to registry
- `getChecksByTier(tier)` - retrieve by tier
- `getChecksByCategory(category)` - retrieve by category
- `getAllChecks()` - all registered checks

### Check Runner

Runner in `runner.ts` with:
- Single `cheerio.load()` call shared across all checks (no re-parsing)
- DoS protection: 5MB max HTML size (threat model T-32-02)
- Convenience functions: `runTier1Checks`, `runTier2Checks`, `runLocalChecks`

### Scoring Calculator

Scoring in `scoring.ts` implements design doc formula:
- Base: 60 points
- Tier 1: +0.3 per pass, max 20
- Tier 2: +0.5 per pass, max 10
- Tier 3: +0.8 per pass, max 10

Hard gates (in priority order):
1. noindex (T1-55 fail) -> cap at 0
2. Duplicate >60% (T4-06) -> cap at 50
3. YMYL no author (T2-17) -> cap at 60
4. CWV Poor (T3-01/02/03 critical) -> cap at 75

## Test Results

All 8 scoring tests pass:
- Base score 60 when no checks
- Tier 1 adds +0.3 per pass, max 20
- Tier 2 adds +0.5 per pass, max 10
- Tier 3 adds +0.8 per pass, max 10
- CWV Poor caps at 75
- noindex caps at 0
- YMYL no author caps at 60
- Duplicate >60% caps at 50

## Deviations from Plan

### Deferred

**Migration Generation:** Drizzle-kit requires TTY for interactive prompts. Run `npx drizzle-kit generate` manually to create migration.

## Known Stubs

None - all infrastructure is complete and functional.

## Self-Check: PASSED

- [x] src/server/lib/audit/checks/types.ts exists
- [x] src/server/lib/audit/checks/registry.ts exists
- [x] src/server/lib/audit/checks/runner.ts exists
- [x] src/server/lib/audit/checks/scoring.ts exists
- [x] src/server/lib/audit/checks/scoring.test.ts exists
- [x] src/db/dashboard-schema.ts contains auditFindings
- [x] Commit 3373b8c exists
