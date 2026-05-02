# Phase 56 Expansion: Keyword Intelligence Pipeline Research

**Researched:** 2026-04-30
**Domain:** Keyword Discovery APIs, AI Classification, pSEO Pattern Generation
**Confidence:** HIGH (verified against existing codebase patterns and current API documentation)

## Summary

This research supports Plans 56-05 and 56-06, which expand the keyword intelligence pipeline to solve a critical problem: **contextual keyword drift**. The current system produces semantically related but contextually irrelevant keywords. Example: A B2B jackets company (striukestau.lt) receives "siuvinėjimo paslaugos" (embroidery services) because it is semantically similar (both involve logos), but contextually wrong --- they ADD logos to jackets, they do not SELL embroidery services.

The solution is a 4-stage pipeline: **Context Extraction** (from ConversationExtractor, 56-02) > **Universe Generation** (autocomplete/PAA/related searches) > **AI Classification** (4-tier relevance scoring with business context) > **pSEO Pattern Generation** (template-based expansion).

**Primary recommendation:** Use DataForSEO's existing integration for keyword discovery (autocomplete, keyword_suggestions, keyword_ideas endpoints --- already implemented in `dataforseo.ts`), implement a `KeywordClassificationService` following the `BusinessPriorityParser` pattern (XML prompt + Zod structured outputs + Claude Sonnet), and add a pSEO pattern generator for scalable keyword matrices.

## Problem Statement

### The Contextual Drift Problem

Current keyword extraction produces keywords based on **semantic similarity** without **business context filtering**:

| Seed Business | Extracted Keyword | Semantic Link | Business Reality |
|---------------|-------------------|---------------|------------------|
| B2B jackets with logo printing | siuvinėjimo paslaugos (embroidery services) | Both involve logos | They BUY embroidery, not SELL it |
| Hair salon products | plaukų dažymas namuose (home hair coloring) | Both involve hair | They sell PRO products, not DIY tutorials |
| Industrial machinery repair | machinery for sale | Both involve machines | They REPAIR, not SELL |

### Root Cause Analysis

1. **No negative association extraction:** The current `ConversationExtractor` extracts what the business DOES, not what they explicitly DO NOT do
2. **No competitor/adjacent suppression:** Semantically adjacent verticals (embroidery services adjacent to logo printing) are not filtered
3. **Single-pass classification:** Keywords are accepted or rejected without tiered classification

### Required Solution Components

1. **Business Context Extraction** --- Extract both positive AND negative associations
2. **Multi-tier Classification** --- PURE / ADJACENT / COMMERCIAL / EXCLUDE categories
3. **Manual Override UI** --- Human review for edge cases
4. **pSEO Pattern Generation** --- Scalable keyword expansion

---

## 1. API Options for Keyword Discovery

### Existing DataForSEO Integration [VERIFIED: codebase]

The codebase already has comprehensive DataForSEO integration in `open-seo-main/src/server/lib/dataforseo.ts`:

| Function | Endpoint | Purpose | Cost |
|----------|----------|---------|------|
| `fetchKeywordSuggestionsRaw()` | `/v3/dataforseo_labs/google/keyword_suggestions/live` | Keywords containing seed | $0.0008/req |
| `fetchKeywordIdeasRaw()` | `/v3/dataforseo_labs/google/keyword_ideas/live` | Semantically related keywords | $0.0008/req |
| `fetchRelatedKeywordsRaw()` | `/v3/dataforseo_labs/google/related_keywords/live` | Related keyword clusters | $0.0008/req |
| `fetchLiveSerpItemsRaw()` | `/v3/serp/google/organic/live/regular` | PAA extraction (via SerpAnalyzer) | $0.002/req |

**Lithuanian locale support:** [VERIFIED: DataForSEO docs]
- `location_code: 2440` (Lithuania)
- `language_code: "lt"` (Lithuanian)
- All endpoints support these parameters

### Google Autocomplete via DataForSEO [CITED: docs.dataforseo.com]

The codebase does NOT currently use the autocomplete endpoint. Available:

| Endpoint | Purpose | Pricing |
|----------|---------|---------|
| `/v3/serp/google/autocomplete/live` | Real-time autocomplete suggestions | $0.002/query (Live) |
| `/v3/serp/google/autocomplete/task_post` + `task_get` | Queued autocomplete | $0.0006/query (Standard) |

**Key feature:** Cursor Pointer allows exploring autocomplete variations:
```typescript
// Cursor at position 5 in "plaukų dažai" → "plauk" shows different completions
{
  keyword: "plaukų dažai",
  cursor_pointer: 5,  // Explore "plauk_" completions
  location_code: 2440,
  language_code: "lt"
}
```

### Alternative APIs (NOT Recommended)

| Provider | Pricing | Why Not |
|----------|---------|---------|
| SerpAPI | $0.015-0.025/search (expires monthly) | [CITED: serpapi.com/pricing] 10-40x more expensive than DataForSEO |
| Serper API | $0.001/search | Lower PAA/autocomplete quality |
| Direct Google scraping | Free (risky) | CAPTCHA, IP bans, ToS violation |

**Recommendation:** Use existing DataForSEO integration. Add autocomplete endpoint wrapper following existing patterns.

---

## 2. Classification Architecture

### Simplified Binary Relevance + Type Categorization

**UPDATE (2026-04-30):** Simplified from 4-tier to binary relevance based on user feedback. Prospects need 100-200 keywords that are ALL on-point — no tiers of "kinda relevant". Either relevant or not.

#### Binary Relevance Gate

| Decision | Threshold | Result |
|----------|-----------|--------|
| **INCLUDE** | confidence >= 0.85 | In final keyword set |
| **EXCLUDE** | confidence < 0.85 | Filtered out (never shown) |

No tiers. Binary. Every keyword in the output should be one the prospect would actually target.

#### Type Categorization (post-relevance)

Once keywords pass the relevance gate, categorize by **what they're useful for** (not relevance level):

| Type | Example | Use |
|------|---------|-----|
| `product` | "darbo striukės su logotipu" | Product/service pages |
| `long_tail` | "darbo striukės statybininkams" | pSEO landing pages |
| `question` | "kaip išsirinkti darbo striukes" | Blog/educational content |
| `local` | "įmonių uniformos Vilniuje" | Location pages |
| `comparison` | "darbo striukės vs liemenės" | Comparison content |

#### Human-in-the-Loop Setting

```typescript
interface ProspectWizardSettings {
  keyword_confirmation: 'always' | 'never' | 'low_confidence';
}
```

| Setting | Behavior |
|---------|----------|
| `always` | Human must confirm keyword list before proceeding |
| `never` | Auto-proceed with AI selection (fast mode) |
| `low_confidence` | Only pause if average confidence < 0.9 |

### Business Context Schema

Extend the existing `ExtractionResult` from `ConversationExtractor.ts`:

```typescript
// Source: Extension of existing ExtractionResult in ConversationExtractor.ts
interface BusinessContextSchema {
  // From existing extraction
  businessName: string;
  industry: string;
  services: string[];
  targetAudience: string;
  keywords: string[];
  
  // NEW: Negative associations for classification
  negativeAssociations: {
    notServices: string[];      // Things they explicitly do NOT sell/provide
    competitors: string[];      // Known competitor domains or business types
    adjacentVerticals: string[]; // Related but wrong verticals (embroidery for jacket company)
    wrongIntent: string[];      // Intent signals to suppress ("DIY", "tutorial", "free")
  };
  
  // NEW: Business model signals
  businessModel: {
    b2b: boolean;
    b2c: boolean;
    ecommerce: boolean;
    serviceProvider: boolean;
    manufacturer: boolean;
    reseller: boolean;
  };
}
```

### Classification Prompt Architecture

Following the `BusinessPriorityParser` pattern [VERIFIED: codebase], use XML prompts with Zod validation:

```xml
<!-- Location: open-seo-main/src/server/features/keywords/prompts/keyword-classifier.xml -->
<prompt>
  <system-context>
    <role>Expert keyword classifier for Lithuanian e-commerce and B2B</role>
    <core-principle name="business-context-first">
      A keyword that is semantically similar but contextually wrong MUST be excluded.
      Example: "embroidery services" is EXCLUDE for a company that BUYS embroidery, not SELLS it.
    </core-principle>
  </system-context>
  
  <business-context>
    {{BUSINESS_CONTEXT_JSON}}
  </business-context>
  
  <classification-rules>
    <rule tier="PURE" confidence="0.85+">
      Direct service/product match + purchase intent + correct business model
    </rule>
    <rule tier="ADJACENT" confidence="0.60-0.84">
      Related vertical OR correct intent but weak specificity
    </rule>
    <rule tier="COMMERCIAL" confidence="0.40-0.59">
      Commercial intent present but weak fit to business offerings
    </rule>
    <rule tier="EXCLUDE" confidence="any">
      Matches negativeAssociations OR wrong business model OR competitor keyword
    </rule>
  </classification-rules>
  
  <keywords-batch>
    {{KEYWORDS_JSON}}
  </keywords-batch>
  
  <output-schema>
    {
      "classifications": [
        {
          "keyword": "string",
          "tier": "PURE | ADJACENT | COMMERCIAL | EXCLUDE",
          "confidence": 0.0-1.0,
          "reasoning": "Brief explanation",
          "exclusionReason": "Optional - why EXCLUDE"
        }
      ]
    }
  </output-schema>
</prompt>
```

### Zod Schema for Classification Output

```typescript
// Location: open-seo-main/src/server/features/keywords/types/classification.ts
import { z } from 'zod';

export const ClassificationTierSchema = z.enum(['PURE', 'ADJACENT', 'COMMERCIAL', 'EXCLUDE']);

export const KeywordClassificationSchema = z.object({
  keyword: z.string(),
  tier: ClassificationTierSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  exclusionReason: z.string().optional(),
});

export const ClassificationBatchResultSchema = z.object({
  classifications: z.array(KeywordClassificationSchema),
  processingTimeMs: z.number(),
  modelUsed: z.string(),
});

export type KeywordClassification = z.infer<typeof KeywordClassificationSchema>;
export type ClassificationBatchResult = z.infer<typeof ClassificationBatchResultSchema>;
```

### Service Implementation Pattern

Following `BusinessPriorityParser.ts` [VERIFIED: codebase]:

```typescript
// Location: open-seo-main/src/server/features/keywords/services/KeywordClassificationService.ts
export class KeywordClassificationService {
  private config: Required<ClassifierConfig>;
  private client: Anthropic;
  private promptTemplate: string | null = null;
  
  constructor(config: ClassifierConfig) {
    this.config = {
      model: 'claude-sonnet-4-20250514',  // Same as BusinessPriorityParser
      maxTokens: 8192,  // Larger for batch classification
      temperature: 0.1,  // Low for consistent classification
      batchSize: 50,    // Process 50 keywords per API call
      ...config,
    };
    this.client = new Anthropic();
  }
  
  async classifyBatch(
    keywords: string[],
    businessContext: BusinessContextSchema
  ): Promise<ClassificationBatchResult> {
    // Load XML prompt, inject context, call Claude with Zod validation
    // Follow exact pattern from BusinessPriorityParser.parse()
  }
}
```

---

## 3. pSEO Pattern Generation

### Pattern Matrix Approach [CITED: backlinko.com, digitalapplied.com]

Programmatic SEO generates keywords from template matrices:

| Pattern Type | Template | Variables | Example Output |
|--------------|----------|-----------|----------------|
| Service + Location | `{{service}} {{location}}` | service=darbo striukės, location=Vilniuje | "darbo striukės Vilniuje" |
| Product + Modifier | `{{product}} {{modifier}}` | product=striukės, modifier=su logotipu | "striukės su logotipu" |
| Industry + Service | `{{industry}} {{service}}` | industry=statybos, service=apranga | "statybos apranga" |
| Intent + Product | `{{intent}} {{product}}` | intent=pirkti, product=darbo striukes | "pirkti darbo striukes" |

### Pattern Generator Schema

```typescript
// Location: open-seo-main/src/server/features/keywords/types/pseo-patterns.ts
interface PSEOPatternConfig {
  patternId: string;
  template: string;           // e.g., "{{service}} {{location}}"
  variables: PatternVariable[];
  estimatedVolume: number;    // Estimated search volume multiplier
  applicableBusinessModels: BusinessModelType[];
}

interface PatternVariable {
  name: string;               // e.g., "location"
  source: 'static' | 'extracted' | 'api';
  values?: string[];          // For static: ["Vilniuje", "Kaune", "Klaipėdoje"]
  apiEndpoint?: string;       // For api: fetch from locations API
  extractionPath?: string;    // For extracted: path in BusinessContextSchema
}

interface GeneratedKeyword {
  keyword: string;
  pattern: string;
  variables: Record<string, string>;
  estimatedVolume: number;
}
```

### Lithuanian Location Matrix [ASSUMED]

For Lithuanian market, standard location modifiers:

```typescript
const LITHUANIAN_LOCATIONS = [
  "Vilniuje", "Kaune", "Klaipėdoje", "Šiauliuose", "Panevėžyje",
  "Alytuje", "Marijampolėje", "Mažeikiuose", "Jonava", "Utena"
];

const LITHUANIAN_INTENT_MODIFIERS = {
  purchase: ["pirkti", "užsakyti", "kaina", "kainos", "pigiai"],
  research: ["geriausias", "top", "reitingas", "apžvalga"],
  local: ["arti manęs", "netoli", "netoliese"],
  b2b: ["didmeninė", "verslo", "įmonėms", "gamintojams"],
};
```

---

## 4. Integration Points

### Existing Codebase Patterns to Follow

| Pattern | Location | How to Apply |
|---------|----------|--------------|
| Claude + Zod structured outputs | `ConversationExtractor.ts` | Use `messages.create()` + manual JSON parsing (not `messages.parse()` - that's not in current codebase) |
| XML prompt templates | `prompts/business-priority-parser.xml` | Create `prompts/keyword-classifier.xml` |
| Rate limiting | `dataforseo.ts` uses `dataForSeoRateLimiter` | Add separate limiter for classification (50/day) |
| Test patterns | `BusinessPriorityParser.test.ts` | Use `vi.hoisted()` mock pattern |

### Proposed File Structure

```
open-seo-main/src/server/features/keywords/
├── services/
│   ├── KeywordClassificationService.ts      # NEW: 4-tier classifier
│   ├── KeywordClassificationService.test.ts # NEW: TDD tests
│   ├── PSEOPatternGenerator.ts              # NEW: Pattern expansion
│   ├── PSEOPatternGenerator.test.ts         # NEW: TDD tests
│   ├── KeywordUniverseBuilder.ts            # NEW: Orchestrates discovery
│   └── [existing services...]
├── prompts/
│   ├── business-priority-parser.xml         # EXISTING
│   ├── keyword-classifier.xml               # NEW: Classification prompt
│   └── context-extractor-enhanced.xml       # NEW: Negative associations
├── types/
│   ├── classification.ts                    # NEW: Zod schemas
│   ├── pseo-patterns.ts                     # NEW: Pattern types
│   └── [existing types...]
├── data/
│   ├── lithuanian-locations.ts              # NEW: Location matrix
│   └── [existing data...]
└── config/
    └── classification-config.ts             # NEW: Tier thresholds
```

### Database Schema Extension

Extend `prospect_keywords` table [VERIFIED: prospect-keyword-schema.ts]:

```typescript
// Add to prospect-keyword-schema.ts
prospectKeywords.classificationTier: text("classification_tier"),  // PURE|ADJACENT|COMMERCIAL|EXCLUDE
prospectKeywords.classificationConfidence: real("classification_confidence"),
prospectKeywords.classificationReasoning: text("classification_reasoning"),
prospectKeywords.manualOverride: boolean("manual_override").default(false),
prospectKeywords.patternSource: text("pattern_source"),  // If from pSEO pattern
```

---

## 5. Recommended Implementation Plan

### Plan 56-05: Keyword Universe Builder + Classification Service

| Task | Description | Estimated Hours |
|------|-------------|-----------------|
| 1 | Add DataForSEO autocomplete wrapper | 2h |
| 2 | Create `KeywordClassificationService` with XML prompt | 4h |
| 3 | Extend `ConversationExtractor` for negative associations | 3h |
| 4 | Add classification schema and DB migration | 2h |
| 5 | Unit tests (TDD) | 3h |

### Plan 56-06: pSEO Patterns + Manual Override UI

| Task | Description | Estimated Hours |
|------|-------------|-----------------|
| 1 | Create `PSEOPatternGenerator` service | 3h |
| 2 | Build Lithuanian location/modifier data | 2h |
| 3 | Manual override UI (tier reassignment) | 4h |
| 4 | Integration with prospect keyword flow | 3h |
| 5 | E2E tests | 2h |

---

## Cost Analysis

### Per-Prospect Keyword Intelligence Cost

| Stage | API Calls | Cost |
|-------|-----------|------|
| Autocomplete (5 seeds) | 5 | $0.01 |
| Keyword Suggestions (3 seeds) | 3 | $0.0024 |
| Keyword Ideas (3 seeds) | 3 | $0.0024 |
| Related Keywords (2 seeds) | 2 | $0.0016 |
| Claude Classification (200 keywords) | 4 batches | $0.04 |
| **Total** | | **$0.06/prospect** |

### Monthly Projections

| Scale | Prospects/mo | Cost |
|-------|--------------|------|
| Current usage | 50 | $3.00 |
| Growth target | 200 | $12.00 |
| SaaS launch | 1000 | $60.00 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DataForSEO autocomplete endpoint pricing is $0.002/query (Live) | API Options | Higher costs, need to use queued requests |
| A2 | Claude Sonnet can reliably classify 50 keywords per batch | Classification Architecture | Need smaller batches, higher latency/cost |
| A3 | Lithuanian location list is comprehensive | pSEO Patterns | May miss regional opportunities |
| A4 | 4-tier classification is sufficient granularity | Classification Architecture | May need 5th tier for "review required" |

---

## Open Questions

1. **Batch size for classification**
   - What we know: BusinessPriorityParser uses single-item parsing
   - What's unclear: How many keywords can Claude reliably classify in one call?
   - Recommendation: Start with 50, adjust based on accuracy testing

2. **Manual override persistence**
   - What we know: Users will override AI classifications
   - What's unclear: Should overrides apply to future prospects with same keyword?
   - Recommendation: Store overrides per-workspace, suggest (not auto-apply) to future prospects

3. **pSEO pattern volume thresholds**
   - What we know: Not all pattern expansions will have search volume
   - What's unclear: Minimum volume threshold to include generated keyword?
   - Recommendation: Include all in discovery, filter by volume > 10 for prioritization

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `open-seo-main/src/server/lib/dataforseo.ts` - existing DataForSEO integration
- [VERIFIED: codebase] `BusinessPriorityParser.ts` - Claude + Zod pattern
- [VERIFIED: codebase] `ConversationExtractor.ts` - extraction service pattern
- [VERIFIED: codebase] `prospect-keyword-schema.ts` - existing schema

### Secondary (MEDIUM confidence)
- [CITED: docs.dataforseo.com/v3/serp-google-autocomplete-overview/] - Autocomplete API
- [CITED: docs.dataforseo.com/v3/dataforseo_labs-google-keyword_suggestions-live/] - Keyword Suggestions
- [CITED: backlinko.com/programmatic-seo] - pSEO patterns
- [CITED: digitalapplied.com/blog/programmatic-seo-scale-content-templates-2026] - Template matrices

### Tertiary (LOW confidence)
- [WebSearch] SerpAPI pricing comparison - used for cost comparison, not implementation

---

## Metadata

**Confidence breakdown:**
- API Options: HIGH - verified against existing codebase + DataForSEO docs
- Classification Architecture: HIGH - follows established BusinessPriorityParser pattern
- pSEO Patterns: MEDIUM - pattern approach verified, Lithuanian specifics are assumed
- Integration Points: HIGH - maps directly to existing codebase structure

**Research date:** 2026-04-30
**Valid until:** 2026-05-30
