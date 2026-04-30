/**
 * Task Component Types
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Shared types for task components in the frontend.
 */

/**
 * Task priority levels (D-10).
 */
export type TaskPriority = "high" | "medium" | "low";

/**
 * Task source types (D-09).
 */
export type TaskSource =
  | "checklist"
  | "pipeline"
  | "follow_up"
  | "expiring"
  | "seo"
  | "manual";

/**
 * Aggregated task from the backend.
 * Matches AggregatedTask from TaskAggregationService.
 */
export interface AggregatedTask {
  /** Unique task ID */
  id: string;
  /** Task source type (D-09) */
  source: TaskSource;
  /** Type of source entity */
  entityType: string | null;
  /** ID of source entity */
  entityId: string | null;
  /** Task title */
  title: string;
  /** Task description */
  description: string | null;
  /** Due date */
  dueAt: Date | null;
  /** Calculated urgency score (D-11 Layer 1) */
  urgencyScore: number;
  /** Task priority */
  priority: TaskPriority;
  /** Associated client ID */
  clientId: string | null;
  /** Client name for display */
  clientName: string | null;
  /** When task was pinned (D-11 Layer 2) */
  pinnedAt: Date | null;
  /** Snoozed until date (D-11 Layer 2) */
  snoozedUntil: Date | null;
  /** Deal value in cents (for scoring) */
  dealValueCents: number | null;
  /** Days in current stage (for stale scoring) */
  daysInStage: number | null;
  /** Task category */
  category: string | null;
  /** Assigned user ID */
  assignedTo: string | null;
}

/**
 * Sort modes for Today's Feed (D-11 Layer 3).
 */
export type SortMode = "smart" | "due_date" | "deal_value" | "client_name";

/**
 * Sort mode display labels.
 */
export const SORT_MODE_LABELS: Record<SortMode, string> = {
  smart: "Smart Priority",
  due_date: "Due Date",
  deal_value: "Deal Value",
  client_name: "Client Name",
};
