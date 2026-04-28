# Phase 37-01: Voice Schema - COMPLETE

## Summary

Created the database schema foundation for brand voice management with three tables supporting 12 voice dimensions, per-page analysis storage, and content protection rules.

## Tasks Completed

### 1. Voice Schema with TDD
- [x] Created `src/db/voice-schema.test.ts` with 21 tests
- [x] Created `src/db/voice-schema.ts` with three tables

**voiceProfiles table** (12 voice dimensions):
- tone_primary, tone_secondary
- formality_level (1-10)
- personality_traits (JSONB array)
- archetype (professional/casual/technical/friendly/authoritative)
- sentence_length_avg, paragraph_length_avg
- contraction_usage (never/sometimes/frequently)
- vocabulary_patterns (JSONB: preferred/avoided arrays)
- signature_phrases, forbidden_phrases (JSONB arrays)
- heading_style (title_case/sentence_case/all_caps)
- confidence_score (0-100)

**voiceAnalysis table:**
- Stores per-page AI analysis results
- Links to voiceProfiles via FK
- Captures extracted tone, formality, sample sentences

**contentProtectionRules table:**
- Three rule types: page, section, pattern
- Target field for URL/CSS selector/regex
- Optional expiration date
- Audit trail (created_by, reason)

### 2. Migration Generation
- [x] Added export to `src/db/schema.ts`
- [x] Created `drizzle/0027_voice_tables.sql`
- [x] Fixed VOICE_MODES conflict (re-exported from brief-schema)

## Test Results

```
Test Files  1 passed (1)
     Tests  21 passed (21)
  Duration  368ms
```

## Files Created/Modified

| File | Change |
|------|--------|
| `src/db/voice-schema.ts` | NEW - 3 tables with types |
| `src/db/voice-schema.test.ts` | NEW - 21 tests |
| `src/db/schema.ts` | Added voice-schema export |
| `drizzle/0027_voice_tables.sql` | NEW - Migration |

## Key Implementation Details

### Enum Exports
- `VOICE_MODES`: Re-exported from brief-schema (preservation/application/best_practices)
- `ARCHETYPES`: 5 brand archetypes
- `CONTRACTION_USAGE`: 3 frequency levels
- `HEADING_STYLES`: 3 capitalization styles
- `PROTECTION_RULE_TYPES`: page/section/pattern

### JSONB Typed Interfaces
- `VocabularyPatterns`: { preferred: string[], avoided: string[] }
- `RawVoiceAnalysis`: Full AI response storage

### Relations
- voiceProfiles → clients (FK, cascade delete)
- voiceAnalysis → voiceProfiles (FK, cascade delete)
- contentProtectionRules → voiceProfiles (FK, cascade delete)

## Phase Status: COMPLETE

Ready for Wave 2: Voice Analysis Service (37-02) and Profile CRUD (37-03)
