import { describe, it, expect } from 'vitest';
import {
  RelevanceScoresSchema,
  RelevanceWeightsSchema,
  RelevanceConfigSchema,
  RelevanceInputSchema,
  RelevanceOutputSchema,
  DEFAULT_RELEVANCE_CONFIG,
  type RelevanceScores,
  type RelevanceWeights,
  type RelevanceConfig,
  type RelevanceInput,
  type RelevanceOutput
} from './types';

describe('RelevanceScores', () => {
  it('validates correct RelevanceScores structure', () => {
    const scores: RelevanceScores = {
      coreRelevance: 0.8,
      categoryRelevance: 0.6,
      problemRelevance: 0.4,
      combinedScore: 0.7,
      passesThreshold: true,
    };

    expect(() => RelevanceScoresSchema.parse(scores)).not.toThrow();
  });

  it('rejects scores outside 0-1 range', () => {
    const invalidScores = {
      coreRelevance: 1.5,
      categoryRelevance: 0.6,
      problemRelevance: 0.4,
      combinedScore: 0.7,
      passesThreshold: true,
    };

    expect(() => RelevanceScoresSchema.parse(invalidScores)).toThrow();
  });

  it('rejects negative scores', () => {
    const invalidScores = {
      coreRelevance: -0.1,
      categoryRelevance: 0.6,
      problemRelevance: 0.4,
      combinedScore: 0.7,
      passesThreshold: true,
    };

    expect(() => RelevanceScoresSchema.parse(invalidScores)).toThrow();
  });
});

describe('RelevanceWeights', () => {
  it('validates weights structure', () => {
    const weights: RelevanceWeights = {
      core: 0.5,
      category: 0.3,
      problem: 0.2,
    };

    expect(() => RelevanceWeightsSchema.parse(weights)).not.toThrow();
  });

  it('accepts weights that sum to 1.0', () => {
    const weights: RelevanceWeights = {
      core: 0.5,
      category: 0.3,
      problem: 0.2,
    };

    const result = RelevanceWeightsSchema.parse(weights);
    const sum = result.core + result.category + result.problem;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('allows weights that do not sum to 1.0', () => {
    // Weights don't have to sum to 1.0, but it's recommended
    const weights: RelevanceWeights = {
      core: 0.6,
      category: 0.3,
      problem: 0.3,
    };

    expect(() => RelevanceWeightsSchema.parse(weights)).not.toThrow();
  });
});

describe('RelevanceConfig', () => {
  it('validates complete config structure', () => {
    const config: RelevanceConfig = {
      weights: {
        core: 0.5,
        category: 0.3,
        problem: 0.2,
      },
      threshold: 0.4,
      cacheTTL: 604800,
    };

    expect(() => RelevanceConfigSchema.parse(config)).not.toThrow();
  });

  it('rejects threshold outside 0-1 range', () => {
    const invalidConfig = {
      weights: {
        core: 0.5,
        category: 0.3,
        problem: 0.2,
      },
      threshold: 1.5,
      cacheTTL: 604800,
    };

    expect(() => RelevanceConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('rejects negative cacheTTL', () => {
    const invalidConfig = {
      weights: {
        core: 0.5,
        category: 0.3,
        problem: 0.2,
      },
      threshold: 0.4,
      cacheTTL: -100,
    };

    expect(() => RelevanceConfigSchema.parse(invalidConfig)).toThrow();
  });
});

describe('RelevanceInput', () => {
  it('validates input with all fields', () => {
    const input: RelevanceInput = {
      keyword: 'automobiliu plovykla',
      businessDescription: 'Automobiliu plovykla Siauliuose',
      priorityCategories: ['plovimas', 'detailing'],
      problemsSolved: ['purvinas automobilis'],
    };

    expect(() => RelevanceInputSchema.parse(input)).not.toThrow();
  });

  it('allows empty arrays', () => {
    const input: RelevanceInput = {
      keyword: 'test',
      businessDescription: 'Test business',
      priorityCategories: [],
      problemsSolved: [],
    };

    expect(() => RelevanceInputSchema.parse(input)).not.toThrow();
  });

  it('rejects empty keyword', () => {
    const invalidInput = {
      keyword: '',
      businessDescription: 'Test',
      priorityCategories: [],
      problemsSolved: [],
    };

    expect(() => RelevanceInputSchema.parse(invalidInput)).toThrow();
  });

  it('rejects empty businessDescription', () => {
    const invalidInput = {
      keyword: 'test',
      businessDescription: '',
      priorityCategories: [],
      problemsSolved: [],
    };

    expect(() => RelevanceInputSchema.parse(invalidInput)).toThrow();
  });
});

describe('RelevanceOutput', () => {
  it('validates complete output structure', () => {
    const output: RelevanceOutput = {
      keyword: 'test keyword',
      coreRelevance: 0.8,
      categoryRelevance: 0.6,
      problemRelevance: 0.4,
      combinedScore: 0.7,
      passesThreshold: true,
      processingTimeMs: 150,
    };

    expect(() => RelevanceOutputSchema.parse(output)).not.toThrow();
  });

  it('rejects negative processingTimeMs', () => {
    const invalidOutput = {
      keyword: 'test',
      coreRelevance: 0.8,
      categoryRelevance: 0.6,
      problemRelevance: 0.4,
      combinedScore: 0.7,
      passesThreshold: true,
      processingTimeMs: -10,
    };

    expect(() => RelevanceOutputSchema.parse(invalidOutput)).toThrow();
  });
});

describe('DEFAULT_RELEVANCE_CONFIG', () => {
  it('exports default config with correct structure', () => {
    expect(DEFAULT_RELEVANCE_CONFIG).toBeDefined();
    expect(DEFAULT_RELEVANCE_CONFIG.weights).toBeDefined();
    expect(DEFAULT_RELEVANCE_CONFIG.threshold).toBeDefined();
    expect(DEFAULT_RELEVANCE_CONFIG.cacheTTL).toBeDefined();
  });

  it('has sensible default weights', () => {
    expect(DEFAULT_RELEVANCE_CONFIG.weights.core).toBe(0.5);
    expect(DEFAULT_RELEVANCE_CONFIG.weights.category).toBe(0.3);
    expect(DEFAULT_RELEVANCE_CONFIG.weights.problem).toBe(0.2);
  });

  it('has reasonable default threshold', () => {
    expect(DEFAULT_RELEVANCE_CONFIG.threshold).toBe(0.4);
  });

  it('has 7-day cache TTL', () => {
    expect(DEFAULT_RELEVANCE_CONFIG.cacheTTL).toBe(604800); // 7 days in seconds
  });

  it('passes validation', () => {
    expect(() => RelevanceConfigSchema.parse(DEFAULT_RELEVANCE_CONFIG)).not.toThrow();
  });
});
