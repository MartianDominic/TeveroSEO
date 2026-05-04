/**
 * Voice Profile Service
 * Phase 37-03: Voice Profile Management
 *
 * CRUD operations for voice profiles with template support.
 * One profile per client (can be extended for multi-brand later).
 */
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  voiceProfiles,
  type VoiceProfileSelect,
  type VoiceProfileInsert,
} from "@/db/voice-schema";
import { getTemplateDefaults } from "../templates/industryTemplates";

/**
 * Service for managing voice profiles with template support.
 *
 * @example
 * ```typescript
 * // Create from scratch
 * const profile = await voiceProfileService.create("client-123", {
 *   tonePrimary: "professional",
 *   formalityLevel: 7,
 * });
 *
 * // Create from template with overrides
 * const profile = await voiceProfileService.createFromTemplate(
 *   "client-123",
 *   "healthcare",
 *   { mode: "application" }
 * );
 * ```
 */
export class VoiceProfileService {
  /**
   * Create a new voice profile.
   *
   * @param clientId - Client ID to associate profile with
   * @param data - Partial profile data (dimensions, mode, etc.)
   * @returns Created profile
   */
  async create(
    clientId: string,
    data: Partial<VoiceProfileInsert>
  ): Promise<VoiceProfileSelect> {
    const id = nanoid();
    const now = new Date();

    const [profile] = await db
      .insert(voiceProfiles)
      .values({
        id,
        clientId,
        mode: data.mode ?? "best_practices",
        tonePrimary: data.tonePrimary ?? null,
        toneSecondary: data.toneSecondary ?? null,
        formalityLevel: data.formalityLevel ?? null,
        personalityTraits: data.personalityTraits ?? null,
        archetype: data.archetype ?? null,
        sentenceLengthAvg: data.sentenceLengthAvg ?? null,
        paragraphLengthAvg: data.paragraphLengthAvg ?? null,
        contractionUsage: data.contractionUsage ?? null,
        vocabularyPatterns: data.vocabularyPatterns ?? null,
        signaturePhrases: data.signaturePhrases ?? null,
        forbiddenPhrases: data.forbiddenPhrases ?? null,
        headingStyle: data.headingStyle ?? null,
        confidenceScore: data.confidenceScore ?? null,
        analyzedAt: data.analyzedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return profile;
  }

  /**
   * Create a voice profile from an industry template.
   *
   * @param clientId - Client ID
   * @param templateId - Template ID (e.g., "healthcare", "legal")
   * @param overrides - Optional overrides to apply on top of template
   * @returns Created profile with template defaults + overrides
   * @throws Error if template not found
   */
  async createFromTemplate(
    clientId: string,
    templateId: string,
    overrides?: Partial<VoiceProfileInsert>
  ): Promise<VoiceProfileSelect> {
    const templateDefaults = getTemplateDefaults(templateId);

    if (!templateDefaults) {
      throw new Error(`Unknown template: ${templateId}`);
    }

    // Merge template defaults with overrides
    return this.create(clientId, {
      ...templateDefaults,
      ...overrides,
    });
  }

  /**
   * Get voice profile by client ID.
   * Returns null if no profile exists for the client.
   *
   * @param clientId - Client ID
   * @returns Profile or null
   */
  async getByClientId(clientId: string): Promise<VoiceProfileSelect | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.clientId, clientId));

    return profile ?? null;
  }

  /**
   * Get voice profile by profile ID (internal use only).
   *
   * WARNING: This method does NOT filter by workspace/client ownership.
   * Use getByIdScoped() for tenant-safe access.
   *
   * @param profileId - Profile ID
   * @returns Profile or null
   */
  async getById(profileId: string): Promise<VoiceProfileSelect | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.id, profileId));

    return profile ?? null;
  }

  /**
   * Get voice profile by profile ID with client ownership verification.
   * Returns null if profile doesn't exist OR belongs to different client.
   *
   * SECURITY: Use this for tenant-safe data access.
   *
   * @param profileId - Profile ID
   * @param clientId - Client ID for ownership verification
   * @returns Profile or null
   */
  async getByIdScoped(profileId: string, clientId: string): Promise<VoiceProfileSelect | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(
        and(
          eq(voiceProfiles.id, profileId),
          eq(voiceProfiles.clientId, clientId)
        )
      );

    return profile ?? null;
  }

  /**
   * Update a voice profile with partial data.
   * Only provided fields are updated.
   *
   * @param profileId - Profile ID to update
   * @param data - Partial update data
   * @returns Updated profile
   */
  async update(
    profileId: string,
    data: Partial<VoiceProfileInsert>
  ): Promise<VoiceProfileSelect> {
    const [updated] = await db
      .update(voiceProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, profileId))
      .returning();

    return updated;
  }

  /**
   * Delete a voice profile.
   * FK cascade will clean up voice_analysis and contentProtectionRules.
   *
   * @param profileId - Profile ID to delete
   */
  async delete(profileId: string): Promise<void> {
    await db.delete(voiceProfiles).where(eq(voiceProfiles.id, profileId));
  }

  /**
   * Upsert (get or create + update) a voice profile for a client.
   * Uses database-level ON CONFLICT to handle race conditions atomically.
   *
   * @param clientId - Client ID
   * @param data - Partial profile data to set/update
   * @returns Created or updated profile
   */
  async upsert(
    clientId: string,
    data: Partial<VoiceProfileInsert>
  ): Promise<VoiceProfileSelect> {
    const id = nanoid();
    const now = new Date();

    // Use atomic INSERT ON CONFLICT DO UPDATE to prevent race conditions
    // where two concurrent calls could both try to create a profile
    const [profile] = await db
      .insert(voiceProfiles)
      .values({
        id,
        clientId,
        mode: data.mode ?? "best_practices",
        tonePrimary: data.tonePrimary ?? null,
        toneSecondary: data.toneSecondary ?? null,
        formalityLevel: data.formalityLevel ?? null,
        personalityTraits: data.personalityTraits ?? null,
        archetype: data.archetype ?? null,
        sentenceLengthAvg: data.sentenceLengthAvg ?? null,
        paragraphLengthAvg: data.paragraphLengthAvg ?? null,
        contractionUsage: data.contractionUsage ?? null,
        vocabularyPatterns: data.vocabularyPatterns ?? null,
        signaturePhrases: data.signaturePhrases ?? null,
        forbiddenPhrases: data.forbiddenPhrases ?? null,
        headingStyle: data.headingStyle ?? null,
        confidenceScore: data.confidenceScore ?? null,
        analyzedAt: data.analyzedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: voiceProfiles.clientId,
        set: {
          ...data,
          updatedAt: now,
        },
      })
      .returning();

    return profile;
  }
}

/**
 * Singleton instance for use in server functions.
 */
export const voiceProfileService = new VoiceProfileService();
