/**
 * BullMQ Queue definitions for the site audit system.
 *
 * - `auditQueue` — primary queue for site audit jobs
 * - `failedAuditsQueue` — dead-letter queue for terminally failed audit jobs
 *
 * Each Queue gets its own shared Redis connection via getSharedBullMQConnection()
 * to prevent connection leaks. Workers are defined separately in audit-worker.ts.
 */

import { Queue, type JobsOptions } from "bullmq";
import type { AuditConfig } from "@/server/lib/audit/types";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { getSharedBullMQConnection } from "@/server/lib/redis";

export const AUDIT_QUEUE_NAME = "audit-queue" as const;
export const FAILED_AUDITS_QUEUE_NAME = "failed-audits" as const;

/**
 * Step enum drives step-level resume semantics (CF Workflows -> BullMQ mapping).
 * The worker inspects `job.data.step` and resumes from the last persisted step
 * on retry. Worker writes updated step via job.updateData().
 */
export const AUDIT_STEP = {
  DISCOVER: "discover",
  CRAWL: "crawl",
  LIGHTHOUSE_SELECT: "lighthouse-select",
  LIGHTHOUSE_RUN: "lighthouse-run",
  FINALIZE: "finalize",
} as const;

export type AuditStep = (typeof AUDIT_STEP)[keyof typeof AUDIT_STEP];

export interface AuditJobData {
  auditId: string;
  projectId: string;
  startUrl: string;
  config: AuditConfig;
  billingCustomer: BillingCustomerContext;
  step: AuditStep;
  /** Resume state carried across retries. Worker writes these via job.updateData(). */
  sitemapUrls?: string[];
  crawlBatchIndex?: number;
  lighthouseBatchIndex?: number;
}

export interface FailedAuditJobData {
  auditId: string;
  projectId: string;
  originalJobId: string;
  failedAt: number; // Date.now()
  error: string;
  attemptsMade: number;
}

/**
 * Default job options for audit jobs.
 * Job timeout is controlled via Worker lockDuration (set to 120s in audit-worker.ts).
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const auditQueue = new Queue<AuditJobData>(AUDIT_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:audit"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const failedAuditsQueue = new Queue<FailedAuditJobData>(
  FAILED_AUDITS_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:failed-audits"),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600, count: 1000 }, // Keep 7 days or 1000 jobs max
    },
  },
);
