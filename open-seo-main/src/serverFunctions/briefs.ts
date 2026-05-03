/**
 * Server functions for content briefs.
 * Phase 36: Content Brief Generation
 *
 * FIX CRIT-TYPE-01: Added runtime validation for API responses
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createLogger } from "@/server/lib/logger";
import {
  BriefsListResponseSchema,
  BriefResponseSchema,
  SerpAnalysisResponseSchema,
  GeneratedBriefResponseSchema,
  GenerateContentResponseSchema,
  GenerationStatusResponseSchema,
  ApiErrorSchema,
} from "@/types/schemas/api-responses";

const log = createLogger({ module: "serverFunctions/briefs" });

const OPEN_SEO_API = process.env.OPEN_SEO_URL || "http://localhost:3001";

// Timeout configuration for briefs API calls
const BRIEFS_TIMEOUT = 30_000; // 30s for standard operations
const BRIEFS_ANALYZE_TIMEOUT = 60_000; // 60s for SERP analysis (external API)
const BRIEFS_GENERATE_TIMEOUT = 120_000; // 120s for content generation

export interface Brief {
  id: string;
  mappingId: string;
  keyword: string;
  targetWordCount: number;
  voiceMode: "preservation" | "application" | "best_practices";
  status: "draft" | "ready" | "generating" | "published";
  serpAnalysis: SerpAnalysisData | null;
  articleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerpAnalysisData {
  commonH2s: { heading: string; frequency: number }[];
  paaQuestions: string[];
  competitorWordCounts: number[];
  metaLengths: { title: number; description: number };
  analyzedAt: string;
  location: string;
}

export interface GeneratedBriefResult {
  brief: Brief;
  suggestedH2s: string[];
  paaQuestions: string[];
  competitorAvgWordCount: number;
}

const getBriefsSchema = z.object({ projectId: z.string() });
const getBriefSchema = z.object({ briefId: z.string() });
const analyzeSerpSchema = z.object({
  mappingId: z.string(),
  locationCode: z.number().optional(),
});
const createBriefSchema = z.object({
  mappingId: z.string(),
  voiceMode: z.enum(["preservation", "application", "best_practices"]),
  locationCode: z.number().optional(),
});
const updateStatusSchema = z.object({
  briefId: z.string(),
  status: z.enum(["draft", "ready", "generating", "published"]),
});
const deleteBriefSchema = z.object({ briefId: z.string() });

export const getBriefsFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getBriefsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs?projectId=${data.projectId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        timeout: BRIEFS_TIMEOUT,
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to fetch briefs");
    }

    const json = await response.json();
    const result = BriefsListResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid briefs list response", undefined, { zodErrors: result.error.issues, json });
      throw new AppError("VALIDATION_ERROR", "Invalid response from briefs service");
    }
    return result.data.data;
  });

export const getBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        timeout: BRIEFS_TIMEOUT,
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to fetch brief");
    }

    const json = await response.json();
    const result = BriefResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid brief response", undefined, { zodErrors: result.error.issues, briefId: data.briefId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from briefs service");
    }
    return result.data.data;
  });

export const analyzeSerpFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => analyzeSerpSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs/analyze-serp/${data.mappingId}`,
      {
        method: "POST",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locationCode: data.locationCode }),
        timeout: BRIEFS_ANALYZE_TIMEOUT, // Longer timeout for SERP analysis
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to analyze SERP");
    }

    const json = await response.json();
    const result = SerpAnalysisResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid SERP analysis response", undefined, { zodErrors: result.error.issues, mappingId: data.mappingId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from SERP analysis service");
    }
    return result.data.data;
  });

export const createBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/briefs`, {
      method: "POST",
      headers: {
        "X-Client-ID": context.clientId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      timeout: BRIEFS_TIMEOUT,
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to create brief");
    }

    const json = await response.json();
    const result = GeneratedBriefResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid create brief response", undefined, { zodErrors: result.error.issues, mappingId: data.mappingId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from briefs service");
    }
    return result.data.data;
  });

export const updateBriefStatusFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        method: "PATCH",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: data.status }),
        timeout: BRIEFS_TIMEOUT,
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to update status");
    }

    const json = await response.json();
    const result = BriefResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid update status response", undefined, { zodErrors: result.error.issues, briefId: data.briefId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from briefs service");
    }
    return result.data.data;
  });

export const deleteBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => deleteBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        method: "DELETE",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        timeout: BRIEFS_TIMEOUT,
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to delete brief");
    }

    return { success: true };
  });

const generateContentSchema = z.object({
  briefId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export interface GenerateContentResult {
  briefId: string;
  articleId: string;
  status: string;
}

export const generateContentFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => generateContentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs/generate/${data.briefId}`,
      {
        method: "POST",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: data.clientId }),
        timeout: BRIEFS_GENERATE_TIMEOUT, // Longer timeout for content generation
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to generate content");
    }

    const json = await response.json();
    const result = GenerateContentResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid generate content response", undefined, { zodErrors: result.error.issues, briefId: data.briefId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from content generation service");
    }
    return result.data.data;
  });

const getGenerationStatusSchema = z.object({ briefId: z.string() });

export interface GenerationStatusResult {
  briefStatus: string;
  articleStatus: string | null;
  articleId: string | null;
}

export const getGenerationStatusFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getGenerationStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/briefs/status/${data.briefId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        timeout: BRIEFS_TIMEOUT,
      }
    );

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const errorParsed = ApiErrorSchema.safeParse(json);
      const errorMsg = errorParsed.success ? (errorParsed.data.error || errorParsed.data.message) : undefined;
      throw new AppError("EXTERNAL_SERVICE_ERROR", errorMsg || "Failed to get status");
    }

    const json = await response.json();
    const result = GenerationStatusResponseSchema.safeParse(json);
    if (!result.success) {
      log.error("Invalid generation status response", undefined, { zodErrors: result.error.issues, briefId: data.briefId });
      throw new AppError("VALIDATION_ERROR", "Invalid response from status service");
    }
    return result.data.data;
  });
