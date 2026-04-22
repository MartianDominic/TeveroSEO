import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RECIPE_REGISTRY,
  getRecipeInfo,
  resolveRecipe,
  isRecipeSafe,
  getSafeRecipeIds,
  getComplexRecipeIds,
  type PlatformWriteAdapter,
  type RecipeContext,
} from './index';
import { SAFE_RECIPES } from './safe-recipes';
import { isValidRecipeId, validateRecipeContext } from './validators';
import { EDIT_RECIPES } from './types';

describe('edit-recipes', () => {
  describe('RECIPE_REGISTRY', () => {
    it('contains all expected recipes', () => {
      expect(Object.keys(RECIPE_REGISTRY)).toHaveLength(EDIT_RECIPES.length);

      for (const recipeId of EDIT_RECIPES) {
        expect(RECIPE_REGISTRY[recipeId]).toBeDefined();
        expect(RECIPE_REGISTRY[recipeId].id).toBe(recipeId);
      }
    });

    it('all recipes have required fields', () => {
      for (const recipe of Object.values(RECIPE_REGISTRY)) {
        expect(recipe.id).toBeDefined();
        expect(recipe.name).toBeDefined();
        expect(recipe.safety).toMatch(/^(safe|complex)$/);
        expect(recipe.category).toBeDefined();
        expect(recipe.field).toBeDefined();
        expect(recipe.description).toBeDefined();
        expect(typeof recipe.handler).toBe('function');
      }
    });
  });

  describe('getRecipeInfo', () => {
    it('returns recipe info for valid ID', () => {
      const info = getRecipeInfo('add-alt-text');
      expect(info).toBeDefined();
      expect(info?.id).toBe('add-alt-text');
      expect(info?.safety).toBe('safe');
      expect(info?.category).toBe('images');
    });

    it('returns undefined for invalid ID', () => {
      const info = getRecipeInfo('invalid-recipe');
      expect(info).toBeUndefined();
    });
  });

  describe('resolveRecipe', () => {
    it('returns handler for valid recipe', () => {
      const handler = resolveRecipe('add-alt-text');
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });

    it('returns undefined for invalid recipe', () => {
      const handler = resolveRecipe('invalid-recipe');
      expect(handler).toBeUndefined();
    });
  });

  describe('isRecipeSafe', () => {
    it('returns true for safe recipes', () => {
      expect(isRecipeSafe('add-alt-text')).toBe(true);
      expect(isRecipeSafe('add-canonical')).toBe(true);
      expect(isRecipeSafe('add-lazy-loading')).toBe(true);
      expect(isRecipeSafe('add-image-dimensions')).toBe(true);
    });

    it('returns false for complex recipes', () => {
      expect(isRecipeSafe('add-title')).toBe(false);
      expect(isRecipeSafe('add-h1')).toBe(false);
      expect(isRecipeSafe('adjust-title-length')).toBe(false);
    });

    it('returns false for invalid recipes', () => {
      expect(isRecipeSafe('invalid-recipe')).toBe(false);
    });
  });

  describe('getSafeRecipeIds', () => {
    it('returns only safe recipe IDs', () => {
      const safeIds = getSafeRecipeIds();
      expect(safeIds).toContain('add-alt-text');
      expect(safeIds).toContain('add-canonical');
      expect(safeIds).toContain('add-lazy-loading');
      expect(safeIds).not.toContain('add-title');
      expect(safeIds).not.toContain('add-h1');
    });

    it('returns 7 safe recipes', () => {
      const safeIds = getSafeRecipeIds();
      expect(safeIds).toHaveLength(7);
    });
  });

  describe('getComplexRecipeIds', () => {
    it('returns only complex recipe IDs', () => {
      const complexIds = getComplexRecipeIds();
      expect(complexIds).toContain('add-title');
      expect(complexIds).toContain('add-h1');
      expect(complexIds).toContain('add-meta-desc');
      expect(complexIds).not.toContain('add-alt-text');
    });
  });

  describe('safe recipe handlers', () => {
    const mockAdapter: PlatformWriteAdapter = {
      readField: vi.fn(),
      writeField: vi.fn(),
      updateMeta: vi.fn(),
      updateImageAlt: vi.fn(),
      updateImageAttributes: vi.fn(),
    };

    const baseContext: RecipeContext = {
      resourceId: 'post-123',
      resourceUrl: 'https://example.com/page',
      resourceType: 'page',
      findingDetails: {},
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('addAltText', () => {
      it('adds alt text to image without existing alt', async () => {
        vi.mocked(mockAdapter.readField).mockResolvedValue(null);
        vi.mocked(mockAdapter.updateImageAlt!).mockResolvedValue({ success: true });

        const context = {
          ...baseContext,
          suggestedValue: 'Test alt text',
        };

        const result = await SAFE_RECIPES['add-alt-text'](mockAdapter, context);

        expect(result.success).toBe(true);
        expect(result.beforeValue).toBeNull();
        expect(result.afterValue).toBe('Test alt text');
        expect(result.field).toBe('alt_text');
      });

      it('skips if alt text already exists', async () => {
        vi.mocked(mockAdapter.readField).mockResolvedValue('Existing alt');

        const result = await SAFE_RECIPES['add-alt-text'](mockAdapter, baseContext);

        expect(result.success).toBe(true);
        expect(result.beforeValue).toBe('Existing alt');
        expect(result.afterValue).toBe('Existing alt');
        expect(mockAdapter.updateImageAlt).not.toHaveBeenCalled();
      });
    });

    describe('addCanonical', () => {
      it('adds canonical URL from resource URL', async () => {
        vi.mocked(mockAdapter.readField).mockResolvedValue(null);
        vi.mocked(mockAdapter.writeField).mockResolvedValue({ success: true });

        const result = await SAFE_RECIPES['add-canonical'](mockAdapter, baseContext);

        expect(result.success).toBe(true);
        expect(result.beforeValue).toBeNull();
        expect(result.afterValue).toBe('https://example.com/page');
        expect(result.field).toBe('canonical');
      });
    });

    describe('addLazyLoading', () => {
      it('adds lazy loading attribute', async () => {
        vi.mocked(mockAdapter.readField).mockResolvedValue(null);
        vi.mocked(mockAdapter.updateImageAttributes!).mockResolvedValue({ success: true });

        const result = await SAFE_RECIPES['add-lazy-loading'](mockAdapter, baseContext);

        expect(result.success).toBe(true);
        expect(result.afterValue).toBe('lazy');
        expect(result.field).toBe('loading');
      });
    });
  });

  describe('complex recipe handlers', () => {
    const mockAdapter: PlatformWriteAdapter = {
      readField: vi.fn(),
      writeField: vi.fn(),
      updateMeta: vi.fn(),
    };

    it('returns error for complex recipes', async () => {
      const handler = resolveRecipe('add-title');
      const result = await handler!(mockAdapter, {
        resourceId: 'post-123',
        resourceUrl: 'https://example.com/page',
        resourceType: 'page',
        findingDetails: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('requires human review');
    });
  });

  describe('validators', () => {
    it('isValidRecipeId returns true for valid IDs', () => {
      expect(isValidRecipeId('add-alt-text')).toBe(true);
      expect(isValidRecipeId('add-title')).toBe(true);
    });

    it('isValidRecipeId returns false for invalid IDs', () => {
      expect(isValidRecipeId('invalid')).toBe(false);
      expect(isValidRecipeId('')).toBe(false);
    });

    it('validateRecipeContext validates required fields', () => {
      const valid = validateRecipeContext({
        resourceId: 'post-123',
        resourceUrl: 'https://example.com/page',
        resourceType: 'page',
        findingDetails: {},
      });

      expect(valid.resourceId).toBe('post-123');
      expect(valid.resourceUrl).toBe('https://example.com/page');
    });

    it('validateRecipeContext throws for invalid URL', () => {
      expect(() =>
        validateRecipeContext({
          resourceId: 'post-123',
          resourceUrl: 'invalid-url',
          resourceType: 'page',
          findingDetails: {},
        })
      ).toThrow();
    });
  });
});
