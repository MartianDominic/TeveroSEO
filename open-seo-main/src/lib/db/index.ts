/**
 * Database utilities module.
 *
 * Re-exports transaction utilities, safe query utilities, and other database helpers.
 */

export {
  withTransaction,
  withIdempotency,
  atomicBatch,
  withRetry,
  withTransactionRetry,
  type Transaction,
  type IdempotencyResult,
  type RetryOptions,
} from "./transaction";

export {
  // Identifier validation
  sanitizeIdentifier,
  safeColumn,
  // ORDER BY
  safeOrderBy,
  safeOrderByNulls,
  type SortDirection,
  // LIKE patterns
  safeLikePattern,
  type LikeMatchType,
  // IN clauses
  safeInClause,
  safeNotInClause,
  // WHERE clause builder
  buildWhereClause,
  type WhereCondition,
  // Table whitelist
  createTableWhitelist,
  // Graph name safety
  sanitizeGraphName,
  safeTenantGraphName,
  // Cypher validation
  validateCypherQuery,
  // Array safety
  safeArrayLiteral,
} from "./safe-query";
