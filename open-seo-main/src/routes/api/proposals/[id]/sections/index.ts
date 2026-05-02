/**
 * POST /api/proposals/:id/sections - Add section to proposal.
 * Phase 57-05: Custom Sections API
 */

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { templateSections } from "@/db/proposal-template-schema";
import { proposals } from "@/db/proposal-schema";
import { eq, max } from "drizzle-orm";

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

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/proposals/id/sections/")({
  server: {
    handlers: {
      /**
       * POST - Add a new section to a proposal template.
       */
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          const proposalId = params.id;

          // Verify proposal exists
          const [proposal] = await db
            .select({ id: proposals.id, template: proposals.template })
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
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
          console.error("Error creating section:", error);
          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
