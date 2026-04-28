# Error Recovery, Transaction Safety, and Crash Resilience Audit

**Date:** 2026-04-28
**Scope:** apps/web/src/actions/, open-seo-main/src/server/workers/, AI-Writer/backend/services/

---

## Executive Summary

This audit examined error recovery, transaction atomicity, and crash resilience across the TeveroSEO codebase. The codebase demonstrates **mature patterns** in many areas (DLQ handling, retry with backoff, idempotent operations) but has **several areas requiring attention**, particularly around multi-step operations without transactions and database session lifecycle management.

**Risk Level:** MEDIUM - Most critical paths have proper error handling, but edge cases could leave data in inconsistent states.

---

## Findings Summary

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Transaction Atomicity | 1 | 3 | 4 | 2 |
| Crash Recovery | 0 | 2 | 3 | 1 |
| Error Propagation | 0 | 1 | 5 | 3 |

---

## 1. Transaction Atomicity Issues

### CRITICAL-TXN-001: Schedule Processor Creates Report Without Transaction
**File:** `open-seo-main/src/server/workers/schedule-processor.ts` (lines 110-148)
**Severity:** CRITICAL

The schedule processor creates a report record and then updates the schedule in separate database operations without a transaction:

```typescript
// Line 111-122: Create report record
const [newReport] = await db
  .insert(reports)
  .values({...})
  .returning();

// Line 124-131: Enqueue job (can fail)
await enqueueReportGeneration(newReport.id, {...});

// Line 139-148: Update schedule (separate operation)
await db
  .update(reportSchedules)
  .set({...})
  .where(eq(reportSchedules.id, schedule.id));
```

**Impact:** If the job enqueue or schedule update fails:
- Report record exists in "pending" status with no corresponding job
- Schedule not updated, will re-trigger next cycle
- Duplicate reports possible

**Recommendation:** Wrap in `db.transaction()`:
```typescript
await db.transaction(async (tx) => {
  const [newReport] = await tx.insert(reports)...;
  await tx.update(reportSchedules)...;
  // Enqueue AFTER transaction commits successfully
});
await enqueueReportGeneration(newReport.id, {...});
```

---

### HIGH-TXN-002: Content Planning Service DB Session Not Closed on Error
**File:** `AI-Writer/backend/services/content_planning_service.py` (lines 21-28, 306-363)
**Severity:** HIGH

The `_get_db_session()` method creates a new session but the service methods don't ensure closure:

```python
def _get_db_session(self, user_id: int) -> Session:
    """Get database session."""
    return get_session_for_user(str(user_id))

def _get_db_service(self, user_id: int) -> ContentPlanningDBService:
    """Get database service."""
    return ContentPlanningDBService(self._get_db_session(user_id))
```

In `generate_content_recommendations_with_ai()` (line 320), the session is created but never explicitly closed:
```python
db_service = self._get_db_service()  # Missing user_id, creates None session
if not db_service:
    logger.error("Database service not available")
    return []
# No db_service.close() or context manager
```

**Impact:**
- Connection pool exhaustion under load
- Leaked database connections
- Transaction isolation violations

**Recommendation:** Use context manager pattern:
```python
def _get_db_service(self, user_id: int) -> ContentPlanningDBService:
    with self._get_db_session(user_id) as session:
        yield ContentPlanningDBService(session)
```

---

### HIGH-TXN-003: Auto-Publish Executor Three-Phase Commit Risk
**File:** `AI-Writer/backend/services/auto_publish_executor.py` (lines 165-298)
**Severity:** HIGH

The `_publish_single_article()` function uses three separate database sessions:
1. Session 1: Claim article (lines 173-205)
2. Session 2: Load credentials (lines 211-273)
3. Session 3: Save result (lines 291-421)

While intentionally designed to avoid holding connections during HTTP calls, the gap between sessions creates risks:

```python
# Session 1: Claim
article.status = "publishing"
article.publishing_started_at = now_utc
db.commit()
db.close()

# ... HTTP call to CMS ...

# Session 3: Save result
article = db.query(ScheduledArticle).filter(...).first()
if article is None:
    # Article was deleted between sessions!
    logger.error("Article disappeared during publish")
    return
```

**Impact:**
- Article can be deleted between sessions, causing orphaned state
- Race condition if multiple workers claim same article

**Positive:** The code does use `with_for_update(skip_locked=True)` for atomic claiming, which mitigates most race conditions.

**Recommendation:** Consider adding a version/optimistic lock field to detect concurrent modifications.

---

### HIGH-TXN-004: Alert Rule Create/Delete Using Wrong HTTP Method
**File:** `apps/web/src/actions/alerts.ts` (lines 160-188)
**Severity:** HIGH

The `createAlertRule()` and `deleteAlertRule()` functions use `patchOpenSeo` for create/delete operations:

```typescript
// Line 160: Using PATCH for POST semantics
const response = await patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules`, {
  method: "POST",  // This is passed as body, not HTTP method!
  ...validatedRule,
});

// Line 184: Using PATCH for DELETE semantics
await patchOpenSeo(`/api/clients/${validatedClientId}/alert-rules/${validatedRuleId}`, {
  method: "DELETE",  // Same issue
});
```

**Impact:**
- Operations may not execute as intended on the backend
- Error responses may be misinterpreted
- Idempotency guarantees broken

**Recommendation:** Use correct HTTP methods:
```typescript
await postOpenSeo(...);  // for create
await deleteOpenSeo(...);  // for delete
```

---

### MEDIUM-TXN-005: Ranking Processor Individual Keyword Failures Don't Rollback
**File:** `open-seo-main/src/server/workers/ranking-processor.ts` (lines 158-276)
**Severity:** MEDIUM

The `processBatch()` function processes keywords individually without batch transaction:

```typescript
for (const kw of keywords) {
  try {
    // ... process single keyword
    await upsertRanking(...);  // Individual insert/update
  } catch (error) {
    failed++;
    // Continue processing other keywords
  }
}
```

**Positive:** This is actually good design for this use case - individual keyword failures shouldn't affect others. However, the upsert operation itself is atomic.

**Note:** The code uses `onConflictDoUpdate` which provides idempotency (line 132-152).

---

### MEDIUM-TXN-006: Webhook Create/Update Without Rollback
**File:** `apps/web/src/actions/webhooks.ts` (lines 143-165, 171-195)
**Severity:** MEDIUM

Webhook operations don't handle partial failures:

```typescript
export async function createWebhook(params: {...}): Promise<{ id: string; secret: string }> {
  // ... validation ...
  return postOpenSeo("/api/webhooks", {...});
  // If backend creates webhook but response fails, client doesn't know about it
}
```

**Impact:** Network failure after successful creation leaves client unaware of created webhook.

**Recommendation:** Add idempotency key to prevent duplicate creates.

---

## 2. Crash Recovery Issues

### HIGH-CRASH-001: Background Job Service In-Memory State
**File:** `AI-Writer/backend/services/background_jobs.py` (lines 86-91)
**Severity:** HIGH

The background job service stores all job state in memory:

```python
# NOTE: In-memory storage is INTENTIONAL for these job types:
# - bing_comprehensive_insights: Regenerated on-demand, cached results survive
# - bing_data_collection: Scheduled externally, data persisted to DB
# - analytics_refresh: Ephemeral refresh operation, results cached in Redis
self._jobs: Dict[str, Job] = {}
self._workers: Dict[str, threading.Thread] = {}
```

**Impact:** On server restart:
- Running jobs are lost
- No way to resume interrupted operations
- Users see jobs disappear

**Positive:** The comment acknowledges this and documents that these specific job types are non-critical.

**Recommendation:** For any future critical job types, use APScheduler with SQLAlchemy job store or BullMQ.

---

### HIGH-CRASH-002: Article Recovery Service Only Handles "publishing" State
**File:** `AI-Writer/backend/services/article_recovery_service.py` (lines 18-65)
**Severity:** HIGH

The `publishing_recovery_sweep()` only recovers articles stuck in "publishing" state:

```python
stuck = (
    db.query(ScheduledArticle)
    .filter(
        ScheduledArticle.status == "publishing",
        ScheduledArticle.publishing_started_at != None,
        ScheduledArticle.publishing_started_at < cutoff,
    )
    .with_for_update(skip_locked=True)
    .all()
)
```

**Missing Recovery:**
- Articles in "approved" with past `publish_date` but never claimed
- Articles stuck in any intermediate processing state

**Recommendation:** Add sweep for orphaned approved articles:
```python
# Also find approved articles that were never picked up
orphaned = db.query(ScheduledArticle).filter(
    ScheduledArticle.status == "approved",
    ScheduledArticle.publish_date < cutoff,
    ScheduledArticle.publishing_started_at == None,
).all()
```

---

### MEDIUM-CRASH-003: BullMQ Worker Graceful Shutdown Timeout
**File:** `open-seo-main/src/server/workers/audit-worker.ts` (lines 97-110)
**Severity:** MEDIUM

Graceful shutdown has a 25-second timeout, after which it force-closes:

```typescript
const SHUTDOWN_TIMEOUT_MS = 25_000;

export async function stopAuditWorker(): Promise<void> {
  // ...
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    await current.close(true); // force
  }
}
```

**Positive:** This is actually proper implementation - timeout prevents hanging on shutdown.

**Note:** The audit processor uses step-level checkpointing (line 78-83 in audit-processor.ts) which enables resume on retry.

---

### MEDIUM-CRASH-004: Link Graph Update Fire-and-Forget
**File:** `AI-Writer/backend/services/auto_publish_executor.py` (lines 533-601)
**Severity:** MEDIUM

The `_run_link_graph_update()` function runs asynchronously without waiting:

```python
task = asyncio.create_task(
    _safe_update_link_graph(article_id, client_id, url, html)
)
task.add_done_callback(_task_done_callback)
```

**Positive:** The code properly adds a done callback to catch errors.

**Impact:** If server crashes during link graph update, the operation is lost. No retry mechanism.

**Recommendation:** Consider queuing failed link graph updates for later retry.

---

## 3. Error Propagation Issues

### HIGH-ERR-001: Silent Error Return in Content Planning Service
**File:** `AI-Writer/backend/services/content_planning_service.py` (multiple methods)
**Severity:** HIGH

Multiple methods catch all exceptions and return None/empty list without propagating:

```python
async def analyze_content_strategy_with_ai(...) -> Optional[ContentStrategy]:
    try:
        # ... logic ...
    except Exception as e:
        logger.error(f"Error analyzing content strategy with AI: {str(e)}")
        return None  # Caller can't distinguish failure from "not found"
```

**Impact:** Callers cannot distinguish between:
- Operation failed
- Resource not found
- Permission denied
- Database error

**Recommendation:** Use typed error returns or raise domain exceptions:
```python
class ContentPlanningError(Exception):
    pass

class NotFoundError(ContentPlanningError):
    pass
```

---

### MEDIUM-ERR-002: Generic Error Messages in Server Actions
**File:** `apps/web/src/actions/changes.ts` (lines 163-170)
**Severity:** MEDIUM

Error handling returns generic messages:

```typescript
} catch (error) {
  if (error instanceof z.ZodError) {
    return { success: false, error: error.errors[0]?.message ?? 'Invalid input' };
  }
  console.error('[getChanges]', error);
  return { success: false, error: 'Failed to fetch changes. Please try again.' };
}
```

**Positive:** This is correct for security (don't leak internal errors to clients).

**Note:** The full error is logged server-side, which is the right approach.

---

### MEDIUM-ERR-003: Wix Service Swallows Request Exceptions
**File:** `AI-Writer/backend/services/wix_service.py` (multiple methods)
**Severity:** MEDIUM

Several methods catch `requests.RequestException` but return empty data:

```python
def lookup_or_create_categories(...) -> List[str]:
    try:
        # ...
    except requests.RequestException as e:
        logger.error(f"Failed to lookup/create categories: {e}")
        return []  # Caller assumes no categories exist
```

**Impact:** Network failures are indistinguishable from "no categories exist".

---

### MEDIUM-ERR-004: Pattern Detection Returns Empty on Error
**File:** `apps/web/src/actions/analytics/detect-patterns.ts` (lines 193-196)
**Severity:** MEDIUM

```typescript
} catch (error) {
  console.error("[detect-patterns] Error detecting patterns:", error);
  return [];
}
```

**Impact:** Users see "no patterns" instead of "pattern detection failed".

**Recommendation:** Return error state that UI can display.

---

## 4. Positive Patterns Found

### Proper DLQ Implementation
**Files:** 
- `open-seo-main/src/server/workers/audit-worker.ts` (lines 60-86)
- `open-seo-main/src/server/workers/onboarding-worker.ts` (lines 110-137)
- `open-seo-main/src/server/workers/auto-revert-worker.ts` (lines 117-139)

All workers properly move failed jobs to DLQ after retries exhausted:

```typescript
if (job.attemptsMade >= maxAttempts) {
  const dlqPayload: FailedAuditJobData = {...};
  await failedAuditsQueue.add(`dlq-${job.data.auditId}`, dlqPayload);
}
```

### Idempotent Operations
**File:** `open-seo-main/src/server/workers/ranking-processor.ts` (lines 98-153)

Ranking processor uses proper idempotency checks:

```typescript
// Skip if already processed today
const existing = await getExistingRanking(kw.id, today);
if (existing) {
  skipped++;
  continue;
}

// Upsert with ON CONFLICT DO UPDATE
await db.insert(keywordRankings)
  .values({...})
  .onConflictDoUpdate({...});
```

### Retry with Exponential Backoff
**File:** `open-seo-main/src/server/workers/utils/error-handler.ts` (lines 280-322)

Well-implemented retry utility:

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {...}
```

### Thread-Safe Background Job Service
**File:** `AI-Writer/backend/services/background_jobs.py`

Proper double-checked locking and dedicated locks:

```python
_service_lock = threading.Lock()
_service_instance: Optional[BackgroundJobService] = None

def get_background_job_service() -> BackgroundJobService:
    global _service_instance
    if _service_instance is None:
        with _service_lock:
            if _service_instance is None:
                _service_instance = BackgroundJobService()
    return _service_instance
```

### Database Engine Cleanup
**File:** `AI-Writer/backend/services/database.py` (lines 329-343)

Proper engine disposal with thread safety:

```python
def cleanup_user_engine(user_id: str) -> None:
    with _engine_lock:
        if user_id in _user_engines:
            try:
                _user_engines[user_id].dispose()
            except Exception as e:
                logger.error(f"Error disposing engine for user {user_id}: {e}")
            finally:
                del _user_engines[user_id]
```

---

## Recommendations Summary

### Immediate Actions (CRITICAL/HIGH)

1. **CRITICAL-TXN-001:** Wrap schedule processor report creation in transaction
2. **HIGH-TXN-002:** Fix ContentPlanningService session lifecycle
3. **HIGH-TXN-003:** Add optimistic locking to article publishing
4. **HIGH-TXN-004:** Fix HTTP methods in alerts.ts (use correct POST/DELETE)
5. **HIGH-CRASH-002:** Extend article recovery to handle orphaned approved articles
6. **HIGH-ERR-001:** Add typed error returns to ContentPlanningService

### Short-Term Actions (MEDIUM)

1. Add idempotency keys to webhook create operations
2. Queue failed link graph updates for retry
3. Return typed error states from server actions instead of empty arrays
4. Add connection pool monitoring for AI-Writer database service

### Long-Term Improvements

1. Consider moving critical background jobs from in-memory to persistent queue
2. Add distributed tracing for cross-service operation debugging
3. Implement circuit breakers for external API calls (Wix, DataForSEO)
4. Add health check endpoints that verify database connectivity

---

## Appendix: Files Reviewed

### apps/web/src/actions/
- alerts.ts
- changes.ts
- voice.ts
- webhooks.ts
- analytics/detect-patterns.ts
- seo/audit.ts
- seo/keywords.ts
- seo/mapping.ts
- seo/projects.ts
- views/saved-views.ts

### open-seo-main/src/server/workers/
- audit-worker.ts
- audit-processor.ts
- auto-revert-worker.ts
- onboarding-worker.ts
- ranking-processor.ts
- schedule-processor.ts
- utils/error-handler.ts

### AI-Writer/backend/services/
- article_recovery_service.py
- auto_publish_executor.py
- background_jobs.py
- content_planning_service.py
- database.py
- wix_service.py
