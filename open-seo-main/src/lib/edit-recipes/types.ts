/**
 * Edit Recipe Types
 * Phase 33: Auto-Fix System
 *
 * Types for the edit recipe system that bridges audit findings to platform write operations.
 */

/**
 * Recipe safety classification.
 * - 'safe': Can be auto-applied without human review
 * - 'complex': Requires human review before application
 */
export type RecipeSafety = 'safe' | 'complex';

/**
 * All supported edit recipe identifiers.
 * These map to editRecipe strings in audit findings.
 */
export const EDIT_RECIPES = [
  // Safe recipes (auto-apply)
  'add-alt-text',
  'add-image-dimensions',
  'add-canonical',
  'add-lazy-loading',
  'add-lang',
  'add-charset',
  'add-viewport',

  // Complex recipes (require review)
  'add-title',
  'add-meta-desc',
  'add-h1',
  'add-og-tags',
  'adjust-title-length',
  'adjust-meta-length',
  'add-keyword-title',
  'add-keyword-meta',
  'add-keyword-h1',
  'add-schema',
] as const;

export type EditRecipeId = typeof EDIT_RECIPES[number];

/**
 * Context provided to recipe handlers.
 * Contains all information needed to execute the fix.
 */
export interface RecipeContext {
  /** Platform-specific resource ID (post ID, product ID, etc.) */
  resourceId: string;
  /** Full URL of the resource */
  resourceUrl: string;
  /** Resource type (post, page, product, collection, image) */
  resourceType: 'post' | 'page' | 'product' | 'collection' | 'image' | 'setting';
  /** Original finding details from audit */
  findingDetails: Record<string, unknown>;
  /** Suggested fix value (may be AI-generated or rule-based) */
  suggestedValue?: string;
  /** Current value from the resource (may be null if missing) */
  currentValue?: string | null;
  /** Target keyword for keyword-based fixes */
  targetKeyword?: string;
}

/**
 * Result returned by recipe handlers.
 */
export interface RecipeResult {
  /** Whether the fix was successfully applied */
  success: boolean;
  /** Value before the change (for revert capability) */
  beforeValue: string | null;
  /** Value after the change */
  afterValue: string | null;
  /** Specific field that was changed */
  field: string;
  /** Error message if success is false */
  error?: string;
  /** Whether verification read-back confirmed the change */
  verified: boolean;
}

/**
 * Recipe handler function signature.
 * Takes adapter and context, returns result with before/after values.
 */
export type RecipeHandler = (
  adapter: PlatformWriteAdapter,
  context: RecipeContext
) => Promise<RecipeResult>;

/**
 * Recipe metadata stored in the registry.
 */
export interface RecipeInfo {
  /** Unique recipe identifier */
  id: EditRecipeId;
  /** Human-readable name */
  name: string;
  /** Safety classification */
  safety: RecipeSafety;
  /** Category of SEO change */
  category: 'meta_tags' | 'headings' | 'images' | 'technical' | 'content' | 'schema';
  /** Field affected by this recipe */
  field: string;
  /** Description of what this recipe does */
  description: string;
  /** The handler function */
  handler: RecipeHandler;
}

/**
 * Platform write adapter interface.
 * Adapters (WordPress, Shopify, etc.) must implement these methods.
 */
export interface PlatformWriteAdapter {
  /** Read a specific field from a resource */
  readField(resourceId: string, field: string): Promise<string | null>;

  /** Write a value to a specific field */
  writeField(resourceId: string, field: string, value: string): Promise<{ success: boolean; error?: string }>;

  /** Update multiple fields at once */
  updateMeta(resourceId: string, meta: Record<string, string>): Promise<{ success: boolean; error?: string }>;

  /** Update image alt text */
  updateImageAlt?(imageId: string, alt: string): Promise<{ success: boolean; error?: string }>;

  /** Update image HTML attributes (dimensions, lazy loading) */
  updateImageAttributes?(imageId: string, attributes: Record<string, string>): Promise<{ success: boolean; error?: string }>;
}
