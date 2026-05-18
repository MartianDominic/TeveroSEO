# Research 02: Keyword Classification System

> **Phase 99 Research** | Keyword Intelligence Classification for Unified SEO Content Pipeline
> **Status**: Complete
> **Last Updated**: 2026-05-11

---

## Overview

This document consolidates the complete keyword classification architecture for TeveroSEO, covering funnel classification, geo filtering, relevance scoring, cascade selection, and pSEO detection.

---

## 1. FunnelClassifier: Lithuanian Patterns + DataForSEO Intent

### Architecture

The FunnelClassifier uses a **dual-signal approach**:
1. **Pattern-based classification** (highest confidence) - 95+ Lithuanian regex patterns
2. **DataForSEO intent fallback** - transactional/commercial/informational mapping

### Existing Implementation

**File**: `open-seo-main/src/server/features/keywords/funnel/patterns.ts`

```typescript
export interface PatternGroup {
  patterns: RegExp[];
  type: string;  // e.g., "purchase", "booking", "comparison", "learning"
}

// BOFU PATTERNS (40+) - Ready to buy/book NOW
export const BOFU_PATTERNS: PatternGroup[] = [
  // Purchase intent
  {
    type: "purchase",
    patterns: [
      /\b(pirkti|pirk|nusipirk|nupirkti|įsigyti)\b/i,
      /\b(užsakyti|užsisakyti|užsakymas|užsak)\b/i,
      /\b(kaina|kainos|kiek kainuoja|kainuoja)\b/i,
      /\b(nuolaida|akcija|išpardavimas|pigiau)\b/i,
    ],
  },
  // Service booking
  {
    type: "booking",
    patterns: [
      /\b(registruotis|registracija|užsiregistruoti)\b/i,
      /\b(rezervuoti|rezervacija|rezervuok|rezervacijos)\b/i,
      /\b(skambinti|susisiekti|kontaktai|kontaktas)\b/i,
    ],
  },
  // Local/immediate intent
  {
    type: "local",
    patterns: [
      /(šalia manęs|netoli|arti|greta)/i,
      /\b(dabar|šiandien|skubiai|greitai|tuoj)\b/i,
    ],
  },
  // ... additional patterns for delivery, product_specific
];

// MOFU PATTERNS (30+) - Comparing options
export const MOFU_PATTERNS: PatternGroup[] = [
  // comparison, versus, reviews, selection, use_case
];

// TOFU PATTERNS (25+) - Just learning
export const TOFU_PATTERNS: PatternGroup[] = [
  // learning, how_to, why, information, tips
];
```

### Classification Algorithm

```typescript
export function detectFunnelPatterns(keyword: string): {
  stage: "bofu" | "mofu" | "tofu" | null;
  patternType: string | null;
} {
  // Priority: BOFU > MOFU > TOFU (purchase intent wins ties)
  const bofuMatch = matchPatterns(keyword, BOFU_PATTERNS);
  if (bofuMatch.matched) return { stage: "bofu", patternType: bofuMatch.patternType };

  const mofuMatch = matchPatterns(keyword, MOFU_PATTERNS);
  if (mofuMatch.matched) return { stage: "mofu", patternType: mofuMatch.patternType };

  const tofuMatch = matchPatterns(keyword, TOFU_PATTERNS);
  if (tofuMatch.matched) return { stage: "tofu", patternType: tofuMatch.patternType };

  return { stage: null, patternType: null };
}
```

### DataForSEO Intent Mapping (from WORLD-CLASS-ARCHITECTURE.md)

```typescript
// DataForSEO intent fallback when patterns don't match
if (dataForSeoIntent === 'transactional') {
  return { stage: 'bofu', confidence: 0.75 };
}

if (dataForSeoIntent === 'commercial') {
  // Commercial is ambiguous - check for city + service = BOFU
  if (hasCity && businessContext.type === 'service') {
    return { stage: 'bofu', confidence: 0.7 };
  }
  return { stage: 'mofu', confidence: 0.65 };
}

if (dataForSeoIntent === 'informational') {
  return { stage: 'tofu', confidence: 0.8 };
}

// Low confidence fallback
return { stage: 'mofu', confidence: 0.4 };
```

---

## 2. GeoClassifier: Lithuanian City Extraction

### City Database

**File**: `open-seo-main/src/server/features/keywords/geo/cities.ts`

```typescript
export interface CityEntry {
  name: string;           // Normalized (nominative): "vilnius"
  variants: string[];     // Morphological forms: ["vilniuje", "vilniaus", "vilniu"]
}

// 50+ Lithuanian cities with 4+ variants each for top 10
export const LITHUANIAN_CITIES: CityEntry[] = [
  { name: "vilnius", variants: ["vilniuje", "vilniaus", "vilniu", "vilniui"] },
  { name: "kaunas", variants: ["kaune", "kauno", "kaunui", "kauna"] },
  { name: "klaipeda", variants: ["klaipedoje", "klaipedos", "klaipedai"] },
  { name: "siauliai", variants: ["siauliuose", "siauliu", "siauliams"] },
  // ... 40+ more cities
];

// Near-me patterns (Lithuanian + English)
export const NEAR_ME_PATTERNS: RegExp[] = [
  /\bsalia manes\b/i,
  /\bnetoli\b/i,
  /\barti\b/i,
  /\bnear me\b/i,
];

// O(1) lookup via variant index
const variantIndex = new Map<string, CityEntry>();
export function findCity(text: string): CityEntry | null;
```

### GeoClassifier Implementation

**File**: `open-seo-main/src/server/features/keywords/geo/GeoClassifier.ts`

```typescript
export interface GeoClassification {
  hasExplicitCity: boolean;
  city: string | null;
  isNearMe: boolean;
  isGeneric: boolean;
  passesGeoFilter: boolean;
  geoScore: number;        // 0-1 for scoring
  reason: string;
}

export interface GeoConstraints {
  includeCities: string[];   // Target cities
  excludeCities: string[];   // Excluded cities
  nearMeAllowed: boolean;    // Allow "near me" keywords
  genericAllowed: boolean;   // Allow non-city keywords
}

export class GeoClassifier {
  classify(keyword: string, constraints: GeoConstraints): GeoClassification {
    const cityMatch = this.extractCity(keyword);
    const isNearMe = this.checkNearMe(keyword);

    if (cityMatch) return this.classifyWithCity(cityMatch, constraints);
    if (isNearMe) return this.classifyNearMe(constraints);
    return this.classifyGeneric(constraints);
  }

  // Street filtering: "Vilniaus g." != city reference
  private extractCity(keyword: string): string | null {
    const streetSuffixes = ["g.", "gatve", "gatvė", "prospektas", "aleja"];
    // Skip if next word is street suffix
  }
}
```

### Geo Score Values

| Scenario | geoScore | passesGeoFilter |
|----------|----------|-----------------|
| Target city match | 1.0 | true |
| Near-me (allowed) | 0.9 | true |
| Generic (allowed) | 0.5 | true |
| Wrong city | 0.0 | false |
| Excluded city | 0.0 | false |

---

## 3. RelevanceScorer: Embedding-Based Multi-Dimensional

### Unified Embedding Service

**File**: `open-seo-main/src/server/features/keywords/services/EmbeddingService.ts`

```typescript
export class UnifiedEmbeddingService {
  // Configuration: jina-v5-text-nano, 768-dim, Matryoshka truncation
  
  async embedPassages(texts: string[], options?: EmbedOptions): Promise<Float32Array[]>;
  async embedQuery(text: string, options?: EmbedOptions): Promise<Float32Array>;
  
  // Cosine similarity for normalized vectors
  static cosineSimilarity(a: Float32Array, b: Float32Array): number;
  static findTopK(query: Float32Array, candidates: Float32Array[], k: number);
}
```

### Multi-Dimensional Relevance (from WORLD-CLASS-ARCHITECTURE.md)

```typescript
interface RelevanceScores {
  coreRelevance: number;        // Similarity to business description
  categoryRelevance: number;    // Similarity to priority categories
  problemRelevance: number;     // Similarity to problems solved
  combinedRelevance: number;    // Weighted average
}

async function scoreRelevance(
  keyword: string,
  businessContext: BusinessContext,
  embeddingService: EmbeddingService
): Promise<RelevanceScores> {
  const kwEmbed = await embeddingService.embed(keyword);
  
  // Core relevance: Is this keyword about what they do?
  const coreEmbed = await embeddingService.embed(businessContext.coreOffering);
  const coreRelevance = cosineSimilarity(kwEmbed, coreEmbed);
  
  // Category relevance: Does it match priority categories?
  const categoryRelevance = Math.max(
    ...categoryEmbeds.map(ce => cosineSimilarity(kwEmbed, ce))
  );
  
  // Weighted combination
  const combinedRelevance = (
    coreRelevance * 0.40 +
    categoryRelevance * 0.35 +
    problemRelevance * 0.25
  );
  
  return { coreRelevance, categoryRelevance, problemRelevance, combinedRelevance };
}
```

---

## 4. CascadeSelector: BOFU-First with Fallback

### Implementation

**File**: `open-seo-main/src/server/features/keywords/selection/CascadeSelector.ts`

```typescript
export interface CascadeConfig {
  targetCount: number;          // e.g., 100
  stages: {
    bofu: { min: number; max: number; priority: 1 };
    mofu: { min: number; max: number; priority: 2 };
    tofu: { min: number; max: number; priority: 3 };
  };
}

export interface SelectionResult {
  selected: SelectedKeyword[];
  excluded: ExcludedKeyword[];
  breakdown: SelectionBreakdown;
  metadata: { totalInput, selectedCount, processingTimeMs };
}

export class CascadeSelector {
  select(keywords: FilteredKeyword[], config: CascadeConfig): SelectionResult {
    // 1. Group by funnel stage
    const pools = this.groupByStage(keywords);
    
    // 2. Sort each pool by composite score (descending)
    for (const stage of ['bofu', 'mofu', 'tofu']) {
      pools[stage].sort((a, b) => b.compositeScore - a.compositeScore);
    }
    
    // 3. Cascade selection by priority
    const stages = [
      { stage: 'bofu', config: config.stages.bofu },  // priority 1
      { stage: 'mofu', config: config.stages.mofu },  // priority 2
      { stage: 'tofu', config: config.stages.tofu },  // priority 3
    ].sort((a, b) => a.config.priority - b.config.priority);
    
    let remaining = config.targetCount;
    for (const { stage, config: stageConfig } of stages) {
      const take = Math.min(pools[stage].length, stageConfig.max, remaining);
      // Select top `take` keywords, exclude rest
      remaining -= take;
    }
  }
}
```

### Example Usage

```typescript
// Target: 100 keywords, BOFU-first
const config: CascadeConfig = {
  targetCount: 100,
  stages: {
    bofu: { min: 0, max: 100, priority: 1 },  // Take all BOFU first
    mofu: { min: 0, max: 50, priority: 2 },   // Fill with MOFU
    tofu: { min: 0, max: 20, priority: 3 },   // Minimal TOFU
  }
};

const result = cascadeSelector.select(filteredKeywords, config);
// result.breakdown: { bofu: 67, mofu: 33, tofu: 0 }
```

---

## 5. Composite Scoring

### Formula

**File**: `open-seo-main/src/server/features/keywords/filtering/scoring.ts`

```typescript
export const SCORING_WEIGHTS = {
  relevance: 0.4,
  funnelConfidence: 0.3,
  geoScore: 0.2,
  volumeNormalized: 0.1,
} as const;

export interface CompositeScore {
  baseScore: number;           // Weighted sum of signals
  priorityMultiplier: number;  // 1.0-2.0 from category priorities
  quickWinBonus: number;       // 0.0-0.2 from position opportunity
  finalScore: number;          // baseScore * priorityMultiplier + quickWinBonus
}

// Volume normalization: log10 scale (0-10000 -> 0-1)
export function normalizeVolume(volume: number): number {
  if (volume <= 0) return 0;
  return Math.min(1, Math.log10(volume) / 4);
}

// Quick win bonus: position 11-20 with volume >= 100 = 0.2 bonus
export function computeQuickWinBonus(position: number | null, volume: number): number {
  if (position >= 11 && position <= 20) {
    if (volume >= 100) return 0.2;
    if (volume >= 50) return 0.15;
    return 0.1;
  }
  return 0;
}
```

---

## 6. pSEO Detection: Template Patterns

### Implementation

**File**: `open-seo-main/src/server/features/keywords/discovery/PSEODetector.ts`

```typescript
export interface PSEOCluster {
  pattern: string;             // "[service] [CITY]"
  template: string;            // "/plovykla/{city}"
  keywords: string[];
  cities: string[];
  estimatedPages: number;      // 50+ Lithuanian cities
  totalVolume: number;
  avgDifficulty: number;
  opportunityScore: number;
}

export function detectPSEOPatterns(keywords: KeywordWithMetrics[]): PSEOCluster[] {
  // Group keywords by pattern (keyword without city)
  const groups = new Map<string, { keywords, cities: Set<string> }>();
  
  for (const kw of keywords) {
    const cityExtraction = extractCityFromKeyword(kw.keyword);
    if (cityExtraction) {
      const base = removeCity(kw.keyword, cityExtraction.variant);
      // Group by base pattern
    }
  }
  
  // Filter to clusters with 3+ cities
  // Sort by opportunity score
}

// Opportunity score formula
export function computePSEOScore(cluster: PSEOCluster): number {
  const volumeScore = Math.min(cluster.totalVolume / 5000, 1.0);
  const cityScore = Math.min(cluster.cities.length / 10, 1.0);
  const difficultyScore = 1 - cluster.avgDifficulty / 100;
  const funnelScore = /* BOFU=1.0, MOFU=0.7, TOFU=0.4 */;
  
  return (
    volumeScore * 0.35 +
    cityScore * 0.25 +
    difficultyScore * 0.20 +
    funnelScore * 0.20
  );
}
```

---

## 7. Constraint Filter Pipeline

### 4-Stage Filter with Early Exit

**File**: `open-seo-main/src/server/features/keywords/filtering/ConstraintFilter.ts`

```typescript
export class ConstraintFilter {
  filter(input: ClassifiedKeywordInput): FilterResult {
    // Stage 1: Geo filter
    const geoResult = checkGeoFilter(input);
    if (!geoResult.passes) return { excluded: true, reason: geoResult.reason, stage: 'geo' };
    
    // Stage 2: Negative filter (DIY, competitors)
    const negativeResult = checkNegativeFilter(input);
    if (!negativeResult.passes) return { excluded: true, reason: negativeResult.reason, stage: 'negative' };
    
    // Stage 3: Audience filter (B2B vs B2C)
    const audienceResult = checkAudienceFilter(input);
    if (!audienceResult.passes) return { excluded: true, reason: audienceResult.reason, stage: 'audience' };
    
    // Stage 4: Relevance threshold (default 0.4)
    const relevanceResult = checkRelevanceFilter(input, threshold);
    if (!relevanceResult.passes) return { excluded: true, reason: relevanceResult.reason, stage: 'relevance' };
    
    // All passed - compute composite score
    return { passed: true, compositeScore: this.scorer.score(input) };
  }
}
```

### Exclusion Reason Taxonomy

```typescript
export type ExclusionReason =
  | `geo:wrong_city:${string}`
  | 'geo:not_in_target_list'
  | 'geo:generic_not_allowed'
  | `negative:term:${string}`
  | `negative:brand:${string}`
  | `negative:intent:${string}`
  | 'audience:b2c_excluded'
  | 'audience:b2b_excluded'
  | `relevance:below_threshold:${string}`;
```

---

## 8. Lithuanian Normalizer

**File**: `open-seo-main/src/server/features/keywords/services/LithuanianNormalizer.ts`

```typescript
export class LithuanianNormalizer {
  // Cascade: Stanza (if available) -> Rule-based LEMMA_MAP -> Passthrough
  
  lemmatize(text: string): string;               // "dažytiems plaukams" -> "dažytas plaukai"
  normalizeForSearch(text: string): string;      // lemmatize + remove diacritics
  removeDiacritics(text: string): string;        // "šampūnas" -> "sampunas"
  extractBrandAliases(name: string): string[];   // "L'Oréal" -> ["loreal", "l'oreal", ...]
}

// Diacritic map
const LITHUANIAN_DIACRITIC_MAP = {
  'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
  'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
};
```

---

## 9. Key TypeScript Interfaces (Consolidated)

```typescript
// From filtering/types.ts
export interface ClassifiedKeywordInput {
  keyword: string;
  geoClassification?: GeoClassification;
  relevanceScores?: { combinedScore: number };
  funnelStage?: 'bofu' | 'mofu' | 'tofu';
  funnelConfidence?: number;
  volume?: number;
  position?: number | null;
  embedding?: number[];  // 768-dim for clustering passthrough
}

// From selection/types.ts
export type FunnelStage = 'bofu' | 'mofu' | 'tofu';

export interface SelectedKeyword {
  keyword: string;
  funnelStage: FunnelStage;
  compositeScore: number;
  cascadePosition: number;
  metrics: { volume: number; difficulty: number; position?: number };
}

// From discovery/types.ts
export interface PSEOCluster {
  pattern: string;
  template: string;
  keywords: string[];
  cities: string[];
  estimatedPages: number;
  totalVolume: number;
  avgDifficulty: number;
  opportunityScore: number;
}

// From WORLD-CLASS-ARCHITECTURE.md
export interface AnalysisConstraints {
  businessContext: {
    type: 'ecommerce' | 'service' | 'saas' | 'local' | 'b2b_services';
    coreOffering: string;
    problemsSolved: string[];
    productCategories: string[];
  };
  geoConstraints: GeoConstraints;
  audienceConstraints: { b2bOnly: boolean; b2cAllowed: boolean };
  funnelConfig: {
    primary: 'bofu' | 'mofu' | 'tofu';
    fallbackOrder: FunnelStage[];
    targetCount: number;
  };
  priorities: { category: string; weightMultiplier: number }[];
  negativeFilters: NegativeFilters;
}
```

---

## 10. Existing Code File Reference

| Component | File Path |
|-----------|-----------|
| FunnelClassifier patterns | `open-seo-main/src/server/features/keywords/funnel/patterns.ts` |
| GeoClassifier | `open-seo-main/src/server/features/keywords/geo/GeoClassifier.ts` |
| City database | `open-seo-main/src/server/features/keywords/geo/cities.ts` |
| EmbeddingService | `open-seo-main/src/server/features/keywords/services/EmbeddingService.ts` |
| CascadeSelector | `open-seo-main/src/server/features/keywords/selection/CascadeSelector.ts` |
| CompositeScorer | `open-seo-main/src/server/features/keywords/filtering/scoring.ts` |
| ConstraintFilter | `open-seo-main/src/server/features/keywords/filtering/ConstraintFilter.ts` |
| PSEODetector | `open-seo-main/src/server/features/keywords/discovery/PSEODetector.ts` |
| LithuanianNormalizer | `open-seo-main/src/server/features/keywords/services/LithuanianNormalizer.ts` |
| ResilientClassifier | `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts` |
| PrioritizationService | `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` |

---

## 11. Phase 99 Integration Notes

For the Unified SEO Content Pipeline, these components integrate as:

1. **ConversationIntelligenceService** extracts `AnalysisConstraints` from client chat
2. **GeoClassifier** + **FunnelClassifier** classify each keyword (parallelizable)
3. **RelevanceScorer** computes embedding-based relevance
4. **ConstraintFilter** applies 4-stage hard filtering
5. **CompositeScorer** computes final scores for passing keywords
6. **CascadeSelector** selects top N with BOFU-first priority
7. **PSEODetector** identifies template opportunities
8. Export selected + excluded with reasons
