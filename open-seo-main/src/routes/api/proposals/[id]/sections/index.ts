/**
 * POST /api/proposals/:id/sections - Add section to proposal.
 * Phase 57-05: Custom Sections API
 *
 * SECURITY: Requires authentication and workspace ownership verification.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { templateSections } from "@/db/proposal-template-schema";
import { proposals } from "@/db/proposal-schema";
import { eq, max } from "drizzle-orm";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-sections" });

/**
 * Custom section types for proposals.
 */
const CUSTOM_SECTION_TYPES = [
  "text",
  "image",
  "testimonial",
  "case_study",
  "video",
  "comparison",
  "timeline",
  "custom",
] as const;

/**
 * Request body schema for creating a section.
 */
const createSectionSchema = z.object({
  type: z.enum(CUSTOM_SECTION_TYPES as unknown as readonly [string, ...string[]]),
  title: z.string().min(1).max(200),
  titleEn: z.string().optional(),
  titleLt: z.string().optional(),
  content: z.string().optional(),
  contentEn: z.string().optional(),
  contentLt: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/proposals/$id/sections")({
  server: {
    handlers: {
      /**
       * POST - Add a new section to a proposal template.
       * Requires authentication and workspace ownership.
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Authenticate request
          const authContext = await requireApiAuth(request);
          const proposalId = params.id;

          // Verify proposal exists and get workspace
          const [proposal] = await db
            .select({ id: proposals.id, template: proposals.template, workspaceId: proposals.workspaceId })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Verify workspace ownership
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Forbidden" },
              { status: 403 }
            );
          }

          // Parse and validate body
          const body = await request.json();
          const parsed = createSectionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Validation failed",
                details: parsed.error.flatten(),
              },
              { status: 400 }
            );
          }

          const { type, title, titleEn, titleLt, content, contentEn, contentLt, data, position } =
            parsed.data;

          // Get max position if not provided
          let sectionPosition = position;
          if (sectionPosition === undefined) {
            const [maxPos] = await db
              .select({ maxPosition: max(templateSections.position) })
              .from(templateSections)
              .where(eq(templateSections.templateId, proposalId));

            sectionPosition = (maxPos?.maxPosition ?? -1) + 1;
          }

          // Generate section ID
          const sectionId = `sec_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

          // Create section
          const [newSection] = await db
            .insert(templateSections)
            .values({
              id: sectionId,
              templateId: proposalId,
              key: `${type}_${sectionPosition}`,
              title,
              titleEn,
              titleLt,
              content: data ? JSON.stringify(data) : content,
              contentEn,
              contentLt,
              sectionType: type === "text" ? "custom" : type,
              isRequired: false,
              isEditable: true,
              position: sectionPosition,
            })
            .returning();

          return Response.json({
            success: true,
            data: {
              id: newSection.id,
              key: newSection.key,
              title: newSection.title,
              sectionType: type,
              position: newSection.position,
              content: newSection.content,
              createdAt: newSection.createdAt,
            },
          });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ success: false, error: error.message }, { status });
          }
          log.error("Error creating section", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
