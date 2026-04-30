/**
 * Tests for invoice-schema.ts
 * Phase 45-02: Invoice schema with Stripe integration
 *
 * Tests verify table structure, status enum, Stripe fields, and type exports.
 */
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  invoices,
  invoicesRelations,
  INVOICE_STATUS,
  type InvoiceStatus,
  type InvoiceLineItem,
  type InvoiceSelect,
  type InvoiceInsert,
} from "./invoice-schema";

describe("invoice-schema", () => {
  describe("INVOICE_STATUS", () => {
    it("contains exactly 6 status values", () => {
      expect(INVOICE_STATUS).toHaveLength(6);
    });

    it("contains all expected values in order", () => {
      expect(INVOICE_STATUS).toEqual([
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
      ]);
    });

    it("is a readonly array", () => {
      const status: InvoiceStatus = "paid";
      expect(INVOICE_STATUS.includes(status)).toBe(true);
    });
  });

  describe("invoices table", () => {
    it("has expected columns", () => {
      const columns = getTableColumns(invoices);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("invoiceNumber");
      expect(columnNames).toContain("lineItems");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("has Stripe integration fields", () => {
      const columns = getTableColumns(invoices);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("stripeInvoiceId");
      expect(columnNames).toContain("stripePaymentIntentId");
      expect(columnNames).toContain("stripePaymentUrl");
    });

    it("has amount columns in cents", () => {
      const columns = getTableColumns(invoices);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("subtotalCents");
      expect(columnNames).toContain("taxCents");
      expect(columnNames).toContain("totalCents");
      expect(columnNames).toContain("currency");
    });

    it("has lifecycle timestamp fields", () => {
      const columns = getTableColumns(invoices);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("sentAt");
      expect(columnNames).toContain("paidAt");
      expect(columnNames).toContain("dueAt");
    });

    it("has status with default 'draft'", () => {
      const columns = getTableColumns(invoices);
      expect(columns.status.notNull).toBe(true);
      expect(columns.status.hasDefault).toBe(true);
      expect(columns.status.default).toBe("draft");
    });

    it("has contractId for linking to contracts", () => {
      const columns = getTableColumns(invoices);
      const columnNames = Object.keys(columns);
      expect(columnNames).toContain("contractId");
    });
  });

  describe("InvoiceLineItem type", () => {
    it("accepts valid line item structure", () => {
      const lineItem: InvoiceLineItem = {
        id: "li-001",
        description: "SEO Audit - Monthly",
        quantity: 1,
        unitPriceCents: 50000,
        totalCents: 50000,
      };

      expect(lineItem.id).toBe("li-001");
      expect(lineItem.totalCents).toBe(50000);
    });

    it("validates line items array", () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: "li-001",
          description: "SEO Setup Fee",
          quantity: 1,
          unitPriceCents: 100000,
          totalCents: 100000,
        },
        {
          id: "li-002",
          description: "Monthly Retainer",
          quantity: 3,
          unitPriceCents: 50000,
          totalCents: 150000,
        },
      ];

      expect(lineItems).toHaveLength(2);
      expect(lineItems.reduce((sum, li) => sum + li.totalCents, 0)).toBe(250000);
    });
  });

  describe("type exports", () => {
    it("exports InvoiceSelect type", () => {
      const select: Partial<InvoiceSelect> = {
        id: "inv-001",
        status: "draft",
        totalCents: 50000,
      };
      expect(select.id).toBe("inv-001");
    });

    it("exports InvoiceInsert type", () => {
      const insert: Partial<InvoiceInsert> = {
        invoiceNumber: "INV-2026-001",
        status: "draft",
      };
      expect(insert.invoiceNumber).toBe("INV-2026-001");
    });
  });

  describe("invoicesRelations", () => {
    it("exports relations object", () => {
      expect(invoicesRelations).toBeDefined();
    });
  });
});
