/**
 * AI-Writer API client for content generation.
 * Phase 36: Content Brief Generation
 */
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import type { ContentBriefSelect } from "@/db/brief-schema";

const log = createLogger({ module: "AIWriterClient" });
// ENV-H04 FIX: Standardized to AI_WRITER_URL to match apps/web and docker-compose.vps.yml
// Supports legacy AIWRITER_INTERNAL_URL for backward compatibility during migration
const AI_WRITER_API = process.env.AI_WRITER_URL || process.env.AIWRITER_INTERNAL_URL || "http://localhost:8000";

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

export async function createArticleFromBrief(
  brief: ContentBriefSelect,
  clientId: string
): Promise<ArticleResponse> {
  const title = buildArticleTitle(brief.keyword);

  const payload: ArticleCreatePayload = {
    client_id: clientId,
    title,
    keyword: brief.keyword,
    brief_id: brief.id,
    target_word_count: brief.targetWordCount,
    voice_mode: brief.voiceMode,
    suggested_h2s: brief.serpAnalysis?.commonH2s.map((h) => h.heading) ?? [],
    paa_questions: brief.serpAnalysis?.paaQuestions ?? [],
  };

  log.info("Creating article from brief", { briefId: brief.id, keyword: brief.keyword });

  const response = await fetch(`${AI_WRITER_API}/api/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function getArticleStatus(articleId: string): Promise<string> {
  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError("NOT_FOUND", `Article ${articleId} not found`);
  }

  const article = (await response.json()) as ArticleResponse;
  return article.status;
}

export async function getArticle(articleId: string): Promise<ArticleResponse> {
  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AppError("NOT_FOUND", `Article ${articleId} not found`);
  }

  return (await response.json()) as ArticleResponse;
}

export async function triggerArticleGeneration(articleId: string): Promise<void> {
  const response = await fetch(`${AI_WRITER_API}/api/articles/${articleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "generating" }),
    signal: AbortSignal.timeout(AI_WRITER_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError("INTERNAL_ERROR", `Failed to trigger article generation: ${errorText}`);
  }
}
