/**
 * GET /api/crawl/[jobId]
 *
 * Proxy to open-seo-main crawl job status API.
 * For async crawl implementation - returns result once available.
 *
 * Note: Current implementation is synchronous; this route
 * proxies to open-seo-main for future async crawl jobs.
 */

import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/api-auth";
import { generalApiLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import { getOpenSeo, FastApiError } from "@/lib/server-fetch";

import { logger } from '@/lib/logger';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CrawlJobResult {
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * GET /api/crawl/[jobId]
 *
 * Get crawl job status and result.
 * Rate limit: 100 requests per minute
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId || !/^[a-f0-9-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId format" }, { status: 400 });
  }

  try {
    // Auth check
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit
    const rateLimitResult = await generalApiLimiter.limit(session.userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    // Proxy to open-seo-main
    const job = await getOpenSeo<CrawlJobResult>(`/api/crawl/${jobId}`);

    return NextResponse.json(job, { headers: rateLimitHeaders(rateLimitResult) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof FastApiError) {
      return NextResponse.json(err.sanitizedBody, { status: err.status });
    }
    logger.error("Crawl job lookup error", err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
