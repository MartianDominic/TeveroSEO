/**
 * AI-Writer API client for content generation.
 * Phase 36: Content Brief Generation
 * BRIEF-01: CorrelationId propagation for distributed tracing
 */
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import type { ContentBriefSelect } from "@/db/brief-schema";

const baseLog = createLogger({ module: "AIWriterClient" });
// CFG-CRIT-01 FIX: Standardized to AI_WRITER_URL
const AI_WRITER_API = process.env.AI_WRITER_URL || "http://localhost:8000";

/** Timeout for AI operations (60 seconds) */
const AI_WRITER_TIMEOUT_MS = 60000;

export interface ArticleCreatePayload {
  client_id: string;
  title: string;
  keyword: string;
  brief_id?: string;
  target_word_count?: number;
  voice_mode?: string;
  suggested_h2s?: string[];
  paa_questions?: string[];
  /** BRIEF-02: Upstream scraping cost for cost attribution in AI-Writer */
  scraping_cost_usd?: number;
}

export interface ArticleResponse {
  id: string;
  client_id: string;
  title: string;
  keyword: string | null;
  status: string;
  content?: string;
  meta_description: string | null;
  url?: string;
  created_at: string;
  updated_at: string;
}

export function buildArticleTitle(keyword: string): string {
  const title = keyword
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  const year = new Date().getFullYear();
  return `${title} - Complete Guide ${year}`;
}

/**
 * Create an article from a content brief via AI-Writer API.
 *
 * @param brief - Content brief with SERP analysis data
 * @param clientId - Client ID for multi-tenant isolation
 * @param correlationId - Correlation ID for distributed tracing (optional)
 * @returns Created article response
 */
export async function createArticleFromBrief(
  brief: ContentBriefSelect,
  clientId: string,
  correlationId?: string
): Promise<ArticleResponse> {
  const log = correlationId ? baseLog.child({ correlationId }) : baseLog;
  const title = buildArticleTitle(brief.keyword);

  // BRIEF-02: Parse scraping cost from brief (stored as decimal string in DB)
  const scrapingCost = brief.scrapingCostUsd
    ? parseFloat(brief.scrapingCostUsd)
    : undefined;

  const payload: ArticleCreatePayload = {
    client_id: clientId,
    title,
    keyword: brief.keyword,
    brief_id: brief.id,
    target_word_count: brief.targetWordCount,
    voice_mode: brief.voiceMode,
    suggested_h2s: brief.serpAnalysis?.commonH2s.map((h) => h.heading) ?? [],
    paa_questions: brief.serpAnalysis?.paaQuestions ?? [],
    // BRIEF-02: Forward scraping cost to AI-Writer for cost attribution
    ...(scrapingCost !== undefined && !isNaN(scrapingCost) && { scraping_cost_usd: scrapingCost }),
  };

  log.info("Creating article from brief", { briefId: brief.id, keyword: brief.keyword });

  // BRIEF-01: Build headers with X-Correlation-ID for distributed tracing
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  const response = await fetch(`${AI_WRITER_API}/api/articles`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error(
      "AI-Writer article creation failed",
      new Error(errorText),
      { status: response.status }
    );
    throw new AppError("INTERNAL_ERROR", `AI-Writer article creation failed: ${response.status}`);
  }

  const article = (await response.json()) as ArticleResponse;
  log.info("Article created", { articleId: article.id, briefId: brief.id });
  return article;
}

/**
 * Get article status by ID.
 *
 * @param articleId - Article ID
 * @param correlationId - Correlation ID for distributed tracing (optional)
 */
export async function getArticleStatus(articleId: string, correlationId?: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    headers,
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError("NOT_FOUND", `Article ${articleId} not found`);
  }

  const article = (await response.json()) as ArticleResponse;
  return article.status;
}

/**
 * Get full article by ID.
 *
 * @param articleId - Article ID
 * @param correlationId - Correlation ID for distributed tracing (optional)
 */
export async function getArticle(articleId: string, correlationId?: string): Promise<ArticleResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    headers,
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError("NOT_FOUND", `Article ${articleId} not found`);
  }

  return (await response.json()) as ArticleResponse;
}

/**
 * Trigger article generation.
 *
 * @param articleId - Article ID
 * @param correlationId - Correlation ID for distributed tracing (optional)
 */
export async function triggerArticleGeneration(articleId: string, correlationId?: string): Promise<void> {
  const log = correlationId ? baseLog.child({ correlationId }) : baseLog;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (correlationId) {
    headers["X-Correlation-ID"] = correlationId;
  }

  log.info("Triggering article generation", { articleId });

  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status: "generating" }),
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error("Failed to trigger article generation", new Error(errorText), { articleId });
    throw new AppError("INTERNAL_ERROR", `Failed to trigger article generation: ${errorText}`);
  }

  log.info("Article generation triggered successfully", { articleId });
}
