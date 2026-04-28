# Business Logic and Race Condition Audit - Round 2

**Date:** 2026-04-28  
**Auditor:** Claude Opus 4.5  
**Scope:** apps/web/src/actions/**, open-seo-main/src/services/**, AI-Writer/backend/api/**

---

## Executive Summary

This audit examines business logic flaws and race conditions across the TeveroSEO platform. The codebase shows good security practices in many areas (authentication, input validation, authorization), but several business logic vulnerabilities were identified that could lead to resource exhaustion, data inconsistency, or workflow bypass.

**Severity Distribution:**
- CRITICAL: 1
- HIGH: 4
- MEDIUM: 6
- LOW: 3

---

## CRITICAL Findings

### 1. Missing Idempotency on Article Generation (CRITICAL)

**Location:** `AI-Writer/backend/api/articles.py:561-622`

**Issue:** The `generate_article_now` endpoint triggers background article generation without idempotency protection. Rapid double-clicks or network retries can spawn multiple concurrent generation tasks for the same article.

```python
@router.post("/{article_id}/generate", status_code=202)
async def generate_article_now(...):
    # No idempotency key or duplicate check
    asyncio.create_task(_run_generation())
    return {"status": "accepted", ...}
```

**Impact:**
- Multiple LLM calls for the same article (cost multiplication)
- Race condition where both tasks update the same article row
- Possible data corruption if concurrent writes conflict

**Recommendation:**
1. Add idempotency key in request or use article status as lock
2. Use Redis SETNX pattern to prevent duplicate generation starts
3. Check if article is already in "generating" status before starting

---

## HIGH Findings

### 2. TOCTOU in Webhook Update/Delete (HIGH)

**Location:** `apps/web/src/actions/webhooks.ts:171-217`

**Issue:** The `updateWebhook` and `deleteWebhookAction` functions fetch the webhook to validate ownership, then perform the mutation in a separate call. Between these operations, another request could modify or delete the webhook.

```typescript
// Fetch webhook first to validate ownership
const webhook = await getOpenSeo<Webhook>(`/api/webhooks/${validated.webhookId}`);
if (webhook.scope === "client" && webhook.scopeId) {
  await validateClientOwnership(webhook.scopeId, auth);
}
// Time gap here - webhook could change
return patchOpenSeo(`/api/webhooks/${validated.webhookId}`, validated.params);
```

**Impact:**
- Authorization bypass if webhook ownership changes between check and mutation
- Potential for operating on wrong resource

**Recommendation:**
- Pass authorization context to backend and validate atomically with the mutation
- Use optimistic locking with version/etag fields

---

### 3. Intelligence Scrape Without Deduplication (HIGH)

**Location:** `AI-Writer/backend/api/intelligence.py:129-178`

**Issue:** The `trigger_intelligence_scrape` endpoint can be called repeatedly, spawning multiple background pipeline tasks for the same client. While it sets status to "pending," there's no check to prevent starting a new scrape if one is already in progress.

```python
# No check if scrape_status == "in_progress"
record.scrape_status = "pending"
db.commit()
background_tasks.add_task(_run_pipeline, str(client.id), url_str)
```

**Impact:**
- Multiple concurrent scrapes consuming API quotas
- Race conditions in writing to the same intelligence record
- Wasted compute resources

**Recommendation:**
```python
if record and record.scrape_status == "in_progress":
    raise HTTPException(status_code=409, detail="Scrape already in progress")
```

---

### 4. No Resource Limits on Client Creation (HIGH)

**Location:** `AI-Writer/backend/api/clients.py:209-228`

**Issue:** The `create_client` endpoint has no limits on how many clients a user can create. A malicious or compromised account could create thousands of clients.

```python
@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, ...):
    # No limit check on existing client count
    client = Client(name=payload.name, website_url=payload.website_url)
    db.add(client)
```

**Impact:**
- Resource exhaustion in database
- Potential billing/quota abuse
- DoS through excessive client creation

**Recommendation:**
- Add per-user or per-organization client limits
- Implement rate limiting on creation endpoint
- Check current client count before allowing creation

---

### 5. Saved View Creation Without Limits (HIGH)

**Location:** `apps/web/src/actions/views/saved-views.ts:173-204`  
**Location:** `AI-Writer/backend/api/dashboard.py` (corresponding backend)

**Issue:** Users can create unlimited saved views per workspace. No limit validation exists.

**Impact:**
- Database bloat
- Performance degradation on view listings
- Potential for DoS through excessive view creation

**Recommendation:**
- Add limit of 50-100 views per user per workspace
- Validate count before creation

---

## MEDIUM Findings

### 6. State Machine Bypass in Article Status (MEDIUM)

**Location:** `AI-Writer/backend/api/articles.py:470-528`

**Issue:** While the code restricts manual status changes to `MANUAL_STATUSES = {"draft", "pending_review", "approved"}`, there's no validation of valid state transitions. A user could set an article from "draft" directly to "approved" bypassing the review workflow.

```python
# Allowed values check exists, but no transition validation
if value not in MANUAL_STATUSES:
    raise HTTPException(...)
# Missing: validate current_status -> new_status is a valid transition
```

**Impact:**
- Workflow bypass - articles could skip review
- Audit trail gaps if state jumps are allowed

**Recommendation:**
Define and enforce valid state transitions:
```python
VALID_TRANSITIONS = {
    "draft": {"pending_review"},
    "pending_review": {"approved", "draft"},
    "approved": {"draft"},
    # generated is system-only
}
```

---

### 7. Revert Operations Without Idempotency (MEDIUM)

**Location:** `apps/web/src/actions/changes.ts:245-279`

**Issue:** The `executeRevert` function has no idempotency protection. Double-submission could attempt to revert already-reverted changes.

**Impact:**
- Confusing error messages
- Potential for double-reverting if backend doesn't protect

**Recommendation:**
- Add idempotency key to revert requests
- Backend should validate change status before reverting

---

### 8. CSV Import Without Row Limits (MEDIUM)

**Location:** `AI-Writer/backend/api/csv_import.py`

**Issue:** While there's a 10MB file size limit, there's no limit on the number of rows that can be imported. A 10MB CSV could contain thousands of articles.

```python
_MAX_CSV_BYTES = 10 * 1024 * 1024  # 10 MB
# No MAX_ROWS limit
```

**Impact:**
- Database overload from bulk insert
- Long-running request that could timeout
- Resource exhaustion

**Recommendation:**
```python
_MAX_ROWS = 500  # Reasonable limit
if result.total_rows > _MAX_ROWS:
    raise HTTPException(status_code=422, detail=f"Maximum {_MAX_ROWS} rows allowed")
```

---

### 9. Alert Rule Limits Not Enforced (MEDIUM)

**Location:** `apps/web/src/actions/alerts.ts:136-166`

**Issue:** No limit on how many alert rules a user can create per client.

**Impact:**
- System could be overwhelmed processing thousands of alert rules
- Performance degradation

**Recommendation:**
- Limit to 50-100 rules per client

---

### 10. Protection Rule Without Limits (MEDIUM)

**Location:** `apps/web/src/actions/voice.ts:116-125`

**Issue:** No limit on protection rules per client.

**Impact:**
- Performance issues when checking protection rules
- Storage bloat

**Recommendation:**
- Add reasonable limit (e.g., 500 rules per client)

---

### 11. Keyword Save Without Limits (MEDIUM)

**Location:** `apps/web/src/actions/seo/keywords.ts:104-114`

**Issue:** While individual save is limited to 500 keywords, there's no check on total keywords already saved for the project.

```typescript
const saveKeywordsParamsSchema = keywordParamsSchema.extend({
  keywords: z.array(...).max(500, "Maximum 500 keywords"),
});
```

**Impact:**
- Users could call repeatedly to save unlimited keywords
- Database bloat

**Recommendation:**
- Check total keyword count before allowing save
- Implement project-level quota

---

## LOW Findings

### 12. Rate Limit Bypass on Redis Failure (LOW)

**Location:** `apps/web/src/lib/rate-limit.ts:93-106`

**Issue:** When Redis fails, the rate limiter allows requests through rather than failing closed.

```typescript
catch (error) {
  // Log error but allow request through to avoid blocking on Redis issues
  console.error("[rate-limit] Redis error, allowing request:", error);
  return { success: true, ... };
}
```

**Impact:**
- If Redis is down, all rate limits are bypassed
- Could lead to cost overruns on expensive operations

**Recommendation:**
- For critical operations (audits, LLM calls), consider failing closed
- Add monitoring for Redis availability

---

### 13. Webhook Event Array Size (LOW)

**Location:** `apps/web/src/actions/webhooks.ts:31-34`

**Issue:** Webhook events array allows up to 50 events which is reasonable, but event names are only validated for length, not against a registry of valid events.

```typescript
const webhookEventsSchema = z
  .array(z.string().min(1).max(100))
  .min(1, "At least one event is required")
  .max(50, "Maximum 50 events allowed");
```

**Impact:**
- Users could subscribe to non-existent event types
- Silent failures when invalid events never fire

**Recommendation:**
- Validate events against the event registry

---

### 14. Goals API Returns Synthetic Data in Production (LOW)

**Location:** `AI-Writer/backend/api/goals.py:132-183, 217-242`

**Issue:** When no goals exist, the API generates synthetic/demo data instead of returning empty results. This could mask missing configuration.

**Impact:**
- Confusing behavior in production
- Users might not realize goals aren't configured

**Recommendation:**
- Return empty results with a flag indicating no configuration
- Let frontend handle display of "no goals configured" state

---

## Positive Findings

The audit identified several well-implemented security patterns:

1. **Article Approval Race Protection** (`articles.py:366-408`): Uses `SELECT FOR UPDATE` with `skip_locked=True` to prevent duplicate approvals - excellent pattern.

2. **Webhook Delivery Idempotency** (`webhooks.ts:244-290`): Uses idempotency keys with `ON CONFLICT DO NOTHING` to prevent duplicate deliveries.

3. **Alert Rule Atomic Upsert** (`alerts.ts:182-221`): Uses proper `INSERT ON CONFLICT DO UPDATE` for race-safe rule creation.

4. **Comprehensive Input Validation**: All endpoints use Zod (frontend) and Pydantic (backend) schema validation.

5. **Rate Limiting on Expensive Operations**: Audits, LLM calls, and API costs are properly rate-limited.

6. **Authorization Checks**: All client/workspace operations validate ownership before mutations.

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| P0 | #1 Article Generation Idempotency | 2h |
| P1 | #2 Webhook TOCTOU | 4h |
| P1 | #3 Intelligence Scrape Deduplication | 1h |
| P1 | #4 Client Creation Limits | 2h |
| P1 | #5 Saved View Limits | 2h |
| P2 | #6 Article State Transitions | 3h |
| P2 | #7 Revert Idempotency | 2h |
| P2 | #8 CSV Row Limits | 1h |
| P2 | #9-11 Various Resource Limits | 3h |
| P3 | #12-14 Low Priority Items | 4h |

**Total Estimated Effort:** ~24 hours

---

## Appendix: Files Reviewed

### apps/web/src/actions/
- voice.ts
- webhooks.ts
- changes.ts
- alerts.ts
- views/saved-views.ts
- analytics/get-opportunities.ts
- dashboard/get-clients-paginated.ts
- team/get-team-metrics.ts
- seo/audit.ts
- seo/keywords.ts
- seo/backlinks.ts
- seo/findings.ts
- seo/mapping.ts
- seo/projects.ts

### open-seo-main/src/services/
- webhooks.ts
- alerts.ts

### AI-Writer/backend/api/
- articles.py
- clients.py
- brainstorm.py
- csv_import.py
- goals.py
- intelligence.py
- publishing_settings.py
- dashboard.py

### Supporting Files
- apps/web/src/lib/rate-limit.ts
- apps/web/src/lib/auth/action-auth.ts

---

## FIXES IMPLEMENTED - 2026-04-28

### 1. Article Generation Idempotency (CRITICAL - Fixed)

**File:** `AI-Writer/backend/api/articles.py`

**Fix:** Added atomic status transition using `SELECT FOR UPDATE` with `skip_locked=True`. The generate endpoint now:
1. Locks the article row with `with_for_update(skip_locked=True)`
2. Only selects articles in `draft` or `failed` status
3. Atomically sets status to `generating` before spawning background task
4. Returns 409 if article is already in `generating` status

This prevents duplicate generation tasks from concurrent requests.

### 2. Webhook TOCTOU (HIGH - Fixed)

**Files:**
- `open-seo-main/src/services/webhooks.ts`
- `apps/web/src/actions/webhooks.ts`

**Fix:** Modified `updateWebhook` and `deleteWebhook` functions to accept optional `expectedScope` and `expectedScopeId` parameters. These are included in the WHERE clause of the update/delete query, providing atomic ownership validation. The frontend now passes the scope info to the backend for atomic validation within the same query.

### 3. Intelligence Scrape Deduplication (HIGH - Fixed)

**File:** `AI-Writer/backend/api/intelligence.py`

**Fix:** Added `with_for_update()` to the intelligence record query and checks for `pending` or `in_progress` status. Returns 409 if a scrape is already in progress for the client.

### 4. Client Creation Limits (HIGH - Fixed)

**File:** `AI-Writer/backend/api/clients.py`

**Fix:** Added `MAX_CLIENTS_PER_USER = 100` limit. The `create_client` endpoint now checks the user's current client count before allowing creation. Returns 429 if limit is reached.

### 5. Saved View Limits (HIGH - Fixed)

**File:** `apps/web/src/actions/views/saved-views.ts`

**Fix:** Added `MAX_SAVED_VIEWS_PER_USER = 50` limit. The `createSavedViewWithConfig` function now checks the user's view count per workspace before allowing creation.

### 6. Article State Machine Transitions (MEDIUM - Fixed)

**File:** `AI-Writer/backend/api/articles.py`

**Fix:** Added `VALID_MANUAL_TRANSITIONS` dictionary defining allowed state transitions:
- `draft` -> `pending_review`
- `generated` -> `pending_review`
- `pending_review` -> `approved`, `draft`
- `approved` -> `draft`
- `failed` -> `draft`

The PATCH endpoint now validates that the requested status transition is allowed, preventing workflow bypass (e.g., jumping from `draft` directly to `approved`).

### 7. Revert Idempotency (MEDIUM - Fixed)

**File:** `apps/web/src/actions/changes.ts`

**Fix:** Added `generateRevertIdempotencyKey` function that creates a hash of the scope, connectionId, and a 30-second time window. This key is passed to the backend with revert requests to enable deduplication of rapid double-submissions.

### 8. CSV Row Limits (MEDIUM - Fixed)

**Files:**
- `AI-Writer/backend/api/csv_import.py`
- `AI-Writer/backend/services/csv_import.py`

**Fix:** Added `_MAX_CSV_ROWS = 500` limit. The CSV import service now raises a ValueError if the row count exceeds the limit, preventing resource exhaustion from large imports.

### Summary of Resource Limits Added

| Resource | Limit | Location |
|----------|-------|----------|
| Clients per user | 100 | `AI-Writer/backend/api/clients.py` |
| Saved views per user per workspace | 50 | `apps/web/src/actions/views/saved-views.ts` |
| CSV import rows | 500 | `AI-Writer/backend/services/csv_import.py` |

### Remaining Items (Not Addressed)

The following lower-priority items from the audit were not addressed in this fix:
- #9 Alert Rule Limits (MEDIUM)
- #10 Protection Rule Limits (MEDIUM)
- #11 Keyword Save Total Limits (MEDIUM)
- #12 Rate Limit Fail-Closed Option (LOW)
- #13 Webhook Event Validation (LOW)
- #14 Goals API Synthetic Data (LOW)

These should be addressed in a follow-up remediation effort.
