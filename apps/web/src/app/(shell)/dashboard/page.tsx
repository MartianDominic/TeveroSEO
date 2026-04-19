import { PageHeader } from "@tevero/ui";
import { ClientPortfolioTable } from "@/components/dashboard/ClientPortfolioTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStatsCards } from "@/components/dashboard/QuickStatsCards";
import { SavedViewSelector } from "@/components/dashboard/SavedViewSelector";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { TeamWorkloadSection } from "@/components/dashboard/TeamWorkloadSection";
import { UpcomingScheduledSection } from "@/components/dashboard/UpcomingScheduledSection";
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins,
  getCardLayout,
  getSavedViews,
  getTeamWorkload,
  getUpcomingScheduled
} from "./actions";

export default async function DashboardPage() {
  // Fetch all dashboard data in parallel
  const [
    metrics,
    summary,
    attentionItems,
    wins,
    cardLayout,
    savedViews,
    teamWorkload,
    upcomingScheduled,
  ] = await Promise.all([
    getDashboardMetrics(),
    getPortfolioSummary(),
    getAttentionItems(),
    getWins(),
    getCardLayout(),
    getSavedViews(),
    getTeamWorkload(),
    getUpcomingScheduled(),
  ]);

  // TODO: Get workspace ID from Clerk auth context
  const workspaceId = "default-workspace";

  // Default filters for SavedViewSelector
  const defaultFilters = {
    search: "",
    healthRange: [0, 100] as [number, number],
    connectionStatus: [] as ("connected" | "stale" | "disconnected")[],
    tags: [],
    hasAlerts: null,
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header with title, saved views, and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Agency Command Center"
          subtitle="Portfolio health overview and actionable insights"
        />
        <div className="flex items-center gap-2">
          <SavedViewSelector
            views={savedViews}
            currentViewId={null}
            currentFilters={defaultFilters}
            onViewChange={() => {
              // TODO: Implement filter application in client component wrapper
            }}
          />
          <ExportButton />
        </div>
      </div>

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

      {/* Client Portfolio Table + Sidebar (Activity Feed, Team Workload, Upcoming) */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Client Portfolio ({metrics.length})
          </h2>
          <ClientPortfolioTable clients={metrics} />
        </div>
        <div className="space-y-6">
          <ActivityFeed workspaceId={workspaceId} />
          {teamWorkload.length > 0 && (
            <TeamWorkloadSection members={teamWorkload} />
          )}
          <UpcomingScheduledSection items={upcomingScheduled} />
        </div>
      </section>
    </div>
  );
}
