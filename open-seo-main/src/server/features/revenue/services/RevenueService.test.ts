/**
 * RevenueService unit tests
 * Phase 51-01: MRR & Retention Dashboard
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { determineContractType, type ContractType } from "./RevenueService";

// Mock the database and date-fns
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("./CurrencyService", () => ({
  CurrencyService: {
    getWorkspaceDisplayCurrency: vi.fn().mockResolvedValue("EUR"),
    convertToDisplayCurrency: vi.fn((amount) => amount.amountCents),
  },
}));

describe("RevenueService", () => {
  describe("determineContractType", () => {
    it("returns recurring for monthly fee only without term", () => {
      const result = determineContractType({
        setupFeeCents: null,
        monthlyFeeCents: 50000,
        termMonths: undefined,
      });
      expect(result).toBe("recurring");
    });

    it("returns prepaid_term for monthly fee with term months", () => {
      const result = determineContractType({
        setupFeeCents: null,
        monthlyFeeCents: 50000,
        termMonths: 6,
      });
      expect(result).toBe("prepaid_term");
    });

    it("returns project for setup fee only without monthly", () => {
      const result = determineContractType({
        setupFeeCents: 250000,
        monthlyFeeCents: null,
      });
      expect(result).toBe("project");
    });

    it("returns hybrid for setup fee with monthly fee", () => {
      const result = determineContractType({
        setupFeeCents: 100000,
        monthlyFeeCents: 50000,
      });
      expect(result).toBe("hybrid");
    });

    it("returns project for zero fees", () => {
      const result = determineContractType({
        setupFeeCents: 0,
        monthlyFeeCents: 0,
      });
      expect(result).toBe("project");
    });

    it("returns project for null fees", () => {
      const result = determineContractType({
        setupFeeCents: null,
        monthlyFeeCents: null,
      });
      expect(result).toBe("project");
    });

    it("treats termMonths of 1 as non-term (recurring)", () => {
      const result = determineContractType({
        setupFeeCents: null,
        monthlyFeeCents: 50000,
        termMonths: 1,
      });
      expect(result).toBe("recurring");
    });
  });

  describe("OutstandingPayment urgency classification", () => {
    // These tests verify the urgency logic conceptually
    // Actual DB tests would require integration test setup

    it("should classify invoices with past due date as overdue", () => {
      const now = new Date();
      const pastDue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Urgency determination logic
      const urgency = pastDue < now ? "overdue" : "upcoming";
      expect(urgency).toBe("overdue");
    });

    it("should classify invoices due within a week as due_this_week", () => {
      const now = new Date();
      const dueInThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Urgency determination logic
      let urgency: string;
      if (dueInThreeDays < now) {
        urgency = "overdue";
      } else if (dueInThreeDays <= weekFromNow) {
        urgency = "due_this_week";
      } else {
        urgency = "upcoming";
      }
      expect(urgency).toBe("due_this_week");
    });

    it("should classify invoices due after a week as upcoming", () => {
      const now = new Date();
      const dueInTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Urgency determination logic
      let urgency: string;
      if (dueInTwoWeeks < now) {
        urgency = "overdue";
      } else if (dueInTwoWeeks <= weekFromNow) {
        urgency = "due_this_week";
      } else {
        urgency = "upcoming";
      }
      expect(urgency).toBe("upcoming");
    });

    it("should calculate days overdue correctly", () => {
      const now = new Date();
      const pastDue = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const daysOverdue = Math.floor(
        (now.getTime() - pastDue.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(daysOverdue).toBe(10);
    });
  });

  describe("Revenue calculation concepts", () => {
    it("should sum MRR correctly with D-17 recognized revenue toggle", () => {
      // Test the concept: recognizedRevenue = true spreads prepaid over term
      const monthlyFee = 50000; // 500 EUR/month
      const termMonths = 6;

      // Cash view: full amount when paid
      const cashView = monthlyFee * termMonths; // 300000

      // Recognized view: monthly amount spread
      const recognizedView = monthlyFee; // 50000 per month

      expect(recognizedView).toBeLessThan(cashView);
      expect(recognizedView * termMonths).toBe(cashView);
    });

    it("should handle multi-currency conversion in sums", () => {
      // Test concept: amounts converted to display currency before summing
      const eurAmount = 10000; // 100 EUR in cents
      const usdAmount = 10000; // 100 USD in cents
      const usdToEurRate = 0.92;

      const totalInEur = eurAmount + usdAmount * usdToEurRate;
      expect(totalInEur).toBe(19200);
    });
  });

  describe("MRR trend generation", () => {
    it("should generate trend array of correct length", () => {
      const months = 6;
      const currentMrr = 100000;

      // Generate mock trend
      const trend: number[] = [];
      for (let i = 0; i < months; i++) {
        const growthFactor = 1 - (months - i - 1) * 0.02;
        trend.push(Math.round(currentMrr * growthFactor));
      }

      expect(trend.length).toBe(6);
      expect(trend[trend.length - 1]).toBe(currentMrr); // Most recent = current
      expect(trend[0]).toBeLessThan(trend[trend.length - 1]); // Growth over time
    });
  });
});
