/**
 * Clustering Pipeline Exports
 * Phase 86: Semantic Intelligence Pipeline
 *
 * This module provides semantic clustering capabilities:
 * - Deduplication (86-01): Merge near-duplicate keywords using cosine similarity
 * - HDBSCAN Clustering (86-02): Group keywords into semantic clusters
 * - Intent Splitting (86-03): Split mixed-funnel clusters
 * - Topic Labeling (86-04): Generate labels for clusters
 * - Hierarchy Building (86-05): Build pillar/subtopic/longtail tree
 * - Cluster Selection (86-06): Score and select keywords
 */

// Types and validation
export {
  // Constants
  EMBEDDING_DIMENSION,

  // Validation
  validateEmbedding,
  mapFilterResultsToClusteringInputs,
  type EmbeddingValidationResult,
  type ClusteringInputMappingResult,

  // Core types
  type ClusteringInput,
  type ClusteringConfig,
  type ClusteringResult,
  type ClusteringStats,
  type KeywordCluster,

  // Deduplication types
  type DeduplicationConfig,
  type DeduplicationResult,
  type DeduplicationStats,
  type MergedKeyword,
  DEFAULT_DEDUP_CONFIG,

  // Clustering config
  DEFAULT_CLUSTERING_CONFIG,

  // Intent splitting types
  type IntentSplitConfig,
  DEFAULT_INTENT_SPLIT_CONFIG,

  // Labeling types
  type LabelingConfig,
  type LabeledCluster,
  DEFAULT_LABELING_CONFIG,

  // Hierarchy types
  type HierarchyTier,
  type HierarchyThresholds,
  type HierarchicalCluster,
  type ClusterHierarchy,
  type HierarchyStats,
  DEFAULT_HIERARCHY_THRESHOLDS,

  // Selection types
  type ClusterSelectionConfig,
  type ClusterSelectionResult,
  type ClusterSelectionStats,
  type ScoredCluster,
  DEFAULT_SELECTION_CONFIG,
} from './types';

// Services
export { SemanticDeduplicator, deduplicate } from './SemanticDeduplicator';
export { HDBSCANClusterer, clusterKeywords } from './HDBSCANClusterer';
