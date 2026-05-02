/**
 * Command Center Types
 * Phase 62-06: Needs Attention List and Quick Actions
 *
 * Shared types for the Command Center dashboard components.
 */

/**
 * Entity types that can appear in the attention list.
 */
export type EntityType =
  | "prospect"
  | "proposal"
  | "contract"
  | "invoice"
  | "client";

/**
 * Priority levels for attention items.
 */
export type Priority = "critical" | "high" | "medium" | "low";

/**
 * Loss reason taxonomy for marking deals as lost.
 */
export type LossReason =
  | "too_expensive"
  | "budget_cut"
  | "competitor_cheaper"
  | "bad_timing"
  | "project_delayed"
  | "internal_changes"
  | "wrong_fit"
  | "scope_mismatch"
  | "different_direction"
  | "chose_competitor"
  | "went_internal"
  | "found_alternative"
  | "unresponsive"
  | "ghosted"
  | "decision_maker_left"
  | "unknown"
  | "other";

/**
 * Item requiring attention in the command center dashboard.
 * Represents an actionable entity that needs user review or action.
 */
export interface AttentionItem {
  /** Unique identifier for the attention item */
  id: string;
  /** Type of entity (prospect, proposal, contract, invoice, client) */
  entityType: EntityType;
  /** ID of the underlying entity */
  entityId: string;
  /** Primary display title */
  title: string;
  /** Secondary description text */
  subtitle: string;
  /** Priority level for sorting and display */
  priority: Priority;
  /** Due date for time-sensitive items */
  dueAt?: Date;
  /** Days since last contact (for follow-up purposes) */
  daysSinceLastContact?: number;
  /** Associated value in cents */
  valueInCents?: number;
  /** Currency code (defaults to EUR) */
  currency?: string;
}

/**
 * Quick action types available for attention items.
 */
export type QuickActionType = "reminder" | "lost" | "snooze" | "note";
