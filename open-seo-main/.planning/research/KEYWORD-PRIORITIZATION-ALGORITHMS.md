# Keyword Prioritization and Filtering Algorithms for SEO Platforms

**Research Date:** 2026-04-22
**Purpose:** Phase 1 keyword filtering from 100-1000 discovered keywords down to 50-200 actionable targets
**Context:** Filter for client-specific difficulty, agreed constraints, and business value

---

## Executive Summary

This document provides concrete algorithms for filtering and prioritizing SEO keywords. The goal is to reduce a discovery set of 100-1000 keywords to 50-200 actionable targets based on:

1. Client-specific rankability (not generic difficulty)
2. Client constraints (e.g., "only category pages")
3. Business value (conversions, not just traffic)

---

## 1. Keyword Difficulty Calculation Methods

### 1.1 How Major Tools Calculate Difficulty

#### Ahrefs Method
- **Primary signal:** Number of referring domains to top 10 pages
- **Formula:** Logarithmic scale based on median backlinks needed
- **KD 40 ≈ 56 referring domains needed to rank top 10**
- **Deliberately excludes:** On-page optimization, content quality, user signals

```typescript
// Ahrefs-style difficulty (simplified)
function ahrefsStyleDifficulty(top10Pages: PageData[]): number {
  const referringDomains = top10Pages.map(p => p.referringDomains);
  const median = calculateMedian(referringDomains);
  
  // Logarithmic scale 0-100
  // ~10 RDs = KD 20, ~50 RDs = KD 40, ~200 RDs = KD 60
  return Math.min(100, Math.round(Math.log2(median + 1) * 12));
}
```

#### SEMrush Method (Multi-Factor Weighted Average)
- **Referring domains:** 41.22% weight
- **Authority Score median:** 16.99% weight
- **Search volume:** 9.47% weight
- **SERP features presence:** 11 different features considered
- **Content quality assessment**
- **Word count analysis**

```typescript
// SEMrush-style difficulty (weighted composite)
interface SerpAnalysis {
  medianReferringDomains: number;
  medianAuthorityScore: number;
  searchVolume: number;
  serpFeatures: SerpFeature[];
  avgContentWordCount: number;
}

function semrushStyleDifficulty(analysis: SerpAnalysis): number {
  const rdScore = Math.min(100, analysis.medianReferringDomains / 2);
  const authScore = analysis.medianAuthorityScore;
  const volumeScore = Math.min(100, Math.log10(analysis.searchVolume + 1) * 25);
  const serpFeatureScore = calculateSerpFeatureImpact(analysis.serpFeatures);
  
  return Math.round(
    rdScore * 0.4122 +
    authScore * 0.1699 +
    volumeScore * 0.0947 +
    serpFeatureScore * 0.15 +
    normalizeContentScore(analysis.avgContentWordCount) * 0.17
  );
}
```

### 1.2 Client-Specific (Personalized) Keyword Difficulty

**Key insight:** Generic KD is misleading. A KD 65 keyword may be KD 35 for a client with strong topical authority.

#### Personal Keyword Difficulty (PKD) Formula

```typescript
interface ClientProfile {
  domainRating: number;           // 0-100 (client's DR)
  topicalAuthorityScore: number;  // 0-100 (content coverage in niche)
  existingRankingPower: number;   // Avg position for related keywords
  backlinksVelocity: number;      // New links/month
}

interface SerpCompetitors {
  avgDomainRating: number;
  avgTopicalAuthority: number;
  avgBacklinks: number;
}

/**
 * Calculate Personal Keyword Difficulty.
 * 
 * Formula: BaseDifficulty × AuthorityGapFactor × TopicalRelevanceFactor
 * 
 * - If client DR > SERP avg DR: difficulty drops
 * - If client has topical authority: difficulty drops
 * - If client already ranks for related terms: difficulty drops
 */
function calculatePersonalDifficulty(
  baseDifficulty: number,
  client: ClientProfile,
  serp: SerpCompetitors
): number {
  // Authority gap factor (0.5 to 1.5)
  // Client DR higher than SERP = easier (factor < 1)
  const drDelta = client.domainRating - serp.avgDomainRating;
  const authorityFactor = Math.max(0.5, Math.min(1.5, 1 - drDelta / 100));
  
  // Topical relevance factor (0.6 to 1.0)
  // High topical authority = easier
  const topicalFactor = Math.max(0.6, 1 - client.topicalAuthorityScore / 200);
  
  // Existing ranking factor (0.7 to 1.0)
  // Already ranking for related keywords = easier
  const rankingFactor = client.existingRankingPower < 20 
    ? 0.7 
    : client.existingRankingPower < 50 
      ? 0.85 
      : 1.0;
  
  const pkd = Math.round(baseDifficulty * authorityFactor * topicalFactor * rankingFactor);
  return Math.max(0, Math.min(100, pkd));
}

// Example:
// Base KD: 65
// Client DR: 55, SERP avg DR: 45 → authorityFactor = 0.9
// Topical authority: 70 → topicalFactor = 0.65
// Already ranking pos 15 for related → rankingFactor = 0.85
// PKD = 65 * 0.9 * 0.65 * 0.85 = 32
```

### 1.3 Signals That Actually Predict Rankability

Based on research, these signals correlate most with ranking success:

| Signal | Weight | How to Measure |
|--------|--------|----------------|
| Referring domains gap | 30% | Client RDs vs SERP median |
| Domain Rating gap | 20% | Client DR vs SERP avg DR |
| Topical authority | 20% | % of topic cluster covered |
| Content quality potential | 15% | Can client create better content? |
| SERP weakness | 15% | Forums, thin content in top 10? |

```typescript
interface RankabilityFactors {
  referringDomainsGap: number;    // Negative = client has more
  domainRatingGap: number;        // Negative = client is stronger
  topicalCoverage: number;        // 0-100
  contentQualityPotential: number; // 0-100
  serpWeakness: number;           // 0-100 (high = weak SERP)
}

function calculateRankabilityScore(factors: RankabilityFactors): number {
  // RD Gap: -50 to +50 normalized to 0-100 (inverted)
  const rdScore = Math.max(0, Math.min(100, 50 - factors.referringDomainsGap));
  
  // DR Gap: -30 to +30 normalized to 0-100 (inverted)
  const drScore = Math.max(0, Math.min(100, 50 - factors.domainRatingGap * 1.67));
  
  const score = 
    rdScore * 0.30 +
    drScore * 0.20 +
    factors.topicalCoverage * 0.20 +
    factors.contentQualityPotential * 0.15 +
    factors.serpWeakness * 0.15;
  
  return Math.round(score);
}
```

---

## 2. Intent-Based Filtering

### 2.1 Intent Classification Categories

| Intent | Description | Modifiers | Best For |
|--------|-------------|-----------|----------|
| Informational | Seeking knowledge | how, what, why, guide, tutorial | Blog posts, guides |
| Navigational | Finding specific site | brand names, login, official | Brand pages |
| Commercial | Comparing options | best, top, vs, review, comparison | Comparison pages |
| Transactional | Ready to act | buy, order, purchase, price, near me | Product/service pages |

### 2.2 Rule-Based Intent Classifier (Production-Ready)

```typescript
type SearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';

interface IntentClassification {
  intent: SearchIntent;
  confidence: number;
  signals: string[];
}

const INTENT_PATTERNS = {
  informational: {
    prefixes: ['how to', 'what is', 'what are', 'why do', 'why does', 'when to', 'where to'],
    suffixes: ['guide', 'tutorial', 'tips', 'ideas', 'examples', 'meaning', 'definition'],
    contains: ['how', 'what', 'why', 'when', 'where', 'explain', 'learn'],
    weight: 1.0,
  },
  navigational: {
    prefixes: [],
    suffixes: ['login', 'sign in', 'official', 'website', 'app', 'download'],
    contains: ['login', 'sign up', 'account', 'official'],
    // Brand detection handled separately
    weight: 1.2, // Higher confidence when matched
  },
  commercial: {
    prefixes: ['best', 'top', 'cheapest', 'affordable'],
    suffixes: ['review', 'reviews', 'vs', 'versus', 'comparison', 'alternative', 'alternatives'],
    contains: ['best', 'top 10', 'top 5', 'compare', 'vs', 'versus', 'review'],
    weight: 1.0,
  },
  transactional: {
    prefixes: ['buy', 'order', 'purchase', 'get', 'hire'],
    suffixes: ['price', 'prices', 'pricing', 'cost', 'for sale', 'near me', 'online', 'delivery'],
    contains: ['buy', 'order', 'purchase', 'price', 'discount', 'coupon', 'deal', 'cheap', 'for sale', 'near me'],
    weight: 1.0,
  },
};

function classifyIntent(keyword: string): IntentClassification {
  const normalized = keyword.toLowerCase().trim();
  const scores: Record<SearchIntent, { score: number; signals: string[] }> = {
    informational: { score: 0, signals: [] },
    navigational: { score: 0, signals: [] },
    commercial: { score: 0, signals: [] },
    transactional: { score: 0, signals: [] },
  };
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [SearchIntent, typeof INTENT_PATTERNS.informational][]) {
    // Check prefixes (strongest signal)
    for (const prefix of patterns.prefixes) {
      if (normalized.startsWith(prefix)) {
        scores[intent].score += 3 * patterns.weight;
        scores[intent].signals.push(`prefix:${prefix}`);
      }
    }
    
    // Check suffixes (strong signal)
    for (const suffix of patterns.suffixes) {
      if (normalized.endsWith(suffix)) {
        scores[intent].score += 2 * patterns.weight;
        scores[intent].signals.push(`suffix:${suffix}`);
      }
    }
    
    // Check contains (moderate signal)
    for (const term of patterns.contains) {
      if (normalized.includes(term)) {
        scores[intent].score += 1 * patterns.weight;
        scores[intent].signals.push(`contains:${term}`);
      }
    }
  }
  
  // Find highest scoring intent
  let maxIntent: SearchIntent = 'informational';
  let maxScore = 0;
  
  for (const [intent, data] of Object.entries(scores) as [SearchIntent, { score: number; signals: string[] }][]) {
    if (data.score > maxScore) {
      maxScore = data.score;
      maxIntent = intent;
    }
  }
  
  // Default to informational if no signals (most common)
  if (maxScore === 0) {
    maxIntent = 'informational';
    maxScore = 1;
  }
  
  // Calculate confidence (0-100)
  const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
  const confidence = totalScore > 0 
    ? Math.min(100, Math.round((maxScore / totalScore) * 100))
    : 50;
  
  return {
    intent: maxIntent,
    confidence,
    signals: scores[maxIntent].signals,
  };
}

// Examples:
// "how to install sauna" → informational (prefix: how to)
// "best barrel sauna 2024" → commercial (prefix: best)
// "buy sauna heater" → transactional (prefix: buy)
// "Harvia heater reviews" → commercial (suffix: reviews)
```

### 2.3 Intent Priority by Business Type

```typescript
type BusinessType = 'ecommerce' | 'saas' | 'local' | 'publisher' | 'b2b';

const INTENT_PRIORITIES: Record<BusinessType, Record<SearchIntent, number>> = {
  ecommerce: {
    transactional: 1.0,   // Highest priority
    commercial: 0.9,
    informational: 0.5,
    navigational: 0.3,
  },
  saas: {
    commercial: 1.0,      // Comparison shopping
    transactional: 0.9,
    informational: 0.7,   // Education important
    navigational: 0.4,
  },
  local: {
    transactional: 1.0,   // "near me" queries
    navigational: 0.8,    // Brand searches
    commercial: 0.7,
    informational: 0.4,
  },
  publisher: {
    informational: 1.0,   // Content is the product
    commercial: 0.8,
    navigational: 0.5,
    transactional: 0.3,
  },
  b2b: {
    commercial: 1.0,      // Long research cycle
    informational: 0.9,
    transactional: 0.7,
    navigational: 0.4,
  },
};

function getIntentPriorityMultiplier(
  businessType: BusinessType,
  intent: SearchIntent
): number {
  return INTENT_PRIORITIES[businessType][intent];
}
```

---

## 3. Opportunity Scoring Formulas

### 3.1 Current Implementation (Basic)

From existing codebase (`dataforseoKeywordGap.ts`):

```typescript
// Basic formula: Volume × CPC × (100 - Difficulty) / 100
function calculateOpportunityScore(gap: KeywordGap): number {
  const { searchVolume, cpc, difficulty } = gap;
  if (searchVolume <= 0 || cpc <= 0) return 0;
  if (difficulty >= 100) return 0;
  
  const difficultyFactor = (100 - difficulty) / 100;
  return Math.round(searchVolume * cpc * difficultyFactor);
}
```

### 3.2 Enhanced Opportunity Scoring (Production Formula)

```typescript
interface EnhancedOpportunityInput {
  // Core metrics
  searchVolume: number;
  cpc: number;
  difficulty: number;           // Generic KD
  personalDifficulty: number;   // Client-specific KD
  
  // Position data (if available)
  currentPosition: number | null;
  
  // Intent & business alignment
  intent: SearchIntent;
  businessType: BusinessType;
  
  // Additional signals
  trendDirection: 'rising' | 'stable' | 'falling';
  serpWeakness: number;         // 0-100
}

interface OpportunityScore {
  total: number;
  breakdown: {
    trafficValue: number;
    rankability: number;
    businessFit: number;
    momentum: number;
  };
  quadrant: 'quick_win' | 'major_project' | 'fill_in' | 'thankless';
}

/**
 * Enhanced Opportunity Score Formula
 * 
 * Components:
 * 1. Traffic Value = Volume × CPC (potential revenue)
 * 2. Rankability = (100 - PKD) × SERP Weakness bonus
 * 3. Business Fit = Intent alignment × conversion potential
 * 4. Momentum = Trend bonus/penalty + striking distance bonus
 * 
 * Final Score = TrafficValue × Rankability × BusinessFit × Momentum
 */
function calculateEnhancedOpportunityScore(
  input: EnhancedOpportunityInput
): OpportunityScore {
  const {
    searchVolume,
    cpc,
    personalDifficulty,
    currentPosition,
    intent,
    businessType,
    trendDirection,
    serpWeakness,
  } = input;
  
  // 1. Traffic Value (normalized to 0-100 scale)
  const rawTrafficValue = searchVolume * cpc;
  const trafficValue = Math.min(100, Math.log10(rawTrafficValue + 1) * 20);
  
  // 2. Rankability (0-100)
  // Lower PKD = higher rankability
  // SERP weakness adds bonus
  const baseRankability = 100 - personalDifficulty;
  const serpBonus = serpWeakness * 0.2; // Up to 20 point bonus
  const rankability = Math.min(100, baseRankability + serpBonus);
  
  // 3. Business Fit (0-100)
  const intentMultiplier = getIntentPriorityMultiplier(businessType, intent);
  const businessFit = intentMultiplier * 100;
  
  // 4. Momentum (0.5 to 1.5 multiplier)
  let momentum = 1.0;
  
  // Trend bonus/penalty
  if (trendDirection === 'rising') momentum += 0.2;
  if (trendDirection === 'falling') momentum -= 0.3;
  
  // Striking distance bonus (position 5-20)
  if (currentPosition !== null && currentPosition >= 5 && currentPosition <= 20) {
    // Position 5 = 0.4 bonus, Position 20 = 0.1 bonus
    const strikingBonus = 0.4 - ((currentPosition - 5) / 15) * 0.3;
    momentum += strikingBonus;
  }
  
  // Calculate total score
  const total = Math.round(
    (trafficValue * 0.30 + rankability * 0.35 + businessFit * 0.25) * momentum
  );
  
  // Determine quadrant
  const impactScore = trafficValue * 0.6 + businessFit * 0.4;
  const effortScore = personalDifficulty;
  const quadrant = determineQuadrant(impactScore, effortScore);
  
  return {
    total: Math.max(0, Math.min(100, total)),
    breakdown: {
      trafficValue,
      rankability,
      businessFit,
      momentum: Math.round(momentum * 100 - 100), // As +/- percentage
    },
    quadrant,
  };
}

function determineQuadrant(
  impact: number,
  effort: number
): 'quick_win' | 'major_project' | 'fill_in' | 'thankless' {
  const impactThreshold = 50;
  const effortThreshold = 50;
  
  if (impact >= impactThreshold && effort < effortThreshold) return 'quick_win';
  if (impact >= impactThreshold && effort >= effortThreshold) return 'major_project';
  if (impact < impactThreshold && effort < effortThreshold) return 'fill_in';
  return 'thankless';
}
```

### 3.3 Striking Distance Scoring

```typescript
interface StrikingDistanceKeyword {
  keyword: string;
  currentPosition: number;
  searchVolume: number;
  cpc: number;
  impressions: number;
  clicks: number;
}

/**
 * Striking Distance Score for keywords ranking 5-20.
 * 
 * Prioritizes:
 * 1. Higher positions (5 is easier to push to top 3 than 18)
 * 2. Higher volume (more reward for ranking up)
 * 3. Higher CTR potential gain (position 11→3 gains more CTR than 6→3)
 */
function calculateStrikingDistanceScore(kw: StrikingDistanceKeyword): number {
  // CTR by position (industry benchmarks)
  const ctrByPosition: Record<number, number> = {
    1: 0.285, 2: 0.157, 3: 0.110, 4: 0.080, 5: 0.065,
    6: 0.055, 7: 0.045, 8: 0.040, 9: 0.035, 10: 0.030,
    11: 0.020, 12: 0.018, 13: 0.016, 14: 0.014, 15: 0.012,
    16: 0.010, 17: 0.009, 18: 0.008, 19: 0.007, 20: 0.006,
  };
  
  const currentCTR = ctrByPosition[kw.currentPosition] ?? 0.005;
  const targetCTR = ctrByPosition[3]; // Target top 3
  const ctrGain = targetCTR - currentCTR;
  
  // Potential monthly traffic gain
  const trafficGain = kw.searchVolume * ctrGain;
  
  // Value of that traffic
  const valueGain = trafficGain * kw.cpc;
  
  // Position ease factor (closer = easier)
  const positionFactor = 1 + (20 - kw.currentPosition) / 20;
  
  return Math.round(valueGain * positionFactor);
}

// Example: Position 8, 5000 volume, $3 CPC
// CTR gain: 0.110 - 0.040 = 0.070
// Traffic gain: 5000 * 0.070 = 350
// Value gain: 350 * 3 = $1050
// Position factor: 1 + (20-8)/20 = 1.6
// Score: 1050 * 1.6 = 1680
```

---

## 4. Topical Relevance Scoring

### 4.1 TF-IDF Based Relevance

```typescript
interface TfIdfResult {
  term: string;
  tfidf: number;
}

/**
 * Calculate TF-IDF relevance between keyword and domain's content.
 * 
 * TF-IDF = (termFrequency / totalTerms) * log(totalDocs / docsContainingTerm)
 */
function calculateTfIdf(
  term: string,
  document: string,
  corpus: string[]
): number {
  const terms = document.toLowerCase().split(/\W+/);
  const termFrequency = terms.filter(t => t === term.toLowerCase()).length;
  const totalTerms = terms.length;
  
  if (totalTerms === 0) return 0;
  
  const tf = termFrequency / totalTerms;
  
  const docsWithTerm = corpus.filter(doc => 
    doc.toLowerCase().includes(term.toLowerCase())
  ).length;
  const idf = Math.log((corpus.length + 1) / (docsWithTerm + 1)) + 1;
  
  return tf * idf;
}

/**
 * Score keyword relevance to client's existing content.
 */
function scoreKeywordRelevance(
  keyword: string,
  clientPages: { url: string; content: string }[]
): number {
  const keywordTerms = keyword.toLowerCase().split(/\W+/);
  const corpus = clientPages.map(p => p.content);
  
  let totalRelevance = 0;
  
  for (const page of clientPages) {
    let pageRelevance = 0;
    for (const term of keywordTerms) {
      const tfidf = calculateTfIdf(term, page.content, corpus);
      pageRelevance += tfidf;
    }
    totalRelevance = Math.max(totalRelevance, pageRelevance);
  }
  
  // Normalize to 0-100
  return Math.min(100, Math.round(totalRelevance * 50));
}
```

### 4.2 Embedding Similarity (Modern Approach)

```typescript
interface EmbeddingVector {
  dimensions: number[];
}

/**
 * Calculate cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.dimensions.length !== b.dimensions.length) {
    throw new Error('Vectors must have same dimensions');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.dimensions.length; i++) {
    dotProduct += a.dimensions[i] * b.dimensions[i];
    normA += a.dimensions[i] ** 2;
    normB += b.dimensions[i] ** 2;
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Score keyword relevance using embeddings.
 * 
 * Uses pre-computed embeddings of:
 * 1. Keyword text
 * 2. Client's top pages / product descriptions
 * 3. Client's topic cluster centroids
 */
async function scoreKeywordRelevanceEmbeddings(
  keywordEmbedding: EmbeddingVector,
  contentEmbeddings: EmbeddingVector[],
  clusterCentroids: EmbeddingVector[]
): Promise<number> {
  // Find max similarity to any content page
  let maxContentSimilarity = 0;
  for (const content of contentEmbeddings) {
    const similarity = cosineSimilarity(keywordEmbedding, content);
    maxContentSimilarity = Math.max(maxContentSimilarity, similarity);
  }
  
  // Find max similarity to any topic cluster
  let maxClusterSimilarity = 0;
  for (const cluster of clusterCentroids) {
    const similarity = cosineSimilarity(keywordEmbedding, cluster);
    maxClusterSimilarity = Math.max(maxClusterSimilarity, similarity);
  }
  
  // Weighted combination (content match more important)
  const weightedSimilarity = 
    maxContentSimilarity * 0.6 + maxClusterSimilarity * 0.4;
  
  // Convert to 0-100 score
  return Math.round(weightedSimilarity * 100);
}
```

### 4.3 Category/Cluster Matching

```typescript
interface TopicCluster {
  id: string;
  name: string;
  pillarKeywords: string[];
  supportingKeywords: string[];
  targetPageType: 'category' | 'product' | 'blog' | 'service';
}

/**
 * Match keyword to appropriate topic cluster.
 */
function matchKeywordToCluster(
  keyword: string,
  clusters: TopicCluster[]
): { clusterId: string; matchScore: number; pageType: string } | null {
  const normalizedKeyword = keyword.toLowerCase();
  
  let bestMatch: { clusterId: string; score: number; pageType: string } | null = null;
  
  for (const cluster of clusters) {
    let score = 0;
    
    // Check pillar keywords (strong match)
    for (const pillar of cluster.pillarKeywords) {
      if (normalizedKeyword.includes(pillar.toLowerCase())) {
        score += 3;
      }
      // Jaccard similarity for partial matches
      const jaccardScore = jaccardSimilarity(
        normalizedKeyword.split(' '),
        pillar.toLowerCase().split(' ')
      );
      score += jaccardScore * 2;
    }
    
    // Check supporting keywords (moderate match)
    for (const supporting of cluster.supportingKeywords) {
      if (normalizedKeyword.includes(supporting.toLowerCase())) {
        score += 1;
      }
    }
    
    if (bestMatch === null || score > bestMatch.score) {
      bestMatch = {
        clusterId: cluster.id,
        score,
        pageType: cluster.targetPageType,
      };
    }
  }
  
  if (bestMatch && bestMatch.score > 0) {
    return {
      clusterId: bestMatch.clusterId,
      matchScore: Math.min(100, bestMatch.score * 20),
      pageType: bestMatch.pageType,
    };
  }
  
  return null;
}

function jaccardSimilarity(set1: string[], set2: string[]): number {
  const intersection = set1.filter(item => set2.includes(item)).length;
  const union = new Set([...set1, ...set2]).size;
  return union === 0 ? 0 : intersection / union;
}
```

---

## 5. Client Constraint Matching

### 5.1 Rules Engine Design

```typescript
type ConstraintOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'in_list'
  | 'not_in_list'
  | 'matches_regex';

interface FilterRule {
  id: string;
  name: string;
  field: keyof KeywordData;
  operator: ConstraintOperator;
  value: string | number | string[];
  action: 'include' | 'exclude' | 'boost' | 'penalize';
  boostFactor?: number; // For boost/penalize actions
}

interface FilterRuleSet {
  id: string;
  name: string;
  description: string;
  rules: FilterRule[];
  combinator: 'AND' | 'OR';
}

interface KeywordData {
  keyword: string;
  intent: SearchIntent;
  category: string;
  pageType: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  position: number | null;
  hasLocalModifier: boolean;
  wordCount: number;
}
```

### 5.2 Built-in Filter Templates

```typescript
const FILTER_TEMPLATES: Record<string, FilterRuleSet> = {
  // "Only category pages"
  category_pages_only: {
    id: 'category_pages_only',
    name: 'Category Pages Only',
    description: 'Filter to keywords suitable for category/collection pages',
    combinator: 'OR',
    rules: [
      {
        id: 'category-page-type',
        name: 'Page type is category',
        field: 'pageType',
        operator: 'equals',
        value: 'category',
        action: 'include',
      },
      {
        id: 'category-broad-terms',
        name: 'Broad category terms',
        field: 'wordCount',
        operator: 'less_than',
        value: 3,
        action: 'boost',
        boostFactor: 1.3,
      },
    ],
  },
  
  // "Only transactional keywords"
  transactional_only: {
    id: 'transactional_only',
    name: 'Transactional Keywords Only',
    description: 'Filter to buying-intent keywords',
    combinator: 'AND',
    rules: [
      {
        id: 'transactional-intent',
        name: 'Intent is transactional',
        field: 'intent',
        operator: 'equals',
        value: 'transactional',
        action: 'include',
      },
      {
        id: 'exclude-informational',
        name: 'Exclude informational',
        field: 'intent',
        operator: 'equals',
        value: 'informational',
        action: 'exclude',
      },
    ],
  },
  
  // "Commercial + Transactional"
  buying_intent: {
    id: 'buying_intent',
    name: 'Buying Intent Keywords',
    description: 'Commercial investigation and transactional keywords',
    combinator: 'OR',
    rules: [
      {
        id: 'commercial-intent',
        name: 'Intent is commercial',
        field: 'intent',
        operator: 'in_list',
        value: ['commercial', 'transactional'],
        action: 'include',
      },
    ],
  },
  
  // "Local keywords only"
  local_only: {
    id: 'local_only',
    name: 'Local Keywords Only',
    description: 'Keywords with location modifiers',
    combinator: 'AND',
    rules: [
      {
        id: 'has-local-modifier',
        name: 'Has location modifier',
        field: 'hasLocalModifier',
        operator: 'equals',
        value: true,
        action: 'include',
      },
    ],
  },
  
  // "Exclude branded keywords"
  exclude_branded: {
    id: 'exclude_branded',
    name: 'Exclude Competitor Brands',
    description: 'Remove keywords containing competitor brand names',
    combinator: 'AND',
    rules: [
      {
        id: 'exclude-brands',
        name: 'Exclude brand names',
        field: 'keyword',
        operator: 'not_contains',
        value: '', // Dynamically populated with competitor brands
        action: 'exclude',
      },
    ],
  },
  
  // "Volume threshold"
  minimum_volume: {
    id: 'minimum_volume',
    name: 'Minimum Search Volume',
    description: 'Only keywords with meaningful volume',
    combinator: 'AND',
    rules: [
      {
        id: 'min-volume',
        name: 'Volume >= threshold',
        field: 'searchVolume',
        operator: 'greater_than',
        value: 100, // Configurable
        action: 'include',
      },
    ],
  },
  
  // "Striking distance"
  striking_distance: {
    id: 'striking_distance',
    name: 'Striking Distance Keywords',
    description: 'Keywords ranking 5-20',
    combinator: 'AND',
    rules: [
      {
        id: 'min-position',
        name: 'Position >= 5',
        field: 'position',
        operator: 'greater_than',
        value: 4,
        action: 'include',
      },
      {
        id: 'max-position',
        name: 'Position <= 20',
        field: 'position',
        operator: 'less_than',
        value: 21,
        action: 'include',
      },
    ],
  },
};
```

### 5.3 Rules Engine Implementation

```typescript
class KeywordFilterEngine {
  private rules: FilterRuleSet[];
  
  constructor(rules: FilterRuleSet[]) {
    this.rules = rules;
  }
  
  /**
   * Apply all rule sets and return filtered, scored keywords.
   */
  filter(keywords: KeywordData[]): { keyword: KeywordData; adjustedScore: number }[] {
    return keywords
      .map(kw => {
        const result = this.evaluateKeyword(kw);
        return result.include 
          ? { keyword: kw, adjustedScore: result.scoreMultiplier }
          : null;
      })
      .filter((result): result is NonNullable<typeof result> => result !== null);
  }
  
  private evaluateKeyword(kw: KeywordData): { include: boolean; scoreMultiplier: number } {
    let include = true;
    let scoreMultiplier = 1.0;
    
    for (const ruleSet of this.rules) {
      const ruleResults = ruleSet.rules.map(rule => this.evaluateRule(kw, rule));
      
      const matches = ruleSet.combinator === 'AND'
        ? ruleResults.every(r => r.matches)
        : ruleResults.some(r => r.matches);
      
      // Apply actions from matching rules
      for (const result of ruleResults) {
        if (!result.matches) continue;
        
        switch (result.action) {
          case 'exclude':
            include = false;
            break;
          case 'boost':
            scoreMultiplier *= result.boostFactor ?? 1.2;
            break;
          case 'penalize':
            scoreMultiplier *= result.boostFactor ?? 0.8;
            break;
        }
      }
    }
    
    return { include, scoreMultiplier };
  }
  
  private evaluateRule(kw: KeywordData, rule: FilterRule): {
    matches: boolean;
    action: FilterRule['action'];
    boostFactor?: number;
  } {
    const fieldValue = kw[rule.field];
    let matches = false;
    
    switch (rule.operator) {
      case 'equals':
        matches = fieldValue === rule.value;
        break;
      case 'not_equals':
        matches = fieldValue !== rule.value;
        break;
      case 'contains':
        matches = typeof fieldValue === 'string' && 
          fieldValue.toLowerCase().includes((rule.value as string).toLowerCase());
        break;
      case 'not_contains':
        matches = typeof fieldValue === 'string' && 
          !fieldValue.toLowerCase().includes((rule.value as string).toLowerCase());
        break;
      case 'starts_with':
        matches = typeof fieldValue === 'string' && 
          fieldValue.toLowerCase().startsWith((rule.value as string).toLowerCase());
        break;
      case 'ends_with':
        matches = typeof fieldValue === 'string' && 
          fieldValue.toLowerCase().endsWith((rule.value as string).toLowerCase());
        break;
      case 'greater_than':
        matches = typeof fieldValue === 'number' && fieldValue > (rule.value as number);
        break;
      case 'less_than':
        matches = typeof fieldValue === 'number' && fieldValue < (rule.value as number);
        break;
      case 'in_list':
        matches = (rule.value as string[]).includes(String(fieldValue));
        break;
      case 'not_in_list':
        matches = !(rule.value as string[]).includes(String(fieldValue));
        break;
      case 'matches_regex':
        try {
          matches = new RegExp(rule.value as string, 'i').test(String(fieldValue));
        } catch {
          matches = false;
        }
        break;
    }
    
    return {
      matches,
      action: rule.action,
      boostFactor: rule.boostFactor,
    };
  }
}
```

---

## 6. Complete Prioritization Pipeline

### 6.1 Full Algorithm Flow

```typescript
interface PrioritizationConfig {
  clientProfile: ClientProfile;
  businessType: BusinessType;
  constraints: FilterRuleSet[];
  targetKeywordCount: number;
}

interface PrioritizedKeyword {
  keyword: string;
  finalScore: number;
  breakdown: {
    opportunityScore: number;
    relevanceScore: number;
    intentScore: number;
    constraintMultiplier: number;
  };
  quadrant: 'quick_win' | 'major_project' | 'fill_in' | 'thankless';
  intent: SearchIntent;
  suggestedPageType: string;
}

async function prioritizeKeywords(
  discoveredKeywords: KeywordData[],
  config: PrioritizationConfig
): Promise<PrioritizedKeyword[]> {
  const results: PrioritizedKeyword[] = [];
  
  // 1. Apply constraint filters
  const filterEngine = new KeywordFilterEngine(config.constraints);
  const filtered = filterEngine.filter(discoveredKeywords);
  
  // 2. Calculate scores for each keyword
  for (const { keyword, adjustedScore } of filtered) {
    // Intent classification
    const intent = classifyIntent(keyword.keyword);
    
    // Personal difficulty
    const serpData = await fetchSerpCompetitors(keyword.keyword);
    const personalDifficulty = calculatePersonalDifficulty(
      keyword.difficulty,
      config.clientProfile,
      serpData
    );
    
    // Enhanced opportunity score
    const opportunity = calculateEnhancedOpportunityScore({
      searchVolume: keyword.searchVolume,
      cpc: keyword.cpc,
      difficulty: keyword.difficulty,
      personalDifficulty,
      currentPosition: keyword.position,
      intent: intent.intent,
      businessType: config.businessType,
      trendDirection: 'stable', // Would come from GSC data
      serpWeakness: await calculateSerpWeakness(keyword.keyword),
    });
    
    // Relevance score (would use embeddings in production)
    const relevance = keyword.category ? 80 : 50;
    
    // Intent score based on business type
    const intentScore = getIntentPriorityMultiplier(
      config.businessType,
      intent.intent
    ) * 100;
    
    // Final score with constraint multiplier
    const finalScore = Math.round(
      (opportunity.total * 0.5 + relevance * 0.3 + intentScore * 0.2) * adjustedScore
    );
    
    results.push({
      keyword: keyword.keyword,
      finalScore,
      breakdown: {
        opportunityScore: opportunity.total,
        relevanceScore: relevance,
        intentScore,
        constraintMultiplier: adjustedScore,
      },
      quadrant: opportunity.quadrant,
      intent: intent.intent,
      suggestedPageType: keyword.pageType,
    });
  }
  
  // 3. Sort by final score and limit to target count
  results.sort((a, b) => b.finalScore - a.finalScore);
  
  // 4. Ensure diversity (max 30% from any one quadrant)
  const diversified = ensureQuadrantDiversity(results, config.targetKeywordCount);
  
  return diversified.slice(0, config.targetKeywordCount);
}

function ensureQuadrantDiversity(
  keywords: PrioritizedKeyword[],
  targetCount: number
): PrioritizedKeyword[] {
  const maxPerQuadrant = Math.ceil(targetCount * 0.3);
  const counts: Record<string, number> = {
    quick_win: 0,
    major_project: 0,
    fill_in: 0,
    thankless: 0,
  };
  
  const result: PrioritizedKeyword[] = [];
  const overflow: PrioritizedKeyword[] = [];
  
  for (const kw of keywords) {
    if (counts[kw.quadrant] < maxPerQuadrant) {
      result.push(kw);
      counts[kw.quadrant]++;
    } else {
      overflow.push(kw);
    }
  }
  
  // Fill remaining slots from overflow
  const remaining = targetCount - result.length;
  result.push(...overflow.slice(0, remaining));
  
  return result;
}
```

---

## 7. DataForSEO Integration Points

### 7.1 Relevant API Endpoints

| Endpoint | Purpose | Cost |
|----------|---------|------|
| `/v3/dataforseo_labs/google/bulk_keyword_difficulty/live` | Bulk KD for up to 1000 keywords | ~$0.05 |
| `/v3/dataforseo_labs/google/domain_intersection/live` | Gap analysis between domains | ~$0.02-0.05 |
| `/v3/dataforseo_labs/google/ranked_keywords/live` | Keywords a domain ranks for | ~$0.05 |
| `/v3/dataforseo_labs/google/competitors_domain/live` | Competitor discovery | ~$0.02 |
| `/v3/keywords_data/google_ads/search_volume/live` | Volume, CPC for keywords | ~$0.05/1000 |

### 7.2 Data Available from DataForSEO

From `bulk_keyword_difficulty`:
- `keyword_difficulty` (0-100)
- `search_volume`
- `competition` (0-1)
- `cpc`
- `keyword_info.categories` (topic categories)
- `keyword_info.search_intent` (I/N/C/T)

---

## 8. Recommended Implementation for Phase 1

### 8.1 Priority 1: Basic Scoring (Week 1)

1. Use existing opportunity formula: `Volume × CPC × (100 - KD) / 100`
2. Add intent classification (rule-based)
3. Add striking distance detection

### 8.2 Priority 2: Client-Specific Difficulty (Week 2)

1. Calculate client DR vs SERP average
2. Detect topical authority from existing rankings
3. Implement PKD formula

### 8.3 Priority 3: Constraint Engine (Week 3)

1. Implement filter rule engine
2. Create preset templates
3. Add UI for custom rules

### 8.4 Priority 4: Advanced Relevance (Week 4)

1. Integrate embeddings (Gemini text-embedding-004)
2. Topic cluster matching
3. Full enhanced opportunity scoring

---

## Sources

- [Keyword Difficulty: Semrush vs Ahrefs](https://www.drafthorseai.com/post/keyword-difficulty-semrush-vs-ahrefs)
- [What is keyword difficulty & how to use it for organic growth 2026](https://growthmindedmarketing.com/blog/what-is-seo-keyword-difficulty/)
- [Semrush vs Ahrefs 2026: AI SEO Features Compared](https://www.demandsage.com/semrush-vs-ahrefs/)
- [Keyword Difficulty: How to Estimate Your Chances to Rank](https://ahrefs.com/blog/keyword-difficulty/)
- [Personal Keyword Difficulty Score - Semrush](https://www.semrush.com/kb/1158-what-is-kd)
- [Intent Classification 2026 Techniques for NLP Models](https://labelyourdata.com/articles/machine-learning/intent-classification)
- [Classifying Search Intent](https://www.contentharmony.com/blog/classifying-search-intent/)
- [Keyword Intent Tool - Keyword Insights](https://www.keywordinsights.ai/features/search-intent/)
- [Keyword Opportunity Score Calculation](https://hmdigitalsolution.com/keyword-opportunity-score-calculation/)
- [Striking Distance Keywords - Clearscope](https://www.clearscope.io/blog/what-are-striking-distance-keywords)
- [Python + Streamlit Striking Distance Keywords](https://www.searchenginejournal.com/python-seo-striking-distance/423009/)
- [SEO Opportunity - SEOmonitor](https://help.seomonitor.com/en/articles/6222130-seo-opportunity)
- [TF-IDF vs Embeddings - PyImageSearch](https://pyimagesearch.com/2026/02/09/tf-idf-vs-embeddings-from-keywords-to-semantic-search/)
- [TF-IDF for SEO Guide](https://diggitymarketing.com/tfidf-for-seo/)
- [DataForSEO Labs API](https://dataforseo.com/apis/dataforseo-labs-api)
- [DataForSEO Keyword Difficulty](https://dataforseo.com/blog/introducing-keyword-difficulty-3-ways-to-leverage-the-new-metric)
- [DataForSEO Bulk Keyword Difficulty API](https://docs.dataforseo.com/v3/dataforseo_labs-google-bulk_keyword_difficulty-live/)
- [eCommerce Keyword Research Strategy](https://www.postdigitalist.xyz/blog/ecommerce-keyword-research)
- [SEO Keyword Value Calculator](https://taglab.net/calculators/seo-keyword-value-calculator-formula/)
