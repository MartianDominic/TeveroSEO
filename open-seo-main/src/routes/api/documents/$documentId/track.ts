/**
 * Document Section Tracking API
 * Phase 101: Document Management (D-04)
 *
 * POST /api/documents/:documentId/track - Record section view events
 *
 * This endpoint is called from the public proposal view page.
 * No workspace auth required - viewId must be valid for the proposal.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SectionTrackingService } from "@/server/features/documents/services/SectionTrackingService";
import { DocumentRepository } from "@/server/features/documents/repositories/DocumentRepository";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-documents-track" });

const trackSchema = z.object({
  viewId: z.string().min(1, "View ID is required"),
  proposalId: z.string().min(1, "Proposal ID is required"),
  sections: z
    .array(
      z.object({
        sectionId: z.string().min(1),
        sectionName: z.string().min(1),
        timeSpentMs: z.number().int().min(0),
        scrollDepth: z.number().int().min(0).max(100).optional(),
        enteredAt: z.string().datetime(),
        exitedAt: z.string().datetime().optional(),
      })
    )
    .min(1, "At least one section required")
    .max(50, "Maximum 50 sections per request"), // T-101-09: Size limit
});

export const Route = createFileRoute("/api/documents/$documentId/track")({
  async POST({ request, params }) {
    const { documentId } = params;

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parseResult = trackSchema.safeParse(body);
    if (!parseResult.success) {
      return Response.json(
        {
          success: false,
          error: parseResult.error.errors[0]?.message ?? "Invalid request",
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Prepare section views with proposalId from input
    const sections = input.sections.map((s) => ({
      proposalId: input.proposalId,
      viewId: input.viewId,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      timeSpentMs: s.timeSpentMs,
      scrollDepth: s.scrollDepth,
      enteredAt: new Date(s.enteredAt),
      exitedAt: s.exitedAt ? new Date(s.exitedAt) : undefined,
    }));

    try {
      // Record in batch
      await SectionTrackingService.recordSectionViewsBatch(sections);

      log.debug("Recorded section tracking", {
        documentId,
        proposalId: input.proposalId,
        viewId: input.viewId,
        sectionCount: sections.length,
      });

      return Response.json({ success: true });
    } catch (error) {
      log.error("Failed to record section tracking", {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });

      return Response.json(
        { success: false, error: "Failed to record tracking data" },
        { status: 500 }
      );
    }
  },
});
