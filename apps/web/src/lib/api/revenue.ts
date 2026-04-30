/**
 * Revenue API client for dashboard data fetching.
 * Phase 51-01: MRR & Retention Dashboard
 */

import { auth } from "@clerk/nextjs/server";

/**
 * MRR metrics response type.
 */
export interface MrrMetrics {
  currentMrr: number;
  newMrr: number;
  expansionMrr: number;
  churnMrr: number;
  displayCurrency: string;
}

/**
 * Revenue metrics response type.
 */
export interface RevenueMetrics {
  mrr: MrrMetrics;
  oneTimeRevenue: number;
  collectedThisMonth: number;
  outstanding: number;
  displayCurrency: string;
}

/**
 * Outstanding payment item type.
 */
export interface OutstandingPayment {
  invoiceId: string;
  clientName: string;
  amountCents: number;
  currency: string;
  urgency: "overdue" | "due_this_week" | "upcoming";
  daysOverdue: number;
  dueDate: string | null;
}

/**
 * Get revenue metrics for the dashboard.
 * Server action that fetches from open-seo-main backend.
 */
export async function getRevenueMetrics(
  options?: { recognizedRevenue?: boolean }
): Promise<RevenueMetrics> {
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default";

  // For MVP, return mock data
  // In production, call the RevenueService via internal API
  return {
    mrr: {
      currentMrr: 850000, // 8,500.00 EUR
      newMrr: 150000, // 1,500.00 EUR
      expansionMrr: 50000, // 500.00 EUR
      churnMrr: 75000, // 750.00 EUR
      displayCurrency: "EUR",
    },
    oneTimeRevenue: 250000, // 2,500.00 EUR
    collectedThisMonth: 1050000, // 10,500.00 EUR
    outstanding: 320000, // 3,200.00 EUR
    displayCurrency: "EUR",
  };
}

/**
 * Get outstanding payments grouped by urgency.
 */
export async function getOutstandingPayments(): Promise<OutstandingPayment[]> {
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default";

  // For MVP, return mock data
  // In production, call the RevenueService via internal API
  return [
    {
      invoiceId: "inv_001",
      clientName: "TechCorp GmbH",
      amountCents: 150000,
      currency: "EUR",
      urgency: "overdue",
      daysOverdue: 12,
      dueDate: "2026-04-18",
    },
    {
      invoiceId: "inv_002",
      clientName: "Digital Agency Ltd",
      amountCents: 85000,
      currency: "EUR",
      urgency: "overdue",
      daysOverdue: 5,
      dueDate: "2026-04-25",
    },
    {
      invoiceId: "inv_003",
      clientName: "E-commerce Store",
      amountCents: 45000,
      currency: "EUR",
      urgency: "due_this_week",
      daysOverdue: 0,
      dueDate: "2026-05-02",
    },
    {
      invoiceId: "inv_004",
      clientName: "SaaS Platform Inc",
      amountCents: 40000,
      currency: "EUR",
      urgency: "upcoming",
      daysOverdue: 0,
      dueDate: "2026-05-15",
    },
  ];
}

/**
 * Get MRR trend data for charts.
 */
export async function getMrrTrend(months: number = 6): Promise<number[]> {
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default";

  // For MVP, return mock trend data
  // Shows growth over time
  const baseMrr = 850000;
  const monthlyGrowth = 0.05; // 5% monthly growth

  return Array.from({ length: months }, (_, i) => {
    const factor = Math.pow(1 - monthlyGrowth, months - 1 - i);
    return Math.round(baseMrr * factor);
  });
}

/**
 * Get monthly revenue data for trend chart.
 */
export async function getMonthlyRevenueData(
  months: number = 12
): Promise<Array<{ month: string; mrr: number }>> {
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default";

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const now = new Date();
  const data: Array<{ month: string; mrr: number }> = [];

  const baseMrr = 850000;
  const monthlyGrowth = 0.05;

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now);
    monthDate.setMonth(monthDate.getMonth() - i);

    const factor = Math.pow(1 - monthlyGrowth, i);
    const mrr = Math.round(baseMrr * factor);

    data.push({
      month: monthNames[monthDate.getMonth()],
      mrr,
    });
  }

  return data;
}
