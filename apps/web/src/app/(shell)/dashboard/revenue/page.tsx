import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { PageHeader } from "@tevero/ui";
import { Skeleton } from "@tevero/ui";
import { WithErrorBoundary } from "@/components/with-error-boundary";
import { RevenueCards } from "@/components/revenue/RevenueCards";
import { MrrMovementBreakdown } from "@/components/revenue/MrrMovementBreakdown";
import { OutstandingPayments } from "@/components/revenue/OutstandingPayments";
import { RevenueTrendChart } from "@/components/revenue/RevenueTrendChart";
import { ChurnRiskAlerts } from "@/components/revenue/ChurnRiskAlerts";
import { RevenueViewToggle } from "./RevenueViewToggle";
import {
  getRevenueMetrics,
  getOutstandingPayments,
  getMonthlyRevenueData,
  getMrrTrend,
} from "@/lib/api/revenue";
import { getChurnRisks } from "@/lib/api/churn";

/**
 * Generate trend data for different periods.
 */
function generateTrendData(
  fullData: Array<{ month: string; mrr: number }>,
  months: number
): Array<{ month: string; mrr: number }> {
  return fullData.slice(-months);
}

/**
 * Revenue Dashboard Page
 * Phase 51-01: MRR & Retention Dashboard
 *
 * Implements:
 * - D-12: 4 metric cards, MRR movement breakdown, trend chart
 * - D-16: Outstanding payments with urgency grouping
 * - D-17: Recognized vs cash received toggle
 * - D-18-21: Churn risk alerts
 */
export default async function RevenuePage() {
  // Get workspace context
  const { orgId, userId } = await auth();
  const workspaceId = orgId || userId || "default-workspace";

  // Fetch all dashboard data in parallel
  const [metrics, outstandingPayments, monthlyData, mrrTrend, churnRisks] =
    await Promise.all([
      getRevenueMetrics().catch((error) => {
        console.error("[RevenuePage] getRevenueMetrics failed:", error);
        return {
          mrr: {
            currentMrr: 0,
            newMrr: 0,
            expansionMrr: 0,
            churnMrr: 0,
            displayCurrency: "EUR",
          },
          oneTimeRevenue: 0,
          collectedThisMonth: 0,
          outstanding: 0,
          displayCurrency: "EUR",
        };
      }),
      getOutstandingPayments().catch((error) => {
        console.error("[RevenuePage] getOutstandingPayments failed:", error);
        return [];
      }),
      getMonthlyRevenueData(12).catch((error) => {
        console.error("[RevenuePage] getMonthlyRevenueData failed:", error);
        return [];
      }),
      getMrrTrend(6).catch((error) => {
        console.error("[RevenuePage] getMrrTrend failed:", error);
        return [];
      }),
      getChurnRisks().catch((error) => {
        console.error("[RevenuePage] getChurnRisks failed:", error);
        return [];
      }),
    ]);

  // Calculate MRR delta for card display
  const previousMrr = mrrTrend.length > 1 ? mrrTrend[mrrTrend.length - 2] : 0;
  const currentMrr = metrics.mrr.currentMrr;
  const mrrDeltaPercent =
    previousMrr > 0
      ? Math.round(((currentMrr - previousMrr) / previousMrr) * 1000) / 10
      : 0;

  const mrrDelta = {
    value: Math.abs(mrrDeltaPercent),
    direction: (mrrDeltaPercent > 0
      ? "up"
      : mrrDeltaPercent < 0
        ? "down"
        : "flat") as "up" | "down" | "flat",
    period: "vs last month",
  };

  // Generate trend data for different periods
  const data3m = generateTrendData(monthlyData, 3);
  const data6m = generateTrendData(monthlyData, 6);
  const data12m = generateTrendData(monthlyData, 12);

  // Handle actions (these would be server actions in production)
  const handleSendReminder = (invoiceId: string) => {
    console.log("Send reminder for invoice:", invoiceId);
  };

  const handleLogCall = (invoiceId: string) => {
    console.log("Log call for invoice:", invoiceId);
  };

  const handleViewInvoice = (invoiceId: string) => {
    console.log("View invoice:", invoiceId);
  };

  const handleViewClient = (clientId: string) => {
    console.log("View client:", clientId);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header with D-17 toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Revenue Dashboard"
          subtitle="Track MRR, payments, and retention"
        />
        <RevenueViewToggle />
      </div>

      {/* D-12: 4 Metric Cards */}
      <section>
        <WithErrorBoundary name="RevenueCards">
          <RevenueCards
            mrrCents={metrics.mrr.currentMrr}
            oneTimeCents={metrics.oneTimeRevenue}
            collectedCents={metrics.collectedThisMonth}
            outstandingCents={metrics.outstanding}
            currency={metrics.displayCurrency}
            mrrTrend={mrrTrend}
            mrrDelta={mrrDelta}
          />
        </WithErrorBoundary>
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: MRR breakdown + Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* D-12: MRR Movement Breakdown */}
          <WithErrorBoundary name="MrrMovementBreakdown">
            <MrrMovementBreakdown
              newMrrCents={metrics.mrr.newMrr}
              expansionMrrCents={metrics.mrr.expansionMrr}
              churnMrrCents={metrics.mrr.churnMrr}
              currency={metrics.displayCurrency}
            />
          </WithErrorBoundary>

          {/* D-12: Trend Chart with 3/6/12 month toggle */}
          <WithErrorBoundary name="RevenueTrendChart">
            <RevenueTrendChart
              data3m={data3m}
              data6m={data6m}
              data12m={data12m}
              currency={metrics.displayCurrency}
            />
          </WithErrorBoundary>
        </div>

        {/* Right column: Outstanding + Churn */}
        <div className="space-y-6">
          {/* D-16: Outstanding Payments */}
          <WithErrorBoundary name="OutstandingPayments">
            <OutstandingPayments
              payments={outstandingPayments}
              onSendReminder={handleSendReminder}
              onLogCall={handleLogCall}
              onViewInvoice={handleViewInvoice}
            />
          </WithErrorBoundary>

          {/* D-18-21: Churn Risk Alerts */}
          <WithErrorBoundary name="ChurnRiskAlerts">
            <ChurnRiskAlerts risks={churnRisks} onViewClient={handleViewClient} />
          </WithErrorBoundary>
        </div>
      </div>
    </div>
  );
}
