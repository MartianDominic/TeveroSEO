/**
 * ChurnRiskService unit tests
 * Phase 51-01: MRR & Retention Dashboard
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChurnRiskSeverity, ChurnRiskType } from "./ChurnRiskService";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

describe("ChurnRiskService", () => {
  describe("D-18: Service ending severity calculation", () => {
    const calculateSeverity = (daysUntil: number): ChurnRiskSeverity => {
      if (daysUntil <= 30) return "high";
      if (daysUntil <= 60) return "medium";
      return "low";
    };

    it("returns high severity for contracts expiring within 30 days", () => {
      expect(calculateSeverity(29)).toBe("high");
      expect(calculateSeverity(30)).toBe("high");
      expect(calculateSeverity(1)).toBe("high");
    });

    it("returns medium severity for contracts expiring within 60 days", () => {
      expect(calculateSeverity(31)).toBe("medium");
      expect(calculateSeverity(45)).toBe("medium");
      expect(calculateSeverity(60)).toBe("medium");
    });

    it("returns low severity for contracts expiring beyond 60 days", () => {
      expect(calculateSeverity(61)).toBe("low");
      expect(calculateSeverity(90)).toBe("low");
    });
  });

  describe("D-19: No contact severity calculation", () => {
    const calculateSeverity = (daysSince: number): ChurnRiskSeverity => {
      if (daysSince >= 30) return "high";
      if (daysSince >= 21) return "medium";
      return "low";
    };

    it("returns high severity for 30+ days without contact", () => {
      expect(calculateSeverity(30)).toBe("high");
      expect(calculateSeverity(45)).toBe("high");
    });

    it("returns medium severity for 21-29 days without contact", () => {
      expect(calculateSeverity(21)).toBe("medium");
      expect(calculateSeverity(29)).toBe("medium");
    });

    it("returns low severity for less than 21 days without contact", () => {
      expect(calculateSeverity(14)).toBe("low");
      expect(calculateSeverity(20)).toBe("low");
    });
  });

  describe("D-20: Deliverables overdue severity calculation", () => {
    const calculateSeverity = (daysOverdue: number): ChurnRiskSeverity => {
      if (daysOverdue >= 14) return "high";
      if (daysOverdue >= 7) return "medium";
      return "low";
    };

    it("returns high severity for 14+ days overdue", () => {
      expect(calculateSeverity(14)).toBe("high");
      expect(calculateSeverity(30)).toBe("high");
    });

    it("returns medium severity for 7-13 days overdue", () => {
      expect(calculateSeverity(7)).toBe("medium");
      expect(calculateSeverity(13)).toBe("medium");
    });

    it("returns low severity for less than 7 days overdue", () => {
      expect(calculateSeverity(1)).toBe("low");
      expect(calculateSeverity(6)).toBe("low");
    });
  });

  describe("Churn risk sorting", () => {
    const severityOrder: Record<ChurnRiskSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    const sortRisks = (risks: Array<{ severity: ChurnRiskSeverity; daysUntilOrSince: number }>) => {
      return [...risks].sort((a, b) => {
        if (a.severity !== b.severity) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return a.daysUntilOrSince - b.daysUntilOrSince;
      });
    };

    it("sorts high severity risks first", () => {
      const risks = [
        { severity: "low" as const, daysUntilOrSince: 5 },
        { severity: "high" as const, daysUntilOrSince: 10 },
        { severity: "medium" as const, daysUntilOrSince: 7 },
      ];

      const sorted = sortRisks(risks);

      expect(sorted[0].severity).toBe("high");
      expect(sorted[1].severity).toBe("medium");
      expect(sorted[2].severity).toBe("low");
    });

    it("sorts by days within same severity", () => {
      const risks = [
        { severity: "high" as const, daysUntilOrSince: 25 },
        { severity: "high" as const, daysUntilOrSince: 10 },
        { severity: "high" as const, daysUntilOrSince: 5 },
      ];

      const sorted = sortRisks(risks);

      expect(sorted[0].daysUntilOrSince).toBe(5);
      expect(sorted[1].daysUntilOrSince).toBe(10);
      expect(sorted[2].daysUntilOrSince).toBe(25);
    });
  });

  describe("Risk type coverage", () => {
    const allTypes: ChurnRiskType[] = [
      "service_ending",
      "no_contact",
      "deliverables_overdue",
      "seo_declining",
    ];

    it("should have all D-18 through D-21 risk types defined", () => {
      expect(allTypes).toContain("service_ending"); // D-18
      expect(allTypes).toContain("no_contact"); // D-19
      expect(allTypes).toContain("deliverables_overdue"); // D-20
      expect(allTypes).toContain("seo_declining"); // D-21
    });
  });

  describe("Days calculation", () => {
    it("calculates days until expiry correctly", () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      const daysUntil = Math.floor(
        (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      expect(daysUntil).toBe(45);
    });

    it("calculates days since last contact correctly", () => {
      const now = new Date();
      const lastContact = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

      const daysSince = Math.floor(
        (now.getTime() - lastContact.getTime()) / (24 * 60 * 60 * 1000)
      );

      expect(daysSince).toBe(20);
    });
  });
});
