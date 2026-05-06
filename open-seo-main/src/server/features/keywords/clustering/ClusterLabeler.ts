/**
 * Cluster Labeler
 * Phase 86-04: Semantic Intelligence Pipeline
 *
 * Generates human-readable labels for semantic clusters using:
 * 1. Centroid nearest: Label from keyword closest to centroid (PRIMARY, FREE)
 * 2. N-gram: Most frequent n-gram in cluster keywords (FREE)
 * 3. LLM: Grok 4.1 Fast summarization (FALLBACK, $0.20/1M tokens)
 *
 * CRITICAL MODEL SELECTION (from CLAUDE.md):
 * - Use grok-4.1-fast for LLM fallback ($0.20/1M tokens)
 * - NO GPT-4, NO Claude for labeling
 * - LLM is FALLBACK only when centroid-nearest confidence < 0.6
 */

import type {
  KeywordCluster,
  LabeledCluster,
  LabelingConfig,
} from './types';
import { DEFAULT_LABELING_CONFIG } from './types';
import { cosineSimilarity } from '@/server/features/keywords/services/EmbeddingService';

/**
 * Lithuanian diacritic mapping for URL transliteration.
 * Preserves Lithuanian in labelLt, removes diacritics for suggestedUrl.
 */
const LITHUANIAN_DIACRITICS: Record<string, string> = {
  'ą': 'a', 'Ą': 'A',
  'č': 'c', 'Č': 'C',
  'ę': 'e', 'Ę': 'E',
  'ė': 'e', 'Ė': 'E',
  'į': 'i', 'Į': 'I',
  'š': 's', 'Š': 'S',
  'ų': 'u', 'Ų': 'U',
  'ū': 'u', 'Ū': 'U',
  'ž': 'z', 'Ž': 'Z',
};

/**
 * Transliterate Lithuanian text to ASCII for URL slugs.
 * Converts diacritics, lowercases, replaces spaces with hyphens.
 */
export function transliterateLithuanian(text: string): string {
  let result = text.toLowerCase();

  // Replace Lithuanian diacritics
  for (const [diacritic, replacement] of Object.entries(LITHUANIAN_DIACRITICS)) {
    result = result.replaceAll(diacritic.toLowerCase(), replacement.toLowerCase());
  }

  // Remove non-alphanumeric (except spaces)
  result = result.replace(/[^a-z0-9\s]/g, '');

  // Replace spaces with hyphens, collapse multiple hyphens
  result = result.replace(/\s+/g, '-').replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  result = result.replace(/^-|-$/g, '');

  return result;
}

/**
 * Cluster labeler with multiple strategies.
 *
 * Default strategy ('auto'):
 * 1. Try centroid_nearest (FREE)
 * 2. If confidence < 0.6, fall back to Grok 4.1 Fast LLM
 */
export class ClusterLabeler {
  private config: LabelingConfig;

  constructor(config: Partial<LabelingConfig> = {}) {
    this.config = { ...DEFAULT_LABELING_CONFIG, ...config };
  }

  /**
   * Label all clusters using configured method.
   */
  async labelClusters(clusters: KeywordCluster[]): Promise<LabeledCluster[]> {
    const results: LabeledCluster[] = [];

    for (const cluster of clusters) {
      const labeled = await this.labelCluster(cluster);
      results.push(labeled);
    }

    return results;
  }

  /**
   * Label a single cluster (async for LLM fallback).
   */
  async labelCluster(cluster: KeywordCluster): Promise<LabeledCluster> {
    if (this.config.method === 'auto') {
      return this.labelWithFallback(cluster);
    }

    return this.labelClusterSync(cluster);
  }

  /**
   * Label cluster synchronously (no LLM).
   * Used for centroid_nearest and ngram methods.
   */
  labelClusterSync(cluster: KeywordCluster): LabeledCluster {
    let labelLt: string;
    let labelConfidence: number;
    let labelMethod: 'centroid_nearest' | 'ngram' | 'llm';

    switch (this.config.method) {
      case 'ngram':
        ({ label: labelLt, confidence: labelConfidence } = this.ngramExtract(cluster));
        labelMethod = 'ngram';
        break;
      case 'centroid_nearest':
      default:
        ({ label: labelLt, confidence: labelConfidence } = this.centroidNearest(cluster));
        labelMethod = 'centroid_nearest';
        break;
    }

    // Generate English label (title case - English convention)
    const labelEn = this.toTitleCase(labelLt);

    // Generate URL slug (ASCII, kebab-case)
    const suggestedUrl = transliterateLithuanian(labelLt);

    return {
      ...cluster,
      labelLt,
      labelEn,
      suggestedUrl,
      labelConfidence,
      labelMethod,
    };
  }

  /**
   * Auto mode: Try centroid_nearest, fall back to Grok 4.1 Fast if confidence < threshold.
   */
  private async labelWithFallback(cluster: KeywordCluster): Promise<LabeledCluster> {
    // Try centroid_nearest first (FREE)
    const centroidResult = this.centroidNearest(cluster);

    // If confidence >= threshold, use centroid result
    if (centroidResult.confidence >= (this.config.llmFallbackThreshold ?? 0.6)) {
      const labelEn = this.toTitleCase(centroidResult.label);
      const suggestedUrl = transliterateLithuanian(centroidResult.label);

      return {
        ...cluster,
        labelLt: centroidResult.label,
        labelEn,
        suggestedUrl,
        labelConfidence: centroidResult.confidence,
        labelMethod: 'centroid_nearest',
      };
    }

    // Fall back to Grok 4.1 Fast LLM ($0.20/1M tokens)
    if (this.config.grokApiKey) {
      try {
        const llmResult = await this.grokSummarize(cluster);
        return {
          ...cluster,
          labelLt: llmResult.labelLt,
          labelEn: llmResult.labelEn,
          suggestedUrl: transliterateLithuanian(llmResult.labelLt),
          labelConfidence: 0.85, // LLM labels assumed high confidence
          labelMethod: 'llm',
        };
      } catch (error) {
        // LLM failed, fall back to centroid result
        console.warn('Grok 4.1 Fast labeling failed, using centroid_nearest:', error);
      }
    }

    // Final fallback: use centroid result even with low confidence
    const labelEn = this.toTitleCase(centroidResult.label);
    const suggestedUrl = transliterateLithuanian(centroidResult.label);

    return {
      ...cluster,
      labelLt: centroidResult.label,
      labelEn,
      suggestedUrl,
      labelConfidence: centroidResult.confidence,
      labelMethod: 'centroid_nearest',
    };
  }

  /**
   * Method 1: Label from keyword nearest to centroid (PRIMARY, FREE).
   */
  private centroidNearest(cluster: KeywordCluster): { label: string; confidence: number } {
    if (cluster.keywords.length === 0) {
      return { label: 'Unknown', confidence: 0 };
    }

    let nearestKeyword = cluster.keywords[0];
    let maxSimilarity = -1;

    // Convert centroid to Float32Array for cosineSimilarity
    const centroidArray = new Float32Array(cluster.centroid);

    for (const keyword of cluster.keywords) {
      const keywordArray = new Float32Array(keyword.embedding);
      const similarity = cosineSimilarity(keywordArray, centroidArray);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        nearestKeyword = keyword;
      }
    }

    // Clean up keyword for label (capitalize first letter)
    const label = this.cleanLabel(nearestKeyword.keyword);

    return { label, confidence: maxSimilarity };
  }

  /**
   * Method 2: Most frequent n-gram in cluster keywords (FREE).
   */
  private ngramExtract(cluster: KeywordCluster): { label: string; confidence: number } {
    if (cluster.keywords.length === 0) {
      return { label: 'Unknown', confidence: 0 };
    }

    // Count bigrams and unigrams (preserve original case)
    const ngramCounts = new Map<string, { count: number; original: string }>();

    for (const keyword of cluster.keywords) {
      const words = keyword.keyword.split(/\s+/);
      const lowerWords = words.map(w => w.toLowerCase());

      // Bigrams (higher priority)
      for (let i = 0; i < lowerWords.length - 1; i++) {
        const bigramKey = `${lowerWords[i]} ${lowerWords[i + 1]}`;
        const bigramOriginal = `${words[i]} ${words[i + 1]}`;
        const existing = ngramCounts.get(bigramKey);
        ngramCounts.set(bigramKey, {
          count: (existing?.count || 0) + 2, // Weight bigrams 2x
          original: existing?.original || bigramOriginal,
        });
      }

      // Unigrams (fallback)
      for (let j = 0; j < lowerWords.length; j++) {
        const word = lowerWords[j];
        if (word.length > 3) { // Skip short words
          const existing = ngramCounts.get(word);
          ngramCounts.set(word, {
            count: (existing?.count || 0) + 1,
            original: existing?.original || words[j],
          });
        }
      }
    }

    // Find most frequent
    let bestNgram = '';
    let bestCount = 0;

    for (const [, { count, original }] of ngramCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestNgram = original;
      }
    }

    const label = this.cleanLabel(bestNgram);
    const confidence = Math.min(1, bestCount / cluster.keywords.length);

    return { label, confidence };
  }

  /**
   * Method 3: Grok 4.1 Fast LLM summarization (FALLBACK, $0.20/1M tokens).
   *
   * CRITICAL: Uses grok-4.1-fast, NOT GPT-4 or Claude.
   */
  private async grokSummarize(cluster: KeywordCluster): Promise<{ labelLt: string; labelEn: string }> {
    // Dynamic import to avoid loading LLM client unless needed
    const { grokFast } = await import('@/server/lib/llm/grok-client');

    // Extract sample keywords for LLM context
    const sampleKeywords = cluster.keywords
      .slice(0, 10)
      .map(k => k.keyword)
      .join(', ');

    const result = await grokFast.generateLabel({
      keywords: sampleKeywords,
      clusterSize: cluster.keywords.length,
      dominantFunnel: cluster.dominantFunnel,
      language: 'Lithuanian',
    });

    return {
      labelLt: result.labelLt,
      labelEn: result.labelEn,
    };
  }

  /**
   * Clean up label string: capitalize first letter, trim whitespace.
   */
  private cleanLabel(label: string): string {
    return label
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^./, c => c.toUpperCase()); // Capitalize first letter
  }

  /**
   * Convert to title case for English label.
   */
  private toTitleCase(text: string): string {
    return text
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}

/**
 * Factory function for labeling clusters.
 * Uses centroid_nearest by default (FREE), with optional Grok 4.1 Fast fallback.
 */
export async function labelClusters(
  clusters: KeywordCluster[],
  config?: Partial<LabelingConfig>
): Promise<LabeledCluster[]> {
  const labeler = new ClusterLabeler(config);
  return labeler.labelClusters(clusters);
}
