/**
 * CascadeSelector - BOFU-first keyword selection with configurable fallback
 * Phase 80-01: Intelligent cascade selection replacing naive slice(0, N)
 *
 * Algorithm:
 * 1. Group keywords by funnel stage (BOFU, MOFU, TOFU)
 * 2. Sort each pool by composite score (descending)
 * 3. Select from BOFU first (priority 1) up to stage max
 * 4. Fill remaining from MOFU (priority 2) up to stage max
 * 5. Fill remaining from TOFU (priority 3) up to stage max
 * 6. Enforce min/max constraints and generate warnings
 */

import type {
  CascadeConfig,
  SelectionResult,
  SelectedKeyword,
  ExcludedKeyword,
  SelectionBreakdown,
  FunnelStage,
  ExclusionReason,
} from './types';
import { DEFAULT_CASCADE } from './presets';

/**
 * FilteredKeyword interface (from Phase 79 - mocked for now)
 */
interface FilteredKeyword {
  keyword: string;
  funnelStage: FunnelStage;
  compositeScore: number;
  metrics: {
    volume: number;
    difficulty: number;
    position?: number;
  };
}

/**
 * CascadeSelector - Intelligent keyword selection service
 */
export class CascadeSelector {
  /**
   * Select keywords using BOFU-first cascade with configurable fallback
   *
   * @param keywords - Filtered keywords from Phase 79
   * @param config - Cascade configuration (defaults to DEFAULT_CASCADE)
   * @returns Selection result with selected, excluded, breakdown, and metadata
   */
  select(
    keywords: FilteredKeyword[],
    config: CascadeConfig = DEFAULT_CASCADE
  ): SelectionResult {
    const startTime = performance.now();

    // Handle empty input
    if (keywords.length === 0) {
      return this.createEmptyResult(config, startTime);
    }

    // Validate config (Threat T-80-02: config tampering)
    this.validateConfig(config);

    // Cap input size (Threat T-80-01: DoS protection)
    const cappedKeywords = keywords.slice(0, 10000);
    if (keywords.length > 10000) {
      console.warn(
        `CascadeSelector: Input capped at 10,000 keywords (received ${keywords.length})`
      );
    }

    // Group by stage and sort by score
    const pools = this.groupByStage(cappedKeywords);

    // Cascade selection
    const selected: SelectedKeyword[] = [];
    const excluded: ExcludedKeyword[] = [];
    let cascadePosition = 1;
    let remaining = config.targetCount;

    // Stage selection order by priority
    const stages: Array<{ stage: FunnelStage; config: typeof config.stages.bofu }> = ([
      { stage: 'bofu' as FunnelStage, config: config.stages.bofu },
      { stage: 'mofu' as FunnelStage, config: config.stages.mofu },
      { stage: 'tofu' as FunnelStage, config: config.stages.tofu },
    ] as Array<{ stage: FunnelStage; config: typeof config.stages.bofu }>).sort((a, b) => a.config.priority - b.config.priority);

    // Select from each stage in priority order
    for (const { stage, config: stageConfig } of stages) {
      const pool = pools[stage];
      const take = Math.min(pool.length, stageConfig.max, remaining);
      const remainingBeforeStage = remaining;

      // Determine what limited the take value
      const limitedByRemaining = remaining < pool.length && remaining <= stageConfig.max;

      // Select top keywords from this stage
      for (let i = 0; i < pool.length; i++) {
        const kw = pool[i];
        if (i < take) {
          selected.push({
            keyword: kw.keyword,
            funnelStage: kw.funnelStage,
            compositeScore: kw.compositeScore,
            cascadePosition: cascadePosition++,
            metrics: kw.metrics,
          });
        } else {
          // Exclude remaining keywords from this stage
          let reason: ExclusionReason;
          if (remainingBeforeStage <= 0) {
            // Target was already met before this stage
            reason = 'cascade_overflow';
          } else if (limitedByRemaining) {
            // Target reached during this stage (remaining was the limiting factor)
            reason = 'target_reached';
          } else if (i >= stageConfig.max) {
            // Hit stage maximum
            reason = 'stage_max_reached';
          } else {
            // Shouldn't reach here, but default to stage_max_reached
            reason = 'stage_max_reached';
          }

          excluded.push({
            keyword: kw.keyword,
            funnelStage: kw.funnelStage,
            compositeScore: kw.compositeScore,
            exclusionReason: reason,
            cascadePosition: cascadePosition++,
          });
        }
      }

      remaining -= take;
      if (remaining <= 0) remaining = 0;
    }

    // Compute breakdown
    const breakdown = this.computeBreakdown(selected, pools, config);

    // Build result
    const processingTimeMs = performance.now() - startTime;
    return {
      selected,
      excluded,
      breakdown,
      config,
      metadata: {
        totalInput: keywords.length,
        passedFilters: keywords.length,
        selectedCount: selected.length,
        processingTimeMs,
      },
    };
  }

  /**
   * Group keywords by funnel stage and sort by composite score (descending)
   */
  private groupByStage(keywords: FilteredKeyword[]): Record<
    FunnelStage,
    FilteredKeyword[]
  > {
    const pools: Record<FunnelStage, FilteredKeyword[]> = {
      bofu: [],
      mofu: [],
      tofu: [],
    };

    for (const kw of keywords) {
      pools[kw.funnelStage].push(kw);
    }

    // Sort each pool by composite score (descending)
    for (const stage of ['bofu', 'mofu', 'tofu'] as FunnelStage[]) {
      pools[stage].sort((a, b) => b.compositeScore - a.compositeScore);
    }

    return pools;
  }

  /**
   * Compute selection breakdown with warnings
   */
  private computeBreakdown(
    selected: SelectedKeyword[],
    pools: Record<FunnelStage, FilteredKeyword[]>,
    config: CascadeConfig
  ): SelectionBreakdown {
    const total = selected.length;
    const warnings: string[] = [];

    // Per-stage breakdown
    const stageCounts = {
      bofu: selected.filter((k) => k.funnelStage === 'bofu').length,
      mofu: selected.filter((k) => k.funnelStage === 'mofu').length,
      tofu: selected.filter((k) => k.funnelStage === 'tofu').length,
    };

    // Check minimums
    let meetsMinimums = true;
    for (const stage of ['bofu', 'mofu', 'tofu'] as FunnelStage[]) {
      const stageConfig = config.stages[stage];
      const count = stageCounts[stage];
      const poolSize = pools[stage].length;

      // Only warn if we didn't meet minimum when pool had enough keywords
      if (count < stageConfig.min && poolSize < stageConfig.min) {
        meetsMinimums = false;
        warnings.push(
          `${stage.toUpperCase()} minimum (${stageConfig.min}) not met: only ${poolSize} available`
        );
      }
    }

    // Check target
    const meetsTarget = total >= config.targetCount;
    if (!meetsTarget) {
      warnings.push(
        `Target (${config.targetCount}) not reached: only ${total} selected within stage constraints`
      );
    }

    return {
      total,
      bofu: {
        count: stageCounts.bofu,
        percentage: total > 0 ? stageCounts.bofu / total : 0,
        poolSize: pools.bofu.length,
      },
      mofu: {
        count: stageCounts.mofu,
        percentage: total > 0 ? stageCounts.mofu / total : 0,
        poolSize: pools.mofu.length,
      },
      tofu: {
        count: stageCounts.tofu,
        percentage: total > 0 ? stageCounts.tofu / total : 0,
        poolSize: pools.tofu.length,
      },
      meetsTarget,
      meetsMinimums,
      warnings,
    };
  }

  /**
   * Create empty result for zero input
   */
  private createEmptyResult(
    config: CascadeConfig,
    startTime: number
  ): SelectionResult {
    return {
      selected: [],
      excluded: [],
      breakdown: {
        total: 0,
        bofu: { count: 0, percentage: 0, poolSize: 0 },
        mofu: { count: 0, percentage: 0, poolSize: 0 },
        tofu: { count: 0, percentage: 0, poolSize: 0 },
        meetsTarget: false,
        meetsMinimums: false,
        warnings: ['No keywords provided for selection'],
      },
      config,
      metadata: {
        totalInput: 0,
        passedFilters: 0,
        selectedCount: 0,
        processingTimeMs: performance.now() - startTime,
      },
    };
  }

  /**
   * Validate cascade configuration (Threat T-80-02)
   */
  private validateConfig(config: CascadeConfig): void {
    if (config.targetCount <= 0) {
      throw new Error('CascadeConfig.targetCount must be > 0');
    }

    for (const stage of ['bofu', 'mofu', 'tofu'] as FunnelStage[]) {
      const stageConfig = config.stages[stage];
      if (stageConfig.min < 0) {
        throw new Error(`${stage}.min must be >= 0`);
      }
      if (stageConfig.max < stageConfig.min) {
        throw new Error(`${stage}.max must be >= ${stage}.min`);
      }
      if (![1, 2, 3].includes(stageConfig.priority)) {
        throw new Error(`${stage}.priority must be 1, 2, or 3`);
      }
    }
  }
}

/**
 * Singleton export for convenience
 */
export const cascadeSelector = new CascadeSelector();
