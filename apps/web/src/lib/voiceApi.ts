/**
 * Voice API client for open-seo-main voice endpoints.
 * Phase 37-02: Voice API Layer
 */

import { z } from "zod";
import { fetchWithTimeout } from "./fetch-with-timeout";

// FIX: Add Zod schema for voice profile mode validation
// Standardized to snake_case: preservation, application, best_practices
const voiceModeSchema = z.enum(["preservation", "application", "best_practices"]);
const voiceStatusSchema = z.enum(["draft", "active", "archived"]);
const ruleTypeSchema = z.enum(["page", "section", "pattern"]);

// Validation schema for VoiceProfile API response
const voiceProfileResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    clientId: z.string(),
    mode: voiceModeSchema,
    voiceStatus: voiceStatusSchema,
  }).passthrough().nullable(),
});

// Validation schema for ProtectionRule response
const protectionRulesResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    profileId: z.string(),
    ruleType: ruleTypeSchema,
    target: z.string(),
  }).passthrough()),
});

const OPEN_SEO_API = process.env.NEXT_PUBLIC_OPEN_SEO_URL || "http://localhost:3001";

/** Voice operations can be slow (analysis, AI processing), use 60s timeout */
const VOICE_TIMEOUT_MS = 60_000;

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
  requiredPhrases: string[];
  keywordDensityTolerance: number | null;
  keywordPlacementRules: string[];
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
  templateConfig: Partial<VoiceProfile>;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectionRule {
  id: string;
  profileId: string;
  ruleType: "page" | "section" | "pattern";
  target: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface AnalyzeJobResult {
  jobId: string;
  profileId: string;
  urlCount: number;
}

export async function fetchVoiceProfile(clientId: string): Promise<VoiceProfile | null> {
  const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}`, {
    credentials: "include",
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch voice profile: ${res.status}`);
  }
  const json = await res.json();
  // FIX: Validate response shape and mode enum with Zod
  const parsed = voiceProfileResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[voiceApi] Invalid voice profile response:", parsed.error);
    throw new Error("Invalid voice profile response from backend");
  }
  return parsed.data.data as VoiceProfile | null;
}

export async function updateVoiceProfile(
  clientId: string,
  data: Partial<Omit<VoiceProfile, "id" | "clientId" | "createdAt" | "updatedAt">>
): Promise<VoiceProfile> {
  const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`Failed to update voice profile: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function triggerVoiceAnalysis(
  clientId: string,
  urls: string[]
): Promise<AnalyzeJobResult> {
  const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ urls }),
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger voice analysis: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchProtectionRules(clientId: string): Promise<ProtectionRule[]> {
  const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules`, {
    credentials: "include",
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch protection rules: ${res.status}`);
  }
  const json = await res.json();
  // FIX: Validate response shape and ruleType enum with Zod
  const parsed = protectionRulesResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[voiceApi] Invalid protection rules response:", parsed.error);
    throw new Error("Invalid protection rules response from backend");
  }
  // Use unknown intermediate cast since Zod passthrough includes extra fields
  return parsed.data.data as unknown as ProtectionRule[];
}

export async function createProtectionRule(
  clientId: string,
  rule: { ruleType: "page" | "section" | "pattern"; target: string; reason?: string; expiresAt?: string }
): Promise<ProtectionRule> {
  const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(rule),
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`Failed to create protection rule: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}

export async function deleteProtectionRule(clientId: string, ruleId: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules?ruleId=${ruleId}`,
    {
      method: "DELETE",
      credentials: "include",
      timeout: VOICE_TIMEOUT_MS,
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to delete protection rule: ${res.status}`);
  }
}

export async function fetchVoiceTemplates(industry?: string): Promise<VoiceTemplate[]> {
  const url = industry
    ? `${OPEN_SEO_API}/api/seo/voice-templates?industry=${encodeURIComponent(industry)}`
    : `${OPEN_SEO_API}/api/seo/voice-templates`;
  const res = await fetchWithTimeout(url, {
    credentials: "include",
    timeout: VOICE_TIMEOUT_MS,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch voice templates: ${res.status}`);
  }
  const json = await res.json();
  return json.data;
}
