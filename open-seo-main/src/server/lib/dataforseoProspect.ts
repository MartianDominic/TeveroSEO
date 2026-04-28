/**
 * DataForSEO API wrappers for prospect analysis.
 *
 * These endpoints are used for one-time prospect analysis, not ongoing tracking.
 * Each call is metered through the billing system.
 *
 * Endpoints:
 * - keywordsForSite: All keywords a domain currently ranks for
 * - competitorsDomain: Competing domains based on keyword overlap
 */
import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import { AppError } from "@/server/lib/errors";
import {
  dataforseoResponseSchema,
  keywordsForSiteItemSchema,
  competitorsDomainItemSchema,
  type KeywordsForSiteItem,
  type CompetitorsDomainItem,
} from "@/server/lib/dataforseoSchemas";

// ---------------------------------------------------------------------------
// SDK client (uses centralized auth from dataforseo-auth.ts)
// ---------------------------------------------------------------------------

import { createDataForSEOFetch } from "@/server/lib/dataforseo-auth";

const API_BASE = "https://api.dataforseo.com";

// Use centralized auth - throws if DATAFORSEO_API_KEY is not set
const createAuthenticatedFetch = createDataForSEOFetch;

async function postDataforseo(
  path: string,
  payload: unknown,
): Promise<unknown> {
  const authenticatedFetch = createAuthenticatedFetch();
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO HTTP ${response.status} on ${path}. Response: ${rawText.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO ${path} returned non-JSON response`,
    );
  }
}

// ---------------------------------------------------------------------------
// Response helpers (reuse pattern from dataforseo.ts)
// ---------------------------------------------------------------------------

function assertOk(response: unknown): {
  path: string[];
  cost: number;
  result_count: number | null;
  result: unknown[];
} {
  const parsed = dataforseoResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response parse failed");
  }

  const data = parsed.data;
  if (data.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      data.status_message || "DataForSEO request failed",
    );
  }

  const task = data.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || "DataForSEO task failed",
    );
  }

  return {
    path: task.path ?? [],
    cost: task.cost ?? 0,
    result_count: task.result_count ?? null,
    result: task.result ?? [],
  };
}

function buildTaskBilling(task: {
  path: string[];
  cost: number;
  result_count: number | null;
}) {
  return {
    path: task.path,
    costUsd: task.cost,
    resultCount: task.result_count,
  };
}

// ---------------------------------------------------------------------------
// Keywords For Site API
// /v3/dataforseo_labs/google/keywords_for_site/live
// ---------------------------------------------------------------------------

export interface KeywordsForSiteInput {
  target: string; // domain without protocol
  locationCode: number;
  languageCode: string;
  limit?: number;
}

/**
 * Fetch all keywords a domain currently ranks for.
 *
 * @param input - Target domain and location/language settings
 * @returns Keywords with ranking data and billing info
 *
 * Cost: ~$0.05-0.10 depending on result count
 *
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live
 */
export async function fetchKeywordsForSiteRaw(
  input: KeywordsForSiteInput,
): Promise<DataforseoApiResponse<KeywordsForSiteItem[]>> {
  const responseRaw = await postDataforseo(
    "/v3/dataforseo_labs/google/keywords_for_site/live",
    [
      {
        target: input.target,
        location_code: input.locationCode,
        language_code: input.languageCode,
        limit: input.limit ?? 100,
        include_serp_info: true,
        include_clickstream_data: true,
      },
    ],
  );

  const task = assertOk(responseRaw);

  // Parse items from result array
  const items: KeywordsForSiteItem[] = [];
  for (const resultItem of task.result) {
    if (
      resultItem &&
      typeof resultItem === "object" &&
      "items" in resultItem &&
      Array.isArray((resultItem as { items?: unknown[] }).items)
    ) {
      for (const item of (resultItem as { items: unknown[] }).items) {
        const parsed = keywordsForSiteItemSchema.safeParse(item);
        if (parsed.success) {
          items.push(parsed.data);
        }
      }
    }
  }

  return {
    data: items,
    billing: buildTaskBilling(task),
  };
}

// ---------------------------------------------------------------------------
// Competitors Domain API
// /v3/dataforseo_labs/google/competitors_domain/live
// ---------------------------------------------------------------------------

export interface CompetitorsDomainInput {
  target: string; // domain without protocol
  locationCode: number;
  languageCode: string;
  limit?: number;
}

/**
 * Fetch competitor domains based on keyword overlap.
 *
 * @param input - Target domain and location/language settings
 * @returns Competitor domains with overlap metrics and billing info
 *
 * Cost: ~$0.05-0.10 depending on result count
 *
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live
 */
export async function fetchCompetitorsDomainRaw(
  input: CompetitorsDomainInput,
): Promise<DataforseoApiResponse<CompetitorsDomainItem[]>> {
  const responseRaw = await postDataforseo(
    "/v3/dataforseo_labs/google/competitors_domain/live",
    [
      {
        target: input.target,
        location_code: input.locationCode,
        language_code: input.languageCode,
        limit: input.limit ?? 20,
        exclude_top_domains: true, // Exclude google.com, facebook.com, etc.
      },
    ],
  );

  const task = assertOk(responseRaw);

  // Parse items from result array
  const items: CompetitorsDomainItem[] = [];
  for (const resultItem of task.result) {
    if (
      resultItem &&
      typeof resultItem === "object" &&
      "items" in resultItem &&
      Array.isArray((resultItem as { items?: unknown[] }).items)
    ) {
      for (const item of (resultItem as { items: unknown[] }).items) {
        const parsed = competitorsDomainItemSchema.safeParse(item);
        if (parsed.success) {
          items.push(parsed.data);
        }
      }
    }
  }

  return {
    data: items,
    billing: buildTaskBilling(task),
  };
}

// Re-export types
export type { KeywordsForSiteItem, CompetitorsDomainItem };
