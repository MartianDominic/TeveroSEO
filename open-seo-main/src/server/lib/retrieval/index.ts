/**
 * Retrieval module for hierarchical search.
 *
 * Phase 73-03: Retrieval Quality Enhancement
 *
 * This module provides:
 * - Category routing for two-stage hierarchical retrieval
 * - Reranker client for cross-encoder reranking
 *
 * Reference:
 * - .planning/phases/73-infrastructure-optimization/73-03-PLAN.md
 */

export {
  CategoryRouter,
  getCategoryRouter,
  getSharedCategoryRouter,
  type CategoryCentroid,
  type RoutingResult,
  type BuildCentroidsOptions,
  type RouteOptions,
} from "./category-router";

export {
  rerankCandidates,
  isRerankerAvailable,
  warmupReranker,
  type RerankRequest,
  type RerankResponse,
  type RerankerClientOptions,
} from "./reranker-client";
