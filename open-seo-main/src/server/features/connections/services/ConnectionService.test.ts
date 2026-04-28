/**
 * ConnectionService Tests
 * Phase 31-03: Platform Adapters
 *
 * Tests ConnectionService CRUD operations with mocked database.
 * Ensures credentials are never returned in plain text.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SiteConnectionSelect } from "@/db/connection-schema";

// Mock db module before importing ConnectionService
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
      siteConnections: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock CredentialEncryption
vi.mock("./CredentialEncryption", () => ({
  encryptCredential: vi.fn((plaintext: string) => {
    // Return a mock encrypted buffer
    return Buffer.from(`encrypted:${plaintext}`);
  }),
  decryptCredential: vi.fn((packed: Buffer) => {
    // Extract plaintext from mock format
    const str = packed.toString();
    return str.replace("encrypted:", "");
  }),
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-connection-id"),
}));

// Import after mocking
import { db } from "@/db";
import { ConnectionService } from "./ConnectionService";
import { encryptCredential, decryptCredential } from "./CredentialEncryption";

describe("ConnectionService", () => {
  let service: ConnectionService;

  // Mock connection row from database
  const mockConnection: SiteConnectionSelect = {
    id: "test-connection-id",
    clientId: "client-123",
    platform: "wordpress",
    siteUrl: "https://example.com",
    displayName: "Example Site",
    encryptedCredentials: Buffer.from(
      'encrypted:{"username":"admin","appPassword":"secret123"}'
    ).toString("base64"),
    capabilities: ["canReadPosts", "canWritePosts"],
    status: "active",
    lastVerifiedAt: new Date(),
    lastErrorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new ConnectionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createConnection", () => {
    it("should encrypt credentials before insert", async () => {
      const mockReturning = vi.fn().mockResolvedValue([mockConnection]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

      await service.createConnection({
        clientId: "client-123",
        platform: "wordpress",
        siteUrl: "https://example.com",
        credentials: { username: "admin", appPassword: "secret123" },
      });

      expect(encryptCredential).toHaveBeenCalledWith(
        JSON.stringify({ username: "admin", appPassword: "secret123" })
      );
    });

    it("should return connection without decrypted credentials", async () => {
      const mockReturning = vi.fn().mockResolvedValue([mockConnection]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

      const result = await service.createConnection({
        clientId: "client-123",
        platform: "wordpress",
        siteUrl: "https://example.com",
        credentials: { username: "admin", appPassword: "secret123" },
      });

      // Result should have hasCredentials but NOT encryptedCredentials
      expect(result.hasCredentials).toBe(true);
      expect((result as unknown as { encryptedCredentials?: string }).encryptedCredentials).toBeUndefined();
    });
  });

  describe("getConnection", () => {
    it("should return connection without decrypted credentials", async () => {
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConnection
      );

      const result = await service.getConnection("test-connection-id");

      expect(result).not.toBeNull();
      expect(result!.hasCredentials).toBe(true);
      expect((result as unknown as { encryptedCredentials?: string }).encryptedCredentials).toBeUndefined();
      expect(result!.id).toBe("test-connection-id");
    });

    it("should return null for non-existent connection", async () => {
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getConnection("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("getConnectionsForClient", () => {
    it("should return connections without decrypted credentials", async () => {
      (db.query.siteConnections.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockConnection,
        { ...mockConnection, id: "conn-2", siteUrl: "https://site2.com" },
      ]);

      const results = await service.getConnectionsForClient("client-123");

      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.hasCredentials).toBe(true);
        expect((result as unknown as { encryptedCredentials?: string }).encryptedCredentials).toBeUndefined();
      });
    });
  });

  describe("getConnectionWithAdapter", () => {
    it("should return WordPress adapter with decrypted credentials", async () => {
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConnection
      );

      const adapter = await service.getConnectionWithAdapter("test-connection-id");

      expect(adapter).not.toBeNull();
      expect(adapter!.platform).toBe("wordpress");
      expect(adapter!.siteUrl).toBe("https://example.com");
      expect(decryptCredential).toHaveBeenCalled();
    });

    it("should return Shopify adapter for shopify platform", async () => {
      const shopifyConnection = {
        ...mockConnection,
        platform: "shopify",
        siteUrl: "https://mystore.myshopify.com",
        encryptedCredentials: Buffer.from(
          'encrypted:{"accessToken":"shpat_xxx"}'
        ).toString("base64"),
      };
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        shopifyConnection
      );

      const adapter = await service.getConnectionWithAdapter("test-connection-id");

      expect(adapter).not.toBeNull();
      expect(adapter!.platform).toBe("shopify");
    });

    it("should return null for non-existent connection", async () => {
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const adapter = await service.getConnectionWithAdapter("non-existent");

      expect(adapter).toBeNull();
    });

    it("should return null for connection without credentials", async () => {
      const noCredConnection = { ...mockConnection, encryptedCredentials: null };
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        noCredConnection
      );

      const adapter = await service.getConnectionWithAdapter("test-connection-id");

      expect(adapter).toBeNull();
    });
  });

  describe("verifyConnection", () => {
    it("should update status to active when verification succeeds", async () => {
      const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConnection
      );

      // Mock fetch for WordPress adapter verifyConnection
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, capabilities: { edit_posts: true } }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.verifyConnection("test-connection-id");

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
        })
      );
    });

    it("should update status to error when verification fails", async () => {
      const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConnection
      );

      // Mock fetch to return 401
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await service.verifyConnection("test-connection-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
        })
      );
    });

    it("should return error for non-existent connection", async () => {
      (db.query.siteConnections.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.verifyConnection("non-existent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("updateStatus", () => {
    it("should update status and timestamp", async () => {
      const mockWhere = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

      await service.updateStatus("test-connection-id", "disconnected", "User disconnected");

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "disconnected",
          lastErrorMessage: "User disconnected",
        })
      );
    });
  });

  describe("deleteConnection", () => {
    it("should delete connection row", async () => {
      const mockWhere = vi.fn().mockResolvedValue({});
      (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockWhere });

      await service.deleteConnection("test-connection-id");

      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
