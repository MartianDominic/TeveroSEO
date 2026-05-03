/**
 * Translation API Route
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * POST /api/translate
 * Translates text from English to Lithuanian using Gemini API with caching.
 *
 * Request body:
 * {
 *   text: string (1-10000 chars),
 *   targetLang: 'en' | 'lt',
 *   contextType?: 'ui' | 'proposal' | 'agreement' | 'email' | 'report',
 *   formality?: 'formal' | 'informal',
 *   maxLength?: number
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data?: { text: string, cached: boolean, confidence: number },
 *   error?: string
 * }
 *
 * SECURITY:
 * - HIGH-AUTH-03 FIX: Authentication required to protect Gemini API credits
 * - T-55-03: Input validation with max 10000 chars
 * - T-55-04: Rate limiting via cache (aggressive caching reduces API calls)
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getTranslationService } from "@/server/services/translation/TranslationService";
import type {
  ContextType,
  Formality,
  SupportedLocale,
} from "@/server/services/translation/types";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api-translate" });

/**
 * Zod schema for translation request.
 * T-55-03: Validate text length (max 10000 chars) to prevent abuse.
 */
const TranslateRequestSchema = z.object({
  /** Text to translate (1-10000 characters) */
  text: z
    .string()
    .min(1, "Text is required")
    .max(10000, "Text must be at most 10000 characters"),

  /** Target language */
  targetLang: z.enum(["en", "lt"]),

  /** Source language (defaults to 'en') */
  sourceLang: z.enum(["en", "lt"]).optional().default("en"),

  /** Content context type */
  contextType: z
    .enum(["ui", "proposal", "agreement", "email", "report"])
    .optional()
    .default("ui"),

  /** Formality level */
  formality: z.enum(["formal", "informal"]).optional().default("formal"),

  /** Maximum length for translated text */
  maxLength: z.number().int().positive().max(50000).optional(),

  /** Workspace ID for custom overrides */
  workspaceId: z.string().optional(),
});

type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

export const Route = createFileRoute("/api/translate")({
  server: {
    handlers: {
      /**
       * POST /api/translate
       *
       * Translates text using Gemini API with database caching.
       * HIGH-AUTH-03 FIX: Requires authentication to protect Gemini API credits.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // HIGH-AUTH-03 FIX: Require authentication
          const auth = await requireApiAuth(request);

          // Parse and validate request body
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = TranslateRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
              { status: 400 }
            );
          }

          const data: TranslateRequest = parsed.data;

          // Get translation service
          const translationService = getTranslationService();

          // Translate the text (use auth workspace if not specified)
          const result = await translationService.translate({
            text: data.text,
            sourceLang: data.sourceLang as SupportedLocale,
            targetLang: data.targetLang as SupportedLocale,
            context: {
              type: data.contextType as ContextType,
              formality: data.formality as Formality,
              workspaceId: data.workspaceId ?? auth.organizationId,
            },
            maxLength: data.maxLength,
            preservePlaceholders: true,
          });

          // MEDIUM-01 FIX: Standardized response envelope
          return Response.json({
            success: true,
            data: {
              text: result.text,
              cached: result.cached,
              confidence: result.confidence,
            },
          });
        } catch (error) {
          // MEDIUM-04 FIX: Handle AppError for proper status codes
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : error.code === "NOT_FOUND"
                    ? 404
                    : error.code === "RATE_LIMITED"
                      ? 429
                      : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          // Log error for debugging
          log.error("Translation failed", error instanceof Error ? error : new Error(String(error)));

          // Check for specific error types
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Return appropriate error response
          if (errorMessage.includes("GEMINI_API_KEY")) {
            return Response.json(
              { success: false, error: "Translation service not configured" },
              { status: 503 }
            );
          }

          return Response.json(
            { success: false, error: "Translation failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});
