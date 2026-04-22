---
phase: 32-107-seo-checks
plan: 01
subsystem: seo-audit
tags: [seo, checks, audit, facade, repository, service]
dependency_graph:
  requires: []
  provides: [runAllChecks, FindingsRepository, CheckService]
  affects: [audit-workflow, seo-results-ui]
tech_stack:
  added: []
  patterns: [facade, repository, service-layer, tdd]
key_files:
  created:
    - apps/web/src/lib/audit/checks/types.ts
    - apps/web/src/lib/audit/checks/definitions.ts
    - apps/web/src/lib/audit/checks/runner.ts
    - apps/web/src/lib/audit/checks/scoring.ts
    - apps/web/src/lib/audit/checks/facade.ts
    - apps/web/src/lib/audit/checks/index.ts
    - apps/web/src/lib/audit/repositories/FindingsRepository.ts
    - apps/web/src/lib/audit/repositories/index.ts
    - apps/web/src/lib/audit/services/CheckService.ts
    - apps/web/src/lib/audit/services/index.ts
    - apps/web/src/lib/audit/index.ts
  modified: []
decisions:
  - "Used apps/web/src/lib/audit/ path instead of open-seo-main reference (adapted to actual project structure)"
  - "Created in-memory FindingsRepository for testing; API-based implementation ready for backend integration"
  - "Check definitions organized in 4 tiers: T1 (27), T2 (25), T3 (30), T4 (25) = 107 total"
metrics:
  duration: 7 minutes
  tasks_completed: 3
  tests_passed: 28
  files_created: 13
  completed_at: 2026-04-22T20:32:54Z
---

# Phase 32 Plan 01: Check Runner Infrastructure Summary

runAllChecks facade, FindingsRepository, and CheckService for 107 SEO checks.

## One-liner

107 SEO check runner infrastructure with facade pattern, in-memory repository, and service layer orchestrating check execution and persistence.

## What Was Built

### Task 1: runAllChecks Facade (2a840ad19)

Created the main entry point for running SEO checks:

- **types.ts**: CheckResult, ScoreResult, CheckOptions, PageAnalysis interfaces
- **definitions.ts**: 107 check definitions across 4 tiers with severity, category, auto-edit info
- **runner.ts**: HTML parsing and check execution with 5MB size limit (T-32-01 mitigation)
- **scoring.ts**: Weighted score calculation with tier/severity weights and gate detection
- **facade.ts**: runAllChecks(html, url, options) returning { results, score }
- **index.ts**: Public API exports

### Task 2: FindingsRepository (a04298993)

Created persistence layer for audit findings:

- **AuditFinding interface**: id, auditId, pageId, checkId, tier, category, passed, severity, message, details
- **FindingsRepository interface**: insertFindings, getFindingsByAudit, getFindingsByPage, getFindingsBySeverity, deleteFindingsByAudit, getFailedFindingsByAudit
- **InMemoryFindingsRepository**: For testing
- **ApiFindingsRepository**: For production (ready for backend integration)

### Task 3: CheckService (c691dbfaa)

Created orchestration layer:

- **runPageChecks**: Execute checks and persist to repository
- **runAuditChecks**: Batch process multiple pages
- **getAuditScore**: Aggregate scores (average, byPage, bySeverity)
- **clearAuditFindings**: Clean up audit data

## Architecture

```
runAllChecks(html, url)
       │
       ▼
   runChecks()  ──────► CHECK_DEFINITIONS (107 checks)
       │
       ▼
calculateOnPageScore() ──► { results, score }
       │
       ▼
CheckService.runPageChecks()
       │
       ▼
FindingsRepository.insertFindings()
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted to actual project structure**
- **Found during:** Task 1
- **Issue:** Plan referenced `open-seo-main/src/server/lib/audit/checks/` but project uses `apps/web/src/lib/audit/`
- **Fix:** Created modules in `apps/web/src/lib/audit/` matching the actual monorepo structure
- **Files modified:** All new files created in correct location

## Test Coverage

- **facade.test.ts**: 6 tests - runAllChecks returns results, scores, respects tier filtering
- **FindingsRepository.test.ts**: 11 tests - CRUD operations, tier/category extraction
- **CheckService.test.ts**: 11 tests - page checks, audit checks, score aggregation

All 28 tests passing.

## Key Interfaces

```typescript
// Run all 107 checks
const { results, score } = await runAllChecks(html, url, { keyword, tiers });

// With persistence
const service = createCheckService(repository);
const { score, resultCount } = await service.runPageChecks({
  auditId, pageId, url, html, keyword
});

// Get audit summary
const { averageScore, byPage, bySeverity } = await service.getAuditScore(auditId);
```

## Next Steps

This plan provides the foundation for:
- Plan 02: Database schema and migrations for audit_findings
- Plan 03: API routes for findings CRUD
- Plan 04: Workflow integration with BullMQ audit jobs
- Plan 05: UI components for displaying check results

## Self-Check: PASSED

- [x] apps/web/src/lib/audit/checks/facade.ts exists
- [x] apps/web/src/lib/audit/repositories/FindingsRepository.ts exists
- [x] apps/web/src/lib/audit/services/CheckService.ts exists
- [x] Commit 2a840ad19 exists (Task 1)
- [x] Commit a04298993 exists (Task 2)
- [x] Commit c691dbfaa exists (Task 3)
