---
phase: 26
plan: 01
subsystem: prospects
tags: [data-model, drizzle, crud, api]
dependency_graph:
  requires: []
  provides:
    - prospects table schema
    - prospect_analyses table schema
    - ProspectService CRUD
    - prospect server functions
  affects:
    - future prospect UI components
    - prospect analysis workers
tech_stack:
  added:
    - Drizzle prospect-schema.ts
    - ProspectService.ts
    - prospects.ts serverFunctions
  patterns:
    - TanStack Start server functions with middleware
    - Zod validation schemas
    - Domain normalization and validation
key_files:
  created:
    - open-seo-main/src/db/prospect-schema.ts
    - open-seo-main/drizzle/0013_prospect_tables.sql
    - open-seo-main/src/server/features/prospects/services/ProspectService.ts
    - open-seo-main/src/server/features/prospects/index.ts
    - open-seo-main/src/serverFunctions/prospects.ts
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - text ID using nanoid for prospects
  - Domain normalization strips protocol, www, path, port
  - DOMAIN_REGEX validates TLD presence
  - Page size max 100 for DoS prevention
  - Status enum as const array for type safety
metrics:
  duration: 319s
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 1
  completed_at: "2026-04-20T21:23:35Z"
---

# Phase 26 Plan 01: Prospect Data Model Summary

Drizzle schema for prospects and analyses with CRUD service and API endpoints

## What Was Built

Created the foundational data layer for prospect management, establishing the prospect data model separate from clients. Prospects represent potential clients being evaluated for SEO opportunities before conversion.

### Database Schema

**prospects table** (14 columns):
- `id` (text PK), `workspace_id` (FK to organization), `domain` (unique per workspace)
- Contact info: `company_name`, `contact_email`, `contact_name`, `industry`
- Status tracking: `status` (new/analyzing/analyzed/converted/archived), `source`, `assigned_to`
- Conversion: `converted_client_id`, `notes`
- Timestamps: `created_at`, `updated_at`

**prospect_analyses table** (14 columns):
- `id` (text PK), `prospect_id` (FK to prospects)
- Analysis config: `analysis_type`, `status`, `target_region`, `target_language`
- JSONB results: `competitor_domains`, `domain_metrics`, `organic_keywords`, `competitor_keywords`
- Cost tracking: `cost_cents`
- Timestamps: `created_at`, `completed_at`

**Indexes:**
- `ix_prospects_workspace` - workspace queries
- `ix_prospects_status` - status filtering
- `ix_prospects_workspace_domain` - unique constraint preventing duplicate domains
- `ix_analyses_prospect` - analysis lookups
- `ix_analyses_status` - analysis status filtering

### ProspectService

CRUD operations with domain validation:
- `create()` - validates domain format, normalizes, checks for duplicates
- `findById()` - returns prospect with analyses array
- `findByWorkspace()` - paginated listing with status filter
- `update()` - validates status against enum
- `delete()` - cascades to analyses via FK
- Status helpers: `markAnalyzing()`, `markAnalyzed()`, `markConverted()`

### API Endpoints (TanStack Server Functions)

| Function | Method | Purpose |
|----------|--------|---------|
| `createProspect` | POST | Create prospect with domain validation |
| `getProspect` | POST | Get prospect with analyses |
| `listProspects` | POST | Paginated workspace prospects |
| `updateProspect` | POST | Update prospect fields |
| `deleteProspect` | POST | Delete prospect |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `9fd60bd` | feat | Create prospect and prospect_analyses Drizzle schema |
| `993d780` | chore | Add prospect tables migration |
| `0151f9d` | feat | Create ProspectService with CRUD operations |
| `98c049d` | feat | Create prospect API server functions |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration generated manually**
- **Found during:** Task 2
- **Issue:** `drizzle-kit generate` requires interactive TTY prompts unavailable in CLI
- **Fix:** Created migration SQL manually following existing migration patterns
- **Files modified:** drizzle/0013_prospect_tables.sql
- **Commit:** 993d780

## Threat Model Compliance

All threat mitigations from the plan were implemented:

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-26-01 | Verify organizationId before insert | `createProspect` uses `context.organizationId` |
| T-26-02 | Re-verify workspaceId before update | `updateProspect` checks ownership first |
| T-26-03 | Filter by organizationId | `getProspect` validates `workspaceId` match |
| T-26-04 | Parameterized queries | Drizzle ORM used throughout |
| T-26-05 | Limit pageSize to 100 | `listProspects` caps at 100 |

## Success Criteria Verification

- [x] `prospects` table schema defined with all 14 columns
- [x] `prospect_analyses` table schema defined with all 14 columns
- [x] Unique index on (workspace_id, domain) prevents duplicates
- [x] Migration file generated with CREATE TABLE statements
- [x] ProspectService implements create/read/update/delete
- [x] Domain validation rejects invalid formats
- [x] Domain normalization strips protocol, www, path
- [x] API endpoints validate auth and workspace ownership
- [x] TypeScript compiles without errors

## Self-Check: PASSED

**Files verified:**
- FOUND: open-seo-main/src/db/prospect-schema.ts
- FOUND: open-seo-main/drizzle/0013_prospect_tables.sql
- FOUND: open-seo-main/src/server/features/prospects/services/ProspectService.ts
- FOUND: open-seo-main/src/server/features/prospects/index.ts
- FOUND: open-seo-main/src/serverFunctions/prospects.ts

**Commits verified:**
- FOUND: 9fd60bd
- FOUND: 993d780
- FOUND: 0151f9d
- FOUND: 98c049d
