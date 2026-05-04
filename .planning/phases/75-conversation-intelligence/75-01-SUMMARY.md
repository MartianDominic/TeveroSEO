---
phase: 75-conversation-intelligence
plan: 01
subsystem: keywords
tags:
  - constraint-extraction
  - claude-api
  - conversation-intelligence
  - tdd
dependency_graph:
  requires: []
  provides:
    - constraint-extraction-service
    - analysis-constraints-types
    - extraction-prompt-template
  affects:
    - keyword-intelligence-system
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.90.0"
  patterns:
    - tdd-red-green-refactor
    - zod-runtime-validation
    - xml-structured-prompts
    - retry-with-backoff
    - factory-singleton-pattern
key_files:
  created:
    - open-seo-main/src/server/features/keywords/conversation/types.ts
    - open-seo-main/src/server/features/keywords/conversation/types.test.ts
    - open-seo-main/src/server/features/keywords/conversation/prompts.ts
    - open-seo-main/src/server/features/keywords/conversation/prompts.test.ts
    - open-seo-main/src/server/features/keywords/conversation/ConstraintExtractor.ts
    - open-seo-main/src/server/features/keywords/conversation/ConstraintExtractor.test.ts
    - open-seo-main/src/server/features/keywords/conversation/index.ts
  modified:
    - open-seo-main/src/server/features/keywords/index.ts
decisions:
  - decision: "Use Claude Sonnet 4.6 for extraction (not Opus)"
    rationale: "Sonnet 4.6 is the best coding model - fast, accurate, cost-effective for structured extraction"
    alternatives: ["Opus 4.5 (overkill)", "Haiku 4.5 (insufficient for complex extraction)"]
  - decision: "XML-structured prompt with few-shot Lithuanian examples"
    rationale: "Claude performs better with XML structure; Lithuanian examples critical for market context"
    alternatives: ["JSON prompt", "Generic English examples"]
  - decision: "Confidence scoring per-category with 0.5 threshold for clarification"
    rationale: "Better to ask for clarification than provide incorrect constraints that affect entire keyword pipeline"
    alternatives: ["Overall confidence only", "No clarification tracking"]
  - decision: "50k char MAX_CONTENT_LENGTH (same as ConversationExtractor)"
    rationale: "Proven DoS limit from existing patterns, prevents memory exhaustion"
    alternatives: ["10k (too restrictive)", "100k (DoS risk)"]
metrics:
  duration_seconds: 505
  tasks_completed: 3
  files_created: 7
  files_modified: 1
  tests_added: 50
  commits: 6
  lines_added: 1893
  completed_at: "2026-05-04T18:39:46Z"
---

# Phase 75 Plan 01: Constraint Extraction Service Summary

**One-liner:** XML-prompted Claude Sonnet 4.6 extracts 7-category AnalysisConstraints from Lithuanian conversations with per-field confidence scoring and automatic clarification requests for low-confidence fields (<0.5).

## Objective Achieved

Created the ConstraintExtractor service that converts unstructured client conversations into typed AnalysisConstraints using Claude Sonnet 4.6. This is the brain of the keyword intelligence system - all downstream filtering, classification, and scoring depends on accurate constraint extraction.

## What Was Built

### Task 1: AnalysisConstraints Type System (26 tests)

**Created:** `types.ts` - Full type system with Zod schemas

**All 7 constraint categories:**

1. **BusinessContext**: type (ecommerce/service/saas/local/b2b_services), coreOffering, problemsSolved[], productCategories[]
2. **GeoConstraints**: scope (hyperlocal/city/regional/national), includeCities[], excludeCities[], nearMeAllowed, genericAllowed
3. **AudienceConstraints**: b2bOnly, b2cAllowed, industryFocus[]
4. **FunnelConfig**: primary (bofu/mofu/tofu), fallbackOrder[], targetCount, minPerStage?
5. **Priority**: category, weightMultiplier (1.0-2.0), reason
6. **NegativeFilters**: excludeTerms[], excludeBrands[], excludeIntents[]
7. **SpecialModes**: pSEODetection, sideKeywordDiscovery, competitorGaps

**Additional types:**
- **ConfidenceScores**: overall + per-category confidence (0-1)
- **ExtractionResult**: wrapper with success, constraints (nullable), error (nullable), clarificationNeeded[], rawResponse?
- **isValidAnalysisConstraints()**: type guard using Zod validation

**Pattern:** Every interface has a Zod schema for runtime validation, following ConversationExtractor pattern.

### Task 2: XML Prompt Template with Lithuanian Examples (13 tests)

**Created:** `prompts.ts` - Metaprompt for Claude extraction

**Structure:**
```xml
<system>You are extracting keyword analysis constraints...</system>
<task>Extract structured constraints from conversation...</task>
<categories><!-- 7 categories with extraction rules --></categories>
<examples><!-- 3 Lithuanian conversation examples --></examples>
<output_schema><!-- JSON matching AnalysisConstraints --></output_schema>
<confidence_rules><!-- 0.9+ explicit, 0.7-0.9 strong, 0.5-0.7 inference, <0.5 clarify --></confidence_rules>
{{USER_INPUT}}
```

**3 Lithuanian examples embedded:**
1. **Case 1**: Local service B2B (car wash in Šiauliai) - B2B focus, hyperlocal targeting
2. **Case 2**: E-commerce national (cosmetics) - B2C, nationwide, transactional priority
3. **Case 3**: B2B services multiple cities (IT consulting) - TOFU, informational focus

**buildExtractionPrompt()**: Injects conversation + optional instruction into template.

**Confidence rules:**
- 0.9+: Explicit statement in conversation
- 0.7-0.9: Strong implication from context
- 0.5-0.7: Reasonable inference based on business type
- <0.5: Guesswork → **add to clarificationNeeded**

### Task 3: ConstraintExtractor Service (11 tests)

**Created:** `ConstraintExtractor.ts` - Main extraction service

**Key features:**

1. **Claude Sonnet 4.6 integration** via @anthropic-ai/sdk
2. **Resilient API calls** with withRetry (3 retries, exponential backoff, 1-30s delay)
3. **JSON extraction** handles markdown code blocks: ` ```json ... ``` ` or raw JSON
4. **Zod validation** ensures type safety of extraction output
5. **Confidence tracking** populates clarificationNeeded[] for <0.5 fields
6. **DoS protection** MAX_CONTENT_LENGTH 50k chars (T-75-04)
7. **Privacy** truncates logs to 100 chars (T-75-03), never logs full conversation
8. **API key validation** throws on construction if ANTHROPIC_API_KEY missing (T-75-01)

**Factory functions:**
- `createConstraintExtractor(config?)`: Create new instance with custom config
- `getDefaultExtractor()`: Singleton for simple use

**Default config:**
- Model: claude-sonnet-4-20250514
- MaxTokens: 4096
- Temperature: 0.1 (consistency over creativity)

**Module exports:**
- Barrel export in `conversation/index.ts`
- Re-exported from `keywords/index.ts` for top-level access

## Test Coverage

**Total: 50 tests passing**

| Module | Tests | Coverage |
|--------|-------|----------|
| types.ts | 26 | All 7 categories + ConfidenceScores + ExtractionResult + type guard |
| prompts.ts | 13 | XML structure, Lithuanian examples, injection, escaping |
| ConstraintExtractor.ts | 11 | Success/failure flows, JSON parsing, clarification, API key validation |

**TDD followed:** RED → GREEN commits for each task (6 total commits).

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations

| Threat ID | Mitigation | Implementation |
|-----------|------------|----------------|
| T-75-01 | Validate ANTHROPIC_API_KEY present before extraction | Constructor throws if missing |
| T-75-03 | Never log full conversation text | Truncate to 100 chars in error messages |
| T-75-04 | DoS protection via MAX_CONTENT_LENGTH check | Reject conversations >50k chars |
| T-75-05 | Zod schema validation to reject malformed JSON | ExtractionResultSchema.safeParse() |

T-75-02 (prompt tampering) accepted - prompts are read-only, no user-controlled template injection.

## Integration Points

**Upstream dependencies:**
- `@anthropic-ai/sdk` (Claude API)
- `@/server/lib/retry` (withRetry for resilience)
- `zod` (runtime validation)

**Downstream consumers (future plans):**
- 75-02: Geographic filtering will use GeoConstraints
- 75-03: Funnel classification will use FunnelConfig
- 75-04: Relevance scoring will use priorities + negatives
- 75-05: Cascade selection will use all constraints

**Exports available at:**
```typescript
import {
  ConstraintExtractor,
  getDefaultExtractor,
  type AnalysisConstraints,
  // ... all types and schemas
} from '@/server/features/keywords';
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 271513a | test | Task 1 RED - AnalysisConstraints type tests |
| 6c47792 | feat | Task 1 GREEN - AnalysisConstraints implementation |
| 26888b9 | test | Task 2 RED - Prompt template tests |
| 71cd96d | feat | Task 2 GREEN - XML prompt with Lithuanian examples |
| f18341f | test | Task 3 RED - ConstraintExtractor service tests |
| 16b4470 | feat | Task 3 GREEN - ConstraintExtractor implementation |

## Known Stubs

None. All functionality fully wired:
- Types are complete with all 7 categories
- Prompt template has real Lithuanian examples
- ConstraintExtractor calls real Claude API (mocked in tests)

## Example Usage

```typescript
import { getDefaultExtractor } from '@/server/features/keywords';

const extractor = getDefaultExtractor();

const result = await extractor.extract(
  "Parduodame kosmetiką internetu visoje Lietuvoje. B2C moterims 25-45m."
);

if (result.success) {
  console.log(result.constraints.business.type); // "ecommerce"
  console.log(result.constraints.geo.scope); // "national"
  console.log(result.constraints.funnel.primary); // inferred from "pardavimams"
  console.log(result.confidence.overall); // 0.85+
} else {
  console.error(result.error);
  console.log(result.clarificationNeeded); // Questions to ask client
}
```

## Next Steps

**Plan 75-02** (Geographic Filtering):
- Use `GeoConstraints.scope` to determine filtering strategy
- Apply `includeCities[]` and `excludeCities[]` to keyword list
- Respect `nearMeAllowed` and `genericAllowed` flags

**Plan 75-03** (Funnel Classification):
- Use `FunnelConfig.primary` as preferred stage
- Apply `fallbackOrder[]` when insufficient keywords in primary
- Enforce `minPerStage` if specified

**Plan 75-04** (Relevance Scoring):
- Apply `priorities[]` weight multipliers to category scores
- Filter out keywords matching `negatives.excludeTerms[]`
- Skip competitor brands from `negatives.excludeBrands[]`

## Self-Check: PASSED

**Files exist:**
```bash
✓ open-seo-main/src/server/features/keywords/conversation/types.ts
✓ open-seo-main/src/server/features/keywords/conversation/types.test.ts
✓ open-seo-main/src/server/features/keywords/conversation/prompts.ts
✓ open-seo-main/src/server/features/keywords/conversation/prompts.test.ts
✓ open-seo-main/src/server/features/keywords/conversation/ConstraintExtractor.ts
✓ open-seo-main/src/server/features/keywords/conversation/ConstraintExtractor.test.ts
✓ open-seo-main/src/server/features/keywords/conversation/index.ts
```

**Commits exist:**
```bash
✓ 271513a37 - test(75-01): add failing tests for AnalysisConstraints types (RED)
✓ 6c4779228 - feat(75-01): implement AnalysisConstraints type system (GREEN)
✓ 26888b98f - test(75-01): add failing tests for extraction prompt template (RED)
✓ 71cd96d40 - feat(75-01): create XML prompt template with Lithuanian examples (GREEN)
✓ f18341fad - test(75-01): add failing tests for ConstraintExtractor service (RED)
✓ 16b4470a3 - feat(75-01): implement ConstraintExtractor service (GREEN)
```

**Tests pass:**
```bash
✓ 50 tests passing (26 types + 13 prompts + 11 ConstraintExtractor)
```

All checks passed.
