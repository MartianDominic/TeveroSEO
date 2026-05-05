/**
 * Graceful degradation for keyword analysis pipeline.
 *
 * Handles stage failures with fallbacks for optional stages.
 * Ensures pipeline can complete even with partial failures.
 *
 * @module server/features/keywords/lib/graceful-degradation
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "graceful-degradation" });

export interface DegradationConfig {
  stage: string;
  optional: boolean;
  fallback?: () => Promise<unknown>;
  timeoutMs: number;
}

export interface EnrichedKeyword {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  source: "dataforseo" | "raw";
}

export interface KeywordWithEmbedding {
  keyword: string;
  embedding: number[];
}

export interface Cluster {
  id: string;
  label: string;
  keywords: KeywordWithEmbedding[];
}

const PIPELINE_STAGES: DegradationConfig[] = [
  { stage: "constraint_extraction", optional: false, timeoutMs: 30000 },
  { stage: "keyword_enrichment", optional: true, timeoutMs: 60000 },
  { stage: "embedding", optional: false, timeoutMs: 120000 },
  { stage: "clustering", optional: true, timeoutMs: 60000 },
  { stage: "funnel_classification", optional: false, timeoutMs: 60000 },
  { stage: "scoring", optional: false, timeoutMs: 30000 },
  { stage: "labeling", optional: true, timeoutMs: 30000 },
];

export function getStageConfig(stage: string): DegradationConfig | undefined {
  return PIPELINE_STAGES.find((s) => s.stage === stage);
}

export function isOptionalStage(stage: string): boolean {
  const config = getStageConfig(stage);
  return config?.optional ?? false;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stageName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Stage ${stageName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export async function runWithDegradation<T>(
  stage: string,
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T | null> {
  const config = getStageConfig(stage);
  if (!config) {
    throw new Error(`Unknown pipeline stage: ${stage}`);
  }

  try {
    return await withTimeout(operation(), config.timeoutMs, stage);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warn(`Stage ${stage} failed: ${errorMessage}`);

    if (config.optional) {
      if (fallback) {
        log.info(`Using fallback for optional stage ${stage}`);
        return fallback();
      }
      log.info(`Skipping optional stage ${stage} (no fallback)`);
      return null;
    }

    throw error;
  }
}

/**
 * Fallback: Return keywords without DataForSEO enrichment
 */
export async function useRawKeywords(keywords: string[]): Promise<EnrichedKeyword[]> {
  return keywords.map((kw) => ({
    keyword: kw,
    volume: null,
    difficulty: null,
    cpc: null,
    source: "raw" as const,
  }));
}

/**
 * Fallback: Put all keywords in a single "Unclustered" group
 */
export async function skipClustering(
  keywords: KeywordWithEmbedding[]
): Promise<Cluster[]> {
  return [
    {
      id: "unclustered",
      label: "All Keywords",
      keywords,
    },
  ];
}

/**
 * Fallback: Generate labels from top keyword + count
 */
export async function useHeuristicLabels(clusters: Cluster[]): Promise<Cluster[]> {
  return clusters.map((c) => ({
    ...c,
    label: c.label || `${c.keywords[0]?.keyword ?? "Keywords"} (${c.keywords.length})`,
  }));
}

/**
 * Combined pipeline executor with degradation support
 */
export class DegradedPipeline {
  private degradedStages: Set<string> = new Set();
  private skippedStages: Set<string> = new Set();

  async runStage<T>(
    stage: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    try {
      return await runWithDegradation(stage, operation, fallback);
    } catch (error) {
      throw error;
    }
  }

  markDegraded(stage: string): void {
    this.degradedStages.add(stage);
    log.info(`Stage ${stage} running in degraded mode`);
  }

  markSkipped(stage: string): void {
    this.skippedStages.add(stage);
    log.info(`Stage ${stage} skipped`);
  }

  getSummary(): {
    degradedStages: string[];
    skippedStages: string[];
    fullyDegraded: boolean;
  } {
    return {
      degradedStages: Array.from(this.degradedStages),
      skippedStages: Array.from(this.skippedStages),
      fullyDegraded: this.degradedStages.size > 0 || this.skippedStages.size > 0,
    };
  }
}
