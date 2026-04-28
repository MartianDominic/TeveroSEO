import {
  parseDataforseoLighthousePayload,
  requestCategories,
  type LighthouseStrategy,
} from "@/server/lib/dataforseoLighthousePayload";
import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import type { StoredLighthousePayload } from "@/server/lib/lighthouseStoredPayload";
import { getDataForSEOHeaders } from "@/server/lib/dataforseo-auth";

const DATAFORSEO_LIGHTHOUSE_ENDPOINT =
  "https://api.dataforseo.com/v3/on_page/lighthouse/live/json";

export async function fetchDataforseoLighthouseResultRaw(input: {
  url: string;
  strategy: LighthouseStrategy;
}): Promise<DataforseoApiResponse<StoredLighthousePayload>> {
  // Uses centralized auth - throws if DATAFORSEO_API_KEY is not set
  const response = await fetch(DATAFORSEO_LIGHTHOUSE_ENDPOINT, {
    method: "POST",
    headers: getDataForSEOHeaders(),
    body: JSON.stringify([
      {
        url: input.url,
        for_mobile: input.strategy === "mobile",
        categories: requestCategories,
      },
    ]),
    signal: AbortSignal.timeout(60_000),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `DataForSEO Lighthouse request failed (${response.status}): ${rawText}`,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error(
      `DataForSEO Lighthouse returned non-JSON content (content-type: ${response.headers.get("content-type") ?? "unknown"}): ${rawText}`,
    );
  }

  const data = parseDataforseoLighthousePayload(payload, input);

  return {
    data,
    billing: {
      path: ["v3", "on_page", "lighthouse", "live", "json"],
      costUsd: data.metadata.cost ?? 0,
      resultCount: 1,
    },
  };
}
