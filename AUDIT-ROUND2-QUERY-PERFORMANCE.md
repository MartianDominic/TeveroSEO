# Query Performance Audit - Round 2

**Date**: 2026-04-28  
**Scope**: N+1 query patterns, unbounded database operations, missing indexes  
**Files Examined**: `apps/web/src/actions/**/*.ts`, `open-seo-main/src/services/**/*.ts`, `open-seo-main/src/routes/**/*.ts`, `AI-Writer/backend/services/*.py`

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 2 | N+1 patterns in loops |
| HIGH | 4 | Unbounded queries without pagination |
| MEDIUM | 3 | In-memory filtering after fetch |

---

## CRITICAL: N+1 Query Patterns

### 1. [CRITICAL] `apps/web/src/actions/analytics/get-predictions.ts` - Goal Projections Loop

**Location**: Lines 70-99  
**File**: `/home/dominic/Documents/TeveroSEO/apps/web/src/actions/analytics/get-predictions.ts`

```typescript
// N+1 PATTERN: Each goal triggers a separate API call for snapshots
for (const { goal, template } of goals) {
  // Fetch goal history from snapshots endpoint
  let history: { date: string; value: number }[] = [];
  try {
    const snapshots = await getFastApi<{ snapshots: GoalSnapshot[] }>(
      `/api/clients/${clientId}/goals/${goal.id}/snapshots?days=30`
    );
    // ...
  }
}
```

**Impact**: If a client has 10 goals, this generates 11 API calls (1 for goals list + 10 for snapshots).

**Recommendation**: 
- Add a batch endpoint `/api/clients/${clientId}/goals/snapshots/batch` that accepts an array of goal IDs
- Or fetch all snapshots in a single query with goal_id IN (...) filter

---

### 2. [CRITICAL] `AI-Writer/backend/services/monitoring_data_service.py` - Execution Logs N+1

**Location**: Lines 424-445  
**File**: `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/monitoring_data_service.py`

```python
logs = query.all()

# N+1 PATTERN: Each log triggers a separate query for task details
logs_data = []
for log in logs:
    # Get task details if available
    task = self.db.query(MonitoringTask).filter(
        MonitoringTask.id == log.task_id
    ).first()
```

**Impact**: Fetching 50 execution logs triggers 51 queries (1 for logs + 50 for tasks).

**Recommendation**:
- Use eager loading with `joinedload`: `query.options(joinedload(TaskExecutionLog.task))`
- Or use a single JOIN query: `query.join(MonitoringTask, MonitoringTask.id == TaskExecutionLog.task_id)`

---

## HIGH: Unbounded Queries

### 3. [HIGH] `apps/web/src/actions/analytics/get-opportunities.ts` - Workspace Opportunities

**Location**: Lines 141-177  
**File**: `/home/dominic/Documents/TeveroSEO/apps/web/src/actions/analytics/get-opportunities.ts`

```typescript
// Get all clients in workspace (UNBOUNDED)
const clients = await getOpenSeo<{ id: string; name: string }[]>(
  `/api/workspaces/${workspaceId}/clients`
);

// Then for each client, fetch opportunities (LIMITED to 20 per client)
await Promise.all(
  clients.map(async (client) => {
    const clientOpportunities = await findOpportunities(client.id);
    // ...
  })
);
```

**Impact**: 
- Workspace with 1000 clients triggers 1001 API calls
- All clients loaded into memory before filtering
- No server-side pagination

**Recommendation**:
- Add LIMIT to clients query: `/api/workspaces/${workspaceId}/clients?limit=50`
- Implement server-side aggregation of opportunities across clients
- Consider batch processing for large workspaces

---

### 4. [HIGH] `AI-Writer/backend/services/content_planning_db.py` - Multiple Unbounded `.all()` Queries

**Location**: Lines 47-53, 110-116, 173-179, 236-242  
**File**: `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/content_planning_db.py`

```python
# UNBOUNDED: No LIMIT on any of these queries
async def get_user_content_strategies(self, user_id: int) -> List[ContentStrategy]:
    return self.db.query(ContentStrategy).filter(ContentStrategy.user_id == user_id).all()

async def get_strategy_calendar_events(self, strategy_id: int) -> List[CalendarEvent]:
    return self.db.query(CalendarEvent).filter(CalendarEvent.strategy_id == strategy_id).all()

async def get_user_content_gap_analyses(self, user_id: int) -> List[ContentGapAnalysis]:
    return self.db.query(ContentGapAnalysis).filter(ContentGapAnalysis.user_id == user_id).all()

async def get_user_content_recommendations(self, user_id: int) -> List[ContentRecommendation]:
    return self.db.query(ContentRecommendation).filter(ContentRecommendation.user_id == user_id).all()
```

**Impact**: User with years of data could have thousands of records loaded into memory.

**Recommendation**:
- Add default LIMIT with pagination: `.limit(100).offset(offset)`
- Add cursor-based pagination for large result sets
- Consider implementing lazy loading with generators

---

### 5. [HIGH] `open-seo-main/src/services/alerts.ts` - Unbounded Alert Rules Query

**Location**: Lines 171-176  
**File**: `/home/dominic/Documents/TeveroSEO/open-seo-main/src/services/alerts.ts`

```typescript
export async function getClientAlertRules(clientId: string) {
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.clientId, clientId));
  // NO LIMIT
}
```

**Impact**: While alert rules are typically few per client, defensive coding should include limits.

**Recommendation**:
- Add `.limit(100)` as a safety net
- Consider pagination if clients can have many custom rules

---

### 6. [HIGH] `AI-Writer/backend/services/ai_analytics_service.py` - Multiple Unbounded Queries

**Location**: Lines 237-243, 412-422, 703-717  
**File**: `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/ai_analytics_service.py`

```python
# UNBOUNDED: All analytics loaded for strategy
analytics = session.query(ContentAnalytics).filter(
    ContentAnalytics.strategy_id == strategy_id,
    ContentAnalytics.recorded_at >= start_date,
    ContentAnalytics.recorded_at <= end_date
).all()

# UNBOUNDED: All analytics for performance data
analytics = session.query(ContentAnalytics).filter(
    ContentAnalytics.strategy_id == strategy_id
).all()
```

**Impact**: Analytics data grows continuously; queries could return thousands of records.

**Recommendation**:
- Add `.limit(1000)` for safety
- Implement aggregation queries for metrics (SUM, AVG) instead of loading all records
- Add date range filters where missing

---

## MEDIUM: In-Memory Filtering

### 7. [MEDIUM] `open-seo-main/src/routes/api/changes/index.ts` - Post-Query Filtering

**Location**: Lines 67-80  
**File**: `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/changes/index.ts`

```typescript
let changes = await getChangesByClient(clientIdParam, {
  status,
  category,
  limit: limit ? parseInt(limit, 10) : 100,
  offset: offset ? parseInt(offset, 10) : 0,
});

// IN-MEMORY FILTERING: After database fetch
if (resourceType) {
  changes = changes.filter((c) => c.resourceType === resourceType);
}
if (triggeredBy) {
  changes = changes.filter((c) => c.triggeredBy === triggeredBy);
}
if (dateFrom) {
  const fromDate = new Date(dateFrom);
  changes = changes.filter((c) => c.createdAt >= fromDate);
}
```

**Impact**: 
- Fetches up to 100 records, then filters in memory
- Inefficient when most records are filtered out
- Could return fewer results than expected with pagination

**Recommendation**:
- Push filters to the repository layer (`getChangesByClient`)
- Add database WHERE clauses for resourceType, triggeredBy, dateFrom, dateTo

---

### 8. [MEDIUM] `apps/web/src/actions/analytics/detect-patterns.ts` - In-Memory Pagination

**Location**: Lines 216-237  
**File**: `/home/dominic/Documents/TeveroSEO/apps/web/src/actions/analytics/detect-patterns.ts`

```typescript
const patterns = await detectPatterns(workspaceId);

// IN-MEMORY: Filter then paginate
const filtered = status
  ? patterns.filter((p) => p.status === status)
  : patterns;

// IN-MEMORY: Slice for pagination
const total = filtered.length;
const totalPages = Math.ceil(total / limit);
const offset = (page - 1) * limit;
const paginatedData = filtered.slice(offset, offset + limit);
```

**Impact**: All patterns fetched from cache/computed, then filtered and sliced in memory.

**Recommendation**:
- If patterns are stored in DB, apply filters at query level
- For computed patterns, consider caching filtered results separately
- This is acceptable if total patterns remain small (<1000)

---

### 9. [MEDIUM] `apps/web/src/actions/analytics/get-opportunities.ts` - Memory Aggregation

**Location**: Lines 155-188  
**File**: `/home/dominic/Documents/TeveroSEO/apps/web/src/actions/analytics/get-opportunities.ts`

```typescript
const allOpportunities: Opportunity[] = [];

// Collect all opportunities in memory
await Promise.all(
  clients.map(async (client) => {
    const clientOpportunities = await findOpportunities(client.id);
    allOpportunities.push(
      ...clientOpportunities.slice(0, 20).map((opp) => ({
        ...opp,
        clientId: client.id,
        clientName: client.name,
      }))
    );
  })
);

// Sort all in memory
const sortedOpportunities = allOpportunities.sort(
  (a, b) => (b.metrics?.estimatedGain ?? 0) - (a.metrics?.estimatedGain ?? 0)
);
```

**Impact**: With 50 clients x 20 opportunities = 1000 records sorted in memory.

**Recommendation**:
- Acceptable for current scale (50 client limit)
- Consider server-side aggregation for larger workspaces
- Add workspace-level opportunity caching

---

## Missing Index Considerations

Based on the query patterns observed, the following indexes should be verified:

### AI-Writer SQLite Databases

```sql
-- MonitoringTask lookups by task_id (from N+1 pattern)
CREATE INDEX IF NOT EXISTS idx_monitoring_task_id ON monitoring_task(id);

-- ContentAnalytics filters
CREATE INDEX IF NOT EXISTS idx_content_analytics_strategy_date 
ON content_analytics(strategy_id, recorded_at);

-- TaskExecutionLog pagination
CREATE INDEX IF NOT EXISTS idx_task_execution_log_user_date 
ON task_execution_log(user_id, execution_date DESC);
```

### open-seo-main PostgreSQL

```sql
-- Changes filtering (currently done in-memory)
CREATE INDEX IF NOT EXISTS idx_changes_client_resource_type 
ON changes(client_id, resource_type);

CREATE INDEX IF NOT EXISTS idx_changes_client_triggered_by 
ON changes(client_id, triggered_by);

CREATE INDEX IF NOT EXISTS idx_changes_client_created_at 
ON changes(client_id, created_at);

-- Alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_client_id 
ON alert_rules(client_id);
```

---

## Summary of Recommendations

### Immediate (CRITICAL)

1. **Fix N+1 in goal projections** - Add batch snapshot endpoint
2. **Fix N+1 in execution logs** - Use SQLAlchemy eager loading

### Short-term (HIGH)

3. **Add LIMIT to unbounded queries** - Default 100-1000 depending on use case
4. **Push filters to database** - Move in-memory filtering to WHERE clauses
5. **Add missing indexes** - Verify index coverage for common query patterns

### Long-term (MEDIUM)

6. **Implement server-side aggregation** - For workspace-level reports
7. **Add query monitoring** - Track slow queries and N+1 patterns in production
8. **Consider read replicas** - For heavy analytics queries

---

## Files Requiring Changes

| Priority | File | Issue |
|----------|------|-------|
| CRITICAL | `apps/web/src/actions/analytics/get-predictions.ts` | N+1 goal snapshots |
| CRITICAL | `AI-Writer/backend/services/monitoring_data_service.py` | N+1 task lookups |
| HIGH | `apps/web/src/actions/analytics/get-opportunities.ts` | Unbounded clients fetch |
| HIGH | `AI-Writer/backend/services/content_planning_db.py` | Multiple unbounded .all() |
| HIGH | `open-seo-main/src/services/alerts.ts` | No LIMIT on rules |
| HIGH | `AI-Writer/backend/services/ai_analytics_service.py` | Unbounded analytics |
| MEDIUM | `open-seo-main/src/routes/api/changes/index.ts` | In-memory filtering |
| MEDIUM | `apps/web/src/actions/analytics/detect-patterns.ts` | In-memory pagination |

---

## FIXES IMPLEMENTED - 2026-04-28

### N+1 Patterns Fixed

1. **`apps/web/src/actions/analytics/get-predictions.ts`** - Goal Projections
   - Changed from sequential per-goal snapshot fetches to batch endpoint
   - Now fetches all snapshots in single request: `/api/clients/{id}/goals/snapshots/batch?goalIds=...`
   - Fallback to individual fetches for backwards compatibility
   - **Impact**: Reduced from N+1 queries to 1 query (or N fallback)

2. **`AI-Writer/backend/services/monitoring_data_service.py`** - Execution Logs
   - Added `joinedload(TaskExecutionLog.task)` for eager loading
   - Task details now fetched in single JOIN query instead of N+1
   - Added max limit enforcement (100 records)
   - **Impact**: Reduced from N+1 queries to 1 query

### Unbounded Queries Fixed

3. **`apps/web/src/actions/analytics/get-opportunities.ts`** - Workspace Clients
   - Added `?limit=50` to workspace clients endpoint
   - Processes in batches of 10 to avoid API overwhelm
   - **Impact**: Bounded to 50 clients max, processed in controlled batches

4. **`AI-Writer/backend/services/content_planning_db.py`** - Multiple Methods
   - `get_user_content_strategies()` - Added limit/offset params, default 100
   - `get_strategy_calendar_events()` - Added limit/offset params, default 100
   - `get_user_content_gap_analyses()` - Added limit/offset params, default 100
   - `get_user_content_recommendations()` - Added limit/offset params, default 100
   - **Impact**: All queries now bounded with pagination support

5. **`open-seo-main/src/services/alerts.ts`** - Alert Rules
   - `getClientAlertRules()` - Added limit/offset params, default 100
   - **Impact**: Query now bounded with pagination support

6. **`AI-Writer/backend/services/ai_analytics_service.py`** - Analytics Queries
   - `_get_analytics_data()` - Added LIMIT 1000 with ORDER BY recorded_at DESC
   - `_get_performance_data()` - Added LIMIT 1000, proper session cleanup
   - `_get_historical_performance_data()` - Added LIMIT 1000
   - **Impact**: All analytics queries now bounded to 1000 records

### In-Memory Filtering Fixed

7. **`open-seo-main/src/routes/api/changes/index.ts`** - Changes Filtering
   - Pushed all filters to repository layer (resourceType, triggeredBy, dateFrom, dateTo)
   - Updated `ChangeRepository.getChangesByClient()` to accept new filter params
   - Added `gte`/`lte` imports for date range queries
   - **Impact**: All filtering now at database level, pagination accurate

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/actions/analytics/get-predictions.ts` | Batch snapshot fetch with fallback |
| `apps/web/src/actions/analytics/get-opportunities.ts` | Bounded clients fetch with batching |
| `AI-Writer/backend/services/monitoring_data_service.py` | Eager loading + max limit |
| `AI-Writer/backend/services/content_planning_db.py` | Pagination on 4 methods |
| `AI-Writer/backend/services/ai_analytics_service.py` | LIMIT on 3 query methods |
| `open-seo-main/src/services/alerts.ts` | Pagination on alert rules |
| `open-seo-main/src/server/features/changes/repositories/ChangeRepository.ts` | Extended filter support |
| `open-seo-main/src/routes/api/changes/index.ts` | Database-level filtering |

### Remaining Items (MEDIUM priority - acceptable for now)

- `apps/web/src/actions/analytics/detect-patterns.ts` - In-memory pagination
  - Patterns are computed/cached, not stored in DB
  - Total patterns typically <100, acceptable for in-memory operations
  - Consider caching filtered results if pattern volume grows
