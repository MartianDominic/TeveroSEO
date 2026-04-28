/**
 * Voice Template Service
 * Phase 37-02: Voice API Layer
 *
 * CRUD operations for voice templates with system template seeding.
 */

import { db } from "@/db";
import {
  voiceTemplates,
  type VoiceTemplateSelect,
  type VoiceTemplateInsert,
} from "@/db/voice-schema";
import { eq, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { INDUSTRY_TEMPLATES } from "../templates/industryTemplates";

/**
 * Service for managing voice templates.
 *
 * @example
 * ```typescript
 * // List all templates
 * const templates = await voiceTemplateService.listAll();
 *
 * // Create custom template
 * const template = await voiceTemplateService.create({
 *   name: "My Template",
 *   industry: "custom",
 *   isSystem: false,
 *   templateConfig: { tonePrimary: "friendly" },
 * });
 *
 * // Seed system templates (run once on DB init)
 * await voiceTemplateService.seedSystemTemplates();
 * ```
 */
export const voiceTemplateService = {
  /**
   * List all templates ordered by name.
   *
   * @returns All templates sorted alphabetically
   */
  async listAll(): Promise<VoiceTemplateSelect[]> {
    return db.select().from(voiceTemplates).orderBy(asc(voiceTemplates.name));
  },

  /**
   * List templates by industry.
   *
   * @param industry - Industry identifier
   * @returns Templates for the specified industry
   */
  async listByIndustry(industry: string): Promise<VoiceTemplateSelect[]> {
    return db
      .select()
      .from(voiceTemplates)
      .where(eq(voiceTemplates.industry, industry))
      .orderBy(asc(voiceTemplates.name));
  },

  /**
   * Get template by ID.
   *
   * @param id - Template ID
   * @returns Template or null if not found
   */
  async getById(id: string): Promise<VoiceTemplateSelect | null> {
    const [result] = await db
      .select()
      .from(voiceTemplates)
      .where(eq(voiceTemplates.id, id))
      .limit(1);
    return result ?? null;
  },

  /**
   * Create a new template.
   *
   * @param data - Template data (without id)
   * @returns Created template
   */
  async create(
    data: Omit<VoiceTemplateInsert, "id">
  ): Promise<VoiceTemplateSelect> {
    const id = nanoid();
    const [result] = await db
      .insert(voiceTemplates)
      .values({ id, ...data })
      .returning();
    return result;
  },

  /**
   * Increment usage count for a template.
   *
   * @param id - Template ID
   */
  async incrementUsage(id: string): Promise<void> {
    await db
      .update(voiceTemplates)
      .set({ usageCount: sql`usage_count + 1` })
      .where(eq(voiceTemplates.id, id));
  },

  /**
   * Delete a template.
   * System templates cannot be deleted.
   *
   * @param id - Template ID
   * @throws Error if template is a system template
   */
  async delete(id: string): Promise<void> {
    const template = await this.getById(id);
    if (!template) return;

    if (template.isSystem) {
      throw new Error("Cannot delete system template");
    }

    await db.delete(voiceTemplates).where(eq(voiceTemplates.id, id));
  },

  /**
   * Seed all system templates.
   * Skips templates that already exist (idempotent).
   *
   * @returns Number of templates seeded
   */
  async seedSystemTemplates(): Promise<number> {
    let seeded = 0;

    for (const template of INDUSTRY_TEMPLATES) {
      const existing = await this.getById(template.id);
      if (existing) continue;

      await db.insert(voiceTemplates).values({
        id: template.id,
        name: template.name,
        description: template.description,
        industry: template.id,
        isSystem: true,
        templateConfig: template.defaults,
        usageCount: 0,
      });

      seeded++;
    }

    return seeded;
  },
};
