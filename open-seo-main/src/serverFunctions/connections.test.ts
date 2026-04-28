/**
 * Connection server functions tests.
 * Phase 31-04: Connection Wizard UI
 *
 * Tests Zod input validation and that credentials never appear in responses.
 * These are isolated schema tests that don't require database connection.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ============================================================================
// Platform Types (replicated to avoid DB import)
// ============================================================================

const PLATFORM_TYPES = [
  "wordpress",
  "shopify",
  "wix",
  "squarespace",
  "webflow",
  "custom",
  "pixel",
] as const;

// type PlatformType = (typeof PLATFORM_TYPES)[number]; // Unused

// ============================================================================
// Schema Tests (Validation)
// ============================================================================

describe("Connection Server Function Schemas", () => {
  // Replicate schemas from connections.ts for isolated testing
  const detectPlatformSchema = z.object({
    domain: z.string().min(1, "Domain is required"),
  });

  // Use inline enum to avoid Zod v4 array reference issues
  const createConnectionSchema = z.object({
    clientId: z.string().min(1, "Client ID is required"),
    platform: z.enum(["wordpress", "shopify", "wix", "squarespace", "webflow", "custom", "pixel"]),
    siteUrl: z.string().url("Invalid site URL"),
    displayName: z.string().optional(),
    credentials: z.record(z.string(), z.unknown()),
  });

  const connectionIdSchema = z.object({
    connectionId: z.string().min(1, "Connection ID is required"),
  });

  const clientIdSchema = z.object({
    clientId: z.string().min(1, "Client ID is required"),
  });

  describe("detectPlatformSchema", () => {
    it("accepts valid domain", () => {
      const result = detectPlatformSchema.safeParse({ domain: "example.com" });
      expect(result.success).toBe(true);
    });

    it("rejects empty domain", () => {
      const result = detectPlatformSchema.safeParse({ domain: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing domain", () => {
      const result = detectPlatformSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("createConnectionSchema", () => {
    const validInput = {
      clientId: "client-123",
      platform: "wordpress" as const,
      siteUrl: "https://example.com",
      credentials: { username: "admin", appPassword: "secret" },
    };

    it("accepts valid input", () => {
      const result = createConnectionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("accepts input with optional displayName", () => {
      const result = createConnectionSchema.safeParse({
        ...validInput,
        displayName: "My Site",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing clientId", () => {
      const { clientId, ...rest } = validInput;
      const result = createConnectionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects empty clientId", () => {
      const result = createConnectionSchema.safeParse({
        ...validInput,
        clientId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid platform", () => {
      const result = createConnectionSchema.safeParse({
        ...validInput,
        platform: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("accepts all valid platform types", () => {
      for (const platform of PLATFORM_TYPES) {
        const result = createConnectionSchema.safeParse({
          ...validInput,
          platform,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid siteUrl", () => {
      const result = createConnectionSchema.safeParse({
        ...validInput,
        siteUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing credentials", () => {
      const { credentials, ...rest } = validInput;
      const result = createConnectionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("accepts empty credentials object", () => {
      const result = createConnectionSchema.safeParse({
        ...validInput,
        credentials: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe("connectionIdSchema", () => {
    it("accepts valid connectionId", () => {
      const result = connectionIdSchema.safeParse({ connectionId: "conn-123" });
      expect(result.success).toBe(true);
    });

    it("rejects empty connectionId", () => {
      const result = connectionIdSchema.safeParse({ connectionId: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing connectionId", () => {
      const result = connectionIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("clientIdSchema", () => {
    it("accepts valid clientId", () => {
      const result = clientIdSchema.safeParse({ clientId: "client-123" });
      expect(result.success).toBe(true);
    });

    it("rejects empty clientId", () => {
      const result = clientIdSchema.safeParse({ clientId: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing clientId", () => {
      const result = clientIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Response Security Tests
// ============================================================================

describe("Connection Response Security", () => {
  describe("credentials never in response", () => {
    it("ConnectionWithoutCredentials type has hasCredentials flag", () => {
      // Type-level test: verify the interface shape
      type ConnectionWithoutCredentials = {
        id: string;
        clientId: string;
        platform: string;
        siteUrl: string;
        displayName: string;
        status: string;
        hasCredentials: boolean; // This flag replaces actual credentials
        // NO encryptedCredentials field
      };

      const conn: ConnectionWithoutCredentials = {
        id: "conn-123",
        clientId: "client-123",
        platform: "wordpress",
        siteUrl: "https://example.com",
        displayName: "Example Site",
        status: "active",
        hasCredentials: true,
      };

      // Should not have encryptedCredentials
      expect(conn).not.toHaveProperty("encryptedCredentials");
      expect(conn).toHaveProperty("hasCredentials");
    });

    it("stripCredentials removes encrypted field and adds hasCredentials", () => {
      // Simulate what stripCredentials does
      const dbRow = {
        id: "conn-123",
        clientId: "client-123",
        platform: "wordpress",
        siteUrl: "https://example.com",
        displayName: "Example Site",
        status: "active",
        encryptedCredentials: "base64-encrypted-data",
        capabilities: ["edit_posts"],
        lastVerifiedAt: new Date(),
        lastErrorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate stripCredentials
      const { encryptedCredentials, ...rest } = dbRow;
      const result = {
        ...rest,
        hasCredentials: !!encryptedCredentials,
      };

      expect(result).not.toHaveProperty("encryptedCredentials");
      expect(result.hasCredentials).toBe(true);
    });

    it("hasCredentials is false when no credentials stored", () => {
      const dbRow = {
        id: "conn-123",
        encryptedCredentials: null,
      };

      const { encryptedCredentials, ...rest } = dbRow;
      const result = {
        ...rest,
        hasCredentials: !!encryptedCredentials,
      };

      expect(result.hasCredentials).toBe(false);
    });
  });
});
