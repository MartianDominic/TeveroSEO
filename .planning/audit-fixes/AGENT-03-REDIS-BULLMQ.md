# Agent 03: Redis/BullMQ Connection Factory

## Summary

Implemented the missing `getSharedBullMQConnection` and `closeRedis` functions that 30+ files depend on for BullMQ worker infrastructure. Fixed worker startup patterns and non-atomic scheduler initialization.

## Issues Fixed

- [x] CRITICAL: Implemented `getSharedBullMQConnection` with connection pooling
- [x] CRITICAL: Implemented `closeRedis` for graceful shutdown
- [x] HIGH: Fixed `worker-entry.ts` async startup (replaced fire-and-forget with `Promise.allSettled`)
- [x] HIGH: Fixed non-atomic scheduler init in `rankingQueue.ts` (add-first, then remove old)

## Files Modified

### 1. `open-seo-main/src/server/lib/redis.ts`

Added BullMQ connection pooling infrastructure:

**New Exports:**
- `getSharedBullMQConnection(label: string): Redis` - Get or create a shared Redis connection for BullMQ workers
- `closeRedis(): Promise<void>` - Close all Redis connections gracefully
- `getBullMQConnectionCount(): number` - Get count of active connections (monitoring)
- `getBullMQConnectionLabels(): string[]` - Get labels of active connections (monitoring)

**Key Features:**
- Connection pooling by label to prevent connection leaks
- BullMQ-optimized settings (`maxRetriesPerRequest: null`, `enableReadyCheck: false`)
- Automatic reconnection on transient errors (READONLY, ECONNRESET, ETIMEDOUT)
- Comprehensive error/ready/close event logging
- Graceful shutdown that closes all connections

### 2. `open-seo-main/src/worker-entry.ts`

Replaced fire-and-forget worker startup with proper async handling:

**Before:**
```typescript
void startAnalyticsWorker();
void startWebhookWorker();
// ... logging happens before workers actually start
```

**After:**
```typescript
async function startAllWorkers(): Promise<void> {
  const results = await Promise.allSettled(
    workers.map(async ({ name, start }) => {
      await start();
      log.info(`${name} worker started`);
    })
  );
  // Proper success/failure reporting
}

startAllWorkers().catch((err) => {
  log.error("Fatal error starting workers", err);
  process.exit(1);
});
```

**Benefits:**
- All workers start in parallel for faster startup
- Proper error handling - failures are logged
- Process exits on fatal errors
- Accurate logging (logs after worker actually starts)

### 3. `open-seo-main/src/server/queues/rankingQueue.ts`

Fixed non-atomic scheduler initialization:

**Before (race condition):**
```typescript
// Job can be lost if crash between remove and add
await rankingQueue.removeRepeatableByKey(job.key);
await rankingQueue.add(...);
```

**After (atomic):**
```typescript
// First add new job (guarantees it exists)
await rankingQueue.add(...);
// Now safe to remove old jobs
for (const job of repeatableJobs) {
  if (job.id === jobId && job.pattern === "0 3 * * *") continue;
  await rankingQueue.removeRepeatableByKey(job.key).catch(...);
}
```

**Benefits:**
- New job is guaranteed to exist before old jobs are removed
- Crash between operations cannot cause job loss
- Old/stale jobs are cleaned up safely

## Exported Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `getSharedBullMQConnection` | `(label: string): Redis` | Get/create pooled BullMQ connection |
| `closeRedis` | `(): Promise<void>` | Close all Redis connections |
| `getBullMQConnectionCount` | `(): number` | Get active connection count |
| `getBullMQConnectionLabels` | `(): string[]` | Get active connection labels |

## Connection Labels in Use

The codebase uses these connection labels:
- `queue:audit`, `queue:failed-audits`, `queue:ranking`, `queue:report`, `queue:schedule`, `queue:voice-analysis`, `queue:pipeline-phase`, `queue:pipeline-plan`
- `worker:audit`, `worker:analytics`, `worker:webhook`, `worker:alert`, `worker:schedule`, `worker:voice-analysis`, `worker:prospect-analysis`, `worker:goal-processor`, `worker:pipeline-phase`
- `flow:pipeline`

## Testing

The implementation follows BullMQ best practices:
- `maxRetriesPerRequest: null` required for blocking commands (BRPOPLPUSH, etc.)
- `enableReadyCheck: false` for faster connection
- Exponential backoff retry strategy (100ms, 200ms, ... up to 3000ms)
- Reconnection on transient Redis errors

## Dependencies

- `ioredis` - Redis client
- `bullmq` - Job queue library (uses the connections)
