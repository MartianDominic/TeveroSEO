# Agent 1: Cross-App Integration Review

**Reviewer:** Agent 1 (Claude Opus 4.5)
**Date:** 2026-05-03
**Scope:** Service boundaries, API contracts, shared state between apps/web, open-seo-main, AI-Writer

---

## Findings

### CRITICAL-01: Missing verify-access Endpoints for Prospects/Proposals

**Severity:** CRITICAL

**Location:** 
- `apps/web/src/lib/auth/action-auth.ts` lines 292-348 (validateProspectOwnership)
- `apps/web/src/lib/auth/action-auth.ts` lines 363-419 (validateProposalOwnership)

**Issue:** The frontend calls `POST /api/prospects/{id}/verify-access` and `POST /api/proposals/{id}/verify-access` on `open-seo-main`, but these endpoints DO NOT EXIST in open-seo-main. A grep search for "verify-access" in open-seo-main returned no results.

**Code Snippet (action-auth.ts:304-320):**
```typescript
const response = await fetch(
  `${backendUrl}/api/prospects/${prospectId}/verify-access`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      userId: authContext.userId,
      orgId: authContext.orgId
    }),
    signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
  }
);
```

**Impact:** All prospect and proposal operations in apps/web will fail with 404 errors when validateProspectOwnership or validateProposalOwnership is called. This affects 20+ server actions across 8 files.

**Affected Files:**
- `apps/web/src/app/(shell)/prospects/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposals/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/contracts/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/scrape-config/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/import/actions.ts`

**Recommendation:** Create `/api/prospects/$prospectId/verify-access` and `/api/proposals/$proposalId/verify-access` route handlers in open-seo-main following the pattern of `/api/workspaces/$workspaceId/membership.ts`.

---

### HIGH-01: Environment Variable Name Inconsistency

**Severity:** HIGH

**Location:**
- `open-seo-main/src/server/lib/aiwriter-api.ts` line 11
- `AI-Writer/backend/services/auto_publish_executor.py` line 54

**Issue:** Environment variable naming is inconsistent between services:
- `open-seo-main` uses: `AI_WRITER_URL` (with fallback to `AI_WRITER_URL` duplicated - likely a bug)
- `AI-Writer` uses: `OPEN_SEO_API_URL`
- `apps/web` uses: `AI_WRITER_URL` and `OPEN_SEO_URL`

**Code Snippet (aiwriter-api.ts:10-11):**
```typescript
const AI_WRITER_URL =
  process.env.AI_WRITER_URL || process.env.AI_WRITER_URL || "http://localhost:8000";
```

This line has a duplicate fallback to the same variable (bug).

**Impact:** Configuration confusion, potential runtime failures if wrong env vars are set, and the duplicate fallback is dead code.

**Recommendation:** Standardize to `AI_WRITER_URL` and `OPEN_SEO_URL` across all services and fix the duplicate fallback bug.

---

### HIGH-02: Missing Authentication on open-seo-main to AI-Writer Calls

**Severity:** HIGH

**Location:** `open-seo-main/src/server/features/briefs/services/AIWriterClient.ts` lines 70-75

**Issue:** The AIWriterClient makes calls to AI-Writer API endpoints without any authentication headers (Bearer token or internal API key).

**Code Snippet:**
```typescript
const response = await fetch(`${AI_WRITER_API}/api/articles`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
});
```

**Impact:** If AI-Writer enforces authentication (which it should), these calls will fail with 401. If AI-Writer accepts unauthenticated calls, this is a security vulnerability.

**Recommendation:** Add `X-Internal-Api-Key` header for service-to-service authentication, matching the pattern in `AI-Writer/backend/api/internal.py`.

---

### HIGH-03: Direct Database Access Bypassing API Layer

**Severity:** HIGH

**Location:** `open-seo-main/src/server/lib/alwrity-db.ts` lines 1-28

**Issue:** open-seo-main directly connects to AI-Writer's PostgreSQL database (`alwrity`) for client validation instead of using the API layer.

**Code Snippet:**
```typescript
export const alwrityPool = new Pool({
  connectionString,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});
```

Used in `client-context.ts` line 71:
```typescript
const { rows } = await alwrityPool.query<{ id: string }>(
  "SELECT id FROM clients WHERE id = $1 AND is_archived = false LIMIT 1",
  [candidate],
);
```

**Impact:**
- Tight coupling between services that should be decoupled
- Schema changes in AI-Writer can break open-seo-main without API versioning
- Cannot independently deploy or scale services
- Bypasses business logic that may exist in API layer

**Recommendation:** Create an internal API endpoint in AI-Writer for client validation and use HTTP calls instead of direct database access.

---

### MEDIUM-01: Circuit Breaker Not Applied to Direct Cross-Service Calls

**Severity:** MEDIUM

**Location:**
- `AI-Writer/backend/services/auto_publish_executor.py` lines 40-103
- `AI-Writer/backend/services/intelligence/autonomous_pipeline.py`

**Issue:** While `apps/web` uses circuit breakers for all cross-service calls via `server-fetch.ts`, direct calls from AI-Writer to open-seo-main in `auto_publish_executor.py` use basic error handling without circuit breaker protection.

**Code Snippet (auto_publish_executor.py:62-73):**
```python
client = await get_client()
response = await client.post(
    f"{open_seo_url}/api/seo/links/graph/update",
    json={
        "clientId": client_id,
        "url": url,
        "html": html,
    },
    timeout=30.0,
)
response.raise_for_status()
```

**Impact:** If open-seo-main is down, repeated failures can cause cascading issues. The `autonomous_pipeline.py` has a circuit breaker, but `auto_publish_executor.py` does not.

**Recommendation:** Apply consistent circuit breaker pattern to all cross-service calls in AI-Writer.

---

### MEDIUM-02: Inconsistent client_id Validation Between Services

**Severity:** MEDIUM

**Location:**
- `open-seo-main/src/server/lib/client-context.ts` - validates via direct DB query
- `apps/web/src/lib/auth/action-auth.ts` - validates via AI-Writer HTTP API
- `AI-Writer/backend/api/clients.py` - validates in endpoint handler

**Issue:** Each service implements client_id validation differently:
1. open-seo-main: Direct query to `alwrity` database for existence check
2. apps/web: HTTP call to AI-Writer `/api/clients/{id}/verify-access`
3. AI-Writer: In-request validation via `require_client_access` middleware

**Impact:** Inconsistent security boundaries and potential for state drift. If AI-Writer's client access model changes, open-seo-main won't be aware.

**Recommendation:** Centralize client validation in AI-Writer and have all services call that API.

---

### MEDIUM-03: WebSocket Routing Inconsistency

**Severity:** MEDIUM

**Location:** `docker/nginx/nginx.conf` lines 134-146 and 313-325

**Issue:** The nginx config routes WebSocket connections to open-seo:3003 from both `app.openseo.so` AND `seowith.tevero.lt`. This means apps/web users on `seowith.tevero.lt` get WebSocket connections to open-seo-main directly.

**Code Snippet (nginx.conf:313-325):**
```nginx
# WebSocket endpoint - proxied to open-seo WebSocket server
location /ws/ {
    proxy_pass http://open-seo:3003;
    ...
}
```

**Impact:** WebSocket connections from apps/web bypass the apps/web Next.js server and go directly to open-seo-main. This may be intentional, but authentication/authorization context from Clerk may not be properly forwarded.

**Recommendation:** Document this architecture decision or route WebSocket through apps/web if Clerk context is needed.

---

### LOW-01: Missing Error Normalization in Direct Service Calls

**Severity:** LOW

**Location:** `open-seo-main/src/server/features/briefs/services/AIWriterClient.ts` lines 77-85

**Issue:** Error responses from AI-Writer are not normalized to match open-seo-main's error format.

**Code Snippet:**
```typescript
if (!response.ok) {
  const errorText = await response.text();
  log.error(
    "AI-Writer article creation failed",
    new Error(errorText),
    { status: response.status }
  );
  throw new AppError("INTERNAL_ERROR", `AI-Writer article creation failed: ${response.status}`);
}
```

**Impact:** Error context from AI-Writer (validation errors, field-level messages) is lost.

**Recommendation:** Parse AI-Writer error responses (which follow FastAPI format with `detail`) and include meaningful information in the thrown error.

---

### LOW-02: Internal Service Token Different from Internal API Key

**Severity:** LOW

**Location:**
- `open-seo-main/src/server/lib/client-context.ts` line 87 - uses `x-internal-service-token`
- `open-seo-main/src/server/lib/aiwriter-api.ts` line 55 - uses `X-Internal-Api-Key`
- `AI-Writer/backend/api/internal.py` line 45 - expects `X-Internal-Api-Key`

**Issue:** Two different header names are used for internal service authentication:
- `x-internal-service-token` (from env `INTERNAL_SERVICE_TOKEN`)
- `X-Internal-Api-Key` (from env `INTERNAL_API_KEY`)

**Impact:** Configuration complexity and potential confusion about which key to use where.

**Recommendation:** Standardize on a single header name and environment variable for internal service authentication.

---

## Architecture Diagram

```
                      +------------------+
                      |     nginx        |
                      | (SSL termination)|
                      +--------+---------+
                               |
        +----------------------+----------------------+
        |                      |                      |
        v                      v                      v
+---------------+     +----------------+     +----------------+
|   apps/web    |     | open-seo-main  |     |   AI-Writer    |
|  (Next.js)    |     | (TanStack)     |     |   (FastAPI)    |
|   port 3002   |     |   port 3001    |     |    port 8000   |
+-------+-------+     +-------+--------+     +--------+-------+
        |                     |                       |
        |  HTTP/Bearer token  |                       |
        +-------------------->|                       |
        |                     |                       |
        |  HTTP/Bearer token  |                       |
        +------------------------------------------>  |
        |                     |                       |
        |                     | Direct DB connection  |
        |                     | (alwrity database)    |
        |                     +---------------------->|
        |                     |                       |
        |                     | HTTP/X-Internal-Api-Key
        |                     +---------------------->|
        |                     |                       |
        |                     |<--- HTTP/No Auth ---+ |
        |                     |     AIWriterClient   |
        |                     +---------------------->|
        |                     |                       |
+-------v-----------------+   |                       |
| Circuit Breakers:       |   |                       |
| - AI_WRITER_BREAKER     |   |                       |
| - OPEN_SEO_BREAKER      |   |                       |
| - VOICE_API_BREAKER     |   |                       |
+-------------------------+   |                       |
                              |                       |
                       +------v------+         +------v------+
                       | PostgreSQL  |         | PostgreSQL  |
                       |  open_seo   |         |   alwrity   |
                       +-------------+         +-------------+
```

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 1 | Missing verify-access endpoints for prospects/proposals |
| HIGH | 3 | Env var inconsistency, missing auth on AIWriterClient, direct DB access |
| MEDIUM | 3 | No circuit breaker in auto_publish, validation inconsistency, WebSocket routing |
| LOW | 2 | Error normalization, token header naming |

---

## Key Integration Strengths

1. Well-designed `server-fetch.ts` with retry logic, circuit breakers, and error normalization
2. Environment validation at startup in apps/web prevents misconfiguration
3. Rate limiting and security headers properly configured in nginx
4. Clerk token propagation implemented via `buildServiceHeaders()`
5. Consistent use of correlation IDs for distributed tracing
6. Workspace membership endpoint exists and is properly implemented

---

## Priority Fixes

1. **CRITICAL-01:** Create missing verify-access endpoints (breaks all prospect/proposal features)
2. **HIGH-02:** Add authentication to AIWriterClient calls
3. **HIGH-03:** Replace direct DB access with API calls for client validation
4. **HIGH-01:** Fix duplicate env var fallback bug in aiwriter-api.ts
