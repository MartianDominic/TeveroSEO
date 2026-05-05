/**
 * Pipeline API utilities
 * Phase 50: Pipeline Kanban
 *
 * Client-side API functions for pipeline operations.
 *
 * CFG-CRIT-01 FIX: Standardized to NEXT_PUBLIC_OPEN_SEO_URL
 * (Client-side code must use NEXT_PUBLIC_ prefix)
 */

import type {
  ProspectData,
  PipelineStageConfig,
} from "@/components/pipeline/PipelineKanban";

// CFG-CRIT-01 FIX: Use standardized env var name (NEXT_PUBLIC_OPEN_SEO_URL)
const OPEN_SEO_API_URL = process.env.NEXT_PUBLIC_OPEN_SEO_URL || "http://localhost:13001";

/**
 * Get pipeline configuration for the current workspace.
 */
export async function getPipelineConfig(): Promise<{
  stages: PipelineStageConfig[];
}> {
  const response = await fetch(`${OPEN_SEO_API_URL}/api/pipeline/config`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline config: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get prospects grouped by pipeline stage.
 */
export async function getProspectsGroupedByStage(): Promise<
  Record<string, ProspectData[]>
> {
  const response = await fetch(`${OPEN_SEO_API_URL}/api/pipeline/prospects`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch prospects: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Move a prospect to a new pipeline stage.
 */
export async function moveProspectToStage(
  prospectId: string,
  targetStage: string,
): Promise<void> {
  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/pipeline/prospects/${prospectId}/move`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetStage }),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to move prospect: ${response.statusText}`);
  }
}

/**
 * Archive a prospect.
 */
export async function archiveProspect(prospectId: string): Promise<void> {
  const response = await fetch(
    `${OPEN_SEO_API_URL}/api/pipeline/prospects/${prospectId}/archive`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to archive prospect: ${response.statusText}`);
  }
}

/**
 * Update pipeline stages configuration.
 */
export async function updatePipelineStages(
  stages: PipelineStageConfig[],
): Promise<void> {
  const response = await fetch(`${OPEN_SEO_API_URL}/api/pipeline/config`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stages }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update pipeline stages: ${response.statusText}`);
  }
}
