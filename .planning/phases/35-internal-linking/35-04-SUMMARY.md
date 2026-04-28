# Plan 35-04 Summary: Auto-Insert + Velocity Control

**Status:** Complete
**Completed:** 2026-04-23

## Tasks Completed

1. **VelocityService** - Rate limiting for link additions
   - `checkLinkVelocity()` enforces limits before each link application
   - Limits: 3 links/page/day, 50 links/site/day, 10 total links/page, 20 pages edited/day
   - `getVelocityStats()` returns current usage vs limits
   - Rate limits reset at midnight UTC
   - 9 tests passing

2. **LinkSuggestionService** - Generate suggestions from opportunities
   - `generateSuggestion()` creates linkSuggestion from opportunity with anchor selection
   - `isAutoApplicable()` returns true only when: wrap_existing, confidence >= 0.85, < 10 links on page
   - Determines insertion method: wrap_existing (safer) or append_sentence
   - Generates replacement HTML or new sentence based on method
   - 8 tests passing (1 skipped - cannibalization detection is Phase 35-05)

3. **LinkApplyService** - Apply suggestions via platform adapters
   - `applySuggestion()` checks velocity, applies link, creates site_changes record
   - Creates before/after snapshot in site_changes for revert capability
   - Handles content-changed scenarios gracefully (marks as failed)
   - Updates link_graph after successful application
   - 11 tests passing

4. **LinkRepository** - Data access layer
   - `getPendingSuggestions()` - Get pending suggestions for a client
   - `getAutoApplicableSuggestions()` - Get auto-applicable suggestions
   - `getAnchorDistribution()` - Get exact/branded/misc distribution for target
   - `getPageLinkMetrics()` - Get inbound/outbound counts

5. **Schema Updates** - Added to `src/db/link-schema.ts`:
   - `opportunityId` - FK to link_opportunities
   - `insertionMethod` - wrap_existing | append_sentence
   - `replacementText` - HTML replacement for wrap_existing
   - `newSentence` - Sentence to append for append_sentence
   - `isAutoApplicable` - Boolean flag for auto-apply eligibility
   - `failureReason` - Reason if application failed

6. **Migration** - Created `drizzle/0026_link_suggestions_auto_insert.sql`

## Test Results

- VelocityService: 9 tests passing
- LinkSuggestionService: 8 tests passing (1 skipped)
- LinkApplyService: 11 tests passing
- Total new tests: 28 passing
- All linking lib tests still passing: 134 tests

## Files Created/Modified

**Created:**
- `src/server/features/linking/services/VelocityService.ts`
- `src/server/features/linking/services/VelocityService.test.ts`
- `src/server/features/linking/services/LinkSuggestionService.ts`
- `src/server/features/linking/services/LinkSuggestionService.test.ts`
- `src/server/features/linking/services/LinkApplyService.ts`
- `src/server/features/linking/services/LinkApplyService.test.ts`
- `src/server/features/linking/repositories/LinkRepository.ts`
- `src/server/features/linking/index.ts`
- `drizzle/0026_link_suggestions_auto_insert.sql`

**Modified:**
- `src/db/link-schema.ts` - Added auto-insert fields to linkSuggestions table

## Verification

```bash
# Service tests
npx vitest run src/server/features/linking/services/VelocityService.test.ts     # 9 passing
npx vitest run src/server/features/linking/services/LinkSuggestionService.test.ts # 8 passing
npx vitest run src/server/features/linking/services/LinkApplyService.test.ts     # 11 passing

# All linking feature tests
npx vitest run src/server/features/linking/   # 28 passing

# All linking lib tests (Phase 35-01 to 35-03)
npx vitest run src/server/lib/linking/        # 134 passing
```

## Success Criteria Met

- [x] VelocityService enforces 3 links/page/day limit
- [x] VelocityService enforces 50 links/site/day limit
- [x] VelocityService returns clear reason when blocked
- [x] LinkSuggestionService generates suggestions from opportunities
- [x] isAutoApplicable returns true only for safe cases (wrap_existing, confidence >= 85%, < 10 links)
- [x] LinkApplyService creates site_changes record before applying
- [x] LinkApplyService updates suggestion status on success/failure
- [x] LinkApplyService handles content-changed scenarios gracefully
- [x] Link graph updated after successful application
- [x] All tests pass with >80% coverage
