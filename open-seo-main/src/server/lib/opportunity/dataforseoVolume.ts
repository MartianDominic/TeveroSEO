/**
 * DataForSEO Keywords Data API integration for search volume validation.
 * Phase 29: AI Opportunity Discovery - Task 29-02
 *
 * Uses the /v3/keywords_data/google_ads/search_volume/live endpoint
 * to validate and enrich AI-generated keywords with real volume data.
 */

import { z } from "zod";
import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { createDataForSEOFetch } from "@/server/lib/dataforseo-auth";

const log = createLogger({ module: "dataforseo-volume" });

const API_BASE = "https://api.dataforseo.com";

// Schema for individual keyword result
const searchVolumeItemSchema = z
  .object({
    keyword: z.string(),
    search_volume: z.number().nullable().optional(),
    cpc: z.number().nullable().optional(),
    competition: z.number().nullable().optional(),
    competition_level: z.string().nullable().optional(),
    keyword_info: z
      .object({
        keyword_difficulty: z.number().nullable().optional(),
      })
      .nullable()
      .optional(),
    monthly_searches: z
      .array(
        z.object({
          year: z.number(),
          month: z.number(),
          search_volume: z.number().nullable(),
        }),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

export type SearchVolumeItem = z.infer<typeof searchVolumeItemSchema>;

// Schema for task response
const searchVolumeTaskSchema = z
  .object({
    id: z.string().optional(),
    status_code: z.number(),
    status_message: z.string().optional(),
    path: z.array(z.string()),
    cost: z.number(),
    result_count: z.number().nullable(),
    result: z
      .array(
        z
          .object({
            items: z.array(searchVolumeItemSchema).nullable().optional(),
          })
          .passthrough(),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

// Schema for API response
const searchVolumeResponseSchema = z
  .object({
    status_code: z.number(),
    status_message: z.string().optional(),
    tasks: z.array(searchVolumeTaskSchema).optional(),
  })
  .passthrough();

export interface SearchVolumeInput {
  keywords: string[];
  locationCode: number;
  languageCode: string;
}

// Use centralized auth - throws if DATAFORSEO_API_KEY is not set
const createAuthenticatedFetch = createDataForSEOFetch;

/**
 * Fetch search volume data for keywords from DataForSEO.
 * Uses the Google Ads search volume endpoint.
 *
 * @param input - Keywords and location/language settings
 * @returns Volume data for each keyword with billing info
 */
export async function fetchSearchVolumeRaw(
  input: SearchVolumeInput,
): Promise<DataforseoApiResponse<SearchVolumeItem[]>> {
  const authenticatedFetch = createAuthenticatedFetch();

  const payload = [
    {
      keywords: input.keywords,
      location_code: input.locationCode,
      language_code: input.languageCode,
      date_from: getDateMonthsAgo(12), // Last 12 months for trend data
    },
  ];

  const response = await authenticatedFetch(
    `${API_BASE}/v3/keywords_data/google_ads/search_volume/live`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const rawText = await response.text();

  if (!response.ok) {
    log.error("DataForSEO search volume HTTP error", new Error(rawText.slice(0, 500)), {
      status: response.status,
    });
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO search volume HTTP ${response.status}`,
    );
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO search volume returned non-JSON response",
    );
  }

  const parsed = searchVolumeResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    log.error("Invalid DataForSEO response shape", new Error(JSON.stringify(parsed.error.issues.slice(0, 3))));
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO search volume returned invalid response",
    );
  }

  const apiResponse = parsed.data;

  if (apiResponse.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      apiResponse.status_message ?? "DataForSEO request failed",
    );
  }

  const task = apiResponse.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }

  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message ?? "DataForSEO task failed",
    );
  }

  const items = task.result?.[0]?.items ?? [];

  log.info("Search volume fetched", {
    keywordsRequested: input.keywords.length,
    resultsReturned: items.length,
    cost: task.cost,
  });

  return {
    data: items,
    billing: {
      path: task.path,
      costUsd: task.cost,
      resultCount: task.result_count ?? items.length,
    },
  };
}

/**
 * Get date string for N months ago in YYYY-MM-DD format.
 */
function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split("T")[0];
}
