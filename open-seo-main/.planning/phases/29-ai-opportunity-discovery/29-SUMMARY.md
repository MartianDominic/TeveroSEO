# Phase 29: AI Opportunity Discovery - Summary

**Completed:** 2026-04-21
**Status:** Complete

## Overview

Implemented AI-powered keyword opportunity discovery that generates keyword ideas from scraped business content. This enables finding keyword opportunities for sites with no existing ranking data ("What SHOULD they target?").

## Tasks Completed

### 29-01: AI Keyword Generator
- Created `keywordGenerator.ts` - Uses Claude API to generate 50-100 keyword ideas
- Builds structured prompts from business info (products, brands, services, location)
- Supports multiple languages (EN, LT, DE, FR, FI, etc.)
- Generates keywords in 5 categories: product, brand, service, commercial, informational
- Parses and validates AI responses with Zod schema
- Deduplicates keywords (case-insensitive)

### 29-02: Volume Validation
- Created `dataforseoVolume.ts` - DataForSEO Keywords Data API integration
- Uses `/v3/keywords_data/google_ads/search_volume/live` endpoint
- Created `volumeValidator.ts` - Validates and enriches AI-generated keywords
- Batches keywords in groups of 1000 (API limit)
- Filters out zero-volume keywords
- Enriches with CPC and difficulty data
- Uses default difficulty of 50 when not provided

### 29-03: Opportunity Scoring
- Implemented scoring formula: `searchVolume * cpc * (100 - difficulty) / 100`
- Higher scores indicate better opportunities:
  - High volume = more potential traffic
  - High CPC = more valuable traffic
  - Low difficulty = easier to rank
- Keywords sorted by opportunity score descending

### 29-04: UI Integration
- Created `OpportunityKeywordsTable.tsx` - Sortable, filterable table
  - Sort by: keyword, category, volume, CPC, difficulty, opportunity score
  - Filter by category (product/brand/service/commercial/informational)
  - Category badges with distinct colors
  - DifficultyBadge integration
  - "Add to proposal" placeholder action
- Created `OpportunitySummaryCard.tsx` - Summary statistics display
  - Total keywords, total volume, average opportunity score
  - Category breakdown with colored counts
- Created `OpportunityKeywordsTab.tsx` - Tab wrapper with export functionality
  - CSV export for keyword opportunities
  - Loading and empty states

## Schema Changes

Added to `prospect-schema.ts`:
```typescript
export const OPPORTUNITY_KEYWORD_CATEGORIES = [
  "product", "brand", "service", "commercial", "informational"
] as const;

export interface OpportunityKeyword {
  keyword: string;
  category: OpportunityKeywordCategory;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  opportunityScore: number;
  source: "ai_generated";
}
```

Added `opportunityKeywords` JSONB field to `prospectAnalyses` table.

## Files Created

### Server
- `src/server/lib/opportunity/keywordGenerator.ts` - AI keyword generation
- `src/server/lib/opportunity/keywordGenerator.test.ts` - 20 tests
- `src/server/lib/opportunity/dataforseoVolume.ts` - DataForSEO volume API
- `src/server/lib/opportunity/volumeValidator.ts` - Volume validation and scoring
- `src/server/lib/opportunity/volumeValidator.test.ts` - 19 tests
- `src/server/lib/opportunity/OpportunityDiscoveryService.ts` - Orchestration service
- `src/server/lib/opportunity/OpportunityDiscoveryService.test.ts` - 8 tests
- `src/server/lib/opportunity/index.ts` - Module exports

### Client
- `src/client/components/prospects/OpportunityKeywordsTable.tsx` - Table component
- `src/client/components/prospects/OpportunityKeywordsTable.test.ts` - 21 tests
- `src/client/components/prospects/OpportunitySummaryCard.tsx` - Summary card
- `src/client/components/prospects/OpportunityKeywordsTab.tsx` - Tab wrapper

## Files Modified

- `src/db/prospect-schema.ts` - Added OpportunityKeyword type and field
- `src/client/components/prospects/index.ts` - Added new component exports

## Test Coverage

- **68 total tests** across 4 test files
- All tests passing
- TDD approach followed (write tests first, then implement)

## API Endpoints Used

- **Claude API**: `claude-3-5-sonnet-20241022` for keyword generation
- **DataForSEO**: `/v3/keywords_data/google_ads/search_volume/live` for volume validation

## Usage Flow

1. Analysis runs and scrapes website content
2. BusinessExtractor extracts products, brands, services, location
3. KeywordGenerator uses Claude to generate keyword ideas
4. VolumeValidator checks keywords against DataForSEO
5. Zero-volume keywords filtered, scores calculated
6. Results stored in `opportunityKeywords` field
7. UI displays categorized, sortable keyword opportunities

## Success Criteria Met

- [x] AI generates relevant keywords from scraped content
- [x] Zero-volume keywords filtered out
- [x] Opportunity score ranks keywords usefully
- [x] Works for sites with no ranking data
- [x] UI shows categorized opportunities
- [x] Keywords ready to flow to Phase 30 proposals

## Next Steps (Phase 30)

Keywords from this phase will feed into the proposal generation system, allowing users to:
- Select target keywords from opportunities
- Generate SEO proposals with recommended actions
- Track keyword targeting across the platform
