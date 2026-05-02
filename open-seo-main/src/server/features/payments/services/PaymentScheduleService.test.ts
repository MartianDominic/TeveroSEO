/**
 * PaymentScheduleService Tests
 * Phase 60-01: Payment Flexibility & Split Payments
 *
 * Tests for calculatePlan function and installment calculations.
 * Uses the pure calculatePlan module to avoid db dependencies during tests.
 */
import { describe, it, expect } from "vitest";
import { calculatePlan } from "./calculatePlan";

describe("PaymentScheduleService", () => {
  describe("calculatePlan", () => {
    describe("full plan", () => {
      it("returns 1 installment of 420000 cents due today", () => {
        const plan = calculatePlan(420000, "full");

        expect(plan.type).toBe("full");
        expect(plan.installments).toHaveLength(1);
        expect(plan.installments[0].number).toBe(1);
        expect(plan.installments[0].amountCents).toBe(420000);
        expect(plan.installments[0].label).toBe("Today");
        expect(plan.totalAmountCents).toBe(420000);
      });

      it("handles small amounts", () => {
        const plan = calculatePlan(100, "full");

        expect(plan.installments[0].amountCents).toBe(100);
      });
    });

    describe("split_2 plan (50/50)", () => {
      it("returns [210000 today, 210000 in 30 days] for 420000 cents", () => {
        const startDate = new Date("2026-05-02");
        const plan = calculatePlan(420000, "split_2", startDate);

        expect(plan.type).toBe("split_2");
        expect(plan.installments).toHaveLength(2);

        // First installment: 50% = 210000
        expect(plan.installments[0].number).toBe(1);
        expect(plan.installments[0].amountCents).toBe(210000);
        expect(plan.installments[0].label).toBe("Today");
        expect(plan.installments[0].dueDate).toEqual(startDate);

        // Second installment: 50% = 210000
        expect(plan.installments[1].number).toBe(2);
        expect(plan.installments[1].amountCents).toBe(210000);
        expect(plan.installments[1].label).toBe("In 30 days");

        // Check 30 days later
        const expectedSecondDate = new Date("2026-06-01");
        expect(plan.installments[1].dueDate).toEqual(expectedSecondDate);

        expect(plan.totalAmountCents).toBe(420000);
      });

      it("uses Math.ceil for first installment on odd amounts", () => {
        // 421001 / 2 = 210500.5, should ceil to 210501
        const plan = calculatePlan(421001, "split_2");

        expect(plan.installments[0].amountCents).toBe(210501);
        expect(plan.installments[1].amountCents).toBe(210500);

        // Total should still be exact
        const total = plan.installments.reduce(
          (sum, i) => sum + i.amountCents,
          0
        );
        expect(total).toBe(421001);
      });

      it("handles very small amounts correctly", () => {
        // 1 cent: should be 1 + 0 = 1
        const plan = calculatePlan(1, "split_2");

        expect(plan.installments[0].amountCents).toBe(1);
        expect(plan.installments[1].amountCents).toBe(0);
      });
    });

    describe("split_3 plan (40/30/30)", () => {
      it("returns [168000 (40%), 126000 (30%), 126000 (30%)] for 420000 cents", () => {
        const startDate = new Date("2026-05-02");
        const plan = calculatePlan(420000, "split_3", startDate);

        expect(plan.type).toBe("split_3");
        expect(plan.installments).toHaveLength(3);

        // First installment: 40% = 168000
        expect(plan.installments[0].number).toBe(1);
        expect(plan.installments[0].amountCents).toBe(168000);
        expect(plan.installments[0].label).toBe("Today");
        expect(plan.installments[0].dueDate).toEqual(startDate);

        // Second installment: 30% = 126000
        expect(plan.installments[1].number).toBe(2);
        expect(plan.installments[1].amountCents).toBe(126000);
        expect(plan.installments[1].label).toBe("In 30 days");
        expect(plan.installments[1].dueDate).toEqual(new Date("2026-06-01"));

        // Third installment: 30% = 126000
        expect(plan.installments[2].number).toBe(3);
        expect(plan.installments[2].amountCents).toBe(126000);
        expect(plan.installments[2].label).toBe("In 60 days");
        expect(plan.installments[2].dueDate).toEqual(new Date("2026-07-01"));

        expect(plan.totalAmountCents).toBe(420000);
      });

      it("uses Math.ceil for first and second installments on odd amounts", () => {
        // 100000 cents
        // 40% = 40000
        // 30% = 30000
        // 30% = 30000
        const plan = calculatePlan(100000, "split_3");

        expect(plan.installments[0].amountCents).toBe(40000);
        expect(plan.installments[1].amountCents).toBe(30000);
        expect(plan.installments[2].amountCents).toBe(30000);

        // Total should be exact
        const total = plan.installments.reduce(
          (sum, i) => sum + i.amountCents,
          0
        );
        expect(total).toBe(100000);
      });

      it("handles amounts that dont divide evenly", () => {
        // 100001 cents
        // 40% = Math.ceil(40000.4) = 40001
        // 30% = Math.ceil(30000.3) = 30001
        // Remainder = 100001 - 40001 - 30001 = 29999
        const plan = calculatePlan(100001, "split_3");

        expect(plan.installments[0].amountCents).toBe(40001);
        expect(plan.installments[1].amountCents).toBe(30001);
        expect(plan.installments[2].amountCents).toBe(29999);

        // Total should be exact
        const total = plan.installments.reduce(
          (sum, i) => sum + i.amountCents,
          0
        );
        expect(total).toBe(100001);
      });

      it("handles very small amounts", () => {
        // 3 cents: should be 2 + 1 + 0 = 3
        const plan = calculatePlan(3, "split_3");

        const total = plan.installments.reduce(
          (sum, i) => sum + i.amountCents,
          0
        );
        expect(total).toBe(3);
      });
    });

    describe("validation", () => {
      it("throws for zero amount", () => {
        expect(() => calculatePlan(0, "full")).toThrow(
          "Total amount must be positive"
        );
      });

      it("throws for negative amount", () => {
        expect(() => calculatePlan(-100, "full")).toThrow(
          "Total amount must be positive"
        );
      });

      it("throws for invalid plan type", () => {
        // @ts-expect-error Testing invalid input
        expect(() => calculatePlan(100, "invalid")).toThrow(
          "Invalid plan type"
        );
      });
    });

    describe("date calculations", () => {
      it("calculates correct dates from custom start date", () => {
        const startDate = new Date("2026-01-15");
        const plan = calculatePlan(100000, "split_3", startDate);

        expect(plan.installments[0].dueDate).toEqual(new Date("2026-01-15"));
        expect(plan.installments[1].dueDate).toEqual(new Date("2026-02-14"));
        expect(plan.installments[2].dueDate).toEqual(new Date("2026-03-16"));
      });

      it("handles month-end edge cases", () => {
        // Starting on Jan 31
        const startDate = new Date("2026-01-31");
        const plan = calculatePlan(100000, "split_2", startDate);

        // 30 days from Jan 31 is March 2
        expect(plan.installments[1].dueDate).toEqual(new Date("2026-03-02"));
      });
    });
  });
});
