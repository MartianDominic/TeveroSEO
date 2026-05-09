/**
 * Tasks Page
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Today's Tasks dashboard page showing aggregated tasks with:
 * - Multi-source task aggregation (D-09)
 * - 5-layer priority system (D-11)
 * - My Focus section (D-11 Layer 5)
 * - Sort mode toggle (D-11 Layer 3)
 */
import { Suspense } from "react";

import { auth } from "@clerk/nextjs/server";

import { PageHeader, Skeleton } from "@tevero/ui";

import { getTasks } from "./actions";
import { TodaysFeedClient } from "./TodaysFeedClient";

export default async function TasksPage() {
  const { userId, orgId } = await auth();
  const workspaceId = orgId ?? userId ?? "default-workspace";

  // Fetch aggregated tasks
  const tasks = await getTasks(workspaceId, userId ?? "");

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Today's Tasks"
        subtitle={`${tasks.length} task${tasks.length !== 1 ? "s" : ""} need your attention`}
      />

      <Suspense fallback={<TasksSkeleton />}>
        <TodaysFeedClient initialTasks={tasks} />
      </Suspense>
    </div>
  );
}

/**
 * Loading skeleton for tasks page.
 */
function TasksSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
