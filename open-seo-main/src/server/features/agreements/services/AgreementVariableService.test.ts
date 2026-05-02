/**
 * Tests for AgreementVariableService
 * Phase 59: Agreement & Signing Excellence
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock db before importing the service
vi.mock("@/db/index", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  AgreementVariableService,
  type AgreementResolutionContext,
} from "./AgreementVariableService";

describe("AgreementVariableService", () => {
  const mockContext: AgreementResolutionContext = {
    agreement: {
      id: "agr-123",
      startDate: new Date("2026-05-01"),
      endDate: null,
      durationMonths: 12,
      signingCity: "Vilnius",
      paymentTerms: "NET-14",
      paymentDueDays: 14,
    },
    proposal: {
      id: "prop-123",
      setupFeeCents: 250000, // 2500 EUR
      monthlyFeeCents: 150000, // 1500 EUR
      currency: "EUR",
    },
    prospect: {
      id: "prsp-123",
      companyName: "UAB Acme",
      companyCode: "123456789",
      vatNumber: "LT123456789",
      address: "Gedimino pr. 1, Vilnius",
      contactName: "Jonas Jonaitis",
      contactEmail: "jonas@acme.lt",
    },
    workspace: {
      id: "ws-123",
      name: "TeveroSEO",
      companyName: "UAB TeveroSEO",
      companyCode: "987654321",
      vatNumber: "LT987654321",
      address: "Ukmerges g. 120, Vilnius",
      email: "info@teveroseo.com",
      phone: "+37060012345",
      bankAccount: "LT123456789012345678",
      bankName: "Swedbank",
      city: "Vilnius",
    },
    signers: [
      {
        id: "sig-1",
        role: "provider",
        name: "Petras Petraitis",
        title: "Direktorius",
        email: "petras@teveroseo.com",
        companyName: "UAB TeveroSEO",
      },
      {
        id: "sig-2",
        role: "client",
        name: "Jonas Jonaitis",
        title: "Direktorius",
        email: "jonas@acme.lt",
        companyName: "UAB Acme",
      },
    ],
    services: [
      { name: "Growth SEO Package", monthlyFeeCents: 150000, setupFeeCents: 200000 },
      { name: "GMB Optimization", monthlyFeeCents: 20000, setupFeeCents: 50000 },
    ],
    locale: "lt",
  };

  describe("resolveWithContext", () => {
    it("should resolve client.name from prospect", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      expect(resolved["client.name"].value).toBe("UAB Acme");
    });

    it("should resolve provider.name from workspace", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      expect(resolved["provider.name"].value).toBe("UAB TeveroSEO");
    });

    it("should resolve services.monthly with currency formatting", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      // Sum of 150000 + 20000 = 170000 cents = 1700 EUR
      expect(resolved["services.monthly"].value).toContain("1");
      expect(resolved["services.monthly"].value).toContain("700");
    });

    it("should resolve signer1.name from provider signer", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      expect(resolved["signer1.name"].value).toBe("Petras Petraitis");
      expect(resolved["signer1.title"].value).toBe("Direktorius");
    });

    it("should resolve signer2.name from client signer", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      expect(resolved["signer2.name"].value).toBe("Jonas Jonaitis");
      expect(resolved["signer2.title"].value).toBe("Direktorius");
    });

    it("should use LT locale for date formatting", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      // Lithuanian date format includes month name
      expect(resolved["agreement.startDate"].value).toMatch(/2026/);
    });

    it("should format service list as bullet points", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      expect(resolved["services.list"].value).toContain("- Growth SEO Package");
      expect(resolved["services.list"].value).toContain("- GMB Optimization");
    });

    it("should mark empty values with isEmpty flag", () => {
      const contextWithMissing: AgreementResolutionContext = {
        ...mockContext,
        prospect: { ...mockContext.prospect!, companyCode: undefined },
      };
      const resolved = AgreementVariableService.resolveWithContext(contextWithMissing);
      expect(resolved["client.companyCode"].isEmpty).toBe(true);
    });
  });

  describe("replaceInText", () => {
    it("should replace all variable placeholders", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      const text = "Agreement between {{provider.name}} and {{client.name}}";
      const result = AgreementVariableService.replaceInText(text, resolved);
      expect(result).toBe("Agreement between UAB TeveroSEO and UAB Acme");
    });

    it("should keep unknown variables unchanged", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      const text = "Value: {{unknown.variable}}";
      const result = AgreementVariableService.replaceInText(text, resolved);
      expect(result).toBe("Value: {{unknown.variable}}");
    });

    it("should handle multiple occurrences of same variable", () => {
      const resolved = AgreementVariableService.resolveWithContext(mockContext);
      const text = "{{client.name}} agrees that {{client.name}} will pay.";
      const result = AgreementVariableService.replaceInText(text, resolved);
      expect(result).toBe("UAB Acme agrees that UAB Acme will pay.");
    });
  });

  describe("getAvailableVariables", () => {
    it("should return variable list with LT labels for LT locale", () => {
      const vars = AgreementVariableService.getAvailableVariables("lt");
      const clientName = vars.find((v) => v.key === "client.name");
      expect(clientName?.label).toBe("Imones pavadinimas");
    });

    it("should return variable list with EN labels for EN locale", () => {
      const vars = AgreementVariableService.getAvailableVariables("en");
      const clientName = vars.find((v) => v.key === "client.name");
      expect(clientName?.label).toBe("Company name");
    });
  });
});
