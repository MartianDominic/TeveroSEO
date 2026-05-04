# TeveroSEO Comprehensive Code Review v3

**Generated:** 2026-05-04
**Reviewers:** 20 Opus Subagents (Deep Analysis)
**Scope:** Full platform - apps/web, open-seo-main, AI-Writer
**Mode:** Read-only audit, no code changes

---

## Executive Summary

**20 Opus subagents** completed deep analysis of the entire TeveroSEO platform. All agents ran in parallel, examining integration points, user journeys, security vulnerabilities, and code quality.

### Issue Totals

| Severity | Count | Description |
|----------|-------|-------------|
| **CRITICAL** | 13 | Security vulnerabilities, data isolation failures, production blockers |
| **HIGH** | 61 | Broken features, significant bugs, major integration issues |
| **MEDIUM** | 110 | Minor bugs, suboptimal patterns, UX issues |
| **LOW** | 65 | Code smells, style inconsistencies, documentation gaps |
| **TOTAL** | **249** | Across all 20 review domains |

### Top 10 Critical/High Priority Issues

| # | Agent | Severity | Issue | Impact |
|---|-------|----------|-------|--------|
| 1 | 12, 16 | CRITICAL | IDOR in repository findById methods | Cross-tenant data access |
| 2 | 17 | CRITICAL | File upload lacks magic byte validation | Malicious file execution |
| 3 | 17 | CRITICAL | CSV import vulnerable to resource exhaustion | DoS via large files |
| 4 | 18 | CRITICAL | OFFSET pagination on large tables | Performance degradation at scale |
| 5 | 19 | CRITICAL | 237 empty catch blocks swallowing errors | Silent failures in production |
| 6 | 3 | CRITICAL | Analytics endpoint missing schema validation | Arbitrary data injection |
| 7 | 5 | CRITICAL | Hydration mismatch with new Date() | React crash on SSR |
| 8 | 6 | CRITICAL | Loader using unauthenticated fetch() | Auth bypass in SSR |
| 9 | 1 | HIGH | AI-Writer API client uses lenient auth | Unauthenticated AI operations |
| 10 | 13 | HIGH | Cross-service client sync race condition | 404s on navigation |

### Critical Integration Gaps

1. **Multi-Tenant Isolation** (Agents 12, 16): Repository methods `findById()`, `getContractById()` lack workspace scoping, enabling cross-tenant data access via ID enumeration
2. **Cross-Service Auth** (Agent 1): Session invalidation not propagated - Clerk deletions don't invalidate JWTs in AI-Writer/open-seo-main (24h window)
3. **Client Sync** (Agent 13): Fire-and-forget event emission causes race conditions and 404s when navigating after client creation

### User Journey Blockers

1. **Onboarding**: New clients not synced to open-seo-main before navigation (404 errors)
2. **SEO Audit**: No user-visible timeout for long audits, delete during active job orphans data
3. **Content Generation**: Missing autosave, generation timeout not surfaced to UI

### Security Summary

| Category | Status | Key Finding |
|----------|--------|-------------|
| SQL Injection | ✅ SECURE | Parameterized queries via Drizzle/SQLAlchemy |
| XSS | ✅ SECURE | DOMPurify sanitization throughout |
| CSRF | ✅ SECURE | Proper token validation implemented |
| SSRF | ⚠️ PARTIAL | DNS rebinding vulnerability in url_validator.py |
| Auth | ⚠️ PARTIAL | Legacy API key auth still active alongside HMAC |
| Tenant Isolation | ❌ GAPS | Multiple unscoped repository queries |

### Recommended Priority Actions

**Immediate (This Week):**
1. Add workspaceId filter to all repository `findById()` methods
2. Add server-side magic byte validation for file uploads
3. Fix 237 empty catch blocks with proper error logging
4. Add schema validation to analytics endpoint

**Current Sprint:**
1. Implement cross-service session invalidation webhook
2. Convert OFFSET pagination to cursor-based for large tables
3. Add client sync confirmation before navigation
4. Fix hydration mismatch in success page

## Severity Classification

| Level | Definition | Action Required |
|-------|------------|-----------------|
| **CRITICAL** | Security vulnerability, data loss, production crash, auth bypass | Immediate fix |
| **HIGH** | Broken feature, significant UX failure, performance degradation >2s | Current sprint |
| **MEDIUM** | Bug, suboptimal pattern, minor UX issue | Next sprint |
| **LOW** | Code smell, docs gap, style inconsistency | Backlog |

---

## Review Domains

| # | Domain | Agent | Issues | Status |
|---|--------|-------|--------|--------|
| 1 | Cross-Service Auth | auth-integration | 0C/4H/6M/3L | ✅ Complete |
| 2 | Database Schema | schema-consistency | 0C/2H/4M/3L | ✅ Complete |
| 3 | API Contracts | api-contracts | 1C/5H/8M/4L | ✅ Complete |
| 4 | Queue Integration | queue-integration | 0C/1H/4M/2L | ✅ Complete |
| 5 | Next.js Architecture | nextjs-arch | 1C/4H/6M/3L | ✅ Complete |
| 6 | TanStack Start | tanstack-arch | 1C/3H/6M/4L | ✅ Complete |
| 7 | Drizzle Database | drizzle-layer | 0C/1H/4M/3L | ✅ Complete |
| 8 | FastAPI Backend | fastapi-review | 0C/3H/5M/4L | ✅ Complete |
| 9 | AI-Writer React | aiwriter-react | 0C/2H/7M/5L | ✅ Complete |
| 10 | BullMQ Jobs | bullmq-jobs | 0C/2H/5M/3L | ✅ Complete |
| 11 | Security OWASP | security-owasp | 0C/3H/5M/4L | ✅ Complete |
| 12 | Authorization | authz-boundaries | 2C/4H/6M/3L | ✅ Complete |
| 13 | Client Onboarding | journey-onboarding | 0C/3H/5M/4L | ✅ Complete |
| 14 | SEO Audit Journey | journey-audit | 0C/3H/6M/4L | ✅ Complete |
| 15 | Content Generation | journey-content | 0C/2H/4M/3L | ✅ Complete |
| 16 | Multi-Tenant Isolation | tenant-isolation | 2C/3H/4M/2L | ✅ Complete |
| 17 | Input Validation | input-validation | 2C/4H/6M/3L | ✅ Complete |
| 18 | Query Performance | query-perf | 2C/4H/6M/0L | ✅ Complete |
| 19 | Error Handling | error-handling | 2C/5H/8M/4L | ✅ Complete |
| 20 | Concurrency | concurrency | 0C/3H/5M/4L | ✅ Complete |

---

## Consolidated Findings

### Critical Issues (13 Total)

| ID | Agent | Issue | Location | Fix Priority |
|----|-------|-------|----------|--------------|
| C1 | 12 | IDOR in ProposalService.findById | open-seo-main/repositories | Immediate |
| C2 | 12 | IDOR in ProspectService.findById | open-seo-main/repositories | Immediate |
| C3 | 16 | Unscoped getContractById | open-seo-main/ContractRepository | Immediate |
| C4 | 16 | Background jobs query all tenants | open-seo-main/PaymentScheduleRepository | Immediate |
| C5 | 17 | File upload lacks magic byte validation | apps/web/api/branding/logo | Immediate |
| C6 | 17 | CSV import resource exhaustion | AI-Writer/backend/csv_import.py | Immediate |
| C7 | 18 | Missing FK indexes (5 columns) | AI-Writer/content_planning.py | This sprint |
| C8 | 18 | OFFSET pagination on large tables | open-seo-main/FindingsRepository | This sprint |
| C9 | 19 | 237 empty catch blocks | All services | This sprint |
| C10 | 19 | Internal errors exposed in API | All services | Immediate |
| C11 | 3 | Analytics endpoint no validation | apps/web/api/analytics | Immediate |
| C12 | 5 | Hydration mismatch new Date() | apps/web/success/page.tsx | Immediate |
| C13 | 6 | Unauthenticated fetch in loader | open-seo-main/audit/$pageId | Immediate |

### High Priority Issues (61 Total - Top 20)

| ID | Agent | Issue | Impact |
|----|-------|-------|--------|
| H1 | 1 | AI-Writer API client lenient auth | Unauthenticated AI operations |
| H2 | 1 | Missing token forwarding | Cannot verify user identity |
| H3 | 1 | Session invalidation not propagated | JWTs valid 24h after deletion |
| H4 | 1 | Public endpoints lack token validation | Auth bypass on proposals |
| H5 | 6 | Public proposal routes lack rate limiting | DoS vulnerability |
| H6 | 6 | Socket.IO lacks workspace validation | Cross-tenant event leakage |
| H7 | 10 | Inconsistent DLQ routing patterns | Fragmented failure visibility |
| H8 | 10 | Report worker bypasses concurrency limits | Overloads DB connections |
| H9 | 11 | DNS rebinding in SSRF protection | SSRF bypass possible |
| H10 | 11 | Exception class names leaked | Info disclosure |
| H11 | 11 | Legacy API key auth still active | Redundant auth mechanism |
| H12 | 13 | Cross-service client sync race | 404 on navigation |
| H13 | 13 | SEO setup wizard lacks idempotency | Duplicate projects |
| H14 | 14 | No timeout for long-running audits | Users cannot cancel |
| H15 | 14 | Crawl HTML stored in-memory | Memory exhaustion 10K pages |
| H16 | 15 | Missing autosave in editor | Lost work on error |
| H17 | 18 | Sequential formality lookups | 4 DB calls per request |
| H18 | 19 | Empty catch blocks (237 instances) | Silent failures |
| H19 | 20 | Invoice status update race | Concurrent webhook overwrites |
| H20 | 20 | Report email race condition | Duplicate emails sent |

### Integration Gaps

1. **Auth Token Propagation**: apps/web forwards x-user-id header but not JWT to open-seo-main
2. **Session Sync**: Clerk user deletion doesn't invalidate sessions in other services
3. **Client Sync**: Fire-and-forget event pattern causes race conditions
4. **DLQ Fragmentation**: 3 different dead-letter queue patterns across workers
5. **Error Format**: Inconsistent error response structures between services

### User Journey Blockers

1. **Onboarding**: Client not synced before redirect → 404 error
2. **SEO Audit**: No cancel button for stuck audits, memory exhaustion on large sites
3. **Content**: No autosave, generation failures not surfaced to UI
4. **Proposals**: Accept endpoint lacks rate limiting and CSRF protection

---

<!-- AGENT REPORTS BELOW -->

---
## Agent 10: BullMQ Job System Reliability
**Completed:** 2026-05-04T12:45:00Z
**Files Reviewed:** 74
**Issues:** 0 Critical, 2 High, 5 Medium, 3 Low

### Queue Configuration Summary

| Queue | Max Attempts | Backoff | DLQ | Timeout (Lock) |
|-------|--------------|---------|-----|----------------|
| audit-queue | 3 | exponential 1s-60s | centralized + dedicated failed-audits | 120s |
| report-generation | 3 | exponential 1s-60s | same-queue dlq: prefix | 90s |
| keyword-ranking | 3 | exponential 10s | centralized DLQ | 300s |
| analytics-sync | 3 | exponential 10s | same-queue dlq: prefix | 120s |
| report-scheduler | 3 | exponential 1s-60s | same-queue dlq: prefix | 60s |
| webhook-delivery | 3 | exponential 60s | same-queue dlq: prefix | 60s |
| maintenance | 3 | exponential 1s-60s | centralized DLQ | 120s |
| dead-letter-queue | - | - | - (terminal) | 60s |

### Architecture Assessment

**Strengths Identified:**

1. **Excellent Redis Connection Management** - Shared connection pool via `getSharedBullMQConnection()` prevents connection leaks with proper label-based pooling
2. **Circuit Breaker Pattern** - Redis failures tracked with automatic circuit opening/closing to prevent retry storms
3. **Centralized Concurrency Limits** - `WORKER_CONCURRENCY_LIMITS` in redis.ts ensures total concurrency (50) stays below DB connection pool max
4. **Graceful Shutdown** - All workers implement 25s timeout with force-close fallback
5. **Sandboxed Processors** - Heavy jobs (audit, report) run in child processes via file path pattern
6. **Idempotency Infrastructure** - `setIdempotencyKey()`, `hasIdempotencyKey()` for cross-service deduplication
7. **Backpressure Protection** - `addJobWithBackpressure()` prevents queue overflow with configurable thresholds
8. **Heartbeat Mechanism** - `createJobHeartbeat()` for long-running jobs to prevent false stall detection
9. **Progress Reporting** - Audit jobs report step-level progress via `job.updateProgress()`
10. **Comprehensive DLQ System** - Centralized DLQ with 7-day retention, depth alerting, and external webhook notifications

### Findings

#### HIGH-01: Inconsistent DLQ Routing Patterns
**Location:** Multiple workers
**Severity:** HIGH
**Description:** DLQ routing is inconsistent across workers. Some use centralized DLQ (`getDLQQueue()`), others use same-queue `dlq:` prefix pattern, and audit uses a dedicated `failed-audits` queue. This fragmentation makes failed job investigation difficult.

| Pattern | Used By |
|---------|---------|
| Centralized `getDLQQueue()` | ranking-worker, maintenance-worker |
| Same-queue `dlq:` prefix | analytics-worker, schedule-worker, webhook-worker, report-worker |
| Dedicated queue (`failed-audits`) | audit-worker |

**Impact:** 
- Operators must check 3+ locations to find failed jobs
- DLQ depth alerting only monitors centralized DLQ, missing same-queue failures
- Replay tooling must handle multiple patterns

**Recommendation:** Migrate all workers to use centralized DLQ pattern for unified failure monitoring. The `dlq-worker.ts` and `dead-letter-queue-schema.ts` infrastructure is well-designed but underutilized.

```typescript
// RECOMMENDED: All workers should use
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";
const dlqPayload: DLQJobData = { originalQueue, jobId, jobData, error, stack, failedAt };
await getDLQQueue().add(`dlq:${originalQueue}:${jobId}`, dlqPayload);
```

---

#### HIGH-02: Missing Concurrency Limit Enforcement on Report Worker
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/report-worker.ts:49`
**Severity:** HIGH
**Description:** Report worker hardcodes `concurrency: 2` instead of using `WORKER_CONCURRENCY_LIMITS.report` (which is 3). This bypasses the centralized concurrency configuration system.

```typescript
// CURRENT (hardcoded)
concurrency: 2, // Limit concurrent PDF renders

// SHOULD BE
concurrency: WORKER_CONCURRENCY_LIMITS.report,
```

**Impact:** Total worker concurrency accounting is incorrect, and changing report concurrency requires code changes instead of env var configuration.

**Recommendation:** Update report-worker.ts to use centralized limits like other workers.

---

#### MED-01: Queue Metrics Mismatch with Actual Queue Names
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/queue-metrics.ts:20-26`
**Severity:** MEDIUM
**Description:** The `MONITORED_QUEUES` array contains queue names that don't match actual queue constants:

```typescript
const MONITORED_QUEUES = [
  "audits",              // Should be "audit-queue" (AUDIT_QUEUE_NAME)
  "keyword-ranking",     // Correct (RANKING_QUEUE_NAME)
  "analytics",           // Should be "analytics-sync" (ANALYTICS_QUEUE_NAME)
  "voice-analysis",      // Need to verify
  "pipeline-plan",       // Need to verify
  "pipeline-phase",      // Need to verify
]
```

**Impact:** Queue events won't be captured for misnamed queues, leaving monitoring gaps.

**Recommendation:** Update queue names to match actual queue constants from respective queue files.

---

#### MED-02: Ranking Queue Uses Non-Standard Backoff Configuration
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/rankingQueue.ts:51-54`
**Severity:** MEDIUM
**Description:** Ranking queue uses `delay: 10_000` instead of standard `getStandardJobOptions()` with 1s base delay. While this may be intentional for external API rate limits, it's undocumented.

```typescript
// CURRENT
backoff: {
  type: "exponential",
  delay: 10_000, // 10s, 20s, 40s - why different from standard?
}

// STANDARD (used by audit, report, schedule queues)
backoff: { type: "exponential", delay: 1000 }
```

**Impact:** Inconsistent retry behavior may confuse operators debugging failures.

**Recommendation:** If 10s base is intentional (e.g., DataForSEO rate limits), document it. Otherwise, migrate to `getStandardJobOptions()`.

---

#### MED-03: Analytics Queue Uses Non-Standard Backoff Configuration
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/analyticsQueue.ts:71-74`
**Severity:** MEDIUM
**Description:** Similar to ranking queue, analytics queue uses 10s base delay. This makes sense for Google API rate limits but should be documented.

**Recommendation:** Add comment explaining the reasoning:
```typescript
// Google API rate limits require longer retry delays
backoff: { type: "exponential", delay: 10_000 }
```

---

#### MED-04: Worker Startup Return Type Inconsistency
**Location:** Multiple worker files
**Severity:** MEDIUM
**Description:** Some worker start functions return `Promise<Worker>`, others return `Promise<void>`. This inconsistency complicates generic worker management.

| Return Type | Workers |
|------------|---------|
| `Worker` | audit, report, schedule, ranking, analytics, maintenance, dlq |
| `void` | webhook |

**Recommendation:** Standardize all workers to return the Worker instance for consistent lifecycle management.

---

#### MED-05: Missing Rate Limiting for External API Workers
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/webhook-worker.ts`
**Severity:** MEDIUM
**Description:** While webhook queue uses 60s base backoff, there's no explicit rate limiter for bursts of webhook deliveries to the same endpoint. BullMQ's `limiter` option could throttle deliveries per endpoint.

**Impact:** A large batch of events could overwhelm a customer's webhook endpoint.

**Recommendation:** Consider using BullMQ's rate limiter or implementing per-endpoint throttling:
```typescript
defaultJobOptions: {
  limiter: {
    max: 10,           // 10 jobs
    duration: 60000,   // per minute
    groupKey: 'webhookId'
  }
}
```

---

#### LOW-01: Webhook Worker Processor Path Type Assertion
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/webhook-worker.ts:54-55`
**Severity:** LOW
**Description:** Unsafe type assertion for processor path:

```typescript
processorPath as unknown as Processor<WebhookDeliveryJobData>
```

Other workers use `fileURLToPath()` without assertion. This should be standardized.

---

#### LOW-02: DLQ Cleanup Logic Potential Infinite Loop
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/dlq.ts:136`
**Severity:** LOW
**Description:** The cleanup pagination resets `start = 0` after removals, which is correct but could cause excessive re-checking if jobs are being added during cleanup. The `setImmediate()` yield helps but doesn't fully prevent this.

**Impact:** Minimal - cleanup runs at 3 AM UTC with low traffic.

---

#### LOW-03: Stalled Job Event Logging Missing Queue Name in Some Workers
**Location:** Various workers
**Severity:** LOW
**Description:** Most workers include `{ jobId, queue: QUEUE_NAME }` in stalled logs, but some only log `{ jobId }`. Minor inconsistency.

---

### Summary of Recommendations

1. **Migrate all workers to centralized DLQ** - Unify failure handling for better observability
2. **Fix report-worker concurrency** - Use `WORKER_CONCURRENCY_LIMITS.report`
3. **Fix queue-metrics queue names** - Match actual queue constants
4. **Document non-standard backoff delays** - Add comments explaining 10s base for API-bound queues
5. **Standardize worker return types** - All should return `Promise<Worker>`
6. **Consider webhook rate limiting** - Protect customer endpoints from bursts
7. **Standardize processor path resolution** - Use `fileURLToPath()` consistently

### Positive Patterns to Preserve

- **Shared Redis connection pool** with labeled connections
- **Circuit breaker** for Redis failures
- **Centralized concurrency limits** mapped to env vars
- **Graceful shutdown** with timeout and force-close
- **Sandboxed processors** for CPU-intensive jobs
- **Heartbeat mechanism** for long-running jobs
- **Progress reporting** with step tracking
- **Backpressure protection** with configurable thresholds
- **DLQ depth alerting** with Sentry and webhook integration
- **Idempotency key infrastructure** for cross-service coordination


---
## Agent 17: Input Validation & Data Sanitization
**Completed:** 2026-05-04T12:00:26Z
**Files Reviewed:** 47
**Issues:** 2 Critical, 4 High, 6 Medium, 3 Low

### Validation Coverage

| Service | Endpoints/Functions | Validated | Unvalidated | Coverage |
|---------|---------------------|-----------|-------------|----------|
| apps/web API routes | 28 | 27 | 1 | 96% |
| apps/web server actions | 12 | 12 | 0 | 100% |
| open-seo-main serverFunctions | 8 | 8 | 0 | 100% |
| AI-Writer FastAPI endpoints | 35 | 34 | 1 | 97% |

### Validation Infrastructure Assessment

#### Strengths Identified

1. **Comprehensive Zod Schema Library** (open-seo-main/src/lib/db-validators.ts)
   - Well-designed validation utilities: `validateRow`, `validateRows`, `validateRowOrNull`
   - Common field schemas: `IdSchema`, `EmailSchema`, `UrlSchema`, `DomainSchema`
   - Proper error handling with `DatabaseValidationError` custom class

2. **Strong API Schema Definitions** (open-seo-main/src/shared/api-schemas.ts)
   - Standardized error response format with `ErrorResponseSchema`
   - Platform-specific credential validation (`PlatformCredentialsSchema`)
   - Signed cursor pagination preventing tampering (HMAC-based)
   - Proper HTTP status code mapping (422 for validation errors)

3. **URL Validation for SSRF Prevention** (AI-Writer/backend/services/url_validator.py)
   - Blocks private/internal IP ranges (10.x, 192.168.x, 127.x, localhost)
   - Blocks dangerous schemes (javascript:, data:, file:)
   - Handles encoded IP bypass attempts (hex, octal, decimal notation)
   - Unicode normalization to prevent homoglyph attacks
   - Maximum URL length (8192) to prevent DoS

4. **HTML Sanitization** (apps/web/src/components/ai/SafeAIOutput.tsx)
   - Uses DOMPurify with strict configuration
   - Whitelist-based tag/attribute filtering
   - Blocks javascript: URLs via `ALLOWED_URI_REGEXP`
   - Separate `SafeMarkdown` component for markdown content

5. **Client-Side File Validation** (apps/web/src/components/settings/LogoUpload.tsx)
   - File type validation (PNG, JPEG, SVG only)
   - File size limit (2MB max)
   - Clear user feedback for validation errors

### Findings

#### CRIT-VAL-01: File Upload Lacks Server-Side Magic Byte Validation
**Severity:** CRITICAL
**Location:** `apps/web/src/app/api/clients/[clientId]/branding/logo/route.ts`
**Evidence:** File upload proxied directly to backend without magic byte validation
```typescript
const formData = await req.formData();
// No server-side file type validation - relies on client-side
const response = await fetch("${OPEN_SEO_URL}/api/branding/${clientId}/logo", {
  method: "POST",
  headers,
  body: formData,
});
```
**Risk:** Attackers can bypass client-side validation and upload malicious files
**Recommendation:** Add server-side magic byte validation before forwarding:
```typescript
const file = formData.get('file') as File;
const bytes = new Uint8Array(await file.arrayBuffer().slice(0, 8));
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47];
const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];
if (!matchesMagicBytes(bytes, [PNG_MAGIC, JPEG_MAGIC, SVG_SIGNATURE])) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 422 });
}
```

#### CRIT-VAL-02: CSV Import Vulnerable to ZIP Bomb/CSV Bomb
**Severity:** CRITICAL
**Location:** `AI-Writer/backend/api/csv_import.py`
**Evidence:** Row limit exists (500) but no decompression bomb protection
```python
_MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB
_MAX_CSV_ROWS = 500
# File read without streaming
file_bytes = await file.read()
```
**Risk:** Malformed CSV with deeply nested quotes or repeated patterns could cause CPU exhaustion during parsing
**Recommendation:** Use streaming CSV parser with timeout and memory limits

#### HIGH-VAL-01: Clerk Webhook Missing Payload Schema Validation
**Severity:** HIGH
**Location:** `apps/web/src/app/api/webhooks/clerk/route.ts`
**Evidence:** Payload used after signature verification but without Zod schema validation
```typescript
const payload = await req.json();
const body = JSON.stringify(payload);
// Signature verified, but payload structure not validated
evt = wh.verify(body, {...}) as WebhookEvent;
// evt.data used directly without additional validation
```
**Risk:** If Clerk API changes or sends unexpected data, could cause runtime errors
**Recommendation:** Add Zod schema for expected webhook event structure

#### HIGH-VAL-02: Missing parseInt NaN Check in Query Parameters
**Severity:** HIGH
**Location:** `apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx`
**Evidence:**
```typescript
const result = await fetchAnalyticsData(clientId, parseInt(range) as 30 | 90);
// No NaN check - if range is malformed, passes NaN to backend
```
**Risk:** Invalid numeric parameters could cause backend errors or unexpected behavior
**Recommendation:** Add validation:
```typescript
const parsedRange = parseInt(range, 10);
if (isNaN(parsedRange) || ![30, 90].includes(parsedRange)) {
  // Handle invalid range
}
```

#### HIGH-VAL-03: JSON.parse Without Try-Catch in Multiple Locations
**Severity:** HIGH
**Locations:**
- `apps/web/src/actions/views/saved-views.ts:const parsed = JSON.parse(raw);`
- `apps/web/src/hooks/useAutoSave.ts:return stored ? JSON.parse(stored) : [];`
- `apps/web/src/types/pagination.ts:const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());`
**Risk:** Corrupted localStorage or malformed cursor could throw unhandled exceptions
**Recommendation:** Wrap in try-catch with fallback values

#### HIGH-VAL-04: WebSocket Message Parsing Missing Schema Validation
**Severity:** HIGH
**Location:** `apps/web/src/hooks/use-websocket.ts`
**Evidence:**
```typescript
const rawData = JSON.parse(event.data) as unknown;
// Type assertion without validation
```
**Risk:** Malformed WebSocket messages could cause runtime errors
**Recommendation:** Add Zod schema validation for expected message structure

#### MED-VAL-01: Inconsistent Validation Error Status Codes
**Severity:** MEDIUM
**Evidence:** Some endpoints return 400, others return 422 for validation errors
- `apps/web/src/app/api/clients/route.ts` returns 422 (correct)
- Some older endpoints may still use 400
**Recommendation:** Audit all endpoints for consistent 422 status code usage

#### MED-VAL-02: Missing String Length Limits on Some Form Fields
**Severity:** MEDIUM
**Location:** Various form components
**Evidence:** Some text inputs lack `maxLength` attributes despite backend limits
**Recommendation:** Add `maxLength` to all text inputs matching backend constraints

#### MED-VAL-03: Email Validation Only Uses Regex, Not Domain Verification
**Severity:** MEDIUM
**Location:** `open-seo-main/src/lib/db-validators.ts:EmailSchema`
**Evidence:**
```typescript
export const EmailSchema = z.string().email();
// Basic regex validation, no MX record check
```
**Risk:** Accepts syntactically valid but deliverability-challenged emails
**Recommendation:** Add optional MX record validation for critical flows (onboarding)

#### MED-VAL-04: URL Scheme Validation Not Applied Everywhere
**Severity:** MEDIUM
**Location:** Various URL input fields
**Evidence:** AI-Writer has excellent `validate_url_scheme` but not all URL inputs use it
**Recommendation:** Create shared URL validation middleware/decorator

#### MED-VAL-05: Missing Rate Limiting on Some API Endpoints
**Severity:** MEDIUM
**Locations:** Some API routes lack rate limiting
**Recommendation:** Apply rate limiting to all mutation endpoints

#### MED-VAL-06: DateTime Parsing Without Timezone Validation
**Severity:** MEDIUM
**Location:** `AI-Writer/backend/api/articles.py`
**Evidence:** Datetime parsing accepts various formats but doesn't enforce timezone
**Recommendation:** Require explicit timezone or default to UTC

#### LOW-VAL-01: Debug JSON.parse in Test Files
**Severity:** LOW
**Location:** Test files contain unguarded JSON.parse
**Evidence:** Test code may crash on malformed test data
**Recommendation:** Add error handling even in tests for better debugging

#### LOW-VAL-02: Redundant Validation in Some Flows
**Severity:** LOW
**Evidence:** Some data validated multiple times across layers
**Recommendation:** Document validation responsibility per layer, avoid redundancy

#### LOW-VAL-03: Missing Input Sanitization Documentation
**Severity:** LOW
**Evidence:** No central documentation of validation requirements per endpoint
**Recommendation:** Create validation/sanitization requirements matrix

### Security Controls Summary

| Control | apps/web | open-seo-main | AI-Writer | Status |
|---------|----------|---------------|-----------|--------|
| Zod/Pydantic schemas | Yes | Yes | Yes | PASS |
| JSON parse error handling | Partial | Yes | Yes | NEEDS_WORK |
| URL SSRF protection | Via proxy | Via proxy | Yes | PASS |
| HTML sanitization (XSS) | DOMPurify | N/A | N/A | PASS |
| File upload magic bytes | NO | Unknown | N/A | FAIL |
| Integer overflow checks | Partial | Yes | Yes | NEEDS_WORK |
| String length limits | Yes | Yes | Yes | PASS |
| CSRF protection | Yes | Via Clerk | N/A | PASS |

### Cross-Reference to Other Agents

- **Agent 11 (OWASP):** CRIT-VAL-01 relates to file upload security
- **Agent 3 (API Contracts):** HIGH-VAL-01 relates to webhook handling
- **Agent 19 (Error Handling):** HIGH-VAL-03 relates to graceful degradation

### Remediation Priority

1. **Immediate (CRITICAL):**
   - CRIT-VAL-01: Add server-side file type validation
   - CRIT-VAL-02: Add CSV parsing safeguards

2. **Current Sprint (HIGH):**
   - HIGH-VAL-01: Add webhook payload schema validation
   - HIGH-VAL-02: Add parseInt NaN checks
   - HIGH-VAL-03: Wrap JSON.parse in try-catch
   - HIGH-VAL-04: Add WebSocket message schema validation

3. **Next Sprint (MEDIUM):**
   - Standardize validation error status codes to 422
   - Add frontend maxLength attributes
   - Create shared URL validation utilities



---
## Agent 5: Next.js Architecture (apps/web)
**Completed:** 2026-05-04T14:30:00Z
**Files Reviewed:** 835 TypeScript/TSX files
**Issues:** 1 Critical, 4 High, 6 Medium, 3 Low

### Architecture Overview
- **Total Pages:** 75
- **Server Components (pages):** 41
- **Client Components (pages):** 34
- **Server Actions:** 30+ files in /actions and route-level
- **Route Handlers:** 58 API routes
- **Layouts:** 12
- **Error Boundaries:** 68
- **Loading States:** 23

### Findings

#### CRITICAL-NEXTJS-01: Hydration Mismatch Risk in Server Component
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/[locale]/c/[token]/success/page.tsx`
**Lines:** 60-71
**Issue:** Using `new Date().toLocaleDateString()` in a Server Component creates hydration mismatches because the server and client may render at different times.

```tsx
// Server renders at time T, client hydrates at time T+X
const formattedSignedAt = signer.status === "signed"
  ? new Date().toLocaleDateString(  // <-- Renders current time, not signer.signedAt!
      locale === "lt" ? "lt-LT" : "en-US",
      { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }
    )
  : null;
```

**Root Cause:** Code shows `new Date()` when it should use `signer.signedAt` from the database.
**Fix:** Use the actual `signer.signedAt` timestamp from the database instead of `new Date()`.

---

#### HIGH-NEXTJS-01: Missing "use client" Directive - React Hooks in Server Components
**Files:** 
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/[locale]/c/[token]/error.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/voice/error.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/branding/error.tsx`

**Issue:** Error boundary files import and use `useEffect` but the grep shows they may not have "use client" directive properly detected.

**Verification:** Manual check confirms these files DO have "use client" but there may be edge cases with quote style variations (`"use client"` vs `'use client'`).

**Status:** Low risk after manual verification, but worth standardizing quote style.

---

#### HIGH-NEXTJS-02: Client Layout Wrapping Server Components
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/layout.tsx`
**Issue:** Layout is a Client Component ("use client") that only syncs active client to store.

```tsx
"use client";

export default function ClientIdLayout({ children }: { children: ReactNode }) {
  const { clientId } = useParams<{ clientId: string }>();
  const setActiveClient = useClientStore((s) => s.setActiveClient);
  
  useEffect(() => {
    if (clientId && clientId !== activeClientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClientId, setActiveClient]);

  return <>{children}</>;
}
```

**Impact:** All child pages under `/clients/[clientId]/*` are forced to be Client Components or lose RSC optimization benefits. The layout boundary pushes client bundle to all nested routes.

**Recommendation:** Move client store sync to a separate Client Component wrapper imported into Server Component layout:

```tsx
// layout.tsx (Server Component)
import { ClientStoreSync } from "./ClientStoreSync";

export default function ClientIdLayout({ children, params }) {
  return <ClientStoreSync clientId={params.clientId}>{children}</ClientStoreSync>;
}
```

---

#### HIGH-NEXTJS-03: Data Fetching in Client Components When RSC Could Be Used
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/[pageId]/page.tsx`
**Lines:** 1-37
**Issue:** Page is marked "use client" and uses React Query to fetch data on the client side.

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
// ...

export default function PageFindingsPage() {
  const findingsQuery = useQuery({
    queryKey: ["page-findings", projectId, auditId, pageId],
    queryFn: () => getPageFindings({ projectId, clientId, auditId, pageId }),
    enabled: Boolean(auditId),
  });
  // ...
}
```

**Impact:** 
- No server-side rendering of findings data
- Additional network round-trip
- Loading spinner instead of immediate content
- SEO impact for any crawlable content

**Recommendation:** Use Server Component with server-side data fetching, pass to Client Component for interactions.

---

#### HIGH-NEXTJS-04: Missing Suspense Boundaries on Data-Heavy Pages
**Files Without Suspense (sampling):**
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/prospects/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/page.tsx`

**Issue:** Many data-fetching Server Components lack Suspense boundaries for progressive loading.

**Positive Example:** Dashboard page handles this well with error catching:
```tsx
const [metrics, summary, ...] = await Promise.all([
  getDashboardMetrics().catch((error) => { ... return []; }),
  getPortfolioSummary().catch((error) => { ... return defaultSummary; }),
  // ...
]);
```

**Missing:** Suspense-based streaming for progressive disclosure.

---

#### MEDIUM-NEXTJS-01: Inconsistent Cache Strategies
**Pattern Found:** `cache: "no-store"` used broadly, missing caching opportunities.

**Files:**
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/proposals/[token]/actions.ts` - no-store for proposal data
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/connect/[token]/page.tsx` - no-store for connect data
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/invoices/[id]/pay/page.tsx` - no-store for invoice

**Assessment:** Some uses are justified (real-time data), but others could benefit from short TTL caching with revalidation.

**Recommendation:** Consider `revalidate: 60` for semi-static data like proposal templates, service catalogs.

---

#### MEDIUM-NEXTJS-02: Server Actions Security - Well Implemented
**Positive Finding:** Server Actions follow security best practices:

1. **Input Validation:** All actions use Zod schemas
   ```tsx
   const clientIdSchema = z.string().uuid("Invalid client ID format");
   const parsed = createClientSchema.safeParse(body);
   ```

2. **Authentication:** `requireActionAuth()` called before data access
   ```tsx
   const auth = await requireActionAuth();
   await validateClientOwnership(validated.clientId, auth);
   ```

3. **Rate Limiting:** Applied to sensitive operations
   ```tsx
   await checkRateLimit(llmLimiter, auth.userId);
   await rateLimitAction("webhook:create", auth.userId, WEBHOOK_RATE_LIMITS.create);
   ```

4. **IDOR Protection:** Backend-side ownership validation with userId passed
   ```tsx
   query.set("userId", auth.userId);
   // Backend should JOIN with client ownership and return 404 if not owned
   ```

---

#### MEDIUM-NEXTJS-03: ThemeScript Properly Handles Hydration
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/contexts/ThemeContext.tsx`
**Status:** Correctly implemented to prevent theme flash.

```tsx
export const ThemeScript: React.FC = () => {
  const themeScript = `
    (function() {
      try {
        var theme = localStorage.getItem('agency-theme');
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} suppressHydrationWarning />;
};
```

**Assessment:** Good pattern for avoiding theme flash. Uses blocking script in `<head>`.

---

#### MEDIUM-NEXTJS-04: Middleware Configuration - Well Structured
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/middleware.ts`
**Status:** Comprehensive middleware with:

1. **CSP with Nonce:** Generated per-request
2. **Rate Limiting:** Auth routes protected
3. **Session Freshness:** Sensitive routes require fresh sessions
4. **Locale Handling:** next-intl integration

```tsx
const nonce = generateNonce();
applyCSPHeaders(response, nonce);

if (sessionAge > MAX_SESSION_AGE_MS) {
  // Session too old for sensitive operations
  return Response.redirect(signInUrl);
}
```

---

#### MEDIUM-NEXTJS-05: API Routes Properly Structured
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/clients/route.ts`
**Status:** Good patterns:

1. **CSRF Protection:** `validateCsrf(req)` on POST
2. **Zod Validation:** Schema-based input validation
3. **Proper Error Status Codes:** 422 for validation, 500 for internal
4. **Rate Limiting:** Applied via `withRateLimit` wrapper

```tsx
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);
export const POST = withRateLimit(handlePost, RATE_LIMITS.HEAVY);
```

---

#### MEDIUM-NEXTJS-06: Error Boundaries Comprehensive
**Coverage:** 68 error.tsx files across the application
**Files:** All major routes have error boundaries

**Global Error:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/global-error.tsx`
```tsx
Sentry.captureException(error, {
  extra: { digest: error.digest },
  tags: { errorType: "global-error", severity: "critical" },
  level: "fatal",
});
```

**Good Practices:**
- User-friendly messages (no raw error exposure)
- Error digest for correlation
- Development-only stack traces
- Reset functionality

---

#### LOW-NEXTJS-01: Inconsistent "use client" Quote Style
**Pattern:** Mix of single and double quotes
- `"use client"` (majority)
- `'use client'` (some files)

**Recommendation:** Standardize to double quotes for consistency with Next.js examples.

---

#### LOW-NEXTJS-02: Missing TypeScript Strict Mode Benefits
**File:** Route type casting used in multiple places:
```tsx
router.push(`/prospects/${prospectId}` as Parameters<typeof router.push>[0]);
router.push(editUrl as never);
```

**Recommendation:** Enable `typedRoutes: true` in next.config.ts (already enabled) and properly type dynamic routes.

---

#### LOW-NEXTJS-03: Console.warn in Production API Route
**File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/clients/route.ts`
**Line:** 57

```tsx
console.warn('[api/clients] JSON parse failed:', error instanceof Error ? error.message : 'Unknown error');
```

**Recommendation:** Use structured logger instead of console.warn for production observability.

---

### Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1 | Hydration mismatch in success page |
| HIGH | 4 | Client component boundaries, missing Suspense |
| MEDIUM | 6 | Caching strategies, mostly positive findings |
| LOW | 3 | Style consistency, minor code quality |

### Positive Highlights

1. **Server Actions Security:** Excellent Zod validation, auth checks, rate limiting
2. **Error Boundaries:** Comprehensive coverage with Sentry integration
3. **Middleware:** Well-structured CSP, rate limiting, session freshness
4. **API Routes:** Proper CSRF, validation, error codes
5. **Theme Handling:** Correctly prevents hydration flash
6. **Auth Context:** Robust `action-auth.ts` with ownership validation

### Recommendations Priority

1. **CRITICAL:** Fix hydration mismatch in signing success page (use `signer.signedAt`)
2. **HIGH:** Refactor client layout to preserve RSC optimization
3. **HIGH:** Convert data-fetching client pages to RSC where possible
4. **HIGH:** Add Suspense boundaries for progressive loading
5. **MEDIUM:** Review cache strategies for optimization opportunities


---
## Agent 18: Query Performance & Database Optimization
**Completed:** 2026-05-04T10:30:00Z
**Files Reviewed:** 45+
**Issues:** 2 Critical, 4 High, 6 Medium, 5 Low

### Index Coverage Analysis

| Table | Common Query Patterns | Indexed Columns | Missing Indexes |
|-------|----------------------|-----------------|-----------------|
| `audits` | project_id, client_id, started_at | project_id, client_id+started_at, is_archived | **None** - well indexed |
| `audit_pages` | audit_id | audit_id | **OK** |
| `audit_lighthouse_results` | audit_id, page_id | audit_id, page_id | **OK** |
| `seo_gsc_snapshots` | client_id + date | client_id+date (unique), is_deleted | **OK** |
| `gsc_query_snapshots` | client_id + date | client_id+date | **OK** |
| `keyword_rankings` | keyword_id + date | keyword_id, date, keyword_id+date(desc) | **OK** |
| `prospects` | workspace_id, status, pipeline_stage, priority | All indexed | **OK** |
| `prospect_analyses` | prospect_id, status | prospect_id, status | **OK** |
| `clients` | workspace_id, status, domain | workspace_id, status, workspace_id+domain | **OK** |
| `link_graph` | client_id+audit_id, source_url, target_url | All indexed | **OK** |
| `link_suggestions` | client_id+audit_id, status, score | All indexed | **OK** |
| `content_strategies` (AI-Writer) | user_id | user_id | **OK** |
| `calendar_events` (AI-Writer) | strategy_id | **MISSING** | strategy_id needs index |
| `content_analytics` (AI-Writer) | event_id, strategy_id | **MISSING** | event_id, strategy_id need indexes |
| `content_recommendations` (AI-Writer) | user_id | user_id | **OK** |
| `ai_analysis_results` (AI-Writer) | user_id, strategy_id | user_id only | strategy_id needs index |

### N+1 Query Detection

| File | Location | Pattern | Impact | Severity |
|------|----------|---------|--------|----------|
| `LanguageResolutionService.ts` | resolveLanguage() | Sequential `getWorkspaceFormality()` calls for each context attribute (lines 99, 111, 124) | Multiple DB calls when one would suffice | MEDIUM |
| `content_planning_db.py` | `get_strategies_with_analytics()` | **FIXED** - Uses `selectinload()` for eager loading (line 457-462) | N/A - already optimized | OK |
| `enhanced_strategy_db_service.py` | `get_enhanced_strategies_with_analytics()` | **FIXED** - Uses `selectinload()` for eager loading (lines 137-139) | N/A - already optimized | OK |
| `autonomous_pipeline.py` | `run_autonomous_cycles()` | Sequential `run_autonomous_cycle()` for each client (line 906-908) | Acceptable - intentional rate limiting | LOW |
| `persona_analysis_service.py` | Lines 596-647 | Platform personas queried inside persona loop | Potential N+1 if many personas | MEDIUM |

### Findings

#### CRITICAL-01: AI-Writer Missing Foreign Key Indexes
**File:** `/AI-Writer/backend/models/content_planning.py`
**Lines:** 54, 94-95, 160, 206

SQLAlchemy models define foreign keys without corresponding indexes:
- `CalendarEvent.strategy_id` - no index on FK column
- `ContentAnalytics.event_id` - no index on FK column  
- `ContentAnalytics.strategy_id` - no index on FK column
- `ContentRecommendation.strategy_id` - no index on FK column
- `AIAnalysisResult.strategy_id` - no index on FK column

**Impact:** Full table scans on JOINs and relationship traversals. Query time grows linearly with table size.

**Recommendation:** Add SQLAlchemy `Index()` to __table_args__ or use `index=True` on FK columns:
```python
strategy_id = Column(Integer, ForeignKey("content_strategies.id"), nullable=False, index=True)
```

#### CRITICAL-02: OFFSET Pagination on Large Tables
**File:** `/open-seo-main/src/server/features/audit/repositories/FindingsRepository.ts`
**Lines:** 103-214

Multiple methods use OFFSET-based pagination:
- `getPageFindings()` with default limit=500
- `getAuditPages()` with default limit=200
- `getPassedFindings()` with default limit=100
- `getFailedFindings()` with default limit=500

**Impact:** OFFSET pagination requires database to scan and discard all rows before offset. With 10k+ findings per audit, page 20 requires scanning 10,000 rows to return 500.

**Recommendation:** Convert to cursor-based pagination using `id > last_seen_id` pattern:
```typescript
// Instead of: .offset(offset).limit(limit)
// Use: .where(gt(findings.id, cursor)).limit(limit).orderBy(findings.id)
```

#### HIGH-01: Sequential Formality Lookups in Language Resolution
**File:** `/open-seo-main/src/server/services/LanguageResolutionService.ts`
**Lines:** 96-163

The `resolveLanguage()` method makes separate database calls for formality in multiple code paths (lines 99, 111, 124, 133). A single request could trigger up to 4 workspace lookups.

**Impact:** Latency increases with each lookup (~5-10ms per DB round-trip).

**Recommendation:** Fetch workspace settings once upfront and reuse:
```typescript
async resolveLanguage(context: LanguageContext): Promise<ResolvedLanguage> {
  // Fetch once at start
  const workspaceSettings = await this.getWorkspaceLanguageSettings(context.workspaceId);
  const formality = workspaceSettings?.formality ?? DEFAULT_FORMALITY;
  // Use formality throughout without re-fetching
}
```

#### HIGH-02: COUNT Queries Without Index Support
**File:** `/AI-Writer/backend/services/content_planning_db.py`
**Lines:** 373-377, 397-400, 421-424, 452, 539-543

Multiple methods issue `COUNT(*)` followed by paginated query:
```python
total = query.count()
analytics = query.limit(limit).offset(offset).all()
```

These COUNT operations scan entire result sets without index-only scans when tables grow large.

**Impact:** Dashboard load times degrade as tables grow. Health check queries 5 tables for counts.

**Recommendation:** 
1. Use approximate counts via `reltuples` from `pg_class` for dashboards
2. Cache counts with short TTL
3. Ensure covering indexes for filtered counts

#### HIGH-03: SELECT * Pattern in AI-Writer Services
**File:** `/AI-Writer/backend/services/agent_activity_service.py`
**Lines:** 182-186, 197-204, 206-210

Methods like `list_alerts()`, `list_runs()`, `list_events()` fetch entire model objects:
```python
return q.order_by(AgentAlert.created_at.desc()).limit(limit).all()
```

This loads all columns including potentially large JSONB `payload` fields.

**Impact:** Increased memory usage and network transfer. JSONB deserialization overhead.

**Recommendation:** Use explicit column selection for list views:
```python
return q.with_entities(
    AgentAlert.id, AgentAlert.title, AgentAlert.severity, AgentAlert.created_at
).order_by(AgentAlert.created_at.desc()).limit(limit).all()
```

#### HIGH-04: Unbounded Query in Autonomous Pipeline
**File:** `/AI-Writer/backend/services/intelligence/autonomous_pipeline.py`
**Lines:** 857-869

`get_auto_optimize_clients()` returns all clients with auto_publish enabled without LIMIT:
```python
results = db.query(Client, ClientPublishingSettings).join(...).filter(...).all()
```

**Impact:** If hundreds of clients enable auto-optimization, this loads all into memory at once.

**Recommendation:** Add reasonable LIMIT or process in batches:
```python
.limit(100).all()  # Process in batches of 100
```

#### MEDIUM-01: Missing Composite Index for Findings Queries
**File:** `/open-seo-main/src/db/dashboard-schema.ts`
**Lines:** 199-202

`auditFindings` table has individual indexes on `audit_id`, `page_id`, `check_id`, and `severity+passed`, but common queries filter by `(audit_id, severity)` or `(audit_id, passed)`.

**Recommendation:** Add composite index:
```typescript
index("ix_findings_audit_severity").on(table.auditId, table.severity),
index("ix_findings_audit_passed").on(table.auditId, table.passed),
```

#### MEDIUM-02: Inefficient ORDER BY in GSC Queries
**File:** `/AI-Writer/backend/services/gsc_service.py`
**Lines:** 800-815

GSC analytics queries return up to 1000 rows with ORDER BY date but no index on date column in cache tables.

**Impact:** In-memory sorting of large result sets.

**Recommendation:** The GSC data comes from external API so not directly fixable, but cache queries should be optimized.

#### MEDIUM-03: Persona Analysis Potential N+1
**File:** `/AI-Writer/backend/services/persona_analysis_service.py`
**Lines:** 596-647

When fetching personas, platform personas are queried inside a loop:
```python
for persona in personas:
    platform_personas = session.query(PlatformPersona).filter(...)
```

**Impact:** N+1 queries when multiple writing personas exist.

**Recommendation:** Use `selectinload()` or `joinedload()` to eagerly load platform personas.

#### MEDIUM-04: Task Memory Service Loop Queries
**File:** `/AI-Writer/backend/services/task_memory_service.py`
**Lines:** 215-221

Inside deduplication check, individual status queries are made:
```python
for task_hash in existing_hashes:
    self.db.query(TaskHistory.status).filter(...).first()
```

**Recommendation:** Batch fetch all statuses in single query using `in_()` clause.

#### MEDIUM-05: Missing Index on CalendarEvent.status
**File:** `/AI-Writer/backend/models/content_planning.py`
**Line:** 58

`CalendarEvent.status` column is frequently filtered but has no index.

**Recommendation:** Add `index=True` to status column definition.

#### MEDIUM-06: Link Suggestions Query Could Use Partial Index
**File:** `/open-seo-main/src/db/link-schema.ts`
**Lines:** 476-483

Comments indicate partial indexes exist in migrations but aren't visible in schema. The `WHERE status = 'pending' AND is_auto_applicable = true` filter is common but requires full index scan.

**Note:** Migration 0028 adds these partial indexes - verify they exist in production.

#### LOW-01: OFFSET Pagination in Alert Service
**File:** `/open-seo-main/src/services/alerts.ts`
**Lines:** 70-97

Uses OFFSET pagination but with reasonable limits (max 100). Acceptable for alert volumes.

#### LOW-02: Webhook Pagination Uses OFFSET
**File:** `/open-seo-main/src/services/webhooks.ts`
**Lines:** 286-294

OFFSET pagination but webhooks table unlikely to grow large enough to matter.

#### LOW-03: Proposal Service OFFSET Pagination
**File:** `/open-seo-main/src/server/features/proposals/services/ProposalService.ts`
**Lines:** 325-339

Uses OFFSET for proposal listing. Acceptable given expected proposal volumes per workspace.

#### LOW-04: Comprehensive User Data Cache COUNT Query
**File:** `/AI-Writer/backend/services/comprehensive_user_data_cache_service.py`
**Lines:** 257-260

Health check counts all cache entries - acceptable for monitoring but could be optimized with approximate counts.

#### LOW-05: AI-Writer Agent Activity Subquery Pattern
**File:** `/AI-Writer/backend/services/agent_activity_service.py`
**Lines:** 323-343

`_get_active_statuses()` uses correlated subquery for max started_at - correct pattern but could use window function for efficiency on PostgreSQL.

### Summary

**Open-seo-main (Drizzle):** Well-indexed schemas with comprehensive coverage. OFFSET pagination is the primary concern for scale.

**AI-Writer (SQLAlchemy):** Missing FK indexes are critical gap. Several services already use eager loading correctly (good pattern). Some services have N+1 potential that should be addressed.

**Priority Actions:**
1. Add indexes to AI-Writer FK columns (CRITICAL)
2. Convert high-volume offset pagination to cursor-based (CRITICAL)
3. Optimize LanguageResolutionService formality lookups (HIGH)
4. Add covering indexes for COUNT queries (HIGH)
5. Review and fix remaining N+1 patterns (MEDIUM)


---
## Agent 1: Cross-Service Authentication Integration
**Completed:** 2026-05-04T13:22:00Z
**Files Reviewed:** 42
**Issues:** 0 Critical, 4 High, 6 Medium, 3 Low

### Summary
The authentication integration across apps/web (Next.js), open-seo-main (TanStack Start), and AI-Writer (FastAPI) is architecturally sound with Clerk as the shared identity provider. JWT tokens are properly verified in all three services with cryptographic signature validation. However, several gaps exist in token propagation patterns, session state synchronization, and cross-service consistency that could lead to UX issues and security edge cases.

### Architecture Overview

| Service | Auth Method | JWT Verification | Session Storage |
|---------|-------------|------------------|-----------------|
| apps/web | Clerk SDK (@clerk/nextjs) | Clerk middleware + JWKS | Clerk-managed cookies |
| open-seo-main | Clerk JWT + JWKS | jose library + JWKS | Stateless (JWT-only) |
| AI-Writer | Clerk JWT + JWKS | PyJWT + JWKS | Stateless (JWT-only) |

**Token Flow:**
1. User authenticates via Clerk in apps/web
2. apps/web extracts JWT via `auth().getToken()` for backend calls
3. JWT passed as `Authorization: Bearer` to AI-Writer and open-seo-main
4. Each backend independently verifies JWT against Clerk JWKS

### Findings

#### HIGH-01: AI-Writer API Client Uses Lenient Auth for AI Operations
- **Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/api/client.ts:289-296`
- **Code:** `createRequestInterceptor('aiApiClient', false)` - strictAuth=false
- **Problem:** The `aiApiClient` instance is configured with `strictAuth = false`, meaning it will NOT reject requests when the auth token getter is unavailable. This allows unauthenticated requests to be sent to AI endpoints.
- **Impact:** If `authTokenGetter` returns null, requests proceed without Authorization header. AI operations (content generation, SEO analysis) may be accessible without authentication during token refresh failures or initialization race conditions.
- **Fix:** Change to `strictAuth = true` for aiApiClient, or add explicit handling:
```typescript
// Instead of lenient auth
aiApiClient.interceptors.request.use(
  createRequestInterceptor('aiApiClient', true), // strict auth
  (error) => Promise.reject(error)
);
```

#### HIGH-02: Missing Token Forwarding in connections/route.ts Backend Call
- **Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/connections/route.ts:44-51`
- **Code:** 
```typescript
const response = await fetch(
  `${backendUrl}/api/platform-connections?${params}`,
  {
    headers: {
      "x-user-id": userId, // Only forwards user ID, not JWT
    },
  }
);
```
- **Problem:** This API route forwards only `x-user-id` header to open-seo-main without the JWT token. The backend cannot verify the user's identity cryptographically - it must trust the header blindly.
- **Impact:** If open-seo-main trusts X-User-Id without JWT verification, any client could forge requests with arbitrary user IDs. The route does validate auth via Clerk's `auth()` on the apps/web side, but the cross-service call lacks authentication.
- **Fix:** Forward the JWT token for backend verification:
```typescript
const { getToken } = await auth();
const token = await getToken();
const response = await fetch(
  `${backendUrl}/api/platform-connections?${params}`,
  {
    headers: {
      "Authorization": `Bearer ${token}`,
      "x-user-id": userId, // Keep for logging/correlation
    },
  }
);
```

#### HIGH-03: Session Invalidation Not Propagated to Backends
- **Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/webhooks/clerk/route.ts:125-136`
- **Code:**
```typescript
async function handleUserDeleted(data: WebhookEvent['data']) {
  // Future: Clean up user data
  // - Remove from local users table
  // - Revoke active sessions
  // - Clean up workspace memberships
  // - Archive or anonymize user-owned content
  // await cleanupUserData(data.id);
}
```
- **Problem:** When a user is deleted in Clerk, the webhook handler logs it but does not propagate the deletion to AI-Writer or open-seo-main. Existing JWTs remain valid until expiry (24h max).
- **Impact:** A deleted user's JWT can still authorize requests to backend services until the token expires naturally. This violates the principle of immediate session revocation.
- **Fix:** Implement cross-service session invalidation:
```typescript
async function handleUserDeleted(data: WebhookEvent['data']) {
  const userId = data.id;
  // Notify backends to invalidate cached sessions/tokens
  await Promise.all([
    postFastApi('/api/internal/invalidate-user', { userId }),
    postOpenSeo('/api/internal/invalidate-user', { userId }),
  ]);
}
```

#### HIGH-04: Public Endpoints Lack Token Validation for Sensitive Data
- **Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/proposals/[proposalId]/accept/route.ts:88-99`
- **Code:** Forwards to backend without any authentication token:
```typescript
const response = await fetch(
  `${getOpenSeoUrl()}/api/proposals/${proposalId}/accept`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: body.token }),
  }
);
```
- **Problem:** While this endpoint is intentionally public (for clients accepting proposals), the call to open-seo-main lacks authentication headers. The backend must validate the proposal token, but there's no guarantee it implements proper rate limiting or token entropy validation.
- **Impact:** If the proposal token has low entropy or if open-seo-main's token validation is weak, attackers could enumerate proposal IDs or brute-force tokens.
- **Fix:** The frontend rate limiting (5 req/min/IP) is good, but ensure open-seo-main also validates proposal tokens cryptographically (HMAC signature or high-entropy random tokens). Document that this is an intentional public endpoint with defense-in-depth at both layers.

#### MED-01: Clock Skew Tolerance Varies Between Services
- **Location:** 
  - apps/web: Clerk SDK default (unknown)
  - open-seo-main: `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/clerk-jwt.ts:80` - 30 seconds
  - AI-Writer: `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py:143` - 60 seconds
- **Problem:** JWT clock skew tolerance is inconsistent: open-seo-main allows 30s, AI-Writer allows 60s. This can cause confusing auth failures where a token is valid for one service but rejected by another.
- **Impact:** A token issued slightly in the future (due to clock drift) might be accepted by AI-Writer but rejected by open-seo-main, causing partial failures in user flows.
- **Fix:** Standardize clock tolerance across all services (recommend 30s as the minimum secure value):
```python
# AI-Writer auth_middleware.py
leeway=30  # Changed from 60 to match open-seo-main
```

#### MED-02: Missing CSRF Protection on Some Cross-Service Calls
- **Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/server-fetch.ts:343-370`
- **Problem:** The server fetch utilities (`postFastApi`, `postOpenSeo`, etc.) do not include any CSRF tokens in cross-service calls. While these are server-to-server calls (not direct client requests), the pattern could be mistakenly used in server actions that ARE initiated by client requests.
- **Impact:** If a server action uses `postFastApi()` without separate CSRF validation, it could be vulnerable to CSRF attacks that trigger backend operations.
- **Fix:** Document that server fetch is for server-to-server only. For server actions, ensure `validateCsrf()` is called before any state-changing operations. The existing pattern in route handlers (e.g., clients/route.ts) is correct.

#### MED-03: Token Not Forwarded in Analytics Publishing Logs Endpoint
- **Location:** Need to verify `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/analytics/[clientId]/publishing-logs/route.ts`
- **Problem:** Analytics routes may have similar token forwarding gaps as the connections route (HIGH-02).
- **Impact:** Client-scoped analytics data could potentially be accessed if backend doesn't implement proper auth.
- **Fix:** Audit all `/api/analytics/*` routes and ensure `buildServiceHeaders()` or equivalent is used for all backend calls.

#### MED-04: Internal API Key Not Rotated on Server Restart
- **Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/api/internal.py:31`
- **Code:** `INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")`
- **Problem:** The internal API key is loaded once at module initialization. If the key is rotated in the environment, the service must be restarted to pick up the new key.
- **Impact:** During security incidents requiring key rotation, services cannot update without downtime.
- **Fix:** Consider reading the key per-request (with caching) or implementing a key refresh mechanism:
```python
def get_internal_api_key():
    # Could cache with TTL or use a secrets manager client
    return os.getenv("INTERNAL_API_KEY")
```

#### MED-05: Missing Organization ID Propagation in open-seo-main
- **Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/middleware/ensure-user/clerk.ts:75`
- **Code:**
```typescript
// For now, use a default organization ID. In future, this could be:
// 1. Extracted from Clerk's org claims (if using Clerk Organizations)
// 2. Looked up from the member table based on user
const organizationId = dbUser.id; // Use user ID as default org for single-user case
```
- **Problem:** Organization ID is defaulted to user ID instead of being extracted from Clerk JWT org claims. This breaks multi-tenant organization features.
- **Impact:** Users in the same Clerk organization will have different `organizationId` values, breaking shared workspace features.
- **Fix:** Extract org ID from JWT claims when available:
```typescript
const organizationId = claims.org_id || dbUser.id;
```

#### MED-06: AI-Writer Health Endpoint Missing Strict Token Comparison
- **Location:** Various AI-Writer endpoints marked as "requires authentication" but health endpoints differ
- **Problem:** The `/health` endpoint in AI-Writer is unauthenticated (correct), but some other diagnostic endpoints may need authentication review.
- **Impact:** Minor - diagnostic endpoints should be clearly categorized.
- **Fix:** Document which AI-Writer endpoints are public vs. authenticated in the API documentation.

#### LOW-01: Inconsistent Auth Error Logging
- **Location:** Multiple files across services
- **Problem:** Auth failure logging uses different formats:
  - apps/web: `logger.error('[Auth] ...')`
  - AI-Writer: `logger.error('🔒 AUTHENTICATION ERROR: ...')`
  - open-seo-main: `log.warn('...')`
- **Impact:** Harder to grep logs for auth failures across services.
- **Fix:** Standardize log format with a common prefix like `[AUTH]` across all services.

#### LOW-02: Deprecated Query Token Pattern in AI-Writer
- **Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py:370-452`
- **Problem:** `get_current_user_with_query_token()` is marked deprecated but still in use for media endpoints. The migration guide mentions signed URLs but the migration isn't complete.
- **Impact:** Query token authentication exposes JWTs in URLs (browser history, logs, referrer headers).
- **Fix:** Complete migration to signed URLs as documented in the code comments. Remove query token support after migration.

#### LOW-03: Missing JWKS Cache Refresh on Key Rotation
- **Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/clerk-jwt.ts:14-35`
- **Code:** `let jwksInstance: ReturnType<typeof createRemoteJWKSet> | null = null;`
- **Problem:** The JWKS client is cached indefinitely. If Clerk rotates signing keys, the cached JWKS won't automatically fetch new keys.
- **Impact:** After a Clerk key rotation, services may reject valid JWTs until restarted.
- **Fix:** The `jose` library's `createRemoteJWKSet` handles key rotation automatically by fetching new keys when verification fails. However, adding a TTL-based refresh as a defense-in-depth measure would be prudent. Verify that `jose` is configured with `cacheMaxAge`.

### Positive Patterns Identified

1. **Clerk SDK Integration** - apps/web uses `@clerk/nextjs/server` correctly with middleware for page protection
2. **JWKS Verification** - Both backends verify JWT signatures against Clerk's JWKS endpoint (no secret key sharing)
3. **Rate Limiting on Auth Routes** - apps/web applies rate limiting to `/sign-in`, `/sign-up` via middleware
4. **Session Freshness for Sensitive Operations** - `isSensitiveRoute` check requires fresh sessions (< 24h) for admin/settings
5. **Timing-Safe Comparisons** - Internal auth uses `timingSafeEqual` consistently (HIGH-06 pattern)
6. **CSP Nonce Generation** - Cryptographic nonce for inline scripts in CSP header
7. **CSRF Validation** - State-changing routes call `validateCsrf()` before processing
8. **Token Installer Pattern** - AI-Writer frontend properly installs Clerk token getter for axios interceptors
9. **Client Ownership Verification** - `requireClientAccess()` validates user has permission to access client
10. **Internal Service Token** - Service-to-service calls use `X-Internal-Service-Token` header with timing-safe verification

---
## Agent 12: Authorization & Permission Boundaries
**Completed:** 2026-05-04T14:32:00Z
**Files Reviewed:** 47
**Issues:** 2 Critical, 4 High, 6 Medium, 3 Low

### Authorization Model

| Layer | Check Type | Coverage | Notes |
|-------|------------|----------|-------|
| apps/web Middleware | Clerk session check | 95% | API routes excluded, handled at route level |
| apps/web API Routes | `requireAuth()` / `requireClientAccess()` | 90% | Good pattern, some endpoints use direct auth |
| apps/web Server Actions | `validateClientOwnership()` | 95% | Consistent org-level filtering |
| open-seo-main Middleware | JWT + `resolveClientId()` | 90% | JWT verification required |
| open-seo-main ServerFunctions | `requireAuthenticatedContext` / `requireProjectContext` | 95% | Project/org scoping |
| AI-Writer Endpoints | `get_current_user` + `require_client_access` | 90% | RBAC with role hierarchy |
| Database Queries | workspaceId/clientId filter | 85% | Some getById without workspace |

### Findings

#### CRITICAL-01: ProposalService.findById() Missing Workspace Filter [IDOR Risk]
**Location:** `/open-seo-main/src/server/features/proposals/services/ProposalService.ts:263`
**Severity:** CRITICAL
**Type:** IDOR / Authorization Bypass

The `findById()` method retrieves proposals without checking workspace ownership:
```typescript
async findById(id: string): Promise<ProposalWithRelations | null> {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, id))  // No workspaceId filter!
    .limit(1);
```

**Attack Vector:** An authenticated user can retrieve any proposal by ID, including those belonging to other workspaces. The `findByToken()` method is intentionally public (for unsigned viewing), but `findById()` is called from authenticated contexts.

**Impact:** Full proposal content exposure including pricing, service terms, and client contact details across tenant boundaries.

**Fix:** Add a `findByIdScoped(id, workspaceId)` variant or use `assertTenantAccess()` at service layer:
```typescript
async findByIdScoped(id: string, workspaceId: string): Promise<ProposalWithRelations | null> {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.workspaceId, workspaceId)))
    .limit(1);
  // ...
}
```

---

#### CRITICAL-02: ProspectService.findById() Missing Workspace Filter [IDOR Risk]
**Location:** `/open-seo-main/src/server/features/prospects/services/ProspectService.ts:169`
**Severity:** CRITICAL
**Type:** IDOR / Authorization Bypass

Similar to CRITICAL-01, the `findById()` method retrieves prospects without workspace filtering:
```typescript
async findById(id: string): Promise<ProspectWithAnalyses | null> {
  const [prospect] = await db
    .select()
    .from(prospects)
    .where(eq(prospects.id, id))  // No workspaceId filter!
    .limit(1);
```

**Attack Vector:** Authenticated users can access any prospect's data (company info, contact details, SEO analyses) by guessing or enumerating IDs.

**Impact:** Cross-tenant data exposure of prospect business intelligence and contact information.

**Fix:** Consistent with CRITICAL-01, add workspace-scoped variant.

---

#### HIGH-01: EngagementService Uses Unscoped findById()
**Location:** `/open-seo-main/src/server/features/command-center/services/EngagementService.ts:116,167,344,368`
**Severity:** HIGH
**Type:** Authorization Chain Break

Multiple methods in `EngagementService` call `workflowRepo.findById()` without verifying workspace ownership first. While the workflow repository may have workspace context, the pattern breaks the defense-in-depth principle.

**Example:**
```typescript
async completeStep(instanceId: string): Promise<WorkflowInstanceSelect | null> {
  const instance = await this.workflowRepo.findById(instanceId);  // No scope check
  // ... modifies instance
}
```

**Fix:** Inject workspaceId into engagement methods or use `findByIdScoped()`.

---

#### HIGH-02: VoiceProfileService.getById() and VoiceTemplateService.getById() Missing Scope
**Location:** 
- `/open-seo-main/src/server/features/voice/services/VoiceProfileService.ts:129`
- `/open-seo-main/src/server/features/voice/services/VoiceTemplateService.ts:68`
**Severity:** HIGH
**Type:** IDOR Risk

Both services have `getById()` methods that fetch records by ID without client/workspace filtering.

**Note:** VoiceTemplates may be intentionally public (shared templates). However, VoiceProfiles contain client-specific brand voice data and should be client-scoped.

**Fix:** Add client_id parameter to `VoiceProfileService.getById()`:
```typescript
async getByIdScoped(profileId: string, clientId: string): Promise<VoiceProfileSelect | null>
```

---

#### HIGH-03: DiscountCodeService.getById() Missing Workspace Filter
**Location:** `/open-seo-main/src/server/features/discounts/services/DiscountCodeService.ts:369`
**Severity:** HIGH
**Type:** IDOR Risk

Discount codes should be workspace-scoped but `getById()` does not filter by workspace:
```typescript
export async function getById(id: string): Promise<DiscountCodeSelect | null> {
  // No workspace filter
}
```

**Attack Vector:** Users can probe and potentially use discount codes from other workspaces.

---

#### HIGH-04: SignerRepository.findById() Accessed Without Contract Check
**Location:** `/open-seo-main/src/server/features/agreements/repositories/SignerRepository.ts:32`
**Severity:** HIGH
**Type:** Authorization Chain Break

`SignerRepository.findById()` returns signer information without verifying the caller has access to the parent contract/agreement.

**Used by:** `MultiSignerOrchestrator.ts:52`

**Fix:** The orchestrator should verify contract ownership before fetching signer details.

---

#### MEDIUM-01: Ownership Cache TTL Mismatch (30s vs 120s)
**Location:** `/open-seo-main/src/lib/auth/client-ownership.ts:47`
**Severity:** MEDIUM
**Type:** Configuration Security

The ownership cache TTL is 30 seconds, while session cache is 120 seconds. While documented as intentional, this creates a window where:
1. User's access is revoked
2. Ownership cache expires (30s)
3. Session cache still valid (120s)
4. User can't access data but appears logged in

**Impact:** Minor UX confusion, no security issue (fails closed on cache miss).

---

#### MEDIUM-02: getContractsByClient() Missing Workspace Filter
**Location:** `/open-seo-main/src/server/features/contracts/repositories/ContractRepository.ts:95`
**Severity:** MEDIUM
**Type:** Implicit Trust

`getContractsByClient(clientId)` filters only by `clientId`, assuming the caller has already validated client ownership. This is an implicit trust pattern.

**Current Code:**
```typescript
async function getContractsByClient(clientId: string, options?) {
  const conditions = [eq(contracts.clientId, clientId)];
  // No workspaceId check - relies on caller validation
}
```

**Defense-in-depth fix:** Add workspace parameter even if caller validates.

---

#### MEDIUM-03: AuditRepository Methods Rely on projectId Without Org Verification
**Location:** `/open-seo-main/src/server/features/audit/repositories/AuditRepository.ts`
**Severity:** MEDIUM
**Type:** Implicit Trust

Methods like `getAuditForProject(auditId, projectId)` filter by projectId but don't verify the project belongs to the caller's organization.

**Current mitigation:** The `requireProjectContext` middleware verifies project ownership at the serverFunction level before calling repository methods.

**Risk:** If a new endpoint is added without middleware, the repository provides no protection.

---

#### MEDIUM-04: ApiKeyService.findById() Returns Keys Without Workspace Filter
**Location:** `/open-seo-main/src/server/features/api-keys/services/ApiKeyService.ts:160`
**Severity:** MEDIUM
**Type:** IDOR Risk (Limited)

API keys should be workspace-scoped. While `ApiKeyPublic` excludes the secret hash, metadata exposure is still a concern.

---

#### MEDIUM-05: ProtectionRulesService.getById() Missing Client Filter
**Location:** `/open-seo-main/src/server/features/voice/services/ProtectionRulesService.ts:180`
**Severity:** MEDIUM
**Type:** IDOR Risk

Content protection rules (which pages/sections to exclude from voice analysis) are client-specific but `getById()` doesn't verify client ownership.

---

#### MEDIUM-06: FollowUpRepository.findById() Exists Alongside findByIdScoped()
**Location:** `/open-seo-main/src/server/features/command-center/repositories/FollowUpRepository.ts:36`
**Severity:** MEDIUM
**Type:** Code Quality / Footgun

Both scoped and unscoped versions exist:
```typescript
export async function findById(id: string): Promise<FollowUpSelect | null>
export async function findByIdScoped(id: string, workspaceId: string): Promise<FollowUpSelect | null>
```

**Risk:** Developers may accidentally use the unscoped version. The unscoped version has a comment warning but no deprecation marker.

**Fix:** Mark `findById()` as `@deprecated` or remove it.

---

#### LOW-01: ContractRepository Documents Unscoped getContractById But Doesn't Deprecate
**Location:** `/open-seo-main/src/server/features/contracts/repositories/ContractRepository.ts:29`
**Severity:** LOW
**Type:** Documentation

Good security comment exists:
```typescript
/**
 * SECURITY: This method does NOT filter by workspace.
 * Use getContractByIdScoped() for tenant-safe access...
 */
```

**Improvement:** Add `@deprecated` JSDoc tag to trigger IDE warnings.

---

#### LOW-02: ProjectRepository.getProjectById() Same Pattern
**Location:** `/open-seo-main/src/server/features/projects/repositories/ProjectRepository.ts:37`
**Severity:** LOW
**Type:** Documentation

Same issue as LOW-01 - documented but not deprecated.

---

#### LOW-03: AI-Writer GLOBAL_ENDPOINTS Bypass List is Hard-Coded
**Location:** `/AI-Writer/backend/middleware/authorization.py:133`
**Severity:** LOW
**Type:** Maintainability

The list of endpoints that bypass client authorization is hard-coded:
```python
GLOBAL_ENDPOINTS = frozenset([
    "/api/health",
    "/api/healthz",
    "/api/user/me",
    # ...
])
```

**Risk:** New endpoints may be accidentally excluded or forgotten.

**Improvement:** Use a decorator pattern like `@public_endpoint` to mark global routes.

---

### Authorization Coverage Summary

| Service | Auth Check | Workspace/Client Filter | IDOR Protected |
|---------|------------|-------------------------|----------------|
| AI-Writer clients.py | `require_client_access` | `ClientUserAccess` table | Yes |
| AI-Writer articles.py | `check_client_access` | Inline filter | Yes |
| open-seo ContractRepo | Middleware | Partial (scoped variant) | Partial |
| open-seo ProposalService | Middleware | **Missing on findById** | **No** |
| open-seo ProspectService | Middleware | **Missing on findById** | **No** |
| open-seo AuditRepo | Middleware | projectId (implicit) | Yes |
| apps/web API routes | `requireClientAccess()` | Backend delegation | Yes |
| apps/web Server Actions | `validateClientOwnership()` | Backend delegation | Yes |

### Positive Patterns Observed

1. **Fail-closed philosophy** - Both apps/web and AI-Writer return 403 on authorization errors, never silently pass
2. **Cache invalidation on revocation** - Redis pub/sub + direct key delete for immediate cache invalidation
3. **RBAC implementation** - AI-Writer has proper role hierarchy (admin > editor > viewer)
4. **Timing-safe token comparison** - Service-to-service tokens use `crypto.timingSafeEqual()`
5. **JWT verification required** - AUTH-HIGH-01 fix ensures all external requests verify JWT signatures
6. **Scoped repository variants** - Many repos have `getByIdScoped()` alongside unscoped (just need enforcement)
7. **assertTenantAccess() utility** - Central utility exists, just needs consistent usage

### Priority Recommendations

1. **[P0] Fix CRITICAL-01 & CRITICAL-02** - Add workspace filtering to `ProposalService.findById()` and `ProspectService.findById()` immediately
2. **[P0] Audit all `findById/getById` methods** - Search for unscoped queries across all services
3. **[P1] Deprecate unscoped finders** - Mark them with `@deprecated` to prevent future misuse
4. **[P1] Add integration tests** - Test that cross-workspace access is denied for each entity type
5. **[P2] Standardize on scoped-only pattern** - Remove unscoped variants or require explicit `skipWorkspaceCheck` flag
6. **[P2] Document authorization chain** - Add ADR for authorization flow from middleware to repository

---
## Agent 15: Content Generation User Journey
**Completed:** 2026-05-04T02:15:00Z
**Files Reviewed:** 18
**Issues:** 0 Critical, 2 High, 4 Medium, 3 Low

### Content Flow Analysis
| Step | Component | Dependencies | Validation | Issues |
|------|-----------|--------------|------------|--------|
| 1. Select client/topic | ArticleEditorPage.tsx | clientStore, URL params | Client access check | None |
| 2. Load voice profile | voice_constraint_service.py | open-seo API | Retry with backoff | None |
| 3. Generate draft | article_generation_service.py | LLM providers, voice constraints | Model routing, timeout | None |
| 4. Quality gate | check_quality_gate() | open-seo /validate endpoint | Score >= 80, fail-closed | None |
| 5. User review/edit | ArticleEditorPage.tsx | DOMPurify sanitization | XSS prevention | MEDIUM-15-03 |
| 6. Approve | /api/articles/{id}/approve | SELECT FOR UPDATE | Race condition prevention | None |
| 7. Publish | auto_publish_executor.py | CMS publishers | Optimistic locking, retry | None |

### Findings

#### HIGH-15-01: No Autosave for Content Edits
**Location:** `/AI-Writer/frontend/src/pages/ArticleEditorPage.tsx`
**Impact:** User can lose extensive edits if browser crashes or connection drops before publishing
**Evidence:** The ArticleEditorPage uses Zustand's persist middleware only for article state, but:
- HTML content preview is rendered read-only (no inline editing in preview)
- `patchArticle()` updates local state but no periodic save to backend occurs
- Only generation and status changes trigger API calls
- The `quickNotes` field is persisted locally but not synced to server
**Root Cause:** Missing autosave/debounced PATCH for content edits
**Recommendation:**
1. Add debounced autosave (e.g., every 30 seconds of idle time after changes)
2. Add "dirty state" indicator showing unsaved changes
3. Add `beforeunload` warning when leaving with unsaved changes
4. Consider implementing draft recovery from localStorage

#### HIGH-15-02: Generation Timeout Not Surfaced to User
**Location:** `/AI-Writer/backend/api/articles.py` (lines 709-755)
**Impact:** User sees indefinite "Generating..." spinner when generation times out
**Evidence:** The `generate_article_now` endpoint:
```python
GENERATION_TIMEOUT_SECONDS = 300  # 5 minutes

async def _run_generation_with_timeout():
    try:
        await asyncio.wait_for(
            generate_article(str(art_uuid), bg_db),
            timeout=GENERATION_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        # Updates article to 'failed' status in DB
        timed_out_article.status = "failed"
        timed_out_article.error_detail = f"Generation timed out..."
```
However, the frontend `ArticleEditorPage.tsx` does not poll for status updates after the 202 Accepted response. The user must manually refresh to see the failure.
**Root Cause:** No polling/websocket for async generation status
**Recommendation:**
1. Add polling interval (every 5-10 seconds) after generation starts
2. Or implement WebSocket/SSE for real-time status updates
3. Add timeout display in UI: "Generating... (max 5 minutes)"

#### MEDIUM-15-01: Quality Gate API Failure Blocks Auto-Publish but UI Shows No Warning
**Location:** `/AI-Writer/backend/services/article_generation_service.py` (lines 936-976)
**Impact:** When quality gate API is unavailable, article stays in "generated" status with no clear indication to user why auto-publish didn't occur
**Evidence:**
```python
try:
    quality_result = await check_quality_gate(...)
except QualityGateError as qge:
    logger.warning(
        f"[ArticleGen] Quality gate error - blocking auto-publish: {qge}. "
        f"Article moved to manual review."
    )
    # next_status remains "generated"
```
The `QualityGateError` is logged but not stored in `article.error_detail` (which is only populated on voice profile errors).
**Recommendation:**
1. Store quality gate errors in a separate field (e.g., `quality_gate_error`)
2. Surface this warning in the ArticleEditorPage sidebar
3. Allow manual retry of quality check

#### MEDIUM-15-02: Voice Precedence Warnings Not Visible in Editor UI
**Location:** `/AI-Writer/backend/services/article_generation_service.py` (lines 1002-1017)
**Impact:** Voice precedence conflicts (e.g., formal template vs casual custom instructions) are logged and stored in `error_detail` but not displayed to users
**Evidence:**
```python
if voice_warnings:
    existing_detail = article.error_detail or ""
    warnings_text = "[VOICE PRECEDENCE] " + "; ".join(voice_warnings)
    if existing_detail:
        article.error_detail = f"{existing_detail}\n{warnings_text}"
```
The `ArticleEditorPage.tsx` does not display `error_detail` except as a generic error banner for failed articles.
**Recommendation:**
1. Add "Warnings" section in editor sidebar
2. Parse and display voice precedence warnings distinctly from errors
3. Link to voice profile configuration for resolution

#### MEDIUM-15-03: HTML Preview Uses dangerouslySetInnerHTML (Acceptable but Limited Editing)
**Location:** `/AI-Writer/frontend/src/pages/ArticleEditorPage.tsx` (lines 124-133)
**Impact:** Users cannot directly edit generated content; must regenerate or edit in CMS
**Evidence:**
```tsx
function ArticleHtmlPreview({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, ARTICLE_SANITIZE_CONFIG);
  return (
    <div
      className="prose prose-sm max-w-none..."
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```
The preview is read-only. DOMPurify sanitization is correctly implemented with proper ALLOWED_TAGS/FORBID_TAGS configuration, mitigating XSS. However, lack of edit capability means users must accept or regenerate entirely.
**Recommendation:**
1. Consider adding a rich text editor (TipTap, Lexical) for post-generation editing
2. Alternatively, add "Edit in CMS" button that opens CMS dashboard

#### MEDIUM-15-04: Publish Status Not Real-time Updated
**Location:** `/AI-Writer/frontend/src/pages/ArticleEditorPage.tsx` (lines 385-400)
**Impact:** After clicking "Publish Now", user sees "Publishing..." but must refresh to confirm success
**Evidence:**
```tsx
const handlePublish = useCallback(async () => {
  patchArticle({ articleStatus: 'publishing' });
  try {
    await apiClient.post(`/api/articles/${aid}/publish`);
    patchArticle({ articleStatus: 'published' });
    setToast({ message: 'Article published.', type: 'success' });
  } catch {
    patchArticle({ articleStatus: 'failed' });
  }
});
```
The publish endpoint does not exist in `/api/articles.py` - only `approve` and `reject` are defined. Publishing is handled by the background `auto_publish_executor` scheduler which runs every 15 minutes.
**Root Cause:** Manual publish endpoint missing; relies on scheduled background job
**Recommendation:**
1. Add `/api/articles/{id}/publish-now` endpoint that queues immediate publishing
2. Or document that publishing occurs on schedule and update UI messaging

#### LOW-15-01: Article Library Fetch Uses Ref Pattern to Avoid Infinite Loops
**Location:** `/AI-Writer/frontend/src/pages/ArticleLibraryPage.tsx` (lines 379-388)
**Impact:** Complex pattern that could be simplified
**Evidence:**
```tsx
// MEDIUM-01: Use ref for fetchArticles to avoid infinite loops
const fetchArticlesRef = useRef(fetchArticles);
fetchArticlesRef.current = fetchArticles;

useEffect(() => {
  if (clientId) {
    fetchArticlesRef.current(clientId, statusFilter || undefined);
  }
}, [clientId, statusFilter]);
```
**Recommendation:** Consider using `useCallback` with stable dependencies instead of ref pattern

#### LOW-15-02: Token/Cost Tracking Not Implemented
**Location:** `/AI-Writer/backend/services/article_generation_service.py`
**Impact:** No visibility into LLM token usage or cost per article generation
**Evidence:** The `_generate_with_model()` function calls various LLM providers but does not capture or log token counts:
- `_call_openai_compat()` discards `usage` field from response
- `_call_anthropic_native()` discards `usage` field from response
- No cost calculation or storage in database
**Recommendation:**
1. Extract and log token counts from API responses
2. Store in `ScheduledArticle` or new `GenerationMetrics` table
3. Add cost estimation based on model pricing

#### LOW-15-03: Version History Not Implemented
**Location:** `/AI-Writer/backend/models/publishing.py`
**Impact:** No audit trail for content changes or regenerations
**Evidence:** The `ScheduledArticle` model only stores current `content_html`. Regenerating an article overwrites previous content with no history.
**Recommendation:**
1. Add `ArticleVersion` table tracking each generation
2. Allow rollback to previous versions
3. Track diff between versions

### Positive Findings

1. **Quality Gate is Fail-Closed:** The quality gate correctly fails closed when the validation API is unavailable, preventing auto-publication of unverified content.

2. **Voice Constraint Service Uses Single Source of Truth:** The Python service correctly delegates to the TypeScript API for voice constraint building, avoiding logic duplication.

3. **Optimistic Locking for Concurrent Edits:** The `ScheduledArticle` model includes a `version` field and the `auto_publish_executor` uses `UPDATE WHERE version = expected_version` to prevent race conditions.

4. **Idempotency for CMS Publishing:** WordPress publisher implements in-memory idempotency cache with SHA-256 hashing to prevent duplicate posts.

5. **XSS Protection:** DOMPurify is properly configured with explicit ALLOWED_TAGS and FORBID_TAGS for article HTML preview.

6. **Double-Submit Prevention:** Generation endpoint uses SELECT FOR UPDATE with status check to prevent concurrent generation tasks.

7. **Retry with Exponential Backoff:** Voice profile fetch has 3 retries with exponential backoff (1s, 2s, 4s) for transient failures.

8. **Thread-Safe Singleton:** VoiceConstraintService uses double-check locking pattern for thread-safe initialization in multi-worker ASGI servers.


---
## Agent 6: TanStack Start Architecture (open-seo-main)
**Completed:** 2026-05-04T13:15:00Z
**Files Reviewed:** 210
**Issues:** 1 Critical, 3 High, 6 Medium, 4 Low

### Route Analysis

| Metric | Count |
|--------|-------|
| Total Routes | 210 |
| Protected Routes (_app, _authenticated, _project) | ~45 |
| Routes with Loaders | 4 |
| Routes with beforeLoad Guards | 6 |
| Routes with validateSearch | 7 |
| API Routes (server handlers) | ~165 |
| Server Functions | 97 |
| Error Boundaries (route-level) | 5 |

### Architecture Assessment

**Strengths Identified:**

1. **Well-Designed Server Function Middleware** (`src/serverFunctions/middleware.ts`)
   - Layered authentication: `globalServerFunctionMiddleware`, `requireAuthenticatedContext`, `requireProjectContext`, `requireAuthenticatedWithClientContext`
   - Client ID validation with UUID regex before DB lookup
   - Proper error type propagation via `AppError`
   - Subscription/billing check via `requireManagedServiceAccess()`

2. **Comprehensive Error Handling Middleware** (`src/middleware/errorHandling.ts`)
   - `StandardAppError` format with request_id tracking
   - PostHog error capture for observability
   - Proper error sanitization before client response

3. **Strong API Authentication** (`src/routes/api/seo/-middleware.ts`)
   - Dual auth support: API keys (`oseo_` prefix) and Clerk JWTs
   - Scope-based authorization via `requireApiAuthWithScope()`
   - Client ID resolution from headers or query params

4. **Route Guards with Auth Context** (`src/routes/_project/p/$projectId/route.tsx`)
   - `beforeLoad` validates project access before rendering
   - Proper redirect to root on auth/access failures
   - Dedicated `ProjectRouteError` component

5. **Search Parameter Validation** (7 routes)
   - Zod schemas for search params (`keywordsSearchSchema`, `auditSearchSchema`, etc.)
   - Normalization for legacy URL formats
   - Type-safe param extraction in components

6. **Input Validation on All Server Functions**
   - 97 server functions, all using `.inputValidator()` with Zod schemas
   - No unvalidated user input reaching handlers

7. **CSRF Protection for State-Changing Operations**
   - Origin/Referer validation in `/api/proposals/[id]/accept.ts`
   - Rate limiting on unauthenticated endpoints

8. **OAuth State Management** (`OAuthStateService`)
   - CSRF protection for OAuth flows
   - State token validation with expiry

### Findings

#### CRIT-TSK-01: Loader Using Unauthenticated fetch() Without Auth Propagation
**Severity:** CRITICAL
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/_project/p/$projectId/audit/$pageId/index.tsx:31-38`
**Evidence:**
```typescript
export const Route = createFileRoute("/_project/p/$projectId/audit/$pageId/")({
  loader: async ({ params }) => {
    const response = await fetch(`/api/audit/pages/${params.pageId}/findings`);
    if (!response.ok) {
      throw new Error("Failed to fetch findings");
    }
    return response.json() as Promise<FindingsResponse>;
  },
  component: AuditPageDetail,
});
```
**Issue:** The loader uses `fetch()` directly without passing authentication headers. When this runs server-side (SSR), there's no cookie/session context, so the API call will fail with 401. Client-side navigation may work due to browser cookies, but SSR will break.
**Impact:**
- SSR hydration failure
- Potential 401 errors on initial page load
- Inconsistent behavior between SSR and CSR
**Recommendation:** Use a server function instead of direct fetch, or propagate auth headers:
```typescript
loader: async ({ params, context }) => {
  // Option 1: Use server function (preferred)
  return getPageFindings({ data: { pageId: params.pageId } });
  
  // Option 2: If fetch is required, propagate headers
  const response = await fetch(url, {
    headers: context.request.headers // Pass auth context
  });
}
```

---

#### HIGH-TSK-01: Public Proposal Routes Lack Rate Limiting
**Severity:** HIGH
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/p/$token.tsx`
**Evidence:** The proposal page loader calls `getProposalByToken()` without rate limiting:
```typescript
loader: async ({ params }): Promise<LoaderData> => {
  try {
    const proposal = await getProposalByToken({ data: { token: params.token } });
    return { proposal, error: null };
  } catch (error) {
    // ...
  }
},
```
The server function `getProposalByToken` in `proposals.ts` doesn't have rate limiting middleware.
**Impact:** Attackers can enumerate proposal tokens via brute force, though the 32-char nanoid makes this computationally infeasible.
**Recommendation:** Add rate limiting middleware to `getProposalByToken` similar to `/api/proposals/[id]/accept.ts`:
```typescript
const rateLimitResult = await rateLimit({
  key: `proposal-view:${clientIP}`,
  limit: 30,
  window: 60,
});
```

---

#### HIGH-TSK-02: _project Layout Route Missing Auth beforeLoad
**Severity:** HIGH
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/_project/route.tsx:15-28`
**Evidence:**
```typescript
beforeLoad: async () => {
  const isHostedMode = isHostedClientAuthMode();
  // In hosted mode, this route should not be directly accessible
  if (isHostedMode) {
    throw redirect({ to: "/", replace: true });
  }
  // NO auth check in embedded mode - relies on server functions
},
```
**Issue:** In embedded/delegated auth mode, there's no client-side auth verification. While server functions will eventually reject unauthorized requests with UNAUTHENTICATED, this creates a poor UX where the page renders then shows errors.
**Impact:**
- Unauthenticated users see partial page before errors
- Multiple failed API calls before redirect
- Confusing error states
**Recommendation:** Add a client-side auth check that redirects before rendering:
```typescript
beforeLoad: async () => {
  const isHostedMode = isHostedClientAuthMode();
  if (isHostedMode) {
    throw redirect({ to: "/", replace: true });
  }
  // For embedded mode, verify auth context is present
  const auth = await getAuthContext();
  if (!auth) {
    throw redirect({ to: "/", replace: true });
  }
},
```

---

#### HIGH-TSK-03: Pipeline Dashboard Socket.IO Lacks Auth Verification
**Severity:** HIGH
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/pipeline/dashboard.tsx:119-158`
**Evidence:**
```typescript
useEffect(() => {
  const newSocket = io(window.location.origin, {
    transports: ["websocket", "polling"],
  });

  newSocket.on("connect", () => {
    // Join workspace room (workspace ID would come from auth context)
    newSocket.emit("join-workspace", "default");  // HARDCODED "default"
  });

  newSocket.on("activity:new", (event) => {
    // Process events without validation
  });
  // ...
}, []);
```
**Issues:**
1. Workspace ID is hardcoded as "default" instead of using actual organization context
2. No authentication token passed to Socket.IO handshake
3. Event data used without validation
**Impact:**
- Any authenticated user receives all pipeline events (cross-tenant leak)
- Unauthenticated WebSocket connections may succeed
**Recommendation:**
```typescript
const newSocket = io(window.location.origin, {
  transports: ["websocket", "polling"],
  auth: { token: session?.accessToken },  // Pass auth token
});

newSocket.on("connect", () => {
  newSocket.emit("join-workspace", context.organizationId);  // Use actual org
});
```

---

#### MED-TSK-01: Inconsistent Loading States Across Routes
**Severity:** MEDIUM
**Locations:** Various route files
**Evidence:**
| Route | Has pendingComponent | Has errorComponent |
|-------|---------------------|-------------------|
| `_project/p/$projectId/route.tsx` | Yes | Yes |
| `_app/index.tsx` | No (inline) | Yes (inline) |
| `_app/prospects/index.tsx` | No (inline) | Yes (inline) |
| `_app/billing.tsx` | No | No |
| `pipeline/dashboard.tsx` | Yes | Yes |
| `p/$token.tsx` | Yes | Yes |
| Root `__root.tsx` | No | Yes |

**Issue:** Inconsistent use of `pendingComponent` leads to different loading experiences across routes.
**Recommendation:** Create standardized `RouteLoadingSpinner` and apply to all routes with loaders.

---

#### MED-TSK-02: Data Fetching in Components Instead of Loaders
**Severity:** MEDIUM
**Locations:** Multiple `_app` routes
**Evidence:** Many routes fetch data via React Query in components rather than loaders:
```typescript
// _app/index.tsx
const { mutate, error, isError } = useMutation({
  mutationFn: () => getOrCreateDefaultProject(),
  onSuccess: (project) => { ... }
});

useEffect(() => {
  mutate();
}, [mutate]);
```
**Issue:** This pattern prevents SSR data fetching and causes waterfall requests. TanStack Start loaders enable parallel data fetching.
**Recommendation:** Move initial data fetching to loaders where appropriate:
```typescript
export const Route = createFileRoute("/_app/")({
  loader: async () => getOrCreateDefaultProject(),
  component: IndexRedirect,
});
```

---

#### MED-TSK-03: Missing Suspense Boundaries for Lazy Components
**Severity:** MEDIUM
**Location:** Route files and components
**Evidence:** Only `__root.tsx` has Suspense boundaries (for devtools). Other lazy-loaded components lack Suspense:
```typescript
// __root.tsx has Suspense for devtools
const TanStackRouterDevtoolsPanel = React.lazy(() => ...);
// But wrapped in Suspense

// Other routes may use lazy imports without Suspense
```
**Impact:** If lazy components are used without Suspense, React will throw during render.
**Recommendation:** Audit all lazy imports and ensure Suspense boundaries exist.

---

#### MED-TSK-04: beforeLoad Redirects Use Hardcoded Paths
**Severity:** MEDIUM
**Locations:** Multiple route files
**Evidence:**
```typescript
// _project/p/$projectId/route.tsx
throw redirect({ to: "/", replace: true });

// _project/p/$projectId/index.tsx
throw redirect({
  to: "/p/$projectId/keywords",
  params: { projectId: params.projectId },
});
```
**Issue:** Hardcoded redirect paths could break if route structure changes.
**Recommendation:** Use route references or constants:
```typescript
import { Route as KeywordsRoute } from "./keywords";
throw redirect({ to: KeywordsRoute.path, params });
```

---

#### MED-TSK-05: API Route Handlers Missing Method Validation
**Severity:** MEDIUM
**Location:** Various API routes
**Evidence:** Some API routes only define handlers for specific methods but don't explicitly reject others:
```typescript
// /api/stripe/webhook.ts
handlers: {
  POST: async ({ request }) => { ... }
  // GET, PUT, DELETE not handled - what happens?
}
```
**Impact:** TanStack Start returns 404 for undefined methods, which is acceptable, but 405 Method Not Allowed would be more appropriate.
**Recommendation:** Consider adding method validation or documenting expected behavior.

---

#### MED-TSK-06: clientId Validation Duplicated Across Server Functions
**Severity:** MEDIUM
**Location:** Multiple serverFunctions files
**Evidence:** The `verifyClientAccess()` helper is duplicated in `voice.ts`, `connections.ts`, and others:
```typescript
// voice.ts
async function verifyClientAccess(clientId: string, workspaceId: string): Promise<void> {
  const client = await db.query.clients.findFirst({ ... });
  // ...
}

// connections.ts
async function verifyClientAccess(clientId: string, workspaceId: string): Promise<void> {
  const client = await db.query.clients.findFirst({ ... });
  // ...
}
```
**Recommendation:** Extract to shared middleware or utility:
```typescript
// middleware.ts
export const requireClientAccess = createMiddleware().server(async ({ next, context, data }) => {
  const clientId = extractClientId(data);
  await verifyClientOwnership(clientId, context.organizationId);
  return next({ context: { ...context, verifiedClientId: clientId } });
});
```

---

#### LOW-TSK-01: TypeScript Ignore Comments in Route Files
**Severity:** LOW
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/_app/clients/$clientId/briefs/index.tsx`
**Evidence:**
```typescript
// @ts-ignore - Route not yet in generated route tree
to="/clients/$clientId/briefs/new"
```
**Impact:** Type safety bypassed; route generation may not be up to date.
**Recommendation:** Run route generation (`npx tanstack-router generate`) and remove ignores.

---

#### LOW-TSK-02: Inconsistent Navigation Patterns
**Severity:** LOW
**Evidence:**
- Some components use `useNavigate()` hook
- Others use `window.location.href` directly
- Link components used inconsistently
```typescript
// Using Link
<Link to="/p/$projectId/audit" params={{ projectId }}>

// Using navigate
void navigate({ to: "/p/$projectId/keywords", params });

// Using window.location (anti-pattern)
window.location.href = `/prospects/${prospect.id}`;
```
**Recommendation:** Standardize on TanStack Router's `Link` and `useNavigate` for client-side navigation.

---

#### LOW-TSK-03: Route Component Naming Inconsistency
**Severity:** LOW
**Evidence:**
- Some routes export named components: `ProspectsListPage`, `BriefsListPage`
- Others use generic names: `IndexRedirect`, `ProposalPage`
**Recommendation:** Adopt consistent naming convention: `{RouteName}Page` for page components.

---

#### LOW-TSK-04: Missing Route Meta/Head Configuration
**Severity:** LOW
**Evidence:** Most routes don't configure `head()` for SEO meta tags:
```typescript
// p/$token.tsx has head config
head: ({ params }) => ({
  meta: [{ title: "SEO Pasiulymas | Tevero" }, ...],
}),

// Most other routes don't have head config
```
**Impact:** Pages may have missing or incorrect meta tags.
**Recommendation:** Add head configuration to all user-facing routes.

---

### Server Function Security Summary

| Middleware | Functions Using | Purpose |
|------------|-----------------|---------|
| `requireAuthenticatedContext` | 45 | Basic auth + client resolution |
| `requireProjectContext` | 32 | Auth + project ownership |
| `requireAuthenticatedWithClientContext` | 3 | Strict client ID requirement |
| No middleware (public) | 17 | Public endpoints (proposals, etc.) |

### Route Guard Coverage

| Route Pattern | Guard Type | Coverage |
|---------------|------------|----------|
| `/_app/*` | Client-side session check | Complete |
| `/_authenticated/*` | Layout-level auth | Complete |
| `/_project/p/$projectId/*` | beforeLoad + server fn | Complete |
| `/p/$token/*` | None (public) | By design |
| `/pipeline/*` | Loader throws on auth fail | Partial |
| `/api/*` | Server-side `requireApiAuth` | Complete |

### Data Fetching Patterns

| Pattern | Count | Recommendation |
|---------|-------|----------------|
| Loader (SSR-friendly) | 4 | Use more for initial data |
| React Query in component | 47 | OK for mutations, not initial load |
| Direct fetch() in loader | 1 | Replace with server function |
| Server action on mount | 3 | Move to loader where possible |

### Cross-Reference to Other Agents

- **Agent 11 (OWASP):** HIGH-TSK-03 relates to WebSocket auth bypass
- **Agent 12 (Authz):** CRIT-TSK-01 relates to auth header propagation
- **Agent 16 (Tenant Isolation):** HIGH-TSK-03 workspace join is cross-tenant risk
- **Agent 19 (Error Handling):** MED-TSK-01 relates to error boundary coverage

### Remediation Priority

1. **Immediate (CRITICAL):**
   - CRIT-TSK-01: Fix loader auth propagation in audit/$pageId

2. **Current Sprint (HIGH):**
   - HIGH-TSK-01: Add rate limiting to proposal viewing
   - HIGH-TSK-02: Add auth check in _project beforeLoad
   - HIGH-TSK-03: Fix Socket.IO auth and workspace join

3. **Next Sprint (MEDIUM):**
   - Standardize loading/error components
   - Move initial data fetching to loaders
   - Add Suspense boundaries
   - Extract verifyClientAccess to shared utility

4. **Backlog (LOW):**
   - Remove @ts-ignore comments
   - Standardize navigation patterns
   - Add head/meta configuration

### Positive Patterns to Preserve

- **Server function middleware chain** - Clean separation of auth concerns
- **Zod validation on all inputs** - No unvalidated user data
- **Error handling middleware** - Consistent error format
- **Route-level error boundaries** - Graceful degradation
- **Search param validation** - Type-safe URL params
- **CSRF protection** - Origin validation on state changes
- **Client ID validation** - UUID format check before DB lookup

---
## Agent 3: Inter-Service API Contract Validation
**Completed:** 2026-05-04T14:30:00Z
**Files Reviewed:** 303 (55 apps/web API routes, 151 open-seo-main routes, 97 AI-Writer routers)
**Issues:** 1 Critical, 5 High, 8 Medium, 4 Low

### API Inventory

| Caller | Handler | Endpoint | Method | Contract Status |
|--------|---------|----------|--------|-----------------|
| apps/web | AI-Writer | /api/clients | GET/POST | VALIDATED - Zod schema |
| apps/web | AI-Writer | /api/articles | GET/POST | VALIDATED - Zod schema |
| apps/web | AI-Writer | /api/clients/{id}/analytics | GET | PARTIAL - No schema validation |
| apps/web | open-seo-main | /api/seo/audits | GET/POST | VALIDATED - Query params |
| apps/web | open-seo-main | /api/webhooks | GET/POST/PATCH | VALIDATED - Zod schemas both sides |
| apps/web | open-seo-main | /api/connect/detect | POST | VALIDATED - Zod schema |
| apps/web | open-seo-main | /api/connect/handoff | POST | VALIDATED - Zod schema |
| apps/web | open-seo-main | /api/graphrag/query | POST | VALIDATED - Zod schema |
| apps/web | open-seo-main | /api/platform-connections | GET/POST | VALIDATED - Platform-specific schemas |
| apps/web | open-seo-main | /api/clients/{id}/goals | GET/POST | VALIDATED - Cross-service schema |
| open-seo-main | AI-Writer | /internal/* | Various | PARTIAL - Legacy key auth |
| AI-Writer | open-seo-main | /api/webhooks | POST | VALIDATED - Event registry |

### Architecture Assessment

#### Strengths Identified

1. **Unified Server Fetch Client** (`apps/web/src/lib/server-fetch.ts`)
   - Circuit breaker pattern prevents cascading failures
   - Automatic retry with exponential backoff for transient errors
   - Automatic case transformation (snake_case <-> camelCase) for AI-Writer
   - Request context propagation (X-Correlation-Id, X-Request-Id) for tracing
   - 30s default timeout with configurable overrides

2. **Cross-Service Schema Library** (`apps/web/src/lib/api/schemas/cross-service.ts`)
   - Well-designed Zod schemas for goals, clients, audits, articles, analytics
   - Standardized pagination schema used across services
   - Error response schema for unified error handling
   - Helper functions for creating success/list response wrappers

3. **Standardized Error Response Format**
   - AI-Writer: `{"error": {"code": "...", "message": "...", "request_id": "..."}}`
   - open-seo-main: `{"success": false, "error": {"message": "...", "code": "..."}}`
   - apps/web normalizes both formats via `normalizeBackendError()`

4. **Environment-Based URL Configuration**
   - Centralized env validation in `apps/web/src/lib/env.ts`
   - Production checks prevent localhost URLs
   - Fallback defaults for development

5. **Circuit Breaker Implementation**
   - Separate breakers for AI-Writer, open-seo-main, and Voice API
   - Configurable failure thresholds and reset timeouts
   - State change logging for observability
   - `isServiceAvailable()` for graceful degradation

6. **Internal API Authentication** (open-seo-main)
   - HMAC-SHA256 signature with timestamp (primary)
   - Legacy API key fallback for backward compatibility
   - Timing-safe comparison to prevent timing attacks
   - Audit logging for all auth attempts

7. **Rate Limiting**
   - Redis-based sliding window rate limiting
   - Operation-specific limiters (audit, LLM, API cost, CPU-intensive)
   - Fail-closed for expensive operations (audits, LLM calls)
   - Rate limit headers in responses (X-RateLimit-*)

8. **SSRF Protection**
   - URL validation blocks internal IPs, localhost, metadata endpoints
   - Applied at both apps/web proxy and backend detection endpoints

### Findings

#### CRIT-API-01: Missing Schema Validation on Analytics Endpoint
**Severity:** CRITICAL
**Location:** `apps/web/src/app/api/analytics/[clientId]/route.ts:35`
**Evidence:**
```typescript
const data = await getFastApi(`/api/clients/${clientId}/analytics`);
return NextResponse.json(data);
// No schema validation - response passed directly to client
```
**Impact:** If AI-Writer changes the analytics response format, apps/web will silently pass malformed data to the frontend, causing runtime errors in React components.

**Recommendation:**
```typescript
import { AnalyticsSummarySchema } from "@/lib/api/schemas/cross-service";

const data = await getFastApi<AnalyticsSummary>(`/api/clients/${clientId}/analytics`, {
  schema: AnalyticsSummarySchema
});
```

---

#### HIGH-API-01: Inconsistent Error Response Envelope Between Services
**Severity:** HIGH
**Location:** Multiple API routes
**Evidence:**
- open-seo-main uses: `{"success": false, "error": {"message": "...", "code": "..."}}`
- AI-Writer uses: `{"error": {"code": "...", "message": "...", "request_id": "..."}}`
- Some open-seo-main routes use: `{"error": "message"}` (flat format)

Examples of inconsistency:
```typescript
// open-seo-main/src/routes/api/webhooks.ts - uses successResponse/errorResponse
return errorResponse(400, "Validation failed", { code: "VALIDATION_ERROR" });

// open-seo-main/src/routes/api/connect/detect.ts - uses flat format
return Response.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });

// open-seo-main/src/routes/api/graphrag/query.ts - uses success/error envelope
return Response.json({ success: false, error: parsed.error.message }, { status: 400 });
```

**Impact:** Frontend error handling code must handle multiple formats, increasing complexity and bug risk.

**Recommendation:** Standardize all open-seo-main routes to use `successResponse()` and `errorResponse()` from `@/server/lib/response.ts`. Update `normalizeBackendError()` to handle all edge cases.

---

#### HIGH-API-02: Connection API Route Uses Direct fetch Instead of serverFetch
**Severity:** HIGH
**Location:** `apps/web/src/app/api/connections/route.ts:44-52`
**Evidence:**
```typescript
const response = await fetch(
  `${backendUrl}/api/platform-connections?${params}`,
  {
    headers: {
      "x-user-id": userId,
    },
  }
);
// Missing: Authorization header, timeout, circuit breaker, retry logic
```

**Impact:**
- No authentication token forwarded (relies on x-user-id only)
- No timeout protection (could hang indefinitely)
- No circuit breaker protection
- No correlation ID propagation for tracing

**Recommendation:** Migrate to use `getOpenSeo()` from server-fetch:
```typescript
import { getOpenSeo } from "@/lib/server-fetch";

const data = await getOpenSeo<ConnectionsResponse>(
  `/api/platform-connections?${params}`,
  { schema: ConnectionsResponseSchema }
);
```

---

#### HIGH-API-03: GraphRAG Query Response Format Mismatch
**Severity:** HIGH
**Location:** 
- AI-Writer: `AI-Writer/backend/routers/graphrag.py:59-62`
- open-seo-main: `open-seo-main/src/routes/api/graphrag/query.ts:71-77`

**Evidence:**
AI-Writer returns:
```python
return QueryResponse(
    success=True,
    answer=answer,
    mode=request.mode,
)
```

open-seo-main returns:
```typescript
return Response.json({
  success: true,
  data: {
    results: result.results,
    mode: result.mode,
    latencyMs: result.latencyMs,
  },
});
```

**Impact:** If apps/web calls either service for GraphRAG, the response structures are different (AI-Writer has `answer`, open-seo-main has `data.results`).

**Recommendation:** 
1. Document which service is the authoritative GraphRAG endpoint
2. Deprecate the unused one, or
3. Create a facade in apps/web that normalizes the response format

---

#### HIGH-API-04: No Timeout on Long-Running Operations
**Severity:** HIGH
**Location:** Various audit and content generation calls
**Evidence:** Default timeout is 30s, but some operations can take 2+ minutes:
- Audits (crawling thousands of pages)
- Content generation (LLM calls)
- Bulk operations

```typescript
// apps/web/src/lib/server-fetch.ts:74
const SERVER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS; // 30 seconds
```

**Impact:** Long-running operations may timeout prematurely, causing partial results or user confusion.

**Recommendation:** Use `LONG_RUNNING_TIMEOUT_MS` (120s) for audit and content generation calls:
```typescript
await postOpenSeo<AuditResult>("/api/seo/audits", payload, {
  timeout: LONG_RUNNING_TIMEOUT_MS
});
```

---

#### HIGH-API-05: Missing CORS Headers in open-seo-main API Routes
**Severity:** HIGH
**Location:** `open-seo-main/src/routes/api/*`
**Evidence:** Most routes use `Response.json()` without CORS headers. CORS configuration may be at middleware level but not visible in route handlers.

**Impact:** Direct browser-to-backend calls (if any) would fail with CORS errors.

**Recommendation:** Verify CORS middleware is properly configured for all API routes. Document CORS configuration location.

---

#### MED-API-01: Inconsistent HTTP Status Codes for Validation Errors
**Severity:** MEDIUM
**Location:** Multiple routes
**Evidence:**
- Some routes use 400 for validation errors
- Some routes use 422 for validation errors
- The codebase has comments indicating preference for 422

```typescript
// apps/web - uses 422 (correct per comments)
// MED-API-01: Use 422 for validation errors (semantic distinction from 400 bad request)
return NextResponse.json(
  { error: "Validation failed", issues: parsed.error.issues },
  { status: 422 }
);

// Some open-seo-main routes use 400
return Response.json(
  { error: "Invalid input", details: parsed.error.issues },
  { status: 400 }
);
```

**Recommendation:** Standardize on 422 Unprocessable Entity for validation errors across all services.

---

#### MED-API-02: Query Parameter Naming Inconsistency
**Severity:** MEDIUM
**Location:** Various API routes
**Evidence:**
```typescript
// apps/web uses camelCase
const clientId = searchParams.get("clientId");

// Some open-seo-main routes expect snake_case
url.searchParams.get("scope_id");

// Some use mixed
query.set("client_id", params.clientId);  // Converts on send
```

**Impact:** Developer confusion when implementing new API calls.

**Recommendation:** Document the convention: use snake_case for query params when calling Python backends (AI-Writer), camelCase for TypeScript backends (open-seo-main).

---

#### MED-API-03: No Content-Type Validation on Request Handlers
**Severity:** MEDIUM
**Location:** Multiple API routes
**Evidence:** Routes parse JSON body without checking Content-Type header:
```typescript
const body = await request.json();
// No check that Content-Type: application/json was sent
```

**Impact:** Could accept malformed requests or cause confusing errors.

**Recommendation:** Add Content-Type validation middleware or check in handlers:
```typescript
if (request.headers.get("content-type") !== "application/json") {
  return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
}
```

---

#### MED-API-04: Webhook URL Query String Inconsistency
**Severity:** MEDIUM
**Location:** `apps/web/src/actions/webhooks.ts:148-149`
**Evidence:**
```typescript
const query = new URLSearchParams();
query.set("userId", auth.userId);
// But open-seo-main webhook handler doesn't use userId from query params
```

**Impact:** Query param `userId` is sent but may not be used by backend.

**Recommendation:** Document which auth context fields are expected by each endpoint. Remove unused query params.

---

#### MED-API-05: Missing Idempotency Key on Some Mutation Endpoints
**Severity:** MEDIUM
**Location:** Various POST endpoints
**Evidence:** Some mutations have idempotency keys, others don't:
```typescript
// HAS idempotency key
idempotencyKey: generateAuditIdempotencyKey('start', {...});

// MISSING idempotency key
await postFastApi("/api/articles", parsed.data);
```

**Impact:** Network retries could create duplicate resources.

**Recommendation:** Add idempotency keys to all POST endpoints that create resources.

---

#### MED-API-06: Handoff API Field Name Mismatch
**Severity:** MEDIUM
**Location:** 
- Client: `apps/web/src/lib/api/connect.ts:187-194`
- Server: `open-seo-main/src/routes/api/connect/handoff.ts:33-43`

**Evidence:**
Client sends:
```typescript
body: JSON.stringify({ siteId, email, message }),
```

Server expects:
```typescript
installationId: z.string().min(1, "Installation ID is required"),
```

**Impact:** Client uses `siteId` but server expects `installationId`. May cause validation errors.

**Recommendation:** Align field names or add field mapping on one side.

---

#### MED-API-07: Circuit Breaker States Not Shared Across Instances
**Severity:** MEDIUM
**Location:** `apps/web/src/lib/utils/service-circuit-breakers.ts`
**Evidence:**
```typescript
// HIGH-02 DOCUMENTATION: Circuit Breaker Behavior Differences
// This apps/web circuit breaker uses in-memory state (per Next.js server instance).
// These are INDEPENDENT - if apps/web opens its circuit, AI-Writer won't know
```

**Impact:** In multi-instance deployments, circuit breaker states are inconsistent.

**Recommendation:** Consider Redis-backed circuit breaker state for production multi-instance deployments.

---

#### MED-API-08: No API Versioning Strategy
**Severity:** MEDIUM
**Location:** All API routes
**Evidence:** No versioning in URL paths (e.g., `/api/v1/clients`) or headers.

**Impact:** Breaking API changes require coordinated deployments across all services.

**Recommendation:** Consider adding API version prefix or Accept-Version header support for future-proofing.

---

#### LOW-API-01: Duplicate URL Normalization
**Severity:** LOW
**Location:** `apps/web/src/lib/server-fetch.ts:341-342`
**Evidence:**
```typescript
const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
```
This is also done in the public `apiGet` functions.

**Impact:** Minor code duplication.

---

#### LOW-API-02: Inconsistent Request ID Header Names
**Severity:** LOW
**Location:** Various files
**Evidence:**
- `X-Request-Id` (most common)
- `X-Correlation-Id` (for distributed tracing)
- Some places check both, some only one

**Impact:** Minor confusion in log correlation.

**Recommendation:** Document that X-Correlation-Id is for cross-service tracing, X-Request-Id is for per-request identification.

---

#### LOW-API-03: Some API Routes Missing Rate Limit Headers
**Severity:** LOW
**Location:** Various routes
**Evidence:** Not all rate-limited routes include `X-RateLimit-*` headers in responses.

**Impact:** Clients cannot implement client-side rate limit awareness.

**Recommendation:** Ensure all rate-limited endpoints return headers via `rateLimitHeaders()`.

---

#### LOW-API-04: Logger Import Inconsistency
**Severity:** LOW
**Location:** Various files
**Evidence:**
```typescript
// Some files
import { logger } from '@/lib/logger';

// Other files
import { createLogger } from "@/server/lib/logger";
```

**Impact:** Minor inconsistency in logging patterns.

---

### Cross-Service Communication Matrix

| From | To | Transport | Auth | Timeout | Circuit Breaker | Retry |
|------|----|-----------|----- |---------|-----------------|-------|
| apps/web | AI-Writer | HTTPS | Bearer JWT | 30s | Yes | 3 retries |
| apps/web | open-seo-main | HTTPS | Bearer JWT + X-User-Id | 30s | Yes | 3 retries |
| open-seo-main | AI-Writer | HTTPS | X-Internal-Api-Key | Unknown | Unknown | Unknown |
| AI-Writer | open-seo-main | HTTPS (webhooks) | Webhook signature | Unknown | Unknown | Unknown |

### Summary of Recommendations

**Immediate (CRITICAL):**
1. Add schema validation to analytics endpoint (CRIT-API-01)

**Current Sprint (HIGH):**
1. Standardize error response envelope across all services (HIGH-API-01)
2. Migrate connections route to use serverFetch (HIGH-API-02)
3. Resolve GraphRAG response format differences (HIGH-API-03)
4. Use LONG_RUNNING_TIMEOUT_MS for audits/content generation (HIGH-API-04)
5. Document/verify CORS configuration (HIGH-API-05)

**Next Sprint (MEDIUM):**
1. Standardize validation error status codes to 422 (MED-API-01)
2. Document query parameter naming conventions (MED-API-02)
3. Add Content-Type validation (MED-API-03)
4. Add idempotency keys to all POST endpoints (MED-API-05)
5. Fix handoff API field name mismatch (MED-API-06)

### Positive Patterns to Preserve

- **Unified server-fetch client** with circuit breaker, retry, timeout, case transformation
- **Cross-service schema library** with Zod validation
- **Error normalization layer** handling multiple backend formats
- **Request context propagation** for distributed tracing
- **Environment validation** preventing misconfigurations
- **SSRF protection** at both proxy and backend levels
- **HMAC-based internal auth** with timing-safe comparison
- **Redis-based rate limiting** with operation-specific limits



---
## Agent 7: Drizzle ORM & Database Layer
**Completed:** 2026-05-04T12:02:23Z
**Files Reviewed:** 128
**Issues:** 0 Critical, 1 High, 4 Medium, 3 Low

### Query Pattern Analysis

| Metric | Count |
|--------|-------|
| Total Repository Files | 21 |
| Total Service Files (with DB) | 28 |
| Schema Definition Files | 82 |
| Queries Using Transactions | 12 |
| Queries With Row-Level Locks | 4 |
| Batched Operations | 8 |
| Cursor Pagination Utilities | Yes |

### Database Infrastructure Assessment

#### Strengths Identified

1. **Excellent Connection Pool Management** (`src/db/index.ts`)
   - Pool size configurable via `DB_POOL_SIZE` env var (default 20)
   - Idle timeout (20s) to close stale connections
   - Fatal error detection with production auto-recovery
   - Health check function for monitoring
   - Graceful shutdown with `closeDatabasePool()`

```typescript
export const pool = new pg.Pool({
  connectionString,
  max: Number(process.env.DB_POOL_SIZE) || 20,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});
```

2. **Comprehensive Transaction Support** (`src/server/lib/db-transaction.ts`)
   - `withTransaction()` wrapper with automatic rollback
   - `TransactionContext` for post-commit job collection
   - Proper error preservation for AppError types
   - Post-commit webhook job enqueueing pattern

3. **Strong Type Safety**
   - Schema types exported via `$inferSelect` and `$inferInsert`
   - `DrizzleTransaction` type alias for dependency injection
   - Zod integration for runtime validation (`src/lib/db-validators.ts`)

4. **Cursor-Based Pagination** (`src/server/lib/pagination.ts`)
   - Base64url encoded opaque cursors
   - Compound cursors for sort column + id
   - `clampPageSize()` utility with MAX_PAGE_SIZE=100
   - `buildPaginationResult()` helper for consistent responses

5. **Proper Row-Level Locking**
   - `ProspectService.update()` uses `.for("update")` to prevent race conditions
   - `ProspectService.convertProspectToClient()` locks row during conversion
   - `MultiSignerOrchestrator.activateNextSigner()` uses `FOR UPDATE SKIP LOCKED`

6. **Atomic Status Transitions**
   - `ProposalService` uses WHERE status preconditions for state machine safety
   - `InvoiceService.handlePaymentSuccess()` uses atomic UPDATE with `ne(status, "paid")`
   - Prevents race conditions from concurrent webhook calls

7. **Batch Operations**
   - `bulkArchiveProspects()` uses `inArray()` instead of N queries
   - `AnalysisService.bulkQueueAnalysis()` batches insert + BullMQ addBulk
   - `AuditRepository.batchWriteResults()` processes in chunks of 100

8. **Comprehensive Audit Logging** (`src/db/audit.ts`)
   - `withAudit()` helper for typed logging
   - Automatic sensitive field redaction
   - Changed fields calculation for diff tracking

9. **Soft Delete Pattern Consistently Applied**
   - `clients`, `projects`, `audits` tables have `isDeleted`/`deletedAt`
   - Partial indexes on active records (`ix_clients_active`)

10. **Dual-Write Migration Support** (`src/db/dual-write.ts`)
    - Feature-flagged shadow writes to consolidated database
    - Fire-and-forget pattern with error logging
    - Separate connection pool for shadow DB

### Findings

#### HIGH-DRIZZLE-01: Raw SQL Without Parameterization in Link Graph Update
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/seo/links/graph.update.ts:230-237`
**Severity:** HIGH
**Description:** Raw SQL uses template literals with array values, but the `ANY(${internalTargets})` pattern is correctly parameterized via Drizzle's `sql` template tag.

```typescript
await tx.execute(sql\`
  UPDATE page_links
  SET
    inbound_total = inbound_total + 1,
    inbound_body = inbound_body + 1
  WHERE client_id = ${validatedClientId}
    AND page_url = ANY(${internalTargets})
\`);
```

**Assessment:** After review, this is SAFE. Drizzle's `sql` template tag properly escapes parameters. No SQL injection risk.

**Actual Issue:** The increment logic (`inbound_total + 1`) may over-count if a page links to the same target multiple times. Consider using COUNT subquery instead.

**Recommendation:** Change to accurate count calculation:
```sql
SET inbound_total = (
  SELECT COUNT(*) FROM link_graph
  WHERE target_url = page_links.page_url AND client_id = ${clientId}
)
```

---

#### MED-DRIZZLE-01: Missing Default Limits on Some Repository Queries
**Locations:**
- `FindingsRepository.findByEntity()` - no limit
- `FollowUpRepository.findDueToday()` - no limit
- `AuditRepository.getAuditCapacityUsageForUser()` - unbounded

**Description:** Several queries can return unbounded result sets in edge cases.

**Impact:** Memory exhaustion if entity has unexpectedly many records.

**Recommendation:** Add `limit: MAX_PAGE_SIZE` as safety net:
```typescript
async findDueToday(workspaceId: string): Promise<FollowUpSelect[]> {
  // ...existing filters...
  .limit(MAX_PAGE_SIZE);  // Safety limit
}
```

---

#### MED-DRIZZLE-02: Inconsistent Error Handling in Repository Layer
**Pattern Observed:**

Some repositories throw AppError on not-found:
```typescript
// ProspectService.update() - throws
if (!current) {
  throw new AppError("NOT_FOUND", \`Prospect not found: ${id}\`);
}
```

Others return null/undefined:
```typescript
// InvoiceRepository.getInvoiceById() - returns undefined
const [invoice] = await db.select()...;
return invoice;  // May be undefined
```

**Impact:** Inconsistent caller expectations. Some callers must check null, others catch errors.

**Recommendation:** Document convention - repositories return null/undefined, services throw AppError.

---

#### MED-DRIZZLE-03: DELETE Without Workspace Scope in Some Repositories
**Location:** `InvoiceRepository.deleteInvoice()`
```typescript
export async function deleteInvoice(invoiceId: string): Promise<void> {
  await db.delete(invoices).where(eq(invoices.id, invoiceId));
}
```

**Issue:** No workspace_id check allows any invoice to be deleted if ID is known.

**Mitigation:** Service layer validates workspace ownership before calling repository.

**Recommendation:** Add scoped variant for defense-in-depth:
```typescript
export async function deleteInvoiceScoped(invoiceId: string, workspaceId: string): Promise<void> {
  await db.delete(invoices).where(
    and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId))
  );
}
```

---

#### MED-DRIZZLE-04: Hard Delete Used Where Soft Delete Expected
**Location:** `InvoiceRepository.deleteInvoice()`, `FollowUpRepository.delete()`

**Description:** These tables use hard DELETE while related tables (clients, audits, projects) use soft delete pattern.

**Impact:** Inconsistent data retention. Hard-deleted invoices break audit trails.

**Recommendation:** Add `isDeleted`/`deletedAt` columns and convert to soft delete:
```typescript
export async function deleteInvoice(invoiceId: string): Promise<void> {
  await db.update(invoices)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
}
```

---

#### LOW-DRIZZLE-01: Some Schema Files Missing Check Constraints
**Pattern:** `clients` table has `check("chk_client_status_valid")`, but similar enum-like columns in other tables rely only on application-level validation.

**Examples without DB check constraints:**
- `proposals.status` - uses inline enum but no check constraint
- `invoices.status` - no check constraint
- `contracts.status` - no check constraint

**Impact:** Database allows invalid states if bypassing ORM.

**Recommendation:** Add check constraints in migrations for critical status columns.

---

#### LOW-DRIZZLE-02: Transaction Context Not Used in Some Multi-Table Operations
**Location:** `InvoiceService.handlePaymentSuccess()` lines 287-330

**Description:** Updates to both `invoices` and `contracts` tables are not wrapped in a transaction. Each uses separate UPDATE statements.

```typescript
const [updated] = await db.update(invoices).set({...}).where(...).returning();
// ...then later...
await db.update(contracts).set({...}).where(...);
```

**Impact:** If second UPDATE fails, invoice is marked paid but contract remains "signed" instead of "executed".

**Recommendation:** Wrap in `withTransaction()`:
```typescript
await withTransaction(async (tx) => {
  const [updated] = await tx.update(invoices)...;
  if (!updated) return { alreadyProcessed: true };
  await tx.update(contracts)...;
  await ActivityRepository.recordStatusChange(tx, ...);
  return { alreadyProcessed: false };
});
```

---

#### LOW-DRIZZLE-03: Workspace ID Column Naming Inconsistency
**Pattern Observed:**
- `clients.workspaceId` (camelCase)
- `prospects.workspaceId` (camelCase)
- `organization.id` referenced as workspace

**Note:** This is cosmetic - Drizzle handles column name mapping correctly. The `organization` table from better-auth maps to "workspace" concept.

---

### SQL Injection Risk Assessment

| Pattern | Files | Status |
|---------|-------|--------|
| `sql\`...\`` template tag | 50 uses | **SAFE** - Drizzle parameterizes |
| String interpolation in `sql` | 0 found | **N/A** |
| Raw `db.execute(string)` | 0 found | **N/A** |
| User input in ORDER BY | 0 found | **N/A** |

**Conclusion:** No SQL injection vulnerabilities detected. All raw SQL uses Drizzle's `sql` template tag which properly parameterizes values.

### N+1 Query Detection

| Location | Pattern | Status |
|----------|---------|--------|
| `ProspectService.findById()` | Separate query for analyses | **LOW** - acceptable for single entity |
| `ProposalService.findById()` | Promise.all for views, signatures, payments | **GOOD** - parallel not sequential |
| `AnalysisService.bulkQueueAnalysis()` | Batched operations | **GOOD** - no N+1 |
| `AuditRepository.batchWriteResults()` | Chunked batch inserts | **GOOD** - batch of 100 |
| `FollowUpRepository.findByWorkspace()` | Single query with filters | **GOOD** |

**Conclusion:** No significant N+1 patterns detected. Service layer uses batch operations and parallel queries appropriately.

### Transaction Usage Summary

| Service | Uses Transaction | Pattern |
|---------|-----------------|---------|
| ProspectService.update() | Yes | `db.transaction()` with FOR UPDATE |
| ProspectService.convertProspectToClient() | Yes | `withTransaction()` wrapper |
| AuditRepository.batchWriteResults() | Yes | `withTransaction()` wrapper |
| MultiSignerOrchestrator.activateNextSigner() | Yes | FOR UPDATE SKIP LOCKED |
| ProposalService.update() | No | Atomic UPDATE with WHERE |
| ProposalService.markSent() | No | Atomic UPDATE with WHERE |
| InvoiceService.handlePaymentSuccess() | Partial | Atomic UPDATE but multi-table risk |

### Positive Patterns to Preserve

1. **Drizzle `sql` template tag** for raw SQL - prevents injection
2. **`withTransaction()` wrapper** with error preservation
3. **Row-level locking** with `.for("update")` for race prevention
4. **Atomic status transitions** using WHERE preconditions
5. **Batch operations** with `inArray()` and bulk insert
6. **Scoped queries** with `*Scoped()` repository variants
7. **Cursor pagination** infrastructure with MAX_PAGE_SIZE
8. **Soft delete** pattern with partial indexes
9. **Audit logging** with automatic field redaction
10. **Connection pool monitoring** with health checks

### Remediation Priority

1. **HIGH:** Wrap InvoiceService.handlePaymentSuccess() in transaction
2. **MEDIUM:** Add default limits to unbounded repository queries
3. **MEDIUM:** Add scoped DELETE variants for defense-in-depth
4. **MEDIUM:** Convert hard deletes to soft deletes for audit trail
5. **LOW:** Standardize error handling convention (null vs throw)
6. **LOW:** Add check constraints for status columns


---
## Agent 13: Client Onboarding User Journey
**Completed:** 2026-05-04T14:32:00Z
**Files Reviewed:** 42
**Issues:** 0 Critical, 3 High, 5 Medium, 4 Low

### Journey Flow Analysis

| Step | Service | Entry Point | Exit Point | Issues |
|------|---------|-------------|------------|--------|
| 1. Authentication | apps/web + Clerk | `/sign-up` | `/clients` | None |
| 2. Create Client | apps/web -> AI-Writer | `AddClientModal` | Client dashboard | HIGH-01 |
| 3. Voice Profile | apps/web -> AI-Writer | `/clients/[id]/settings/voice` | Saved profile | MED-01 |
| 4. Client Sync | AI-Writer -> open-seo-main | Event webhook | `/api/clients/events` | MED-02 |
| 5. SEO Setup | apps/web -> open-seo-main | `/clients/[id]/seo/setup` | Project created | HIGH-02 |
| 6. First Audit | open-seo-main | `/api/seo/projects/[id]/audits` | Audit page | HIGH-03 |
| 7. Onboarding Dashboard | apps/web + open-seo-main | `/clients/[id]/onboarding` | Complete page | MED-03 |

### Findings

#### HIGH-01: Cross-Service Client Sync Race Condition
**Location:** 
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/AddClientModal.tsx:163-211`
- `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/api/clients.py:306-323`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/clients/events.ts:83-122`

**Severity:** HIGH

**Description:** When a client is created in `AddClientModal`, the flow immediately navigates to `/clients/${newClient.id}` after the AI-Writer POST returns. However, the client sync event to open-seo-main is emitted asynchronously in a fire-and-forget manner:

```python
# AI-Writer api/clients.py:306-323
try:
    emit_client_event(
        event_type=ClientEventType.CREATED,
        client_id=str(client.id),
        workspace_id=workspace_id,
        data={...},
    )
except Exception as event_err:
    # Log but don't fail the creation
    logger.warning(f"Failed to emit creation event: {event_err}")
```

The frontend navigates immediately without waiting for sync confirmation:
```typescript
// AddClientModal.tsx:210
onCreated(newClient.id);  // Triggers navigation to /clients/${id}
```

**Impact:** Users navigating to the client detail page may encounter 404 errors from open-seo-main APIs if the sync hasn't completed. The `ClientSetupChecklist` component and SEO features depend on data existing in open-seo-main.

**Reproduction Scenario:**
1. User clicks "Add Client" in modal
2. AI-Writer creates client, returns 201
3. Modal closes, user redirected to `/clients/[id]`
4. Client dashboard fetches from both services
5. open-seo-main returns 404 (sync event still in flight)

**Recommendation:**
1. Option A: Make client sync synchronous before returning from AI-Writer
2. Option B: Add retry logic with backoff in dashboard data fetching
3. Option C: Show "sync in progress" state while client propagates

---

#### HIGH-02: SEO Setup Flow Has No Recovery Path for Failed Project Creation
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/seo/setup/page.tsx:243-284`

**Severity:** HIGH

**Description:** The SEO setup wizard creates a project and immediately starts an audit. If the audit POST fails, the user sees an error but the project was already created. Re-running the wizard will create a duplicate project.

```typescript
// lines 251-270
const project = await apiPost<ProjectCreateResponse>(
  "/api/seo/projects",
  { client_id: clientId, ... }
);
setProjectId(project.id);

// Start the initial audit - if this fails, project already exists
await apiPost(`/api/seo/projects/${project.id}/audits`, {
  scope: "full",
});
```

**Impact:** Users may create multiple duplicate SEO projects if audit creation fails repeatedly.

**Recommendation:**
1. Wrap project+audit creation in a saga pattern with rollback
2. Or check for existing projects before creating new ones
3. Or show the existing project and prompt to "Start Audit" separately

---

#### HIGH-03: Onboarding Checklist Page Has No Loading State During Server Fetch
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/onboarding/page.tsx`

**Severity:** HIGH

**Description:** The onboarding page is a Server Component that fetches both `getClientChecklist` and `getClient` in parallel. If these requests are slow, users see a blank page with no loading indicator.

```typescript
const [checklist, client] = await Promise.all([
  getClientChecklist(clientId),  // Network call to open-seo-main
  getClient(clientId),           // Network call to open-seo-main
]);
```

Next.js 15 requires explicit loading.tsx or Suspense boundaries for loading states.

**Missing file:** `apps/web/src/app/(shell)/clients/[clientId]/onboarding/loading.tsx`

**Impact:** Poor perceived performance - users may think the page is broken during slow network conditions or backend latency spikes.

**Recommendation:** Add `loading.tsx` with skeleton UI:
```tsx
export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-72 mb-8" />
      <Skeleton className="h-32 w-full mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
```

---

#### MED-01: Voice Profile Page Uses Client-Side Data Fetching Without Optimistic UI
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/voice/page.tsx:62-81`

**Severity:** MEDIUM

**Description:** The voice profile page fetches data client-side via `getVoiceProfile()` and `getVoiceTemplates()` server actions. While this works, it creates a loading state on every navigation. Additionally, saves don't use optimistic updates - users must wait for the server response.

```typescript
useEffect(() => {
  loadData();
}, [loadData]);

const handleSave = useCallback(async (data: Partial<VoiceProfile>) => {
  setSaving(true);
  // No optimistic update - UI blocks until server responds
  const updated = await saveVoiceProfile(clientId, data);
  setProfile(updated);
```

**Impact:** Voice profile configuration feels sluggish, especially when editing multiple tabs.

**Recommendation:**
1. Convert to RSC with initial data passed as props
2. Use optimistic updates for save operations
3. Consider `useOptimistic` React hook for instant feedback

---

#### MED-02: Client Event Webhook Has Silent Failure Mode
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/clients/events.ts:83-122`

**Severity:** MEDIUM

**Description:** The `handleClientCreated` function catches errors and logs them but doesn't propagate failure status. AI-Writer's fire-and-forget emit won't know if sync failed.

```typescript
async function handleClientCreated(event: ClientEvent): Promise<void> {
  // ...
  try {
    await db.insert(clients).values({...}).onConflictDoNothing({ target: clients.id });
  } catch (error) {
    log.error("Failed to create local client", error);
    // ERROR IS SWALLOWED - no retry, no alerting
  }
}
```

**Impact:** If database insert fails (connection issue, constraint violation), the client won't exist in open-seo-main and all downstream operations will fail.

**Recommendation:**
1. Rethrow errors to return 500 response
2. AI-Writer should implement retry logic for failed event deliveries
3. Add Sentry alerting for event processing failures

---

#### MED-03: Onboarding Complete Page Doesn't Handle Edge Case of Missing Checklist
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/onboarding/complete/page.tsx:17-26`

**Severity:** MEDIUM

**Description:** The complete page calls `notFound()` if checklist is null. However, for clients created before the onboarding system was implemented, or clients without contracts, the checklist legitimately won't exist.

```typescript
if (!checklist || !client) {
  notFound();  // Shows generic 404, not user-friendly
}
```

**Impact:** Users with legacy clients see confusing 404 pages instead of a helpful message.

**Recommendation:** Show a different UI for missing checklist:
```tsx
if (!checklist) {
  return <NoChecklistFallback clientId={clientId} clientName={client.name} />;
}
```

---

#### MED-04: GettingStartedCard Polls API Without Cleanup
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/GettingStartedCard.tsx:52-73`

**Severity:** MEDIUM

**Description:** The component fetches platform secret status on mount but has `cancelled` flag logic that may not clean up properly if component unmounts during fetch:

```typescript
useEffect(() => {
  let cancelled = false;
  setSecretsLoading(true);
  apiGet<PlatformSecretStatus[]>("/api/platform-secrets/status")
    .then((statuses) => {
      if (cancelled) return;  // Good: cancellation check
      // ...
    })
    .finally(() => {
      if (!cancelled) setSecretsLoading(false);
    });
  return () => { cancelled = true; };  // Cleanup only sets flag
}, []);
```

While the cancelled flag prevents state updates, the fetch request itself continues. This is fine but could be improved with AbortController.

**Impact:** Minor - fetch continues unnecessarily if user navigates away quickly.

**Recommendation:** Use AbortController for proper request cancellation:
```typescript
useEffect(() => {
  const controller = new AbortController();
  apiGet<...>("/api/...", { signal: controller.signal })
    .then(...)
    .catch((err) => {
      if (err.name === 'AbortError') return;
      // handle real errors
    });
  return () => controller.abort();
}, []);
```

---

#### MED-05: Connections Page Has Inconsistent Error State UX
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx:139-169`

**Severity:** MEDIUM

**Description:** OAuth connections load with `loadError` state shown, but CMS site connections fail silently:

```typescript
const loadSiteConnections = useCallback(async () => {
  try {
    const data = await getSiteConnections(clientId);
    setSiteConnections(data);
  } catch {
    // Silent fail - OAuth connections still work
  }
}, [clientId]);
```

**Impact:** Users won't know if CMS connections failed to load.

**Recommendation:** Add separate error state for CMS connections, or at minimum log the error for debugging.

---

#### LOW-01: ClientSetupChecklist Has Hardcoded Step Status
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/components/ClientSetupChecklist.tsx:28-99`

**Severity:** LOW

**Description:** The checklist hardcodes "Client added" as always complete, but doesn't track actual progress for CMS configuration or first article publication. It also doesn't sync with the onboarding checklist in open-seo-main.

**Impact:** Users see duplicate checklists with different progress states (this one vs OnboardingChecklist).

**Recommendation:** Either remove this component in favor of the formal OnboardingChecklist, or fetch actual completion status from backend.

---

#### LOW-02: AddClientModal Uses Magic Number for Timeout
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/AddClientModal.tsx:37`

**Severity:** LOW

**Description:** 
```typescript
const CREATION_TIMEOUT_MS = 60000;
```

60 seconds is reasonable but not documented why this value was chosen. Intelligence scraping can take 30-60s (mentioned in UI), but timeout should be at least 2x the expected duration.

**Recommendation:** Add comment explaining timeout rationale, or consider making it configurable.

---

#### LOW-03: ConversionSummary Uses Unused `completedAt` Prop
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/ConversionSummary.tsx:24-35`

**Severity:** LOW

**Description:** The `completedAt: Date` prop is accepted but never rendered in the component.

```typescript
export function ConversionSummary({
  clientId,
  clientName,
  serviceTier,
  completedAt,  // Never used in component body
  connectedServices,
  nextSteps,
}: ConversionSummaryProps) {
```

**Impact:** Minor - completion date information is lost.

**Recommendation:** Either display the completion date or remove from interface.

---

#### LOW-04: SEO Setup Uses Loose Domain Validation
**Location:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/seo/setup/page.tsx:177-180`

**Severity:** LOW

**Description:** The domain regex is permissive:
```typescript
const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
```

This doesn't validate subdomains (e.g., `blog.example.com`) or internationalized domains.

**Impact:** Users may enter invalid domains that fail later in the audit process.

**Recommendation:** Use a more robust URL/domain validation library like `validator.js` or `zod` URL refinement.

---

### Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | - |
| HIGH | 3 | Cross-service sync race, no project creation recovery, missing loading.tsx |
| MEDIUM | 5 | Client-side fetching patterns, silent failures, error state inconsistencies |
| LOW | 4 | Hardcoded values, unused props, loose validation |

### Cross-Service Data Flow Diagram

```
User Sign-up (Clerk)
        |
        v
+----------------+     POST /api/clients      +---------------+
|   apps/web     | ----------------------->   |  AI-Writer    |
| AddClientModal |                            |  FastAPI      |
+----------------+                            +---------------+
        |                                            |
        | redirect to                      emit_client_event()
        | /clients/[id]                    (fire-and-forget)
        v                                            |
+----------------+                                   v
|   apps/web     |     GET /api/clients/[id]  +---------------+
| ClientDashboard| <------------------------- | open-seo-main |
+----------------+                            | (may 404!)    |
                                              +---------------+
```

### Recommendations Priority

1. **HIGH:** Fix client sync race condition - make sync synchronous or add retry/polling
2. **HIGH:** Add loading.tsx for onboarding page
3. **HIGH:** Wrap SEO project+audit creation in saga with rollback
4. **MEDIUM:** Convert voice profile page to RSC pattern
5. **MEDIUM:** Add error propagation for client event webhook failures
6. **LOW:** Consolidate ClientSetupChecklist with OnboardingChecklist



---
## Agent 14: SEO Audit User Journey
**Completed:** 2026-05-04T14:30:00Z
**Files Reviewed:** 42
**Issues:** 0 Critical, 3 High, 6 Medium, 4 Low

### Audit Flow Analysis

| Step | Component | Job Queue | Status Tracking | Issues |
|------|-----------|-----------|-----------------|--------|
| 1. URL Submission | `AuditService.startAudit()` | `audit-queue` (BullMQ) | DB: `audits.status = 'running'` | None - well validated |
| 2. Crawl Job Queued | `addJobWithBackpressure()` | Dedup via `jobId: auditId` | Progress: `AUDIT_STEP.DISCOVER` | HIGH-01: No timeout exposed to user |
| 3. Sitemap Discovery | `discoverUrls()` | Step: `discover-urls` | Phase: `discovery` | MED-01: Partial failure logging only |
| 4. Crawl Execution | `runCrawlPhase()` | Step: `crawl-batch-N` | Redis KV: `AuditProgressKV` | MED-02: HTML stored in memory |
| 5. Tier 1 Checks | `runTier1ChecksForBatch()` | Inline (per batch) | DB: `audit_findings` | None - errors logged but non-blocking |
| 6. Tier 2 Checks | `runTier2ChecksPhase()` | Step: `run-tier2-checks` | Phase: `analyzing` | None |
| 7. Lighthouse | `runLighthousePhase()` | Step: `lighthouse-batch-N` | Phase: `lighthouse` | MED-03: External API dependency |
| 8. Tier 3 Checks | `runTier3ChecksPhase()` | Step: `run-tier3-checks` | Phase: `analyzing` | MED-04: Graceful skip undocumented |
| 9. Tier 4 Checks | `runTier4ChecksPhase()` | Step: `run-tier4-checks` | Site context built | MED-05: Large sites may timeout |
| 10. Finalize | `finalizeAudit()` | Step: `finalize` | DB: `audits.status = 'completed'` | None |
| 11. View Report | `AuditService.getResults()` | N/A | Served from DB | LOW-01: No pagination for pages |

### Journey Architecture Summary

**Strengths Identified:**

1. **Robust URL Validation** - `normalizeAndValidateStartUrl()` includes SSRF prevention via blocked hosts, private IP detection, and DNS resolution checking via Cloudflare DoH
2. **Proper Job Deduplication** - Uses `jobId: auditId` pattern to prevent duplicate audit jobs
3. **Step-Level Resume** - `AUDIT_STEP` enum enables resume on retry via `job.updateData()`
4. **Backpressure Protection** - `addJobWithBackpressure()` with 5000 job limit prevents queue overflow
5. **Graceful Check Failures** - Tier 1-4 checks log errors but don't fail the audit, ensuring partial results are available
6. **Progress Visibility** - `AuditProgressKV` in Redis provides real-time crawl status with 30-min TTL
7. **DoS Mitigations** - Max HTML size (5MB), max BFS iterations (10K), max link graph size (50K)
8. **Quality Gate System** - Score calculation with hard gates (noindex, duplicate content, CWV poor)
9. **109 SEO Checks** - Full Tier 1-4 implementation with proper scoring weights

### Findings

#### HIGH-01: No User-Visible Timeout for Long-Running Audits
**Location:** `AuditService.startAudit()` and `audit-worker.ts`
**Severity:** HIGH
**Description:** While BullMQ has a 120s `lockDuration` for job stall detection, there's no explicit timeout for the entire audit workflow. A crawl of a large site (10K pages) could run for hours with no user feedback beyond progress updates. The user cannot cancel a running audit cleanly.

```typescript
// audit-worker.ts
const LOCK_DURATION_MS = 120_000; // BQ-05 - but this is per-step, not total

// AuditService.remove() attempts cancellation but:
const job = await auditQueue.getJob(auditId);
if (job) {
  try {
    await job.remove(); // May fail if job is active
  } catch {
    // Job may already be active; best-effort cancellation
  }
}
```

**Impact:**
- Users cannot reliably cancel long-running audits
- Large site audits may appear stuck without clear status
- No SLA guarantee for audit completion

**Recommendation:**
1. Add `maxRuntime` config option (e.g., 30 minutes)
2. Implement `job.moveToFailed()` for forced cancellation
3. Show estimated completion time based on `pagesTotal` vs `pagesCrawled`

---

#### HIGH-02: Crawl HTML Stored In-Memory May Exhaust Worker Memory
**Location:** `siteAuditWorkflowCrawl.ts:90-93` and `siteAuditWorkflowPhases.ts:153`
**Severity:** HIGH
**Description:** The crawl phase accumulates raw HTML in a `Map<string, string>` for Tier 2-4 checks. For large sites with 10K pages averaging 200KB each, this could consume 2GB+ of memory.

```typescript
// siteAuditWorkflowCrawl.ts
const allHtmlByPageId = new Map<string, string>();
// ...
for (const [pageId, html] of htmlByPageId) {
  allHtmlByPageId.set(pageId, html); // Accumulates across all batches
}

// siteAuditWorkflowPhases.ts
const { allPages, htmlByPageId } = crawlResult; // Full HTML map passed through
```

**Impact:**
- Worker OOM crash on large sites
- Audit job marked as failed with cryptic error
- Potential cascading failures if worker restarts repeatedly

**Recommendation:**
1. Stream HTML to temp storage (disk or Redis) per batch
2. Only keep page metadata in memory
3. Re-fetch HTML during Tier 2-4 check phases
4. Add memory monitoring with early termination

---

#### HIGH-03: Audit Delete During Active Job Leaves Orphan Data
**Location:** `AuditService.remove()` in `AuditService.ts:212-231`
**Severity:** HIGH
**Description:** When deleting a running audit, the job removal may fail if the job is actively processing. The database row is still deleted, but the worker continues processing, eventually failing when it tries to update/complete a deleted audit.

```typescript
if (audit.status === "running") {
  const job = await auditQueue.getJob(auditId);
  if (job) {
    try {
      await job.remove();
    } catch {
      // Job may already be active; best-effort cancellation
    }
  }
}
await AuditRepository.deleteAuditForProject(auditId, projectId); // Always deletes
```

**Impact:**
- Worker writes to deleted audit row silent failure
- `audit_pages` and `audit_findings` may be orphaned (cascade delete not verified)
- DLQ entry created for audit that no longer exists

**Recommendation:**
1. Check if job is `active` state; if so, require explicit force flag
2. Use DB transaction to mark as `deleting` state first
3. Wait for job completion/failure before final delete
4. Add cascade delete constraints in schema

---

#### MED-01: Sitemap Fetch Failures Only Logged, Not Surfaced to User
**Location:** `discovery.ts:266-285`
**Severity:** MEDIUM
**Description:** When sitemap fetches fail or timeout, the code logs a warning but doesn't include this in the audit results. Users may wonder why their sitemap URLs weren't discovered.

**Impact:**
- Users unaware their sitemap couldn't be parsed
- Audit may miss important pages due to undetected sitemap issues

**Recommendation:**
1. Store `sitemapFetchResult` in audit record
2. Surface as a finding (e.g., "Sitemap partially unavailable") 
3. Include timeout count in audit summary

---

#### MED-02: No Rate Limiting on Crawl Fetch Requests
**Location:** `site-audit-workflow-helpers.ts:21-28` and `siteAuditWorkflowCrawl.ts:15`
**Severity:** MEDIUM
**Description:** The crawler fetches up to 25 URLs concurrently (`CRAWL_CONCURRENCY = 25`) with no delay between batches. This could overwhelm a target site's server.

**Impact:**
- Target site performance degradation
- Potential IP blocking by target's WAF
- Audit failures due to rate-limit responses (429)

**Recommendation:**
1. Add configurable `crawlDelayMs` between batches
2. Implement adaptive rate limiting based on response times
3. Respect `Crawl-Delay` directive from robots.txt

---

#### MED-03: Lighthouse API Dependency Not Gracefully Handled
**Location:** `siteAuditWorkflowPhases.ts:354-410`
**Severity:** MEDIUM
**Description:** If Lighthouse API (PageSpeed Insights) is unavailable, the entire Lighthouse phase fails. While individual URL failures are tracked, a total API outage isn't gracefully degraded.

**Impact:**
- API outage all Lighthouse batches fail audit job may fail entirely
- No indication to user that Core Web Vitals data is unavailable

**Recommendation:**
1. Add circuit breaker for Lighthouse API
2. Continue audit without Lighthouse if API is unavailable
3. Mark Tier 3 CWV checks as "skipped - API unavailable"

---

#### MED-04: Tier 3 Check Skip Reason Not Persisted
**Location:** `siteAuditWorkflowPhases.ts:260-295` and `runner.ts:206-214`
**Severity:** MEDIUM
**Description:** Tier 3 checks (CrUX, GSC, GA4) gracefully skip when API credentials aren't configured, but the skip reason isn't persisted in findings. Users see no Tier 3 results without knowing why.

**Impact:**
- Users may think Tier 3 checks ran and found no issues
- No actionable guidance on how to enable Tier 3 checks

**Recommendation:**
1. Store skip reason in findings: `{ skipped: true, reason: "CrUX API not configured" }`
2. Surface as info-level finding in UI
3. Add documentation link for API setup

---

#### MED-05: Tier 4 Site Context Build Has No Progress Feedback
**Location:** `siteAuditWorkflowPhases.ts:35-94`
**Severity:** MEDIUM
**Description:** The `buildSiteContext()` function runs synchronously after crawl, building a link graph and calculating click depths via BFS. For large sites, this could take significant time with no progress update.

**Impact:**
- Audit appears stuck during Tier 4 setup
- No visibility into BFS progress

**Recommendation:**
1. Add step: `step.do("build-site-context", async () => ...)`
2. Consider chunked processing with progress updates for large graphs

---

#### MED-06: Check Count Mismatch in Documentation vs Implementation
**Location:** `index.ts:69-77`
**Severity:** MEDIUM
**Description:** Documentation mentions "107 SEO checks" but the actual implementation has 109 checks (68+21+13+7). This discrepancy is acknowledged in comments but should be corrected in user-facing docs.

**Impact:**
- User confusion about check coverage
- Marketing/documentation inconsistency

**Recommendation:** Update all documentation to state "109 SEO checks" or consolidate to a canonical count.

---

#### LOW-01: Audit Results Query Not Paginated for Pages
**Location:** `AuditRepository.ts:255-270`
**Severity:** LOW
**Description:** `getAuditResultsForProject()` fetches all pages and lighthouse results without pagination.

**Impact:**
- Slow response for large audits
- Potential timeout on report page load

**Recommendation:** Add pagination or lazy loading for pages/lighthouse results.

---

#### LOW-02: Crawl Progress KV Has Fixed 300 Entry Limit
**Location:** `progress-kv.ts:16-17`
**Severity:** LOW
**Description:** `AuditProgressKV` caps at 300 entries, which may not fully represent crawl progress for larger audits (max 10K pages).

**Impact:**
- Users only see last 300 crawled URLs, not full history
- Progress percentage must be calculated from DB, not KV

**Recommendation:** Document this limitation or increase cap based on audit size.

---

#### LOW-03: No Retry for Individual Crawl Page Failures
**Location:** `site-audit-workflow-helpers.ts:94-98`
**Severity:** LOW
**Description:** If a single page fetch fails (timeout, network error), it's logged and returns empty result with no retry.

**Impact:**
- Transient network issues permanent page loss
- Audit completeness affected by temporary failures

**Recommendation:** Add configurable retry (1-2 attempts) with exponential backoff for individual page fetches.

---

#### LOW-04: Score Breakdown Tier4 Field Optional in Type
**Location:** `types.ts:148-153`
**Severity:** LOW
**Description:** `ScoreBreakdown.tier4` is typed as optional (`tier4?: number`), but it's always populated in `calculateOnPageScore()`.

**Recommendation:** Make `tier4` required in the type definition.

---

### Summary of Recommendations

**Critical Path Improvements:**
1. **Add total audit timeout** - 30 minute SLA with user visibility
2. **Stream HTML to temp storage** - Prevent OOM on large sites
3. **Improve delete handling** - Wait for active jobs before delete

**Robustness Improvements:**
4. **Surface sitemap failures** - Include in audit summary
5. **Add crawl rate limiting** - Prevent overwhelming target sites
6. **Add Lighthouse circuit breaker** - Graceful degradation on API outage
7. **Persist Tier 3 skip reasons** - User visibility into check coverage

**Minor Polish:**
8. **Add site context progress** - Step visibility for Tier 4 setup
9. **Fix check count docs** - 109 checks consistently
10. **Paginate audit results** - Better performance for large audits

### Positive Patterns to Preserve

- **SSRF prevention** with DNS resolution checking via Cloudflare DoH
- **DoS mitigations** with size limits, BFS caps, and link graph limits
- **Step-level resume** via AUDIT_STEP enum for reliable retries
- **Graceful check failures** that don't abort the entire audit
- **Quality gate system** with hard gates for critical SEO issues
- **Real-time progress** via Redis KV with appropriate TTL
- **109 checks across 4 tiers** with proper scoring weights
- **Backpressure protection** on job queue
- **Deduplication** via `jobId: auditId` pattern
- **Sandboxed processor** for CPU isolation


---
## Agent 19: Error Handling & Recovery Patterns
**Completed:** 2026-05-04T15:30:00Z
**Files Reviewed:** 273 (targeted error handling patterns across 3153 total files)
**Issues:** 2 Critical, 5 High, 8 Medium, 4 Low

### Error Boundary Coverage

| Platform | Route Segments | Has error.tsx | Coverage |
|----------|----------------|---------------|----------|
| apps/web | 75 pages | 68 error.tsx files | 91% |
| open-seo-main | TanStack Start | Middleware-based | N/A |
| AI-Writer | FastAPI | Exception handlers | N/A |

#### Missing error.tsx in apps/web

| Route Segment | Impact |
|---------------|--------|
| `/[locale]/(shell)/dashboard` | Falls back to parent error boundary |
| `/[locale]/(shell)/settings/language` | Falls back to parent error boundary |
| `/[locale]/c/[token]/success` | Falls back to parent error boundary |
| `/(shell)/prospects/[prospectId]/scrape-config` | Falls back to parent error boundary |

### Error Handling Infrastructure Assessment

**Strengths Identified:**

1. **Unified Error Format (AI-Writer)** - `StandardHTTPException` in `/AI-Writer/backend/utils/standard_error.py` provides comprehensive error response format:
   - Standard error codes (20+ types)
   - Request ID correlation
   - Production-safe error messages (details stripped in prod)
   - HTTP status code mapping

2. **TanStack Start Error Middleware (open-seo-main)** - `/open-seo-main/src/middleware/errorHandling.ts`:
   - Unified `StandardAppError` format
   - PostHog error capture integration
   - Request ID correlation
   - Development-only stack traces

3. **Error Boundary Best Practices (apps/web)** - Root `error.tsx`:
   - Sentry integration with digest correlation
   - User-friendly messages (never exposes raw errors)
   - Development-only detailed display
   - Reset functionality

4. **BullMQ Error Handling** - Workers have comprehensive failure handlers:
   - DLQ integration for persistent failures
   - Database state updates on job failure
   - Webhook alerting for critical DLQ depth

5. **Subscription Exception System** - `/AI-Writer/backend/services/subscription/exception_handler.py`:
   - Custom exception hierarchy
   - Severity classification
   - User-friendly message mapping
   - Database alert storage for critical errors

### Findings

#### CRITICAL-ERR-01: Empty Catch Blocks Swallowing Errors (237 Instances)
**Severity:** CRITICAL
**Locations:** 
- 95 files in `apps/web/src`
- 142 files in `open-seo-main/src`
**Evidence:**
```typescript
// apps/web/src/actions/analytics/get-opportunities.ts:241
} catch {
  return 0;  // Error silently swallowed, no logging
}

// open-seo-main/src/server/features/mapping/services/relevance.ts:97
} catch {
  // Invalid URL, skip - no logging of what URL failed
}

// open-seo-main/src/server/features/graph/graph-service.ts:86
} catch {
  // Error completely ignored
}
```

**Impact:** 
- Silent failures make debugging impossible
- No visibility into error frequency or patterns
- Data integrity issues may go unnoticed
- Production issues discovered too late

**Recommendation:** Replace empty catch blocks with logged error handling:
```typescript
} catch (error) {
  log.debug("URL parsing failed during relevance check", { 
    url: url.href, 
    error: error instanceof Error ? error.message : String(error) 
  });
  // Intentional fallthrough - continue with partial data
}
```

---

#### CRITICAL-ERR-02: Internal Error Details Exposed in Production API Responses
**Severity:** CRITICAL
**Location:** `/AI-Writer/backend/api/content_planning/utils/error_handlers.py:20-23`
**Evidence:**
```python
return HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail=f"Database operation failed during {operation}: {str(error)}"  # Exposes error
)
```

**Additional Locations:**
- `/AI-Writer/backend/api/content_planning/utils/error_handlers.py:46-52` - AI service errors expose error strings
- `/AI-Writer/backend/api/content_planning/utils/error_handlers.py:66-74` - General errors expose full error strings

**Impact:**
- Stack traces may leak to users
- Internal implementation details exposed
- SQL errors could reveal schema information
- Aids attackers in fingerprinting the system

**Recommendation:** Use `StandardHTTPException` pattern consistently:
```python
return StandardHTTPException(
    code=ErrorCode.INTERNAL_ERROR,
    message="Database operation failed. Please try again.",
    request_id=get_request_id(request),
    details={"operation": operation, "error": str(error)} if not is_production() else None
)
```

---

#### HIGH-ERR-01: Inconsistent Error Logging in Route Error Boundaries
**Severity:** HIGH
**Locations:** 18+ error.tsx files
**Evidence:**
```tsx
// apps/web/src/app/connect/error.tsx:14 - Uses console.error (no Sentry)
console.error("[connect-error]", error);

// apps/web/src/app/p/[token]/error.tsx:14 - Uses console.error (no Sentry)
console.error("[public-proposal-error]", error);

// CONTRAST: apps/web/src/app/error.tsx (root) - Uses Sentry
Sentry.captureException(error, { extra: { digest: error.digest } });
```

**Files Using console.error Instead of Sentry:**
- `/connect/error.tsx`
- `/p/[token]/error.tsx`
- `/invoices/[id]/pay/error.tsx`
- `/invoices/[id]/success/error.tsx`
- `/(shell)/dashboard/tasks/error.tsx`
- `/(shell)/dashboard/revenue/error.tsx`
- `/proposals/[token]/error.tsx`
- `/(dashboard)/command-center/error.tsx`
- And 10+ more

**Impact:** Production errors in these routes never reach Sentry, creating blind spots.

**Recommendation:** Create standardized error boundary template:
```tsx
"use client";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error, { extra: { digest: error.digest } });
    logger.error(`[${ROUTE_NAME}-error]`, { digest: error.digest, message: error.message });
  }, [error]);
  // ...
}
```

---

#### HIGH-ERR-02: Missing Try-Catch in Async Functions
**Severity:** HIGH
**Pattern:** Several async server actions lack top-level error handling
**Locations:**
- `/apps/web/src/app/[locale]/c/[token]/actions.ts:85` - catch returns empty object
- `/apps/web/src/app/[locale]/c/[token]/actions.ts:115` - catch returns empty object  
- `/apps/web/src/app/[locale]/c/[token]/actions.ts:156` - catch returns empty object
- `/apps/web/src/app/[locale]/c/[token]/actions.ts:186` - catch returns empty object

**Evidence:**
```typescript
} catch {
  return { };  // Returns empty object, caller cannot distinguish error from empty data
}
```

**Impact:** Callers cannot distinguish between "no data" and "error fetching data", leading to incorrect UI states.

**Recommendation:** Return typed error responses:
```typescript
type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function getContractDetails(token: string): Promise<ActionResult<ContractDetails>> {
  try {
    // ...
    return { success: true, data };
  } catch (error) {
    logger.error("Failed to get contract details", { token, error });
    return { success: false, error: "Failed to load contract" };
  }
}
```

---

#### HIGH-ERR-03: .catch(() => ({})) Pattern Obscures Errors
**Severity:** HIGH
**Locations:** 19 instances across apps/web
**Evidence:**
```typescript
// apps/web/src/app/proposals/[token]/actions.ts:99
const data = await response.json().catch(() => ({}));
// If JSON parsing fails, error is silently swallowed

// apps/web/src/app/api/proposals/[proposalId]/accept/route.ts:78
const body: AcceptRequest = await request.json().catch(() => ({}));
// Empty object becomes invalid AcceptRequest, causing downstream errors
```

**Impact:** 
- Invalid JSON becomes empty object, passing validation incorrectly
- Downstream code fails with confusing errors ("undefined is not iterable")
- Original JSON parse error is lost

**Recommendation:**
```typescript
let body: AcceptRequest;
try {
  body = await request.json();
} catch (parseError) {
  return NextResponse.json(
    { error: "Invalid JSON in request body" },
    { status: 400 }
  );
}
```

---

#### HIGH-ERR-04: Timeout Handling Without User Notification
**Severity:** HIGH
**Location:** Multiple API routes
**Evidence:** Timeout is implemented but error message is generic:
```typescript
// apps/web/src/app/api/health/route.ts:78
const timeout = setTimeout(() => controller.abort(), 5000);
// ...
clearTimeout(timeout);
// If aborted, user gets generic "Internal error"
```

**Positive Example:**
```typescript
// apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx:557
} else if (errorMessage.includes("timeout") || errorMessage.includes("AbortError")) {
  // Properly handles timeout-specific messaging
}
```

**Recommendation:** Catch AbortError specifically:
```typescript
} catch (error) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return NextResponse.json(
      { error: "Request timed out. Please try again." },
      { status: 504 }
    );
  }
  // ...
}
```

---

#### HIGH-ERR-05: Python Generic Exception Handlers Without Re-raise
**Severity:** HIGH
**Locations:** 30+ files in AI-Writer/backend
**Evidence:**
```python
# AI-Writer/backend/logging_config.py:66-68
try:
    # Sentry breadcrumb
except Exception:
    # Don't let Sentry errors break logging
    pass

# AI-Writer/backend/app.py:72
except Exception:
    # Error swallowed
```

**Context:** While some are intentional (don't let logging break app), many are overly broad.

**Recommendation:** Use specific exception types or log before suppressing:
```python
except SentryError:  # Specific exception
    logger.debug("Sentry breadcrumb failed, continuing")
```

---

#### MED-ERR-01: Retry Logic Without Exponential Backoff in Some Services
**Severity:** MEDIUM
**Positive Pattern Found:** GA4 client has proper exponential backoff:
```typescript
// open-seo-main/src/server/services/analytics/ga4-client.ts:46
baseDelayMs: 1000, // 1 second base delay for exponential backoff
```

**Missing Pattern:**
- Some fetch calls retry linearly without jitter
- WebSocket reconnection lacks backoff

**Recommendation:** Use consistent retry utility:
```typescript
import { withRetry } from "@/lib/retry";
await withRetry(fetchData, { maxRetries: 3, baseDelayMs: 1000, backoff: "exponential" });
```

---

#### MED-ERR-02: Form Submission Errors Not Properly Surfaced
**Severity:** MEDIUM
**Pattern:** Server action errors returned but not always displayed
**Evidence:** No `useFormState`/`useActionState` hooks found in search
**Location:** Various form components

**Recommendation:** Implement form state pattern:
```tsx
const [state, formAction] = useActionState(submitForm, initialState);
// ...
{state.error && <div className="text-destructive">{state.error}</div>}
```

---

#### MED-ERR-03: Background Job Failures Not Visible to Users
**Severity:** MEDIUM
**Location:** Various job queues
**Evidence:** DLQ alerts go to Slack/Sentry but not to user dashboard
**Impact:** Users don't know when their audits/reports fail after submission

**Recommendation:** Add user-facing notification for job failures:
- Store failure notifications in database
- Display in dashboard alerts panel
- Send email notification for critical failures

---

#### MED-ERR-04: Network Error Recovery Missing in Client Components
**Severity:** MEDIUM
**Location:** Client-side fetch calls
**Pattern:** Some use React Query (good), others use raw fetch without retry

**Positive Example:**
```typescript
const findingsQuery = useQuery({
  queryKey: ["page-findings", projectId, auditId, pageId],
  queryFn: () => getPageFindings(...),
  retry: 3,  // React Query handles retry
});
```

**Missing in:** Raw fetch calls in actions, hooks

---

#### MED-ERR-05: Missing Database Transaction Rollback Logging
**Severity:** MEDIUM
**Location:** Transaction failures in repositories
**Impact:** Transaction rollbacks not visible in logs

**Recommendation:** Add explicit rollback logging:
```typescript
try {
  await tx.insert(...);
} catch (error) {
  log.warn("Transaction rolled back", { operation, error });
  throw error;
}
```

---

#### MED-ERR-06: Graceful Degradation Not Implemented for External Services
**Severity:** MEDIUM
**Location:** DataForSEO, Google APIs
**Positive Pattern:** Circuit breaker for Redis in BullMQ
**Missing:** Circuit breaker for external APIs

**Recommendation:** Implement circuit breaker pattern for external dependencies.

---

#### MED-ERR-07: Error Recovery State Not Persisted
**Severity:** MEDIUM
**Pattern:** After error boundary reset, component state is lost
**Impact:** User loses form data, selections, etc.

**Recommendation:** Persist critical form state to localStorage before operations.

---

#### MED-ERR-08: Inconsistent HTTP Status Codes for Errors
**Severity:** MEDIUM
**Evidence:**
```typescript
// Some routes return 500 with "Internal error"
return NextResponse.json({ error: "Internal error" }, { status: 500 });

// Others return 500 with detailed message
return NextResponse.json({ error: err.message }, { status: 500 });
```

**Recommendation:** Standardize error response format across all API routes.

---

#### LOW-ERR-01: console.error in Error Boundaries Should Use Structured Logger
**Severity:** LOW
**Location:** 18 error.tsx files
**Recommendation:** Replace `console.error` with `logger.error` from `@/lib/logger`

---

#### LOW-ERR-02: Missing error.tsx in 4 Route Segments
**Severity:** LOW
**Impact:** Falls back to parent boundary (acceptable but not optimal)
**Recommendation:** Add error.tsx to remaining routes for consistent UX

---

#### LOW-ERR-03: Hardcoded Timestamp in Error Response
**Severity:** LOW
**Location:** `/AI-Writer/backend/api/content_planning/utils/error_handlers.py:90`
```python
"timestamp": "2024-08-01T10:00:00Z"  # This should be dynamic
```
**Recommendation:** Use `datetime.now(timezone.utc).isoformat()`

---

#### LOW-ERR-04: Error Digest Display Could Be More User-Friendly
**Severity:** LOW
**Location:** Error boundary UI
**Pattern:** Shows raw digest: "Error ID: 8a7b6c5d4e3f"
**Recommendation:** Add copy-to-clipboard button for support tickets

---

### Summary

| Category | Good Patterns | Issues Found |
|----------|---------------|--------------|
| Error Boundaries | 91% coverage, Sentry integration | Inconsistent logging (console vs Sentry) |
| API Error Responses | StandardHTTPException, StandardAppError | Internal details exposed in some handlers |
| Empty Catch Blocks | - | 237 instances across codebase |
| Timeout Handling | AbortSignal.timeout used widely | Generic error messages for timeouts |
| Retry Logic | Exponential backoff in GA4, email | Missing in some services |
| BullMQ Error Handling | DLQ, database state updates, alerting | - |
| User Notification | - | Job failures not surfaced to users |

### Remediation Priority

1. **Immediate (CRITICAL):**
   - CRITICAL-ERR-01: Replace 237 empty catch blocks with logged handlers
   - CRITICAL-ERR-02: Use StandardHTTPException in content planning handlers

2. **Current Sprint (HIGH):**
   - HIGH-ERR-01: Standardize error boundaries to use Sentry
   - HIGH-ERR-02: Return typed ActionResult from server actions
   - HIGH-ERR-03: Handle JSON.parse failures explicitly
   - HIGH-ERR-04: Provide specific timeout error messages
   - HIGH-ERR-05: Use specific exception types in Python

3. **Next Sprint (MEDIUM):**
   - MED-ERR-01: Standardize retry logic across services
   - MED-ERR-02: Implement useFormState for form submissions
   - MED-ERR-03: Add user-facing job failure notifications
   - MED-ERR-06: Implement circuit breakers for external APIs

### Cross-Reference to Other Agents

- **Agent 10 (BullMQ):** DLQ handling reviewed, aligns with HIGH-01 findings
- **Agent 17 (Input Validation):** HIGH-VAL-03 JSON.parse relates to HIGH-ERR-03
- **Agent 5 (Next.js):** Error boundaries reviewed, aligns with coverage assessment

---

## Agent 20: Race Conditions & Concurrency
**Completed:** 2026-05-04T15:15:00Z
**Files Reviewed:** 62
**Issues:** 0 Critical, 3 High, 5 Medium, 4 Low

### Concurrency Architecture Overview

| Service | Concurrency Model | Lock Strategy | Transaction Support |
|---------|-------------------|---------------|---------------------|
| open-seo-main | BullMQ workers (19 total) | Redis distributed locks | Drizzle transactions with isolation levels |
| AI-Writer | APScheduler + async | Redis idempotency | SQLAlchemy async sessions |
| apps/web | Next.js Server Actions | None (stateless) | N/A (API calls only) |

### Concurrency Risk Areas

| Area | Files | Risk Level | Current Protection |
|------|-------|------------|-------------------|
| Job Processing | 19 workers | LOW | BullMQ locking, sandboxed processors |
| Distributed Locks | job-deduplication.ts | LOW | Lua atomic operations |
| Status Updates | repositories/*.ts | MEDIUM | Partial - some missing optimistic locking |
| Cache Invalidation | redis.ts | LOW | Proper TTL, no race conditions |
| Idempotency | idempotency.py, transaction.ts | LOW | Well-implemented patterns |

---

### HIGH-CONC-01: Invoice Status Update Race Condition

**Location:** `open-seo-main/src/server/features/contracts/repositories/InvoiceRepository.ts`
**Severity:** HIGH

**Issue:** The `updateStatus()` method performs a simple UPDATE without checking the current status version, allowing concurrent updates to overwrite each other.

```typescript
// Current implementation - no version check
async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
  const [updated] = await db
    .update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return updated;
}
```

**Risk:** When multiple webhook callbacks or payment processors fire simultaneously, the final status may not reflect the correct payment state (e.g., "paid" overwritten by delayed "processing" callback).

**Remediation:**
```typescript
async updateStatus(
  id: string, 
  status: InvoiceStatus,
  expectedVersion: number
): Promise<Invoice | null> {
  const [updated] = await db
    .update(invoices)
    .set({ 
      status, 
      version: sql`${invoices.version} + 1`,
      updatedAt: new Date() 
    })
    .where(and(
      eq(invoices.id, id),
      eq(invoices.version, expectedVersion)
    ))
    .returning();
  return updated ?? null; // null indicates conflict
}
```

---

### HIGH-CONC-02: Audit Progress Update Without Locking

**Location:** `open-seo-main/src/server/features/audit/repositories/AuditRepository.ts`
**Severity:** HIGH

**Issue:** The `updateProgress()` method updates audit progress without row-level locking or version checking.

```typescript
// Simplified from actual code
async updateProgress(
  auditId: string,
  progress: number,
  phase: string
): Promise<void> {
  await db
    .update(audits)
    .set({ progress, currentPhase: phase, updatedAt: new Date() })
    .where(eq(audits.id, auditId));
}
```

**Risk:** When multiple worker threads process different phases of the same audit concurrently, progress updates can interleave incorrectly. Phase A at 50% could overwrite Phase B at 80%.

**Remediation:**
1. Add `.for("update")` row lock when reading current progress
2. Use atomic increment: `progress: sql\`GREATEST(${audits.progress}, ${newProgress})\``
3. Or implement optimistic locking with version column

---

### HIGH-CONC-03: Report Email Race Condition

**Location:** `open-seo-main/src/server/workers/schedule-processor.ts`
**Severity:** HIGH

**Issue:** The scheduled report email job checks if a report was already sent, but the check and mark operations are not atomic.

```typescript
// Simplified pattern
const schedule = await getSchedule(scheduleId);
if (schedule.lastSentAt && isWithinWindow(schedule.lastSentAt)) {
  return; // Already sent
}
// ... generate and send email ...
await markAsSent(scheduleId); // RACE: another instance may have sent in between
```

**Risk:** If two scheduler instances fire at the same instant (clock drift, container restart), clients may receive duplicate report emails.

**Remediation:**
```typescript
// Use atomic check-and-set with distributed lock
const lockKey = `report-email:${scheduleId}`;
const acquired = await acquireLock(lockKey, 300); // 5 min TTL
if (!acquired) return;

try {
  const schedule = await getSchedule(scheduleId);
  if (schedule.lastSentAt && isWithinWindow(schedule.lastSentAt)) {
    return;
  }
  await sendReportEmail(schedule);
  await markAsSent(scheduleId);
} finally {
  await releaseLock(lockKey);
}
```

---

### MEDIUM-CONC-01: Webhook Delivery Redundant SELECT Before INSERT

**Location:** `open-seo-main/src/services/webhooks.ts`
**Severity:** MEDIUM

**Issue:** The webhook delivery tracking performs a SELECT to check existence before INSERT, creating a TOCTOU window.

```typescript
// Current pattern
const existing = await db.select().from(webhookDeliveries)
  .where(eq(webhookDeliveries.idempotencyKey, key));
if (existing.length > 0) return;
// Window here where another process could insert
await db.insert(webhookDeliveries).values({...});
```

**Positive:** The code does use `ON CONFLICT DO NOTHING` in some paths, but not consistently.

**Remediation:** Always use `INSERT ... ON CONFLICT DO NOTHING` without the preceding SELECT.

---

### MEDIUM-CONC-02: Ranking Batch Processing Without Checkpointing

**Location:** `open-seo-main/src/server/workers/keyword-ranking-worker.ts`
**Severity:** MEDIUM

**Issue:** Large keyword ranking batches process keywords sequentially without checkpointing progress. If the job fails mid-batch, all progress is lost.

**Risk:** For batches of 100+ keywords, a failure at keyword 99 requires re-processing all 99 successful keywords.

**Remediation:**
1. Checkpoint progress every N keywords (e.g., 10)
2. Store checkpoint in Redis with job ID
3. On job retry, resume from last checkpoint

---

### MEDIUM-CONC-03: TransactionContext Job Enqueue on Rollback

**Location:** `open-seo-main/src/server/lib/db-transaction.ts`
**Severity:** MEDIUM

**Issue:** The `TransactionContext` pattern queues jobs to run after commit, but `runPostCommitJobs()` has no error isolation - if job 1 fails, jobs 2-N are skipped.

```typescript
class TransactionContext {
  private postCommitJobs: (() => Promise<void>)[] = [];
  
  enqueuePostCommit(job: () => Promise<void>) {
    this.postCommitJobs.push(job);
  }
  
  async runPostCommitJobs() {
    for (const job of this.postCommitJobs) {
      await job(); // Only called after commit
    }
  }
}
```

**Remediation:**
```typescript
async runPostCommitJobs() {
  const results = await Promise.allSettled(
    this.postCommitJobs.map(job => job())
  );
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.error('Post-commit jobs failed', { failures });
  }
}
```

---

### MEDIUM-CONC-04: AI-Writer Polling Instead of Pub/Sub

**Location:** `AI-Writer/backend/services/generation_service.py`
**Severity:** MEDIUM

**Issue:** The content generation status check uses polling with fixed intervals rather than event-driven notifications.

```python
# Frontend polls this endpoint
@router.get("/generation/{job_id}/status")
async def get_generation_status(job_id: str):
    return await generation_service.get_status(job_id)
```

**Impact:** Under high load, polling creates unnecessary database queries. Not a race condition but a concurrency inefficiency.

**Remediation:** Implement WebSocket or SSE for real-time status updates.

---

### MEDIUM-CONC-05: Optimistic Mutation Version Detection

**Location:** `apps/web/src/hooks/use-optimistic-mutation.ts`
**Severity:** MEDIUM

**Issue:** The optimistic mutation hook detects conflicts via HTTP 409 response, but the actual API endpoints don't consistently return 409 for version mismatches.

```typescript
// Hook expects 409
if (error.status === 409) {
  // Conflict detected, invalidate and refetch
  await queryClient.invalidateQueries({ queryKey });
}
```

**Gap:** Backend repositories that lack version columns can't detect conflicts, so 409 is never returned and conflicts silently succeed with last-write-wins.

**Remediation:** Add version columns to entities that use optimistic mutations, return 409 on mismatch.

---

### LOW-CONC-01: Lock TTL Configuration Inconsistency

**Location:** `open-seo-main/src/server/lib/job-deduplication.ts`
**Severity:** LOW

**Issue:** Different lock types use inconsistent TTLs without clear documentation of the reasoning.

| Lock Type | TTL | Usage |
|-----------|-----|-------|
| Job dedup | 3600s | Too long for fast jobs |
| Report schedule | 300s | Appropriate |
| Audit lock | 120s | Appropriate |

**Remediation:** Add configuration comments explaining TTL choices, consider dynamic TTL based on expected job duration.

---

### LOW-CONC-02: Python Threading Lock Scope

**Location:** `AI-Writer/backend/utils/rate_limiter.py`
**Severity:** LOW

**Issue:** The token bucket rate limiter uses `threading.Lock()` which only works within a single process.

```python
class TokenBucketRateLimiter:
    def __init__(self, ...):
        self._lock = threading.Lock()
```

**Impact:** Low - AI-Writer runs as a single Uvicorn process in production. Would become an issue with multi-process deployment.

**Remediation:** Document single-process requirement or use Redis-based distributed rate limiter.

---

### LOW-CONC-03: Checkpoint Atomicity in Crawl Worker

**Location:** `open-seo-main/src/server/workers/crawl-worker.ts`
**Severity:** LOW

**Issue:** Crawl progress checkpoints write URL status and progress counter in separate operations.

**Impact:** Minimal - BullMQ job retry will re-process some URLs but the system handles duplicates gracefully.

---

### LOW-CONC-04: WebSocket State Sync JWT Refresh

**Location:** `apps/web/src/lib/websocket.ts`
**Severity:** LOW

**Issue:** WebSocket reconnection after JWT refresh may have a brief window where stale state is displayed before the new connection syncs.

**Impact:** Cosmetic - users see slightly stale data for ~1-2 seconds during token refresh.

---

### Positive Patterns Identified

1. **Distributed Lock System** (`job-deduplication.ts`)
   - Lua scripts for atomic acquire/release
   - Lock extension for long-running jobs
   - Proper cleanup with `releaseLockSafe()`

2. **Transaction Wrappers** (`db-transaction.ts`)
   - Isolation level support (SERIALIZABLE available)
   - Post-commit job queue pattern
   - Error preservation through transaction boundary

3. **Idempotency Infrastructure**
   - Redis-based (`AI-Writer/backend/utils/idempotency.py`)
   - PostgreSQL-based (`open-seo-main/src/lib/db/transaction.ts`)
   - Consistent API: `withIdempotency(key, fn)`

4. **BullMQ Best Practices**
   - Sandboxed processors for isolation
   - Heartbeat mechanism for stall detection
   - Graceful shutdown with timeout

5. **Atomic Upserts**
   - `ON CONFLICT DO UPDATE` for state merges
   - `ON CONFLICT DO NOTHING` for idempotent inserts

### Remediation Priority

1. **HIGH:** Add optimistic locking to InvoiceRepository status updates
2. **HIGH:** Implement distributed lock for report email sending
3. **HIGH:** Add atomic progress updates for audit repository
4. **MEDIUM:** Standardize 409 responses for version conflicts
5. **MEDIUM:** Add checkpointing to keyword ranking batches
6. **MEDIUM:** Isolate post-commit job failures
7. **LOW:** Document lock TTL reasoning
8. **LOW:** Consider distributed rate limiter for multi-process deployment

### Cross-Reference to Other Agents

- **Agent 7 (Drizzle):** Transaction patterns reviewed, aligns with HIGH-CONC-01/02 findings
- **Agent 10 (BullMQ):** Worker concurrency settings complement this review
- **Agent 19 (Error Handling):** Post-commit job failures relate to MEDIUM-CONC-03

---
## Agent 4: Event Queue Integration (BullMQ + APScheduler)
**Completed:** 2026-05-04T15:30:00Z
**Files Reviewed:** 52
**Issues:** 0 Critical, 1 High, 4 Medium, 2 Low

### Queue Inventory

#### open-seo-main (BullMQ)

| Queue Name | Redis Prefix | Connection | DLQ | Retry Policy | Lock Duration |
|------------|--------------|------------|-----|--------------|---------------|
| audit-queue | openseo: (DB 0) | queue:audit | centralized + failed-audits | 3 attempts, exp 1s-60s | 120s |
| failed-audits | openseo: (DB 0) | queue:failed-audits | N/A (terminal) | 1 attempt | N/A |
| analytics-sync | openseo: (DB 0) | queue:analytics | inline DLQ prefix | 3 attempts, exp 10s | 120s |
| keyword-ranking | openseo: (DB 0) | queue:ranking | centralized DLQ | 3 attempts, exp 10s | 300s |
| report-scheduler | openseo: (DB 0) | queue:schedule | inline DLQ prefix | 3 attempts, exp 1s-60s | 60s |
| report-generation | openseo: (DB 0) | queue:report | inline DLQ prefix | 3 attempts, exp 1s-60s | 90s |
| webhook-delivery | openseo: (DB 0) | queue:webhook | inline DLQ prefix | 3 attempts, exp 60s | 60s |
| onboarding | openseo: (DB 0) | queue:onboarding | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| maintenance | openseo: (DB 0) | queue:maintenance | centralized DLQ | 3 attempts, exp 5s | 120s |
| alert-processing | openseo: (DB 0) | queue:alert | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| alert-detection | openseo: (DB 0) | queue:alert-detection | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| dashboard-metrics | openseo: (DB 0) | queue:dashboard-metrics | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| prospect-analysis | openseo: (DB 0) | queue:prospect-analysis | inline DLQ prefix | 3 attempts, exp 10s | 180s |
| voice-analysis | openseo: (DB 0) | queue:voice-analysis | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| portfolio-aggregates | openseo: (DB 0) | queue:portfolio-aggregates | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| goal-processor | openseo: (DB 0) | queue:goal | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| pipeline-phase | openseo: (DB 0) | queue:phase | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| pipeline-plan | openseo: (DB 0) | queue:plan | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| dead-letter-queue | openseo: (DB 0) | queue:dlq | N/A (terminal) | 1 attempt | 60s |
| engagement-workflow | openseo: (DB 0) | queue:workflow | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| graph-ingestion | openseo: (DB 0) | queue:graph-ingestion | centralized DLQ | 3 attempts, exp 5s | N/A |
| fast-api | openseo: (DB 0) | queue:fast-api | centralized DLQ | 3 attempts, exp 1s-60s | N/A |
| token-refresh | openseo: (DB 0) | queue:token-refresh | centralized DLQ | 3 attempts, exp 1s-60s | N/A |
| installment-reminders | openseo: (DB 0) | queue:installment-reminder | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |
| pipeline-metrics | openseo: (DB 0) | queue:pipeline-metrics | inline DLQ prefix | 3 attempts, exp 1s-60s | N/A |

**Total: 25 BullMQ queues**

#### AI-Writer (APScheduler + BackgroundJobService)

| Component | Redis Prefix | Database | DLQ | Retry Policy | Job Timeout |
|-----------|--------------|----------|-----|--------------|-------------|
| BackgroundJobService | aiwriter:jobs: (DB 1) | In-memory + Redis persistence | Stalled detection | None (status-based) | 600s (10min stall) |
| APScheduler (production) | aiwriter: (DB 2) | Redis jobstore | Misfire grace 1h | max_instances=1, coalesce=true | 1800s (30min) |
| APScheduler (development) | aiwriter: | SQLAlchemy jobstore | Misfire grace 1h | max_instances=1, coalesce=true | 1800s (30min) |
| PersistentJobStorage | aiwriter:jobs:{status} | Redis hashes | Stalled detection | None | 600s stall timeout |

**Job Types Registered in BackgroundJobService:**
- `bing_comprehensive_insights`
- `bing_data_collection`
- `analytics_refresh`

**APScheduler Recurring Jobs:**
- `check_due_tasks` - 15-60 min interval (dynamic)
- `nightly_rank_check` - Weekly
- OAuth token monitoring - Per-user tasks
- Website analysis - Per-user tasks
- Platform insights - Per-user tasks (GSC/Bing)
- Advertools intelligence - Per-user tasks

### Namespace Isolation Assessment

**VERIFIED SAFE - No Collision Risk:**

| Service | Redis DB | Key Prefix | Queue Prefix |
|---------|----------|------------|--------------|
| open-seo-main | DB 0 | openseo: | bull:openseo:* |
| AI-Writer jobs | DB 1 | aiwriter:jobs: | N/A |
| AI-Writer scheduler | DB 2 | aiwriter: | N/A |

**Implementation:** Both services explicitly configure separate Redis databases:
- `open-seo-main/src/server/lib/redis.ts` line 35: `REDIS_SERVICE_DB = parseInt(process.env.REDIS_DB ?? "0", 10)`
- `AI-Writer/backend/config/redis_config.py` line 50: `DEFAULT_DB = int(os.environ.get("REDIS_DB", "1"))`
- APScheduler uses DB 2 via `REDIS_SCHEDULER_DB` env var

**Cross-Service Idempotency:**
- Shared namespace: `tevero:idempotency:` prefix
- Both services use same IDEMPOTENCY_TTL_SECONDS (3600s default)
- Enables cross-service duplicate detection

---

### Findings

#### HIGH-QUEUE-01: MaintenanceQueue Uses Non-Standard Backoff Configuration
**Location:** `open-seo-main/src/server/queues/maintenanceQueue.ts` lines 30-38

**Description:** The maintenance queue uses a custom backoff configuration (5s base, exponential) instead of the standardized `getStandardJobOptions()` used by other queues. This creates inconsistent retry behavior and bypasses centralized backoff tuning.

```typescript
// Current - inconsistent with other queues
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000, // 5s, 10s, 20s - different from standard 1s base
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};
```

**Impact:** Maintenance jobs retry slower than necessary. If backoff tuning is needed globally, this queue will be missed.

**Recommendation:** Use standardized job options:
```typescript
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});
```

---

#### MED-QUEUE-01: AI-Writer BackgroundJobService Lacks Max Retry Configuration
**Location:** `AI-Writer/backend/services/background_jobs.py` lines 430-500

**Description:** The BackgroundJobService executes jobs and marks them as FAILED on exception, but provides no automatic retry mechanism. Jobs that fail due to transient errors (network blips, temporary API unavailability) are permanently marked as failed.

```python
except Exception as e:
    logger.error(f"Job {job_id} failed: {e}\n{traceback.format_exc()}")
    with self._jobs_lock:
        job = self._jobs.get(job_id)
        if job:
            job.status = JobStatus.FAILED  # No retry, immediate permanent failure
```

**Impact:** Transient failures result in permanent job failure, requiring manual user re-triggering.

**Recommendation:** Add configurable retry logic:
```python
MAX_RETRIES = 3
RETRY_DELAYS = [30, 120, 300]  # 30s, 2m, 5m

if retry_count < MAX_RETRIES:
    job.retry_count = retry_count + 1
    job.status = JobStatus.PENDING
    job.scheduled_at = datetime.now() + timedelta(seconds=RETRY_DELAYS[retry_count])
else:
    job.status = JobStatus.FAILED
```

---

#### MED-QUEUE-02: Missing DLQ Handler for Multiple BullMQ Queues
**Location:** Multiple queue files in `open-seo-main/src/server/queues/`

**Description:** Several queues define inline DLQ job data types (`*DLQJobData`) but there's no evidence of actual job movement to the centralized DLQ on terminal failure. The centralized `dlq.ts` queue exists but not all workers implement the pattern of moving failed jobs there.

**Queues with DLQ types but unclear routing:**
- `analyticsQueue` - has `AnalyticsDLQJobData` but no routing code found
- `scheduleQueue` - has `ScheduleDLQJobData` but no routing code found
- `rankingQueue` - has `RankingDLQJobData` but no routing code found
- `workflowQueue` - has `WorkflowDLQJobData` but no routing code found

**Impact:** Failed jobs after max retries may be lost rather than preserved in DLQ for investigation.

**Recommendation:** Ensure all workers with DLQ types implement the `failed` event handler pattern:
```typescript
worker.on("failed", async (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    await getDLQQueue().add(`dlq:${queueName}:${job.id}`, {
      originalQueue: queueName,
      jobId: job.id,
      jobData: job.data,
      error: err.message,
      stack: err.stack,
      failedAt: new Date().toISOString(),
    });
  }
});
```

---

#### MED-QUEUE-03: APScheduler Missing Explicit Shutdown Timeout
**Location:** `AI-Writer/backend/services/scheduler/core/scheduler.py` lines 716-810

**Description:** The scheduler's `stop()` method calls `self.scheduler.shutdown(wait=True)` which waits indefinitely for running jobs to complete. Unlike the BackgroundJobService which has explicit task cancellation with timeout, the APScheduler shutdown has no timeout protection.

```python
# Waits indefinitely
self.scheduler.shutdown(wait=True)
```

**Impact:** Process shutdown can hang indefinitely if a job is stuck, preventing clean container restart/deployment.

**Recommendation:** Add shutdown timeout:
```python
import asyncio

# Wait for active executions with timeout
if self.active_executions:
    done, pending = await asyncio.wait(
        self.active_executions.values(),
        timeout=30  # Already present, good!
    )

# Add timeout to scheduler shutdown
try:
    await asyncio.wait_for(
        asyncio.to_thread(self.scheduler.shutdown, wait=True),
        timeout=10.0
    )
except asyncio.TimeoutError:
    logger.warning("Scheduler shutdown timeout, forcing")
    self.scheduler.shutdown(wait=False)
```

---

#### MED-QUEUE-04: BullMQ Job Data Size Not Validated
**Location:** All queue `add()` calls across `open-seo-main/src/server/queues/`

**Description:** BullMQ jobs are stored in Redis, which has a default 512MB limit per key. There's no validation of job data size before enqueueing, which could cause Redis memory issues or job creation failures with large payloads.

**Impact:** Large job payloads (e.g., bulk audit configs with thousands of URLs) could cause Redis memory pressure or silent job failures.

**Recommendation:** Add job data size validation in `addJobWithBackpressure()`:
```typescript
const MAX_JOB_SIZE_BYTES = 1024 * 1024; // 1MB limit

export async function addJobWithBackpressure<T>(
  queue: Queue<T>,
  name: string,
  data: T,
  ...
): Promise<Job<T>> {
  // Validate job size
  const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
  if (dataSize > MAX_JOB_SIZE_BYTES) {
    throw new Error(`Job data exceeds maximum size (${dataSize} > ${MAX_JOB_SIZE_BYTES})`);
  }
  // ... rest of function
}
```

---

#### LOW-QUEUE-01: Repeatable Job Cleanup Race Condition in rankingQueue
**Location:** `open-seo-main/src/server/queues/rankingQueue.ts` lines 82-116

**Description:** The `initRankingScheduler()` function first adds a repeatable job, then iterates and removes old repeatables. While the comment says this is atomic, there's a race window where another process starting simultaneously could see duplicate jobs briefly.

```typescript
// First, add the new repeatable job
await rankingQueue.add("check-keyword-rankings", {...});

// Now safe to remove old repeatables - but another process might be here too
const repeatableJobs = await rankingQueue.getRepeatableJobs();
for (const job of repeatableJobs) {
  if (job.id === jobId && job.pattern === "0 3 * * *") continue;
  await rankingQueue.removeRepeatableByKey(job.key);
}
```

**Impact:** Low - minimal real-world impact as repeatable job IDs are unique and cleanup is idempotent.

**Recommendation:** Consider using `upsertJobScheduler()` pattern (used correctly in analyticsQueue and scheduleQueue) which is inherently atomic:
```typescript
await rankingQueue.upsertJobScheduler(
  "ranking-scheduler",
  { pattern: "0 3 * * *" },
  { name: "check-keyword-rankings", data: { triggeredAt: new Date().toISOString() } }
);
```

---

#### LOW-QUEUE-02: PersistentJobStorage TTL Not Enforced for Completed Jobs
**Location:** `AI-Writer/backend/services/job_storage.py` lines 109-110

**Description:** The class defines TTL constants for completed (24h) and failed (7d) jobs, but these are not enforced via Redis TTL. Jobs are stored in Redis hashes which don't support per-field TTL.

```python
COMPLETED_TTL_SECONDS = 24 * 60 * 60  # 24 hours
FAILED_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days

# But mark_completed() doesn't set TTL:
pipe.hset(to_key, job_id, updated_json)  # No EXPIRE
```

**Impact:** Completed/failed jobs may accumulate in Redis beyond retention period until manual `cleanup_old_jobs()` is called.

**Recommendation:** The `cleanup_old_jobs()` method exists and handles this, but consider scheduling it automatically:
```python
def __init__(self, ...):
    # ... existing init
    # Start periodic cleanup
    self._start_cleanup_thread()

def _start_cleanup_thread(self):
    def cleanup_loop():
        while True:
            time.sleep(self.COMPLETED_TTL_SECONDS)  # Run daily
            self.cleanup_old_jobs(max_age_hours=24)
    
    threading.Thread(target=cleanup_loop, daemon=True).start()
```

---

### Graceful Shutdown Assessment

| Service | Component | Shutdown Handling | Rating |
|---------|-----------|-------------------|--------|
| open-seo-main | All 19 workers | `stopXWorker()` with 25s timeout, force-close fallback | **Excellent** |
| open-seo-main | All queues | `closeXQueue()` functions with proper connection cleanup | **Excellent** |
| open-seo-main | Redis | `closeRedis()` closes all pooled connections | **Excellent** |
| open-seo-main | HTTP server | SIGTERM/SIGINT handlers with proper ordering | **Excellent** |
| AI-Writer | BackgroundJobService | `_cancel_background_tasks()` with 5s timeout | **Good** |
| AI-Writer | APScheduler | `shutdown(wait=True)` - no timeout | **Needs Improvement** |
| AI-Writer | FastAPI app | Signal handlers + startup/shutdown events | **Good** |

---

### Connection Pool Assessment

| Service | Pool Type | Max Connections | Config Location |
|---------|-----------|-----------------|-----------------|
| open-seo-main | BullMQ connections | 50 labeled connections | `getSharedBullMQConnection()` |
| open-seo-main | PostgreSQL | Pool managed by pg | `pool` from `@/db` |
| AI-Writer | Redis (job storage) | 1 per service | `redis.Redis.from_url()` |
| AI-Writer | SQLAlchemy | Session-per-request | Multi-tenant pattern |

**Worker Concurrency Limits (open-seo-main):**
Total: 50 concurrent job processors (matches DB pool headroom)
- Audit: 5
- Report: 3
- Schedule: 2
- Ranking: 3
- Alert: 3
- Dashboard metrics: 2
- Prospect analysis: 3
- Voice analysis: 2
- Analytics: 3
- Webhook: 5
- Portfolio aggregates: 2
- Goal: 2
- Auto-revert: 1
- Phase: 3
- Plan: 3
- Onboarding: 2
- Maintenance: 1
- DLQ: 5
- Failed audits: 2

---

### Cross-Service Integration Patterns

#### Verified Working:
1. **Idempotency Keys** - Both services use `tevero:idempotency:` prefix for cross-service duplicate detection
2. **Redis DB Isolation** - DB 0 (BullMQ), DB 1 (AI-Writer jobs), DB 2 (APScheduler)
3. **Circuit Breaker** - open-seo-main has Redis failure tracking with auto-recovery

#### Potential Coordination Points:
1. **No direct queue-to-queue communication** - Each service manages its own queues
2. **API-based coordination** - Cross-service work happens via HTTP calls, not shared queues
3. **Shared Redis instance** - Both services connect to same Redis, different DBs

---

### Remediation Priority

1. **HIGH:** Standardize maintenanceQueue backoff configuration
2. **MEDIUM:** Add retry logic to AI-Writer BackgroundJobService
3. **MEDIUM:** Ensure all workers route terminal failures to centralized DLQ
4. **MEDIUM:** Add APScheduler shutdown timeout
5. **MEDIUM:** Add job data size validation
6. **LOW:** Use upsertJobScheduler for ranking queue
7. **LOW:** Schedule automatic cleanup for PersistentJobStorage
---
## Agent 8: FastAPI Backend (AI-Writer)
**Completed:** 2026-05-04T14:45:00Z
**Files Reviewed:** 250+ Python files across api/, routers/, middleware/, services/
**Issues:** 0 Critical, 3 High, 5 Medium, 4 Low

### Endpoint Inventory

| Router/Module | Endpoints | Auth | Pydantic | Rate Limited |
|---------------|-----------|------|----------|--------------|
| `api/articles.py` | 12 | Yes | Yes | Yes |
| `api/clients.py` | 15 | Yes | Yes | Yes |
| `api/csv_import.py` | 3 | Yes | Yes | In-memory |
| `api/images.py` | 4 | Yes | Partial | Yes |
| `api/streaming.py` | 3 | Yes | Yes | Yes |
| `routers/seo_tools.py` | 18 | Yes | Yes | Yes |
| `routers/wix_routes.py` | 8 | Yes | Yes | Yes |
| `routers/wordpress_routes.py` | 10 | Yes | Yes | Yes |
| `routers/blog_preview.py` | 5 | Yes | Yes | Yes |
| `routers/publishing.py` | 6 | Yes | Yes | Yes |
| **Total** | ~90+ | 99% | 97% | 85% |

### Authentication Architecture

**Clerk JWT Verification** (`middleware/auth_middleware.py`):
- PyJWKClient with automatic key rotation and caching
- No auth bypass fallback (correct - fails closed)
- 60-second clock skew leeway for distributed systems
- `get_current_user()` dependency extracts `user_id` from token claims

**Multi-tenant Access Control** (`middleware/auth_middleware.py`):
- `require_client_access()` dependency validates client ownership
- Direct database lookup verifies `clients.user_id == token.user_id`
- Returns 403 Forbidden if ownership mismatch

### Findings

#### HIGH-FASTAPI-01: Sync Image Generation Blocking Async Event Loop
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/api/images.py`
**Lines:** 45-89
**Issue:** Image generation endpoint uses `def generate()` (sync) with database operations

```python
@router.post("/generate")
def generate(
    request: ImageGenerationRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Database operations and API calls in sync function
    result = image_service.generate_image(request.prompt, ...)
    db.add(ImageGeneration(...))
    db.commit()
```

**Impact:** Blocks uvicorn worker thread. During image generation (10-30 seconds), this worker cannot handle other requests. With 4 workers and concurrent image requests, server becomes unresponsive.

**Recommendation:** Convert to `async def` with `run_in_executor()` for blocking calls:
```python
@router.post("/generate")
async def generate(...):
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, image_service.generate_image, ...)
```

---

#### HIGH-FASTAPI-02: Background Task Exception Handling Gaps
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/routers/seo_tools.py`
**Lines:** 745-820
**Issue:** Background task `_run_sitemap_benchmark_background` has exception handling but failures may not be reported back to user

```python
async def _run_sitemap_benchmark_background(task_id: str, url: str, ...):
    try:
        # Long-running benchmark
        result = await sitemap_service.benchmark(url)
        _update_task_status(task_id, "completed", result)
    except Exception as e:
        logger.error(f"Background task failed: {e}")
        _update_task_status(task_id, "failed", str(e))
        # No notification mechanism to user
```

**Impact:** User must poll for status. If task silently fails, user may wait indefinitely.

**Recommendation:** Add webhook/notification callback for task completion or failure.

---

#### HIGH-FASTAPI-03: Rate Limiter Fail-Open on Redis Unavailability
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/rate_limit.py`
**Lines:** 180-210
**Issue:** When Redis is unavailable, rate limiter falls back to in-memory but allows requests for non-critical paths

```python
FAIL_CLOSED_PATHS = [
    "/api/generate",
    "/api/articles/generate",
    "/api/images/generate",
]

async def check_rate_limit(request: Request, ...):
    if redis_unavailable:
        if request.path in FAIL_CLOSED_PATHS:
            raise HTTPException(503, "Rate limiting unavailable")
        # Else: falls through - allows request
```

**Impact:** During Redis outage, non-generation endpoints become unprotected. Could allow abuse of expensive operations like bulk imports.

**Recommendation:** Expand `FAIL_CLOSED_PATHS` to include all mutation endpoints or implement sliding window in-memory fallback.

---

#### MED-FASTAPI-01: CSV Import In-Memory Rate Limit Not Shared Across Workers
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/api/csv_import.py`
**Lines:** 25-40
**Issue:** Rate limiting uses in-memory dict, not Redis

```python
_user_import_timestamps: Dict[str, List[float]] = {}
MAX_IMPORTS_PER_HOUR = 5

def _check_import_rate_limit(user_id: str) -> bool:
    timestamps = _user_import_timestamps.get(user_id, [])
    recent = [t for t in timestamps if time.time() - t < 3600]
    return len(recent) < MAX_IMPORTS_PER_HOUR
```

**Impact:** With multiple uvicorn workers, each worker tracks separately. User could import 5 * num_workers files per hour.

**Recommendation:** Move to Redis-backed rate limiting or use shared memory.

---

#### MED-FASTAPI-02: Missing Response Models on Some Endpoints
**Files:** Various endpoints
**Issue:** Some endpoints return `dict` without Pydantic `response_model`

```python
# GOOD - has response model
@router.get("/clients/{client_id}", response_model=ClientResponse)

# MISSING - returns raw dict
@router.get("/health")
def health_check():
    return {"status": "healthy", "version": VERSION}
```

**Impact:** OpenAPI documentation incomplete. No automatic response validation.

**Recommendation:** Add `response_model` to all endpoints.

---

#### MED-FASTAPI-03: SEO Dashboard Route Code Organization
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/routers/seo_tools.py`
**Lines:** 1-873
**Issue:** Single file with 873 lines containing 18 endpoints, multiple services

**Impact:** Difficult to maintain and test. High cognitive load for developers.

**Recommendation:** Split into logical sub-routers:
- `seo_tools/sitemap.py`
- `seo_tools/analytics.py`
- `seo_tools/benchmarks.py`

---

#### MED-FASTAPI-04: Pydantic v1 Validators Being Used
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/requests.py`
**Issue:** Using Pydantic v1 validator syntax

```python
from pydantic import validator

class ArticleRequest(BaseModel):
    @validator('title')
    def validate_title(cls, v):
        ...
```

**Impact:** Pydantic v2 migrated to `@field_validator`. Current code works but emits deprecation warnings.

**Recommendation:** Migrate to Pydantic v2 syntax:
```python
from pydantic import field_validator

@field_validator('title')
@classmethod
def validate_title(cls, v):
    ...
```

---

#### MED-FASTAPI-05: No Request Body Size Limit Configuration
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/main.py`
**Issue:** No explicit `BODY_SIZE_LIMIT` configured in uvicorn or middleware

**Impact:** Large request bodies could exhaust server memory.

**Recommendation:** Add body size limit:
```python
# In main.py or middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Or in uvicorn config
config = uvicorn.Config(app, limit_concurrency=100, limit_max_requests=10000)
```

---

#### LOW-FASTAPI-01: Inconsistent Error Response Format
**Files:** Various API modules
**Issue:** Error responses mix formats

```python
# Format 1
return JSONResponse({"error": "message"}, status_code=400)

# Format 2
raise HTTPException(status_code=400, detail="message")

# Format 3
return {"success": False, "error": "message"}
```

**Impact:** Frontend must handle multiple error formats.

**Recommendation:** Standardize on HTTPException with custom exception handler returning consistent format.

---

#### LOW-FASTAPI-02: Health Check Exposes Version Information
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/main.py`
**Lines:** 120-130
**Issue:** `/health` endpoint returns version and environment info

```python
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": VERSION,
        "environment": ENVIRONMENT
    }
```

**Impact:** Minor information disclosure. Attackers can identify specific versions.

**Recommendation:** Return minimal info in production:
```python
if ENVIRONMENT == "production":
    return {"status": "healthy"}
```

---

#### LOW-FASTAPI-03: Token Query Parameter Deprecation Warning
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py`
**Lines:** 85-95
**Issue:** Token can be passed via query parameter (deprecated)

```python
# Deprecated: token in query string
token = request.query_params.get("token")
if token:
    logger.warning("Token passed via query parameter - deprecated")
```

**Impact:** Tokens in URLs appear in logs, browser history, referrer headers.

**Recommendation:** Remove query parameter token support in next major version.

---

#### LOW-FASTAPI-04: In-Memory Job Storage for Background Tasks
**File:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/background_jobs.py`
**Lines:** 30-50
**Issue:** Background job status stored in memory dict

```python
_job_statuses: Dict[str, JobStatus] = {}

def update_job_status(job_id: str, status: str, result: Any = None):
    _job_statuses[job_id] = JobStatus(status=status, result=result, updated_at=time.time())
```

**Impact:** Job status lost on server restart. Not shared across workers.

**Recommendation:** Move to Redis-backed storage for production scale.

---

### Security Posture Assessment

#### Strengths

1. **No SQL Injection Vectors** - SQLAlchemy ORM used throughout. No raw SQL string concatenation found.

2. **SSRF Protection** - `url_validator.py` blocks private IP ranges, localhost, dangerous schemes. Handles encoded IP bypass attempts.

3. **File Upload Validation** - `file_validator.py` uses python-magic for magic byte detection. MIME whitelist, size limits, secure filename generation.

4. **Timing-Safe API Key Comparison** - Uses `hmac.compare_digest()` for API key validation, preventing timing attacks.

5. **Encryption at Rest** - Sensitive credentials (wp_app_password, shopify_api_key) encrypted using Fernet symmetric encryption.

6. **CORS Explicit Allowlist** - No wildcards with credentials. Origins explicitly listed:
   ```python
   ALLOWED_ORIGINS = [
       "https://app.teveroseo.com",
       "https://staging.teveroseo.com",
       "http://localhost:3000"
   ]
   ```

7. **Security Headers Middleware** - OWASP security headers applied:
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Strict-Transport-Security
   - Content-Security-Policy (report-only)

8. **Rate Limiting Middleware** - Sliding window rate limiter with Redis backend. Fail-closed for expensive endpoints.

9. **Global Exception Handler** - Catches unhandled exceptions, returns sanitized error response, logs full traceback to Sentry.

10. **No Bare Except Clauses** - Only 1 found (commented out) in `wix_routes.py:363`. All others properly typed.

### Async/Await Pattern Analysis

| Pattern | Count | Status |
|---------|-------|--------|
| `async def` with `await` | 85+ | Correct |
| `async def` without `await` | 3 | Needs review |
| `def` (sync) with DB ops | 12 | Should convert |
| `run_in_executor` usage | 4 | Correct pattern |

**Files needing async review:**
- `api/images.py` - Image generation (HIGH priority)
- `api/health.py` - Health checks (LOW priority)
- `services/file_validator.py` - File I/O (MEDIUM priority)

### Dependency Injection Analysis

| Dependency | Usage Count | Thread-Safe |
|------------|-------------|-------------|
| `get_db` | 90+ | Yes (scoped session) |
| `get_current_user` | 85+ | Yes |
| `require_client_access` | 40+ | Yes |
| `get_redis` | 15 | Yes (connection pool) |
| `get_rate_limiter` | 10 | Yes |

### Middleware Stack Order

```python
# main.py middleware registration (executed in reverse order)
app.add_middleware(SecurityHeadersMiddleware)     # 5. Add security headers
app.add_middleware(RateLimitMiddleware)           # 4. Check rate limits
app.add_middleware(MonitoringMiddleware)          # 3. Track metrics
app.add_middleware(CORSMiddleware, ...)           # 2. Handle CORS
app.add_middleware(APIKeyInjectionMiddleware)     # 1. Inject API keys
# Request flows: 1 -> 2 -> 3 -> 4 -> 5 -> handler -> 5 -> 4 -> 3 -> 2 -> 1
```

**Assessment:** Order is correct. Rate limiting happens after CORS (allows preflight) but before handler.

### Summary of Recommendations

| Priority | Issue | Effort |
|----------|-------|--------|
| HIGH | Convert image generation to async | 2h |
| HIGH | Add background task notification | 4h |
| HIGH | Expand fail-closed rate limit paths | 1h |
| MEDIUM | Move CSV rate limit to Redis | 2h |
| MEDIUM | Add response models | 4h |
| MEDIUM | Split seo_tools.py | 3h |
| MEDIUM | Migrate to Pydantic v2 validators | 2h |
| MEDIUM | Add request body size limit | 1h |
| LOW | Standardize error format | 3h |
| LOW | Minimize health check info | 0.5h |
| LOW | Remove query param token | 1h |
| LOW | Move job storage to Redis | 4h |

### Positive Patterns to Preserve

- **SQLAlchemy ORM** prevents SQL injection
- **Clerk JWT** with proper signature verification
- **SSRF protection** blocks internal network access
- **File validation** with magic bytes, not just extension
- **Rate limiting** with Redis backend
- **Security headers** middleware
- **Dependency injection** for testability
- **Scoped database sessions** prevent connection leaks
- **Structured logging** with correlation IDs

### Cross-Reference to Other Agents

- **Agent 3 (API Contracts):** Error response format inconsistency relates to HIGH-API-01
- **Agent 11 (OWASP):** Security posture aligns with SSRF and injection findings
- **Agent 17 (Input Validation):** Pydantic validation coverage aligns with 97% validation rate
- **Agent 19 (Error Handling):** Background task failure notification relates to MED-ERR-03
## Agent 2: Database Schema Consistency
**Completed:** 2026-05-04T13:15:00Z
**Files Reviewed:** 42 (schemas + migrations)
**Issues:** 0 Critical, 2 High, 4 Medium, 3 Low

### Schema Alignment Matrix

| Entity | AI-Writer (SQLAlchemy) | open-seo-main (Drizzle) | Type Match | FK Integrity |
|--------|------------------------|-------------------------|------------|--------------|
| clients.id | GUID() (UUID) | uuid().defaultRandom() | **MATCH** | N/A (PK) |
| clients.workspace_id | String(255), nullable | text().notNull() | **PARTIAL** | References organization |
| clients.created_at | DateTime, default=utcnow | timestamp().defaultNow() | **MATCH** | N/A |
| clients.updated_at | DateTime, onupdate=utcnow | timestamp().$onUpdate() | **MATCH** | N/A |
| voice_profiles.client_id | GUID() | uuid().references(clients) | **MATCH** | SET NULL on delete |
| audit_pages.client_id | N/A | uuid().references(clients) | N/A | CASCADE |
| gsc_snapshots.client_id | GUID() | N/A | N/A | CASCADE |

### Cross-Database Entity Linking

**Pattern:** `client_id` UUID serves as the shared entity key across `alwrity` and `open_seo` databases.

**Validation:**
- AI-Writer `Client.id` is `GUID()` type (PostgreSQL UUID with Python bridge)
- open-seo-main `clients.id` is `uuid("id").defaultRandom()`
- Both generate RFC4122 v4 UUIDs, ensuring collision-free cross-database references

**GUID TypeDecorator Implementation (AI-Writer):**
```python
class GUID(TypeDecorator):
    impl = CHAR
    cache_ok = True
    
    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(UUID())
        else:
            return dialect.type_descriptor(CHAR(32))
```

This ensures consistent UUID storage regardless of dialect, matching Drizzle's native UUID type.

---

### HIGH-SCHEMA-01: Timestamp Update Mechanism Asymmetry
**Location:** AI-Writer models vs open-seo-main schemas
**Type:** High

**AI-Writer (Application-Level):**
```python
updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
```
SQLAlchemy `onupdate` triggers during Python ORM operations only.

**open-seo-main (Application-Level):**
```typescript
updatedAt: timestamp("updated_at").$onUpdate(() => new Date())
```
Drizzle `$onUpdate()` triggers during TypeScript ORM operations only.

**Impact:** Direct SQL updates (migrations, admin scripts, raw queries) will NOT update `updated_at` in either database, creating stale timestamps for audit trails.

**Recommendation:** Add database-level triggers for critical tables:
```sql
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clients_modtime
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
```

---

### HIGH-SCHEMA-02: workspace_id Nullability Mismatch
**Location:** AI-Writer `Client.workspace_id` vs open-seo-main `clients.workspaceId`
**Type:** High

**AI-Writer:**
```python
workspace_id = Column(String(255), nullable=True, index=True)
```

**open-seo-main:**
```typescript
workspaceId: text("workspace_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
```

**Impact:** 
- AI-Writer allows clients without workspace association (legacy/migration support)
- open-seo-main requires workspace association (multi-tenant enforcement)
- Cross-database sync could fail if AI-Writer creates orphaned clients

**Recommendation:** Add migration to backfill AI-Writer `workspace_id`:
```python
# alembic migration
op.execute("""
    UPDATE clients 
    SET workspace_id = (SELECT id FROM organizations LIMIT 1)
    WHERE workspace_id IS NULL
""")
op.alter_column('clients', 'workspace_id', nullable=False)
```

---

### MEDIUM-SCHEMA-01: Table Naming Convention Inconsistency
**Pattern:** Mixed singular/plural across databases

| Database | Table | Convention |
|----------|-------|------------|
| alwrity | clients | plural |
| alwrity | client_voice_profile | singular prefix |
| open_seo | clients | plural |
| open_seo | voice_profiles | plural |
| open_seo | audit_page | singular |
| open_seo | audit_page_results | plural |

**Recommendation:** Standardize to plural for all tables in future migrations.

---

### MEDIUM-SCHEMA-02: SET NULL Cascade Creates Orphan Records
**Location:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/voice-schema.ts`

```typescript
clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
```

**Justification in Code:** Voice profiles are expensive to generate, preserving them allows reassignment.

**Risk:** Orphan voice profiles without client association may accumulate. Need periodic cleanup or admin reassignment UI.

**Recommendation:** Add scheduled job to audit orphaned voice profiles:
```sql
SELECT * FROM voice_profiles WHERE client_id IS NULL AND created_at < NOW() - INTERVAL '90 days';
```

---

### MEDIUM-SCHEMA-03: Missing Composite Index for Common Query Pattern
**Location:** AI-Writer `gsc_snapshots` table

**Query Pattern (from service code):**
```python
GSCSnapshot.query.filter_by(client_id=client_id).order_by(GSCSnapshot.snapshot_date.desc()).first()
```

**Current Indexes:**
- `client_id` (single column)

**Missing:** Composite index on `(client_id, snapshot_date DESC)` for optimal query plan.

**Recommendation:**
```python
Index('ix_gsc_snapshots_client_date', 'client_id', 'snapshot_date', postgresql_using='btree')
```

---

### MEDIUM-SCHEMA-04: Inconsistent Soft Delete Implementation
**Location:** Multiple tables

| Table | Soft Delete Pattern | Implementation |
|-------|---------------------|----------------|
| clients (open-seo) | `is_deleted` + `deleted_at` | Partial index |
| voice_profiles | Hard delete | No soft delete |
| audit_pages | Hard delete | No soft delete |
| clients (AI-Writer) | Hard delete | No soft delete |

**Recommendation:** Standardize soft delete pattern across both databases for audit compliance.

---

### LOW-SCHEMA-01: ID Generation Strategy Alignment
**Finding:** Both databases use application-generated UUIDs, not database sequences.

**AI-Writer:**
```python
id = Column(GUID(), primary_key=True, default=uuid.uuid4)
```

**open-seo-main:**
```typescript
id: uuid("id").primaryKey().defaultRandom(),
```

**Status:** Aligned - both use RFC4122 v4 random UUIDs.

---

### LOW-SCHEMA-02: Column Naming Convention Asymmetry
**Pattern:**
- AI-Writer: `snake_case` (`client_id`, `created_at`)
- open-seo-main: `camelCase` in TypeScript, `snake_case` in DB (`workspace_id` mapped from `workspaceId`)

**Status:** Acceptable - Drizzle handles column name mapping transparently.

---

### LOW-SCHEMA-03: Missing CHECK Constraints for Status Enums
**Location:** Multiple status columns use TEXT without CHECK constraints

**Example:**
```typescript
status: text("status").default("active"),
```

**Recommendation:** Add CHECK constraints in migrations:
```sql
ALTER TABLE audits ADD CONSTRAINT chk_audit_status 
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));
```

---

### Migration Safety Assessment

| Migration | Transaction Wrapped | Down Migration | Safe |
|-----------|---------------------|----------------|------|
| 0034_client_id_to_uuid.sql | Yes (implicit) | Not provided | **Partial** |
| 0067_schema_consistency_fixes.sql | Yes | Not provided | **Partial** |
| AI-Writer alembic migrations | Yes (default) | Yes (autogenerated) | **Yes** |

**Key Pattern (Migration 0034):**
```sql
-- Pre-migration backup checklist documented
-- FK constraints dropped before type change
-- FK constraints recreated after type change
ALTER TABLE "audit_page" ALTER COLUMN "client_id" SET DATA TYPE uuid USING "client_id"::uuid;
```

---

### Cascade Delete Behavior Summary

| Parent | Child Table | On Delete | Notes |
|--------|-------------|-----------|-------|
| clients | voice_profiles | SET NULL | Preserves expensive profiles |
| clients | audit_pages | CASCADE | Removes all audit data |
| clients | briefs | CASCADE | Removes content briefs |
| clients | gsc_snapshots | CASCADE | Removes analytics history |
| organization | clients | CASCADE | Workspace deletion removes all clients |

---

### Recommendations (Prioritized)

1. **HIGH:** Add database-level timestamp triggers for `updated_at` on critical tables
2. **HIGH:** Create AI-Writer migration to enforce `workspace_id` NOT NULL after backfill
3. **MEDIUM:** Add composite index on `(client_id, snapshot_date)` for GSC queries
4. **MEDIUM:** Document SET NULL cascade implications for voice_profiles
5. **LOW:** Standardize to plural table naming in future schema changes
---
---
## Agent 16: Multi-Tenant Data Isolation
**Completed:** 2026-05-04T15:30:00Z
**Files Reviewed:** 87
**Issues:** 2 Critical, 3 High, 4 Medium, 2 Low (positive findings)

### Tenant Isolation Architecture Overview

The TeveroSEO platform implements multi-tenant isolation through:

| Layer | Mechanism | Service |
|-------|-----------|---------|
| **Database** | `workspace_id` / `organization_id` column scoping | open-seo-main |
| **API** | `requireClientAccess` middleware with Redis caching | open-seo-main |
| **WebSocket** | Room membership verification | open-seo-main |
| **Background Jobs** | Tenant context propagation (partial) | open-seo-main |
| **File Storage** | Path traversal protection | AI-Writer |
| **Cache** | Key namespacing with tenant prefix | open-seo-main |

**Cross-References:**
- Agent 12 (Authorization): RBAC permission model
- Agent 7 (Drizzle): Scoped query patterns
- Agent 11 (Security OWASP): Injection prevention

---

### CRITICAL Issues

#### CRIT-TENANT-01: Unscoped Repository Methods Allow Cross-Tenant Access
**Location:** `open-seo-main/src/server/features/*/repositories/*.ts`

**Description:** Repository layer contains both scoped (`*Scoped()`) and unscoped methods for the same operations. The unscoped methods can be called directly, bypassing workspace isolation.

**Evidence:**

```typescript
// ContractRepository.ts - VULNERABLE
static async getContractById(id: string) {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, id))
    .limit(1);
  return contract || null;  // NO workspace filter!
}

// Same file - SAFE variant
static async getContractByIdScoped(id: string, workspaceId: string) {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(and(
      eq(contracts.id, id),
      eq(contracts.workspaceId, workspaceId)  // Properly scoped
    ))
    .limit(1);
  return contract || null;
}
```

**Impact:** Any code path using unscoped methods can fetch data from other tenants by ID enumeration.

**Files Affected:**
- `ContractRepository.ts` - `getContractById()` vs `getContractByIdScoped()`
- `ProposalRepository.ts` - `findById()` vs `findByIdScoped()`
- `InvoiceRepository.ts` - `findById()` vs `findByIdScoped()`
- `ProspectRepository.ts` - `findById()` vs `findByIdScoped()`

**Remediation:**
1. Deprecate unscoped methods with `@deprecated` JSDoc
2. Add runtime warnings when unscoped methods are called
3. Migrate all callers to scoped variants
4. Add ESLint rule to prevent unscoped method usage in routes/actions

---

#### CRIT-TENANT-02: Background Job Global Queries Expose Cross-Tenant Data
**Location:** `open-seo-main/src/server/features/payments/repositories/PaymentScheduleRepository.ts`

**Description:** Background workers query all tenants then filter in memory, exposing tenant IDs and partial data to job context.

**Evidence:**

```typescript
// PaymentScheduleRepository.ts lines 145-160
static async getUpcomingInstallments(daysAhead: number) {
  const cutoffDate = addDays(new Date(), daysAhead);
  return db
    .select()
    .from(paymentSchedules)
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(and(
      eq(paymentSchedules.status, 'scheduled'),
      lte(paymentSchedules.dueDate, cutoffDate)
    ))
    // NO workspace filter - queries ALL tenants
    .orderBy(asc(paymentSchedules.dueDate));
}

static async getOverdueInstallments() {
  return db
    .select()
    .from(paymentSchedules)
    .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
    .where(and(
      eq(paymentSchedules.status, 'scheduled'),
      lt(paymentSchedules.dueDate, new Date())
    ));
    // NO workspace filter - queries ALL tenants
}
```

**Impact:** 
- Job logs may contain cross-tenant invoice IDs
- Error reports expose tenant data boundaries
- Memory contains full cross-tenant dataset during processing

**Remediation:**
1. Add `workspaceId` parameter to methods
2. Restructure background jobs to iterate per-workspace
3. Use cursor pagination to prevent memory bloat

---

### HIGH Issues

#### HIGH-TENANT-01: getContractsByClient Lacks Workspace Scoping
**Location:** `open-seo-main/src/server/features/contracts/repositories/ContractRepository.ts`

**Description:** Method queries by `clientId` without verifying workspace ownership.

```typescript
static async getContractsByClient(clientId: string) {
  return db
    .select()
    .from(contracts)
    .where(eq(contracts.clientId, clientId))
    .orderBy(desc(contracts.createdAt));
  // Client ID alone doesn't prove workspace ownership
}
```

**Impact:** If attacker knows a `clientId` from another workspace, they can retrieve all contracts.

**Remediation:** Add workspace filter or verify client belongs to workspace before query.

---

#### HIGH-TENANT-02: ContentPlanningDB Uses user_id Without workspace_id
**Location:** `AI-Writer/backend/services/content_planning_db.py`

**Description:** Content planning queries filter by `user_id` only, not by workspace/client scope.

```python
def get_user_topics(self, user_id: str) -> List[Dict]:
    """Get all topics for a user"""
    return self.topics.find({"user_id": user_id}).to_list()

def get_user_briefs(self, user_id: str) -> List[Dict]:
    """Get all briefs for a user"""
    return self.briefs.find({"user_id": user_id}).to_list()
```

**Impact:** Users can access any content they created regardless of current workspace context. If user switches workspaces, old content remains accessible.

**Remediation:** Add `workspace_id` to content planning documents and filter queries.

---

#### HIGH-TENANT-03: GSCService Stores Credentials Per-User Not Per-Client
**Location:** `AI-Writer/backend/services/gsc_service.py`

**Description:** Google Search Console credentials stored per `user_id` in SQLite, inconsistent with the per-client OAuth model in `ClientOAuthService`.

```python
def store_credentials(self, user_id: str, credentials: dict):
    """Store GSC credentials for a user"""
    self.cursor.execute('''
        INSERT OR REPLACE INTO gsc_credentials 
        (user_id, credentials, created_at) 
        VALUES (?, ?, ?)
    ''', (user_id, json.dumps(credentials), datetime.now().isoformat()))
```

**Impact:** 
- User has single GSC connection across all clients
- Cannot have different GSC properties per client
- Inconsistent with brand voice per-client model

**Remediation:** Migrate to per-client credential storage matching `ClientOAuthService` pattern.

---

### MEDIUM Issues

#### MED-TENANT-01: System Templates Visible Across All Workspaces
**Location:** `open-seo-main/src/server/features/templates/repositories/TemplateRepository.ts`

**Description:** Templates with `isSystemTemplate: true` are returned for all workspaces without filtering.

```typescript
static async findAll(workspaceId: string) {
  return db
    .select()
    .from(templates)
    .where(or(
      eq(templates.workspaceId, workspaceId),
      eq(templates.isSystemTemplate, true)  // Visible to all
    ));
}
```

**Impact:** Low risk - system templates are intentionally shared. However, if a workspace creates a template and accidentally marks it as system template, it becomes visible to all.

**Remediation:** Add admin-only permission for `isSystemTemplate` flag, or validate on creation.

---

#### MED-TENANT-02: Rate Limiting Keys Not Workspace-Scoped
**Location:** `open-seo-main/src/server/middleware/rate-limit.ts`

**Description:** Rate limiting uses user ID but not workspace ID in key composition.

```typescript
const key = `ratelimit:${userId}:${endpoint}`;
```

**Impact:** User hitting rate limit in one workspace affects their limits in all workspaces. Malicious user could rate-limit themselves to affect shared account usage.

**Remediation:** Include workspace ID in rate limit key: `ratelimit:${workspaceId}:${userId}:${endpoint}`

---

#### MED-TENANT-03: Membership Cache TTL Creates 5-Minute Stale Window
**Location:** `open-seo-main/src/server/middleware/authz.ts`

**Description:** Workspace membership is cached for 5 minutes. If user is removed from workspace, they retain access until cache expires.

```typescript
const MEMBERSHIP_CACHE_TTL = 300; // 5 minutes

export async function checkClientAccess(userId: string, clientId: string): Promise<boolean> {
  const cacheKey = `membership:${userId}:${clientId}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return cached === 'true';
  // ... check database
}
```

**Impact:** Delayed revocation of access when user is removed from workspace.

**Remediation:** 
1. Invalidate cache on membership change (already exists in `invalidateMembershipCache`)
2. Reduce TTL to 60 seconds for sensitive operations
3. Add real-time membership event subscription

---

#### MED-TENANT-04: Article Ownership Tied to User Not Workspace
**Location:** `AI-Writer/backend/models/article.py`

**Description:** Articles have `user_id` foreign key but no `client_id` or `workspace_id`.

```python
class Article(Base):
    __tablename__ = "articles"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    # ... no workspace_id or client_id column
```

**Impact:** User's articles visible regardless of workspace context. Cannot associate content with specific client for brand voice.

**Remediation:** Add `client_id` column, migrate existing data, update queries.

---

### LOW Issues (Positive Findings)

#### LOW-TENANT-01: Download Endpoints Properly Validate Ownership
**Location:** `open-seo-main/src/server/features/reports/routes/download.ts`

**Description:** PDF/Excel download endpoints verify workspace ownership before serving files.

```typescript
export async function downloadReport(req: Request) {
  const { reportId } = req.params;
  const { workspaceId } = req.auth;
  
  const report = await ReportRepository.findByIdScoped(reportId, workspaceId);
  if (!report) throw new ForbiddenError('Report not found');
  
  return streamFile(report.filePath);
}
```

**Status:** Well-implemented tenant isolation.

---

#### LOW-TENANT-02: File Storage Uses Path Traversal Protection
**Location:** `AI-Writer/backend/services/storage_service.py`

**Description:** File paths are sanitized to prevent directory traversal attacks.

```python
def validate_path(self, user_path: str) -> str:
    """Sanitize and validate file path"""
    # Remove any directory traversal attempts
    clean_path = os.path.normpath(user_path)
    if '..' in clean_path or clean_path.startswith('/'):
        raise ValueError("Invalid path")
    
    full_path = os.path.join(self.base_dir, clean_path)
    # Verify path stays within base directory
    if not full_path.startswith(os.path.abspath(self.base_dir)):
        raise ValueError("Path traversal detected")
    
    return full_path
```

**Status:** Proper protection against path traversal.

---

### Tenant Isolation Matrix

| Resource | Scoped Query | API Check | Background Job | Status |
|----------|--------------|-----------|----------------|--------|
| Contracts | Partial | Yes | No | NEEDS WORK |
| Proposals | Partial | Yes | N/A | NEEDS WORK |
| Invoices | Partial | Yes | No | NEEDS WORK |
| Prospects | Partial | Yes | N/A | NEEDS WORK |
| Audits | Yes | Yes | Yes | GOOD |
| Reports | Yes | Yes | Yes | GOOD |
| Templates | Partial | Yes | N/A | ACCEPTABLE |
| Articles (AI-Writer) | No | Partial | N/A | NEEDS WORK |
| Content Plans | No | No | N/A | NEEDS WORK |
| GSC Credentials | No | Partial | N/A | NEEDS WORK |

### E2E Test Coverage for Tenant Isolation

**Location:** `e2e/multi-tenant.spec.ts`

Tests verify:
- Cross-tenant contract access returns 403/404
- Cross-tenant proposal access returns 403/404
- Cross-tenant audit access returns 403/404
- Workspace membership required for data access
- User removal invalidates access (with cache delay)

**Status:** Good E2E coverage for happy paths. Missing tests for background job isolation.

---

### Remediation Priority

1. **CRITICAL (Immediate):**
   - Deprecate unscoped repository methods
   - Add workspace filter to background job queries

2. **HIGH (Current Sprint):**
   - Add workspace scoping to `getContractsByClient()`
   - Add `workspace_id` to ContentPlanningDB queries
   - Migrate GSCService to per-client credentials

3. **MEDIUM (Next Sprint):**
   - Reduce membership cache TTL for sensitive ops
   - Add `client_id` to Article model
   - Namespace rate limit keys by workspace

4. **LOW (Backlog):**
   - Add admin-only guard for `isSystemTemplate` flag
   - Add background job isolation E2E tests

---

### Cross-Agent References

| Issue | Related Agent | Finding |
|-------|---------------|---------|
| CRIT-TENANT-01 | Agent 7 (Drizzle) | Scoped query pattern established |
| CRIT-TENANT-02 | Agent 10 (BullMQ) | Job context propagation |
| HIGH-TENANT-03 | Agent 8 (FastAPI) | OAuth service patterns |
| MED-TENANT-03 | Agent 4 (Queue) | Redis cache patterns |

---
## Agent 11: Security Vulnerability Scan (OWASP Top 10)
**Completed:** 2026-05-04T14:35:00Z
**Files Reviewed:** 42
**Issues:** 0 Critical, 3 High, 5 Medium, 4 Low

### OWASP Top 10 Coverage Matrix

| Category | Status | Implementation |
|----------|--------|----------------|
| A01: Broken Access Control | COVERED | Clerk JWT + RBAC + workspace isolation |
| A02: Cryptographic Failures | COVERED | TLS enforced, HMAC-SHA256 signing, secure nonces |
| A03: Injection | COVERED | Parameterized queries, Zod validation, DOMPurify |
| A04: Insecure Design | PARTIAL | Quality gate, fail-closed patterns, missing threat model |
| A05: Security Misconfiguration | PARTIAL | CSP implemented, stack traces exposed in errors |
| A06: Vulnerable Components | NOT TESTED | Dependency scanning not in scope |
| A07: Auth Failures | COVERED | JWT verification, secure session management |
| A08: Data Integrity Failures | COVERED | HMAC signatures, optimistic locking |
| A09: Logging Failures | COVERED | PostHog + Sentry, PII redaction |
| A10: SSRF | PARTIAL | URL validation present, DNS rebinding gap |

### Findings

#### HIGH-SEC-01: DNS Rebinding Attack Not Mitigated in SSRF Protection
**Severity:** HIGH
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/url_validator.py:67-89
**Evidence:**
The URL validator resolves hostnames to IPs and checks if private, but does not re-resolve after initial validation. An attacker can use DNS rebinding (first resolve to public IP, then to 127.0.0.1) to bypass SSRF protection.

**Impact:** Potential SSRF attacks against internal services (Redis, PostgreSQL, internal APIs).

**Recommendation:** 
1. Re-resolve hostname immediately before making request
2. Use socket.getaddrinfo() with AI_NUMERICHOST flag after validation
3. Add DNS pinning (cache resolved IP, verify match on request)

---

#### HIGH-SEC-02: Stack Traces Exposed in Production API Error Responses
**Severity:** HIGH
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/main.py:89-102
**Issue:** While the stack trace is not directly returned, the error_type field leaks internal exception class names (e.g., SQLAlchemyError, KeyError, AttributeError). Combined with timing attacks, this aids reconnaissance.

**Impact:** Attackers can fingerprint internal frameworks and identify vulnerable code paths.

**Recommendation:** Remove error_type from production responses.

---

#### HIGH-SEC-03: Legacy API Key Authentication Still Active
**Severity:** HIGH
**Location:** /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/internal-auth.ts:78-95
**Issue:** Legacy API key authentication bypasses HMAC signature verification. While logged with console.warn, the fallback remains active and can be exploited if the static key is compromised.

**Impact:** 
- Static key can be brute-forced or leaked
- No request-level integrity (HMAC verifies payload, API key does not)
- No timestamp/replay protection

**Recommendation:**
1. Add deprecation timeline and remove legacy auth by specific date
2. Monitor for legacy auth usage via metrics/alerts
3. Add rate limiting specifically for legacy auth attempts
4. Consider returning 410 Gone after deprecation period

---

#### MED-SEC-01: Query Token Authentication for Media Endpoints
**Severity:** MEDIUM
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py:112-130
**Issue:** Query parameter tokens are necessary for media embedding but appear in browser history, server access logs, referrer headers, and browser bookmarks.

**Mitigation Present:** Tokens have short TTL (15 minutes) and are scoped to specific resources.

**Recommendation:**
1. Ensure tokens are single-use (invalidate after first use)
2. Add Referrer-Policy: no-referrer header for media responses
3. Consider signed URL approach with expiry embedded

---

#### MED-SEC-02: SSRF in Platform Auto-Detection (Referer-Based)
**Severity:** MEDIUM
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/cms_publishers/wordpress_publisher.py:45-58
**Issue:** The site_url comes from user configuration. While the URL validator is used elsewhere, this specific code path may bypass it.

**Impact:** User-controlled URL can probe internal services.

**Recommendation:** Ensure all user-provided URLs pass through URLValidator.validate() before any HTTP request.

---

#### MED-SEC-03: GLOBAL_ENDPOINTS Bypass List Expansion Risk
**Severity:** MEDIUM
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/authorization.py:133-145
**Issue:** Hard-coded list of endpoints that bypass client authorization. New endpoints may be accidentally added without proper review.

**Recommendation:** 
1. Use decorator pattern: @public_endpoint to mark global routes
2. Require security review for any additions to GLOBAL_ENDPOINTS
3. Add audit logging for bypass endpoint access

---

#### MED-SEC-04: Error Verbosity in open-seo-main API
**Severity:** MEDIUM
**Location:** /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/middleware/errorHandling.ts:45-62
**Positive:** Production mode hides details for DrizzleError.
**Issue:** Other error types may leak sensitive information in err.message.

**Recommendation:** Sanitize all error messages before returning to client, regardless of error type.

---

#### MED-SEC-05: Clock Skew Tolerance in JWT Verification
**Severity:** MEDIUM
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/middleware/auth_middleware.py:67-75
**Note:** Previously was 300 seconds (5 minutes), now reduced to 60 seconds. This is acceptable but worth monitoring.

**Recommendation:** Document the 60-second leeway decision and monitor for clock sync issues in production.

---

#### LOW-SEC-01: Subprocess Usage in Content Processing
**Severity:** LOW
**Location:** /home/dominic/Documents/TeveroSEO/AI-Writer/backend/services/content_processor.py
**Evidence:** Uses subprocess for pandoc conversion.
**Status:** VERIFIED SECURE - Input is validated, shell=False, timeout enforced.

---

#### LOW-SEC-02: Environment Files Not in .gitignore
**Severity:** LOW
**Location:** Multiple .env.example files present
**Status:** .env files ARE in .gitignore. Only .env.example templates are tracked.

---

#### LOW-SEC-03: DOMPurify Config May Be Overly Permissive
**Severity:** LOW
**Location:** /home/dominic/Documents/TeveroSEO/apps/web/src/lib/sanitize.ts:15-25
**Issue:** img tag with onerror can execute JS if not properly handled.

**Mitigation Present:** FORBID_ATTR strips event handlers.

**Recommendation:** Verify DOMPurify version is current (CVE tracking).

---

#### LOW-SEC-04: React innerHTML Usage
**Severity:** LOW
**Location:** Multiple React components
**Status:** All usages pass through DOMPurify first. Pattern is acceptable.

---

### Security Strengths Observed

1. **JWT Verification is Mandatory:** All external requests verify JWT signatures against Clerk JWKS endpoint with caching.

2. **HMAC Service-to-Service Auth:** Internal API calls use HMAC-SHA256 with timing-safe comparison and 5-minute timestamp drift protection.

3. **Rate Limiting Infrastructure:** Redis-based sliding window rate limiting with fail-closed behavior for external endpoints.

4. **CSRF Protection:** Origin/Referer validation on state-changing operations, CSP with cryptographic nonces.

5. **SQL Injection Prevention:** 
   - AI-Writer: safe_query.py utilities for identifier sanitization
   - open-seo-main: Drizzle ORM with parameterized queries
   - No raw string interpolation in SQL

6. **XSS Prevention:**
   - DOMPurify with explicit allowlist configuration
   - Safe URI regexp blocking javascript: and data: schemes
   - React's built-in escaping for most outputs

7. **File Upload Validation:** Magic byte detection, file type allowlisting, size limits enforced.

8. **Role-Based Access Control:** Admin > Editor > Viewer hierarchy with proper permission checks.

9. **Timing-Safe Comparisons:** crypto.timingSafeEqual() used for token/signature verification.

10. **Fail-Closed Philosophy:** Authorization failures return 403, never silently pass.

### Summary of Recommendations

| Priority | Finding | Action |
|----------|---------|--------|
| P0 | HIGH-SEC-01 | Implement DNS pinning for SSRF protection |
| P0 | HIGH-SEC-02 | Remove error_type from production responses |
| P1 | HIGH-SEC-03 | Set deprecation date for legacy API key auth |
| P1 | MED-SEC-02 | Ensure all user URLs pass URLValidator |
| P2 | MED-SEC-01 | Add single-use tokens for media endpoints |
| P2 | MED-SEC-03 | Replace GLOBAL_ENDPOINTS with decorator pattern |
| P2 | MED-SEC-04 | Sanitize all error messages in generic handler |
| P3 | LOW-SEC-03 | Audit DOMPurify version for known CVEs |
---

## Agent 9: AI-Writer React Frontend

**Completed:** 2026-05-04T13:15:00Z
**Files Reviewed:** 87
**Issues:** 0 Critical, 2 High, 7 Medium, 5 Low

### Component Architecture Summary

| Area | Pattern | Status |
|------|---------|--------|
| State Management | Zustand stores with persist | **GOOD** |
| API Client | Axios singleton with interceptors | **GOOD** |
| Error Boundaries | ErrorBoundary component with Sentry | **GOOD** |
| Form Validation | Zod schemas with react-hook-form | **GOOD** |
| XSS Prevention | DOMPurify for all setInnerHTML calls | **GOOD** |
| Memory Leak Prevention | AbortController in stores and hooks | **GOOD** |

### Security Assessment

| Vector | Implementation | Status |
|--------|---------------|--------|
| XSS via innerHTML | DOMPurify.sanitize() | **SECURE** |
| Auth Token Management | Clerk useAuth() hook | **SECURE** |
| API Request Auth | Axios interceptor adds Bearer token | **SECURE** |
| Input Sanitization | Zod schemas at API boundaries | **SECURE** |
| Error Disclosure | Generic messages in production | **SECURE** |

### State Management Review

| Store | Cleanup | Persist | Status |
|-------|---------|---------|--------|
| clientStore | AbortController | Yes (partial) | **GOOD** |
| articleStore | AbortController | Yes | **GOOD** |
| brandVoiceStore | AbortController | Yes | **GOOD** |
| toastStore | Manual clear | No | **GOOD** |

### API Integration Review

| Pattern | Implementation | Status |
|---------|---------------|--------|
| Loading States | Most components | **PARTIAL** |
| Error States | Most components | **PARTIAL** |
| Request Cancellation | useCancellableFetch hook | **GOOD** |
| Retry Logic | Axios interceptor (3 retries) | **GOOD** |
| Rate Limit Handling | cooldownUntil tracking | **GOOD** |

### Findings

#### HIGH-REACT-01: Console.log Statements in Production Code
**Location:** 30+ files across frontend
**Severity:** HIGH
**Description:** Console.log statements are scattered throughout the codebase. These should use a centralized logger that respects environment settings.

**Files Affected:**
- `src/pages/BrandAITab.tsx` (lines 45, 67, 123)
- `src/pages/ArticleEditorPage.tsx` (lines 89, 234)
- `src/stores/clientStore.ts` (lines 78, 112)
- `src/api/client.ts` (lines 34, 89, 145)
- `src/hooks/useErrorHandler.ts` (line 23)
- ... and 25+ more files

**Impact:** 
- Sensitive data may leak to browser console
- Performance impact from string formatting
- Difficult to debug without structured logs

**Recommendation:** Replace with centralized logger:
```typescript
// src/utils/logger.ts
const logger = {
  debug: (...args) => import.meta.env.DEV && console.log('[DEBUG]', ...args),
  info: (...args) => console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
export default logger;
```

---

#### HIGH-REACT-02: Missing Loading States in Critical Operations
**Location:** Multiple components
**Severity:** HIGH
**Description:** Several API operations lack loading state feedback, leaving users uncertain whether actions are processing.

**Files Affected:**
- `src/pages/BrandAITab.tsx` - Voice profile save
- `src/pages/GlobalSettingsPage.tsx` - Settings update
- `src/components/clients/ClientForm.tsx` - Client creation

**Impact:** Poor UX when operations take >1s. Users may double-click causing duplicate submissions.

**Recommendation:** Add loading states to all mutation operations:
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    await mutation();
  } finally {
    setIsSubmitting(false);
  }
};
```

---

#### MED-REACT-01: useEffect Dependency Array Completeness
**Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/pages/ArticleDashboard.tsx:89`
**Severity:** MEDIUM
**Description:** Some useEffect hooks have incomplete dependency arrays, potentially causing stale closures.

```typescript
// Line 89 - searchTerm used but not in dependencies
useEffect(() => {
  fetchArticles(searchTerm);
}, [page, pageSize]); // Missing searchTerm
```

**Recommendation:** Add all referenced values to dependency array or use a ref pattern.

---

#### MED-REACT-02: Index-Based Keys in List Rendering
**Location:** Multiple components
**Severity:** MEDIUM
**Description:** Several .map() iterations use array index as key prop instead of stable identifiers.

**Files Affected:**
- `src/components/shared/TagList.tsx:34` - `key={index}`
- `src/pages/AnalyticsDashboard.tsx:156` - `key={i}`
- `src/components/articles/ArticleList.tsx:78` - `key={index}` (though items have id)

**Impact:** React reconciliation may behave incorrectly when items are reordered or filtered.

**Recommendation:** Use stable identifiers:
```typescript
// BAD
{items.map((item, index) => <Item key={index} />)}

// GOOD
{items.map((item) => <Item key={item.id} />)}
```

---

#### MED-REACT-03: Error Boundary Coverage Gap
**Location:** Route-level
**Severity:** MEDIUM
**Description:** ErrorBoundary wraps App but some async errors in event handlers will not be caught.

**Impact:** Unhandled promise rejections in onClick handlers may crash silently.

**Recommendation:** Use try-catch in all async event handlers and show toast on error:
```typescript
const handleClick = async () => {
  try {
    await asyncOperation();
  } catch (error) {
    toast.error('Operation failed');
    logError(error);
  }
};
```

---

#### MED-REACT-04: Uncontrolled to Controlled Component Warnings
**Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/components/shared/TextInput.tsx`
**Severity:** MEDIUM
**Description:** TextInput component may receive undefined value initially, causing React warning.

**Recommendation:** Provide default value:
```typescript
value={props.value ?? ''}
```

---

#### MED-REACT-05: Large Bundle from Full Library Imports
**Location:** Multiple components
**Severity:** MEDIUM
**Description:** Some imports pull entire libraries instead of specific functions.

```typescript
// Current
import * as DOMPurify from 'dompurify';

// Better for tree-shaking
import DOMPurify from 'dompurify';
```

**Impact:** Bundle size may be larger than necessary.

---

#### MED-REACT-06: Axios Interceptor Token Refresh Race Condition
**Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/api/client.ts:45-78`
**Severity:** MEDIUM
**Description:** Multiple concurrent 401 responses may trigger multiple token refresh attempts.

**Current Pattern:**
```typescript
// Multiple requests hitting 401 simultaneously could race
if (error.response?.status === 401) {
  await refreshToken();
  return axios(originalRequest);
}
```

**Recommendation:** Add mutex/queue pattern for token refresh:
```typescript
let refreshPromise: Promise<string> | null = null;
const refreshToken = async () => {
  if (!refreshPromise) {
    refreshPromise = actualRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};
```

---

#### MED-REACT-07: Missing ARIA Labels on Icon-Only Buttons
**Location:** Multiple components
**Severity:** MEDIUM (a11y)
**Description:** Several icon-only buttons lack aria-label attributes.

**Files Affected:**
- `src/components/shell/AppShell.tsx` - Collapse button (has aria-label when collapsed only)
- `src/components/shared/IconButton.tsx` - Generic icon button

**Impact:** Screen readers cannot announce button purpose.

**Recommendation:** Add aria-label to all icon-only buttons:
```tsx
<button aria-label="Collapse sidebar" onClick={toggle}>
  <ChevronIcon />
</button>
```

---

#### LOW-REACT-01: Unused Imports
**Location:** Multiple files
**Severity:** LOW
**Description:** Several files have unused imports that should be cleaned up.

**Files Affected:**
- `src/pages/ArticleEditorPage.tsx` - unused useState import
- `src/components/shared/Modal.tsx` - unused useCallback

**Recommendation:** Run ESLint with unused-imports plugin.

---

#### LOW-REACT-02: Inconsistent Error Message Formatting
**Location:** Throughout frontend
**Severity:** LOW
**Description:** Error messages use inconsistent formatting - some start with capital, some lowercase, some have periods, some do not.

**Recommendation:** Establish error message style guide and apply consistently.

---

#### LOW-REACT-03: Missing TypeScript Strict Null Checks
**Location:** `tsconfig.json`
**Severity:** LOW
**Description:** Some components do not handle null/undefined cases that TypeScript would catch with strictNullChecks.

**Recommendation:** Enable `"strictNullChecks": true` and fix resulting errors.

---

#### LOW-REACT-04: Inline Styles Instead of Tailwind Classes
**Location:** Scattered across components
**Severity:** LOW
**Description:** Some components use inline style objects instead of Tailwind utility classes.

**Impact:** Inconsistent styling approach, harder to maintain.

---

#### LOW-REACT-05: Missing displayName on Forwardref Components
**Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/frontend/src/components/shared/Input.tsx`
**Severity:** LOW
**Description:** ForwardRef components should have displayName for better debugging.

```typescript
// Add after forwardRef
Input.displayName = 'Input';
```

---

### Positive Patterns to Preserve

1. **DOMPurify Usage** - All innerHTML renders properly sanitized
2. **AbortController in Stores** - Proper request cancellation prevents memory leaks
3. **Axios Interceptors** - Centralized auth and retry logic
4. **ErrorBoundary** - Comprehensive error capture with Sentry integration
5. **Clerk Integration** - Clean auth hook usage
6. **Zustand Persist** - State persistence with proper partial rehydration
7. **useCancellableFetch Hook** - Clean abstraction for cancellable requests
8. **Double-Submit Prevention** - ArticleEditorPage disables button during save
9. **Ref Pattern for Callbacks** - Prevents stale closures in useEffect
10. **Technical Error Details in Dev** - ErrorBoundary shows stack traces only in development

### Remediation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | HIGH-REACT-01: Console.log cleanup | Medium | Security, Performance |
| 2 | HIGH-REACT-02: Missing loading states | Low | UX |
| 3 | MED-REACT-06: Token refresh race | Medium | Reliability |
| 4 | MED-REACT-07: ARIA labels | Low | Accessibility |
| 5 | MED-REACT-01: useEffect deps | Low | Correctness |
| 6 | MED-REACT-02: Index keys | Low | Correctness |
| 7 | MED-REACT-03: Error boundary gaps | Medium | Reliability |
| 8 | MED-REACT-04: Controlled inputs | Low | Correctness |
| 9 | MED-REACT-05: Bundle size | Medium | Performance |
