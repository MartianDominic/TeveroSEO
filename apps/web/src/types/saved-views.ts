/**
 * Types for saved views with column customization.
 */

import type { FilterParams } from "./pagination";

/**
 * View configuration including columns, filters, and sort settings.
 */
export interface ViewConfig {
  columns: string[];
  filters: FilterParams;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

/**
 * Saved view representation.
 */
export interface SavedView {
  id: string;
  name: string;
  description?: string;
  config: ViewConfig;
  isShared: boolean;
  isDefault: boolean;
  createdAt: Date;
  userId: string;
}

/**
 * Input for creating a saved view.
 */
export interface CreateSavedViewInput {
  name: string;
  description?: string;
  config: ViewConfig;
  isShared?: boolean;
}

/**
 * Input for updating a saved view.
 */
export interface UpdateSavedViewInput {
  name?: string;
  description?: string;
  config?: ViewConfig;
  isShared?: boolean;
}

/**
 * Default visible columns for the client table.
 */
export const DEFAULT_COLUMNS = [
  "select",
  "clientName",
  "goalAttainmentPct",
  "trafficTotal",
  "trafficTrend",
  "keywordsTop10",
  "alertsCritical",
];

/**
 * All available columns with metadata.
 */
export const ALL_COLUMNS: ColumnDefinition[] = [
  { id: "select", label: "Select", locked: true },
  { id: "clientName", label: "Client", locked: true },
  { id: "goalAttainmentPct", label: "Goal Progress" },
  { id: "primaryGoalName", label: "Primary Goal" },
  { id: "trafficTotal", label: "Traffic (30d)" },
  { id: "trafficTrend", label: "Traffic Trend" },
  { id: "keywordsTop10", label: "Keywords Top 10" },
  { id: "keywordsTop3", label: "Keywords Top 3" },
  { id: "keywordsPosition1", label: "#1 Rankings" },
  { id: "ctr", label: "CTR" },
  { id: "alertsCritical", label: "Critical Alerts" },
  { id: "alertsWarning", label: "Warning Alerts" },
  { id: "owner", label: "Owner" },
  { id: "lastTouch", label: "Last Touch" },
  { id: "tags", label: "Tags" },
  { id: "status", label: "Status" },
];

/**
 * Column definition with visibility metadata.
 */
export interface ColumnDefinition {
  id: string;
  label: string;
  locked?: boolean;
}

/**
 * Get default view configuration.
 */
export function getDefaultViewConfig(): ViewConfig {
  return {
    columns: DEFAULT_COLUMNS,
    filters: {},
    sortBy: "priorityScore",
    sortDir: "desc",
  };
}
