import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@tevero/ui";
import { ClientPortfolioTable } from "@/components/dashboard/ClientPortfolioTable";
import { PortfolioHealthSummary } from "@/components/dashboard/PortfolioHealthSummary";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { WinsMilestonesSection } from "@/components/dashboard/WinsMilestonesSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickStatsCards } from "@/components/dashboard/QuickStatsCards";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { TeamWorkloadSection } from "@/components/dashboard/TeamWorkloadSection";
import { UpcomingScheduledSection } from "@/components/dashboard/UpcomingScheduledSection";
import { PowerUserFeatures } from "@/components/dashboard/PowerUserFeatures";
import { DashboardViewProvider } from "@/components/dashboard/DashboardViewProvider";
import { WithErrorBoundary } from "@/components/with-error-boundary";
import { logger } from '@/lib/logger';
import {
  getDashboardMetrics,
  getPortfolioSummary,
  getAttentionItems,
  getWins,
  getCardLayout,
  getTeamWorkload,
  getUpcomingScheduled
} from "../../../(shell)/dashboard/actions";

// Default fallback values for graceful degradation
const defaultSummary = {
  totalClients: 0,
  clientsNeedingAttention: 0,
  winsThisWeek: 0,
  totalClicks30d: 0,
  totalImpressions30d: 0,
  avgTrafficChange: 0,
  keywordsTotal: 0,
  keywordsTop10: 0,
  keywordsTop3: 0,
  keywordsPosition1: 0,
  avgGoalAttainment: 0,
  avgGoalAttainmentTrend: 0,
  clientsOnTrack: 0,
  clientsWatching: 0,
  clientsCritical: 0,
  goalsMet: 0,
  goalsTotal: 0,
};

const defaultCardLayout = [
  "totalClients",
  "avgGoalAttainment",
  "keywordsTop10",
  "winsThisWeek",
];

export default async function DashboardPage() {
  // Get translations for dashboard namespace
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  // Get workspace ID from Clerk auth context
  const { userId, orgId } = await auth();
  const workspaceId = orgId || userId || "default-workspace";

  // Fetch all dashboard data in parallel with individual fallbacks
  const [
    metrics,
    summary,
    attentionItems,
    wins,
    cardLayout,
    teamWorkload,
    upcomingScheduled,
  ] = await Promise.all([
    getDashboardMetrics().catch((error) => {
      logger.error("[DashboardPage] getDashboardMetrics failed", error instanceof Error ? error : { error: String(error) });
      return [];
    }),
    getPortfolioSummary().catch((error) => {
      logger.error("[DashboardPage] getPortfolioSummary failed", error instanceof Error ? error : { error: String(error) });
      return defaultSummary;
    }),
    getAttentionItems().catch((error) => {
      logger.error("[DashboardPage] getAttentionItems failed", error instanceof Error ? error : { error: String(error) });
      return [];
    }),
    getWins().catch((error) => {
      logger.error("[DashboardPage] getWins failed", error instanceof Error ? error : { error: String(error) });
      return [];
    }),
    getCardLayout().catch((error) => {
      logger.error("[DashboardPage] getCardLayout failed", error instanceof Error ? error : { error: String(error) });
      return defaultCardLayout;
    }),
    getTeamWorkload().catch((error) => {
      logger.error("[DashboardPage] getTeamWorkload failed", error instanceof Error ? error : { error: String(error) });
      return [];
    }),
    getUpcomingScheduled().catch((error) => {
      logger.error("[DashboardPage] getUpcomingScheduled failed", error instanceof Error ? error : { error: String(error) });
      return [];
    }),
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Power user keyboard features (Cmd+K, ?) */}
      <PowerUserFeatures clients={metrics} />

      {/* Header with title and export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={t("title")}
          subtitle={t("overview")}
        />
        <ExportButton />
      </div>

      {/* Table controls with saved views, filters, and column customization */}
      <DashboardViewProvider workspaceId={workspaceId} />

      {/* Quick Stats Cards - drag and drop */}
      <section>
        <WithErrorBoundary name="QuickStatsCards">
          <QuickStatsCards summary={summary} initialLayout={cardLayout ?? undefined} />
        </WithErrorBoundary>
      </section>

      {/* Portfolio Health Summary */}
      <section>
        <WithErrorBoundary name="PortfolioHealthSummary">
          <PortfolioHealthSummary summary={summary} />
        </WithErrorBoundary>
      </section>

      {/* Needs Attention + Wins (side by side on large screens) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WithErrorBoundary name="NeedsAttentionSection">
          <NeedsAttentionSection items={attentionItems} />
        </WithErrorBoundary>
        <WithErrorBoundary name="WinsMilestonesSection">
          <WinsMilestonesSection wins={wins} />
        </WithErrorBoundary>
      </section>

      {/* Client Portfolio Table + Sidebar */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              {tCommon("items", { count: metrics.length })}
            </h2>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Cmd+K</kbd>
              <span>{tCommon("search")}</span>
            </div>
          </div>
          <WithErrorBoundary name="ClientPortfolioTable">
            <ClientPortfolioTable clients={metrics} />
          </WithErrorBoundary>
        </div>
        <div className="space-y-6">
          <WithErrorBoundary name="ActivityFeed">
            <ActivityFeed workspaceId={workspaceId} />
          </WithErrorBoundary>
          {teamWorkload.length > 0 && (
            <WithErrorBoundary name="TeamWorkloadSection">
              <TeamWorkloadSection members={teamWorkload} />
            </WithErrorBoundary>
          )}
          <WithErrorBoundary name="UpcomingScheduledSection">
            <UpcomingScheduledSection items={upcomingScheduled} />
          </WithErrorBoundary>
        </div>
      </section>
    </div>
  );
}
