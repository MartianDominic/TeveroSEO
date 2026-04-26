/**
 * DataForSEO API client for keyword metrics.
 *
 * Fetches keyword volume, difficulty, CPC, and competition
 * from DataForSEO keywords_data endpoint.
 */

export interface KeywordMetric {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: string;
}

/**
 * Fetch keyword metrics from DataForSEO.
 *
 * @param keywords - Array of keyword strings (max 1000)
 * @param location - Location code (e.g., 2440 for Lithuania)
 * @param language - Language code (e.g., "lt" for Lithuanian)
 * @returns Array of keyword metrics
 */
export async function fetchKeywordMetrics(
  keywords: string[],
  location: number,
  language: string
): Promise<KeywordMetric[]> {
  const apiLogin = process.env.DATAFORSEO_LOGIN;
  const apiPassword = process.env.DATAFORSEO_PASSWORD;

  if (!apiLogin || !apiPassword) {
    throw new Error("DataForSEO credentials not configured");
  }

  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiLogin}:${apiPassword}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords,
          location_code: location,
          language_code: language,
        },
      ]),
    }
  );

  if (!response.ok) {
    throw new Error(`DataForSEO API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message}`);
  }

  // Extract results from nested response
  const results: KeywordMetric[] = [];
  for (const task of data.tasks || []) {
    for (const resultItem of task.result || []) {
      results.push({
        keyword: resultItem.keyword,
        searchVolume: resultItem.search_volume || 0,
        cpc: resultItem.cpc || 0,
        competition: resultItem.competition || 0,
        competitionLevel: resultItem.competition_level || "unknown",
      });
    }
  }

  return results;
}
