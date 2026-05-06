/**
 * ChunkExtractor - Semantic chunking and tokenization utilities
 * Phase 92: On-Page SEO Mastery
 *
 * Provides:
 * - Token counting using tiktoken cl100k_base encoding
 * - Text extraction from HTML
 * - Semantic chunking with heading boundary priority
 * - Path pattern extraction for URL analysis
 *
 * Requirements: OPM-04, OPM-05, OPM-06
 */

import { get_encoding, type Tiktoken } from "tiktoken";
import { load, type CheerioAPI } from "cheerio";
import { chunkit } from "semantic-chunking";

// DoS protection limit per T-92-04
const MAX_CHUNKS = 100;
const MAX_CONTENT_SIZE = 100_000; // 100KB limit for content extraction

/**
 * Semantic chunk with metadata and quality metrics
 */
export interface SemanticChunk {
  id: string;
  position: number;
  text: string;
  tokenCount: number;
  parentHeading: string | null;
  embedding: number[];
  metrics: {
    tokenScore: number; // 1.0 in range [400-600], decay outside
    selfContainmentScore: number; // 1.0 if no dangling references
    headingAlignmentScore: number; // similarity between heading and content
    factDensity: number; // entities per 100 tokens (placeholder)
  };
}

/**
 * Result from chunk extraction
 */
export interface ChunkExtractionResult {
  chunks: SemanticChunk[];
  totalTokens: number;
  truncated: boolean;
  truncationReason?: string;
}

/**
 * Content block extracted from HTML with heading context
 */
interface ContentBlock {
  text: string;
  heading: string | null;
  headingLevel: number | null;
}

/**
 * Count tokens in a text string using tiktoken cl100k_base encoding.
 * IMPORTANT: This encoding must match the LLM tokenizer for accurate chunk boundaries.
 *
 * @param text - The text to tokenize
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  const encoding = get_encoding("cl100k_base");
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } finally {
    encoding.free(); // CRITICAL: free WASM resources
  }
}

/**
 * Count tokens for multiple texts efficiently with a single encoding instance.
 *
 * @param texts - Array of texts to tokenize
 * @returns Array of token counts
 */
export function batchCountTokens(texts: string[]): number[] {
  if (texts.length === 0) {
    return [];
  }

  const encoding = get_encoding("cl100k_base");
  try {
    return texts.map((text) => encoding.encode(text).length);
  } finally {
    encoding.free();
  }
}

/**
 * Extract plain text from HTML, excluding scripts and styles.
 * Uses a cloned DOM to avoid mutating the shared Cheerio instance.
 *
 * @param $ - Cheerio instance
 * @returns Normalized text content
 */
export function extractText($: CheerioAPI): string {
  // Clone the DOM to avoid mutating the shared Cheerio instance
  const $clone = $.root().clone();
  const $cloned = load($clone.html() ?? "");

  // Remove scripts and styles from the clone
  $cloned("script, style, noscript, svg, iframe").remove();

  const text = $cloned("body").text().replace(/\s+/g, " ").trim();

  // Enforce size limit for DoS protection
  if (text.length > MAX_CONTENT_SIZE) {
    return text.slice(0, MAX_CONTENT_SIZE);
  }

  return text;
}

/**
 * Extract content blocks from HTML with heading context.
 * Groups content by H2/H3 sections for better semantic chunking.
 *
 * @param $ - Cheerio instance
 * @returns Array of content blocks with heading metadata
 */
function extractContentBlocks($: CheerioAPI): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let currentHeading: string | null = null;
  let currentLevel: number | null = null;
  let currentContent: string[] = [];

  const flushBlock = () => {
    if (currentContent.length > 0) {
      const text = currentContent.join(" ").replace(/\s+/g, " ").trim();
      if (text.length > 0) {
        blocks.push({
          text,
          heading: currentHeading,
          headingLevel: currentLevel,
        });
      }
      currentContent = [];
    }
  };

  // Clone to avoid mutation
  const $clone = $.root().clone();
  const $cloned = load($clone.html() ?? "");
  $cloned("script, style, noscript, svg, iframe").remove();

  // Walk through body content
  $cloned("body")
    .children()
    .each((_, element) => {
      const $el = $cloned(element);
      const tagName = element.tagName?.toLowerCase();

      // Check for heading elements
      if (tagName?.match(/^h[1-6]$/)) {
        flushBlock();
        const level = parseInt(tagName.charAt(1), 10);
        // Only track H2 and H3 for semantic boundaries
        if (level <= 3) {
          currentHeading = $el.text().trim();
          currentLevel = level;
        }
      } else {
        // Accumulate paragraph and other content
        const text = $el.text().trim();
        if (text.length > 0) {
          currentContent.push(text);
        }
      }
    });

  // Flush remaining content
  flushBlock();

  return blocks;
}

/**
 * Calculate token score for a chunk.
 * Score is 1.0 for chunks in the [400-600] token range, with decay outside.
 *
 * @param tokenCount - Number of tokens in the chunk
 * @returns Score between 0 and 1
 */
function calculateTokenScore(tokenCount: number): number {
  const TARGET_MIN = 400;
  const TARGET_MAX = 600;
  const TARGET_CENTER = 500;

  if (tokenCount >= TARGET_MIN && tokenCount <= TARGET_MAX) {
    return 1.0;
  }

  // Calculate decay based on distance from range
  const distance =
    tokenCount < TARGET_MIN
      ? TARGET_MIN - tokenCount
      : tokenCount - TARGET_MAX;
  const maxDistance = TARGET_CENTER; // Full decay at 0 or 1000 tokens

  return Math.max(0, 1.0 - distance / maxDistance);
}

/**
 * Calculate self-containment score for a chunk.
 * Checks for dangling references that indicate incomplete context.
 *
 * @param text - Chunk text
 * @returns Score between 0 and 1
 */
function calculateSelfContainmentScore(text: string): number {
  // Patterns that indicate incomplete context
  const danglingPatterns = [
    /^(However|Therefore|Thus|Hence|Consequently|Moreover|Furthermore|Additionally),?\s/i,
    /^(This|That|These|Those|It|They)\s+(is|are|was|were|have|has|had)\b/i,
    /^(As mentioned|As discussed|As noted)\s+(above|below|earlier|previously)/i,
    /\b(the aforementioned|the following|the above|the below)\b/i,
    /\b(see|refer to)\s+(section|chapter|figure|table|above|below)/i,
  ];

  let penaltyCount = 0;
  for (const pattern of danglingPatterns) {
    if (pattern.test(text)) {
      penaltyCount++;
    }
  }

  // Max 5 penalties, each reduces score by 0.15
  return Math.max(0, 1.0 - penaltyCount * 0.15);
}

/**
 * Calculate heading alignment score.
 * Measures how well the content relates to its parent heading.
 *
 * @param text - Chunk text
 * @param heading - Parent heading text or null
 * @returns Score between 0 and 1
 */
function calculateHeadingAlignmentScore(
  text: string,
  heading: string | null
): number {
  if (!heading) {
    return 0.5; // Neutral score if no heading
  }

  // Simple word overlap calculation
  const headingWords = new Set(
    heading
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  if (headingWords.size === 0) {
    return 0.5;
  }

  const textWords = text.toLowerCase().split(/\s+/).slice(0, 100); // First 100 words
  let matchCount = 0;

  for (const word of textWords) {
    if (headingWords.has(word.replace(/[^\w]/g, ""))) {
      matchCount++;
    }
  }

  // Normalize by heading word count
  const matchRatio = matchCount / headingWords.size;

  // Score caps at 1.0 when all heading words appear
  return Math.min(1.0, matchRatio);
}

/**
 * Extract semantic chunks from HTML using embedding-based boundary detection.
 * Implements the 500-token chunk architecture with H2/H3 boundary priority.
 *
 * @param html - HTML content to chunk
 * @param embedFn - Embedding function that takes text and returns vector
 * @returns Promise resolving to chunk extraction result
 */
export async function extractChunks(
  html: string,
  embedFn: (text: string) => Promise<number[]>
): Promise<ChunkExtractionResult> {
  const $ = load(html);
  const blocks = extractContentBlocks($);

  if (blocks.length === 0) {
    return {
      chunks: [],
      totalTokens: 0,
      truncated: false,
    };
  }

  // Prepare documents for semantic chunking
  const documents = blocks.map((block, i) => ({
    document_name: `block-${i}`,
    document_text: block.text,
    metadata: {
      heading: block.heading,
      headingLevel: block.headingLevel,
    },
  }));

  // Use semantic-chunking library with custom embedder
  const chunkedDocuments = await chunkit(documents, {
    logging: false,
    maxTokenSize: 600, // Max token size per chunk
    similarityThreshold: 0.5, // Threshold for combining sentences
    combineChunks: true,
    combineChunksSimilarityThreshold: 0.6,
    returnEmbedding: true,
    returnTokenLength: true,
    embedCallback: async (texts: string[]) => {
      // Batch embed all texts
      const embeddings: number[][] = [];
      for (const text of texts) {
        const embedding = await embedFn(text);
        embeddings.push(embedding);
      }
      return embeddings;
    },
  });

  // Process chunks with metrics
  // semantic-chunking returns flat array: each item is a chunk with text, token_length, embedding
  let chunks: SemanticChunk[] = [];
  let totalTokens = 0;

  for (let position = 0; position < chunkedDocuments.length; position++) {
    const chunkData = chunkedDocuments[position] as {
      document_name?: string;
      text?: string;
      token_length?: number;
      embedding?: number[];
    };

    const text = chunkData.text || "";
    const tokenCount = chunkData.token_length || countTokens(text);
    totalTokens += tokenCount;

    // Get heading from original block metadata
    const blockIndex = parseInt(
      chunkData.document_name?.split("-")[1] || "0",
      10
    );
    const originalBlock = blocks[blockIndex];

    chunks.push({
      id: `chunk-${position}`,
      position,
      text,
      tokenCount,
      parentHeading: originalBlock?.heading || null,
      embedding: chunkData.embedding || [],
      metrics: {
        tokenScore: calculateTokenScore(tokenCount),
        selfContainmentScore: calculateSelfContainmentScore(text),
        headingAlignmentScore: calculateHeadingAlignmentScore(
          text,
          originalBlock?.heading || null
        ),
        factDensity: 0, // Placeholder - calculated by EntityExtractor
      },
    });
  }

  // DoS protection: limit to MAX_CHUNKS (T-92-04)
  let truncated = false;
  let truncationReason: string | undefined;

  if (chunks.length > MAX_CHUNKS) {
    chunks = chunks.slice(0, MAX_CHUNKS);
    truncated = true;
    truncationReason = `Chunk count limited to ${MAX_CHUNKS} for DoS protection`;
  }

  return {
    chunks,
    totalTokens,
    truncated,
    truncationReason,
  };
}

/**
 * Extract a simplified chunk without embeddings.
 * Useful for quick token analysis without LLM calls.
 *
 * @param html - HTML content to chunk
 * @returns Array of text chunks with token counts
 */
export function extractSimpleChunks(
  html: string
): Array<{ text: string; tokenCount: number; heading: string | null }> {
  const $ = load(html);
  const blocks = extractContentBlocks($);

  return blocks.map((block) => ({
    text: block.text,
    tokenCount: countTokens(block.text),
    heading: block.heading,
  }));
}

/**
 * Extract path pattern from URL for caching purposes.
 * Normalizes dynamic URL segments to wildcards.
 *
 * Examples:
 * - /product/123 -> /product/{wildcard}
 * - /blog/2024/01/my-post -> /blog/{wildcard}
 * - /category/shoes/nike -> /category/{wildcard}/{wildcard}
 *
 * @param path - URL path
 * @returns Normalized path pattern
 */
export function extractPathPattern(path: string): string {
  // Remove query string and hash
  const cleanPath = path.split(/[?#]/)[0] || "/";

  // Split into segments
  const segments = cleanPath.split("/").filter((s) => s.length > 0);

  if (segments.length === 0) {
    return "/";
  }

  // Patterns that indicate dynamic segments
  const dynamicPatterns = [
    /^\d+$/, // Pure numbers (IDs)
    /^[a-f0-9-]{8,}$/i, // UUIDs
    /^\d{4}$/, // Years
    /^\d{2}$/, // Months/days
    /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/i, // Slugs with multiple dashes (likely titles)
  ];

  const normalizedSegments = segments.map((segment, index) => {
    // Keep first segment (usually category/section)
    if (index === 0) {
      return segment;
    }

    // Check if segment matches dynamic patterns
    for (const pattern of dynamicPatterns) {
      if (pattern.test(segment)) {
        return "*";
      }
    }

    // Keep segment if it looks like a category
    return segment;
  });

  return "/" + normalizedSegments.join("/");
}
