/**
 * BullMQ worker for goal progress computation.
 * Phase 22: Goal-Based Metrics System
 *
 * MED-35 DESIGN DECISION: This worker uses an inline processor function instead
 * of a sandboxed processor (file path) for the following reasons:
 * 1. Goal computation is primarily DB-bound (not CPU-intensive like Lighthouse)
 * 2. DB connections are shared and managed at the application level
 * 3. Sandboxing would require additional IPC overhead for DB access
 * 4. The inline function provides simpler debugging and error handling
 *
 * If goal computation becomes CPU-intensive in the future, consider migrating
 * to a sandboxed processor like audit-worker.ts or analytics-worker.ts.
 */
import { Worker, type Job } from "bullmq";
import { db } from "@/db";
import {
  clientGoals,
  goalTemplates,
  goalSnapshots,
} from "@/db/goals-schema";
import { clientDashboardMetrics } from "@/db/dashboard-schema";
import { eq, and, desc } from "drizzle-orm";
import { computationMethods } from "./goal-computations";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { GOAL_QUEUE_NAME, goalQueue, initGoalProcessingScheduler, type GoalProcessorJobData, type GoalDLQJobData } from "@/server/queues/goalQueue";

const log = createLogger({ module: "goal-processor" });

/**
 * Process goals for specified client or all clients.
 */
async function processGoals(job: Job<GoalProcessorJobData>) {
  const { clientId, goalId } = job.data;
  const jobLogger = createLogger({ module: "goal-processor", jobId: job.id });

  jobLogger.info("Starting goal processing", { clientId, goalId });

  // Build query conditions
  const conditions = [];
  if (clientId) conditions.push(eq(clientGoals.clientId, clientId));
  if (goalId) conditions.push(eq(clientGoals.id, goalId));

  // Fetch goals with templates
  const goals = await db
    .select({
      goal: clientGoals,
      template: goalTemplates,
    })
    .from(clientGoals)
    .innerJoin(goalTemplates, eq(clientGoals.templateId, goalTemplates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const results = { processed: 0, errors: 0 };

  for (const { goal, template } of goals) {
    try {
      const goalWithTemplate = { ...goal, template };

      // Run computation
      const computeFn = computationMethods[template.computationMethod];
      if (!computeFn) {
        jobLogger.warn(`Unknown computation method: ${template.computationMethod}`);
        continue;
      }

      const { currentValue, error } = await computeFn(
        goal.clientId,
        goalWithTemplate,
      );

      if (error) {
        jobLogger.error(`Error computing goal ${goal.id}:`, new Error(error));
        results.errors++;
        continue;
      }

      // Calculate attainment
      const targetValue = Number(goal.targetValue);
      const attainmentPct =
        targetValue > 0 ? (currentValue / targetValue) * 100 : 0;

      // Calculate trend (compare to previous snapshot)
      const previousSnapshot = await db
        .select()
        .from(goalSnapshots)
        .where(eq(goalSnapshots.goalId, goal.id))
        .orderBy(desc(goalSnapshots.snapshotDate))
        .limit(1);

      const previousValue = Number(
        previousSnapshot[0]?.currentValue ?? currentValue,
      );
      const trendValue = currentValue - previousValue;
      const trendDirection =
        trendValue > 0.5 ? "up" : trendValue < -0.5 ? "down" : "flat";

      // Update goal
      await db
        .update(clientGoals)
        .set({
          currentValue: String(currentValue),
          attainmentPct: String(attainmentPct),
          trendDirection,
          trendValue: String(trendValue),
          lastComputedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientGoals.id, goal.id));

      // Save snapshot (once per day - upsert)
      const today = new Date().toISOString().split("T")[0];
      const snapshotId = crypto.randomUUID();
      await db
        .insert(goalSnapshots)
        .values({
          id: snapshotId,
          goalId: goal.id,
          snapshotDate: new Date(today),
          currentValue: String(currentValue),
          attainmentPct: String(attainmentPct),
        })
        .onConflictDoUpdate({
          target: [goalSnapshots.goalId, goalSnapshots.snapshotDate],
          set: {
            currentValue: String(currentValue),
            attainmentPct: String(attainmentPct),
          },
        });

      results.processed++;
    } catch (err) {
      jobLogger.error(
        `Failed to process goal ${goal.id}`,
        err instanceof Error ? err : new Error(String(err)),
      );
      results.errors++;
    }
  }

  // Update dashboard metrics if processing by client
  if (clientId) {
    await updateClientDashboardGoals(clientId, jobLogger);
  }

  jobLogger.info("Goal processing complete", results);
  return results;
}

/**
 * Update dashboard metrics with goal aggregates for a client.
 */
async function updateClientDashboardGoals(
  clientId: string,
  logger: ReturnType<typeof createLogger>,
) {
  // Get all goals for client
  const goals = await db
    .select({
      goal: clientGoals,
      template: goalTemplates,
    })
    .from(clientGoals)
    .innerJoin(goalTemplates, eq(clientGoals.templateId, goalTemplates.id))
    .where(eq(clientGoals.clientId, clientId));

  if (goals.length === 0) return;

  // Calculate aggregates
  const goalsMetCount = goals.filter(
    (g) => Number(g.goal.attainmentPct ?? 0) >= 100,
  ).length;
  const goalsTotalCount = goals.length;
  const avgAttainment =
    goals.reduce((sum, g) => sum + Number(g.goal.attainmentPct ?? 0), 0) /
    goals.length;

  // Find primary goal
  const primaryGoal = goals.find((g) => g.goal.isPrimary) ?? goals[0];
  const primaryGoalName =
    primaryGoal.goal.customName ?? primaryGoal.template.name;

  // Update dashboard metrics
  await db
    .update(clientDashboardMetrics)
    .set({
      goalAttainmentPct: String(avgAttainment),
      goalsMetCount,
      goalsTotalCount,
      primaryGoalName,
      primaryGoalPct: primaryGoal.goal.attainmentPct,
      primaryGoalTrend: primaryGoal.goal.trendDirection,
      computedAt: new Date(),
    })
    .where(eq(clientDashboardMetrics.clientId, clientId));

  logger.info("Dashboard goal metrics updated", {
    clientId,
    goalsMetCount,
    goalsTotalCount,
    avgAttainment,
  });
}

const SHUTDOWN_TIMEOUT_MS = 25_000;

let goalWorker: Worker<GoalProcessorJobData> | null = null;

/**
 * Start the goal worker.
 */
export async function startGoalWorker(): Promise<void> {
  if (goalWorker) {
    log.warn("Goal worker already running");
    return;
  }

  // Initialize the scheduler for repeatable jobs
  await initGoalProcessingScheduler();
  log.info("Goal scheduler initialized");

  goalWorker = new Worker<GoalProcessorJobData>(
    GOAL_QUEUE_NAME,
    processGoals,
    {
      connection: getSharedBullMQConnection("worker:goal-processor"),
      concurrency: 5,
      lockDuration: 120_000, // 2 minutes for DB-heavy work
      maxStalledCount: 2,
    },
  );

  goalWorker.on("ready", () => {
    log.info("Goal worker ready", { queue: GOAL_QUEUE_NAME });
  });

  goalWorker.on("completed", (job) => {
    log.info(`Goal processing completed for job ${job.id}`);
  });

  goalWorker.on("failed", async (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));

    if (!job) {
      log.error("Job failed with no job context", error);
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const jobLogger = createLogger({
      module: "goal-processor",
      jobId: job.id,
    });

    // HIGH-52 fix: Use inline DLQ pattern (same as other workers)
    if (job.attemptsMade >= maxAttempts && !job.name.startsWith("dlq:")) {
      try {
        const dlqData: GoalDLQJobData = {
          originalJobId: job.id,
          originalJobName: job.name,
          data: job.data as GoalProcessorJobData,
          error: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString(),
          attemptsMade: job.attemptsMade,
        };
        await goalQueue.add("dlq:goal-processor", dlqData, {
          removeOnComplete: { age: 604800 }, // 7 days
          removeOnFail: { age: 604800 },
          attempts: 1,
        });
        jobLogger.info("Job moved to DLQ", { attemptsMade: job.attemptsMade });
      } catch (dlqErr) {
        jobLogger.error("Failed to move job to DLQ", dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    } else {
      log.warn("Goal job failed, will retry", {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts,
        error: error.message,
      });
    }
  });

  goalWorker.on("error", (err) => {
    log.error("Goal worker error", err);
  });

  goalWorker.on("stalled", (jobId) => {
    log.warn("Goal job stalled", { jobId, queue: GOAL_QUEUE_NAME });
  });

  log.info("Goal worker started");
}

/**
 * Stop the goal worker gracefully.
 */
export async function stopGoalWorker(): Promise<void> {
  if (!goalWorker) return;

  const current = goalWorker;
  goalWorker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);

  if (result === "timeout") {
    log.error(
      "Graceful shutdown timeout exceeded, forcing close",
      undefined,
      { timeoutMs: SHUTDOWN_TIMEOUT_MS },
    );
    await current.close(true);
  }

  log.info("Goal worker stopped");
}
