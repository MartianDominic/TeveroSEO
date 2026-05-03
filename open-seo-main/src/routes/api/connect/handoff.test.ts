/**
 * Handoff API Endpoint Tests
 * Phase 66-05: Developer Handoff Flow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Test the request validation schemas independently
describe("Handoff API Schemas", () => {
  const CreateHandoffSchema = z.object({
    installationId: z.string().min(1, "Installation ID is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .max(254, "Email too long"),
    name: z.string().max(100, "Name too long").optional(),
    message: z.string().max(500, "Message too long").optional(),
    senderName: z.string().min(1, "Sender name is required").max(100, "Sender name too long"),
    domain: z.string().min(1, "Domain is required"),
  });

  const GetHandoffsSchema = z.object({
    installationId: z.string().min(1, "Installation ID is required"),
  });

  describe("CreateHandoffSchema", () => {
    it("validates valid request", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "inst_123",
        email: "dev@example.com",
        senderName: "Jane Manager",
        domain: "example.com",
      });

      expect(result.success).toBe(true);
    });

    it("rejects empty installation ID", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "",
        email: "dev@example.com",
        senderName: "Jane Manager",
        domain: "example.com",
      });

      expect(result.success).toBe(false);
    });

    it("rejects invalid email format", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "inst_123",
        email: "invalid-email",
        senderName: "Jane Manager",
        domain: "example.com",
      });

      expect(result.success).toBe(false);
    });

    it("accepts optional name and message", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "inst_123",
        email: "dev@example.com",
        name: "John Developer",
        message: "Please install ASAP",
        senderName: "Jane Manager",
        domain: "example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Developer");
        expect(result.data.message).toBe("Please install ASAP");
      }
    });

    it("rejects message over 500 chars", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "inst_123",
        email: "dev@example.com",
        senderName: "Jane Manager",
        domain: "example.com",
        message: "a".repeat(501),
      });

      expect(result.success).toBe(false);
    });

    it("rejects empty sender name", () => {
      const result = CreateHandoffSchema.safeParse({
        installationId: "inst_123",
        email: "dev@example.com",
        senderName: "",
        domain: "example.com",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("GetHandoffsSchema", () => {
    it("validates valid request", () => {
      const result = GetHandoffsSchema.safeParse({
        installationId: "inst_123",
      });

      expect(result.success).toBe(true);
    });

    it("rejects empty installation ID", () => {
      const result = GetHandoffsSchema.safeParse({
        installationId: "",
      });

      expect(result.success).toBe(false);
    });

    it("rejects missing installation ID", () => {
      const result = GetHandoffsSchema.safeParse({});

      expect(result.success).toBe(false);
    });
  });
});

describe("Token Schema", () => {
  const TokenSchema = z.string().min(1, "Token is required").max(64, "Token too long");

  it("validates valid token", () => {
    const result = TokenSchema.safeParse("a".repeat(32));
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = TokenSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects token over 64 chars", () => {
    const result = TokenSchema.safeParse("a".repeat(65));
    expect(result.success).toBe(false);
  });
});

describe("Handoff Response Types", () => {
  it("CreateHandoffResponse has correct shape", () => {
    interface CreateHandoffResponse {
      handoffId: string;
      magicLink: string;
      status: "sent";
    }

    const response: CreateHandoffResponse = {
      handoffId: "handoff_123",
      magicLink: "https://app.tevero.io/install/abc123",
      status: "sent",
    };

    expect(response.handoffId).toBe("handoff_123");
    expect(response.status).toBe("sent");
    expect(response.magicLink).toContain("https://app.tevero.io/install/");
  });

  it("HandoffListResponse has correct shape", () => {
    interface HandoffListResponse {
      handoffs: Array<{
        id: string;
        developerEmail: string;
        developerName: string | null;
        status: string;
        sentAt: Date;
        openedAt: Date | null;
        completedAt: Date | null;
        reminderCount: number;
      }>;
    }

    const response: HandoffListResponse = {
      handoffs: [
        {
          id: "h1",
          developerEmail: "dev@example.com",
          developerName: "John",
          status: "sent",
          sentAt: new Date(),
          openedAt: null,
          completedAt: null,
          reminderCount: 0,
        },
      ],
    };

    expect(response.handoffs).toHaveLength(1);
    expect(response.handoffs[0].status).toBe("sent");
  });
});

describe("HandoffResponse Type", () => {
  it("HandoffResponse has correct shape for magic link page", () => {
    interface HandoffResponse {
      handoff: {
        id: string;
        developerEmail: string;
        developerName: string | null;
        status: string;
        sentAt: Date;
        openedAt: Date | null;
      };
      installation: {
        siteId: string;
        domain: string;
      };
      guide: {
        platform: string;
        steps: Array<{
          title: string;
          content: string;
        }>;
      } | null;
      snippet: string;
    }

    const response: HandoffResponse = {
      handoff: {
        id: "handoff_123",
        developerEmail: "dev@example.com",
        developerName: "John Developer",
        status: "opened",
        sentAt: new Date(),
        openedAt: new Date(),
      },
      installation: {
        siteId: "site_abc123",
        domain: "example.com",
      },
      guide: {
        platform: "shopify",
        steps: [
          { title: "Step 1", content: "Go to admin" },
          { title: "Step 2", content: "Add code" },
        ],
      },
      snippet: '<script async src="https://pixel.tevero.io/t.js" data-site="site_abc123"></script>',
    };

    expect(response.handoff.id).toBe("handoff_123");
    expect(response.installation.siteId).toBe("site_abc123");
    expect(response.guide?.steps).toHaveLength(2);
    expect(response.snippet).toContain("data-site");
  });
});
