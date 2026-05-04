---
phase: 77-geographic-intelligence
plan: 01
subsystem: keyword-intelligence
tags:
  - geographic-filtering
  - lithuanian-morphology
  - local-seo
  - keyword-classification
dependency_graph:
  requires:
    - Phase 73 (intent classification foundations)
  provides:
    - GeoClassifier service for city extraction
    - Lithuanian city database with 50+ cities
    - Near-me pattern detection
  affects:
    - Phase 79 (ConstraintFiltering)
    - Phase 80 (scoring system)
tech_stack:
  added:
    - Lithuanian city morphology database
    - Zod schema validation for constraints
  patterns:
    - O(1) city lookup via pre-built variant index
    - TDD with comprehensive edge case coverage
key_files:
  created:
    - open-seo-main/src/server/features/keywords/geo/types.ts
    - open-seo-main/src/server/features/keywords/geo/cities.ts
    - open-seo-main/src/server/features/keywords/geo/GeoClassifier.ts
    - open-seo-main/src/server/features/keywords/geo/index.ts
    - open-seo-main/src/server/features/keywords/geo/cities.test.ts
    - open-seo-main/src/server/features/keywords/geo/GeoClassifier.test.ts
  modified: []
decisions:
  - id: GEO-01
    title: Lithuanian city database with morphological variants
    rationale: DataForSEO returns country-level keywords; need city extraction to filter
    alternatives: NLP library (overkill), hardcoded regex (unmaintainable)
    chosen: Curated city database with all morphological forms
  - id: GEO-02
    title: Street reference filtering
    rationale: "vilniaus g." is a street reference, not city "Vilnius"
    implementation: Check for street suffixes (g., gatve, prospektas) after city name
  - id: GEO-03
    title: Three-tier scoring (1.0, 0.9, 0.5)
    rationale: Target city = highest priority, near-me = local intent, generic = fallback
    impact: Composite score correctly reflects geographic relevance
  - id: GEO-04
    title: O(1) city lookup via variant index
    rationale: 1000 keywords must process in <1 second
    implementation: Pre-build Map<variant, CityEntry> at module load time
metrics:
  duration_seconds: 226
  tasks_completed: 3
  files_created: 6
  test_cases: 44
  city_database_size: 50
  performance_1000_keywords_ms: 8
  completed_date: "2026-05-04"
---

# Phase 77 Plan 01: Geographic Intelligence - Foundation Summary

**One-liner:** Lithuanian city extraction with 50+ cities, morphological variants, and O(1) lookup for local SEO filtering.

## What Was Built

Built the Geographic Intelligence module for the World-Class Keyword Intelligence system. This module extracts city mentions from Lithuanian keywords (handling all morphological cases like vilnius/vilniuje/vilniaus), detects "near me" patterns, and classifies keywords as city-specific, near-me, or generic.

**Purpose:** Local service businesses need to filter keywords by geography. A car wash in Siauliai should not target "plovykla kaune" (car wash in Kaunas).

**Key Components:**
1. **Lithuanian City Database** - 50+ cities with full morphological variants (4+ forms for major cities)
2. **GeoClassifier Service** - Extracts cities, detects near-me patterns, applies filtering constraints
3. **Street Reference Detection** - "vilniaus g." correctly treated as street, not city
4. **Performance Optimization** - O(1) city lookup via pre-built variant index

## Tasks Completed

| Task | Name | Commit | Files | Status |
|------|------|--------|-------|--------|
| 1 | Types and Lithuanian City Database | ffec0a0ce | types.ts, cities.ts, cities.test.ts | ✓ Complete |
| 2 | GeoClassifier Service | 41d7653f0 | GeoClassifier.ts, GeoClassifier.test.ts, index.ts | ✓ Complete |
| 3 | Full Test Suite and Edge Cases | (included in T1/T2) | All test files | ✓ Complete |

## Test Coverage

**44 test cases pass:**
- 19 tests in cities.test.ts (database validation, findCity(), pattern matching)
- 25 tests in GeoClassifier.test.ts (all classification scenarios, edge cases, performance)

**Coverage highlights:**
- All major cities (vilnius, kaunas, klaipeda, siauliai, panevezys) have 4+ variants
- 50+ Lithuanian cities total
- Street reference filtering (vilniaus g., gatve, prospektas)
- Multi-city targeting (Vilnius + Kaunas)
- Near-me patterns (Lithuanian and English)
- Exclude cities override logic
- Performance: 1000 keywords in 8ms (<1 second target ✓)

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Consumes:**
- `geoConstraints` from Phase 75 ConversationIntelligence (includeCities, excludeCities, nearMeAllowed, genericAllowed)

**Provides:**
- `GeoClassification` interface with city, isNearMe, isGeneric, passesGeoFilter, geoScore, reason
- `geoClassifier` singleton service with classify() and classifyBatch() methods

**Used by:**
- Phase 79 ConstraintFiltering (applies geo filter to keyword lists)
- Phase 80 Scoring (geoScore contributes to composite score)

## Technical Highlights

### Lithuanian Morphology Handling

The city database covers all morphological cases:
- **Nominative**: vilnius, kaunas, siauliai
- **Locative**: vilniuje, kaune, siauliuose (most common in "in [city]" phrases)
- **Genitive**: vilniaus, kauno, siauliu (possessive forms)
- **Dative**: vilniui, kaunui, siauliams
- **Accusative**: vilniu, kauna, siaulius

### Street Reference Detection

Prevents false positives:
```
"vilniaus g. plovykla" → GENERIC (street reference)
"plovykla vilniuje" → CITY: vilnius (location reference)
```

**Street suffixes:** g., gatve, gatves, gatvė, gatvės, prospektas, aleja, skersgatvis

### Performance Optimization

**O(1) Lookup:**
```typescript
// Pre-build variant index at module load time
const variantIndex = new Map<string, CityEntry>();
for (const city of LITHUANIAN_CITIES) {
  for (const variant of city.variants) {
    variantIndex.set(variant.toLowerCase(), city);
  }
}

// Runtime lookup is O(1)
export function findCity(text: string): CityEntry | null {
  return variantIndex.get(text.toLowerCase()) || null;
}
```

**Performance test result:** 1000 keywords classified in 8ms (125,000 keywords/second).

### Scoring Logic

| Classification | Score | Pass Condition |
|----------------|-------|----------------|
| Target city | 1.0 | city in includeCities |
| Excluded city | 0.0 | city in excludeCities |
| Near-me | 0.9 | nearMeAllowed = true |
| Generic | 0.5 | genericAllowed = true |
| Wrong city | 0.0 | city not in includeCities |

## Next Steps

**Phase 77 Plan 02:** Constraint composition and filtering service integration.

**Downstream consumers:**
- Phase 79: Apply GeoClassification.passesGeoFilter in constraint pipeline
- Phase 80: Include GeoClassification.geoScore in composite score calculation

## Known Stubs

None. All functionality fully implemented and tested.

## Threat Flags

None. GeoConstraints validated via Zod schema before processing (mitigates T-77-01 spoofing threat).

## Self-Check: PASSED

All created files verified to exist:
- ✓ types.ts
- ✓ cities.ts
- ✓ GeoClassifier.ts
- ✓ index.ts
- ✓ cities.test.ts
- ✓ GeoClassifier.test.ts

All commits verified to exist:
- ✓ ffec0a0ce (Task 1: Types and Lithuanian City Database)
- ✓ 41d7653f0 (Task 2: GeoClassifier Service)
