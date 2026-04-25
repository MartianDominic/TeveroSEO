---
phase: 41
plan: "01"
subsystem: production-hardening
tags: [dead-code, factory-pattern, error-handling, security]
dependency_graph:
  requires: []
  provides: [clean-codebase, safe-factories, production-validation]
  affects: [AI-Writer, apps/web]
tech_stack:
  added: []
  patterns: [environment-aware-factory, startup-validation]
key_files:
  created: []
  modified:
    - AI-Writer/backend/services/component_logic/__init__.py
    - AI-Writer/backend/api/component_logic.py
    - AI-Writer/backend/services/agent_framework.py
    - AI-Writer/backend/main.py
    - apps/web/src/lib/audit/repositories/FindingsRepository.ts
    - apps/web/src/lib/audit/repositories/index.ts
    - apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx
  deleted:
    - AI-Writer/backend/services/component_logic/research_utilities.py
    - AI-Writer/ToBeMigrated/ai_web_researcher/google_serp_search.py
    - AI-Writer/ToBeMigrated/ai_web_researcher/firecrawl_web_crawler.py
decisions:
  - Remove fake research_utilities.py and its API endpoints (real services in services/research/)
  - Legacy SERP files deleted (DataForSEO replaces Serper/Firecrawl)
  - Add environment-aware createFindingsRepository() factory
  - Agent framework fallback mode replaced with RuntimeError
  - Production startup validation rejects dangerous flags
metrics:
  duration: 6m
  completed_date: "2026-04-25"
  tasks_completed: 6
  files_modified: 7
  files_deleted: 3
---

# Phase 41 Plan 01: Dead Code Removal + Factory Fixes Summary

Removed dead code returning fake data and fixed factory patterns that could return mock implementations in production.

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | fix | AI-Writer@863c0aca | Delete research_utilities.py and unused API endpoints |
| 2 | fix | AI-Writer@a833e801 | Delete legacy Serper/Firecrawl SERP code |
| 3 | fix | 00ab33f69 | Add safe FindingsRepository factory with env check |
| 4 | fix | AI-Writer@58ee6d18 | Remove agent framework fallback mode |
| 5 | fix | ce4cedf97 | Improve SEO page error handling |
| 6 | fix | AI-Writer@2faa848e | Add startup validation for dangerous flags |

## Task Details

### Task 1: Delete research_utilities.py

**Files deleted:**
- `AI-Writer/backend/services/component_logic/research_utilities.py` (325 lines)

**Files modified:**
- `AI-Writer/backend/services/component_logic/__init__.py` - Removed import/export
- `AI-Writer/backend/api/component_logic.py` - Removed 5 API endpoints using fake data

**Why:** The file contained `_simulate_research()` returning fake data. Real implementations exist in `services/research/tavily_service.py` and `services/research/exa_service.py`.

### Task 2: Delete legacy SERP code

**Files deleted:**
- `AI-Writer/ToBeMigrated/ai_web_researcher/google_serp_search.py` (340 lines)
- `AI-Writer/ToBeMigrated/ai_web_researcher/firecrawl_web_crawler.py` (97 lines)

**Why:** DataForSEO replaces both Serper.dev and Firecrawl for SERP functionality.

### Task 3: Fix InMemoryFindingsRepository factory

**Files modified:**
- `apps/web/src/lib/audit/repositories/FindingsRepository.ts`
- `apps/web/src/lib/audit/repositories/index.ts`

**Changes:**
- Added `createFindingsRepository(baseUrl?)` factory function
- Returns InMemoryFindingsRepository ONLY when `NODE_ENV === 'test'`
- Returns ApiFindingsRepository in production/development
- Throws error if baseUrl not provided in non-test environments

### Task 4: Remove agent framework fallback mode

**Files modified:**
- `AI-Writer/backend/services/agent_framework.py`

**Changes:**
- `_execute_fallback()` now raises `RuntimeError` instead of returning fake completion messages
- `FallbackAgent.run()` raises `RuntimeError` instead of returning fake processing message
- Prevents silent failures with fake "completed (fallback mode)" results

### Task 5: Fix SEO dashboard error handling

**Files modified:**
- `apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx`

**Changes:**
- Added explicit error tracking variable
- Show error details to users instead of generic fallback
- Differentiate between "no project" and "API error" states
- Log error context (clientId) for debugging

### Task 6: Add startup validation

**Files modified:**
- `AI-Writer/backend/main.py`

**Changes:**
- Added `validate_production_config()` function
- Rejects `DISABLE_AUTH=true`, `SKIP_AUTH=true`, `DEBUG_MODE=true` in production
- Rejects `QUALITY_GATE_ENABLED=false` in production
- Called at startup before any other initialization

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] research_utilities.py had active callers**
- **Found during:** Task 1
- **Issue:** Plan assumed no callers, but `__init__.py` and `component_logic.py` imported it
- **Fix:** Removed imports and 5 API endpoints that used fake research data
- **Files modified:** `__init__.py`, `component_logic.py`
- **Commit:** AI-Writer@863c0aca

**2. [Rule 3 - Blocking] Plan file path incorrect**
- **Found during:** Task 5
- **Issue:** Plan referenced `apps/web/src/actions/dashboard/get-seo-metrics.ts` which doesn't exist
- **Fix:** Found and improved SEO page at `apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx`
- **Commit:** ce4cedf97

## Verification

- [x] `research_utilities.py` deleted and no import errors
- [x] `google_serp_search.py` deleted
- [x] `firecrawl_web_crawler.py` deleted
- [x] `createFindingsRepository` returns ApiFindingsRepository in prod
- [x] Agent framework errors without txtai (no silent fallback)
- [x] SEO page shows error details (not silent failures)
- [x] Production startup rejects DISABLE_AUTH=true

## Self-Check: PASSED

- [x] All commits exist in git history
- [x] All deleted files confirmed removed
- [x] Modified files contain expected changes
