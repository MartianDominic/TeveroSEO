/**
 * Crawl Lane Router - Routes jobs to appropriate queue based on type.
 *
 * Per 64-RESEARCH.md Pattern 2:
 * - Type A (FULL_AUDIT) -> heavy-crawl queue (auditQueue, <15 min SLA)
 * - Types B/C/D/E/F -> fast-api queue (<1 min SLA)
 *
 * Separate queues ensure SLA isolation. Heavy audits cannot block fast operations.
 *
 * Per T-64-07 (Tampering): Validates job type before routing; rejects unknown types.
 *
 * @module crawlLaneRouter
 */

import { auditQueue, type AuditJobData, AUDIT_STEP } from "./auditQueue";
import {
  fastApiQueue,
  FAST_API_QUEUE_NAME,
  type FastApiJobData,
  type FastApiJobType,
} from "./fastApiQueue";

/**
 * Job type constants per CONTEXT.md.
 */
export const JobType = {
  /** Full site audit - heavy crawl lane (<15 min SLA) */
  FULL_AUDIT: "A",
  /** Competitor snapshot - fast API lane (<1 min SLA) */
  COMPETITOR_SNAPSHOT: "B",
  /** Keyword gap analysis - fast API lane (<1 min SLA) */
  KEYWORD_GAP: "C",
  /** Backlink profile - fast API lane (<1 min SLA) */
  BACKLINK_PROFILE: "D",
  /** Content gap analysis - fast API lane (<1 min SLA) */
  CONTENT_GAP: "E",
  /** Local SEO analysis - fast API lane (<1 min SLA) */
  LOCAL_SEO: "F",
} as const;

export type JobTypeValue = (typeof JobType)[keyof typeof JobType];

/**
 * All valid job type values for runtime validation.
 */
const VALID_JOB_TYPES = new Set<string>(Object.values(JobType));

/**
 * Fast API job types (everything except Type A).
 */
const FAST_API_TYPES = new Set<string>(["B", "C", "D", "E", "F"]);

/**
 * Routing result returned by routeJob.
 */
export interface RouteResult {
  /** Job ID from BullMQ */
  jobId: string;
  /** Which lane the job was routed to */
  lane: "heavy-crawl" | "fast-api";
}

/**
 * Data for heavy-crawl jobs (Type A).
 */
export interface HeavyCrawlJobInput {
  projectId: string;
  url: string;
  tenantId: string;
  config: {
    maxPages?: number;
    depth?: number;
    [key: string]: unknown;
  };
  auditId?: string;
}

/**
 * Data for fast-api jobs (Types B/C/D/E/F).
 */
export interface FastApiJobInput {
  projectId: string;
  url: string;
  tenantId: string;
  payload: Record<string, unknown>;
}

/**
 * Union of all job inputs.
 */
export type JobInput = HeavyCrawlJobInput | FastApiJobInput;

/**
 * Validate and coerce a string to a JobTypeValue.
 *
 * @param type - String to validate
 * @returns Valid JobTypeValue
 * @throws Error if type is not a valid job type
 */
export function determineJobType(type: string): JobTypeValue {
  if (!type || !VALID_JOB_TYPES.has(type)) {
    throw new Error(
      `Invalid job type: "${type}". Valid types: ${Array.from(VALID_JOB_TYPES).join(", ")}`
    );
  }
  return type as JobTypeValue;
}

/**
 * Route a job to the appropriate queue based on its type.
 *
 * Type A (FULL_AUDIT) routes to heavy-crawl queue (auditQueue).
 * Types B/C/D/E/F route to fast-api queue.
 *
 * @param type - Job type (A, B, C, D, E, or F)
 * @param data - Job data (structure depends on job type)
 * @returns RouteResult with jobId and lane
 * @throws Error if job type is invalid
 *
 * @example
 * ```typescript
 * // Route a full audit to heavy-crawl queue
 * const result = await routeJob("A", {
 *   projectId: "proj-123",
 *   url: "https://example.com",
 *   tenantId: "tenant-456",
 *   config: { maxPages: 500 },
 * });
 * // result.lane === "heavy-crawl"
 *
 * // Route a competitor snapshot to fast-api queue
 * const result = await routeJob("B", {
 *   projectId: "proj-123",
 *   url: "https://competitor.com",
 *   tenantId: "tenant-456",
 *   payload: { competitorUrls: ["..."] },
 * });
 * // result.lane === "fast-api"
 * ```
 */
export async function routeJob(
  type: JobTypeValue,
  data: JobInput
): Promise<RouteResult> {
  // Validate job type at runtime (T-64-07 mitigation)
  if (!VALID_JOB_TYPES.has(type)) {
    throw new Error(
      `Invalid job type: "${type}". Valid types: ${Array.from(VALID_JOB_TYPES).join(", ")}`
    );
  }

  const enqueuedAt = Date.now();

  // Type A -> heavy-crawl queue (auditQueue)
  if (type === "A") {
    const heavyData = data as HeavyCrawlJobInput;

    // Build base audit job data
    // AuditConfig only has maxPages and lighthouseStrategy
    // BillingCustomerContext needs organizationId and userId
    const baseAuditData: AuditJobData = {
      auditId: heavyData.auditId || `audit-${Date.now()}`,
      projectId: heavyData.projectId,
      startUrl: heavyData.url,
      config: {
        maxPages: heavyData.config.maxPages ?? 500,
        lighthouseStrategy: "auto",
      },
      billingCustomer: {
        organizationId: heavyData.tenantId,
        userId: "system",
        projectId: heavyData.projectId,
      },
      step: AUDIT_STEP.DISCOVER,
    };

    // Add routing metadata using spread (BullMQ accepts extra fields)
    const auditJobData = {
      ...baseAuditData,
      lane: "heavy-crawl" as const,
      enqueuedAt,
      jobType: type,
    };

    const job = await auditQueue.add(
      `audit:${heavyData.projectId}:${enqueuedAt}`,
      auditJobData
    );

    return {
      jobId: job.id || "unknown",
      lane: "heavy-crawl",
    };
  }

  // Types B/C/D/E/F -> fast-api queue
  if (FAST_API_TYPES.has(type)) {
    const fastData = data as FastApiJobInput;
    const fastApiJobData: FastApiJobData = {
      type: type as FastApiJobType,
      projectId: fastData.projectId,
      url: fastData.url,
      tenantId: fastData.tenantId,
      payload: fastData.payload,
      lane: "fast-api",
      enqueuedAt,
      jobType: type as FastApiJobType,
    };

    const job = await fastApiQueue.add(
      `${FAST_API_QUEUE_NAME}:${type}:${fastData.projectId}:${enqueuedAt}`,
      fastApiJobData
    );

    return {
      jobId: job.id || "unknown",
      lane: "fast-api",
    };
  }

  // Should never reach here if VALID_JOB_TYPES is correct
  throw new Error(`Unhandled job type: "${type}"`);
}
