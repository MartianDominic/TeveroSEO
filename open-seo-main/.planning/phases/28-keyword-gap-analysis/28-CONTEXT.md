# Phase 28: Keyword Gap Analysis - Context

**Gathered:** 2026-04-21
**Status:** Ready for execution
**Mode:** Auto-generated (plans pre-exist)

## Phase Boundary

Identify keywords competitors rank for that the prospect doesn't — "What are they missing?"

## Implementation Decisions

### Claude's Discretion
Plans already exist (28-01, 28-02, 28-03). Follow existing plan specifications. Use ROADMAP success criteria and codebase conventions to guide implementation.

## Success Criteria

1. Competitors auto-discovered via DataForSEO
2. Domain intersection API returns gap keywords
3. Top 100 gap keywords stored with volume, CPC, difficulty
4. Gap analysis UI displays sortable keyword table

## Existing Code Insights

- DataForSEO patterns in `src/server/lib/dataforseo*.ts`
- Prospect schema in `src/db/prospect-schema.ts`
- UI components follow shadcn/ui patterns
- Phase 27 (Website Scraping) is complete

## Plan Sequence

1. **28-01**: API & Schema - Domain intersection wrapper, KeywordGap interface, migration
2. **28-02**: Service Layer - ProspectAnalysisService with gap analysis workflow
3. **28-03**: UI Components - KeywordGapTable, DifficultyBadge, CSV export

## Deferred Ideas

None — using existing plans.
