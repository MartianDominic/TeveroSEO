/**
 * Types for Phase 92 On-Page SEO Mastery.
 *
 * Defines verticals, classification schemas, and quality gate interfaces.
 */
import { z } from "zod";

// 12 primary verticals from CONTEXT.md + general fallback
export const VERTICALS = [
  "healthcare",
  "legal",
  "financial",
  "ecommerce",
  "saas",
  "real_estate",
  "home_services",
  "hospitality",
  "education",
  "professional",
  "manufacturing",
  "nonprofit",
  "general",
] as const;

export type Vertical = (typeof VERTICALS)[number];

// YMYL verticals requiring stricter quality gates
export const YMYL_VERTICALS: Vertical[] = ["healthcare", "legal", "financial"];

/**
 * Check if a vertical is YMYL (Your Money or Your Life).
 */
export function isYmylVertical(vertical: Vertical): boolean {
  return YMYL_VERTICALS.includes(vertical);
}

// Classification methods
export const CLASSIFICATION_METHODS = [
  "schema",
  "url-pattern",
  "keyword",
  "client-setting",
  "llm",
] as const;

export type ClassificationMethod = (typeof CLASSIFICATION_METHODS)[number];

/**
 * Classification result from VerticalClassifier.
 */
export interface Classification {
  vertical: Vertical;
  confidence: number; // 0-1
  isYmyl: boolean;
  method: ClassificationMethod;
}

/**
 * Zod schema for LLM classification response validation.
 */
export const ClassificationResponseSchema = z.object({
  vertical: z.enum(VERTICALS),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>;

/**
 * Schema.org type to vertical mapping (from COST-CONTROL.md).
 * Used for heuristic classification with high confidence (0.95).
 */
export const SCHEMA_TO_VERTICAL: Record<string, Vertical> = {
  // Healthcare
  LocalBusiness: "home_services",
  MedicalBusiness: "healthcare",
  MedicalOrganization: "healthcare",
  Hospital: "healthcare",
  Physician: "healthcare",
  Dentist: "healthcare",
  MedicalClinic: "healthcare",

  // Legal
  LegalService: "legal",
  Attorney: "legal",
  LawFirm: "legal",

  // Financial
  FinancialService: "financial",
  BankOrCreditUnion: "financial",
  InsuranceAgency: "financial",
  AccountingService: "financial",

  // Ecommerce
  Product: "ecommerce",
  Offer: "ecommerce",
  ShoppingCenter: "ecommerce",
  Store: "ecommerce",

  // SaaS
  SoftwareApplication: "saas",
  WebApplication: "saas",
  MobileApplication: "saas",

  // Real Estate
  RealEstateAgent: "real_estate",
  RealEstateListing: "real_estate",
  Apartment: "real_estate",
  House: "real_estate",

  // Home Services
  HomeAndConstructionBusiness: "home_services",
  Plumber: "home_services",
  Electrician: "home_services",
  HVACBusiness: "home_services",
  RoofingContractor: "home_services",

  // Hospitality
  Restaurant: "hospitality",
  Hotel: "hospitality",
  LodgingBusiness: "hospitality",
  FoodEstablishment: "hospitality",
  CafeOrCoffeeShop: "hospitality",

  // Education
  EducationalOrganization: "education",
  School: "education",
  Course: "education",
  CollegeOrUniversity: "education",

  // Professional
  ProfessionalService: "professional",
  ConsultingService: "professional",
  MarketingAgency: "professional",

  // Manufacturing
  Manufacturer: "manufacturing",

  // Nonprofit
  Organization: "nonprofit",
  NGO: "nonprofit",
  NonprofitOrganization: "nonprofit",
};

/**
 * URL patterns for vertical detection.
 * Used when Schema.org detection fails (confidence 0.90).
 */
export const URL_PATTERNS: Array<[RegExp, Vertical]> = [
  // Ecommerce patterns
  [/\/products?\/|\/shop\/|\/cart|\/checkout|\/store\//i, "ecommerce"],
  [/\/collections?\/|\/categories?\/|\/buy\//i, "ecommerce"],

  // SaaS patterns
  [/\/pricing|\/plans|\/features|\/integrations|\/demo/i, "saas"],
  [/\/signup|\/register|\/trial|\/dashboard/i, "saas"],

  // Home Services patterns
  [/\/locations?\/|\/near-me|\/service-area|\/coverage/i, "home_services"],
  [/\/services\/|\/our-services|\/what-we-do/i, "home_services"],

  // Healthcare patterns
  [/\/doctors?\/|\/health\/|\/medical|\/symptoms/i, "healthcare"],
  [/\/patients?\/|\/conditions?\/|\/treatments?/i, "healthcare"],
  [/\/wellness|\/clinic|\/healthcare/i, "healthcare"],

  // Legal patterns
  [/\/attorneys?\/|\/lawyers?\/|\/legal|\/law-firm/i, "legal"],
  [/\/practice-areas?\/|\/cases?\/|\/litigation/i, "legal"],

  // Financial patterns
  [/\/invest|\/finance|\/loans?|\/mortgage|\/insurance/i, "financial"],
  [/\/banking|\/credit|\/wealth|\/portfolio/i, "financial"],

  // Real Estate patterns
  [/\/properties|\/listings|\/real-estate|\/homes-for/i, "real_estate"],
  [/\/apartments?\/|\/rentals?\/|\/for-sale/i, "real_estate"],

  // Hospitality patterns
  [/\/book|\/reservations?|\/rooms?|\/hotels?/i, "hospitality"],
  [/\/menu|\/dining|\/restaurant/i, "hospitality"],

  // Education patterns
  [/\/courses?|\/learn|\/training|\/education/i, "education"],
  [/\/classes?|\/programs?|\/curriculum/i, "education"],
];

/**
 * YMYL keyword patterns for fallback detection.
 * Used when Schema.org and URL patterns fail (confidence 0.70).
 */
export const YMYL_KEYWORDS: Record<string, RegExp> = {
  healthcare:
    /\b(diagnosis|treatment|symptoms|medication|surgery|cancer|disease|prescription|dosage|side.?effects?|medical.?advice)\b/i,
  legal:
    /\b(lawsuit|liability|damages|settlement|litigation|attorney|court|verdict|plaintiff|defendant|legal.?advice)\b/i,
  financial:
    /\b(investment|retirement|401k|mortgage|bankruptcy|credit.?score|tax|debt|portfolio|financial.?advice)\b/i,
};

/**
 * On-page mastery context for check execution.
 */
export interface OnPageMasteryContext {
  url: string;
  html: string;
  vertical: Vertical;
  isYmyl: boolean;
  clientId: string;
  pageId?: string;
}

/**
 * Quality gate result from individual checks.
 */
export interface GateResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  method: "embedding" | "llm" | "llm-fallback" | "rule";
  confidence?: "high" | "medium" | "low";
  embeddingSimilarity?: number;
}

/**
 * Cached classification from database.
 */
export interface CachedClassification {
  id: string;
  clientId: string;
  domain: string;
  pathPattern: string;
  vertical: Vertical;
  confidence: number;
  isYmyl: boolean;
  method: ClassificationMethod;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * VerticalClassifier configuration.
 */
export interface VerticalClassifierConfig {
  /** Confidence threshold for heuristic finality (skip LLM) */
  heuristicThreshold: number;
  /** Cache TTL in days */
  cacheTtlDays: number;
  /** xAI API key (optional, uses env if not provided) */
  apiKey?: string;
}

export const DEFAULT_CLASSIFIER_CONFIG: VerticalClassifierConfig = {
  heuristicThreshold: 0.9,
  cacheTtlDays: 90,
};
