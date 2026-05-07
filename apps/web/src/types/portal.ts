/**
 * Portal Types
 * Phase 86-10: Semantic Intelligence Integration
 *
 * Type definitions for portal cluster and keyword data.
 * Mirrors types from open-seo-main/src/server/features/portal/types.ts
 */

/**
 * Keyword data for portal display.
 */
export interface PortalKeyword {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  funnelStage: "bofu" | "mofu" | "tofu";

  /** Current ranking position (null if not ranking) */
  currentPosition: number | null;

  /** Position at contract signing */
  lockedPosition: number | null;

  /** Position change since lock (positive = improved) */
  positionChange: number | null;

  /** Status indicator */
  status: "top10" | "top20" | "progress" | "pending";
}

/**
 * Cluster data for portal display.
 * Uses client-friendly language: "growth areas" not "clusters".
 */
export interface PortalCluster {
  id: string;

  /** Display tier: pillar (main topics), subtopic, longtail */
  tier: "pillar" | "subtopic" | "longtail";

  /** Primary label (Lithuanian for LT clients) */
  label: string;

  /** English label (for international clients) */
  labelEn: string;

  /** Total search volume for all keywords in cluster */
  totalVolume: number;

  /** Average keyword difficulty */
  averageDifficulty: number;

  /** Dominant funnel stage */
  dominantFunnel: "bofu" | "mofu" | "tofu";

  /** Keywords in this cluster with progress */
  keywords: PortalKeyword[];

  /** Funnel stage breakdown (counts) */
  funnelBreakdown: Record<"bofu" | "mofu" | "tofu", number>;

  /** Quick-win opportunities count */
  quickWinCount: number;

  /** Progress metrics */
  progress: {
    inTop10: number;
    inTop20: number;
    total: number;
    percentComplete: number;
  };

  /** Parent cluster ID (for subtopics) */
  parentId: string | null;
}

/**
 * Full portal data response including clusters.
 */
export interface PortalDataResponse {
  client: {
    name: string;
    domain: string;
  };

  agency: {
    name: string;
    logoUrl: string | null;
  };

  goal: {
    metric: "top_10" | "top_3" | "page_1";
    target: number;
    deadline: string;
    currentCount: number;
    achievementPct: number;
  };

  achievement: {
    current: number;
    target: number;
    percentage: number;
    daysAhead: number;
  };

  /**
   * Clusters for "growth areas" view.
   * Display as pillar cards with nested keywords.
   */
  clusters: PortalCluster[];

  /**
   * Flat keyword list (for simple view toggle).
   * Kept for backwards compatibility.
   */
  keywords: PortalKeyword[];

  calendar: CalendarEvent[];

  lastUpdated: string;
}

/**
 * Calendar event for content schedule.
 */
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: "published" | "scheduled";
  targetKeyword?: string;
}
