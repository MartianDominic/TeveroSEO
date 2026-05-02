/**
 * Individual report template API routes.
 * Phase 53: CRUD operations for single templates.
 *
 * GET /api/report-templates/:id - Get template
 * PUT /api/report-templates/:id - Update template
 * DELETE /api/report-templates/:id - Delete template
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

const log = createLogger({ module: "api/report-templates/:id" });

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
 * Update template request schema.
 * T-53-13: Max 10 sections, max 100 char name.
 */
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sections: z.array(sectionSchema).min(1).max(10).optional(),
  locale: z.string().min(2).max(10).optional(),
  isDefault: z.boolean().optional(),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/report-templates/$id")({
  server: {
    handlers: {
      /**
       * GET /api/report-templates/:id
       * Get a single template by ID.
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          const [template] = await db
            .select()
            .from(reportTemplates)
            .where(
              and(
                eq(reportTemplates.id, params.id),
                eq(reportTemplates.workspaceId, workspaceId),
              ),
            )
            .limit(1);

          if (!template) {
            return Response.json(
              { error: "Template not found" },
              { status: 404 },
            );
          }

          return Response.json({
            id: template.id,
            name: template.name,
            description: template.description,
            sections: template.sections,
            locale: template.locale,
            isDefault: template.isDefault,
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString(),
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
            "Get template failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * PUT /api/report-templates/:id
       * Update an existing template.
       */
      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateTemplateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 },
            );
          }

          // Verify template exists and belongs to workspace (T-53-11)
          const [existing] = await db
            .select()
            .from(reportTemplates)
            .where(
              and(
                eq(reportTemplates.id, params.id),
                eq(reportTemplates.workspaceId, workspaceId),
              ),
            )
            .limit(1);

          if (!existing) {
            return Response.json(
              { error: "Template not found" },
              { status: 404 },
            );
          }

          // If setting as default, unset others
          if (parsed.data.isDefault) {
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

          const [updated] = await db
            .update(reportTemplates)
            .set({
              ...parsed.data,
              updatedAt: new Date(),
            })
            .where(eq(reportTemplates.id, params.id))
            .returning();

          log.info("Template updated", { templateId: params.id });

          return Response.json({
            id: updated.id,
            name: updated.name,
            description: updated.description,
            sections: updated.sections,
            locale: updated.locale,
            isDefault: updated.isDefault,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
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
            "Update template failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * DELETE /api/report-templates/:id
       * Delete a template.
       */
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // Delete only if template belongs to workspace (T-53-11)
          const [deleted] = await db
            .delete(reportTemplates)
            .where(
              and(
                eq(reportTemplates.id, params.id),
                eq(reportTemplates.workspaceId, workspaceId),
              ),
            )
            .returning();

          if (!deleted) {
            return Response.json(
              { error: "Template not found" },
              { status: 404 },
            );
          }

          log.info("Template deleted", { templateId: params.id });

          return Response.json({ success: true });
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
            "Delete template failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
