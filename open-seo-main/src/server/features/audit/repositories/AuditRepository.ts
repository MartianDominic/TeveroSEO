/**
 * Data access layer for site audit tables.
 * PostgreSQL operations for audits, audit_pages, and stored Lighthouse results.
 *
 * H-CONC-02: Added optimistic locking for concurrent phase update safety.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { audits, auditLighthouseResults, auditPages } from "@/db/schema";
import { withTransaction, type Transaction } from "@/lib/db/transaction";
import type {
  AuditConfig,
  LighthouseResult,
  StepPageResult,
} from "@/server/lib/audit/types";

/**
 * Error thrown when optimistic lock fails due to concurrent modification.
 * Callers should refresh data and retry.
 */
export class AuditOptimisticLockError extends Error {
  constructor(auditId: string, expectedVersion: number) {
    super(`Audit ${auditId} was modified concurrently (expected version ${expectedVersion})`);
    this.name = "AuditOptimisticLockError";
  }
}

const DB_BATCH_SIZE = 100;

/**
 * Execute database operations in batches with optional transaction context.
 * When a transaction is provided, all operations share the same transaction.
 */
async function executeInBatches<T>(
  items: T[],
  buildStatement: (item: T, tx?: Transaction) => Promise<unknown>,
  tx?: Transaction,
) {
  for (let i = 0; i < items.length; i += DB_BATCH_SIZE) {
    const chunk = items.slice(i, i + DB_BATCH_SIZE);
    await Promise.all(chunk.map((item) => buildStatement(item, tx)));
  }
}

async function createAudit(data: {
  id: string;
  projectId: string;
  startedByUserId: string;
  startUrl: string;
  workflowInstanceId: string;
  config: AuditConfig;
  pagesTotal: number;
  lighthouseTotal: number;
  clientId?: string | null;
}) {
  await db.insert(audits).values({
    id: data.id,
    projectId: data.projectId,
    startedByUserId: data.startedByUserId,
    startUrl: data.startUrl,
    workflowInstanceId: data.workflowInstanceId,
    config: data.config,
    status: "running",
    pagesTotal: data.pagesTotal,
    lighthouseTotal: data.lighthouseTotal,
    currentPhase: "discovery",
    clientId: data.clientId ?? null,
  });
}

async function updateAuditProgress(
  auditId: string,
  workflowInstanceId: string,
  data: {
    pagesCrawled?: number;
    pagesTotal?: number;
    lighthouseTotal?: number;
    lighthouseCompleted?: number;
    lighthouseFailed?: number;
    currentPhase?: string;
  },
) {
  await db
    .update(audits)
    .set({
      ...data,
      version: sql`COALESCE(${audits.version}, 1) + 1`,
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
      ),
    );
}

/**
 * Update audit progress with optimistic locking.
 * H-CONC-02: Prevents race conditions in concurrent phase updates.
 *
 * @param auditId - Audit ID to update
 * @param workflowInstanceId - Workflow instance ID for additional safety
 * @param expectedVersion - Version the caller expects (from their read)
 * @param data - Progress data to update
 * @returns true if update succeeded, false if version mismatch
 * @throws AuditOptimisticLockError if version mismatch (caller can refresh and retry)
 */
async function updateAuditProgressWithVersion(
  auditId: string,
  workflowInstanceId: string,
  expectedVersion: number,
  data: {
    pagesCrawled?: number;
    pagesTotal?: number;
    lighthouseTotal?: number;
    lighthouseCompleted?: number;
    lighthouseFailed?: number;
    currentPhase?: string;
  },
): Promise<boolean> {
  const result = await db
    .update(audits)
    .set({
      ...data,
      version: sql`COALESCE(${audits.version}, 1) + 1`,
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
        eq(audits.version, expectedVersion), // Optimistic lock check
      ),
    )
    .returning({ id: audits.id });

  if (result.length === 0) {
    throw new AuditOptimisticLockError(auditId, expectedVersion);
  }

  return true;
}

async function completeAudit(
  auditId: string,
  workflowInstanceId: string,
  data: {
    pagesCrawled: number;
    pagesTotal: number;
  },
) {
  await db
    .update(audits)
    .set({
      status: "completed",
      completedAt: new Date(),
      currentPhase: "completed",
      ...data,
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
      ),
    );
}

async function failAudit(auditId: string, workflowInstanceId: string) {
  await db
    .update(audits)
    .set({
      status: "failed",
      completedAt: new Date(),
      currentPhase: "failed",
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
      ),
    );
}

/**
 * Cancel a running audit.
 * H-AUDIT-01: User-visible cancellation for stuck audits.
 */
async function cancelAudit(auditId: string, workflowInstanceId: string) {
  await db
    .update(audits)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      currentPhase: "cancelled",
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
      ),
    );
}

/**
 * Reset audit for retry.
 * M-AUDIT-02: Retry UI for failed audits.
 */
async function resetAuditForRetry(auditId: string, workflowInstanceId: string) {
  const newWorkflowInstanceId = `${auditId}-retry-${Date.now()}`;
  await db
    .update(audits)
    .set({
      status: "running",
      completedAt: null,
      currentPhase: "discovery",
      pagesCrawled: 0,
      lighthouseCompleted: 0,
      lighthouseFailed: 0,
      workflowInstanceId: newWorkflowInstanceId,
    })
    .where(
      and(
        eq(audits.id, auditId),
        eq(audits.workflowInstanceId, workflowInstanceId),
      ),
    );
}

async function getAuditForWorkflow(
  auditId: string,
  workflowInstanceId: string,
) {
  return db.query.audits.findFirst({
    where: and(
      eq(audits.id, auditId),
      eq(audits.workflowInstanceId, workflowInstanceId),
    ),
  });
}

/**
 * Write audit pages and lighthouse results atomically.
 * Uses a transaction to ensure both inserts succeed or fail together,
 * preventing partial data from being written on error.
 */
async function batchWriteResults(
  auditId: string,
  pages: StepPageResult[],
  lighthouseResults: LighthouseResult[],
) {
  await withTransaction(async (tx) => {
    await executeInBatches(
      pages,
      (page, txCtx) =>
        (txCtx ?? db).insert(auditPages).values({
          id: page.id,
          auditId,
          url: page.url,
          statusCode: page.statusCode,
          redirectUrl: page.redirectUrl,
          title: page.title,
          metaDescription: page.metaDescription,
          canonicalUrl: page.canonicalUrl,
          robotsMeta: page.robotsMeta,
          ogTitle: page.ogTitle,
          ogDescription: page.ogDescription,
          ogImage: page.ogImage,
          h1Count: page.h1Count,
          h2Count: page.h2Count,
          h3Count: page.h3Count,
          h4Count: page.h4Count,
          h5Count: page.h5Count,
          h6Count: page.h6Count,
          headingOrderJson: page.headingOrder,
          wordCount: page.wordCount,
          imagesTotal: page.imagesTotal,
          imagesMissingAlt: page.imagesMissingAlt,
          imagesJson: page.images,
          internalLinkCount: page.internalLinks.length,
          externalLinkCount: page.externalLinks.length,
          hasStructuredData: page.hasStructuredData,
          hreflangTagsJson: page.hreflangTags,
          isIndexable: page.isIndexable,
          responseTimeMs: page.responseTimeMs,
        }),
      tx,
    );

    if (lighthouseResults.length === 0) {
      return;
    }

    await executeInBatches(
      lighthouseResults,
      (result, txCtx) =>
        (txCtx ?? db).insert(auditLighthouseResults).values({
          id: crypto.randomUUID(),
          auditId,
          pageId: result.pageId,
          strategy: result.strategy,
          performanceScore: result.performanceScore,
          accessibilityScore: result.accessibilityScore,
          bestPracticesScore: result.bestPracticesScore,
          seoScore: result.seoScore,
          lcpMs: result.lcpMs,
          cls: result.cls,
          inpMs: result.inpMs,
          ttfbMs: result.ttfbMs,
          errorMessage: result.errorMessage ?? null,
          r2Key: result.r2Key ?? null,
          payloadSizeBytes: result.payloadSizeBytes ?? null,
        }),
      tx,
    );
  });
}

async function getAuditForProject(auditId: string, projectId: string) {
  return db.query.audits.findFirst({
    where: and(eq(audits.id, auditId), eq(audits.projectId, projectId)),
  });
}

/**
 * Get audits for a project.
 * Phase 69-03: Added default limit to prevent unbounded queries.
 */
async function getAuditsByProject(
  projectId: string,
  opts?: { clientId?: string | null; limit?: number; offset?: number },
) {
  const { limit = 100, offset = 0 } = opts ?? {};
  const whereClause = opts?.clientId
    ? and(eq(audits.projectId, projectId), eq(audits.clientId, opts.clientId))
    : eq(audits.projectId, projectId);

  const rows = await db
    .select({ audit: audits })
    .from(audits)
    .where(whereClause)
    .orderBy(desc(audits.startedAt))
    .limit(limit)
    .offset(offset);

  return rows.map(({ audit }) => audit);
}

async function getAuditCapacityUsageForUser(userId: string) {
  const rows = await db.query.audits.findMany({
    where: eq(audits.startedByUserId, userId),
    columns: {
      pagesTotal: true,
      lighthouseTotal: true,
    },
  });

  return rows.reduce(
    (total, row) => total + row.pagesTotal + row.lighthouseTotal,
    0,
  );
}

async function getAuditResultsForProject(auditId: string, projectId: string) {
  const audit = await getAuditForProject(auditId, projectId);
  if (!audit) {
    return { audit: null, pages: [], lighthouse: [] };
  }

  const [pages, lighthouse] = await Promise.all([
    db.query.auditPages.findMany({
      where: eq(auditPages.auditId, auditId),
    }),
    db.query.auditLighthouseResults.findMany({
      where: eq(auditLighthouseResults.auditId, auditId),
    }),
  ]);

  return { audit, pages, lighthouse };
}

async function getLighthouseResultById(input: {
  lighthouseResultId: string;
  projectId: string;
}) {
  const lighthouse = await db.query.auditLighthouseResults.findFirst({
    where: eq(auditLighthouseResults.id, input.lighthouseResultId),
  });

  if (!lighthouse) {
    return null;
  }

  const [parentAudit, page] = await Promise.all([
    db.query.audits.findFirst({
      where: and(
        eq(audits.id, lighthouse.auditId),
        eq(audits.projectId, input.projectId),
      ),
    }),
    db.query.auditPages.findFirst({
      where: eq(auditPages.id, lighthouse.pageId),
    }),
  ]);

  if (!parentAudit) {
    return null;
  }

  return {
    lighthouse,
    page,
    audit: parentAudit,
  };
}

async function deleteAuditForProject(auditId: string, projectId: string) {
  await db
    .delete(audits)
    .where(and(eq(audits.id, auditId), eq(audits.projectId, projectId)));
}

export const AuditRepository = {
  createAudit,
  updateAuditProgress,
  updateAuditProgressWithVersion,
  completeAudit,
  failAudit,
  cancelAudit,
  resetAuditForRetry,
  getAuditForWorkflow,
  batchWriteResults,
  getAuditForProject,
  getAuditsByProject,
  getAuditCapacityUsageForUser,
  getAuditResultsForProject,
  getLighthouseResultById,
  deleteAuditForProject,
} as const;
