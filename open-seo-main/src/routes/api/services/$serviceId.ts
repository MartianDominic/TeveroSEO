/**
 * Individual service API routes.
 * Phase 58-01: Service Catalog & Extra Services - API Layer
 *
 * GET /api/services/:serviceId - Get service details
 * PUT /api/services/:serviceId - Update service
 * DELETE /api/services/:serviceId - Delete service (soft delete)
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
import { ServiceCatalogService } from "@/server/features/services/services/ServiceCatalogService";
import { SERVICE_CATEGORIES, PRICING_TYPES } from "@/db/service-catalog-schema";

const log = createLogger({ module: "api/services/$serviceId" });

/**
 * Update service request schema.
 */
const updateServiceSchema = z.object({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  name: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional().nullable(),
  nameLt: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  descriptionEn: z.string().max(2000).optional().nullable(),
  descriptionLt: z.string().max(2000).optional().nullable(),
  pricingType: z.enum(PRICING_TYPES).optional(),
  basePriceCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  setupFeeCents: z.number().int().min(0).max(100_000_000).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  unitLabel: z.string().max(100).optional().nullable(),
  inclusions: z.array(z.string().max(500)).max(20).optional().nullable(),
  termsTemplate: z.string().max(10000).optional().nullable(),
  termsTemplateEn: z.string().max(10000).optional().nullable(),
  termsTemplateLt: z.string().max(10000).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  displayOrder: z.number().int().min(0).max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const Route = createFileRoute("/api/services/$serviceId")({
  server: {
    handlers: {
      /**
       * GET /api/services/:serviceId
       * Get a service by ID.
       */
      GET: async ({ request, params }: { request: Request; params: { serviceId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const { serviceId } = params;

          const service = await ServiceCatalogService.getService(serviceId);

          if (!service) {
            throw new AppError("NOT_FOUND", "Service not found");
          }

          // Verify access: user can access system templates or their workspace templates
          if (
            service.workspaceId !== null &&
            service.workspaceId !== auth.organizationId
          ) {
            throw new AppError("NOT_FOUND", "Service not found");
          }

          return Response.json({
            id: service.id,
            workspaceId: service.workspaceId,
            category: service.category,
            name: service.name,
            nameEn: service.nameEn,
            nameLt: service.nameLt,
            description: service.description,
            descriptionEn: service.descriptionEn,
            descriptionLt: service.descriptionLt,
            pricingType: service.pricingType,
            basePriceCents: service.basePriceCents,
            setupFeeCents: service.setupFeeCents,
            currency: service.currency,
            unitLabel: service.unitLabel,
            inclusions: service.inclusions,
            termsTemplate: service.termsTemplate,
            termsTemplateEn: service.termsTemplateEn,
            termsTemplateLt: service.termsTemplateLt,
            icon: service.icon,
            displayOrder: service.displayOrder,
            isActive: service.isActive,
            isSystemTemplate: service.workspaceId === null,
            createdAt: service.createdAt.toISOString(),
            updatedAt: service.updatedAt.toISOString(),
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
            "Get service failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * PUT /api/services/:serviceId
       * Update a service template.
       */
      PUT: async ({ request, params }: { request: Request; params: { serviceId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { serviceId } = params;

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = updateServiceSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const updated = await ServiceCatalogService.updateService(
            serviceId,
            workspaceId,
            parsed.data
          );

          log.info("Service updated", { serviceId, workspaceId });

          return Response.json({
            id: updated.id,
            workspaceId: updated.workspaceId,
            category: updated.category,
            name: updated.name,
            nameEn: updated.nameEn,
            nameLt: updated.nameLt,
            description: updated.description,
            pricingType: updated.pricingType,
            basePriceCents: updated.basePriceCents,
            setupFeeCents: updated.setupFeeCents,
            currency: updated.currency,
            unitLabel: updated.unitLabel,
            inclusions: updated.inclusions,
            icon: updated.icon,
            displayOrder: updated.displayOrder,
            isActive: updated.isActive,
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
            "Update service failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      /**
       * DELETE /api/services/:serviceId
       * Soft delete a service (sets isActive = false).
       * Only workspace templates can be deleted, not system templates.
       */
      DELETE: async ({ request, params }: { request: Request; params: { serviceId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { serviceId } = params;

          await ServiceCatalogService.deleteService(serviceId, workspaceId);

          log.info("Service deleted", { serviceId, workspaceId });

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
            "Delete service failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
