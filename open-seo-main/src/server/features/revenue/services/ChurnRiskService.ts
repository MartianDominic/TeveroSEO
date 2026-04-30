/**
 * Churn risk signal aggregation service.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * Implements:
 * - D-18: Service period ending warnings (30/60/90 days)
 * - D-19: No contact logged in X days
 * - D-20: Deliverables overdue
 * - D-21: SEO metrics declining (placeholder for GSC integration)
 */
import { eq, and, gte, lte, lt, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { contracts } from "@/db/contract-schema";
import { pipelineActivities } from "@/db/activity-schema";
import { clients } from "@/db/client-schema";
import { addDays, differenceInDays, subDays } from "date-fns";

/**
 * Types of churn risk signals.
 */
export type ChurnRiskType =
  | "service_ending" // D-18
  | "no_contact" // D-19
  | "deliverables_overdue" // D-20
  | "seo_declining"; // D-21

/**
 * Severity levels for churn risks.
 */
export type ChurnRiskSeverity = "high" | "medium" | "low";

/**
 * Churn risk alert structure.
 */
export interface ChurnRisk {
  id: string;
  type: ChurnRiskType;
  severity: ChurnRiskSeverity;
  clientId: string;
  clientName: string;
  description: string;
  daysUntilOrSince: number;
  entityType?: string;
  entityId?: string;
}

/**
 * D-18: Get contracts/services expiring within window.
 * Severity: 30 days = high, 60 days = medium, 90 days = low
 */
export async function getExpiringServices(
  workspaceId: string,
  windowDays: number = 90
): Promise<ChurnRisk[]> {
  const now = new Date();
  const windowEnd = addDays(now, windowDays);

  const expiring = await db
    .select({
      contract: contracts,
      client: clients,
    })
    .from(contracts)
    .leftJoin(clients, eq(contracts.clientId, clients.id))
    .where(
      and(
        eq(contracts.workspaceId, workspaceId),
        eq(contracts.status, "executed"),
        lte(contracts.expiresAt, windowEnd),
        gte(contracts.expiresAt, now)
      )
    );

  return expiring.map(({ contract, client }) => {
    const daysUntil = differenceInDays(contract.expiresAt!, now);

    let severity: ChurnRiskSeverity = "low";
    if (daysUntil <= 30) severity = "high";
    else if (daysUntil <= 60) severity = "medium";

    return {
      id: `expiring_${contract.id}`,
      type: "service_ending",
      severity,
      clientId: contract.clientId || "",
      clientName: client?.name || "Unknown Client",
      description: `Contract expires in ${daysUntil} days`,
      daysUntilOrSince: daysUntil,
      entityType: "contract",
      entityId: contract.id,
    };
  });
}

/**
 * D-19: Get clients with no contact logged within threshold.
 * Severity: 30+ days = high, 21+ days = medium, 14+ days = low
 */
export async function getInactiveClients(
  workspaceId: string,
  inactiveDays: number = 14
): Promise<ChurnRisk[]> {
  const cutoff = subDays(new Date(), inactiveDays);

  // Get all active clients for this workspace
  const activeClients = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        eq(clients.status, "active"),
        eq(clients.isDeleted, false)
      )
    );

  const risks: ChurnRisk[] = [];

  for (const client of activeClients) {
    // Get latest activity for this client
    const activities = await db
      .select()
      .from(pipelineActivities)
      .where(
        and(
          eq(pipelineActivities.workspaceId, workspaceId),
          eq(pipelineActivities.entityType, "client"),
          eq(pipelineActivities.entityId, client.id)
        )
      )
      .orderBy(desc(pipelineActivities.createdAt))
      .limit(1);

    const lastActivity = activities[0];
    const lastContactDate = lastActivity?.createdAt || client.createdAt;

    if (lastContactDate < cutoff) {
      const daysSince = differenceInDays(new Date(), lastContactDate);

      let severity: ChurnRiskSeverity = "low";
      if (daysSince >= 30) severity = "high";
      else if (daysSince >= 21) severity = "medium";

      risks.push({
        id: `inactive_${client.id}`,
        type: "no_contact",
        severity,
        clientId: client.id,
        clientName: client.name,
        description: `No contact logged in ${daysSince} days`,
        daysUntilOrSince: daysSince,
        entityType: "client",
        entityId: client.id,
      });
    }
  }

  return risks;
}

/**
 * D-20: Get overdue deliverables/tasks.
 * Note: Tasks table may not exist yet - returns empty for now.
 * Severity: 14+ days = high, 7+ days = medium, <7 days = low
 */
export async function getOverdueDeliverables(
  workspaceId: string
): Promise<ChurnRisk[]> {
  // Tasks table doesn't exist yet - return empty
  // When tasks table is added, implement:
  // - Query tasks where completedAt is null and dueAt < now
  // - Join with clients for client name
  // - Calculate days overdue
  // - Assign severity based on days overdue

  return [];
}

/**
 * D-21: Get clients with declining SEO metrics.
 * Placeholder - requires GSC integration to detect ranking/traffic drops.
 */
export async function getDecliningMetrics(
  workspaceId: string
): Promise<ChurnRisk[]> {
  // TODO: Integrate with GSC data to detect:
  // - Significant traffic drop (>20% vs previous period)
  // - Multiple keyword ranking drops
  // - Domain visibility decline

  // For now, return empty array
  return [];
}

/**
 * Aggregate all churn risks for a workspace.
 * Sorted by severity (high first), then by days.
 */
export async function getChurnRisks(
  workspaceId: string
): Promise<ChurnRisk[]> {
  const [expiring, inactive, overdue, declining] = await Promise.all([
    getExpiringServices(workspaceId),
    getInactiveClients(workspaceId),
    getOverdueDeliverables(workspaceId),
    getDecliningMetrics(workspaceId),
  ]);

  const allRisks = [...expiring, ...inactive, ...overdue, ...declining];

  // Sort by severity (high first), then by days
  const severityOrder: Record<ChurnRiskSeverity, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return allRisks.sort((a, b) => {
    if (a.severity !== b.severity) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    // Within same severity, sort by urgency (days ascending for expiring, descending for inactive)
    if (a.type === "service_ending" && b.type === "service_ending") {
      return a.daysUntilOrSince - b.daysUntilOrSince; // Sooner expiry first
    }
    return b.daysUntilOrSince - a.daysUntilOrSince; // Longer inactive first
  });
}

/**
 * Get churn risk summary counts.
 */
export async function getChurnRiskSummary(
  workspaceId: string
): Promise<{
  total: number;
  high: number;
  medium: number;
  low: number;
  byType: Record<ChurnRiskType, number>;
}> {
  const risks = await getChurnRisks(workspaceId);

  const summary = {
    total: risks.length,
    high: 0,
    medium: 0,
    low: 0,
    byType: {
      service_ending: 0,
      no_contact: 0,
      deliverables_overdue: 0,
      seo_declining: 0,
    } as Record<ChurnRiskType, number>,
  };

  for (const risk of risks) {
    summary[risk.severity]++;
    summary.byType[risk.type]++;
  }

  return summary;
}

/**
 * ChurnRiskService aggregated export.
 */
export const ChurnRiskService = {
  getExpiringServices,
  getInactiveClients,
  getOverdueDeliverables,
  getDecliningMetrics,
  getChurnRisks,
  getChurnRiskSummary,
};
