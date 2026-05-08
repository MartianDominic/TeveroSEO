import { type SerpLiveItem } from "@/server/lib/dataforseoClient";
import { buildCacheKey, getCached, setCached } from "@/server/lib/r2-cache";
import type { SerpResultItem } from "@/types/keywords";
import { z } from "zod";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseoClient";
import { normalizeKeyword } from "./helpers";
import { createLogger } from "@/server/lib/logger";
import { getDfsCostTracker } from "@/server/features/scraping/providers/DfsCostTracker";
import { getFeatureFlagWithOverride } from "@/server/features/scraping/config/flags-loader";
import type { DbClient } from "@/db";

const log = createLogger({ module: "keywords/serp" });

/**
 * SERP Live API cost per request (DataForSEO pricing)
 * Reference: https://dataforseo.com/pricing
 */
const SERP_LIVE_API_COST = 0.002;

const SERP_CACHE_TTL_SECONDS = 12 * 60 * 60;

type SerpAnalysisReason = "no_organic_results";

type SerpAnalysisResult = {
  requestedKeyword: string;
  items: SerpResultItem[];
  reason?: SerpAnalysisReason;
};

const serpResultItemSchema = z.object({
  rank: z.number().int(),
  title: z.string(),
  url: z.string(),
  domain: z.string(),
  description: z.string(),
  etv: z.number().nullable(),
  estimatedPaidTrafficCost: z.number().nullable(),
  referringDomains: z.number().nullable(),
  backlinks: z.number().nullable(),
  isNew: z.boolean(),
  rankChange: z.number().nullable(),
});

const serpCacheSchema = z.object({
  requestedKeyword: z.string(),
  items: z.array(serpResultItemSchema),
  reason: z.enum(["no_organic_results"]).optional(),
});

function mapOrganicSerpItems(items: SerpLiveItem[]): SerpResultItem[] {
  return items
    .filter((item) => item.type === "organic")
    .map((item) => ({
      rank: item.rank_absolute ?? item.rank_group ?? 0,
      title: item.title ?? "",
      url: item.url ?? "",
      domain: item.domain ?? "",
      description: item.description ?? "",
      etv: item.etv ?? null,
      estimatedPaidTrafficCost: item.estimated_paid_traffic_cost ?? null,
      referringDomains: item.backlinks_info?.referring_domains ?? null,
      backlinks: item.backlinks_info?.backlinks ?? null,
      isNew: false,
      rankChange: null,
    }));
}

/**
 * Options for SERP analysis with cost tracking support.
 */
interface SerpAnalysisOptions {
  projectId: string;
  keyword: string;
  locationCode: number;
  languageCode: string;
  /** Client ID for cost attribution (Phase 95) */
  clientId?: string;
  /** Workspace ID for cost attribution (Phase 95) */
  workspaceId?: string;
}

/**
 * Fetch SERP analysis with optional cost tracking.
 *
 * Phase 95 Gap Closure (GAP-K4):
 * - Added clientId/workspaceId for cost attribution
 * - Added DfsCostTracker integration for SERP API calls
 * - Preserved existing R2 cache behavior
 * - serpApi migration flag checked for future routing
 *
 * @param input - SERP analysis input with optional cost attribution
 * @param billingCustomer - Billing context for DataForSEO client
 * @param db - Database client for cost tracking (optional for backward compatibility)
 */
async function getSerpLiveAnalysis(
  input: SerpAnalysisOptions,
  billingCustomer: BillingCustomerContext,
  db?: DbClient,
): Promise<SerpAnalysisResult> {
  const keyword = normalizeKeyword(input.keyword);
  const startTime = Date.now();

  // Check serpApi migration flag for future routing decisions
  const serpApiFlag = getFeatureFlagWithOverride("serpApi");
  const shouldTrackCosts = db && (serpApiFlag !== "legacy");

  const cacheKey = await buildCacheKey("serp:analysis", {
    organizationId: billingCustomer.organizationId,
    projectId: input.projectId,
    keyword,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });

  const cachedRaw = await getCached(cacheKey);
  const cached = serpCacheSchema.safeParse(cachedRaw);
  if (cached.success) {
    log.debug("SERP cache hit", { keyword, cacheHit: true });
    return cached.data;
  }

  // Get cost tracker if we should track costs
  const costTracker = shouldTrackCosts ? getDfsCostTracker(db) : null;

  try {
    const liveItems = await createDataforseoClient(billingCustomer).serp.live({
      keyword,
      locationCode: input.locationCode,
      languageCode: input.languageCode,
    });

    const responseTimeMs = Date.now() - startTime;

    // Record successful cost
    if (costTracker) {
      void costTracker.recordCost({
        url: keyword,
        domain: "serp-api",
        mode: "basic",
        usedStandardQueue: false, // SERP Live API uses live queue
        estimatedCost: SERP_LIVE_API_COST,
        actualCost: SERP_LIVE_API_COST,
        success: true,
        responseTimeMs,
        clientId: input.clientId,
        workspaceId: input.workspaceId,
      }).catch((err) => {
        log.warn("Failed to record SERP cost", { error: err instanceof Error ? err.message : String(err) });
      });
    }

    const items = mapOrganicSerpItems(liveItems);
    const result: SerpAnalysisResult = { requestedKeyword: keyword, items };
    if (items.length === 0) {
      result.reason = "no_organic_results";
    }

    void setCached(cacheKey, result, SERP_CACHE_TTL_SECONDS).catch((error) => {
      log.error("Cache write failed", error instanceof Error ? error : new Error(String(error)));
    });

    return result;
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    // Record failed cost
    if (costTracker) {
      void costTracker.recordCost({
        url: keyword,
        domain: "serp-api",
        mode: "basic",
        usedStandardQueue: false,
        estimatedCost: SERP_LIVE_API_COST,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs,
        clientId: input.clientId,
        workspaceId: input.workspaceId,
      }).catch((err) => {
        log.warn("Failed to record SERP error cost", { error: err instanceof Error ? err.message : String(err) });
      });
    }

    throw error;
  }
}

export const getSerpAnalysis = getSerpLiveAnalysis;
