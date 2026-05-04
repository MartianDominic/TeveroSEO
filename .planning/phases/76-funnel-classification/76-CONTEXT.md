# Phase 76: Funnel Classification - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Classify keywords into BOFU/MOFU/TOFU funnel stages using Lithuanian patterns + DataForSEO intent signals. This replaces the generic "commercial/informational/transactional" intent with actionable funnel stages.

**The Problem:**
DataForSEO provides `intent` field with values:
- `informational` → Roughly TOFU
- `commercial` → Could be MOFU or BOFU (ambiguous!)
- `transactional` → Usually BOFU but misses some cases
- `navigational` → N/A for keyword analysis

**The Solution:**
Pattern-based classification with Lithuanian morphology awareness, using DataForSEO intent as ONE signal among many.

**Funnel Stage Definitions:**

| Stage | Definition | Lithuanian Signals |
|-------|------------|-------------------|
| BOFU | Ready to buy/book NOW | pirkti, kaina, nuolaida, užsakyti, registruotis |
| MOFU | Comparing options | geriausi, palyginti, vs, atsiliepimai, ar verta |
| TOFU | Just learning | kas yra, kaip veikia, kodėl, nauda |

</domain>

<decisions>
## Implementation Decisions

### Pattern Library (Lithuanian)

**BOFU Patterns (40+):**
```typescript
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
  
  // Delivery
  /\b(pristatymas|siuntimas|atsiėmimas)\b/i,
];
```

**MOFU Patterns (30+):**
```typescript
const MOFU_PATTERNS_LT = [
  /\b(geriausi|geriausias|geriausios)\b/i,
  /\b(top \d+|topas)\b/i,
  /\b(palyginti|palyginimas|vs|ar)\b/i,
  /\b(atsiliepimai|atsiliepimas|įvertinimai)\b/i,
  /\b(rekomenduoju|rekomenduojami|patarimai)\b/i,
  /\b(kaip pasirinkti|kaip išsirinkti)\b/i,
  /\b(privalumai|trūkumai|skirtumai)\b/i,
  /\b(alternatyva|alternatyvos|panašus)\b/i,
];
```

**TOFU Patterns (25+):**
```typescript
const TOFU_PATTERNS_LT = [
  /\b(kas yra|kas tai|ką reiškia)\b/i,
  /\b(kaip veikia|kaip tai veikia)\b/i,
  /\b(kaip naudoti|naudojimas)\b/i,
  /\b(kodėl|kam reikia|ar reikia)\b/i,
  /\b(nauda|privalumai ir trūkumai)\b/i,
  /\b(istorija|tendencijos|ateitis)\b/i,
  /\b(pradedantiesiems|pradžiamoksliams)\b/i,
];
```

### Classification Decision Tree

```
1. Check explicit patterns (highest confidence)
   → BOFU pattern match → stage: bofu, confidence: 0.90
   → MOFU pattern match → stage: mofu, confidence: 0.85
   → TOFU pattern match → stage: tofu, confidence: 0.90

2. Check DataForSEO intent (medium confidence)
   → transactional → stage: bofu, confidence: 0.75
   → commercial + city + service_business → stage: bofu, confidence: 0.70
   → commercial (default) → stage: mofu, confidence: 0.65
   → informational → stage: tofu, confidence: 0.80

3. Check business context signals
   → City mentioned + local service → boost BOFU confidence
   → Product name + modifier → boost BOFU confidence
   → Question format → boost TOFU confidence

4. Low confidence fallback
   → stage: mofu, confidence: 0.40
   → Flag for LLM batch classification
```

### Batch Processing

- Process 100 keywords per LLM call (for low-confidence batch)
- Use Grok 4.1 for cost efficiency ($0.20/1M tokens)
- XML prompt with classification rubric
- Return array of classifications

### Integration with Existing Pipeline

- Extends `ClassificationPipeline` from Phase 63
- Adds `funnelStage` alongside existing `keywordType`
- Stored in `keyword_classifications` table

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/keywords/classification/types.ts` — KeywordTypeEnum
- `open-seo-main/src/server/features/keywords/classification/GrokClassifier.ts` — Existing Grok integration
- `open-seo-main/src/server/features/keywords/classification/ClassificationPipeline.ts` — Two-pass cascade
- `open-seo-main/src/types/keywords.ts` — KeywordIntent type (informational/commercial/etc.)

</references>

<existing_code>
## Existing Infrastructure

### ClassificationPipeline (Phase 63)
- Two-pass: Grok 4.1 (Pass 1) → Claude Sonnet (Pass 2)
- Classifies into: product, long_tail, question, local, comparison
- **Gap:** No BOFU/MOFU/TOFU classification

### KeywordIntent Type
```typescript
type KeywordIntent = 
  | 'informational' 
  | 'commercial' 
  | 'transactional' 
  | 'navigational'
  | 'unknown';
```
- Stored in `keywordMetrics.intent`
- **Gap:** commercial spans MOFU and BOFU

### DataForSEO Response
- Returns `intent` field per keyword
- Used as input signal but not source of truth

</existing_code>

<success_criteria>
## Success Criteria

1. BOFU keywords classified correctly 90%+ (precision)
2. MOFU/TOFU classification accuracy 85%+
3. DataForSEO "commercial" correctly split between BOFU/MOFU
4. Batch processing handles 100 keywords in <5 seconds
5. Edge cases (city + service = BOFU) handled correctly
6. Pattern library covers 95%+ of Lithuanian purchase intent signals
7. Low-confidence keywords flagged for LLM batch review

</success_criteria>

<test_cases>
## Key Test Cases

### BOFU Examples
```
"automobilių plovykla šiauliuose" → BOFU (city + service)
"šampūnas kaina" → BOFU (price signal)
"užsakyti veido serumą" → BOFU (order signal)
"plovykla šalia manęs" → BOFU (near me)
"detailing paslaugos registracija" → BOFU (booking)
```

### MOFU Examples
```
"geriausi šampūnai 2024" → MOFU (best X)
"cosrx vs some by mi" → MOFU (comparison)
"veido serumo atsiliepimai" → MOFU (reviews)
"kaip pasirinkti plovyklą" → MOFU (decision support)
```

### TOFU Examples
```
"kas yra hialurono rūgštis" → TOFU (what is)
"kaip veikia kolagenas" → TOFU (how does)
"plaukų priežiūros patarimai" → TOFU (tips)
"kodėl svarbu valyti automobilį" → TOFU (why)
```

### Edge Cases
```
"geriausios plovyklos vilniuje" → MOFU (comparison + city, but not buying yet)
"šampūnas riebiems plaukams" → BOFU (product + need = ready to buy)
"automobilių valymo paslaugos" → BOFU if service business context, else MOFU
```

</test_cases>
