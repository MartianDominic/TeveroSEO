/**
 * Churn risk API client for dashboard data fetching.
 * Phase 51-01: MRR & Retention Dashboard
 */

import { auth } from "@clerk/nextjs/server";

/**
 * Churn risk types per D-18-21.
 */
export type ChurnRiskType =
  | "service_ending" // D-18
  | "no_contact" // D-19
  | "deliverables_overdue" // D-20
  | "seo_declining"; // D-21

/**
 * Churn risk severity levels.
 */
export type ChurnRiskSeverity = "high" | "medium" | "low";

/**
 * Churn risk alert type.
 */
export interface ChurnRisk {
  id: string;
  type: ChurnRiskType;
  severity: ChurnRiskSeverity;
  clientId: string;
  clientName: string;
  description: string;
  daysUntilOrSince: number;
}

/**
 * Get churn risk alerts for the dashboard.
 */
export async function getChurnRisks(): Promise<ChurnRisk[]> {
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default";

  // For MVP, return mock data
  // In production, call the ChurnRiskService via internal API
  return [
    {
      id: "expiring_c001",
      type: "service_ending",
      severity: "high",
      clientId: "client_001",
      clientName: "TechCorp GmbH",
      description: "Contract expires in 28 days",
      daysUntilOrSince: 28,
    },
    {
      id: "inactive_c002",
      type: "no_contact",
      severity: "high",
      clientId: "client_002",
      clientName: "Digital Agency Ltd",
      description: "No contact logged in 32 days",
      daysUntilOrSince: 32,
    },
    {
      id: "expiring_c003",
      type: "service_ending",
      severity: "medium",
      clientId: "client_003",
      clientName: "E-commerce Store",
      description: "Contract expires in 45 days",
      daysUntilOrSince: 45,
    },
    {
      id: "inactive_c004",
      type: "no_contact",
      severity: "medium",
      clientId: "client_004",
      clientName: "Local Business",
      description: "No contact logged in 21 days",
      daysUntilOrSince: 21,
    },
    {
      id: "expiring_c005",
      type: "service_ending",
      severity: "low",
      clientId: "client_005",
      clientName: "SaaS Platform Inc",
      description: "Contract expires in 75 days",
      daysUntilOrSince: 75,
    },
  ];
}

/**
 * Get churn risk summary counts.
 */
export async function getChurnRiskSummary(): Promise<{
  total: number;
  high: number;
  medium: number;
  low: number;
}> {
  const risks = await getChurnRisks();

  const summary = {
    total: risks.length,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const risk of risks) {
    summary[risk.severity]++;
  }

  return summary;
}
