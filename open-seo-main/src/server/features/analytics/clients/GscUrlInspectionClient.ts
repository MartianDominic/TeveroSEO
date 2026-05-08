/**
 * GscUrlInspectionClient
 * Phase 96-04: Google Search Console URL Inspection API Client
 *
 * Handles communication with GSC URL Inspection API.
 * Daily limits: 2000 inspections, 200 indexing requests
 */

export interface UrlInspectionResponse {
  inspectionResult: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      coverageState?: string;
      indexingState?: string;
      lastCrawlTime?: string;
      crawledAs?: string;
      robotsTxtState?: string;
      pageFetchState?: string;
      sitemap?: string[];
      referringUrls?: string[];
      verdict?: string;
    };
    mobileUsabilityResult?: {
      verdict?: string;
      issues?: Array<{ issueType: string; severity: string; message: string }>;
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: Array<{
        richResultType: string;
        items?: unknown[];
      }>;
    };
    ampResult?: {
      verdict?: string;
      issues?: unknown[];
    };
  };
}

export interface IndexingRequestResponse {
  urlNotificationMetadata?: {
    url: string;
    latestUpdate?: {
      type: string;
      notifyTime: string;
    };
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export class GscUrlInspectionClient {
  private accessToken: string | null = null;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || null;
  }

  /**
   * Set the access token for API calls
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Inspect a URL using GSC URL Inspection API
   * Endpoint: POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
   */
  async inspectUrl(
    siteUrl: string,
    inspectionUrl: string
  ): Promise<UrlInspectionResponse> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Call setAccessToken first.");
    }

    const response = await fetch(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspectionUrl,
          siteUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (response.status === 429) {
        throw new Error("Quota exceeded: 2000 inspections per day");
      }
      throw new Error(
        `URL Inspection API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Submit URL for indexing using Indexing API
   * Endpoint: POST https://indexing.googleapis.com/v3/urlNotifications:publish
   */
  async submitIndexRequest(
    url: string,
    type: "URL_UPDATED" | "URL_DELETED"
  ): Promise<IndexingRequestResponse> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Call setAccessToken first.");
    }

    const response = await fetch(
      "https://indexing.googleapis.com/v3/urlNotifications:publish",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          type,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (response.status === 429) {
        throw new Error("Quota exceeded");
      }
      throw new Error(
        `Indexing API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Get metadata for a previously submitted URL
   * Endpoint: GET https://indexing.googleapis.com/v3/urlNotifications/metadata?url={url}
   */
  async getUrlMetadata(url: string): Promise<IndexingRequestResponse> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Call setAccessToken first.");
    }

    const response = await fetch(
      `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        `Indexing API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      );
    }

    return response.json();
  }
}
