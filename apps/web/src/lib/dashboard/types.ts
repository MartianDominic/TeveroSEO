/**
 * Types for the Agency Command Center dashboard.
 */

export interface HealthBreakdown {
  traffic: number;
  rankings: number;
  technical: number;
  backlinks: number;
  content: number;
}

export interface ClientMetrics {
  id: string;
  clientId: string;
  clientName: string;
  healthScore: number;
  healthBreakdown: HealthBreakdown;
  trafficCurrent: number;
  trafficPrevious: number;
  trafficTrendPct: number;
  keywordsTotal: number;
  keywordsTop10: number;
  keywordsTop3: number;
  keywordsPosition1: number;
  alertsOpen: number;
  alertsCritical: number;
  lastReportAt: string | null;
  lastAuditAt: string | null;
  computedAt: string;
  connectionStatus: "connected" | "stale" | "disconnected";
}

export interface PortfolioSummary {
  totalClients: number;
  clientsNeedingAttention: number;
  winsThisWeek: number;
  totalClicks30d: number;
  totalImpressions30d: number;
  avgTrafficChange: number;
  keywordsTotal: number;
  keywordsTop10: number;
  keywordsTop3: number;
  keywordsPosition1: number;
}

export interface AttentionItem {
  id: string;
  clientId: string;
  clientName: string;
  type: "alert" | "health" | "connection";
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WinItem {
  id: string;
  clientId: string;
  clientName: string;
  type: "position_1" | "top_10_entry" | "traffic_milestone" | "high_da_backlink";
  title: string;
  description: string;
  achievedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Sparkline data point for 30-day trends.
 */
export interface SparklineDataPoint {
  value: number;
  label?: string; // Date or label for tooltip
}

/**
 * Extended client metrics with sparkline data for table display.
 */
export interface ClientMetricsWithTrends extends ClientMetrics {
  trafficSparkline: SparklineDataPoint[];
  keywordsSparkline: SparklineDataPoint[];
  backlinksTotal: number;
  backlinksNewMonth: number;
  addedAt: string; // When client was added to portfolio
  tags: string[];
}

/**
 * Filter options for client table.
 */
export interface ClientTableFilters {
  search: string;
  healthRange: [number, number]; // [min, max] e.g., [0, 60] for "at risk"
  connectionStatus: ("connected" | "stale" | "disconnected")[];
  tags: string[];
  hasAlerts: boolean | null;
}

/**
 * Sort configuration for client table.
 */
export interface ClientTableSort {
  key: ClientSortKey;
  direction: "asc" | "desc";
}

export type ClientSortKey =
  | "clientName"
  | "healthScore"
  | "trafficCurrent"
  | "trafficTrendPct"
  | "keywordsTotal"
  | "keywordsTop10"
  | "alertsOpen"
  | "addedAt";

/**
 * Saved dashboard view configuration.
 */
export interface SavedView {
  id: string;
  name: string;
  filters: ClientTableFilters;
  cardLayout?: string[];
  isDefault: boolean;
  createdAt: string;
}

/**
 * Team member with client assignments.
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  clientCount: number;
  maxCapacity: number; // e.g., 15 clients max
  clients: { id: string; name: string }[];
}

/**
 * Upcoming scheduled item (report, audit, etc.)
 */
export interface ScheduledItem {
  id: string;
  type: "report" | "audit" | "meeting" | "ssl_expiry";
  clientId: string;
  clientName: string;
  title: string;
  scheduledAt: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

/**
 * Export configuration for CSV.
 */
export interface ExportConfig {
  columns: ExportColumn[];
  filters?: ClientTableFilters;
  format: "csv";
}

export type ExportColumn =
  | "clientName"
  | "healthScore"
  | "trafficCurrent"
  | "trafficTrendPct"
  | "keywordsTotal"
  | "keywordsTop10"
  | "keywordsTop3"
  | "keywordsPosition1"
  | "alertsOpen"
  | "connectionStatus"
  | "lastReportAt"
  | "lastAuditAt";

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  clientName: "Client Name",
  healthScore: "Health Score",
  trafficCurrent: "Traffic (30d)",
  trafficTrendPct: "Traffic Change %",
  keywordsTotal: "Keywords Total",
  keywordsTop10: "Keywords Top 10",
  keywordsTop3: "Keywords Top 3",
  keywordsPosition1: "Keywords #1",
  alertsOpen: "Open Alerts",
  connectionStatus: "Connection Status",
  lastReportAt: "Last Report",
  lastAuditAt: "Last Audit",
};
