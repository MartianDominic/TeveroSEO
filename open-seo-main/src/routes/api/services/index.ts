/**
 * Service catalog API routes.
 * Phase 58-01: Service Catalog & Extra Services - API Layer
 *
 * GET /api/services - List services for workspace
 * POST /api/services - Create new service template
 *
 * Security:
 * - Workspace ownership verified via organizationId from auth
 * - Zod schema validates service structure
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { ServiceCatalogService } from "@/server/features/services/services/ServiceCatalogService";
import { SERVICE_CATEGORIES, PRICING_TYPES } from "@/db/service-catalog-schema";

const log = createLogger({ module: "api/services" });

/**
 * Create service request schema.
 */
const createServiceSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES),
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional(),
  nameLt: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  descriptionEn: z.string().max(2000).optional(),
  descriptionLt: z.string().max(2000).optional(),
  pricingType: z.enum(PRICING_TYPES),
  basePriceCents: z.number().int().min(0).max(100_000_000).optional(),
  setupFeeCents: z.number().int().min(0).max(100_000_000).optional(),
  currency: z.string().length(3).default("EUR"),
  unitLabel: z.string().max(100).optional(),
  inclusions: z.array(z.string().max(500)).max(20).optional(),
  termsTemplate: z.string().max(10000).optional(),
  termsTemplateEn: z.string().max(10000).optional(),
  termsTemplateLt: z.string().max(10000).optional(),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
});

/**
 * List services query params schema.
 */
const listServicesQuerySchema = z.object({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const Route = createFileRoute("/api/services/")({
  server: {
    handlers: {
      /**
       * GET /api/services
       * List all services available to the current workspace.
       * Includes system templates (workspaceId = null) and workspace-specific templates.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          // Parse query params
          const url = new URL(request.url);
          const queryResult = listServicesQuerySchema.safeParse({
            category: url.searchParams.get("category"),
            includeInactive: url.searchParams.get("includeInactive"),
          });

          if (!queryResult.success) {
            return Response.json(
              { error: "Invalid query parameters", details: queryResult.error.issues },
              { status: 400 }
            );
          }

          // Ensure default services exist
          await ServiceCatalogService.ensureDefaultServices(workspaceId);

          const services = await ServiceCatalogService.listServices(
            workspaceId,
            queryResult.data
          );

          return Response.json({
            services: services.map((s) => ({
              id: s.id,
              workspaceId: s.workspaceId,
              category: s.category,
              name: s.name,
              nameEn: s.nameEn,
              nameLt: s.nameLt,
              description: s.description,
              descriptionEn: s.descriptionEn,
              descriptionLt: s.descriptionLt,
              pricingType: s.pricingType,
              basePriceCents: s.basePriceCents,
              setupFeeCents: s.setupFeeCents,
              currency: s.currency,
              unitLabel: s.unitLabel,
              inclusions: s.inclusions,
              termsTemplate: s.termsTemplate,
              termsTemplateEn: s.termsTemplateEn,
              termsTemplateLt: s.termsTemplateLt,
              icon: s.icon,
              displayOrder: s.displayOrder,
              isActive: s.isActive,
              isSystemTemplate: s.workspaceId === null,
              createdAt: s.createdAt.toISOString(),
              updatedAt: s.updatedAt.toISOString(),
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
            "List services failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * POST /api/services
       * Create a new service template for the current workspace.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = createServiceSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const service = await ServiceCatalogService.createService(
            workspaceId,
            parsed.data
          );

          log.info("Service created", {
            serviceId: service.id,
            workspaceId,
          });

          return Response.json(
            {
              id: service.id,
              workspaceId: service.workspaceId,
              category: service.category,
              name: service.name,
              nameEn: service.nameEn,
              nameLt: service.nameLt,
              description: service.description,
              pricingType: service.pricingType,
              basePriceCents: service.basePriceCents,
              setupFeeCents: service.setupFeeCents,
              currency: service.currency,
              unitLabel: service.unitLabel,
              inclusions: service.inclusions,
              icon: service.icon,
              displayOrder: service.displayOrder,
              isActive: service.isActive,
              createdAt: service.createdAt.toISOString(),
              updatedAt: service.updatedAt.toISOString(),
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
            "Create service failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
