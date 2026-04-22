/**
 * Zod Validators for Edit Recipes
 * Phase 33: Auto-Fix System
 *
 * Type-safe validation for recipe contexts and results.
 */
import { z } from 'zod';
import { EDIT_RECIPES } from './types';

/**
 * Validate edit recipe ID is a known recipe.
 */
export const editRecipeIdSchema = z.enum(EDIT_RECIPES);

/**
 * Validate recipe context input.
 */
export const recipeContextSchema = z.object({
  resourceId: z.string().min(1, 'resourceId is required'),
  resourceUrl: z.string().url('resourceUrl must be a valid URL'),
  resourceType: z.enum(['post', 'page', 'product', 'collection', 'image', 'setting']),
  findingDetails: z.record(z.string(), z.unknown()).default({}),
  suggestedValue: z.string().optional(),
  currentValue: z.string().nullable().optional(),
  targetKeyword: z.string().optional(),
});

/**
 * Validate recipe result output.
 */
export const recipeResultSchema = z.object({
  success: z.boolean(),
  beforeValue: z.string().nullable(),
  afterValue: z.string().nullable(),
  field: z.string().min(1),
  error: z.string().optional(),
  verified: z.boolean(),
});

/**
 * Validate batch apply request.
 */
export const batchApplyRequestSchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
  connectionId: z.string().min(1, 'connectionId is required'),
  changes: z.array(z.object({
    findingId: z.string().min(1),
    recipeId: editRecipeIdSchema,
    context: recipeContextSchema,
  })).min(1, 'At least one change required').max(100, 'Maximum 100 changes per batch'),
});

/**
 * Type inference for validated inputs.
 */
export type ValidatedRecipeContext = z.infer<typeof recipeContextSchema>;
export type ValidatedBatchRequest = z.infer<typeof batchApplyRequestSchema>;

/**
 * Validate and parse recipe context.
 * Throws ZodError if validation fails.
 */
export function validateRecipeContext(input: unknown): ValidatedRecipeContext {
  return recipeContextSchema.parse(input);
}

/**
 * Validate and parse batch apply request.
 * Throws ZodError if validation fails.
 */
export function validateBatchRequest(input: unknown): ValidatedBatchRequest {
  return batchApplyRequestSchema.parse(input);
}

/**
 * Check if a string is a valid edit recipe ID.
 */
export function isValidRecipeId(id: string): id is typeof EDIT_RECIPES[number] {
  return EDIT_RECIPES.includes(id as typeof EDIT_RECIPES[number]);
}
