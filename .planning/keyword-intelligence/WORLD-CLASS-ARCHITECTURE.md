# World-Class Keyword Intelligence Architecture

> **Purpose**: Design the AI-powered keyword analysis system that processes client conversations + bulk keywords into prioritized, filtered proposal-ready output.
> **Key Insight**: This is NOT a static taxonomy system. Every keyword is classified dynamically based on conversation-extracted constraints.

---

## The Core Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           THE ACTUAL WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Client conversation (pasted into TeveroSEO chat)                 │   │
│  │    "Mes automobilių plovykla Šiauliuose. Norime pritraukti          │   │
│  │     daugiau verslo klientų su automobilių parkais..."               │   │
│  │                                                                     │   │
│  │ 2. Keywords (3000 from DataForSEO)                                  │   │
│  │    CSV with: keyword, search_volume, cpc, difficulty, intent        │   │
│  │                                                                     │   │
│  │ 3. User instruction                                                 │   │
│  │    "We need 100 BOFU keywords for the proposal. B2B focus."         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  AI EXTRACTS CONSTRAINTS                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ From conversation:                                                  │   │
│  │   • Business: car wash in Šiauliai                                  │   │
│  │   • Geo: Šiauliai ONLY (exclude other cities)                       │   │
│  │   • Audience: B2B (company fleets)                                  │   │
│  │   • Services: regular maintenance, detailing                        │   │
│  │                                                                     │   │
│  │ From instruction:                                                   │   │
│  │   • Funnel: BOFU only (MOFU fallback if needed)                     │   │
│  │   • Count: 100 keywords                                             │   │
│  │   • Filter: B2B signals prioritized                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  CLASSIFY EACH KEYWORD (3000x)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "plovykla kaune" →                                                  │   │
│  │   geo: FAIL (wrong city) → EXCLUDED                                 │   │
│  │                                                                     │   │
│  │ "automobilių plovykla šiauliuose" →                                 │   │
│  │   geo: PASS | funnel: BOFU | relevance: 0.95 → SELECTED             │   │
│  │                                                                     │   │
│  │ "kaip nuplauti automobilį namie" →                                  │   │
│  │   geo: PASS | funnel: TOFU | negative: DIY → EXCLUDED               │   │
│  │                                                                     │   │
│  │ "automobilių parko priežiūra" →                                     │   │
│  │   geo: PASS | funnel: BOFU | b2b: HIGH → SELECTED (boosted)         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  CASCADE SELECTION                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Target: 100 keywords                                                │   │
│  │ Funnel priority: BOFU first, then MOFU                              │   │
│  │                                                                     │   │
│  │ Step 1: Top 100 BOFU by composite score                             │   │
│  │   → Got 67 BOFU keywords                                            │   │
│  │                                                                     │   │
│  │ Step 2: Add top MOFU to reach 100                                   │   │
│  │   → Added 33 MOFU keywords                                          │   │
│  │                                                                     │   │
│  │ Final: 67 BOFU + 33 MOFU = 100 keywords                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  OUTPUT                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Selected: 100 keywords (proposal-ready, exportable)                 │   │
│  │ Excluded: 2,900 keywords (with exclusion reasons)                   │   │
│  │ pSEO: 3 template opportunities identified                           │   │
│  │ Side keywords: 8 problem→product expansions                         │   │
│  │ Gaps: Categories with insufficient keyword coverage                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. ConversationIntelligenceService

Extracts structured constraints from unstructured client conversation.

```typescript
interface AnalysisConstraints {
  // What the business is
  businessContext: {
    type: 'ecommerce' | 'service' | 'saas' | 'local' | 'b2b_services';
    coreOffering: string;               // "automobilių plovykla"
    problemsSolved: string[];           // For side keyword discovery
    productCategories: string[];        // ["plovimas", "detailing"]
  };
  
  // Geographic filtering
  geoConstraints: {
    scope: 'hyperlocal' | 'city' | 'regional' | 'national';
    includeCities: string[];            // ["šiauliai"]
    excludeCities: string[];            // ["kaunas", "vilnius"]
    nearMeAllowed: boolean;
    genericAllowed: boolean;            // Keywords without city
  };
  
  // Audience targeting
  audienceConstraints: {
    b2bOnly: boolean;
    b2cAllowed: boolean;
    industryFocus: string[];            // ["logistics", "taxi"]
  };
  
  // Funnel configuration
  funnelConfig: {
    primary: 'bofu' | 'mofu' | 'tofu';
    fallbackOrder: ('bofu' | 'mofu' | 'tofu')[];
    targetCount: number;                // 100
    minPerStage?: Record<string, number>;
  };
  
  // Priority categories (from conversation)
  priorities: {
    category: string;
    weightMultiplier: number;           // 1.0-2.0
    reason: string;
  }[];
  
  // Hard exclusions
  negativeFilters: {
    excludeTerms: string[];             // ["savitarna", "namų"]
    excludeBrands: string[];
    excludeIntents: string[];           // ["diy"]
  };
  
  // Special modes
  specialModes: {
    pSEODetection: boolean;
    sideKeywordDiscovery: boolean;
    competitorGaps: boolean;
  };
}
```

**AI Prompt for Extraction**:
```
You are extracting keyword analysis constraints from a client conversation.

INPUT:
- Client conversation (natural language)
- Keywords list (optional context)

Extract and structure:
1. Business context: What do they sell/do? What problems do they solve?
2. Geographic scope: Which cities? Exclude others? Allow generic?
3. Audience: B2B? B2C? Both? Which industries?
4. Priority categories: What do they want to focus on?
5. Negative filters: What should we exclude?

Output as structured JSON.
```

### 2. GeoClassifier

Extracts and validates geographic information from each keyword.

```typescript
interface GeoClassification {
  hasExplicitCity: boolean;
  city: string | null;
  isNearMe: boolean;
  isGeneric: boolean;
  passesGeoFilter: boolean;
  geoScore: number;                     // 0-1 for scoring
}

// Lithuanian city extraction
const LITHUANIAN_CITIES = [
  { name: 'vilnius', variants: ['vilniuje', 'vilniaus', 'vilnių'] },
  { name: 'kaunas', variants: ['kaune', 'kauno'] },
  { name: 'klaipėda', variants: ['klaipėdoje', 'klaipėdos'] },
  { name: 'šiauliai', variants: ['šiauliuose', 'šiaulių'] },
  { name: 'panevėžys', variants: ['panevėžyje', 'panevėžio'] },
  { name: 'alytus', variants: ['alytuje', 'alytaus'] },
  { name: 'marijampolė', variants: ['marijampolėje', 'marijampolės'] },
  { name: 'mažeikiai', variants: ['mažeikiuose', 'mažeikių'] },
  { name: 'jonava', variants: ['jonavoje', 'jonavos'] },
  { name: 'utena', variants: ['utenoje', 'utenos'] },
  // ... 50+ more Lithuanian cities
];

const NEAR_ME_PATTERNS = [
  /\bšalia manęs\b/i,
  /\bnetoli\b/i,
  /\barti\b/i,
  /\bprie manęs\b/i,
  /\bnear me\b/i,
];

function classifyGeo(
  keyword: string,
  constraints: GeoConstraints
): GeoClassification {
  const kw = keyword.toLowerCase();
  
  // Check explicit city mentions
  for (const city of LITHUANIAN_CITIES) {
    const allVariants = [city.name, ...city.variants];
    if (allVariants.some(v => kw.includes(v))) {
      return {
        hasExplicitCity: true,
        city: city.name,
        isNearMe: false,
        isGeneric: false,
        passesGeoFilter: constraints.includeCities.includes(city.name) 
                        && !constraints.excludeCities.includes(city.name),
        geoScore: constraints.includeCities.includes(city.name) ? 1.0 : 0.0
      };
    }
  }
  
  // Check "near me" patterns
  if (NEAR_ME_PATTERNS.some(p => p.test(kw))) {
    return {
      hasExplicitCity: false,
      city: null,
      isNearMe: true,
      isGeneric: false,
      passesGeoFilter: constraints.nearMeAllowed,
      geoScore: constraints.nearMeAllowed ? 0.9 : 0.0
    };
  }
  
  // Generic (no location)
  return {
    hasExplicitCity: false,
    city: null,
    isNearMe: false,
    isGeneric: true,
    passesGeoFilter: constraints.genericAllowed,
    geoScore: constraints.genericAllowed ? 0.5 : 0.0
  };
}
```

### 3. FunnelClassifier

Classifies keywords into BOFU/MOFU/TOFU using patterns + DataForSEO intent.

```typescript
interface FunnelClassification {
  stage: 'bofu' | 'mofu' | 'tofu';
  confidence: number;
  signals: string[];
  dataForSeoIntent: string;
}

// BOFU: Ready to buy/book NOW
const BOFU_PATTERNS_LT = [
  // Purchase intent
  /\b(pirkti|pirk|nusipirk|nupirkti)\b/i,
  /\b(užsakyti|užsisakyti|užsakymas)\b/i,
  /\b(kaina|kainos|kiek kainuoja)\b/i,
  /\b(nuolaida|akcija|išpardavimas)\b/i,
  
  // Service booking
  /\b(registruotis|registracija)\b/i,
  /\b(rezervuoti|rezervacija)\b/i,
  /\b(skambinti|susisiekti|kontaktai)\b/i,
  
  // Local/immediate intent
  /\b(šalia manęs|netoli|arti)\b/i,
  /\b(dabar|šiandien|skubiai|greitai)\b/i,
  
  // Delivery/logistics
  /\b(pristatymas|siuntimas|atsiėmimas)\b/i,
];

// MOFU: Comparing options
const MOFU_PATTERNS_LT = [
  /\b(geriausi|geriausias|geriausios)\b/i,
  /\b(top \d+|topas)\b/i,
  /\b(palyginti|palyginimas|palyginimui)\b/i,
  /\b(vs|ar|arba|kuris geresnis)\b/i,
  /\b(atsiliepimai|atsiliepimas|įvertinimai)\b/i,
  /\b(rekomenduoju|rekomenduojami|patarimai)\b/i,
  /\b(kaip pasirinkti|kaip išsirinkti)\b/i,
  /\b(privalumai|trūkumai|skirtumai)\b/i,
  /\b(alternatyva|alternatyvos|panašus)\b/i,
  /\b(vertinimas|reitingas)\b/i,
];

// TOFU: Just learning
const TOFU_PATTERNS_LT = [
  /\b(kas yra|kas tai|ką reiškia)\b/i,
  /\b(kaip veikia|kaip tai veikia)\b/i,
  /\b(kaip naudoti|naudojimas)\b/i,
  /\b(kodėl|kam reikia|ar reikia)\b/i,
  /\b(nauda|privalumai ir trūkumai)\b/i,
  /\b(istorija|tendencijos|ateitis)\b/i,
  /\b(pradedantiesiems|pradžiamoksliams)\b/i,
  /\b(apžvalga|gidas|vadovas)\b/i,
];

function classifyFunnel(
  keyword: string,
  dataForSeoIntent: string | null,
  businessContext: BusinessContext
): FunnelClassification {
  const kw = keyword.toLowerCase();
  const signals: string[] = [];
  
  // Pattern-based classification (highest confidence)
  for (const pattern of BOFU_PATTERNS_LT) {
    if (pattern.test(kw)) {
      signals.push(`pattern:bofu:${pattern.source}`);
      return { stage: 'bofu', confidence: 0.9, signals, dataForSeoIntent: dataForSeoIntent || 'unknown' };
    }
  }
  
  for (const pattern of MOFU_PATTERNS_LT) {
    if (pattern.test(kw)) {
      signals.push(`pattern:mofu:${pattern.source}`);
      return { stage: 'mofu', confidence: 0.85, signals, dataForSeoIntent: dataForSeoIntent || 'unknown' };
    }
  }
  
  for (const pattern of TOFU_PATTERNS_LT) {
    if (pattern.test(kw)) {
      signals.push(`pattern:tofu:${pattern.source}`);
      return { stage: 'tofu', confidence: 0.9, signals, dataForSeoIntent: dataForSeoIntent || 'unknown' };
    }
  }
  
  // DataForSEO intent fallback
  if (dataForSeoIntent === 'transactional') {
    signals.push('dataforseo:transactional');
    return { stage: 'bofu', confidence: 0.75, signals, dataForSeoIntent };
  }
  
  if (dataForSeoIntent === 'commercial') {
    // Commercial is ambiguous - check for additional signals
    // City + service business = likely BOFU (looking for local provider)
    const hasCity = LITHUANIAN_CITIES.some(c => 
      [c.name, ...c.variants].some(v => kw.includes(v))
    );
    
    if (hasCity && businessContext.type === 'service') {
      signals.push('commercial:city:service');
      return { stage: 'bofu', confidence: 0.7, signals, dataForSeoIntent };
    }
    
    signals.push('commercial:default:mofu');
    return { stage: 'mofu', confidence: 0.65, signals, dataForSeoIntent };
  }
  
  if (dataForSeoIntent === 'informational') {
    signals.push('dataforseo:informational');
    return { stage: 'tofu', confidence: 0.8, signals, dataForSeoIntent };
  }
  
  // Low confidence - would benefit from LLM classification
  signals.push('fallback:mofu');
  return { stage: 'mofu', confidence: 0.4, signals, dataForSeoIntent: dataForSeoIntent || 'unknown' };
}
```

### 4. RelevanceScorer (Embedding-Based)

Multi-dimensional relevance scoring using embeddings.

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
  let categoryRelevance = 0;
  if (businessContext.productCategories.length > 0) {
    const categoryEmbeds = await Promise.all(
      businessContext.productCategories.map(c => embeddingService.embed(c))
    );
    categoryRelevance = Math.max(
      ...categoryEmbeds.map(ce => cosineSimilarity(kwEmbed, ce))
    );
  }
  
  // Problem relevance: Is this about problems they solve?
  let problemRelevance = 0;
  if (businessContext.problemsSolved.length > 0) {
    const problemEmbeds = await Promise.all(
      businessContext.problemsSolved.map(p => embeddingService.embed(p))
    );
    problemRelevance = Math.max(
      ...problemEmbeds.map(pe => cosineSimilarity(kwEmbed, pe))
    );
  }
  
  // Weighted combination
  const combinedRelevance = (
    coreRelevance * 0.40 +
    categoryRelevance * 0.35 +
    problemRelevance * 0.25
  );
  
  return {
    coreRelevance,
    categoryRelevance,
    problemRelevance,
    combinedRelevance
  };
}
```

### 5. NegativeFilter

Hard exclusion based on conversation-extracted filters.

```typescript
interface FilterResult {
  passes: boolean;
  reason: string | null;
}

function checkNegativeFilters(
  keyword: string,
  filters: NegativeFilters
): FilterResult {
  const kw = keyword.toLowerCase();
  
  // Check excluded terms
  for (const term of filters.excludeTerms) {
    if (kw.includes(term.toLowerCase())) {
      return { passes: false, reason: `excluded_term:${term}` };
    }
  }
  
  // Check excluded brands
  for (const brand of filters.excludeBrands) {
    if (kw.includes(brand.toLowerCase())) {
      return { passes: false, reason: `excluded_brand:${brand}` };
    }
  }
  
  // Check excluded intents (e.g., DIY patterns)
  const DIY_PATTERNS = [
    /\b(pats|pačiam|savo rankomis)\b/i,
    /\b(namie|namuose|namų)\b/i,
    /\b(be specialisto|be meistro)\b/i,
  ];
  
  if (filters.excludeIntents.includes('diy')) {
    for (const pattern of DIY_PATTERNS) {
      if (pattern.test(kw)) {
        return { passes: false, reason: 'excluded_intent:diy' };
      }
    }
  }
  
  return { passes: true, reason: null };
}
```

### 6. CascadeSelector

Selects keywords by funnel priority with fallback.

```typescript
interface CascadeConfig {
  targetCount: number;
  funnelPriority: ('bofu' | 'mofu' | 'tofu')[];
  minPerStage?: Partial<Record<'bofu' | 'mofu' | 'tofu', number>>;
  maxPerStage?: Partial<Record<'bofu' | 'mofu' | 'tofu', number>>;
}

interface SelectionResult {
  selected: ClassifiedKeyword[];
  excluded: ClassifiedKeyword[];
  breakdown: {
    bofu: number;
    mofu: number;
    tofu: number;
  };
}

function cascadeSelect(
  keywords: ClassifiedKeyword[],
  config: CascadeConfig
): SelectionResult {
  const selected: ClassifiedKeyword[] = [];
  
  // Group by funnel stage, sorted by composite score
  const byStage: Record<string, ClassifiedKeyword[]> = {
    bofu: keywords.filter(k => k.funnelStage === 'bofu')
      .sort((a, b) => b.compositeScore - a.compositeScore),
    mofu: keywords.filter(k => k.funnelStage === 'mofu')
      .sort((a, b) => b.compositeScore - a.compositeScore),
    tofu: keywords.filter(k => k.funnelStage === 'tofu')
      .sort((a, b) => b.compositeScore - a.compositeScore),
  };
  
  // First pass: ensure minimums
  for (const stage of ['bofu', 'mofu', 'tofu'] as const) {
    const min = config.minPerStage?.[stage] || 0;
    const available = byStage[stage];
    const toTake = Math.min(min, available.length);
    selected.push(...available.splice(0, toTake));
  }
  
  // Second pass: fill by priority order
  for (const stage of config.funnelPriority) {
    if (selected.length >= config.targetCount) break;
    
    const max = config.maxPerStage?.[stage] || Infinity;
    const alreadySelected = selected.filter(k => k.funnelStage === stage).length;
    const canAdd = Math.min(
      max - alreadySelected,
      config.targetCount - selected.length,
      byStage[stage].length
    );
    
    if (canAdd > 0) {
      selected.push(...byStage[stage].splice(0, canAdd));
    }
  }
  
  // Remaining are excluded
  const excluded = [...byStage.bofu, ...byStage.mofu, ...byStage.tofu];
  
  return {
    selected,
    excluded,
    breakdown: {
      bofu: selected.filter(k => k.funnelStage === 'bofu').length,
      mofu: selected.filter(k => k.funnelStage === 'mofu').length,
      tofu: selected.filter(k => k.funnelStage === 'tofu').length,
    }
  };
}
```

### 7. SideKeywordExpander

Discovers keywords through problem→solution mapping.

```typescript
interface SideKeywordOpportunity {
  problem: string;                      // "sąnarių skausmas"
  relatedKeywords: EnrichedKeyword[];   // Keywords about this problem
  productLink: string[];                // Products that solve it
  funnelStage: 'mofu' | 'tofu';        // Usually MOFU or TOFU
}

async function discoverSideKeywords(
  businessContext: BusinessContext,
  dataForSeoClient: DataForSeoClient,
  embeddingService: EmbeddingService
): Promise<SideKeywordOpportunity[]> {
  const opportunities: SideKeywordOpportunity[] = [];
  
  for (const problem of businessContext.problemsSolved) {
    // Get keyword ideas for this problem
    const ideas = await dataForSeoClient.keywordIdeas({
      seeds: [problem],
      location: 2440,  // Lithuania
      language: 'lt'
    });
    
    // Filter to relevant keywords
    const problemEmbed = await embeddingService.embed(problem);
    const relevant = ideas.filter(async (idea) => {
      const kwEmbed = await embeddingService.embed(idea.keyword);
      const similarity = cosineSimilarity(kwEmbed, problemEmbed);
      return similarity >= 0.5;  // Relevance threshold
    });
    
    // Find products that solve this problem
    const productLinks = businessContext.productCategories.filter(async (product) => {
      const productEmbed = await embeddingService.embed(product);
      const similarity = cosineSimilarity(problemEmbed, productEmbed);
      return similarity >= 0.3;
    });
    
    if (relevant.length > 0) {
      opportunities.push({
        problem,
        relatedKeywords: relevant,
        productLink: productLinks,
        funnelStage: 'mofu'  // Problem-aware = MOFU
      });
    }
  }
  
  return opportunities;
}
```

### 8. pSEODetector

Identifies template patterns for programmatic SEO.

```typescript
interface pSEOCluster {
  template: string;                     // "automobilių plovykla [CITY]"
  variable: 'city' | 'service' | 'product' | 'color' | 'size' | 'brand';
  variations: string[];
  keywords: ClassifiedKeyword[];
  combinedVolume: number;
  avgDifficulty: number;
  recommendation: string;
}

function detectpSEOPatterns(keywords: ClassifiedKeyword[]): pSEOCluster[] {
  const clusters: pSEOCluster[] = [];
  
  // City variations
  const cityPatterns = new Map<string, ClassifiedKeyword[]>();
  for (const kw of keywords) {
    for (const city of LITHUANIAN_CITIES) {
      const allVariants = [city.name, ...city.variants];
      for (const variant of allVariants) {
        if (kw.keyword.toLowerCase().includes(variant)) {
          // Create template by replacing city with [CITY]
          const template = kw.keyword.toLowerCase().replace(variant, '[CITY]');
          if (!cityPatterns.has(template)) {
            cityPatterns.set(template, []);
          }
          cityPatterns.get(template)!.push(kw);
          break;
        }
      }
    }
  }
  
  // Filter to clusters with 3+ variations
  for (const [template, kws] of cityPatterns) {
    if (kws.length >= 3) {
      const cities = kws.map(k => {
        for (const city of LITHUANIAN_CITIES) {
          const allVariants = [city.name, ...city.variants];
          if (allVariants.some(v => k.keyword.toLowerCase().includes(v))) {
            return city.name;
          }
        }
        return 'unknown';
      });
      
      clusters.push({
        template,
        variable: 'city',
        variations: [...new Set(cities)],
        keywords: kws,
        combinedVolume: sum(kws.map(k => k.searchVolume || 0)),
        avgDifficulty: avg(kws.map(k => k.keywordDifficulty || 0)),
        recommendation: `Create a location template page targeting ${kws.length} cities`
      });
    }
  }
  
  // Sort by combined volume
  return clusters.sort((a, b) => b.combinedVolume - a.combinedVolume);
}
```

---

## The Complete Pipeline

```typescript
interface KeywordAnalysisResult {
  // Selected keywords for proposal
  selected: ClassifiedKeyword[];
  
  // Excluded keywords with reasons
  excluded: {
    keyword: ClassifiedKeyword;
    reason: string;
  }[];
  
  // Funnel breakdown
  breakdown: {
    bofu: number;
    mofu: number;
    tofu: number;
  };
  
  // Opportunities
  pSEOClusters: pSEOCluster[];
  sideKeywords: SideKeywordOpportunity[];
  
  // Gaps
  gaps: {
    category: string;
    issue: string;  // "No BOFU keywords", "Low volume"
  }[];
  
  // Metadata
  meta: {
    totalKeywords: number;
    passedHardFilters: number;
    constraintsApplied: string[];
  };
}

async function analyzeKeywords(
  conversation: string,
  keywords: RawKeyword[],
  instruction: string,
  services: {
    embeddingService: EmbeddingService;
    dataForSeoClient: DataForSeoClient;
    llmClient: LLMClient;
  }
): Promise<KeywordAnalysisResult> {
  
  // Step 1: Extract constraints from conversation
  const constraints = await ConversationIntelligenceService.extract(
    conversation,
    instruction,
    services.llmClient
  );
  
  // Step 2: Classify each keyword
  const classified: ClassifiedKeyword[] = await Promise.all(
    keywords.map(async (kw) => {
      const geo = classifyGeo(kw.keyword, constraints.geoConstraints);
      const funnel = classifyFunnel(kw.keyword, kw.intent, constraints.businessContext);
      const relevance = await scoreRelevance(kw.keyword, constraints.businessContext, services.embeddingService);
      const negative = checkNegativeFilters(kw.keyword, constraints.negativeFilters);
      
      return {
        ...kw,
        geo,
        funnel,
        relevance,
        negative,
        passesHardFilters: geo.passesGeoFilter && negative.passes && relevance.combinedRelevance >= 0.3,
        compositeScore: calculateCompositeScore(kw, relevance, geo, constraints)
      };
    })
  );
  
  // Step 3: Apply hard filters
  const passing = classified.filter(k => k.passesHardFilters);
  const failing = classified.filter(k => !k.passesHardFilters);
  
  // Step 4: Cascade selection
  const selection = cascadeSelect(passing, constraints.funnelConfig);
  
  // Step 5: Detect pSEO opportunities
  const pSEOClusters = detectpSEOPatterns(selection.selected);
  
  // Step 6: Discover side keywords (if enabled)
  let sideKeywords: SideKeywordOpportunity[] = [];
  if (constraints.specialModes.sideKeywordDiscovery) {
    sideKeywords = await discoverSideKeywords(
      constraints.businessContext,
      services.dataForSeoClient,
      services.embeddingService
    );
  }
  
  // Step 7: Build excluded list with reasons
  const excluded = [
    ...failing.map(k => ({
      keyword: k,
      reason: !k.geo.passesGeoFilter ? `geo:${k.geo.city || 'generic'}` :
              !k.negative.passes ? k.negative.reason! :
              'relevance:low'
    })),
    ...selection.excluded.map(k => ({
      keyword: k,
      reason: `cascade:${k.funnel.stage}:below_cutoff`
    }))
  ];
  
  return {
    selected: selection.selected,
    excluded,
    breakdown: selection.breakdown,
    pSEOClusters,
    sideKeywords,
    gaps: detectGaps(selection.selected, constraints),
    meta: {
      totalKeywords: keywords.length,
      passedHardFilters: passing.length,
      constraintsApplied: summarizeConstraints(constraints)
    }
  };
}
```

---

## The Chat Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD ANALYSIS CHAT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER: [pastes client conversation]                                         │
│  "Mes automobilių plovykla Šiauliuose. Norime pritraukti daugiau           │
│   verslo klientų su automobilių parkais. Mums svarbiausia -                │
│   reguliari priežiūra ir detailing paslaugos."                             │
│                                                                             │
│  USER: [uploads keywords.csv - 3000 keywords from DataForSEO]              │
│                                                                             │
│  USER: "Analyze this. We need BOFU keywords only, 100 for the proposal.    │
│         B2B focus. No DIY or self-service keywords."                        │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  AI: I've analyzed the conversation and 3,000 keywords.                    │
│                                                                             │
│  **Business Context Extracted:**                                           │
│  • Service: Car wash in Šiauliai                                           │
│  • Target audience: B2B (companies with vehicle fleets)                    │
│  • Priority services: Regular maintenance, detailing                       │
│                                                                             │
│  **Constraints Applied:**                                                  │
│  • Geo: Šiauliai only (excluded 847 keywords from other cities)            │
│  • Funnel: BOFU only (filtered 1,423 MOFU/TOFU keywords)                   │
│  • Audience: B2B prioritized                                               │
│  • Excluded: DIY, self-service patterns (removed 156 keywords)             │
│                                                                             │
│  **Results:**                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │ Selected: 100 keywords                                            │     │
│  │ Breakdown: 87 BOFU + 13 MOFU (fallback to reach 100)              │     │
│  │ Combined volume: 14,200/month                                     │     │
│  │ Avg difficulty: 32 (achievable)                                   │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  **Top 10 Keywords:**                                                      │
│  | # | Keyword                               | Vol  | KD | Stage |         │
│  |---|---------------------------------------|------|----| ------|         │
│  | 1 | automobilių plovykla šiauliuose       | 720  | 28 | BOFU  |         │
│  | 2 | detailing paslaugos šiauliuose        | 240  | 35 | BOFU  |         │
│  | 3 | automobilių plovykla įmonėms          | 180  | 22 | BOFU  |         │
│  | 4 | automobilių parko priežiūra           | 120  | 18 | BOFU  |         │
│  | 5 | profesionalus automobilio valymas     | 110  | 31 | BOFU  |         │
│  | ...                                                                     │
│                                                                             │
│  **pSEO Opportunity Detected:**                                            │
│  Template: "automobilių [SERVICE] šiauliuose"                              │
│  8 variations: plovykla, poliravimas, valymas, detailing...                │
│  Combined volume: 1,840/month                                              │
│  → Consider creating a service template page                               │
│                                                                             │
│  **Actions:**                                                              │
│  • [Export 100 Keywords] [Export All with Reasons]                         │
│  • [Show MOFU Fallback] [Add more keywords]                                │
│  • [Show pSEO Details] [Show Excluded Keywords]                            │
│                                                                             │
│  ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  USER: "Show the excluded keywords for other cities"                       │
│                                                                             │
│  AI: Here are 847 keywords excluded due to geo filter (wrong city):        │
│                                                                             │
│  | Keyword                          | City     | Vol | Stage |             │
│  |----------------------------------|----------|-----|-------|             │
│  | automobilių plovykla vilniuje    | vilnius  | 2.4K| BOFU  |             │
│  | plovykla kaune                   | kaunas   | 1.8K| BOFU  |             │
│  | detailing klaipėdoje             | klaipėda | 580 | BOFU  |             │
│  | ...                                                                     │
│                                                                             │
│  These are high-value keywords but outside your service area.              │
│  If you expand to these cities, they would be priority targets.            │
│                                                                             │
│  [Export Geo-Excluded Keywords]                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Core Classification (3-4 days)
1. `FunnelClassifier` with Lithuanian patterns + DataForSEO intent
2. `GeoClassifier` with Lithuanian city extraction
3. `NegativeFilter` with pattern-based exclusions
4. Basic composite scoring

### Phase 2: Conversation Intelligence (2-3 days)
1. `ConversationIntelligenceService` with Claude extraction
2. Constraint generation from natural language
3. Integration with classification pipeline

### Phase 3: Relevance Scoring (2-3 days)
1. Multi-dimensional embedding scoring
2. Integration with Jina v5-nano (fast) or v5-small (quality)
3. Priority boost calculation

### Phase 4: Selection & Output (2 days)
1. `CascadeSelector` with configurable fallback
2. Export system (selected + excluded)
3. Breakdown analytics

### Phase 5: Discovery Features (2-3 days)
1. `pSEODetector` for template patterns
2. `SideKeywordExpander` for problem→keyword discovery
3. Gap detection

### Phase 6: Chat Integration (2-3 days)
1. `/api/keyword-chat/analyze` endpoint
2. CopilotKit tool for keyword analysis
3. Export actions from chat

**Total: ~14-18 days for world-class implementation**

---

## What Makes This World-Class

| Feature | Competitors (Ahrefs, SEMrush) | TeveroSEO |
|---------|-------------------------------|-----------|
| Input | Keyword list only | Conversation + keywords |
| Context | Manual filtering | AI-extracted constraints |
| Geo filtering | Manual | Automatic city detection |
| Funnel stage | Basic intent | BOFU/MOFU/TOFU with patterns |
| Relevance | None | Embedding-based multi-dimensional |
| Selection | Manual | Cascade with configurable fallback |
| pSEO | None | Automatic template detection |
| Side keywords | None | Problem→keyword expansion |
| Output | CSV | Selected + excluded + reasons |
| Interface | Dashboard | Conversational chat |

The key differentiator: **Paste client conversation, get filtered, prioritized keywords for proposal.** No manual filtering, no guesswork.
