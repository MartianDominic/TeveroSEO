### Agent 4: apps/web API Routes & Server Actions

**Status:** Complete
**Scope:** API route handlers, server actions, data fetching patterns, error handling

#### Summary

Reviewed 59 API route files and 45 server action files in `apps/web/src/`. The codebase demonstrates mature patterns for authentication, rate limiting, CSRF protection, and input validation. However, several inconsistencies and gaps exist.

#### Critical Issues

None identified. The codebase has been hardened with comprehensive security measures.

#### High Priority Issues

**H-API-01: Missing Rate Limiting on /api/connections/[id] Routes**
- File: `apps/web/src/app/api/connections/[id]/route.ts`
- Lines: 15-57 (GET), 59-101 (DELETE)
- Issue: Unlike other routes (e.g., `/api/site-connections`, `/api/articles`), these endpoints lack rate limiting. The DELETE operation is particularly sensitive.
- Impact: Potential for abuse via rapid enumeration or deletion attempts.
- Fix: Add `withRateLimit` wrapper or use `checkRateLimit` at the start of handlers.

**H-API-02: Missing CSRF Protection on /api/connections/[id] DELETE**
- File: `apps/web/src/app/api/connections/[id]/route.ts`
- Line: 59
- Issue: DELETE handler does not call `validateCsrf()`. Other state-changing operations (POST, PATCH, DELETE) in the codebase consistently use CSRF protection.
- Impact: Potential CSRF attack vector for connection deletion.
- Fix: Add `const csrfError = validateCsrf(request); if (csrfError) return csrfError;` at handler start.

**H-API-03: Missing Rate Limiting on /api/connections GET (list)**
- File: `apps/web/src/app/api/connections/route.ts`
- Lines: 10-52
- Issue: No rate limiting on the GET endpoint. While GET is safe from CSRF, unprotected listing can lead to enumeration.
- Impact: Potential for connection enumeration via rapid requests.
- Fix: Add rate limiting similar to `/api/site-connections/route.ts`.

**H-API-04: Missing Zod Input Validation on /api/agreements/[agreementId]/sign**
- File: `apps/web/src/app/api/agreements/[agreementId]/sign/route.ts`
- Lines: 36-50
- Issue: Body is parsed with `req.json()` and validated manually (`body.signature.trim().length < 2`), not with Zod schema like other routes.
- Impact: Inconsistent validation, potential for unexpected input formats.
- Fix: Add Zod schema for `SignRequest` type validation.

**H-API-05: Missing Rate Limiting on /api/agreements/[agreementId]/sign**
- File: `apps/web/src/app/api/agreements/[agreementId]/sign/route.ts`
- Lines: 30-117
- Issue: No rate limiting on signature submission endpoint.
- Impact: Potential for signature brute-forcing or abuse.
- Fix: Add rate limiting (suggest `RATE_LIMITS.HEAVY` or custom limit).

#### Medium Priority Issues

**M-API-01: Inconsistent Auth Helper Import**
- File: `apps/web/src/app/api/platform-secrets/status/route.ts`
- Line: 4
- Issue: Imports `requireAuth` from `@/lib/auth` instead of `@/lib/auth/api-auth` like other routes.
- Impact: Potential for inconsistent auth behavior if these modules diverge.
- Fix: Standardize imports to `@/lib/auth/api-auth`.

**M-API-02: Direct Fetch Instead of Server-Fetch Utilities**
- File: `apps/web/src/app/api/connections/[id]/route.ts`
- Lines: 25-33, 69-77
- Issue: Uses raw `fetch()` with manual header construction instead of `getOpenSeo`/`postOpenSeo` utilities that include circuit breakers, retries, and auth token injection.
- Impact: Missing circuit breaker protection, retry logic, and consistent error handling.
- Fix: Refactor to use `getOpenSeo`/`deleteOpenSeo` from `@/lib/server-fetch`.

**M-API-03: Direct Fetch in /api/connections Route**
- File: `apps/web/src/app/api/connections/route.ts`
- Lines: 20-32
- Issue: Same as M-API-02 - uses raw `fetch()` instead of server-fetch utilities.
- Fix: Refactor to use `getOpenSeo` from `@/lib/server-fetch`.

**M-API-04: Inconsistent Error Response Format**
- Files: Multiple routes use slightly different error formats
- Examples:
  - `{ error: "message" }` (most routes)
  - `{ error: "message", details: [...] }` (validation errors)
  - `{ success: false, error: "message" }` (agreements/sign)
- Impact: Frontend must handle multiple error formats.
- Fix: Standardize on `{ error: string, code?: string, details?: unknown }` format.

**M-API-05: Missing Token Validation on Public Endpoints**
- File: `apps/web/src/app/api/proposals/beacon/route.ts`
- Lines: 28-70
- Issue: Token parameter is not validated (no UUID check, length limit, or format validation) before forwarding to backend.
- Impact: Potential for injection or malformed requests reaching backend.
- Fix: Add basic token format validation (e.g., UUID check or length limit).

#### API Design Observations

**Good Patterns Observed:**

1. **Consistent Rate Limiting Framework**: Well-designed `RateLimiter` class with Redis-backed distributed limiting, fail-closed in production, fail-open in development.

2. **Comprehensive CSRF Protection**: `validateCsrf()` function checks Origin/Referer headers and is consistently applied to state-changing operations in most routes.

3. **Client Access Verification**: `requireClientAccess()` properly verifies user ownership of client resources via backend API call before allowing operations.

4. **Zod Schema Validation**: Most routes use Zod for input validation with proper error formatting.

5. **Circuit Breakers**: `server-fetch.ts` implements circuit breaker pattern for backend calls with automatic retry on transient errors.

6. **Idempotency Keys**: Server actions like `createAlertRule` and `startAudit` generate idempotency keys to prevent duplicate operations.

7. **IP Spoofing Protection**: Rate limiting middleware validates proxy headers with secrets before trusting X-Forwarded-For.

8. **Sanitized Error Responses**: `FastApiError.sanitizedBody` prevents leaking sensitive backend details to clients.

**Areas for Improvement:**

1. **Response Envelope Inconsistency**: Some routes return raw data, others wrap in `{ data: ... }` or `{ connections: [...] }`. Consider standardizing.

2. **Status Code Usage**: Most routes use appropriate codes (201 for create, 202 for async, 204 for delete), but some return 200 for everything.

3. **Missing OpenAPI/Documentation**: No API documentation generation observed. Consider adding swagger-jsdoc or similar.

#### Error Handling Audit

**Strengths:**
- All routes use try-catch blocks
- `AuthError` and `FastApiError` are handled specifically
- Generic errors return 500 with sanitized message
- Rate limit errors include Retry-After headers

**Gaps:**
- Some routes log errors to console in production (should use structured logging)
- No correlation IDs for request tracing
- Some error messages may leak internal structure (e.g., "Failed to fetch prospect metadata")

#### Server Actions Audit

**Files Reviewed:**
- `apps/web/src/actions/alerts.ts` - Well-structured with Zod validation, auth, rate limiting
- `apps/web/src/actions/seo/audit.ts` - Good idempotency key usage, proper rate limiting
- `apps/web/src/app/(shell)/dashboard/actions.ts` - Input validation on all mutations

**Server Action Patterns:**
1. All actions use `"use server"` directive
2. `requireActionAuth()` called at start
3. `validateClientOwnership()` for client-scoped actions
4. Input validation with Zod schemas
5. Rate limiting via `checkActionRateLimit()` or custom limiters

**No Critical Issues in Server Actions.**

#### Files Reviewed

- `/apps/web/src/app/api/health/route.ts`
- `/apps/web/src/app/api/clients/route.ts`
- `/apps/web/src/app/api/articles/route.ts`
- `/apps/web/src/app/api/articles/[articleId]/route.ts`
- `/apps/web/src/app/api/oauth/google/callback/route.ts`
- `/apps/web/src/app/api/oauth/shopify/callback/route.ts`
- `/apps/web/src/app/api/oauth/wix/callback/route.ts`
- `/apps/web/src/app/api/webhooks/clerk/route.ts`
- `/apps/web/src/app/api/proposals/beacon/route.ts`
- `/apps/web/src/app/api/crawl/route.ts`
- `/apps/web/src/app/api/goals/delete/route.ts`
- `/apps/web/src/app/api/agreements/[agreementId]/sign/route.ts`
- `/apps/web/src/app/api/reports/generate/route.ts`
- `/apps/web/src/app/api/site-connections/route.ts`
- `/apps/web/src/app/api/content-calendar/route.ts`
- `/apps/web/src/app/api/connections/route.ts`
- `/apps/web/src/app/api/connections/[id]/route.ts`
- `/apps/web/src/app/api/prospects/[id]/report/route.ts`
- `/apps/web/src/app/api/dashboard/export/route.ts`
- `/apps/web/src/app/api/global-settings/route.ts`
- `/apps/web/src/app/api/platform-secrets/status/route.ts`
- `/apps/web/src/lib/auth/api-auth.ts`
- `/apps/web/src/lib/api/security.ts`
- `/apps/web/src/lib/rate-limit.ts`
- `/apps/web/src/lib/middleware/rate-limit.ts`
- `/apps/web/src/lib/server-fetch.ts`
- `/apps/web/src/actions/alerts.ts`
- `/apps/web/src/actions/seo/audit.ts`
- `/apps/web/src/app/(shell)/dashboard/actions.ts`
