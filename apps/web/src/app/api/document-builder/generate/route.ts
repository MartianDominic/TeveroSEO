/**
 * Document Builder AI Generation API Route
 * Phase 102-03: AI content generation
 *
 * POST endpoint for generating block content with AI.
 * Rate limited: 10 generations/hour/user per T-102-04.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { generateBlockContent, type GenerationRequest } from "@/lib/document-builder/ai-generator";
import { PERSUASION_BLOCK_TYPES_ARRAY } from "@/lib/document-builder/types";

// Use Node.js runtime for longer timeout
export const runtime = "nodejs";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Rate Limit Configuration
// ---------------------------------------------------------------------------

/**
 * AI generation rate limit: 10 requests per hour per user.
 * This is stricter than standard API endpoints to control AI costs.
 */
const AI_GENERATION_RATE_LIMIT = {
  limit: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// ---------------------------------------------------------------------------
// Request Validation Schema
// ---------------------------------------------------------------------------

const prospectContextSchema = z.object({
  id: z.string().min(1),
  domain: z.string().optional(),
  niche: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
}).passthrough();

const styleReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(["pdf", "url", "text"]),
  url: z.string().optional(),
  content: z.string().optional(),
});

const generationRequestSchema = z.object({
  blockType: z.enum(PERSUASION_BLOCK_TYPES_ARRAY as [string, ...string[]]),
  intent: z.enum(["create", "fill_variables", "regenerate", "improve"]),
  prospect: prospectContextSchema,
  styleReferences: z.array(styleReferenceSchema).optional(),
  existingContent: z.string().max(10000).optional(),
  customPrompt: z.string().max(1000).optional(),
  maxLength: z.number().int().min(10).max(2000).optional(),
  tone: z.string().max(100).optional(),
  language: z.string().max(10).default("lt"),
  framework: z.string().max(100).optional(),
  precedingBlocks: z.array(z.string().max(2000)).max(10).optional(),
});

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    // Authentication check
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Content-Type validation
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    // Rate limiting: 10 generations per hour per user
    const rateLimitKey = `doc-builder-generate:${userId}`;
    const rateLimitResult = await checkRateLimit(
      rateLimitKey,
      AI_GENERATION_RATE_LIMIT.limit,
      AI_GENERATION_RATE_LIMIT.windowMs
    );

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      logger.warn("[doc-builder/generate] Rate limit exceeded", {
        userId,
        retryAfter,
      });
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `AI generation limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.reset / 1000)),
          },
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parseResult = generationRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: parseResult.error.issues.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const request = parseResult.data as GenerationRequest;

    // Generate content
    logger.info("[doc-builder/generate] Generating content", {
      userId,
      blockType: request.blockType,
      intent: request.intent,
      language: request.language,
    });

    const result = await generateBlockContent(request);

    // Return generated content
    return NextResponse.json(
      {
        content: result.content,
        confidence: result.confidence,
        suggestions: result.suggestions,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": String(Math.ceil(rateLimitResult.reset / 1000)),
        },
      }
    );
  } catch (error) {
    logger.error("[doc-builder/generate] Generation failed", error instanceof Error ? error : { error: String(error) });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Content generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
