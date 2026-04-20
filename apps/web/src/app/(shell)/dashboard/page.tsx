import { PageHeader } from "@tevero/ui";
import { ClientPortfolioTable } from "@/components/dashboard/ClientPortfolioTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStatsCards } from "@/components/dashboard/QuickStatsCards";
import { TableControls } from "@/components/dashboard/TableControls";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { TeamWorkloadSection } from "@/components/dashboard/TeamWorkloadSection";
import { UpcomingScheduledSection } from "@/components/dashboard/UpcomingScheduledSection";
import { PowerUserFeatures } from "@/components/dashboard/PowerUserFeatures";
import { DashboardViewProvider } from "@/components/dashboard/DashboardViewProvider";
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins,
  getCardLayout,
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
    teamWorkload,
    upcomingScheduled,
  ] = await Promise.all([
    getDashboardMetrics(),
    getPortfolioSummary(),
    getAttentionItems(),
    getWins(),
    getCardLayout(),
    getTeamWorkload(),
    getUpcomingScheduled(),
  ]);

  // TODO: Get workspace ID from Clerk auth context
  const workspaceId = "default-workspace";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Power user keyboard features (Cmd+K, ?) */}
      <PowerUserFeatures clients={metrics} />

      {/* Header with title and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Agency Command Center"
          subtitle="Portfolio health overview and actionable insights"
        />
        <ExportButton />
      </div>

      {/* Table controls with saved views, filters, and column customization */}
      <DashboardViewProvider workspaceId={workspaceId} />

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Client Portfolio ({metrics.length})
            </h2>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Cmd+K</kbd>
              <span>Search</span>
              <span className="mx-1">|</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">?</kbd>
              <span>Shortcuts</span>
            </div>
          </div>
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
