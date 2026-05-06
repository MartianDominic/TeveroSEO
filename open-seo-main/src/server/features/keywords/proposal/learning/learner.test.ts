import { describe, it, expect } from 'vitest';
import { PreferenceLearner, learnFromEdits } from './learner';
import type { LearningInput } from './types';

describe('PreferenceLearner', () => {
  const learner = new PreferenceLearner();

  describe('minimum edits threshold', () => {
    it('should NOT trigger learning with fewer than 3 edits', () => {
      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'Budget' }, timestamp: new Date() },
        ],
      };

      const result = learner.learn(input);

      expect(result.triggered).toBe(false);
      expect(result.patternsLearned).toBe(0);
    });

    it('should trigger learning with 3+ edits', () => {
      // Use same label 3 times to hit confidence threshold (3/5 = 0.6)
      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
        ],
      };

      const result = learner.learn(input);

      expect(result.triggered).toBe(true);
      expect(result.patternsLearned).toBeGreaterThan(0);
    });
  });

  describe('exclusion pattern extraction', () => {
    it('should extract topic patterns from removed clusters', () => {
      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
        ],
      };

      const result = learner.learn(input);

      expect(result.preferences.exclusions.length).toBeGreaterThan(0);
      const diyPattern = result.preferences.exclusions.find((p) => p.pattern === 'diy');
      expect(diyPattern).toBeDefined();
      expect(diyPattern!.occurrences).toBe(3);
    });

    it('should add removed clusters to avoidedTopics', () => {
      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          {
            type: 'remove_cluster',
            data: { clusterLabel: 'Competitor Brand' },
            timestamp: new Date(),
          },
          {
            type: 'remove_cluster',
            data: { clusterLabel: 'Competitor Brand' },
            timestamp: new Date(),
          },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
        ],
      };

      const result = learner.learn(input);

      expect(result.preferences.avoidedTopics).toContain('competitor brand');
      expect(result.preferences.avoidedTopics).toContain('diy');
    });
  });

  describe('funnel bias learning', () => {
    it('should adjust funnel bias from distribution changes', () => {
      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          {
            type: 'change_distribution',
            data: {
              oldDistribution: { bofu: 0.3, mofu: 0.4, tofu: 0.3 },
              newDistribution: { bofu: 0.5, mofu: 0.3, tofu: 0.2 },
            },
            timestamp: new Date(),
          },
          {
            type: 'change_distribution',
            data: {
              oldDistribution: { bofu: 0.3, mofu: 0.4, tofu: 0.3 },
              newDistribution: { bofu: 0.5, mofu: 0.3, tofu: 0.2 },
            },
            timestamp: new Date(),
          },
          {
            type: 'change_distribution',
            data: {
              oldDistribution: { bofu: 0.3, mofu: 0.4, tofu: 0.3 },
              newDistribution: { bofu: 0.5, mofu: 0.3, tofu: 0.2 },
            },
            timestamp: new Date(),
          },
        ],
      };

      const result = learner.learn(input);

      expect(result.biasUpdated).toBe(true);
      expect(result.preferences.funnelBias.bofu).toBeGreaterThan(1.0);
      expect(result.preferences.funnelBias.tofu).toBeLessThan(1.0);
    });
  });

  describe('merge existing preferences', () => {
    it('should increment occurrences for existing patterns', () => {
      const existingPrefs = {
        clientId: 'client-1',
        exclusions: [
          {
            type: 'topic' as const,
            pattern: 'diy',
            confidence: 0.4,
            occurrences: 2,
            firstSeen: new Date(),
            lastSeen: new Date(),
          },
        ],
        funnelBias: { bofu: 1.0, mofu: 1.0, tofu: 1.0 },
        positioning: 'neutral' as const,
        preferredTopics: [],
        avoidedTopics: [],
        lastLearnedAt: new Date(),
        editsSinceLastLearn: 0,
        confidenceScore: 0.3,
      };

      const input: LearningInput = {
        clientId: 'client-1',
        edits: [
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
          { type: 'remove_cluster', data: { clusterLabel: 'DIY' }, timestamp: new Date() },
        ],
      };

      const result = learner.learn(input, existingPrefs);

      const diyPattern = result.preferences.exclusions.find((p) => p.pattern === 'diy');
      expect(diyPattern!.occurrences).toBe(5);
    });
  });
});

describe('learnFromEdits factory', () => {
  it('should create learner and return result', () => {
    const input: LearningInput = {
      clientId: 'client-1',
      edits: [
        { type: 'remove_cluster', data: { clusterLabel: 'Test' }, timestamp: new Date() },
        { type: 'remove_cluster', data: { clusterLabel: 'Test' }, timestamp: new Date() },
        { type: 'remove_cluster', data: { clusterLabel: 'Test' }, timestamp: new Date() },
      ],
    };

    const result = learnFromEdits(input);

    expect(result.clientId).toBe('client-1');
    expect(result.triggered).toBe(true);
  });
});
