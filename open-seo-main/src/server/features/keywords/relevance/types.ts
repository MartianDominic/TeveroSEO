import { z } from 'zod';

/**
 * Relevance scores across multiple dimensions
 */
export const RelevanceScoresSchema = z.object({
  coreRelevance: z.number().min(0).max(1),
  categoryRelevance: z.number().min(0).max(1),
  problemRelevance: z.number().min(0).max(1),
  combinedScore: z.number().min(0).max(1),
  passesThreshold: z.boolean(),
});

export type RelevanceScores = z.infer<typeof RelevanceScoresSchema>;

/**
 * Weights for combining relevance dimensions
 */
export const RelevanceWeightsSchema = z.object({
  core: z.number().min(0).max(1),
  category: z.number().min(0).max(1),
  problem: z.number().min(0).max(1),
});

export type RelevanceWeights = z.infer<typeof RelevanceWeightsSchema>;

/**
 * Configuration for relevance scoring
 */
export const RelevanceConfigSchema = z.object({
  weights: RelevanceWeightsSchema,
  threshold: z.number().min(0).max(1),
  cacheTTL: z.number().min(0),
});

export type RelevanceConfig = z.infer<typeof RelevanceConfigSchema>;

/**
 * Input for relevance scoring
 */
export const RelevanceInputSchema = z.object({
  keyword: z.string().min(1),
  businessDescription: z.string().min(1),
  priorityCategories: z.array(z.string()),
  problemsSolved: z.array(z.string()),
});

export type RelevanceInput = z.infer<typeof RelevanceInputSchema>;

/**
 * Output of relevance scoring (includes scores + metadata)
 */
export const RelevanceOutputSchema = RelevanceScoresSchema.extend({
  keyword: z.string(),
  processingTimeMs: z.number().min(0),
});

export type RelevanceOutput = z.infer<typeof RelevanceOutputSchema>;

/**
 * Default configuration for relevance scoring
 *
 * Weights:
 * - core: 0.5 (business description match is most important)
 * - category: 0.3 (priority categories boost relevance)
 * - problem: 0.2 (problem-solution match is helpful)
 *
 * Threshold: 0.4 (keywords below this are filtered out)
 * Cache TTL: 604800 seconds (7 days)
 */
export const DEFAULT_RELEVANCE_CONFIG: RelevanceConfig = {
  weights: {
    core: 0.5,
    category: 0.3,
    problem: 0.2,
  },
  threshold: 0.4,
  cacheTTL: 604800, // 7 days in seconds
};
