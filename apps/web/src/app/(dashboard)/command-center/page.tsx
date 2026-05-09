import { Suspense } from "react";

import { auth } from "@clerk/nextjs/server";

import { getDashboardMetrics } from "@/server/features/command-center/api/metrics";

import {
  DashboardSkeleton,
  CardSkeleton,
  ChartSkeleton,
  TodayBarSkeleton,
} from "./_components/DashboardSkeleton";
import { PipelineFunnel } from "./_components/PipelineFunnel";
import { PipelineHealthCards } from "./_components/PipelineHealthCards";
import { RevenuePipeline } from "./_components/RevenuePipeline";
import { TodayActionBar } from "./_components/TodayActionBar";


/**
 * Command Center Dashboard Page
 * Phase 62-05: Command Center Dashboard Core
 *
 * The main operations hub for SEO agencies showing:
 * - Today Action Bar (overdue, due, awaiting, new counts)
 * - Pipeline Health Cards (prospects, proposals, agreements, payments)
 * - Revenue Pipeline (this month, last month, outstanding, overdue)
 * - Conversion Funnel (Recharts visualization)
 *
 * Architecture:
 * - Server Component for initial data fetch
 * - Client components with TanStack Query for live refresh
 * - Suspense boundaries for progressive loading
 */
export default async function CommandCenterPage() {
  // Get workspace ID from Clerk auth context
  const { userId, orgId } = await auth();

  // Use organization ID as workspace, falling back to user ID for personal workspace
  const workspaceId = orgId || userId;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Select a Workspace
          </h2>
          <p className="text-sm text-muted-foreground">
            Please select or create a workspace to view the Command Center.
          </p>
        </div>
      </div>
    );
  }

  // Server-side initial fetch for fast first paint
  const initialMetrics = await getDashboardMetrics(workspaceId);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline overview and today&apos;s actions
        </p>
      </div>

      {/* Today Action Bar */}
      <Suspense fallback={<TodayBarSkeleton />}>
        <TodayActionBar initialData={initialMetrics} workspaceId={workspaceId} />
      </Suspense>

      {/* Pipeline Health Cards - 4 column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Suspense
          fallback={
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          }
        >
          <PipelineHealthCards
            initialData={initialMetrics}
            workspaceId={workspaceId}
          />
        </Suspense>
      </div>

      {/* Bottom row - Revenue Pipeline and Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenuePipeline initialData={initialMetrics} />
        <Suspense fallback={<ChartSkeleton />}>
          <PipelineFunnel
            initialData={initialMetrics}
            workspaceId={workspaceId}
          />
        </Suspense>
      </div>
    </div>
  );
}
