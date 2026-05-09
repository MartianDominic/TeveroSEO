/**
 * Cloudflare Detection API Route
 *
 * Detects whether a domain uses Cloudflare and returns integration recommendations.
 * Used by the IndexNow onboarding flow to determine the best setup path.
 *
 * GET /api/cloudflare/detect?domain=example.com
 */

import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { integrateCloudfareCrawlerHints } from "@/lib/cloudflare/crawler-hints";

// ============================================================================
// Types
// ============================================================================

const QuerySchema = z.object({
  domain: z
    .string()
    .min(1)
    .refine(
      (val) => {
        // Basic domain validation
        const normalized = val.replace(/^https?:\/\//, "").replace(/\/$/, "");
        return /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(normalized);
      },
      { message: "Invalid domain format" }
    ),
  // Optional: include raw headers in response (for debugging)
  includeHeaders: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// ============================================================================
// Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const { domain, includeHeaders } = QuerySchema.parse(searchParams);

    // Normalize domain
    const normalizedDomain = domain
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    // Run detection
    const result = await integrateCloudfareCrawlerHints(normalizedDomain);

    // Build response
    const response: {
      success: boolean;
      data: {
        domain: string;
        usesCloudflare: boolean;
        detectionMethod: string;
        dataCenter?: string;
        cacheEnabled?: boolean;
        cacheStatus?: string;
        recommendedAction: string;
        dashboardUrl?: string;
        instructions: string;
        estimatedMinutes: number;
        rawHeaders?: Record<string, string>;
      };
    } = {
      success: true,
      data: {
        domain: normalizedDomain,
        usesCloudflare: result.usesCloudflare,
        detectionMethod: result.detection.detectionMethod,
        dataCenter: result.detection.dataCenter,
        cacheEnabled: result.detection.cacheEnabled,
        cacheStatus: result.detection.cacheStatus,
        recommendedAction: result.recommendedAction,
        dashboardUrl: result.dashboardUrl,
        instructions: result.instructions,
        estimatedMinutes: result.estimatedMinutes,
      },
    };

    // Include raw headers if requested (debugging)
    if (includeHeaders && result.detection.rawHeaders) {
      response.data.rawHeaders = result.detection.rawHeaders;
    }

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 minutes (Cloudflare status doesn't change often)
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error("Cloudflare detection error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Detection failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - For batch detection
// ============================================================================

const BatchQuerySchema = z.object({
  domains: z.array(z.string()).min(1).max(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domains } = BatchQuerySchema.parse(body);

    // Run detection for all domains in parallel
    const results = await Promise.all(
      domains.map(async (domain) => {
        const normalizedDomain = domain
          .replace(/^https?:\/\//, "")
          .replace(/\/$/, "");

        try {
          const result = await integrateCloudfareCrawlerHints(normalizedDomain);
          return {
            domain: normalizedDomain,
            success: true,
            usesCloudflare: result.usesCloudflare,
            detectionMethod: result.detection.detectionMethod,
            recommendedAction: result.recommendedAction,
            dashboardUrl: result.dashboardUrl,
          };
        } catch (error) {
          return {
            domain: normalizedDomain,
            success: false,
            error: error instanceof Error ? error.message : "Detection failed",
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Batch detection failed",
      },
      { status: 500 }
    );
  }
}
