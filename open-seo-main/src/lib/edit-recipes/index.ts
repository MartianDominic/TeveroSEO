/**
 * Edit Recipe Registry
 * Phase 33: Auto-Fix System
 *
 * Central registry for all edit recipes with safety classification.
 * Resolves editRecipe strings from audit findings to executable handlers.
 */
import type { EditRecipeId, RecipeInfo, RecipeHandler, RecipeSafety } from './types';
import { SAFE_RECIPES } from './safe-recipes';

// Re-export types for consumers
export * from './types';
export { validateRecipeContext, validateBatchRequest, isValidRecipeId } from './validators';

/**
 * Stub handler for complex recipes that require human review.
 * These don't auto-execute but are registered for info purposes.
 */
const complexRecipeStub: RecipeHandler = async () => {
  return {
    success: false,
    beforeValue: null,
    afterValue: null,
    field: 'unknown',
    verified: false,
    error: 'Complex recipe requires human review before execution',
  };
};

/**
 * Recipe registry with metadata and handlers.
 */
export const RECIPE_REGISTRY: Record<EditRecipeId, RecipeInfo> = {
  // =====================================================
  // SAFE RECIPES (auto-apply)
  // =====================================================
  'add-alt-text': {
    id: 'add-alt-text',
    name: 'Add Alt Text',
    safety: 'safe',
    category: 'images',
    field: 'alt_text',
    description: 'Add alt text to images that are missing it',
    handler: SAFE_RECIPES['add-alt-text'],
  },
  'add-image-dimensions': {
    id: 'add-image-dimensions',
    name: 'Add Image Dimensions',
    safety: 'safe',
    category: 'images',
    field: 'dimensions',
    description: 'Add width and height attributes to images for CLS improvement',
    handler: SAFE_RECIPES['add-image-dimensions'],
  },
  'add-canonical': {
    id: 'add-canonical',
    name: 'Add Canonical URL',
    safety: 'safe',
    category: 'technical',
    field: 'canonical',
    description: 'Add self-referencing canonical URL to prevent duplicate content issues',
    handler: SAFE_RECIPES['add-canonical'],
  },
  'add-lazy-loading': {
    id: 'add-lazy-loading',
    name: 'Add Lazy Loading',
    safety: 'safe',
    category: 'images',
    field: 'loading',
    description: 'Add loading="lazy" attribute to below-fold images',
    handler: SAFE_RECIPES['add-lazy-loading'],
  },
  'add-lang': {
    id: 'add-lang',
    name: 'Add Language Attribute',
    safety: 'safe',
    category: 'technical',
    field: 'lang',
    description: 'Add lang attribute to HTML element',
    handler: SAFE_RECIPES['add-lang'],
  },
  'add-charset': {
    id: 'add-charset',
    name: 'Add Charset',
    safety: 'safe',
    category: 'technical',
    field: 'charset',
    description: 'Add UTF-8 charset meta tag',
    handler: SAFE_RECIPES['add-charset'],
  },
  'add-viewport': {
    id: 'add-viewport',
    name: 'Add Viewport',
    safety: 'safe',
    category: 'technical',
    field: 'viewport',
    description: 'Add responsive viewport meta tag',
    handler: SAFE_RECIPES['add-viewport'],
  },

  // =====================================================
  // COMPLEX RECIPES (require human review)
  // =====================================================
  'add-title': {
    id: 'add-title',
    name: 'Add Page Title',
    safety: 'complex',
    category: 'meta_tags',
    field: 'title',
    description: 'Add or update the page title tag (requires review)',
    handler: complexRecipeStub,
  },
  'add-meta-desc': {
    id: 'add-meta-desc',
    name: 'Add Meta Description',
    safety: 'complex',
    category: 'meta_tags',
    field: 'meta_description',
    description: 'Add or update the meta description (requires review)',
    handler: complexRecipeStub,
  },
  'add-h1': {
    id: 'add-h1',
    name: 'Add H1 Heading',
    safety: 'complex',
    category: 'headings',
    field: 'h1',
    description: 'Add or update the H1 heading (requires review)',
    handler: complexRecipeStub,
  },
  'add-og-tags': {
    id: 'add-og-tags',
    name: 'Add Open Graph Tags',
    safety: 'complex',
    category: 'meta_tags',
    field: 'og_tags',
    description: 'Add Open Graph meta tags for social sharing (requires review)',
    handler: complexRecipeStub,
  },
  'adjust-title-length': {
    id: 'adjust-title-length',
    name: 'Adjust Title Length',
    safety: 'complex',
    category: 'meta_tags',
    field: 'title',
    description: 'Adjust title to optimal length (requires review)',
    handler: complexRecipeStub,
  },
  'adjust-meta-length': {
    id: 'adjust-meta-length',
    name: 'Adjust Meta Description Length',
    safety: 'complex',
    category: 'meta_tags',
    field: 'meta_description',
    description: 'Adjust meta description to optimal length (requires review)',
    handler: complexRecipeStub,
  },
  'add-keyword-title': {
    id: 'add-keyword-title',
    name: 'Add Keyword to Title',
    safety: 'complex',
    category: 'meta_tags',
    field: 'title',
    description: 'Add target keyword to page title (requires review)',
    handler: complexRecipeStub,
  },
  'add-keyword-meta': {
    id: 'add-keyword-meta',
    name: 'Add Keyword to Meta Description',
    safety: 'complex',
    category: 'meta_tags',
    field: 'meta_description',
    description: 'Add target keyword to meta description (requires review)',
    handler: complexRecipeStub,
  },
  'add-keyword-h1': {
    id: 'add-keyword-h1',
    name: 'Add Keyword to H1',
    safety: 'complex',
    category: 'headings',
    field: 'h1',
    description: 'Add target keyword to H1 heading (requires review)',
    handler: complexRecipeStub,
  },
  'add-schema': {
    id: 'add-schema',
    name: 'Add Schema Markup',
    safety: 'complex',
    category: 'schema',
    field: 'schema_markup',
    description: 'Add structured data schema markup (requires review)',
    handler: complexRecipeStub,
  },
};

/**
 * Get recipe info by ID.
 * Returns undefined if recipe not found.
 */
export function getRecipeInfo(recipeId: string): RecipeInfo | undefined {
  return RECIPE_REGISTRY[recipeId as EditRecipeId];
}

/**
 * Resolve a recipe ID to its handler.
 * Returns the handler function or undefined if not found.
 */
export function resolveRecipe(recipeId: string): RecipeHandler | undefined {
  const info = getRecipeInfo(recipeId);
  return info?.handler;
}

/**
 * Check if a recipe is safe for auto-application.
 */
export function isRecipeSafe(recipeId: string): boolean {
  const info = getRecipeInfo(recipeId);
  return info?.safety === 'safe';
}

/**
 * Get all recipes by safety classification.
 */
export function getRecipesBySafety(safety: RecipeSafety): RecipeInfo[] {
  return Object.values(RECIPE_REGISTRY).filter((r) => r.safety === safety);
}

/**
 * Get all safe recipe IDs.
 */
export function getSafeRecipeIds(): EditRecipeId[] {
  return Object.values(RECIPE_REGISTRY)
    .filter((r) => r.safety === 'safe')
    .map((r) => r.id);
}

/**
 * Get all complex recipe IDs.
 */
export function getComplexRecipeIds(): EditRecipeId[] {
  return Object.values(RECIPE_REGISTRY)
    .filter((r) => r.safety === 'complex')
    .map((r) => r.id);
}
