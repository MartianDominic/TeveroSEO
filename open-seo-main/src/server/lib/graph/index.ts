/**
 * Graph Database Module
 * Phase 65: GraphRAG Foundation
 *
 * Exports FalkorDB client, TenantGraphManager, graph schema,
 * and product catalog schema for per-tenant GraphRAG.
 */

// Graph schema and types (Phase 65)
export * from "./graph-schema";

// Legacy client (kept for backwards compatibility)
export {
  FalkorDBClient,
  createFalkorDBClient,
  getDefaultFalkorDBClient,
  closeDefaultFalkorDBClient,
  type FalkorDBClientOptions,
} from "./falkordb-client";

// New tenant manager (recommended for new code)
export {
  TenantGraphManager,
  getTenantGraphManager,
  closeTenantGraphManager,
  type TenantGraphManagerOptions,
  type HybridSearchResult,
  type HybridSearchOptions,
} from "./tenant-graph-manager";

// Product catalog schema (existing)
export * from "./product-catalog-schema";
