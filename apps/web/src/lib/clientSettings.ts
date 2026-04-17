"use client";

import { apiGet, apiPut, ApiError } from "@/lib/api-client";

export interface ClientSettings {
  id: string;
  client_id: string;
  brand_voice: string | null;
  image_prompt_template: string | null;
  text_model_override: string | null;
  image_model_override: string | null;
  wp_url: string | null;
  wp_username: string | null;
  // wp_app_password — intentionally absent (write-only, never returned from backend)
  shopify_store_url: string | null;
  // shopify_api_key — intentionally absent (write-only, never returned from backend)
  // v2.0 voice blend fields
  voice_template_id: string | null;
  voice_blend_weight: number | null;
  custom_voice_instructions: string | null;
  webhook_url?: string | null;
}

export interface ClientSettingsUpdate {
  brand_voice?: string | null;
  image_prompt_template?: string | null;
  text_model_override?: string | null;
  image_model_override?: string | null;
  wp_url?: string | null;
  wp_username?: string | null;
  wp_app_password?: string; // write-only
  shopify_store_url?: string | null;
  shopify_api_key?: string; // write-only
  voice_template_id?: string | null;
  voice_blend_weight?: number | null;
  custom_voice_instructions?: string | null;
  webhook_url?: string | null;
}

export interface VoiceTemplate {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

/**
 * Fetch settings for a given client.
 * Returns null when no settings row exists yet (backend returns 404 for new clients).
 * Re-throws all other errors.
 */
export async function fetchClientSettings(
  clientId: string
): Promise<ClientSettings | null> {
  try {
    return await apiGet<ClientSettings>(`/api/client-settings/${clientId}`);
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Create or update settings for a given client.
 * Always returns the full settings object after save.
 */
export async function upsertClientSettings(
  clientId: string,
  payload: ClientSettingsUpdate
): Promise<ClientSettings> {
  return apiPut<ClientSettings>(`/api/client-settings/${clientId}`, payload);
}

/**
 * Fetch all available voice templates (system + user-created).
 * Returns empty array on error — graceful degradation.
 */
export async function fetchVoiceTemplates(): Promise<VoiceTemplate[]> {
  return apiGet<VoiceTemplate[]>("/api/voice-templates");
}
