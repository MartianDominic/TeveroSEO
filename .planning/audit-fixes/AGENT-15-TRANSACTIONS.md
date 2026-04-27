# Agent 15: Transaction Safety

## Summary

Fixed transaction safety issues across the codebase by implementing transaction utilities, adding idempotency key support, and wrapping multi-step database operations in atomic transactions.

## Issues Fixed

- [x] HIGH: Created transaction utilities with auto-rollback (`withTransaction`)
- [x] HIGH: Fixed ChangeService.ts full transaction coverage
- [x] HIGH: Added idempotency key support (`withIdempotency`)
- [x] HIGH: Created idempotency_keys table migration
- [x] HIGH: Fixed signing.ts `handleSigningCompletion` transaction coverage
- [x] Added retry logic for transient DB errors (`withRetry`)
- [x] Added combined transaction + retry utility (`withTransactionRetry`)
- [x] Added atomic batch operation utility (`atomicBatch`)

## Files Created

| File | Purpose |
|------|---------|
| `open-seo-main/src/lib/db/transaction.ts` | Transaction utilities with auto-rollback, idempotency, retry |
| `open-seo-main/src/lib/db/index.ts` | Module exports for transaction utilities |
| `open-seo-main/src/db/idempotency-schema.ts` | Drizzle schema for idempotency_keys table |
| `open-seo-main/src/db/migrations/0032_add_idempotency_keys.ts` | Drizzle migration for idempotency_keys |
| `open-seo-main/src/db/migrations/add_idempotency_keys.sql` | Raw SQL migration for manual execution |

## Files Modified

| File | Changes |
|------|---------|
| `open-seo-main/src/db/schema.ts` | Added export for idempotency-schema |
| `open-seo-main/src/server/features/changes/services/ChangeService.ts` | Wrapped applyChange in transaction + idempotency |
| `open-seo-main/src/server/features/proposals/signing/signing.ts` | Wrapped handleSigningCompletion in transaction + idempotency |

## Transaction Utilities

### `withTransaction<T>(operation: (tx) => Promise<T>): Promise<T>`

Executes operation within a database transaction with automatic rollback on error.

```typescript
const result = await withTransaction(async (tx) => {
  await tx.insert(users).values({ name: 'John' });
  await tx.insert(profiles).values({ userId: 1 });
  return { success: true };
});
```

### `withIdempotency<T>(key, operation, ttlSeconds): Promise<{ result: T; cached: boolean }>`

Prevents duplicate operations using idempotency keys with configurable TTL.

```typescript
const { result, cached } = await withIdempotency(
  `payment:order:${orderId}`,
  () => processPayment(orderId),
  3600 // 1 hour TTL
);
```

### `withRetry<T>(operation, options): Promise<T>`

Retries operation with exponential backoff on transient database errors (serialization failures, deadlocks).

```typescript
const result = await withRetry(
  () => updateBalance(accountId, amount),
  { maxRetries: 5, baseDelayMs: 200 }
);
```

### `withTransactionRetry<T>(operation, retryOptions): Promise<T>`

Combines transaction and retry for maximum safety.

```typescript
const result = await withTransactionRetry(async (tx) => {
  const balance = await tx.query.accounts.findFirst({...});
  await tx.update(accounts).set({ balance: balance - amount });
  return { newBalance: balance - amount };
});
```

### `atomicBatch<T>(operations): Promise<T>`

Executes multiple operations atomically - all succeed or all fail.

```typescript
const [user, profile] = await atomicBatch([
  () => createUser({ name: 'John' }),
  () => createProfile({ bio: 'Hello' }),
]);
```

## Transaction Guarantees

| Guarantee | Implementation |
|-----------|----------------|
| Atomicity | All operations in `withTransaction` succeed or all are rolled back |
| Idempotency | `withIdempotency` prevents duplicate operations with same key |
| Retry on transient errors | `withRetry` handles serialization failures and deadlocks |
| Full coverage | Multi-step operations wrapped in single transaction |

## Idempotency Keys Table

```sql
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);
```

## Migration Instructions

### Option 1: Drizzle Migration

```bash
cd open-seo-main
pnpm drizzle-kit push
```

### Option 2: Raw SQL

```bash
psql -d open_seo -f src/db/migrations/add_idempotency_keys.sql
```

## Cleanup Job

Set up a periodic job to clean expired idempotency keys:

```sql
-- Run hourly via pg_cron or external scheduler
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

## Before/After Comparison

### Before (ChangeService.ts line 132)

```typescript
// PROBLEM: Transaction only covers the status update, not the full operation
await insertChange(changeRecord);  // Outside transaction
const result = await handler(adapter, context);  // Outside transaction
await db.transaction(async (tx) => {
  await tx.update(siteChanges).set({...});  // Only this is transactional
});
```

### After

```typescript
// FIXED: Entire operation wrapped in transaction with idempotency
const { result, cached } = await withIdempotency(
  idempotencyKey,
  () => withRetry(() => withTransaction(async (tx) => {
    await tx.insert(siteChanges).values(changeRecord);
    const recipeResult = await handler(adapter, context);
    await tx.update(siteChanges).set({...});
    return { success: true, changeId, recipeResult };
  }))
);
```

## Retryable Errors

The `withRetry` utility automatically retries on these PostgreSQL error codes:

| Code | Name | Description |
|------|------|-------------|
| 40001 | SERIALIZATION_FAILURE | Transaction conflict due to concurrent modification |
| 40P01 | DEADLOCK_DETECTED | Deadlock between transactions |

## Security Considerations

- Idempotency keys include client/resource context to prevent cross-tenant collisions
- Keys expire after 24 hours by default (configurable)
- Results stored in JSONB, no sensitive data should be included

## Testing

Unit tests should mock the transaction utilities:

```typescript
vi.mock('@/lib/db/transaction', () => ({
  withTransaction: vi.fn((fn) => fn(mockTx)),
  withIdempotency: vi.fn((key, fn) => fn().then(result => ({ result, cached: false }))),
  withRetry: vi.fn((fn) => fn()),
}));
```
