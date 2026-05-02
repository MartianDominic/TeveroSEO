/**
 * Report templates API routes.
 * Phase 53: Templates for saving/loading report configurations.
 *
 * GET /api/report-templates - List templates for workspace
 * POST /api/report-templates - Create new template
 *
 * Security:
 * - T-53-11: Workspace ownership verified via organizationId
 * - T-53-12: Zod schema validates section types against enum
 * - T-53-13: Max 10 sections per template, max 100 character name
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { reportTemplates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";

const log = createLogger({ module: "api/report-templates" });

/**
 * Section type enum (T-53-12: validate against enum).
 */
const sectionTypeEnum = z.enum([
  "header",
  "summary_stats",
  "gsc_chart",
  "ga4_chart",
  "queries_table",
  "footer",
]);

/**
 * Section schema with order and optional config.
 */
const sectionSchema = z.object({
  type: sectionTypeEnum,
  order: z.number().int().min(0).max(10),
  config: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Create template request schema.
 * T-53-13: Max 10 sections, max 100 char name.
 */
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sections: z.array(sectionSchema).min(1).max(10),
  locale: z.string().min(2).max(10).default("en"),
  isDefault: z.boolean().default(false),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/report-templates/")({
  server: {
    handlers: {
      /**
       * GET /api/report-templates
       * List all templates for the current workspace.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          const templates = await db
            .select()
            .from(reportTemplates)
            .where(eq(reportTemplates.workspaceId, workspaceId))
            .orderBy(reportTemplates.name);

          return Response.json({
            templates: templates.map((t) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              sections: t.sections,
              locale: t.locale,
              isDefault: t.isDefault,
              createdAt: t.createdAt.toISOString(),
              updatedAt: t.updatedAt.toISOString(),
            })),
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "List templates failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * POST /api/report-templates
       * Create a new template for the current workspace.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = createTemplateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          const { name, description, sections, locale, isDefault } =
            parsed.data;

          // If setting as default, unset any existing default
          if (isDefault) {
            await db
              .update(reportTemplates)
              .set({ isDefault: false })
              .where(
                and(
                  eq(reportTemplates.workspaceId, workspaceId),
                  eq(reportTemplates.isDefault, true),
                ),
              );
          }

          const templateId = crypto.randomUUID();

          const [template] = await db
            .insert(reportTemplates)
            .values({
              id: templateId,
              workspaceId,
              name,
              description,
              sections,
              locale,
              isDefault,
            })
            .returning();

          log.info("Template created", {
            templateId: template.id,
            workspaceId,
          });

          return Response.json(
            {
              id: template.id,
              name: template.name,
              description: template.description,
              sections: template.sections,
              locale: template.locale,
              isDefault: template.isDefault,
              createdAt: template.createdAt.toISOString(),
              updatedAt: template.updatedAt.toISOString(),
            },
            { status: 201 },
          );
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Create template failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
