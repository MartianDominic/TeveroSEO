/**
 * IndexCoverageService
 * Phase 96-04: URL Inspection + Index Coverage
 *
 * Handles business logic for:
 * - URL inspection via GSC API (2000/day limit)
 * - Index coverage stats aggregation
 * - Indexing request submission and tracking
 * - Priority-based inspection scheduling
 */
import { IndexCoverageRepository } from "../repositories/IndexCoverageRepository";
import {
  GscUrlInspectionClient,
  type UrlInspectionResponse,
} from "../clients/GscUrlInspectionClient";
import type {
  UrlInspectionResult,
  IndexCoverageStats,
  IndexingQuota,
  InspectionPriority,
} from "../types";

export interface IndexingResult {
  success: boolean;
  queued: boolean;
  error?: string;
}

export interface BatchInspectResult {
  processed: number;
  remaining: number;
  errors: string[];
}

export class IndexCoverageService {
  private repo: IndexCoverageRepository;
  private gscClient: GscUrlInspectionClient;

  constructor() {
    this.repo = new IndexCoverageRepository();
    this.gscClient = new GscUrlInspectionClient();
  }

  /**
   * Set the GSC access token for API calls
   */
  setAccessToken(token: string): void {
    this.gscClient.setAccessToken(token);
  }

  /**
   * Inspect a single URL and store the result
   */
  async inspectUrl(
    siteId: string,
    siteUrl: string,
    pageUrl: string
  ): Promise<UrlInspectionResult> {
    // Call GSC URL Inspection API
    const response = await this.gscClient.inspectUrl(siteUrl, pageUrl);

    // Parse and store the result
    const result = this.parseInspectionResponse(pageUrl, response);

    await this.repo.upsert({
      siteId,
      pageUrl,
      coverageState: result.coverageState,
      indexingState: result.indexingState,
      lastCrawlTime: result.lastCrawlTime,
      crawledAs: result.crawledAs,
      robotsTxtState: result.robotsTxtState,
      canonicalUrl: result.canonicalUrl,
      isCanonical: result.isCanonical,
      mobileUsability: result.mobileUsability,
      richResults: result.richResults,
      pageFetchState: result.pageFetchState,
      referringUrls: result.referringUrls,
      userDeclaredCanonical: result.userDeclaredCanonical,
      googleSelectedCanonical: result.googleSelectedCanonical,
      inspectionTime: result.inspectionTime,
    });

    return result;
  }

  /**
   * Get index coverage stats for a site
   */
  async getIndexCoverageStats(siteId: string): Promise<IndexCoverageStats> {
    return this.repo.getStats(siteId);
  }

  /**
   * Request indexing for a URL
   */
  async requestIndexing(
    siteId: string,
    pageUrl: string,
    requestType: "URL_UPDATED" | "URL_DELETED"
  ): Promise<IndexingResult> {
    // Create the request record
    const request = await this.repo.createRequest({
      siteId,
      pageUrl,
      requestType,
      status: "pending",
      priority: 0,
    });

    try {
      // Submit to GSC Indexing API
      const response = await this.gscClient.submitIndexRequest(
        pageUrl,
        requestType
      );

      // Update request as successful
      await this.repo.updateRequest(request.id, {
        status: "success",
        submittedAt: new Date(),
        response: {
          notificationType: requestType,
          urlNotificationMetadata: response.urlNotificationMetadata,
        },
      });

      return { success: true, queued: false };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Check if quota exceeded - queue for later
      if (errorMessage.includes("Quota exceeded")) {
        await this.repo.updateRequest(request.id, {
          status: "pending",
          errorMessage,
        });
        return { success: false, queued: true, error: errorMessage };
      }

      // Mark as failed
      await this.repo.updateRequest(request.id, {
        status: "failed",
        errorMessage,
      });

      return { success: false, queued: false, error: errorMessage };
    }
  }

  /**
   * Get priority URLs for inspection
   */
  async getPriorityUrls(
    siteId: string,
    limit: number = 100
  ): Promise<InspectionPriority[]> {
    return this.repo.getHighPriorityUrls(siteId, limit);
  }

  /**
   * Batch inspect multiple URLs, respecting quota
   */
  async batchInspect(
    siteId: string,
    siteUrl: string,
    urls: string[]
  ): Promise<BatchInspectResult> {
    // Check quota
    const quota = await this.repo.getQuotaUsage(siteId);
    const remainingQuota = quota.inspectionsLimit - quota.inspectionsUsed;

    if (remainingQuota <= 0) {
      return { processed: 0, remaining: urls.length, errors: ["Quota exceeded"] };
    }

    // Only process up to remaining quota
    const urlsToProcess = urls.slice(0, remainingQuota);
    const errors: string[] = [];
    let processed = 0;

    for (const pageUrl of urlsToProcess) {
      try {
        await this.inspectUrl(siteId, siteUrl, pageUrl);
        processed++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(`${pageUrl}: ${errorMessage}`);

        // Stop if quota exceeded
        if (errorMessage.includes("Quota exceeded")) {
          break;
        }
      }
    }

    return {
      processed,
      remaining: urls.length - processed,
      errors,
    };
  }

  /**
   * Get current quota usage
   */
  async getQuota(siteId: string): Promise<IndexingQuota> {
    return this.repo.getQuotaUsage(siteId);
  }

  /**
   * Get inspection result for a URL
   */
  async getUrlInspection(
    siteId: string,
    pageUrl: string
  ): Promise<UrlInspectionResult | null> {
    const result = await this.repo.findByUrl(siteId, pageUrl);
    if (!result) return null;

    return {
      pageUrl: result.pageUrl,
      inspectionTime: result.inspectionTime,
      coverageState: result.coverageState || "",
      indexingState: result.indexingState || "",
      lastCrawlTime: result.lastCrawlTime,
      crawledAs: result.crawledAs,
      robotsTxtState: result.robotsTxtState,
      canonicalUrl: result.canonicalUrl,
      isCanonical: result.isCanonical,
      mobileUsability: result.mobileUsability,
      richResults: result.richResults,
      pageFetchState: result.pageFetchState,
      referringUrls: result.referringUrls,
      userDeclaredCanonical: result.userDeclaredCanonical,
      googleSelectedCanonical: result.googleSelectedCanonical,
    };
  }

  /**
   * Parse GSC inspection response into our format
   */
  private parseInspectionResponse(
    pageUrl: string,
    response: UrlInspectionResponse
  ): UrlInspectionResult {
    const indexStatus = response.inspectionResult?.indexStatusResult;
    const mobileResult = response.inspectionResult?.mobileUsabilityResult;
    const richResult = response.inspectionResult?.richResultsResult;

    return {
      pageUrl,
      inspectionTime: new Date(),
      coverageState: indexStatus?.coverageState || "Unknown",
      indexingState: indexStatus?.indexingState || "Unknown",
      lastCrawlTime: indexStatus?.lastCrawlTime
        ? new Date(indexStatus.lastCrawlTime)
        : null,
      crawledAs: indexStatus?.crawledAs || null,
      robotsTxtState: indexStatus?.robotsTxtState || null,
      canonicalUrl: null, // Would need to parse from inspection result
      isCanonical: null,
      mobileUsability: mobileResult?.verdict || null,
      richResults: richResult?.detectedItems
        ? {
            detected: richResult.detectedItems.map((d) => d.richResultType),
            items: richResult.detectedItems,
          }
        : null,
      pageFetchState: indexStatus?.pageFetchState || null,
      referringUrls: indexStatus?.referringUrls || null,
      userDeclaredCanonical: null,
      googleSelectedCanonical: null,
    };
  }
}
