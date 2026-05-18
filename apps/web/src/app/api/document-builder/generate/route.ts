/**
 * Document Builder AI Generation API Route
 * Phase 102-03: AI content generation
 *
 * POST endpoint for generating block content with AI.
 * Rate limited: 10 generations/hour/user per T-102-04.
 */

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { generateBlockContent, type GenerationRequest } from "@/lib/document-builder/ai-generator";
import { PERSUASION_BLOCK_TYPES_ARRAY } from "@/lib/document-builder/types";
import {
  unauthorized,
  badRequest,
  validationError,
  rateLimited,
  internalError,
  success,
} from "@/lib/api/responses";
import { validateCsrf } from "@/lib/api/security";

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

/**
 * Prospect context schema with explicit fields.
 * M-10-01: Removed .passthrough() to prevent arbitrary unvalidated fields.
 */
const prospectContextSchema = z.object({
  id: z.string().min(1).max(100),
  domain: z.string().max(253).optional(), // Max domain length per RFC
  niche: z.string().max(200).optional(),
  painPoints: z.array(z.string().max(500)).max(20).optional(),
  // Explicitly allow customData for extension (validated)
  customData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validate URL uses safe protocol (http/https only).
 * H-10-01: Prevents javascript:, data:, file: protocols.
 */
const safeUrlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
  { message: 'URL must use http or https protocol' }
);

const styleReferenceSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(["pdf", "url", "text"]),
  url: safeUrlSchema.optional(),
  content: z.string().max(50000).optional(), // 50KB max for text content
});

const generationRequestSchema = z.object({
  // PERSUASION_BLOCK_TYPES_ARRAY is a readonly tuple from `as const`, so we can use it directly
  blockType: z.enum(PERSUASION_BLOCK_TYPES_ARRAY),
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
    // CSRF protection for state-changing request
    const csrfError = validateCsrf(req);
    if (csrfError) return csrfError;

    // Authentication check
    const { userId, orgId } = await auth();
    if (!userId) {
      return unauthorized();
    }

    // Content-Type validation
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return badRequest("Content-Type must be application/json");
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
      return rateLimited(
        `AI generation limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const parseResult = generationRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return validationError(parseResult.error);
    }

    // Zod schema validates and infers the type - construct GenerationRequest explicitly
    const validatedData = parseResult.data;
    const request: GenerationRequest = {
      // blockType is properly typed from z.enum(PERSUASION_BLOCK_TYPES_ARRAY)
      blockType: validatedData.blockType,
      intent: validatedData.intent,
      prospect: {
        id: validatedData.prospect.id,
        domain: validatedData.prospect.domain,
        niche: validatedData.prospect.niche,
        painPoints: validatedData.prospect.painPoints,
      },
      styleReferences: validatedData.styleReferences,
      existingContent: validatedData.existingContent,
      customPrompt: validatedData.customPrompt,
      maxLength: validatedData.maxLength,
      tone: validatedData.tone,
      language: validatedData.language,
      framework: validatedData.framework,
      precedingBlocks: validatedData.precedingBlocks,
    };

    // Generate content
    const startTime = Date.now();
    logger.info("[doc-builder/generate] Generating content", {
      userId,
      blockType: request.blockType,
      intent: request.intent,
      language: request.language,
    });

    const result = await generateBlockContent(request);
    const durationMs = Date.now() - startTime;

    // M-OBS-04: Log success with metrics
    logger.info("[doc-builder/generate] Content generated successfully", {
      userId,
      blockType: request.blockType,
      intent: request.intent,
      durationMs,
      confidence: result.confidence,
      contentLength: result.content.length,
      // Token usage for cost tracking (if available from ai-generator)
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      totalTokens: result.usage?.totalTokens,
      cost: result.cost,
    });

    // Return generated content
    return success({
      content: result.content,
      confidence: result.confidence,
      suggestions: result.suggestions,
    });
  } catch (error) {
    logger.error("[doc-builder/generate] Generation failed", error instanceof Error ? error : { error: String(error) });

    return internalError("Content generation failed. Please try again.");
  }
}
