# Agent 4: API Contract Validation Review

**Agent ID:** 4
**Domain:** API Contract Validation
**Date:** 2026-05-03

## Scope
- Request/response schema consistency
- Error response formats
- Status code usage
- Type safety across boundaries

## Files Examined
- `/AI-Writer/backend/main.py`
- `/AI-Writer/backend/api/clients.py`
- `/AI-Writer/backend/api/articles.py`
- `/AI-Writer/backend/api/analytics.py`
- `/AI-Writer/backend/api/voice_templates.py`
- `/AI-Writer/backend/api/workspaces.py`
- `/apps/web/src/lib/server-fetch.ts`
- `/apps/web/src/actions/seo/audit.ts`
- `/apps/web/src/actions/voice.ts`
- `/apps/web/src/actions/analytics/get-opportunities.ts`
- `/apps/web/src/actions/dashboard/get-clients-paginated.ts`
- `/apps/web/src/actions/seo/projects.ts`
- `/open-seo-main/src/routes/api/webhooks.ts`
- `/open-seo-main/src/routes/api/connections/index.ts`
- `/open-seo-main/src/routes/api/reports/generate.ts`
- `/open-seo-main/src/routes/api/invoices/$id.pay.ts`

## Findings

### CRITICAL Issues

**CRIT-API-01: Unvalidated credentials field in CreateConnectionSchema**
- **Location:** `/open-seo-main/src/routes/api/connections/index.ts:33`
- **Description:** The `credentials` field accepts `z.record(z.string(), z.unknown())` which allows any arbitrary object without platform-specific validation. This could lead to storing invalid or malicious credential structures.
- **Expected:** Platform-specific credential schemas (e.g., WordPress requires `wp_url`, `wp_username`, `wp_app_password`)
- **Actual:** Any key-value pairs accepted without validation
- **Fix:** Create discriminated union schemas for each platform type:
```typescript
const WordPressCredentialsSchema = z.object({
  wp_url: z.string().url(),
  wp_username: z.string().min(1),
  wp_app_password: z.string().min(1),
});
const ShopifyCredentialsSchema = z.object({
  shopify_store_url: z.string().url(),
  shopify_access_token: z.string().min(1),
});
// Use discriminated union based on platform field
```

**CRIT-API-02: Type assertion without validation in server-fetch.ts**
- **Location:** `/apps/web/src/lib/server-fetch.ts:338`
- **Description:** When no schema is provided, the response is cast with `return parsed as T` bypassing runtime type validation. This can cause runtime crashes if the API response shape differs from TypeScript expectations.
- **Expected:** All API responses should be validated against schemas
- **Actual:** Type assertion used when schema not provided
- **Fix:** Require schema parameter or implement runtime type guards for critical paths. Consider making schema parameter required or adding a lint rule to flag unvalidated API calls.

### HIGH Issues

**HIGH-API-01: Inconsistent error response formats between services**
- **Location:** Multiple files across AI-Writer, open-seo-main, apps/web
- **Description:** 
  - AI-Writer uses `{"detail": "..."}` (FastAPI default)
  - open-seo-main uses `{"error": "...", "code": "..."}`
  - apps/web normalizes via `normalizeBackendError()` but some paths miss this
- **Expected:** Consistent error envelope: `{success: false, error: string, code: string}`
- **Actual:** Three different formats causing frontend parsing complexity
- **Evidence:** 
  - `/AI-Writer/backend/main.py:270` returns `{"detail": "..."}`
  - `/open-seo-main/src/routes/api/connections/index.ts:71` returns `{"error": "..."}`
  - `/apps/web/src/lib/server-fetch.ts:117-184` normalizes but not all code paths use it
- **Fix:** Standardize on single error format across all services

**HIGH-API-02: Missing validation on limit parameter in publishing-logs endpoint**
- **Location:** `/AI-Writer/backend/api/analytics.py:183`
- **Description:** The `limit` parameter is capped at 100 server-side but no input validation schema enforces this. Client can send any integer, potentially causing confusion.
- **Code:**
```python
.limit(min(limit, 100))  # cap at 100 regardless of param
```
- **Expected:** Pydantic schema with `Field(le=100, ge=1)` constraint
- **Actual:** Manual clamping with `min(limit, 100)` after accepting any value
- **Fix:** Add Pydantic validation: `limit: int = Field(50, ge=1, le=100)`

**HIGH-API-03: Status code mismatch in voice_templates.py delete endpoint**
- **Location:** `/AI-Writer/backend/api/voice_templates.py:197`
- **Description:** DELETE endpoint returns `{"deleted": True}` with implicit 200 status. RESTful convention expects 204 No Content for successful deletes.
- **Code:**
```python
return {"deleted": True}  # Returns 200 with body
```
- **Expected:** `status_code=204` with no body, or explicit `status_code=200`
- **Actual:** Implicit 200 with JSON body
- **Fix:** Add `status_code=status.HTTP_204_NO_CONTENT` and return empty Response

**HIGH-API-04: Uncaught exception path in test_cms_connection**
- **Location:** `/AI-Writer/backend/api/articles.py:766-777`
- **Description:** Catches `ValueError` and generic `Exception` but if `get_publisher()` raises a custom exception class, it may not be handled properly.
- **Code:**
```python
except ValueError as e:
    return CmsConnectionResult(...)
except Exception as e:
    return CmsConnectionResult(
        success=False,
        cms_type=cms_type,
        error=f"Unexpected error: {str(e)}",  # Leaks internal details
    )
```
- **Fix:** Sanitize all exception messages, don't include `str(e)` directly

**HIGH-API-05: Invoice pay endpoint lacks idempotency protection**
- **Location:** `/open-seo-main/src/routes/api/invoices/$id.pay.ts:100-194`
- **Description:** POST to create payment session has no idempotency key. Multiple rapid clicks could create duplicate payment sessions with the same payment provider.
- **Expected:** Accept and validate `X-Idempotency-Key` header
- **Actual:** No idempotency protection
- **Fix:** Add idempotency key handling with cache/database to prevent duplicate sessions

**HIGH-API-06: Missing request body size limits**
- **Location:** Multiple FastAPI and TanStack routes
- **Description:** No explicit request body size limits configured. Large payloads could cause memory exhaustion or DoS.
- **Files affected:**
  - `/AI-Writer/backend/main.py` - No body size middleware
  - `/open-seo-main/src/routes/api/webhooks.ts` - Accepts arbitrary body
- **Fix:** Add body size limits via middleware (e.g., 1MB default, larger for specific upload endpoints)

### MEDIUM Issues

**MED-API-01: Pagination cursor encoding not validated**
- **Location:** `/apps/web/src/actions/dashboard/get-clients-paginated.ts:137-144`
- **Description:** Cursor is encoded client-side but backend validation is not shown. Tampered cursors could cause unexpected behavior or information disclosure.
- **Expected:** Backend should validate cursor format and contents
- **Actual:** Cursor passed directly to backend without apparent validation
- **Fix:** Add cursor signature/HMAC to prevent tampering

**MED-API-02: Inconsistent HTTP status codes for validation errors**
- **Location:** Multiple files
- **Description:** Validation errors return different status codes:
  - AI-Writer: 422 for UUID errors (`/analytics.py:74,218`)
  - open-seo-main: 400 for schema validation (`/connections/index.ts:94`)
  - apps/web actions: Return error object with success=false, no HTTP status
- **Expected:** Consistent 400 or 422 across all services
- **Fix:** Standardize on 422 for validation failures (RFC 4918 semantics)

**MED-API-03: Response type mismatch in getTopOpportunities**
- **Location:** `/apps/web/src/actions/analytics/get-opportunities.ts:217-222`
- **Description:** On error, function returns `{data: [], pagination: {...}, error: undefined}` but the return includes an `error` property that's not in the type definition.
- **Code:**
```typescript
return {
  data: [],
  nextCursor: null,
  prevCursor: null,
  hasMore: false,
  totalCount: 0,
  error: "Failed to load clients. Please try again.",  // Not in type
};
```
- **Expected:** Type definition should include optional error field
- **Actual:** Runtime object includes field not in type definition
- **Fix:** Update `PaginatedResponse<T>` or `CursorPaginationResult` to include `error?: string`

**MED-API-04: Missing Content-Type validation**
- **Location:** `/open-seo-main/src/routes/api/connections/index.ts:87`
- **Description:** POST handler calls `request.json()` without checking Content-Type header first. Non-JSON requests will throw uninformative errors.
- **Expected:** Check `Content-Type: application/json` before parsing
- **Actual:** Direct JSON parsing
- **Fix:** Add Content-Type validation middleware or check before parsing

**MED-API-05: Workspace ID query parameter inconsistency**
- **Location:** Multiple actions in apps/web
- **Description:** Some endpoints use `workspaceId`, others use `workspace_id` (snake_case). This creates confusion and potential bugs.
- **Examples:**
  - `/get-clients-paginated.ts` uses `workspaceId`
  - `/get-opportunities.ts` uses `workspaceId`
  - Backend open-seo may expect `workspace_id`
- **Fix:** Standardize on camelCase for frontend, snake_case for backend with explicit conversion layer

**MED-API-06: Missing rate limit headers in responses**
- **Location:** `/AI-Writer/backend/main.py:336-337`
- **Description:** CORS config exposes `X-RateLimit-*` headers but rate limit middleware doesn't appear to set them consistently across all endpoints.
- **Code:**
```python
expose_headers=["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
```
- **Expected:** All rate-limited endpoints should return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Actual:** Headers exposed but not consistently set
- **Fix:** Add rate limit headers to all rate-limited endpoint responses

### LOW Issues

**LOW-API-01: Inconsistent date serialization**
- **Location:** Multiple files
- **Description:** Dates serialized as ISO strings in most places, but some endpoints return raw datetime objects or different formats.
- **Examples:**
  - `/AI-Writer/backend/api/voice_templates.py:88` - `.isoformat()`
  - `/AI-Writer/backend/api/analytics.py:159` - `.isoformat() if last_pub else None`
- **Fix:** Use consistent ISO 8601 format with timezone (Z suffix for UTC)

**LOW-API-02: Missing OpenAPI/Swagger documentation for some endpoints**
- **Location:** `/AI-Writer/backend/api/seo_dashboard.py` endpoints registered directly on app
- **Description:** SEO dashboard endpoints are registered directly on `app` instead of via router, bypassing automatic OpenAPI documentation generation.
- **Evidence:** Lines 441-510 show direct `@app.get()` decorators instead of router pattern
- **Fix:** Move endpoints to dedicated router for proper OpenAPI inclusion

**LOW-API-03: Optional fields returned as null vs omitted inconsistently**
- **Location:** Multiple response schemas
- **Description:** Some responses omit optional fields when null, others include them explicitly as `null`. This affects frontend null-checking logic.
- **Example:** `ClientDetailResponse.settings` can be `None` but serialization behavior varies
- **Fix:** Standardize on explicit null for optional fields that may exist

**LOW-API-04: Undocumented query parameter aliases**
- **Location:** `/apps/web/src/actions/seo/audit.ts:118`
- **Description:** Query params use `audit_id` but TypeScript type uses `auditId`. Alias handling is implicit.
- **Code:**
```typescript
const query = buildQuery(validated, { audit_id: validated.auditId, action: "status" });
```
- **Fix:** Document or standardize naming conventions

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| CRITICAL | 2 | Unvalidated input types, type assertion bypassing validation |
| HIGH | 6 | Error format inconsistency, missing idempotency, body size limits |
| MEDIUM | 6 | Status code inconsistency, pagination security, type mismatches |
| LOW | 4 | Serialization consistency, documentation gaps |

## Positive Observations

1. **Good error normalization layer exists:** `/apps/web/src/lib/server-fetch.ts` has `normalizeBackendError()` that handles multiple error formats
2. **Strong validation patterns in apps/web actions:** Most server actions use Zod schemas for input validation
3. **SSRF protection in CMS connection tests:** URL validation prevents internal network access
4. **Credential encryption:** Sensitive CMS credentials are encrypted before storage
5. **Circuit breaker pattern:** `server-fetch.ts` implements circuit breakers for backend services

## Priority Recommendations

1. **Immediate (CRITICAL):** Add platform-specific credential validation schemas in ConnectionService
2. **Immediate (CRITICAL):** Require Zod schemas for all cross-service API calls in server-fetch
3. **Short-term (HIGH):** Unify error response format across all three services to `{error, code, success}`
4. **Short-term (HIGH):** Add idempotency protection to payment endpoints
5. **Medium-term (MEDIUM):** Standardize on 422 for validation errors across all services
6. **Medium-term (MEDIUM):** Add request body size limits to all endpoints
