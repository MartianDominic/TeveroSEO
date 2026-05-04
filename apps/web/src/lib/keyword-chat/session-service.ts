/**
 * Session Service for Keyword Analysis
 * Phase 82: Chat Integration
 *
 * Handles persistence and retrieval of analysis sessions.
 * Sessions are stored in open-seo-main database via API calls.
 */

import { createHash } from "crypto";
import type { AnalysisResult, AnalysisConstraints } from "./types";

export interface SessionSummary {
  id: string;
  clientId: string;
  createdAt: string;
  keywordCount: number;
  selectedCount: number;
  excludedCount: number;
  breakdown: {
    total: number;
    byStage: { bofu: number; mofu: number; tofu: number };
    averageScore: number;
  };
}

export interface SaveSessionParams {
  clientId: string;
  workspaceId: string;
  conversation: string;
  result: AnalysisResult;
}

/**
 * Generate a hash of constraints for deduplication.
 */
export function hashConstraints(constraints: AnalysisConstraints): string {
  const normalized = JSON.stringify({
    businessType: constraints.businessType,
    coreOffering: constraints.coreOffering,
    geoConstraints: constraints.geoConstraints,
    audienceType: constraints.audienceType,
    funnelPreference: constraints.funnelPreference,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Save analysis session to database.
 */
export async function saveAnalysisSession(
  params: SaveSessionParams
): Promise<{ id: string }> {
  const constraintsHash = hashConstraints(params.result.constraints);

  const response = await fetch("/api/keyword-chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: params.clientId,
      workspaceId: params.workspaceId,
      conversation: params.conversation,
      constraintsHash,
      keywordCount: params.result.stats.totalKeywords,
      selectedCount: params.result.stats.selectedCount,
      excludedCount: params.result.stats.excludedCount,
      breakdown: params.result.selection.breakdown,
      result: params.result,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save session: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get analysis sessions for a client.
 */
export async function getClientSessions(
  clientId: string,
  limit = 10
): Promise<SessionSummary[]> {
  const response = await fetch(
    `/api/keyword-chat/sessions?clientId=${clientId}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific session with full result.
 */
export async function getSession(
  sessionId: string
): Promise<{ session: SessionSummary; result: AnalysisResult | null }> {
  const response = await fetch(`/api/keyword-chat/sessions/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.statusText}`);
  }

  return response.json();
}
