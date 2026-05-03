### Agent 9: open-seo-main Authentication (better-auth)

**Status:** Complete
**Scope:** Auth configuration, session management, middleware, security

#### Summary

The open-seo-main authentication system has **migrated away from better-auth** to a **Clerk-based JWT authentication** model. The codebase shows evidence of this migration (deprecated stubs, comments). The current implementation is **well-designed and security-conscious**, with proper server-side enforcement, comprehensive audit logging, and multiple authentication methods (API keys + JWT).

#### Architecture Overview

1. **Primary Auth: Clerk JWT** (`src/middleware/ensure-user/clerk.ts`)
   - JWT verification via JWKS from Clerk
   - RS256 algorithm validation (prevents algorithm confusion attacks)
   - Token issuer validation against Clerk instance
   - 24-hour maximum token age enforcement
   - Auto-provisioning: creates user record on first login from JWT claims

2. **API Key Authentication** (`src/server/middleware/auth.ts`)
   - SHA-256 hashed keys (never stores raw keys)
   - `oseo_` prefix format for easy identification
   - Organization + optional client scoping
   - Granular permission scopes (`read:audits`, `write:briefs`, etc.)
   - Expiration and enable/disable support
   - Last-used tracking (fire-and-forget)

3. **Authorization Layer** (`src/server/middleware/authz.ts`)
   - User -> Member -> Organization -> Client chain
   - Redis-cached ownership checks (5-min TTL)
   - Cache invalidation on membership changes
   - Batch ownership checks for list views

4. **Security Headers** (`src/server/middleware/security-headers.ts`)
   - Comprehensive CSP with appropriate directives
   - HSTS in production (1 year, includeSubDomains, preload)
   - X-Frame-Options: DENY (clickjacking protection)
   - X-Content-Type-Options: nosniff
   - Permissions-Policy disabling unnecessary browser features

5. **Rate Limiting** (`src/server/middleware/rate-limit.ts`)
   - Redis-backed sliding window algorithm
   - Atomic Lua script to prevent race conditions
   - Pre-configured limits for auth endpoints (10/min), password reset (3/5min), signup (5/5min)
   - Fails open on Redis errors (with logging)

#### Findings

**HIGH - H01: Rate Limiting Fails Open on Redis Failure**
- **File:** `src/server/middleware/rate-limit.ts:299-314`
- **Issue:** When Redis is unavailable, rate limiting fails open (allows the request). This could allow brute-force attacks during Redis outages.
- **Recommendation:** For authentication endpoints specifically, consider failing closed (deny request) or implementing a fallback in-memory rate limiter with shorter window.

**HIGH - H02: API Key Validation Timing Attack Potential**
- **File:** `src/server/middleware/auth.ts:140-163`
- **Issue:** API key lookup uses database comparison of hashes. If the key is not found (no rows returned), the response time differs from when a disabled/expired key is found. This could leak information about valid key hashes.
- **Recommendation:** Use constant-time comparison for all branches or add artificial delay to normalize response times. The `secureCompare` utility exists but is not used for this validation.

**MEDIUM - M01: JWT User Not Looked Up in Database**
- **File:** `src/server/middleware/auth.ts:436-449`
- **Issue:** For JWT authentication via `authenticateRequest()`, the Clerk user ID is used directly without database lookup. This means the user's actual database ID differs from their auth context ID.
- **Recommendation:** Ensure consistent behavior with `resolveClerkContext()` which does perform DB lookup. Consider whether JWT auth in unified middleware should also resolve to DB user.

**MEDIUM - M02: Organization ID Defaulting to User ID**
- **File:** `src/middleware/ensure-user/clerk.ts:75`
- **Issue:** `organizationId = dbUser.id` - Using user ID as default organization ID for "single-user case". This is a simplification that may cause issues when multi-tenant support is needed.
- **Recommendation:** Document this limitation clearly. Consider extracting Clerk's org claims if using Clerk Organizations.

**MEDIUM - M03: Authorization Cache TTL Inconsistency**
- **File:** `src/lib/auth/client-ownership.ts:40` vs `src/server/middleware/authz.ts:23`
- **Issue:** Two ownership cache implementations with different TTLs (2 minutes vs 5 minutes). This could cause confusing behavior where access is granted/denied inconsistently.
- **Recommendation:** Consolidate to single ownership check implementation with consistent TTL (2 minutes is more secure).

**MEDIUM - M04: SSRF Protection DNS Resolution Failure Mode**
- **File:** `src/server/lib/webhook-url-policy.ts:217-222`
- **Issue:** When DNS resolution fails, the function returns `false` (allows the URL). This is a fail-open approach for SSRF protection.
- **Recommendation:** Consider fail-closed for DNS resolution errors, or at least log these failures for monitoring.

**LOW - L01: Deprecated Auth Stubs Still Present**
- **Files:** `src/lib/auth-client.ts`, `src/lib/auth-mode.ts`, `src/lib/auth-session.ts`
- **Issue:** These files contain deprecated stubs from the better-auth migration. While harmless, they add confusion.
- **Recommendation:** Remove deprecated stubs or consolidate into a single "legacy compatibility" module.

**LOW - L02: Session Table References Removed But Schema Exists**
- **File:** `src/db/user-schema.ts:26-27`
- **Issue:** Comment notes session/account/verification tables "have been removed" but no migration evidence to drop them. May have orphaned tables.
- **Recommendation:** Verify tables were actually dropped via migration or clean up if they still exist.

**LOW - L03: Security Audit Log Not Indexed by Timestamp Range**
- **File:** `src/db/security-audit-schema.ts:68`
- **Issue:** `ix_security_audit_created` index exists but is a simple B-tree. For time-range queries (common for audit logs), a BRIN index might be more efficient.
- **Recommendation:** Consider BRIN index for `createdAt` column on large audit tables.

#### Positive Patterns Observed

1. **Excellent Server-Side Auth Enforcement**
   - Clear documentation that client-side auth is UX only
   - All API endpoints protected via `requireApiAuth()`
   - Middleware pattern ensures consistent auth checks

2. **Comprehensive Security Audit Logging**
   - Dedicated schema for security events
   - Fire-and-forget logging to avoid blocking requests
   - Multiple event types: auth_failure, permission_denied, rate_limit_exceeded
   - IP address, user agent, request ID captured

3. **Strong Password/Key Policies**
   - SHA-256 hashing for API keys (industry standard)
   - RS256 JWT validation with JWKS
   - Password length requirements (8-128 chars)
   - Token expiration enforcement

4. **SSRF Prevention**
   - Comprehensive webhook URL validation
   - Private IP detection (IPv4 and IPv6)
   - Cloud metadata endpoint blocking
   - DNS rebinding protection via DoH resolution

5. **OAuth State Management**
   - CSRF protection via random state tokens
   - 10-minute expiry (appropriate for OAuth flows)
   - Single-use enforcement via `usedAt` tracking

6. **Authorization Caching with Invalidation**
   - Redis-backed for distributed deployments
   - Pattern-based bulk invalidation
   - Graceful fallback on cache failures

#### Security Header Configuration Review

| Header | Value | Assessment |
|--------|-------|------------|
| Content-Security-Policy | Comprehensive | Good |
| X-Frame-Options | DENY | Good |
| X-Content-Type-Options | nosniff | Good |
| Strict-Transport-Security | 1yr, preload | Excellent |
| Referrer-Policy | strict-origin-when-cross-origin | Good |
| Permissions-Policy | All disabled | Excellent |

#### Rate Limit Configuration Review

| Endpoint | Limit | Window | Assessment |
|----------|-------|--------|------------|
| Auth endpoints | 10 | 60s | Good |
| Password reset | 3 | 300s | Good |
| Signup | 5 | 300s | Good |
| API key generation | 5 | 60s | Good |
| Audit operations | 10 | 60s | Appropriate |
| Content generation | 20 | 60s | Appropriate |

#### Files Reviewed

- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth/client-ownership.ts` (373 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth-client.ts` (82 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth-mode.ts` (28 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth-options.ts` (12 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth-redirect.ts` (38 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/lib/auth-session.ts` (26 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/middleware/ensureUser.ts` (63 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/middleware/ensure-user/index.ts` (15 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/middleware/ensure-user/clerk.ts` (83 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/middleware/ensure-user/types.ts` (13 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/clerk-jwt.ts` (105 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/auth.ts` (543 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/authz.ts` (310 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/rls-context.ts` (230 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/rate-limit.ts` (613 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/security-headers.ts` (220 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/security-audit.ts` (185 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/webhook-url-policy.ts` (286 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/seo/-middleware.ts` (130 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/webhooks.ts` (172 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/_authenticated.tsx` (43 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/user-schema.ts` (126 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/api-key-schema.ts` (119 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/security-audit-schema.ts` (76 lines)
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/oauth-state-schema.ts` (68 lines)
