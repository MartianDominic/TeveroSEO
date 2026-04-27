"use server";

import {
  requireActionAuth,
  validateClientOwnership,
} from "@/lib/auth/action-auth";
import {
  fetchVoiceProfile as apiFetchVoiceProfile,
  updateVoiceProfile as apiUpdateVoiceProfile,
  triggerVoiceAnalysis as apiTriggerVoiceAnalysis,
  fetchProtectionRules as apiFetchProtectionRules,
  createProtectionRule as apiCreateProtectionRule,
  deleteProtectionRule as apiDeleteProtectionRule,
  fetchVoiceTemplates as apiFetchVoiceTemplates,
  type VoiceProfile,
  type ProtectionRule,
  type VoiceTemplate,
  type AnalyzeJobResult,
} from "@/lib/voiceApi";

export async function getVoiceProfile(clientId: string): Promise<VoiceProfile | null> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiFetchVoiceProfile(clientId);
}

export async function saveVoiceProfile(
  clientId: string,
  data: Partial<VoiceProfile>
): Promise<VoiceProfile> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiUpdateVoiceProfile(clientId, data);
}

export async function analyzeVoice(
  clientId: string,
  urls: string[]
): Promise<AnalyzeJobResult> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiTriggerVoiceAnalysis(clientId, urls);
}

export async function getProtectionRules(clientId: string): Promise<ProtectionRule[]> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiFetchProtectionRules(clientId);
}

export async function addProtectionRule(
  clientId: string,
  rule: { ruleType: "page" | "section" | "pattern"; target: string; reason?: string; expiresAt?: string }
): Promise<ProtectionRule> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiCreateProtectionRule(clientId, rule);
}

export async function removeProtectionRule(clientId: string, ruleId: string): Promise<void> {
  const auth = await requireActionAuth();
  await validateClientOwnership(clientId, auth);
  return apiDeleteProtectionRule(clientId, ruleId);
}

export async function getVoiceTemplates(industry?: string): Promise<VoiceTemplate[]> {
  // Voice templates are public/shared, but require authentication
  await requireActionAuth();
  return apiFetchVoiceTemplates(industry);
}
