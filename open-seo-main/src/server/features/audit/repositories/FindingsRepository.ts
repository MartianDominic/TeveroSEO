/**
 * Data access layer for audit check findings.
 * Phase 32: 107 SEO Checks Implementation
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditFindings, audits, auditPages } from "@/db/schema";
import type { CheckResult, CheckCategory } from "@/server/lib/audit/checks/types";
import { AppError } from "@/server/lib/errors";

const DB_BATCH_SIZE = 100;

/**
 * Extract tier number from check ID (e.g., "T1-01" -> 1)
 */
function getTierFromCheckId(checkId: string): number {
  const match = checkId.match(/^T(\d)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Verify that an audit belongs to the specified client.
 * Throws FORBIDDEN if the audit doesn't exist or belongs to a different client.
 */
async function verifyAuditOwnership(auditId: string, clientId: string): Promise<void> {
  const [audit] = await db
    .select({ id: audits.id, clientId: audits.clientId })
    .from(audits)
    .where(eq(audits.id, auditId))
    .limit(1);

  if (!audit) {
    throw new AppError("NOT_FOUND", "Audit not found");
  }

  // If audit has a clientId, it must match the requested clientId
  // Audits without clientId (legacy) are accessible to all authenticated users
  if (audit.clientId && audit.clientId !== clientId) {
    throw new AppError("FORBIDDEN", "Access denied to audit");
  }
}

/**
 * Verify that a page belongs to an audit owned by the specified client.
 * Throws FORBIDDEN if the page/audit doesn't exist or belongs to a different client.
 */
async function verifyPageOwnership(pageId: string, clientId: string): Promise<void> {
  const [page] = await db
    .select({
      id: auditPages.id,
      auditId: auditPages.auditId
    })
    .from(auditPages)
    .where(eq(auditPages.id, pageId))
    .limit(1);

  if (!page) {
    throw new AppError("NOT_FOUND", "Page not found");
  }

  await verifyAuditOwnership(page.auditId, clientId);
}

/**
 * Insert check results as findings for a page.
 */
async function insertFindings(
  auditId: string,
  pageId: string,
  results: CheckResult[],
  category?: CheckCategory
): Promise<void> {
  if (results.length === 0) return;

  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < results.length; i += DB_BATCH_SIZE) {
    const batch = results.slice(i, i + DB_BATCH_SIZE);
    const values = batch.map((result) => ({
      id: crypto.randomUUID(),
      auditId,
      pageId,
      checkId: result.checkId,
      tier: getTierFromCheckId(result.checkId),
      category: category ?? "unknown",
      passed: result.passed,
      severity: result.severity,
      message: result.message,
      details: result.details ?? null,
      autoEditable: result.autoEditable,
      editRecipe: result.editRecipe ?? null,
    }));

    await db.insert(auditFindings).values(values);
  }
}

/**
 * Get all findings for an audit.
 * @param auditId - The audit ID to fetch findings for
 * @param clientId - Optional client ID for ownership validation. If provided,
 *                   verifies the audit belongs to this client before returning findings.
 */
async function getFindingsByAudit(auditId: string, clientId?: string) {
  // If clientId is provided, verify ownership first
  if (clientId) {
    await verifyAuditOwnership(auditId, clientId);
  }

  return db.query.auditFindings.findMany({
    where: eq(auditFindings.auditId, auditId),
  });
}

/**
 * Get findings for a specific page.
 * @param pageId - The page ID to fetch findings for
 * @param clientId - Optional client ID for ownership validation. If provided,
 *                   verifies the page's audit belongs to this client before returning findings.
 */
async function getFindingsByPage(pageId: string, clientId?: string) {
  // If clientId is provided, verify ownership first
  if (clientId) {
    await verifyPageOwnership(pageId, clientId);
  }

  return db.query.auditFindings.findMany({
    where: eq(auditFindings.pageId, pageId),
  });
}

/**
 * Get failed findings by severity for an audit.
 * @param auditId - The audit ID to fetch findings for
 * @param severity - The severity level to filter by
 * @param clientId - Optional client ID for ownership validation
 */
async function getFailedFindingsBySeverity(auditId: string, severity: string, clientId?: string) {
  // If clientId is provided, verify ownership first
  if (clientId) {
    await verifyAuditOwnership(auditId, clientId);
  }

  return db.query.auditFindings.findMany({
    where: and(
      eq(auditFindings.auditId, auditId),
      eq(auditFindings.severity, severity),
      eq(auditFindings.passed, false)
    ),
  });
}

/**
 * Get all failed findings for an audit.
 * @param auditId - The audit ID to fetch findings for
 * @param clientId - Optional client ID for ownership validation
 */
async function getFailedFindingsByAudit(auditId: string, clientId?: string) {
  // If clientId is provided, verify ownership first
  if (clientId) {
    await verifyAuditOwnership(auditId, clientId);
  }

  return db.query.auditFindings.findMany({
    where: and(
      eq(auditFindings.auditId, auditId),
      eq(auditFindings.passed, false)
    ),
  });
}

/**
 * Delete all findings for an audit.
 * @param auditId - The audit ID to delete findings for
 * @param clientId - Optional client ID for ownership validation
 */
async function deleteFindingsByAudit(auditId: string, clientId?: string): Promise<void> {
  // If clientId is provided, verify ownership first
  if (clientId) {
    await verifyAuditOwnership(auditId, clientId);
  }

  await db.delete(auditFindings).where(eq(auditFindings.auditId, auditId));
}

/**
 * Get finding counts by tier for an audit.
 * @param auditId - The audit ID to count findings for
 * @param clientId - Optional client ID for ownership validation
 */
async function getFindingCountsByTier(auditId: string, clientId?: string): Promise<{
  tier1: { passed: number; failed: number };
  tier2: { passed: number; failed: number };
  tier3: { passed: number; failed: number };
  tier4: { passed: number; failed: number };
}> {
  // Ownership is verified in getFindingsByAudit if clientId is provided
  const findings = await getFindingsByAudit(auditId, clientId);

  const counts = {
    tier1: { passed: 0, failed: 0 },
    tier2: { passed: 0, failed: 0 },
    tier3: { passed: 0, failed: 0 },
    tier4: { passed: 0, failed: 0 },
  };

  for (const finding of findings) {
    const tierKey = `tier${finding.tier}` as keyof typeof counts;
    if (counts[tierKey]) {
      if (finding.passed) {
        counts[tierKey].passed++;
      } else {
        counts[tierKey].failed++;
      }
    }
  }

  return counts;
}

export const FindingsRepository = {
  insertFindings,
  getFindingsByAudit,
  getFindingsByPage,
  getFailedFindingsBySeverity,
  getFailedFindingsByAudit,
  deleteFindingsByAudit,
  getFindingCountsByTier,
} as const;
