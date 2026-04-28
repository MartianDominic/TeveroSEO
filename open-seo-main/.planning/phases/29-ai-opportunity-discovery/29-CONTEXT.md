# Phase 29: AI Opportunity Discovery - Context

**Gathered:** 2026-04-21
**Status:** Ready for execution
**Mode:** Auto-generated (plans pre-exist)

## Phase Boundary

Generate keyword opportunities from scraped business content — "What SHOULD they target?"

Uses Phase 27 scraped content (products, brands, services) to suggest keywords even for zero-ranking sites.

## Implementation Decisions

### Claude's Discretion
Plan 29-PLAN.md exists with detailed specifications. Follow existing plan. Use ROADMAP success criteria and codebase conventions.

## Success Criteria

1. AI generates keyword ideas from products, brands, services
2. DataForSEO validates keywords (filters zero-volume)
3. Opportunity scoring ranks keywords by potential
4. UI shows categorized opportunities

## Dependencies

- Phase 27: Website Scraping (complete) - scraped content available
- Phase 28: Keyword Gap Analysis (complete) - gap analysis infrastructure

## Existing Code Insights

- Business info extracted via `businessExtractor.ts`
- DataForSEO keyword data endpoint available
- Opportunity scoring from Phase 28: `searchVolume * cpc * (100 - difficulty) / 100`
- UI patterns established in Phase 28 (KeywordGapTable)

## Plan Sequence

1. **29-PLAN.md**: AI Keyword Generator + Volume Validation + Scoring + UI

## Deferred Ideas

None — using existing plan.
