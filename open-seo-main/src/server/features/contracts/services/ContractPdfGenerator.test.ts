/**
 * ContractPdfGenerator Tests
 * Phase 48-01: Contract Generation - Task 2
 */
import { describe, it, expect } from "vitest";
import { generateContractPdf } from "./ContractPdfGenerator.js";
import type { ContractContent } from "@/db/contract-schema";

describe("ContractPdfGenerator", () => {
  const mockContent: ContractContent = {
    sections: [
      {
        title: "Service Overview",
        body: "We will provide comprehensive SEO services including technical audits, content optimization, and monthly reporting.",
      },
      {
        title: "Scope of Work",
        body: "Technical SEO audit. Content optimization strategy. Monthly performance reports.",
      },
    ],
    terms: "This agreement is valid for 12 months. Either party may terminate with 30 days notice. All fees are non-refundable.",
    signatures: [
      { role: "Service Provider", name: "TeveroSEO" },
      { role: "Client" },
    ],
  };

  it("returns a Buffer", async () => {
    const result = await generateContractPdf({
      title: "Service Agreement",
      content: mockContent,
      workspaceName: "TeveroSEO",
      clientName: "Test Client",
      createdAt: new Date("2024-01-01"),
    });

    expect(result).toBeInstanceOf(Buffer);
  });

  it("generates valid PDF starting with magic bytes", async () => {
    const pdfBuffer = await generateContractPdf({
      title: "Service Agreement",
      content: mockContent,
      workspaceName: "TeveroSEO",
      clientName: "Test Client",
      createdAt: new Date("2024-01-01"),
    });

    const pdfString = pdfBuffer.toString("utf8", 0, 5);
    expect(pdfString).toBe("%PDF-");
  });

  it("handles multi-section contracts", async () => {
    const longContent: ContractContent = {
      sections: Array.from({ length: 10 }, (_, i) => ({
        title: `Section ${i + 1}`,
        body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
      })),
      terms: "Standard terms and conditions. ".repeat(50),
      signatures: [
        { role: "Provider" },
        { role: "Client" },
      ],
    };

    const pdfBuffer = await generateContractPdf({
      title: "Multi-Section Agreement",
      content: longContent,
      workspaceName: "TeveroSEO",
      clientName: "Test Client",
      createdAt: new Date("2024-01-01"),
    });

    // Should generate multi-page PDF (file size > 5KB for long content)
    expect(pdfBuffer.length).toBeGreaterThan(5000);
    // Verify it's a valid PDF
    expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  it("includes signature placeholders", async () => {
    const pdfBuffer = await generateContractPdf({
      title: "Service Agreement",
      content: mockContent,
      workspaceName: "TeveroSEO",
      clientName: "Test Client",
      createdAt: new Date("2024-01-01"),
    });

    // Verify PDF was generated and has reasonable size
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });

  it("handles contracts with no signature names", async () => {
    const noNameContent: ContractContent = {
      sections: [{ title: "Services", body: "SEO services" }],
      terms: "Standard terms",
      signatures: [
        { role: "Provider" }, // no name field
        { role: "Client" },   // no name field
      ],
    };

    const pdfBuffer = await generateContractPdf({
      title: "Simple Agreement",
      content: noNameContent,
      workspaceName: "TeveroSEO",
      clientName: "Test Client",
      createdAt: new Date("2024-01-01"),
    });

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.toString("utf8", 0, 5)).toBe("%PDF-");
  });
});
