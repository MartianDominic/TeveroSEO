/**
 * Volume Refresh Processor
 * Phase 93: Keyword Coverage Intelligence
 *
 * Sandboxed processor for volume refresh jobs.
 * Updates keyword metrics WITHOUT triggering re-clustering.
 *
 * CRITICAL per 93-RESEARCH.md pitfall #2:
 * - Only update searchVolume, cpc, competition, enrichedAt
 * - Do NOT touch fields that would trigger clustering (keyword, embedding, etc.)
 */
import type { Job } from "bullmq";
import { db } from "@/db";
import { prospectKeywords } from "@/db/prospect-keyword-schema";
import { prospects } from "@/db/prospect-schema";
import { researchSessionService } from "@/server/features/keywords/services/ResearchSessionService";
import { eq, and, sql, lt, isNull, or, ne } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import type { VolumeRefreshJobData, VolumeRefreshResult } from "@/server/queues/volumeRefreshQueue";

const log = createLogger({ module: "volume-refresh-processor" });

const BATCH_SIZE = 1000;  // DataForSEO max per request
const STALE_THRESHOLD_DAYS = 30;
const COST_PER_REQUEST_USD = 0.15;  // DataForSEO pricing

/**
 * Fetch keyword metrics from DataForSEO.
 * Returns search volume, CPC, and competition for each keyword.
 */
async function fetchKeywordMetrics(
  keywords: string[],
  locationCode: number,
  languageCode: string
): Promise<Array<{
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
}>> {
  // TODO: Wire to existing DataForSEO service
  // For now, stub that returns same keywords with mock metrics
  // Real implementation should use: /keywords_data/google_ads/search_volume/live

  const apiKey = process.env.DATAFORSEO_API_KEY;
  if (!apiKey) {
    log.warn("DATAFORSEO_API_KEY not set, returning mock metrics");
    return keywords.map(kw => ({
      keyword: kw,
      searchVolume: Math.floor(Math.random() * 1000),
      cpc: Math.random() * 5,
      competition: Math.random(),
    }));
  }

  // Real implementation:
  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(apiKey).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords,
          location_code: locationCode,
          language_code: languageCode,
        },
      ]),
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = await response.json();
  const results = data?.tasks?.[0]?.result || [];

  return results.map((r: any) => ({
    keyword: r.keyword,
    searchVolume: r.search_volume ?? null,
    cpc: r.cpc ?? null,
    competition: r.competition ?? null,
  }));
}

/**
 * Process a single prospect's volume refresh.
 */
async function processProspectRefresh(
  prospectId: string,
  triggeredBy: string,
  locationCode: number,
  languageCode: string
): Promise<VolumeRefreshResult> {
  const startTime = Date.now();
  let keywordsUpdated = 0;
  let keywordsSkipped = 0;
  let totalCost = 0;

  // Query keywords needing refresh (enrichedAt > 30 days old OR null)
  const staleThreshold = sql`NOW() - INTERVAL '${STALE_THRESHOLD_DAYS} days'`;

  const staleKeywords = await db
    .select({
      id: prospectKeywords.id,
      keyword: prospectKeywords.keyword,
    })
    .from(prospectKeywords)
    .where(
      and(
        eq(prospectKeywords.prospectId, prospectId),
        or(
          isNull(prospectKeywords.enrichedAt),
          lt(prospectKeywords.enrichedAt, staleThreshold)
        ),
        // Skip excluded/ignored keywords
        or(
          isNull(prospectKeywords.tier),
          ne(prospectKeywords.tier, 'ignore')
        )
      )
    )
    .limit(BATCH_SIZE);

  if (staleKeywords.length === 0) {
    log.info("No stale keywords found", { prospectId });
    return {
      prospectId,
      keywordsUpdated: 0,
      keywordsSkipped: 0,
      costUsd: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Fetch metrics from DataForSEO
  const metrics = await fetchKeywordMetrics(
    staleKeywords.map(k => k.keyword),
    locationCode,
    languageCode
  );
  totalCost = COST_PER_REQUEST_USD;  // One request per batch

  // Build keyword -> metrics map
  const metricsMap = new Map(
    metrics.map(m => [m.keyword.toLowerCase(), m])
  );

  // Bulk update - metadata only, NO clustering trigger
  const now = new Date();
  for (const kw of staleKeywords) {
    const newMetrics = metricsMap.get(kw.keyword.toLowerCase());
    if (newMetrics) {
      await db
        .update(prospectKeywords)
        .set({
          searchVolume: newMetrics.searchVolume,
          cpc: newMetrics.cpc,
          competition: newMetrics.competition,
          enrichedAt: now,
          updatedAt: now,
          // CRITICAL: Do NOT update keyword, normalizedKeyword, embedding, clusterId
          // These would trigger re-clustering per 93-RESEARCH.md pitfall #2
        })
        .where(eq(prospectKeywords.id, kw.id));
      keywordsUpdated++;
    } else {
      keywordsSkipped++;
    }
  }

  // Record research session
  await researchSessionService.recordSession({
    prospectId,
    mode: "REFRESH_VOLUMES",
    seedKeywords: [],  // No seeds for volume refresh
    locationCode,
    languageCode,
    newKeywordsCount: 0,  // Volume refresh doesn't add new keywords
    duplicateCount: 0,
    totalCostUsd: totalCost,
    triggeredBy,
  });

  log.info("Volume refresh complete", {
    prospectId,
    keywordsUpdated,
    keywordsSkipped,
    costUsd: totalCost,
  });

  return {
    prospectId,
    keywordsUpdated,
    keywordsSkipped,
    costUsd: totalCost,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Main processor function.
 */
export default async function volumeRefreshProcessor(
  job: Job<VolumeRefreshJobData>
): Promise<VolumeRefreshResult | VolumeRefreshResult[]> {
  const { prospectId, triggeredBy, locationCode, languageCode } = job.data;
  const jobLog = createLogger({ module: "volume-refresh-processor", jobId: job.id });

  const loc = locationCode ?? 2440;  // Default: Lithuania
  const lang = languageCode ?? "lt";

  jobLog.info("Starting volume refresh", { prospectId, triggeredBy });

  // Handle "all" prospect (monthly global refresh)
  if (prospectId === "all") {
    const allProspects = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(eq(prospects.status, "analyzed"));  // Only analyzed prospects

    const results: VolumeRefreshResult[] = [];
    for (const p of allProspects) {
      try {
        const result = await processProspectRefresh(p.id, triggeredBy, loc, lang);
        results.push(result);
        // Rate limit: 5 requests per minute per 93-RESEARCH.md
        await new Promise(resolve => setTimeout(resolve, 12000));  // 12s between prospects
      } catch (error) {
        jobLog.error("Failed to refresh prospect", error as Error, { prospectId: p.id });
      }
    }
    return results;
  }

  // Single prospect refresh
  return processProspectRefresh(prospectId, triggeredBy, loc, lang);
}
