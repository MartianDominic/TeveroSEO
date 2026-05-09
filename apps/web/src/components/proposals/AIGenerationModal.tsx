"use client";

/**
 * AIGenerationModal - AI content generation configuration dialog.
 * Phase 57-07: AI Content Generation
 *
 * Refactored: Configuration data and sub-components extracted to:
 * - ai-generation-config.ts (configuration data)
 * - ContextSelectionGrid.tsx
 * - SectionSelectionList.tsx
 * - ToneLanguageSelectors.tsx
 *
 * Features:
 * - Context checkboxes: audit, keywords, prospect info, competitor analysis
 * - Section selection checkboxes for AI generation
 * - Tone & style dropdown with presets
 * - Language selector (EN/LT)
 * - Generate button triggers API call
 *
 * Available context is dynamically determined based on proposal's linked data.
 */

import { type FC, useState, useCallback, useMemo, useEffect } from "react";

import { Sparkles, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Label,
} from "@tevero/ui";

// Extracted configuration and sub-components
import {
  type ContextType,
  type GeneratableSectionType,
  type TonePreset,
  type GenerationLanguage,
  CONTEXT_CONFIGS,
  getUILabels,
} from "./ai-generation-config";
import { ContextSelectionGrid, type ContextItem } from "./ContextSelectionGrid";
import { SectionSelectionList } from "./SectionSelectionList";
import { ToneLanguageSelectors } from "./ToneLanguageSelectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Generation request payload.
 */
export interface GenerationRequest {
  sections: GeneratableSectionType[];
  context: ContextType[];
  tone: TonePreset;
  language: GenerationLanguage;
}

export interface AIGenerationModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Available context based on linked proposal data */
  availableContext: {
    hasAudit: boolean;
    hasKeywords: boolean;
    hasProspect: boolean;
    hasCompetitor: boolean;
    auditScore?: number;
    keywordsCount?: number;
    competitorCount?: number;
  };
  /** Currently selected sections in the proposal */
  existingSections?: GeneratableSectionType[];
  /** Callback when generation is triggered */
  onGenerate: (request: GenerationRequest) => void;
  /** Whether generation is in progress */
  isGenerating?: boolean;
}

// ---------------------------------------------------------------------------
// AIGenerationModal
// ---------------------------------------------------------------------------

export const AIGenerationModal: FC<AIGenerationModalProps> = ({
  open,
  onOpenChange,
  locale = "en",
  availableContext,
  existingSections = [],
  onGenerate,
  isGenerating = false,
}) => {
  // Selected context types
  const [selectedContext, setSelectedContext] = useState<ContextType[]>([]);

  // CRIT-01 FIX: Sync selected context when availableContext prop changes
  // useState initializer only runs once, so we need useEffect to update when props change
  useEffect(() => {
    const defaults: ContextType[] = [];
    if (availableContext.hasAudit) defaults.push("audit");
    if (availableContext.hasKeywords) defaults.push("keywords");
    if (availableContext.hasProspect) defaults.push("prospect");
    if (availableContext.hasCompetitor) defaults.push("competitor");
    setSelectedContext(defaults);
  }, [
    availableContext.hasAudit,
    availableContext.hasKeywords,
    availableContext.hasProspect,
    availableContext.hasCompetitor,
  ]);

  // Selected sections to generate
  const [selectedSections, setSelectedSections] = useState<GeneratableSectionType[]>([]);

  // Tone preset
  const [tone, setTone] = useState<TonePreset>("professional");

  // Language
  const [language, setLanguage] = useState<GenerationLanguage>(locale);

  // Get localized UI labels
  const labels = useMemo(() => getUILabels(locale), [locale]);

  // Build context items with availability
  const contextItems: ContextItem[] = useMemo(() => {
    return CONTEXT_CONFIGS.map((config) => {
      let available = false;
      let summary: string | undefined;

      switch (config.type) {
        case "audit":
          available = availableContext.hasAudit;
          if (available && availableContext.auditScore !== undefined) {
            summary = `Score: ${availableContext.auditScore}/100`;
          }
          break;
        case "keywords":
          available = availableContext.hasKeywords;
          if (available && availableContext.keywordsCount !== undefined) {
            summary = `${availableContext.keywordsCount} ${locale === "lt" ? "galimybiu" : "opportunities"}`;
          }
          break;
        case "prospect":
          available = availableContext.hasProspect;
          break;
        case "competitor":
          available = availableContext.hasCompetitor;
          if (available && availableContext.competitorCount !== undefined) {
            summary = `${availableContext.competitorCount} ${locale === "lt" ? "konkurentai" : "competitors"}`;
          }
          break;
      }

      return { ...config, available, summary };
    });
  }, [availableContext, locale]);

  // Toggle context selection
  const toggleContext = useCallback((type: ContextType) => {
    setSelectedContext((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  // Toggle section selection
  const toggleSection = useCallback((type: GeneratableSectionType) => {
    setSelectedSections((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }, []);

  // Handle generate click
  const handleGenerate = useCallback(() => {
    if (selectedSections.length === 0) return;

    onGenerate({
      sections: selectedSections,
      context: selectedContext,
      tone,
      language,
    });
  }, [selectedSections, selectedContext, tone, language, onGenerate]);

  const canGenerate = selectedSections.length > 0 && !isGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-lg border bg-background p-6 shadow-[var(--shadow-modal)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {/* Available Context Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{labels.contextHeader}</Label>
            <ContextSelectionGrid
              items={contextItems}
              selectedContext={selectedContext}
              onToggle={toggleContext}
              locale={locale}
              notAvailableLabel={labels.notAvailable}
            />
          </div>

          {/* Sections to Generate */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{labels.sectionsHeader}</Label>
            <SectionSelectionList
              selectedSections={selectedSections}
              existingSections={existingSections}
              onToggle={toggleSection}
              locale={locale}
              existsLabel={labels.exists}
            />
          </div>

          {/* Tone & Language Row */}
          <ToneLanguageSelectors
            tone={tone}
            onToneChange={setTone}
            language={language}
            onLanguageChange={setLanguage}
            locale={locale}
            toneLabel={labels.toneLabel}
            languageLabel={labels.languageLabel}
          />
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            {labels.cancelButton}
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {labels.generating}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {labels.generateButton}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIGenerationModal;

// Re-export types for convenience
export type {
  ContextType,
  GeneratableSectionType,
  TonePreset,
  GenerationLanguage,
} from "./ai-generation-config";
