/**
 * Single Document API Routes
 * Phase 101: Document Management (D-04)
 *
 * GET /api/documents/:documentId - Get document with heatmap data
 * PATCH /api/documents/:documentId - Update document fields
 * DELETE /api/documents/:documentId - Soft delete document
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DocumentRepository } from "@/server/features/documents/repositories/DocumentRepository";
import { DocumentSyncService } from "@/server/features/documents/services/DocumentSyncService";
import { SectionTrackingService } from "@/server/features/documents/services/SectionTrackingService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import type { DocumentSyncMode } from "@/db/document-schema";

const log = createLogger({ module: "api-documents-single" });

const updateSchema = z.object({
  name: z.string().optional(),
  clientId: z.string().nullable().optional(),
  syncMode: z.enum(["two_way_sync", "import_copy", "link_only"]).optional(),
});

export const Route = createFileRoute("/api/documents/$documentId/")({
  async GET({ request, params }) {
    // Authenticate
    const authContext = await requireApiAuth(request);
    const workspaceId = authContext.organizationId;
    const { documentId } = params;

    const document = await DocumentRepository.findById(documentId, workspaceId);
    if (!document) {
      return Response.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Get heatmap data if this document is linked to a proposal
    let heatmapData = null;
    if (document.proposalId) {
      heatmapData = await SectionTrackingService.getHeatmapData(
        document.proposalId
      );
    }

    log.debug("Retrieved document", { documentId, workspaceId });

    return Response.json({
      success: true,
      data: { ...document, heatmapData },
    });
  },

  async PATCH({ request, params }) {
    // Authenticate
    const authContext = await requireApiAuth(request);
    const workspaceId = authContext.organizationId;
    const { documentId } = params;

    // Parse body
    const body = await request.json();
    const input = updateSchema.parse(body);

    const document = await DocumentRepository.update(
      documentId,
      workspaceId,
      input
    );
    if (!document) {
      return Response.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // If syncMode changed to import_copy, trigger sync
    if (input.syncMode === "import_copy") {
      try {
        await DocumentSyncService.syncDocument(documentId, workspaceId);
      } catch (error) {
        log.warn("Sync failed after mode change", {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    log.info("Updated document", { documentId, workspaceId, changes: input });

    return Response.json({ success: true, data: document });
  },

  async DELETE({ request, params }) {
    // Authenticate
    const authContext = await requireApiAuth(request);
    const workspaceId = authContext.organizationId;
    const userId = authContext.userId;
    const { documentId } = params;

    await DocumentRepository.softDelete(documentId, workspaceId, userId);

    log.info("Soft deleted document", { documentId, workspaceId, userId });

    return Response.json({ success: true });
  },
});
