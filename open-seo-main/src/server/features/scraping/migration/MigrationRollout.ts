/**
 * MigrationRollout - Controlled Feature Migration
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Manages gradual rollout of scraping features:
 * - State machine for migration progression
 * - Criteria-based advancement checks
 * - Rollback capability
 * - Full status dashboard
 * - Metrics tracking
 */

import {
  type MigrationState,
  type ScrapingFeature,
  MIGRATION_ORDER,
  VALID_MIGRATION_STATES,
  loadMigrationFlagsCached,
} from '../config';
import { redis, REDIS_SERVICE_PREFIX } from '@/server/lib/redis';
import { migrationLogger } from '../logging';

// =============================================================================
// Types
// =============================================================================

/**
 * Criteria for advancing to the next migration state.
 */
export interface RolloutCriteria {
  /** Minimum shadow mode match rate (%) - results must match legacy */
  minShadowMatchRate?: number;
  /** Maximum error rate allowed (%) */
  maxErrorRate?: number;
  /** Minimum requests before advancing */
  minRequestCount?: number;
  /** Minimum hours at current state */
  durationHours?: number;
}

/**
 * Metrics for evaluating rollout readiness.
 */
export interface RolloutMetrics {
  /** Shadow mode result match rate (0-100) */
  shadowMatchRate: number;
  /** Error rate (0-100) */
  errorRate: number;
  /** Total requests at current state */
  requestCount: number;
  /** Hours at current state */
  hoursInState: number;
  /** Timestamp when state was entered */
  stateEnteredAt?: Date;
  /** Last error message */
  lastError?: string;
}

/**
 * Result of checking rollout readiness.
 */
export interface RolloutReadinessCheck {
  /** Whether feature is ready to advance */
  ready: boolean;
  /** Current migration state */
  currentState: MigrationState;
  /** Next state (if ready) */
  nextState?: MigrationState;
  /** Criteria for current state */
  criteria: RolloutCriteria;
  /** Current metrics */
  metrics: RolloutMetrics;
  /** Blockers preventing advancement */
  blockers: string[];
}

/**
 * Result of advancing a feature.
 */
export interface AdvanceResult {
  /** Whether advance was successful */
  success: boolean;
  /** Previous state */
  previousState: MigrationState;
  /** New state */
  newState: MigrationState;
  /** Message describing the result */
  message: string;
}

/**
 * Result of rolling back a feature.
 */
export interface RollbackResult {
  /** Whether rollback was successful */
  success: boolean;
  /** Previous state */
  previousState: MigrationState;
  /** New state after rollback */
  newState: MigrationState;
  /** Reason for rollback (if provided) */
  reason?: string;
}

/**
 * Full rollout status for all features.
 */
export interface RolloutStatus {
  /** Status by feature */
  features: Record<ScrapingFeature, {
    state: MigrationState;
    ready: boolean;
    blockers: string[];
    metrics: RolloutMetrics;
  }>;
  /** Overall migration progress (0-100) */
  overallProgress: number;
  /** Number of features fully migrated */
  migratedCount: number;
  /** Total features */
  totalFeatures: number;
  /** Recommended next action */
  recommendation?: string;
}

// =============================================================================
// Default Criteria by State
// =============================================================================

/**
 * Default criteria for each migration state.
 */
const DEFAULT_CRITERIA: Record<MigrationState, RolloutCriteria> = {
  legacy: {},
  shadow: {
    minShadowMatchRate: 99,
    minRequestCount: 1000,
    durationHours: 24,
  },
  canary: {
    maxErrorRate: 1,
    minRequestCount: 500,
    durationHours: 48,
  },
  rollout: {
    maxErrorRate: 0.5,
    minRequestCount: 5000,
    durationHours: 72,
  },
  migrated: {},
};

/**
 * State transition order.
 */
const STATE_ORDER: MigrationState[] = ['legacy', 'shadow', 'canary', 'rollout', 'migrated'];

/**
 * Redis key prefix for rollout state.
 */
const ROLLOUT_KEY_PREFIX = `${REDIS_SERVICE_PREFIX}rollout:`;

// =============================================================================
// MigrationRollout Implementation
// =============================================================================

/**
 * MigrationRollout manages controlled feature migration.
 *
 * @example
 * ```typescript
 * const rollout = new MigrationRollout();
 *
 * // Check if a feature is ready to advance
 * const check = await rollout.checkReadyForAdvancement('prospectAnalysis');
 * if (check.ready) {
 *   await rollout.advanceFeature('prospectAnalysis');
 * }
 *
 * // Get full rollout status
 * const status = await rollout.getFullRolloutStatus();
 * ```
 */
export class MigrationRollout {
  private customCriteria: Partial<Record<MigrationState, RolloutCriteria>> = {};

  /**
   * Set custom criteria for a state.
   */
  setCustomCriteria(state: MigrationState, criteria: Partial<RolloutCriteria>): void {
    this.customCriteria[state] = {
      ...DEFAULT_CRITERIA[state],
      ...criteria,
    };
  }

  /**
   * Get criteria for a state.
   */
  getCriteria(state: MigrationState): RolloutCriteria {
    return this.customCriteria[state] ?? DEFAULT_CRITERIA[state];
  }

  // ===========================================================================
  // State Management
  // ===========================================================================

  /**
   * Get the current state for a feature.
   */
  async getFeatureState(feature: ScrapingFeature): Promise<MigrationState> {
    const flags = loadMigrationFlagsCached();
    return flags[feature];
  }

  /**
   * Set the state for a feature.
   * This updates the Redis-backed state store.
   */
  async setFeatureState(feature: ScrapingFeature, state: MigrationState): Promise<void> {
    if (!VALID_MIGRATION_STATES.includes(state)) {
      throw new Error(`Invalid migration state: ${state}`);
    }

    // Store state transition
    const key = `${ROLLOUT_KEY_PREFIX}state:${feature}`;
    const stateData = {
      state,
      enteredAt: new Date().toISOString(),
      previousState: await this.getFeatureState(feature),
    };

    await redis.set(key, JSON.stringify(stateData));

    // Also set the environment variable override
    const envKey = `${ROLLOUT_KEY_PREFIX}env:${feature}`;
    await redis.set(envKey, state);

    migrationLogger.info({ feature, previousState: stateData.previousState, newState: state }, 'Feature state changed');
  }

  /**
   * Get all features with their states.
   */
  async getAllFeatures(): Promise<ScrapingFeature[]> {
    const flags = loadMigrationFlagsCached();
    return Object.keys(flags) as ScrapingFeature[];
  }

  // ===========================================================================
  // Readiness Checks
  // ===========================================================================

  /**
   * Check if a feature is ready to advance to the next state.
   */
  async checkReadyForAdvancement(feature: ScrapingFeature): Promise<RolloutReadinessCheck> {
    const currentState = await this.getFeatureState(feature);
    const nextState = this.getNextState(currentState);
    const criteria = this.getCriteria(currentState);
    const metrics = await this.getMetrics(feature, currentState);
    const blockers: string[] = [];

    // Check each criterion
    if (criteria.minShadowMatchRate !== undefined &&
        metrics.shadowMatchRate < criteria.minShadowMatchRate) {
      blockers.push(
        `Shadow match rate ${metrics.shadowMatchRate.toFixed(1)}% < ${criteria.minShadowMatchRate}% required`
      );
    }

    if (criteria.maxErrorRate !== undefined &&
        metrics.errorRate > criteria.maxErrorRate) {
      blockers.push(
        `Error rate ${metrics.errorRate.toFixed(2)}% > ${criteria.maxErrorRate}% allowed`
      );
    }

    if (criteria.minRequestCount !== undefined &&
        metrics.requestCount < criteria.minRequestCount) {
      blockers.push(
        `Request count ${metrics.requestCount} < ${criteria.minRequestCount} required`
      );
    }

    if (criteria.durationHours !== undefined &&
        metrics.hoursInState < criteria.durationHours) {
      blockers.push(
        `Hours in state ${metrics.hoursInState.toFixed(1)}h < ${criteria.durationHours}h required`
      );
    }

    return {
      ready: blockers.length === 0 && nextState !== null,
      currentState,
      nextState: blockers.length === 0 ? nextState ?? undefined : undefined,
      criteria,
      metrics,
      blockers,
    };
  }

  /**
   * Advance a feature to the next state.
   */
  async advanceFeature(feature: ScrapingFeature): Promise<AdvanceResult> {
    const check = await this.checkReadyForAdvancement(feature);

    if (!check.ready) {
      return {
        success: false,
        previousState: check.currentState,
        newState: check.currentState,
        message: `Not ready to advance: ${check.blockers.join('; ')}`,
      };
    }

    if (!check.nextState) {
      return {
        success: false,
        previousState: check.currentState,
        newState: check.currentState,
        message: 'Already at final state (migrated)',
      };
    }

    // Advance to next state
    await this.setFeatureState(feature, check.nextState);

    // Record advancement in history
    await this.recordStateTransition(feature, check.currentState, check.nextState, 'advance');

    return {
      success: true,
      previousState: check.currentState,
      newState: check.nextState,
      message: `Advanced from ${check.currentState} to ${check.nextState}`,
    };
  }

  /**
   * Roll back a feature to the previous state.
   */
  async rollbackFeature(feature: ScrapingFeature, reason?: string): Promise<RollbackResult> {
    const currentState = await this.getFeatureState(feature);
    const previousState = this.getPreviousState(currentState);

    // Set previous state
    await this.setFeatureState(feature, previousState);

    // Record rollback in history
    await this.recordStateTransition(feature, currentState, previousState, 'rollback', reason);

    migrationLogger.warn({ feature, previousState: currentState, newState: previousState, reason: reason ?? 'Not specified' }, 'Feature rolled back');

    return {
      success: true,
      previousState: currentState,
      newState: previousState,
      reason,
    };
  }

  /**
   * Force a feature to a specific state (bypass criteria).
   * Use with caution - for emergency situations only.
   */
  async forceState(feature: ScrapingFeature, state: MigrationState, reason: string): Promise<void> {
    const currentState = await this.getFeatureState(feature);

    await this.setFeatureState(feature, state);
    await this.recordStateTransition(feature, currentState, state, 'force', reason);

    migrationLogger.warn({ feature, previousState: currentState, newState: state, reason }, 'Feature state FORCED');
  }

  // ===========================================================================
  // Status & Reporting
  // ===========================================================================

  /**
   * Get full rollout status for all features.
   */
  async getFullRolloutStatus(): Promise<RolloutStatus> {
    const features = await this.getAllFeatures();
    const status: RolloutStatus = {
      features: {} as RolloutStatus['features'],
      overallProgress: 0,
      migratedCount: 0,
      totalFeatures: features.length,
    };

    let totalProgress = 0;

    for (const feature of features) {
      const check = await this.checkReadyForAdvancement(feature);

      status.features[feature] = {
        state: check.currentState,
        ready: check.ready,
        blockers: check.blockers,
        metrics: check.metrics,
      };

      // Calculate progress for this feature
      const stateIndex = STATE_ORDER.indexOf(check.currentState);
      const featureProgress = (stateIndex / (STATE_ORDER.length - 1)) * 100;
      totalProgress += featureProgress;

      if (check.currentState === 'migrated') {
        status.migratedCount++;
      }
    }

    status.overallProgress = totalProgress / features.length;

    // Generate recommendation
    status.recommendation = this.generateRecommendation(status);

    return status;
  }

  /**
   * Get transition history for a feature.
   */
  async getTransitionHistory(feature: ScrapingFeature, limit: number = 20): Promise<Array<{
    from: MigrationState;
    to: MigrationState;
    action: 'advance' | 'rollback' | 'force';
    reason?: string;
    timestamp: string;
  }>> {
    const key = `${ROLLOUT_KEY_PREFIX}history:${feature}`;
    const history = await redis.lrange(key, 0, limit - 1);

    return history.map((entry) => JSON.parse(entry));
  }

  // ===========================================================================
  // Metrics
  // ===========================================================================

  /**
   * Get metrics for a feature at a given state.
   */
  async getMetrics(feature: ScrapingFeature, _state: MigrationState): Promise<RolloutMetrics> {
    const metricsKey = `${ROLLOUT_KEY_PREFIX}metrics:${feature}`;
    const stateKey = `${ROLLOUT_KEY_PREFIX}state:${feature}`;

    // Get stored metrics
    const metricsData = await redis.get(metricsKey);
    const stateData = await redis.get(stateKey);

    let metrics: Partial<RolloutMetrics> = {};
    if (metricsData) {
      try {
        metrics = JSON.parse(metricsData);
      } catch {
        // Invalid metrics data
      }
    }

    // Calculate hours in state
    let hoursInState = 0;
    let stateEnteredAt: Date | undefined;
    if (stateData) {
      try {
        const parsed = JSON.parse(stateData);
        if (parsed.enteredAt) {
          stateEnteredAt = new Date(parsed.enteredAt);
          hoursInState = (Date.now() - stateEnteredAt.getTime()) / (1000 * 60 * 60);
        }
      } catch {
        // Invalid state data
      }
    }

    return {
      shadowMatchRate: metrics.shadowMatchRate ?? 100,
      errorRate: metrics.errorRate ?? 0,
      requestCount: metrics.requestCount ?? 0,
      hoursInState,
      stateEnteredAt,
      lastError: metrics.lastError,
    };
  }

  /**
   * Update metrics for a feature.
   * Called by shadow runner and other monitoring components.
   */
  async updateMetrics(feature: ScrapingFeature, update: Partial<RolloutMetrics>): Promise<void> {
    const metricsKey = `${ROLLOUT_KEY_PREFIX}metrics:${feature}`;

    // Get existing metrics
    const existing = await this.getMetrics(feature, await this.getFeatureState(feature));

    // Merge with updates
    const updated: RolloutMetrics = {
      ...existing,
      ...update,
    };

    await redis.set(metricsKey, JSON.stringify(updated));
  }

  /**
   * Record a request for a feature.
   * Increments request count and optionally records error.
   */
  async recordRequest(feature: ScrapingFeature, options: {
    success: boolean;
    error?: string;
    shadowMatch?: boolean;
  }): Promise<void> {
    const countersKey = `${ROLLOUT_KEY_PREFIX}counters:${feature}`;

    // Increment counters atomically
    const pipeline = redis.pipeline();
    pipeline.hincrby(countersKey, 'total', 1);

    if (!options.success) {
      pipeline.hincrby(countersKey, 'errors', 1);
    }

    if (options.shadowMatch === true) {
      pipeline.hincrby(countersKey, 'shadowMatches', 1);
    } else if (options.shadowMatch === false) {
      pipeline.hincrby(countersKey, 'shadowMismatches', 1);
    }

    await pipeline.exec();

    // Update computed metrics periodically (every 100 requests)
    const counters = await redis.hgetall(countersKey);
    const total = parseInt(counters.total ?? '0', 10);

    if (total % 100 === 0) {
      const errors = parseInt(counters.errors ?? '0', 10);
      const matches = parseInt(counters.shadowMatches ?? '0', 10);
      const mismatches = parseInt(counters.shadowMismatches ?? '0', 10);
      const totalShadow = matches + mismatches;

      await this.updateMetrics(feature, {
        requestCount: total,
        errorRate: total > 0 ? (errors / total) * 100 : 0,
        shadowMatchRate: totalShadow > 0 ? (matches / totalShadow) * 100 : 100,
        lastError: options.error,
      });
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get the next state in the progression.
   */
  private getNextState(current: MigrationState): MigrationState | null {
    const currentIndex = STATE_ORDER.indexOf(current);
    if (currentIndex < 0 || currentIndex >= STATE_ORDER.length - 1) {
      return null;
    }
    return STATE_ORDER[currentIndex + 1];
  }

  /**
   * Get the previous state.
   */
  private getPreviousState(current: MigrationState): MigrationState {
    const currentIndex = STATE_ORDER.indexOf(current);
    if (currentIndex <= 0) {
      return 'legacy';
    }
    return STATE_ORDER[currentIndex - 1];
  }

  /**
   * Record a state transition in history.
   */
  private async recordStateTransition(
    feature: ScrapingFeature,
    from: MigrationState,
    to: MigrationState,
    action: 'advance' | 'rollback' | 'force',
    reason?: string
  ): Promise<void> {
    const key = `${ROLLOUT_KEY_PREFIX}history:${feature}`;
    const entry = {
      from,
      to,
      action,
      reason,
      timestamp: new Date().toISOString(),
    };

    // Prepend to list (most recent first)
    await redis.lpush(key, JSON.stringify(entry));

    // Trim to last 100 entries
    await redis.ltrim(key, 0, 99);
  }

  /**
   * Generate a recommendation based on current status.
   */
  private generateRecommendation(status: RolloutStatus): string {
    // Find features ready to advance
    const readyFeatures = Object.entries(status.features)
      .filter(([_, data]) => data.ready && data.state !== 'migrated')
      .map(([feature]) => feature);

    if (readyFeatures.length > 0) {
      // Recommend advancing in migration order
      const orderedReady = MIGRATION_ORDER.filter((f) => readyFeatures.includes(f));
      if (orderedReady.length > 0) {
        return `Ready to advance: ${orderedReady[0]} (${status.features[orderedReady[0] as ScrapingFeature].state} -> next)`;
      }
    }

    // Check for features with high error rates
    const highErrorFeatures = Object.entries(status.features)
      .filter(([_, data]) => data.metrics.errorRate > 5)
      .map(([feature]) => feature);

    if (highErrorFeatures.length > 0) {
      return `Warning: High error rate on ${highErrorFeatures.join(', ')}. Consider rollback.`;
    }

    // Check overall progress
    if (status.overallProgress < 50) {
      return 'Continue monitoring shadow mode results before advancing.';
    }

    if (status.migratedCount === status.totalFeatures) {
      return 'All features migrated. Legacy code can be removed.';
    }

    return 'Continue monitoring. No immediate action needed.';
  }
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let rolloutInstance: MigrationRollout | null = null;

/**
 * Get the singleton MigrationRollout instance.
 */
export function getMigrationRollout(): MigrationRollout {
  if (!rolloutInstance) {
    rolloutInstance = new MigrationRollout();
  }
  return rolloutInstance;
}

/**
 * Create a new MigrationRollout instance.
 */
export function createMigrationRollout(): MigrationRollout {
  return new MigrationRollout();
}
