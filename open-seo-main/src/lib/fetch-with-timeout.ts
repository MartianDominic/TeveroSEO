/**
 * Re-export fetch utilities from @tevero/utils.
 *
 * This file is kept for backwards compatibility.
 * New code should import directly from "@tevero/utils".
 */
export {
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
  LONG_RUNNING_TIMEOUT_MS,
  QUICK_CHECK_TIMEOUT_MS,
} from "@tevero/utils";
export type { FetchWithTimeoutOptions } from "@tevero/utils";
