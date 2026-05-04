"use client";

/**
 * ModelDefaultsTab - Default AI Model Configuration
 *
 * HIGH-02 FIX: Extracted from 1043-line settings/page.tsx for maintainability.
 * This component manages default AI models for text and image generation.
 */

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, Loader2 } from "lucide-react";

import { logger } from "@/lib/logger";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@tevero/ui";
import { apiGet, apiPut } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalSettings {
  default_text_model: string | null;
  default_image_model: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXT_MODELS = [
  // Anthropic Claude
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  // Google Gemini 3 (preview)
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  // Google Gemini 2.5
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  // Google Gemini 2.0 (legacy)
  "gemini-2.0-pro",
  // OpenAI GPT-5
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  // OpenAI GPT-4.1
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  // OpenAI GPT-4o
  "gpt-4o",
  "gpt-4o-mini",
  // OpenAI o-series
  "o3",
  "o3-mini",
  "o4-mini",
  // xAI Grok
  "grok-4",
  "grok-4-latest",
  "grok-4-fast-reasoning",
  "grok-4-fast-non-reasoning",
  "grok-4-1-fast-reasoning",
];

const IMAGE_MODELS = [
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-001",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelDefaultsTab() {
  const [settings, setSettings] = useState<GlobalSettings>({
    default_text_model: null,
    default_image_model: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedOkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    apiGet<GlobalSettings>("/api/settings/global")
      .then((data) => setSettings(data))
      .catch((err) => {
        logger.error("Failed to load global settings", err instanceof Error ? err : { error: String(err) });
      })
      .finally(() => setLoading(false));
  }, []);

  // Cleanup savedOk timer on unmount
  useEffect(() => {
    return () => {
      if (savedOkTimerRef.current) {
        clearTimeout(savedOkTimerRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    // Clear any existing timer
    if (savedOkTimerRef.current) {
      clearTimeout(savedOkTimerRef.current);
    }
    try {
      await apiPut("/api/settings/global", {
        default_text_model: settings.default_text_model,
        default_image_model: settings.default_image_model,
      });
      setSavedOk(true);
      savedOkTimerRef.current = setTimeout(() => setSavedOk(false), 3000);
    } catch (error) {
      logger.error("[ModelDefaultsTab] Failed to save model defaults", error instanceof Error ? error : { error: String(error) });
      setSaveError("Failed to save model defaults. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border border-border bg-card p-6 max-w-md">
        <h3 className="text-sm font-medium text-foreground mb-1">Model Defaults</h3>
        <p className="text-xs text-muted-foreground mb-5">
          Default AI models used for article generation and image creation. These are workspace-wide defaults and can be overridden per client.
        </p>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Text Model
            </Label>
            <Select
              value={settings.default_text_model ?? ""}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, default_text_model: value || null }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select text model..." />
              </SelectTrigger>
              <SelectContent>
                {TEXT_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground mb-1.5 block">
              Image Model
            </Label>
            <Select
              value={settings.default_image_model ?? ""}
              onValueChange={(value) =>
                setSettings((s) => ({ ...s, default_image_model: value || null }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select image model..." />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}

          {savedOk && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              Model defaults saved.
            </p>
          )}

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving...</>
              ) : (
                "Save defaults"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
