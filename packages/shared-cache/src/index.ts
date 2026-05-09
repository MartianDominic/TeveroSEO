/**
 * @tevero/shared-cache
 *
 * Shared cache invalidation types and utilities.
 * Used across all TeveroSEO services for unified pub/sub invalidation.
 */

export {
  UNIFIED_INVALIDATION_CHANNEL,
  generateInstanceId,
  matchesPattern,
  type CacheType,
  type UnifiedInvalidationMessage,
  type InvalidationHandler,
} from "./invalidation-types";
