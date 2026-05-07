/**
 * Priority Assignment Logic for Scraping Jobs.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Determines job priority based on source, context, and features.
 */

import type { JobPriority, JobSource, ScrapeJobData, ScrapeQueueName } from "./queue.types";
import { SCRAPE_QUEUE_NAMES } from "./queue.types";

/**
 * Paid features that get elevated (normal) priority.
 */
const PAID_FEATURES = [
  "competitor_spy",
  "content_brief",
  "serp_analysis",
] as const;

/**
 * BullMQ priority values (lower = higher priority).
 */
export const BULLMQ_PRIORITY_VALUES: Record<JobPriority, number> = {
  critical: 1,
  high: 5,
  normal: 10,
  low: 20,
};

/**
 * Assign priority to a job based on its source and context.
 *
 * Priority Logic:
 * - UI source: Always elevated (critical or high)
 * - API + paid feature: normal
 * - Scheduler/System: low
 *
 * @param job - Partial job data to determine priority
 * @returns Assigned priority level
 */
export function assignPriority(job: Partial<ScrapeJobData>): JobPriority {
  // Explicit priority takes precedence
  if (job.priority) {
    return job.priority;
  }

  // User-initiated always gets elevated priority
  if (job.source === "ui") {
    // Site audits get high (async feedback expected)
    // Other UI actions get critical (user watching screen)
    return job.metadata?.featureContext === "site_audit" ? "high" : "critical";
  }

  // API calls from paid features
  if (job.source === "api") {
    if (job.metadata?.featureContext && isPaidFeature(job.metadata.featureContext)) {
      return "normal";
    }
    // Non-paid API calls default to low
    return "low";
  }

  // Scheduled jobs
  if (job.source === "scheduler") {
    return "low";
  }

  // System jobs (cache warming, etc.)
  if (job.source === "system") {
    return "low";
  }

  // Default fallback
  return "normal";
}

/**
 * Select the appropriate queue for a job based on priority and source.
 *
 * Queue Selection:
 * - UI source: Always priority queue
 * - Critical/High priority: Priority queue
 * - Normal priority: Standard queue
 * - Low priority: Background queue
 *
 * @param priority - Job priority
 * @param source - Job source
 * @returns Queue name
 */
export function selectQueue(priority: JobPriority, source: JobSource): ScrapeQueueName {
  // User-initiated always goes to priority queue
  if (source === "ui") {
    return SCRAPE_QUEUE_NAMES.PRIORITY;
  }

  switch (priority) {
    case "critical":
    case "high":
      return SCRAPE_QUEUE_NAMES.PRIORITY;
    case "normal":
      return SCRAPE_QUEUE_NAMES.STANDARD;
    case "low":
      return SCRAPE_QUEUE_NAMES.BACKGROUND;
  }
}

/**
 * Convert our priority to BullMQ priority value.
 *
 * BullMQ uses lower numbers for higher priority.
 *
 * @param priority - Our priority level
 * @returns BullMQ priority number
 */
export function toBullMQPriority(priority: JobPriority): number {
  return BULLMQ_PRIORITY_VALUES[priority];
}

/**
 * Convert BullMQ priority to our priority level.
 *
 * @param bullmqPriority - BullMQ priority number
 * @returns Our priority level
 */
export function fromBullMQPriority(bullmqPriority: number): JobPriority {
  if (bullmqPriority <= 1) return "critical";
  if (bullmqPriority <= 5) return "high";
  if (bullmqPriority <= 10) return "normal";
  return "low";
}

/**
 * Get SLA for a priority level in milliseconds.
 *
 * @param priority - Priority level
 * @returns Expected SLA in ms
 */
export function getPrioritySLA(priority: JobPriority): number {
  switch (priority) {
    case "critical":
      return 60_000; // 60 seconds
    case "high":
      return 300_000; // 5 minutes
    case "normal":
      return 900_000; // 15 minutes
    case "low":
      return 3_600_000; // 1 hour
  }
}

/**
 * Check if a feature context is a paid feature.
 */
function isPaidFeature(featureContext: string): boolean {
  return PAID_FEATURES.includes(featureContext as (typeof PAID_FEATURES)[number]);
}

/**
 * Get human-readable description for a priority.
 */
export function getPriorityDescription(priority: JobPriority): string {
  switch (priority) {
    case "critical":
      return "User watching screen, requires immediate processing";
    case "high":
      return "User-initiated, async feedback expected within 5 minutes";
    case "normal":
      return "Paid feature, background processing within 15 minutes";
    case "low":
      return "Background task, can take up to 1 hour";
  }
}
