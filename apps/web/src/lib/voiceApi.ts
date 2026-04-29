/**
 * Voice API client for open-seo-main voice endpoints.
 * Phase 37-02: Voice API Layer
 *
 * SECURITY FIX: Uses server-side auth with Bearer tokens instead of cookies.
 * This module is server-only and uses Clerk's getToken() for authentication.
 *
 * Uses circuit breaker pattern to prevent cascading failures when
 * the voice service is unavailable.
 */

import "server-only";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { fetchWithTimeout } from "./fetch-with-timeout";
import { getOpenSeoUrl } from "./env";
import {
  VOICE_API_BREAKER,
  CircuitOpenError,
  getServiceErrorMessage,
} from "./utils/service-circuit-breakers";

// Re-export for consumers
export { CircuitOpenError, getServiceErrorMessage };

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
const protectionRuleSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  ruleType: ruleTypeSchema,
  target: z.string(),
  reason: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

const protectionRulesResponseSchema = z.object({
  data: z.array(protectionRuleSchema),
});

const singleProtectionRuleResponseSchema = z.object({
  data: protectionRuleSchema,
});

// Full VoiceProfile schema for update responses
const fullVoiceProfileSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  mode: voiceModeSchema,
  voiceStatus: voiceStatusSchema,
  voiceName: z.string().nullable().optional(),
  primaryTone: z.string().nullable().optional(),
  secondaryTones: z.array(z.string()).optional(),
  formalityLevel: z.number().nullable().optional(),
  personalityTraits: z.array(z.string()).optional(),
  archetype: z.string().nullable().optional(),
  emotionalRange: z.string().nullable().optional(),
  contractionUsage: z.string().nullable().optional(),
  sentenceLengthTarget: z.string().nullable().optional(),
  paragraphLengthTarget: z.string().nullable().optional(),
  listPreference: z.string().nullable().optional(),
  headingStyle: z.string().nullable().optional(),
  ctaTemplate: z.string().nullable().optional(),
  jargonLevel: z.string().nullable().optional(),
  acronymPolicy: z.string().nullable().optional(),
  industryTerms: z.array(z.string()).optional(),
  signaturePhrases: z.array(z.string()).optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  requiredPhrases: z.array(z.string()).optional(),
  keywordDensityTolerance: z.number().nullable().optional(),
  keywordPlacementRules: z.array(z.string()).optional(),
  seoVsVoicePriority: z.number().nullable().optional(),
  voiceBlendEnabled: z.boolean().optional(),
  voiceBlendWeight: z.number().optional(),
  voiceTemplateId: z.string().nullable().optional(),
  customInstructions: z.string().nullable().optional(),
  confidenceScore: z.number().nullable().optional(),
  analyzedAt: z.string().nullable().optional(),
  protectedSections: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const updateVoiceProfileResponseSchema = z.object({
  data: fullVoiceProfileSchema,
});

// Validation schema for analyze job result
const analyzeJobResultSchema = z.object({
  jobId: z.string(),
  profileId: z.string(),
  urlCount: z.number(),
});

const analyzeJobResponseSchema = z.object({
  data: analyzeJobResultSchema,
});

// Validation schema for voice templates
const voiceTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  isSystem: z.boolean().optional(),
  templateConfig: z.record(z.string(), z.unknown()).optional(),
  usageCount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const voiceTemplatesResponseSchema = z.object({
  data: z.array(voiceTemplateSchema),
});

const OPEN_SEO_API = getOpenSeoUrl();

/** Voice operations can be slow (analysis, AI processing), use 60s timeout */
const VOICE_TIMEOUT_MS = 60_000;

/**
 * Get authorization header with Clerk token for server-side requests.
 * SECURITY: Uses Bearer token authentication instead of cookies.
 */
async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}`, {
      headers: await authHeader(),
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
    return parsed.data.data as unknown as VoiceProfile | null;
  });
}

export async function updateVoiceProfile(
  clientId: string,
  data: Partial<Omit<VoiceProfile, "id" | "clientId" | "createdAt" | "updatedAt">>
): Promise<VoiceProfile> {
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(data),
      timeout: VOICE_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw new Error(`Failed to update voice profile: ${res.status}`);
    }
    const json = await res.json();
    const parsed = updateVoiceProfileResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[voiceApi] Invalid update voice profile response:", parsed.error);
      throw new Error("Invalid update voice profile response from backend");
    }
    return parsed.data.data as VoiceProfile;
  });
}

export async function triggerVoiceAnalysis(
  clientId: string,
  urls: string[]
): Promise<AnalyzeJobResult> {
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ urls }),
      timeout: VOICE_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw new Error(`Failed to trigger voice analysis: ${res.status}`);
    }
    const json = await res.json();
    const parsed = analyzeJobResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[voiceApi] Invalid analyze job response:", parsed.error);
      throw new Error("Invalid analyze job response from backend");
    }
    return parsed.data.data;
  });
}

export async function fetchProtectionRules(clientId: string): Promise<ProtectionRule[]> {
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules`, {
      headers: await authHeader(),
      timeout: VOICE_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch protection rules: ${res.status}`);
    }
    const json = await res.json();
    const parsed = protectionRulesResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[voiceApi] Invalid protection rules response:", parsed.error);
      throw new Error("Invalid protection rules response from backend");
    }
    return parsed.data.data as ProtectionRule[];
  });
}

export async function createProtectionRule(
  clientId: string,
  rule: { ruleType: "page" | "section" | "pattern"; target: string; reason?: string; expiresAt?: string }
): Promise<ProtectionRule> {
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(`${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(rule),
      timeout: VOICE_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw new Error(`Failed to create protection rule: ${res.status}`);
    }
    const json = await res.json();
    const parsed = singleProtectionRuleResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[voiceApi] Invalid create protection rule response:", parsed.error);
      throw new Error("Invalid create protection rule response from backend");
    }
    return parsed.data.data as ProtectionRule;
  });
}

export async function deleteProtectionRule(clientId: string, ruleId: string): Promise<void> {
  return VOICE_API_BREAKER.execute(async () => {
    const res = await fetchWithTimeout(
      `${OPEN_SEO_API}/api/seo/voice/${clientId}/protection-rules?ruleId=${ruleId}`,
      {
        method: "DELETE",
        headers: await authHeader(),
        timeout: VOICE_TIMEOUT_MS,
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to delete protection rule: ${res.status}`);
    }
  });
}

export async function fetchVoiceTemplates(industry?: string): Promise<VoiceTemplate[]> {
  return VOICE_API_BREAKER.execute(async () => {
    const url = industry
      ? `${OPEN_SEO_API}/api/seo/voice-templates?industry=${encodeURIComponent(industry)}`
      : `${OPEN_SEO_API}/api/seo/voice-templates`;
    const res = await fetchWithTimeout(url, {
      headers: await authHeader(),
      timeout: VOICE_TIMEOUT_MS,
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch voice templates: ${res.status}`);
    }
    const json = await res.json();
    const parsed = voiceTemplatesResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[voiceApi] Invalid voice templates response:", parsed.error);
      throw new Error("Invalid voice templates response from backend");
    }
    return parsed.data.data as VoiceTemplate[];
  });
}
