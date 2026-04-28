/**
 * VoiceProfileService tests
 * Phase 37-03: Voice Profile Management
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceProfileService } from "./VoiceProfileService";
import { getTemplateDefaults } from "../templates/industryTemplates";

// Mock dependencies
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: () => "test-profile-id",
}));

// Import mocked db
import { db } from "@/db";

describe("VoiceProfileService", () => {
  let service: VoiceProfileService;

  beforeEach(() => {
    service = new VoiceProfileService();
    vi.clearAllMocks();
  });

  describe("create()", () => {
    it("inserts new profile with all dimensions", async () => {
      const mockProfile = {
        id: "test-profile-id",
        clientId: "client-123",
        mode: "best_practices",
        tonePrimary: "professional",
        toneSecondary: "friendly",
        formalityLevel: 5,
        personalityTraits: ["reliable"],
        archetype: "professional",
        sentenceLengthAvg: 15,
        paragraphLengthAvg: 4,
        contractionUsage: "sometimes",
        vocabularyPatterns: { preferred: [], avoided: [] },
        signaturePhrases: [],
        forbiddenPhrases: [],
        headingStyle: "sentence_case",
        confidenceScore: null,
        analyzedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProfile]),
        }),
      } as never);

      const result = await service.create("client-123", {
        tonePrimary: "professional",
        toneSecondary: "friendly",
        formalityLevel: 5,
      });

      expect(result).toEqual(mockProfile);
      expect(db.insert).toHaveBeenCalled();
    });

    it("applies template defaults when templateId provided", async () => {
      const healthcareDefaults = getTemplateDefaults("healthcare");
      expect(healthcareDefaults).toBeDefined();

      const mockProfile = {
        id: "test-profile-id",
        clientId: "client-123",
        mode: "best_practices",
        ...healthcareDefaults,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProfile]),
        }),
      } as never);

      const result = await service.createFromTemplate("client-123", "healthcare");

      expect(result.tonePrimary).toBe("empathetic");
      expect(result.formalityLevel).toBe(7);
    });

    it("throws error for unknown template", async () => {
      await expect(
        service.createFromTemplate("client-123", "unknown-template")
      ).rejects.toThrow("Unknown template: unknown-template");
    });
  });

  describe("getByClientId()", () => {
    it("returns profile when found", async () => {
      const mockProfile = {
        id: "profile-1",
        clientId: "client-123",
        mode: "application",
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockProfile]),
        }),
      } as never);

      const result = await service.getByClientId("client-123");

      expect(result).toEqual(mockProfile);
    });

    it("returns null when not found", async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const result = await service.getByClientId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("update()", () => {
    it("merges partial updates", async () => {
      const updatedProfile = {
        id: "profile-1",
        clientId: "client-123",
        tonePrimary: "updated-tone",
        formalityLevel: 8,
      };

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProfile]),
          }),
        }),
      } as never);

      const result = await service.update("profile-1", {
        tonePrimary: "updated-tone",
        formalityLevel: 8,
      });

      expect(result.tonePrimary).toBe("updated-tone");
      expect(result.formalityLevel).toBe(8);
    });
  });

  describe("delete()", () => {
    it("deletes profile (FK cascade handles voice_analysis)", async () => {
      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as never);

      await expect(service.delete("profile-1")).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("createFromTemplate()", () => {
    it("combines template with custom overrides", async () => {
      const mockProfile = {
        id: "test-profile-id",
        clientId: "client-123",
        mode: "application",
        tonePrimary: "empathetic",
        toneSecondary: "custom-override",
        formalityLevel: 7,
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProfile]),
        }),
      } as never);

      const result = await service.createFromTemplate("client-123", "healthcare", {
        mode: "application",
        toneSecondary: "custom-override",
      });

      expect(result.tonePrimary).toBe("empathetic"); // From template
      expect(result.toneSecondary).toBe("custom-override"); // Override
      expect(result.mode).toBe("application"); // Override
    });
  });
});
