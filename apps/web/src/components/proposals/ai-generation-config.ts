/**
 * AI Generation Configuration
 *
 * Extracted from AIGenerationModal for better maintainability.
 * Contains all configuration data for AI content generation.
 */

import {
  FileSearch,
  Key,
  Building2,
  Users,
  Sparkles,
  FileText,
  TrendingUp,
  DollarSign,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
export type TonePreset = "professional" | "friendly" | "technical" | "urgent";

/**
 * Language options.
 */
export type GenerationLanguage = "en" | "lt";

/**
 * Context item configuration (without runtime availability).
 */
export interface ContextConfig {
  type: ContextType;
  label: string;
  labelLt: string;
  description: string;
  descriptionLt: string;
  icon: typeof FileSearch;
}

/**
 * Section item configuration.
 */
export interface SectionConfig {
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

// ---------------------------------------------------------------------------
// Configuration Data
// ---------------------------------------------------------------------------

/**
 * Context configurations with icons and labels.
 */
export const CONTEXT_CONFIGS: ContextConfig[] = [
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
] as const;

/**
 * Section configurations for AI generation.
 */
export const SECTION_CONFIGS: SectionConfig[] = [
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
] as const;

/**
 * Tone preset configurations.
 */
export const TONE_CONFIGS: ToneConfig[] = [
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
] as const;

/**
 * Language options.
 */
export const LANGUAGE_OPTIONS = [
  { value: "en" as const, label: "English" },
  { value: "lt" as const, label: "Lietuviu" },
] as const;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get localized label from a config item.
 */
export function getLocalizedLabel(
  item: { label: string; labelLt: string },
  locale: "en" | "lt"
): string {
  return locale === "lt" ? item.labelLt : item.label;
}

/**
 * Get localized description from a config item.
 */
export function getLocalizedDescription(
  item: { description: string; descriptionLt: string },
  locale: "en" | "lt"
): string {
  return locale === "lt" ? item.descriptionLt : item.description;
}

/**
 * UI labels for the modal, localized.
 */
export function getUILabels(locale: "en" | "lt") {
  return {
    title: locale === "lt" ? "Generuoti su AI" : "Generate with AI",
    description:
      locale === "lt"
        ? "Pasirinkite konteksta ir sekcijas, kurias norite sugeneruoti"
        : "Select context and sections you want to generate",
    contextHeader: locale === "lt" ? "Prieinama kontekstas" : "Available Context",
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
    generating: locale === "lt" ? "Generuojama..." : "Generating...",
  };
}
