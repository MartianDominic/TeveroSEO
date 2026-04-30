# Phase 56 Audit: Keyword Intelligence Gap Analysis

**Audited:** 2026-04-30
**Auditor:** Claude (gsd-verifier)
**Against:** User requirements for 100-200 on-point keywords per prospect

---

## What's Built (Plans 01-04)

### Plan 56-01: Multi-Modal Prospect Input Foundation (COMPLETE)
- **Schema:** Extended `prospects` table with `input_mode`, `raw_input`, `extracted_data`, `confirmed_data`, `confirmation_status`
- **Store:** Zustand wizard store (`prospect-wizard-store.ts`) with steps: input -> progress -> confirmation -> complete
- **UI:** Tab-based modal (Website / Website+Context / Conversation) with validation
- **i18n:** English + Lithuanian translations

### Plan 56-02: AI Extraction Service (COMPLETE)
- **ConversationExtractor:** Claude-powered extraction returning:
  ```typescript
  {
    businessName?: string;
    industry?: string;
    services?: string[];      // What they offer
    targetAudience?: string;
    keywords?: string[];      // 5-10 basic seed keywords
    location?: string;
    confidence: number;       // 0-100
  }
  ```
- **API endpoint:** `/api/prospects/extract` with rate limiting (50/day)
- **Zod validation:** Input/output schemas validated
- **Tests:** 5 unit tests passing

### Plan 56-03: Confirmation UI (PLANNED - NOT EXECUTED)
- ExtractionConfirmation component
- KeywordSelector with checkboxes
- Confirm endpoint `/api/prospects/confirm`
- Editable fields for all extracted data

### Plan 56-04: SSE Progress Display (PLANNED - NOT EXECUTED)
- Real-time progress stages via Server-Sent Events
- AnalysisProgress component
- useAnalysisProgress hook

---

## What's Missing for Keyword Intelligence

| Gap | Priority | Effort | Notes |
|-----|----------|--------|-------|
| **G1: No negative association extraction** | P0 | 4h | ConversationExtractor only extracts what business DOES, not what they DON'T do. Critical for filtering out adjacent verticals (e.g., embroidery services for a jacket company that BUYS embroidery) |
| **G2: No business model detection** | P0 | 2h | Schema needs `businessModel: { b2b, b2c, ecommerce, serviceProvider, manufacturer, reseller }` - affects keyword intent filtering |
| **G3: No binary relevance classification** | P0 | 6h | User requirement: binary include/exclude at 0.85 confidence threshold. Current: no classification service wired to prospect flow |
| **G4: No keyword type categorization** | P1 | 3h | User requirement: `product`, `long_tail`, `question`, `local`, `comparison` types. Schema has `category` in `OpportunityKeyword` but different values |
| **G5: No autocomplete API integration** | P1 | 2h | DataForSEO autocomplete endpoint NOT implemented in `dataforseo.ts`. Existing: keyword_suggestions, keyword_ideas, related_keywords |
| **G6: No PAA extraction for keywords** | P1 | 3h | PAA exists in SerpAnalyzer but not wired to keyword discovery pipeline |
| **G7: No multi-model cascade for classification** | P2 | 4h | ResilientClassifier exists with Claude->GPT-4o-mini->rules cascade but categorizes for hair care products, not prospect keywords |
| **G8: No human_confirmation setting** | P1 | 2h | User requirement: `always`/`never`/`low_confidence` toggle. Missing from wizard store and schema |
| **G9: No competitor/adjacent vertical extraction** | P0 | 3h | Needed for exclusion filtering. ConversationExtractor doesn't extract competitor signals |
| **G10: SSE progress doesn't show classification stage** | P2 | 1h | Stages are: connecting -> crawling -> extracting -> analyzing -> complete. "Classifying keywords" not included |

### Gap Severity Assessment

- **P0 (Blocker):** G1, G2, G3, G9 - Without these, keywords WILL include irrelevant results (the exact problem user described)
- **P1 (Required):** G4, G5, G6, G8 - Needed for full solution but partial value without
- **P2 (Enhancement):** G7, G10 - Optimization, can ship without

---

## Analysis: Existing Infrastructure

### Keyword Services Available (open-seo-main/src/server/features/keywords/)

| Service | What it Does | Reusable? |
|---------|--------------|-----------|
| `KeywordIntelligenceService` | Orchestrates classification, embedding, normalization | Partially - designed for client keywords, not prospect discovery |
| `ResilientClassifier` | Claude->GPT->rules cascade | Yes - adapt prompt for prospect context |
| `ClassificationSingleflight` | Cross-tenant dedup via Redis | Yes |
| `LithuanianNormalizer` | Morphological normalization | Yes |
| `KeywordDeduplicator` | Removes duplicates with fuzzy matching | Yes |

### DataForSEO Functions Available (dataforseo.ts)

| Function | Implemented | Notes |
|----------|-------------|-------|
| `fetchKeywordMetrics()` | Yes | search_volume/cpc |
| `fetchKeywordSuggestionsRaw()` | Yes | Keywords containing seed |
| `fetchKeywordIdeasRaw()` | Yes | Semantically related |
| `fetchRelatedKeywordsRaw()` | Yes | Related clusters |
| `fetchAutocomplete()` | **NO** | Not implemented |

---

## Recommended Plan 56-05 Scope: Business Context Extraction + Classification Foundation

**Goal:** Enable contextual keyword filtering by extracting what businesses DON'T do and their business model.

### Tasks

1. **Extend ConversationExtractor prompt** (3h)
   - Add negative associations extraction block:
     ```
     "negativeAssociations": {
       "notServices": string[],      // Things they explicitly DO NOT sell/provide
       "competitors": string[],      // Known competitor domains or types
       "adjacentVerticals": string[],// Related but wrong verticals
       "wrongIntent": string[]       // Intent signals to suppress
     }
     ```
   - Add business model detection:
     ```
     "businessModel": {
       "b2b": boolean,
       "b2c": boolean,
       "ecommerce": boolean,
       "serviceProvider": boolean,
       "manufacturer": boolean,
       "reseller": boolean
     }
     ```

2. **Create KeywordClassificationService** (4h)
   - Binary relevance gate: `confidence >= 0.85` = INCLUDE, else EXCLUDE
   - Use ResilientClassifier pattern (Claude->GPT->rules)
   - XML prompt template following `BusinessPriorityParser` pattern
   - Input: keywords[] + BusinessContextSchema
   - Output: `{ keyword, include: boolean, confidence: number, type: KeywordType, reasoning: string }`

3. **Add keyword type categorization** (2h)
   - Enum: `product | long_tail | question | local | comparison`
   - Heuristic rules:
     - Contains `?` or starts with `kaip/kodėl/kas` = question
     - Contains location = local
     - Contains `vs` or `palyginti` = comparison
     - 4+ words = long_tail
     - Default = product

4. **Add human_confirmation setting** (2h)
   - Extend wizard store:
     ```typescript
     keywordConfirmation: 'always' | 'never' | 'low_confidence'
     ```
   - Add UI toggle in settings or confirmation step
   - When `low_confidence`: pause if avg confidence < 0.9

5. **Schema migration** (1h)
   - Extend `ExtractedProspectData` interface with new fields
   - Add `keyword_type` column to prospect_keywords if needed

**Estimated Total:** 12h

---

## Recommended Plan 56-06 Scope: Keyword Universe Builder + Integration

**Goal:** Generate 100-200 on-point keywords using autocomplete, PAA, and classification pipeline.

### Tasks

1. **Add DataForSEO autocomplete wrapper** (2h)
   - Implement `fetchAutocomplete()` in `dataforseo.ts`
   - Endpoint: `/v3/serp/google/autocomplete/task_post` + `task_get`
   - Support cursor_pointer for variation exploration
   - Lithuanian locale: `location_code: 2440, language_code: "lt"`

2. **Create KeywordUniverseBuilder service** (4h)
   - Orchestrates keyword discovery:
     1. Take 5-10 seed keywords from extraction
     2. Call autocomplete for each seed (5x cursor positions)
     3. Call keyword_suggestions for each seed
     4. Call keyword_ideas for top 3 seeds
     5. Extract PAA from SERP (if enabled)
     6. Deduplicate via KeywordDeduplicator
     7. Run through KeywordClassificationService
     8. Return filtered, typed keywords

3. **Wire classification to confirmation flow** (3h)
   - After extraction, before showing confirmation:
     1. Run KeywordUniverseBuilder
     2. Store classified keywords in `extractedData.classifiedKeywords`
     3. Show in KeywordSelector with type badges
   - SSE progress: add "Classifying keywords" stage

4. **Cost optimization: model cascade config** (2h)
   - Configure cascade:
     - Batch 1-50: Claude Sonnet (highest quality for first batch)
     - Batch 51-200: GPT-4o-mini (cost-effective for bulk)
     - Fallback: Rule-based classifier
   - Log model used per keyword for cost tracking

5. **Integration tests** (3h)
   - E2E: Conversation input -> extract -> classify -> confirm -> save
   - Test Lithuanian keywords specifically
   - Test negative association filtering (embroidery example)

**Estimated Total:** 14h

---

## Integration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **API cost overrun** | Medium | High | Add budget cap per prospect (e.g., $0.10). KeywordUniverseBuilder should abort if approaching limit |
| **Classification latency** | High | Medium | 200 keywords at 50/batch = 4 Claude calls = ~8s. Show progress, consider background job for large sets |
| **Negative association false positives** | Medium | High | Be conservative in prompt - only extract explicit negatives, not inferred ones. Add "uncertain" list for human review |
| **Lithuanian morphology edge cases** | Medium | Medium | LithuanianNormalizer exists but may miss business domain terms. Test with striuke.lt example |
| **Existing KeywordIntelligenceService conflict** | Low | Medium | New service is for prospects, existing is for clients. Keep separate but share utilities |

---

## Schema Alignment Check

### Current ExtractedProspectData (from prospect-schema.ts)
```typescript
interface ExtractedProspectData {
  businessName?: string;
  industry?: string;
  services?: string[];
  targetAudience?: string;
  keywords?: string[];      // Just seed keywords
  location?: string;
  confidence: number;
}
```

### Required for Keyword Intelligence
```typescript
interface ExtractedProspectData {
  // Existing fields...
  
  // NEW: Business context for filtering
  negativeAssociations?: {
    notServices: string[];
    competitors: string[];
    adjacentVerticals: string[];
    wrongIntent: string[];
  };
  businessModel?: {
    b2b: boolean;
    b2c: boolean;
    ecommerce: boolean;
    serviceProvider: boolean;
    manufacturer: boolean;
    reseller: boolean;
  };
  
  // NEW: Classified keywords (post-universe-builder)
  classifiedKeywords?: Array<{
    keyword: string;
    include: boolean;
    confidence: number;
    type: 'product' | 'long_tail' | 'question' | 'local' | 'comparison';
    reasoning?: string;
  }>;
}
```

---

## Summary

**Phase 56 current state:**
- Plans 01-02: Complete (input modal, basic extraction)
- Plans 03-04: Not executed (confirmation UI, progress display)

**Gaps for keyword intelligence:**
- 10 gaps identified, 4 are P0 blockers
- Core issue: No contextual filtering = irrelevant keywords

**Recommendation:**
1. Execute Plans 03-04 first (confirmation UI needed for keyword review)
2. Add Plans 05-06 for keyword intelligence pipeline
3. Total additional effort: ~26h

**Key insight:** The existing `KeywordIntelligenceService` is designed for client keyword analysis (post-conversion). Prospect keyword discovery is a different use case requiring:
- Broader universe generation (autocomplete, PAA)
- Stricter relevance filtering (binary gate)
- Business context awareness (negatives, model)

---

*Audit complete. Awaiting decision on Plan 05-06 scope.*
