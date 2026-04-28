/**
 * DataForSEO API client for organic keyword research.
 *
 * Fetches organic keywords for a domain using the
 * dataforseo_labs/google/ranked_keywords endpoint.
 */

import { getDataForSEOAuthHeader } from "@/server/lib/dataforseo-auth";

export interface OrganicKeywordItem {
  keyword: string;
  position: number;
  searchVolume: number;
  cpc: number | null;
  url: string | null;
}

/**
 * Fetch organic keywords that a domain ranks for.
 *
 * @param domain - Target domain (e.g., "example.com")
 * @param locationCode - Location code (e.g., 2440 for Lithuania)
 * @param languageCode - Language code (e.g., "lt" for Lithuanian)
 * @param limit - Maximum keywords to fetch (default 100)
 * @returns Array of organic keyword items
 */
export async function fetchOrganicKeywords(
  domain: string,
  locationCode: number,
  languageCode: string,
  limit: number = 100
): Promise<OrganicKeywordItem[]> {
  // Uses centralized auth from dataforseo-auth.ts
  // Throws if DATAFORSEO_API_KEY is not set

  const response = await fetch(
    "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
    {
      method: "POST",
      headers: {
        Authorization: getDataForSEOAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          target: domain,
          location_code: locationCode,
          language_code: languageCode,
          limit,
          order_by: ["keyword_data.keyword_info.search_volume,desc"],
        },
      ]),
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    status_code: number;
    status_message?: string;
    tasks?: Array<{
      result?: Array<{
        items?: Array<{
          keyword?: string;
          position?: number;
          keyword_data?: {
            keyword_info?: {
              keyword?: string;
              search_volume?: number;
              cpc?: number;
            };
          };
          ranked_serp_element?: {
            serp_item?: {
              rank_absolute?: number;
              url?: string;
            };
          };
        }>;
      }>;
    }>;
  };

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message}`);
  }

  // Extract results from nested response
  const results: OrganicKeywordItem[] = [];

  for (const task of data.tasks || []) {
    for (const resultItem of task.result || []) {
      for (const item of resultItem.items || []) {
        const keywordInfo = item.keyword_data?.keyword_info || {};
        const rankedElement = item.ranked_serp_element || {};

        results.push({
          keyword: keywordInfo.keyword || item.keyword || "",
          position: rankedElement.serp_item?.rank_absolute || item.position || 0,
          searchVolume: keywordInfo.search_volume || 0,
          cpc: keywordInfo.cpc ?? null,
          url: rankedElement.serp_item?.url || null,
        });
      }
    }
  }

  return results;
}
