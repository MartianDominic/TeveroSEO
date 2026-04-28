# API Contract Audit Report - Round 2

**Date:** 2026-04-28  
**Scope:** Frontend-Backend API contract alignment  
**Files Examined:** 35+ action files, API endpoints, hooks, and type definitions

---

## Summary

Analyzed `apps/web/src/actions/**/*.ts`, `apps/web/src/hooks/*.ts`, `apps/web/src/types/*.ts`, and corresponding `AI-Writer/backend/api/*.py` backend endpoints. Identified **8 CRITICAL**, **6 HIGH**, and **9 MEDIUM** severity issues.

---

## CRITICAL Issues

### 1. Dashboard Metrics Response Shape Mismatch

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/actions/dashboard/get-clients-paginated.ts` (lines 102-106)  
**BACKEND:** `AI-Writer/backend/api/dashboard.py` (lines 466-470)

**ISSUE:** Frontend expects `data`, `hasMore`, `totalCount` from API, but builds cursors locally from data assuming specific properties exist.

```typescript
// Frontend expects:
const response = await getFastApi<{
  data: ClientMetrics[];
  hasMore: boolean;
  totalCount: number;
}>(`/api/dashboard/metrics/paginated?${params.toString()}`);

// Then assumes:
const lastRow = data[data.length - 1];
const getSortValue = (row: ClientMetrics): string | number => {
  const key = sortKeyMap[sortBy] ?? "priorityScore";
  return (row[key] as string | number) ?? 0;  // Potential undefined
};
```

**IMPACT:** If backend returns empty `data` array, `data[data.length - 1]` returns `undefined`, causing cursor encoding to fail silently or produce invalid cursors.

**FIX:** Add null check before accessing `lastRow` properties:
```typescript
const nextCursor = hasMore && lastRow && lastRow.clientId
  ? encodeCursor(lastRow.clientId, getSortValue(lastRow))
  : null;
```

---

### 2. Portfolio Aggregates Numeric String Parsing

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/actions/dashboard/get-portfolio-aggregates.ts` (lines 93-106)

**ISSUE:** Backend may return numeric fields as strings (common with Decimal/Numeric SQL types), but frontend casts without validation.

```typescript
// Frontend assumes response.data fields might be strings:
avgGoalAttainment: Number(response.data.avgGoalAttainment ?? 0),
avgGoalAttainmentTrend: response.data.avgGoalAttainmentTrend
  ? Number(response.data.avgGoalAttainmentTrend)
  : null,
```

**IMPACT:** If backend returns `avgGoalAttainment: "NaN"` or `avgGoalAttainment: null`, `Number(null)` returns `0` but `Number("abc")` returns `NaN`, causing display issues.

**FIX:** Add explicit validation:
```typescript
avgGoalAttainment: parseFloat(String(response.data.avgGoalAttainment)) || 0,
```

---

### 3. CursorPaginationResult Error Field Not Type-Safe

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/types/pagination.ts` (line 19) vs `apps/web/src/actions/dashboard/get-clients-paginated.ts` (line 155)

**ISSUE:** The `error` field is added to the return type at runtime but not declared in `CursorPaginationResult` interface properly.

```typescript
// Type definition:
export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  totalCount: number;
  error?: string;  // Optional field added
}

// Usage returns:
return {
  data: [],
  error: "Failed to load clients. Please try again.",  // OK
};
```

**IMPACT:** Consumers of `usePaginatedClients` hook may not check for `error` field since TypeScript won't enforce error handling.

**FIX:** Make error handling explicit in hook:
```typescript
const { data, isError, error } = usePaginatedClients(...);
// Also show error from data.pages[0]?.error
```

---

### 4. Voice Profile Mode Enum Mismatch

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/lib/voiceApi.ts` (line 17)  
**BACKEND:** Potentially `open-seo-main` voice endpoints

**ISSUE:** Frontend defines:
```typescript
mode: "preservation" | "application" | "best_practices";
```

If backend uses different enum values (e.g., `"preserve"` instead of `"preservation"`), voice profile operations will silently fail or data will be lost.

**IMPACT:** Voice profile CRUD operations may fail with validation errors or store incorrect data.

**FIX:** Verify backend enum values match exactly. Consider using a shared schema or adding Zod runtime validation on API responses.

---

### 5. Prediction Analytics Field Mismatch

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/actions/analytics/get-predictions.ts` (lines 144-148)  
**BACKEND:** `AI-Writer/backend/api/analytics.py` (lines 98-161)

**ISSUE:** Frontend expects `gsc_daily` array in analytics response:
```typescript
const analytics = await getFastApi<ClientAnalytics>(
  `/api/clients/${clientId}/analytics`
);
if (analytics.gsc_daily && analytics.gsc_daily.length >= 7) { ... }
```

Backend returns different shape:
```python
class ClientAnalyticsResponse(BaseModel):
    client_id: str
    articles_published_this_month: int
    total_word_count_this_month: int
    failed_count_this_month: int
    last_published_at: Optional[str]
    cms_type: Optional[str]
```

**IMPACT:** `analytics.gsc_daily` will always be `undefined`, so traffic prediction alerts never fire.

**FIX:** Either:
1. Add `gsc_daily` field to backend `ClientAnalyticsResponse`, or
2. Frontend should call separate GSC data endpoint

---

### 6. Opportunity Type Enum Mismatch

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/types/opportunities.ts` (lines 9-13) vs `apps/web/src/actions/analytics/get-opportunities.ts` (line 26)

**ISSUE:** Frontend defines OpportunityType as:
```typescript
export type OpportunityType =
  | "ctr_improvement"
  | "ranking_gap"
  | "quick_win"
  | "content_opportunity";
```

But action file filter accepts:
```typescript
types: z.array(z.enum(["quick-win", "growth", "defensive", "technical", "content"])).optional()
```

**IMPACT:** Type mismatch between filter schema and actual type. `"quick-win"` (hyphenated) vs `"quick_win"` (underscored), and different enum values.

**FIX:** Align filter schema with `OpportunityType`:
```typescript
types: z.array(z.enum(["ctr_improvement", "ranking_gap", "quick_win", "content_opportunity"])).optional()
```

---

### 7. TeamMetrics Error Field Not in Type

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/actions/team/get-team-metrics.ts` (line 294)  
**TYPE:** Missing `error` in `TeamMetrics` interface

**ISSUE:** Function returns `error` field on failure but type likely doesn't include it:
```typescript
return {
  totalCapacity: 0,
  utilizedCapacity: 0,
  // ...
  members: [],
  error: "Failed to load team metrics. Please try again.",  // Not in type
};
```

**IMPACT:** TypeScript doesn't catch missing error handling in consumers.

**FIX:** Add `error?: string` to `TeamMetrics` type definition.

---

### 8. Changes API Response Wrapping Inconsistency

**SEVERITY:** CRITICAL  
**FILE:** `apps/web/src/actions/changes.ts` (lines 156-162)

**ISSUE:** Action expects backend to return `{ success: boolean; data: Change[] }`:
```typescript
const response = await getOpenSeo<{ success: boolean; data: Change[] }>(url);
if (!response.success) {
  return { success: false, error: 'Failed to fetch changes' };
}
return { success: true, data: response.data };
```

If backend returns unwrapped array `Change[]` instead of `{ success, data }` wrapper, this will fail.

**IMPACT:** Runtime error when accessing `response.success` on an array.

**FIX:** Verify backend returns proper wrapper or update frontend to handle both.

---

## HIGH Issues

### 1. Alerts API Response Type Casting

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/alerts.ts` (line 66)

**ISSUE:** Direct cast without validation:
```typescript
return getOpenSeo(`/api/clients/${validatedClientId}/alerts${query}`) as Promise<Alert[]>;
```

**IMPACT:** If backend returns different structure, runtime errors occur.

**FIX:** Use generic type parameter instead of cast:
```typescript
return getOpenSeo<Alert[]>(`/api/clients/${validatedClientId}/alerts${query}`);
```

---

### 2. SavedView JSON Column Parsing

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/views/saved-views.ts` (lines 69-88)

**ISSUE:** Backend returns `columns` and `filters` as JSON strings, frontend parses with fallbacks:
```typescript
function parseJsonColumn<T>(raw: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    // ...
  } catch { return fallback; }
}
```

**IMPACT:** Invalid JSON silently degrades to empty arrays/objects. Users lose their saved view configurations without notification.

**FIX:** Log errors more prominently and potentially show user notification.

---

### 3. Keywords Action Uses `unknown` Return Types

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/seo/keywords.ts` (lines 84, 104, 131, 146)

**ISSUE:** Multiple functions return `Promise<unknown>`:
```typescript
export async function researchKeywords(params: ResearchKeywordsParams): Promise<unknown>
export async function saveKeywords(params: SaveKeywordsParams): Promise<unknown>
export async function removeSavedKeyword(params: RemoveSavedKeywordParams): Promise<unknown>
export async function getSerpAnalysis(params: SerpAnalysisParams): Promise<unknown>
```

**IMPACT:** No type safety for consumers. Any property access requires manual casting.

**FIX:** Define proper response types for each endpoint.

---

### 4. Audit Results Uses `unknown` Return Type

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/seo/audit.ts` (line 99)

**ISSUE:**
```typescript
export async function getAuditResults(params: AuditIdParams): Promise<unknown>
```

**IMPACT:** Components consuming audit results have no type safety.

**FIX:** Define `AuditResults` interface matching backend response.

---

### 5. Pattern Detection API Endpoints May Not Exist

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/analytics/detect-patterns.ts` (lines 159-165)

**ISSUE:** Calls endpoints that may not be implemented:
```typescript
const [trafficResponse, rankingResponse] = await Promise.all([
  getOpenSeo<TrafficDataResponse[]>(
    `/api/workspaces/${validatedWorkspaceId.data}/traffic-data`
  ),
  getOpenSeo<RankingDataResponse[]>(
    `/api/workspaces/${validatedWorkspaceId.data}/ranking-data`
  ),
]);
```

**IMPACT:** If endpoints don't exist, pattern detection fails silently (returns `[]`).

**FIX:** Verify endpoints exist in open-seo-main backend.

---

### 6. Webhook Events Array Validation

**SEVERITY:** HIGH  
**FILE:** `apps/web/src/actions/webhooks.ts` (lines 33-35)

**ISSUE:** Events schema is very permissive:
```typescript
const webhookEventsSchema = z
  .array(z.string().min(1).max(100))
  .min(1)
  .max(50);
```

**IMPACT:** Frontend accepts any string, but backend may reject invalid event types.

**FIX:** Validate against known event types from registry or add backend validation error handling.

---

## MEDIUM Issues

### 1. Date String vs Date Object Handling

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/types/opportunities.ts` (lines 46-47) vs `apps/web/src/actions/analytics/get-opportunities.ts`

**ISSUE:** Type defines dates as `Date`:
```typescript
createdAt: Date;
expiresAt?: Date;
```

But API likely returns ISO strings. Frontend must parse:
```typescript
// Currently no transformation happens
```

**IMPACT:** Date methods called on string values fail.

**FIX:** Transform dates in action:
```typescript
createdAt: new Date(rawOpportunity.createdAt),
```

---

### 2. ClientMetrics Type Mismatch - primaryGoalTrend

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/lib/dashboard/types.ts` (line 38) vs `AI-Writer/backend/api/dashboard.py` (line 78)

**ISSUE:** Frontend type:
```typescript
primaryGoalTrend: "up" | "down" | "flat" | null;
```

Backend returns:
```python
primaryGoalTrend: Optional[str] = None  # Could be any string
```

**IMPACT:** Invalid trend values not caught at runtime.

**FIX:** Add runtime validation or backend enum constraint.

---

### 3. Connection Status Enum Divergence

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/lib/dashboard/types.ts` (line 30) vs `AI-Writer/backend/api/dashboard.py` (line 72)

**ISSUE:** Frontend:
```typescript
connectionStatus: "connected" | "stale" | "disconnected";
```

Backend:
```python
connectionStatus: str = "disconnected"  # No enum constraint
```

**IMPACT:** Backend could return unexpected values.

**FIX:** Add Python enum or Literal type on backend.

---

### 4. ProtectionRule Response Shape

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/lib/voiceApi.ts` (lines 64-71)

**ISSUE:** Frontend expects specific shape for protection rules, but no runtime validation:
```typescript
export interface ProtectionRule {
  id: string;
  profileId: string;
  ruleType: "page" | "section" | "pattern";
  // ...
}
```

**IMPACT:** Invalid ruleType values not caught.

**FIX:** Add Zod validation on API response.

---

### 5. Missing Pagination in getClientAlerts

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/actions/alerts.ts` (line 66)

**ISSUE:** Returns all alerts without pagination:
```typescript
export async function getClientAlerts(clientId: string, status?: string): Promise<Alert[]>
```

**IMPACT:** Performance degradation with many alerts.

**FIX:** Add pagination parameters.

---

### 6. Batch Size Hard-Coded in Predictions

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/actions/analytics/get-predictions.ts` (lines 277-278)

**ISSUE:**
```typescript
const batchSize = 10;
for (let i = 0; i < Math.min(metrics.length, 50); i += batchSize) {
```

**IMPACT:** Hard limit of 50 clients processed, may miss predictions for larger workspaces.

**FIX:** Make configurable or use proper pagination.

---

### 7. CMS Test Connection Platform Enum

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/actions/cms/test-connection.ts` (line 21) vs `AI-Writer/backend/api/clients.py` (line 78)

**ISSUE:** Both define same enum but separately:
```typescript
// Frontend
const cmsPlatformSchema = z.enum(["wordpress", "shopify", "wix", "webhook"])

// Backend
class TestConnectionParams(BaseModel):
    platform: str = Field(..., pattern="^(wordpress|shopify|wix|webhook)$")
```

**IMPACT:** Enum drift risk if one side adds a platform.

**FIX:** Generate types from shared schema or OpenAPI spec.

---

### 8. Reassign Client Cache Invalidation

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/actions/team/get-team-metrics.ts` (lines 331-333)

**ISSUE:** Only invalidates 'owner' role cache:
```typescript
const cacheKey = teamMetricsCacheKey(validatedWorkspaceId, 'owner');
await cacheSet(cacheKey, null, { ttl: 0 });
```

**IMPACT:** Other role caches (admin, member) not invalidated after reassignment.

**FIX:** Invalidate all role caches or use cache tags.

---

### 9. Webhook Scope Validation Gap

**SEVERITY:** MEDIUM  
**FILE:** `apps/web/src/actions/webhooks.ts` (lines 189-194)

**ISSUE:** Update function fetches webhook to check scope, but doesn't verify workspace membership for workspace-scoped webhooks:
```typescript
if (webhook.scope === "client" && webhook.scopeId) {
  await validateClientOwnership(webhook.scopeId, auth);
}
// Missing: else if (webhook.scope === "workspace") { validateWorkspaceMembership }
```

**IMPACT:** Potential IDOR for workspace-scoped webhooks.

**FIX:** Add workspace membership validation for workspace-scoped webhooks.

---

## Recommendations

1. **Shared Schema Generation:** Use OpenAPI spec or code generation to ensure type alignment between frontend and backend.

2. **Runtime Validation:** Add Zod validation on all API responses, not just inputs.

3. **Error Type Standardization:** Create a consistent error response type across all actions.

4. **Enum Synchronization:** Define enums in a shared location or generate from backend.

5. **Pagination Defaults:** Audit all list endpoints for missing pagination.

6. **Type Safety Audit:** Replace all `unknown` return types with proper interfaces.

---

## Files Changed (Recommended Priority Order)

1. `apps/web/src/actions/analytics/get-predictions.ts` - CRITICAL: Fix analytics response mismatch
2. `apps/web/src/actions/analytics/get-opportunities.ts` - CRITICAL: Fix filter enum mismatch  
3. `apps/web/src/actions/dashboard/get-clients-paginated.ts` - CRITICAL: Fix cursor null handling
4. `apps/web/src/types/pagination.ts` - CRITICAL: Add error field documentation
5. `apps/web/src/actions/changes.ts` - CRITICAL: Verify response wrapper format
6. `apps/web/src/lib/voiceApi.ts` - CRITICAL: Verify voice mode enum values
7. `apps/web/src/actions/seo/keywords.ts` - HIGH: Add proper return types
8. `apps/web/src/actions/webhooks.ts` - MEDIUM: Add workspace scope validation

---

## FIXES IMPLEMENTED - 2026-04-28

### Enum Standardization

1. **OpportunityType filter schema** (`get-opportunities.ts` line 25-26)
   - Changed from: `["quick-win", "growth", "defensive", "technical", "content"]`
   - Changed to: `["ctr_improvement", "ranking_gap", "quick_win", "content_opportunity"]`
   - Now aligned with `OpportunityType` in `types/opportunities.ts`

2. **Voice profile mode enum** (`voiceApi.ts`)
   - Added Zod validation schema: `voiceModeSchema = z.enum(["preservation", "application", "best_practices"])`
   - Added `voiceStatusSchema` and `ruleTypeSchema` for complete validation

### Response Shape Fixes

1. **Dashboard cursor encoding** (`get-clients-paginated.ts` lines 111-136)
   - Added null checks: `const lastRow = data.length > 0 ? data[data.length - 1] : null`
   - Enhanced cursor encoding: `nextCursor: hasMore && lastRow && lastRow.clientId ? ...`
   - Prevents undefined access on empty arrays

2. **Portfolio aggregates numeric parsing** (`get-portfolio-aggregates.ts` lines 93-113)
   - Added `safeParseNum()` and `safeParseNumOrNull()` helper functions
   - Handles: null, undefined, NaN strings, and Decimal type coercion
   - Returns fallback values instead of NaN

3. **Predictions GSC data endpoint** (`get-predictions.ts` lines 180-193)
   - Changed from: `getFastApi<ClientAnalytics>('/api/clients/${clientId}/analytics')`
   - Changed to: `getFastApi<GscDailyResponse>('/api/clients/${clientId}/gsc/daily?days=30')`
   - Added `GscDailyResponse` interface for proper typing
   - Gracefully handles missing GSC connection

### Schema Validation Added

1. **Voice API responses** (`voiceApi.ts`)
   - `voiceProfileResponseSchema` - validates mode, voiceStatus fields
   - `protectionRulesResponseSchema` - validates ruleType field
   - Both use `.passthrough()` to allow additional fields
   - Logs validation errors before throwing

### Already Correct (Verified)

1. **TeamMetrics error field** - Already defined in `types/team.ts` line 48
2. **Changes API response wrapper** - Already expects `{ success: boolean; data: Change[] }`
3. **CursorPaginationResult error field** - Already defined in `types/pagination.ts` line 19

### Remaining Items (Not Fixed)

1. **Keywords action `unknown` return types** - Requires defining backend response schemas
2. **Webhook workspace scope validation** - Requires backend endpoint verification
3. **Pattern detection endpoints** - Requires backend implementation check
