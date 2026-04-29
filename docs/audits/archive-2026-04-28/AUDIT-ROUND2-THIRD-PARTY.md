# Third-Party API Integration Resilience Audit

**Date:** 2026-04-28  
**Scope:** Google APIs, DataForSEO, Clerk Authentication, Stripe/Payment  
**Auditor:** Security Review Agent

---

## Executive Summary

This audit examined third-party API integrations across TeveroSEO's three main services (apps/web, AI-Writer, open-seo-main) for resilience, error handling, security, and rate limiting. The codebase demonstrates **good security practices overall**, with proper webhook signature verification, encrypted token storage, and circuit breaker patterns already in place.

**Key Findings:**

| Severity | Count | Category |
|----------|-------|----------|
| CRITICAL | 0 | - |
| HIGH | 2 | Error handling, Rate limiting |
| MEDIUM | 5 | Retry logic, Response validation, Logging |
| LOW | 4 | Improvements, Edge cases |

---

## 1. Google APIs (GSC, GA4, OAuth)

### 1.1 Files Examined

- `/AI-Writer/backend/services/gsc_service.py`
- `/AI-Writer/backend/services/client_oauth_service.py`
- `/AI-Writer/backend/api/client_oauth.py`
- `/open-seo-main/src/server/services/analytics/ga4-client.ts`

### 1.2 Findings

#### GOOD: OAuth Token Refresh Handling

**Location:** `gsc_service.py:386-396`

The GSC service properly handles token refresh with appropriate error handling:

```python
if credentials.expired:
    if credentials.refresh_token:
        try:
            credentials.refresh(GoogleRequest())
            self.save_user_credentials(user_id, credentials)
        except Exception as e:
            logger.error(f"Failed to refresh GSC token for user {user_id}: {e}")
            return None
    else:
        logger.warning(f"GSC token expired for user {user_id} but no refresh token available")
        return None
```

**Status:** Properly implemented with fallback handling.

---

#### GOOD: API Timeout Configuration

**Location:** `gsc_service.py:24, 134, 567`

Timeouts are configured for all Google API calls (30 seconds):

```python
GSC_API_TIMEOUT_SECONDS = 30
http = httplib2.Http(timeout=GSC_API_TIMEOUT_SECONDS)
```

**Status:** Timeouts prevent hanging requests.

---

#### GOOD: OAuth State CSRF Protection

**Location:** `client_oauth_service.py:263-276`

OAuth state tokens are stored in database before redirect, preventing CSRF:

```python
# SECURITY: Store state token in database before redirect
state_record = OAuthStateToken(
    state_token=state,
    client_id=client_id,
    flow_type=flow_type,
    invite_token=invite_token,
    created_at=now,
    expires_at=expires_at,  # 10 minute TTL
)
```

**Status:** State validated against DB on callback, single-use enforcement.

---

#### GOOD: Encrypted Token Storage

**Location:** `client_oauth_service.py:514-516`

OAuth tokens are Fernet-encrypted before storage:

```python
existing.access_token = encrypt_value(access_token)
existing.refresh_token = encrypt_value(refresh_token) if refresh_token else None
```

**Status:** Write-only tokens, never exposed in responses.

---

#### MEDIUM: GA4 Client Missing Error Handling

**Location:** `/open-seo-main/src/server/services/analytics/ga4-client.ts:32-70`

The GA4 client lacks try/catch around the API call:

```typescript
export async function fetchGA4Metrics(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<GA4DateMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  // No try/catch, no timeout configuration
  const response = await analyticsdata.properties.runReport({ ... });
  // ...
}
```

**Recommendation:** Add try/catch with proper error categorization (auth errors, quota errors, network errors) and configurable timeout.

---

#### MEDIUM: Missing Retry Logic for Transient Google API Errors

**Location:** `gsc_service.py` - various API call sites

Google API calls don't have retry logic for transient errors (429, 503):

```python
# At lines 777-780, 807-810, etc.
response = service.searchanalytics().query(
    siteUrl=site_url,
    body=request
).execute()  # No retry on transient failure
```

**Recommendation:** Implement exponential backoff retry for status codes 429, 500, 503.

---

#### LOW: OAuth Callback Error Logging Could Be More Specific

**Location:** `client_oauth.py:406-407`

```python
except ValueError as e:
    logger.error(f"OAuth callback error: {e}")
    raise HTTPException(status_code=400, detail=str(e))
```

**Recommendation:** Log more context (state prefix, flow type) without exposing sensitive data.

---

## 2. DataForSEO Integration

### 2.1 Files Examined

- `/AI-Writer/backend/services/scraping/dataforseo_client.py`
- `/AI-Writer/backend/utils/http_client.py`
- `/open-seo-main/src/server/features/keywords/services/TaskRouter.ts`

### 2.2 Findings

#### GOOD: Graceful Degradation

**Location:** `dataforseo_client.py:279-289`

Service gracefully skips when credentials are missing:

```python
async def fetch_all_seo_data(domain: str, url: str) -> dict:
    try:
        _auth()  # check credentials
    except EnvironmentError:
        logger.warning("[DataForSEO] Credentials not set - skipping SEO enrichment")
        return {}
```

**Status:** Properly degrades without crashing.

---

#### GOOD: Circuit Breaker Implementation

**Location:** `http_client.py:601-610`

DataForSEO has a pre-configured resilient client with circuit breaker:

```python
dataforseo_client = ResilientHttpClient(HttpClientConfig(
    base_url="https://api.dataforseo.com",
    timeout_seconds=60.0,
    retries=2,
    retry_delay_seconds=2.0,
    circuit_breaker_threshold=5,
    circuit_breaker_reset_timeout=120.0,
))
```

**Status:** Excellent resilience pattern.

---

#### HIGH: DataForSEO Client Not Using Resilient HTTP Client

**Location:** `dataforseo_client.py:36-48`

The actual DataForSEO client uses raw aiohttp instead of the resilient client:

```python
async def _post(endpoint: str, payload: list) -> dict:
    login, password = _auth()
    url = f"{_BASE_URL}/{endpoint}"
    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            json=payload,
            auth=aiohttp.BasicAuth(login, password),
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            resp.raise_for_status()  # No rate limit handling!
            return await resp.json()
```

**Issues:**
1. No rate limit (429) handling
2. No retry logic for transient errors
3. Basic auth credentials in memory (acceptable but noted)

**Recommendation:** Either:
- Use the `dataforseo_client` from `http_client.py`, or
- Add rate limit detection and exponential backoff retry

---

#### MEDIUM: Response Validation Missing

**Location:** `dataforseo_client.py:78-82, 127-130`

Responses are accessed without schema validation:

```python
items = (
    data.get("tasks", [{}])[0]
    .get("result", [{}])[0]
    .get("items", [])
) if data.get("tasks") else []
```

**Risk:** Malformed responses could cause silent data loss or incorrect processing.

**Recommendation:** Add explicit response structure validation or Pydantic models.

---

#### LOW: API Key Not Exposed in Logs

**Location:** `dataforseo_client.py:112-113`

Error logging is safe:

```python
logger.error(f"[DataForSEO] get_domain_analytics failed for {domain}: {exc}")
```

**Status:** Credentials not logged.

---

## 3. Clerk Authentication

### 3.1 Files Examined

- `/apps/web/src/app/api/webhooks/clerk/route.ts`
- `/apps/web/src/lib/env.ts`
- `/open-seo-main/src/server/middleware/webhook-auth.ts`

### 3.2 Findings

#### GOOD: Webhook Signature Verification

**Location:** `clerk/route.ts:19-58`

Proper Svix signature verification with fail-fast on missing secret:

```typescript
try {
  WEBHOOK_SECRET = getClerkWebhookSecret();
} catch {
  console.error('[ClerkWebhook] CLERK_WEBHOOK_SECRET not configured - rejecting webhook');
  return new NextResponse('Webhook secret not configured', { status: 500 });
}

// ... later ...
try {
  evt = wh.verify(body, {
    'svix-id': svix_id,
    'svix-timestamp': svix_timestamp,
    'svix-signature': svix_signature,
  }) as WebhookEvent;
} catch (err) {
  console.error('[ClerkWebhook] Signature verification failed:', err);
  return new NextResponse('Invalid signature', { status: 400 });
}
```

**Status:** Excellent - fails closed when secret missing.

---

#### GOOD: Environment Validation at Startup

**Location:** `env.ts:27-47`

Required secrets validated with minimum length:

```typescript
CLERK_SECRET_KEY: z.string().min(20, 'CLERK_SECRET_KEY must be at least 20 characters'),
CLERK_WEBHOOK_SECRET: z.string().min(10, 'CLERK_WEBHOOK_SECRET is required for webhook security'),
INTERNAL_API_KEY: z.string().min(32, 'INTERNAL_API_KEY must be at least 32 characters').optional()
  .refine(
    (val) => process.env.NODE_ENV !== 'production' || (val && val.length >= 32),
    'INTERNAL_API_KEY is required in production'
  ),
```

**Status:** Prevents silent security bypasses.

---

#### GOOD: Comprehensive Webhook Auth Middleware

**Location:** `webhook-auth.ts:297-393`

Multi-provider webhook verification with:
- Timing-safe signature comparison
- Timestamp replay protection (300s max age)
- Provider-specific format handling (Stripe, Svix, GitHub)

**Status:** Well-implemented.

---

#### MEDIUM: User Sync Not Implemented

**Location:** `clerk/route.ts:84-137`

User lifecycle handlers are stubs:

```typescript
async function handleUserCreated(data: WebhookEvent['data']) {
  // Future: Sync to local users table if needed
  // await syncUserToDatabase({ userId, email, firstName, lastName });
}

async function handleUserDeleted(data: WebhookEvent['data']) {
  // Future: Clean up user data
  // await cleanupUserData(data.id);
}
```

**Risk:** User deletion in Clerk won't clean up local data, causing orphaned records.

**Recommendation:** Implement cleanup or document as intentional.

---

## 4. Stripe/Payment Integration

### 4.1 Files Examined

- `/AI-Writer/backend/services/subscription/stripe_service.py`
- `/AI-Writer/backend/api/subscription/routes/payment.py`

### 4.2 Findings

#### GOOD: Webhook Signature Verification

**Location:** `stripe_service.py:316-325`

Proper signature verification with SDK:

```python
try:
    event = stripe.Webhook.construct_event(
        payload, sig_header, self.webhook_secret
    )
except ValueError as e:
    logger.error(f"Invalid payload: {e}")
    raise HTTPException(status_code=400, detail="Invalid payload")
except stripe.error.SignatureVerificationError as e:
    logger.error(f"Invalid signature: {e}")
    raise HTTPException(status_code=400, detail="Invalid signature")
```

**Status:** Using official SDK verification.

---

#### GOOD: Idempotency for Webhook Processing

**Location:** `stripe_service.py:336-370`

Events tracked with idempotent processing:

```python
processed_event = self.db.query(ProcessedStripeEvent).filter(
    ProcessedStripeEvent.event_id == event_id
).first()

if processed_event and processed_event.status == "processed":
    logger.info(f"Skipping already processed Stripe event {event_id}")
    return {"status": "success"}
```

**Status:** Prevents duplicate processing on retries.

---

#### GOOD: Rate Limiting on Checkout

**Location:** `payment.py:25-52`

Per-user rate limiting (10 requests/60 seconds):

```python
_checkout_rate_limit_window_seconds = 60
_checkout_rate_limit_max_requests = 10

attempts = _checkout_attempts_by_user[user_id]
window_start = now - _checkout_rate_limit_window_seconds
attempts[:] = [ts for ts in attempts if ts >= window_start]
if len(attempts) > _checkout_rate_limit_max_requests:
    raise HTTPException(status_code=429, detail="Too many checkout attempts")
```

**Status:** Good protection against abuse.

---

#### HIGH: In-Memory Rate Limiting Not Distributed

**Location:** `payment.py:27`

```python
_checkout_attempts_by_user: Dict[str, Any] = defaultdict(list)
```

**Issue:** This in-memory dict won't work across multiple server instances.

**Risk:** Attackers can bypass rate limit by hitting different instances.

**Recommendation:** Move to Redis-based rate limiting for distributed deployments.

---

#### MEDIUM: Webhook Secret Logging

**Location:** `stripe_service.py:312-314`

```python
if not self.webhook_secret:
    logger.warning("STRIPE_WEBHOOK_SECRET not set. Ignoring webhook.")
    return
```

**Issue:** Silently ignoring webhooks when secret not set could cause data sync issues.

**Recommendation:** In production, this should fail loudly (similar to Clerk webhook handling).

---

#### MEDIUM: Missing Subscription State Edge Cases

**Location:** `stripe_service.py:467-483`

```python
async def _handle_invoice_payment_failed(self, invoice: Dict[str, Any]):
    subscription.status = UsageStatus.PAST_DUE
    subscription.is_active = False
```

**Missing handling for:**
- `invoice.upcoming` - warning before failure
- Grace period logic
- Dunning email triggers

**Recommendation:** Consider adding pre-failure warnings and grace period handling.

---

#### LOW: Error Messages Could Leak Implementation Details

**Location:** `stripe_service.py:267`

```python
raise HTTPException(status_code=500, detail=str(e))
```

**Risk:** Raw exception strings could expose internal details.

**Recommendation:** Use generic error messages in production, log details server-side.

---

## 5. Cross-Cutting Concerns

### 5.1 HTTP Client Resilience (GOOD)

**Location:** `/AI-Writer/backend/utils/http_client.py`

The codebase has an excellent `ResilientHttpClient` class with:
- Circuit breaker pattern (lines 56-136)
- Exponential backoff retries with jitter (lines 404-416)
- Configurable timeouts
- Pre-configured clients for major APIs

**Issue:** Not all API integrations use this client (e.g., DataForSEO direct client).

### 5.2 Secrets Management (GOOD)

- OAuth tokens: Fernet encrypted
- API keys: Environment variables only
- Webhook secrets: Validated at startup
- No hardcoded secrets found

### 5.3 Logging Security (GOOD)

- Credentials not logged
- User IDs logged for audit trail
- Structured logging with loguru/custom logger

---

## Recommendations Summary

### High Priority

1. **DataForSEO: Add rate limit handling** - `dataforseo_client.py`
   - Implement 429 detection and exponential backoff
   - Consider using the existing `ResilientHttpClient`

2. **Stripe: Distributed rate limiting** - `payment.py`
   - Move `_checkout_attempts_by_user` to Redis
   - Use sliding window algorithm for accuracy

### Medium Priority

3. **GA4 Client: Add error handling** - `ga4-client.ts`
   - Wrap API calls in try/catch
   - Add timeout configuration

4. **Google APIs: Add retry logic** - `gsc_service.py`
   - Implement retry for 429, 503 errors
   - Use existing circuit breaker pattern

5. **Stripe: Fail loudly on missing webhook secret** - `stripe_service.py`
   - Match Clerk webhook handling pattern

6. **DataForSEO: Response validation** - `dataforseo_client.py`
   - Add Pydantic models for response validation

7. **Clerk: Implement user cleanup** - `clerk/route.ts`
   - Complete `handleUserDeleted` implementation

### Low Priority

8. Improve OAuth callback error logging context
9. Add grace period handling for Stripe subscriptions
10. Sanitize error messages in production responses

---

## Appendix: Files Audited

| File | Lines | Status |
|------|-------|--------|
| `/AI-Writer/backend/services/gsc_service.py` | 1132 | Reviewed |
| `/AI-Writer/backend/services/client_oauth_service.py` | 680 | Reviewed |
| `/AI-Writer/backend/api/client_oauth.py` | 421 | Reviewed |
| `/AI-Writer/backend/services/scraping/dataforseo_client.py` | 315 | Reviewed |
| `/AI-Writer/backend/utils/http_client.py` | 619 | Reviewed |
| `/AI-Writer/backend/services/subscription/stripe_service.py` | 636 | Reviewed |
| `/AI-Writer/backend/api/subscription/routes/payment.py` | 126 | Reviewed |
| `/apps/web/src/app/api/webhooks/clerk/route.ts` | 138 | Reviewed |
| `/apps/web/src/lib/env.ts` | 179 | Reviewed |
| `/open-seo-main/src/server/middleware/webhook-auth.ts` | 464 | Reviewed |
| `/open-seo-main/src/server/services/analytics/ga4-client.ts` | 98 | Reviewed |
| `/open-seo-main/src/server/features/keywords/services/TaskRouter.ts` | 200+ | Partial |

---

## FIXES IMPLEMENTED - 2026-04-28

### DataForSEO (`AI-Writer/backend/services/scraping/dataforseo_client.py`)

- **Added 429 rate limit handling**: The `_post()` function now detects HTTP 429 responses and automatically waits based on the `Retry-After` header (or uses exponential backoff as fallback)
- **Added retry logic**: Up to 3 retries with exponential backoff for rate limits and transient network errors
- **Added global rate limit state**: Tracks `_rate_limit_until` timestamp to proactively wait before making requests when rate limited
- **Added response schema validation**: New `DataForSEOResponse` Pydantic model validates API responses against expected structure
- **Added `RateLimitError` exception**: Custom exception class for rate limit scenarios with `retry_after` attribute

### Stripe (`AI-Writer/backend/api/subscription/routes/payment.py`)

- **Moved rate limiting from in-memory to Redis**: Replaced `_checkout_attempts_by_user` dict with the existing `_rate_limiter` from `middleware/rate_limit.py`
- **Works across multiple server instances**: Uses Redis-backed sliding window algorithm (falls back to in-memory if Redis unavailable)
- **Added rate limit headers**: Response now includes `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers on 429 responses

### GA4 (`open-seo-main/src/server/services/analytics/ga4-client.ts`)

- **Added 30s timeout**: Configured via `GA4_CONFIG.timeoutMs` constant
- **Added retry with exponential backoff**: Up to 3 attempts with jitter (configurable via `GA4_CONFIG`)
- **Added `GA4Error` class**: Custom error class with `code`, `statusCode`, and `retryable` properties for better error handling
- **Retry on transient errors**: Automatically retries on 429, 5xx, and network errors (`ECONNRESET`)
- **Proper error categorization**: Distinguishes between auth errors (401/403), rate limits (429), server errors (5xx), and other failures

---

*End of Audit Report*
