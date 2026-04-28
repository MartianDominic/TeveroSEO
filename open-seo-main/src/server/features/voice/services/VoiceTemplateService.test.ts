/**
 * VoiceTemplateService Tests
 * Phase 37-02: Voice API Layer
 *
 * TDD RED phase: Tests written first, implementation follows.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/db";
import { voiceTemplates } from "@/db/voice-schema";
import { eq } from "drizzle-orm";
import { voiceTemplateService } from "./VoiceTemplateService";
import { INDUSTRY_TEMPLATES } from "../templates/industryTemplates";

describe("VoiceTemplateService", () => {
  // Clean up before each test
  beforeEach(async () => {
    await db.delete(voiceTemplates);
  });

  afterEach(async () => {
    await db.delete(voiceTemplates);
  });

  describe("listAll", () => {
    it("should return all templates ordered by name", async () => {
      // Insert test templates
      await db.insert(voiceTemplates).values([
        {
          id: "test-1",
          name: "Zebra Template",
          description: "Last alphabetically",
          industry: "technology",
          isSystem: false,
          templateConfig: {},
          usageCount: 0,
        },
        {
          id: "test-2",
          name: "Alpha Template",
          description: "First alphabetically",
          industry: "healthcare",
          isSystem: false,
          templateConfig: {},
          usageCount: 0,
        },
      ]);

      const templates = await voiceTemplateService.listAll();

      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe("Alpha Template");
      expect(templates[1].name).toBe("Zebra Template");
    });
  });

  describe("listByIndustry", () => {
    it("should return only templates for specified industry", async () => {
      await db.insert(voiceTemplates).values([
        {
          id: "healthcare-1",
          name: "Healthcare Template",
          description: null,
          industry: "healthcare",
          isSystem: true,
          templateConfig: {},
          usageCount: 0,
        },
        {
          id: "legal-1",
          name: "Legal Template",
          description: null,
          industry: "legal",
          isSystem: true,
          templateConfig: {},
          usageCount: 0,
        },
      ]);

      const templates = await voiceTemplateService.listByIndustry("healthcare");

      expect(templates).toHaveLength(1);
      expect(templates[0].industry).toBe("healthcare");
    });
  });

  describe("getById", () => {
    it("should return template by ID", async () => {
      await db.insert(voiceTemplates).values({
        id: "template-123",
        name: "Test Template",
        description: "Test description",
        industry: "technology",
        isSystem: false,
        templateConfig: { tonePrimary: "professional" },
        usageCount: 5,
      });

      const template = await voiceTemplateService.getById("template-123");

      expect(template).not.toBeNull();
      expect(template?.name).toBe("Test Template");
      expect(template?.usageCount).toBe(5);
    });

    it("should return null for non-existent ID", async () => {
      const template = await voiceTemplateService.getById("nonexistent");
      expect(template).toBeNull();
    });
  });

  describe("create", () => {
    it("should insert new template and return it", async () => {
      const template = await voiceTemplateService.create({
        name: "New Template",
        description: "Custom template",
        industry: "ecommerce",
        isSystem: false,
        templateConfig: { formalityLevel: 5 },
        usageCount: 0,
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe("New Template");
      expect(template.industry).toBe("ecommerce");
      expect(template.isSystem).toBe(false);

      // Verify it was actually inserted
      const found = await db
        .select()
        .from(voiceTemplates)
        .where(eq(voiceTemplates.id, template.id));
      expect(found).toHaveLength(1);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usageCount by 1", async () => {
      const template = await voiceTemplateService.create({
        name: "Usage Test",
        description: null,
        industry: "technology",
        isSystem: true,
        templateConfig: {},
        usageCount: 10,
      });

      await voiceTemplateService.incrementUsage(template.id);

      const updated = await voiceTemplateService.getById(template.id);
      expect(updated?.usageCount).toBe(11);

      // Increment again
      await voiceTemplateService.incrementUsage(template.id);
      const updated2 = await voiceTemplateService.getById(template.id);
      expect(updated2?.usageCount).toBe(12);
    });
  });

  describe("delete", () => {
    it("should remove template if isSystem is false", async () => {
      const template = await voiceTemplateService.create({
        name: "Deletable",
        description: null,
        industry: "technology",
        isSystem: false,
        templateConfig: {},
        usageCount: 0,
      });

      await voiceTemplateService.delete(template.id);

      const found = await voiceTemplateService.getById(template.id);
      expect(found).toBeNull();
    });

    it("should throw error if template isSystem is true", async () => {
      const template = await voiceTemplateService.create({
        name: "System Template",
        description: null,
        industry: "healthcare",
        isSystem: true,
        templateConfig: {},
        usageCount: 0,
      });

      await expect(voiceTemplateService.delete(template.id)).rejects.toThrow(
        "Cannot delete system template"
      );

      // Verify it still exists
      const found = await voiceTemplateService.getById(template.id);
      expect(found).not.toBeNull();
    });
  });

  describe("seedSystemTemplates", () => {
    it("should insert all 8 industry templates with isSystem=true", async () => {
      await voiceTemplateService.seedSystemTemplates();

      const templates = await voiceTemplateService.listAll();

      expect(templates).toHaveLength(8);

      // Verify each industry template was inserted
      for (const industryTemplate of INDUSTRY_TEMPLATES) {
        const found = templates.find((t) => t.id === industryTemplate.id);
        expect(found).toBeDefined();
        expect(found?.name).toBe(industryTemplate.name);
        expect(found?.isSystem).toBe(true);
        expect(found?.usageCount).toBe(0);
      }
    });

    it("should skip templates that already exist", async () => {
      // Insert one template manually
      await db.insert(voiceTemplates).values({
        id: "healthcare",
        name: "Healthcare",
        description: "Existing",
        industry: "healthcare",
        isSystem: true,
        templateConfig: {},
        usageCount: 5,
      });

      await voiceTemplateService.seedSystemTemplates();

      const templates = await voiceTemplateService.listAll();
      expect(templates).toHaveLength(8);

      // Original healthcare template should be unchanged
      const healthcare = templates.find((t) => t.id === "healthcare");
      expect(healthcare?.description).toBe("Existing");
      expect(healthcare?.usageCount).toBe(5);
    });
  });
});
