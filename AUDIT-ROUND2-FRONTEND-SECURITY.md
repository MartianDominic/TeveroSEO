# Frontend Security Audit Report - Round 2

**Date:** 2026-04-28  
**Scope:** apps/web - Content Security Policy, CORS, Sensitive Data Exposure  
**Auditor:** Claude Code Security Review

---

## Executive Summary

The TeveroSEO frontend (apps/web) demonstrates **strong security practices** overall. The codebase includes comprehensive CSP headers, proper HTML sanitization with DOMPurify, server-side authorization patterns, and rate limiting infrastructure. A few areas for improvement were identified, primarily related to ensuring consistent rate limiting across all API routes.

**Overall Security Posture:** GOOD

| Category | Status | Notes |
|----------|--------|-------|
| Content Security Policy | GOOD | Comprehensive CSP with allowlist approach |
| CORS Protection | GOOD | Origin validation implemented |
| XSS Prevention | EXCELLENT | DOMPurify sanitization consistently applied |
| Sensitive Data Exposure | GOOD | No API keys in client bundle |
| Client-Side Auth | GOOD | Authorization deferred to server |
| Rate Limiting | MEDIUM | Infrastructure exists but not consistently applied |
| Dependencies | PENDING | Unable to run npm audit (no lockfile) |

---

## 1. Content Security Policy (CSP)

**Location:** `/apps/web/next.config.ts`

### Findings

**POSITIVE:** The CSP implementation is comprehensive and follows best practices:

- `default-src 'self'` - Only allow same-origin by default
- `script-src` - Uses 'unsafe-eval' only in development for HMR
- `style-src 'self' 'unsafe-inline'` - Required for Tailwind/CSS-in-JS
- `frame-ancestors 'none'` - Prevents clickjacking
- `object-src 'none'` - Blocks plugin-based attacks
- Explicit allowlist for connect-src domains (Clerk, WebSocket)

**MEDIUM RISK:** `unsafe-inline` for scripts
- Required for Next.js hydration
- Mitigated by server-side rendering and sanitization

**Recommendation:** Consider implementing nonce-based CSP in the future for stricter script control.

### Additional Security Headers

All OWASP-recommended headers are present:
- `Strict-Transport-Security`: 1 year with preload
- `X-Frame-Options`: DENY
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: Disables unused APIs (camera, microphone, geolocation, etc.)

---

## 2. Sensitive Data Exposure

### Environment Variables

**Location:** `/apps/web/.env.example`, `/apps/web/src/lib/env.ts`

**POSITIVE:** Clear separation of server vs client variables:

| Variable | Exposure | Risk |
|----------|----------|------|
| `DATABASE_URL` | Server-only | Safe |
| `CLERK_SECRET_KEY` | Server-only | Safe |
| `INTERNAL_API_KEY` | Server-only | Safe |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client | Safe (designed for public use) |
| `NEXT_PUBLIC_APP_URL` | Client | Safe (non-sensitive) |

**POSITIVE:** Environment validation at startup with Zod:
- INTERNAL_API_KEY requires 32+ characters in production
- CLERK_WEBHOOK_SECRET is validated and required
- Missing required secrets cause startup failure (fail-fast)

### localStorage Usage

**Location:** Various client components

**POSITIVE:** Only non-sensitive UI state is stored:
- `agency-theme` - UI theme preference
- `COLLAPSED_KEY` - Sidebar state

No tokens, credentials, or PII found in localStorage.

### sessionStorage Usage

**POSITIVE:** Only scroll positions stored:
- `scroll-{key}` - Scroll restoration
- `wix_connected` - OAuth flow flag (boolean only)

### Console Logging

**MEDIUM RISK:** Several `console.log` statements in production code:

| File | Type | Concern |
|------|------|---------|
| `api/webhooks/clerk/route.ts` | User creation logs | Logs user IDs - acceptable for audit trail |
| `lib/redis/client.ts` | Connection status | Infrastructure logging - acceptable |
| `lib/redis/pubsub.ts` | Subscription events | Infrastructure logging - acceptable |
| `lib/auth/client-ownership.ts` | Access denials | Security audit - **recommended** |

**Recommendation:** Consider structured logging with log levels to control verbosity in production.

---

## 3. XSS Prevention

### HTML Sanitization

**Location:** `/apps/web/src/lib/sanitize.ts`, `/apps/web/src/components/ai/SafeAIOutput.tsx`

**EXCELLENT:** DOMPurify is consistently used with strict configuration:

- Uses ALLOWED_TAGS (allowlist approach) not FORBID_TAGS
- ALLOW_DATA_ATTR: false - Blocks data-* attributes
- ALLOWED_URI_REGEXP blocks javascript:, vbscript:, data: URLs
- RETURN_DOM: false - Returns sanitized string

### Raw HTML Rendering

All instances of raw HTML rendering are properly sanitized:

| File | Sanitization |
|------|--------------|
| `articles/[articleId]/page.tsx` | `sanitizeHtml()` from lib/sanitize.ts |
| `articles/new/page.tsx` | `sanitizeHtml()` from lib/sanitize.ts |
| `ReportFooter.tsx` | `sanitizeMinimalHtml()` |
| `SafeAIOutput.tsx` | DOMPurify.sanitize() inline |

The SafeAIOutput component provides a reusable safe rendering pattern with configurable allowlists.

### Link Security

**POSITIVE:** All `target="_blank"` links include `rel="noopener noreferrer"`:
- Verified in intelligence/page.tsx, articles/page.tsx
- Prevents reverse tabnabbing attacks

---

## 4. Client-Side Validation

### Authorization Pattern

**Location:** `/apps/web/src/lib/auth/`

**POSITIVE:** Authorization is properly delegated to backend:

**Key Security Patterns:**
1. **Fail-closed design:** Network errors deny access
2. **Backend verification:** All ownership checks go to AI-Writer API
3. **Caching with TTL:** 5-minute cache prevents abuse while allowing updates
4. **Audit logging:** All access denials are logged

The `validateClientOwnership()` function ensures users cannot access clients they don't own, with proper error handling for network failures.

### No Client-Side Price/Amount Calculations

**POSITIVE:** No sensitive calculations found on client side. All `total`, `amount` references are display-only values from backend.

---

## 5. CSRF Protection

**Location:** `/apps/web/src/lib/api/security.ts`

**POSITIVE:** Comprehensive CSRF protection implemented:

- Origin header validation against allowlist
- Referer header fallback validation
- Optional X-Requested-With header check
- Integrated with rate limiting via `secureRoute()`
- GET/HEAD/OPTIONS methods exempt (safe methods)

---

## 6. Rate Limiting

**Location:** `/apps/web/src/lib/middleware/rate-limit.ts`, `/apps/web/src/lib/api/security.ts`

### Infrastructure

**POSITIVE:** Well-designed rate limiting infrastructure:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| AUTH | 10 | 1 minute |
| API | 100 | 1 minute |
| HEAVY | 20 | 1 minute |
| PASSWORD_RESET | 3 | 5 minutes |
| SIGNUP | 5 | 5 minutes |

Includes memory management with bounded map (10K max entries) and automatic cleanup.

### Coverage Gap

**MEDIUM RISK:** Several API routes lack explicit rate limiting:

| Route | Method | Rate Limiting |
|-------|--------|---------------|
| `/api/analytics/[clientId]/publishing-logs` | GET | Missing |
| `/api/reports/[id]` | GET | Missing |
| `/api/site-connections` | GET, POST | Missing |
| `/api/site-connections/[id]` | GET, DELETE | Missing |
| `/api/site-connections/[id]/verify` | POST | Missing |
| `/api/site-connections/detect` | POST | Missing |
| `/api/content-calendar` | GET, POST | Missing |
| `/api/webhooks/clerk` | POST | Acceptable (signature-verified) |

**Recommendation:** Apply `withRateLimit()` or `secureRoute()` wrapper to all API routes.

---

## 7. Authentication Middleware

**Location:** `/apps/web/src/middleware.ts`

**POSITIVE:** Proper Clerk middleware with session freshness check:

- Public routes explicitly defined
- Sensitive routes require re-authentication after 24 hours
- Session age checked against JWT `iat` claim
- Proper redirect with reason parameter for UX

---

## 8. Dependency Security

**Unable to verify:** No package-lock.json found in apps/web.

**Recommendation:** 
1. Generate lockfile: `npm i --package-lock-only`
2. Run `npm audit` regularly
3. Consider adding `npm audit` to CI pipeline

### Notable Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| next | 15.5.15 | Current |
| react | 19.1.6 | Current |
| dompurify | 3.4.1 | Current, security-critical |
| @clerk/nextjs | 6.39.2 | Check for updates |

---

## 9. WebSocket Security

**Location:** `/apps/web/src/lib/websocket/socket-client.ts`

**POSITIVE:** Secure WebSocket implementation:
- Falls back to same-origin WS when `NEXT_PUBLIC_WS_URL` not set
- Uses `wss:` for HTTPS pages
- Bounded set for deduplication (prevents memory exhaustion)
- Reconnection with exponential backoff

**Note:** WebSocket authentication should be verified at the server level.

---

## Summary of Recommendations

### HIGH Priority
1. Add rate limiting to all API routes currently missing it
2. Generate and commit package-lock.json for dependency auditing

### MEDIUM Priority
3. Consider nonce-based CSP for stricter script control
4. Review console.log statements for production appropriateness
5. Add `npm audit` to CI pipeline

### LOW Priority
6. Document WebSocket authentication requirements
7. Consider structured logging framework

---

## Files Reviewed

- `/apps/web/next.config.ts` - Security headers
- `/apps/web/src/middleware.ts` - Auth middleware
- `/apps/web/.env.example` - Environment variables
- `/apps/web/package.json` - Dependencies
- `/apps/web/src/lib/env.ts` - Env validation
- `/apps/web/src/lib/sanitize.ts` - HTML sanitization
- `/apps/web/src/lib/api-client.ts` - Client API
- `/apps/web/src/lib/voiceApi.ts` - Voice API client
- `/apps/web/src/lib/clientOAuth.ts` - OAuth client
- `/apps/web/src/lib/api/security.ts` - CSRF protection
- `/apps/web/src/lib/middleware/rate-limit.ts` - Rate limiting
- `/apps/web/src/lib/auth/action-auth.ts` - Server action auth
- `/apps/web/src/lib/auth/client-ownership.ts` - Client authorization
- `/apps/web/src/lib/websocket/socket-client.ts` - WebSocket client
- `/apps/web/src/components/ai/SafeAIOutput.tsx` - Safe HTML rendering
- `/apps/web/src/app/api/webhooks/clerk/route.ts` - Webhook handler
- Various API routes and page components
