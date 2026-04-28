# Phase 27-03: AI Business Extractor - COMPLETE

**Date:** 2026-04-21
**Status:** ✅ Complete
**Autonomous:** false

## Overview

Implemented AI-powered business information extraction from scraped website content using Claude. The system analyzes multi-page scrape results to extract products, brands, services, location, and target market with confidence scoring. Added UI components to display extracted information and provide manual input fallback for low-confidence extractions.

## Implementation Summary

### 1. Business Extractor Service

**File:** `src/server/lib/scraper/businessExtractor.ts`

- `extractBusinessInfo()` - Calls Claude API with scraped page data
- Builds optimized prompt from PageAnalysis fields (title, meta, h1s, etc.)
- Returns structured BusinessInfo with confidence score (0-1)
- Validates response with Zod schema
- Graceful error handling returns empty results

**Dependencies:**
- `@anthropic-ai/sdk` - Claude API client
- Model: `claude-3-5-sonnet-20241022`
- Max tokens: 2048

### 2. Database Schema Update

**File:** `src/db/prospect-schema.ts`

Added `scrapedContent` JSONB column to `prospect_analyses`:

```typescript
scrapedContent: jsonb("scraped_content").$type<ScrapedContent>()
```

**ScrapedContent type includes:**
- `pages: PageAnalysis[]` - Scraped page data
- `businessLinks: BusinessLinks | null` - Detected business URLs
- `businessInfo: BusinessInfo | null` - AI-extracted information
- `totalCostCents: number` - Combined scraping + AI cost
- `scrapedAt: string` - ISO timestamp

**Migration:** `drizzle/0014_add_scraped_content.sql`

### 3. Worker Integration

**File:** `src/server/workers/prospect-analysis-processor.ts`

Added Step 4 after keyword/competitor analysis:
1. Call `scrapeProspectSite(domain)` from multiPageScraper
2. Combine homepage + additional pages
3. Call `extractBusinessInfo(pages, domain)`
4. Build ScrapedContent object with results
5. Add to analysis update with cost tracking

**Error handling:** Scraping failures are logged but don't fail the entire analysis (optional step).

### 4. Analysis Service Update

**File:** `src/server/features/prospects/services/AnalysisService.ts`

- Added `ScrapedContent` import from prospect-schema
- Updated `AnalysisResults` interface to include `scrapedContent?`
- Updated `updateAnalysisResult()` to save scraped content to database

### 5. UI Components

#### ScrapedContentDisplay.tsx
**File:** `apps/web/src/components/prospects/ScrapedContentDisplay.tsx`

Displays extracted business information:
- Summary text
- Location and target market badges
- Products (secondary badges)
- Brands (outline badges)
- Services (default badges)
- Confidence score with color coding:
  - Green (≥70%): High confidence
  - Yellow (40-69%): Medium confidence
  - Red (<40%): Low confidence
- Low confidence warning (<50%)

#### BusinessInfoForm.tsx
**File:** `apps/web/src/components/prospects/BusinessInfoForm.tsx`

Manual input form for fallback:
- Dynamic field arrays for products, brands, services
- Add/remove buttons for each field type
- Location text input
- Target market select (residential/commercial/both)
- Summary textarea
- Form validation and submission

#### BusinessInfoFormWrapper.tsx
**File:** `apps/web/src/components/prospects/BusinessInfoFormWrapper.tsx`

Client wrapper to handle server actions properly.

### 6. Prospect Detail Page Update

**File:** `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx`

Shows business information in Latest Analysis section:
- Display ScrapedContentDisplay if confidence ≥ 0.5
- Display BusinessInfoFormWrapper if no data or confidence < 0.5
- Manual form saves to same `scrapedContent` field with confidence=1.0

### 7. Server Actions

**File:** `apps/web/src/app/(shell)/prospects/[prospectId]/actions.ts`

Added `saveManualBusinessInfo()`:
- Updates existing `scrapedContent` with manual business info
- Sets confidence to 1.0 (manual entry is fully confident)
- Revalidates prospect detail page after save

### 8. Environment Configuration

**File:** `.env.example`

Added optional `ANTHROPIC_API_KEY` configuration.

## Test Coverage

**File:** `src/server/lib/scraper/businessExtractor.test.ts`

6 passing tests:
1. ✅ Extract products array from scraped content
2. ✅ Identify brand names
3. ✅ Detect services offered
4. ✅ Extract location
5. ✅ Handle empty content gracefully
6. ✅ Return confidence score

All tests use mocked Anthropic SDK responses.

## Files Created

1. `src/server/lib/scraper/businessExtractor.ts` - Core extraction logic
2. `src/server/lib/scraper/businessExtractor.test.ts` - Test suite
3. `apps/web/src/components/prospects/ScrapedContentDisplay.tsx` - Display component
4. `apps/web/src/components/prospects/BusinessInfoForm.tsx` - Manual input form
5. `apps/web/src/components/prospects/BusinessInfoFormWrapper.tsx` - Client wrapper
6. `drizzle/0014_add_scraped_content.sql` - Database migration

## Files Modified

1. `src/db/prospect-schema.ts` - Added ScrapedContent type and column
2. `src/server/workers/prospect-analysis-processor.ts` - Integrated scraping step
3. `src/server/features/prospects/services/AnalysisService.ts` - Added scrapedContent support
4. `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx` - Display business info
5. `apps/web/src/app/(shell)/prospects/[prospectId]/actions.ts` - Manual save action
6. `.env.example` - Added ANTHROPIC_API_KEY
7. `package.json` - Added @anthropic-ai/sdk dependency

## Dependencies Added

```json
{
  "@anthropic-ai/sdk": "^0.90.0"
}
```

## Cost Tracking

The system tracks costs for:
- DataForSEO multi-page scraping (from Phase 27-02)
- Claude API calls for business extraction (~2048 tokens per analysis)

Combined costs stored in `prospect_analyses.costCents` and `scrapedContent.totalCostCents`.

## Confidence Thresholds

- **≥ 0.7**: High confidence - show results only
- **0.5-0.69**: Medium confidence - show results with warning
- **< 0.5**: Low confidence - show manual input form instead

## AI Prompt Strategy

The prompt sent to Claude includes:
- Domain name
- All scraped pages with: URL, title, meta description, OG tags, H1 headings, word count
- Structured JSON schema for response
- Clear guidelines for products vs brands vs services
- Instructions for target market detection keywords

## Integration Points

1. **Worker Pipeline:** Runs after DataForSEO analysis steps
2. **Database:** Stores in `prospect_analyses.scraped_content` JSONB column
3. **UI:** Renders in prospect detail page after analysis completes
4. **Fallback:** Manual form for low-confidence or failed extractions

## Error Handling

- Missing API key: Returns empty results with confidence=0
- API errors: Logged and returns empty results (doesn't fail analysis)
- Invalid JSON: Caught by Zod validation, returns empty results
- Scraping failures: Worker continues without scraped data

## Future Enhancements

Potential improvements identified:
1. Support for additional languages beyond English
2. Industry-specific extraction templates (HVAC, legal, e-commerce, etc.)
3. Competitor business info extraction
4. Historical tracking of business info changes
5. Bulk re-analysis with improved prompts

## Human Verification Checkpoint

⚠️ **CHECKPOINT:** This plan has `autonomous: false`. Please verify:

1. Database migration needs to be run manually:
   ```bash
   cd open-seo-main
   pnpm drizzle-kit push
   ```

2. Environment variable needs to be set:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. Test the full flow:
   - Create a prospect
   - Trigger analysis
   - Verify scraping runs
   - Check business info displays
   - Test manual form if needed

## Completion Checklist

- [x] Business extractor implemented
- [x] Tests written and passing (6/6)
- [x] Database schema updated
- [x] Migration generated
- [x] Worker integration complete
- [x] UI components created
- [x] Prospect detail page updated
- [x] Server actions implemented
- [x] Environment config updated
- [x] Dependencies installed
- [x] Documentation complete

**Phase 27-03 is ready for review and testing.**
