/**
 * Document Builder Type Definitions
 * Phase 102-01: Foundation Schema and Types
 *
 * Implements the 3-layer architecture (Structure, Content, Context)
 * for the persuasion-aware document builder.
 */

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
 */
export const PERSUASION_BLOCK_TYPES_ARRAY: PersuasionBlockType[] = [
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
  /** Additional custom metadata */
  [key: string]: unknown;
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
  [key: string]: unknown;
}

/**
 * Block variant status for A/B testing.
 */
export type BlockVariantStatus = "active" | "paused" | "winner" | "loser";

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
  [key: string]: unknown;
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
