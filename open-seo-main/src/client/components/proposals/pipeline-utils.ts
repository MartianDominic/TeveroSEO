/**
 * Pipeline utilities for proposals.
 * Phase 30-08: Pipeline & Automation
 *
 * Pure functions for pipeline logic - no UI dependencies.
 */

import type { ProposalSelect } from "@/db/proposal-schema";
import type { EngagementSignals } from "@/server/features/proposals/tracking/EngagementSignals";

/**
 * Pipeline stages with Lithuanian labels and colors.
 */
export const PIPELINE_STAGES = [
  { id: "draft", label: "Juodrastis", color: "gray" },
  { id: "sent", label: "Issiusta", color: "blue" },
  { id: "viewed", label: "Perziureta", color: "yellow" },
  { id: "accepted", label: "Priimta", color: "orange" },
  { id: "signed", label: "Pasirasysta", color: "purple" },
  { id: "paid", label: "Apmoketa", color: "green" },
  { id: "onboarded", label: "Klientas", color: "emerald" },
  { id: "declined", label: "Atmesta", color: "red" },
  { id: "expired", label: "Pasibaige", color: "gray" },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

/**
 * Valid stage transitions.
 */
export const STAGE_TRANSITIONS: Record<PipelineStageId, PipelineStageId[]> = {
  draft: ["sent"],
  sent: ["viewed", "expired", "declined"],
  viewed: ["accepted", "expired", "declined"],
  accepted: ["signed", "declined"],
  signed: ["paid", "declined"],
  paid: ["onboarded"],
  onboarded: [],
  declined: [],
  expired: ["sent"],
};

/**
 * Check if a transition between stages is valid.
 */
export function canTransitionTo(
  from: PipelineStageId,
  to: PipelineStageId
): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Proposal with engagement signals for display.
 */
export interface PipelineProposal extends ProposalSelect {
  prospect?: {
    domain: string;
    companyName: string | null;
  };
  engagementSignals?: EngagementSignals;
}

/**
 * Group proposals by their status.
 */
export function groupProposalsByStage(
  proposals: PipelineProposal[]
): Record<PipelineStageId, PipelineProposal[]> {
  const grouped: Record<PipelineStageId, PipelineProposal[]> = {
    draft: [],
    sent: [],
    viewed: [],
    accepted: [],
    signed: [],
    paid: [],
    onboarded: [],
    declined: [],
    expired: [],
  };

  for (const proposal of proposals) {
    const status = proposal.status as PipelineStageId;
    if (grouped[status]) {
      grouped[status].push(proposal);
    }
  }

  return grouped;
}

/**
 * Format time in stage as a human-readable string (Lithuanian).
 */
export function formatTimeInStage(updatedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(updatedAt).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `${diffDays} d.`;
  }
  if (diffHours > 0) {
    return `${diffHours} val.`;
  }
  return `${diffMinutes} min.`;
}

/**
 * Get stage color classes for Tailwind.
 */
export function getStageColorClasses(color: string): {
  bg: string;
  dot: string;
  border: string;
} {
  const colorMap: Record<string, { bg: string; dot: string; border: string }> = {
    gray: { bg: "bg-gray-100", dot: "bg-gray-500", border: "border-gray-200" },
    blue: { bg: "bg-blue-50", dot: "bg-blue-500", border: "border-blue-200" },
    yellow: { bg: "bg-yellow-50", dot: "bg-yellow-500", border: "border-yellow-200" },
    orange: { bg: "bg-orange-50", dot: "bg-orange-500", border: "border-orange-200" },
    purple: { bg: "bg-purple-50", dot: "bg-purple-500", border: "border-purple-200" },
    green: { bg: "bg-green-50", dot: "bg-green-500", border: "border-green-200" },
    emerald: { bg: "bg-emerald-50", dot: "bg-emerald-500", border: "border-emerald-200" },
    red: { bg: "bg-red-50", dot: "bg-red-500", border: "border-red-200" },
  };

  return colorMap[color] ?? colorMap.gray;
}
