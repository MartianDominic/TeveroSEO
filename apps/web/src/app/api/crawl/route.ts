/**
 * POST /api/crawl
 *
 * Proxy to open-seo-main crawler API.
 * Uses fetch-first, Playwright-fallback pattern for JS-heavy sites.
 *
 * Rate limit: 10 crawls per minute per user (SSRF protection)
 */

import { NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { z } from "zod";
import { validateCsrf } from "@/lib/api/security";
import { connectionTestLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zod schema for crawl request
const crawlRequestSchema = z.object({
  url: z.string().url("url must be a valid URL"),
  clientId: z.string().uuid("clientId must be a valid UUID").optional(),
  options: z
    .object({
      maxPages: z.number().int().min(1).max(1000).optional(),
      respectRobots: z.boolean().optional(),
      renderJs: z.union([z.boolean(), z.literal("auto")]).optional(),
      timeout: z.number().int().min(1000).max(120000).optional(),
    })
    .optional(),
});

// Response type from open-seo crawler
interface CrawlResult {
  status: "success" | "blocked" | "error";
  method?: "fetch" | "playwright";
  data?: {
    title: string;
    metaDescription: string | null;
    h1: string[];
    h2: string[];
    canonicalUrl: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    internalLinks: string[];
  };
  sitemapUrls?: string[];
  reason?: string;
  error?: string;
}

/**
 * POST /api/crawl
 *
 * Crawl a URL and return page data.
 * Rate limit: 10 requests per minute (SSRF protection)
 */
export async function POST(request: Request) {
  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate request body with Zod
  const parsed = crawlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    // If clientId provided, verify access
    let authUserId: string;
    if (parsed.data.clientId) {
      const authContext = await requireClientAccess(parsed.data.clientId);
      authUserId = authContext.userId;
    } else {
      // Require at least authentication
      const { auth } = await import("@clerk/nextjs/server");
      const session = await auth();
      if (!session?.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      authUserId = session.userId;
    }

    // Rate limit: 10 crawls per minute (SSRF protection)
    const rateLimitResult = await connectionTestLimiter.limit(authUserId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Proxy to open-seo-main crawler API
    const result = await postOpenSeo<CrawlResult>("/api/crawl", {
      url: parsed.data.url,
      options: parsed.data.options,
    });

    return NextResponse.json(result, { headers: rateLimitHeaders(rateLimitResult) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.sanitizedBody, { status: err.status });
    }
    logger.error("Crawl error", err instanceof Error ? err : { error: String(err) });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
