# Plan 35-03 Summary: Target Selection + Anchor Selection

**Status:** Complete
**Completed:** 2026-04-23

## Tasks Completed

1. **linkSuggestions table** - Added to `src/db/link-schema.ts` with columns: anchorText, anchorType, insertionMethod, originalText, replacementText, confidence, isAutoApplicable, status

2. **target-selector.ts** - Ranks link targets by priority
   - `rankLinkTargets()` returns sorted candidates with scores and reasons
   - Scoring: link deficit (25%), exact-match need (20%), orphan (30%), depth (15%), relevance (20%)
   - `extractKeywordsFromContent()` extracts keywords without stopwords
   - `computeKeywordOverlap()` returns Jaccard similarity
   - 33 tests passing

3. **anchor-selector.ts** - Selects anchor text per distribution rules
   - `selectAnchorText()` follows 50% exact / 25% branded / 25% misc distribution
   - Prefers wrapping existing text (confidence 0.9+) over insertion (confidence 0.6)
   - `findExistingTextMatch()`, `determineAnchorType()`, `generateBrandedAnchor()`, `generateMiscAnchor()`
   - 29 tests passing

4. **Migrations** - Created:
   - `drizzle/0024_link_opportunities_table.sql`
   - `drizzle/0025_link_suggestions_table.sql`

5. **Exports** - Updated `src/server/lib/linking/index.ts`

## Test Results

- 62 new tests for Phase 35-03
- 134 total tests in linking module
- All tests passing

## Files Created/Modified

- `src/db/link-schema.ts` (modified - added linkSuggestions)
- `src/server/lib/linking/target-selector.ts` (created)
- `src/server/lib/linking/target-selector.test.ts` (created)
- `src/server/lib/linking/anchor-selector.ts` (created)
- `src/server/lib/linking/anchor-selector.test.ts` (created)
- `src/server/lib/linking/index.ts` (modified)
- `drizzle/0024_link_opportunities_table.sql` (created)
- `drizzle/0025_link_suggestions_table.sql` (created)

## Verification

```bash
npx vitest run src/server/lib/linking/target-selector.test.ts   # 33 passing
npx vitest run src/server/lib/linking/anchor-selector.test.ts   # 29 passing
npx vitest run src/server/lib/linking/   # 134 total passing
```
