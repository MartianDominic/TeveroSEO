# Phase 78: Relevance Scoring - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Score keyword relevance using embeddings across multiple dimensions. This ensures only truly relevant keywords make it to final selection — even if they pass geo/funnel filters.

**The Problem:**
A car wash in Šiauliai gets DataForSEO keywords including:
- "automobilių plovykla" ✓ (core service)
- "padangų montavimas" ✗ (different service entirely)
- "automobilio valymas" ✓ (synonym)
- "detailing paslaugos" ✓ (related service they offer)
- "automobilių remontas" ? (tangentially related)

DataForSEO returns these because they share "automobil" root, but semantic relevance varies wildly.

**The Solution:**
Multi-dimensional embedding similarity scoring:
1. Core relevance: keyword ↔ business description
2. Category relevance: keyword ↔ priority categories
3. Problem relevance: keyword ↔ problems solved

</domain>

<decisions>
## Implementation Decisions

### Embedding Model Selection

```typescript
// Jina v5 for Lithuanian support
const EMBEDDING_CONFIG = {
  model: 'jina-embeddings-v3',  // Best Lithuanian quality
  fallback: 'jina-embeddings-v2-base-en',
  dimensions: 768,
  batchSize: 100,  // Jina batch limit
  cacheTTL: 7 * 24 * 60 * 60 * 1000,  // 7 days
};
```

### Scoring Dimensions

```typescript
interface RelevanceScores {
  coreRelevance: number;      // keyword ↔ businessDescription
  categoryRelevance: number;  // keyword ↔ priorityCategories (max)
  problemRelevance: number;   // keyword ↔ problemsSolved (max)
  combinedScore: number;      // Weighted combination
  passesThreshold: boolean;   // combinedScore >= 0.4
}

// Weight configuration (from AnalysisConstraints)
const DEFAULT_WEIGHTS = {
  core: 0.5,      // Business description match
  category: 0.3,  // Priority category match
  problem: 0.2,   // Problem-solution match
};
```

### Scoring Algorithm

```
For each keyword:

1. Embed keyword (batch for efficiency)
   → embedding_kw = jina.embed(keyword)

2. Compute core relevance
   → embedding_biz = jina.embed(businessDescription)  // Cached
   → coreRelevance = cosineSimilarity(embedding_kw, embedding_biz)

3. Compute category relevance (max across categories)
   → For each priorityCategory:
       embedding_cat = jina.embed(category)  // Cached
       similarity = cosineSimilarity(embedding_kw, embedding_cat)
   → categoryRelevance = max(similarities)

4. Compute problem relevance (max across problems)
   → For each problemSolved:
       embedding_prob = jina.embed(problem)  // Cached
       similarity = cosineSimilarity(embedding_kw, embedding_prob)
   → problemRelevance = max(similarities)

5. Combine scores
   → combinedScore = (core * w_core) + (category * w_cat) + (problem * w_prob)
   → passesThreshold = combinedScore >= 0.4
```

### Caching Strategy

```typescript
interface EmbeddingCache {
  // Redis-based cache with 7-day TTL
  key: `embedding:${modelId}:${textHash}`;
  value: Float32Array;  // 768 dimensions
  ttl: 604800;  // 7 days in seconds
}

// Cache hit scenarios:
// 1. Same keyword analyzed for different client → Hit
// 2. Same business description → Hit  
// 3. Same category text → Hit
// Expected hit rate: 80%+ after initial analysis
```

### Batch Processing

```typescript
// Process 1000 keywords efficiently
async function scoreKeywordsBatch(
  keywords: string[],
  constraints: AnalysisConstraints
): Promise<Map<string, RelevanceScores>> {
  // 1. Pre-embed all reference texts (business, categories, problems)
  const referenceEmbeddings = await embedReferences(constraints);
  
  // 2. Batch embed keywords (100 per batch)
  const keywordEmbeddings = await batchEmbed(keywords, 100);
  
  // 3. Compute all similarities (parallelized)
  const scores = computeAllScores(keywordEmbeddings, referenceEmbeddings);
  
  return scores;
}
```

### Threshold Calibration

Based on testing with Lithuanian e-commerce and service keywords:

| Score Range | Interpretation | Action |
|-------------|---------------|--------|
| 0.7 - 1.0 | Highly relevant | Include, high priority |
| 0.5 - 0.7 | Relevant | Include |
| 0.4 - 0.5 | Marginally relevant | Include if needed |
| 0.0 - 0.4 | Not relevant | Exclude |

### Integration with Phase 79

```typescript
// RelevanceScorer output → ConstraintFilter input
interface ClassifiedKeyword {
  keyword: string;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  funnelConfidence: number;
  geoClassification: GeoClassification;
  relevanceScores: RelevanceScores;  // ← Phase 78 output
}
```

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts` — Business description source
- `AI-Writer/backend/services/embeddings/` — Existing Jina integration
- `benchmark/jina-embedding-benchmark/` — Jina v3 vs v5 Lithuanian benchmark

</references>

<existing_code>
## Existing Infrastructure

### Jina Embeddings Integration
- AI-Writer has Jina API integration
- Used for semantic search in content
- **Gap:** No relevance scoring for keywords

### GraphRAG Embeddings (Phase 65)
- Jina v3 embeddings for knowledge graph
- Stored in PostgreSQL with pgvector
- **Gap:** Different use case (graph nodes, not keyword scoring)

### Embedding Cache
- Redis caching exists for AI-Writer embeddings
- **Gap:** Need to extend for keyword scoring cache

</existing_code>

<success_criteria>
## Success Criteria

1. Irrelevant keywords (e.g., "padangų montavimas" for car wash) score <0.3
2. Relevant keywords score >0.6
3. Edge cases (tangentially related) scored with nuance (0.4-0.6)
4. Batch processing handles 1000 keywords in <30 seconds
5. Embedding cache achieves 80%+ hit rate on repeat analysis
6. Category relevance correctly boosts priority keywords
7. Problem relevance identifies "solution" keywords

</success_criteria>

<test_cases>
## Key Test Cases

### Car Wash Business (Šiauliai)

```
Business: "Automobilių plovykla Šiauliuose. Teikiame plovimo, 
valymo ir detailing paslaugas."

Priority categories: ["plovimas", "detailing"]
Problems solved: ["purvinas automobilis", "neprižiūrėta išvaizda"]

Keywords to score:
"automobilių plovykla" → coreRelevance: 0.85, combined: 0.80+ ✓
"detailing paslaugos" → categoryRelevance: 0.90, combined: 0.75+ ✓
"automobilio valymas" → coreRelevance: 0.75, combined: 0.70+ ✓
"padangų montavimas" → coreRelevance: 0.25, combined: 0.20 ✗
"automobilių remontas" → coreRelevance: 0.40, combined: 0.35 ?
```

### E-commerce Cosmetics (National)

```
Business: "Natūrali kosmetika internetu. Veido serumai, 
šampūnai, kūno priežiūra."

Priority categories: ["veido serumai", "šampūnai"]
Problems solved: ["sausa oda", "riebi galvos oda", "plaukų slinkimas"]

Keywords to score:
"veido serumas su vitaminu c" → categoryRelevance: 0.88 ✓
"šampūnas nuo pleiskanų" → categoryRelevance: 0.82 ✓
"kūno losjonas" → coreRelevance: 0.65 ✓
"dekoratyvinė kosmetika" → coreRelevance: 0.45 ?
"parfumerija" → coreRelevance: 0.30 ✗
```

### Edge Cases

```
"geriausias šampūnas" → No explicit category match, but...
  → Problem match: "plaukų slinkimas" related → 0.55
  → Should pass threshold (0.4)

"kosmetikos parduotuvė vilniuje" → Competitor mention
  → coreRelevance high (0.70) but...
  → Geo filter will exclude (Phase 77)

"kas yra hialurono rūgštis" → TOFU educational
  → problemRelevance: "sausa oda" → 0.60
  → Should pass for content strategy
```

</test_cases>
