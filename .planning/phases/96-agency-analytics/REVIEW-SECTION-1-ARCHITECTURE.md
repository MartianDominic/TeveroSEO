# Section 1: Architecture & Integration Review

**Review Date:** 2026-05-08  
**Reviewer:** Senior Platform Architect - Phase 96 Integration Auditor  
**Scope:** Cross-service data flow, shared entity model, queue architecture, frontend integration

---

## 1.1 Cross-Service Integration Matrix

| P96 Component | Consumes From | Produces For | Integration Status |
|---------------|---------------|--------------|-------------------|
| **GscFullSyncService** | Google Search Console API | gsc_query_analytics table | IMPLEMENTED |
| **TrendDetectionService** | gsc_query_analytics | API endpoints only | PARTIAL - No downstream consumers |
| **StrikingDistanceService** | gsc_query_analytics | strikingDistancePages table | PARTIAL - No AI-Writer integration |
| **CannibalizationDetection** | gsc_query_analytics | keywordCannibalization table | BROKEN - Stub imports in API route |
| **AnnotationImportService** | GSC API, manual input | gscAnnotations table | IMPLEMENTED |
| **ClientVisibilityService** | clientVisibility table | visibilityMiddleware | IMPLEMENTED |
| **PortfolioMetricsService** | gsc_query_analytics + clients | Portfolio dashboards | IMPLEMENTED |
| **AnalyticsExportService** | All analytics tables | CSV/PDF exports | IMPLEMENTED |

### Service Dependency Graph

```
                    +-------------------+
                    | Google Search     |
                    | Console API       |
                    +--------+----------+
                             |
                             v
                    +--------+----------+
                    | GscFullSyncService |
                    | (3 AM UTC daily)   |
                    +--------+----------+
                             |
                             v
              +--------------+---------------+
              |     gsc_query_analytics      |
              |     (TimescaleDB planned)    |
              +--------------+---------------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+--------+-------+  +--------+-------+  +--------+-------+
| TrendDetection |  | StrikingDist.  |  | Cannibalization|
| Service        |  | Service        |  | Service        |
+--------+-------+  +--------+-------+  +--------+-------+
         |                   |                   |
         v                   v                   v
    [API only]        [API + Table]      [BROKEN ROUTE]
         |                   |                   |
         X                   X                   X
    No consumer         No AI-Writer        Stub imports
                        integration         in route
```

---

## 1.2 Data Flow Analysis

### Primary Data Flow: GSC Sync Pipeline

1. **Ingestion Layer**
   - `gsc-sync.job.ts` schedules daily sync at 3 AM UTC
   - BullMQ queue with 3 attempts, exponential backoff
   - Rate limited to 50 req/min per GSC API constraints
   - Data lands in `gsc_query_analytics` table

2. **Processing Layer**
   - `TrendDetectionService`: Calculates WoW, MoM trends from raw data
   - `StrikingDistanceService`: Identifies positions 11-20 opportunities
   - `CannibalizationService` (in linking module): Detects keyword overlap

3. **Presentation Layer**
   - API routes expose processed data
   - `visibilityMiddleware` filters based on client portal permissions
   - Dashboard components consume via TanStack Query

### Cross-Module Data Flow Issues

**Striking Distance -> AI-Writer (NOT CONNECTED)**
```
open-seo-main:                          AI-Writer:
StrikingDistanceService                 content_strategy.py
        |                                      |
        v                                      v
strikingDistancePages table             SEPARATE IMPLEMENTATION
        |                               (backend/services/intelligence/
        X                                agents/specialized/)
        |
  No shared data path
```

AI-Writer has its own striking distance implementation in:
- `backend/routers/platform_analytics.py`
- `backend/services/intelligence/agents/specialized/content_strategy.py`

These do NOT consume from P96's `strikingDistancePages` table.

**Cannibalization -> Linking (BROKEN)**
```
analytics/services/               linking/services/
CannibalizationDetection         CannibalizationService
        |                                |
        v                                v
(Planned in P96-03)              keywordCannibalization table
        |                                |
        X-------- STUB IMPORTS ----------X
        
routes/api/analytics/cannibalization.ts uses:
  const keywordCannibalization = { ... } as any;  // STUB!
```

---

## 1.3 Integration Gaps Identified

### CRITICAL Severity

| ID | Gap | Impact | Location |
|----|-----|--------|----------|
| **C1** | Cannibalization API route uses stub schema imports | Route returns empty/incorrect data; linking integration broken | `routes/api/analytics/cannibalization.ts` lines 8-12 |
| **C2** | Placeholder helper functions return hardcoded values | Auth/scoping completely bypassed | `routes/api/analytics/cannibalization.ts` - `getWorkspaceIdFromRequest()`, `getClientIdFromSite()` |

**C1 Evidence:**
```typescript
// Stub schema import (would reference real link-schema.ts)
const keywordCannibalization = {
  clientId: 'clientId',
  status: 'status',
  severity: 'severity',
} as any;
```

### HIGH Severity

| ID | Gap | Impact | Location |
|----|-----|--------|----------|
| **H1** | StrikingDistanceService not integrated with AI-Writer | Content team cannot prioritize based on SEO opportunities | No integration code exists |
| **H2** | TrendDetectionService has no downstream consumers | Trend data computed but not actionable | Service outputs to API only |
| **H3** | Duplicate striking distance implementations | Maintenance burden, data inconsistency risk | `open-seo-main` vs `AI-Writer/backend/services/` |

### MEDIUM Severity

| ID | Gap | Impact | Location |
|----|-----|--------|----------|
| **M1** | No explicit BullMQ job coordination | Potential resource contention during parallel runs | `gsc-sync.job.ts`, `annotation-import.job.ts` |
| **M2** | Missing client_id validation on cross-service boundaries | FK integrity relies on app-level trust | Analytics services assume valid client_id |
| **M3** | PortfolioMetricsService lacks caching strategy | Repeated expensive cross-client aggregations | `PortfolioMetricsService.ts` |

### LOW Severity

| ID | Gap | Impact | Location |
|----|-----|--------|----------|
| **L1** | Inconsistent error response formats across API routes | Client-side error handling complexity | Various `routes/api/analytics/*.ts` |
| **L2** | No retry mechanism for GSC API partial failures | Data gaps on transient errors | `GscFullSyncService.ts` |

---

## 1.4 Shared Entity Model Assessment

### client_id Consistency

**Flow:** AI-Writer `clients` table -> `client_id` used across all P96 tables

| Table | client_id FK | Cascade Delete | Notes |
|-------|--------------|----------------|-------|
| gsc_query_analytics | YES | YES | Primary analytics data |
| strikingDistancePages | YES | YES | P96-03 feature |
| keywordCannibalization | YES | YES | Lives in link-schema |
| clientVisibility | YES | YES | P96-04 feature |
| brandTerms | YES | YES | P96-04 feature |
| gscAnnotations | YES | YES | P96-03 feature |

**Finding:** Schema-level FK relationships are properly defined with cascade delete. However, runtime validation is inconsistent - services trust incoming client_id without re-verification against AI-Writer's source of truth.

### workspace_id Scoping

`PortfolioMetricsService` correctly uses workspace_id for cross-client aggregation:
```typescript
// Joins gsc_query_analytics with clients table
// Filters by workspace_id from request context
```

**Finding:** Workspace boundaries are maintained through query-time filtering, not table-level constraints. This is acceptable but requires middleware vigilance.

---

## 1.5 Queue Architecture Assessment

### BullMQ Job Scheduling

| Job | Schedule | Queue | Concurrency | Rate Limit |
|-----|----------|-------|-------------|------------|
| GSC Full Sync | 3 AM UTC | gsc-sync | 1 | 50 req/min |
| Annotation Import | 4 AM UTC | annotation-import | 1 | None |

**Finding:** Jobs are staggered by 1 hour to avoid overlap. However:
- No explicit coordination mechanism exists
- If GSC sync runs long (>1 hour), annotation import may compete for resources
- No dead letter queue configuration observed

### Recommended Queue Configuration

```typescript
// Missing: Explicit coordination
const queueOptions = {
  limiter: {
    max: 50,
    duration: 60000, // 50/min
  },
  settings: {
    lockDuration: 300000, // 5 min lock
    stalledInterval: 120000, // 2 min stall check
  },
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
};
```

---

## 1.6 Recommendations

### Immediate Actions (P0)

1. **Fix Cannibalization API Route**
   - Replace stub imports with actual `link-schema.ts` references
   - Implement proper `getWorkspaceIdFromRequest()` using session context
   - Wire route to existing `CannibalizationService` in linking module

2. **Remove Placeholder Helpers**
   - `getClientIdFromSite()` must resolve from request context + site lookup
   - Add proper auth checks before any data access

### Short-Term (P1)

3. **Create Striking Distance Integration API**
   - Expose `/api/analytics/striking-distance/export` for AI-Writer consumption
   - Define contract for content prioritization handoff
   - Consider event-driven notification when new opportunities detected

4. **Add BullMQ Job Coordination**
   - Implement job dependency chain: GSC sync must complete before annotation import
   - Add health check endpoint for job status monitoring
   - Configure dead letter queues for failed jobs

### Medium-Term (P2)

5. **Consolidate Striking Distance Implementations**
   - Deprecate AI-Writer's internal implementation
   - Point content strategy agent to P96's StrikingDistanceService API
   - Single source of truth for position 11-20 opportunities

6. **Add Client ID Validation Layer**
   - Create shared validation utility for cross-service client_id verification
   - Cache valid client_ids with short TTL to reduce DB lookups

7. **Implement Portfolio Caching**
   - Add Redis cache layer for `PortfolioMetricsService` aggregations
   - 15-minute TTL appropriate for dashboard data

---

## 1.7 Integration Test Coverage Gaps

The following integration scenarios lack test coverage:

| Scenario | Current Coverage | Required |
|----------|-----------------|----------|
| GSC sync -> Trend detection pipeline | None | E2E test |
| Striking distance -> Content brief priority | None | Integration test |
| Cannibalization -> Linking recommendations | None | Integration test |
| Client visibility -> All API routes | Partial | Full matrix |
| Portfolio aggregation across 10+ clients | None | Load test |

---

## Summary

Phase 96 implements solid foundational analytics infrastructure but has significant integration gaps with the broader TeveroSEO ecosystem:

- **2 CRITICAL issues** requiring immediate attention (stub imports, placeholder auth)
- **3 HIGH issues** preventing intended value delivery (no AI-Writer integration)
- **3 MEDIUM issues** affecting reliability and performance
- **2 LOW issues** for polish

The architecture follows established patterns (repository, singleton services, middleware) but cross-service data flow is incomplete. Most critically, the promised integration between striking distance insights and content generation does not exist - AI-Writer has its own parallel implementation.

**Next Review Section:** Authentication & Authorization deep-dive
