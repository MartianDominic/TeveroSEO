---
phase: 92-on-page-seo-mastery
plan: 07
subsystem: audit-checks
tags:
  - tier1-checks
  - page-structure
  - seo-audit
dependency_graph:
  requires:
    - 92-01 (VerticalClassifier)
    - 92-04 (RuleEngineService)
  provides:
    - T1-70 to T1-85 page structure checks
    - Page type detection utility
  affects:
    - open-seo-main/src/server/lib/audit/checks/tier1/
tech_stack:
  added: []
  patterns:
    - registerCheck pattern for check registration
    - Page type filtering for conditional check execution
key_files:
  created:
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-70-page-type.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-71-value-prop.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-72-cta-above-fold.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-73-h2-spacing.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-74-comparison-table.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-75-pros-cons.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-76-winner-declaration.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-77-listicle-numbered.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-78-nap-info.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-79-map-embed.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-80-local-business-schema.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-81-author-byline.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-82-published-date.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-83-service-schema.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-84-itemlist-schema.ts
    - open-seo-main/src/server/lib/audit/checks/tier1/T1-85-social-proof.ts
  modified:
    - open-seo-main/src/server/lib/audit/checks/tier1/index.ts
decisions:
  - Page type detection uses 3-tier confidence: JSON-LD (95%), DOM structure (80%), content patterns (60%)
  - Unknown page types still run checks but with reduced applicability messaging
  - Checks export detectPageType for reuse across the check suite
metrics:
  duration: 5m 17s
  completed_date: "2026-05-06T20:17:24Z"
---

# Phase 92 Plan 07: Tier 1 Page Structure Checks Summary

16 new Tier 1 page structure checks (T1-70 to T1-85) implementing page-type-specific SEO validation for article, comparison, listicle, local, and service pages.

## Task Summary

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create T1-70 to T1-75 checks | 0f8372850 | Complete |
| 2 | Create T1-76 to T1-85 checks | 6b295adbd | Complete |

## Checks Implemented

| ID | Name | Page Types | Severity |
|----|------|------------|----------|
| T1-70 | Page type detected | All | medium |
| T1-71 | Value proposition above fold | All | high |
| T1-72 | Primary CTA above fold | service, local | high |
| T1-73 | H2 spacing optimal | article | low |
| T1-74 | Comparison table present | comparison | high |
| T1-75 | Pros/cons section present | comparison | medium |
| T1-76 | Winner declaration present | comparison | medium |
| T1-77 | Listicle items numbered | listicle | medium |
| T1-78 | NAP information present | local | **critical** |
| T1-79 | Map embed present | local | medium |
| T1-80 | LocalBusiness schema complete | local | high |
| T1-81 | Author byline present | article | high |
| T1-82 | Published date visible | article | medium |
| T1-83 | Service schema present | service | medium |
| T1-84 | ItemList schema present | listicle | medium |
| T1-85 | Social proof section present | service | medium |

## Implementation Details

### Page Type Detection (T1-70)

Central utility for classifying pages into 6 types:
- **article**: Blog posts, news articles
- **comparison**: VS pages, feature comparisons
- **listicle**: Top 10, best-of lists
- **local**: Location pages, store locators
- **service**: Service landing pages
- **product**: E-commerce product pages

Detection uses 3-tier confidence scoring:
1. JSON-LD schema matching (95% confidence)
2. DOM structure patterns (80% confidence)
3. Content text patterns (60% confidence)

### Check Registration Pattern

All checks follow the established `registerCheck` pattern:
```typescript
registerCheck({
  id: "T1-XX",
  name: "Check name",
  tier: 1,
  category: "content-structure",
  severity: "high" | "medium" | "low" | "critical",
  autoEditable: true,
  editRecipe: "How to fix this issue",
  run: (ctx: CheckContext): CheckResult => { ... }
});
```

### Page Type Filtering

Checks that apply to specific page types return early with `passed: true` and `severity: "info"` when the detected page type doesn't match:

```typescript
if (pageType && pageType !== "comparison" && pageType !== "unknown") {
  return {
    checkId: "T1-74",
    passed: true,
    severity: "info",
    message: `Comparison table check not applicable for ${pageType} pages`,
    autoEditable: false,
  };
}
```

## Updated Tier 1 Index

Modified `index.ts` to:
- Import all 16 new check files
- Update `TIER1_CHECK_COUNT` from 68 to 84
- Export `detectPageType` and `PageType` for reuse

## Deviations from Plan

None - plan executed exactly as written.

## Verification

```bash
# Count check files
ls open-seo-main/src/server/lib/audit/checks/tier1/T1-7*.ts \
   open-seo-main/src/server/lib/audit/checks/tier1/T1-8*.ts | wc -l
# Output: 16

# Verify registrations
grep -l "registerCheck" open-seo-main/src/server/lib/audit/checks/tier1/T1-{7,8}*.ts | wc -l
# Output: 16
```

## Self-Check: PASSED

- [x] All 16 check files exist
- [x] All files contain registerCheck pattern
- [x] T1-78 (NAP) has severity "critical"
- [x] Index updated with imports and count
- [x] Commits 0f8372850 and 6b295adbd verified
