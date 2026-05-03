/**
 * DeveloperHandoffService Tests
 * Phase 66: Platform Unification Excellence - Plan 05
 *
 * TDD RED phase: Tests for developer handoff functionality.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DeveloperHandoffService,
  type CreateHandoffRequest,
} from "./developer-handoff.service";

// Mock database client
const mockDb = {
  query: {
    developerHandoffs: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    pixelInstallations: {
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
};

// Mock email service
const mockEmailService = {
  sendEmail: vi.fn().mockResolvedValue({
    success: true,
    messageId: "msg_test123",
    language: "en",
    subject: "Test Subject",
  }),
};

describe("DeveloperHandoffService", () => {
  let service: DeveloperHandoffService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeveloperHandoffService(
      mockDb as any,
      mockEmailService as any
    );
  });

  describe("createHandoff", () => {
    const validRequest: CreateHandoffRequest = {
      installationId: "inst_123",
      email: "dev@example.com",
      name: "John Developer",
      message: "Please install this on our site",
      senderName: "Jane Manager",
      domain: "example.com",
    };

    const mockInstallation = {
      id: "inst_123",
      siteId: "site_abc123",
      domain: "example.com",
      workspaceId: "ws_123",
    };

    it("creates handoff record with 'sent' status", async () => {
      // Setup mocks
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.developerHandoffs.findMany.mockResolvedValue([]); // No existing handoffs today
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "handoff_123",
              installationId: "inst_123",
              developerEmail: "dev@example.com",
              developerName: "John Developer",
              status: "sent",
              magicLinkToken: expect.any(String),
              sentAt: new Date(),
            },
          ]),
        }),
      });

      const result = await service.createHandoff(validRequest);

      expect(result.status).toBe("sent");
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it("generates 32-char nanoid token", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.developerHandoffs.findMany.mockResolvedValue([]); // No existing handoffs today

      let capturedValues: any = null;
      mockDb.insert.mockReturnValue({
        values: vi.fn((vals: any) => {
          capturedValues = vals;
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "handoff_123",
                ...vals,
                status: "sent",
                sentAt: new Date(),
              },
            ]),
          };
        }),
      });

      await service.createHandoff(validRequest);

      expect(capturedValues.magicLinkToken).toBeDefined();
      expect(capturedValues.magicLinkToken.length).toBe(32);
    });

    it("sets 30-day expiry", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.developerHandoffs.findMany.mockResolvedValue([]); // No existing handoffs today

      let capturedValues: any = null;
      mockDb.insert.mockReturnValue({
        values: vi.fn((vals: any) => {
          capturedValues = vals;
          return {
            returning: vi.fn().mockResolvedValue([
              {
                id: "handoff_123",
                ...vals,
                status: "sent",
                sentAt: new Date(),
              },
            ]),
          };
        }),
      });

      await service.createHandoff(validRequest);

      const expectedExpiry = new Date();
      expectedExpiry.setDate(expectedExpiry.getDate() + 30);

      // Check expiry is approximately 30 days from now (within 5 seconds tolerance)
      const expiryDate = new Date(capturedValues.magicLinkExpiresAt);
      const diffMs = Math.abs(expiryDate.getTime() - expectedExpiry.getTime());
      expect(diffMs).toBeLessThan(5000);
    });

    it("throws error when installation not found", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      await expect(service.createHandoff(validRequest)).rejects.toThrow(
        "Installation not found"
      );
    });

    it("validates email format", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);

      const invalidRequest = {
        ...validRequest,
        email: "invalid-email",
      };

      await expect(service.createHandoff(invalidRequest)).rejects.toThrow(
        "Invalid email format"
      );
    });
  });

  describe("getHandoffByToken", () => {
    const mockHandoff = {
      id: "handoff_123",
      installationId: "inst_123",
      developerEmail: "dev@example.com",
      status: "sent",
      magicLinkToken: "a".repeat(32),
      magicLinkExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      sentAt: new Date(),
      openedAt: null,
    };

    it("returns null for expired token", async () => {
      const expiredHandoff = {
        ...mockHandoff,
        magicLinkExpiresAt: new Date(Date.now() - 1000), // Already expired
      };
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(expiredHandoff);

      const result = await service.getHandoffByToken(mockHandoff.magicLinkToken);

      expect(result).toBeNull();
    });

    it("updates status to 'opened' on first access", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(mockHandoff);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockHandoff, status: "opened", openedAt: new Date() },
            ]),
          }),
        }),
      });

      const result = await service.getHandoffByToken(mockHandoff.magicLinkToken);

      expect(result?.status).toBe("opened");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("does not update if already opened", async () => {
      const openedHandoff = {
        ...mockHandoff,
        status: "opened",
        openedAt: new Date(Date.now() - 3600000), // Opened an hour ago
      };
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(openedHandoff);

      const result = await service.getHandoffByToken(mockHandoff.magicLinkToken);

      expect(result?.status).toBe("opened");
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("returns null for non-existent token", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(null);

      const result = await service.getHandoffByToken("nonexistent_token");

      expect(result).toBeNull();
    });
  });

  describe("completeHandoff", () => {
    const mockHandoff = {
      id: "handoff_123",
      status: "opened",
    };

    it("updates status to 'completed'", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(mockHandoff);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockHandoff, status: "completed", completedAt: new Date() },
            ]),
          }),
        }),
      });

      await service.completeHandoff("handoff_123");

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("throws error when handoff not found", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(null);

      await expect(service.completeHandoff("nonexistent")).rejects.toThrow(
        "Handoff not found"
      );
    });
  });

  describe("sendReminder", () => {
    const mockHandoff = {
      id: "handoff_123",
      installationId: "inst_123",
      developerEmail: "dev@example.com",
      status: "sent",
      reminderCount: 0,
    };

    const mockInstallation = {
      id: "inst_123",
      siteId: "site_abc123",
      domain: "example.com",
      workspaceId: "ws_123",
    };

    it("increments reminderCount", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(mockHandoff);
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { ...mockHandoff, reminderCount: 1 },
            ]),
          }),
        }),
      });

      const result = await service.sendReminder("handoff_123");

      expect(result).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it("cannot send more than 3 reminders", async () => {
      const maxReminderHandoff = {
        ...mockHandoff,
        reminderCount: 3,
      };
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(maxReminderHandoff);

      const result = await service.sendReminder("handoff_123");

      expect(result).toBe(false);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it("throws error when handoff not found", async () => {
      mockDb.query.developerHandoffs.findFirst.mockResolvedValue(null);

      await expect(service.sendReminder("nonexistent")).rejects.toThrow(
        "Handoff not found"
      );
    });
  });

  describe("getHandoffsForSite", () => {
    it("returns all handoffs for installation", async () => {
      const mockHandoffs = [
        { id: "h1", status: "sent" },
        { id: "h2", status: "completed" },
      ];
      mockDb.query.developerHandoffs.findMany.mockResolvedValue(mockHandoffs);

      const result = await service.getHandoffsForSite("inst_123");

      expect(result).toHaveLength(2);
    });
  });

  describe("generateEmail", () => {
    it("generates correct subject format", () => {
      const email = service.generateEmailContent(
        "example.com",
        "site_abc123",
        "Jane Manager",
        undefined,
        "token123"
      );

      expect(email.subject).toBe("Add TeveroSEO to example.com (30 seconds)");
    });

    it("includes magic link with correct format", () => {
      const email = service.generateEmailContent(
        "example.com",
        "site_abc123",
        "Jane Manager",
        undefined,
        "token123"
      );

      expect(email.magicLink).toContain("https://app.tevero.io/install/token123");
    });

    it("includes pixel snippet in body", () => {
      const email = service.generateEmailContent(
        "example.com",
        "site_abc123",
        "Jane Manager",
        undefined,
        "token123"
      );

      expect(email.body).toContain('data-site="site_abc123"');
      expect(email.body).toContain("pixel.tevero.io/t.js");
    });

    it("includes custom message when provided", () => {
      const customMessage = "Please install ASAP!";
      const email = service.generateEmailContent(
        "example.com",
        "site_abc123",
        "Jane Manager",
        customMessage,
        "token123"
      );

      expect(email.body).toContain(customMessage);
    });
  });

  describe("rate limiting", () => {
    it("limits to 5 handoffs per site per day", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        domain: "example.com",
        workspaceId: "ws_123",
      };

      // Mock 5 existing handoffs today
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.developerHandoffs.findMany.mockResolvedValue([
        { id: "h1" },
        { id: "h2" },
        { id: "h3" },
        { id: "h4" },
        { id: "h5" },
      ]);

      const request: CreateHandoffRequest = {
        installationId: "inst_123",
        email: "dev@example.com",
        senderName: "Jane Manager",
        domain: "example.com",
      };

      await expect(service.createHandoff(request)).rejects.toThrow(
        "Rate limit exceeded"
      );
    });
  });

  describe("email sanitization (T-66-16)", () => {
    it("sanitizes sender name to prevent email injection", async () => {
      const mockInstallation = {
        id: "inst_123",
        siteId: "site_abc123",
        domain: "example.com",
        workspaceId: "ws_123",
      };
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.developerHandoffs.findMany.mockResolvedValue([]);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "handoff_123",
              installationId: "inst_123",
              status: "sent",
              sentAt: new Date(),
            },
          ]),
        }),
      });

      const maliciousRequest: CreateHandoffRequest = {
        installationId: "inst_123",
        email: "dev@example.com",
        senderName: "Jane\nBcc: attacker@evil.com",
        domain: "example.com",
      };

      await service.createHandoff(maliciousRequest);

      // The email should have been sent with sanitized sender name
      const emailCall = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailCall.variables.senderName).not.toContain("\n");
      expect(emailCall.variables.senderName).not.toContain("Bcc:");
    });
  });
});
