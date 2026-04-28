import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "dataforseo-schemas" });

const dataforseoTaskSchema = z
  .object({
    status_code: z.number().optional(),
    status_message: z.string().optional(),
    path: z.array(z.string()),
    cost: z.number(),
    result_count: z.number().nullable(),
    result: z
      .array(
        z
          .object({
            items: z.array(z.unknown()).nullable().optional(),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

export type DataforseoTask = z.infer<typeof dataforseoTaskSchema>;
export const successfulDataforseoTaskSchema = dataforseoTaskSchema;

export const dataforseoResponseSchema = z
  .object({
    status_code: z.number().optional(),
    status_message: z.string().optional(),
    tasks: z.array(dataforseoTaskSchema).optional(),
  })
  .passthrough();

const monthlySearchSchema = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    search_volume: z.number().nullable(),
  })
  .passthrough();

const keywordInfoSchema = z
  .object({
    search_volume: z.number().nullable().optional(),
    cpc: z.number().nullable().optional(),
    competition: z.number().nullable().optional(),
    monthly_searches: z.array(monthlySearchSchema).nullable().optional(),
  })
  .passthrough();

const keywordInfoWithClickstreamSchema = z
  .object({
    search_volume: z.number().nullable().optional(),
    monthly_searches: z.array(monthlySearchSchema).nullable().optional(),
  })
  .passthrough();

const searchIntentInfoSchema = z
  .object({
    main_intent: z.string().nullable().optional(),
  })
  .passthrough();

const keywordPropertiesSchema = z
  .object({
    keyword_difficulty: z.number().nullable().optional(),
  })
  .passthrough();

export const relatedKeywordItemSchema = z
  .object({
    keyword_data: z
      .object({
        keyword: z.string().optional(),
        keyword_info: keywordInfoSchema.optional(),
        keyword_info_normalized_with_clickstream:
          keywordInfoWithClickstreamSchema.optional(),
        search_intent_info: searchIntentInfoSchema.nullable().optional(),
        keyword_properties: keywordPropertiesSchema.nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const labsKeywordDataItemSchema = z
  .object({
    keyword: z.string(),
    keyword_info: keywordInfoSchema.optional(),
    keyword_info_normalized_with_clickstream:
      keywordInfoWithClickstreamSchema.optional(),
    search_intent_info: searchIntentInfoSchema.nullable().optional(),
    keyword_properties: keywordPropertiesSchema.nullable().optional(),
  })
  .passthrough();

const domainMetricsValueSchema = z
  .object({
    etv: z.number().nullable().optional(),
    count: z.number().nullable().optional(),
  })
  .passthrough();

export const domainMetricsItemSchema = z
  .object({
    metrics: z.record(
      z.string(),
      domainMetricsValueSchema.nullable().optional(),
    ),
  })
  .passthrough();

const rankedKeywordInfoSchema = z
  .object({
    search_volume: z.number().nullable().optional(),
    cpc: z.number().nullable().optional(),
    keyword_difficulty: z.number().nullable().optional(),
  })
  .passthrough();

const rankedKeywordDataSchema = z
  .object({
    keyword: z.string().nullable().optional(),
    keyword_info: rankedKeywordInfoSchema.nullable().optional(),
    keyword_properties: keywordPropertiesSchema.nullable().optional(),
  })
  .passthrough();

const rankedSerpItemSchema = z
  .object({
    url: z.string().nullable().optional(),
    relative_url: z.string().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    etv: z.number().nullable().optional(),
  })
  .passthrough();

const rankedSerpElementSchema = z
  .object({
    serp_item: rankedSerpItemSchema.nullable().optional(),
    url: z.string().nullable().optional(),
    relative_url: z.string().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    etv: z.number().nullable().optional(),
  })
  .passthrough();

export const domainRankedKeywordItemSchema = z
  .object({
    keyword_data: rankedKeywordDataSchema.nullable().optional(),
    ranked_serp_element: rankedSerpElementSchema.nullable().optional(),
    keyword: z.string().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    etv: z.number().nullable().optional(),
    keyword_difficulty: z.number().nullable().optional(),
  })
  .passthrough();

export const serpSnapshotItemSchema = z
  .object({
    type: z.string(),
    rank_group: z.number().nullable().optional(),
    rank_absolute: z.number().nullable().optional(),
    domain: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    breadcrumb: z.string().nullable().optional(),
    etv: z.number().nullable().optional(),
    estimated_paid_traffic_cost: z.number().nullable().optional(),
    backlinks_info: z
      .object({
        referring_domains: z.number().nullable().optional(),
        backlinks: z.number().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    rank_changes: z
      .object({
        previous_rank_absolute: z.number().nullable().optional(),
        is_new: z.boolean().nullable().optional(),
        is_up: z.boolean().nullable().optional(),
        is_down: z.boolean().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type RelatedKeywordItem = z.infer<typeof relatedKeywordItemSchema>;
export type LabsKeywordDataItem = z.infer<typeof labsKeywordDataItemSchema>;
export type DomainMetricsItem = z.infer<typeof domainMetricsItemSchema>;
export type DomainRankedKeywordItem = z.infer<
  typeof domainRankedKeywordItemSchema
>;
export type SerpLiveItem = z.infer<typeof serpSnapshotItemSchema>;

export function parseTaskItems<T extends z.ZodType>(
  endpointName: string,
  task: DataforseoTask,
  itemSchema: T,
): z.infer<T>[] {
  const parsed = z.array(itemSchema).safeParse(task.result?.[0]?.items ?? []);
  if (!parsed.success) {
    log.error("Invalid payload from DataForSEO", undefined, {
      endpoint: endpointName,
      issues: parsed.error.issues.slice(0, 5),
    });
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO ${endpointName} returned an invalid response shape`,
    );
  }
  return parsed.data;
}

// ============================================================================
// Keywords For Site API (prospect analysis)
// ============================================================================

/**
 * Schema for items returned by /v3/dataforseo_labs/google/keywords_for_site/live
 * Each item represents a keyword the target domain ranks for.
 */
export const keywordsForSiteItemSchema = z
  .object({
    keyword: z.string(),
    location_code: z.number().nullable().optional(),
    language_code: z.string().nullable().optional(),
    keyword_info: z
      .object({
        search_volume: z.number().nullable().optional(),
        cpc: z.number().nullable().optional(),
        competition: z.number().nullable().optional(),
        competition_level: z.string().nullable().optional(),
        categories: z.array(z.number()).nullable().optional(),
        monthly_searches: z
          .array(
            z.object({
              year: z.number(),
              month: z.number(),
              search_volume: z.number(),
            }),
          )
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    keyword_info_normalized_with_bing: z
      .object({
        search_volume: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    impressions_info: z
      .object({
        se_type: z.string().nullable().optional(),
        last_updated_time: z.string().nullable().optional(),
        bid: z.number().nullable().optional(),
        match_type: z.string().nullable().optional(),
        ad_position_min: z.number().nullable().optional(),
        ad_position_max: z.number().nullable().optional(),
        ad_position_average: z.number().nullable().optional(),
        cpc_min: z.number().nullable().optional(),
        cpc_max: z.number().nullable().optional(),
        cpc_average: z.number().nullable().optional(),
        daily_impressions_min: z.number().nullable().optional(),
        daily_impressions_max: z.number().nullable().optional(),
        daily_impressions_average: z.number().nullable().optional(),
        daily_clicks_min: z.number().nullable().optional(),
        daily_clicks_max: z.number().nullable().optional(),
        daily_clicks_average: z.number().nullable().optional(),
        daily_cost_min: z.number().nullable().optional(),
        daily_cost_max: z.number().nullable().optional(),
        daily_cost_average: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    serp_info: z
      .object({
        serp_type: z.string().nullable().optional(),
        check_url: z.string().nullable().optional(),
        serp_check_time: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    ranked_serp_element: z
      .object({
        se_type: z.string().nullable().optional(),
        serp_item: z
          .object({
            se_type: z.string().nullable().optional(),
            type: z.string().nullable().optional(),
            rank_group: z.number().nullable().optional(),
            rank_absolute: z.number().nullable().optional(),
            position: z.string().nullable().optional(),
            xpath: z.string().nullable().optional(),
            domain: z.string().nullable().optional(),
            url: z.string().nullable().optional(),
            title: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            etv: z.number().nullable().optional(),
            estimated_paid_traffic_cost: z.number().nullable().optional(),
            rank_changes: z
              .object({
                previous_rank_absolute: z.number().nullable().optional(),
                is_new: z.boolean().nullable().optional(),
                is_up: z.boolean().nullable().optional(),
                is_down: z.boolean().nullable().optional(),
              })
              .nullable()
              .optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type KeywordsForSiteItem = z.infer<typeof keywordsForSiteItemSchema>;

// ============================================================================
// Competitors Domain API (prospect analysis)
// ============================================================================

/**
 * Schema for items returned by /v3/dataforseo_labs/google/competitors_domain/live
 * Each item represents a competing domain.
 */
export const competitorsDomainItemSchema = z
  .object({
    se_type: z.string().nullable().optional(),
    domain: z.string(),
    avg_position: z.number().nullable().optional(),
    sum_position: z.number().nullable().optional(),
    intersections: z.number().nullable().optional(),
    full_domain_metrics: z
      .object({
        organic: z
          .object({
            pos_1: z.number().nullable().optional(),
            pos_2_3: z.number().nullable().optional(),
            pos_4_10: z.number().nullable().optional(),
            pos_11_20: z.number().nullable().optional(),
            pos_21_30: z.number().nullable().optional(),
            pos_31_40: z.number().nullable().optional(),
            pos_41_50: z.number().nullable().optional(),
            pos_51_60: z.number().nullable().optional(),
            pos_61_70: z.number().nullable().optional(),
            pos_71_80: z.number().nullable().optional(),
            pos_81_90: z.number().nullable().optional(),
            pos_91_100: z.number().nullable().optional(),
            etv: z.number().nullable().optional(),
            impressions_etv: z.number().nullable().optional(),
            count: z.number().nullable().optional(),
            estimated_paid_traffic_cost: z.number().nullable().optional(),
            is_new: z.number().nullable().optional(),
            is_up: z.number().nullable().optional(),
            is_down: z.number().nullable().optional(),
            is_lost: z.number().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type CompetitorsDomainItem = z.infer<typeof competitorsDomainItemSchema>;

// ============================================================================
// Domain Intersection API (keyword gap analysis)
// ============================================================================

/**
 * Schema for items returned by /v3/dataforseo_labs/google/domain_intersection/live
 * Each item represents a keyword where domain 1 ranks but domain 2 doesn't (a gap).
 */
export const domainIntersectionItemSchema = z
  .object({
    keyword_data: z
      .object({
        keyword: z.string(),
        keyword_info: z
          .object({
            search_volume: z.number().nullable().optional(),
            cpc: z.number().nullable().optional(),
          })
          .nullable()
          .optional(),
        keyword_properties: z
          .object({
            keyword_difficulty: z.number().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
    domain_1_ranked_serp_element: z
      .object({
        rank_absolute: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    domain_2_ranked_serp_element: z
      .object({
        rank_absolute: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type DomainIntersectionItem = z.infer<typeof domainIntersectionItemSchema>;

// ============================================================================
// On-Page Content Parsing Live API (for raw HTML scraping)
// ============================================================================

/**
 * Schema for response from /v3/on_page/content_parsing/live
 * Returns a task ID that can be used to fetch raw HTML
 */
export const onPageContentParsingLiveItemSchema = z
  .object({
    id: z.string(),
    status_code: z.number().optional(),
    status_message: z.string().optional(),
  })
  .passthrough();

export type OnPageContentParsingLiveItem = z.infer<
  typeof onPageContentParsingLiveItemSchema
>;

// ============================================================================
// On-Page Raw HTML API
// ============================================================================

/**
 * Schema for items returned by /v3/on_page/raw_html
 * Returns raw HTML and metadata for a previously parsed page
 */
export const onPageRawHtmlItemSchema = z
  .object({
    html: z.string(),
    status_code: z.number(),
    page_timing: z
      .object({
        time_to_interactive: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    redirect_url: z.string().nullable().optional(),
  })
  .passthrough();

export type OnPageRawHtmlItem = z.infer<typeof onPageRawHtmlItemSchema>;
