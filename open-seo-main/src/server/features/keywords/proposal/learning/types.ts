/**
 * Preference Learning Types
 * Phase 86-09: Backfill Pool + Learning
 */

/**
 * Configurable learning thresholds.
 */
export interface LearningConfig {
  /** Minimum edits before learning triggers (default: 3) */
  minEditsToLearn: number;

  /** Confidence threshold for pattern inclusion (default: 0.6) */
  confidenceThreshold: number;

  /** Occurrences needed for max confidence (default: 5) */
  maxConfidenceOccurrences: number;
}

export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  minEditsToLearn: 3,
  confidenceThreshold: 0.6,
  maxConfidenceOccurrences: 5,
};

/**
 * Client preferences learned from edit patterns.
 * Stored in client_preferences table (separate from proposals).
 */
export interface ClientPreferences {
  clientId: string;

  /** Learned exclusion patterns */
  exclusions: ExclusionPattern[];

  /** Funnel stage bias (1.0 = neutral) */
  funnelBias: {
    bofu: number;
    mofu: number;
    tofu: number;
  };

  /** Positioning preference inferred from edits */
  positioning: 'premium' | 'value' | 'professional' | 'neutral';

  /** Cluster topic preferences */
  preferredTopics: string[];
  avoidedTopics: string[];

  /** Learning metadata */
  lastLearnedAt: Date;
  editsSinceLastLearn: number;
  confidenceScore: number;
}

/**
 * Exclusion pattern learned from removed keywords/clusters.
 */
export interface ExclusionPattern {
  /** Pattern type */
  type: 'term' | 'brand' | 'topic' | 'intent';

  /** Pattern value (e.g., "competitor-name", "diy") */
  pattern: string;

  /** Confidence (0-1) based on how often pattern was removed */
  confidence: number;

  /** Number of times this pattern was excluded */
  occurrences: number;

  /** First and last occurrence dates */
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * Learning input from proposal edits.
 */
export interface LearningInput {
  clientId: string;
  edits: EditForLearning[];
}

export interface EditForLearning {
  type: 'remove_cluster' | 'remove_keyword' | 'change_distribution';
  data: {
    clusterLabel?: string;
    keyword?: string;
    funnelStage?: 'bofu' | 'mofu' | 'tofu';
    oldDistribution?: { bofu: number; mofu: number; tofu: number };
    newDistribution?: { bofu: number; mofu: number; tofu: number };
  };
  timestamp: Date;
}

/**
 * Learning result with updated preferences.
 */
export interface LearningResult {
  clientId: string;
  preferences: ClientPreferences;
  patternsLearned: number;
  biasUpdated: boolean;
  triggered: boolean;
}
