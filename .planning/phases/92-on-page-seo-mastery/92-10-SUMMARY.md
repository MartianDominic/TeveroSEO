---
phase: 92-on-page-seo-mastery
plan: 10
subsystem: testing
tags: [integration-tests, unit-tests, coverage, vitest]
dependency_graph:
  requires:
    - 92-01
    - 92-02
    - 92-03
    - 92-04
  provides:
    - onpage-mastery-test-suite
    - coverage-thresholds
  affects:
    - open-seo-main/vitest.config.ts
tech_stack:
  added: []
  patterns:
    - parameterized-tests
    - mock-driven-integration
    - circuit-breaker-testing
key_files:
  created:
    - open-seo-main/src/server/features/onpage-mastery/integration.test.ts
  modified:
    - open-seo-main/vitest.config.ts
decisions:
  - "Basic tier used for integration tests to avoid LLM calls for Reddit Test"
  - "13 verticals tested with parameterized it.each() pattern"
  - "Coverage thresholds set at 80% statements/lines, 70% branches"
metrics:
  duration_seconds: 250
  completed_date: "2026-05-06"
  test_count: 241
  coverage_target: 80
---

# Phase 92 Plan 10: Integration Tests Summary

Comprehensive test suite for Phase 92 On-Page SEO Mastery services with mocked LLM/embedding responses for deterministic results.

## One-Liner

Integration tests for full audit pipeline (VerticalClassifier -> QualityGateService -> RuleEngineService) with 241 tests and 80% coverage thresholds.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| af24eafe4 | test | Integration tests and coverage thresholds for Phase 92 |

## Deliverables

### Integration Test Suite (integration.test.ts)

**Full Pipeline Tests:**
- Healthcare content: classify -> quality gates -> scorecard
- Ecommerce: Product schema detection
- Legal: LegalService schema detection
- Thin content: blocking failure detection
- LLM fallback for ambiguous content

**Vertical Coverage Tests (13 verticals):**
- healthcare, legal, financial (YMYL)
- ecommerce, saas, real_estate
- home_services, hospitality, education
- professional, manufacturing, nonprofit, general

**YMYL Handling Tests:**
- 85 threshold for YMYL vs 70 for non-YMYL
- 800 word minimum for healthcare vs 400 for general

**Error Handling Tests:**
- Missing API key
- Malformed HTML
- Empty content

**Client Override Tests:**
- Disabled rules excluded from evaluation
- Custom weights applied correctly

**Performance Tests:**
- Full pipeline under 500ms with mocks

### Vitest Config Updates

```typescript
coverage: {
  thresholds: {
    "src/server/features/onpage-mastery/services/": {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
    "src/server/features/onpage-mastery/utils/": {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
}
```

## Test Results

```
Test Files  9 passed (9)
Tests       241 passed (241)
Duration    2.35s
```

**Breakdown:**
- VerticalClassifier.test.ts: 27 tests
- QualityGateService.test.ts: 31 tests
- RuleEngineService.test.ts: 14 tests
- integration.test.ts: 36 tests
- ChunkExtractor.test.ts: 21 tests
- EntityExtractor.test.ts: 39 tests
- SchemaGenerator.test.ts: 28 tests
- Other utils: 45 tests

## Deviations from Plan

None - plan executed exactly as written. Existing unit tests were comprehensive; integration test added as planned.

## Verification

```bash
cd open-seo-main && pnpm vitest run src/server/features/onpage-mastery/
# 241 tests passing
```

## Self-Check: PASSED

- [x] integration.test.ts created at correct path
- [x] vitest.config.ts updated with coverage thresholds
- [x] Commit af24eafe4 exists in git log
- [x] All 241 tests passing
