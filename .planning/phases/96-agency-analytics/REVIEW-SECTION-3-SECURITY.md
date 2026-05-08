# Section 3: API Security & Authorization Review

**Phase:** 96 - Agency Analytics
**Reviewer:** Senior Security Engineer
**Audit Date:** 2026-05-08
**Scope:** API routes, middleware, and authorization patterns

---

## 3.1 Route Authorization Matrix

### Summary

| Route | Auth Method | Workspace Validation | Visibility Filtering | Status |
|-------|-------------|---------------------|---------------------|--------|
| `/api/analytics/master` | X-Workspace-ID header | None (trusts header) | None | **CRITICAL** |
| `/api/analytics/portfolio` | X-Workspace-ID header | Service-level | None | **HIGH** |
| `/api/analytics/portfolio/trends` | X-Workspace-ID header | Service-level | None | **HIGH** |
| `/api/analytics/portfolio/top-clients` | X-Workspace-ID header | Service-level | None | **HIGH** |
| `/api/analytics/portfolio/underperforming` | X-Workspace-ID header | Service-level | None | **HIGH** |
| `/api/analytics/portfolio/comparison` | X-Workspace-ID header | Service-level | None | **HIGH** |
| `/api/analytics/tags` | X-Workspace-ID header | None | None | **CRITICAL** |
| `/api/analytics/export/csv` | X-Workspace-ID header | ClientVisibilityService | canExport check | OK |
| `/api/analytics/export/sheets` | X-Workspace-ID header | ClientVisibilityService | canExport check | OK |
| `/api/analytics/visibility/$clientId` | X-Workspace-ID header | ClientVisibilityService | N/A | OK |
| `/api/analytics/branded-split/$clientId` | X-Workspace-ID header | ClientVisibilityService | showQueries filter | OK |
| `/api/analytics/ctr-benchmark/$clientId` | X-Workspace-ID header | ClientVisibilityService | Field-level filter | OK |
| `/api/analytics/trends` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/striking-distance` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/cannibalization` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/annotations` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/topic-clusters` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/topic-clusters/$clusterId` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/content-groups` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/content-groups/$groupId` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/index-coverage` | Placeholder stub | Placeholder stub | None | **CRITICAL** |
| `/api/analytics/sync-health` | **NONE** | **NONE** | None | **CRITICAL** |

### Legend
- **CRITICAL**: Missing or bypassed authentication/authorization
- **HIGH**: Partial implementation, trusts client-supplied headers
- **OK**: Proper validation implemented

---

## 3.2 Input Validation Coverage

### Zod Schema Analysis

| Route | Schema Applied | Validation Quality | Gaps |
|-------|---------------|-------------------|------|
| master.ts | querySchema | Good date format validation | Missing date range limit |
| portfolio.ts | querySchema | Partial - optional fields | No date range limit |
| export.ts | exportSchema, sheetsSchema | Good - required fields | No row limit protection |
| visibility.ts | visibilitySchema | Good - boolean fields | None |
| branded-split.ts | dateRangeSchema | Partial - optional | No date range limit |
| ctr-benchmark.ts | querySchema | Partial | No date range limit |
| trends.ts | querySchema | Good | periodDays max: 90 OK |
| striking-distance.ts | querySchema | Good | limit max: 500 OK |
| cannibalization.ts | querySchema | Good | limit max: 500 OK |
| annotations.ts | getQuerySchema, postBodySchema | Good | None |
| topic-clusters.ts | Multiple schemas | Good | None |
| content-groups.ts | Multiple schemas | Good | None |
| index-coverage.ts | Multiple schemas | Good | batchInspect max: 100 |

### Input Validation Findings

1. **Date Range DoS Vector (MEDIUM)**
   - Routes: `master.ts`, `portfolio.ts`, `branded-split.ts`, `ctr-benchmark.ts`
   - Issue: No maximum date range enforcement
   - Impact: Attacker could request 10+ years of data, causing expensive queries
   - Recommendation: Add `maxDays: 365` constraint

2. **UUID Validation (LOW)**
   - Routes with siteId/clientId params
   - Most use `z.string().uuid()` - Good
   - Some use `z.string()` without UUID validation - Minor

3. **CSV Formula Injection Protection (OK)**
   - `AnalyticsExportService.escapeCsvField()` handles formula triggers: `=`, `+`, `-`, `@`, `\t`, `\r`
   - Implementation prepends single quote - Industry standard practice

---

## 3.3 Security Vulnerabilities Identified

### VULN-01: Insecure Direct Object Reference (IDOR) - X-Workspace-ID Header Trust

**Severity:** CRITICAL (CVSS 9.1)
**Affected Routes:** 10+ routes
**CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)

**Description:**
Multiple routes extract `X-Workspace-ID` from the request header and trust it without validation:
```typescript
// master.ts:44
const workspaceId = request.headers.get('X-Workspace-ID');
```

The header is client-supplied and can be forged. An attacker knowing or guessing a workspace ID can access any workspace's analytics data.

**Proof of Concept:**
```bash
curl -H "X-Workspace-ID: victim-workspace-id" \
  https://api.example.com/api/analytics/master?startDate=2024-01-01&endDate=2024-12-31
```

**Affected Routes:**
- `/api/analytics/master`
- `/api/analytics/portfolio/*` (5 routes)
- `/api/analytics/tags`

**Recommendation:**
1. Use `authenticateRequest()` from `auth.ts` to validate JWT/API key
2. Extract workspace from auth context, not headers
3. Verify user membership via `checkClientAccess()` from `authz.ts`

---

### VULN-02: Placeholder Authentication Stubs (BROKEN AUTH)

**Severity:** CRITICAL (CVSS 9.8)
**Affected Routes:** 9 routes
**CWE:** CWE-306 (Missing Authentication)

**Description:**
Multiple routes use placeholder authentication functions that return hardcoded values:
```typescript
// trends.ts:22-29
async function getWorkspaceIdFromRequest(_request: Request): Promise<string | null> {
  return 'workspace-placeholder';
}

async function verifySiteOwnership(_siteId: string, _workspaceId: string): Promise<boolean> {
  return true;  // ALWAYS GRANTS ACCESS
}
```

These routes are effectively unprotected in production.

**Affected Routes:**
- `/api/analytics/trends`
- `/api/analytics/striking-distance`
- `/api/analytics/cannibalization`
- `/api/analytics/annotations`
- `/api/analytics/topic-clusters` (2 routes)
- `/api/analytics/content-groups` (2 routes)
- `/api/analytics/index-coverage`

**Recommendation:**
1. Replace placeholder functions with actual auth middleware
2. Implement `verifySiteOwnership()` using `ClientVisibilityService.validateWorkspaceAccess()`
3. Remove or gate routes until auth is implemented

---

### VULN-03: Unauthenticated Endpoint (sync-health)

**Severity:** HIGH (CVSS 7.5)
**Affected Routes:** `/api/analytics/sync-health`
**CWE:** CWE-306 (Missing Authentication)

**Description:**
The sync-health endpoint has NO authentication whatsoever:
```typescript
// sync-health.ts:13-61
export const Route = (createFileRoute as any)("/api/analytics/sync-health")({
  loader: async () => {
    // No auth check - direct data access
    const [waiting, active, completed, failed, delayed] = await Promise.all([...]);
```

This exposes:
- Queue statistics (waiting, active, completed, failed, delayed counts)
- Last sync timestamps
- Recent error messages (potential information leak)
- Next scheduled run times

**Recommendation:**
1. Add authentication middleware
2. Consider if this should be admin-only

---

### VULN-04: Cross-Client Data Leakage in Portfolio Aggregation

**Severity:** HIGH (CVSS 7.2)
**Affected Routes:** `/api/analytics/portfolio/*`
**CWE:** CWE-200 (Information Exposure)

**Description:**
Portfolio routes aggregate data across all clients in a workspace. Combined with VULN-01 (header trust), an attacker can:
1. Set `X-Workspace-ID` to any value
2. Retrieve aggregated metrics for all clients in that workspace
3. Get client names, domains, and performance data via `/portfolio/comparison`

**Impact:**
- Competitor intelligence leak
- Client list exposure
- Performance benchmarking data theft

**Recommendation:**
1. Fix VULN-01 first (proper auth)
2. Consider visibility filtering for portfolio aggregations
3. Add rate limiting to prevent enumeration

---

### VULN-05: Missing Rate Limiting

**Severity:** MEDIUM (CVSS 5.3)
**Affected Routes:** All export endpoints, batch operations
**CWE:** CWE-770 (Allocation of Resources Without Limits)

**Description:**
No rate limiting is implemented on:
- CSV export (unlimited rows per request)
- Google Sheets export (unlimited API calls)
- Batch URL inspection (100 URLs per request, unlimited requests)

An attacker could:
1. Exhaust GSC API quotas
2. Generate DoS via large exports
3. Abuse Google Sheets API

**Recommendation:**
1. Implement per-workspace rate limiting (e.g., BullMQ rate limiter)
2. Add per-user export quotas (e.g., 10 exports/hour)
3. Cap maximum rows per export (e.g., 10,000)

---

### VULN-06: OAuth Token Exposure Risk

**Severity:** MEDIUM (CVSS 5.5)
**Affected Routes:** `/api/analytics/export/sheets`
**CWE:** CWE-522 (Insufficiently Protected Credentials)

**Description:**
Google OAuth tokens are passed via header:
```typescript
// export.ts:214
const oauthToken = request.headers.get("X-Google-OAuth-Token");
```

Concerns:
1. Token transmitted in request header (logged in some proxies)
2. No token validation before use
3. Token could be reused across requests

**Recommendation:**
1. Use server-side token storage (encrypted in DB)
2. Exchange short-lived tokens via backend
3. Never pass tokens through client-supplied headers

---

### VULN-07: Error Message Information Leakage

**Severity:** LOW (CVSS 3.7)
**Affected Routes:** All error handlers
**CWE:** CWE-209 (Information Exposure Through Error Message)

**Description:**
Error responses include `error.message` which may leak internal details:
```typescript
// master.ts:76
error: error instanceof Error ? error.message : 'Internal server error',
```

Database errors, file paths, and internal logic could be exposed.

**Recommendation:**
1. Use generic error messages for 500s
2. Log detailed errors server-side only
3. Implement error code mapping

---

## 3.4 Security Recommendations

### Priority 1: Critical (Fix Before Production)

| # | Issue | Route(s) | Action | Effort |
|---|-------|----------|--------|--------|
| 1.1 | Replace placeholder auth stubs | 9 routes | Implement real auth using `authenticateRequest()` + `checkClientAccess()` | 2-3 days |
| 1.2 | Fix IDOR via X-Workspace-ID | 7 routes | Extract workspace from auth context, not headers | 1 day |
| 1.3 | Add auth to sync-health | sync-health.ts | Wrap in `requireUnifiedAuth()` | 2 hours |

### Priority 2: High (Fix Within Sprint)

| # | Issue | Route(s) | Action | Effort |
|---|-------|----------|--------|--------|
| 2.1 | Implement rate limiting | All | Add Redis-based rate limiter middleware | 2 days |
| 2.2 | Add date range limits | 4 routes | Add `z.refine()` for max 365-day range | 4 hours |
| 2.3 | Server-side OAuth tokens | export/sheets | Store tokens in DB, exchange on backend | 1 day |

### Priority 3: Medium (Address in Next Phase)

| # | Issue | Route(s) | Action | Effort |
|---|-------|----------|--------|--------|
| 3.1 | Visibility filtering for portfolio | portfolio/* | Apply ClientVisibilityService to aggregations | 1 day |
| 3.2 | Sanitize error messages | All | Create error code mapping, remove stack traces | 4 hours |
| 3.3 | Add export quotas | export/* | Track exports per user, enforce limits | 1 day |

---

## 3.5 Positive Security Findings

### Good Practices Observed

1. **ClientVisibilityService Architecture (export.ts, visibility.ts, branded-split.ts, ctr-benchmark.ts)**
   - Proper workspace validation: `validateWorkspaceAccess(clientId, workspaceId)`
   - Field-level filtering based on visibility config
   - Export permission check: `canExport` flag

2. **CSV Formula Injection Protection (AnalyticsExportService.ts)**
   - Handles all standard formula triggers
   - Proper escaping of quotes and newlines

3. **Zod Schema Validation**
   - Good coverage of required parameters
   - UUID validation on most ID fields
   - Enum constraints on status/severity fields

4. **Existing Auth Infrastructure (auth.ts, authz.ts)**
   - Comprehensive API key validation with timing-safe comparison
   - JWT support via Clerk
   - Redis-cached authorization checks
   - Audit logging for security events

5. **Repository Pattern**
   - SQL injection prevention via Drizzle ORM
   - Parameterized queries throughout

---

## 3.6 Token Security Assessment

### GSC OAuth Token Handling

**Current State:**
- Tokens stored in `clients.gscRefreshToken` column
- No evidence of encryption at rest in schema
- Tokens passed via headers for Sheets export

**Recommendations:**
1. Encrypt refresh tokens at rest using `TokenEncryption` service (found at `/src/server/features/platform-oauth/`)
2. Implement token rotation on use
3. Add token refresh handling in `GscBridgeService`

### Session Security

**Current State:**
- JWT validation via Clerk JWKS
- API keys hashed with SHA-256 before storage
- Timing-safe comparison implemented

**Finding:** Session security is well-implemented.

---

## 3.7 OWASP Top 10 Alignment

| OWASP Category | Status | Notes |
|----------------|--------|-------|
| A01:2021 Broken Access Control | **FAIL** | IDOR via headers, placeholder auth |
| A02:2021 Cryptographic Failures | PASS | Proper key hashing, JWT validation |
| A03:2021 Injection | PASS | Drizzle ORM prevents SQLi |
| A04:2021 Insecure Design | **PARTIAL** | Good patterns exist but not applied everywhere |
| A05:2021 Security Misconfiguration | PASS | No obvious misconfigs |
| A06:2021 Vulnerable Components | UNKNOWN | Requires dependency audit |
| A07:2021 Auth Failures | **FAIL** | Placeholder stubs, missing auth |
| A08:2021 Software/Data Integrity | PASS | No evidence of issues |
| A09:2021 Logging/Monitoring | PASS | Audit logging present |
| A10:2021 SSRF | LOW RISK | Limited external URL handling |

---

## Summary

**Overall Security Posture:** HIGH RISK

The Phase 96 analytics API has significant authorization gaps:
- 10+ routes with CRITICAL auth issues
- Placeholder stubs returning `true` for all access checks
- Client-supplied `X-Workspace-ID` header trusted without validation

The good news: proper auth infrastructure (`auth.ts`, `authz.ts`, `ClientVisibilityService`) already exists. The implementation just needs to be applied consistently across all routes.

**Recommended Next Steps:**
1. Create a shared auth middleware for analytics routes
2. Replace all placeholder functions
3. Add comprehensive integration tests for auth flows
4. Conduct penetration testing before production deployment

---

*Document generated by Security Review Agent*
*Classification: Internal - Security Sensitive*
