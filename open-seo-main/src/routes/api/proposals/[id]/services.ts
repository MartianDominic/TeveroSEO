/**
 * Proposal Services API - Manage services selected for a proposal.
 * Phase 58-03: Service Catalog - Proposal Integration
 *
 * GET /api/proposals/:id/services - Get services for a proposal
 * PUT /api/proposals/:id/services - Update proposal service selections
 *
 * Security:
 * - Requires authentication via API key or Clerk JWT
 * - Verifies proposal belongs to workspace
 * - Validates price bounds per threat model T-58-07
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { proposals } from "@/db/proposal-schema";
import {
  proposalServices,
  serviceTemplates,
  type ProposalServiceInsert,
} from "@/db/service-catalog-schema";
import { createLogger } from "@/server/lib/logger";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";

const log = createLogger({ module: "api/proposals/services" });

// Max price in cents: 1M EUR per threat model T-58-07
const MAX_PRICE_CENTS = 100_000_000;

/**
 * Service selection input schema.
 */
const proposalServiceInputSchema = z.object({
  serviceTemplateId: z.string().uuid(),
  customPriceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable().optional(),
  customSetupCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable().optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  isIncluded: z.boolean(),
});

/**
 * PUT body schema.
 */
const updateServicesSchema = z.object({
  services: z.array(proposalServiceInputSchema),
});

/**
 * Route definition - TanStack Start pattern.
 */
// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/proposals/[id]/services")({
  server: {
    handlers: {
      /**
       * GET - Fetch services for a proposal.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const authContext = await requireApiAuth(request);
          log.debug("Fetching proposal services", { userId: authContext.userId });

          // Extract proposal ID from URL
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/");
          const proposalIdIndex = pathParts.findIndex((p) => p === "proposals") + 1;
          const proposalId = pathParts[proposalIdIndex];

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID required" },
              { status: 400 }
            );
          }

          // Verify proposal exists and belongs to workspace (T-58-08)
          const [proposal] = await db
            .select({ id: proposals.id, workspaceId: proposals.workspaceId })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Security check: proposal belongs to user's workspace (T-58-08)
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Forbidden" },
              { status: 403 }
            );
          }

          // Fetch proposal services with template data
          const services = await db
            .select({
              id: proposalServices.id,
              proposalId: proposalServices.proposalId,
              serviceTemplateId: proposalServices.serviceTemplateId,
              customPriceCents: proposalServices.customPriceCents,
              customSetupCents: proposalServices.customSetupCents,
              quantity: proposalServices.quantity,
              isIncluded: proposalServices.isIncluded,
              displayOrder: proposalServices.displayOrder,
              createdAt: proposalServices.createdAt,
              // Template fields
              templateName: serviceTemplates.name,
              templateNameEn: serviceTemplates.nameEn,
              templateNameLt: serviceTemplates.nameLt,
              templateCategory: serviceTemplates.category,
              templatePricingType: serviceTemplates.pricingType,
              templateBasePriceCents: serviceTemplates.basePriceCents,
              templateSetupFeeCents: serviceTemplates.setupFeeCents,
              templateIcon: serviceTemplates.icon,
            })
            .from(proposalServices)
            .leftJoin(
              serviceTemplates,
              eq(proposalServices.serviceTemplateId, serviceTemplates.id)
            )
            .where(eq(proposalServices.proposalId, proposalId))
            .orderBy(proposalServices.displayOrder);

          return Response.json({
            success: true,
            services: services.map((s) => ({
              id: s.id,
              proposalId: s.proposalId,
              serviceTemplateId: s.serviceTemplateId,
              customPriceCents: s.customPriceCents,
              customSetupCents: s.customSetupCents,
              quantity: s.quantity,
              isIncluded: s.isIncluded,
              displayOrder: s.displayOrder,
              createdAt: s.createdAt?.toISOString(),
              // Nested template for convenience
              template: s.serviceTemplateId
                ? {
                    name: s.templateName,
                    nameEn: s.templateNameEn,
                    nameLt: s.templateNameLt,
                    category: s.templateCategory,
                    pricingType: s.templatePricingType,
                    basePriceCents: s.templateBasePriceCents,
                    setupFeeCents: s.templateSetupFeeCents,
                    icon: s.templateIcon,
                  }
                : null,
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
            return Response.json({ success: false, error: err.message }, { status });
          }
          log.error(
            "Fetch proposal services failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },

      /**
       * PUT - Update proposal service selections.
       * Replaces all existing selections with the provided list.
       */
      PUT: async ({ request }: { request: Request }) => {
        try {
          const authContext = await requireApiAuth(request);
          log.debug("Updating proposal services", { userId: authContext.userId });

          // Extract proposal ID from URL
          const url = new URL(request.url);
          const pathParts = url.pathname.split("/");
          const proposalIdIndex = pathParts.findIndex((p) => p === "proposals") + 1;
          const proposalId = pathParts[proposalIdIndex];

          if (!proposalId) {
            return Response.json(
              { success: false, error: "Proposal ID required" },
              { status: 400 }
            );
          }

          // Verify proposal exists and belongs to workspace (T-58-08)
          const [proposal] = await db
            .select({ id: proposals.id, workspaceId: proposals.workspaceId })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Security check: proposal belongs to user's workspace (T-58-08)
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Forbidden" },
              { status: 403 }
            );
          }

          // Parse and validate body
          const body = await request.json();
          const parsed = updateServicesSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: "Validation failed", details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const { services: selections } = parsed.data;

          // Verify all service templates exist and are accessible (T-58-09)
          if (selections.length > 0) {
            const templateIds = selections.map((s) => s.serviceTemplateId);
            const templates = await db
              .select({ id: serviceTemplates.id, workspaceId: serviceTemplates.workspaceId })
              .from(serviceTemplates)
              .where(inArray(serviceTemplates.id, templateIds));

            // Check all templates exist
            const foundIds = new Set(templates.map((t) => t.id));
            const missingIds = templateIds.filter((id) => !foundIds.has(id));
            if (missingIds.length > 0) {
              return Response.json(
                { success: false, error: `Service templates not found: ${missingIds.join(", ")}` },
                { status: 400 }
              );
            }

            // Check all templates are accessible (system or same workspace)
            const inaccessible = templates.filter(
              (t) => t.workspaceId !== null && t.workspaceId !== authContext.organizationId
            );
            if (inaccessible.length > 0) {
              return Response.json(
                { success: false, error: "Access denied to some service templates" },
                { status: 403 }
              );
            }
          }

          // Transaction: delete existing and insert new
          await db.transaction(async (tx) => {
            // Delete existing selections
            await tx
              .delete(proposalServices)
              .where(eq(proposalServices.proposalId, proposalId));

            // Insert new selections
            if (selections.length > 0) {
              const toInsert: ProposalServiceInsert[] = selections.map((s, idx) => ({
                id: crypto.randomUUID(),
                proposalId,
                serviceTemplateId: s.serviceTemplateId,
                customPriceCents: s.customPriceCents ?? null,
                customSetupCents: s.customSetupCents ?? null,
                quantity: s.quantity,
                isIncluded: s.isIncluded,
                displayOrder: idx,
              }));

              await tx.insert(proposalServices).values(toInsert);
            }
          });

          log.info("Proposal services updated", {
            proposalId,
            serviceCount: selections.length,
          });

          // Fetch updated list
          const updated = await db
            .select()
            .from(proposalServices)
            .where(eq(proposalServices.proposalId, proposalId))
            .orderBy(proposalServices.displayOrder);

          return Response.json({
            success: true,
            services: updated.map((s) => ({
              id: s.id,
              proposalId: s.proposalId,
              serviceTemplateId: s.serviceTemplateId,
              customPriceCents: s.customPriceCents,
              customSetupCents: s.customSetupCents,
              quantity: s.quantity,
              isIncluded: s.isIncluded,
              displayOrder: s.displayOrder,
              createdAt: s.createdAt.toISOString(),
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
            return Response.json({ success: false, error: err.message }, { status });
          }
          log.error(
            "Update proposal services failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return Response.json(
            { success: false, error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
