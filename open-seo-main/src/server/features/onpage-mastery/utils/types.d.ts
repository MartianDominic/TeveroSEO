/**
 * Type declarations for third-party modules without types
 * Phase 92: On-Page SEO Mastery
 */

declare module "text-readability" {
  const Readability: {
    fleschReadingEase(text: string): number;
    fleschKincaidGrade(text: string): number;
    gunningFog(text: string): number;
    smogIndex(text: string): number;
    automatedReadabilityIndex(text: string): number;
    colemanLiauIndex(text: string): number;
    linsearWriteFormula(text: string): number;
    daleChallReadabilityScore(text: string): number;
    textStandard(text: string): string;
  };
  export default Readability;
}

declare module "semantic-chunking" {
  export interface ChunkerOptions {
    logging?: boolean;
    maxTokenSize?: number;
    similarityThreshold?: number;
    dynamicThresholdLowerBound?: number;
    dynamicThresholdUpperBound?: number;
    numSimilaritySentencesLookahead?: number;
    combineChunks?: boolean;
    combineChunksSimilarityThreshold?: number;
    onnxEmbeddingModel?: string;
    dtype?: string;
    device?: string;
    localModelPath?: string | null;
    modelCacheDir?: string | null;
    returnEmbedding?: boolean;
    returnTokenLength?: boolean;
    chunkPrefix?: string | null;
    excludeChunkPrefixInResults?: boolean;
    embedCallback?: ((texts: string[]) => Promise<number[][]>) | null;
    maxMergesPerPass?: number;
    maxUncappedPasses?: number;
    maxMergesPerPassPercentage?: number;
    uncappedCandidateMerges?: number;
  }

  export interface DocumentInput {
    document_name?: string;
    document_text: string;
  }

  export interface Chunk {
    text: string;
    tokenCount: number;
    embedding?: number[];
  }

  export function chunkit(
    documents: DocumentInput[],
    options?: ChunkerOptions
  ): Promise<Chunk[]>;
}

declare module "compromise-dates" {
  import type nlp from "compromise";
  type View = ReturnType<typeof nlp>;

  interface DateView extends View {
    format(fmt: string): View;
    get(): object[];
  }

  interface TimeView extends View {
    format(fmt: string): View;
    get(): object[];
  }

  interface DatesMethods {
    dates(opts?: object): DateView;
    times(opts?: object): TimeView;
    durations(): View;
  }

  const nlpDates: nlp.TypedPlugin<DatesMethods>;
  export default nlpDates;
}
