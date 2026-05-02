/**
 * Template duplicate API route.
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * POST /api/templates/proposals/:templateId/duplicate - Clone template to workspace
 *
 * Security:
 * - Source template must be accessible (system or own workspace)
 * - Duplicate is created in the current workspace
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { TemplateService } from "@/server/features/proposals/services/TemplateService";

const log = createLogger({ module: "api/templates/proposals/$templateId.duplicate" });

/**
 * Duplicate template request schema.
 */
const duplicateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/templates/proposals/$templateId/duplicate")({
  server: {
    handlers: {
      /**
       * POST /api/templates/proposals/:templateId/duplicate
       * Clone a template (system or existing) to the current workspace.
       */
      POST: async ({ request, params }: { request: Request; params: { templateId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { templateId } = params;

          // Parse optional new name
          let newName: string | undefined;
          try {
            const body = (await request.json()) as Record<string, unknown>;
            const parsed = duplicateTemplateSchema.safeParse(body);
            if (parsed.success) {
              newName = parsed.data.name;
            }
          } catch {
            // No body provided, use default name
          }

          // Verify source template is accessible
          const source = await TemplateService.getTemplate(templateId);
          if (
            source.workspaceId !== null &&
            source.workspaceId !== workspaceId
          ) {
            throw new AppError("NOT_FOUND", "Template not found");
          }

          const duplicate = await TemplateService.duplicateTemplate(
            templateId,
            workspaceId,
            newName
          );

          log.info("Template duplicated", {
            sourceId: templateId,
            newId: duplicate.id,
            workspaceId,
          });

          return Response.json(
            {
              id: duplicate.id,
              workspaceId: duplicate.workspaceId,
              name: duplicate.name,
              nameEn: duplicate.nameEn,
              nameLt: duplicate.nameLt,
              description: duplicate.description,
              type: duplicate.type,
              category: duplicate.category,
              variables: duplicate.variables,
              brandingSettings: duplicate.brandingSettings,
              sectionOrder: duplicate.sectionOrder,
              version: duplicate.version,
              isPublished: duplicate.isPublished,
              isDefault: duplicate.isDefault,
              sections: duplicate.sections.map((s) => ({
                id: s.id,
                key: s.key,
                title: s.title,
                titleEn: s.titleEn,
                titleLt: s.titleLt,
                sectionType: s.sectionType,
                isRequired: s.isRequired,
                isEditable: s.isEditable,
                position: s.position,
              })),
              createdAt: duplicate.createdAt.toISOString(),
              updatedAt: duplicate.updatedAt.toISOString(),
            },
            { status: 201 }
          );
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Duplicate template failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
