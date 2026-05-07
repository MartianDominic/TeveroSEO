/**
 * Queue Orchestrator for Dynamic Queue Management.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Manages queue priorities dynamically:
 * - Pauses background queue when priority queues are congested
 * - Resumes background queue when pressure eases
 * - Monitors queue health and adjusts accordingly
 */

import type { Worker } from "bullmq";
import type { QueueManager } from "./QueueManager";
import { QUEUE_CONFIG, SCRAPE_QUEUE_NAMES } from "./queue.types";

/**
 * Orchestrator configuration.
 */
export interface OrchestratorConfig {
  /** Utilization threshold to pause background queue (default: 0.5) */
  pauseThreshold: number;

  /** Utilization threshold to resume background queue (default: 0.3) */
  resumeThreshold: number;

  /** Interval for checking queue health in ms (default: 5000) */
  checkIntervalMs: number;
}

/**
 * Default orchestrator configuration.
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  pauseThreshold: 0.5,
  resumeThreshold: 0.3,
  checkIntervalMs: 5_000,
};

/**
 * Queue orchestrator for dynamic priority management.
 *
 * When priority queues are congested (>50% utilization), the background
 * queue is paused to prioritize user-facing work. When pressure eases
 * (<30% utilization), background processing resumes.
 */
export class QueueOrchestrator {
  private readonly queueManager: QueueManager;
  private readonly config: OrchestratorConfig;
  private backgroundWorker?: Worker;
  private isBackgroundPaused = false;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    queueManager: QueueManager,
    config: Partial<OrchestratorConfig> = {}
  ) {
    this.queueManager = queueManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the background worker to pause/resume.
   */
  setBackgroundWorker(worker: Worker): void {
    this.backgroundWorker = worker;
  }

  /**
   * Start the orchestrator monitoring loop.
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      void this.checkAndAdjust();
    }, this.config.checkIntervalMs);

    console.log("[QueueOrchestrator] Started monitoring queue health");
  }

  /**
   * Stop the orchestrator.
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.isRunning = false;
    console.log("[QueueOrchestrator] Stopped monitoring");
  }

  /**
   * Check queue health and adjust background worker accordingly.
   */
  async checkAndAdjust(): Promise<void> {
    try {
      const metrics = await this.queueManager.getQueueMetrics();

      const priorityConfig = QUEUE_CONFIG[SCRAPE_QUEUE_NAMES.PRIORITY];
      const standardConfig = QUEUE_CONFIG[SCRAPE_QUEUE_NAMES.STANDARD];

      const priorityStats = metrics.queues[SCRAPE_QUEUE_NAMES.PRIORITY];
      const standardStats = metrics.queues[SCRAPE_QUEUE_NAMES.STANDARD];

      // Calculate utilization based on waiting + active jobs vs concurrency
      const priorityTotal = priorityStats.waiting + priorityStats.active;
      const standardTotal = standardStats.waiting + standardStats.active;

      const priorityUtilization = priorityTotal / priorityConfig.concurrency;
      const standardUtilization = standardTotal / standardConfig.concurrency;

      // Pause background when priority queues are stressed
      if (
        (priorityUtilization > this.config.pauseThreshold ||
          standardUtilization > this.config.pauseThreshold) &&
        !this.isBackgroundPaused
      ) {
        await this.pauseBackground();
        console.log(
          `[QueueOrchestrator] Background paused: priority=${(priorityUtilization * 100).toFixed(1)}%, standard=${(standardUtilization * 100).toFixed(1)}%`
        );
      }

      // Resume when pressure eases
      if (
        priorityUtilization < this.config.resumeThreshold &&
        standardUtilization < this.config.resumeThreshold &&
        this.isBackgroundPaused
      ) {
        await this.resumeBackground();
        console.log(
          `[QueueOrchestrator] Background resumed: priority=${(priorityUtilization * 100).toFixed(1)}%, standard=${(standardUtilization * 100).toFixed(1)}%`
        );
      }
    } catch (error) {
      console.error("[QueueOrchestrator] Error checking queue health:", error);
    }
  }

  /**
   * Pause the background worker and queue.
   */
  private async pauseBackground(): Promise<void> {
    if (this.backgroundWorker) {
      await this.backgroundWorker.pause();
    }
    await this.queueManager.pauseQueue(SCRAPE_QUEUE_NAMES.BACKGROUND);
    this.isBackgroundPaused = true;
  }

  /**
   * Resume the background worker and queue.
   */
  private async resumeBackground(): Promise<void> {
    await this.queueManager.resumeQueue(SCRAPE_QUEUE_NAMES.BACKGROUND);
    if (this.backgroundWorker) {
      await this.backgroundWorker.resume();
    }
    this.isBackgroundPaused = false;
  }

  /**
   * Get current orchestrator state.
   */
  getState(): {
    isRunning: boolean;
    isBackgroundPaused: boolean;
  } {
    return {
      isRunning: this.isRunning,
      isBackgroundPaused: this.isBackgroundPaused,
    };
  }

  /**
   * Force pause background processing.
   */
  async forcePauseBackground(): Promise<void> {
    await this.pauseBackground();
    console.log("[QueueOrchestrator] Background force-paused");
  }

  /**
   * Force resume background processing.
   */
  async forceResumeBackground(): Promise<void> {
    await this.resumeBackground();
    console.log("[QueueOrchestrator] Background force-resumed");
  }
}
