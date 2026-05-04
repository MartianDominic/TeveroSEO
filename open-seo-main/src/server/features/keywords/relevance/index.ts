/**
 * Relevance scoring module
 *
 * Multi-dimensional embedding similarity scoring to filter semantically irrelevant keywords.
 */

export {
  type RelevanceScores,
  type RelevanceWeights,
  type RelevanceConfig,
  type RelevanceInput,
  type RelevanceOutput,
  RelevanceScoresSchema,
  RelevanceWeightsSchema,
  RelevanceConfigSchema,
  RelevanceInputSchema,
  RelevanceOutputSchema,
  DEFAULT_RELEVANCE_CONFIG,
} from './types';

export { RelevanceScorer, createRelevanceScorer } from './RelevanceScorer';
