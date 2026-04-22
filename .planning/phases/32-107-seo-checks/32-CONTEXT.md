# Phase 32: 107 SEO Checks Implementation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via autonomous workflow)

## Phase Boundary

Implement all 107 SEO checks from MICRO-OPTIMIZATIONS-80-PERCENT.md. Organized by tier: Tier 1 (66 DOM/regex), Tier 2 (21 calculation), Tier 3 (13 API), Tier 4 (7 crawl). Check runner with scoring.

## Success Criteria

1. `audit_findings` table with: checkId, severity, autoEditable, editRecipe, field, value
2. All 66 Tier 1 checks implemented (DOM/regex — instant, free)
3. All 21 Tier 2 checks implemented (light calculation)
4. All 13 Tier 3 checks implemented (API required — DataForSEO, GSC)
5. All 7 Tier 4 checks implemented (crawl required)
6. `runAllChecks(url, keyword)` returns findings with scores
7. On-page score calculated: 100-point scale with category breakdown
8. Check results visible at `/clients/[id]/seo/audit/[pageId]`

## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per autonomous workflow. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

## Existing Code Insights

Codebase context will be gathered during plan-phase research.

**Design doc:** `open-seo-main/docs/MICRO-OPTIMIZATIONS-80-PERCENT.md`
**Depends on:** Phase 31 (site connection for content access)
**Working directory:** `open-seo-main/`
**Current state:** 5% — Only Cheerio parsing and ~25 implicit checks in health score

## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

## Deferred Ideas

None — discuss phase skipped.
