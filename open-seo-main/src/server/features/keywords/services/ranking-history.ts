/**
 * Keyword ranking history service.
 * Provides access to historical ranking data for sparklines and charts.
 */
import { db } from "@/db";
import { keywordRankings } from "@/db/ranking-schema";
import { savedKeywords } from "@/db/app.schema";
import { eq, and, gte, lte, asc, desc, inArray } from "drizzle-orm";

interface GetHistoryParams {
  keywordId: string;
  days?: number;
}

interface GetLatestParams {
  keywordId: string;
}

interface GetSavedWithRankingsParams {
  projectId: string;
}

/**
 * Get ranking history for a keyword within a date range.
 */
export async function getKeywordRankingHistory({
  keywordId,
  days = 30,
}: GetHistoryParams) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const rankings = await db
    .select({
      date: keywordRankings.date,
      position: keywordRankings.position,
      previousPosition: keywordRankings.previousPosition,
      url: keywordRankings.url,
      serpFeatures: keywordRankings.serpFeatures,
    })
    .from(keywordRankings)
    .where(
      and(
        eq(keywordRankings.keywordId, keywordId),
        gte(keywordRankings.date, startDate),
        lte(keywordRankings.date, endDate),
      ),
    )
    .orderBy(asc(keywordRankings.date));

  return { rows: rankings };
}

/**
 * Get the latest ranking for a keyword with change indicator.
 */
export async function getKeywordLatestRanking({ keywordId }: GetLatestParams) {
  const [latest] = await db
    .select()
    .from(keywordRankings)
    .where(eq(keywordRankings.keywordId, keywordId))
    .orderBy(desc(keywordRankings.date))
    .limit(1);

  if (!latest) {
    return { position: null, change: null };
  }

  // Positive change = improved (moved up in rankings)
  const change = latest.previousPosition
    ? latest.previousPosition - latest.position
    : null;

  return {
    position: latest.position,
    previousPosition: latest.previousPosition,
    change,
    url: latest.url,
    serpFeatures: latest.serpFeatures,
    date: latest.date,
  };
}

/**
 * Get saved keywords with their recent rankings (last 30 days) for sparklines.
 */
export async function getSavedKeywordsWithRankings({
  projectId,
}: GetSavedWithRankingsParams) {
  // Get all saved keywords for the project
  const keywords = await db
    .select()
    .from(savedKeywords)
    .where(eq(savedKeywords.projectId, projectId));

  if (keywords.length === 0) {
    return { rows: [] };
  }

  // Get last 30 days of rankings for all keywords
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const keywordIds = keywords.map((k) => k.id);
  const rankings = await db
    .select()
    .from(keywordRankings)
    .where(
      and(
        inArray(keywordRankings.keywordId, keywordIds),
        gte(keywordRankings.date, thirtyDaysAgo),
      ),
    )
    .orderBy(asc(keywordRankings.date));

  // Group rankings by keywordId
  const rankingsByKeyword = new Map<string, typeof rankings>();
  for (const r of rankings) {
    if (!rankingsByKeyword.has(r.keywordId)) {
      rankingsByKeyword.set(r.keywordId, []);
    }
    rankingsByKeyword.get(r.keywordId)!.push(r);
  }

  // Attach rankings to each keyword
  const keywordsWithRankings = keywords.map((k) => ({
    ...k,
    rankings: rankingsByKeyword.get(k.id) ?? [],
  }));

  return { rows: keywordsWithRankings };
}
