/**
 * Tests for contract-schema.ts
 * Phase 45-01: Contract schema with state machine
 *
 * Tests verify table structure, column types, and exported constants.
 */
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  contracts,
  CONTRACT_STATUS,
  type ContractStatus,
  type ContractContent,
  type ContractSelect,
  type ContractInsert,
} from "./contract-schema";

describe("contract-schema", () => {
  describe("CONTRACT_STATUS", () => {
    it("contains exactly 6 status values", () => {
      expect(CONTRACT_STATUS).toHaveLength(6);
    });

    it("contains all expected values in order", () => {
      expect(CONTRACT_STATUS).toEqual([
        "draft",
        "sent",
        "signed",
        "executed",
        "expired",
        "cancelled",
      ]);
    });

    it("is a readonly array", () => {
      // TypeScript should prevent mutation at compile time
      // This test verifies the array is typed as const
      const status: ContractStatus = "draft";
      expect(CONTRACT_STATUS.includes(status)).toBe(true);
    });
  });

  describe("contracts table", () => {
    it("has expected columns", () => {
      const columns = getTableColumns(contracts);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("proposalId");
      expect(columnNames).toContain("title");
      expect(columnNames).toContain("content");
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("has e-signature fields", () => {
      const columns = getTableColumns(contracts);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("dokobitSessionId");
      expect(columnNames).toContain("signedPdfUrl");
      expect(columnNames).toContain("signedAt");
      expect(columnNames).toContain("signerName");
    });

    it("has lifecycle timestamp fields", () => {
      const columns = getTableColumns(contracts);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("sentAt");
      expect(columnNames).toContain("executedAt");
      expect(columnNames).toContain("expiresAt");
    });
  });

  describe("ContractContent type", () => {
    it("accepts valid content structure", () => {
      const content: ContractContent = {
        sections: [
          { title: "Scope of Work", body: "Description..." },
          { title: "Payment Terms", body: "Terms..." },
        ],
        terms: "Standard terms and conditions apply.",
        signatures: [
          { role: "Client", name: "John Doe" },
          { role: "Provider" },
        ],
      };

      expect(content.sections).toHaveLength(2);
      expect(content.terms).toBeDefined();
      expect(content.signatures).toHaveLength(2);
    });
  });

  describe("type exports", () => {
    it("exports ContractSelect type", () => {
      // Type-level test - just ensure these compile
      const select: Partial<ContractSelect> = {
        id: "test-id",
        status: "draft",
      };
      expect(select.id).toBe("test-id");
    });

    it("exports ContractInsert type", () => {
      const insert: Partial<ContractInsert> = {
        title: "Test Contract",
        status: "draft",
      };
      expect(insert.title).toBe("Test Contract");
    });
  });
});
