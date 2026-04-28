# Phase 35-03: Target Selection + Anchor Selection - COMPLETE

## Summary

Implemented the target selection and anchor selection modules for internal link recommendations. These modules score potential link targets and select optimal anchor text while maintaining distribution balance.

## Tasks Completed

### 1. Database Schema
- [x] Added `linkSuggestions` table to `src/db/link-schema.ts`
  - All scoring columns: score, linkDeficitScore, exactMatchScore, orphanScore, depthScore, relevanceScore
  - Anchor fields: anchorText, anchorType, anchorConfidence
  - Placement context: existingTextMatch, insertionContext
  - Status tracking: status, acceptedAt, rejectedAt, appliedAt, appliedChangeId
  - Proper indexes for client/audit, source/target URL, status, score

### 2. Database Migrations
- [x] Created `drizzle/0024_link_opportunities_table.sql` (Phase 35-02 dependency)
- [x] Created `drizzle/0025_link_suggestions_table.sql` (Phase 35-03)

### 3. Target Selector (`target-selector.ts`)
- [x] `extractKeywordsFromContent()` - Extracts keywords excluding stopwords
- [x] `computeKeywordOverlap()` - Jaccard similarity between keyword sets
- [x] `computeLinkDeficitScore()` - 25% weight, scales based on deficit from ideal
- [x] `computeExactMatchScore()` - 20% weight, needs exact-match anchor text
- [x] `computeOrphanScore()` - 30% weight, binary 100 for orphans
- [x] `computeDepthScore()` - 15% weight, linear scale based on click depth
- [x] `computeRelevanceScore()` - 20% weight, keyword overlap to 0-100 scale
- [x] `rankLinkTargets()` - Main function returning sorted ScoredCandidate[]

### 4. Anchor Selector (`anchor-selector.ts`)
- [x] `normalizeText()` - Lowercase, trim, collapse spaces
- [x] `findExistingTextMatch()` - Find keyword in body text (word boundary matching)
- [x] `determineAnchorType()` - Maintains ~50% exact / 25% branded / 25% misc
- [x] `generateBrandedAnchor()` - Creates branded anchor from templates
- [x] `generateMiscAnchor()` - Creates misc anchor from title or templates
- [x] `selectAnchorText()` - Main function returning AnchorSelection

### 5. Type Definitions (`types.ts`)
- [x] `PageCandidate` - Input candidate for ranking
- [x] `SourcePageData` - Source page content and brand
- [x] `ScoredCandidate` - Ranked result with all scores
- [x] `RankLinkTargetsParams` - Parameters for ranking
- [x] `AnchorSelection` - Result of anchor selection
- [x] `SelectAnchorParams` - Parameters for anchor selection
- [x] `AnchorDistribution` - Tracking for anchor type balance
- [x] `LinkSuggestion` - Full suggestion ready for DB insertion

### 6. Module Exports (`index.ts`)
- [x] Updated to export all Phase 35-03 types and functions

## Test Results

```
 ✓ src/server/lib/linking/target-selector.test.ts (33 tests)
 ✓ src/server/lib/linking/anchor-selector.test.ts (29 tests)
 
 Total: 62 tests passing for Phase 35-03
 
 All linking module tests: 134 tests passing
```

## Key Implementation Details

### Scoring Weights (Total = 110% due to rounding, normalized in composite)
| Factor | Weight | Description |
|--------|--------|-------------|
| Link Deficit | 25% | How far below ideal inbound count |
| Exact Match | 20% | Pages lacking exact-match anchors |
| Orphan | 30% | Pages with zero inbound links (highest priority) |
| Depth | 15% | Pages far from homepage |
| Relevance | 20% | Keyword overlap between source and target |

### Anchor Selection Strategy
- **Confidence 0.9+**: Wrapping existing text found in source page
- **Confidence 0.6**: Inserting new text (no existing match)
- **Distribution goal**: 50% exact / 25% branded / 25% misc

### Files Created/Modified
- `src/db/link-schema.ts` - Added linkSuggestions table + types
- `src/server/lib/linking/target-selector.ts` - NEW
- `src/server/lib/linking/target-selector.test.ts` - NEW
- `src/server/lib/linking/anchor-selector.ts` - NEW
- `src/server/lib/linking/anchor-selector.test.ts` - NEW
- `src/server/lib/linking/types.ts` - Added Phase 35-03 types
- `src/server/lib/linking/index.ts` - Added Phase 35-03 exports
- `drizzle/0024_link_opportunities_table.sql` - NEW
- `drizzle/0025_link_suggestions_table.sql` - NEW

## TypeScript Status
No TypeScript errors in the linking module. Pre-existing errors in other parts of codebase are unrelated.

## Next Phase
Phase 35-04: Suggestion Generator Service - Combines target selection and anchor selection to generate and persist link suggestions.
