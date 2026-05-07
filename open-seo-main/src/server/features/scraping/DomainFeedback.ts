/**
 * DomainFeedbackService - Check-Based Domain Learning
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Collects feedback from SEO checks to improve domain learning:
 * - Buffers check results per domain
 * - Detects patterns (JS failures, quality issues)
 * - Updates domain config based on feedback
 * - Non-blocking operation
 */

import { DomainLearningService, normalizeDomain } from './DomainLearningService';
import type { ScrapeTier } from '@/db/domain-scrape-learning-schema';

// =============================================================================
// Types
// =============================================================================

/**
 * Feedback from a single SEO check.
 */
export interface CheckFeedback {
  /** Domain that was checked */
  domain: string;
  /** URL that was checked */
  url?: string;
  /** Check ID (e.g., 'T1-01', 'T5-03') */
  checkId: string;
  /** Whether the check passed */
  passed: boolean;
  /** Reason for pass/fail */
  reason?: string;
  /** Suggested tier based on check results */
  suggestedTier?: ScrapeTier;
  /** Timestamp of the check */
  timestamp?: Date;
}

/**
 * Aggregated feedback for a domain.
 */
interface DomainFeedbackAggregate {
  /** Total checks processed */
  totalChecks: number;
  /** Passed checks */
  passedChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** JS-related failures */
  jsFailures: CheckFeedback[];
  /** Quality-related failures */
  qualityFailures: CheckFeedback[];
  /** Content extraction failures */
  contentFailures: CheckFeedback[];
  /** Rendering failures */
  renderingFailures: CheckFeedback[];
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Options for DomainFeedbackService.
 */
export interface DomainFeedbackOptions {
  /** Flush interval in milliseconds (default: 5 minutes) */
  flushIntervalMs?: number;
  /** Minimum failures before updating config (default: 3) */
  minFailuresForUpdate?: number;
  /** Enable automatic flushing (default: true) */
  autoFlush?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Check ID patterns that indicate JS-related issues.
 */
const JS_CHECK_PATTERNS = [
  'T5-', // Tier 5 content quality often requires JS
  'SPA',
  'dynamic',
  'react',
  'vue',
  'angular',
  'script',
  'hydration',
];

/**
 * Reason patterns that indicate JS rendering is required.
 */
const JS_REASON_PATTERNS = [
  'JS',
  'JavaScript',
  'dynamic content',
  'SPA',
  'single page',
  'client-side',
  'hydration',
  'react',
  'vue',
  'angular',
  'empty content',
  'no content',
  'loading state',
];

/**
 * Check ID patterns for quality issues.
 */
const QUALITY_CHECK_PATTERNS = [
  'T5-',
  'quality',
  'content',
  'readability',
  'thin',
  'duplicate',
];

/**
 * Check ID patterns for content extraction issues.
 */
const CONTENT_CHECK_PATTERNS = [
  'title',
  'meta',
  'h1',
  'heading',
  'description',
  'canonical',
];

/**
 * Check ID patterns for rendering issues.
 */
const RENDERING_CHECK_PATTERNS = [
  'render',
  'layout',
  'cwv',
  'cls',
  'lcp',
  'screenshot',
  'visual',
];

// =============================================================================
// DomainFeedbackService Implementation
// =============================================================================

/**
 * DomainFeedbackService collects check feedback and updates domain learning.
 *
 * @example
 * ```typescript
 * const feedbackService = new DomainFeedbackService(domainLearning);
 *
 * // Record check results
 * feedbackService.recordCheckFeedback({
 *   domain: 'example.com',
 *   checkId: 'T5-01',
 *   passed: false,
 *   reason: 'Empty content - JS rendering required',
 * });
 *
 * // Manual flush (automatic flush happens every 5 minutes)
 * await feedbackService.flush();
 * ```
 */
export class DomainFeedbackService {
  private learningService: DomainLearningService;
  private feedbackBuffer: Map<string, CheckFeedback[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private options: Required<DomainFeedbackOptions>;

  constructor(
    learningService: DomainLearningService,
    options: DomainFeedbackOptions = {}
  ) {
    this.learningService = learningService;
    this.options = {
      flushIntervalMs: options.flushIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      minFailuresForUpdate: options.minFailuresForUpdate ?? 3,
      autoFlush: options.autoFlush ?? true,
    };

    // Start automatic flushing
    if (this.options.autoFlush) {
      this.startAutoFlush();
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Record feedback from a check.
   * This is non-blocking - feedback is buffered and processed periodically.
   */
  recordCheckFeedback(feedback: CheckFeedback): void {
    const domain = normalizeDomain(feedback.domain);
    const existing = this.feedbackBuffer.get(domain) ?? [];

    existing.push({
      ...feedback,
      domain,
      timestamp: feedback.timestamp ?? new Date(),
    });

    this.feedbackBuffer.set(domain, existing);
  }

  /**
   * Record multiple feedbacks at once.
   */
  recordCheckFeedbackBatch(feedbacks: CheckFeedback[]): void {
    for (const feedback of feedbacks) {
      this.recordCheckFeedback(feedback);
    }
  }

  /**
   * Manually flush buffered feedback.
   */
  async flush(): Promise<{ domainsProcessed: number; updatesApplied: number }> {
    return this.flushFeedback();
  }

  /**
   * Get current buffer size.
   */
  getBufferSize(): { domains: number; totalFeedback: number } {
    let totalFeedback = 0;
    for (const feedbacks of this.feedbackBuffer.values()) {
      totalFeedback += feedbacks.length;
    }
    return {
      domains: this.feedbackBuffer.size,
      totalFeedback,
    };
  }

  /**
   * Clear the feedback buffer.
   */
  clearBuffer(): void {
    this.feedbackBuffer.clear();
  }

  /**
   * Stop the automatic flush interval.
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Restart automatic flushing.
   */
  startAutoFlush(): void {
    this.stop();
    this.flushInterval = setInterval(
      () => this.flushFeedback(),
      this.options.flushIntervalMs
    );
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Flush buffered feedback to domain learning service.
   */
  private async flushFeedback(): Promise<{ domainsProcessed: number; updatesApplied: number }> {
    let domainsProcessed = 0;
    let updatesApplied = 0;

    // Copy and clear buffer to avoid issues with concurrent access
    const bufferedFeedback = new Map(this.feedbackBuffer);
    this.feedbackBuffer.clear();

    for (const [domain, feedbacks] of bufferedFeedback) {
      try {
        const applied = await this.processDomainFeedback(domain, feedbacks);
        domainsProcessed++;
        if (applied) {
          updatesApplied++;
        }
      } catch (error) {
        console.error(`[DomainFeedback] Error processing ${domain}:`, error);
        // Re-add to buffer for retry
        const existing = this.feedbackBuffer.get(domain) ?? [];
        this.feedbackBuffer.set(domain, [...existing, ...feedbacks]);
      }
    }

    if (domainsProcessed > 0) {
      console.info(`[DomainFeedback] Processed ${domainsProcessed} domains, ${updatesApplied} updates applied`);
    }

    return { domainsProcessed, updatesApplied };
  }

  /**
   * Process feedback for a single domain.
   */
  private async processDomainFeedback(
    domain: string,
    feedbacks: CheckFeedback[]
  ): Promise<boolean> {
    // Aggregate feedback
    const aggregate = this.aggregateFeedback(feedbacks);

    // Skip if not enough data
    if (aggregate.totalChecks < this.options.minFailuresForUpdate) {
      return false;
    }

    // Get current domain config
    const config = await this.learningService.getConfig(domain);

    // Determine if updates are needed
    const updates = this.determineUpdates(aggregate, config);

    if (Object.keys(updates).length === 0) {
      return false;
    }

    // Apply updates
    await this.learningService.updateConfig(domain, {
      success: true, // Mark as a learning update
      tier: config?.optimalTier ?? 'direct',
      responseTimeMs: config?.avgResponseTimeMs ?? 0,
      ...updates,
    });

    console.info(`[DomainFeedback] Updated ${domain}:`, updates);
    return true;
  }

  /**
   * Aggregate feedback into categories.
   */
  private aggregateFeedback(feedbacks: CheckFeedback[]): DomainFeedbackAggregate {
    const aggregate: DomainFeedbackAggregate = {
      totalChecks: feedbacks.length,
      passedChecks: 0,
      failedChecks: 0,
      jsFailures: [],
      qualityFailures: [],
      contentFailures: [],
      renderingFailures: [],
      lastUpdated: new Date(),
    };

    for (const feedback of feedbacks) {
      if (feedback.passed) {
        aggregate.passedChecks++;
        continue;
      }

      aggregate.failedChecks++;

      // Categorize failure
      if (this.isJsRelatedFailure(feedback)) {
        aggregate.jsFailures.push(feedback);
      }

      if (this.isQualityRelatedFailure(feedback)) {
        aggregate.qualityFailures.push(feedback);
      }

      if (this.isContentRelatedFailure(feedback)) {
        aggregate.contentFailures.push(feedback);
      }

      if (this.isRenderingRelatedFailure(feedback)) {
        aggregate.renderingFailures.push(feedback);
      }
    }

    return aggregate;
  }

  /**
   * Determine what updates to apply based on aggregated feedback.
   */
  private determineUpdates(
    aggregate: DomainFeedbackAggregate,
    _config: Awaited<ReturnType<DomainLearningService['getConfig']>>
  ): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    // If many JS-related failures, suggest higher tier
    if (aggregate.jsFailures.length >= this.options.minFailuresForUpdate) {
      updates.requiresJsRendering = true;
      updates.suggestedMinTier = 'dfs_js';
      updates.feedbackSource = 'check_failures_js';
    }

    // If content quality checks fail, might need better rendering
    if (aggregate.qualityFailures.length >= this.options.minFailuresForUpdate) {
      updates.contentQualityIssues = true;
      updates.feedbackSource = 'check_failures_quality';
    }

    // If content extraction fails, might need JS rendering
    if (aggregate.contentFailures.length >= this.options.minFailuresForUpdate) {
      updates.contentExtractionIssues = true;
      // If we're not already at JS tier, suggest it
      if (!updates.requiresJsRendering) {
        updates.suggestedMinTier = 'dfs_basic';
      }
      updates.feedbackSource = 'check_failures_content';
    }

    // If rendering failures, definitely need browser
    if (aggregate.renderingFailures.length >= this.options.minFailuresForUpdate) {
      updates.requiresJsRendering = true;
      updates.suggestedMinTier = 'dfs_browser';
      updates.feedbackSource = 'check_failures_rendering';
    }

    return updates;
  }

  /**
   * Check if failure is JS-related.
   */
  private isJsRelatedFailure(feedback: CheckFeedback): boolean {
    // Check ID patterns
    const checkIdLower = feedback.checkId.toLowerCase();
    for (const pattern of JS_CHECK_PATTERNS) {
      if (checkIdLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check reason patterns
    if (feedback.reason) {
      const reasonLower = feedback.reason.toLowerCase();
      for (const pattern of JS_REASON_PATTERNS) {
        if (reasonLower.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if failure is quality-related.
   */
  private isQualityRelatedFailure(feedback: CheckFeedback): boolean {
    const checkIdLower = feedback.checkId.toLowerCase();
    for (const pattern of QUALITY_CHECK_PATTERNS) {
      if (checkIdLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if failure is content extraction-related.
   */
  private isContentRelatedFailure(feedback: CheckFeedback): boolean {
    const checkIdLower = feedback.checkId.toLowerCase();
    for (const pattern of CONTENT_CHECK_PATTERNS) {
      if (checkIdLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if failure is rendering-related.
   */
  private isRenderingRelatedFailure(feedback: CheckFeedback): boolean {
    const checkIdLower = feedback.checkId.toLowerCase();
    for (const pattern of RENDERING_CHECK_PATTERNS) {
      if (checkIdLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false;
  }
}

// =============================================================================
// Check Runner Integration
// =============================================================================

/**
 * Hook to integrate with check runner.
 * Call this to wire up automatic feedback collection.
 */
export type CheckCompleteHandler = (result: {
  url?: string;
  checkId: string;
  pass: boolean;
  message?: string;
}) => void;

/**
 * Create an integration handler for the check runner.
 */
export function createCheckRunnerIntegration(
  feedbackService: DomainFeedbackService
): CheckCompleteHandler {
  return (result) => {
    if (!result.url) return;

    try {
      const url = new URL(result.url);
      feedbackService.recordCheckFeedback({
        domain: url.hostname,
        url: result.url,
        checkId: result.checkId,
        passed: result.pass,
        reason: result.message,
      });
    } catch {
      // Invalid URL, skip
    }
  };
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let feedbackServiceInstance: DomainFeedbackService | null = null;

/**
 * Get the singleton DomainFeedbackService instance.
 */
export function getDomainFeedbackService(): DomainFeedbackService {
  if (!feedbackServiceInstance) {
    throw new Error('DomainFeedbackService not initialized. Call setFeedbackServiceDependencies first.');
  }
  return feedbackServiceInstance;
}

/**
 * Initialize the DomainFeedbackService singleton.
 */
export function setFeedbackServiceDependencies(
  learningService: DomainLearningService,
  options?: DomainFeedbackOptions
): void {
  if (feedbackServiceInstance) {
    feedbackServiceInstance.stop();
  }
  feedbackServiceInstance = new DomainFeedbackService(learningService, options);
}

/**
 * Create a new DomainFeedbackService instance.
 */
export function createDomainFeedbackService(
  learningService: DomainLearningService,
  options?: DomainFeedbackOptions
): DomainFeedbackService {
  return new DomainFeedbackService(learningService, options);
}
