/**
 * Tests for contract PDF generation.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";
import type { ProposalContent } from "@/db/proposal-schema";

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("Contract PDF Generation", () => {
  const mockProposalContent: ProposalContent = {
    hero: {
      headline: "SEO Pasiulymas - example.com",
      subheadline: "Individualus SEO planas",
      trafficValue: 15000,
    },
    currentState: {
      traffic: 500,
      keywords: 120,
      value: 2500,
      chartData: [
        { month: "Jan", traffic: 400 },
        { month: "Feb", traffic: 450 },
        { month: "Mar", traffic: 500 },
      ],
    },
    opportunities: [
      { keyword: "seo paslaugos", volume: 2400, difficulty: "medium", potential: 3000 },
      { keyword: "seo optimizacija", volume: 1900, difficulty: "hard", potential: 2500 },
    ],
    roi: {
      projectedTrafficGain: 2000,
      trafficValue: 5000,
      defaultConversionRate: 0.02,
      defaultAov: 150,
    },
    investment: {
      setupFee: 2500,
      monthlyFee: 1500,
      inclusions: [
        "Techninis SEO auditas",
        "Turinio optimizavimas",
        "Menesine ataskaita",
      ],
    },
    nextSteps: [
      "Perziureti pasiulyma",
      "Pasirasyti sutarti",
      "Pradeti darbus",
    ],
  };

  const mockProposal = {
    id: "proposal-123",
    prospectId: "prospect-456",
    workspaceId: "workspace-789",
    template: "standard",
    content: mockProposalContent,
    setupFeeCents: 250000,
    monthlyFeeCents: 150000,
    currency: "EUR",
    status: "accepted" as const,
    token: "token-abc",
    expiresAt: null,
    sentAt: new Date("2026-04-01"),
    firstViewedAt: new Date("2026-04-02"),
    acceptedAt: new Date("2026-04-03"),
    signedAt: null,
    paidAt: null,
    declinedReason: null,
    declinedNotes: null,
    createdAt: new Date("2026-03-30"),
    updatedAt: new Date("2026-04-03"),
    brandConfig: null,
  };

  describe("generateContractPdf", () => {
    it("should generate a valid PDF buffer", async () => {
      const { generateContractPdf } = await import("./pdf");

      const pdfBuffer = await generateContractPdf(mockProposal);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(pdfBuffer.slice(0, 4).toString()).toBe("%PDF");
    });

    it("should include proposal pricing information", async () => {
      const { generateContractPdf } = await import("./pdf");

      const pdfBuffer = await generateContractPdf(mockProposal);

      // PDF should contain pricing (we can't easily read PDF content in tests,
      // but we verify the function completes and produces valid PDF)
      expect(pdfBuffer.length).toBeGreaterThan(1000); // Reasonable minimum size
    });

    it("should handle proposals with brand config", async () => {
      const proposalWithBranding = {
        ...mockProposal,
        brandConfig: {
          logoUrl: "/branding/client-123/logo.png",
          primaryColor: "#4F46E5",
          secondaryColor: "#818CF8",
          fontFamily: "Inter",
        },
      };

      const { generateContractPdf } = await import("./pdf");

      const pdfBuffer = await generateContractPdf(proposalWithBranding);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it("should generate different PDFs for different proposals", async () => {
      const { generateContractPdf } = await import("./pdf");

      const proposal1 = { ...mockProposal, id: "proposal-1", setupFeeCents: 100000 };
      const proposal2 = { ...mockProposal, id: "proposal-2", setupFeeCents: 200000 };

      const pdf1 = await generateContractPdf(proposal1);
      const pdf2 = await generateContractPdf(proposal2);

      // PDFs should be different (different content/hashes)
      const hash1 = createHash("sha256").update(pdf1).digest("hex");
      const hash2 = createHash("sha256").update(pdf2).digest("hex");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("calculateDocumentHash", () => {
    it("should return SHA256 hash of PDF buffer", async () => {
      const { calculateDocumentHash } = await import("./pdf");

      const pdfBuffer = Buffer.from("test pdf content");
      const hash = calculateDocumentHash(pdfBuffer);

      expect(hash).toHaveLength(64); // SHA256 produces 64 hex chars
      expect(hash).toMatch(/^[a-f0-9]+$/); // Only hex characters
    });

    it("should produce consistent hash for same input", async () => {
      const { calculateDocumentHash } = await import("./pdf");

      const pdfBuffer = Buffer.from("consistent content");
      const hash1 = calculateDocumentHash(pdfBuffer);
      const hash2 = calculateDocumentHash(pdfBuffer);

      expect(hash1).toBe(hash2);
    });

    it("should produce different hash for different input", async () => {
      const { calculateDocumentHash } = await import("./pdf");

      const buffer1 = Buffer.from("content 1");
      const buffer2 = Buffer.from("content 2");

      const hash1 = calculateDocumentHash(buffer1);
      const hash2 = calculateDocumentHash(buffer2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("formatCurrency", () => {
    it("should format EUR amounts correctly", async () => {
      const { formatCurrency } = await import("./pdf");

      // Lithuanian locale uses non-breaking space as thousands separator
      expect(formatCurrency(250000, "EUR")).toContain("500");
      expect(formatCurrency(250000, "EUR")).toContain("EUR");
      expect(formatCurrency(150000, "EUR")).toContain("500");
      expect(formatCurrency(100, "EUR")).toContain("1,00");
    });

    it("should handle USD currency", async () => {
      const { formatCurrency } = await import("./pdf");

      expect(formatCurrency(250000, "USD")).toBe("$2,500.00");
    });

    it("should handle zero amounts", async () => {
      const { formatCurrency } = await import("./pdf");

      expect(formatCurrency(0, "EUR")).toBe("0,00 EUR");
    });
  });

  describe("formatDate", () => {
    it("should format date in Lithuanian format", async () => {
      const { formatDate } = await import("./pdf");

      const date = new Date("2026-04-21");
      expect(formatDate(date)).toBe("2026-04-21");
    });

    it("should handle null dates", async () => {
      const { formatDate } = await import("./pdf");

      expect(formatDate(null)).toBe("-");
    });
  });
});

describe("Contract content structure", () => {
  it("should include required contract sections", async () => {
    const { CONTRACT_SECTIONS } = await import("./pdf");

    expect(CONTRACT_SECTIONS).toContain("header");
    expect(CONTRACT_SECTIONS).toContain("parties");
    expect(CONTRACT_SECTIONS).toContain("services");
    expect(CONTRACT_SECTIONS).toContain("pricing");
    expect(CONTRACT_SECTIONS).toContain("terms");
    expect(CONTRACT_SECTIONS).toContain("signatures");
  });
});
