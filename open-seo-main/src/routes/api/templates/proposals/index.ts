/**
 * Proposal templates API routes.
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * GET /api/templates/proposals - List templates for workspace
 * POST /api/templates/proposals - Create new template
 *
 * Security:
 * - Workspace ownership verified via organizationId
 * - Zod schema validates template structure
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
  TEMPLATE_SECTION_TYPES,
} from "@/db/proposal-template-schema";

const log = createLogger({ module: "api/templates/proposals" });

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
  logoUrl: z.string().url().max(2000).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().max(100).optional(),
  headerStyle: z.enum(["centered", "left-aligned", "minimal"]).optional(),
  footerText: z.string().max(500).optional(),
});

/**
 * Section creation schema.
 */
const sectionSchema = z.object({
  key: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  titleEn: z.string().max(200).optional(),
  titleLt: z.string().max(200).optional(),
  content: z.string().max(50000).optional(),
  contentEn: z.string().max(50000).optional(),
  contentLt: z.string().max(50000).optional(),
  sectionType: z.enum(TEMPLATE_SECTION_TYPES).default("custom"),
  isRequired: z.boolean().default(false),
  isEditable: z.boolean().default(true),
  position: z.number().int().min(0).max(100).optional(),
  aiPromptHint: z.string().max(1000).optional(),
});

/**
 * Create template request schema.
 */
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameLt: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  descriptionEn: z.string().max(1000).optional(),
  descriptionLt: z.string().max(1000).optional(),
  type: z.enum(PROPOSAL_TEMPLATE_TYPES).default("proposal"),
  category: z.enum(PROPOSAL_TEMPLATE_CATEGORIES).default("seo"),
  variables: z.array(variableDefinitionSchema).max(50).default([]),
  brandingSettings: brandingSettingsSchema.optional(),
  isDefault: z.boolean().default(false),
  sections: z.array(sectionSchema).max(30).optional(),
});

/**
 * List templates query params schema.
 */
const listTemplatesQuerySchema = z.object({
  type: z.enum(PROPOSAL_TEMPLATE_TYPES).optional(),
  category: z.enum(PROPOSAL_TEMPLATE_CATEGORIES).optional(),
  includeArchived: z.coerce.boolean().default(false),
});

export const Route = createFileRoute("/api/templates/proposals/")({
  server: {
    handlers: {
      /**
       * GET /api/templates/proposals
       * List all templates available to the current workspace.
       * Includes system templates (workspaceId = null) and workspace-specific templates.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // Parse query params
          const url = new URL(request.url);
          const queryResult = listTemplatesQuerySchema.safeParse({
            type: url.searchParams.get("type"),
            category: url.searchParams.get("category"),
            includeArchived: url.searchParams.get("includeArchived"),
          });

          if (!queryResult.success) {
            return Response.json(
              { error: "Invalid query parameters", details: queryResult.error.issues },
              { status: 400 }
            );
          }

          const templates = await TemplateService.listTemplates(
            workspaceId,
            queryResult.data
          );

          return Response.json({
            templates: templates.map((t) => ({
              id: t.id,
              workspaceId: t.workspaceId,
              name: t.name,
              nameEn: t.nameEn,
              nameLt: t.nameLt,
              description: t.description,
              descriptionEn: t.descriptionEn,
              descriptionLt: t.descriptionLt,
              type: t.type,
              category: t.category,
              version: t.version,
              isPublished: t.isPublished,
              isDefault: t.isDefault,
              isArchived: t.isArchived,
              isSystemTemplate: t.workspaceId === null,
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
                  : err.code === "NOT_FOUND"
                    ? 404
                    : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "List templates failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * POST /api/templates/proposals
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
              { status: 400 }
            );
          }

          const template = await TemplateService.createTemplate({
            workspaceId,
            ...parsed.data,
            createdBy: auth.userId,
          });

          log.info("Template created", {
            templateId: template.id,
            workspaceId,
          });

          return Response.json(
            {
              id: template.id,
              workspaceId: template.workspaceId,
              name: template.name,
              nameEn: template.nameEn,
              nameLt: template.nameLt,
              description: template.description,
              type: template.type,
              category: template.category,
              variables: template.variables,
              brandingSettings: template.brandingSettings,
              sectionOrder: template.sectionOrder,
              version: template.version,
              isPublished: template.isPublished,
              isDefault: template.isDefault,
              sections: template.sections.map((s) => ({
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
              createdAt: template.createdAt.toISOString(),
              updatedAt: template.updatedAt.toISOString(),
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
                  : err.code === "VALIDATION_ERROR"
                    ? 400
                    : 500;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Create template failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
