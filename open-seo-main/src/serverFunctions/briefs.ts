/**
 * Server functions for content briefs.
 * Phase 36: Content Brief Generation
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { AppError } from "@/server/lib/errors";

const OPEN_SEO_API = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

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
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs?projectId=${data.projectId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to fetch briefs");
    }

    const result = (await response.json()) as { data: Brief[] };
    return result.data;
  });

export const getBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => getBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to fetch brief");
    }

    const result = (await response.json()) as { data: Brief };
    return result.data;
  });

export const analyzeSerpFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => analyzeSerpSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs/analyze-serp/${data.mappingId}`,
      {
        method: "POST",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locationCode: data.locationCode }),
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to analyze SERP");
    }

    const result = (await response.json()) as { data: SerpAnalysisData };
    return result.data;
  });

export const createBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetch(`${OPEN_SEO_API}/api/seo/briefs`, {
      method: "POST",
      headers: {
        "X-Client-ID": context.clientId || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to create brief");
    }

    const result = (await response.json()) as { data: GeneratedBriefResult };
    return result.data;
  });

export const updateBriefStatusFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        method: "PATCH",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: data.status }),
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to update status");
    }

    const result = (await response.json()) as { data: Brief };
    return result.data;
  });

export const deleteBriefFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => deleteBriefSchema.parse(data))
  .handler(async ({ data, context }) => {
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs?id=${data.briefId}`,
      {
        method: "DELETE",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to delete brief");
    }

    return { success: true };
  });

const generateContentSchema = z.object({
  briefId: z.string(),
  clientId: z.string(),
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
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs/generate/${data.briefId}`,
      {
        method: "POST",
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: data.clientId }),
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to generate content");
    }

    const result = (await response.json()) as { data: GenerateContentResult };
    return result.data;
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
    const response = await fetch(
      `${OPEN_SEO_API}/api/seo/briefs/status/${data.briefId}`,
      {
        headers: {
          "X-Client-ID": context.clientId || "",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { error?: string };
      throw new AppError("EXTERNAL_SERVICE_ERROR", error.error || "Failed to get status");
    }

    const result = (await response.json()) as { data: GenerationStatusResult };
    return result.data;
  });
