/**
 * Domain Scrape Config Revalidation Cron Job
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Periodically revalidates domain scrape configurations to ensure
 * optimal tier assignments remain accurate as sites change their
 * anti-bot protection.
 *
 * Triggers:
 * - Scheduled: Every 30 days of no access
 * - Failure-driven: After 3 consecutive failures
 * - Success rate: When success rate drops below 90%
 *
 * Run frequency: Every 15 minutes
 * Batch size: 50 domains per run
 */

// @ts-expect-error - cron may not be installed yet
import { CronJob } from "cron";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  domainScrapeConfigs,
  domainScrapeHistory,
  REVALIDATION_INTERVALS,
} from "@/db/domain-scrape-learning-schema";
import { domainLearningService } from "./DomainLearningService";
import type { RevalidationCandidate, RevalidationResult } from "./types";
import { domainLogger } from "./logging";

// =============================================================================
// Configuration
// =============================================================================

/**
 * Revalidation job configuration.
 */
export interface RevalidationJobConfig {
  /** Cron schedule (default: every 15 minutes) */
  schedule: string;

  /** Maximum domains to revalidate per run */
  batchSize: number;

  /** Minimum interval between revalidation of same domain (hours) */
  minIntervalHours: number;

  /** Whether to run immediately on startup */
  runOnStartup: boolean;

  /** Whether the job is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: RevalidationJobConfig = {
  schedule: "*/15 * * * *", // Every 15 minutes
  batchSize: 50,
  minIntervalHours: REVALIDATION_INTERVALS.MIN_INTERVAL_HOURS,
  runOnStartup: false,
  enabled: true,
};

// =============================================================================
// Revalidation Statistics
// =============================================================================

/**
 * Statistics from a revalidation run.
 */
export interface RevalidationRunStats {
  /** Timestamp of the run */
  timestamp: Date;

  /** Number of candidates found */
  candidatesFound: number;

  /** Number successfully revalidated */
  successCount: number;

  /** Number that failed revalidation */
  failureCount: number;

  /** Number that changed tier */
  tierChangedCount: number;

  /** Average time per revalidation (ms) */
  avgTimeMs: number;

  /** Total run time (ms) */
  totalTimeMs: number;

  /** Breakdown by reason */
  byReason: Record<RevalidationCandidate["reason"], number>;

  /** Tier change summary */
  tierChanges: Array<{
    domain: string;
    previousTier: string;
    newTier: string;
  }>;
}

// =============================================================================
// Revalidation Cron Job
// =============================================================================

export class RevalidationCronJob {
  private job: CronJob | null = null;
  private config: RevalidationJobConfig;
  private isRunning = false;
  private lastRunStats: RevalidationRunStats | null = null;

  constructor(config: Partial<RevalidationJobConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the cron job.
   */
  start(): void {
    if (!this.config.enabled) {
      domainLogger.info('Revalidation job is disabled, not starting');
      return;
    }

    if (this.job) {
      domainLogger.info('Revalidation job already running');
      return;
    }

    this.job = new CronJob(
      this.config.schedule,
      () => this.run(),
      null, // onComplete
      true, // start
      "UTC"
    );

    domainLogger.info({ schedule: this.config.schedule }, 'Revalidation cron job started');

    if (this.config.runOnStartup) {
      // Run after a short delay to allow system initialization
      setTimeout(() => this.run(), 5000);
    }
  }

  /**
   * Stop the cron job.
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
      domainLogger.info('Revalidation cron job stopped');
    }
  }

  /**
   * Check if the job is currently running.
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get statistics from the last run.
   */
  getLastRunStats(): RevalidationRunStats | null {
    return this.lastRunStats;
  }

  /**
   * Execute a revalidation run.
   */
  async run(): Promise<RevalidationRunStats> {
    if (this.isRunning) {
      domainLogger.debug('Previous revalidation run still in progress, skipping');
      return this.lastRunStats ?? this.createEmptyStats();
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats = this.createEmptyStats();
    stats.timestamp = new Date();

    try {
      domainLogger.info('Starting revalidation run');

      // Get candidates
      const candidates = await domainLearningService.getRevalidationCandidates(
        this.config.batchSize
      );
      stats.candidatesFound = candidates.length;

      if (candidates.length === 0) {
        domainLogger.debug('No candidates for revalidation');
        return stats;
      }

      domainLogger.info({ candidateCount: candidates.length }, 'Found revalidation candidates');

      // Track by reason
      for (const candidate of candidates) {
        stats.byReason[candidate.reason] =
          (stats.byReason[candidate.reason] ?? 0) + 1;
      }

      // Revalidate each candidate
      const results: RevalidationResult[] = [];
      const times: number[] = [];

      for (const candidate of candidates) {
        const candidateStart = Date.now();

        try {
          // Check minimum interval
          const canRevalidate = await this.checkMinimumInterval(candidate.domain);
          if (!canRevalidate) {
            domainLogger.debug({ domain: candidate.domain }, 'Skipping revalidation - too recent');
            continue;
          }

          const result = await domainLearningService.revalidate(candidate.domain);
          results.push(result);
          stats.successCount++;

          if (result.tierChanged) {
            stats.tierChangedCount++;
            stats.tierChanges.push({
              domain: result.domain,
              previousTier: result.previousTier,
              newTier: result.newTier,
            });
            domainLogger.info(
              { domain: result.domain, previousTier: result.previousTier, newTier: result.newTier },
              'Domain tier changed during revalidation'
            );
          }
        } catch (error) {
          stats.failureCount++;
          domainLogger.error(
            { domain: candidate.domain, error: error instanceof Error ? error.message : String(error) },
            'Failed to revalidate domain'
          );
        }

        times.push(Date.now() - candidateStart);
      }

      // Calculate averages
      stats.avgTimeMs =
        times.length > 0
          ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          : 0;

      domainLogger.info(
        { successCount: stats.successCount, failureCount: stats.failureCount, tierChangedCount: stats.tierChangedCount },
        'Revalidation run completed'
      );
    } catch (error) {
      domainLogger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Revalidation run failed'
      );
    } finally {
      stats.totalTimeMs = Date.now() - startTime;
      this.lastRunStats = stats;
      this.isRunning = false;
    }

    return stats;
  }

  /**
   * Check if minimum interval has passed since last revalidation.
   */
  private async checkMinimumInterval(domain: string): Promise<boolean> {
    const minTime = new Date(
      Date.now() - this.config.minIntervalHours * 60 * 60 * 1000
    );

    const result = await db
      .select({ lastTestedAt: domainScrapeConfigs.lastTestedAt })
      .from(domainScrapeConfigs)
      .where(eq(domainScrapeConfigs.domain, domain))
      .limit(1);

    if (result.length === 0) {
      return true; // New domain, can revalidate
    }

    const lastTested = result[0].lastTestedAt;
    if (!lastTested) {
      return true; // Never tested, can revalidate
    }

    return lastTested < minTime;
  }

  /**
   * Create empty stats object.
   */
  private createEmptyStats(): RevalidationRunStats {
    return {
      timestamp: new Date(),
      candidatesFound: 0,
      successCount: 0,
      failureCount: 0,
      tierChangedCount: 0,
      avgTimeMs: 0,
      totalTimeMs: 0,
      byReason: {
        stale: 0,
        consecutive_failures: 0,
        low_success_rate: 0,
        scheduled: 0,
      },
      tierChanges: [],
    };
  }

  /**
   * Manually trigger revalidation for a specific domain.
   */
  async revalidateDomain(domain: string): Promise<RevalidationResult> {
    domainLogger.info({ domain }, 'Manual revalidation triggered');
    return domainLearningService.revalidate(domain);
  }

  /**
   * Get current job status.
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    schedule: string;
    nextRun: Date | null;
    lastRun: Date | null;
    lastRunStats: RevalidationRunStats | null;
  } {
    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      schedule: this.config.schedule,
      nextRun: this.job?.nextDate()?.toJSDate() ?? null,
      lastRun: this.lastRunStats?.timestamp ?? null,
      lastRunStats: this.lastRunStats,
    };
  }
}

// =============================================================================
// History Cleanup Job
// =============================================================================

/**
 * Cleanup old scrape history records.
 * Run daily to keep history table size manageable.
 */
export class HistoryCleanupJob {
  private job: CronJob | null = null;
  private retentionDays: number;

  constructor(retentionDays = 30) {
    this.retentionDays = retentionDays;
  }

  /**
   * Start the cleanup job.
   */
  start(): void {
    if (this.job) {
      return;
    }

    // Run daily at 3 AM UTC
    this.job = new CronJob(
      "0 3 * * *",
      () => this.run(),
      null,
      true,
      "UTC"
    );

    domainLogger.info({ retentionDays: this.retentionDays }, 'History cleanup job started');
  }

  /**
   * Stop the cleanup job.
   */
  stop(): void {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Execute cleanup.
   */
  async run(): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
    );

    domainLogger.info({ cutoffDate: cutoffDate.toISOString() }, 'Starting history cleanup');

    const result = await db
      .delete(domainScrapeHistory)
      .where(lt(domainScrapeHistory.attemptedAt, cutoffDate))
      .returning({ id: domainScrapeHistory.id });

    const deletedCount = result.length;
    domainLogger.info({ deletedCount }, 'History cleanup completed');

    return { deletedCount };
  }
}

// =============================================================================
// Exports
// =============================================================================

// Create default instances
export const revalidationCronJob = new RevalidationCronJob();
export const historyCleanupJob = new HistoryCleanupJob();

/**
 * Start all domain learning cron jobs.
 */
export function startDomainLearningJobs(): void {
  revalidationCronJob.start();
  historyCleanupJob.start();
}

/**
 * Stop all domain learning cron jobs.
 */
export function stopDomainLearningJobs(): void {
  revalidationCronJob.stop();
  historyCleanupJob.stop();
}
