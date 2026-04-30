/**
 * MagicLinkService tests
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Tests magic link generation, validation, and usage tracking.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateMagicLink,
  validateMagicLink,
  markMagicLinkUsed,
} from "./MagicLinkService";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-nanoid-32-chars-long-token-x"),
}));

import { db } from "@/db";

const mockInsert = vi.mocked(db.insert);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);

describe("MagicLinkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateMagicLink", () => {
    it("creates token with 24h expiry from now", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "mock-nanoid-32-chars-long-token-x",
        expiresAt: new Date("2026-05-01T12:00:00Z"),
        usedAt: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      mockInsert.mockReturnValue({ values: mockValues } as any);
      mockValues.mockReturnValue({ returning: mockReturning } as any);

      const result = await generateMagicLink("ws-1", "client-1", "cl-1", "item-1");

      // Check that expiry is 24 hours from now
      expect(result.expiresAt.getTime()).toBe(new Date("2026-05-01T12:00:00Z").getTime());
    });

    it("stores workspaceId, clientId, checklistId, itemId in magic_links table", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "mock-nanoid-32-chars-long-token-x",
        expiresAt: new Date("2026-05-01T12:00:00Z"),
        usedAt: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      mockInsert.mockReturnValue({ values: mockValues } as any);
      mockValues.mockReturnValue({ returning: mockReturning } as any);

      await generateMagicLink("ws-1", "client-1", "cl-1", "item-1");

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
      }));
    });

    it("returns url with /connect/{token} format", async () => {
      const mockValues = vi.fn().mockReturnThis();
      const mockReturning = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "mock-nanoid-32-chars-long-token-x",
        expiresAt: new Date("2026-05-01T12:00:00Z"),
        usedAt: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      mockInsert.mockReturnValue({ values: mockValues } as any);
      mockValues.mockReturnValue({ returning: mockReturning } as any);

      const result = await generateMagicLink("ws-1", "client-1", "cl-1", "item-1");

      expect(result.url).toBe("/connect/mock-nanoid-32-chars-long-token-x");
    });
  });

  describe("validateMagicLink", () => {
    it("returns valid=true for unexpired, unused token", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "valid-token",
        expiresAt: new Date("2026-05-01T12:00:00Z"), // Future
        usedAt: null, // Unused
        createdAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      const mockWorkspaceFrom = vi.fn().mockReturnThis();
      const mockWorkspaceWhere = vi.fn().mockReturnThis();
      const mockWorkspaceLimit = vi.fn().mockResolvedValue([{
        id: "ws-1",
        name: "Test Agency",
        slug: "test-agency",
        logo: "https://example.com/logo.png",
        createdAt: new Date(),
        metadata: null,
        isArchived: false,
        archivedAt: null,
      }]);

      mockSelect.mockReturnValueOnce({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere } as any);
      mockWhere.mockReturnValue({ limit: mockLimit } as any);

      mockSelect.mockReturnValueOnce({ from: mockWorkspaceFrom } as any);
      mockWorkspaceFrom.mockReturnValue({ where: mockWorkspaceWhere } as any);
      mockWorkspaceWhere.mockReturnValue({ limit: mockWorkspaceLimit } as any);

      const result = await validateMagicLink("valid-token");

      expect(result.valid).toBe(true);
      expect(result.workspaceId).toBe("ws-1");
      expect(result.clientId).toBe("client-1");
      expect(result.checklistId).toBe("cl-1");
      expect(result.itemId).toBe("item-1");
    });

    it("returns valid=false for expired token", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "expired-token",
        expiresAt: new Date("2026-04-29T12:00:00Z"), // Past
        usedAt: null,
        createdAt: new Date("2026-04-28T12:00:00Z"),
      }]);

      mockSelect.mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere } as any);
      mockWhere.mockReturnValue({ limit: mockLimit } as any);

      const result = await validateMagicLink("expired-token");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });

    it("returns valid=false for already-used token (usedAt not null)", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "used-token",
        expiresAt: new Date("2026-05-01T12:00:00Z"), // Future
        usedAt: new Date("2026-04-30T10:00:00Z"), // Already used
        createdAt: new Date("2026-04-30T09:00:00Z"),
      }]);

      mockSelect.mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere } as any);
      mockWhere.mockReturnValue({ limit: mockLimit } as any);

      const result = await validateMagicLink("used-token");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("used");
    });

    it("returns valid=false for non-existent token", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      mockSelect.mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere } as any);
      mockWhere.mockReturnValue({ limit: mockLimit } as any);

      const result = await validateMagicLink("non-existent-token");

      expect(result.valid).toBe(false);
      expect(result.reason).toBe("not_found");
    });

    it("returns workspace branding (name, logoUrl, primaryColor)", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([{
        id: "ml-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        checklistId: "cl-1",
        itemId: "item-1",
        token: "valid-token",
        expiresAt: new Date("2026-05-01T12:00:00Z"),
        usedAt: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      const mockWorkspaceFrom = vi.fn().mockReturnThis();
      const mockWorkspaceWhere = vi.fn().mockReturnThis();
      const mockWorkspaceLimit = vi.fn().mockResolvedValue([{
        id: "ws-1",
        name: "Acme Agency",
        slug: "acme-agency",
        logo: "https://acme.com/logo.png",
        createdAt: new Date(),
        metadata: null,
        isArchived: false,
        archivedAt: null,
      }]);

      mockSelect.mockReturnValueOnce({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere } as any);
      mockWhere.mockReturnValue({ limit: mockLimit } as any);

      mockSelect.mockReturnValueOnce({ from: mockWorkspaceFrom } as any);
      mockWorkspaceFrom.mockReturnValue({ where: mockWorkspaceWhere } as any);
      mockWorkspaceWhere.mockReturnValue({ limit: mockWorkspaceLimit } as any);

      const result = await validateMagicLink("valid-token");

      expect(result.branding).toEqual({
        name: "Acme Agency",
        logoUrl: "https://acme.com/logo.png",
        primaryColor: "#10b981", // Default emerald
      });
    });
  });

  describe("markMagicLinkUsed", () => {
    it("sets usedAt timestamp", async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue([{
        id: "ml-1",
        usedAt: new Date("2026-04-30T12:00:00Z"),
      }]);

      mockUpdate.mockReturnValue({ set: mockSet } as any);
      mockSet.mockReturnValue({ where: mockWhere } as any);

      await markMagicLinkUsed("token-to-mark");

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        usedAt: expect.any(Date),
      }));
    });
  });
});
