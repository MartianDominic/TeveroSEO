/**
 * ProtectionRulesService tests
 * Phase 37-03: Voice Profile Management
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProtectionRulesService } from "./ProtectionRulesService";

// Mock dependencies
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: () => "test-rule-id",
}));

import { db } from "@/db";

describe("ProtectionRulesService", () => {
  let service: ProtectionRulesService;

  beforeEach(() => {
    service = new ProtectionRulesService();
    vi.clearAllMocks();
  });

  describe("create()", () => {
    it("inserts rule with type, target, optional expiration", async () => {
      const mockRule = {
        id: "test-rule-id",
        profileId: "profile-123",
        ruleType: "page",
        target: "https://example.com/about",
        reason: "Brand messaging",
        createdBy: "user-1",
        expiresAt: null,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRule]),
        }),
      } as never);

      const result = await service.create("profile-123", {
        ruleType: "page",
        target: "https://example.com/about",
        reason: "Brand messaging",
        createdBy: "user-1",
      });

      expect(result).toEqual(mockRule);
      expect(db.insert).toHaveBeenCalled();
    });

    it("validates URL format for page type", async () => {
      // Empty target should throw
      await expect(
        service.create("profile-123", {
          ruleType: "page",
          target: "",
          reason: "Test",
          createdBy: "user-1",
        })
      ).rejects.toThrow("Invalid URL or path");
    });

    it("validates regex for pattern type", async () => {
      await expect(
        service.create("profile-123", {
          ruleType: "pattern",
          target: "[invalid regex",
          reason: "Test",
          createdBy: "user-1",
        })
      ).rejects.toThrow("Invalid regex pattern");
    });
  });

  describe("getByProfileId()", () => {
    it("returns all rules for profile", async () => {
      const mockRules = [
        { id: "rule-1", profileId: "profile-123", ruleType: "page" },
        { id: "rule-2", profileId: "profile-123", ruleType: "section" },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRules),
        }),
      } as never);

      const result = await service.getByProfileId("profile-123");

      expect(result).toHaveLength(2);
    });
  });

  describe("delete()", () => {
    it("removes single rule", async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await expect(service.delete("rule-1")).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("validateTarget()", () => {
    it("validates CSS selector for section type", () => {
      // Valid selectors should not throw
      expect(() => service.validateTarget("section", ".header")).not.toThrow();
      expect(() => service.validateTarget("section", "#main-nav")).not.toThrow();
      expect(() => service.validateTarget("section", "div.content > p")).not.toThrow();
    });

    it("validates regex pattern", () => {
      expect(() => service.validateTarget("pattern", "^Copyright.*$")).not.toThrow();
      expect(() => service.validateTarget("pattern", "[")).toThrow("Invalid regex pattern");
    });

    it("validates URL for page type", () => {
      expect(() => service.validateTarget("page", "https://example.com")).not.toThrow();
      expect(() => service.validateTarget("page", "/relative/path")).not.toThrow();
      expect(() => service.validateTarget("page", "")).toThrow("Invalid URL or path");
    });
  });

  describe("bulkImportCsv()", () => {
    it("parses CSV and creates multiple rules", async () => {
      const csv = `rule_type,target,reason,expires_at
page,https://example.com/about,Brand page,
section,.hero-section,Hero content,2026-12-31
pattern,^Contact us.*,Contact info,`;

      const mockRule = { id: "test-rule-id" };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRule]),
        }),
      } as never);

      const result = await service.bulkImportCsv("profile-123", csv, "user-1");

      expect(result.imported).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it("skips invalid rows with error report", async () => {
      const csv = `rule_type,target,reason,expires_at
page,https://example.com/valid,Valid rule,
invalid_type,something,Invalid type,
pattern,[bad-regex,Bad regex,`;

      const mockRule = { id: "test-rule-id" };
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockRule]),
        }),
      } as never);

      const result = await service.bulkImportCsv("profile-123", csv, "user-1");

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row).toBe(3);
      expect(result.errors[1].row).toBe(4);
    });

    it("enforces 500 row limit (T-37-08 DoS mitigation)", async () => {
      // Generate CSV with 501 rows
      const rows = ["rule_type,target,reason,expires_at"];
      for (let i = 0; i < 501; i++) {
        rows.push(`page,https://example.com/page${i},Test,`);
      }
      const csv = rows.join("\n");

      await expect(service.bulkImportCsv("profile-123", csv, "user-1")).rejects.toThrow(
        "CSV exceeds maximum 500 rows"
      );
    });
  });

  describe("getActiveRules()", () => {
    it("excludes expired rules", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000);
      const past = new Date(now.getTime() - 86400000);

      const mockRules = [
        { id: "rule-1", expiresAt: null },
        { id: "rule-2", expiresAt: future },
        // rule-3 with past date would be filtered by SQL
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRules),
        }),
      } as never);

      const result = await service.getActiveRules("profile-123");

      expect(result).toHaveLength(2);
    });
  });
});
