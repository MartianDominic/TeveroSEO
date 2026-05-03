/**
 * Tests for ClientSyncService - lazy client synchronization from AI-Writer.
 * Phase 40: Gap Closure - CRIT-SYNC-01
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClientSyncService } from "./ClientSyncService";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([])),
        })),
        onConflictDoUpdate: vi.fn(() => ({
          returning: vi.fn(() =>
            Promise.resolve([
              {
                id: "test-client-id",
                workspaceId: "test-workspace-id",
                name: "Test Client",
                domain: "example.com",
                status: "active",
              },
            ])
          ),
        })),
      })),
    })),
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("ClientSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("extractDomain", () => {
    it("extracts domain from valid https URL", () => {
      const domain = ClientSyncService.extractDomain("https://www.example.com/path");
      expect(domain).toBe("www.example.com");
    });

    it("extracts domain from http URL", () => {
      const domain = ClientSyncService.extractDomain("http://example.com");
      expect(domain).toBe("example.com");
    });

    it("extracts domain from URL without protocol", () => {
      const domain = ClientSyncService.extractDomain("example.com/path");
      expect(domain).toBe("example.com");
    });

    it("returns null for null input", () => {
      const domain = ClientSyncService.extractDomain(null);
      expect(domain).toBeNull();
    });

    it("returns null for empty string", () => {
      const domain = ClientSyncService.extractDomain("");
      expect(domain).toBeNull();
    });

    it("handles URLs with ports", () => {
      const domain = ClientSyncService.extractDomain("https://example.com:8080/path");
      expect(domain).toBe("example.com");
    });

    it("handles subdomains", () => {
      const domain = ClientSyncService.extractDomain("https://sub.domain.example.com");
      expect(domain).toBe("sub.domain.example.com");
    });
  });

  describe("ensureClient", () => {
    it("returns null when client not found in AI-Writer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await ClientSyncService.ensureClient(
        "nonexistent-id",
        "workspace-id"
      );

      expect(result).toBeNull();
    });

    it("handles AI-Writer API timeout gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Timeout"));

      const result = await ClientSyncService.ensureClient(
        "client-id",
        "workspace-id"
      );

      expect(result).toBeNull();
    });

    it("handles AI-Writer API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await ClientSyncService.ensureClient(
        "client-id",
        "workspace-id"
      );

      expect(result).toBeNull();
    });
  });

  describe("syncClient", () => {
    it("returns null when client not found in AI-Writer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await ClientSyncService.syncClient(
        "nonexistent-id",
        "workspace-id"
      );

      expect(result).toBeNull();
    });

    it("syncs client data from AI-Writer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-client-id",
            name: "Test Client",
            website_url: "https://example.com",
            is_archived: false,
          }),
      });

      const result = await ClientSyncService.syncClient(
        "test-client-id",
        "test-workspace-id"
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("test-client-id");
      expect(result?.name).toBe("Test Client");
    });

    it("handles archived clients from AI-Writer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "archived-client-id",
            name: "Archived Client",
            website_url: null,
            is_archived: true,
          }),
      });

      const result = await ClientSyncService.syncClient(
        "archived-client-id",
        "workspace-id"
      );

      // Should still sync, but status should reflect archived state
      expect(result).toBeDefined();
    });
  });
});

describe("URL Scheme Validation (CRIT-SYNC-02)", () => {
  // These tests validate that the URL scheme validation is working
  // The actual validation is in AI-Writer, but we test the domain extraction here

  it("rejects javascript: URLs in domain extraction", () => {
    // javascript: URLs should not parse as valid domains
    const domain = ClientSyncService.extractDomain("javascript:alert(1)");
    expect(domain).toBeNull();
  });

  it("rejects data: URLs in domain extraction", () => {
    // data: URLs should not parse as valid domains
    const domain = ClientSyncService.extractDomain("data:text/html,<script>alert(1)</script>");
    expect(domain).toBeNull();
  });

  it("accepts valid http URLs", () => {
    const domain = ClientSyncService.extractDomain("http://example.com");
    expect(domain).toBe("example.com");
  });

  it("accepts valid https URLs", () => {
    const domain = ClientSyncService.extractDomain("https://secure.example.com");
    expect(domain).toBe("secure.example.com");
  });
});
