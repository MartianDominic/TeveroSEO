# Phase 28: Keyword Gap & Opportunity Analysis - Context

**Gathered:** 2026-04-22
**Status:** Partially complete (60%)
**Mode:** Gap closure after implementation audit

## Phase Boundary

Show keywords competitors rank for that the prospect doesn't (gap analysis). Filter by achievability based on prospect's domain authority.

## Current State (from audit)

**DONE:**
- DataForSEO `domainIntersection` API integration (`dataforseoKeywordGap.ts`)
- `KeywordGap` interface with keyword, competitorDomain, position, volume, CPC, difficulty
- `KeywordGapTable.tsx` component with sorting and virtualization
- `GapSummaryCard.tsx` with statistics
- CSV export (`exportKeywordGaps()`)
- Basic opportunity score: `searchVolume * cpc * (100 - difficulty) / 100`

**GAPS:**
1. Achievability formula should use Domain Authority: `100 - max(0, difficulty - DA)`
2. Filter controls missing: min volume, max difficulty, competitor selection
3. Quick Wins tab missing: low difficulty + decent volume + not ranking

## Existing Code References

- `open-seo-main/src/server/lib/dataforseoKeywordGap.ts` — domainIntersection API
- `open-seo-main/src/client/components/prospects/KeywordGapTable.tsx` — gap table
- `open-seo-main/src/client/components/prospects/GapSummaryCard.tsx` — summary stats
- `open-seo-main/src/client/utils/export.ts` — CSV export
- `open-seo-main/src/db/prospect-schema.ts` — KeywordGap type, keywordGaps JSONB column

## Success Criteria

1. Achievability score uses DA: `100 - max(0, difficulty - DA)`
2. Filter controls: min volume, max difficulty, competitor selection
3. Quick Wins tab highlights low-effort opportunities
