"use client";

/**
 * AIGenerationModal - AI content generation configuration dialog.
 * Phase 57-07: AI Content Generation
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

import { type FC, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Button,
  Checkbox,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@tevero/ui";
import {
  Sparkles,
  FileSearch,
  Key,
  Building2,
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Available context types for AI generation.
 */
export type ContextType = "audit" | "keywords" | "prospect" | "competitor";

/**
 * Section types that can be AI-generated.
 */
export type GeneratableSectionType =
  | "hero"
  | "current_state"
  | "opportunities"
  | "roi";

/**
 * Tone presets for AI generation.
 */
export type TonePreset =
  | "professional"
  | "friendly"
  | "technical"
  | "urgent";

/**
 * Language options.
 */
export type GenerationLanguage = "en" | "lt";

/**
 * Context item with availability status.
 */
export interface ContextItem {
  type: ContextType;
  available: boolean;
  label: string;
  labelLt: string;
  description: string;
  descriptionLt: string;
  icon: typeof FileSearch;
  /** Summary info when available (e.g., "Score: 72/100") */
  summary?: string;
}

/**
 * Section item for generation selection.
 */
export interface SectionItem {
  type: GeneratableSectionType;
  label: string;
  labelLt: string;
  description: string;
  descriptionLt: string;
  icon: typeof FileText;
}

/**
 * Tone preset configuration.
 */
export interface ToneConfig {
  value: TonePreset;
  label: string;
  labelLt: string;
  description: string;
  descriptionLt: string;
}

/**
 * Generation request payload.
 */
export interface GenerationRequest {
  sections: GeneratableSectionType[];
  context: ContextType[];
  tone: TonePreset;
  language: GenerationLanguage;
}

/**
 * Context configurations with icons and labels.
 */
const CONTEXT_CONFIGS: Omit<ContextItem, "available" | "summary">[] = [
  {
    type: "audit",
    label: "Website Audit Results",
    labelLt: "Svetaines audito rezultatai",
    description: "SEO score, technical issues, and recommendations",
    descriptionLt: "SEO balas, technines problemos ir rekomendacijos",
    icon: FileSearch,
  },
  {
    type: "keywords",
    label: "Keyword Research",
    labelLt: "Raktazodziu tyrimas",
    description: "Opportunities, search volumes, and difficulty",
    descriptionLt: "Galimybes, paieskos apimtys ir sudetingumas",
    icon: Key,
  },
  {
    type: "prospect",
    label: "Prospect Information",
    labelLt: "Prospekto informacija",
    description: "Company name, industry, and contact details",
    descriptionLt: "Imones pavadinimas, industrija ir kontaktai",
    icon: Building2,
  },
  {
    type: "competitor",
    label: "Competitor Analysis",
    labelLt: "Konkurentu analize",
    description: "Competitor domains, traffic, and gaps",
    descriptionLt: "Konkurentu domenai, srautas ir spragu",
    icon: Users,
  },
];

/**
 * Section configurations for AI generation.
 */
const SECTION_CONFIGS: SectionItem[] = [
  {
    type: "hero",
    label: "Hero / Introduction",
    labelLt: "Ivadas",
    description: "Personalized opening hook and headline",
    descriptionLt: "Personalizuotas pradinis kabliukas ir antrastes",
    icon: Sparkles,
  },
  {
    type: "current_state",
    label: "Current State Analysis",
    labelLt: "Dabartines bukles analize",
    description: "Summary of audit findings and current performance",
    descriptionLt: "Audito isvabu ir dabartines bukles santrauka",
    icon: FileText,
  },
  {
    type: "opportunities",
    label: "Opportunities",
    labelLt: "Galimybes",
    description: "Keyword opportunities and growth potential",
    descriptionLt: "Raktazodziu galimybes ir augimo potencialas",
    icon: TrendingUp,
  },
  {
    type: "roi",
    label: "ROI Projections",
    labelLt: "ROI prognozes",
    description: "Traffic and revenue projections",
    descriptionLt: "Srauto ir pajamu prognozes",
    icon: DollarSign,
  },
];

/**
 * Tone preset configurations.
 */
const TONE_CONFIGS: ToneConfig[] = [
  {
    value: "professional",
    label: "Professional & Consultative",
    labelLt: "Profesionalus, konsultacinis",
    description: "Formal, ROI-focused, authoritative",
    descriptionLt: "Formalus, orientuotas i ROI, autoritetingas",
  },
  {
    value: "friendly",
    label: "Friendly & Approachable",
    labelLt: "Draugiskas ir prieinamas",
    description: "Warm, conversational, supportive",
    descriptionLt: "Siltus, pokalbio stiliaus, palaikymas",
  },
  {
    value: "technical",
    label: "Technical & Detailed",
    labelLt: "Techninis ir detalizuotas",
    description: "Data-driven, specific metrics, deep analysis",
    descriptionLt: "Paremtas duomenimis, tikslios metrikos, gili analize",
  },
  {
    value: "urgent",
    label: "Urgent & Action-Oriented",
    labelLt: "Skubus ir veiksmo orientuotas",
    description: "Time-sensitive, compelling CTA, scarcity",
    descriptionLt: "Laiko spaudimas, itikinantis CTA, ribotumas",
  },
];

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

/**
 * AIGenerationModal component.
 *
 * Modal dialog for configuring AI content generation parameters.
 */
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
  const [selectedContext, setSelectedContext] = useState<ContextType[]>(() => {
    // Default to all available context
    const defaults: ContextType[] = [];
    if (availableContext.hasAudit) defaults.push("audit");
    if (availableContext.hasKeywords) defaults.push("keywords");
    if (availableContext.hasProspect) defaults.push("prospect");
    if (availableContext.hasCompetitor) defaults.push("competitor");
    return defaults;
  });

  // Selected sections to generate
  const [selectedSections, setSelectedSections] = useState<GeneratableSectionType[]>([]);

  // Tone preset
  const [tone, setTone] = useState<TonePreset>("professional");

  // Language
  const [language, setLanguage] = useState<GenerationLanguage>(locale);

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

  // Get localized label
  const getLabel = useCallback(
    (item: { label: string; labelLt: string }) =>
      locale === "lt" ? item.labelLt : item.label,
    [locale]
  );

  const getDescription = useCallback(
    (item: { description: string; descriptionLt: string }) =>
      locale === "lt" ? item.descriptionLt : item.description,
    [locale]
  );

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

  // Check if section already exists
  const isSectionExisting = useCallback(
    (type: GeneratableSectionType) => existingSections.includes(type),
    [existingSections]
  );

  // UI labels
  const labels = {
    title: locale === "lt" ? "Generuoti su AI" : "Generate with AI",
    description:
      locale === "lt"
        ? "Pasirinkite konteksta ir sekcijas, kurias norite sugeneruoti"
        : "Select context and sections you want to generate",
    contextHeader:
      locale === "lt" ? "Prieinama kontekstas" : "Available Context",
    sectionsHeader:
      locale === "lt" ? "Sekcijos generavimui" : "Sections to Generate",
    toneLabel: locale === "lt" ? "Tonas ir stilius" : "Tone & Style",
    languageLabel: locale === "lt" ? "Kalba" : "Language",
    generateButton: locale === "lt" ? "Generuoti" : "Generate",
    cancelButton: locale === "lt" ? "Atsaukti" : "Cancel",
    notAvailable: locale === "lt" ? "Nepasiekiama" : "Not available",
    exists: locale === "lt" ? "Jau egzistuoja" : "Already exists",
    selectAtLeastOne:
      locale === "lt"
        ? "Pasirinkite bent viena sekcija"
        : "Select at least one section",
  };

  const canGenerate = selectedSections.length > 0 && !isGenerating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-lg border bg-background p-6 shadow-lg">
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
            <Label className="text-sm font-medium">
              {labels.contextHeader}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {contextItems.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedContext.includes(item.type);

                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => item.available && toggleContext(item.type)}
                    disabled={!item.available}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left",
                      "transition-colors",
                      item.available
                        ? "hover:border-primary hover:bg-accent cursor-pointer"
                        : "opacity-50 cursor-not-allowed",
                      isSelected && item.available && "border-primary bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={isSelected && item.available}
                      disabled={!item.available}
                      onCheckedChange={() => toggleContext(item.type)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {getLabel(item)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {item.available
                          ? item.summary || getDescription(item)
                          : labels.notAvailable}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sections to Generate */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {labels.sectionsHeader}
            </Label>
            <div className="space-y-2">
              {SECTION_CONFIGS.map((section) => {
                const Icon = section.icon;
                const isSelected = selectedSections.includes(section.type);
                const exists = isSectionExisting(section.type);

                return (
                  <button
                    key={section.type}
                    type="button"
                    onClick={() => toggleSection(section.type)}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-lg border p-3 text-left",
                      "transition-colors hover:border-primary hover:bg-accent",
                      isSelected && "border-primary bg-accent"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSection(section.type)}
                    />
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">
                        {getLabel(section)}
                      </span>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {getDescription(section)}
                      </p>
                    </div>
                    {exists && (
                      <span className="text-xs text-amber-600 shrink-0">
                        {labels.exists}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone & Language Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Tone Select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{labels.toneLabel}</Label>
              <Select
                value={tone}
                onValueChange={(value: TonePreset) => setTone(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_CONFIGS.map((config) => (
                    <SelectItem key={config.value} value={config.value}>
                      {getLabel(config)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Select */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {labels.languageLabel}
              </Label>
              <Select
                value={language}
                onValueChange={(value: GenerationLanguage) =>
                  setLanguage(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="lt">Lietuviu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            {labels.cancelButton}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "lt" ? "Generuojama..." : "Generating..."}
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
