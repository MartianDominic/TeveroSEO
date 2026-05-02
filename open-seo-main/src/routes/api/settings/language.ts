/**
 * Language Settings API Routes
 * Phase 55-04: Multi-Tenant Language Settings
 *
 * GET /api/settings/language - Get workspace language settings
 * PUT /api/settings/language - Update workspace language settings
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { organization } from "@/db/user-schema";
import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import type { SupportedLocale, Formality } from "@/server/services/translation/types";

const log = createLogger({ module: "LanguageSettingsAPI" });

// Supported locales and formality options
const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "lt"];
const FORMALITY_OPTIONS: Formality[] = ["formal", "informal"];

// Validation schemas
const updateLanguageSettingsSchema = z.object({
  defaultLanguage: z.enum(["en", "lt"]),
  supportedLanguages: z.array(z.enum(["en", "lt"])).min(1, "At least one language must be supported"),
  formality: z.enum(["formal", "informal"]),
  country: z.string().length(2).optional().nullable(),
}).refine(
  (data) => data.supportedLanguages.includes(data.defaultLanguage),
  {
    message: "Default language must be in supported languages",
    path: ["defaultLanguage"],
  }
);

/**
 * Response format for language settings
 */
interface LanguageSettingsResponse {
  defaultLanguage: SupportedLocale;
  supportedLanguages: SupportedLocale[];
  formality: Formality;
  country: string | null;
}

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/settings/language")({
  server: {
    handlers: {
      /**
       * GET /api/settings/language
       * Get workspace language settings
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const result = await db
            .select({
              defaultLanguage: organization.defaultLanguage,
              supportedLanguages: organization.supportedLanguages,
              formality: organization.formality,
              country: organization.country,
            })
            .from(organization)
            .where(eq(organization.id, auth.organizationId))
            .limit(1);

          if (result.length === 0) {
            return Response.json(
              { success: false, error: "Organization not found" },
              { status: 404 }
            );
          }

          const row = result[0];
          const response: LanguageSettingsResponse = {
            defaultLanguage: (row.defaultLanguage as SupportedLocale) ?? "en",
            supportedLanguages: (row.supportedLanguages as SupportedLocale[]) ?? ["en"],
            formality: (row.formality as Formality) ?? "formal",
            country: row.country,
          };

          return Response.json({ success: true, data: response });
        } catch (error) {
          log.error("Failed to get language settings", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to get language settings" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT /api/settings/language
       * Update workspace language settings
       */
      PUT: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          const body = await request.json();
          const parsed = updateLanguageSettingsSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Validation error", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const { defaultLanguage, supportedLanguages, formality, country } = parsed.data;

          // Validate that all languages are supported
          for (const lang of supportedLanguages) {
            if (!SUPPORTED_LOCALES.includes(lang)) {
              return Response.json(
                { success: false, error: `Unsupported language: ${lang}` },
                { status: 400 }
              );
            }
          }

          // Validate formality
          if (!FORMALITY_OPTIONS.includes(formality)) {
            return Response.json(
              { success: false, error: `Invalid formality: ${formality}` },
              { status: 400 }
            );
          }

          // Update organization settings
          const updated = await db
            .update(organization)
            .set({
              defaultLanguage,
              supportedLanguages,
              formality,
              country: country ?? null,
            })
            .where(eq(organization.id, auth.organizationId))
            .returning({
              defaultLanguage: organization.defaultLanguage,
              supportedLanguages: organization.supportedLanguages,
              formality: organization.formality,
              country: organization.country,
            });

          if (updated.length === 0) {
            return Response.json(
              { success: false, error: "Organization not found" },
              { status: 404 }
            );
          }

          const row = updated[0];
          const response: LanguageSettingsResponse = {
            defaultLanguage: row.defaultLanguage as SupportedLocale,
            supportedLanguages: row.supportedLanguages as SupportedLocale[],
            formality: row.formality as Formality,
            country: row.country,
          };

          log.info("Updated language settings", {
            workspaceId: auth.organizationId,
            defaultLanguage,
            formality,
          });

          return Response.json({ success: true, data: response });
        } catch (error) {
          log.error("Failed to update language settings", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: "Failed to update language settings" },
            { status: 500 }
          );
        }
      },
    },
  },
});
