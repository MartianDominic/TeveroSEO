"use server";

/**
 * Scrape Configuration Server Actions
 * Phase 43-05: AI Selector Discovery + Custom Extraction Rules
 */

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";
import { logger } from '@/lib/logger';
import {
  requireActionAuth,
  validateProspectOwnership,
  type ActionResult,
} from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";

/** Default timeout for API requests (30 seconds) */
const API_TIMEOUT_MS = 30000;

// Validation schemas
const prospectIdSchema = z.string().uuid("Invalid prospect ID format");

// Extraction field schema
const ExtractionFieldSchema = z.object({
  name: z.string().min(1).max(100),
  selectors: z.array(z.string().min(1).max(500)).min(1).max(10),
  type: z.enum(["text", "attribute", "html"]),
  attribute: z.string().max(100).optional(),
  transform: z.enum(["trim", "lowercase", "number", "price"]).optional(),
});

// Extraction rule schema
const ExtractionRuleSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  urlPattern: z.string().min(1).max(500),
  pageType: z.enum(["product", "category", "brand", "other"]),
  fields: z.array(ExtractionFieldSchema).min(1).max(20),
  enabled: z.boolean(),
});

// AI selector schema
export const AiSelectorSchema = z.object({
  field: z.string(),
  selector: z.string(),
  fallback: z.string().nullable(),
  confidence: z.number(),
  sampleValue: z.string(),
  discoveredAt: z.string(),
});

export type ExtractionField = z.infer<typeof ExtractionFieldSchema>;
export type ExtractionRule = z.infer<typeof ExtractionRuleSchema>;
export type AiSelector = z.infer<typeof AiSelectorSchema>;

export interface ScrapeConfig {
  id: string;
  prospectId: string;
  detectedPlatform: string | null;
  detectedSiteType: string | null;
  platformVersion: string | null;
  extractionRules: ExtractionRule[] | null;
  aiSelectors: AiSelector[] | null;
  maxPages: number;
  maxDepth: number;
  rateLimit: number;
  includePatterns: string[] | null;
  excludePatterns: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface SelectorDiscoveryResult {
  platform: string;
  platformConfidence: number;
  selectors: AiSelector[];
}

export interface RuleTestResult {
  matched: boolean;
  data: Record<string, string | null> | null;
}

/**
 * Get scrape configuration for a prospect.
 */
export async function getScrapeConfig(
  prospectId: string
): Promise<ActionResult<ScrapeConfig | null>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid prospect ID",
    };
  }

  try {
    // Validate ownership before fetching
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/scrape-config`,
      {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.detail ||
          errorData.message ||
          errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[getScrapeConfig] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[getScrapeConfig] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Update config schema
const updateConfigSchema = z.object({
  extractionRules: z.array(ExtractionRuleSchema).max(50).optional(),
  maxPages: z.number().int().min(1).max(5000).optional(),
  maxDepth: z.number().int().min(1).max(10).optional(),
  rateLimit: z.number().int().min(1).max(10).optional(),
  includePatterns: z.array(z.string().max(500)).max(50).optional(),
  excludePatterns: z.array(z.string().max(500)).max(50).optional(),
});

/**
 * Update scrape configuration for a prospect.
 */
export async function updateScrapeConfig(
  prospectId: string,
  config: {
    extractionRules?: ExtractionRule[];
    maxPages?: number;
    maxDepth?: number;
    rateLimit?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
  }
): Promise<ActionResult<void>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid prospect ID",
    };
  }

  // Validate config
  const validatedConfig = updateConfigSchema.safeParse(config);
  if (!validatedConfig.success) {
    return {
      success: false,
      error: validatedConfig.error.issues[0]?.message || "Invalid configuration",
    };
  }

  try {
    // Validate ownership before updating
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/scrape-config`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(validatedConfig.data),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.detail ||
          errorData.message ||
          errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[updateScrapeConfig] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error("[updateScrapeConfig] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

// Discover selectors schema
const discoverSelectorsSchema = z.object({
  html: z.string().min(100, "HTML content is required").max(5_000_000, "HTML too large"),
  url: z.string().url("Invalid URL"),
});

/**
 * Run AI selector discovery on provided HTML.
 */
export async function discoverSelectors(
  prospectId: string,
  html: string,
  url: string
): Promise<ActionResult<SelectorDiscoveryResult>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid prospect ID",
    };
  }

  // Validate input
  const validatedInput = discoverSelectorsSchema.safeParse({ html, url });
  if (!validatedInput.success) {
    return {
      success: false,
      error: validatedInput.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    // Validate ownership before discovering
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/scrape-config`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action: "discover",
          html: validatedInput.data.html,
          url: validatedInput.data.url,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout for AI operations
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.detail ||
          errorData.message ||
          errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[discoverSelectors] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[discoverSelectors] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}

/**
 * Test an extraction rule against sample HTML.
 */
export async function testExtractionRule(
  prospectId: string,
  rule: ExtractionRule,
  html: string,
  url: string
): Promise<ActionResult<RuleTestResult>> {
  const authContext = await requireActionAuth();

  // Validate prospect ID format
  const validatedId = prospectIdSchema.safeParse(prospectId);
  if (!validatedId.success) {
    return {
      success: false,
      error: validatedId.error.issues[0]?.message || "Invalid prospect ID",
    };
  }

  // Validate rule
  const validatedRule = ExtractionRuleSchema.safeParse(rule);
  if (!validatedRule.success) {
    return {
      success: false,
      error: validatedRule.error.issues[0]?.message || "Invalid rule",
    };
  }

  // Validate HTML/URL input
  const validatedInput = discoverSelectorsSchema.safeParse({ html, url });
  if (!validatedInput.success) {
    return {
      success: false,
      error: validatedInput.error.issues[0]?.message || "Invalid input",
    };
  }

  try {
    // Validate ownership before testing
    await validateProspectOwnership(validatedId.data, authContext);

    const { getToken } = await auth();
    const token = await getToken();

    const response = await fetch(
      `${env.OPEN_SEO_URL}/api/prospects/${validatedId.data}/scrape-config`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          action: "test",
          rule: validatedRule.data,
          html: validatedInput.data.html,
          url: validatedInput.data.url,
        }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage =
          errorData.error ||
          errorData.detail ||
          errorData.message ||
          errorMessage;
      } catch {
        // Response wasn't JSON
      }
      logger.error("[testExtractionRule] API error", { status: response.status, detail: errorMessage });
      return {
        success: false,
        error: sanitizeErrorForClient(new Error(errorMessage)),
      };
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    logger.error("[testExtractionRule] Error", error instanceof Error ? error : { error: String(error) });
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out. Please try again.",
      };
    }
    return {
      success: false,
      error: sanitizeErrorForClient(error),
    };
  }
}
