/**
 * Documents API Routes
 * Phase 101: Document Management (D-04)
 *
 * GET /api/documents - List documents by client, proposal, or workspace
 * POST /api/documents - Link a Google Drive file as a new document
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DocumentRepository } from "@/server/features/documents/repositories/DocumentRepository";
import { DocumentSyncService } from "@/server/features/documents/services/DocumentSyncService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import type { DocumentSyncMode } from "@/db/document-schema";

const log = createLogger({ module: "api-documents" });

const listQuerySchema = z.object({
  clientId: z.string().optional(),
  proposalId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const linkDriveSchema = z.object({
  driveFileId: z.string().min(1, "Drive file ID is required"),
  clientId: z.string().nullable().optional(),
  syncMode: z
    .enum(["two_way_sync", "import_copy", "link_only"])
    .optional()
    .default("link_only"),
});

export const Route = createFileRoute("/api/documents/")({
  async GET({ request }) {
    // Authenticate
    const authContext = await requireApiAuth(request);
    const workspaceId = authContext.organizationId;

    // Parse query params
    const url = new URL(request.url);
    const query = listQuerySchema.parse({
      clientId: url.searchParams.get("clientId") ?? undefined,
      proposalId: url.searchParams.get("proposalId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });

    let documents;
    if (query.clientId) {
      documents = await DocumentRepository.findByClient(
        query.clientId,
        workspaceId
      );
    } else if (query.proposalId) {
      documents = await DocumentRepository.findByProposal(
        query.proposalId,
        workspaceId
      );
    } else {
      documents = await DocumentRepository.findByWorkspace(workspaceId, {
        limit: query.limit,
        offset: query.offset,
      });
    }

    log.debug("Listed documents", {
      workspaceId,
      count: documents.length,
      clientId: query.clientId,
      proposalId: query.proposalId,
    });

    return Response.json({ success: true, data: documents });
  },

  async POST({ request }) {
    // Authenticate
    const authContext = await requireApiAuth(request);
    const workspaceId = authContext.organizationId;
    const userId = authContext.userId;

    // Parse body
    const body = await request.json();
    const input = linkDriveSchema.parse(body);

    try {
      const documentId = await DocumentSyncService.linkDriveFile(
        input.driveFileId,
        workspaceId,
        input.clientId ?? null,
        input.syncMode as DocumentSyncMode,
        userId
      );

      const document = await DocumentRepository.findById(documentId, workspaceId);

      log.info("Linked Drive file as document", {
        documentId,
        driveFileId: input.driveFileId,
        workspaceId,
        userId,
      });

      return Response.json({ success: true, data: document }, { status: 201 });
    } catch (error) {
      log.error("Failed to link Drive file", {
        error: error instanceof Error ? error.message : String(error),
        driveFileId: input.driveFileId,
        workspaceId,
      });

      return Response.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to link Drive file",
        },
        { status: 400 }
      );
    }
  },
});
