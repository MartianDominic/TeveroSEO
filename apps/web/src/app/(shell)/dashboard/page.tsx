import { PageHeader } from "@tevero/ui";
import { ClientPortfolioTable } from "@/components/dashboard/ClientPortfolioTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStatsCards } from "@/components/dashboard/QuickStatsCards";
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins,
  getCardLayout
} from "./actions";

export default async function DashboardPage() {
  // Fetch all dashboard data in parallel
  const [metrics, summary, attentionItems, wins, cardLayout] = await Promise.all([
    getDashboardMetrics(),
    getPortfolioSummary(),
    getAttentionItems(),
    getWins(),
    getCardLayout(),
  ]);

  // TODO: Get workspace ID from Clerk auth context
  const workspaceId = "default-workspace";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="Agency Command Center"
        subtitle="Portfolio health overview and actionable insights"
      />

      {/* Quick Stats Cards - drag and drop */}
      <section>
        <QuickStatsCards summary={summary} initialLayout={cardLayout ?? undefined} />
      </section>

      {/* Portfolio Health Summary */}
      <section>
        <PortfolioHealthSummary summary={summary} />
      </section>

      {/* Needs Attention + Wins (side by side on large screens) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeedsAttentionSection items={attentionItems} />
        <WinsMilestonesSection wins={wins} />
      </section>

      {/* Client Portfolio Table + Activity Feed (side by side on large screens) */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Client Portfolio ({metrics.length})
          </h2>
          <ClientPortfolioTable clients={metrics} />
        </div>
        <div>
          <ActivityFeed workspaceId={workspaceId} />
        </div>
      </section>
    </div>
  );
}
