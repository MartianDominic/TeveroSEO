/**
 * Industry Voice Templates
 * Phase 37-03: Voice Profile Management
 *
 * 8 pre-configured voice profiles for common industry verticals.
 * Templates provide sensible defaults that users can customize.
 */

import type {
  Archetype,
  ContractionUsage,
  HeadingStyle,
  VocabularyPatterns,
} from "@/db/voice-schema";

/**
 * Extracted voice dimensions for template defaults.
 * Matches the 12 voice dimensions in voiceProfiles schema.
 */
export interface ExtractedVoiceDimensions {
  tonePrimary: string;
  toneSecondary: string;
  formalityLevel: number;
  personalityTraits: string[];
  archetype: Archetype;
  sentenceLengthAvg: number;
  paragraphLengthAvg: number;
  contractionUsage: ContractionUsage;
  vocabularyPatterns: VocabularyPatterns;
  signaturePhrases: string[];
  forbiddenPhrases: string[];
  headingStyle: HeadingStyle;
}

/**
 * Industry template structure.
 */
export interface IndustryTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brief description of the voice style */
  description: string;
  /** Sample paragraph demonstrating this voice */
  exampleContent: string;
  /** Default values for all 12 voice dimensions */
  defaults: ExtractedVoiceDimensions;
}

/**
 * 8 pre-configured industry voice templates.
 */
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: "healthcare",
    name: "Healthcare",
    description: "Empathetic, clear, authoritative",
    exampleContent:
      "Your health journey matters to us. Our team of certified specialists provides personalized care tailored to your unique needs. We combine cutting-edge medical expertise with genuine compassion to ensure you receive the support you deserve throughout your treatment.",
    defaults: {
      tonePrimary: "empathetic",
      toneSecondary: "reassuring",
      formalityLevel: 7,
      personalityTraits: ["caring", "knowledgeable", "trustworthy"],
      archetype: "authoritative",
      sentenceLengthAvg: 18,
      paragraphLengthAvg: 4,
      contractionUsage: "sometimes",
      vocabularyPatterns: {
        preferred: [
          "care",
          "wellness",
          "personalized",
          "certified",
          "treatment",
          "health",
          "support",
        ],
        avoided: ["cheap", "deal", "guarantee", "miracle", "cure-all"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
  {
    id: "legal",
    name: "Legal",
    description: "Formal, precise, trustworthy",
    exampleContent:
      "Our attorneys possess extensive experience in navigating complex legal matters. We provide thorough analysis of your case, ensuring all aspects are examined with meticulous attention to detail. Our commitment to client confidentiality and ethical practice forms the foundation of every engagement.",
    defaults: {
      tonePrimary: "professional",
      toneSecondary: "confident",
      formalityLevel: 9,
      personalityTraits: ["precise", "trustworthy", "knowledgeable"],
      archetype: "authoritative",
      sentenceLengthAvg: 22,
      paragraphLengthAvg: 4,
      contractionUsage: "never",
      vocabularyPatterns: {
        preferred: [
          "counsel",
          "representation",
          "expertise",
          "confidential",
          "compliance",
          "jurisdiction",
        ],
        avoided: ["guarantee", "promise", "cheap", "quick fix", "loophole"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "title_case",
    },
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    description: "Friendly, action-oriented",
    exampleContent:
      "Discover your new favorite finds! We've curated an amazing collection just for you. Shop now and enjoy free shipping on orders over $50. Don't miss out on these incredible deals - your perfect purchase is just a click away!",
    defaults: {
      tonePrimary: "enthusiastic",
      toneSecondary: "friendly",
      formalityLevel: 4,
      personalityTraits: ["energetic", "helpful", "approachable"],
      archetype: "friendly",
      sentenceLengthAvg: 12,
      paragraphLengthAvg: 3,
      contractionUsage: "frequently",
      vocabularyPatterns: {
        preferred: [
          "discover",
          "exclusive",
          "save",
          "free",
          "limited",
          "shop",
          "love",
        ],
        avoided: ["obligation", "contract", "penalty", "complicated"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
  {
    id: "b2b_saas",
    name: "B2B SaaS",
    description: "Professional, technical, solution-focused",
    exampleContent:
      "Streamline your workflow with our enterprise-grade platform. Our solution integrates seamlessly with your existing tech stack, enabling your team to automate repetitive tasks and focus on high-impact work. See measurable ROI within the first quarter of implementation.",
    defaults: {
      tonePrimary: "professional",
      toneSecondary: "confident",
      formalityLevel: 6,
      personalityTraits: ["innovative", "reliable", "efficient"],
      archetype: "technical",
      sentenceLengthAvg: 16,
      paragraphLengthAvg: 4,
      contractionUsage: "sometimes",
      vocabularyPatterns: {
        preferred: [
          "streamline",
          "integrate",
          "automate",
          "scale",
          "ROI",
          "enterprise",
          "workflow",
        ],
        avoided: ["cheap", "basic", "simple", "old-fashioned"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
  {
    id: "financial",
    name: "Financial Services",
    description: "Trustworthy, precise, compliant",
    exampleContent:
      "Building your financial future requires a partner you can trust. Our advisors bring decades of market experience to help you navigate investment opportunities while managing risk. We maintain the highest standards of regulatory compliance and fiduciary responsibility.",
    defaults: {
      tonePrimary: "trustworthy",
      toneSecondary: "measured",
      formalityLevel: 8,
      personalityTraits: ["reliable", "knowledgeable", "prudent"],
      archetype: "authoritative",
      sentenceLengthAvg: 20,
      paragraphLengthAvg: 4,
      contractionUsage: "never",
      vocabularyPatterns: {
        preferred: [
          "investment",
          "portfolio",
          "fiduciary",
          "compliant",
          "growth",
          "secure",
        ],
        avoided: [
          "guaranteed returns",
          "get rich",
          "risk-free",
          "quick profit",
        ],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "title_case",
    },
  },
  {
    id: "real_estate",
    name: "Real Estate",
    description: "Warm, professional, local",
    exampleContent:
      "Finding your dream home is our passion. With deep roots in the local community, we understand what makes each neighborhood special. Let us guide you through every step of your property journey with personalized attention and market expertise you can count on.",
    defaults: {
      tonePrimary: "warm",
      toneSecondary: "professional",
      formalityLevel: 5,
      personalityTraits: ["approachable", "knowledgeable", "trustworthy"],
      archetype: "friendly",
      sentenceLengthAvg: 16,
      paragraphLengthAvg: 4,
      contractionUsage: "sometimes",
      vocabularyPatterns: {
        preferred: [
          "home",
          "community",
          "local",
          "property",
          "neighborhood",
          "investment",
        ],
        avoided: ["dump", "fixer-upper", "overpriced", "desperate"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
  {
    id: "home_services",
    name: "Home Services",
    description: "Friendly, reliable, local",
    exampleContent:
      "We treat your home like it's our own. Our licensed technicians arrive on time, every time, ready to solve your problems with skill and care. As your neighbors, we take pride in delivering honest work at fair prices. Call us today for a free estimate!",
    defaults: {
      tonePrimary: "friendly",
      toneSecondary: "dependable",
      formalityLevel: 4,
      personalityTraits: ["reliable", "honest", "hardworking"],
      archetype: "friendly",
      sentenceLengthAvg: 14,
      paragraphLengthAvg: 3,
      contractionUsage: "frequently",
      vocabularyPatterns: {
        preferred: [
          "licensed",
          "insured",
          "free estimate",
          "same-day",
          "guaranteed",
          "local",
        ],
        avoided: ["cheap", "no-name", "shortcut", "temporary fix"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
  {
    id: "technology",
    name: "Technology",
    description: "Innovative, clear, expert",
    exampleContent:
      "Pushing the boundaries of what's possible. Our engineering team builds cutting-edge solutions that transform how businesses operate. We combine deep technical expertise with user-centric design to create products that are powerful yet intuitive.",
    defaults: {
      tonePrimary: "innovative",
      toneSecondary: "confident",
      formalityLevel: 5,
      personalityTraits: ["forward-thinking", "precise", "creative"],
      archetype: "technical",
      sentenceLengthAvg: 15,
      paragraphLengthAvg: 4,
      contractionUsage: "sometimes",
      vocabularyPatterns: {
        preferred: [
          "innovative",
          "cutting-edge",
          "scalable",
          "seamless",
          "intelligent",
          "transform",
        ],
        avoided: ["outdated", "legacy", "complicated", "bloated"],
      },
      signaturePhrases: [],
      forbiddenPhrases: [],
      headingStyle: "sentence_case",
    },
  },
];

/**
 * Get a template by ID.
 *
 * @param id - Template ID (e.g., "healthcare", "legal")
 * @returns Template or undefined if not found
 */
export function getTemplate(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get just the defaults from a template.
 *
 * @param id - Template ID
 * @returns Voice dimension defaults or undefined
 */
export function getTemplateDefaults(
  id: string
): ExtractedVoiceDimensions | undefined {
  return getTemplate(id)?.defaults;
}

/**
 * Get all template IDs for validation.
 */
export const TEMPLATE_IDS = INDUSTRY_TEMPLATES.map((t) => t.id);
