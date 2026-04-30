/**
 * Pipeline Constants
 * Phase 50: Pipeline Kanban
 *
 * Default pipeline stages per D-05.
 */

export interface PipelineStageConfig {
  id: string;
  name: string;
  order: number;
  color: string;
}

/**
 * D-05: Default pipeline stages
 * New -> Analyzing -> Qualified -> Proposal Sent -> Negotiating -> Won -> Onboarding -> Active Client
 */
export const DEFAULT_PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: "new", name: "New", order: 0, color: "#6b7280" },
  { id: "analyzing", name: "Analyzing", order: 1, color: "#3b82f6" },
  { id: "qualified", name: "Qualified", order: 2, color: "#10b981" },
  { id: "proposal_sent", name: "Proposal Sent", order: 3, color: "#f59e0b" },
  { id: "negotiating", name: "Negotiating", order: 4, color: "#8b5cf6" },
  { id: "won", name: "Won", order: 5, color: "#22c55e" },
  { id: "onboarding", name: "Onboarding", order: 6, color: "#06b6d4" },
  { id: "active_client", name: "Active Client", order: 7, color: "#14b8a6" },
];
