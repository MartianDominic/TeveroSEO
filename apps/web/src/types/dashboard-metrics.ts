/**
 * Dashboard Metrics Types
 * Phase 62-05: Command Center Dashboard Core
 *
 * TypeScript interfaces for dashboard metrics response from 62-04 API.
 */

/**
 * Today action counts for the Today Action Bar.
 */
export interface TodayMetrics {
  overdue: number;
  dueToday: number;
  awaitingYou: number;
  new: number;
}

/**
 * Prospect pipeline counts by status.
 */
export interface ProspectPipeline {
  new: number;
  qualified: number;
  contacted: number;
  negotiating: number;
}

/**
 * Proposal pipeline counts by status.
 */
export interface ProposalPipeline {
  draft: number;
  sent: number;
  viewed: number;
  accepted: number;
}

/**
 * Agreement (contract) pipeline counts by status.
 */
export interface AgreementPipeline {
  draft: number;
  pending: number;
  signed: number;
  executed: number;
}

/**
 * Payment pipeline counts by status.
 */
export interface PaymentPipeline {
  sent: number;
  paid30d: number;
  overdue: number;
}

/**
 * Complete pipeline metrics across all entity types.
 */
export interface PipelineMetrics {
  prospects: ProspectPipeline;
  proposals: ProposalPipeline;
  agreements: AgreementPipeline;
  payments: PaymentPipeline;
}

/**
 * Revenue metrics in cents.
 */
export interface RevenueMetrics {
  thisMonth: number;
  lastMonth: number;
  outstanding: number;
  overdue: number;
}

/**
 * Conversion funnel metrics.
 */
export interface ConversionMetrics {
  winRate: number;
  avgCycleDays: number;
}

/**
 * Complete dashboard metrics structure.
 */
export interface DashboardMetrics {
  today: TodayMetrics;
  pipeline: PipelineMetrics;
  revenue: RevenueMetrics;
  conversions: ConversionMetrics;
}

/**
 * API response wrapper for dashboard metrics.
 */
export interface DashboardMetricsResponse {
  pending: boolean;
  metrics: DashboardMetrics | null;
  computedAt?: Date;
  isStale?: boolean;
}
