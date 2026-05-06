/**
 * Clustering Pipeline Types
 * Phase 86: Semantic Intelligence Pipeline
 *
 * Defines types for the semantic clustering pipeline:
 * 1. Deduplication (86-01)
 * 2. HDBSCAN Clustering (86-02)
 * 3. Intent Splitting (86-03)
 * 4. Topic Labeling (86-04)
 * 5. Hierarchy Building (86-05)
 * 6. Cluster Selection (86-06)
 */

import type { FilterResult } from '../filtering/types';

// ============================================================================
// Embedding Constants and Validation
// ============================================================================

/**
 * Expected embedding dimension for jina-v5-text-nano model.
 * All embeddings MUST have this dimension for clustering to work.
 */
export const EMBEDDING_DIMENSION = 768;

/**
 * Embedding validation result.
 */
export interface EmbeddingValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate embedding dimension and values.
 *
 * @param embedding - The embedding vector to validate
 * @param keyword - Keyword for error message context
 * @returns Validation result with error message if invalid
 */
export function validateEmbedding(
  embedding: number[] | undefined,
  keyword: string
): EmbeddingValidationResult {
  if (!embedding) {
    return {
      valid: false,
      error: `Missing embedding for keyword "${keyword}" - cannot include in clustering`,
    };
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    return {
      valid: false,
      error: `Invalid embedding dimension for keyword "${keyword}": ` +
        `expected ${EMBEDDING_DIMENSION} (jina-v5-text-nano), got ${embedding.length}`,
    };
  }

  // Check for NaN/Infinity values
  for (let i = 0; i < embedding.length; i++) {
    if (!Number.isFinite(embedding[i])) {
      return {
        valid: false,
        error: `Invalid embedding value at index ${i} for keyword "${keyword}": ` +
          `got ${embedding[i]} (expected finite number)`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Input Types (from filtering pipeline)
// ============================================================================

/**
 * Input to the clustering pipeline.
 * Contains keyword + embedding + metadata from filtering.
 * IMPORTANT: Embeddings are REUSED from Phase 78 (RelevanceScorer) - NOT recomputed!
 */
export interface ClusteringInput {
  keyword: string;
  embedding: number[];  // 768-dim from jina-v5-text-nano (passed from Phase 78)
  volume: number;
  difficulty: number;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  funnelConfidence: number;
  geoCity: string | null;
  compositeScore: number;
  position?: number | null;
}

/**
 * Result of mapping FilterResult[] to ClusteringInput[].
 * Tracks skipped keywords due to missing/invalid embeddings.
 */
export interface ClusteringInputMappingResult {
  /** Successfully mapped inputs with valid embeddings */
  inputs: ClusteringInput[];
  /** Keywords skipped due to missing or invalid embeddings */
  skipped: Array<{
    keyword: string;
    reason: string;
  }>;
  /** Statistics */
  stats: {
    total: number;
    mapped: number;
    skipped: number;
    skipRate: number;
  };
}

/**
 * Map FilterResult[] to ClusteringInput[] with graceful handling of missing embeddings.
 *
 * Per 86-RESEARCH.md: "if embedding missing, log warning and skip keyword"
 *
 * @param results - FilterResults from Phase 80 (must have embedding field added by Task 0)
 * @returns Mapping result with valid inputs and skipped keywords
 */
export function mapFilterResultsToClusteringInputs(
  results: FilterResult[]
): ClusteringInputMappingResult {
  const inputs: ClusteringInput[] = [];
  const skipped: Array<{ keyword: string; reason: string }> = [];

  for (const result of results) {
    // Only process passed keywords
    if (!result.passed) {
      continue;
    }

    // Validate embedding
    const validation = validateEmbedding(result.embedding, result.keyword);
    if (!validation.valid) {
      skipped.push({
        keyword: result.keyword,
        reason: validation.error!,
      });
      continue;
    }

    // Map to ClusteringInput
    inputs.push({
      keyword: result.keyword,
      embedding: result.embedding!,  // Validated above
      volume: result.volume ?? 0,
      difficulty: result.difficulty ?? 50,  // Default mid-range difficulty
      funnelStage: result.classification?.funnelStage ?? 'mofu',
      funnelConfidence: result.classification?.relevanceScore ?? 0.5,
      geoCity: result.classification?.geoCity ?? null,
      compositeScore: result.compositeScore?.finalScore ?? 0,
      position: null,  // Position comes from GSC data, not FilterResult
    });
  }

  const total = results.filter(r => r.passed).length;
  return {
    inputs,
    skipped,
    stats: {
      total,
      mapped: inputs.length,
      skipped: skipped.length,
      skipRate: total > 0 ? skipped.length / total : 0,
    },
  };
}

// ============================================================================
// Deduplication Types (86-01)
// ============================================================================

/**
 * Configuration for semantic deduplication.
 */
export interface DeduplicationConfig {
  /**
   * Cosine similarity threshold for merging.
   * Default: 0.92 (empirically tuned for Lithuanian SEO keywords)
   */
  similarityThreshold: number;

  /**
   * Strategy for selecting canonical keyword.
   * - 'highest_volume': Keep the variant with highest search volume
   * - 'shortest': Keep the shortest variant (simpler form)
   * - 'first': Keep the first occurrence
   */
  canonicalStrategy: 'highest_volume' | 'shortest' | 'first';
}

export const DEFAULT_DEDUP_CONFIG: DeduplicationConfig = {
  similarityThreshold: 0.92,
  canonicalStrategy: 'highest_volume',
};

/**
 * A keyword that was merged from multiple near-duplicates.
 */
export interface MergedKeyword extends ClusteringInput {
  /**
   * Original variants that were merged into this canonical.
   */
  mergedFrom: string[];

  /**
   * Combined volume from all variants.
   */
  combinedVolume: number;

  /**
   * Average difficulty from all variants.
   */
  averageDifficulty: number;

  /**
   * Number of variants merged (including canonical).
   */
  variantCount: number;
}

/**
 * Result of semantic deduplication.
 */
export interface DeduplicationResult {
  /**
   * Keywords after deduplication (canonical forms).
   */
  canonicals: ClusteringInput[];

  /**
   * Map from merged keyword -> canonical keyword.
   * Includes self-mapping for canonicals.
   */
  mergeMap: Map<string, string>;

  /**
   * Merged keywords with variant metadata.
   */
  merged: MergedKeyword[];

  /**
   * Statistics about deduplication.
   */
  stats: DeduplicationStats;
}

export interface DeduplicationStats {
  inputCount: number;
  outputCount: number;
  mergedCount: number;
  reductionPercent: number;
  processingTimeMs: number;
  /** Count of keywords skipped due to invalid embeddings (should be 0 if pre-validated) */
  skippedInvalidEmbeddings: number;
}

// ============================================================================
// Clustering Types (86-02)
// ============================================================================

/**
 * Configuration for HDBSCAN clustering.
 */
export interface ClusteringConfig {
  /**
   * Minimum cluster size for HDBSCAN.
   * Default: 3
   */
  minClusterSize: number;

  /**
   * Minimum samples for core point.
   * Default: 2
   */
  minSamples: number;

  /**
   * UMAP target dimensions for clustering.
   * Default: 15 (from 768D)
   */
  umapDimensions: number;

  /**
   * UMAP target dimensions for visualization.
   * Default: 2 (for scatter plot)
   */
  umapVisDimensions: number;
}

export const DEFAULT_CLUSTERING_CONFIG: ClusteringConfig = {
  minClusterSize: 3,
  minSamples: 2,
  umapDimensions: 15,
  umapVisDimensions: 2,
};

/**
 * A semantic cluster of keywords.
 */
export interface KeywordCluster {
  /**
   * Unique cluster ID (0-indexed, -1 for noise).
   */
  clusterId: number;

  /**
   * Keywords in this cluster.
   */
  keywords: ClusteringInput[];

  /**
   * Cluster centroid (768-dim embedding from jina-v5-text-nano).
   */
  centroid: number[];

  /**
   * 2D coordinates for visualization (UMAP projection).
   */
  visCoords?: { x: number; y: number };

  /**
   * Total search volume across all keywords.
   */
  totalVolume: number;

  /**
   * Average difficulty across all keywords.
   */
  averageDifficulty: number;

  /**
   * Dominant funnel stage in this cluster.
   */
  dominantFunnel: 'bofu' | 'mofu' | 'tofu';

  /**
   * Funnel distribution within cluster.
   */
  funnelBreakdown: { bofu: number; mofu: number; tofu: number };
}

/**
 * Result of HDBSCAN clustering.
 */
export interface ClusteringResult {
  /**
   * Clusters found by HDBSCAN.
   */
  clusters: KeywordCluster[];

  /**
   * Keywords that didn't fit any cluster (noise).
   */
  noise: ClusteringInput[];

  /**
   * Clustering statistics.
   */
  stats: ClusteringStats;
}

export interface ClusteringStats {
  inputCount: number;
  clusterCount: number;
  noiseCount: number;
  avgClusterSize: number;
  processingTimeMs: number;
}

// ============================================================================
// Intent Splitting Types (86-03)
// ============================================================================

/**
 * Configuration for intent-based cluster splitting.
 */
export interface IntentSplitConfig {
  /**
   * Funnel variance threshold for splitting.
   * If a cluster has >20% variance in funnel stages, split it.
   * Default: 0.2
   */
  funnelVarianceThreshold: number;
}

export const DEFAULT_INTENT_SPLIT_CONFIG: IntentSplitConfig = {
  funnelVarianceThreshold: 0.2,
};

// ============================================================================
// Topic Labeling Types (86-04)
// ============================================================================

/**
 * Configuration for cluster labeling.
 */
export interface LabelingConfig {
  /**
   * Labeling method to use.
   * - 'centroid_nearest': Label from nearest keyword to centroid (fast, free)
   * - 'ngram': Most frequent n-gram in cluster (fast, free)
   * - 'llm': LLM summarization (best quality, ~$0.03/analysis)
   * - 'auto': Try centroid_nearest first, fall back to LLM if confidence < threshold
   */
  method: 'centroid_nearest' | 'ngram' | 'llm' | 'auto';
  /**
   * LLM fallback threshold for 'auto' mode.
   * Use LLM if confidence < this value.
   * Default: 0.6
   */
  llmFallbackThreshold?: number;
  /**
   * Grok API key for LLM labeling.
   * Required if method is 'llm' or 'auto'.
   */
  grokApiKey?: string;
}

export const DEFAULT_LABELING_CONFIG: LabelingConfig = {
  method: 'auto',  // centroid_nearest primary, LLM fallback
  llmFallbackThreshold: 0.6,
};

/**
 * A labeled cluster with topic metadata.
 */
export interface LabeledCluster extends KeywordCluster {
  /**
   * Lithuanian label for the cluster.
   */
  labelLt: string;

  /**
   * English label for the cluster.
   */
  labelEn: string;

  /**
   * Suggested URL slug for this topic.
   */
  suggestedUrl: string;

  /**
   * Labeling confidence (0-1).
   */
  labelConfidence: number;

  /**
   * Method used to generate the label.
   */
  labelMethod: 'centroid_nearest' | 'ngram' | 'llm';
}

// ============================================================================
// Hierarchy Types (86-05)
// ============================================================================

/**
 * Hierarchy tier based on volume and keyword count.
 */
export type HierarchyTier = 'pillar' | 'subtopic' | 'longtail';

/**
 * Thresholds for hierarchy classification.
 */
export interface HierarchyThresholds {
  /**
   * Minimum volume for pillar tier.
   * Default: 10000
   */
  pillarMinVolume: number;

  /**
   * Minimum keyword count for pillar tier.
   * Default: 15
   */
  pillarMinKeywords: number;

  /**
   * Minimum volume for subtopic tier.
   * Default: 2000
   */
  subtopicMinVolume: number;

  /**
   * Minimum centroid similarity for parent-child linking.
   * Default: 0.7
   */
  parentSimilarityThreshold: number;

  /**
   * Longtail is anything below subtopic threshold.
   */
}

export const DEFAULT_HIERARCHY_THRESHOLDS: HierarchyThresholds = {
  pillarMinVolume: 10000,
  pillarMinKeywords: 15,
  subtopicMinVolume: 2000,
  parentSimilarityThreshold: 0.7,
};

/**
 * A cluster with hierarchy tier and parent relationship.
 */
export interface HierarchicalCluster extends LabeledCluster {
  /**
   * Hierarchy tier (pillar, subtopic, longtail).
   */
  tier: HierarchyTier;

  /**
   * Parent cluster ID (null for pillars).
   */
  parentId: number | null;

  /**
   * Child cluster IDs (for pillars and subtopics).
   */
  childIds: number[];
}

/**
 * Complete hierarchy tree.
 */
export interface ClusterHierarchy {
  /**
   * All clusters with hierarchy metadata.
   */
  clusters: HierarchicalCluster[];

  /**
   * Pillar clusters (top-level).
   */
  pillars: HierarchicalCluster[];

  /**
   * Statistics about the hierarchy.
   */
  stats: HierarchyStats;
}

export interface HierarchyStats {
  pillarCount: number;
  subtopicCount: number;
  longtailCount: number;
  avgChildrenPerPillar: number;
}

// ============================================================================
// Cluster Selection Types (86-06)
// ============================================================================

/**
 * Funnel distribution targets for proposal generation.
 * Defines the desired mix of keywords by funnel stage.
 */
export interface FunnelDistribution {
  bofu: number;  // Bottom-of-funnel percentage (0-1)
  mofu: number;  // Middle-of-funnel percentage (0-1)
  tofu: number;  // Top-of-funnel percentage (0-1)
}

/**
 * Configuration for cluster-based keyword selection.
 */
export interface ClusterSelectionConfig {
  /**
   * Target number of keywords to select.
   * Default: 100
   */
  targetCount: number;

  /**
   * Backfill pool size (extra keywords for editing).
   * Default: 200
   */
  backfillPoolSize: number;

  /**
   * Minimum clusters to include for diversity.
   * Default: 5
   */
  minClusters: number;
}

export const DEFAULT_SELECTION_CONFIG: ClusterSelectionConfig = {
  targetCount: 100,
  backfillPoolSize: 200,
  minClusters: 5,
};

/**
 * A scored cluster for selection ranking.
 */
export interface ScoredCluster extends HierarchicalCluster {
  /**
   * Cluster rankability score (0-1).
   * Based on difficulty, quick-win potential, volume.
   */
  rankabilityScore: number;

  /**
   * Keywords selected from this cluster.
   */
  selectedKeywords: ClusteringInput[];

  /**
   * Keywords in backfill pool from this cluster.
   */
  backfillKeywords: ClusteringInput[];
}

/**
 * Result of cluster-based selection.
 */
export interface ClusterSelectionResult {
  /**
   * Selected keywords (target count).
   */
  selected: ClusteringInput[];

  /**
   * Backfill pool for editing.
   */
  backfillPool: ClusteringInput[];

  /**
   * Scored clusters with selection metadata.
   */
  scoredClusters: ScoredCluster[];

  /**
   * Selection statistics.
   */
  stats: ClusterSelectionStats;
}

export interface ClusterSelectionStats {
  selectedCount: number;
  backfillCount: number;
  clustersUsed: number;
  avgClusterScore: number;
}
