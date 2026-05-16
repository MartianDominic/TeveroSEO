/**
 * Template Service for Document Builder
 * Phase 102-03: Framework templates
 *
 * Provides framework template management and validation.
 * Supports 3 proven frameworks: Russell Brunson, StoryBrand, PAS.
 */

import { nanoid } from "nanoid";

import {
  FRAMEWORK_TEMPLATES,
  PERSUASION_BLOCK_TYPES,
  getFrameworkTemplate as getFrameworkFromBlocks,
  validateFrameworkCompliance as validateFromBlocks,
} from "./persuasion-blocks";
import type {
  FrameworkTemplate,
  PersuasionBlock,
  PersuasionBlockType,
  TipTapContent,
} from "./types";

// ---------------------------------------------------------------------------
// Re-export framework template type and constants
// ---------------------------------------------------------------------------

export type { FrameworkTemplate };
export { FRAMEWORK_TEMPLATES };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of framework validation.
 */
export interface FrameworkValidationResult {
  /** Whether the current blocks satisfy the framework */
  isValid: boolean;
  /** Block types that are required but missing */
  missingBlocks: PersuasionBlockType[];
  /** Block types that are present but not part of the framework */
  extraBlocks: PersuasionBlockType[];
  /** Framework compliance percentage (0-100) */
  complianceScore: number;
  /** Human-readable warnings */
  warnings: string[];
}

/**
 * Pre-configured block for canvas initialization.
 */
export interface CanvasBlock {
  id: string;
  type: PersuasionBlockType;
  position: number;
  title: string;
  content: TipTapContent;
  persuasionMeta: {
    frameworkId: string;
    isRequired: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Template Service Functions
// ---------------------------------------------------------------------------

/**
 * Get a framework template by ID.
 *
 * @param frameworkId - Framework identifier (russell_brunson, storybrand, pas)
 * @returns Framework template or undefined if not found
 */
export function getFrameworkTemplate(
  frameworkId: string
): FrameworkTemplate | undefined {
  return getFrameworkFromBlocks(frameworkId);
}

/**
 * Get all available framework templates.
 */
export function getAllFrameworkTemplates(): readonly FrameworkTemplate[] {
  return FRAMEWORK_TEMPLATES;
}

/**
 * Apply a framework template to create canvas blocks.
 *
 * Creates pre-configured blocks in the recommended sequence
 * with proper metadata for framework tracking.
 *
 * @param frameworkId - Framework identifier
 * @returns Array of canvas blocks ready for the store
 */
export function applyFrameworkToCanvas(frameworkId: string): CanvasBlock[] {
  const framework = getFrameworkTemplate(frameworkId);
  if (!framework) {
    return [];
  }

  const now = new Date().toISOString();

  return framework.recommendedSequence.map((type, index) => {
    const metadata = PERSUASION_BLOCK_TYPES.find((b) => b.type === type);
    const isRequired = framework.requiredBlocks.includes(type);

    return {
      id: nanoid(),
      type,
      position: index,
      title: metadata?.label ?? "Custom Block",
      content: createEmptyTipTapDoc(),
      persuasionMeta: {
        frameworkId: framework.id,
        isRequired,
      },
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Validate blocks against a framework's requirements.
 *
 * @param blocks - Current blocks on the canvas
 * @param frameworkId - Framework to validate against
 * @returns Detailed validation result
 */
export function validateFrameworkCompliance(
  blocks: PersuasionBlock[],
  frameworkId: string
): FrameworkValidationResult {
  const framework = getFrameworkTemplate(frameworkId);

  // No framework = always valid
  if (!framework) {
    return {
      isValid: true,
      missingBlocks: [],
      extraBlocks: [],
      complianceScore: 100,
      warnings: [],
    };
  }

  const blockTypes = blocks.map((b) => b.type);
  const blockTypeSet = new Set(blockTypes);

  // Find missing required blocks
  const missingBlocks = framework.requiredBlocks.filter(
    (required) => !blockTypeSet.has(required)
  );

  // Find extra blocks not in recommended sequence
  const recommendedSet = new Set(framework.recommendedSequence);
  const extraBlocks = blockTypes.filter(
    (type) => !recommendedSet.has(type) && type !== "custom"
  );

  // Calculate compliance score
  const requiredCount = framework.requiredBlocks.length;
  const presentRequiredCount = requiredCount - missingBlocks.length;
  const complianceScore = requiredCount > 0
    ? Math.round((presentRequiredCount / requiredCount) * 100)
    : 100;

  // Generate warnings
  const warnings: string[] = [];

  for (const missing of missingBlocks) {
    const metadata = PERSUASION_BLOCK_TYPES.find((b) => b.type === missing);
    const label = metadata?.label ?? missing;
    warnings.push(
      `Missing required block: ${label}. Add it to match the ${framework.name} framework.`
    );
  }

  if (extraBlocks.length > 0) {
    warnings.push(
      `${extraBlocks.length} block(s) are outside the ${framework.name} template. Consider removing or replacing them.`
    );
  }

  // Check block order against recommended sequence
  const orderedTypes = framework.recommendedSequence.filter((type) =>
    blockTypeSet.has(type)
  );
  const actualOrder = blockTypes.filter((type) =>
    recommendedSet.has(type)
  );

  // Simple order check: are the present blocks in recommended order?
  const isCorrectOrder = orderedTypes.every(
    (type, index) => actualOrder[index] === type
  );

  if (!isCorrectOrder && actualOrder.length > 1) {
    warnings.push(
      `Block order differs from ${framework.name} recommendation. Consider reordering for maximum impact.`
    );
  }

  return {
    isValid: missingBlocks.length === 0,
    missingBlocks,
    extraBlocks,
    complianceScore,
    warnings,
  };
}

/**
 * Get the recommended block sequence for a framework.
 *
 * @param frameworkId - Framework identifier
 * @returns Ordered array of block types
 */
export function getFrameworkSequence(
  frameworkId: string
): PersuasionBlockType[] {
  const framework = getFrameworkTemplate(frameworkId);
  return framework?.recommendedSequence ?? [];
}

/**
 * Check if a block type is required by a framework.
 *
 * @param frameworkId - Framework identifier
 * @param blockType - Block type to check
 * @returns True if the block is required
 */
export function isBlockRequired(
  frameworkId: string,
  blockType: PersuasionBlockType
): boolean {
  const framework = getFrameworkTemplate(frameworkId);
  return framework?.requiredBlocks.includes(blockType) ?? false;
}

/**
 * Get suggested next block type based on current blocks and framework.
 *
 * @param blocks - Current blocks on canvas
 * @param frameworkId - Framework identifier (optional)
 * @returns Suggested next block type or undefined
 */
export function getSuggestedNextBlock(
  blocks: PersuasionBlock[],
  frameworkId?: string | null
): PersuasionBlockType | undefined {
  if (!frameworkId) {
    return undefined;
  }

  const framework = getFrameworkTemplate(frameworkId);
  if (!framework) {
    return undefined;
  }

  const presentTypes = new Set(blocks.map((b) => b.type));

  // Find the first block in recommended sequence that's not present
  for (const type of framework.recommendedSequence) {
    if (!presentTypes.has(type)) {
      return type;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an empty TipTap document.
 */
function createEmptyTipTapDoc(): TipTapContent {
  return {
    type: "doc",
    content: [],
  };
}
