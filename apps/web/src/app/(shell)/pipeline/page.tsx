/**
 * Pipeline Page
 * Phase 50: Pipeline Kanban
 *
 * Sales pipeline kanban board with drag-and-drop between stages.
 * Implements D-05 (full pipeline stages), D-06 (configurable stages),
 * D-07 (card display), D-08 (quick actions).
 */

import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { PageHeader, Skeleton } from "@tevero/ui";
import { PipelineKanbanContainer } from "./PipelineKanbanContainer";
import { DEFAULT_PIPELINE_STAGES } from "./constants";

// Default empty state
const defaultGroupedProspects: Record<string, never[]> = {};
for (const stage of DEFAULT_PIPELINE_STAGES) {
  defaultGroupedProspects[stage.id] = [];
}

/**
 * Fetch pipeline configuration from the backend.
 */
async function fetchPipelineConfig(workspaceId: string) {
  const apiUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/api/pipeline/config`, {
      headers: {
        "x-workspace-id": workspaceId,
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(
        `[PipelinePage] Failed to fetch config: ${response.status}`,
      );
      return { stages: DEFAULT_PIPELINE_STAGES };
    }

    return response.json();
  } catch (error) {
    console.error("[PipelinePage] Error fetching config:", error);
    return { stages: DEFAULT_PIPELINE_STAGES };
  }
}

/**
 * Fetch prospects grouped by stage from the backend.
 */
async function fetchProspectsGroupedByStage(workspaceId: string) {
  const apiUrl = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

  try {
    const response = await fetch(`${apiUrl}/api/pipeline/prospects`, {
      headers: {
        "x-workspace-id": workspaceId,
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      console.error(
        `[PipelinePage] Failed to fetch prospects: ${response.status}`,
      );
      return defaultGroupedProspects;
    }

    return response.json();
  } catch (error) {
    console.error("[PipelinePage] Error fetching prospects:", error);
    return defaultGroupedProspects;
  }
}

/**
 * Kanban skeleton loader.
 */
function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {DEFAULT_PIPELINE_STAGES.slice(0, 5).map((stage) => (
        <div
          key={stage.id}
          className="min-w-[280px] max-w-[320px] bg-surface-2/50 rounded-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-8 ml-auto" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-card" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function PipelinePage() {
  // Get workspace ID from Clerk auth context
  const { userId, orgId } = await auth();
  const workspaceId = orgId || userId || "default-workspace";

  // Fetch data in parallel
  const [configResult, prospectsResult] = await Promise.all([
    fetchPipelineConfig(workspaceId),
    fetchProspectsGroupedByStage(workspaceId),
  ]);

  const stages = configResult.stages || DEFAULT_PIPELINE_STAGES;
  const groupedProspects = prospectsResult || defaultGroupedProspects;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Sales Pipeline"
        subtitle="Manage prospects through your sales funnel"
      />

      <Suspense fallback={<KanbanSkeleton />}>
        <PipelineKanbanContainer
          workspaceId={workspaceId}
          stages={stages}
          initialState={groupedProspects}
        />
      </Suspense>
    </div>
  );
}
