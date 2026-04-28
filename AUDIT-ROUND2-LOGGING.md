# Logging, Debugging, and Observability Audit Report

**Audit Date:** 2026-04-28  
**Scope:** TeveroSEO (apps/web, open-seo-main, AI-Writer)

---

## Executive Summary

This audit examines logging, debugging capabilities, and observability across the TeveroSEO codebase. The review found **several critical issues** requiring immediate attention, including PII exposure in logs, debug scripts containing hardcoded user IDs, and sensitive data potentially logged in request/response payloads.

**Risk Level:** MEDIUM-HIGH

---

## Critical Findings

### 1. PII Logged in Clerk Webhook Handler (CRITICAL)

**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/webhooks/clerk/route.ts`

**Issue:** User email addresses are logged in plain text during user creation events.

```typescript
// Lines 98-103
console.log('[ClerkWebhook] New user details:', {
  userId,
  email,  // PII: Email logged in plaintext
  name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
  createdAt: new Date().toISOString(),
});
```

**Impact:** PII (email, name) written to production logs violates data protection principles and potentially GDPR/CCPA compliance.

**Recommendation:** Remove PII from logs or hash/anonymize before logging:
```typescript
console.log('[ClerkWebhook] New user details:', {
  userId,
  emailDomain: email?.split('@')[1], // Log domain only, not full email
  createdAt: new Date().toISOString(),
});
```

---

### 2. User Email Logged in Auth Middleware (CRITICAL)

**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py`

**Issue:** User email is logged alongside user ID on successful authentication.

```python
# Line 152
logger.info(f"Token verified successfully using fastapi-clerk-auth for user: {email} (ID: {user_id})")
```

**Impact:** Every authenticated request logs user PII to the log stream.

**Recommendation:** Log only user ID or a hashed identifier:
```python
logger.info(f"Token verified successfully for user ID: {user_id}")
```

---

### 3. Debug Scripts with Hardcoded User IDs (HIGH)

**Files:**
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/scripts/debug_specific_user.py`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/debug_analytics_api.py`

**Issue:** Debug scripts exist in the backend directory with hardcoded user IDs:

```python
# debug_specific_user.py - Line 11
USER_ID = "user_33Gz1FPI86VDXhRY8QN4ragRFGN"
```

These scripts:
- Print raw database records including billing information
- Can be executed with production credentials
- Are not excluded from the production build

**Impact:** Debug scripts in production deployments could expose user data if accessed. Hardcoded IDs could be used to target specific users.

**Recommendation:**
1. Move debug scripts to a separate `/scripts/debug/` directory excluded from production
2. Add `.gitignore` entry to prevent committing debug scripts
3. Require environment variable for user ID instead of hardcoding

---

### 4. Request Data Logged Without Sanitization (HIGH)

**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/gsc_service.py`

**Issue:** GSC verification requests logged with full request details:

```python
# Lines 774, 804, 825, 842, 870
logger.info(f"GSC Data verification request for user {user_id}: {verification_request}")
logger.info(f"GSC API request for user {user_id}: {request}")
logger.info(f"GSC Query-level request for user {user_id}: {query_request}")
```

**Impact:** Request objects may contain sensitive query parameters, URLs, or site data.

**Recommendation:** Implement request sanitization before logging or log only essential metadata (request type, timestamp, status).

---

### 5. Full Request Data Logged in Validation (HIGH)

**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/validation.py`

**Issue:** Full step data including API keys structure logged:

```python
# Lines 293, 299, 302, 305
logger.info(f"[validate_step_data] Validating step {step_number} with data: {data}")
logger.info(f"[validate_step_data] Step 1 validation - data type: {type(data)}, data: {data}")
logger.warning(f"[validate_step_data] No data or api_keys missing. data: {data}")
```

**Impact:** While the actual API key values may not be logged, the structure reveals configuration details and the presence of specific integrations.

**Recommendation:** Log only step number and validation result, not the full data object.

---

## Medium Severity Findings

### 6. Console.log Statements in Production Code (MEDIUM)

**Locations:**
- `apps/web/src/lib/redis/client.ts` - Lines 47, 51, 72, 135
- `apps/web/src/lib/redis/pubsub.ts` - Lines 40, 125, 156, 225
- `apps/web/src/lib/cache/cache-cleanup.ts` - Line 23
- `open-seo-main/src/server/lib/redis.ts` - Lines 52, 72, 147, 151, 158, 187, 214, 227
- `open-seo-main/src/db/index.ts` - Line 99

**Issue:** Multiple console.log statements in production infrastructure code.

**Impact:** Logs become noisy, potentially impacting log aggregation costs and making it harder to find important events.

**Recommendation:** Replace with structured logger or conditional debug logging.

---

### 7. Error Stack Traces in Production (MEDIUM)

**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/errors/handler.ts`

**Issue:** Stack traces are included in development but the isDev check relies on NODE_ENV:

```typescript
const isDev = process.env.NODE_ENV !== 'production';
// ...
stack: isDev ? error.stack : undefined,
```

This is correctly implemented but several error handlers across the codebase log full error objects:

**Examples:**
- `apps/web/src/app/global-error.tsx` - Line 18: Logs error details
- `apps/web/src/app/(shell)/error.tsx` - Line 20: Logs error digest/message
- Multiple `console.error` calls with full error objects

**Impact:** While the main handler is safe, scattered error logging may leak implementation details.

---

### 8. Missing Audit Trail for Critical Operations (MEDIUM)

**Issue:** While `open-seo-main/src/db/audit.ts` provides comprehensive audit logging infrastructure, several critical operations lack audit logging:

**Missing audit coverage:**
- Login/logout events (no dedicated auth event logging)
- Failed authentication attempts
- API key creation/deletion
- Workspace membership changes
- Client data export operations

**Recommendation:** Extend audit logging to cover:
1. All authentication events (login, logout, token refresh, failures)
2. Authorization failures (403 responses)
3. Bulk data operations
4. Admin actions

---

### 9. Verbose Logging Mode Risks (MEDIUM)

**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/logging_config.py`

**Issue:** The ALWRITY_VERBOSE environment variable enables DEBUG level logging:

```python
# Line 102
verbose_mode = os.getenv("ALWRITY_VERBOSE", "false").lower() == "true"
```

When enabled, this logs sensitive operations at DEBUG level across the entire application.

**Recommendation:** 
1. Add safeguards to prevent verbose mode in production
2. Never log sensitive data even at DEBUG level
3. Add production environment check before enabling verbose mode

---

## Good Practices Found

### 1. Sensitive Field Redaction (apps/web)

**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/errors/handler.ts`

The error handler properly redacts sensitive fields:

```typescript
const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'key', 'auth', 'credential',
  'cookie', 'authorization', 'api_key', 'apikey', 'access_token',
  'refresh_token', 'private', 'ssn', 'credit_card', 'card_number',
];
```

### 2. Audit Log Redaction (open-seo-main)

**File:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/audit.ts`

Audit logs properly redact sensitive fields before storage:

```typescript
const REDACTED_FIELDS = new Set([
  'password', 'passwordHash', 'secret', 'secretKey', 'apiKey',
  'keyHash', 'refreshToken', 'accessToken', 'gscRefreshToken',
  'privateKey', 'credentials',
]);
```

### 3. Structured Logger with Correlation IDs

**File:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/logger.ts`

The logger implementation includes:
- Environment-aware formatting (JSON in prod, colorized in dev)
- Log level filtering via LOG_LEVEL
- Correlation IDs via AsyncLocalStorage
- Request ID propagation

### 4. URL Sanitization for Logging

**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/http_client.py`

Contains `_sanitize_url_for_logging` function to strip API keys from URLs before logging.

---

## Recommendations Summary

### Immediate Actions (P0)

1. **Remove PII from Clerk webhook logs** - Remove or anonymize email/name logging
2. **Remove email from auth middleware logs** - Log only user ID
3. **Move debug scripts out of main source** - Create separate debug directory excluded from production

### Short-term Actions (P1)

4. **Sanitize request/response logging** - Implement universal request sanitization
5. **Add auth event audit trail** - Log login/logout/auth failures
6. **Replace console.log with structured logger** - Standardize logging across apps

### Medium-term Actions (P2)

7. **Implement log injection protection** - Sanitize user input in log messages
8. **Add production safeguards for verbose mode** - Prevent DEBUG in production
9. **Centralize logging configuration** - Share logger config across all apps

---

## Log Injection Assessment

No critical log injection vulnerabilities were found. The codebase uses:
- Template literals without raw string interpolation
- Structured logging with object serialization
- No direct newline insertion from user input

However, user-provided values (URLs, names) are included in logs without explicit sanitization. While the risk is low with structured logging, adding explicit newline stripping would be a defense-in-depth measure.

---

## Files Requiring Changes

| File | Priority | Issue |
|------|----------|-------|
| `apps/web/src/app/api/webhooks/clerk/route.ts` | P0 | PII in logs |
| `AI-Writer/backend/middleware/auth_middleware.py` | P0 | Email in logs |
| `AI-Writer/backend/scripts/debug_specific_user.py` | P0 | Debug script in source |
| `AI-Writer/backend/debug_analytics_api.py` | P0 | Debug script in source |
| `AI-Writer/backend/services/gsc_service.py` | P1 | Request data logging |
| `AI-Writer/backend/services/validation.py` | P1 | Full data logging |
| `apps/web/src/lib/redis/client.ts` | P2 | Console.log usage |
| `open-seo-main/src/server/lib/redis.ts` | P2 | Console.log usage |

---

*Generated by security audit - Round 2*

---

## FIXES IMPLEMENTED - 2026-04-28

### PII Removed From Logs

| File | Change |
|------|--------|
| `apps/web/src/app/api/webhooks/clerk/route.ts` | Removed email and name from webhook logs. Now logs only partial userId (first 8 chars + `***`) and event type |
| `AI-Writer/backend/middleware/auth_middleware.py` | Removed email from auth success log. Now logs only partial user_id (first 8 chars + `***`) |
| `AI-Writer/backend/services/gsc_service.py` | Sanitized all request/response logging - removed full request objects, now logs only dimensions, rowLimit, and rowCount |
| `AI-Writer/backend/services/validation.py` | Removed full data object logging - now logs only data keys and boolean flags |

### Sanitization Utilities Created

| File | Purpose |
|------|---------|
| `AI-Writer/backend/utils/log_sanitizer.py` | Comprehensive log sanitization utility with functions: `sanitize_for_logging()`, `sanitize_user_id()`, `sanitize_email()`, `sanitize_request_for_logging()`, `get_safe_log_context()` |

### Debug Scripts Secured

| Action | Details |
|--------|---------|
| Removed | `AI-Writer/backend/scripts/debug_specific_user.py` (had hardcoded user ID) |
| Removed | `AI-Writer/backend/debug_analytics_api.py` (was in wrong location) |
| Created | `AI-Writer/backend/scripts/debug/debug_specific_user.py` - requires `USER_ID` env var |
| Created | `AI-Writer/backend/scripts/debug/debug_analytics_api.py` - requires `ALWRITY_API_TOKEN` env var |
| Updated | `AI-Writer/.gitignore` - added `backend/scripts/debug/` to prevent accidental commits |

### Summary of Changes

1. **Clerk Webhook**: User email and name no longer logged. Only partial userId shown.
2. **Auth Middleware**: User email removed from success log message.
3. **GSC Service**: All 10 request/response log lines sanitized to show only metadata (dimensions, row counts).
4. **Validation Service**: All 4 data logging lines sanitized to show only keys/flags, not values.
5. **Debug Scripts**: Moved to dedicated `/scripts/debug/` directory, removed hardcoded IDs, added to .gitignore.
6. **New Utility**: Created `log_sanitizer.py` for consistent PII redaction across the codebase.
