---
phase: 69-data-integrity-performance
plan: 01
subsystem: data-integrity
tags: [transactions, saga, rollback, data-integrity]
dependency_graph:
  requires: []
  provides: [withTransaction, TransactionContext, executeSaga, convertProspectToClient]
  affects: [ProspectService, webhook-delivery]
tech_stack:
  added: []
  patterns: [saga-pattern, post-commit-jobs, row-level-locking]
key_files:
  created:
    - open-seo-main/src/server/lib/db-transaction.ts
    - open-seo-main/src/server/lib/saga.ts
  modified:
    - open-seo-main/src/server/features/prospects/services/ProspectService.ts
decisions:
  - INTERNAL_ERROR code for transaction failures (consistent with existing error codes)
  - PostCommitJob queued but not enqueued until after transaction commits
  - Row-level FOR UPDATE locking to prevent concurrent conversion
  - Saga compensation runs all compensations even if some fail
  - noOpCompensation helper for irreversible operations
metrics:
  duration_seconds: 254
  completed_at: "2026-05-03T22:28:54Z"
  task_count: 3
  file_count: 3
---

# Phase 69 Plan 01: Transaction Wrappers Summary

Standardized transaction handling with rollback safety and saga pattern for cross-service operations.

## One-liner

withTransaction wrapper with post-commit job collection and saga pattern for distributed transactions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create withTransaction Helper | 7da32ad6c | db-transaction.ts |
| 2 | Fix convertProspectToClient Transaction | 779b91a5c | ProspectService.ts, db-transaction.ts |
| 3 | Implement Saga Pattern | 0fff89031 | saga.ts |

## Key Deliverables

### 1. withTransaction Helper (`db-transaction.ts`)

- Wraps Drizzle `db.transaction()` with consistent error handling
- Preserves AppError instances for proper error code propagation
- Wraps unknown errors with descriptive message
- Supports isolation level configuration
- `withTransactionAndContext()` convenience wrapper returns both result and context

### 2. TransactionContext

- Collects post-commit jobs during transaction
- Jobs not enqueued until `enqueuePostCommitJobs()` called after commit
- Prevents webhook workers from processing uncommitted data
- If transaction rolls back, collected jobs are discarded

### 3. convertProspectToClient Method

- All operations in single transaction (fetch, create client, update prospect)
- Row-level `FOR UPDATE` locking prevents concurrent conversion
- Validates prospect exists and not already converted
- Collects webhook job for `client.created` event
- Returns client and post-commit jobs for caller to enqueue

### 4. Saga Pattern (`saga.ts`)

- `executeSaga()` coordinates multi-step distributed operations
- Compensation runs in reverse order on step failure
- Failed compensations logged but don't block other compensations
- `onCompensationFailure` callback for external alerting/DLQ
- `noOpCompensation()` helper for irreversible steps (e.g., sent emails)
- `createSagaStep()` convenience wrapper with structured logging
- `executeSagaWithDLQ()` for dead-letter queue integration

## Usage Examples

### Transaction with Post-Commit Jobs

```typescript
const txContext = new TransactionContext();

const client = await withTransaction(async (tx) => {
  const [created] = await tx.insert(clients).values({...}).returning();
  txContext.addPostCommitJob({
    queue: 'webhooks',
    jobName: 'client.created',
    data: { clientId: created.id },
  });
  return created;
});

// Enqueue AFTER commit succeeds
await enqueuePostCommitJobs(txContext.getPostCommitJobs());
```

### Saga for Cross-Service Operations

```typescript
const result = await executeSaga([
  {
    name: 'reserve-inventory',
    execute: async () => await inventory.reserve(items),
    compensate: async (reservation) => await inventory.release(reservation.id),
  },
  {
    name: 'charge-payment',
    execute: async () => await payments.charge(amount),
    compensate: async (charge) => await payments.refund(charge.id),
  },
  {
    name: 'send-confirmation',
    execute: async () => await email.send(confirmation),
    compensate: noOpCompensation('Email already sent'),
  },
]);

if (!result.success) {
  console.error('Failed at:', result.failedStep);
}
```

## Acceptance Criteria Verification

- [x] withTransaction wraps Drizzle transaction
- [x] Re-throws AppError, wraps others with descriptive error
- [x] TransactionContext collects post-commit jobs
- [x] File exists: open-seo-main/src/server/lib/db-transaction.ts
- [x] All operations in single transaction (convertProspectToClient)
- [x] Webhook jobs collected and enqueued after commit
- [x] Rollback on any failure
- [x] Compensation runs in reverse on saga failure
- [x] Failed compensation invokes onCompensationFailure callback
- [x] Returns success/failure with step info
- [x] File exists: open-seo-main/src/server/lib/saga.ts

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] db-transaction.ts exists at open-seo-main/src/server/lib/db-transaction.ts
- [x] saga.ts exists at open-seo-main/src/server/lib/saga.ts
- [x] ProspectService.ts modified with convertProspectToClient method
- [x] Commit 7da32ad6c exists
- [x] Commit 779b91a5c exists
- [x] Commit 0fff89031 exists
