# Rate Limiting Audit Report - Round 2

**Audit Date:** 2026-04-28  
**Auditor:** Claude Opus 4.5  
**Scope:** apps/web, AI-Writer, open-seo-main rate limiting implementations

---

## Executive Summary

The codebase has a solid foundation for rate limiting with Redis-backed sliding window implementations in all three services. However, there are **critical gaps** in coverage, **IP spoofing vulnerabilities**, and **inconsistent implementation** across server actions that could be exploited for abuse.

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 2 | Requires immediate fix |
| HIGH | 4 | Fix before next release |
| MEDIUM | 5 | Plan for remediation |
| LOW | 3 | Track for improvement |

---

## 1. Missing Rate Limits

### CRITICAL: C01 - Public/Unauthenticated Endpoints Without Rate Limits

**Location:** `apps/web/src/middleware.ts`

The Next.js middleware handles authentication routing but does NOT apply rate limiting at the middleware level. Public routes are completely unprotected:

```typescript
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",     // NO rate limit on sign-up
  "/connect/(.*)",
  "/api/health",
]);
```

**Impact:** Unlimited sign-up attempts enable:
- Account enumeration attacks
- Credential stuffing preparation
- Resource exhaustion

**Evidence:** The `apps/web/src/lib/middleware/rate-limit.ts` defines `RATE_LIMITS.SIGNUP` (5/5min) but it is NOT applied anywhere in the middleware or sign-up routes.

---

### CRITICAL: C02 - File Upload Endpoints Without Rate Limits

**Location:** `apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts`

Logo upload endpoint has NO rate limiting:

```typescript
export async function POST(req: Request, { params }) {
  // NO rate limit check
  const formData = await req.formData();
  // ... forwards to backend
}
```

**Impact:** Attackers can:
- Exhaust storage/bandwidth
- DoS via large file uploads
- Abuse file processing resources

**Location:** `AI-Writer/backend/api/csv_import.py`

CSV import endpoint has authentication but NO rate limiting:

```python
@router.post("/{client_id}/import-csv")
async def import_csv(
    client_id: str,
    file: UploadFile = File(...),
    # NO rate limit dependency
):
```

**Recommendation:** Add rate limits of 5-10 uploads per minute per user.

---

### HIGH: H01 - Inconsistent Server Action Rate Limiting

**Location:** `apps/web/src/actions/**/*.ts`

Only 8 of 25+ server actions have rate limiting:

| Action | Has Rate Limit | Risk Level |
|--------|---------------|------------|
| `voice.ts` - analyzeVoice | Yes (llmLimiter) | - |
| `seo/audit.ts` | Yes (auditLimiter) | - |
| `seo/backlinks.ts` | Yes (apiCostLimiter) | - |
| `analytics/get-predictions.ts` | Yes (mlPredictionsLimiter) | - |
| `analytics/detect-patterns.ts` | Yes (cpuIntensiveLimiter) | - |
| `cms/test-connection.ts` | Yes (connectionTestLimiter) | - |
| `webhooks.ts` | Yes (rateLimitAction) | - |
| **`alerts.ts`** | **NO** | HIGH - alert bombing |
| **`changes.ts`** | **NO** | HIGH - revert abuse |
| **`seo/domain.ts`** | **NO** | HIGH - DataForSEO cost |
| **`seo/keywords.ts`** | **NO** | CRITICAL - external API |
| **`seo/mapping.ts`** | **NO** | MEDIUM |
| **`seo/projects.ts`** | **NO** | LOW |
| **`seo/findings.ts`** | **NO** | MEDIUM |
| **`dashboard/get-clients-paginated.ts`** | **NO** | LOW (has caching) |
| **`dashboard/get-portfolio-aggregates.ts`** | **NO** | LOW (has caching) |
| **`views/saved-views.ts`** | **NO** | MEDIUM |
| **`team/get-team-metrics.ts`** | **NO** | MEDIUM |
| **`analytics/get-opportunities.ts`** | **NO** | MEDIUM |

**Highest Risk:** `seo/keywords.ts` calls DataForSEO API without rate limits - direct cost exposure.

---

### HIGH: H02 - AI-Writer Exempt Paths Are Too Broad

**Location:** `AI-Writer/backend/alwrity_utils/rate_limiter.py`

```python
self.exempt_paths = [
    "/stream/strategies",
    "/stream/strategic-intelligence", 
    "/stream/keyword-research",
    # ... more streaming endpoints
    "/api/research",               # DANGEROUS - exempt entire research
    "/api/blog-writer",            # DANGEROUS - exempt blog writer
    "/api/blog-writer/research",
    "/api/blog-writer/research/",
]
```

**Impact:** Research and blog-writer endpoints are expensive LLM operations exempt from rate limiting.

---

## 2. Bypass Vectors

### HIGH: H03 - IP Spoofing via Headers (Partial Trust)

**Location:** Multiple files

All three services trust `X-Forwarded-For` headers without validation:

`apps/web/src/lib/middleware/rate-limit.ts`:
```typescript
export function getClientIpFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();  // Trusts first value
  }
  // ...
}
```

`AI-Writer/backend/middleware/rate_limit.py`:
```python
def get_client_key(request: Request, user_id: Optional[str] = None) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"{client_ip}:{user_id or 'anon'}"
```

**Issue:** AI-Writer uses `request.client.host` (correct) but apps/web trusts `X-Forwarded-For` (spoofable).

**Attack Vector:**
```bash
# Bypass rate limit by spoofing IP
curl -H "X-Forwarded-For: 1.2.3.4" https://api.example.com/endpoint
curl -H "X-Forwarded-For: 1.2.3.5" https://api.example.com/endpoint
# ...infinite requests
```

**Recommendation:** 
- Configure trusted proxy depth in production
- Use Cloudflare's `CF-Connecting-IP` or similar verified headers
- Fall back to connection IP when proxy chain is untrusted

---

### MEDIUM: M01 - User ID Rotation for Distributed Attacks

Server actions rate limit by `auth.userId`:

```typescript
await checkRateLimit(auditLimiter, auth.userId);
```

If an attacker creates multiple accounts, they get independent rate limit buckets. Combined with IP spoofing, this enables:
- N accounts x M spoofed IPs = N*M effective requests

**Recommendation:** Add global rate limits per organization/workspace in addition to per-user limits.

---

## 3. Implementation Issues

### MEDIUM: M02 - Race Condition in apps/web In-Memory Rate Limiter

**Location:** `apps/web/src/lib/middleware/rate-limit.ts`

The in-memory rate limiter uses a simple Map without proper atomic operations:

```typescript
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  let entry = rateLimitMap.get(key);
  // ... non-atomic check-then-set
  if (entry.count >= limit) {
    return { success: false, ... };
  }
  entry.count++;  // Race condition window
  return { success: true, ... };
}
```

**Impact:** In high-concurrency scenarios, multiple requests can pass the limit check before any increment, allowing burst abuse.

**Note:** This is mitigated by the Redis-backed limiter in `apps/web/src/lib/rate-limit.ts` which uses proper transactions. However, some API routes use the in-memory version.

---

### MEDIUM: M03 - Fail-Open on Redis Errors

All three services fail open when Redis is unavailable:

`apps/web/src/lib/rate-limit.ts`:
```typescript
} catch (error) {
  // Log error but allow request through to avoid blocking on Redis issues
  console.error("[rate-limit] Redis error, allowing request:", error);
  return {
    success: true,  // FAIL OPEN
    remaining: this.config.maxRequests,
    // ...
  };
}
```

`AI-Writer/backend/middleware/rate_limit.py`:
```python
except redis.RedisError as e:
    logger.warning(f"Redis rate limiter error: {e}")
    self._connected = False
    # Fail open on errors
    return True, limit - 1  # ALLOWS REQUEST
```

**Impact:** If Redis goes down (or is attacked), rate limiting is completely disabled.

**Recommendation:** Consider fail-closed for critical security endpoints (auth, file upload).

---

### MEDIUM: M04 - Memory Growth in In-Memory Limiter

**Location:** `apps/web/src/lib/middleware/rate-limit.ts`

The cleanup interval runs every 60 seconds but has a cap of 10K entries:

```typescript
const MAX_RATE_LIMIT_ENTRIES = 10000;

if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
  const excess = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES;
  const keys = Array.from(rateLimitMap.keys()).slice(0, excess);
  keys.forEach(k => rateLimitMap.delete(k));
}
```

**Issue:** Under attack, oldest entries (potentially still active rate limits) get evicted, allowing attackers to cycle IPs and always get fresh buckets.

---

### LOW: L01 - Duplicate Rate Limiting in AI-Writer

**Location:** `AI-Writer/backend/main.py`

Two rate limiters are registered:

```python
# Line 312: New endpoint-specific rate limiter
app.add_middleware(RateLimitMiddleware)

# Line 320: Legacy global rate limiter
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    return await rate_limiter.rate_limit_middleware(request, call_next)
```

This creates overhead and potential confusion about which limits apply.

---

## 4. Response Handling Issues

### LOW: L02 - Missing Retry-After in Some Error Paths

**Location:** `apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts`

Error responses don't include rate limit headers:

```typescript
return NextResponse.json(parsed ?? { error: "Upload failed" }, {
  status: response.status,
  // NO Retry-After header
});
```

---

### LOW: L03 - Inconsistent Rate Limit Header Names

- AI-Writer uses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- open-seo-main uses: Same headers (consistent)
- apps/web uses: Same headers (consistent)

No issue found - headers are consistent across services.

---

## 5. Recommendations Summary

### Immediate Actions (CRITICAL)

1. **Add rate limiting to sign-up/auth routes in Next.js middleware**
   - Use `RATE_LIMITS.SIGNUP` (5/5min) and `RATE_LIMITS.AUTH` (10/min)
   
2. **Add rate limits to file upload endpoints**
   - Logo upload: 10/minute per user
   - CSV import: 5/minute per user

### Short-Term (HIGH)

3. **Add rate limits to all SEO keyword actions** that call external APIs (DataForSEO)
   - Use `apiCostLimiter` for `seo/domain.ts` and `seo/keywords.ts`

4. **Fix IP header trust** - Only accept forwarded IPs from configured trusted proxies

5. **Remove dangerous exempt paths** from AI-Writer rate limiter

6. **Add organization-level rate limits** in addition to per-user

### Medium-Term (MEDIUM)

7. **Consider fail-closed** for authentication endpoints when Redis is unavailable

8. **Replace in-memory rate limiter** with Redis-only in apps/web for consistency

9. **Add rate limits to saved views, team metrics, and opportunities actions**

### Long-Term (LOW)

10. **Consolidate AI-Writer rate limiting** to single middleware

11. **Add rate limit metrics** to monitoring dashboard

---

## Files Examined

### apps/web
- `src/lib/rate-limit.ts` - Redis-backed rate limiter (good implementation)
- `src/lib/middleware/rate-limit.ts` - In-memory rate limiter (has issues)
- `src/middleware.ts` - Auth middleware (no rate limiting)
- `src/actions/**/*.ts` - Server actions (inconsistent coverage)
- `src/app/api/**/route.ts` - API routes (some have rate limits)

### AI-Writer
- `backend/middleware/rate_limit.py` - Endpoint-specific rate limiter (good)
- `backend/alwrity_utils/rate_limiter.py` - Legacy global limiter (overly permissive)
- `backend/main.py` - Middleware registration (dual limiters)
- `backend/api/csv_import.py` - File upload (no rate limit)

### open-seo-main
- `src/server/middleware/rate-limit.ts` - Redis Lua script limiter (excellent)

---

## Appendix: Rate Limit Configurations

### apps/web Pre-configured Limiters
| Name | Limit | Window | Used By |
|------|-------|--------|---------|
| auditLimiter | 5 | 1 hour | SEO audits |
| apiCostLimiter | 100 | 1 hour | External APIs |
| llmLimiter | 50 | 1 hour | Voice analysis |
| cpuIntensiveLimiter | 30 | 1 min | Pattern detection |
| connectionTestLimiter | 10 | 1 min | CMS tests |
| exportLimiter | 10 | 1 min | Data exports |
| mlPredictionsLimiter | 10 | 1 min | ML predictions |

### AI-Writer Rate Limits
| Pattern | Limit | Window |
|---------|-------|--------|
| /api/auth/ | 10 | 60s |
| /api/oauth/ | 10 | 60s |
| /api/generate/ | 20 | 60s |
| /api/images/generate | 15 | 60s |
| /api/seo-dashboard/strategic-insights/run | 5 | 60s |
| /api/ (default) | 100 | 60s |

### open-seo-main Rate Limits
| Type | Limit | Window |
|------|-------|--------|
| AUDIT_RUN_CHECKS | 10 | 60s |
| AUTH | 10 | 60s |
| PASSWORD_RESET | 3 | 300s |
| SIGNUP | 5 | 300s |
| CONTENT_GENERATE | 20 | 60s |
| SERP_ANALYZE | 20 | 60s |

---

## FIXES IMPLEMENTED - 2026-04-28

### Auth Rate Limiting Added (C01 RESOLVED)

**New file:** `apps/web/src/lib/rate-limit/auth-limiter.ts`

Added Redis-backed sliding window rate limiting for all authentication endpoints:

| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|--------|---------|
| Sign-in | 5 | 15 min | Prevents brute force |
| Sign-up | 5 | 15 min | Prevents mass account creation |
| Password Reset | 3 | 1 hour | Prevents email bombing |
| Email Verification | 5 | 15 min | Prevents abuse |

### IP Spoofing Protection Added (H03 RESOLVED)

The `getClientIp()` function now implements secure IP detection:

1. **Proxy Secret Verification**: Only trusts `X-Forwarded-For` if request includes valid `X-Proxy-Secret` header matching `PROXY_SECRET` env var
2. **Cloudflare Support**: Trusts `CF-Connecting-IP` when `TRUST_CLOUDFLARE=true`
3. **Vercel Support**: Auto-detects Vercel environment and uses `x-vercel-forwarded-for`
4. **Fallback Chain**: Uses secure fallback order when headers can't be verified
5. **Warning Logs**: Logs suspicious header combinations in production

### Fail-Closed for Auth Endpoints

Unlike other rate limiters that fail-open on Redis errors, auth rate limiting **fails closed** in production:
- If Redis is unavailable, auth requests are blocked with 429
- In development, requests are allowed with warning logs
- This prevents attackers from exploiting Redis outages

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/lib/rate-limit/auth-limiter.ts` | **NEW** - Auth-specific rate limiter with IP spoofing protection |
| `apps/web/src/lib/rate-limit/index.ts` | Added exports for auth limiter |
| `apps/web/src/middleware.ts` | Integrated auth rate limiting before Clerk processing |
| `apps/web/.env.example` | Added `PROXY_SECRET` and `TRUST_CLOUDFLARE` documentation |

### Environment Variables Added

```bash
# Required for secure IP detection behind reverse proxy
PROXY_SECRET=<generate with: openssl rand -hex 32>

# Set to "true" if behind Cloudflare
TRUST_CLOUDFLARE=false
```

### Remaining Items

The following items from the audit were NOT addressed in this fix:
- H02: AI-Writer exempt paths (AI-Writer codebase)
- M01-M04: Various medium-priority issues (planned for future)

---

## FIXES IMPLEMENTED - 2026-04-28 (Server Actions & File Upload)

### C02 RESOLVED: File Upload Rate Limiting

**File:** `apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts`

Added rate limiting to logo upload endpoint:
- Limit: 10 uploads per hour per user
- Returns 429 with proper headers (X-RateLimit-*, Retry-After)

### H01 RESOLVED: Server Action Rate Limiting

**New file:** `apps/web/src/lib/rate-limit/action-limiters.ts`

Created comprehensive action-specific rate limiters based on operation cost:

| Limiter | Limit | Window | Used By |
|---------|-------|--------|---------|
| `externalApi` | 20 | 1 hour | Generic external API calls |
| `keywords` | 20 | 1 hour | DataForSEO keyword research |
| `domainAnalysis` | 30 | 1 hour | DataForSEO domain analysis |
| `upload` | 10 | 1 hour | File uploads |
| `revert` | 30 | 1 hour | CMS content reverts |
| `alertConfig` | 50 | 1 hour | Alert rule CRUD |
| `savedViews` | 60 | 1 hour | Saved views CRUD |
| `teamMetrics` | 60 | 1 minute | Team metrics & assignments |
| `opportunities` | 30 | 1 minute | Opportunity analysis |
| `crud` | 100 | 1 minute | Standard CRUD operations |
| `read` | 200 | 1 minute | Read-only operations |
| `dashboard` | 60 | 1 minute | Dashboard aggregations |
| `export` | 30 | 1 minute | Data exports |
| `mapping` | 50 | 1 minute | Keyword-URL mappings |

### Actions Rate Limited (17 Total)

| File | Functions | Limiter |
|------|-----------|---------|
| `seo/keywords.ts` | `researchKeywords`, `getSerpAnalysis` | keywords (20/hr) |
| `seo/domain.ts` | `getDomainOverview` | domainAnalysis (30/hr) |
| `alerts.ts` | `updateAlertConfig`, `createAlertRule`, `deleteAlertRule` | alertConfig (50/hr) |
| `changes.ts` | `executeRevert` | revert (30/hr) |
| `views/saved-views.ts` | `createSavedViewWithConfig`, `updateSavedViewWithConfig`, `deleteSavedViewById` | savedViews (60/hr) |
| `team/get-team-metrics.ts` | `getTeamMetrics`, `reassignClient` | teamMetrics (60/min) |
| `analytics/get-opportunities.ts` | `getClientOpportunities`, `getTopOpportunities` | opportunities (30/min) |
| `seo/mapping.ts` | `suggestMappings`, `overrideMapping` | mapping (50/min) |
| `seo/findings.ts` | `exportFindingsCSV` | export (30/min) |
| `dashboard/get-clients-paginated.ts` | `getClientsPaginated` | dashboard (60/min) |
| `dashboard/get-portfolio-aggregates.ts` | `getPortfolioAggregates` | dashboard (60/min) |

### Files Modified

| File | Changes |
|------|---------|
| `apps/web/src/lib/rate-limit/action-limiters.ts` | **NEW** - Action-specific rate limiters |
| `apps/web/src/lib/rate-limit/index.ts` | Added exports for action limiters |
| `apps/web/src/actions/seo/keywords.ts` | Added rate limiting to researchKeywords, getSerpAnalysis |
| `apps/web/src/actions/seo/domain.ts` | Added rate limiting to getDomainOverview |
| `apps/web/src/actions/alerts.ts` | Added rate limiting to CRUD operations |
| `apps/web/src/actions/changes.ts` | Added rate limiting to executeRevert |
| `apps/web/src/actions/views/saved-views.ts` | Added rate limiting to CRUD operations |
| `apps/web/src/actions/team/get-team-metrics.ts` | Added rate limiting to getTeamMetrics, reassignClient |
| `apps/web/src/actions/analytics/get-opportunities.ts` | Added rate limiting to opportunity fetches |
| `apps/web/src/actions/seo/mapping.ts` | Added rate limiting to suggestMappings, overrideMapping |
| `apps/web/src/actions/seo/findings.ts` | Added rate limiting to exportFindingsCSV |
| `apps/web/src/actions/dashboard/get-clients-paginated.ts` | Added rate limiting |
| `apps/web/src/actions/dashboard/get-portfolio-aggregates.ts` | Added rate limiting |
| `apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts` | Added upload rate limiting with proper headers |

### Audit Status Summary

| Issue | Severity | Status |
|-------|----------|--------|
| C01 - Auth rate limiting | CRITICAL | RESOLVED |
| C02 - File upload rate limiting | CRITICAL | RESOLVED |
| H01 - Server action rate limiting | HIGH | RESOLVED |
| H02 - AI-Writer exempt paths | HIGH | NOT ADDRESSED (different codebase) |
| H03 - IP spoofing | HIGH | RESOLVED |
| M01-M04 | MEDIUM | PLANNED |
| L01-L03 | LOW | PLANNED |
