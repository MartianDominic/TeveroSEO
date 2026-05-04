/**
 * Cascade Selection Types
 * Phase 80-01: BOFU-first keyword selection with configurable fallback
 *
 * Defines types for intelligent keyword selection that prioritizes BOFU keywords,
 * respects min/max constraints per funnel stage, and falls back to MOFU/TOFU
 * when BOFU is exhausted.
 */

/**
 * Funnel stage classification
 */
export type FunnelStage = 'bofu' | 'mofu' | 'tofu';

/**
 * Stage configuration with min/max constraints and priority
 */
export interface StageConfig {
  /** Minimum keywords required from this stage */
  min: number;
  /** Maximum keywords allowed from this stage */
  max: number;
  /** Selection priority (1 = highest, 3 = lowest) */
  priority: 1 | 2 | 3;
}

/**
 * Cascade selection configuration
 */
export interface CascadeConfig {
  /** Target total number of keywords to select */
  targetCount: number;

  /** Per-stage configuration */
  stages: {
    bofu: StageConfig;
    mofu: StageConfig;
    tofu: StageConfig;
  };

  /** If true, can exceed targetCount to meet stage minimums */
  allowOverflow: boolean;

  /** If true, never exceed stage max even if target not met */
  strictMax: boolean;
}

/**
 * Selected keyword with cascade metadata
 */
export interface SelectedKeyword {
  /** Keyword text */
  keyword: string;

  /** Funnel stage classification */
  funnelStage: FunnelStage;

  /** Composite score from prioritization */
  compositeScore: number;

  /** 1-based position in cascade selection order */
  cascadePosition: number;

  /** Metrics used for selection */
  metrics: {
    volume: number;
    difficulty: number;
    position?: number;
  };
}

/**
 * Exclusion reasons for keywords not selected
 */
export type ExclusionReason =
  | 'cascade_overflow'      // Excluded because target was already reached
  | 'stage_max_reached'     // Excluded because stage maximum was hit
  | 'target_reached';       // Excluded because overall target was met

/**
 * Excluded keyword with metadata
 */
export interface ExcludedKeyword {
  /** Keyword text */
  keyword: string;

  /** Funnel stage classification */
  funnelStage: FunnelStage;

  /** Composite score from prioritization */
  compositeScore: number;

  /** Reason for exclusion */
  exclusionReason: ExclusionReason;

  /** Position when excluded (for debugging) */
  cascadePosition: number;
}

/**
 * Per-stage breakdown in selection result
 */
export interface StageBreakdown {
  /** Number of keywords selected from this stage */
  count: number;

  /** Percentage of total selection */
  percentage: number;

  /** Total keywords available in this stage's pool */
  poolSize: number;
}

/**
 * Breakdown of selection by funnel stage
 */
export interface SelectionBreakdown {
  /** Total keywords selected */
  total: number;

  /** BOFU stage breakdown */
  bofu: StageBreakdown;

  /** MOFU stage breakdown */
  mofu: StageBreakdown;

  /** TOFU stage breakdown */
  tofu: StageBreakdown;

  /** Whether target count was reached */
  meetsTarget: boolean;

  /** Whether all stage minimums were met */
  meetsMinimums: boolean;

  /** Warning messages for unmet constraints */
  warnings: string[];
}

/**
 * Complete selection result
 */
export interface SelectionResult {
  /** Keywords selected for the campaign */
  selected: SelectedKeyword[];

  /** Keywords excluded from selection */
  excluded: ExcludedKeyword[];

  /** Breakdown by funnel stage */
  breakdown: SelectionBreakdown;

  /** Configuration used for selection */
  config: CascadeConfig;

  /** Metadata about the selection process */
  metadata: {
    /** Total keywords in input */
    totalInput: number;

    /** Keywords that passed filters */
    passedFilters: number;

    /** Final selected count */
    selectedCount: number;

    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
}
