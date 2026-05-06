# Phase 92: On-Page SEO Mastery - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 29 new/modified files
**Analogs found:** 27 / 29

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/server/features/onpage-mastery/services/VerticalClassifier.ts` | service | request-response + cache | `src/server/features/keywords/classification/GrokClassifier.ts` | role-match |
| `src/server/features/onpage-mastery/services/PageStructureAnalyzer.ts` | service | transform | `src/server/lib/audit/checks/tier2/content-quality.ts` | partial-match |
| `src/server/features/onpage-mastery/services/RuleEngineService.ts` | service | CRUD + evaluation | `src/server/features/graph/graph-service.ts` | role-match |
| `src/server/features/onpage-mastery/services/QualityGateService.ts` | service | evaluation + LLM | `src/server/features/keywords/classification/GrokClassifier.ts` | role-match |
| `src/server/features/onpage-mastery/utils/ChunkExtractor.ts` | utility | transform | `src/server/lib/audit/checks/tier2/content-quality.ts` | role-match |
| `src/server/features/onpage-mastery/utils/EntityExtractor.ts` | utility | transform | `src/server/lib/audit/checks/tier2/content-quality.ts` | role-match |
| `src/server/features/onpage-mastery/utils/ReadabilityScorer.ts` | utility | calculation | `src/server/lib/audit/checks/tier2/content-quality.ts` | exact |
| `src/server/features/onpage-mastery/utils/SchemaGenerator.ts` | utility | transform | `src/server/lib/audit/checks/tier1/content-structure.ts` | partial-match |
| `src/server/features/onpage-mastery/checks/tier1/T1-70-page-type.ts` | check | evaluation | `src/server/lib/audit/checks/tier1/content-structure.ts` | exact |
| `src/server/features/onpage-mastery/checks/tier1/T1-71-value-prop.ts` | check | evaluation | `src/server/lib/audit/checks/tier1/content-structure.ts` | exact |
| `src/server/features/onpage-mastery/checks/tier1/T1-72-T1-85.ts` (14 checks) | check | evaluation | `src/server/lib/audit/checks/tier1/content-structure.ts` | exact |
| `src/server/features/onpage-mastery/checks/tier5/T5-01-reddit-test.ts` | check | evaluation + LLM | `src/server/lib/audit/checks/tier2/content-quality.ts` | role-match |
| `src/server/features/onpage-mastery/checks/tier5/T5-02-T5-13.ts` (12 checks) | check | evaluation + LLM | `src/server/lib/audit/checks/tier2/content-quality.ts` | role-match |
| `src/server/features/verticals/VerticalClassifier.ts` | service | classification | `src/server/features/keywords/classification/GrokClassifier.ts` | exact |
| `src/server/features/linking/TopicClusterer.ts` | service | clustering | `src/server/features/keywords/clustering/HDBSCANClusterer.ts` | exact |
| `src/server/features/linking/InternalLinkGraph.ts` (enhancement) | service | graph | `src/server/features/linking/services/LinkSuggestionService.ts` | exact |
| `src/db/onpage-mastery-schema.ts` | schema | database | `src/db/link-schema.ts` | role-match |

## Pattern Assignments

### `src/server/features/verticals/VerticalClassifier.ts` (service, classification)

**Analog:** `src/server/features/keywords/classification/GrokClassifier.ts`

**Imports pattern** (lines 1-22):
```typescript
import OpenAI from "openai";
import { CircuitBreaker, CircuitOpenError } from "../services/CircuitBreaker";
import {
  ClassificationResponseSchema,
  type BusinessContext,
  type ClassificationItem,
} from "./types";
import { GROK_CONFIG, CLASSIFICATION_CONFIG } from "./config";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "VerticalClassifier" });

export { CircuitOpenError };
```

**Service class pattern** (lines 28-48):
```typescript
export class VerticalClassifier {
  private client: OpenAI;
  private circuit: CircuitBreaker;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("XAI_API_KEY not configured");
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: GROK_CONFIG.baseURL,
    });

    this.circuit = new CircuitBreaker({
      name: "vertical-classifier",
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }
}
```

**Circuit breaker + LLM call pattern** (lines 51-76):
```typescript
async classify(
  pages: string[],
  context: ClassificationContext
): Promise<ClassificationItem[]> {
  if (!this.circuit.allowsRequest) {
    throw new CircuitOpenError("vertical-classifier");
  }

  if (pages.length === 0) {
    return [];
  }

  try {
    const response = await this.client.chat.completions.create({
      model: GROK_CONFIG.model,
      messages: [
        { role: "system", content: this.buildSystemPrompt() },
        { role: "user", content: this.buildUserPrompt(pages, context) },
      ],
      response_format: { type: "json_object" },
      max_tokens: GROK_CONFIG.maxTokens,
      temperature: GROK_CONFIG.temperature,
    });
    
    // Parse and validate with Zod
    const parsed = ClassificationResponseSchema.safeParse(jsonData);
    this.circuit.recordSuccess();
    return parsed.data.classifications;
  } catch (error) {
    this.circuit.recordFailure();
    throw error;
  }
}
```

**Cache integration pattern** (from RESEARCH.md, add to VerticalClassifier):
```typescript
// Redis cache key pattern
private getCacheKey(domain: string, pathPattern: string): string {
  return `tier5:vertical:${domain}:${pathPattern}`;
}

// Cache-first classification
async classifyWithCache(
  domain: string, 
  path: string, 
  html: string
): Promise<Classification> {
  const pathPattern = this.extractPathPattern(path); // "/product/*"
  const cacheKey = this.getCacheKey(domain, pathPattern);
  
  // 1. Check cache (24h TTL)
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // 2. Run heuristics (Schema.org + URL patterns)
  const heuristic = this.classifyHeuristic(html, path);
  if (heuristic.confidence >= 0.90) {
    await redis.setex(cacheKey, 86400, JSON.stringify(heuristic));
    return heuristic;
  }
  
  // 3. LLM fallback
  const llm = await this.classifyLLM(html, path);
  await redis.setex(cacheKey, 86400, JSON.stringify(llm));
  return llm;
}
```

---

### `src/server/features/onpage-mastery/utils/ChunkExtractor.ts` (utility, transform)

**Analog:** `src/server/lib/audit/checks/tier2/content-quality.ts`

**Text extraction pattern** (lines 42-50):
```typescript
/**
 * Extract plain text from HTML, excluding scripts and styles.
 * Uses a cloned DOM to avoid mutating the shared Cheerio instance.
 */
function extractText($: CheckContext["$"]): string {
  // Clone the DOM to avoid mutating the shared Cheerio instance
  const $clone = $.root().clone();
  const $cloned = $.load($clone.html() ?? "");
  // Remove scripts and styles from the clone
  $cloned("script, style, noscript").remove();
  return $cloned("body").text().replace(/\s+/g, " ").trim();
}
```

**Tokenization integration** (from RESEARCH.md tiktoken pattern):
```typescript
import { get_encoding } from 'tiktoken';

export function countTokens(text: string): number {
  const encoding = get_encoding('cl100k_base');
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } finally {
    encoding.free(); // CRITICAL: free WASM resources
  }
}

// Batch tokenization for multiple chunks (more efficient)
export function batchCountTokens(texts: string[]): number[] {
  const encoding = get_encoding('cl100k_base');
  try {
    return texts.map(text => encoding.encode(text).length);
  } finally {
    encoding.free();
  }
}
```

**Semantic chunking integration** (from RESEARCH.md):
```typescript
import { SemanticChunker } from 'semantic-chunking';

async function chunkContent(
  text: string, 
  embedFn: (text: string) => Promise<number[]>
): Promise<Array<{ text: string; embedding: number[] }>> {
  const chunker = new SemanticChunker({
    embedder: embedFn,           // BYOE: jina-v5 embeddings
    targetSize: 500,             // Target tokens
    zScoreThreshold: 1.5,        // Boundary sensitivity
    minChunkSize: 300,           // Never below 300 tokens
    maxChunkSize: 700,           // Allow overflow to 700
  });
  
  return await chunker.chunk(text);
}
```

---

### `src/server/features/onpage-mastery/utils/ReadabilityScorer.ts` (utility, calculation)

**Analog:** `src/server/lib/audit/checks/tier2/content-quality.ts`

**Syllable counting pattern** (lines 11-36):
```typescript
/**
 * Count syllables in a word using standard heuristics.
 * Rules:
 * 1. Count vowel groups (a, e, i, o, u, y)
 * 2. Subtract 1 for silent 'e' at end
 * 3. Minimum 1 syllable per word
 */
function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length <= 2) return 1;

  // Count vowel groups
  const vowelGroups = lower.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Subtract for silent e at end (but not "le" endings like "table")
  if (lower.endsWith("e") && !lower.endsWith("le")) {
    count = Math.max(1, count - 1);
  }

  // Subtract for common silent endings
  if (lower.endsWith("es") || lower.endsWith("ed")) {
    count = Math.max(1, count - 1);
  }

  return Math.max(1, count);
}
```

**Flesch Reading Ease pattern** (lines 70-95):
```typescript
/**
 * Calculate Flesch Reading Ease score.
 * Formula: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 *
 * Score interpretation:
 * - 90-100: 5th grade (very easy)
 * - 80-89: 6th grade (easy)
 * - 70-79: 7th grade (fairly easy)
 * - 60-69: 8-9th grade (standard)
 * - 50-59: 10-12th grade (fairly difficult)
 * - 30-49: College (difficult)
 * - 0-29: Graduate (very difficult)
 */
function calculateFleschReadingEase(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;

  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, score));
}
```

**Flesch-Kincaid Grade pattern** (lines 97-116):
```typescript
/**
 * Calculate Flesch-Kincaid Grade Level.
 * Formula: 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
 *
 * Returns grade level (e.g., 9 = 9th grade).
 */
function calculateFleschKincaidGrade(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 0) return 0;

  const sentenceCount = countSentences(text);
  const syllableCount = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;

  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}
```

**Prefer text-readability library** (from RESEARCH.md):
```typescript
// RESEARCH.md recommends text-readability (1.1.1) for multi-formula support
import { 
  fleschReadingEase, 
  fleschKincaidGrade, 
  gunningFog 
} from 'text-readability';

export interface ReadabilityScores {
  fleschEase: number;          // 0-100, higher = easier
  gradeLevel: number;          // US grade level (0-18+)
  gunningFog: number;          // Years of education needed
  recommendation: string;
}

export function analyzeReadability(text: string): ReadabilityScores {
  const ease = fleschReadingEase(text);
  const grade = fleschKincaidGrade(text);
  const fog = gunningFog(text);
  
  // Vertical-specific recommendations
  let recommendation = '';
  if (grade > 12) {
    recommendation = 'Content requires college-level reading. Simplify for broader audience.';
  } else if (grade > 8) {
    recommendation = 'Appropriate for general audience.';
  } else {
    recommendation = 'Very accessible. Consider adding depth for expert audience.';
  }
  
  return { fleschEase: ease, gradeLevel: grade, gunningFog: fog, recommendation };
}
```

---

### `src/server/lib/audit/checks/tier1/T1-70-page-type.ts` (check, evaluation)

**Analog:** `src/server/lib/audit/checks/tier1/content-structure.ts`

**Check registration pattern** (lines 26-51):
```typescript
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

// T1-70: Page type detected
registerCheck({
  id: "T1-70",
  name: "Page type detected",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const { $ } = ctx;
    
    // Detection logic
    const pageType = detectPageType($);
    const passed = pageType !== "unknown";
    
    return {
      checkId: "T1-70",
      passed,
      severity: passed ? "info" : "medium",
      message: passed 
        ? `Page type: ${pageType}` 
        : "Could not determine page type",
      details: { pageType },
      autoEditable: false,
    };
  },
});
```

**Keyword-based check pattern** (lines 26-51 from content-structure.ts):
```typescript
registerCheck({
  id: "T1-26",
  name: "Keyword in first 100 words",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add keyword to the first 100 words of content",
  run: (ctx: CheckContext): CheckResult => {
    const { $, keyword } = ctx;
    if (!keyword) {
      return { checkId: "T1-26", passed: true, severity: "info", message: "No keyword provided", autoEditable: false };
    }
    const text = getBodyText($);
    const first100 = getWords(text).slice(0, 100).join(" ");
    const passed = keywordRegex(keyword).test(first100);
    return {
      checkId: "T1-26",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Keyword found in first 100 words" : "Keyword missing from first 100 words",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add keyword to the first 100 words of content",
    };
  },
});
```

---

### `src/server/lib/audit/checks/tier5/T5-01-reddit-test.ts` (check, evaluation + LLM)

**Analog:** `src/server/lib/audit/checks/tier2/content-quality.ts`

**LLM-based quality check pattern** (from RESEARCH.md):
```typescript
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

registerCheck({
  id: "T5-01",
  name: "Reddit Test",
  tier: 5,
  category: "content-quality",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add specific examples, numbers, case studies; avoid generic advice",
  run: async (ctx: CheckContext): Promise<CheckResult> => {
    const text = extractText(ctx.$);
    const wordCount = countWords(text);
    
    if (wordCount < 100) {
      return {
        checkId: "T5-01",
        passed: true,
        severity: "info",
        message: "Content too short for Reddit Test",
        autoEditable: false,
      };
    }
    
    // Step 1: Generate embedding
    const embedding = await embedText(text);
    
    // Step 2: Calculate similarity with reference embeddings
    const references = await getReferenceEmbeddings("reddit-quality", ctx.vertical);
    const maxSimilarity = Math.max(...references.map(ref => 
      cosineSimilarity(embedding, ref.embedding)
    ));
    
    // Step 3: Three-tier decision
    if (maxSimilarity >= 0.85) {
      return {
        checkId: "T5-01",
        passed: true,
        severity: "info",
        message: "Content demonstrates specificity and expertise",
        details: { similarity: maxSimilarity, method: "embedding" },
        autoEditable: false,
      };
    } else if (maxSimilarity <= 0.70) {
      return {
        checkId: "T5-01",
        passed: false,
        severity: "high",
        message: "Content is generic and lacks specific examples",
        details: { similarity: maxSimilarity, method: "embedding" },
        autoEditable: true,
        editRecipe: "Add specific examples, numbers, or case studies",
      };
    } else {
      // Borderline: LLM fallback
      const llmResult = await evaluateWithGrok(text, ctx.vertical);
      return {
        checkId: "T5-01",
        passed: llmResult.score >= 50,
        severity: llmResult.score >= 50 ? "info" : "high",
        message: llmResult.message,
        details: { similarity: maxSimilarity, llmScore: llmResult.score, method: "llm-fallback" },
        autoEditable: llmResult.score < 50,
        editRecipe: llmResult.score < 50 ? "Add specific examples, numbers, or case studies" : undefined,
      };
    }
  },
});
```

---

### `src/server/features/onpage-mastery/services/RuleEngineService.ts` (service, CRUD + evaluation)

**Analog:** `src/server/features/graph/graph-service.ts`

**Service singleton pattern** (lines 98-109):
```typescript
// Singleton instance
let _service: RuleEngineService | null = null;

/**
 * Get the singleton RuleEngineService instance.
 */
export async function getRuleEngineService(): Promise<RuleEngineService> {
  if (!_service) {
    const db = await getDb();
    _service = new RuleEngineService(db);
  }
  return _service;
}
```

**Service class with dependency injection** (lines 25-30):
```typescript
export class RuleEngineService {
  constructor(
    private db: AppDb,
    private ruleRegistry: RuleRegistry
  ) {}
  
  async evaluateScorecard(
    ctx: OnPageMasteryContext,
    clientId: string
  ): Promise<ScorecardResult> {
    // Load rules in hierarchy order
    const universalRules = this.ruleRegistry.getUniversalRules();
    const verticalRules = this.ruleRegistry.getVerticalRules(ctx.vertical);
    const clientRules = await this.loadClientOverrides(clientId);
    
    // Merge with client overrides taking precedence
    const mergedRules = this.mergeRules([
      universalRules,
      verticalRules,
      clientRules,
    ]);
    
    // Apply rules and calculate score
    const results = await Promise.all(
      mergedRules.map(rule => this.evaluateRule(rule, ctx))
    );
    
    return this.calculateScore(results);
  }
}
```

**Error handling pattern** (from graph-service.ts lines 79-94):
```typescript
async hasTenantData(tenantId: string): Promise<boolean> {
  try {
    const graph = await this.manager.getGraph(tenantId);
    const result = await graph.query<{ count: number }>(
      "MATCH (n) RETURN count(n) AS count LIMIT 1"
    );
    return (result.data?.[0]?.count ?? 0) > 0;
  } catch (error) {
    // Log error but return false - graph may not exist yet
    log.debug("hasTenantData check failed", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
```

---

### `src/server/features/linking/TopicClusterer.ts` (service, clustering)

**Analog:** `src/server/features/keywords/clustering/HDBSCANClusterer.ts`

**Python service integration pattern** (lines 40-60):
```typescript
export class TopicClusterer {
  private config: ClusteringConfig;
  private apiUrl: string;

  constructor(
    config: Partial<ClusteringConfig> = {},
    apiUrl?: string
  ) {
    this.config = { ...DEFAULT_CLUSTERING_CONFIG, ...config };
    this.apiUrl = apiUrl || process.env.AI_WRITER_URL || 'http://localhost:8000';
  }

  async clusterTopics(inputs: ClusteringInput[]): Promise<ClusteringResult> {
    // Handle empty input
    if (inputs.length === 0) {
      return {
        clusters: [],
        noise: [],
        stats: {
          inputCount: 0,
          clusterCount: 0,
          noiseCount: 0,
          avgClusterSize: 0,
          processingTimeMs: 0,
        },
      };
    }
  }
}
```

**Timeout handling pattern** (lines 99-124):
```typescript
const CLUSTERING_TIMEOUT_MS = 60000;

private async callPythonApi(
  embeddings: number[][]
): Promise<PythonClusterResponse> {
  const url = `${this.apiUrl}/api/clustering/cluster`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeddings,
        min_cluster_size: this.config.minClusterSize,
        min_samples: this.config.minSamples,
      }),
      // CRITICAL: 60s timeout to prevent hanging requests
      signal: AbortSignal.timeout(CLUSTERING_TIMEOUT_MS),
    });
  } catch (error) {
    const cause = (error as any)?.cause?.message || (error as Error).message;
    throw new Error(`Clustering service unavailable: ${cause}. Is the Python clustering service running at ${this.apiUrl}?`);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Clustering API error: ${response.status} - ${error}`);
  }
}
```

---

### `src/db/onpage-mastery-schema.ts` (schema, database)

**Analog:** `src/db/link-schema.ts` + `src/db/voice-schema.ts`

**Schema definition pattern**:
```typescript
import { pgTable, text, integer, jsonb, boolean, timestamp, real, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Client SEO settings (per-client configuration)
export const clientSeoSettings = pgTable("client_seo_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().references(() => clients.id),
  tier5Enabled: boolean("tier5_enabled").notNull().default(false),
  verticalOverride: text("vertical_override"), // Manual vertical classification
  qualityGateTier: text("quality_gate_tier").notNull().default("basic"), // basic | standard | full
  excludedChecks: jsonb("excluded_checks").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vertical classifications (cached by domain + path pattern)
export const verticalClassifications = pgTable("vertical_classifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().references(() => clients.id),
  domain: text("domain").notNull(),
  pathPattern: text("path_pattern").notNull(), // e.g., "/product/*", "/blog/*"
  vertical: text("vertical").notNull(), // 12 verticals
  confidence: real("confidence").notNull(), // 0-1
  isYmyl: boolean("is_ymyl").notNull().default(false),
  method: text("method").notNull(), // schema | url-pattern | client-setting | llm
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 90 days from cachedAt
});

// Semantic chunks (500-token chunks with embeddings)
export const semanticChunks = pgTable("semantic_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: text("content_id").notNull(), // Page ID or content hash
  position: integer("position").notNull(),
  text: text("text").notNull(),
  tokenCount: integer("token_count").notNull(),
  parentHeading: text("parent_heading"),
  embedding: jsonb("embedding").$type<number[]>().notNull(), // 768-dim jina-v5
  tokenScore: real("token_score").notNull(), // 1.0 in range, decay outside
  selfContainmentScore: real("self_containment_score").notNull(),
  headingAlignmentScore: real("heading_alignment_score").notNull(),
  factDensity: real("fact_density").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Page quality scores (Tier 5 quality metrics)
export const pageQualityScores = pgTable("page_quality_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: text("client_id").notNull().references(() => clients.id),
  pageId: text("page_id").notNull(),
  pageUrl: text("page_url").notNull(),
  auditId: uuid("audit_id"),
  vertical: text("vertical").notNull(),
  isYmyl: boolean("is_ymyl").notNull().default(false),
  redditTestScore: real("reddit_test_score"),
  infoGainScore: real("info_gain_score"),
  proveItScore: real("prove_it_score"),
  aiSlopScore: real("ai_slop_score"),
  voiceConsistencyScore: real("voice_consistency_score"),
  toneScore: real("tone_score"),
  overallScore: real("overall_score").notNull(), // 0-100
  blockingFailures: jsonb("blocking_failures").$type<string[]>().default([]),
  passedChecks: jsonb("passed_checks").$type<string[]>().default([]),
  failedChecks: jsonb("failed_checks").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const clientSeoSettingsRelations = relations(clientSeoSettings, ({ one }) => ({
  client: one(clients, {
    fields: [clientSeoSettings.clientId],
    references: [clients.id],
  }),
}));

export const verticalClassificationsRelations = relations(verticalClassifications, ({ one }) => ({
  client: one(clients, {
    fields: [verticalClassifications.clientId],
    references: [clients.id],
  }),
}));

export const pageQualityScoresRelations = relations(pageQualityScores, ({ one }) => ({
  client: one(clients, {
    fields: [pageQualityScores.clientId],
    references: [clients.id],
  }),
}));

// Type exports
export type ClientSeoSettingsInsert = typeof clientSeoSettings.$inferInsert;
export type ClientSeoSettingsSelect = typeof clientSeoSettings.$inferSelect;
export type VerticalClassificationInsert = typeof verticalClassifications.$inferInsert;
export type VerticalClassificationSelect = typeof verticalClassifications.$inferSelect;
export type SemanticChunkInsert = typeof semanticChunks.$inferInsert;
export type SemanticChunkSelect = typeof semanticChunks.$inferSelect;
export type PageQualityScoreInsert = typeof pageQualityScores.$inferInsert;
export type PageQualityScoreSelect = typeof pageQualityScores.$inferSelect;
```

---

## Shared Patterns

### Circuit Breaker + LLM Integration
**Source:** `src/server/features/keywords/classification/GrokClassifier.ts`
**Apply to:** All services with LLM calls (VerticalClassifier, QualityGateService)
```typescript
import { CircuitBreaker, CircuitOpenError } from "@/server/features/keywords/services/CircuitBreaker";
import OpenAI from "openai";

export class ServiceWithLLM {
  private client: OpenAI;
  private circuit: CircuitBreaker;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });

    this.circuit = new CircuitBreaker({
      name: "service-name",
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }

  async callLLM(prompt: string): Promise<Response> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("service-name");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: "grok-4.1-fast-reasoning",
        messages: [
          { role: "system", content: "..." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      this.circuit.recordSuccess();
      return response;
    } catch (error) {
      this.circuit.recordFailure();
      throw error;
    }
  }
}
```

### Zod Schema Validation
**Source:** `src/server/features/keywords/classification/types.ts`
**Apply to:** All LLM response parsing
```typescript
import { z } from "zod";

const ResponseSchema = z.object({
  classifications: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })
  ),
});

// Parse and validate
const parsed = ResponseSchema.safeParse(jsonData);

if (!parsed.success) {
  log.warn("Invalid response schema", { error: parsed.error.message });
  throw new Error(`Invalid response: ${parsed.error.message}`);
}

return parsed.data.classifications;
```

### Redis Caching
**Source:** COST-CONTROL.md caching architecture
**Apply to:** VerticalClassifier, QualityGateService
```typescript
interface CacheConfig {
  redisPrefix: 'tier5:';
  
  keys: {
    vertical: (domain: string, pathPattern: string) => 
      `tier5:vertical:${domain}:${pathPattern}`,
    qualityGate: (pageId: string, contentHash: string) => 
      `tier5:quality:${pageId}:${contentHash}`,
  };
  
  ttls: {
    vertical: 90 * 24 * 60 * 60,      // 90 days
    qualityGate: 30 * 24 * 60 * 60,   // 30 days
  };
}

// Usage
const cacheKey = config.keys.vertical(domain, pathPattern);
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Compute value
const result = await compute();

// Cache with TTL
await redis.setex(cacheKey, config.ttls.vertical, JSON.stringify(result));
```

### Check Registration
**Source:** `src/server/lib/audit/checks/registry.ts`
**Apply to:** All Tier 1 and Tier 5 checks
```typescript
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

registerCheck({
  id: "T1-70",
  name: "Page type detected",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    // Check logic
    const passed = /* ... */;
    
    return {
      checkId: "T1-70",
      passed,
      severity: passed ? "info" : "medium",
      message: "...",
      details: { /* ... */ },
      autoEditable: false,
    };
  },
});
```

### Logger Integration
**Source:** All service files
**Apply to:** All new services
```typescript
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "service-name" });

// Usage
log.info("Operation started", { context });
log.debug("Debug info", { data });
log.warn("Warning condition", { reason });
log.error("Error occurred", { error: error.message });
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/server/features/onpage-mastery/rules/*.ts` (vertical rule packs) | config | data | New domain logic — no existing vertical rule system |
| `src/server/features/onpage-mastery/utils/ContentHasher.ts` | utility | hashing | Specialized content hashing for change detection — follow crypto.createHash pattern |

---

## Metadata

**Analog search scope:** `src/server/features/`, `src/server/lib/audit/checks/`, `src/db/`
**Files scanned:** ~150 TypeScript files
**Pattern extraction date:** 2026-05-06

**Key insights:**
- GrokClassifier provides perfect analog for VerticalClassifier (circuit breaker, Zod validation, batching)
- tier2/content-quality.ts provides exact readability scoring patterns (Flesch, syllable counting)
- tier1/content-structure.ts provides exact check registration pattern
- HDBSCANClusterer provides Python service integration pattern with timeout handling
- link-schema.ts provides database schema pattern with relations
- All services follow singleton pattern with dependency injection
