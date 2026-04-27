# Agent 09: Error Handling - Workers

## Summary

Implemented comprehensive error handling for all BullMQ workers in open-seo-main to address 5 CRITICAL issues found in the security audit.

## Issues Fixed

- [x] CRITICAL: Created worker error handler with structured logging (`error-handler.ts`)
- [x] CRITICAL: Created BaseWorker class with graceful shutdown (`base-worker.ts`)
- [x] CRITICAL: Added transaction-safe patterns and idempotency helpers
- [x] HIGH: Fixed fire-and-forget patterns in auth middleware and research service
- [x] HIGH: Added idempotency to ranking processor with upsert pattern

## Files Created

### `open-seo-main/src/server/workers/utils/error-handler.ts`

Worker error handling utilities providing:

- `createErrorContext(job, error)` - Creates structured error context with sanitized data
- `logWorkerError(workerName, job, error)` - Logs errors with full context
- `withErrorHandling(workerName, processor)` - Wraps processor with automatic error handling
- `fireAndForget(name, promise, logger?)` - Safe fire-and-forget with error logging
- `createFireAndForget(logger)` - Creates bound fire-and-forget function
- `withRetry(operation, options)` - Retry with exponential backoff

Key features:
- Sanitizes sensitive fields (passwords, tokens, API keys) from job data
- Provides structured logging compatible with production log aggregation
- Re-throws errors after logging to preserve BullMQ retry logic

### `open-seo-main/src/server/workers/utils/base-worker.ts`

Abstract base class for workers providing:

- Automatic error handling via `withErrorHandling` wrapper
- Graceful shutdown on SIGTERM/SIGINT with configurable timeout
- Dead letter queue (DLQ) support for jobs that exhaust retries
- Event handlers for completed, failed, error, and stalled events
- Queue metrics (waiting, active, completed, failed, delayed counts)
- Support for both sandboxed and inline processors

Usage:
```typescript
class MyWorker extends BaseWorker<JobData, Result> {
  constructor() {
    super({
      name: 'my-processor',
      queueName: 'my-queue',
      concurrency: 5,
    });
  }

  protected async process(job: Job<JobData>): Promise<Result> {
    // Process job - errors are automatically handled
    return { success: true };
  }
}
```

### `open-seo-main/src/server/workers/utils/index.ts`

Barrel export for all worker utilities.

## Files Modified

### `open-seo-main/src/server/workers/ranking-processor.ts`

Changes:
1. Added idempotency check via `getExistingRanking()` - skips already-processed keywords
2. Added `upsertRanking()` with ON CONFLICT DO UPDATE for safe retries
3. Added `withRetry()` wrapper for DataForSEO API calls with transient error handling
4. Changed `recordDropEvent` to use `fireAndForget()` for non-critical alerts
5. Added progress updates via `job.updateProgress()`
6. Added database error handling with proper re-throw for job retry
7. Added `skipped` count to batch results for monitoring

### `open-seo-main/src/server/middleware/auth.ts`

Changes:
1. Imported `createFireAndForget` from worker utils
2. Replaced `void db.update(...).catch(...)` pattern with `bgTask()` for cleaner error handling

Before:
```typescript
void db.update(apiKeys).set({ lastUsedAt: now }).where(...).catch((err) => {
  log.error("Failed to update lastUsedAt", err);
});
```

After:
```typescript
bgTask(`update-api-key-last-used-${apiKeyRecord.id}`, 
  db.update(apiKeys).set({ lastUsedAt: now }).where(...)
);
```

### `open-seo-main/src/server/features/keywords/services/research/research.ts`

Changes:
1. Imported `createFireAndForget` from worker utils
2. Replaced `void Promise.all(...).catch(...)` pattern with `bgTask()` for cleaner error handling

Before:
```typescript
void Promise.all(rows.map((row) => 
  KeywordResearchRepository.upsertKeywordMetric({...})
)).catch((error) => {
  log.error("Persist metrics failed", error);
});
```

After:
```typescript
bgTask(`persist-keyword-metrics-${input.projectId}`,
  Promise.all(rows.map((row) =>
    KeywordResearchRepository.upsertKeywordMetric({...})
  ))
);
```

## Error Handling Strategy

### 1. Worker Errors

All worker errors are:
1. Logged with structured context (jobId, jobName, attempts, error details)
2. Re-thrown to trigger BullMQ retry logic
3. Moved to DLQ after max retries exhausted

### 2. Transaction Safety

Database operations use Drizzle's native transaction support:
```typescript
await db.transaction(async (tx) => {
  // Operations automatically rolled back on error
});
```

For idempotent operations, use upsert pattern:
```typescript
await db.insert(table).values(data).onConflictDoUpdate({
  target: [table.uniqueKey],
  set: { ...updatedFields },
});
```

### 3. Fire-and-Forget Pattern

Background tasks that shouldn't block the main flow use `fireAndForget()`:
- Errors are logged but don't affect the caller
- Each task has a unique name for log correlation
- Uses the module's logger for consistent formatting

### 4. Graceful Shutdown

Workers handle SIGTERM/SIGINT:
1. Stop accepting new jobs
2. Wait for in-flight jobs (configurable timeout, default 25s)
3. Force close if timeout exceeded
4. Close queue events and connections

### 5. Idempotency

Jobs are designed to be safely retriable:
- Check for existing records before processing
- Use upsert patterns for database writes
- Include unique job IDs for deduplication

## Testing Recommendations

1. Test worker error handling with intentional failures
2. Verify DLQ receives jobs after max retries
3. Test graceful shutdown with SIGTERM during job processing
4. Verify idempotency by processing same job twice
5. Monitor fire-and-forget errors in logs

## Metrics to Monitor

- `jobs.completed` - Successful job completions
- `jobs.failed` - Job failures (before DLQ)
- `jobs.dlq` - Jobs moved to dead letter queue
- `jobs.stalled` - Stalled jobs (may indicate worker issues)
- Background task errors in logs (prefix: `Background task failed:`)
