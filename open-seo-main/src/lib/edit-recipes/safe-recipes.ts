/**
 * Safe Edit Recipe Handlers
 * Phase 33: Auto-Fix System
 *
 * These recipes can be auto-applied without human review.
 * They make deterministic, low-risk changes to SEO elements.
 */
import type { RecipeHandler, RecipeResult, PlatformWriteAdapter, RecipeContext } from './types';

/**
 * Create a standard RecipeResult from handler execution.
 */
function createResult(
  success: boolean,
  field: string,
  beforeValue: string | null,
  afterValue: string | null,
  verified: boolean,
  error?: string
): RecipeResult {
  return { success, beforeValue, afterValue, field, verified, error };
}

/**
 * Add alt text to an image.
 * Safe: Alt text additions don't affect page content or rankings negatively.
 */
export const addAltText: RecipeHandler = async (adapter, context) => {
  const { resourceId, suggestedValue, currentValue } = context;
  const field = 'alt_text';

  // Get current value if not provided
  const beforeValue = currentValue ?? await adapter.readField(resourceId, field);

  // Skip if already has alt text
  if (beforeValue && beforeValue.trim().length > 0) {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  const newValue = suggestedValue || generateAltFromContext(context);
  if (!newValue) {
    return createResult(false, field, beforeValue, null, false, 'No alt text value available');
  }

  // Apply change
  const result = adapter.updateImageAlt
    ? await adapter.updateImageAlt(resourceId, newValue)
    : await adapter.writeField(resourceId, field, newValue);

  if (!result.success) {
    return createResult(false, field, beforeValue, null, false, result.error);
  }

  // Verify change
  const verifiedValue = await adapter.readField(resourceId, field);
  const verified = verifiedValue === newValue;

  return createResult(true, field, beforeValue, newValue, verified);
};

/**
 * Add image dimensions (width/height attributes).
 * Safe: Improves CLS without affecting content.
 */
export const addImageDimensions: RecipeHandler = async (adapter, context) => {
  const { resourceId, findingDetails } = context;
  const field = 'dimensions';

  const width = findingDetails.width as string | undefined;
  const height = findingDetails.height as string | undefined;

  if (!width || !height) {
    return createResult(false, field, null, null, false, 'Width and height not provided in finding details');
  }

  const beforeValue = await adapter.readField(resourceId, 'dimensions');
  const newValue = `${width}x${height}`;

  if (adapter.updateImageAttributes) {
    const result = await adapter.updateImageAttributes(resourceId, { width, height });
    if (!result.success) {
      return createResult(false, field, beforeValue, null, false, result.error);
    }
  } else {
    return createResult(false, field, beforeValue, null, false, 'Adapter does not support image attribute updates');
  }

  // Verify
  const verifiedValue = await adapter.readField(resourceId, 'dimensions');
  const verified = verifiedValue === newValue;

  return createResult(true, field, beforeValue, newValue, verified);
};

/**
 * Add canonical URL meta tag.
 * Safe: Self-referencing canonical is standard practice.
 */
export const addCanonical: RecipeHandler = async (adapter, context) => {
  const { resourceId, resourceUrl, currentValue } = context;
  const field = 'canonical';

  const beforeValue = currentValue ?? await adapter.readField(resourceId, field);

  // Use resource URL as canonical (self-referencing)
  const newValue = resourceUrl;

  if (beforeValue === newValue) {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  const result = await adapter.writeField(resourceId, field, newValue);
  if (!result.success) {
    return createResult(false, field, beforeValue, null, false, result.error);
  }

  // Verify
  const verifiedValue = await adapter.readField(resourceId, field);
  const verified = verifiedValue === newValue;

  return createResult(true, field, beforeValue, newValue, verified);
};

/**
 * Add lazy loading attribute to images.
 * Safe: Performance improvement, no content change.
 */
export const addLazyLoading: RecipeHandler = async (adapter, context) => {
  const { resourceId, currentValue } = context;
  const field = 'loading';

  const beforeValue = currentValue ?? await adapter.readField(resourceId, field);
  const newValue = 'lazy';

  if (beforeValue === 'lazy') {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  if (adapter.updateImageAttributes) {
    const result = await adapter.updateImageAttributes(resourceId, { loading: newValue });
    if (!result.success) {
      return createResult(false, field, beforeValue, null, false, result.error);
    }
  } else {
    const result = await adapter.writeField(resourceId, field, newValue);
    if (!result.success) {
      return createResult(false, field, beforeValue, null, false, result.error);
    }
  }

  // Verify
  const verifiedValue = await adapter.readField(resourceId, field);
  const verified = verifiedValue === newValue;

  return createResult(true, field, beforeValue, newValue, verified);
};

/**
 * Add lang attribute to HTML tag.
 * Safe: Standard accessibility improvement.
 */
export const addLang: RecipeHandler = async (adapter, context) => {
  const { resourceId, suggestedValue } = context;
  const field = 'lang';

  const beforeValue = await adapter.readField(resourceId, field);
  const newValue = suggestedValue || 'en';

  if (beforeValue && beforeValue.trim().length > 0) {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  const result = await adapter.writeField(resourceId, field, newValue);
  if (!result.success) {
    return createResult(false, field, beforeValue, null, false, result.error);
  }

  const verifiedValue = await adapter.readField(resourceId, field);
  return createResult(true, field, beforeValue, newValue, verifiedValue === newValue);
};

/**
 * Add charset meta tag.
 * Safe: Standard UTF-8 charset is universal.
 */
export const addCharset: RecipeHandler = async (adapter, context) => {
  const { resourceId } = context;
  const field = 'charset';

  const beforeValue = await adapter.readField(resourceId, field);
  const newValue = 'UTF-8';

  if (beforeValue && beforeValue.toUpperCase() === 'UTF-8') {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  const result = await adapter.writeField(resourceId, field, newValue);
  if (!result.success) {
    return createResult(false, field, beforeValue, null, false, result.error);
  }

  const verifiedValue = await adapter.readField(resourceId, field);
  return createResult(true, field, beforeValue, newValue, verifiedValue?.toUpperCase() === newValue);
};

/**
 * Add viewport meta tag.
 * Safe: Standard responsive viewport is universal.
 */
export const addViewport: RecipeHandler = async (adapter, context) => {
  const { resourceId } = context;
  const field = 'viewport';

  const beforeValue = await adapter.readField(resourceId, field);
  const newValue = 'width=device-width, initial-scale=1';

  if (beforeValue && beforeValue.includes('width=device-width')) {
    return createResult(true, field, beforeValue, beforeValue, true);
  }

  const result = await adapter.writeField(resourceId, field, newValue);
  if (!result.success) {
    return createResult(false, field, beforeValue, null, false, result.error);
  }

  const verifiedValue = await adapter.readField(resourceId, field);
  return createResult(true, field, beforeValue, newValue, verifiedValue === newValue);
};

/**
 * Generate alt text from context (fallback if no suggested value).
 */
function generateAltFromContext(context: RecipeContext): string | null {
  const { findingDetails, resourceUrl } = context;

  // Try to extract from filename
  const filename = findingDetails.filename as string | undefined;
  if (filename) {
    // Convert filename to readable text: "barrel-sauna-outdoor.jpg" -> "Barrel sauna outdoor"
    const text = filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ') // Replace separators with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    if (text.length > 0) {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }

  // Try to extract from URL path
  try {
    const url = new URL(resourceUrl);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch {
    // Invalid URL, skip
  }

  return null;
}

/**
 * Export all safe recipes as a map.
 */
export const SAFE_RECIPES = {
  'add-alt-text': addAltText,
  'add-image-dimensions': addImageDimensions,
  'add-canonical': addCanonical,
  'add-lazy-loading': addLazyLoading,
  'add-lang': addLang,
  'add-charset': addCharset,
  'add-viewport': addViewport,
} as const;

export type SafeRecipeId = keyof typeof SAFE_RECIPES;
