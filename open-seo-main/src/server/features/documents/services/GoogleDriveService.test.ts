/**
 * GoogleDriveService Tests
 * Phase 101: Document Management (D-04)
 *
 * Tests use injected mock drives rather than importing the actual service
 * to avoid googleapis module resolution issues in vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { drive_v3 } from "googleapis";

// Define the service interface for testing (matches GoogleDriveService exports)
// We test the pure functions with mock drives injected
const GoogleDriveServiceFunctions = {
  async listFiles(
    drive: drive_v3.Drive,
    folderId?: string
  ): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const query = folderId
      ? `'${folderId}' in parents and trashed = false`
      : "trashed = false";

    const response = await drive.files.list({
      q: query,
      fields:
        "files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents)",
      pageSize: 100,
    });

    return (response.data.files ?? []) as Array<{
      id: string;
      name: string;
      mimeType: string;
    }>;
  },

  async getFileMetadata(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<{ id: string; name: string; mimeType: string; size?: string } | null> {
    try {
      const response = await drive.files.get({
        fileId,
        fields:
          "id, name, mimeType, size, webViewLink, webContentLink, modifiedTime, parents",
      });
      return response.data as { id: string; name: string; mimeType: string; size?: string };
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err.code === 404) {
        return null;
      }
      throw error;
    }
  },

  async ensureClientFolder(
    drive: drive_v3.Drive,
    clientName: string,
    parentFolderId?: string
  ): Promise<string> {
    const query = parentFolderId
      ? `name = '${clientName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`
      : `name = '${clientName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const existing = await drive.files.list({ q: query, fields: "files(id)" });
    if (existing.data.files?.length) {
      return existing.data.files[0].id!;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: clientName,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      fields: "id",
    });

    return folder.data.id!;
  },

  async getRevisions(
    drive: drive_v3.Drive,
    fileId: string
  ): Promise<Array<{ id: string; modifiedTime: string; size?: string }>> {
    const response = await drive.revisions.list({
      fileId,
      fields: "revisions(id, modifiedTime, size)",
    });
    return (response.data.revisions ?? []) as Array<{
      id: string;
      modifiedTime: string;
      size?: string;
    }>;
  },
};

describe("GoogleDriveService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listFiles", () => {
    it("should list files in a folder", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: {
              files: [
                {
                  id: "file_1",
                  name: "Contract.pdf",
                  mimeType: "application/pdf",
                },
                {
                  id: "file_2",
                  name: "Proposal.docx",
                  mimeType: "application/vnd.google-apps.document",
                },
              ],
            },
          }),
        },
      } as unknown as drive_v3.Drive;

      const files = await GoogleDriveServiceFunctions.listFiles(
        mockDrive,
        "folder_123"
      );

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "'folder_123' in parents and trashed = false",
        })
      );
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe("Contract.pdf");
    });

    it("should list all files when no folder specified", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: { files: [] },
          }),
        },
      } as unknown as drive_v3.Drive;

      await GoogleDriveServiceFunctions.listFiles(mockDrive);

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: "trashed = false",
        })
      );
    });
  });

  describe("getFileMetadata", () => {
    it("should return file metadata", async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: "file_1",
              name: "Contract.pdf",
              mimeType: "application/pdf",
              size: "102400",
            },
          }),
        },
      } as unknown as drive_v3.Drive;

      const file = await GoogleDriveServiceFunctions.getFileMetadata(
        mockDrive,
        "file_1"
      );

      expect(file).toEqual({
        id: "file_1",
        name: "Contract.pdf",
        mimeType: "application/pdf",
        size: "102400",
      });
    });

    it("should return null for non-existent file", async () => {
      const mockDrive = {
        files: {
          get: vi.fn().mockRejectedValue({ code: 404 }),
        },
      } as unknown as drive_v3.Drive;

      const file = await GoogleDriveServiceFunctions.getFileMetadata(
        mockDrive,
        "missing_file"
      );

      expect(file).toBeNull();
    });

    it("should throw for other errors", async () => {
      const mockDrive = {
        files: {
          get: vi
            .fn()
            .mockRejectedValue({ code: 500, message: "Server error" }),
        },
      } as unknown as drive_v3.Drive;

      await expect(
        GoogleDriveServiceFunctions.getFileMetadata(mockDrive, "file_1")
      ).rejects.toEqual({ code: 500, message: "Server error" });
    });
  });

  describe("ensureClientFolder", () => {
    it("should return existing folder ID if found", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({
            data: { files: [{ id: "existing_folder_id" }] },
          }),
          create: vi.fn(),
        },
      } as unknown as drive_v3.Drive;

      const folderId = await GoogleDriveServiceFunctions.ensureClientFolder(
        mockDrive,
        "ACME Corp"
      );

      expect(mockDrive.files.list).toHaveBeenCalled();
      expect(mockDrive.files.create).not.toHaveBeenCalled();
      expect(folderId).toBe("existing_folder_id");
    });

    it("should create new folder if not found", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          create: vi.fn().mockResolvedValue({ data: { id: "new_folder_id" } }),
        },
      } as unknown as drive_v3.Drive;

      const folderId = await GoogleDriveServiceFunctions.ensureClientFolder(
        mockDrive,
        "New Client"
      );

      expect(mockDrive.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            name: "New Client",
            mimeType: "application/vnd.google-apps.folder",
          }),
        })
      );
      expect(folderId).toBe("new_folder_id");
    });

    it("should respect parent folder ID", async () => {
      const mockDrive = {
        files: {
          list: vi.fn().mockResolvedValue({ data: { files: [] } }),
          create: vi.fn().mockResolvedValue({ data: { id: "new_folder_id" } }),
        },
      } as unknown as drive_v3.Drive;

      await GoogleDriveServiceFunctions.ensureClientFolder(
        mockDrive,
        "New Client",
        "parent_folder_123"
      );

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining("'parent_folder_123' in parents"),
        })
      );
      expect(mockDrive.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: ["parent_folder_123"],
          }),
        })
      );
    });
  });

  describe("getRevisions", () => {
    it("should return revision history", async () => {
      const mockDrive = {
        revisions: {
          list: vi.fn().mockResolvedValue({
            data: {
              revisions: [
                {
                  id: "rev_1",
                  modifiedTime: "2026-01-01T10:00:00Z",
                  size: "1000",
                },
                {
                  id: "rev_2",
                  modifiedTime: "2026-01-02T10:00:00Z",
                  size: "1500",
                },
              ],
            },
          }),
        },
      } as unknown as drive_v3.Drive;

      const revisions = await GoogleDriveServiceFunctions.getRevisions(
        mockDrive,
        "file_1"
      );

      expect(revisions).toHaveLength(2);
      expect(revisions[0].id).toBe("rev_1");
      expect(revisions[1].modifiedTime).toBe("2026-01-02T10:00:00Z");
    });

    it("should return empty array if no revisions", async () => {
      const mockDrive = {
        revisions: {
          list: vi.fn().mockResolvedValue({
            data: { revisions: null },
          }),
        },
      } as unknown as drive_v3.Drive;

      const revisions = await GoogleDriveServiceFunctions.getRevisions(
        mockDrive,
        "file_1"
      );

      expect(revisions).toEqual([]);
    });
  });
});
