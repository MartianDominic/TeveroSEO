"use server";

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
  return apiFetchVoiceProfile(clientId);
}

export async function saveVoiceProfile(
  clientId: string,
  data: Partial<VoiceProfile>
): Promise<VoiceProfile> {
  return apiUpdateVoiceProfile(clientId, data);
}

export async function analyzeVoice(
  clientId: string,
  urls: string[]
): Promise<AnalyzeJobResult> {
  return apiTriggerVoiceAnalysis(clientId, urls);
}

export async function getProtectionRules(clientId: string): Promise<ProtectionRule[]> {
  return apiFetchProtectionRules(clientId);
}

export async function addProtectionRule(
  clientId: string,
  rule: { ruleType: "page" | "section" | "pattern"; target: string; reason?: string; expiresAt?: string }
): Promise<ProtectionRule> {
  return apiCreateProtectionRule(clientId, rule);
}

export async function removeProtectionRule(clientId: string, ruleId: string): Promise<void> {
  return apiDeleteProtectionRule(clientId, ruleId);
}

export async function getVoiceTemplates(industry?: string): Promise<VoiceTemplate[]> {
  return apiFetchVoiceTemplates(industry);
}
