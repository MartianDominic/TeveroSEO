import { describe, expect, it } from "vitest";

import {
  ensureStringId,
  ensureStringIds,
  ensureStringIdsArray,
  compareIds,
  isValidUuidString,
} from "./uuid-coercion";

describe("uuid-coercion", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  describe("ensureStringId", () => {
    it("returns string as-is", () => {
      expect(ensureStringId(validUuid)).toBe(validUuid);
    });

    it("returns empty string for null", () => {
      expect(ensureStringId(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(ensureStringId(undefined)).toBe("");
    });

    it("converts object with toString to string", () => {
      const uuidLikeObject = {
        toString: () => validUuid,
      };
      expect(ensureStringId(uuidLikeObject)).toBe(validUuid);
    });

    it("handles number input", () => {
      expect(ensureStringId(123)).toBe("123");
    });
  });

  describe("ensureStringIds", () => {
    it("coerces specified fields to strings", () => {
      const input = {
        id: { toString: () => validUuid },
        name: "Test Client",
        count: 5,
      };

      const result = ensureStringIds(input, ["id"]);

      expect(result.id).toBe(validUuid);
      expect(result.name).toBe("Test Client");
      expect(result.count).toBe(5);
    });

    it("does not mutate original object", () => {
      const uuidObj = { toString: () => validUuid };
      const input = { id: uuidObj };

      ensureStringIds(input, ["id"]);

      expect(input.id).toBe(uuidObj);
    });

    it("handles missing fields gracefully", () => {
      const input = { name: "Test" };
      const result = ensureStringIds(input, ["id" as keyof typeof input]);

      expect(result).toEqual({ name: "Test" });
    });
  });

  describe("ensureStringIdsArray", () => {
    it("coerces IDs in all array elements", () => {
      const input = [
        { id: { toString: () => "uuid-1" }, name: "Client 1" },
        { id: { toString: () => "uuid-2" }, name: "Client 2" },
      ];

      const result = ensureStringIdsArray(input, ["id"]);

      expect(result[0].id).toBe("uuid-1");
      expect(result[1].id).toBe("uuid-2");
    });
  });

  describe("compareIds", () => {
    it("returns true for equal string IDs", () => {
      expect(compareIds(validUuid, validUuid)).toBe(true);
    });

    it("returns true for string vs UUID object", () => {
      const uuidObj = { toString: () => validUuid };
      expect(compareIds(validUuid, uuidObj)).toBe(true);
    });

    it("returns true for both null/undefined", () => {
      expect(compareIds(null, undefined)).toBe(true);
    });

    it("returns false for different IDs", () => {
      expect(compareIds("uuid-1", "uuid-2")).toBe(false);
    });
  });

  describe("isValidUuidString", () => {
    it("returns true for valid UUID", () => {
      expect(isValidUuidString(validUuid)).toBe(true);
    });

    it("returns false for non-string", () => {
      expect(isValidUuidString(123)).toBe(false);
      expect(isValidUuidString(null)).toBe(false);
      expect(isValidUuidString({ toString: () => validUuid })).toBe(false);
    });

    it("returns false for invalid UUID format", () => {
      expect(isValidUuidString("not-a-uuid")).toBe(false);
      expect(isValidUuidString("123")).toBe(false);
    });
  });
});
