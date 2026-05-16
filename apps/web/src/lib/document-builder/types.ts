/**
 * Document Builder Types
 * Phase 102-01: Foundation schema and types
 *
 * Core types for the persuasion-aware document builder.
 * Supports 11 persuasion block types and 3-layer architecture.
 */

/**
 * All supported persuasion block types.
 * Based on Russell Brunson frameworks and common proposal patterns.
 */
export type PersuasionBlockType =
  | 'pain_amplifier'
  | 'villain_story'
  | 'credibility'
  | 'social_proof'
  | 'process_reveal'
  | 'offer_stack'
  | 'risk_reversal'
  | 'objection_handler'
  | 'urgency'
  | 'cta'
  | 'custom';

/**
 * Content mode for template blocks.
 */
export type TemplateContentMode = 'fixed' | 'variable' | 'regenerate';

/**
 * Persuasion-specific metadata attached to a block.
 */
export interface PersuasionMeta {
  /** AI generation hints */
  aiHints?: string;
  /** Framework this block belongs to */
  frameworkId?: string;
  /** Whether this block is required by the framework */
  isRequired?: boolean;
  /** Content mode for template blocks */
  contentMode?: TemplateContentMode;
}

/**
 * A single persuasion block in the document builder.
 */
export interface PersuasionBlock {
  /** Unique identifier */
  id: string;
  /** Block type determines structure and AI prompting */
  type: PersuasionBlockType;
  /** Position in the document (0-indexed) */
  position: number;
  /** TipTap-compatible content (JSON) */
  content: unknown;
  /** Visual styling overrides */
  styling?: Record<string, unknown>;
  /** Persuasion-specific metadata */
  persuasionMeta?: PersuasionMeta;
  /** Display title (optional, auto-generated from type if not set) */
  title?: string;
  /** View count for analytics */
  viewCount?: number;
  /** Dwell time in milliseconds for analytics */
  dwellTimeMs?: number;
  /** Timestamp of creation */
  createdAt?: string;
  /** Timestamp of last update */
  updatedAt?: string;
}

/**
 * A/B test variant for a block.
 */
export interface BlockVariant {
  /** Unique identifier */
  id: string;
  /** Parent block ID */
  parentBlockId: string;
  /** Display name (e.g., "Control", "Variant A") */
  variantName: string;
  /** TipTap-compatible content (JSON) */
  content: unknown;
  /** Visual styling overrides */
  styling?: Record<string, unknown>;
  /** Traffic weight (0-100) */
  weight: number;
  /** Number of impressions */
  impressions: number;
  /** Number of conversions */
  conversions: number;
  /** Status of the variant */
  status: 'active' | 'paused' | 'winner' | 'loser';
  /** Timestamp of creation */
  createdAt?: string;
}

/**
 * Structure Layer - Defines the overall document structure.
 * Handles block ordering, framework compliance, and validation.
 */
export interface StructureLayer {
  /** Ordered list of block IDs */
  blockOrder: string[];
  /** Framework ID if using a template */
  frameworkId?: string | null;
  /** Framework name for display */
  frameworkName?: string | null;
  /** Validation result from framework compliance check */
  validationResult?: {
    isValid: boolean;
    missingBlocks?: PersuasionBlockType[];
    warnings?: string[];
  } | null;
}

/**
 * Content Layer - The actual content within blocks.
 * Handles TipTap content, versions, and modifications.
 */
export interface ContentLayer {
  /** Map of block ID to content */
  blocks: Record<string, unknown>;
  /** Content version number */
  version: number;
  /** Last modification timestamp */
  lastModified: string;
}

/**
 * Context Layer - External context for AI generation.
 * Handles prospect data, style references, and success patterns.
 */
export interface ContextLayer {
  /** Current prospect data */
  prospect?: {
    id?: string;
    domain?: string;
    industry?: string;
    painPoints?: string[];
  };
  /** Style references from brand voice */
  styleReferences?: {
    voiceProfileId?: string;
    tonePreference?: string;
  };
  /** Previous successful proposals for reference */
  previousSuccesses?: {
    proposalId: string;
    conversionRate: number;
    industry: string;
  }[];
}
