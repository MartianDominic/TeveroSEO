/**
 * Revolut Polling Processor
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * Sandboxed processor for BullMQ Revolut polling jobs.
 * Implements D-03: 15-minute polling to catch missed webhooks.
 *
 * Job types:
 * - poll-transactions: Master job that iterates all configured workspaces
 * - poll-workspace: Poll a specific workspace's Revolut account
 */
import { Job } from "bullmq";
import { db } from "@/db";
import { workspacePaymentSettings } from "@/db/workspace-payment-settings-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { createJobHeartbeat } from "@/server/lib/queue-utils";
import type { RevolutPollingJobData } from "@/server/queues/revolutPollingQueue";
import { PaymentIngestionService } from "@/server/features/payments/services/PaymentIngestionService";
import { AutoMatchEngine } from "@/server/features/payments/services/AutoMatchEngine";

const logger = createLogger({ module: "revolut-polling-processor" });

/**
 * Revolut Transaction structure from Business API.
 * Matches the interface in PaymentIngestionService.
 */
interface RevolutTransaction {
  id: string;
  type: string;
  state: string;
  amount: { value: number; currency: string };
  fee?: { value: number; currency: string };
  reference?: string;
  merchant?: { name?: string };
  counterparty?: { name?: string; email?: string };
  created_at: string;
}

/**
 * Environment configuration.
 * Revolut uses different API URLs for sandbox vs production.
 */
const REVOLUT_API_URL =
  (globalThis as any).process?.env?.REVOLUT_API_URL || "https://b2b.revolut.com/api/1.0";

/**
 * Fetch transactions from Revolut Business API.
 *
 * @param accessToken - Revolut API access token
 * @param accountId - Revolut account ID (optional, fetches default if not specified)
 * @param fromDate - Only fetch transactions after this date (ISO string)
 * @returns Array of Revolut transactions
 */
async function fetchRevolutTransactions(
  accessToken: string,
  accountId?: string,
  fromDate?: string
): Promise<RevolutTransaction[]> {
  const params = new URLSearchParams();

  // Filter by date if provided (incremental fetch)
  if (fromDate) {
    params.set("from", fromDate);
  }

  // Filter by account if specified
  if (accountId) {
    params.set("account", accountId);
  }

  // Limit to completed transactions
  params.set("type", "transfer");

  const url = `${REVOLUT_API_URL}/transactions?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Revolut API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const transactions = (await response.json()) as RevolutTransaction[];

  // Filter to only completed transactions
  return transactions.filter((tx) => tx.state === "completed");
}

/**
 * Poll a single workspace's Revolut account.
 *
 * @param workspaceId - Workspace to poll
 * @param accountId - Revolut account ID (optional)
 * @param lastPollTimestamp - Only fetch transactions after this time
 * @returns Stats about the polling operation
 */
async function pollWorkspace(
  workspaceId: string,
  accountId?: string,
  lastPollTimestamp?: string
): Promise<{
  transactionsFound: number;
  newPayments: number;
  errors: number;
}> {
  const workspaceLogger = logger.child({ workspaceId });

  // Get Revolut credentials for workspace
  const [settings] = await db
    .select()
    .from(workspacePaymentSettings)
    .where(eq(workspacePaymentSettings.workspaceId, workspaceId));

  if (!settings) {
    workspaceLogger.debug("No payment settings for workspace");
    return { transactionsFound: 0, newPayments: 0, errors: 0 };
  }

  if (!settings.revolutEnabled || !settings.revolutApiKey) {
    workspaceLogger.debug("Revolut not enabled for workspace");
    return { transactionsFound: 0, newPayments: 0, errors: 0 };
  }

  // Fetch transactions since last poll (or last 24 hours if first poll)
  const fromDate =
    lastPollTimestamp ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  workspaceLogger.info("Polling Revolut transactions", { fromDate });

  const transactions = await fetchRevolutTransactions(
    settings.revolutApiKey,
    accountId || settings.revolutMerchantId || undefined,
    fromDate
  );

  workspaceLogger.info("Fetched Revolut transactions", {
    count: transactions.length,
  });

  let newPayments = 0;
  let errors = 0;

  // Process each transaction
  for (const tx of transactions) {
    try {
      // Ingest payment (idempotent - won't duplicate)
      const { payment, isNew } = await PaymentIngestionService.ingestFromRevolut(
        tx,
        workspaceId
      );

      if (isNew) {
        newPayments++;

        // Run auto-matching for new payments
        try {
          await AutoMatchEngine.processPayment(payment.id, workspaceId);
        } catch (matchError) {
          // Log but don't fail - payment is ingested, matching can be retried
          workspaceLogger.warn("Auto-match failed for payment", {
            paymentId: payment.id,
            error:
              matchError instanceof Error ? matchError.message : "Unknown error",
          });
        }
      }
    } catch (txError) {
      errors++;
      workspaceLogger.error("Failed to process transaction", txError as Error, {
        transactionId: tx.id,
      });
    }
  }

  return {
    transactionsFound: transactions.length,
    newPayments,
    errors,
  };
}

/**
 * Process Revolut polling job.
 * Handles both master (poll-transactions) and workspace-specific (poll-workspace) jobs.
 *
 * @param job - BullMQ job with polling data
 */
export default async function process(
  job: Job<RevolutPollingJobData>
): Promise<void> {
  const { type, workspaceId, accountId, lastPollTimestamp } = job.data;

  logger.info("Starting Revolut polling job", {
    jobId: job.id,
    type,
    workspaceId,
  });

  if (type === "poll-workspace" && workspaceId) {
    // Poll a specific workspace
    const stats = await pollWorkspace(workspaceId, accountId, lastPollTimestamp);
    logger.info("Workspace poll complete", {
      jobId: job.id,
      workspaceId,
      ...stats,
    });
    return;
  }

  // Master job: poll all workspaces with Revolut enabled
  const workspacesWithRevolut = await db
    .select({
      workspaceId: workspacePaymentSettings.workspaceId,
    })
    .from(workspacePaymentSettings)
    .where(eq(workspacePaymentSettings.revolutEnabled, true));

  logger.info("Found workspaces with Revolut enabled", {
    count: workspacesWithRevolut.length,
  });

  let totalTransactions = 0;
  let totalNewPayments = 0;
  let totalErrors = 0;
  let workspacesPolled = 0;

  // JOBS-01 FIX: Add heartbeat for long-running master job
  // Prevents BullMQ stall detection when processing many workspaces with slow API responses
  const heartbeat = createJobHeartbeat(job, 30_000); // 30s heartbeat interval

  try {
    for (const { workspaceId: wsId } of workspacesWithRevolut) {
      try {
        const stats = await pollWorkspace(wsId);
        totalTransactions += stats.transactionsFound;
        totalNewPayments += stats.newPayments;
        totalErrors += stats.errors;
        workspacesPolled++;

        // Signal job is still active after processing each workspace
        heartbeat.stop(); // Temporarily stop to avoid race
        await job.updateProgress({
          workspacesPolled,
          totalWorkspaces: workspacesWithRevolut.length,
          lastWorkspace: wsId,
        });
      } catch (wsError) {
        totalErrors++;
        logger.error("Failed to poll workspace", wsError as Error, {
          workspaceId: wsId,
        });
      }
    }
  } finally {
    heartbeat.stop();
  }

  logger.info("Revolut polling check complete", {
    jobId: job.id,
    workspacesPolled,
    totalTransactions,
    totalNewPayments,
    totalErrors,
  });
}
