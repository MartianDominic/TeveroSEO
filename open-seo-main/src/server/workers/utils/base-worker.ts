/**
 * Base worker class with built-in error handling, graceful shutdown, and monitoring.
 *
 * Provides:
 * - Automatic error handling and logging
 * - Graceful shutdown on SIGTERM/SIGINT
 * - Dead letter queue support
 * - Event handlers for monitoring
 * - Idempotency helpers
 *
 * @module workers/utils/base-worker
 */

import { Worker, Queue, QueueEvents, type Job, type Processor } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger, type Logger } from "@/server/lib/logger";
import { withErrorHandling, fireAndForget } from "./error-handler";

/**
 * Configuration for creating a worker.
 */
export interface WorkerConfig {
  /** Unique name for the worker (used for logging and Redis connections) */
  name: string;
  /** Name of the BullMQ queue to process */
  queueName: string;
  /** Number of concurrent jobs to process (default: 1) */
  concurrency?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Lock duration for job processing in ms (default: 30000) */
  lockDuration?: number;
  /** Maximum number of stalled job retries (default: 2) */
  maxStalledCount?: number;
  /** Timeout for graceful shutdown in ms (default: 25000) */
  shutdownTimeout?: number;
  /** Whether to use sandboxed processor (default: false) */
  sandboxed?: boolean;
  /** Path to processor file (required if sandboxed is true) */
  processorPath?: string;
}

/**
 * Dead letter queue job data.
 */
export interface DLQJobData<TData = unknown> {
  /** Original job ID */
  originalJobId: string;
  /** Original job name */
  originalJobName: string;
  /** Original job data */
  data: TData;
  /** Error message from final failure */
  error: string;
  /** Error stack trace */
  stack?: string;
  /** ISO timestamp when job was moved to DLQ */
  failedAt: string;
  /** Number of attempts made before failure */
  attemptsMade: number;
}

/**
 * Base worker class with comprehensive error handling and lifecycle management.
 *
 * Extend this class to create workers with built-in:
 * - Error handling and logging
 * - Graceful shutdown
 * - Dead letter queue support
 * - Event monitoring
 *
 * @example
 * class EmailWorker extends BaseWorker<EmailJobData, EmailResult> {
 *   constructor() {
 *     super({
 *       name: 'email-processor',
 *       queueName: 'emails',
 *       concurrency: 5,
 *     });
 *   }
 *
 *   protected async process(job: Job<EmailJobData>): Promise<EmailResult> {
 *     const { to, subject, body } = job.data;
 *     await sendEmail(to, subject, body);
 *     return { sent: true };
 *   }
 * }
 */
export abstract class BaseWorker<TData, TResult> {
  protected worker: Worker<TData, TResult> | null = null;
  protected queue: Queue<TData, TResult, string>;
  protected queueEvents: QueueEvents | null = null;
  protected dlqQueue: Queue<DLQJobData<TData>> | null = null;
  protected config: Required<
    Pick<WorkerConfig, "name" | "queueName" | "concurrency" | "maxRetries" | "retryDelay" | "lockDuration" | "maxStalledCount" | "shutdownTimeout">
  > & Pick<WorkerConfig, "sandboxed" | "processorPath">;
  protected log: Logger;

  private isShuttingDown = false;
  private shutdownHandlersRegistered = false;

  constructor(config: WorkerConfig) {
    this.config = {
      name: config.name,
      queueName: config.queueName,
      concurrency: config.concurrency ?? 1,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      lockDuration: config.lockDuration ?? 30000,
      maxStalledCount: config.maxStalledCount ?? 2,
      shutdownTimeout: config.shutdownTimeout ?? 25000,
      sandboxed: config.sandboxed,
      processorPath: config.processorPath,
    };

    this.log = createLogger({ module: config.name });

    const connection = getSharedBullMQConnection(`queue:${config.queueName}`);

    this.queue = new Queue<TData, TResult, string>(config.queueName, {
      connection,
      defaultJobOptions: {
        attempts: this.config.maxRetries,
        backoff: {
          type: "exponential",
          delay: this.config.retryDelay,
        },
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          count: 5000, // Keep last 5000 failed jobs
        },
      },
    });
  }

  /**
   * Process a single job. Override in subclass.
   *
   * @param job - The job to process
   * @returns Promise resolving to the job result
   */
  protected abstract process(job: Job<TData>): Promise<TResult>;

  /**
   * Start the worker. Creates the BullMQ worker and begins processing.
   *
   * @returns Promise resolving when worker is ready
   */
  async start(): Promise<void> {
    if (this.worker) {
      this.log.warn("Worker already started");
      return;
    }

    this.log.info("Starting worker", {
      queue: this.config.queueName,
      concurrency: this.config.concurrency,
    });

    const connection = getSharedBullMQConnection(`worker:${this.config.name}`);

    // Create processor with error handling wrapper
    const wrappedProcessor = withErrorHandling<TData, TResult>(
      this.config.name,
      this.process.bind(this) as (job: Job<TData>) => Promise<TResult>
    );

    // Use sandboxed processor if configured, otherwise use wrapped processor
    if (this.config.sandboxed && this.config.processorPath) {
      this.worker = new Worker<TData, TResult>(
        this.config.queueName,
        this.config.processorPath,
        {
          connection,
          concurrency: this.config.concurrency,
          lockDuration: this.config.lockDuration,
          maxStalledCount: this.config.maxStalledCount,
        }
      );
    } else {
      this.worker = new Worker<TData, TResult>(
        this.config.queueName,
        wrappedProcessor,
        {
          connection,
          concurrency: this.config.concurrency,
          lockDuration: this.config.lockDuration,
          maxStalledCount: this.config.maxStalledCount,
        }
      );
    }

    // Set up event handlers
    this.setupEventHandlers();

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    // Initialize queue events for monitoring
    this.queueEvents = new QueueEvents(this.config.queueName, { connection });

    // Wait for worker to be ready
    await new Promise<void>((resolve) => {
      this.worker!.on("ready", () => {
        this.log.info("Worker ready", { queue: this.config.queueName });
        resolve();
      });
    });
  }

  /**
   * Stop the worker gracefully.
   * Waits for in-flight jobs to complete up to shutdownTimeout.
   *
   * @returns Promise resolving when worker is stopped
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      this.log.debug("Shutdown already in progress");
      return;
    }

    if (!this.worker) {
      this.log.debug("Worker not running");
      return;
    }

    this.isShuttingDown = true;
    this.log.info("Stopping worker", { queue: this.config.queueName });

    const current = this.worker;
    this.worker = null;

    try {
      // Race between graceful close and timeout
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), this.config.shutdownTimeout)
      );
      const closed = current.close().then(() => "closed" as const);

      const result = await Promise.race([closed, timeout]);

      if (result === "timeout") {
        this.log.warn("Graceful shutdown timeout exceeded, forcing close", {
          timeoutMs: this.config.shutdownTimeout,
        });
        await current.close(true); // Force close
      }

      // Close queue events
      if (this.queueEvents) {
        await this.queueEvents.close();
        this.queueEvents = null;
      }

      this.log.info("Worker stopped", { queue: this.config.queueName });
    } catch (error) {
      this.log.error(
        "Error stopping worker",
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Add a job to the queue.
   *
   * @param name - Job name
   * @param data - Job data
   * @param options - Optional job options
   * @returns The created job
   */
  async addJob(
    name: string,
    data: TData,
    options?: {
      delay?: number;
      priority?: number;
      jobId?: string;
    }
  ): Promise<Job<TData, TResult, string>> {
    // Type assertion needed due to BullMQ's complex generic inference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const job = await (this.queue as any).add(name, data, {
      delay: options?.delay,
      priority: options?.priority,
      jobId: options?.jobId,
    });
    return job as Job<TData, TResult, string>;
  }

  /**
   * Get queue metrics.
   *
   * @returns Object with job counts by state
   */
  async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed"
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  /**
   * Enable dead letter queue for jobs that exhaust retries.
   *
   * @param dlqQueueName - Name of the DLQ (default: `${queueName}-dlq`)
   */
  enableDLQ(dlqQueueName?: string): void {
    const name = dlqQueueName ?? `${this.config.queueName}-dlq`;
    const connection = getSharedBullMQConnection(`queue:${name}`);

    this.dlqQueue = new Queue<DLQJobData<TData>>(name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: false, // Keep DLQ jobs for investigation
        removeOnFail: false,
      },
    });

    this.log.info("DLQ enabled", { dlqQueue: name });
  }

  /**
   * Set up event handlers for the worker.
   */
  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on("completed", (job, result) => {
      const durationMs =
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined;

      this.log.debug("Job completed", {
        jobId: job.id,
        jobName: job.name,
        durationMs,
      });
    });

    this.worker.on("failed", async (job, err) => {
      if (!job) {
        this.log.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;

      this.log.warn("Job failed", {
        jobId: job.id,
        jobName: job.name,
        attempt: job.attemptsMade,
        maxAttempts,
        error: err.message,
      });

      // Move to DLQ if retries exhausted
      if (job.attemptsMade >= maxAttempts && this.dlqQueue) {
        await this.moveToDLQ(job, err);
      }
    });

    this.worker.on("error", (err) => {
      this.log.error("Worker error", err);
    });

    this.worker.on("stalled", (jobId) => {
      this.log.warn("Job stalled", { jobId });
    });
  }

  /**
   * Move a failed job to the dead letter queue.
   */
  private async moveToDLQ(job: Job<TData>, error: Error): Promise<void> {
    if (!this.dlqQueue) return;

    try {
      const dlqData: DLQJobData<TData> = {
        originalJobId: job.id ?? "unknown",
        originalJobName: job.name,
        data: job.data,
        error: error.message,
        stack: error.stack,
        failedAt: new Date().toISOString(),
        attemptsMade: job.attemptsMade,
      };

      await this.dlqQueue.add(`dlq:${job.name}`, dlqData);

      this.log.info("Job moved to DLQ", {
        jobId: job.id,
        jobName: job.name,
        attemptsMade: job.attemptsMade,
      });
    } catch (dlqErr) {
      this.log.error(
        "Failed to move job to DLQ",
        dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)),
        { jobId: job.id }
      );
    }
  }

  /**
   * Set up graceful shutdown handlers.
   */
  private setupGracefulShutdown(): void {
    if (this.shutdownHandlersRegistered) return;

    const shutdown = async (signal: string) => {
      this.log.info(`Received ${signal}, initiating graceful shutdown`);
      await this.stop();
    };

    process.on("SIGTERM", () => {
      fireAndForget("shutdown-sigterm", shutdown("SIGTERM"), this.log);
    });

    process.on("SIGINT", () => {
      fireAndForget("shutdown-sigint", shutdown("SIGINT"), this.log);
    });

    this.shutdownHandlersRegistered = true;
  }
}

/**
 * Create a simple worker without extending BaseWorker.
 * Useful for quick worker creation with all the benefits of BaseWorker.
 *
 * @example
 * const worker = createWorker({
 *   name: 'simple-processor',
 *   queueName: 'simple-tasks',
 *   processor: async (job) => {
 *     console.log('Processing:', job.data);
 *     return { done: true };
 *   },
 * });
 *
 * await worker.start();
 */
export function createWorker<TData, TResult>(
  config: WorkerConfig & {
    processor: (job: Job<TData>) => Promise<TResult>;
  }
): BaseWorker<TData, TResult> {
  class SimpleWorker extends BaseWorker<TData, TResult> {
    private processor: (job: Job<TData>) => Promise<TResult>;

    constructor() {
      super(config);
      this.processor = config.processor;
    }

    protected async process(job: Job<TData>): Promise<TResult> {
      return this.processor(job);
    }
  }

  return new SimpleWorker();
}
