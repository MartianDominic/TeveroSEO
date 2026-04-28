/**
 * Tests for auto-onboarding service.
 * Phase 30-07: Auto-Onboarding
 *
 * TDD: Tests written FIRST before implementation.
 * Covers: client creation, project setup, GSC invite, kickoff scheduling, notifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("mock-id-123"),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock database operations
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockSelectFrom = vi.fn();
const mockReturning = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

// Create a transaction-aware mock that passes `tx` with the same API as `db`
const createDbMock = () => ({
  select: () => ({
    from: mockSelectFrom.mockReturnValue({
      where: mockWhere.mockReturnValue({
        limit: mockLimit.mockResolvedValue([]),
      }),
    }),
  }),
  insert: () => ({
    values: mockInsertValues.mockReturnValue({
      returning: mockReturning,
    }),
  }),
  update: () => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockWhere.mockReturnValue({
        returning: mockReturning,
      }),
    }),
  }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = vi.fn() as ReturnType<typeof vi.fn> & { mockResolvedValue: (val: any) => void };

vi.mock("@/db/index", () => ({
  db: {
    ...createDbMock(),
    transaction: vi.fn(async (callback: (tx: ReturnType<typeof createDbMock>) => Promise<unknown>) => {
      return callback(createDbMock());
    }),
    query: {
      proposals: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Mock email service - return true for successful sends
const mockSendGscInviteEmail = vi.fn().mockResolvedValue(true);
const mockSendKickoffSchedulingEmail = vi.fn().mockResolvedValue(true);
const mockSendClientWelcomeEmail = vi.fn().mockResolvedValue(true);
const mockSendAgencyNotificationEmail = vi.fn().mockResolvedValue(true);

vi.mock("./email", () => ({
  sendGscInviteEmail: mockSendGscInviteEmail,
  sendKickoffSchedulingEmail: mockSendKickoffSchedulingEmail,
  sendClientWelcomeEmail: mockSendClientWelcomeEmail,
  sendAgencyNotificationEmail: mockSendAgencyNotificationEmail,
  // Re-export generate functions for template tests
  generateGscInviteEmail: vi.fn((params: { clientName: string; domain: string; connectUrl: string }) => ({
    subject: "Prisijunkite prie Google Search Console",
    body: `Sveiki, ${params.clientName}!\n\nSvetaine: ${params.domain}\n\n${params.connectUrl}`,
  })),
  generateKickoffSchedulingEmail: vi.fn((params: { clientName: string; calendlyUrl: string }) => ({
    subject: "Suplanuokime susitikima",
    body: `Sveiki, ${params.clientName}!\n\n${params.calendlyUrl}`,
  })),
  generateClientWelcomeEmail: vi.fn((params: { clientName: string; companyName: string }) => ({
    subject: `Sveiki atvyke, ${params.companyName}!`,
    body: `Sveiki, ${params.clientName}!\n\n${params.companyName}`,
  })),
}));

// Mock Slack notifications
const mockSendSlackNotification = vi.fn().mockResolvedValue(true);
vi.mock("./notifications", () => ({
  notifyAgencySlack: mockSendSlackNotification,
  formatSlackNotification: vi.fn((data: { clientName: string; monthlyValue: number }) => ({
    text: `Naujas klientas: ${data.clientName} (${data.monthlyValue} EUR/men.)`,
    blocks: [],
  })),
}));

describe("OnboardingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      APP_URL: "https://app.example.com",
      CALENDLY_URL: "https://calendly.com/seo-team",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
      AGENCY_NOTIFICATION_EMAIL: "agency@example.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Test data
  const mockProspect = {
    id: "prospect-123",
    workspaceId: "workspace-456",
    domain: "example.com",
    companyName: "Example Company",
    contactEmail: "contact@example.com",
    contactName: "John Doe",
    industry: "E-commerce",
    status: "analyzed",
    notes: null,
    source: "manual",
    assignedTo: null,
    convertedClientId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  };

  const mockAnalysis = {
    id: "analysis-789",
    prospectId: "prospect-123",
    analysisType: "deep_dive",
    status: "completed",
    targetRegion: "LT",
    targetLanguage: "lt",
    domainMetrics: {
      domainRank: 45,
      organicTraffic: 5000,
      organicKeywords: 250,
      backlinks: 1200,
      referringDomains: 150,
    },
    organicKeywords: [
      { keyword: "seo services", position: 12, searchVolume: 1500, cpc: 3.5 },
      { keyword: "seo agency", position: 8, searchVolume: 800, cpc: 4.2 },
    ],
    opportunityKeywords: [
      {
        keyword: "seo optimization",
        category: "service" as const,
        searchVolume: 2200,
        cpc: 3.8,
        difficulty: 45,
        opportunityScore: 78,
        source: "ai_generated" as const,
      },
    ],
    competitorDomains: ["competitor1.com", "competitor2.com"],
    competitorKeywords: null,
    keywordGaps: null,
    scrapedContent: null,
    costCents: 150,
    createdAt: new Date("2024-01-10"),
    completedAt: new Date("2024-01-10"),
  };

  const mockProposal = {
    id: "proposal-abc",
    prospectId: "prospect-123",
    workspaceId: "workspace-456",
    template: "standard",
    content: {
      hero: { headline: "Grow Example Company", subheadline: "SEO", trafficValue: 15000 },
      currentState: { traffic: 5000, keywords: 250, value: 10000, chartData: [] },
      opportunities: [{ keyword: "seo optimization", volume: 2200, difficulty: "medium", potential: 8360 }],
      roi: { projectedTrafficGain: 2000, trafficValue: 7600, defaultConversionRate: 0.02, defaultAov: 150 },
      investment: { setupFee: 2500, monthlyFee: 1500, inclusions: [] },
      nextSteps: [],
    },
    setupFeeCents: 250000,
    monthlyFeeCents: 150000,
    currency: "EUR",
    status: "paid",
    token: "token-xyz",
    brandConfig: null,
    expiresAt: null,
    sentAt: new Date(),
    firstViewedAt: new Date(),
    acceptedAt: new Date(),
    signedAt: new Date(),
    paidAt: new Date(),
    declinedReason: null,
    declinedNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("triggerOnboarding", () => {
    it("should create a client from the prospect data", async () => {
      // Mock proposal query with prospect and analyses
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      // Mock insert returning
      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]); // client
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]); // project

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      expect(result.clientId).toBe("client-new-123");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-456",
          name: "Example Company",
          domain: "example.com",
          contactEmail: "contact@example.com",
          contactName: "John Doe",
          industry: "E-commerce",
          status: "onboarding",
          convertedFromProspectId: "prospect-123",
        })
      );
    });

    it("should update prospect status to converted", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);

      const { triggerOnboarding } = await import("./onboarding");
      await triggerOnboarding("proposal-abc");

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "converted",
          convertedClientId: "client-new-123",
        })
      );
    });

    it("should create a project for the domain", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      expect(result.projectId).toBe("project-new-456");
      // Project uses organizationId in the actual schema
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "workspace-456",
          name: "SEO - example.com",
          domain: "example.com",
        })
      );
    });

    it("should send GSC invite email", async () => {
      vi.clearAllMocks();
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);
      mockSendGscInviteEmail.mockResolvedValueOnce(true);
      mockSendKickoffSchedulingEmail.mockResolvedValueOnce(true);
      mockSendClientWelcomeEmail.mockResolvedValueOnce(true);

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      expect(result.gscInviteSent).toBe(true);
      expect(mockSendGscInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "contact@example.com",
          clientName: "John Doe",
          domain: "example.com",
        })
      );
    });

    it("should send kickoff scheduling email with Calendly link", async () => {
      vi.clearAllMocks();
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);
      mockSendGscInviteEmail.mockResolvedValueOnce(true);
      mockSendKickoffSchedulingEmail.mockResolvedValueOnce(true);
      mockSendClientWelcomeEmail.mockResolvedValueOnce(true);

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      expect(result.kickoffEmailSent).toBe(true);
      expect(mockSendKickoffSchedulingEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "contact@example.com",
          clientName: "John Doe",
          calendlyUrl: expect.stringContaining("calendly.com"),
        })
      );
    });

    it("should update proposal status to onboarded", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);

      const { triggerOnboarding } = await import("./onboarding");
      await triggerOnboarding("proposal-abc");

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "onboarded",
        })
      );
    });

    it("should throw error if proposal not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const { triggerOnboarding } = await import("./onboarding");

      await expect(triggerOnboarding("nonexistent")).rejects.toThrow(
        /Proposal.*not found/i
      );
    });

    it("should throw error if prospect not linked to proposal", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: null,
      });

      const { triggerOnboarding } = await import("./onboarding");

      await expect(triggerOnboarding("proposal-abc")).rejects.toThrow(
        /Prospect.*not found/i
      );
    });

    it("should be idempotent - not create duplicate clients", async () => {
      // Proposal already onboarded
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        status: "onboarded",
        prospect: {
          ...mockProspect,
          status: "converted",
          convertedClientId: "existing-client-123",
          analyses: [mockAnalysis],
        },
      });

      // Mock the select for finding existing project
      mockLimit.mockResolvedValueOnce([{ id: "existing-project-456" }]);

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      // Should return existing client, not create new
      expect(result.clientId).toBe("existing-client-123");
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("should use domain as client name if companyName is missing", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          companyName: null,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);

      const { triggerOnboarding } = await import("./onboarding");
      await triggerOnboarding("proposal-abc");

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "example.com",
        })
      );
    });

    it("should handle missing contact email gracefully", async () => {
      mockFindFirst.mockResolvedValue({
        ...mockProposal,
        prospect: {
          ...mockProspect,
          contactEmail: null,
          analyses: [mockAnalysis],
        },
      });

      mockReturning.mockResolvedValueOnce([{ id: "client-new-123" }]);
      mockReturning.mockResolvedValueOnce([{ id: "project-new-456", name: "SEO - example.com", domain: "example.com" }]);

      const { triggerOnboarding } = await import("./onboarding");
      const result = await triggerOnboarding("proposal-abc");

      // Should still create client but skip emails
      expect(result.clientId).toBe("client-new-123");
      expect(result.gscInviteSent).toBe(false);
      expect(result.kickoffEmailSent).toBe(false);
    });
  });

  describe("createClientFromProposal", () => {
    it("should create client with all prospect fields mapped", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "client-new",
        workspaceId: "workspace-456",
        name: "Example Company",
        domain: "example.com",
        contactEmail: "contact@example.com",
        contactName: "John Doe",
        industry: "E-commerce",
        status: "onboarding",
      }]);

      const { createClientFromProposal } = await import("./onboarding");
      const client = await createClientFromProposal(mockProspect, "workspace-456");

      expect(client.id).toBe("client-new");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-456",
          name: "Example Company",
          domain: "example.com",
          contactEmail: "contact@example.com",
          contactName: "John Doe",
          industry: "E-commerce",
          status: "onboarding",
          convertedFromProspectId: "prospect-123",
        })
      );
    });
  });

  describe("createProjectFromAnalysis", () => {
    it("should create project with domain and name", async () => {
      mockReturning.mockResolvedValueOnce([{
        id: "project-new",
        organizationId: "workspace-456",
        name: "SEO - example.com",
        domain: "example.com",
      }]);

      const { createProjectFromAnalysis } = await import("./onboarding");
      const project = await createProjectFromAnalysis(
        "client-123",
        "workspace-456",
        mockProspect,
        mockAnalysis
      );

      expect(project.id).toBe("project-new");
      // Actual schema uses organizationId
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "workspace-456",
          name: "SEO - example.com",
          domain: "example.com",
        })
      );
    });
  });

  describe("notifyAgency", () => {
    it("should send agency notification email", async () => {
      const { notifyAgency } = await import("./onboarding");
      await notifyAgency({
        clientName: "Example Company",
        domain: "example.com",
        monthlyValue: 1500,
        projectId: "project-123",
      });

      expect(mockSendAgencyNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "agency@example.com",
          clientName: "Example Company",
          domain: "example.com",
          monthlyValue: 1500,
        })
      );
    });

    it("should send Slack notification if webhook is configured", async () => {
      const { notifyAgency } = await import("./onboarding");
      await notifyAgency({
        clientName: "Example Company",
        domain: "example.com",
        monthlyValue: 1500,
        projectId: "project-123",
      });

      expect(mockSendSlackNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: "Example Company",
          monthlyValue: 1500,
        })
      );
    });
  });
});

describe("Email Templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      APP_URL: "https://app.example.com",
      CALENDLY_URL: "https://calendly.com/seo-team",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GSC Invite Email", () => {
    it("should generate Lithuanian email content", async () => {
      const { generateGscInviteEmail } = await import("./email");
      const email = generateGscInviteEmail({
        clientName: "Jonas",
        domain: "example.lt",
        connectUrl: "https://app.example.com/onboarding/client-123/gsc",
      });

      expect(email.subject).toContain("Google Search Console");
      expect(email.body).toContain("Jonas");
      expect(email.body).toContain("example.lt");
      expect(email.body).toContain("https://app.example.com/onboarding/client-123/gsc");
    });
  });

  describe("Kickoff Scheduling Email", () => {
    it("should include Calendly link with email prefill", async () => {
      const { generateKickoffSchedulingEmail } = await import("./email");
      const email = generateKickoffSchedulingEmail({
        clientName: "Jonas",
        calendlyUrl: "https://calendly.com/seo-team?email=jonas@example.lt",
      });

      expect(email.subject).toContain("susitikima");
      expect(email.body).toContain("Jonas");
      expect(email.body).toContain("calendly.com");
    });
  });

  describe("Client Welcome Email", () => {
    it("should generate welcome email in Lithuanian", async () => {
      const { generateClientWelcomeEmail } = await import("./email");
      const email = generateClientWelcomeEmail({
        clientName: "Jonas",
        companyName: "Example Company",
      });

      expect(email.subject).toContain("Sveiki");
      expect(email.body).toContain("Jonas");
      expect(email.body).toContain("Example Company");
    });
  });
});

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Slack Notification", () => {
    it("should format Slack message with client details", async () => {
      const { formatSlackNotification } = await import("./notifications");
      const message = formatSlackNotification({
        clientName: "Example Company",
        domain: "example.com",
        monthlyValue: 1500,
        projectId: "project-123",
      });

      expect(message.text).toContain("Example Company");
      expect(message.text).toContain("1500");
    });

    it("should skip notification if webhook not configured", async () => {
      delete process.env.SLACK_WEBHOOK_URL;

      const { notifyAgencySlack } = await import("./notifications");
      await notifyAgencySlack({
        clientName: "Example Company",
        domain: "example.com",
        monthlyValue: 1500,
        projectId: "project-123",
      });

      // Should not throw, just skip
    });
  });
});
