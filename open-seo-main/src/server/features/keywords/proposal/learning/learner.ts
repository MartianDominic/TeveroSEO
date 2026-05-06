/**
 * Preference Learner
 * Phase 86-09: Backfill Pool + Learning
 *
 * Learns client preferences from proposal edit patterns.
 * Triggers after configurable threshold (default: 3 edits).
 */

import type {
  ClientPreferences,
  ExclusionPattern,
  LearningInput,
  LearningResult,
  EditForLearning,
  LearningConfig,
} from './types';
import { DEFAULT_LEARNING_CONFIG } from './types';

/**
 * Preference learner for client edit patterns.
 */
export class PreferenceLearner {
  private config: LearningConfig;

  constructor(config: Partial<LearningConfig> = {}) {
    this.config = { ...DEFAULT_LEARNING_CONFIG, ...config };
  }

  /**
   * Learn preferences from edit history.
   * Only triggers if edits >= minEditsToLearn (default: 3).
   */
  learn(input: LearningInput, existingPrefs?: ClientPreferences): LearningResult {
    const prefs = existingPrefs || this.createDefaultPreferences(input.clientId);

    if (input.edits.length < this.config.minEditsToLearn) {
      return {
        clientId: input.clientId,
        preferences: prefs,
        patternsLearned: 0,
        biasUpdated: false,
        triggered: false,
      };
    }

    const newPatterns = this.learnExclusionPatterns(input.edits);
    prefs.exclusions = this.mergePatterns(prefs.exclusions, newPatterns);

    const biasUpdated = this.learnFunnelBias(prefs, input.edits);

    this.learnTopicPreferences(prefs, input.edits);

    prefs.lastLearnedAt = new Date();
    prefs.editsSinceLastLearn = 0;
    prefs.confidenceScore = this.calculateConfidence(prefs, input.edits.length);

    return {
      clientId: input.clientId,
      preferences: prefs,
      patternsLearned: newPatterns.length,
      biasUpdated,
      triggered: true,
    };
  }

  private createDefaultPreferences(clientId: string): ClientPreferences {
    return {
      clientId,
      exclusions: [],
      funnelBias: { bofu: 1.0, mofu: 1.0, tofu: 1.0 },
      positioning: 'neutral',
      preferredTopics: [],
      avoidedTopics: [],
      lastLearnedAt: new Date(),
      editsSinceLastLearn: 0,
      confidenceScore: 0,
    };
  }

  private learnExclusionPatterns(edits: EditForLearning[]): ExclusionPattern[] {
    const patterns: Map<string, ExclusionPattern> = new Map();

    for (const edit of edits) {
      if (edit.type === 'remove_cluster' && edit.data.clusterLabel) {
        const key = `topic:${edit.data.clusterLabel.toLowerCase()}`;
        this.incrementPattern(
          patterns,
          key,
          'topic',
          edit.data.clusterLabel.toLowerCase(),
          edit.timestamp
        );
      }

      if (edit.type === 'remove_keyword' && edit.data.keyword) {
        const terms = this.extractSignificantTerms(edit.data.keyword);
        for (const term of terms) {
          const key = `term:${term}`;
          this.incrementPattern(patterns, key, 'term', term, edit.timestamp);
        }
      }
    }

    return Array.from(patterns.values()).filter(
      (p) => p.confidence >= this.config.confidenceThreshold
    );
  }

  private incrementPattern(
    patterns: Map<string, ExclusionPattern>,
    key: string,
    type: ExclusionPattern['type'],
    pattern: string,
    timestamp: Date
  ): void {
    const existing = patterns.get(key);

    if (existing) {
      existing.occurrences++;
      existing.lastSeen = timestamp;
      existing.confidence = Math.min(
        existing.occurrences / this.config.maxConfidenceOccurrences,
        1.0
      );
    } else {
      patterns.set(key, {
        type,
        pattern,
        confidence: 1 / this.config.maxConfidenceOccurrences,
        occurrences: 1,
        firstSeen: timestamp,
        lastSeen: timestamp,
      });
    }
  }

  private extractSignificantTerms(keyword: string): string[] {
    const stopWords = new Set([
      'ir',
      'su',
      'be',
      'ar',
      'kai',
      'kaip',
      'the',
      'a',
      'an',
      'is',
      'are',
    ]);
    return keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));
  }

  private mergePatterns(
    existing: ExclusionPattern[],
    newPatterns: ExclusionPattern[]
  ): ExclusionPattern[] {
    const merged = new Map<string, ExclusionPattern>();

    for (const p of existing) {
      merged.set(`${p.type}:${p.pattern}`, p);
    }

    for (const p of newPatterns) {
      const key = `${p.type}:${p.pattern}`;
      const e = merged.get(key);

      if (e) {
        e.occurrences += p.occurrences;
        e.confidence = Math.min(e.occurrences / this.config.maxConfidenceOccurrences, 1.0);
        e.lastSeen = p.lastSeen;
      } else {
        merged.set(key, p);
      }
    }

    return Array.from(merged.values());
  }

  private learnFunnelBias(prefs: ClientPreferences, edits: EditForLearning[]): boolean {
    const distributionChanges = edits.filter((e) => e.type === 'change_distribution');

    if (distributionChanges.length === 0) return false;

    let bofuDelta = 0,
      mofuDelta = 0,
      tofuDelta = 0;

    for (const edit of distributionChanges) {
      const { oldDistribution, newDistribution } = edit.data;
      if (!oldDistribution || !newDistribution) continue;

      bofuDelta += newDistribution.bofu - oldDistribution.bofu;
      mofuDelta += newDistribution.mofu - oldDistribution.mofu;
      tofuDelta += newDistribution.tofu - oldDistribution.tofu;
    }

    const count = distributionChanges.length;

    prefs.funnelBias.bofu += (bofuDelta / count) * 0.1;
    prefs.funnelBias.mofu += (mofuDelta / count) * 0.1;
    prefs.funnelBias.tofu += (tofuDelta / count) * 0.1;

    prefs.funnelBias.bofu = Math.max(0.5, Math.min(2.0, prefs.funnelBias.bofu));
    prefs.funnelBias.mofu = Math.max(0.5, Math.min(2.0, prefs.funnelBias.mofu));
    prefs.funnelBias.tofu = Math.max(0.5, Math.min(2.0, prefs.funnelBias.tofu));

    return true;
  }

  private learnTopicPreferences(prefs: ClientPreferences, edits: EditForLearning[]): void {
    for (const edit of edits) {
      if (edit.type === 'remove_cluster' && edit.data.clusterLabel) {
        const topic = edit.data.clusterLabel.toLowerCase();

        if (!prefs.avoidedTopics.includes(topic)) {
          prefs.avoidedTopics.push(topic);
        }

        prefs.preferredTopics = prefs.preferredTopics.filter((t) => t !== topic);
      }
    }
  }

  private calculateConfidence(prefs: ClientPreferences, editCount: number): number {
    const patternConfidence =
      prefs.exclusions.length > 0
        ? prefs.exclusions.reduce((s, p) => s + p.confidence, 0) / prefs.exclusions.length
        : 0;

    const editConfidence = Math.min(editCount / 10, 1.0);

    return (patternConfidence + editConfidence) / 2;
  }
}

/**
 * Factory function for learning.
 */
export function learnFromEdits(
  input: LearningInput,
  existingPrefs?: ClientPreferences,
  config?: Partial<LearningConfig>
): LearningResult {
  const learner = new PreferenceLearner(config);
  return learner.learn(input, existingPrefs);
}
