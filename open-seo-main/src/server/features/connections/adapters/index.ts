/**
 * Platform Adapters Barrel Export
 * Phase 31-03: Platform Adapters
 *
 * Re-exports all adapter types and implementations.
 */

// Base types
export type {
  PlatformAdapter,
  CapabilityResult,
  WordPressAdapterConfig,
  ShopifyAdapterConfig,
  WixAdapterConfig,
  SquarespaceAdapterConfig,
  WebflowAdapterConfig,
  AdapterFactory,
} from "./BaseAdapter";

// Implementations
export { WordPressAdapter } from "./WordPressAdapter";
export { ShopifyAdapter } from "./ShopifyAdapter";
export { WixAdapter } from "./WixAdapter";
export { SquarespaceAdapter } from "./SquarespaceAdapter";
export { WebflowAdapter } from "./WebflowAdapter";
