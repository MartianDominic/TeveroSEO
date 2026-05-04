# Phase 77: Geographic Intelligence - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** New feature - World-Class Keyword Intelligence v8.0

<domain>
## Phase Boundary

Extract city mentions from keywords and filter based on geographic constraints from conversation. Critical for local service businesses where "plovykla kaune" must be excluded when targeting Šiauliai.

**The Problem:**
DataForSEO returns keywords for the entire country (Lithuania, location_code 2440). For a local business in Šiauliai, we get:
- "automobilių plovykla šiauliuose" ✓ (target city)
- "automobilių plovykla kaune" ✗ (wrong city)
- "automobilių plovykla vilniuje" ✗ (wrong city)
- "automobilių plovykla" ? (generic - configurable)
- "plovykla šalia manęs" ✓ (local intent)

**The Solution:**
Lithuanian city database with morphological variants + extraction + filtering logic.

</domain>

<decisions>
## Implementation Decisions

### Lithuanian City Database

```typescript
const LITHUANIAN_CITIES = [
  // Top 10 cities by population
  { name: 'vilnius', variants: ['vilniuje', 'vilniaus', 'vilnių', 'vilniui'] },
  { name: 'kaunas', variants: ['kaune', 'kauno', 'kaunui', 'kauną'] },
  { name: 'klaipėda', variants: ['klaipėdoje', 'klaipėdos', 'klaipėdai'] },
  { name: 'šiauliai', variants: ['šiauliuose', 'šiaulių', 'šiauliams'] },
  { name: 'panevėžys', variants: ['panevėžyje', 'panevėžio', 'panevėžiui'] },
  { name: 'alytus', variants: ['alytuje', 'alytaus', 'alytui'] },
  { name: 'marijampolė', variants: ['marijampolėje', 'marijampolės'] },
  { name: 'mažeikiai', variants: ['mažeikiuose', 'mažeikių'] },
  { name: 'jonava', variants: ['jonavoje', 'jonavos'] },
  { name: 'utena', variants: ['utenoje', 'utenos'] },
  
  // 40+ more Lithuanian cities...
  { name: 'kėdainiai', variants: ['kėdainiuose', 'kėdainių'] },
  { name: 'telšiai', variants: ['telšiuose', 'telšių'] },
  { name: 'tauragė', variants: ['tauragėje', 'tauragės'] },
  { name: 'ukmergė', variants: ['ukmergėje', 'ukmergės'] },
  { name: 'visaginas', variants: ['visagine', 'visagino'] },
  { name: 'palanga', variants: ['palangoje', 'palangos'] },
  { name: 'druskininkai', variants: ['druskininkuose', 'druskininkų'] },
  // ... (50+ total)
];
```

### Near Me Patterns

```typescript
const NEAR_ME_PATTERNS = [
  /\bšalia manęs\b/i,
  /\bnetoli\b/i,
  /\barti\b/i,
  /\bprie manęs\b/i,
  /\bmano rajone\b/i,
  /\bnear me\b/i,  // English fallback
  /\bnearby\b/i,
];
```

### GeoClassification Output

```typescript
interface GeoClassification {
  hasExplicitCity: boolean;
  city: string | null;           // Normalized city name
  isNearMe: boolean;
  isGeneric: boolean;            // No location mentioned
  passesGeoFilter: boolean;      // Given constraints
  geoScore: number;              // 0-1 for scoring
  reason: string;                // Why pass/fail
}
```

### Filtering Logic

```
Given: keyword, geoConstraints from Phase 75

1. Extract city from keyword
   → Found "kaune" → city: "kaunas"
   → Found "šiauliuose" → city: "šiauliai"
   → No city found → check near_me patterns

2. Check near_me patterns
   → Found "šalia manęs" → isNearMe: true, passesGeoFilter: nearMeAllowed

3. If no city and not near_me
   → isGeneric: true, passesGeoFilter: genericAllowed

4. If city found
   → Check includeCities: city in list → passesGeoFilter: true, geoScore: 1.0
   → Check excludeCities: city in list → passesGeoFilter: false, geoScore: 0.0
   → Neither: passesGeoFilter: false (not in target area)

5. Assign geoScore
   → Target city: 1.0
   → Near me: 0.9
   → Generic (allowed): 0.5
   → Generic (not allowed): 0.0
   → Wrong city: 0.0
```

### Integration Points

- Receives `geoConstraints` from Phase 75 (ConversationIntelligence)
- Outputs `GeoClassification` consumed by Phase 79 (ConstraintFiltering)
- Stored alongside funnel classification in `keyword_classifications` table

</decisions>

<references>
## Reference Documents

- `.planning/keyword-intelligence/WORLD-CLASS-ARCHITECTURE.md` — Full system design
- `open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts` — Uses locationCode 2440
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts` — Extracts location string

</references>

<existing_code>
## Existing Infrastructure

### Location Code Usage
- DataForSEO queries use `location_code: 2440` (Lithuania)
- No keyword-level city extraction
- `locationCode` parameter exists but country-level only

### ConversationExtractor
- Extracts single `location` string from conversation
- **Gap:** No structured city list, no include/exclude logic

</existing_code>

<success_criteria>
## Success Criteria

1. Lithuanian city variants detected 95%+ accuracy (all morphological forms)
2. Wrong-city keywords filtered (e.g., "plovykla kaune" when targeting Šiauliai)
3. "Near me" patterns correctly identified (Lithuanian and English)
4. Generic keywords (no city) configurable via `genericAllowed` flag
5. Geo score correctly influences composite score (1.0 target, 0.9 near-me, 0.5 generic)
6. 50+ Lithuanian cities with morphological variants covered
7. Processing speed: 1000 keywords in <1 second

</success_criteria>

<test_cases>
## Key Test Cases

### Target City: Šiauliai

```
"automobilių plovykla šiauliuose" → PASS, city: šiauliai, score: 1.0
"plovykla šiauliuose kaina" → PASS, city: šiauliai, score: 1.0
"automobilių plovykla kaune" → FAIL, city: kaunas, score: 0.0
"detailing vilniuje" → FAIL, city: vilnius, score: 0.0
"plovykla šalia manęs" → PASS (if nearMeAllowed), score: 0.9
"automobilių plovykla" → PASS (if genericAllowed), score: 0.5
"geriausia plovykla lietuvoje" → ? (depends on configuration)
```

### Multiple Target Cities: Vilnius + Kaunas

```
"plovykla vilniuje" → PASS, city: vilnius, score: 1.0
"plovykla kaune" → PASS, city: kaunas, score: 1.0
"plovykla šiauliuose" → FAIL (not in target list)
"plovykla" → PASS (if genericAllowed), score: 0.5
```

### Edge Cases

```
"vilniaus g. plovykla" → Check if "vilniaus" is street reference or city
"kaunietiškas stilius" → Not a city reference, generic keyword
"plovykla prie Vilniaus" → Near Vilnius, needs context
```

</test_cases>
