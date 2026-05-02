/**
 * PUT/DELETE /api/proposals/:id/sections/:sid - Update/delete section.
 * Phase 57-05: Custom Sections API
 */

import { createAPIFileRoute } from "@tanstack/start/api";
import { json } from "@tanstack/start";
import { z } from "zod";
import { db } from "~/db";
import { templateSections } from "~/db/proposal-template-schema";
import { proposals } from "~/db/proposal-schema";
import { eq, and } from "drizzle-orm";

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
  data: z.record(z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
  sectionType: z.enum(CUSTOM_SECTION_TYPES).optional(),
});

export const APIRoute = createAPIFileRoute(
  "/api/proposals/$id/sections/$sid"
)({
  /**
   * PUT - Update a section.
   */
  PUT: async ({ request, params }) => {
    try {
      const { id: proposalId, sid: sectionId } = params;

      // Verify proposal exists
      const [proposal] = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(eq(proposals.id, proposalId))
        .limit(1);

      if (!proposal) {
        return json(
          { success: false, error: "Proposal not found" },
          { status: 404 }
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
        return json(
          { success: false, error: "Section not found" },
          { status: 404 }
        );
      }

      // Parse and validate body
      const body = await request.json();
      const parsed = updateSectionSchema.safeParse(body);

      if (!parsed.success) {
        return json(
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

      return json({
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
      console.error("Error updating section:", error);
      return json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  },

  /**
   * DELETE - Delete a section.
   */
  DELETE: async ({ params }) => {
    try {
      const { id: proposalId, sid: sectionId } = params;

      // Verify proposal exists
      const [proposal] = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(eq(proposals.id, proposalId))
        .limit(1);

      if (!proposal) {
        return json(
          { success: false, error: "Proposal not found" },
          { status: 404 }
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
        return json(
          { success: false, error: "Section not found" },
          { status: 404 }
        );
      }

      if (existingSection.isRequired) {
        return json(
          { success: false, error: "Cannot delete required section" },
          { status: 400 }
        );
      }

      // Delete section
      await db
        .delete(templateSections)
        .where(eq(templateSections.id, sectionId));

      return json({
        success: true,
        data: { id: sectionId, deleted: true },
      });
    } catch (error) {
      console.error("Error deleting section:", error);
      return json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  },
});
