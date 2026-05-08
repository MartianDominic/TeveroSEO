/**
 * Workspace Portal Settings Service Tests
 * Phase 96: CPR-005, CPR-007
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    query: {
      workspacePortalSettings: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
    }),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "test-id-12345",
}));

import { db } from "@/db";
import { WorkspacePortalSettingsService } from "./WorkspacePortalSettingsService";

describe("WorkspacePortalSettingsService", () => {
  let service: WorkspacePortalSettingsService;
  const mockWorkspaceId = "workspace-123";

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspacePortalSettingsService();
  });

  describe("getSettings", () => {
    it("should return existing settings if found", async () => {
      const existingSettings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 48,
        timezone: "America/New_York",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        existingSettings
      );

      const result = await service.getSettings(mockWorkspaceId);

      expect(result).toEqual(existingSettings);
      expect(db.query.workspacePortalSettings.findFirst).toHaveBeenCalledTimes(1);
    });

    it("should create default settings if none exist", async () => {
      const defaultSettings = {
        id: "test-id-12345",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 24,
        timezone: "UTC",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        undefined
      );

      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([defaultSettings]),
        }),
      });
      vi.mocked(db.insert).mockImplementation(insertMock);

      const result = await service.getSettings(mockWorkspaceId);

      expect(result).toEqual(defaultSettings);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("getPublicSettings", () => {
    it("should return only public fields", async () => {
      const fullSettings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 48,
        timezone: "Europe/London",
        portalTitle: "Client Portal",
        supportEmail: "support@agency.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        fullSettings
      );

      const result = await service.getPublicSettings(mockWorkspaceId);

      expect(result).toEqual({
        sessionTimeoutHours: 48,
        timezone: "Europe/London",
        portalTitle: "Client Portal",
        supportEmail: "support@agency.com",
      });
      // Should not include internal fields
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("workspaceId");
      expect(result).not.toHaveProperty("createdAt");
    });
  });

  describe("updateSettings", () => {
    it("should validate session timeout range (1-72 hours)", async () => {
      // Test too low
      await expect(
        service.updateSettings(mockWorkspaceId, { sessionTimeoutHours: 0 })
      ).rejects.toThrow("Invalid session timeout");

      // Test too high
      await expect(
        service.updateSettings(mockWorkspaceId, { sessionTimeoutHours: 100 })
      ).rejects.toThrow("Invalid session timeout");

      // Test non-integer
      await expect(
        service.updateSettings(mockWorkspaceId, { sessionTimeoutHours: 12.5 })
      ).rejects.toThrow("Invalid session timeout");
    });

    it("should validate timezone is valid IANA identifier", async () => {
      await expect(
        service.updateSettings(mockWorkspaceId, { timezone: "Invalid/Timezone" })
      ).rejects.toThrow("Invalid timezone");

      await expect(
        service.updateSettings(mockWorkspaceId, { timezone: "not-a-timezone" })
      ).rejects.toThrow("Invalid timezone");
    });

    it("should accept valid session timeout values", async () => {
      const existingSettings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 24,
        timezone: "UTC",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        existingSettings
      );

      const updatedSettings = { ...existingSettings, sessionTimeoutHours: 48 };
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSettings]),
          }),
        }),
      });
      vi.mocked(db.update).mockImplementation(updateMock);

      const result = await service.updateSettings(mockWorkspaceId, {
        sessionTimeoutHours: 48,
      });

      expect(result.sessionTimeoutHours).toBe(48);
    });

    it("should accept valid timezone values", async () => {
      const existingSettings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 24,
        timezone: "UTC",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        existingSettings
      );

      const updatedSettings = { ...existingSettings, timezone: "America/New_York" };
      const updateMock = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSettings]),
          }),
        }),
      });
      vi.mocked(db.update).mockImplementation(updateMock);

      const result = await service.updateSettings(mockWorkspaceId, {
        timezone: "America/New_York",
      });

      expect(result.timezone).toBe("America/New_York");
    });
  });

  describe("getSessionTimeoutMs", () => {
    it("should convert hours to milliseconds", async () => {
      const settings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 24,
        timezone: "UTC",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        settings
      );

      const result = await service.getSessionTimeoutMs(mockWorkspaceId);

      // 24 hours * 60 minutes * 60 seconds * 1000 milliseconds
      expect(result).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("getSessionExpiryDate", () => {
    it("should return date in the future based on timeout", async () => {
      const settings = {
        id: "settings-1",
        workspaceId: mockWorkspaceId,
        sessionTimeoutHours: 48,
        timezone: "UTC",
        portalTitle: null,
        supportEmail: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.query.workspacePortalSettings.findFirst).mockResolvedValue(
        settings
      );

      const before = Date.now();
      const result = await service.getSessionExpiryDate(mockWorkspaceId);
      const after = Date.now();

      // Should be approximately 48 hours in the future
      const expectedMs = 48 * 60 * 60 * 1000;
      expect(result.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000);
    });
  });
});
