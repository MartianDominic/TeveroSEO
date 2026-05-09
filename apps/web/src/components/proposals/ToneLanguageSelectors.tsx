"use client";

/**
 * ToneLanguageSelectors - Tone and language selection dropdowns.
 *
 * Extracted from AIGenerationModal for better component organization.
 */

import { type FC } from "react";

import {
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@tevero/ui";

import {
  type TonePreset,
  type GenerationLanguage,
  TONE_CONFIGS,
  LANGUAGE_OPTIONS,
  getLocalizedLabel,
} from "./ai-generation-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToneLanguageSelectorsProps {
  tone: TonePreset;
  onToneChange: (tone: TonePreset) => void;
  language: GenerationLanguage;
  onLanguageChange: (language: GenerationLanguage) => void;
  locale: "en" | "lt";
  toneLabel: string;
  languageLabel: string;
}

// ---------------------------------------------------------------------------
// ToneLanguageSelectors
// ---------------------------------------------------------------------------

export const ToneLanguageSelectors: FC<ToneLanguageSelectorsProps> = ({
  tone,
  onToneChange,
  language,
  onLanguageChange,
  locale,
  toneLabel,
  languageLabel,
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Tone Select */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{toneLabel}</Label>
        <Select value={tone} onValueChange={(value: TonePreset) => onToneChange(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONE_CONFIGS.map((config) => (
              <SelectItem key={config.value} value={config.value}>
                {getLocalizedLabel(config, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Language Select */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{languageLabel}</Label>
        <Select
          value={language}
          onValueChange={(value: GenerationLanguage) => onLanguageChange(value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
