/**
 * Portal Types
 *
 * Type definitions for portal API responses and data structures.
 * Mirrors the API response types from open-seo-main portal routes.
 */

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardMetrics {
  clicks: number;
  impressions: number;
  avgPosition: number;
  top10Count: number;
  deltas: {
    clicks: number;
    impressions: number;
    avgPosition: number;
    top10Count: number;
  };
}

export interface RecentWin {
  keyword: string;
  position: number;
  previousPosition: number;
  date: string;
}

export interface NeedsAttentionItem {
  keyword: string;
  position: number;
  previousPosition: number;
  dropAmount: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentWins: RecentWin[];
  needsAttention: NeedsAttentionItem[];
  lastUpdated: string;
}

export interface DashboardResponse {
  success: true;
  data: DashboardData;
}

// ============================================================================
// Keywords Types
// ============================================================================

export interface KeywordData {
  keyword: string;
  position: number;
  previousPosition: number;
  change: number;
  clicks: number;
  impressions: number;
  volume: number | null;
  isEstimated: boolean;
  /** Keyword difficulty score (0-100) */
  difficulty?: number;
  /** Whether this keyword is marked as priority */
  isPriority?: boolean;
  /** Whether this keyword is in the content queue */
  isQueued?: boolean;
}

export interface KeywordsPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface KeywordsSummary {
  top10: number;
  improving: number;
  declining: number;
  unchanged: number;
}

export interface KeywordsData {
  keywords: KeywordData[];
  pagination: KeywordsPagination;
  summary: KeywordsSummary;
}

export interface KeywordsResponse {
  success: true;
  data: KeywordsData;
}

export type KeywordFilter = "all" | "top10" | "improving" | "declining";
export type KeywordSort = "position" | "clicks" | "change" | "impressions";
export type SortOrder = "asc" | "desc";

export interface KeywordQueryOptions {
  filter?: KeywordFilter;
  sort?: KeywordSort;
  order?: SortOrder;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Activity Types
// ============================================================================

export interface ActivityArtifact {
  label: string;
  url: string;
}

export interface ActivityEntry {
  id: string;
  category: string;
  title: string;
  description: string | null;
  artifacts: ActivityArtifact[];
  createdAt: string;
}

export interface ActivityData {
  activities: ActivityEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ActivityResponse {
  success: true;
  data: ActivityData;
}

export type ActivityCategory =
  | "content"
  | "technical"
  | "ranking"
  | "report"
  | "other";

export interface ActivityQueryOptions {
  category?: ActivityCategory;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsData {
  notifications: NotificationEntry[];
  unreadCount: number;
}

export interface NotificationsResponse {
  success: true;
  data: NotificationsData;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  weeklyDigest: boolean;
  instantAlerts: boolean;
}

export interface NotificationSettingsResponse {
  success: true;
  data: NotificationSettings;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
  success: false;
  error: string;
}

// Discriminated union - TypeScript can narrow based on success field
export type ApiResult<T extends { success: true }> = T | ApiError;

// ============================================================================
// Trust Indicator Types (per D-02)
// ============================================================================

export type TrustLevel = "verified" | "estimated" | "client";
