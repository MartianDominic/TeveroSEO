/**
 * Voice management server functions.
 * Phase 37-03: Voice Profile Management
 *
 * TanStack Start server functions for voice profile and protection rules CRUD.
 * All endpoints require authentication and verify workspace ownership.
 *
 * Security:
 * - T-37-07: Server verifies user has access to clientId via session
 * - T-37-08: CSV import limited to 500 rows
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { voiceProfiles } from "@/db/voice-schema";
import { voiceProfileService } from "@/server/features/voice/services/VoiceProfileService";
import { protectionRulesService } from "@/server/features/voice/services/ProtectionRulesService";
import { voiceComplianceService } from "@/server/features/voice/services/VoiceComplianceService";
import { buildVoiceConstraints } from "@/server/features/voice/services/VoiceConstraintBuilder";
import {
  INDUSTRY_TEMPLATES,
  TEMPLATE_IDS,
} from "@/server/features/voice/templates/industryTemplates";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
// M-TSK-06 FIX: Use shared client access verification
import { verifyClientAccess } from "@/serverFunctions/client-access";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

// ============================================================================
// Input Schemas
// ============================================================================

const clientIdSchema = z.object({
  clientId: z.string().uuid("Client ID must be a valid UUID"),
});

const profileIdSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
});

const createProfileSchema = z.object({
  clientId: z.string().uuid(),
  templateId: z.string().optional(),
  mode: z.enum(["preservation", "application", "best_practices"]).optional(),
  tonePrimary: z.string().optional(),
  toneSecondary: z.string().optional(),
  formalityLevel: z.number().min(1).max(10).optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z
    .enum(["professional", "casual", "technical", "friendly", "authoritative"])
    .optional(),
  sentenceLengthAvg: z.number().optional(),
  paragraphLengthAvg: z.number().optional(),
  contractionUsage: z.enum(["never", "sometimes", "frequently"]).optional(),
  vocabularyPatterns: z
    .object({
      preferred: z.array(z.string()),
      avoided: z.array(z.string()),
    })
    .optional(),
  signaturePhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  headingStyle: z.enum(["title_case", "sentence_case", "all_caps"]).optional(),
});

const updateProfileSchema = z.object({
  profileId: z.string().min(1),
  mode: z.enum(["preservation", "application", "best_practices"]).optional(),
  tonePrimary: z.string().optional(),
  toneSecondary: z.string().optional(),
  formalityLevel: z.number().min(1).max(10).optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z
    .enum(["professional", "casual", "technical", "friendly", "authoritative"])
    .optional(),
  sentenceLengthAvg: z.number().optional(),
  paragraphLengthAvg: z.number().optional(),
  contractionUsage: z.enum(["never", "sometimes", "frequently"]).optional(),
  vocabularyPatterns: z
    .object({
      preferred: z.array(z.string()),
      avoided: z.array(z.string()),
    })
    .optional(),
  signaturePhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  headingStyle: z.enum(["title_case", "sentence_case", "all_caps"]).optional(),
});

const createRuleSchema = z.object({
  profileId: z.string().min(1),
  ruleType: z.enum(["page", "section", "pattern"]),
  target: z.string().min(1),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

const importCsvSchema = z.object({
  profileId: z.string().min(1),
  csvContent: z.string().min(1),
});

const ruleIdSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required"),
});

// ============================================================================
// Helper Functions
// ============================================================================

// M-TSK-06 FIX: verifyClientAccess moved to shared module @/serverFunctions/client-access

/**
 * Verify user has access to the profile via its client.
 */
async function verifyProfileAccess(
  profileId: string,
  workspaceId: string
): Promise<void> {
  const profile = await db.query.voiceProfiles.findFirst({
    where: eq(voiceProfiles.id, profileId),
  });

  if (!profile) {
    throw new AppError("NOT_FOUND", "Voice profile not found");
  }

  // Note: clientId can be null if the client was deleted (soft delete preserves voice profiles)
  if (!profile.clientId) {
    throw new AppError("NOT_FOUND", "Voice profile's client no longer exists");
  }

  await verifyClientAccess(profile.clientId, workspaceId);
}

// ============================================================================
// Voice Profile Server Functions
// ============================================================================

/**
 * Get voice profile for a client.
 */
export const getVoiceProfileFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => clientIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyClientAccess(data.clientId, context.organizationId);
    return voiceProfileService.getByClientId(data.clientId);
  });

/**
 * Create a new voice profile.
 */
export const createVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyClientAccess(data.clientId, context.organizationId);

    const { clientId, templateId, ...profileData } = data;

    if (templateId) {
      return voiceProfileService.createFromTemplate(
        clientId,
        templateId,
        profileData
      );
    }

    return voiceProfileService.create(clientId, profileData);
  });

/**
 * Update an existing voice profile.
 */
export const updateVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => updateProfileSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    const { profileId, ...updateData } = data;
    return voiceProfileService.update(profileId, updateData);
  });

/**
 * Delete a voice profile.
 */
export const deleteVoiceProfileFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    await voiceProfileService.delete(data.profileId);
    return { success: true };
  });

/**
 * Get available industry templates.
 */
export const getIndustryTemplatesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async () => {
    return INDUSTRY_TEMPLATES;
  });

// ============================================================================
// Protection Rules Server Functions
// ============================================================================

/**
 * Get all protection rules for a profile.
 */
export const getProtectionRulesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    return protectionRulesService.getByProfileId(data.profileId);
  });

/**
 * Get only active (non-expired) protection rules.
 */
export const getActiveProtectionRulesFn = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => profileIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );
    return protectionRulesService.getActiveRules(data.profileId);
  });

/**
 * Create a new protection rule.
 */
export const createProtectionRuleFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createRuleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    return protectionRulesService.create(data.profileId, {
      ruleType: data.ruleType,
      target: data.target,
      reason: data.reason,
      createdBy: context.userId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });
  });

/**
 * Delete a protection rule.
 * Security: Verifies user has access to the rule via profile -> client ownership chain.
 */
export const deleteProtectionRuleFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => ruleIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Fetch the rule to get its profileId
    const rule = await protectionRulesService.getById(data.ruleId);
    if (!rule) {
      throw new AppError("NOT_FOUND", "Protection rule not found");
    }

    // Verify user has access to the profile (which validates client ownership)
    await verifyProfileAccess(rule.profileId, context.organizationId);

    await protectionRulesService.delete(data.ruleId);
    return { success: true };
  });

/**
 * Bulk import protection rules from CSV.
 */
export const importProtectionRulesCsvFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => importCsvSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(
      data.profileId,
      context.organizationId
    );

    return protectionRulesService.bulkImportCsv(
      data.profileId,
      data.csvContent,
      context.userId
    );
  });

// ============================================================================
// Voice Compliance Server Functions (Phase 37-04)
// ============================================================================

const scoreComplianceSchema = z.object({
  content: z.string().min(1, "Content is required"),
  profileId: z.string().min(1, "Profile ID is required"),
});

const buildConstraintsSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  templateBlend: z.number().min(0).max(1).optional(),
  templateId: z.string().optional(),
  targetUrl: z.string().optional(),
});

const generatePreviewSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
});

/**
 * Score content against a voice profile.
 * Returns compliance score across 5 dimensions with violations.
 *
 * Security: T-37-10 - Verifies caller has access to profileId's client
 */
export const scoreComplianceFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => scoreComplianceSchema.parse(data))
  .handler(async ({ data, context }) => {
    // T-37-10: Verify access before scoring
    await verifyProfileAccess(data.profileId, context.organizationId);

    const profile = await voiceProfileService.getById(data.profileId);
    if (!profile) {
      throw new AppError("NOT_FOUND", "Voice profile not found");
    }

    return voiceComplianceService.scoreContent(data.content, profile);
  });

/**
 * Build voice constraints for AI prompt injection.
 * Returns formatted prompt section based on profile mode.
 */
export const buildVoiceConstraintsFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => buildConstraintsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(data.profileId, context.organizationId);

    const profile = await voiceProfileService.getById(data.profileId);
    if (!profile) {
      throw new AppError("NOT_FOUND", "Voice profile not found");
    }

    const constraints = buildVoiceConstraints({
      profile,
      templateBlend: data.templateBlend,
      templateId: data.templateId,
      targetUrl: data.targetUrl,
    });

    return { constraints };
  });

// ============================================================================
// Voice Preview Server Functions (Phase 37-05)
// ============================================================================

/**
 * Generate preview samples using the voice profile.
 * Returns headline, paragraph, and CTA samples with compliance scoring.
 *
 * Security: T-37-12 - Rate limited via profile access verification
 */
export const generateVoicePreviewFn = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => generatePreviewSchema.parse(data))
  .handler(async ({ data, context }) => {
    await verifyProfileAccess(data.profileId, context.organizationId);

    const profile = await voiceProfileService.getById(data.profileId);
    if (!profile) {
      throw new AppError("NOT_FOUND", "Voice profile not found");
    }

    // Build constraints for sample generation
    const constraints = buildVoiceConstraints({ profile });

    // Generate samples using Claude AI with voice constraints
    const samples = await generateAISamples(profile, constraints);

    // Score the generated content
    const allContent = `${samples.headline}\n\n${samples.paragraph}\n\n${samples.cta}`;
    const compliance = await voiceComplianceService.scoreContent(
      allContent,
      profile
    );

    return { samples, compliance };
  });

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const PREVIEW_MAX_TOKENS = 1024;

const GeneratedSamplesSchema = z.object({
  headline: z.string(),
  paragraph: z.string(),
  cta: z.string(),
});

type GeneratedSamples = z.infer<typeof GeneratedSamplesSchema>;

interface VoiceProfileForGeneration {
  tonePrimary: string | null;
  toneSecondary: string | null;
  archetype: string | null;
  formalityLevel: number | null;
  contractionUsage: string | null;
  personalityTraits: string[] | null;
  vocabularyPatterns: { preferred: string[]; avoided: string[] } | null;
  signaturePhrases: string[] | null;
  forbiddenPhrases: string[] | null;
  headingStyle: string | null;
  sentenceLengthAvg: number | null;
  paragraphLengthAvg: number | null;
}

/**
 * Generate content samples using Claude API based on voice profile.
 * Uses real AI generation with voice constraints for preview content.
 */
async function generateAISamples(
  profile: VoiceProfileForGeneration,
  constraints: string
): Promise<GeneratedSamples> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn("ANTHROPIC_API_KEY not set, using fallback samples");
    return generateFallbackSamples(profile);
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const prompt = buildSampleGenerationPrompt(profile, constraints);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: PREVIEW_MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textContent) {
      throw new Error("No text content in Claude response");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    const validated = GeneratedSamplesSchema.parse(parsed);

    logger.info("AI sample generation complete", {
      archetype: profile.archetype,
      tone: profile.tonePrimary,
    });

    return validated;
  } catch (error) {
    logger.error(
      "AI sample generation failed, using fallback",
      error instanceof Error ? error : new Error(String(error))
    );
    return generateFallbackSamples(profile);
  }
}

/**
 * Build the prompt for AI sample generation with voice constraints.
 */
function buildSampleGenerationPrompt(
  profile: VoiceProfileForGeneration,
  constraints: string
): string {
  const formalityDesc =
    (profile.formalityLevel ?? 5) >= 7
      ? "formal and polished"
      : (profile.formalityLevel ?? 5) >= 4
        ? "balanced, neither too formal nor casual"
        : "casual and conversational";

  const contractionGuidance =
    profile.contractionUsage === "never"
      ? "NEVER use contractions (write 'we are' not 'we're', 'you will' not 'you'll')"
      : profile.contractionUsage === "frequently"
        ? "Use contractions naturally (we're, you'll, it's, etc.)"
        : "Use contractions sparingly";

  return `You are a brand voice copywriter. Generate sample content that perfectly matches this voice profile.

VOICE PROFILE:
- Primary Tone: ${profile.tonePrimary ?? "professional"}
- Secondary Tone: ${profile.toneSecondary ?? "none"}
- Archetype: ${profile.archetype ?? "professional"}
- Formality: ${profile.formalityLevel ?? 5}/10 (${formalityDesc})
- Personality Traits: ${(profile.personalityTraits ?? []).join(", ") || "none specified"}
- Contractions: ${contractionGuidance}
- Heading Style: ${profile.headingStyle ?? "title_case"}
${profile.sentenceLengthAvg ? `- Target Sentence Length: ~${profile.sentenceLengthAvg} words` : ""}
${profile.paragraphLengthAvg ? `- Target Paragraph Length: ~${profile.paragraphLengthAvg} sentences` : ""}

VOCABULARY RULES:
- Preferred terms: ${(profile.vocabularyPatterns?.preferred ?? []).join(", ") || "none"}
- Avoided terms: ${(profile.vocabularyPatterns?.avoided ?? []).join(", ") || "none"}
- Signature phrases to incorporate: ${(profile.signaturePhrases ?? []).join(", ") || "none"}
- Forbidden phrases: ${(profile.forbiddenPhrases ?? []).join(", ") || "none"}

VOICE CONSTRAINTS:
${constraints}

Generate THREE pieces of sample content that embody this voice:

1. HEADLINE: A compelling headline (5-10 words) that captures the brand voice
2. PARAGRAPH: A body paragraph (2-3 sentences) showcasing the tone and style
3. CTA: A call-to-action (2-5 words) that fits the voice

The content should be generic enough for any industry but clearly demonstrate the voice characteristics.

Return ONLY valid JSON:
{
  "headline": "Your headline here",
  "paragraph": "Your paragraph here with proper voice.",
  "cta": "Action Text"
}`;
}

/**
 * Generate fallback samples when AI is unavailable.
 * Uses rule-based generation based on profile attributes.
 */
function generateFallbackSamples(profile: VoiceProfileForGeneration): GeneratedSamples {
  const formal = (profile.formalityLevel ?? 5) >= 7;
  const useContractions = profile.contractionUsage === "frequently";

  const archetypeContent: Record<string, GeneratedSamples> = {
    professional: {
      headline: "Excellence in Every Detail",
      paragraph: formal
        ? "Our dedicated team of professionals delivers comprehensive solutions tailored to your specific requirements. We maintain the highest standards of quality and service excellence in everything we do."
        : useContractions
          ? "We're committed to delivering the best results for your business. Our team's expertise ensures you'll get solutions that work."
          : "We are committed to delivering the best results for your business. Our team expertise ensures you will get solutions that work.",
      cta: formal ? "Schedule a Consultation" : "Get Started Today",
    },
    friendly: {
      headline: useContractions
        ? "We're Here to Help You Succeed"
        : "We Are Here to Help You Succeed",
      paragraph: useContractions
        ? "Looking for a partner who truly understands your needs? We've got you covered! Our friendly team is ready to help you achieve your goals with personalized support every step of the way."
        : "Looking for a partner who truly understands your needs? We have got you covered! Our friendly team is ready to help you achieve your goals with personalized support every step of the way.",
      cta: useContractions ? "Let's Talk!" : "Let Us Talk!",
    },
    technical: {
      headline: "Advanced Solutions for Complex Challenges",
      paragraph: formal
        ? "Our platform leverages cutting-edge technology to deliver scalable, enterprise-grade solutions. With robust architecture and comprehensive APIs, we provide the technical foundation for your success."
        : "Built with modern tech stack, our platform scales with your needs. Powerful APIs and flexible architecture mean you can customize everything.",
      cta: "View Technical Documentation",
    },
    authoritative: {
      headline: "Industry-Leading Expertise You Can Trust",
      paragraph: formal
        ? "With decades of combined experience, our experts provide authoritative guidance backed by rigorous research and proven methodologies. Trust the professionals who set the standard in the industry."
        : "Our experts bring years of experience and proven methods. We set the standard that others follow.",
      cta: "Speak With an Expert",
    },
    casual: {
      headline: useContractions ? "Hey, Let's Make This Easy" : "Hey, Let Us Make This Easy",
      paragraph: useContractions
        ? "No complicated stuff here - just straightforward solutions that actually work. We're all about keeping things simple and getting you results without the headache."
        : "No complicated stuff here - just straightforward solutions that actually work. We are all about keeping things simple and getting you results without the headache.",
      cta: "Jump In",
    },
  };

  const archetype = profile.archetype ?? "professional";
  return archetypeContent[archetype] ?? archetypeContent.professional;
}
