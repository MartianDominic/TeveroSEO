# Configuration Management & Environment Handling Audit

**Date**: 2026-04-28  
**Scope**: Configuration files, environment handling, dev/prod parity  
**Files Examined**: 
- `apps/web/.env.example`, `apps/web/next.config.ts`, `apps/web/src/lib/env.ts`
- `AI-Writer/.env.example`, `AI-Writer/backend/main.py`, `AI-Writer/backend/config/env_validator.py`, `AI-Writer/backend/middleware/auth_middleware.py`
- `open-seo-main/.env.example`, `open-seo-main/src/server.ts`, `open-seo-main/src/server/lib/runtime-env.ts`, `open-seo-main/src/db/index.ts`, `open-seo-main/src/server/lib/redis.ts`
- `docker-compose.vps.yml`, `AI-Writer/docker-compose.yml`, `AI-Writer/docker-compose.vps.yml`

---

## Executive Summary

Configuration management across the TeveroSEO platform is **generally well-implemented** with several security-conscious patterns. All three services (apps/web, AI-Writer, open-seo-main) have environment validation at startup with fail-fast behavior. However, there are **7 findings** requiring attention, including 2 HIGH severity issues.

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 2 |

---

## Findings

### HIGH-1: Timing Attack Vulnerability in Internal API Key Comparison

**Location**: `open-seo-main/src/routes/api/admin/dlq/$jobId.ts:41`

**Issue**: Direct string comparison for INTERNAL_API_KEY validation is vulnerable to timing attacks.

```typescript
function verifyInternalApiKey(request: Request): boolean {
  const apiKey = request.headers.get("X-Internal-Api-Key");
  if (!INTERNAL_API_KEY) {
    dlqLogger.error("INTERNAL_API_KEY not configured");
    return false;
  }
  return apiKey === INTERNAL_API_KEY;  // <-- TIMING VULNERABLE
}
```

**Risk**: Timing attacks can incrementally reveal the API key by measuring response times.

**Contrast**: The parent file `open-seo-main/src/routes/api/admin/dlq.ts` correctly uses `timingSafeEqual`:
```typescript
return timingSafeEqual(apiKeyBuffer, expectedBuffer);
```

And `AI-Writer/backend/api/internal.py` correctly uses `hmac.compare_digest`:
```python
if not hmac.compare_digest(
    x_internal_api_key.encode("utf-8"),
    INTERNAL_API_KEY.encode("utf-8"),
):
```

**Remediation**: Update `$jobId.ts` to use `timingSafeEqual` from Node.js `crypto` module.

---

### HIGH-2: SKIP_ENV_VALIDATION Bypass in apps/web

**Location**: `apps/web/src/lib/env.ts:90-93`

**Issue**: The `SKIP_ENV_VALIDATION=true` flag allows bypassing all environment validation, including security-critical secrets.

```typescript
if (process.env.SKIP_ENV_VALIDATION === 'true') {
  console.warn('[env] Skipping environment validation (SKIP_ENV_VALIDATION=true)');
  return process.env as unknown as Env;  // <-- No validation at all
}
```

**Risk**: 
- If accidentally set in production, app starts without required secrets
- Missing `CLERK_WEBHOOK_SECRET` allows unsigned webhook payloads
- Missing `INTERNAL_API_KEY` disables service-to-service auth

**Remediation**: Either:
1. Remove this flag entirely
2. Only allow during build (not runtime): check `process.env.NODE_ENV !== 'production'`
3. Always validate security-critical vars even when flag is set

---

### MEDIUM-1: Localhost Defaults Can Leak to Production

**Location**: `apps/web/src/lib/env.ts:50-51`

**Issue**: Service URLs default to localhost, which is incorrect for production but passes validation.

```typescript
OPEN_SEO_URL: z.string().url('OPEN_SEO_URL must be a valid URL').default('http://localhost:3001'),
AI_WRITER_URL: z.string().url('AI_WRITER_URL must be a valid URL').default('http://localhost:8000'),
```

**Risk**: If environment variable is unset, requests go to localhost instead of failing fast.

**Remediation**: Make these required in production:
```typescript
OPEN_SEO_URL: z.string().url().refine(
  (val) => process.env.NODE_ENV !== 'production' || !val.includes('localhost'),
  'OPEN_SEO_URL cannot be localhost in production'
),
```

---

### MEDIUM-2: Redis Falls Back to Localhost Without SSL

**Location**: `open-seo-main/src/server/lib/redis.ts:17-30`

**Issue**: In development mode, Redis falls back to localhost without TLS, but there's no validation that production URLs use TLS.

```typescript
function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REDIS_URL environment variable is required in production");
    }
    console.warn("[Redis] REDIS_URL not set, falling back to redis://localhost:6379");
    return "redis://localhost:6379";
  }
  return url;  // <-- No TLS validation in production
}
```

**Risk**: Production Redis traffic could be unencrypted if `rediss://` prefix not enforced.

**Remediation**: Validate TLS for production:
```typescript
if (process.env.NODE_ENV === 'production' && !url.startsWith('rediss://')) {
  throw new Error('Production REDIS_URL must use TLS (rediss://)');
}
```

---

### MEDIUM-3: DISABLE_SUBSCRIPTION Defaulted to True in Production

**Location**: `docker-compose.vps.yml:178, 204`

**Issue**: Subscription enforcement is disabled by default in the production docker-compose.

```yaml
ai-writer-backend:
  environment:
    DISABLE_SUBSCRIPTION: ${DISABLE_SUBSCRIPTION:-true}  # <-- Default true

ai-writer-frontend:
  build:
    args:
      REACT_APP_DISABLE_SUBSCRIPTION: ${REACT_APP_DISABLE_SUBSCRIPTION:-true}  # <-- Default true
```

**Risk**: Billing/subscription checks may be bypassed in production if variable not explicitly set to `false`.

**Remediation**: Change defaults to `false` for production compose file:
```yaml
DISABLE_SUBSCRIPTION: ${DISABLE_SUBSCRIPTION:-false}
```

---

### LOW-1: Inconsistent Environment Variable Naming

**Location**: Multiple files across services

**Issue**: Environment variable naming is inconsistent between services:

| Purpose | apps/web | AI-Writer | open-seo-main |
|---------|----------|-----------|---------------|
| Clerk Key | `CLERK_SECRET_KEY` | `CLERK_SECRET_KEY` | `CLERK_PUBLISHABLE_KEY` (different key!) |
| Environment | `NODE_ENV` | `ENVIRONMENT` / `NODE_ENV` / `APP_ENV` | `NODE_ENV` |
| Debug Mode | N/A | `DEBUG_MODE` | N/A |

AI-Writer's auth middleware tries multiple names:
```python
self.environment = (os.getenv('ENVIRONMENT') or os.getenv('APP_ENV') or 'development').strip().lower()
```

**Risk**: Configuration errors due to naming confusion; debugging difficulty.

**Remediation**: Standardize on one naming convention across all services. Document canonical names in `.env.example` files.

---

### LOW-2: Missing Validation for Optional Security Vars

**Location**: 
- `open-seo-main/.env.example:77` - `IP_SALT` listed but validation only in production
- `open-seo-main/.env.example:69` - `PERSONAL_CODE_SALT` listed as optional

**Issue**: Some security-relevant variables are only validated in production mode, meaning development can run without them.

```typescript
// open-seo-main/src/server.ts:19-22
const isProduction = process.env.NODE_ENV === "production";
const requiredEnvVars = isProduction
  ? [...REQUIRED_ENV_CORE, ...REQUIRED_ENV_SECURITY]  // Security vars only in prod
  : REQUIRED_ENV_CORE;
```

**Risk**: 
- Development environment doesn't mirror production
- IP hashing for GDPR compliance silently skipped in development
- Security bugs only manifest in production

**Remediation**: Consider warning (not failing) for missing security vars in development to encourage parity.

---

## Positive Patterns Observed

### Environment Validation at Startup

All three services implement fail-fast validation:

**AI-Writer** (`config/env_validator.py`):
```python
def validate_env() -> Dict[str, bool]:
    # Validates at startup, exits with sys.exit(1) on failure
    if missing or invalid:
        sys.exit(1)
```

**apps/web** (`lib/env.ts`):
```typescript
function validateEnv(): Env {
  if (!result.success) {
    throw new Error('Invalid environment configuration');
  }
}
```

**open-seo-main** (`server/lib/runtime-env.ts`):
```typescript
export function validateEnv(required: readonly string[]): void {
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
```

### Production-Only Dangerous Config Rejection

AI-Writer explicitly rejects dangerous flags in production (`main.py:157-188`):
```python
def validate_production_config():
    dangerous_flags = {
        "DISABLE_AUTH": "Authentication bypass is not allowed in production",
        "DEBUG_MODE": "Debug mode must be disabled in production",
        "QUALITY_GATE_ENABLED": None,  # Must be true
    }
    for flag, error_msg in dangerous_flags.items():
        if value == "true":
            raise ValueError(f"{flag}=true is not allowed in production")
```

### Auth Bypass Removed

The AI-Writer auth middleware explicitly disables bypass flags (`auth_middleware.py:40-46`):
```python
# SECURITY: DISABLE_AUTH has been removed - authentication is always required
self.disable_auth = False
# SECURITY: Unverified JWT fallback has been removed - always verify signatures
self.allow_unverified_dev = False
```

### Timing-Safe Comparisons (Partial)

Several files correctly use timing-safe comparisons:
- `open-seo-main/src/routes/api/admin/dlq.ts` - uses `timingSafeEqual`
- `open-seo-main/src/server/middleware/webhook-auth.ts` - uses `timingSafeEqual`
- `open-seo-main/src/server/middleware/auth.ts` - uses `timingSafeEqual`
- `AI-Writer/backend/api/internal.py` - uses `hmac.compare_digest`

### Database SSL in Production

Database connections enforce SSL in production (`open-seo-main/src/db/index.ts:45-48`):
```typescript
ssl:
  process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false,
```

---

## Recommendations Summary

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Fix timing attack in `$jobId.ts` internal API key comparison | 15 min |
| P0 | Remove or restrict `SKIP_ENV_VALIDATION` flag | 30 min |
| P1 | Change `DISABLE_SUBSCRIPTION` default to `false` in docker-compose.vps.yml | 5 min |
| P1 | Add localhost rejection for production service URLs | 30 min |
| P2 | Add TLS validation for production Redis URL | 15 min |
| P2 | Standardize environment variable naming conventions | 2-4 hrs |
| P3 | Add development warnings for missing security vars | 1 hr |

---

## Files Changed Since Last Audit

Based on git status, the following config-related files have pending changes:
- `apps/web/.env.example` (M)
- `apps/web/next.config.ts` (M)
- `AI-Writer/backend/main.py` (M)

These should be reviewed to ensure no new configuration issues were introduced.
