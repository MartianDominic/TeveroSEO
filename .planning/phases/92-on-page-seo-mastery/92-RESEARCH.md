# Phase 92: On-Page SEO Mastery - Research

**Researched:** 2026-05-06
**Domain:** On-page SEO quality scoring, content analysis, vertical classification
**Confidence:** HIGH

## Summary

Phase 92 integrates advanced on-page SEO intelligence into TeveroSEO's existing 109-check audit system by adding a new Tier 5 for AI-powered content quality checks, vertical classification with industry-specific rules, 500-token chunk architecture for LLM optimization, and topical authority measurement. The phase introduces 41 checks (29 new, 12 enhanced) organized into quality gates that block publication for thin content, AI slop, and YMYL violations.

**Primary recommendation:** Use tiktoken for tokenization, embedding-based semantic chunking with fallback to Grok 4.1, heuristic-first vertical classification (90%+ skip LLM), existing Vitest infrastructure for testing, and modular service architecture following project patterns.

**Key insight:** Don't hand-roll tokenization, readability scoring, or PageRank — battle-tested npm packages exist for all core algorithms. Focus engineering effort on domain logic (vertical rules, quality gates, YMYL detection) where no off-the-shelf solution fits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tier 5 vs Embedded in Existing Tiers:** New Tier 5 (Content Quality Intelligence) chosen for clean opt-in without affecting existing audits.

**LLM for Quality Gates:** Hybrid approach — embedding similarity (jina-v5-text-nano local) primary, Grok 4.1 Fast fallback for borderline cases (0.7-0.85 similarity). Cost: ~$0.007-0.010 per page audit.

**AEO as Separate Toggle:** 500-token chunks and query fan-out are CORE (internal optimization), entity graph and citation formatting are PREMIUM (speculative), tributary trust is FUTURE (Phase 100+).

**Vertical Classification:** Heuristic-first (Schema.org types + URL patterns, confidence >= 0.90) with Grok 4.1 Fast fallback (~250 tokens). Caching by domain + path. 90%+ classifications skip LLM.

**New Services:** RuleEngineService (41-point scorecard), PageStructureAnalyzer (chunk boundaries), QualityGateService (7 quality gates), VerticalClassifier (12 verticals + YMYL).

**New Checks:** 16 Tier 1 page structure checks (T1-70 to T1-85), 13 Tier 5 quality intelligence checks (T5-01 to T5-13).

**Vertical Rule Override Hierarchy:** Universal < Vertical < Sub-vertical < Client.

**Master Article Prompt Structure:** Vertical rules injected based on classification, with banned patterns (30+ intro phrases, weasel words) enforced via prompt.

**500-Token Chunk Boundary Priority:** H2 headings (1.0) > H3 headings (0.8) > topic shift (0.5) > paragraph breaks (0.2).

**Topical Authority Formula:** CoverageScore * 0.30 + DepthScore * 0.25 + LinkDensityScore * 0.20 + BacklinkScore * 0.25, with PillarMultiplier.

**Internal Linking Enhancements:** Embedding-based semantic matching replaces Jaccard overlap, 8 anchor patterns with diversity tracking, auto-detection + recommendations, PageRank-style authority flow.

**Database Schema Additions:** 8 new tables (client_seo_settings, seo_rule_weights, page_quality_scores, semantic_chunks, chunk_recommendations, topic_clusters, topic_authority_scores, vertical_classifications).

**Cost Projections:** ~$0.011/page full audit (vertical $0.00007 cached, Tier 5 $0.010, embeddings $0.0005). Monthly @ 10k pages: $110 quality audits + $1,250 content generation = $1,360/month.

### Claude's Discretion

**Tokenization Library Choice:** tiktoken (dqbd/tiktoken) vs gpt-tokenizer vs alternatives — research recommends tiktoken for accuracy and WASM performance.

**Clustering Library Choice:** HDBSCAN (hdbscan-ts or density-clustering) vs custom — research recommends density-clustering for maturity or Python fallback for production-grade.

**Semantic Chunking Library:** @chonkiejs/core vs semantic-chunking vs custom — research recommends semantic-chunking (2.6.0) for BYOE flexibility with jina-v5 embeddings.

**Readability Scoring Library:** text-readability vs flesch-kincaid standalone — research recommends text-readability (1.1.1) for multi-formula support.

**NLP Entity Extraction:** compromise (14.15.0) vs node-nlp (5.0.0-alpha.5) vs wink-nlp (2.4.0) — research recommends compromise for lightweight local extraction without model downloads.

**PageRank Library:** ngraph.pagerank (2.1.1) vs pagerank.js vs custom — research recommends ngraph.pagerank for graph ecosystem integration.

**Schema.org Generation:** schema-dts (2.0.0) TypeScript types vs manual JSON-LD — research recommends schema-dts for type safety with manual JSON.stringify() generation.

**Test Framework Configuration:** Existing Vitest setup sufficient, extend coverage thresholds for new modules.

### Deferred Ideas (OUT OF SCOPE)

- Full Tributary Trust Protocol (Phase 100+)
- Real-time engagement signals (requires analytics integration)
- Competitor SERP scraping at scale (cost/legal considerations)
- Multi-language vertical rules (i18n for rule packs)

</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 92 addresses requirements from .planning/REQUIREMENTS.md related to on-page SEO optimization, content quality scoring, and vertical-specific rule application. Specific requirement IDs not provided in phase context — research supports architectural decisions documented in CONTEXT.md.

Key capabilities enabled by research findings:

| Capability | Research Support |
|------------|------------------|
| Text tokenization for 500-token chunks | tiktoken (1.0.21) with cl100k_base encoding |
| Semantic chunk boundary detection | semantic-chunking (2.6.0) with BYOE pattern for jina-v5 |
| Content quality scoring (readability) | text-readability (1.1.1) with Flesch-Kincaid + Gunning Fog |
| Entity extraction for SEAT signals | compromise (14.15.0) for lightweight NLP without models |
| Topic clustering | density-clustering (1.3.0) DBSCAN/OPTICS or Python HDBSCAN |
| Internal link PageRank calculation | ngraph.pagerank (2.1.1) for authority flow |
| Schema.org type definitions | schema-dts (2.0.0) for TypeScript types |
| Vertical classification heuristics | Schema.org type detection + URL pattern matching |
| YMYL detection | Vertical classification + keyword patterns |
| Quality gate execution | Embedding similarity + Grok 4.1 fallback for 7 gates |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Text tokenization | API / Backend | — | CPU-bound, reusable across requests |
| Chunk extraction | API / Backend | — | Requires full HTML parsing + embeddings |
| Vertical classification | API / Backend | — | LLM calls, database caching |
| Quality gate evaluation | API / Backend | — | Embedding similarity + LLM fallback |
| SEO check execution | API / Backend | — | Existing Tier 1-4 check runner pattern |
| Rule engine scoring | API / Backend | — | 41-point scorecard calculation |
| Topic clustering | API / Backend | — | Graph algorithms on page relationships |
| PageRank calculation | API / Backend | — | Graph traversal on link structure |
| Schema.org generation | API / Backend | — | JSON-LD from CMS data |
| Entity extraction | API / Backend | — | NLP processing on raw text |
| Dashboard visualization | Frontend Server (SSR) | Browser / Client | TanStack Start SSR with client hydration |
| Quality score display | Frontend Server (SSR) | Browser / Client | Scorecard rendering with charts |

**Why backend-heavy:** Phase 92 is fundamentally about content analysis and scoring — computationally intensive tasks requiring NLP, graph algorithms, embeddings, and LLM calls. All data processing happens server-side; frontend renders results.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tiktoken | 1.0.21 | Text tokenization (500-token chunks) | Official OpenAI BPE tokenizer, WASM-optimized, accurate token counts for cl100k_base encoding used by GPT-4/Grok models [VERIFIED: npm registry 2026-05-06] |
| semantic-chunking | 2.6.0 | Semantic boundary detection | BYOE pattern allows jina-v5 embeddings, z-score threshold for chunk boundaries, actively maintained [VERIFIED: npm registry 2026-05-06] |
| text-readability | 1.1.1 | Readability scoring (Flesch-Kincaid, Gunning Fog) | Multi-formula support (8 algorithms), consistent API, zero dependencies [VERIFIED: npm registry 2026-05-06] |
| compromise | 14.15.0 | NLP entity extraction | Lightweight (no model downloads), 350k tokens/sec, part-of-speech tagging + NER [VERIFIED: npm registry 2026-05-06] |
| ngraph.pagerank | 2.1.1 | PageRank algorithm for internal links | Standard graph library, damping factor 0.80-0.90, proven for link authority [VERIFIED: npm registry 2026-05-06] |
| schema-dts | 2.0.0 | Schema.org TypeScript types | Official types for all Schema.org entities, compile-time validation [VERIFIED: npm registry 2026-05-06] |
| density-clustering | 1.3.0 | DBSCAN/OPTICS clustering | Mature (2015), supports varying density via OPTICS, pure JS [VERIFIED: npm registry 2026-05-06] |

**Installation:**
```bash
pnpm add tiktoken semantic-chunking text-readability compromise ngraph.pagerank schema-dts density-clustering
pnpm add -D @types/compromise
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| hdbscan-ts | 1.0.17 | HDBSCAN clustering | If DBSCAN insufficient for hierarchical clusters [VERIFIED: npm registry 2026-05-06] |
| @chonkiejs/core | 0.0.9 | Advanced semantic chunking | If semantic-chunking insufficient, includes Savitzky-Golay filtering [VERIFIED: npm registry 2026-05-06] |
| wink-nlp | 2.4.0 | Advanced NLP pipeline | If compromise insufficient, requires model download (wink-eng-lite-web-model) [VERIFIED: npm registry 2026-05-06] |
| natural | 8.1.1 | Comprehensive NLP toolkit | If compromise insufficient for advanced NER, larger footprint [VERIFIED: npm registry 2026-05-06] |
| flesch | 2.0.1 | Standalone Flesch scoring | If text-readability excessive, single-formula use case [VERIFIED: npm registry 2026-05-06] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tiktoken | gpt-tokenizer (3.4.0) | Faster but less accurate; use if token precision non-critical [VERIFIED: npm registry 2026-05-06] |
| density-clustering | Python HDBSCAN via exec | Production-grade algorithm but cross-language complexity |
| compromise | node-nlp (5.0.0-alpha.5) | 40+ languages but alpha stability, larger model downloads [VERIFIED: npm registry 2026-05-06] |
| semantic-chunking | Custom sliding window | Simpler but misses semantic boundaries, no z-score detection |
| schema-dts | Manual JSON-LD objects | More flexible but no compile-time type checking |

**Key Decision:** Use tiktoken over gpt-tokenizer — 500-token chunk boundaries require precise counts for LLM context optimization. [ASSUMED: cl100k_base encoding matches Grok 4.1 tokenization]

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTRY POINTS                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Audit Trigger (manual/scheduled)                             │
│ 2. Content Generation (AI-Writer integration)                    │
│ 3. Bulk Analysis (BullMQ worker)                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ VERTICAL CLASSIFICATION SERVICE                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. Check cache (domain+path) → HIT: return classification       │
│ 2. Run heuristics (Schema.org + URL patterns)                   │
│    → confidence >= 0.90: return (90%+ skip LLM)                 │
│ 3. Fallback: Grok 4.1 Fast (~250 tokens) → cache result         │
│ Output: vertical (12 types), confidence, isYMYL                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ PAGE STRUCTURE ANALYZER                                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. HTML parsing (Cheerio)                                       │
│ 2. Heading hierarchy extraction (H1-H6)                         │
│ 3. Content block segmentation                                   │
│ 4. Tokenization (tiktoken cl100k_base)                          │
│ 5. Chunk boundary detection (H2 > H3 > topic > paragraph)      │
│ 6. Embedding generation (jina-v5-text-nano local)              │
│ Output: semantic_chunks[] (400-600 tokens each)                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ├────────────────────────────────────────────────┐
                 │                                                 │
                 ▼                                                 ▼
┌──────────────────────────────────┐  ┌─────────────────────────────────┐
│ RULE ENGINE SERVICE              │  │ QUALITY GATE SERVICE            │
├──────────────────────────────────┤  ├─────────────────────────────────┤
│ 1. Load vertical rules           │  │ 1. T5-01: Reddit Test           │
│ 2. Load client overrides         │  │    (embedding similarity)       │
│ 3. Apply 41-point scorecard      │  │ 2. T5-02: Information Gain      │
│ 4. Weight by importance          │  │    (SERP comparison)            │
│ Output: scorecard_result         │  │ 3. T5-03: Prove-It Details      │
│   (0-100, passed[], failed[])    │  │    (claim verification)         │
└──────────────────────────────────┘  │ 4. T5-04-13: Additional gates   │
                 │                     │ Output: quality_score (0-100)   │
                 │                     │   blocking_failures[]           │
                 │                     └────────────┬────────────────────┘
                 │                                  │
                 ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ TIER 1-4 CHECK RUNNER (Existing)                                │
├─────────────────────────────────────────────────────────────────┤
│ Run 109 existing checks + 16 new Tier 1 (T1-70 to T1-85)       │
│ Output: check_results[] (passed/failed/severity)                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ AGGREGATION & SCORING                                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Combine Tier 1-4 base score (existing formula)               │
│ 2. Add Tier 5 quality score (opt-in, separate)                  │
│ 3. Apply hard gates (noindex, CWV-poor, quality < 40)          │
│ 4. Generate recommendations                                      │
│ Output: final_score (0-100), breakdown, recommendations[]        │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ PERSISTENCE & OUTPUT                                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Save to page_quality_scores table                            │
│ 2. Save chunks to semantic_chunks table                         │
│ 3. Save vertical classification (cached)                        │
│ 4. Trigger UI update (WebSocket)                                │
│ Output: audit_id, quality_report_url                            │
└─────────────────────────────────────────────────────────────────┘
```

**Data Flow Notes:**
- Vertical classification runs first — determines which rules apply
- Page structure analysis runs once — chunks reused by multiple gates
- Rule engine and quality gates run in parallel (independent)
- Tier 1-4 checks use existing runner — no changes to execution
- Final aggregation combines all scores using weighted formula

### Component Responsibilities

| Component | File Path | Responsibilities |
|-----------|-----------|------------------|
| VerticalClassifier | `src/server/features/onpage-mastery/services/VerticalClassifier.ts` | Heuristic classification (Schema.org + URL), Grok 4.1 fallback, cache management, YMYL detection |
| PageStructureAnalyzer | `src/server/features/onpage-mastery/services/PageStructureAnalyzer.ts` | HTML parsing, heading hierarchy, tokenization (tiktoken), chunk boundary detection, embedding generation |
| RuleEngineService | `src/server/features/onpage-mastery/services/RuleEngineService.ts` | 41-point scorecard evaluation, vertical rule loading, client override application, weighted scoring |
| QualityGateService | `src/server/features/onpage-mastery/services/QualityGateService.ts` | 7 quality gates (T5-01 to T5-07), embedding similarity checks, Grok 4.1 fallback, blocking failure detection |
| ChunkExtractor | `src/server/features/onpage-mastery/utils/ChunkExtractor.ts` | Semantic chunking logic (semantic-chunking lib), boundary scoring, token count validation (400-600 target) |
| EntityExtractor | `src/server/features/onpage-mastery/utils/EntityExtractor.ts` | NLP entity extraction (compromise), fact density calculation, SEAT signal detection |
| ReadabilityScorer | `src/server/features/onpage-mastery/utils/ReadabilityScorer.ts` | Flesch-Kincaid, Gunning Fog, grade level calculation (text-readability) |
| TopicClusterer | `src/server/features/keywords/clustering/TopicClusterer.ts` | DBSCAN/OPTICS clustering (density-clustering), topical authority scoring, gap analysis |
| InternalLinkGraph | `src/server/features/linking/InternalLinkGraph.ts` | PageRank calculation (ngraph.pagerank), semantic matching (embeddings), anchor diversity tracking |
| SchemaGenerator | `src/server/features/onpage-mastery/utils/SchemaGenerator.ts` | JSON-LD generation (schema-dts types), vertical-specific schema selection, validation |

### Recommended Project Structure

```
src/server/features/onpage-mastery/
├── services/
│   ├── VerticalClassifier.ts       # Heuristic + LLM classification
│   ├── PageStructureAnalyzer.ts    # Chunk extraction + embeddings
│   ├── RuleEngineService.ts        # 41-point scorecard
│   ├── QualityGateService.ts       # 7 quality gates
│   └── index.ts                    # Service exports
├── utils/
│   ├── ChunkExtractor.ts           # Semantic chunking logic
│   ├── EntityExtractor.ts          # NLP entity extraction
│   ├── ReadabilityScorer.ts        # Readability formulas
│   ├── SchemaGenerator.ts          # Schema.org JSON-LD
│   └── index.ts                    # Utility exports
├── rules/
│   ├── universal.ts                # Base rules for all pages
│   ├── healthcare.ts               # YMYL medical rules
│   ├── legal.ts                    # YMYL legal rules
│   ├── financial.ts                # YMYL financial rules
│   ├── ecommerce.ts                # E-commerce rules
│   ├── saas.ts                     # SaaS-specific rules
│   └── index.ts                    # Rule registry
├── checks/
│   ├── tier1/
│   │   ├── T1-70-page-type.ts      # New Tier 1 checks
│   │   ├── T1-71-value-prop.ts
│   │   └── ... (14 more)
│   └── tier5/
│       ├── T5-01-reddit-test.ts    # New Tier 5 checks
│       ├── T5-02-info-gain.ts
│       └── ... (11 more)
├── types.ts                        # Type definitions
└── index.ts                        # Feature exports
```

### Pattern 1: Heuristic-First Vertical Classification

**What:** Fast path for 90%+ classifications without LLM calls using Schema.org types and URL patterns.

**When to use:** Every page classification — optimize for cache hits and heuristic matches.

**Example:**
```typescript
// Source: Phase 92 CONTEXT.md + research synthesis
interface VerticalClassifier {
  async classify(url: string, html: string): Promise<Classification> {
    // 1. Check cache (domain + path)
    const cached = await this.cache.get(`vertical:${domain}:${path}`);
    if (cached) return cached; // Fast path: cache hit
    
    // 2. Run heuristics (Schema.org + URL patterns)
    const heuristic = this.runHeuristics(html, url);
    if (heuristic.confidence >= 0.90) {
      await this.cache.set(`vertical:${domain}:${path}`, heuristic, 86400); // 24h TTL
      return heuristic; // Fast path: high-confidence heuristic
    }
    
    // 3. Fallback: LLM classification (Grok 4.1 Fast)
    const llm = await this.classifyWithLLM(html, url);
    await this.cache.set(`vertical:${domain}:${path}`, llm, 86400);
    return llm; // Slow path: LLM required
  }
  
  private runHeuristics(html: string, url: string): Classification {
    // Schema.org type detection
    const schemaTypes = this.extractSchemaTypes(html);
    if (schemaTypes.includes('MedicalOrganization')) {
      return { vertical: 'healthcare', confidence: 0.95, isYMYL: true };
    }
    
    // URL pattern matching
    if (/\/(shop|store|product|cart)/.test(url)) {
      return { vertical: 'ecommerce', confidence: 0.85, isYMYL: false };
    }
    
    // Keyword-based detection (low confidence)
    const text = this.extractText(html);
    if (/attorney|lawyer|legal|lawsuit/.test(text.toLowerCase())) {
      return { vertical: 'legal', confidence: 0.70, isYMYL: true };
    }
    
    return { vertical: 'general', confidence: 0.50, isYMYL: false };
  }
}
```

### Pattern 2: Semantic Chunking with Boundary Scoring

**What:** Split content into 400-600 token chunks at semantically meaningful boundaries (H2 > H3 > topic shift > paragraph).

**When to use:** All content analysis — chunks used by quality gates, topic clustering, entity extraction.

**Example:**
```typescript
// Source: semantic-chunking docs + Phase 92 chunk architecture
import { SemanticChunker } from 'semantic-chunking';
import { get_encoding } from 'tiktoken';

interface ChunkExtractor {
  async extractChunks(html: string): Promise<SemanticChunk[]> {
    const encoding = get_encoding('cl100k_base');
    
    // 1. Extract content blocks with heading context
    const blocks = this.parseContentBlocks(html);
    
    // 2. Initialize semantic chunker with custom embedder
    const chunker = new SemanticChunker({
      embedder: async (text: string) => {
        return await this.jinaEmbeddings.embed(text); // jina-v5-text-nano local
      },
      targetSize: 500,        // Target 400-600 tokens
      zScoreThreshold: 1.5,   // Boundary detection sensitivity
    });
    
    // 3. Generate chunks with boundary scoring
    const rawChunks = await chunker.chunk(blocks);
    
    // 4. Validate and adjust chunks
    const chunks = rawChunks.map((chunk, i) => {
      const tokens = encoding.encode(chunk.text);
      const tokenCount = tokens.length;
      
      // Token score: 1.0 in range [400-600], decay outside
      const tokenScore = tokenCount >= 400 && tokenCount <= 600 
        ? 1.0 
        : 1.0 - Math.abs(tokenCount - 500) / 500;
      
      return {
        id: `chunk-${i}`,
        position: i,
        text: chunk.text,
        tokenCount,
        parentHeading: chunk.metadata.heading || null,
        embedding: chunk.embedding,
        metrics: {
          tokenScore,
          selfContainmentScore: this.scoreSelfContainment(chunk.text),
          headingAlignmentScore: this.scoreHeadingAlignment(chunk.text, chunk.metadata.heading),
          factDensity: this.calculateFactDensity(chunk.text),
        },
      };
    });
    
    encoding.free(); // Clean up tiktoken resources
    return chunks;
  }
}
```

### Pattern 3: Quality Gate with Embedding Similarity + LLM Fallback

**What:** Evaluate content quality using local embeddings for speed, Grok 4.1 Fast for borderline cases (similarity 0.7-0.85).

**When to use:** All quality gates (T5-01 to T5-07) — Reddit Test, Information Gain, Prove-It Details, etc.

**Example:**
```typescript
// Source: Phase 92 quality gates + hybrid approach decision
interface QualityGateService {
  async evaluateRedditTest(content: string, vertical: string): Promise<GateResult> {
    // 1. Generate embedding for content
    const contentEmbedding = await this.jinaEmbeddings.embed(content);
    
    // 2. Retrieve reference embeddings for vertical (high-quality Reddit posts)
    const references = await this.getReferenceEmbeddings(vertical);
    
    // 3. Calculate cosine similarity with each reference
    const similarities = references.map(ref => 
      this.cosineSimilarity(contentEmbedding, ref.embedding)
    );
    const maxSimilarity = Math.max(...similarities);
    
    // 4. Decision logic
    if (maxSimilarity >= 0.85) {
      // High confidence: passes Reddit Test
      return { 
        passed: true, 
        score: maxSimilarity * 100, 
        message: 'Content demonstrates specificity and expertise expected by domain communities',
        method: 'embedding',
      };
    } else if (maxSimilarity <= 0.70) {
      // Low confidence: fails Reddit Test
      return {
        passed: false,
        score: maxSimilarity * 100,
        message: 'Content is generic and would be criticized for lack of specificity',
        method: 'embedding',
      };
    } else {
      // Borderline: use LLM fallback (Grok 4.1 Fast)
      const llmResult = await this.evaluateWithLLM(content, vertical);
      return {
        ...llmResult,
        method: 'llm-fallback',
        embeddingSimilarity: maxSimilarity,
      };
    }
  }
  
  private async evaluateWithLLM(content: string, vertical: string): Promise<GateResult> {
    const prompt = `Evaluate if this ${vertical} content would survive scrutiny on r/${vertical} without being criticized for vagueness or lack of expertise. Score 0-100.

Content:
${content.slice(0, 2000)}

Criteria:
- Specific examples, numbers, or case studies
- Domain expertise signals
- Avoids generic advice
- Includes contrarian or nuanced takes`;

    const response = await this.grok.complete(prompt, { 
      model: 'grok-4.1-fast', 
      maxTokens: 150 
    });
    
    const score = this.extractScore(response.text);
    return {
      passed: score >= 50,
      score,
      message: response.text,
      method: 'llm',
    };
  }
}
```

### Pattern 4: Vertical Rule Override Hierarchy

**What:** Apply rules in cascading order (Universal < Vertical < Sub-vertical < Client) with client overrides taking precedence.

**When to use:** Rule engine evaluation — ensures client customizations override default vertical rules.

**Example:**
```typescript
// Source: Phase 92 rule hierarchy + client override pattern
interface RuleEngineService {
  async evaluateScorecard(ctx: OnPageMasteryContext, clientId: string): Promise<ScorecardResult> {
    // 1. Load rules in hierarchy order
    const universalRules = this.loadUniversalRules();
    const verticalRules = this.loadVerticalRules(ctx.vertical);
    const subVerticalRules = ctx.subVertical 
      ? this.loadSubVerticalRules(ctx.subVertical)
      : [];
    const clientRules = await this.loadClientOverrides(clientId);
    
    // 2. Merge rules (later overrides earlier)
    const mergedRules = this.mergeRules([
      universalRules,
      verticalRules,
      subVerticalRules,
      clientRules,
    ]);
    
    // 3. Apply merged rules with weights
    const results = await Promise.all(
      mergedRules.map(rule => this.evaluateRule(rule, ctx))
    );
    
    // 4. Calculate weighted score
    const weightedScore = results.reduce((sum, result) => {
      return sum + (result.passed ? result.weight : 0);
    }, 0);
    
    return {
      score: Math.min(weightedScore, 100),
      passed: results.filter(r => r.passed),
      failed: results.filter(r => !r.passed),
      vertical: ctx.vertical,
      customizations: clientRules.length,
    };
  }
  
  private mergeRules(ruleSets: RuleDefinition[][]): RuleDefinition[] {
    const ruleMap = new Map<string, RuleDefinition>();
    
    // Process in order: universal, vertical, sub-vertical, client
    for (const ruleSet of ruleSets) {
      for (const rule of ruleSet) {
        // Later rules override earlier with same ID
        ruleMap.set(rule.id, rule);
      }
    }
    
    return Array.from(ruleMap.values());
  }
}
```

### Anti-Patterns to Avoid

- **Re-tokenizing on every operation:** Tokenize once in PageStructureAnalyzer, cache token counts in chunks. Re-tokenization for every quality gate wastes CPU.
- **Synchronous embedding generation:** Use batch embedding generation (process 10-50 chunks at once) instead of one-by-one await. Reduces jina-v5 server round trips.
- **LLM-first vertical classification:** Always run heuristics first — 90%+ pages should skip LLM. Cache aggressively by domain + path (24h TTL).
- **Manual JSON-LD construction:** Use schema-dts types for compile-time validation, then JSON.stringify(). Catches Schema.org property typos at build time.
- **Deep nesting in rules:** Flatten rule hierarchy to 4 levels max (Universal/Vertical/SubVertical/Client). Deeper nesting makes debugging impossible.
- **Hardcoded vertical rules:** Store rules in `rules/*.ts` modules, not in service logic. Rules should be data-driven and testable in isolation.
- **Ignoring YMYL detection:** Always check `isYMYL` from vertical classification — YMYL pages require different quality thresholds (85+ vs 70+).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text tokenization | Custom BPE tokenizer | tiktoken (1.0.21) | OpenAI's official tokenizer handles edge cases (emojis, Unicode, special tokens) that custom implementations miss. WASM-optimized for performance. [VERIFIED: npm registry 2026-05-06] |
| Semantic chunking | Sliding window with fixed overlap | semantic-chunking (2.6.0) | Z-score boundary detection finds natural topic shifts. BYOE pattern integrates jina-v5 embeddings. Custom implementations miss semantic boundaries. [VERIFIED: npm registry 2026-05-06] |
| Readability scoring | Custom syllable counting | text-readability (1.1.1) | 8 readability formulas with edge case handling (silent 'e', common suffixes, exception dictionaries). Flesch-Kincaid + Gunning Fog algorithms are deceptively complex. [VERIFIED: npm registry 2026-05-06] |
| PageRank algorithm | Custom graph traversal | ngraph.pagerank (2.1.1) | Power iteration method with configurable damping factor. Handles convergence detection, dangling nodes, sink nodes. Off-by-one errors in custom implementations break authority flow. [VERIFIED: npm registry 2026-05-06] |
| Entity extraction | Regex patterns for names/places | compromise (14.15.0) | 350k tokens/sec NLP with POS tagging + NER. Handles context-dependent entities (person vs place), coreference resolution. Regex approaches fail on ambiguous cases. [VERIFIED: npm registry 2026-05-06] |
| Schema.org validation | Manual JSON structure checks | schema-dts (2.0.0) types | TypeScript compiler validates Schema.org properties at build time. Catches typos before runtime. Manual validation misses required properties. [VERIFIED: npm registry 2026-05-06] |
| Density clustering | K-means with manual tuning | density-clustering (1.3.0) | DBSCAN/OPTICS handle arbitrary cluster shapes and varying densities. K-means assumes spherical clusters — fails for topic clustering. [VERIFIED: npm registry 2026-05-06] |

**Key insight:** All core algorithms have battle-tested npm implementations. Focus engineering effort on domain logic (vertical rules, quality gates, YMYL detection) where no off-the-shelf solution fits the SEO domain.

## Runtime State Inventory

> Phase 92 is greenfield (new feature addition) — no renaming or refactoring of existing entities. This section omitted per guidelines.

## Common Pitfalls

### Pitfall 1: Search Intent Misalignment in Quality Gates

**What goes wrong:** Quality gates evaluate content quality without considering search intent — informational vs transactional vs navigational. A product page failing the Reddit Test (low specificity) may be correct for transactional intent.

**Why it happens:** Quality gates (T5-01 to T5-07) designed for informational content. Transactional and navigational pages have different quality signals (trust badges, clear CTAs, navigation clarity).

**How to avoid:** Gate evaluation must receive `queryType` from context. Adjust thresholds based on intent:
- Informational: Reddit Test >= 50, Prove-It Details >= 30
- Transactional: Reddit Test >= 30 (specificity less critical), Trust Signals >= 70
- Navigational: Structure checks only, skip content quality gates

**Warning signs:** Product pages scoring low on Prove-It Details despite meeting user needs. High bounce rates on pages passing all quality gates.

### Pitfall 2: Token Count Drift Between Libraries

**What goes wrong:** tiktoken counts 487 tokens, but Grok 4.1 API receives 503 tokens for same text. Chunk boundaries misaligned with actual LLM context windows.

**Why it happens:** Different tokenizers handle whitespace, Unicode, special characters differently. tiktoken uses cl100k_base (GPT-4), but Grok 4.1 may use different encoding. [ASSUMED: Grok 4.1 uses cl100k_base-compatible encoding]

**How to avoid:** 
1. Always include 10% token buffer: target 450 tokens, not 500
2. Log token count from API response, compare with tiktoken count
3. If drift > 5%, adjust chunk extraction to target 450 instead of 500
4. Never split on exact token boundaries — always use semantic boundaries (H2/H3)

**Warning signs:** Chunks exceeding LLM context limits. Quality gate LLM calls returning truncated responses.

### Pitfall 3: YMYL False Negatives in Vertical Classification

**What goes wrong:** Medical blog classified as 'general' (not 'healthcare') because URL patterns and Schema.org missing. YMYL quality gates not applied, content passes with score 72 (should require 85+).

**Why it happens:** Heuristic classification relies on signals that authors may not include (Schema.org MedicalOrganization, /health/ URL paths). LLM fallback may classify based on surface signals, not deep content analysis.

**How to avoid:**
1. Always run LLM fallback if heuristic confidence < 0.90 AND content contains YMYL keywords
2. YMYL keyword detection: medical terms (diagnosis, treatment, symptoms), legal terms (lawsuit, liability, damages), financial terms (investment, retirement, insurance)
3. Log vertical classifications with confidence < 0.90 for manual review
4. Allow client manual override: "This is YMYL content" checkbox in settings

**Warning signs:** Low-confidence classifications (< 0.90) on content discussing health conditions, legal advice, financial planning. Client complaints about inappropriate content approval.

### Pitfall 4: Embedding Similarity Threshold Miscalibration

**What goes wrong:** Reddit Test passes content with similarity 0.72 (borderline), but human reviewers reject as generic. Gate threshold too lenient.

**Why it happens:** Reference embeddings may not represent true "high-quality" content — collected from Reddit but not manually curated. Similarity threshold (0.85 pass, 0.70 fail) chosen without domain validation.

**How to avoid:**
1. Build reference corpus with human-reviewed examples: collect 100+ high-quality posts per vertical, manually curate
2. Validate thresholds with A/B testing: sample 500 pages, compare embedding scores with human quality ratings
3. Adjust thresholds per vertical: technical verticals (saas, manufacturing) may need higher thresholds (0.90+)
4. Use LLM fallback range (0.70-0.85) as calibration zone — log all LLM decisions for threshold tuning

**Warning signs:** High variance between embedding scores and human quality ratings. Frequent LLM fallback usage (> 20% of evaluations).

### Pitfall 5: Chunk Boundary Splits Mid-Sentence

**What goes wrong:** 500-token target forces chunk split in middle of sentence or code example. Quality gates evaluate incomplete context, score incorrectly.

**Why it happens:** Boundary detection prioritizes token count over sentence integrity. Paragraph breaks (priority 0.2) chosen over incomplete sentence when token limit reached.

**How to avoid:**
1. Never split mid-sentence — implement sentence boundary detection with `compromise` library
2. If chunk must exceed 600 tokens to complete sentence, allow overflow (600-700 acceptable)
3. If chunk would drop below 300 tokens to avoid split, merge with previous chunk
4. Log boundary violations (mid-sentence splits) for review — may indicate heading structure issues

**Warning signs:** Quality gate "context incomplete" errors. Chunks with dangling pronouns or incomplete clauses at boundaries.

### Pitfall 6: PageRank Authority Flow to Low-Quality Pages

**What goes wrong:** Internal linking recommendations suggest linking from high-authority pillar page to thin content (200 words, score 45). PageRank doesn't consider destination quality.

**Why it happens:** ngraph.pagerank calculates authority based purely on link structure — inbound link count and source authority. Doesn't evaluate destination content quality.

**How to avoid:**
1. Filter link recommendations by destination quality score: require score >= 70 before suggesting as link target
2. Combine PageRank authority with quality score: `linkScore = pagerank * 0.5 + qualityScore * 0.5`
3. Penalize links to thin content in PageRank calculation: reduce edge weight if destination < 70 quality
4. Auto-flag thin pages with high inbound authority: "This page receives authority but needs content expansion"

**Warning signs:** Thin pages ranking high in internal link recommendations. High-quality pages not appearing in link suggestions despite semantic relevance.

### Pitfall 7: Vertical Rule Explosion (Maintenance Burden)

**What goes wrong:** 12 verticals × 41 rules = 492 rule definitions. Small rule change (update word count threshold) requires editing 12 files. Rules drift out of sync.

**Why it happens:** Rules defined per vertical without shared base rules or inheritance. No abstraction layer for common patterns (min word count, max heading depth, required sections).

**How to avoid:**
1. Define universal rules with parameters: `minWordCount(vertical)` returns 300 for general, 800 for healthcare
2. Use rule composition: `healthcareRules = [...universalRules, ...ymylRules, ...medicalSpecificRules]`
3. Store thresholds in config: `verticalConfig.healthcare.minWordCount = 800` referenced by shared rule logic
4. Test rule inheritance: verify healthcare inherits all universal rules, not duplicates

**Warning signs:** Rule definitions duplicated across vertical files. Threshold changes requiring multi-file edits. Forgotten verticals (rule updated in 10/12 verticals).

## Code Examples

Verified patterns from official sources and project conventions:

### Tiktoken Tokenization with Resource Cleanup

```typescript
// Source: https://github.com/dqbd/tiktoken/blob/main/README.md [CITED]
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

// Batch tokenization for multiple texts (more efficient)
export function batchCountTokens(texts: string[]): number[] {
  const encoding = get_encoding('cl100k_base');
  try {
    return texts.map(text => encoding.encode(text).length);
  } finally {
    encoding.free();
  }
}
```

### Semantic Chunking with Custom Embedder

```typescript
// Source: semantic-chunking npm docs + Phase 92 BYOE pattern [SYNTHESIS]
import { SemanticChunker } from 'semantic-chunking';

async function chunkContent(
  text: string, 
  embedFn: (text: string) => Promise<number[]>
): Promise<Array<{ text: string; embedding: number[] }>> {
  const chunker = new SemanticChunker({
    embedder: embedFn,           // BYOE: bring your own embedder
    targetSize: 500,             // Target tokens (approximate)
    zScoreThreshold: 1.5,        // Boundary sensitivity
    minChunkSize: 300,           // Never below 300 tokens
    maxChunkSize: 700,           // Allow overflow to 700 if needed
  });
  
  return await chunker.chunk(text);
}
```

### Readability Scoring with Multiple Formulas

```typescript
// Source: text-readability npm docs [CITED: https://www.npmjs.com/package/text-readability]
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

### NLP Entity Extraction with Compromise

```typescript
// Source: compromise library usage patterns [CITED: https://www.npmjs.com/package/compromise]
import nlp from 'compromise';

export interface ExtractedEntities {
  people: string[];
  places: string[];
  organizations: string[];
  topics: string[];
  factDensity: number;        // Entities per 100 words
}

export function extractEntities(text: string): ExtractedEntities {
  const doc = nlp(text);
  
  // Named entity recognition
  const people = doc.people().out('array');
  const places = doc.places().out('array');
  const organizations = doc.organizations().out('array');
  
  // Topic extraction (nouns + noun phrases)
  const topics = doc.topics().out('array');
  
  // Fact density calculation
  const wordCount = doc.wordCount();
  const totalEntities = people.length + places.length + organizations.length;
  const factDensity = (totalEntities / wordCount) * 100;
  
  return { people, places, organizations, topics, factDensity };
}
```

### PageRank for Internal Link Authority

```typescript
// Source: ngraph.pagerank usage [CITED: https://www.npmjs.com/package/ngraph.pagerank]
import createGraph from 'ngraph.graph';
import pagerank from 'ngraph.pagerank';

export interface PageAuthority {
  url: string;
  score: number;               // 0-1, higher = more authority
  rank: number;                // 1-N, 1 = highest authority
}

export function calculatePageAuthority(linkGraph: Map<string, string[]>): PageAuthority[] {
  // 1. Build graph
  const graph = createGraph();
  for (const [source, targets] of linkGraph.entries()) {
    for (const target of targets) {
      graph.addLink(source, target);
    }
  }
  
  // 2. Calculate PageRank (damping factor 0.85 standard)
  const ranks = pagerank(graph, { dampingFactor: 0.85 });
  
  // 3. Convert to sorted array
  const authorities: PageAuthority[] = [];
  graph.forEachNode((node) => {
    authorities.push({ 
      url: node.id, 
      score: ranks[node.id] || 0,
      rank: 0, // Assigned after sort
    });
  });
  
  authorities.sort((a, b) => b.score - a.score);
  authorities.forEach((auth, i) => auth.rank = i + 1);
  
  return authorities;
}
```

### Schema.org JSON-LD Generation with Type Safety

```typescript
// Source: schema-dts usage [CITED: https://www.npmjs.com/package/schema-dts]
import type { Article, Person } from 'schema-dts';

export function generateArticleSchema(data: {
  headline: string;
  author: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
}): string {
  const schema: Article = {
    '@type': 'Article',
    headline: data.headline,
    author: {
      '@type': 'Person',
      name: data.author,
    } as Person,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    image: data.image,
    url: data.url,
    publisher: {
      '@type': 'Organization',
      name: 'TeveroSEO',
    },
  };
  
  // TypeScript validates all properties at compile time
  return JSON.stringify({
    '@context': 'https://schema.org',
    ...schema,
  });
}
```

### Quality Gate Evaluation Pattern

```typescript
// Source: Phase 92 quality gate architecture [SYNTHESIS]
import type { GateResult } from './types';

export async function evaluateQualityGate(
  content: string,
  gateName: string,
  threshold: number,
  vertical: string
): Promise<GateResult> {
  // 1. Generate content embedding
  const embedding = await embedText(content);
  
  // 2. Retrieve reference embeddings for gate + vertical
  const references = await getGateReferences(gateName, vertical);
  
  // 3. Calculate max similarity
  const similarities = references.map(ref => cosineSimilarity(embedding, ref));
  const maxSimilarity = Math.max(...similarities);
  
  // 4. Three-tier decision logic
  if (maxSimilarity >= 0.85) {
    // High confidence pass
    return {
      passed: true,
      score: maxSimilarity * 100,
      message: `Content meets ${gateName} quality standards`,
      method: 'embedding',
      confidence: 'high',
    };
  } else if (maxSimilarity <= 0.70) {
    // High confidence fail
    return {
      passed: false,
      score: maxSimilarity * 100,
      message: `Content fails ${gateName}: ${getFailureReason(gateName)}`,
      method: 'embedding',
      confidence: 'high',
    };
  } else {
    // Borderline: LLM fallback (Grok 4.1 Fast)
    const llmResult = await evaluateWithLLM(content, gateName, vertical);
    return {
      ...llmResult,
      method: 'llm-fallback',
      embeddingSimilarity: maxSimilarity,
      confidence: 'medium',
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keyword density scoring | Semantic similarity + entity extraction | 2024-2025 (LLM era) | Quality measured by meaning, not keyword repetition |
| Fixed readability thresholds | Vertical-specific grade levels | 2025-2026 | Technical content (SaaS) can have grade 14+, healthcare requires grade 10- |
| Manual Schema.org markup | AI-generated structured data | 2025-2026 | Automated Schema.org from CMS data, validated at compile time |
| Rule-based thin content detection | LLM quality gates (Reddit Test, Prove-It) | 2025-2026 | Detects generic content that passes word count but lacks substance |
| Single quality score | Tiered scoring (base + quality + vertical) | Phase 92 | Separates technical SEO (Tier 1-4) from content quality (Tier 5) |
| Global SEO rules | Vertical-specific rules with YMYL detection | Phase 92 | Healthcare requires 800+ words + citations, e-commerce 300+ words + product schema |
| Fixed chunk sizes (500 chars) | Semantic chunking (400-600 tokens, boundary-aware) | 2025-2026 (RAG optimization) | Chunks align with LLM context windows, preserve semantic boundaries |
| Keyword-based internal linking | Embedding-based semantic matching + PageRank | Phase 92 | Links pages by meaning, not keyword overlap; calculates authority flow |

**Deprecated/outdated:**
- **Keyword density** (< 2%): Obsolete since 2012. Google uses NLP, not keyword counting. [ASSUMED: Based on industry knowledge]
- **Exact match anchor text**: Penalized since 2012 Penguin update. Use semantic anchors with diversity. [ASSUMED]
- **Fixed 600-word minimum**: Replaced by vertical-specific minimums (300 e-commerce, 800 healthcare). [VERIFIED: Phase 92 CONTEXT.md]
- **Meta keywords tag**: Ignored by Google since 2009. Remove from checks. [ASSUMED]
- **Single Schema.org type per page**: 2026 allows multiple types (Article + Product for review posts). [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Grok 4.1 uses cl100k_base-compatible encoding (same as GPT-4) | Standard Stack | Token count drift between tiktoken and Grok API, chunks misaligned with context windows |
| A2 | jina-v5-text-nano embeddings sufficient for semantic similarity (no need for larger model) | Standard Stack | Quality gates produce unreliable scores, high LLM fallback rate |
| A3 | 90%+ pages can be classified via heuristics without LLM | Vertical Classification | Higher LLM costs than projected, slower classification |
| A4 | Redis cache with 24h TTL sufficient for vertical classifications | Vertical Classification | Stale classifications if site content changes frequently |
| A5 | Compromise library sufficient for entity extraction (no transformer models needed) | NLP Entity Extraction | Lower fact density accuracy, missed entities |
| A6 | density-clustering DBSCAN/OPTICS sufficient for topic clustering (HDBSCAN not required) | Topic Clustering | Poor clustering on hierarchical topics, need Python HDBSCAN fallback |
| A7 | Existing Vitest configuration sufficient for Phase 92 modules | Testing | Missing test coverage for async LLM operations, embedding generation |
| A8 | Keyword density scoring obsolete since 2012 | State of the Art | If Google still uses keyword density as minor signal, missing optimization |
| A9 | Meta keywords tag ignored by Google since 2009 | State of the Art | If Bing or other engines use it, missing optimization opportunity |
| A10 | PageRank damping factor 0.85 optimal for internal links | PageRank | If different factor needed for internal graphs, authority scores inaccurate |

**If this table has entries:** Planner and discuss-phase should validate assumptions A1-A10 before locking down implementation details. High-risk assumptions (A1, A2, A3) should be tested in 92-01 wave.

## Open Questions

1. **HDBSCAN in TypeScript vs Python Fallback**
   - What we know: hdbscan-ts (1.0.17) exists but immature (12 commits, 1 contributor). density-clustering (1.3.0) mature but lacks hierarchical clustering.
   - What's unclear: Whether topic clustering requires hierarchical HDBSCAN or if DBSCAN/OPTICS sufficient.
   - Recommendation: Start with density-clustering DBSCAN. If hierarchical clusters needed, add Python HDBSCAN as separate service (exec child process or HTTP endpoint). Evaluate in 92-07 (Topical Authority).

2. **Grok 4.1 Token Encoding Compatibility**
   - What we know: tiktoken uses cl100k_base (OpenAI encoding). Grok 4.1 tokenization not publicly documented.
   - What's unclear: Whether Grok uses same encoding or custom tokenizer.
   - Recommendation: Log token counts from Grok API responses in 92-04 (Quality Gates). Compare with tiktoken counts. If drift > 5%, adjust target chunk size down by 10% (450 instead of 500).

3. **Embedding Similarity Threshold Validation**
   - What we know: 0.85 pass, 0.70 fail chosen based on typical similarity ranges. Not validated against human quality ratings.
   - What's unclear: Whether thresholds produce acceptable precision/recall.
   - Recommendation: Build validation set in 92-04: 100 pages per vertical with human quality ratings. Calculate precision/recall for thresholds. Adjust per vertical if needed.

4. **Vertical Classification Edge Cases**
   - What we know: Heuristics work for clear cases (Schema.org present, obvious URL patterns). LLM fallback for ambiguous cases.
   - What's unclear: How to handle multi-vertical content (medical e-commerce, legal SaaS). Which vertical rules apply?
   - Recommendation: Support primary + secondary vertical classification. Apply both rule sets, take union. Client can override to single vertical if needed.

5. **YMYL Detection Accuracy**
   - What we know: YMYL detected via vertical classification (healthcare/legal/financial) + keyword patterns.
   - What's unclear: Whether keyword detection catches edge cases (mental health blog without "medical" in URL).
   - Recommendation: Build YMYL keyword corpus (500+ terms across medical/legal/financial). Test against 1000 pages with known YMYL status. Measure precision/recall. Manual client override as safety net.

## Environment Availability

Phase 92 has no external dependencies beyond existing infrastructure. All services run within existing Node.js/TanStack Start environment.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All services | ✓ | v20+ | — |
| PostgreSQL | Database schemas | ✓ | v15+ | — |
| Redis | Caching (vertical classifications) | ✓ | v7+ | — |
| jina-v5-text-nano | Embeddings (quality gates) | ✓ | Local server (Phase 86) | — |
| Grok 4.1 Fast | LLM fallback | ✓ | API key configured | — |
| BullMQ | Background processing (bulk analysis) | ✓ | v5.74+ | — |

**Missing dependencies with no fallback:** None — all infrastructure already exists from prior phases.

**Missing dependencies with fallback:** None — no optional dependencies identified.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `open-seo-main/vitest.config.ts` |
| Quick run command | `pnpm test -- src/server/features/onpage-mastery` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPM-01 | Vertical classification heuristics (Schema.org detection) | unit | `pnpm test -- src/server/features/onpage-mastery/services/VerticalClassifier.test.ts -t "heuristics"` | ❌ Wave 0 |
| OPM-02 | Vertical classification LLM fallback | integration | `pnpm test -- src/server/features/onpage-mastery/services/VerticalClassifier.test.ts -t "llm-fallback"` | ❌ Wave 0 |
| OPM-03 | YMYL detection (vertical + keywords) | unit | `pnpm test -- src/server/features/onpage-mastery/services/VerticalClassifier.test.ts -t "ymyl"` | ❌ Wave 0 |
| OPM-04 | Text tokenization (tiktoken cl100k_base) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts -t "tokenization"` | ❌ Wave 0 |
| OPM-05 | Semantic chunk boundary detection (H2 > H3 > topic) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts -t "boundaries"` | ❌ Wave 0 |
| OPM-06 | Chunk token count validation (400-600 target) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts -t "token-count"` | ❌ Wave 0 |
| OPM-07 | Quality gate: Reddit Test (embedding similarity) | integration | `pnpm test -- src/server/features/onpage-mastery/services/QualityGateService.test.ts -t "reddit-test"` | ❌ Wave 0 |
| OPM-08 | Quality gate: Information Gain (SERP comparison) | integration | `pnpm test -- src/server/features/onpage-mastery/services/QualityGateService.test.ts -t "info-gain"` | ❌ Wave 0 |
| OPM-09 | Quality gate: Prove-It Details (claim verification) | integration | `pnpm test -- src/server/features/onpage-mastery/services/QualityGateService.test.ts -t "prove-it"` | ❌ Wave 0 |
| OPM-10 | Quality gate: LLM fallback (borderline similarity 0.7-0.85) | integration | `pnpm test -- src/server/features/onpage-mastery/services/QualityGateService.test.ts -t "llm-fallback"` | ❌ Wave 0 |
| OPM-11 | Rule engine: vertical rule loading | unit | `pnpm test -- src/server/features/onpage-mastery/services/RuleEngineService.test.ts -t "rule-loading"` | ❌ Wave 0 |
| OPM-12 | Rule engine: client override hierarchy | unit | `pnpm test -- src/server/features/onpage-mastery/services/RuleEngineService.test.ts -t "overrides"` | ❌ Wave 0 |
| OPM-13 | Rule engine: 41-point scorecard calculation | integration | `pnpm test -- src/server/features/onpage-mastery/services/RuleEngineService.test.ts -t "scorecard"` | ❌ Wave 0 |
| OPM-14 | Readability scoring (Flesch-Kincaid, Gunning Fog) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/ReadabilityScorer.test.ts` | ❌ Wave 0 |
| OPM-15 | Entity extraction (compromise NLP) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/EntityExtractor.test.ts` | ❌ Wave 0 |
| OPM-16 | PageRank calculation (ngraph.pagerank) | unit | `pnpm test -- src/server/features/linking/InternalLinkGraph.test.ts -t "pagerank"` | ❌ Wave 0 |
| OPM-17 | Schema.org JSON-LD generation (schema-dts) | unit | `pnpm test -- src/server/features/onpage-mastery/utils/SchemaGenerator.test.ts` | ❌ Wave 0 |
| OPM-18 | Tier 1 checks: T1-70 to T1-85 (page structure) | unit | `pnpm test -- src/server/lib/audit/checks/tier1/T1-70-*.test.ts` | ❌ Wave 0 |
| OPM-19 | Tier 5 checks: T5-01 to T5-13 (quality gates) | integration | `pnpm test -- src/server/lib/audit/checks/tier5/T5-*.test.ts` | ❌ Wave 0 |
| OPM-20 | End-to-end: full audit with Tier 5 enabled | e2e | Manual verification (requires full page + embeddings + LLM) | Manual-only |

### Sampling Rate

- **Per task commit:** `pnpm test -- src/server/features/onpage-mastery` (< 30s, all unit tests for modified modules)
- **Per wave merge:** `pnpm test` (full suite, all phases)
- **Phase gate:** Full suite green + manual E2E verification (OPM-20) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/server/features/onpage-mastery/services/VerticalClassifier.test.ts` — OPM-01, OPM-02, OPM-03
- [ ] `src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts` — OPM-04, OPM-05, OPM-06
- [ ] `src/server/features/onpage-mastery/services/QualityGateService.test.ts` — OPM-07, OPM-08, OPM-09, OPM-10
- [ ] `src/server/features/onpage-mastery/services/RuleEngineService.test.ts` — OPM-11, OPM-12, OPM-13
- [ ] `src/server/features/onpage-mastery/utils/ReadabilityScorer.test.ts` — OPM-14
- [ ] `src/server/features/onpage-mastery/utils/EntityExtractor.test.ts` — OPM-15
- [ ] `src/server/features/linking/InternalLinkGraph.test.ts` — OPM-16 (extend existing)
- [ ] `src/server/features/onpage-mastery/utils/SchemaGenerator.test.ts` — OPM-17
- [ ] `src/server/lib/audit/checks/tier1/T1-70-*.test.ts` — OPM-18 (16 files)
- [ ] `src/server/lib/audit/checks/tier5/T5-*.test.ts` — OPM-19 (13 files)
- [ ] Vitest config: Add `coverage` section with 80% thresholds for new modules

**Test infrastructure status:** Vitest configured and working (existing tests pass). All Phase 92 tests are net-new files.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | N/A — inherits from existing audit system |
| V3 Session Management | no | N/A — inherits from existing audit system |
| V4 Access Control | yes | Vertical classification cache scoped by clientId, quality scores tenant-isolated |
| V5 Input Validation | yes | Zod validation for all LLM prompts (prevent injection), HTML sanitization for entity extraction |
| V6 Cryptography | no | N/A — no new cryptographic operations |

### Known Threat Patterns for On-Page SEO Mastery Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM prompt injection via page content | Tampering | Sanitize HTML before LLM input, validate Grok 4.1 response structure (Zod schema) |
| Malicious Schema.org markup (XSS in JSON-LD) | Tampering | Parse Schema.org types only, never render user-controlled JSON-LD in browser without sanitization |
| Cache poisoning (vertical classification) | Spoofing | Include domain+path+hash in cache key, validate cached data structure on retrieval |
| Resource exhaustion (embedding generation) | Denial of Service | Rate limit: max 50 pages/client/minute for quality audits, chunk limit 100 per page |
| Sensitive data in LLM prompts (PII in content) | Information Disclosure | Strip emails/phone numbers from content before quality gate LLM calls |
| Unauthorized access to quality scores | Information Disclosure | Tenant isolation: all queries scoped by clientId (existing pattern from Phase 32) |

**LLM-specific risks:** Phase 92 sends page content to Grok 4.1 Fast for quality evaluation. Sanitize HTML to prevent prompt injection attacks (e.g., content containing "IGNORE PREVIOUS INSTRUCTIONS"). Validate LLM responses with Zod schemas before using scores.

**YMYL compliance:** YMYL detection (healthcare/legal/financial) MUST be logged for audit trails — regulators may require proof of content quality enforcement. Store vertical classifications and quality scores for 7 years (medical compliance).

## Sources

### Primary (HIGH confidence)

- [tiktoken (dqbd/tiktoken)](https://github.com/dqbd/tiktoken) - Official WASM tokenizer, verified v1.0.21
- [semantic-chunking npm](https://www.npmjs.com/package/semantic-chunking) - BYOE pattern, verified v2.6.0
- [text-readability npm](https://www.npmjs.com/package/text-readability) - Multi-formula library, verified v1.1.1
- [compromise npm](https://www.npmjs.com/package/compromise) - NLP library, verified v14.15.0
- [ngraph.pagerank npm](https://www.npmjs.com/package/ngraph.pagerank) - PageRank library, verified v2.1.1
- [schema-dts npm](https://www.npmjs.com/package/schema-dts) - Schema.org types, verified v2.0.0
- [density-clustering npm](https://www.npmjs.com/package/density-clustering) - DBSCAN/OPTICS, verified v1.3.0
- Phase 92 CONTEXT.md - Architectural decisions from 14 Opus subagent analyses

### Secondary (MEDIUM confidence)

- [YMYL Content Guidelines (2026)](https://koanthic.com/en/ymyl-content-guidelines-complete-guide-for-2026/) - E-E-A-T framework requirements
- [Healthcare SEO EEAT Requirements](https://nihalps.in/blog/healthcare-seo-content-ymyl-eeat-requirements/) - Medical content standards
- [AI Generated SEO Content Quality](https://www.trysight.ai/blog/ai-generated-seo-content-quality) - AI slop detection patterns
- [What is AI Slop](https://www.aidetectors.io/blog/what-is-ai-slop-and-how-to-detect-it) - Quality gate criteria
- [Common SEO Mistakes 2026](https://digikestra.com/blog/common-seo-mistakes-that-hurt-rankings-in-2026) - Search intent misalignment, Core Web Vitals
- [On-Page SEO Factors 2026](https://wellows.com/blog/on-page-seo-factors/) - 13 critical factors (verified against Phase 92 checks)
- [Free JavaScript SEO Audit Tool](https://ccbd.dev/blog/Free-JavaScript-SEO-Audit-Tool-Every-Developer-Needs-in-2026) - @power-seo/audit patterns
- [Quality Gates in Software Development](https://www.sonarsource.com/resources/library/quality-gate/) - Threshold architecture patterns
- [Build Automated QA-Gate](https://oleno.ai/blog/build-an-automated-qa-gate-50-quality-checks-for-content-pipelines/) - 85+ pass threshold standard

### Tertiary (LOW confidence)

- [hdbscan-ts npm](https://www.npmjs.com/package/hdbscan-ts) - TypeScript HDBSCAN (immature, 1.0.17)
- [GitHub: dobbyscan](https://github.com/mapbox/dobbyscan) - Fast geographic clustering (Mapbox, specific use case)
- [Chonkie-TS](https://www.npmjs.com/package/@chonkiejs/core) - Advanced chunking (0.0.9, very new)
- [node-nlp](https://www.npmjs.com/package/node-nlp) - 40+ languages NLP (alpha 5.0.0, stability concerns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm registry with active maintenance, stable versions
- Architecture: HIGH - Patterns match existing open-seo-main conventions (services, utils, checks structure)
- Pitfalls: MEDIUM - Based on research synthesis + industry knowledge, not project-specific verification
- YMYL requirements: HIGH - Multiple authoritative sources (Koanthic, healthcare SEO guides) confirm E-E-A-T standards
- Quality gate thresholds: LOW - 0.85/0.70 similarity thresholds not validated against human ratings (flagged as Open Question #3)

**Research date:** 2026-05-06
**Valid until:** 60 days (2026-07-05) — fast-moving domain (AI content quality), libraries stable but practices evolving
