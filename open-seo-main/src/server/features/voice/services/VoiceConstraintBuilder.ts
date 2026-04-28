/**
 * Voice Constraint Builder
 * Phase 37-04: Compliance Scoring + AI-Writer Integration
 *
 * Builds voice-constrained prompts for AI content generation.
 * Supports 3 modes:
 * - preservation: Protect branded content from changes
 * - application: Full voice profile injection
 * - best_practices: Generic SEO best practices only
 *
 * Security:
 * - T-37-09: Escapes special characters in phrases before prompt injection
 */

import type { VoiceProfileSelect } from "@/db/voice-schema";
import { protectionRulesService } from "./ProtectionRulesService";
import { getTemplateDefaults } from "../templates/industryTemplates";
import type { ExtractedVoiceDimensions } from "../templates/industryTemplates";

/**
 * Options for building voice constraints.
 */
export interface VoiceConstraintOptions {
  /** Voice profile to use for constraints */
  profile: VoiceProfileSelect;
  /** Blend ratio with template (0.0 = pure client, 1.0 = pure template) */
  templateBlend?: number;
  /** Template ID for blending */
  templateId?: string;
  /** Target URL for protection rule checking */
  targetUrl?: string;
}

/**
 * Build voice constraints for AI prompt injection.
 * Synchronous function for simple mode-based constraint generation.
 *
 * @param options - Voice constraint options
 * @returns Formatted prompt section with voice constraints
 */
export function buildVoiceConstraints(options: VoiceConstraintOptions): string {
  const { profile, templateBlend = 0, templateId } = options;

  // Mode-specific handling
  if (profile.mode === "best_practices") {
    return buildBestPracticesConstraints();
  }

  if (profile.mode === "preservation") {
    // For sync function, return basic preservation message
    // Use builder.build() for full async protection rule loading
    return buildBasicPreservationConstraints(profile);
  }

  // Application mode: full voice constraints
  return buildApplicationConstraints(profile, templateBlend, templateId);
}

/**
 * Class-based builder for more complex constraint building.
 * Supports async operations like loading protection rules.
 */
export class VoiceConstraintBuilder {
  /**
   * Build voice constraints with full async support.
   * Use this when you need protection rules for preservation mode.
   *
   * @param options - Voice constraint options
   * @returns Formatted prompt section with voice constraints
   */
  async build(options: VoiceConstraintOptions): Promise<string> {
    const { profile, templateBlend = 0, templateId, targetUrl } = options;

    // Mode-specific handling
    if (profile.mode === "best_practices") {
      return buildBestPracticesConstraints();
    }

    if (profile.mode === "preservation" && targetUrl) {
      return this.buildPreservationConstraints(profile, targetUrl);
    }

    if (profile.mode === "preservation") {
      return buildBasicPreservationConstraints(profile);
    }

    // Application mode: full voice constraints
    return buildApplicationConstraints(profile, templateBlend, templateId);
  }

  /**
   * Build preservation mode constraints with protection rules.
   */
  private async buildPreservationConstraints(
    profile: VoiceProfileSelect,
    targetUrl: string
  ): Promise<string> {
    const activeRules = await protectionRulesService.getActiveRules(profile.id);

    // Categorize rules by type
    const pageRules = activeRules.filter((r) => r.ruleType === "page");
    const sectionRules = activeRules.filter((r) => r.ruleType === "section");
    const patternRules = activeRules.filter((r) => r.ruleType === "pattern");

    let constraints = `## Content Preservation Mode

This client uses PRESERVATION mode. Protected content must NOT be changed.

**Target URL:** ${escapeForPrompt(targetUrl)}

`;

    if (pageRules.length > 0) {
      constraints += `### Protected Pages (DO NOT MODIFY)
${pageRules.map((r) => `- ${escapeForPrompt(r.target)} - ${escapeForPrompt(r.reason || "Protected")}`).join("\n")}

`;
    }

    if (sectionRules.length > 0) {
      constraints += `### Protected Sections (CSS Selectors - DO NOT MODIFY)
${sectionRules.map((r) => `- \`${escapeForPrompt(r.target)}\` - ${escapeForPrompt(r.reason || "Protected")}`).join("\n")}

`;
    }

    if (patternRules.length > 0) {
      constraints += `### Protected Text Patterns (DO NOT MODIFY)
${patternRules.map((r) => `- Pattern: \`${escapeForPrompt(r.target)}\` - ${escapeForPrompt(r.reason || "Protected")}`).join("\n")}

`;
    }

    constraints += `### Guidelines for Non-Protected Content
- Maintain existing tone: ${profile.tonePrimary || "professional"}
- Keep formality consistent with surrounding content
- Do not introduce new branded terminology
- Preserve the overall document structure
`;

    return constraints;
  }
}

/**
 * Build basic preservation constraints without async rule loading.
 */
function buildBasicPreservationConstraints(profile: VoiceProfileSelect): string {
  return `## Content Preservation Mode

This client uses PRESERVATION mode. Protected content must NOT be changed.

### Guidelines
- Do not modify any branded messaging or taglines
- Maintain existing tone: ${profile.tonePrimary || "professional"}
- Keep formality consistent with surrounding content
- Preserve the overall document structure
- Only make SEO improvements to non-protected sections
`;
}

/**
 * Build application mode constraints with full 12-dimension profile.
 */
function buildApplicationConstraints(
  profile: VoiceProfileSelect,
  blend: number,
  templateId?: string
): string {
  // If blending with template, interpolate values
  const effectiveProfile =
    blend > 0 && templateId
      ? blendWithTemplate(profile, templateId, blend)
      : profile;

  let constraints = `## Voice & Tone Requirements

`;

  // Tone section
  constraints += `### Primary Tone
${effectiveProfile.tonePrimary || "professional"}
`;

  if (effectiveProfile.toneSecondary) {
    constraints += `
### Secondary Tone
${effectiveProfile.toneSecondary}
`;
  }

  // Formality section
  constraints += `
### Formality Level
${effectiveProfile.formalityLevel ?? 5}/10
${describeFormalityLevel(effectiveProfile.formalityLevel ?? 5)}
`;

  // Brand archetype
  constraints += `
### Brand Archetype
${effectiveProfile.archetype || "professional"}
${describeArchetype(effectiveProfile.archetype || "professional")}
`;

  // Personality traits
  const traits = effectiveProfile.personalityTraits ?? [];
  if (traits.length > 0) {
    constraints += `
### Personality Traits to Embody
${traits.map((t) => `- ${escapeForPrompt(t)}`).join("\n")}
`;
  }

  // Writing style requirements
  constraints += `
## Writing Style Requirements

### Sentence Length
Target ~${effectiveProfile.sentenceLengthAvg ?? 15} words per sentence

### Paragraph Length
Target ~${effectiveProfile.paragraphLengthAvg ?? 3} sentences per paragraph

### Contractions
${describeContractionUsage(effectiveProfile.contractionUsage || "sometimes")}

### Heading Style
${(effectiveProfile.headingStyle || "sentence_case").replace("_", " ")}
`;

  // Vocabulary guidelines
  const vocabPatterns = effectiveProfile.vocabularyPatterns ?? {
    preferred: [],
    avoided: [],
  };
  const preferred = vocabPatterns.preferred ?? [];
  const avoided = vocabPatterns.avoided ?? [];

  constraints += `
## Vocabulary Guidelines

`;

  if (preferred.length > 0) {
    constraints += `### Preferred Words (use when natural)
${preferred.map((w) => escapeForPrompt(w)).join(", ")}

`;
  }

  if (avoided.length > 0) {
    constraints += `### FORBIDDEN - NEVER USE these words
${avoided.map((w) => escapeForPrompt(w)).join(", ")}

`;
  }

  // Signature phrases
  const signaturePhrases = effectiveProfile.signaturePhrases ?? [];
  if (signaturePhrases.length > 0) {
    constraints += `### Signature Phrases (incorporate when appropriate)
${signaturePhrases.map((p) => `- "${escapeForPrompt(p)}"`).join("\n")}

`;
  }

  // Forbidden phrases
  const forbiddenPhrases = effectiveProfile.forbiddenPhrases ?? [];
  if (forbiddenPhrases.length > 0) {
    constraints += `### Additional Forbidden Phrases - NEVER USE
${forbiddenPhrases.map((p) => `- "${escapeForPrompt(p)}"`).join("\n")}

`;
  }

  return constraints;
}

/**
 * Build best practices mode constraints (generic SEO guidelines).
 */
function buildBestPracticesConstraints(): string {
  return `## SEO Best Practices Voice

Use professional, clear writing optimized for readability and SEO:

### Structure
- Clear, scannable structure with descriptive headings
- Short paragraphs (2-4 sentences each)
- Bulleted lists for easy scanning
- Logical flow from introduction to conclusion

### Writing Style
- Active voice preferred over passive
- Clear, concise sentences (15-20 words average)
- Natural keyword integration (avoid keyword stuffing)
- Accessible language for the target audience

### SEO Guidelines
- Include primary keyword in first paragraph
- Use related keywords and semantic variations
- Write compelling meta descriptions
- Use descriptive, keyword-rich headings
- Internal linking where relevant
`;
}

/**
 * Blend a profile with a template based on blend ratio.
 * 0.0 = pure profile, 1.0 = pure template
 */
function blendWithTemplate(
  profile: VoiceProfileSelect,
  templateId: string,
  blend: number
): VoiceProfileSelect {
  const template = getTemplateDefaults(templateId);
  if (!template) return profile;

  // Clamp blend ratio
  const b = Math.max(0, Math.min(1, blend));
  const p = 1 - b; // Profile weight

  // At blend 1.0, use pure template values
  if (b >= 1) {
    return {
      ...profile,
      tonePrimary: template.tonePrimary,
      toneSecondary: template.toneSecondary,
      formalityLevel: template.formalityLevel,
      personalityTraits: template.personalityTraits,
      archetype: template.archetype,
      sentenceLengthAvg: template.sentenceLengthAvg,
      paragraphLengthAvg: template.paragraphLengthAvg,
      contractionUsage: template.contractionUsage,
      vocabularyPatterns: template.vocabularyPatterns,
      signaturePhrases: template.signaturePhrases,
      forbiddenPhrases: template.forbiddenPhrases,
      headingStyle: template.headingStyle,
    };
  }

  // At blend 0.0, use pure profile values
  if (b <= 0) {
    return profile;
  }

  // Interpolate numeric values
  const blendedFormality = Math.round(
    (profile.formalityLevel ?? 5) * p + template.formalityLevel * b
  );
  const blendedSentenceLength = Math.round(
    (profile.sentenceLengthAvg ?? 15) * p + template.sentenceLengthAvg * b
  );
  const blendedParagraphLength = Math.round(
    (profile.paragraphLengthAvg ?? 3) * p + template.paragraphLengthAvg * b
  );

  // For categorical values, use profile if blend < 0.5, template if >= 0.5
  const useTone = b < 0.5 ? profile.tonePrimary : template.tonePrimary;
  const useSecondaryTone = b < 0.5 ? profile.toneSecondary : template.toneSecondary;
  const useArchetype = b < 0.5 ? profile.archetype : template.archetype;
  const useContraction =
    b < 0.5 ? profile.contractionUsage : template.contractionUsage;
  const useHeadingStyle = b < 0.5 ? profile.headingStyle : template.headingStyle;

  // Merge arrays (combine both, with template additions weighted by blend)
  const mergedTraits = mergeArrays(
    profile.personalityTraits ?? [],
    template.personalityTraits,
    b
  );
  const mergedPreferred = mergeArrays(
    profile.vocabularyPatterns?.preferred ?? [],
    template.vocabularyPatterns.preferred,
    b
  );
  const mergedAvoided = mergeArrays(
    profile.vocabularyPatterns?.avoided ?? [],
    template.vocabularyPatterns.avoided,
    b
  );
  const mergedSignature = mergeArrays(
    profile.signaturePhrases ?? [],
    template.signaturePhrases,
    b
  );
  const mergedForbidden = mergeArrays(
    profile.forbiddenPhrases ?? [],
    template.forbiddenPhrases,
    b
  );

  return {
    ...profile,
    tonePrimary: useTone,
    toneSecondary: useSecondaryTone,
    formalityLevel: blendedFormality,
    personalityTraits: mergedTraits,
    archetype: useArchetype,
    sentenceLengthAvg: blendedSentenceLength,
    paragraphLengthAvg: blendedParagraphLength,
    contractionUsage: useContraction,
    vocabularyPatterns: {
      preferred: mergedPreferred,
      avoided: mergedAvoided,
    },
    signaturePhrases: mergedSignature,
    forbiddenPhrases: mergedForbidden,
    headingStyle: useHeadingStyle,
  };
}

/**
 * Merge two arrays with weighting based on blend ratio.
 */
function mergeArrays(
  profileArr: string[],
  templateArr: string[],
  blend: number
): string[] {
  // Always include all profile items
  const result = [...profileArr];

  // Add template items weighted by blend ratio
  // At blend 1.0, include all template items
  // At blend 0.5, include half of template items
  const templateItemsToAdd = Math.ceil(templateArr.length * blend);
  const templateSubset = templateArr.slice(0, templateItemsToAdd);

  for (const item of templateSubset) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Describe formality level in human-readable terms.
 */
function describeFormalityLevel(level: number): string {
  if (level <= 2) {
    return "Very casual - use slang, contractions, colloquial expressions";
  }
  if (level <= 4) {
    return "Casual - conversational tone, contractions allowed, friendly";
  }
  if (level <= 6) {
    return "Balanced - professional yet approachable, moderate formality";
  }
  if (level <= 8) {
    return "Formal - professional language, minimal contractions";
  }
  return "Very formal - academic/legal style, no contractions, precise terminology";
}

/**
 * Describe brand archetype characteristics.
 */
function describeArchetype(archetype: string): string {
  const descriptions: Record<string, string> = {
    professional:
      "Business-focused, clear, credible, trustworthy. Emphasize expertise and reliability.",
    casual:
      "Relaxed, conversational, everyday language, relatable. Connect on a personal level.",
    technical:
      "Data-driven, precise, jargon-appropriate for experts. Show deep domain knowledge.",
    friendly:
      "Warm, approachable, personal, empathetic. Build emotional connection with readers.",
    authoritative:
      "Expert, commanding, definitive, educational. Establish thought leadership.",
  };
  return descriptions[archetype] || descriptions.professional;
}

/**
 * Describe contraction usage expectations.
 */
function describeContractionUsage(usage: string): string {
  const descriptions: Record<string, string> = {
    never: "Do not use contractions - write out all words fully",
    sometimes: "Use contractions occasionally for natural flow",
    frequently: "Use contractions freely for conversational tone",
  };
  return descriptions[usage] || descriptions.sometimes;
}

/**
 * Escape special characters in text for safe prompt injection.
 * Mitigates T-37-09: Prompt injection via signature/forbidden phrases.
 */
function escapeForPrompt(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/\n/g, " ") // Replace newlines with spaces
    .replace(/\r/g, "") // Remove carriage returns
    .replace(/</g, "&lt;") // Escape HTML-like tags
    .replace(/>/g, "&gt;");
}
