/**
 * Document Builder Type Definitions
 * Phase 102-01: Foundation Schema and Types
 *
 * Implements the 3-layer architecture (Structure, Content, Context)
 * for the persuasion-aware document builder.
 */

import { z } from "zod";
import type { EditorSection, TemplateSectionType } from "@/components/proposals/types";

/**
 * All 11 persuasion block types per CONTEXT.md Section 1.
 * Each type has specific copy and psychological purpose.
 */
export type PersuasionBlockType =
  | "pain_amplifier"
  | "villain_story"
  | "credibility"
  | "social_proof"
  | "process_reveal"
  | "offer_stack"
  | "risk_reversal"
  | "objection_handler"
  | "urgency"
  | "cta"
  | "custom";

/**
 * Array constant for iteration/validation.
 * Note: `as const` provides readonly literal tuple inference.
 * Do NOT add an explicit type annotation as it would widen the type.
 */
export const PERSUASION_BLOCK_TYPES_ARRAY = [
  "pain_amplifier",
  "villain_story",
  "credibility",
  "social_proof",
  "process_reveal",
  "offer_stack",
  "risk_reversal",
  "objection_handler",
  "urgency",
  "cta",
  "custom",
] as const;

/**
 * Metadata for persuasion blocks.
 * Provides AI hints and framework compliance info.
 */
export interface PersuasionMeta {
  /** Hint for AI content generation */
  aiHints?: string;
  /** Framework this block belongs to */
  frameworkId?: string;
  /** Whether this block is required by the framework */
  isRequired?: boolean;
  /** Additional custom metadata (use this instead of index signature) */
  customData?: Record<string, unknown>;
}

/**
 * Extended EditorSection with persuasion awareness (D-01).
 * Extends the base EditorSection from proposals/types.ts.
 */
export interface ExtendedEditorSection extends EditorSection {
  /** Optional persuasion block type classification */
  persuasionType?: PersuasionBlockType;
  /** Metadata for AI and framework compliance */
  persuasionMeta?: PersuasionMeta;
}

/**
 * Template content modes per D-07.
 * Controls how block content is handled during generation.
 */
export type TemplateContentMode = "fixed" | "variable" | "regenerate";

/**
 * TipTap document node structure.
 * Simplified representation for typing purposes.
 */
export interface TipTapContent {
  type: string;
  content?: TipTapContent[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

// =====================================
// Zod Schemas for Runtime Validation
// H-10-02: Runtime validation for TipTapContent
// =====================================

/**
 * TipTap mark schema for inline formatting.
 */
const tipTapMarkSchema = z.object({
  type: z.string().min(1).max(50),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

/**
 * TipTap node schema (recursive for nested content).
 * H-10-02: Provides runtime validation for TipTapContent.
 *
 * Note: Using z.lazy() for recursive types. Depth is naturally
 * limited by practical document structure (~10-20 levels max).
 */
const baseTipTapNodeSchema = z.object({
  type: z.string().min(1).max(50),
  text: z.string().max(100000).optional(), // 100KB max per text node
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(tipTapMarkSchema).max(20).optional(),
});

export const tipTapContentSchema: z.ZodType<TipTapContent> = baseTipTapNodeSchema.extend({
  content: z.lazy(() => z.array(tipTapContentSchema).max(1000)).optional(),
});

/**
 * TipTap document schema (root must be 'doc' type).
 */
export const tipTapDocumentSchema = tipTapContentSchema.refine(
  (doc) => doc.type === "doc",
  { message: "Root node must be of type 'doc'" }
);

/**
 * Block variant status schema.
 */
export const blockVariantStatusSchema = z.enum(["active", "paused", "winner", "loser"]);

/**
 * Block styling schema for runtime validation.
 */
export const blockStylingSchema = z.object({
  backgroundColor: z.string().max(50).optional(),
  textColor: z.string().max(50).optional(),
  borderColor: z.string().max(50).optional(),
  padding: z.string().max(50).optional(),
  margin: z.string().max(50).optional(),
  fontFamily: z.string().max(100).optional(),
  fontSize: z.string().max(20).optional(),
  customStyles: z.record(z.string(), z.unknown()).optional(),
}).nullable();

/**
 * Block variant schema for runtime validation.
 * M-10-04: Mirrors DB constraints for application-level validation.
 */
export const blockVariantSchema = z.object({
  id: z.string().min(1).max(100),
  parentBlockId: z.string().min(1).max(100),
  variantName: z.string().min(1).max(100),
  content: tipTapContentSchema,
  styling: blockStylingSchema,
  weight: z.number().int().min(0).max(100),
  impressions: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  status: blockVariantStatusSchema,
  createdAt: z.string().datetime(),
});

/**
 * Type inferred from blockVariantSchema for type-safe validation.
 */
export type ValidatedBlockVariant = z.infer<typeof blockVariantSchema>;

/**
 * Template block definition with content mode.
 */
export interface TemplateBlock {
  id: string;
  type: PersuasionBlockType;
  mode: TemplateContentMode;
  defaultContent?: TipTapContent;
  /** Variable keys that can be injected into this block */
  variableKeys?: string[];
}

/**
 * Block styling configuration.
 */
export interface BlockStyling {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  padding?: string;
  margin?: string;
  fontFamily?: string;
  fontSize?: string;
  /** Additional custom styles (use this instead of index signature) */
  customStyles?: Record<string, unknown>;
}

/**
 * Block variant status for A/B testing.
 */
export type BlockVariantStatus = "active" | "paused" | "winner" | "loser";

/**
 * Typed constants for BlockVariantStatus.
 * Use these instead of type assertions like `'active' as BlockVariantStatus`.
 */
export const VARIANT_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  WINNER: "winner",
  LOSER: "loser",
} as const satisfies Record<string, BlockVariantStatus>;

/**
 * Block variant for A/B testing (D-02).
 * Normalized table design - separate from parent block.
 */
export interface BlockVariant {
  id: string;
  parentBlockId: string;
  variantName: string;
  content: TipTapContent;
  styling: BlockStyling | null;
  /** Traffic allocation weight (0-100) */
  weight: number;
  impressions: number;
  conversions: number;
  status: BlockVariantStatus;
  createdAt: string;
}

// =====================================
// 3-Layer Architecture Interfaces
// =====================================

/**
 * Block reference in StructureLayer.
 */
export interface StructureBlockRef {
  id: string;
  type: PersuasionBlockType;
  position: number;
}

/**
 * Framework validation result.
 */
export interface FrameworkValidation {
  isValid: boolean;
  missingBlocks?: PersuasionBlockType[];
  warnings?: string[];
}

/**
 * LAYER 1: Structure Layer
 * Defines the document skeleton and framework compliance.
 */
export interface StructureLayer {
  /** Ordered list of block references */
  blocks: StructureBlockRef[];
  /** Optional framework identifier */
  frameworkId?: string;
  /** Framework display name */
  frameworkName?: string;
  /** Framework compliance validation result */
  validation?: FrameworkValidation;
}

/**
 * Content block in ContentLayer.
 */
export interface ContentBlock {
  id: string;
  content: TipTapContent;
  styling?: BlockStyling;
}

/**
 * LAYER 2: Content Layer
 * Stores the actual block content and version info.
 */
export interface ContentLayer {
  /** Block content keyed by block ID */
  blocks: ContentBlock[];
  /** Content version number */
  version: number;
  /** ISO timestamp of last modification */
  lastModified: string;
}

/**
 * Prospect information for context.
 */
export interface ProspectContext {
  id: string;
  domain?: string;
  niche?: string;
  painPoints?: string[];
  /** Additional custom prospect data (use this instead of index signature) */
  customData?: Record<string, unknown>;
}

/**
 * Style reference for AI generation.
 */
export interface StyleReference {
  id: string;
  type: "pdf" | "url" | "text";
  url?: string;
  content?: string;
}

/**
 * Previous success for social proof context.
 */
export interface PreviousSuccess {
  caseStudyId: string;
  relevanceScore: number;
  matchingKeywords?: string[];
}

/**
 * LAYER 3: Context Layer
 * Provides prospect info and AI generation context.
 */
export interface ContextLayer {
  /** Prospect information */
  prospect: ProspectContext;
  /** Style references for AI tone matching */
  styleReferences?: StyleReference[];
  /** Previous successful proposals for context */
  previousSuccesses?: PreviousSuccess[];
}

// =====================================
// Composite Types
// =====================================

/**
 * Complete document state combining all 3 layers.
 */
export interface DocumentState {
  structure: StructureLayer;
  content: ContentLayer;
  context: ContextLayer;
}

/**
 * Framework template definition.
 */
export interface FrameworkTemplate {
  id: string;
  name: string;
  description: string;
  requiredBlocks: PersuasionBlockType[];
  recommendedSequence: PersuasionBlockType[];
}

/**
 * PersuasionBlock - A single block in the document canvas.
 * Used by the Zustand store and React components.
 */
export interface PersuasionBlock {
  /** Unique block identifier */
  id: string;
  /** Persuasion block type */
  type: PersuasionBlockType;
  /** Position/order in the document */
  position: number;
  /** TipTap content (nullable for empty blocks) */
  content: TipTapContent | null;
  /** User-editable title */
  title?: string;
  /** Block styling overrides */
  styling?: BlockStyling;
  /** Persuasion metadata for AI and framework compliance */
  persuasionMeta?: PersuasionMeta;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last modification */
  updatedAt: string;
}

// =====================================
// Block-Specific Content Types (Discriminated Unions)
// =====================================

/**
 * Content specific to pain_amplifier blocks.
 */
export interface PainAmplifierContent {
  headline?: string;
  lossAmount?: string;
  painPoints?: string[];
}

/**
 * Content specific to villain_story blocks.
 */
export interface VillainStoryContent {
  villain?: string;
  problem?: string;
  contrast?: string;
}

/**
 * Content specific to credibility blocks.
 */
export interface CredibilityContent {
  yearsExperience?: number;
  clientCount?: number;
  certifications?: string[];
  awards?: string[];
}

/**
 * Content specific to social_proof blocks.
 */
export interface SocialProofContent {
  testimonials?: Array<{
    quote: string;
    name: string;
    company?: string;
    metric?: string;
  }>;
  logos?: string[];
}

/**
 * Content specific to process_reveal blocks.
 */
export interface ProcessRevealContent {
  steps?: Array<{
    number: number;
    title: string;
    description: string;
  }>;
}

/**
 * Content specific to offer_stack blocks.
 */
export interface OfferStackContent {
  packageName?: string;
  items?: Array<{
    name: string;
    value: string;
  }>;
  totalValue?: string;
  price?: string;
}

/**
 * Content specific to risk_reversal blocks.
 */
export interface RiskReversalContent {
  guaranteeType?: string;
  metric?: string;
  timeframe?: string;
  terms?: string;
}

/**
 * Content specific to objection_handler blocks.
 */
export interface ObjectionHandlerContent {
  objections?: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Content specific to urgency blocks.
 */
export interface UrgencyContent {
  expirationDate?: string;
  capacityRemaining?: number;
  reason?: string;
}

/**
 * Content specific to cta blocks.
 */
export interface CtaContent {
  primaryAction?: string;
  calendarLink?: string;
  alternativeAction?: string;
}

/**
 * Content specific to custom blocks.
 */
export interface CustomBlockContent {
  freeform?: string;
}

/**
 * Union of all block-specific content types.
 * Used for structured data extraction and type narrowing.
 */
export type BlockSpecificContent =
  | PainAmplifierContent
  | VillainStoryContent
  | CredibilityContent
  | SocialProofContent
  | ProcessRevealContent
  | OfferStackContent
  | RiskReversalContent
  | ObjectionHandlerContent
  | UrgencyContent
  | CtaContent
  | CustomBlockContent;

// =====================================
// Discriminated Block Types
// =====================================

/**
 * Base block interface for discriminated union.
 */
interface BaseBlock {
  id: string;
  position: number;
  content: TipTapContent | null;
  title?: string;
  styling?: BlockStyling;
  persuasionMeta?: PersuasionMeta;
  createdAt: string;
  updatedAt: string;
}

/** Pain Amplifier block with type-specific structured content. */
export interface PainAmplifierBlock extends BaseBlock {
  type: "pain_amplifier";
  structuredContent?: PainAmplifierContent;
}

/** Villain Story block with type-specific structured content. */
export interface VillainStoryBlock extends BaseBlock {
  type: "villain_story";
  structuredContent?: VillainStoryContent;
}

/** Credibility block with type-specific structured content. */
export interface CredibilityBlock extends BaseBlock {
  type: "credibility";
  structuredContent?: CredibilityContent;
}

/** Social Proof block with type-specific structured content. */
export interface SocialProofBlock extends BaseBlock {
  type: "social_proof";
  structuredContent?: SocialProofContent;
}

/** Process Reveal block with type-specific structured content. */
export interface ProcessRevealBlock extends BaseBlock {
  type: "process_reveal";
  structuredContent?: ProcessRevealContent;
}

/** Offer Stack block with type-specific structured content. */
export interface OfferStackBlock extends BaseBlock {
  type: "offer_stack";
  structuredContent?: OfferStackContent;
}

/** Risk Reversal block with type-specific structured content. */
export interface RiskReversalBlock extends BaseBlock {
  type: "risk_reversal";
  structuredContent?: RiskReversalContent;
}

/** Objection Handler block with type-specific structured content. */
export interface ObjectionHandlerBlock extends BaseBlock {
  type: "objection_handler";
  structuredContent?: ObjectionHandlerContent;
}

/** Urgency block with type-specific structured content. */
export interface UrgencyBlock extends BaseBlock {
  type: "urgency";
  structuredContent?: UrgencyContent;
}

/** CTA block with type-specific structured content. */
export interface CtaBlock extends BaseBlock {
  type: "cta";
  structuredContent?: CtaContent;
}

/** Custom block with freeform structured content. */
export interface CustomBlock extends BaseBlock {
  type: "custom";
  structuredContent?: CustomBlockContent;
}

/**
 * Discriminated union of all typed blocks.
 * Use for type narrowing: switch(block.type) { case "pain_amplifier": ... }
 */
export type TypedPersuasionBlock =
  | PainAmplifierBlock
  | VillainStoryBlock
  | CredibilityBlock
  | SocialProofBlock
  | ProcessRevealBlock
  | OfferStackBlock
  | RiskReversalBlock
  | ObjectionHandlerBlock
  | UrgencyBlock
  | CtaBlock
  | CustomBlock;

// =====================================
// Type Guards
// =====================================

/**
 * Type guard to check if a block is a specific type.
 * Works with both PersuasionBlock and TypedPersuasionBlock inputs.
 */
export function isBlockType<T extends PersuasionBlockType>(
  block: PersuasionBlock | TypedPersuasionBlock,
  type: T
): block is TypedPersuasionBlock & { type: T } {
  return block.type === type;
}

/**
 * Type guard for pain amplifier blocks.
 * Accepts PersuasionBlock or TypedPersuasionBlock and narrows to PainAmplifierBlock.
 */
export function isPainAmplifierBlock(
  block: PersuasionBlock | TypedPersuasionBlock
): block is PainAmplifierBlock {
  return block.type === "pain_amplifier";
}

/**
 * Type guard for social proof blocks.
 * Accepts PersuasionBlock or TypedPersuasionBlock and narrows to SocialProofBlock.
 */
export function isSocialProofBlock(
  block: PersuasionBlock | TypedPersuasionBlock
): block is SocialProofBlock {
  return block.type === "social_proof";
}

/**
 * Type guard for CTA blocks.
 * Accepts PersuasionBlock or TypedPersuasionBlock and narrows to CtaBlock.
 */
export function isCtaBlock(
  block: PersuasionBlock | TypedPersuasionBlock
): block is CtaBlock {
  return block.type === "cta";
}

/**
 * Type guard for credibility blocks.
 * Accepts PersuasionBlock or TypedPersuasionBlock and narrows to CredibilityBlock.
 */
export function isCredibilityBlock(
  block: PersuasionBlock | TypedPersuasionBlock
): block is CredibilityBlock {
  return block.type === "credibility";
}

/**
 * Type guard for offer stack blocks.
 * Accepts PersuasionBlock or TypedPersuasionBlock and narrows to OfferStackBlock.
 */
export function isOfferStackBlock(
  block: PersuasionBlock | TypedPersuasionBlock
): block is OfferStackBlock {
  return block.type === "offer_stack";
}
