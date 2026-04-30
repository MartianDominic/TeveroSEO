import { describe, it, expect } from "vitest";
import {
  createContractSchema,
  updateContractSchema,
  transitionContractSchema,
  type CreateContractInput,
  type TransitionContractInput,
} from "./contract.schema";

describe("contract.schema", () => {
  describe("createContractSchema", () => {
    it("validates valid input", () => {
      const input: CreateContractInput = {
        title: "SEO Services Contract",
        content: {
          sections: [
            { title: "Scope of Work", body: "SEO optimization services..." },
          ],
          terms: "Standard terms apply",
          signatures: [{ role: "Client" }],
        },
      };

      const result = createContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts optional fields", () => {
      const input = {
        title: "Contract",
        content: {
          sections: [{ title: "Section", body: "Content" }],
          terms: "Terms",
        },
        proposalId: "prop-123",
        clientId: "550e8400-e29b-41d4-a716-446655440000",
        expiresAt: "2026-12-31T23:59:59Z",
      };

      const result = createContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const input = {
        title: "",
        content: {
          sections: [{ title: "Section", body: "Content" }],
          terms: "Terms",
        },
      };

      const result = createContractSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("required");
      }
    });

    it("rejects empty sections array", () => {
      const input = {
        title: "Contract",
        content: {
          sections: [],
          terms: "Terms",
        },
      };

      const result = createContractSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects invalid clientId format", () => {
      const input = {
        title: "Contract",
        content: {
          sections: [{ title: "Section", body: "Content" }],
          terms: "Terms",
        },
        clientId: "not-a-uuid",
      };

      const result = createContractSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("updateContractSchema", () => {
    it("allows partial updates", () => {
      const input = {
        title: "Updated Title",
      };

      const result = updateContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      const result = updateContractSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("transitionContractSchema", () => {
    it("validates valid status transition", () => {
      const input: TransitionContractInput = {
        contractId: "contract-123",
        toState: "sent",
      };

      const result = transitionContractSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts all valid statuses", () => {
      const statuses = [
        "draft",
        "sent",
        "signed",
        "executed",
        "expired",
        "cancelled",
      ];

      statuses.forEach((status) => {
        const result = transitionContractSchema.safeParse({
          contractId: "contract-123",
          toState: status,
        });
        expect(result.success).toBe(true);
      });
    });

    it("rejects invalid status", () => {
      const input = {
        contractId: "contract-123",
        toState: "invalid_status",
      };

      const result = transitionContractSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid");
      }
    });

    it("rejects empty contractId", () => {
      const input = {
        contractId: "",
        toState: "sent",
      };

      const result = transitionContractSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("type exports", () => {
    it("CreateContractInput type is exported", () => {
      const input: CreateContractInput = {
        title: "Test",
        content: {
          sections: [{ title: "S", body: "B" }],
          terms: "T",
          signatures: [],
        },
      };
      expect(input.title).toBe("Test");
    });

    it("TransitionContractInput type is exported", () => {
      const input: TransitionContractInput = {
        contractId: "c-1",
        toState: "draft",
      };
      expect(input.toState).toBe("draft");
    });
  });
});
