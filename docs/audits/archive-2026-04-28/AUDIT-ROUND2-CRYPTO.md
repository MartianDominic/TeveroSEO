# Cryptographic Security Audit - Round 2

**Date:** 2026-04-28  
**Scope:** Cryptographic implementations, secret management, token security, timing attacks  
**Files Examined:**
- `AI-Writer/backend/services/encryption.py`
- `AI-Writer/backend/services/gsc_service.py`
- `AI-Writer/backend/services/client_oauth_service.py`
- `AI-Writer/backend/middleware/internal_auth.py`
- `apps/web/src/lib/auth/**/*.ts`
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/internal-api/client.ts`
- `open-seo-main/src/server/lib/clerk-jwt.ts`
- `.env` files and `.gitignore`

---

## Executive Summary

Overall the cryptographic implementations are **GOOD**. The codebase demonstrates security-conscious design with proper use of:
- Fernet (AES-128-CBC + HMAC-SHA256) for credential encryption
- HMAC-SHA256 with constant-time comparison for request signing
- Cryptographically secure random number generation (`secrets` module)
- Proper JWT validation with JWKS

**Critical Issues Found:** 1 (exposed secrets in committed .env)  
**High Issues Found:** 0  
**Medium Issues Found:** 2  
**Low/Informational:** 3

---

## CRITICAL: Hardcoded Secrets in Git History

### Location
`AI-Writer/.env` (tracked in git, shown in `git status` as modified)

### Evidence
```
CLERK_SECRET_KEY=sk_test_qujQa8BZuMhhOBB6A2vjI6JA4rVoJqvPiFlxhZToQ5
GEMINI_API_KEY=AIzaSyDWnct3gm_ZzXQnBuEgel4OMdH2lhF9XEk
FERNET_KEY=OdVcttbR-1XmQnKa8vLDsU2dVhX00khhuMFV_7WAXJs=
POSTGRES_PASSWORD=localdev
```

### Impact
- These secrets may be in git history even if .env is now gitignored
- If pushed to remote, secrets are compromised
- `sk_test_` indicates test keys, but should still not be committed

### Remediation
1. **IMMEDIATE:** Rotate ALL secrets that were ever committed:
   - Generate new `FERNET_KEY`: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - Rotate `CLERK_SECRET_KEY` in Clerk dashboard
   - Regenerate `GEMINI_API_KEY` in Google Cloud Console
2. Verify `.env` is in `.gitignore` (confirmed: it is)
3. Run `git rm --cached AI-Writer/.env` if still tracked
4. Consider using `git filter-branch` or BFG Repo Cleaner to purge from history

---

## MEDIUM: Missing JWT Expiration Validation

### Location
`open-seo-main/src/server/lib/clerk-jwt.ts:51`

### Evidence
```typescript
const { payload } = await jwtVerify(token, jwks, {
  algorithms: ["RS256"],
});
```

### Issue
While `jwtVerify` from `jose` library does check `exp` claim by default, there is:
1. No explicit `maxTokenAge` configuration
2. No validation of `iat` (issued at) claim
3. No audience (`aud`) or issuer (`iss`) validation

### Remediation
```typescript
const { payload } = await jwtVerify(token, jwks, {
  algorithms: ["RS256"],
  issuer: `https://${instanceUrl}`,  // Validate issuer
  maxTokenAge: "1h",  // Explicit max age
});
```

---

## MEDIUM: OAuth State Token Stored in URL-Derived User Database

### Location
`AI-Writer/backend/services/gsc_service.py:432-454`

### Evidence
```python
# The state includes user_id derived from the state itself
state = f"{user_id}:{random_state}"
# Later, user_id is extracted from state to find the database
parts = state.split(':', 1)
user_id = parts[0]
db_path = self._get_db_path(user_id)  # User controls which DB is checked
```

### Issue
While path traversal is checked, the pattern of deriving the database location from user-supplied data is inherently risky. An attacker who discovers a valid state token pattern could potentially target a specific user's database.

### Mitigating Factors
- Path traversal characters are validated (lines 498-502)
- State token randomness is good (32-byte `secrets.token_urlsafe`)
- State is verified against stored record in the target DB

### Remediation
Consider using a central state store (Redis) instead of user-specific SQLite databases for OAuth state tokens.

---

## LOW: Development Mode Auth Bypass

### Location
`AI-Writer/backend/middleware/internal_auth.py:105-108`

### Evidence
```python
# Skip auth if no API key configured (development mode)
if not self.api_key:
    logger.debug("Skipping internal auth (no API key configured)")
    return await call_next(request)
```

### Issue
In development mode without `INTERNAL_API_KEY`, all `/internal/` routes bypass authentication entirely.

### Mitigating Factors
- Production mode requires the key (enforced on line 64)
- Warning is logged (line 68)

### Remediation
Consider requiring explicit opt-in for development mode bypass rather than implicit.

---

## LOW: No Rate Limiting on OAuth State Generation

### Location
`AI-Writer/backend/services/client_oauth_service.py:221-290`

### Issue
The `get_oauth_url` function generates and stores state tokens without rate limiting. An attacker could flood the database with state tokens.

### Mitigating Factors
- State tokens expire after 10 minutes
- `cleanup_expired_state_tokens` method exists for cleanup

### Remediation
Add rate limiting at the router level for OAuth initiation endpoints.

---

## INFORMATIONAL: Good Practices Observed

### 1. Strong Encryption Implementation
**Location:** `AI-Writer/backend/services/encryption.py`

- Uses Fernet (AES-128-CBC + HMAC-SHA256)
- Key validation at runtime with clear error messages
- No fallback to weak crypto
- Security contract documented in docstrings

### 2. Constant-Time Signature Comparison
**Location:** `AI-Writer/backend/middleware/internal_auth.py:177`

```python
if not hmac.compare_digest(signature, expected_signature):
```

Correctly uses `hmac.compare_digest` for timing-safe comparison.

### 3. Cryptographically Secure Random Number Generation
**Locations:**
- `AI-Writer/backend/services/gsc_service.py:433` - `secrets.token_urlsafe(32)`
- `AI-Writer/backend/services/client_oauth_service.py:157,260` - `secrets.token_urlsafe(32)`
- `AI-Writer/backend/services/integrations/bing_oauth.py:81` - `secrets.token_urlsafe(32)`
- `apps/web/src/lib/concurrency/distributed-lock.ts:131` - `crypto.randomBytes(16)`

All security-sensitive random values use cryptographic random sources.

### 4. HMAC Request Signing
**Locations:**
- `apps/web/src/lib/internal-api/client.ts:92` - HMAC-SHA256 signing
- `AI-Writer/backend/middleware/internal_auth.py:170-174` - HMAC verification

Proper HMAC-based request signing with timestamp for replay protection.

### 5. Timing-Safe Comparison in TypeScript
**Location:** `open-seo-main/src/server/middleware/auth.ts:541`

```typescript
return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
```

Uses Node.js `timingSafeEqual` correctly.

### 6. OAuth State Validation
**Location:** `AI-Writer/backend/services/client_oauth_service.py:263-277`

- State tokens stored in database before redirect (CSRF prevention)
- Single-use enforcement (deleted after use)
- TTL enforcement (10 minutes)

### 7. Environment Variable Validation
**Location:** `apps/web/src/lib/env.ts`

- Zod schema validation at startup
- Minimum length requirements for secrets
- Fail-fast on missing configuration

---

## Checklist Summary

| Check | Status | Notes |
|-------|--------|-------|
| No MD5/SHA1 for security | PASS | Not found in security contexts |
| No ECB mode encryption | PASS | Fernet uses CBC |
| Strong key lengths | PASS | 32-byte keys enforced |
| Cryptographic random | PASS | Uses `secrets` module and `crypto.randomBytes` |
| No hardcoded secrets in code | PASS | Uses env vars |
| Secrets in .gitignore | PASS | `.env` files properly ignored |
| Secrets not in error messages | PASS | Sanitized error responses |
| JWT with expiration | PARTIAL | Implicit exp check, no explicit maxTokenAge |
| JWT signing with strong algorithm | PASS | RS256 |
| Timing-safe secret comparison | PASS | `hmac.compare_digest` and `timingSafeEqual` used |
| Replay attack prevention | PASS | Timestamp validation with 5-minute drift |

---

## Recommended Actions

### Immediate (CRITICAL)
1. Rotate all secrets found in `AI-Writer/.env`
2. Ensure `.env` is not tracked in git
3. Audit git history for exposed secrets

### Short-term (1-2 weeks)
1. Add explicit JWT validation options (issuer, maxTokenAge)
2. Add rate limiting to OAuth state generation endpoints
3. Consider central state store for OAuth flow

### Long-term
1. Implement secrets rotation policy
2. Consider HashiCorp Vault or AWS Secrets Manager for production
3. Add security scanning to CI/CD pipeline

---
## FIXES IMPLEMENTED - 2026-04-28

### JWT Verification Enhanced (MEDIUM)
- Added `maxTokenAge: "24h"` to JWT verification in `open-seo-main/src/server/lib/clerk-jwt.ts`
- Added `issuer` validation to ensure tokens originate from expected Clerk instance
- Added `getClerkIssuerUrl()` helper to derive issuer URL from publishable key
- Documents security contract in function docstring
