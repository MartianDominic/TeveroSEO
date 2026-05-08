/**
 * Analytics-Audit Bridge Types
 * Phase 40: Cross-module integration between P92 audit checks and P96 analytics data
 *
 * These types enable T4 architecture checks to consume analytics data
 * in a format suitable for audit scoring and recommendations.
 */

import type { TopicClusterWithPages, StrikingDistancePage } from "../types";
import type {
  CannibalizationIssue,
  CannibalizingPage,
} from "../services/CannibalizationService";
import type { CannibalizationSeverity } from "@/db/link-schema";

// Re-export for convenience
export type { CannibalizationIssue, CannibalizingPage, CannibalizationSeverity };

/**
 * Priority levels for audit recommendations
 */
export type RecommendationPriority = "critical" | "high" | "medium" | "low";

/**
 * Categories for audit recommendations
 */
export type RecommendationCategory =
  | "topic_coverage"
  | "content_gap"
  | "cannibalization"
  | "hub_spoke_linking"
  | "cluster_size";

/**
 * Impact and effort estimates for recommendations
 */
export type ImpactLevel = "high" | "medium" | "low";
export type EffortLevel = "high" | "medium" | "low";

/**
 * Audit recommendation with actionable guidance
 */
export interface AuditRecommendation {
  /** Unique recommendation ID */
  id: string;
  /** Priority for addressing this recommendation */
  priority: RecommendationPriority;
  /** Category of the recommendation */
  category: RecommendationCategory;
  /** Short title for the recommendation */
  title: string;
  /** Detailed description of the issue */
  description: string;
  /** Specific action to take */
  action: string;
  /** Expected impact of implementing this recommendation */
  impact: ImpactLevel;
  /** Estimated effort to implement */
  effort: EffortLevel;
  /** Keywords affected by this issue (if applicable) */
  affectedKeywords?: string[];
  /** Pages affected by this issue (if applicable) */
  affectedPages?: string[];
  /** Estimated traffic impact (monthly clicks) */
  estimatedTrafficImpact?: number;
}

/**
 * Topic cluster summary for audit consumption
 */
export interface TopicClusterSummary {
  /** Cluster ID */
  id: string;
  /** Cluster name */
  name: string;
  /** Hub page URL */
  hubPageUrl: string;
  /** Number of spoke pages */
  spokeCount: number;
  /** Percentage of spokes that link back to hub (0-100) */
  hubLinkCoverage: number;
  /** Spoke pages missing links to hub */
  spokesWithoutHubLink: string[];
  /** Total cluster clicks */
  totalClicks: number;
  /** Total cluster impressions */
  totalImpressions: number;
  /** Average position across cluster */
  avgPosition: number;
  /** Content gaps identified */
  gaps: string[];
}

/**
 * Topic coverage audit data for T4-03, T4-04, T4-05 checks
 */
export interface TopicCoverageAuditData {
  /** Total number of topic clusters */
  totalClusters: number;
  /** Clusters with at least one page */
  coveredClusters: number;
  /** Clusters with no pages (content gaps) */
  gapClusters: TopicClusterSummary[];
  /** Coverage score (0-100) */
  coverageScore: number;
  /** Individual cluster summaries */
  clusters: TopicClusterSummary[];
  /** Generated recommendations */
  recommendations: AuditRecommendation[];
}

/**
 * Striking distance keyword summary for audit consumption
 */
export interface StrikingKeywordSummary {
  /** Page URL */
  pageUrl: string;
  /** Average position for the page */
  avgPosition: number;
  /** Total impressions */
  impressions: number;
  /** Current clicks */
  currentClicks: number;
  /** Potential clicks if moved to target position */
  potentialClicks: number;
  /** Click gain opportunity */
  clickGain: number;
  /** Optimization difficulty */
  difficulty: "easy" | "medium" | "hard";
  /** Top keywords driving impressions */
  topKeywords: string[];
}

/**
 * Content gap audit data for T4 striking distance integration
 */
export interface ContentGapAuditData {
  /** Total pages in striking distance */
  strikingDistanceCount: number;
  /** High value opportunities (>500 impressions) */
  highValueOpportunities: StrikingKeywordSummary[];
  /** Quick wins (positions 11-15, easy to push to page 1) */
  quickWins: StrikingKeywordSummary[];
  /** Gap score (0-100, higher means fewer gaps) */
  gapScore: number;
  /** Total potential click gain */
  totalPotentialClicks: number;
  /** Generated recommendations */
  recommendations: AuditRecommendation[];
}

/**
 * Cannibalization issue summary for audit consumption
 */
export interface CannibalizationSummary {
  /** Keyword being cannibalized */
  keyword: string;
  /** Number of competing pages */
  competingPageCount: number;
  /** URLs of competing pages */
  competingUrls: string[];
  /** Severity of the issue */
  severity: CannibalizationSeverity;
  /** Estimated monthly lost clicks */
  monthlyLostClicks: number;
  /** Recommended primary page */
  recommendedPrimaryPage: string;
  /** Recommended action */
  recommendedAction: "consolidate" | "canonical" | "redirect" | "differentiate";
}

/**
 * Cannibalization audit data for T4 checks
 */
export interface CannibalizationAuditData {
  /** Total cannibalization issues */
  totalIssues: number;
  /** Critical severity issues */
  criticalIssues: CannibalizationSummary[];
  /** High severity issues */
  highIssues: CannibalizationSummary[];
  /** Moderate (medium) severity issues */
  moderateIssues: CannibalizationSummary[];
  /** Low severity issues */
  lowIssues: CannibalizationSummary[];
  /** Cannibalization score (0-100, higher means fewer issues) */
  cannibalizationScore: number;
  /** Total monthly impact across all issues */
  totalMonthlyImpact: number;
  /** Generated recommendations */
  recommendations: AuditRecommendation[];
}

/**
 * Hub-spoke linking audit data for T4-03 and T4-04 checks
 */
export interface HubSpokeLinkingAuditData {
  /** Current page URL being checked */
  pageUrl: string;
  /** Whether this page is identified as a hub */
  isHub: boolean;
  /** Whether this page is identified as a spoke */
  isSpoke: boolean;
  /** If hub: spoke pages that this hub links to */
  linkedSpokes?: string[];
  /** If hub: spoke pages missing links from this hub */
  missingSpokes?: string[];
  /** If spoke: whether this page links back to its hub */
  linksToHub?: boolean;
  /** If spoke: the hub page URL */
  hubPageUrl?: string;
  /** Cluster this page belongs to (if any) */
  clusterId?: string;
  /** Cluster name */
  clusterName?: string;
  /** Score for hub-spoke linking (0-100) */
  linkingScore: number;
}

/**
 * Cluster size audit data for T4-05 check
 */
export interface ClusterSizeAuditData {
  /** Cluster ID */
  clusterId: string;
  /** Cluster name */
  clusterName: string;
  /** Current spoke count */
  spokeCount: number;
  /** Target minimum spokes */
  targetMin: number;
  /** Target maximum spokes */
  targetMax: number;
  /** Whether cluster is within target range */
  withinRange: boolean;
  /** Suggestion based on current count */
  suggestion: "add_content" | "optimal" | "consider_splitting";
  /** Score for cluster size (0-100) */
  sizeScore: number;
}

/**
 * Combined analytics audit context
 * Used to pass all analytics data to audit checks at once
 */
export interface AnalyticsAuditContext {
  /** Topic coverage data */
  topicCoverage?: TopicCoverageAuditData;
  /** Content gap data */
  contentGaps?: ContentGapAuditData;
  /** Cannibalization data */
  cannibalization?: CannibalizationAuditData;
  /** Hub-spoke linking for current page */
  hubSpokeLinking?: HubSpokeLinkingAuditData;
  /** Cluster size for current page's cluster */
  clusterSize?: ClusterSizeAuditData;
  /** Trend detection data for T4-08 */
  trendData?: TrendAuditData;
  /** Striking distance data for T4-09 */
  strikingDistanceData?: StrikingDistanceAuditData;
  /** Whether analytics data is available */
  hasAnalyticsData: boolean;
  /** Last sync timestamp */
  lastSyncAt?: Date;
}

/**
 * Trend detection audit data for T4-08 check
 */
export interface TrendAuditData {
  /** Pages with declining traffic (>10% decrease over 3 weeks) */
  decayingPages: TrendingPageSummary[];
  /** Pages with growing traffic (>10% increase over 3 weeks) */
  growingPages: TrendingPageSummary[];
  /** Net trend score (-100 to 100, positive = more growing than decaying) */
  netTrend: number;
  /** Total pages analyzed */
  totalPagesAnalyzed: number;
  /** Period in days used for comparison */
  periodDays: number;
  /** Threshold used for trend detection (e.g., 0.10 = 10%) */
  threshold: number;
  /** Generated recommendations */
  recommendations: AuditRecommendation[];
}

/**
 * Summary of a trending page for audit consumption
 */
export interface TrendingPageSummary {
  /** Page URL */
  pageUrl: string;
  /** Percentage change in clicks */
  changePercent: number;
  /** Current period clicks */
  currentClicks: number;
  /** Previous period clicks */
  previousClicks: number;
  /** Current position */
  currentPosition: number;
  /** Position change (negative = improvement) */
  positionChange: number;
  /** Top keywords driving traffic */
  topKeywords: string[];
  /** Confidence level based on impression volume */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Striking distance audit data for T4-09 check
 */
export interface StrikingDistanceAuditData {
  /** Keywords/pages in striking distance (positions 11-20) */
  keywords: StrikingDistanceKeywordSummary[];
  /** Total optimization opportunities found */
  totalOpportunities: number;
  /** Estimated monthly traffic gain if all opportunities captured */
  estimatedTrafficGain: number;
  /** Quick wins (easy difficulty, high impressions) */
  quickWins: StrikingDistanceKeywordSummary[];
  /** High value opportunities (>500 impressions) */
  highValueOpportunities: StrikingDistanceKeywordSummary[];
  /** Generated recommendations */
  recommendations: AuditRecommendation[];
}

/**
 * Summary of a striking distance keyword for audit consumption
 */
export interface StrikingDistanceKeywordSummary {
  /** Page URL */
  pageUrl: string;
  /** Average position (11-20 range) */
  avgPosition: number;
  /** Total impressions */
  impressions: number;
  /** Current clicks */
  currentClicks: number;
  /** Potential clicks if moved to target position */
  potentialClicks: number;
  /** Click gain opportunity */
  clickGain: number;
  /** Optimization difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Top keywords for this page */
  topKeywords: string[];
}
