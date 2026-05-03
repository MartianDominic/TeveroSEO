import { z } from "zod";
import { type LabsKeywordDataItem } from "@/server/lib/dataforseoClient";
import type { BillingCustomerContext } from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseoClient";
import {
  normalizeIntent,
  normalizeKeyword,
  type EnrichedKeyword,
} from "./helpers";
import type { KeywordSource } from "./selection";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "research-data" });

interface RelatedKeywordItem {
  keyword_data: LabsKeywordDataItem;
  depth?: number;
}

/**
 * Schema for validating related keyword API response items.
 * Allows additional properties since DataForSEO API may include extra fields.
 */
const relatedKeywordItemSchema = z.object({
  keyword_data: z.object({
    keyword: z.string().optional(),
    keyword_info: z.object({
      search_volume: z.number().nullable().optional(),
      cpc: z.number().nullable().optional(),
      competition: z.number().nullable().optional(),
      monthly_searches: z.array(z.object({
        year: z.number(),
        month: z.number(),
        search_volume: z.number().nullable().optional(),
      })).optional(),
    }).optional(),
    keyword_info_normalized_with_clickstream: z.object({
      search_volume: z.number().nullable().optional(),
      monthly_searches: z.array(z.object({
        year: z.number(),
        month: z.number(),
        search_volume: z.number().nullable().optional(),
      })).optional(),
    }).optional(),
    keyword_properties: z.object({
      keyword_difficulty: z.number().nullable().optional(),
    }).optional(),
    search_intent_info: z.object({
      main_intent: z.string().nullable().optional(),
    }).optional(),
  }),
  depth: z.number().optional(),
}).passthrough();

const relatedKeywordsResponseSchema = z.array(relatedKeywordItemSchema);

type FetchResearchRowsParams = {
  seedKeyword: string;
  locationCode: number;
  languageCode: string;
  resultLimit: number;
  source: KeywordSource;
};

function mapKeywordDataItems(items: LabsKeywordDataItem[]): EnrichedKeyword[] {
  const rows: EnrichedKeyword[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const keyword = item.keyword;
    if (!keyword) continue;

    const normalized = normalizeKeyword(keyword);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const keywordInfo = item.keyword_info_normalized_with_clickstream
      ?.search_volume
      ? item.keyword_info_normalized_with_clickstream
      : item.keyword_info;

    rows.push({
      keyword: normalized,
      searchVolume: keywordInfo?.search_volume ?? null,
      trend: (keywordInfo?.monthly_searches ?? []).map((entry) => ({
        year: entry.year,
        month: entry.month,
        searchVolume: entry.search_volume ?? 0,
      })),
      cpc: item.keyword_info?.cpc ?? null,
      competition: item.keyword_info?.competition ?? null,
      keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
      intent: normalizeIntent(item.search_intent_info?.main_intent),
    });
  }

  return rows;
}

async function fetchRelatedRows(
  params: Omit<FetchResearchRowsParams, "source">,
  dataforseo: ReturnType<typeof createDataforseoClient>,
) {
  const rawItems = await dataforseo.keywords.related({
    keyword: params.seedKeyword,
    locationCode: params.locationCode,
    languageCode: params.languageCode,
    limit: params.resultLimit,
    depth: 3,
  });

  // Validate and parse the API response
  const parsed = relatedKeywordsResponseSchema.safeParse(rawItems);
  if (!parsed.success) {
    log.error("Related keywords response validation failed", new Error(JSON.stringify(parsed.error.format())));
    return [];
  }

  const rows: EnrichedKeyword[] = [];
  const seen = new Set<string>();

  for (const item of parsed.data) {
    const keywordData = item.keyword_data;
    const keyword = keywordData.keyword;
    if (!keyword) continue;

    const normalized = normalizeKeyword(keyword);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const keywordInfo = keywordData.keyword_info_normalized_with_clickstream
      ?.search_volume
      ? keywordData.keyword_info_normalized_with_clickstream
      : keywordData.keyword_info;

    rows.push({
      keyword: normalized,
      searchVolume: keywordInfo?.search_volume ?? null,
      trend: (keywordInfo?.monthly_searches ?? []).map((entry) => ({
        year: entry.year,
        month: entry.month,
        searchVolume: entry.search_volume ?? 0,
      })),
      cpc: keywordData.keyword_info?.cpc ?? null,
      competition: keywordData.keyword_info?.competition ?? null,
      keywordDifficulty:
        keywordData.keyword_properties?.keyword_difficulty ?? null,
      intent: normalizeIntent(keywordData.search_intent_info?.main_intent),
    });
  }

  return rows;
}

export async function fetchResearchRowsBySource(
  params: FetchResearchRowsParams,
  billingCustomer: BillingCustomerContext,
): Promise<EnrichedKeyword[]> {
  const dataforseo = createDataforseoClient(billingCustomer);

  if (params.source === "related") {
    return fetchRelatedRows(params, dataforseo);
  }

  if (params.source === "suggestions") {
    return mapKeywordDataItems(
      await dataforseo.keywords.suggestions({
        keyword: params.seedKeyword,
        locationCode: params.locationCode,
        languageCode: params.languageCode,
        limit: params.resultLimit,
      }),
    );
  }

  return mapKeywordDataItems(
    await dataforseo.keywords.ideas({
      keyword: params.seedKeyword,
      locationCode: params.locationCode,
      languageCode: params.languageCode,
      limit: params.resultLimit,
    }),
  );
}
