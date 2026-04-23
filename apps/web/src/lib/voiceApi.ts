/**
 * Voice API Types
 *
 * Temporary stub implementation for Plan 37-03 UI development.
 * Full implementation planned for Plan 37-02.
 */

export interface VoiceProfile {
  id: string;
  clientId: string;
  mode: "preservation" | "application" | "best_practices";
  voiceStatus: "draft" | "active" | "archived";
  voiceName: string | null;
  primaryTone: string | null;
  secondaryTones: string[];
  formalityLevel: number | null;
  personalityTraits: string[];
  archetype: string | null;
  emotionalRange: string | null;
  contractionUsage: string | null;
  sentenceLengthTarget: string | null;
  paragraphLengthTarget: string | null;
  listPreference: string | null;
  headingStyle: string | null;
  ctaTemplate: string | null;
  jargonLevel: string | null;
  acronymPolicy: string | null;
  industryTerms: string[];
  signaturePhrases: string[];
  forbiddenPhrases: string[];
  keywordDensityTolerance: number | null;
  seoVsVoicePriority: number | null;
  voiceBlendEnabled: boolean;
  voiceBlendWeight: number;
  voiceTemplateId: string | null;
  customInstructions: string | null;
  confidenceScore: number | null;
  analyzedAt: string | null;
  protectedSections: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  isSystem: boolean;
  createdAt: string;
}

export interface ProtectionRule {
  id: string;
  clientId: string;
  ruleType: "page" | "section" | "pattern";
  target: string;
  reason: string | null;
  createdAt: string;
}

export interface AnalyzeJobResult {
  jobId: string;
  status: "pending" | "processing" | "complete" | "failed";
}
