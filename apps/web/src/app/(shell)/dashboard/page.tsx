import { PageHeader } from "@tevero/ui";
import { DashboardTable } from "@/components/analytics/DashboardTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins
} from "./actions";
import type { DashboardClient } from "@/lib/analytics/types";

// Temporary: Convert new metrics to legacy DashboardClient format
// until we fully migrate to the new data structure
function convertToLegacyFormat(metrics: Awaited<ReturnType<typeof getDashboardMetrics>>): DashboardClient[] {
  return metrics.map(m => ({
    id: m.clientId,
    name: m.clientName,
    clicks_30d: m.trafficCurrent,
    impressions_30d: 0, // Not tracked in new schema yet
    avg_position: 0, // Not tracked in new schema yet
    wow_change: m.trafficTrendPct,
    status: m.healthScore < 40 ? "drop" :
            m.connectionStatus === "stale" ? "stale" :
            m.connectionStatus === "disconnected" ? "no_gsc" : "good",
    last_sync: m.computedAt,
  }));
}

export default async function DashboardPage() {
  // Fetch all dashboard data in parallel
  const [metrics, summary, attentionItems, wins] = await Promise.all([
    getDashboardMetrics(),
    getPortfolioSummary(),
    getAttentionItems(),
    getWins(),
  ]);

  // Convert to legacy format for existing table component
  const clients = convertToLegacyFormat(metrics);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Agency Command Center"
        subtitle="Portfolio health overview and actionable insights"
      />

      {/* Portfolio Health Summary */}
      <section>
        <PortfolioHealthSummary summary={summary} />
      </section>

      {/* Needs Attention + Wins (side by side on large screens) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeedsAttentionSection items={attentionItems} />
        <WinsMilestonesSection wins={wins} />
      </section>

      {/* Client Portfolio Table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          All Clients ({clients.length})
        </h2>
        <DashboardTable clients={clients} />
      </section>
    </div>
  );
}
