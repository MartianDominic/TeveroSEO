import { PageHeader } from "@tevero/ui";
import { ClientPortfolioTable } from "@/components/dashboard/ClientPortfolioTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins
} from "./actions";

export default async function DashboardPage() {
  // Fetch all dashboard data in parallel
  const [metrics, summary, attentionItems, wins] = await Promise.all([
    getDashboardMetrics(),
    getPortfolioSummary(),
    getAttentionItems(),
    getWins(),
  ]);

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
          Client Portfolio ({metrics.length})
        </h2>
        <ClientPortfolioTable clients={metrics} />
      </section>
    </div>
  );
}
