/**
 * PlatformConnectionService Tests
 * Phase 61-04: Platform Integration Excellence
 *
 * Tests unified CRUD for OAuth and app password connections.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlatformConnectionService,
  type CreateOAuthConnectionInput,
  type CreateAppPasswordConnectionInput,
} from "./PlatformConnectionService";

// Mock dependencies
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
    query: {
      platformConnections: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("./TokenEncryption", () => ({
  encryptToken: vi.fn((text: string) => `encrypted:${text}`),
  decryptToken: vi.fn((text: string) => text.replace("encrypted:", "")),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-id-12345"),
}));

import { db } from "@/db";
import { encryptToken, decryptToken } from "./TokenEncryption";

describe("PlatformConnectionService", () => {
  let service: PlatformConnectionService;

  beforeEach(() => {
    service = new PlatformConnectionService();
    vi.clearAllMocks();
  });

  describe("createOAuthConnection", () => {
    const oauthInput: CreateOAuthConnectionInput = {
      workspaceId: "ws-123",
      platform: "google_search_console",
      accessToken: "access-token-xyz",
      refreshToken: "refresh-token-abc",
      expiresIn: 3600,
      tokenType: "Bearer",
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
      connectedBy: "user-456",
    };

    it("should store encrypted OAuth tokens", async () => {
      const id = await service.createOAuthConnection(oauthInput);

      expect(id).toBe("test-id-12345");
      expect(encryptToken).toHaveBeenCalledWith("access-token-xyz");
      expect(encryptToken).toHaveBeenCalledWith("refresh-token-abc");
      expect(db.insert).toHaveBeenCalled();
    });

    it("should handle optional prospectId", async () => {
      const inputWithProspect = {
        ...oauthInput,
        prospectId: "prospect-789",
      };

      const id = await service.createOAuthConnection(inputWithProspect);
      expect(id).toBe("test-id-12345");
    });
  });

  describe("createAppPasswordConnection", () => {
    const appPasswordInput: CreateAppPasswordConnectionInput = {
      workspaceId: "ws-123",
      platform: "wordpress_org",
      siteUrl: "https://example.com",
      credentials: {
        username: "admin",
        appPassword: "xxxx xxxx xxxx",
      },
      connectedBy: "user-456",
    };

    it("should store encrypted credential JSON", async () => {
      const id = await service.createAppPasswordConnection(appPasswordInput);

      expect(id).toBe("test-id-12345");
      expect(encryptToken).toHaveBeenCalledWith(
        JSON.stringify(appPasswordInput.credentials)
      );
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("getConnection", () => {
    it("should return connection without decrypted credentials", async () => {
      const mockRow = {
        id: "conn-123",
        workspaceId: "ws-123",
        prospectId: null,
        platform: "google_search_console",
        platformAccountId: "account-1",
        platformAccountName: "Test Account",
        platformSiteUrl: "https://example.com",
        credentialType: "oauth",
        status: "active",
        lastSyncAt: null,
        lastSyncStatus: null,
        lastError: null,
        connectedAt: new Date(),
        accessTokenEncrypted: "encrypted:token",
        credentialsEncrypted: null,
      };

      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce(
        mockRow
      );

      const result = await service.getConnection("conn-123");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("conn-123");
      expect(result!.hasTokens).toBe(true);
      // Should NOT include encrypted tokens in response
      expect((result as any).accessTokenEncrypted).toBeUndefined();
    });

    it("should return null for non-existent connection", async () => {
      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce(
        null
      );

      const result = await service.getConnection("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("getOAuthTokens", () => {
    it("should decrypt and return credentials (server only)", async () => {
      const mockRow = {
        accessTokenEncrypted: "encrypted:access-token",
        refreshTokenEncrypted: "encrypted:refresh-token",
        tokenExpiresAt: new Date("2026-05-03"),
      };

      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce(
        mockRow
      );

      const result = await service.getOAuthTokens("conn-123");

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe("access-token");
      expect(result!.refreshToken).toBe("refresh-token");
      expect(decryptToken).toHaveBeenCalledWith("encrypted:access-token");
      expect(decryptToken).toHaveBeenCalledWith("encrypted:refresh-token");
    });

    it("should return null if no access token", async () => {
      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce({
        accessTokenEncrypted: null,
      });

      const result = await service.getOAuthTokens("conn-123");
      expect(result).toBeNull();
    });
  });

  describe("getAppPasswordCredentials", () => {
    it("should decrypt and return app password credentials", async () => {
      const credentials = { username: "admin", appPassword: "secret" };
      const mockRow = {
        credentialsEncrypted: `encrypted:${JSON.stringify(credentials)}`,
        credentialType: "app_password",
      };

      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce(
        mockRow
      );

      const result = await service.getAppPasswordCredentials("conn-123");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("admin");
      expect(result!.appPassword).toBe("secret");
    });

    it("should return null for non-app_password credential type", async () => {
      vi.mocked(db.query.platformConnections.findFirst).mockResolvedValueOnce({
        credentialsEncrypted: "encrypted:something",
        credentialType: "oauth",
      });

      const result = await service.getAppPasswordCredentials("conn-123");
      expect(result).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("should update status and lastError", async () => {
      await service.updateStatus("conn-123", "error", "Token expired");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("deleteConnection", () => {
    it("should remove connection from database", async () => {
      await service.deleteConnection("conn-123");

      expect(db.delete).toHaveBeenCalled();
    });
  });
});
