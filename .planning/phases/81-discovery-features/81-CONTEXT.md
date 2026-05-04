# Phase 81: Discovery Features - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Detect pSEO template opportunities and discover side keywords via problem→solution mapping. This is the "expansion" layer that finds opportunities beyond the initial keyword list.

**pSEO Detection Problem:**
User uploads 2000 keywords, many follow patterns:
- "automobilių plovykla vilniuje"
- "automobilių plovykla kaune"
- "automobilių plovykla klaipėdoje"
- "automobilių plovykla šiauliuose"

These should be flagged as ONE pSEO opportunity with template: `/plovykla/{city}` — not 50 separate keywords.

**Side Keyword Discovery Problem:**
Client conversation mentions "plaukų priežiūra" but the keyword list doesn't include problem-framed searches like:
- "kaip sustabdyti plaukų slinkimą" (problem)
- "sausų plaukų gydymas" (problem)
- "šampūnas nuo pleiskanų" (solution)

These are adjacent keywords the analysis should surface via DataForSEO keyword ideas.

</domain>

<decisions>
## Implementation Decisions

### pSEO Detection Algorithm

```typescript
interface PSEOCluster {
  pattern: string;             // "[service] [CITY]" or "[product] [CITY]"
  template: string;            // "/plovykla/{city}"
  keywords: string[];          // All matching keywords
  cities: string[];            // Extracted cities
  estimatedPages: number;      // 50+ Lithuanian cities
  totalVolume: number;         // Sum of all keyword volumes
  avgDifficulty: number;       // Average difficulty
  opportunityScore: number;    // Combined value metric
}

// Detection algorithm
function detectPSEOPatterns(
  keywords: ClassifiedKeyword[],
  cities: LithuanianCity[]
): PSEOCluster[] {
  // 1. Group keywords by "keyword without city"
  const groups = new Map<string, ClassifiedKeyword[]>();
  
  for (const kw of keywords) {
    const withoutCity = extractKeywordWithoutCity(kw.keyword, cities);
    if (withoutCity !== kw.keyword) {  // Had a city
      const existing = groups.get(withoutCity) || [];
      existing.push(kw);
      groups.set(withoutCity, existing);
    }
  }
  
  // 2. Filter to clusters with 3+ cities
  const clusters: PSEOCluster[] = [];
  for (const [base, kwList] of groups) {
    if (kwList.length >= 3) {  // Minimum cluster size
      const extractedCities = kwList.map(k => extractCity(k.keyword, cities));
      clusters.push({
        pattern: `${base} [CITY]`,
        template: generateURLTemplate(base),
        keywords: kwList.map(k => k.keyword),
        cities: [...new Set(extractedCities)],
        estimatedPages: LITHUANIAN_CITIES.length,  // 50+ pages potential
        totalVolume: kwList.reduce((sum, k) => sum + k.volume, 0),
        avgDifficulty: kwList.reduce((sum, k) => sum + k.difficulty, 0) / kwList.length,
        opportunityScore: computePSEOScore(kwList),
      });
    }
  }
  
  // 3. Sort by opportunity score
  return clusters.sort((a, b) => b.opportunityScore - a.opportunityScore);
}
```

### pSEO Opportunity Scoring

```typescript
function computePSEOScore(cluster: ClassifiedKeyword[]): number {
  const weights = {
    totalVolume: 0.35,
    cityCount: 0.25,
    avgDifficulty: 0.20,  // Lower = better
    funnelValue: 0.20,    // BOFU = 1.0, MOFU = 0.7, TOFU = 0.4
  };
  
  const volumeScore = Math.min(cluster.totalVolume / 5000, 1.0);
  const cityScore = Math.min(cluster.cities.length / 10, 1.0);
  const difficultyScore = 1 - (cluster.avgDifficulty / 100);
  const funnelScore = cluster.reduce((sum, k) => 
    sum + (k.funnelStage === 'bofu' ? 1.0 : k.funnelStage === 'mofu' ? 0.7 : 0.4), 0
  ) / cluster.length;
  
  return (
    volumeScore * weights.totalVolume +
    cityScore * weights.cityCount +
    difficultyScore * weights.avgDifficulty +
    funnelScore * weights.funnelValue
  );
}
```

### Side Keyword Discovery

```typescript
interface SideKeywordExpansion {
  source: 'problem' | 'solution' | 'related';
  seedTerm: string;           // Original problem/solution from conversation
  discoveredKeywords: SideKeyword[];
  expansionMethod: string;    // "dataforseo_keyword_ideas" | "semantic_expansion"
}

interface SideKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  relevanceScore: number;     // From Phase 78 scoring
  passesFilters: boolean;     // From Phase 79 filtering
  discoverySource: string;    // Which seed term found this
}

// Discovery algorithm
async function discoverSideKeywords(
  constraints: AnalysisConstraints,
  existingKeywords: Set<string>
): Promise<SideKeywordExpansion[]> {
  const expansions: SideKeywordExpansion[] = [];
  
  // 1. Extract problems from conversation
  const problems = constraints.businessContext.problemsSolved;
  // e.g., ["plaukų slinkimas", "sausa oda", "riebi galvos oda"]
  
  // 2. For each problem, get DataForSEO keyword ideas
  for (const problem of problems) {
    const ideas = await dataForSEO.getKeywordIdeas({
      seed: problem,
      locationCode: 2440,  // Lithuania
      limit: 100,
    });
    
    // 3. Filter to new keywords only
    const newKeywords = ideas.filter(k => !existingKeywords.has(k.keyword));
    
    // 4. Score relevance (Phase 78)
    const scored = await relevanceScorer.score(newKeywords, constraints);
    
    // 5. Filter by constraints (Phase 79)
    const filtered = await constraintFilter.filter(scored, constraints);
    
    expansions.push({
      source: 'problem',
      seedTerm: problem,
      discoveredKeywords: filtered.passed.map(k => ({
        keyword: k.keyword,
        volume: k.volume,
        difficulty: k.difficulty,
        relevanceScore: k.relevanceScores.combinedScore,
        passesFilters: true,
        discoverySource: problem,
      })),
      expansionMethod: 'dataforseo_keyword_ideas',
    });
  }
  
  return expansions;
}
```

### Product/Service Linkage

```typescript
interface ProductLinkage {
  keyword: string;
  linkedProducts: LinkedProduct[];
  linkageConfidence: number;
  suggestedLandingPage: string;
}

interface LinkedProduct {
  productName: string;
  category: string;
  matchReason: string;  // "solves_problem", "direct_match", "category_match"
}

// Link keywords to products/services
async function linkKeywordsToProducts(
  keywords: ClassifiedKeyword[],
  products: Product[],  // From client's catalog
): Promise<ProductLinkage[]> {
  const linkages: ProductLinkage[] = [];
  
  for (const kw of keywords) {
    const matches: LinkedProduct[] = [];
    
    // 1. Direct product name match
    const directMatch = products.find(p => 
      kw.keyword.toLowerCase().includes(p.name.toLowerCase())
    );
    if (directMatch) {
      matches.push({
        productName: directMatch.name,
        category: directMatch.category,
        matchReason: 'direct_match',
      });
    }
    
    // 2. Problem → solution match
    const problemMatch = products.find(p =>
      p.solvedProblems.some(prob => kw.keyword.includes(prob))
    );
    if (problemMatch) {
      matches.push({
        productName: problemMatch.name,
        category: problemMatch.category,
        matchReason: 'solves_problem',
      });
    }
    
    // 3. Category match (embedding similarity)
    // ... use Phase 78 relevance scoring
    
    linkages.push({
      keyword: kw.keyword,
      linkedProducts: matches,
      linkageConfidence: matches.length > 0 ? 0.8 : 0.3,
      suggestedLandingPage: matches[0]?.category 
        ? `/products/${matches[0].category}`
        : '/products',
    });
  }
  
  return linkages;
}
```

### Discovery Output

```typescript
interface DiscoveryResult {
  pseoOpportunities: PSEOCluster[];
  sideKeywords: SideKeywordExpansion[];
  productLinkages: ProductLinkage[];
  recommendations: DiscoveryRecommendation[];
  metadata: {
    totalPSEOPages: number;    // Sum of estimatedPages
    totalSideKeywords: number;
    linkageRate: number;       // % of keywords with product match
  };
}

interface DiscoveryRecommendation {
  type: 'pseo_template' | 'content_gap' | 'product_page' | 'category_page';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  keywords: string[];
  estimatedImpact: {
    volume: number;
    pages: number;
  };
}
```

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/keywords/services/DataForSEOService.ts` — Keyword ideas API
- `open-seo-main/src/server/features/keywords/classification/` — Existing classifiers

</references>

<existing_code>
## Existing Infrastructure

### DataForSEO Integration
- `getKeywordIdeas()` exists
- Returns related keywords with volume/difficulty
- **Gap:** No problem→solution expansion workflow

### Keyword Clustering
- Basic clustering by similarity exists
- **Gap:** No pSEO pattern detection, no city extraction

</existing_code>

<success_criteria>
## Success Criteria

1. pSEO clusters with 3+ city variations detected
2. Template recommendations actionable (URL pattern, content strategy)
3. pSEO opportunity score correlates with implementation value
4. Side keywords relevant to business (filtered by Phase 78/79)
5. Problem → keyword expansion finds non-obvious opportunities
6. Product linkage accuracy 80%+ for direct matches
7. Recommendations prioritized by estimated impact

</success_criteria>

<test_cases>
## Key Test Cases

### pSEO Detection

```
Input keywords:
  "automobilių plovykla vilniuje" (vol: 320, diff: 45)
  "automobilių plovykla kaune" (vol: 280, diff: 42)
  "automobilių plovykla klaipėdoje" (vol: 150, diff: 38)
  "automobilių plovykla šiauliuose" (vol: 120, diff: 35)
  "automobilių plovykla panevėžyje" (vol: 90, diff: 32)

Expected cluster:
  pattern: "automobilių plovykla [CITY]"
  template: "/plovykla/{city}"
  keywords: [5 keywords above]
  cities: ["vilnius", "kaunas", "klaipėda", "šiauliai", "panevėžys"]
  estimatedPages: 50+
  totalVolume: 960
  opportunityScore: 0.75 (high)
```

### Side Keyword Discovery

```
Conversation: "Mes parduodame natūralią kosmetiką. Klientai skundžiasi 
sausa oda ir plaukų slinkimu."

Extracted problems: ["sausa oda", "plaukų slinkimas"]

DataForSEO expansion for "sausa oda":
  → "drėkinamasis kremas sausai odai" (vol: 210)
  → "veido serumas sausai odai" (vol: 180)
  → "kaip gydyti sausą odą" (vol: 320)
  → "sausos odos priežastys" (vol: 150)

After filtering (Phase 79):
  → "drėkinamasis kremas sausai odai" ✓ BOFU
  → "veido serumas sausai odai" ✓ BOFU (matches priority category)
  → "kaip gydyti sausą odą" ✓ MOFU
  → "sausos odos priežastys" ✓ TOFU

These become side keyword recommendations.
```

### Product Linkage

```
Client products:
  - "Hialurono serumas" (category: veido serumai, solves: sausa oda)
  - "Keratino šampūnas" (category: šampūnai, solves: plaukų slinkimas)

Keyword: "serumas sausai odai"
  → Direct match: "serumas" in product name
  → Problem match: "sausai odai" → "sausa oda" in solvedProblems
  → Linkage: Hialurono serumas (confidence: 0.9)
  → Landing page: /produktai/veido-serumai/hialurono-serumas

Keyword: "kaip sustabdyti plaukų slinkimą"
  → No direct match
  → Problem match: "plaukų slinkimas" → Keratino šampūnas
  → Linkage: Keratino šampūnas (confidence: 0.7)
  → Landing page: /produktai/sampunai (category page)
```

</test_cases>
