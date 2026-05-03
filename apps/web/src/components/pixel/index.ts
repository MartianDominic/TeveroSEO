/**
 * Pixel Components
 * Phase 66: Platform Unification Excellence
 *
 * Components for pixel management:
 * - Analytics: Dashboard, CWV cards, traffic chart, top pages (66-08)
 * - DOM Changes: Pending, approval, history (66-07)
 */

// Analytics Dashboard (Phase 66-08)
export {
  AnalyticsDashboard,
  type AnalyticsDashboardProps,
  type AnalyticsResponse,
  type AnalyticsSummary,
  type CwvResult,
  type CwvMetricResult,
  type DateRangePreset,
} from "./analytics-dashboard";

export { CwvCard, type CwvCardProps, type CwvRating, type CwvMetricType } from "./cwv-card";
export { TrafficChart, type TrafficChartProps, type TimeseriesDataPoint } from "./traffic-chart";
export { TopPages, type TopPagesProps, type TopPage } from "./top-pages";

// DOM Change Management (Phase 66-07)
export { PendingChanges } from "./pending-changes";
export type { PendingChangesProps, PendingChange } from "./pending-changes";

export { ChangeApproval } from "./change-approval";
export type { ChangeApprovalProps, ChangeForApproval } from "./change-approval";

export { ChangeHistory } from "./change-history";
export type { ChangeHistoryProps, HistoryChange } from "./change-history";
