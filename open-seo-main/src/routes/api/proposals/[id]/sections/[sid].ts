/**
 * PUT/DELETE /api/proposals/:id/sections/:sid - Update/delete section.
 * Phase 57-05: Custom Sections API
 *
 * SECURITY: Requires authentication and workspace ownership verification.
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { templateSections } from "@/db/proposal-template-schema";
import { proposals } from "@/db/proposal-schema";
import { eq, and } from "drizzle-orm";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-sections-sid" });

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
 * Request body schema for updating a section.
 */
const updateSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleEn: z.string().optional(),
  titleLt: z.string().optional(),
  content: z.string().optional(),
  contentEn: z.string().optional(),
  contentLt: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
  sectionType: z.enum(CUSTOM_SECTION_TYPES as unknown as readonly [string, ...string[]]).optional(),
});

export const Route = createFileRoute("/api/proposals/id/sections/sid")({
  server: {
    handlers: {
      /**
       * PUT - Update a section.
       * Requires authentication and workspace ownership.
       */
      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string; sid: string };
      }) => {
        try {
          // Authenticate request
          const authContext = await requireApiAuth(request);
          const { id: proposalId, sid: sectionId } = params;

          // Verify proposal exists and get workspace
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

          // Verify workspace ownership
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Forbidden" },
              { status: 403 }
            );
          }

          // Verify section exists
          const [existingSection] = await db
            .select()
            .from(templateSections)
            .where(
              and(
                eq(templateSections.id, sectionId),
                eq(templateSections.templateId, proposalId)
              )
            )
            .limit(1);

          if (!existingSection) {
            return Response.json(
              { success: false, error: "Section not found" },
              { status: 404 }
            );
          }

          // Parse and validate body
          const body = await request.json();
          const parsed = updateSectionSchema.safeParse(body);

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

          const updates = parsed.data;

          // Build update object
          const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
          };

          if (updates.title !== undefined) updateData.title = updates.title;
          if (updates.titleEn !== undefined) updateData.titleEn = updates.titleEn;
          if (updates.titleLt !== undefined) updateData.titleLt = updates.titleLt;
          if (updates.content !== undefined) updateData.content = updates.content;
          if (updates.contentEn !== undefined) updateData.contentEn = updates.contentEn;
          if (updates.contentLt !== undefined) updateData.contentLt = updates.contentLt;
          if (updates.data !== undefined) updateData.content = JSON.stringify(updates.data);
          if (updates.position !== undefined) updateData.position = updates.position;
          if (updates.sectionType !== undefined) {
            updateData.sectionType = updates.sectionType === "text" ? "custom" : updates.sectionType;
          }

          // Update section
          const [updatedSection] = await db
            .update(templateSections)
            .set(updateData)
            .where(eq(templateSections.id, sectionId))
            .returning();

          return Response.json({
            success: true,
            data: {
              id: updatedSection.id,
              key: updatedSection.key,
              title: updatedSection.title,
              sectionType: updatedSection.sectionType,
              position: updatedSection.position,
              content: updatedSection.content,
              updatedAt: updatedSection.updatedAt,
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
          log.error("Error updating section", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            { status: 500 }
          );
        }
      },

      /**
       * DELETE - Delete a section.
       * Requires authentication and workspace ownership.
       */
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string; sid: string };
      }) => {
        try {
          // Authenticate request
          const authContext = await requireApiAuth(request);
          const { id: proposalId, sid: sectionId } = params;

          // Verify proposal exists and get workspace
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

          // Verify workspace ownership
          if (proposal.workspaceId !== authContext.organizationId) {
            return Response.json(
              { success: false, error: "Forbidden" },
              { status: 403 }
            );
          }

          // Verify section exists and is not required
          const [existingSection] = await db
            .select({ id: templateSections.id, isRequired: templateSections.isRequired })
            .from(templateSections)
            .where(
              and(
                eq(templateSections.id, sectionId),
                eq(templateSections.templateId, proposalId)
              )
            )
            .limit(1);

          if (!existingSection) {
            return Response.json(
              { success: false, error: "Section not found" },
              { status: 404 }
            );
          }

          if (existingSection.isRequired) {
            return Response.json(
              { success: false, error: "Cannot delete required section" },
              { status: 400 }
            );
          }

          // Delete section
          await db
            .delete(templateSections)
            .where(eq(templateSections.id, sectionId));

          return Response.json({
            success: true,
            data: { id: sectionId, deleted: true },
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
          log.error("Error deleting section", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
