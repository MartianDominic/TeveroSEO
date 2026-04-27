/**
 * Idempotency Keys Schema
 *
 * Stores idempotency keys to prevent duplicate operations.
 * Each key has a TTL after which it expires and can be reused.
 *
 * Used by withIdempotency() in lib/db/transaction.ts
 */

import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

/**
 * Table for storing idempotency keys.
 *
 * Primary key is the idempotency key itself (e.g., "change:apply:abc123").
 * Result stores the JSON-serialized return value of the operation.
 * expires_at determines when the key can be reused.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    /** Unique idempotency key (e.g., "payment:order123:100") */
    key: varchar("key", { length: 255 }).primaryKey(),

    /** JSON-serialized result of the operation */
    result: jsonb("result").notNull(),

    /** When this key was created */
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    /** When this key expires and can be reused */
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
      .notNull(),
  },
  (table) => [
    // Index for cleanup queries (DELETE WHERE expires_at < NOW())
    index("idx_idempotency_keys_expires").on(table.expiresAt),
  ]
);

/** Type for SELECT queries */
export type IdempotencyKey = InferSelectModel<typeof idempotencyKeys>;

/** Type for INSERT queries */
export type IdempotencyKeyInsert = InferInsertModel<typeof idempotencyKeys>;
