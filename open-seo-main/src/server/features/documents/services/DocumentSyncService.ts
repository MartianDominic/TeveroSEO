/**
 * Document Sync Service
 * Phase 101: Document Management (D-04)
 *
 * Manages document sync based on syncMode:
 * - two_way_sync: Changes reflect in both places
 * - import_copy: File copied to TeveroSEO, Drive link maintained
 * - link_only: Just store URL, file stays in Drive
 */
import { eq } from "drizzle-orm";
import { DocumentRepository } from "../repositories/DocumentRepository";
import { GoogleDriveService } from "./GoogleDriveService";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { db } from "@/db";
import {
  documentVersions,
  type DocumentSyncMode,
} from "@/db/document-schema";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

const log = createLogger({ module: "DocumentSyncService" });

const STORAGE_BASE = process.env.DOCUMENT_STORAGE_PATH ?? "/data/documents";

// ============================================================================
// Service Implementation
// ============================================================================

export const DocumentSyncService = {
  /**
   * Sync a document based on its syncMode.
   */
  async syncDocument(documentId: string, workspaceId: string): Promise<void> {
    const doc = await DocumentRepository.findById(documentId, workspaceId);
    if (!doc) {
      log.warn("Document not found for sync", { documentId });
      return;
    }

    if (!doc.driveFileId) {
      log.debug("Document has no Drive file ID, skipping sync", { documentId });
      return;
    }

    // Get Google OAuth tokens for workspace
    const connections = await platformConnectionService.getConnectionsForWorkspace(workspaceId);
    const googleConnection = connections.find((c) => c.platform === "google" && c.hasTokens);

    if (!googleConnection) {
      log.warn("No Google connection for workspace", { workspaceId });
      return;
    }

    const tokens = await platformConnectionService.getOAuthTokens(googleConnection.id);
    if (!tokens?.accessToken) {
      log.warn("No valid OAuth tokens for Google connection", { connectionId: googleConnection.id });
      return;
    }

    const drive = GoogleDriveService.createClient(tokens.accessToken, tokens.refreshToken);
    const driveFile = await GoogleDriveService.getFileMetadata(drive, doc.driveFileId);

    if (!driveFile) {
      log.warn("Drive file no longer exists", {
        documentId,
        driveFileId: doc.driveFileId,
      });
      return;
    }

    // Update metadata
    await DocumentRepository.update(documentId, workspaceId, {
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size ? parseInt(driveFile.size, 10) : undefined,
      lastSyncedAt: new Date(),
    });

    // For import_copy mode, download and store locally
    if (doc.syncMode === "import_copy") {
      await this.importCopy(documentId, workspaceId, drive, driveFile);
    }

    log.info("Document synced", { documentId, syncMode: doc.syncMode });
  },

  /**
   * Import a copy of the Drive file to local storage.
   */
  async importCopy(
    documentId: string,
    workspaceId: string,
    drive: ReturnType<typeof GoogleDriveService.createClient>,
    driveFile: { id: string; name: string; mimeType: string; size?: string }
  ): Promise<void> {
    // Download content
    let content: Buffer;
    const isGoogleDoc = driveFile.mimeType.startsWith(
      "application/vnd.google-apps."
    );

    if (isGoogleDoc) {
      // Export Google Docs as PDF
      content = await GoogleDriveService.exportAsPdf(drive, driveFile.id);
    } else {
      content = await GoogleDriveService.downloadFile(drive, driveFile.id);
    }

    // Get current version count
    const versions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId));
    const nextVersion = versions.length + 1;

    // Store locally
    const localPath = join(
      STORAGE_BASE,
      workspaceId,
      documentId,
      `v${nextVersion}`,
      driveFile.name
    );
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, content);

    // Create version record
    await db.insert(documentVersions).values({
      id: nanoid(),
      documentId,
      versionNumber: nextVersion,
      driveRevisionId: undefined, // Could fetch from revisions API
      sizeBytes: content.length,
      snapshotPath: localPath,
    });

    // Update document localPath
    await DocumentRepository.update(documentId, workspaceId, { localPath });

    log.info("Imported document copy", {
      documentId,
      version: nextVersion,
      path: localPath,
    });
  },

  /**
   * Link a Drive file as a new document (link_only mode by default).
   */
  async linkDriveFile(
    driveFileId: string,
    workspaceId: string,
    clientId: string | null,
    syncMode: DocumentSyncMode = "link_only",
    createdBy: string
  ): Promise<string> {
    // Check if already linked
    const existing = await DocumentRepository.findByDriveFileId(
      driveFileId,
      workspaceId
    );
    if (existing) {
      log.debug("Drive file already linked", {
        driveFileId,
        existingDocId: existing.id,
      });
      return existing.id;
    }

    // Get Google OAuth tokens for workspace
    const connections = await platformConnectionService.getConnectionsForWorkspace(workspaceId);
    const googleConnection = connections.find((c) => c.platform === "google" && c.hasTokens);

    if (!googleConnection) {
      throw new Error("No Google connection for workspace");
    }

    const tokens = await platformConnectionService.getOAuthTokens(googleConnection.id);
    if (!tokens?.accessToken) {
      throw new Error("No valid OAuth tokens for Google connection");
    }

    const drive = GoogleDriveService.createClient(tokens.accessToken, tokens.refreshToken);
    const driveFile = await GoogleDriveService.getFileMetadata(drive, driveFileId);

    if (!driveFile) {
      throw new Error(`Drive file not found: ${driveFileId}`);
    }

    // Create document record
    const doc = await DocumentRepository.create({
      workspaceId,
      clientId,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size ? parseInt(driveFile.size, 10) : undefined,
      driveFileId,
      driveFolderId: driveFile.parents?.[0],
      syncMode,
      externalUrl: driveFile.webViewLink,
      lastSyncedAt: new Date(),
      createdBy,
    });

    // For import_copy, download immediately
    if (syncMode === "import_copy") {
      await this.importCopy(doc.id, workspaceId, drive, driveFile);
    }

    log.info("Linked Drive file as document", {
      documentId: doc.id,
      driveFileId,
      syncMode,
    });
    return doc.id;
  },

  /**
   * Upload a local file to Drive and create document record.
   */
  async uploadToDrive(
    workspaceId: string,
    clientId: string | null,
    name: string,
    content: Buffer,
    mimeType: string,
    folderId: string | undefined,
    createdBy: string,
    syncMode: DocumentSyncMode = "two_way_sync"
  ): Promise<string> {
    // Get Google OAuth tokens for workspace
    const connections = await platformConnectionService.getConnectionsForWorkspace(workspaceId);
    const googleConnection = connections.find((c) => c.platform === "google" && c.hasTokens);

    if (!googleConnection) {
      throw new Error("No Google connection for workspace");
    }

    const tokens = await platformConnectionService.getOAuthTokens(googleConnection.id);
    if (!tokens?.accessToken) {
      throw new Error("No valid OAuth tokens for Google connection");
    }

    const drive = GoogleDriveService.createClient(tokens.accessToken, tokens.refreshToken);

    // Upload to Drive
    const driveFile = await GoogleDriveService.createFile(
      drive,
      name,
      content,
      mimeType,
      folderId
    );

    // Create document record
    const doc = await DocumentRepository.create({
      workspaceId,
      clientId,
      name: driveFile.name,
      mimeType: driveFile.mimeType,
      sizeBytes: driveFile.size ? parseInt(driveFile.size, 10) : undefined,
      driveFileId: driveFile.id,
      driveFolderId: folderId,
      syncMode,
      externalUrl: driveFile.webViewLink,
      lastSyncedAt: new Date(),
      createdBy,
    });

    log.info("Uploaded file to Drive", {
      documentId: doc.id,
      driveFileId: driveFile.id,
    });
    return doc.id;
  },

  /**
   * Change sync mode for a document.
   */
  async changeSyncMode(
    documentId: string,
    workspaceId: string,
    newSyncMode: DocumentSyncMode
  ): Promise<void> {
    const doc = await DocumentRepository.findById(documentId, workspaceId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    await DocumentRepository.update(documentId, workspaceId, {
      syncMode: newSyncMode,
    });

    // If changing to import_copy, trigger immediate sync
    if (newSyncMode === "import_copy" && doc.driveFileId) {
      await this.syncDocument(documentId, workspaceId);
    }

    log.info("Changed document sync mode", { documentId, newSyncMode });
  },
};
