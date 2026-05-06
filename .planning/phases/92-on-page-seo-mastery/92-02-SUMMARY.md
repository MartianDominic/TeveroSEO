---
phase: 92-on-page-seo-mastery
plan: 02
subsystem: text-processing-utilities
tags: [tokenization, readability, nlp, pii-stripping, semantic-chunking]
dependency_graph:
  requires: []
  provides:
    - ChunkExtractor utility (tiktoken + semantic-chunking)
    - ReadabilityScorer utility (5 readability formulas)
    - EntityExtractor utility (NLP + PII stripping)
  affects:
    - Quality gates (T5-01 to T5-13) - depend on these utilities
tech_stack:
  added:
    - tiktoken: ^1.0.22 (cl100k_base encoding for token counting)
    - semantic-chunking: ^2.6.0 (BYOE pattern for semantic boundaries)
    - text-readability: ^1.1.1 (Flesch-Kincaid, Gunning Fog, SMOG, ARI)
    - compromise: ^14.15.0 (NLP entity extraction)
    - compromise-dates: ^3.7.1 (date entity plugin)
  patterns:
    - WASM resource cleanup (encoding.free() in finally block)
    - DOM cloning to avoid Cheerio mutation
    - Barrel exports via utils/index.ts
key_files:
  created:
    - open-seo-main/src/server/features/onpage-mastery/utils/ChunkExtractor.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/ChunkExtractor.test.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/ReadabilityScorer.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/ReadabilityScorer.test.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/EntityExtractor.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/EntityExtractor.test.ts
    - open-seo-main/src/server/features/onpage-mastery/utils/index.ts
  modified:
    - open-seo-main/package.json
decisions:
  - Used chunkit() function from semantic-chunking (flat array return, not doc.chunks)
  - Extended compromise with compromise-dates plugin for date extraction
  - PII stripping uses placeholder tokens [EMAIL], [PHONE], [SSN]
  - Vertical readability thresholds capped at grade 10 for YMYL content
metrics:
  duration: ~15 minutes
  completed: 2026-05-06T19:46:42Z
  tests: 72 passing
  files_created: 7
  files_modified: 1
---

# Phase 92 Plan 02: Text Processing Utilities Summary

Text processing utilities with tiktoken tokenization, semantic chunking, readability scoring, and NLP entity extraction with PII stripping.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | aab978b10 | ChunkExtractor with tiktoken tokenization (prior session) |
| 2 | f51aae5bb | ReadabilityScorer + EntityExtractor implementations |

## What Was Built

### ChunkExtractor (OPM-04, OPM-05, OPM-06)

Token counting and semantic chunking utilities:

- `countTokens(text)` - Accurate token counts using tiktoken cl100k_base encoding
- `batchCountTokens(texts)` - Efficient multi-text tokenization with single encoder instance
- `extractText($)` - HTML text extraction with DOM cloning to avoid Cheerio mutation
- `extractChunks(html, embedFn)` - Semantic chunking with BYOE (Bring Your Own Embedder) pattern
- `extractSimpleChunks(html)` - Quick chunking without embeddings
- `extractPathPattern(path)` - URL pattern normalization for caching

Key features:
- Targets 400-600 token chunks with H2/H3 boundary priority
- DoS protection: MAX_CHUNKS = 100, MAX_CONTENT_SIZE = 100KB
- Chunk quality metrics: tokenScore, selfContainmentScore, headingAlignmentScore

### ReadabilityScorer (OPM-14)

Multi-formula readability analysis:

- `analyzeReadability(text)` - Returns comprehensive ReadabilityScores object
- `getVerticalReadabilityThreshold(vertical, isYMYL)` - Industry-specific grade thresholds

Scoring formulas:
- Flesch Reading Ease (0-100, higher = easier)
- Flesch-Kincaid Grade Level (US grade 0-18+)
- Gunning Fog Index
- SMOG Index
- Automated Readability Index (ARI)

Vertical thresholds:
- healthcare: 10, legal: 12, financial: 10, saas: 14, general: 12
- YMYL content capped at grade 10 for accessibility

### EntityExtractor (OPM-15)

NLP entity extraction with PII protection:

- `extractEntities(text)` - Named entity recognition (people, places, organizations, dates, numbers)
- `stripPII(text)` - Replaces emails, phones, SSNs with placeholder tokens
- `containsPII(text)` - Boolean check for PII presence
- `calculateEvidenceDensity(text)` - Statistics/citations per 200 words

PII patterns detected and stripped:
- Email addresses -> [EMAIL]
- Phone numbers (US formats) -> [PHONE]
- SSN patterns -> [SSN]

## Test Coverage

72 tests passing across 3 test files:

| Module | Tests | Coverage |
|--------|-------|----------|
| ChunkExtractor | 32 | Token counting, text extraction, chunk boundaries, 100-chunk limit |
| ReadabilityScorer | 16 | Grade levels, formulas, vertical thresholds, YMYL caps |
| EntityExtractor | 24 | Entity extraction, PII stripping, evidence density |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] semantic-chunking API differs from documentation**
- **Found during:** Task 1 (prior session)
- **Issue:** Documentation showed `doc.chunks` but library returns flat array
- **Fix:** Iterate `chunkedDocuments` directly, each item has `text`, `token_length`, `embedding`
- **Files modified:** ChunkExtractor.ts

**2. [Rule 1 - Bug] compromise dates() not available in base package**
- **Found during:** Task 2
- **Issue:** `doc.dates()` threw "doc.dates is not a function"
- **Fix:** Installed compromise-dates plugin, extended nlp with `nlp.plugin(dates)`
- **Files modified:** EntityExtractor.ts, package.json

**3. [Rule 1 - Bug] Entity extraction included trailing punctuation**
- **Found during:** Task 2
- **Issue:** Places extracted as "New York." instead of "New York"
- **Fix:** Added cleanEntity() function to strip trailing punctuation
- **Files modified:** EntityExtractor.ts

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-92-04 | MAX_CHUNKS = 100, MAX_CONTENT_SIZE = 100KB in ChunkExtractor |
| T-92-05 | stripPII() removes emails, phones, SSNs before LLM calls |

## Requirements Completed

- [x] OPM-04: Tokenization with cl100k_base encoding
- [x] OPM-05: Semantic chunks targeting 400-600 tokens
- [x] OPM-06: 100-chunk limit enforced
- [x] OPM-14: Multi-formula readability scoring
- [x] OPM-15: Entity extraction with PII stripping

## Self-Check: PASSED

Files verified:
- FOUND: open-seo-main/src/server/features/onpage-mastery/utils/ChunkExtractor.ts
- FOUND: open-seo-main/src/server/features/onpage-mastery/utils/ReadabilityScorer.ts
- FOUND: open-seo-main/src/server/features/onpage-mastery/utils/EntityExtractor.ts
- FOUND: open-seo-main/src/server/features/onpage-mastery/utils/index.ts

Commits verified:
- FOUND: aab978b10 (ChunkExtractor)
- FOUND: f51aae5bb (ReadabilityScorer + EntityExtractor)
