/**
 * Google Drive Service
 * Phase 101: Document Management (D-04)
 *
 * Provides Google Drive file operations using googleapis.
 * Uses OAuth2 tokens from PlatformConnectionService.
 */
import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "GoogleDriveService" });

// ============================================================================
// Types
// ============================================================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
  size?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

export const GoogleDriveService = {
  /**
   * Create authenticated Drive client from OAuth tokens.
   */
  createClient(accessToken: string, refreshToken?: string): drive_v3.Drive {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return google.drive({ version: "v3", auth: oauth2Client });
  },

  /**
   * List files in a folder (or root if no folderId).
   */
  async listFiles(
    drive: drive_v3.Drive,
    folderId?: string
  ): Promise<DriveFile[]> {
    const query = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false";

    const response = await drive.files.list({
      q: query,
      fields:
        "files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents)",
      pageSize: 100,
    });

    log.debug("Listed Drive files", {
      count: response.data.files?.length ?? 0,
      folderId,
    });
    return (response.data.files ?? []) as DriveFile[];
  },

  /**
   * Get file metadata.
   */
  async getFileMetadata(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<DriveFile | null> {
    try {
      const response = await drive.files.get({
        fileId,
        fields:
          "id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents",
      });
      return response.data as DriveFile;
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err.code === 404) {
        log.warn("Drive file not found", { fileId });
        return null;
      }
      throw error;
    }
  },

  /**
   * Download file content (for import_copy mode).
   */
  async downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(response.data as ArrayBuffer);
  },

  /**
   * Export Google Docs/Sheets/Slides to PDF.
   */
  async exportAsPdf(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
    const response = await drive.files.export(
      { fileId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(response.data as ArrayBuffer);
  },

  /**
   * Create a new file in Drive.
   */
  async createFile(
    drive: drive_v3.Drive,
    name: string,
    content: Buffer,
    mimeType: string,
    folderId?: string
  ): Promise<DriveFile> {
    const { Readable } = await import("stream");
    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType,
      parents: folderId ? [folderId] : undefined,
    };

    const media = {
      mimeType,
      body: Readable.from(content),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, mimeType, size, webViewLink",
    });

    log.info("Created Drive file", { fileId: response.data.id, name });
    return response.data as DriveFile;
  },

  /**
   * Update file content (for two_way_sync).
   */
  async updateFile(
    drive: drive_v3.Drive,
    fileId: string,
    content: Buffer,
    mimeType: string
  ): Promise<DriveFile> {
    const { Readable } = await import("stream");
    const media = {
      mimeType,
      body: Readable.from(content),
    };

    const response = await drive.files.update({
      fileId,
      media,
      fields: "id, name, mimeType, size, webViewLink, modifiedTime",
    });

    log.info("Updated Drive file", { fileId });
    return response.data as DriveFile;
  },

  /**
   * Get file revision history.
   */
  async getRevisions(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<DriveRevision[]> {
    const response = await drive.revisions.list({
      fileId,
      fields: "revisions(id, modifiedTime, size)",
    });
    return (response.data.revisions ?? []) as DriveRevision[];
  },

  /**
   * Create or get client folder in Drive.
   */
  async ensureClientFolder(
    drive: drive_v3.Drive,
    clientName: string,
    parentFolderId?: string
  ): Promise<string> {
    // Search for existing folder
    const query = parentFolderId
      ? `name = '${clientName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`
      : `name = '${clientName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const existing = await drive.files.list({ q: query, fields: "files(id)" });
    if (existing.data.files?.length) {
      return existing.data.files[0].id!;
    }

    // Create new folder
    const folder = await drive.files.create({
      requestBody: {
        name: clientName,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      fields: "id",
    });

    log.info("Created client folder in Drive", {
      clientName,
      folderId: folder.data.id,
    });
    return folder.data.id!;
  },

  /**
   * Delete a file from Drive.
   */
  async deleteFile(drive: drive_v3.Drive, fileId: string): Promise<void> {
    await drive.files.delete({ fileId });
    log.info("Deleted Drive file", { fileId });
  },

  /**
   * Move file to a different folder.
   */
  async moveFile(
    drive: drive_v3.Drive,
    fileId: string,
    newFolderId: string
  ): Promise<DriveFile> {
    // Get current parents
    const file = await drive.files.get({
      fileId,
      fields: "parents",
    });

    const previousParents = (file.data.parents ?? []).join(",");

    const response = await drive.files.update({
      fileId,
      addParents: newFolderId,
      removeParents: previousParents,
      fields: "id, name, mimeType, size, webViewLink, parents",
    });

    log.info("Moved Drive file", { fileId, newFolderId });
    return response.data as DriveFile;
  },
};
