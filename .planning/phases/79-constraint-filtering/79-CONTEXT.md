# Phase 79: Constraint Filtering - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Apply hard filters and compute composite scores for keyword selection. This is the aggregation layer that combines all classification signals into a final pass/fail + score.

**The Problem:**
After Phases 76-78, each keyword has:
- Funnel stage (BOFU/MOFU/TOFU) + confidence
- Geo classification (city, near-me, generic) + pass/fail
- Relevance scores (core, category, problem) + combined

But we also need:
- Hard exclusions (negative terms, wrong audience)
- Priority boosts (client-emphasized categories)
- Quick win detection (position opportunity)
- Clear exclusion reasons for export

**The Solution:**
Pipeline filter with composite scoring and detailed exclusion tracking.

</domain>

<decisions>
## Implementation Decisions

### Hard Filter Pipeline

```
Keywords flow through filters in order:

1. GEO FILTER (from Phase 77)
   │ Input: geoClassification.passesGeoFilter
   │ Exclude: wrong city keywords
   │ Reason: "geo:wrong_city:kaunas"
   ▼
2. NEGATIVE TERM FILTER
   │ Input: negativeFilters.excludeTerms from constraints
   │ Exclude: DIY, self-service, competitor brands
   │ Reason: "negative:term:savitarna"
   ▼
3. AUDIENCE FILTER
   │ Input: audienceConstraints from constraints
   │ If b2bOnly: exclude B2C patterns
   │ If b2cAllowed: include both
   │ Reason: "audience:b2c_excluded"
   ▼
4. RELEVANCE THRESHOLD FILTER
   │ Input: relevanceScores.combinedScore
   │ Exclude: score < 0.4
   │ Reason: "relevance:below_threshold:0.32"
   ▼
5. PASSED KEYWORDS → Composite Scoring
```

### Negative Term Patterns

```typescript
// Extracted from conversation + defaults
interface NegativeFilters {
  excludeTerms: string[];    // e.g., ["savitarna", "namų"]
  excludeBrands: string[];   // e.g., ["Lidl", "Maxima"] (competitors)
  excludeIntents: string[];  // e.g., ["diy", "kaip pačiam"]
}

// Default Lithuanian DIY/self-service patterns
const DEFAULT_NEGATIVE_PATTERNS = [
  /\bpačiam\b/i,
  /\bsavitarna\b/i,
  /\bnamų sąlygomis\b/i,
  /\bnemokamai\b/i,  // Free (usually not commercial)
  /\bkaip padaryti\b/i,
];
```

### Audience Filter Logic

```typescript
// B2B vs B2C detection patterns
const B2C_PATTERNS = [
  /\basmeninis\b/i,
  /\bnamų\b/i,
  /\bšeimai\b/i,
  /\bvaikams\b/i,
];

const B2B_PATTERNS = [
  /\bįmonėms\b/i,
  /\bverslui\b/i,
  /\bkorporatyvinis\b/i,
  /\bautoparkui\b/i,
  /\bflotai\b/i,
];

function checkAudienceFilter(
  keyword: string,
  constraints: AudienceConstraints
): { passes: boolean; reason?: string } {
  if (constraints.b2bOnly) {
    const isB2C = B2C_PATTERNS.some(p => p.test(keyword));
    if (isB2C) return { passes: false, reason: 'audience:b2c_excluded' };
  }
  return { passes: true };
}
```

### Composite Score Formula

```typescript
interface CompositeScore {
  baseScore: number;           // From relevance + funnel + geo
  priorityMultiplier: number;  // 1.0 - 2.0 from category priorities
  quickWinBonus: number;       // 0.0 - 0.2 from position opportunity
  finalScore: number;          // baseScore * priorityMultiplier + quickWinBonus
}

// Base score calculation
function computeBaseScore(classified: ClassifiedKeyword): number {
  const weights = {
    relevance: 0.40,
    funnelConfidence: 0.30,
    geoScore: 0.20,
    volumeNormalized: 0.10,
  };
  
  return (
    classified.relevanceScores.combinedScore * weights.relevance +
    classified.funnelConfidence * weights.funnelConfidence +
    classified.geoClassification.geoScore * weights.geoScore +
    normalizeVolume(classified.volume) * weights.volumeNormalized
  );
}

// Priority multiplier from conversation-extracted priorities
function computePriorityMultiplier(
  keyword: string,
  priorities: CategoryPriority[]
): number {
  for (const priority of priorities) {
    if (keywordMatchesCategory(keyword, priority.category)) {
      return priority.weightMultiplier;  // 1.0 - 2.0
    }
  }
  return 1.0;  // No priority match
}

// Quick win detection
function computeQuickWinBonus(
  keyword: string,
  metrics: KeywordMetrics
): number {
  // Position 11-20 with decent volume = quick win
  if (metrics.position >= 11 && metrics.position <= 20) {
    if (metrics.volume >= 100) return 0.2;
    if (metrics.volume >= 50) return 0.15;
    return 0.1;
  }
  // Position 21-50 with high volume = opportunity
  if (metrics.position >= 21 && metrics.position <= 50) {
    if (metrics.volume >= 500) return 0.15;
    if (metrics.volume >= 200) return 0.1;
  }
  return 0.0;
}
```

### Filter Result Type

```typescript
interface FilterResult {
  keyword: string;
  passed: boolean;
  
  // If passed
  compositeScore?: CompositeScore;
  classification?: {
    funnelStage: 'bofu' | 'mofu' | 'tofu';
    geoCity: string | null;
    relevanceScore: number;
  };
  
  // If excluded
  exclusionReason?: string;
  exclusionStage?: 'geo' | 'negative' | 'audience' | 'relevance';
  
  // Metadata
  processingTimeMs: number;
}
```

### Exclusion Reason Taxonomy

```typescript
// Structured reasons for export and analysis
type ExclusionReason = 
  | `geo:wrong_city:${string}`
  | `geo:not_in_target_list`
  | `geo:generic_not_allowed`
  | `negative:term:${string}`
  | `negative:brand:${string}`
  | `negative:intent:${string}`
  | `audience:b2c_excluded`
  | `audience:b2b_excluded`
  | `relevance:below_threshold:${string}`;

// Export format for client review
interface ExclusionExport {
  keyword: string;
  reason: ExclusionReason;
  humanReadable: string;  // "Excluded: wrong city (Kaunas)"
  stage: string;
  details: Record<string, unknown>;
}
```

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` — Existing scoring
- `open-seo-main/src/server/features/keywords/types/focus-directive.ts` — CategoryPriority type

</references>

<existing_code>
## Existing Infrastructure

### PrioritizationService
- Basic scoring exists (volume × difficulty weighting)
- **Gap:** No conversation-aware prioritization, no hard filters

### FocusDirective
- `CategoryPriority` type exists
- `CategorySuppression` for negative boost
- **Gap:** Generated per-request, not persisted from conversation

### KeywordEnrichmentService
- Enriches keywords with DataForSEO data
- **Gap:** No filtering, just enrichment

</existing_code>

<success_criteria>
## Success Criteria

1. Hard filters correctly exclude wrong-city keywords
2. Negative filters exclude DIY/self-service patterns
3. Audience filters correctly separate B2B/B2C
4. Relevance threshold filters irrelevant keywords
5. Composite score correlates with keyword value (verified manually)
6. Priority boost correctly weights focus categories (1.0-2.0x)
7. Quick win bonus identifies position opportunities
8. Exclusion reasons exportable and actionable

</success_criteria>

<test_cases>
## Key Test Cases

### Hard Filter Tests

```
Constraints:
  geoConstraints.includeCities: ["šiauliai"]
  negativeFilters.excludeTerms: ["savitarna"]
  audienceConstraints.b2bOnly: true

"plovykla kaune" → EXCLUDED (geo:wrong_city:kaunas)
"savitarnos plovykla" → EXCLUDED (negative:term:savitarna)
"plovykla šeimai" → EXCLUDED (audience:b2c_excluded)
"plovykla įmonėms šiauliuose" → PASSED
```

### Composite Score Tests

```
Keyword: "detailing paslaugos šiauliuose"
  relevanceScores.combinedScore: 0.75
  funnelConfidence: 0.90 (BOFU)
  geoClassification.geoScore: 1.0
  volume: 320

Priority: "detailing" → weightMultiplier: 1.5
Position: 15 → quickWinBonus: 0.2

Expected:
  baseScore = 0.75*0.4 + 0.90*0.3 + 1.0*0.2 + 0.15*0.1 = 0.785
  finalScore = 0.785 * 1.5 + 0.2 = 1.378 (very high priority!)
```

### Edge Cases

```
"automobilių plovykla" (generic, no city)
  → If genericAllowed: PASSED with geoScore 0.5
  → If !genericAllowed: EXCLUDED (geo:generic_not_allowed)

"plovykla prie kauno" (near Kaunas)
  → City extraction: "kaunas"
  → If targeting Šiauliai: EXCLUDED
  → Needs careful city variant handling

"geriausia plovykla lietuvoje" (national claim)
  → No specific city
  → Should be treated as generic
```

</test_cases>
