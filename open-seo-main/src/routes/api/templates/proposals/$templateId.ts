/**
 * Individual proposal template API routes.
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * GET /api/templates/proposals/:templateId - Get template with sections
 * PUT /api/templates/proposals/:templateId - Update template
 * DELETE /api/templates/proposals/:templateId - Delete template (soft delete)
 *
 * Security:
 * - Workspace ownership verified for mutations
 * - System templates (workspaceId = null) are read-only
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { TemplateService } from "@/server/features/proposals/services/TemplateService";
import {
  PROPOSAL_TEMPLATE_TYPES,
  PROPOSAL_TEMPLATE_CATEGORIES,
} from "@/db/proposal-template-schema";

const log = createLogger({ module: "api/templates/proposals/$templateId" });

/**
 * Variable definition schema.
 */
const variableDefinitionSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  labelEn: z.string().max(200).optional(),
  labelLt: z.string().max(200).optional(),
  category: z.enum(["client", "provider", "pricing", "audit", "dates", "custom"]),
  type: z.enum(["text", "number", "currency", "date", "list", "rich_text"]),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  validation: z.object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().max(10000).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().max(500).optional(),
  }).optional(),
});

/**
 * Branding settings schema.
 */
const brandingSettingsSchema = z.object({
  logoUrl: z.string().url().max(2000).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  fontFamily: z.string().max(100).optional().nullable(),
  headerStyle: z.enum(["centered", "left-aligned", "minimal"]).optional().nullable(),
  footerText: z.string().max(500).optional().nullable(),
});

/**
 * Update template request schema.
 */
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional().nullable(),
  nameLt: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  descriptionEn: z.string().max(1000).optional().nullable(),
  descriptionLt: z.string().max(1000).optional().nullable(),
  type: z.enum(PROPOSAL_TEMPLATE_TYPES).optional(),
  category: z.enum(PROPOSAL_TEMPLATE_CATEGORIES).optional(),
  variables: z.array(variableDefinitionSchema).max(50).optional(),
  brandingSettings: brandingSettingsSchema.optional().nullable(),
  isDefault: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export const Route = createFileRoute("/api/templates/proposals/$templateId")({
  server: {
    handlers: {
      /**
       * GET /api/templates/proposals/:templateId
       * Get a template by ID with all its sections.
       */
      GET: async ({ request, params }: { request: Request; params: { templateId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const { templateId } = params;

          const template = await TemplateService.getTemplate(templateId);

          // Verify access: user can access system templates or their workspace templates
          if (
            template.workspaceId !== null &&
            template.workspaceId !== auth.organizationId
          ) {
            throw new AppError("NOT_FOUND", "Template not found");
          }

          return Response.json({
            id: template.id,
            workspaceId: template.workspaceId,
            name: template.name,
            nameEn: template.nameEn,
            nameLt: template.nameLt,
            description: template.description,
            descriptionEn: template.descriptionEn,
            descriptionLt: template.descriptionLt,
            type: template.type,
            category: template.category,
            variables: template.variables,
            brandingSettings: template.brandingSettings,
            sectionOrder: template.sectionOrder,
            version: template.version,
            isPublished: template.isPublished,
            isDefault: template.isDefault,
            isArchived: template.isArchived,
            isSystemTemplate: template.workspaceId === null,
            sections: template.sections.map((s) => ({
              id: s.id,
              key: s.key,
              title: s.title,
              titleEn: s.titleEn,
              titleLt: s.titleLt,
              content: s.content,
              contentEn: s.contentEn,
              contentLt: s.contentLt,
              sectionType: s.sectionType,
              isRequired: s.isRequired,
              isEditable: s.isEditable,
              position: s.position,
              conditions: s.conditions,
              aiPromptHint: s.aiPromptHint,
              createdAt: s.createdAt.toISOString(),
              updatedAt: s.updatedAt.toISOString(),
            })),
            createdAt: template.createdAt.toISOString(),
            updatedAt: template.updatedAt.toISOString(),
            createdBy: template.createdBy,
          });
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
            "Get template failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * PUT /api/templates/proposals/:templateId
       * Update a template (metadata only, sections are updated via separate endpoints).
       */
      PUT: async ({ request, params }: { request: Request; params: { templateId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { templateId } = params;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateTemplateSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const updated = await TemplateService.updateTemplate(
            templateId,
            workspaceId,
            parsed.data
          );

          log.info("Template updated", { templateId, workspaceId });

          return Response.json({
            id: updated.id,
            workspaceId: updated.workspaceId,
            name: updated.name,
            nameEn: updated.nameEn,
            nameLt: updated.nameLt,
            description: updated.description,
            type: updated.type,
            category: updated.category,
            variables: updated.variables,
            brandingSettings: updated.brandingSettings,
            sectionOrder: updated.sectionOrder,
            version: updated.version,
            isPublished: updated.isPublished,
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
                  : err.code === "NOT_FOUND"
                    ? 404
                    : err.code === "VALIDATION_ERROR"
                      ? 400
                      : 500;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Update template failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * DELETE /api/templates/proposals/:templateId
       * Soft delete a template (sets isArchived = true).
       * Only workspace templates can be deleted, not system templates.
       */
      DELETE: async ({ request, params }: { request: Request; params: { templateId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { templateId } = params;

          await TemplateService.deleteTemplate(templateId, workspaceId);

          log.info("Template deleted", { templateId, workspaceId });

          return Response.json({ success: true }, { status: 200 });
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
            "Delete template failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
