# Queue Persistence Design: Document Processing

**Phase:** 102 - Advanced Document Builder  
**Created:** 2026-05-18  
**Status:** Design Review

## Problem Statement

The current `processing-queue.ts` uses an in-memory array (`jobQueue: QueuedJob[]`) that loses all pending and in-progress jobs on server restart. The existing `recoverStaleJobs()` function only recovers jobs that were mid-processing for >10 minutes, but jobs sitting in the queue waiting to be processed are permanently lost.

**Current architecture:**
```
Upload -> DB record (pending) -> In-memory queue -> Processing -> DB update (completed)
                                    |
                              [LOST ON RESTART]
```

**Impact:**
- Jobs queued but not yet started are lost entirely
- Jobs mid-processing require manual re-queue after 10-minute stale threshold
- No visibility into queue state after restart

---

## Comparison Table

| Criteria | Option A: Database-Backed | Option B: Redis-Backed (BullMQ-lite) |
|----------|---------------------------|--------------------------------------|
| **Durability** | Full ACID, survives Redis failure | Depends on Redis persistence (RDB/AOF) |
| **Recovery time** | ~50-200ms (single query) | ~10-50ms (LRANGE) |
| **Atomicity** | Transactional with doc updates | Requires Lua scripts for atomicity |
| **Infrastructure** | Uses existing PostgreSQL | Uses existing Redis |
| **Complexity** | Low - extend existing schema | Medium - new Redis data structures |
| **Queue ordering** | Requires ORDER BY query | Native with LPUSH/RPOP |
| **Backoff/retry state** | Stored in JSON column | Stored in hash field |
| **Monitoring** | SQL queries | Redis LLEN, SCAN |
| **Horizontal scaling** | Needs advisory locks | Built-in with BRPOPLPUSH |
| **BullMQ migration path** | Requires rewrite | Drop-in replacement ready |

---

## Recommended Solution: Option A (Database-Backed)

**Rationale:**

1. **No new infrastructure** - PostgreSQL is already the source of truth for document state
2. **Transactional consistency** - Queue operations and document updates in single transaction
3. **Simpler failure modes** - Database failure = entire app down anyway
4. **Already partially implemented** - `uploadedDocuments.status` field exists with `pending` state
5. **Cheaper operations** - No Redis roundtrip for every queue check

The key insight: `uploadedDocuments` table already tracks processing state. The in-memory queue is redundant - we just need to query `status = 'pending'` on startup and poll.

---

## Implementation Details

### Schema Extension

No new table needed. Extend `uploadedDocuments` with queue-specific fields:

```typescript
// apps/web/src/db/schema/document-builder.ts

export const uploadedDocuments = pgTable(
  "uploaded_documents",
  {
    // ... existing fields ...
    
    // Queue management (NEW)
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "date" }),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    lockedBy: text("locked_by"), // Instance ID for distributed locking
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    // ... existing indexes ...
    
    // Queue polling index (status + nextAttemptAt for efficient ordering)
    index("idx_uploaded_documents_queue").on(
      table.status, 
      table.nextAttemptAt
    ),
  ]
);
```

### Migration

```sql
-- 0001_add_queue_fields.sql
ALTER TABLE uploaded_documents
  ADD COLUMN queued_at TIMESTAMPTZ,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN last_error TEXT,
  ADD COLUMN locked_by TEXT,
  ADD COLUMN locked_at TIMESTAMPTZ;

CREATE INDEX idx_uploaded_documents_queue 
  ON uploaded_documents (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

-- Backfill existing pending documents
UPDATE uploaded_documents 
SET 
  queued_at = created_at,
  next_attempt_at = COALESCE(processing_started_at, created_at)
WHERE status IN ('pending', 'processing');
```

### Database-Backed Queue Implementation

```typescript
// apps/web/src/lib/document-processing/db-queue.ts

import { eq, and, lt, lte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { uploadedDocuments } from "@/db/schema/document-builder";
import { logger } from "@/lib/logger";
import { nanoid } from "nanoid";

// =============================================================================
// Configuration
// =============================================================================

const PROCESS_INTERVAL_MS = 1000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BACKOFF_MS = 5000;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const INSTANCE_ID = `worker-${process.pid}-${nanoid(8)}`;

// =============================================================================
// Queue Interface
// =============================================================================

export interface QueueJob {
  documentId: string;
  attemptCount: number;
}

export const documentQueue = {
  /**
   * Add a document to the processing queue.
   * Since we use the documents table itself, this just updates queue fields.
   */
  async add(documentId: string): Promise<void> {
    await db.update(uploadedDocuments)
      .set({
        status: "pending",
        queuedAt: new Date(),
        nextAttemptAt: new Date(),
        attemptCount: 0,
        lockedBy: null,
        lockedAt: null,
        processingError: null,
      })
      .where(eq(uploadedDocuments.id, documentId));

    logger.info("[db-queue] Job queued", { documentId });
  },

  /**
   * Get the next job ready for processing.
   * Uses SELECT FOR UPDATE SKIP LOCKED for distributed safety.
   */
  async getNextJob(): Promise<QueueJob | null> {
    const now = new Date();

    // Use raw SQL for SKIP LOCKED (not supported in Drizzle query builder)
    const result = await db.execute(sql`
      UPDATE uploaded_documents
      SET 
        locked_by = ${INSTANCE_ID},
        locked_at = ${now},
        status = 'processing',
        processing_started_at = ${now}
      WHERE id = (
        SELECT id FROM uploaded_documents
        WHERE status = 'pending'
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
          AND (locked_by IS NULL OR locked_at < ${new Date(now.getTime() - LOCK_TIMEOUT_MS)})
        ORDER BY next_attempt_at ASC NULLS FIRST
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, attempt_count
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as { id: string; attempt_count: number };
    return {
      documentId: row.id,
      attemptCount: row.attempt_count,
    };
  },

  /**
   * Mark a job as completed successfully.
   */
  async complete(documentId: string): Promise<void> {
    await db.update(uploadedDocuments)
      .set({
        status: "completed",
        processingCompletedAt: new Date(),
        processingProgress: 100,
        lockedBy: null,
        lockedAt: null,
      })
      .where(eq(uploadedDocuments.id, documentId));

    logger.info("[db-queue] Job completed", { documentId });
  },

  /**
   * Mark a job as failed. Schedules retry if attempts remain.
   */
  async fail(
    documentId: string,
    error: string,
    options?: { maxAttempts?: number; backoffMs?: number }
  ): Promise<void> {
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const backoffMs = options?.backoffMs ?? DEFAULT_BACKOFF_MS;

    // Get current attempt count
    const doc = await db.query.uploadedDocuments.findFirst({
      where: eq(uploadedDocuments.id, documentId),
      columns: { attemptCount: true },
    });

    const attemptCount = (doc?.attemptCount ?? 0) + 1;
    const hasRetriesLeft = attemptCount < maxAttempts;

    if (hasRetriesLeft) {
      // Schedule retry with exponential backoff
      const backoff = backoffMs * Math.pow(2, attemptCount - 1);
      const nextAttemptAt = new Date(Date.now() + backoff);

      await db.update(uploadedDocuments)
        .set({
          status: "pending",
          attemptCount,
          nextAttemptAt,
          lastError: error,
          lockedBy: null,
          lockedAt: null,
          processingProgress: 0,
        })
        .where(eq(uploadedDocuments.id, documentId));

      logger.info("[db-queue] Job scheduled for retry", {
        documentId,
        attemptCount,
        nextAttemptAt,
        backoffMs: backoff,
      });
    } else {
      // Max attempts reached - permanent failure
      await db.update(uploadedDocuments)
        .set({
          status: "failed",
          attemptCount,
          lastError: error,
          processingError: error,
          lockedBy: null,
          lockedAt: null,
        })
        .where(eq(uploadedDocuments.id, documentId));

      logger.error("[db-queue] Job permanently failed", {
        documentId,
        attemptCount,
        error,
      });
    }
  },

  /**
   * Update job progress (for long-running jobs).
   */
  async updateProgress(documentId: string, progress: number): Promise<void> {
    await db.update(uploadedDocuments)
      .set({ processingProgress: progress })
      .where(eq(uploadedDocuments.id, documentId));
  },

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const result = await db.execute(sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM uploaded_documents
      GROUP BY status
    `);

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of result.rows as { status: string; count: number }[]) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = row.count;
      }
    }
    return stats;
  },
};

// =============================================================================
// Worker Implementation
// =============================================================================

let processingInterval: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;
let shutdownRequested = false;

/**
 * Process the next available job from the queue.
 */
async function processNextJob(
  processor: (job: QueueJob) => Promise<void>
): Promise<boolean> {
  if (isProcessing || shutdownRequested) {
    return false;
  }

  isProcessing = true;

  try {
    const job = await documentQueue.getNextJob();
    if (!job) {
      return false;
    }

    logger.info("[db-queue] Processing job", {
      documentId: job.documentId,
      attemptCount: job.attemptCount,
    });

    try {
      await processor(job);
      await documentQueue.complete(job.documentId);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await documentQueue.fail(job.documentId, errorMsg);
      return false;
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Recover jobs that were orphaned by crashes.
 * Jobs with stale locks (locked but not updated in LOCK_TIMEOUT_MS) are re-queued.
 */
async function recoverOrphanedJobs(): Promise<number> {
  const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);

  const result = await db.update(uploadedDocuments)
    .set({
      status: "pending",
      lockedBy: null,
      lockedAt: null,
      processingProgress: 0,
    })
    .where(
      and(
        eq(uploadedDocuments.status, "processing"),
        lt(uploadedDocuments.lockedAt, staleThreshold)
      )
    )
    .returning({ id: uploadedDocuments.id });

  if (result.length > 0) {
    logger.info("[db-queue] Recovered orphaned jobs", {
      count: result.length,
      documentIds: result.map((r) => r.id),
    });
  }

  return result.length;
}

/**
 * Create and start a document processing worker.
 */
export function createDocumentWorker(
  processor: (job: QueueJob) => Promise<void>
) {
  return {
    async start(): Promise<void> {
      if (processingInterval) {
        return;
      }

      shutdownRequested = false;

      // Recover orphaned jobs on startup
      await recoverOrphanedJobs();

      logger.info("[db-queue] Worker starting", {
        instanceId: INSTANCE_ID,
        intervalMs: PROCESS_INTERVAL_MS,
      });

      // Poll for jobs
      processingInterval = setInterval(
        () => processNextJob(processor),
        PROCESS_INTERVAL_MS
      );
    },

    async stop(): Promise<void> {
      if (!processingInterval) {
        return;
      }

      logger.info("[db-queue] Shutdown requested");
      shutdownRequested = true;

      // Wait for in-flight job (max 60s)
      const maxWait = 60000;
      const checkInterval = 100;
      let waited = 0;

      while (isProcessing && waited < maxWait) {
        await new Promise((r) => setTimeout(r, checkInterval));
        waited += checkInterval;
      }

      clearInterval(processingInterval);
      processingInterval = null;

      logger.info("[db-queue] Worker stopped", {
        instanceId: INSTANCE_ID,
        hadInFlightJob: waited > 0,
      });
    },

    isRunning: () => processingInterval !== null,
    getInstanceId: () => INSTANCE_ID,
    recoverOrphanedJobs,
  };
}
```

### Integration with Upload Service

```typescript
// apps/web/src/lib/document-processing/upload-service.ts
// Update the upload function to use db-queue

import { documentQueue } from "./db-queue";

export async function uploadDocument(
  file: File,
  workspaceId: string
): Promise<UploadResult> {
  // ... existing validation and R2 upload ...

  // Create database record with queue fields
  await db.insert(uploadedDocuments).values({
    id: documentId,
    workspaceId,
    fileName: file.name,
    fileType,
    fileSize: file.size,
    mimeType: file.type,
    r2Key,
    r2Bucket: bucket,
    status: "pending",
    processingProgress: 0,
    queuedAt: new Date(),        // NEW
    nextAttemptAt: new Date(),   // NEW
    attemptCount: 0,             // NEW
  });

  // No separate queue.add() needed - the INSERT itself queues the job
  // Worker polls uploadedDocuments WHERE status = 'pending'

  logger.info("[upload-service] Document queued for processing", {
    documentId,
    r2Key,
  });

  return { documentId, status: "pending" };
}
```

### Worker Initialization

```typescript
// apps/web/src/lib/document-processing/worker.ts

import { createDocumentWorker, type QueueJob } from "./db-queue";
import { processDocument } from "./processor";

// Create worker with processor function
const worker = createDocumentWorker(async (job: QueueJob) => {
  await processDocument(job.documentId);
});

// Export for instrumentation
export { worker as documentProcessingWorker };

// Auto-start in production
if (process.env.NODE_ENV === "production") {
  worker.start().catch((err) => {
    console.error("[worker] Failed to start:", err);
  });
}
```

---

## Migration Path (Zero Downtime)

### Phase 1: Add Schema (Non-Breaking)

1. Run migration to add new columns with defaults
2. Backfill existing pending/processing documents
3. Deploy - existing in-memory queue continues working

### Phase 2: Dual-Write (Parallel Operation)

1. Modify `upload-service.ts` to write queue fields
2. Keep in-memory queue active as backup
3. Deploy new worker that polls database
4. Both workers process jobs (with deduplication via locks)

### Phase 3: Cutover

1. Disable in-memory queue
2. Remove old queue code
3. Monitor for 24h
4. Clean up

### Rollback Plan

If issues occur in Phase 2 or 3:
1. Re-enable in-memory queue
2. Kill database worker
3. Jobs in database remain and can be processed later

---

## Failure Scenarios

### Scenario 1: Server Crash Mid-Processing

**Before (In-Memory):**
- Job lost from queue
- Document stuck in `status: 'processing'` 
- Only recovered after 10-minute stale check

**After (Database-Backed):**
- Job has `locked_by` and `locked_at` set
- On restart, `recoverOrphanedJobs()` detects stale lock
- Job resets to `pending` with `attemptCount++`
- Processing resumes automatically

### Scenario 2: Server Restart with Pending Jobs

**Before (In-Memory):**
- All pending jobs lost permanently
- No recovery mechanism

**After (Database-Backed):**
- Jobs remain in database with `status: 'pending'`
- Worker polls and picks them up immediately
- Zero job loss

### Scenario 3: Database Failure

**Before (In-Memory):**
- In-memory queue survives
- But document updates fail anyway
- Inconsistent state

**After (Database-Backed):**
- Queue operations fail
- Upload fails (good - user gets error)
- No partial state

### Scenario 4: Multiple Workers (Horizontal Scale)

**Before (In-Memory):**
- Each instance has separate queue
- Same job could be processed twice
- Race conditions

**After (Database-Backed):**
- `FOR UPDATE SKIP LOCKED` ensures single processor
- `locked_by` identifies which instance owns job
- Clean handoff on instance death

### Scenario 5: Long-Running Job

**Before (In-Memory):**
- No heartbeat mechanism
- Stale check only after 10 minutes

**After (Database-Backed):**
- Progress updates touch `updated_at`
- Can add heartbeat with `locked_at` refresh
- More granular timeout detection

---

## Monitoring and Observability

```typescript
// Health check endpoint addition
export async function getQueueHealth() {
  const stats = await documentQueue.getStats();
  const orphaned = await db.query.uploadedDocuments.findMany({
    where: and(
      eq(uploadedDocuments.status, "processing"),
      lt(uploadedDocuments.lockedAt, new Date(Date.now() - LOCK_TIMEOUT_MS))
    ),
    columns: { id: true },
  });

  return {
    queue: stats,
    orphanedJobs: orphaned.length,
    instanceId: INSTANCE_ID,
    workerRunning: processingInterval !== null,
  };
}
```

**Grafana/Datadog Metrics:**
- `document_queue_pending` - gauge of pending jobs
- `document_queue_processing` - gauge of in-flight jobs
- `document_queue_completed_total` - counter
- `document_queue_failed_total` - counter with `attempt` label
- `document_queue_processing_duration_ms` - histogram

---

## Alternative: Redis-Backed (Option B) - For Reference

If BullMQ compatibility becomes important, here is the Redis approach:

```typescript
// apps/web/src/lib/document-processing/redis-queue.ts

import { redis } from "@/lib/redis/client";

const QUEUE_KEY = "doc-processing:queue";
const PROCESSING_KEY = "doc-processing:processing";
const JOB_PREFIX = "doc-processing:job:";

export const redisQueue = {
  async add(documentId: string): Promise<void> {
    const job = {
      documentId,
      attemptCount: 0,
      queuedAt: Date.now(),
      nextAttemptAt: Date.now(),
    };
    
    await redis.multi()
      .hset(`${JOB_PREFIX}${documentId}`, job)
      .zadd(QUEUE_KEY, Date.now(), documentId)
      .exec();
  },

  async getNextJob(): Promise<QueueJob | null> {
    // Atomic move from queue to processing with Lua script
    const lua = `
      local id = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 1)[1]
      if not id then return nil end
      redis.call('ZREM', KEYS[1], id)
      redis.call('ZADD', KEYS[2], ARGV[1], id)
      return id
    `;
    
    const documentId = await redis.eval(lua, 2, QUEUE_KEY, PROCESSING_KEY, Date.now());
    if (!documentId) return null;
    
    const job = await redis.hgetall(`${JOB_PREFIX}${documentId}`);
    return {
      documentId: documentId as string,
      attemptCount: parseInt(job.attemptCount || "0"),
    };
  },

  async complete(documentId: string): Promise<void> {
    await redis.multi()
      .zrem(PROCESSING_KEY, documentId)
      .del(`${JOB_PREFIX}${documentId}`)
      .exec();
  },

  async fail(documentId: string, error: string): Promise<void> {
    const job = await redis.hgetall(`${JOB_PREFIX}${documentId}`);
    const attemptCount = parseInt(job.attemptCount || "0") + 1;
    
    if (attemptCount < 3) {
      const backoff = 5000 * Math.pow(2, attemptCount - 1);
      const nextAttemptAt = Date.now() + backoff;
      
      await redis.multi()
        .zrem(PROCESSING_KEY, documentId)
        .hset(`${JOB_PREFIX}${documentId}`, { attemptCount, lastError: error })
        .zadd(QUEUE_KEY, nextAttemptAt, documentId)
        .exec();
    } else {
      await redis.multi()
        .zrem(PROCESSING_KEY, documentId)
        .hset(`${JOB_PREFIX}${documentId}`, { status: 'failed', lastError: error })
        .exec();
    }
  },
};
```

**Why not chosen:**
- Adds Redis as critical dependency for queue (currently Redis is optional for caching)
- Requires synchronizing state between Redis queue and PostgreSQL document records
- More complex failure modes (Redis down vs Postgres down)
- Database already has the data we need

---

## Decision

**Implement Option A: Database-Backed Queue**

The `uploadedDocuments` table already tracks processing state. Converting to database-backed polling eliminates the in-memory queue entirely, provides transactional consistency with document updates, and handles all failure scenarios gracefully.

**Next steps:**
1. Create migration for new columns
2. Implement `db-queue.ts` as shown above
3. Update `upload-service.ts` to use database queue
4. Update worker initialization in `instrumentation.ts`
5. Remove old `processing-queue.ts`
