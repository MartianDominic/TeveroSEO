/**
 * Duplicate service API route.
 * Phase 58-01: Service Catalog & Extra Services - API Layer
 *
 * POST /api/services/:serviceId/duplicate - Duplicate a service template
 *
 * Security:
 * - Workspace ownership verified for target workspace
 * - Can duplicate system templates or own workspace templates
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { ServiceCatalogService } from "@/server/features/services/services/ServiceCatalogService";

const log = createLogger({ module: "api/services/$serviceId/duplicate" });

/**
 * Duplicate service request schema.
 */
const duplicateServiceSchema = z.object({
  newName: z.string().min(1).max(200).optional(),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/services/$serviceId/duplicate")({
  server: {
    handlers: {
      /**
       * POST /api/services/:serviceId/duplicate
       * Duplicate a service template to the current workspace.
       * Can duplicate system templates or own workspace templates.
       */
      POST: async ({ request, params }: { request: Request; params: { serviceId: string } }) => {
        try {
          const auth = await requireApiAuth(request);
          const workspaceId = auth.organizationId;
          const { serviceId } = params;

          // Parse optional new name from body
          let newName: string | undefined;
          try {
            const body = (await request.json()) as Record<string, unknown>;
            const parsed = duplicateServiceSchema.safeParse(body);
            if (parsed.success) {
              newName = parsed.data.newName;
            }
          } catch {
            // Empty body is allowed
          }

          // Verify access: user can duplicate system templates or their workspace templates
          const source = await ServiceCatalogService.getService(serviceId);
          if (!source) {
            throw new AppError("NOT_FOUND", "Service not found");
          }

          if (
            source.workspaceId !== null &&
            source.workspaceId !== workspaceId
          ) {
            throw new AppError("FORBIDDEN", "Cannot duplicate service from another workspace");
          }

          const duplicated = await ServiceCatalogService.duplicateService(
            serviceId,
            workspaceId,
            newName
          );

          log.info("Service duplicated", {
            sourceId: serviceId,
            newId: duplicated.id,
            workspaceId,
          });

          return Response.json(
            {
              id: duplicated.id,
              workspaceId: duplicated.workspaceId,
              category: duplicated.category,
              name: duplicated.name,
              nameEn: duplicated.nameEn,
              nameLt: duplicated.nameLt,
              description: duplicated.description,
              pricingType: duplicated.pricingType,
              basePriceCents: duplicated.basePriceCents,
              setupFeeCents: duplicated.setupFeeCents,
              currency: duplicated.currency,
              unitLabel: duplicated.unitLabel,
              inclusions: duplicated.inclusions,
              icon: duplicated.icon,
              displayOrder: duplicated.displayOrder,
              isActive: duplicated.isActive,
              createdAt: duplicated.createdAt.toISOString(),
              updatedAt: duplicated.updatedAt.toISOString(),
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
            "Duplicate service failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
