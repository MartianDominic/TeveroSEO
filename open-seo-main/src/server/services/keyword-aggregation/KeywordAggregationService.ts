/**
 * Keyword Aggregation Service
 * Phase 34: Keyword-Page Mapping
 *
 * Aggregates keywords from multiple sources for unified keyword-page mapping:
 * - GSC query snapshots (last 30 days, min 10 impressions)
 * - Saved keywords with metrics
 * - Keyword rankings (current positions)
 * - Prospect analyses (gap/opportunity keywords if client converted from prospect)
 *
 * Deduplicates by keyword (case-insensitive) and tracks source attribution.
 */
import { and, eq, gte, sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { gscQuerySnapshots } from "@/db/analytics-schema";
import { savedKeywords, keywordMetrics, projects } from "@/db/app.schema";
import { keywordRankings } from "@/db/ranking-schema";
import { clients } from "@/db/client-schema";
import { prospectAnalyses } from "@/db/prospect-schema";

/**
 * Sources from which keywords can be aggregated.
 */
export type KeywordSource =
  | "gsc"
  | "saved"
  | "ranking"
  | "prospect_gap"
  | "prospect_opportunity";

/**
 * Unified keyword representation with source attribution.
 */
export interface AggregatedKeyword {
  /** Normalized keyword text (lowercase, trimmed) */
  keyword: string;
  /** Original keyword text (preserves case) */
  originalKeyword: string;
  /** Sources this keyword appears in */
  sources: KeywordSource[];
  /** Current ranking position (if known) */
  currentPosition: number | null;
  /** URL that currently ranks for this keyword */
  currentUrl: string | null;
  /** Monthly search volume */
  searchVolume: number | null;
  /** Cost per click */
  cpc: number | null;
  /** Keyword difficulty (0-100) */
  difficulty: number | null;
  /** Average position from GSC data */
  gscAvgPosition: number | null;
  /** Total impressions from GSC (last 30 days) */
  gscImpressions: number | null;
  /** Total clicks from GSC (last 30 days) */
  gscClicks: number | null;
  /** Achievability score from prospect analysis (0-100) */
  achievability: number | null;
  /** Whether keyword is actively tracked */
  isTracked: boolean;
}

/**
 * Options for keyword aggregation.
 */
export interface AggregationOptions {
  /** Minimum GSC impressions threshold (default: 10) */
  minGscImpressions?: number;
  /** Number of days for GSC data (default: 30) */
  gscDaysBack?: number;
  /** Include prospect analysis keywords (default: true) */
  includeProspectKeywords?: boolean;
}

/**
 * Result of keyword aggregation.
 */
export interface AggregationResult {
  /** Aggregated keywords, deduplicated */
  keywords: AggregatedKeyword[];
  /** Count by source */
  sourceCounts: Record<KeywordSource, number>;
  /** Total unique keywords */
  totalUnique: number;
  /** Client ID if available */
  clientId: string | null;
  /** Prospect ID if client converted from prospect */
  prospectId: string | null;
}

/**
 * Internal type for GSC keyword aggregation.
 */
interface GSCKeywordData {
  keyword: string;
  avgPosition: number;
  totalImpressions: number;
  totalClicks: number;
}

/**
 * Internal type for saved keyword data.
 */
interface SavedKeywordData {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  difficulty: number | null;
  isTracked: boolean;
}

/**
 * Internal type for ranking data.
 */
interface RankingData {
  keyword: string;
  position: number;
  url: string | null;
}

/**
 * Internal type for prospect keyword data.
 */
interface ProspectKeywordData {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  difficulty: number | null;
  achievability: number | null;
  source: "prospect_gap" | "prospect_opportunity";
}

/**
 * Get the client ID associated with a project.
 */
async function getProjectClient(
  projectId: string,
): Promise<{ clientId: string | null } | null> {
  const result = await db
    .select({
      clientId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  // Note: In the current schema, projects don't directly reference clients.
  // We need to find the client via the workspace/organization.
  // For now, we'll look for a client with matching workspace.
  if (result.length === 0) {
    return null;
  }

  const workspaceId = result[0].clientId;

  // Find client in this workspace - take most recent active client
  const clientResult = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.workspaceId, workspaceId))
    .orderBy(desc(clients.createdAt))
    .limit(1);

  return {
    clientId: clientResult[0]?.id ?? null,
  };
}

/**
 * Aggregate keywords from GSC query snapshots.
 * Filters by date range and minimum impressions.
 */
async function aggregateFromGSC(
  clientId: string,
  minImpressions: number,
  daysBack: number,
): Promise<GSCKeywordData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split("T")[0];

  // Aggregate by query (case-insensitive grouping handled in merge)
  const result = await db
    .select({
      query: gscQuerySnapshots.query,
      avgPosition: sql<number>`avg(${gscQuerySnapshots.position})`.as(
        "avg_position",
      ),
      totalImpressions: sql<number>`sum(${gscQuerySnapshots.impressions})`.as(
        "total_impressions",
      ),
      totalClicks: sql<number>`sum(${gscQuerySnapshots.clicks})`.as(
        "total_clicks",
      ),
    })
    .from(gscQuerySnapshots)
    .where(
      and(
        eq(gscQuerySnapshots.clientId, clientId),
        gte(gscQuerySnapshots.date, startDateStr),
      ),
    )
    .groupBy(gscQuerySnapshots.query)
    .having(sql`sum(${gscQuerySnapshots.impressions}) >= ${minImpressions}`);

  return result.map((row) => ({
    keyword: row.query,
    avgPosition: Number(row.avgPosition),
    totalImpressions: Number(row.totalImpressions),
    totalClicks: Number(row.totalClicks),
  }));
}

/**
 * Aggregate keywords from saved keywords table with metrics.
 */
async function aggregateFromSavedKeywords(
  projectId: string,
): Promise<SavedKeywordData[]> {
  const result = await db
    .select({
      keyword: savedKeywords.keyword,
      trackingEnabled: savedKeywords.trackingEnabled,
      searchVolume: keywordMetrics.searchVolume,
      cpc: keywordMetrics.cpc,
      difficulty: keywordMetrics.keywordDifficulty,
    })
    .from(savedKeywords)
    .leftJoin(
      keywordMetrics,
      and(
        eq(keywordMetrics.projectId, savedKeywords.projectId),
        eq(keywordMetrics.keyword, savedKeywords.keyword),
        eq(keywordMetrics.locationCode, savedKeywords.locationCode),
        eq(keywordMetrics.languageCode, savedKeywords.languageCode),
      ),
    )
    .where(eq(savedKeywords.projectId, projectId));

  return result.map((row) => ({
    keyword: row.keyword,
    searchVolume: row.searchVolume,
    cpc: row.cpc,
    difficulty: row.difficulty,
    isTracked: row.trackingEnabled ?? true,
  }));
}

/**
 * Aggregate keywords from ranking data.
 * Gets the most recent position for each keyword.
 */
async function aggregateFromRankings(
  projectId: string,
): Promise<RankingData[]> {
  // First get saved keyword IDs for this project
  const savedKeywordIds = await db
    .select({ id: savedKeywords.id, keyword: savedKeywords.keyword })
    .from(savedKeywords)
    .where(eq(savedKeywords.projectId, projectId));

  if (savedKeywordIds.length === 0) {
    return [];
  }

  const keywordIdMap = new Map(
    savedKeywordIds.map((sk) => [sk.id, sk.keyword]),
  );
  const ids = savedKeywordIds.map((sk) => sk.id);

  // Get latest ranking for each keyword using a subquery
  // We need the most recent date's ranking for each keyword
  const latestRankings = await db
    .select({
      keywordId: keywordRankings.keywordId,
      position: keywordRankings.position,
      url: keywordRankings.url,
      date: keywordRankings.date,
    })
    .from(keywordRankings)
    .where(inArray(keywordRankings.keywordId, ids))
    .orderBy(desc(keywordRankings.date));

  // Deduplicate to get only the latest for each keyword
  const latestByKeyword = new Map<
    string,
    { position: number; url: string | null }
  >();
  for (const ranking of latestRankings) {
    if (!latestByKeyword.has(ranking.keywordId)) {
      latestByKeyword.set(ranking.keywordId, {
        position: ranking.position,
        url: ranking.url,
      });
    }
  }

  return Array.from(latestByKeyword.entries()).map(([keywordId, data]) => ({
    keyword: keywordIdMap.get(keywordId) ?? "",
    position: data.position,
    url: data.url,
  }));
}

/**
 * Aggregate keywords from prospect analysis if client was converted from prospect.
 */
async function aggregateFromProspectAnalysis(
  clientId: string,
): Promise<{ keywords: ProspectKeywordData[]; prospectId: string | null }> {
  // Find if client was converted from a prospect
  const clientData = await db
    .select({
      convertedFromProspectId: clients.convertedFromProspectId,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const prospectId = clientData[0]?.convertedFromProspectId ?? null;
  if (!prospectId) {
    return { keywords: [], prospectId: null };
  }

  // Get the latest completed analysis for this prospect
  const analysisResult = await db
    .select({
      keywordGaps: prospectAnalyses.keywordGaps,
      opportunityKeywords: prospectAnalyses.opportunityKeywords,
    })
    .from(prospectAnalyses)
    .where(
      and(
        eq(prospectAnalyses.prospectId, prospectId),
        eq(prospectAnalyses.status, "completed"),
      ),
    )
    .orderBy(desc(prospectAnalyses.completedAt))
    .limit(1);

  if (analysisResult.length === 0) {
    return { keywords: [], prospectId };
  }

  const analysis = analysisResult[0];
  const keywords: ProspectKeywordData[] = [];

  // Add gap keywords
  const gaps = analysis.keywordGaps ?? [];
  for (const gap of gaps) {
    keywords.push({
      keyword: gap.keyword,
      searchVolume: gap.searchVolume,
      cpc: gap.cpc,
      difficulty: gap.difficulty,
      achievability: gap.achievability ?? null,
      source: "prospect_gap",
    });
  }

  // Add opportunity keywords
  const opportunities = analysis.opportunityKeywords ?? [];
  for (const opp of opportunities) {
    keywords.push({
      keyword: opp.keyword,
      searchVolume: opp.searchVolume,
      cpc: opp.cpc,
      difficulty: opp.difficulty,
      achievability: opp.achievability ?? null,
      source: "prospect_opportunity",
    });
  }

  return { keywords, prospectId };
}

/**
 * Merge and deduplicate keywords from all sources.
 * Uses case-insensitive matching and merges metrics.
 */
function mergeAndDeduplicate(
  gscKeywords: GSCKeywordData[],
  savedKeywordsList: SavedKeywordData[],
  rankings: RankingData[],
  prospectKeywords: ProspectKeywordData[],
): AggregatedKeyword[] {
  const keywordMap = new Map<string, AggregatedKeyword>();

  // Helper to normalize keyword for deduplication
  const normalize = (kw: string): string => kw.toLowerCase().trim();

  // Helper to get or create aggregated keyword entry
  const getOrCreate = (keyword: string): AggregatedKeyword => {
    const key = normalize(keyword);
    if (!keywordMap.has(key)) {
      keywordMap.set(key, {
        keyword: key,
        originalKeyword: keyword,
        sources: [],
        currentPosition: null,
        currentUrl: null,
        searchVolume: null,
        cpc: null,
        difficulty: null,
        gscAvgPosition: null,
        gscImpressions: null,
        gscClicks: null,
        achievability: null,
        isTracked: false,
      });
    }
    return keywordMap.get(key)!;
  };

  // Process GSC keywords
  for (const gsc of gscKeywords) {
    const agg = getOrCreate(gsc.keyword);
    if (!agg.sources.includes("gsc")) {
      agg.sources.push("gsc");
    }
    agg.gscAvgPosition = gsc.avgPosition;
    agg.gscImpressions = gsc.totalImpressions;
    agg.gscClicks = gsc.totalClicks;
  }

  // Process saved keywords (higher priority for metrics)
  for (const saved of savedKeywordsList) {
    const agg = getOrCreate(saved.keyword);
    if (!agg.sources.includes("saved")) {
      agg.sources.push("saved");
    }
    // Saved keywords metrics take priority
    agg.searchVolume = saved.searchVolume ?? agg.searchVolume;
    agg.cpc = saved.cpc ?? agg.cpc;
    agg.difficulty = saved.difficulty ?? agg.difficulty;
    agg.isTracked = saved.isTracked || agg.isTracked;
  }

  // Process rankings (highest priority for position data)
  for (const ranking of rankings) {
    const agg = getOrCreate(ranking.keyword);
    if (!agg.sources.includes("ranking")) {
      agg.sources.push("ranking");
    }
    // Ranking position is the authoritative current position
    agg.currentPosition = ranking.position;
    agg.currentUrl = ranking.url;
  }

  // Process prospect keywords (fill in gaps)
  for (const prospect of prospectKeywords) {
    const agg = getOrCreate(prospect.keyword);
    if (!agg.sources.includes(prospect.source)) {
      agg.sources.push(prospect.source);
    }
    // Only use prospect data if not already set
    agg.searchVolume = agg.searchVolume ?? prospect.searchVolume;
    agg.cpc = agg.cpc ?? prospect.cpc;
    agg.difficulty = agg.difficulty ?? prospect.difficulty;
    agg.achievability = prospect.achievability ?? agg.achievability;
  }

  // Convert map to array and sort by search volume (descending)
  return Array.from(keywordMap.values()).sort((a, b) => {
    const volA = a.searchVolume ?? 0;
    const volB = b.searchVolume ?? 0;
    return volB - volA;
  });
}

/**
 * Aggregate keywords for a project from all available sources.
 *
 * @param projectId - The project ID to aggregate keywords for
 * @param options - Aggregation options
 * @returns Aggregated keywords with source attribution
 */
export async function aggregateKeywords(
  projectId: string,
  options: AggregationOptions = {},
): Promise<AggregationResult> {
  const {
    minGscImpressions = 10,
    gscDaysBack = 30,
    includeProspectKeywords = true,
  } = options;

  // Find client ID for this project (needed for GSC data and prospect lookup)
  const projectData = await getProjectClient(projectId);
  const clientId = projectData?.clientId ?? null;
  let prospectId: string | null = null;

  // Aggregate from all sources in parallel
  const [gscKeywords, savedKeywordsList, rankings] = await Promise.all([
    clientId
      ? aggregateFromGSC(clientId, minGscImpressions, gscDaysBack)
      : Promise.resolve([]),
    aggregateFromSavedKeywords(projectId),
    aggregateFromRankings(projectId),
  ]);

  // Get prospect keywords if client was converted from prospect
  let prospectKeywords: ProspectKeywordData[] = [];
  if (includeProspectKeywords && clientId) {
    const prospectData = await aggregateFromProspectAnalysis(clientId);
    prospectKeywords = prospectData.keywords;
    prospectId = prospectData.prospectId;
  }

  // Merge and deduplicate all sources
  const merged = mergeAndDeduplicate(
    gscKeywords,
    savedKeywordsList,
    rankings,
    prospectKeywords,
  );

  // Calculate source counts
  const sourceCounts: Record<KeywordSource, number> = {
    gsc: 0,
    saved: 0,
    ranking: 0,
    prospect_gap: 0,
    prospect_opportunity: 0,
  };

  for (const kw of merged) {
    for (const source of kw.sources) {
      sourceCounts[source]++;
    }
  }

  return {
    keywords: merged,
    sourceCounts,
    totalUnique: merged.length,
    clientId,
    prospectId,
  };
}

/**
 * Calculate aggregation statistics from an aggregation result.
 */
export function calculateAggregationStats(keywords: AggregatedKeyword[]) {
  return {
    totalKeywords: keywords.length,
    withSearchVolume: keywords.filter((k) => k.searchVolume !== null).length,
    withPosition: keywords.filter((k) => k.currentPosition !== null).length,
  };
}

/**
 * Static service object for keyword aggregation.
 */
export const KeywordAggregationService = {
  aggregateKeywords,
  calculateAggregationStats,
} as const;
