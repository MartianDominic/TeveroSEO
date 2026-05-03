/**
 * Re-export fetch utilities from @tevero/utils.
 *
 * This file is kept for backwards compatibility.
 * New code should import directly from "@tevero/utils".
 *
 * Timeout guidelines for cross-service consistency:
 * - DEFAULT_TIMEOUT_MS (30s): Normal operations (CRUD, queries)
 * - LONG_RUNNING_TIMEOUT_MS (120s): Audits, content generation, bulk operations
 * - QUICK_CHECK_TIMEOUT_MS (5s): Health checks, feature flags
 */
export {
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
  LONG_RUNNING_TIMEOUT_MS,
  QUICK_CHECK_TIMEOUT_MS,
} from "@tevero/utils";
export type { FetchWithTimeoutOptions } from "@tevero/utils";
