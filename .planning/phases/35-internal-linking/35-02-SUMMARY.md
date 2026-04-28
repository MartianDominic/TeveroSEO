# Plan 35-02 Summary: Opportunity Detection

**Status:** Complete
**Completed:** 2026-04-23

## Tasks Completed

1. **linkOpportunities table** - Added to `src/db/link-schema.ts` with columns: opportunityType, relevanceScore, urgencyScore, impactScore, combinedScore, status, detection details

2. **click-depth.ts** - BFS algorithm for computing click depth from homepage
   - 12 tests passing
   - Caps at 10k iterations and max depth 10 (DoS protection T-35-05)
   - Handles cycles, unreachable pages, URL normalization

3. **opportunity-detector.ts** - Detects 4 opportunity types:
   - `depth_reduction`: Pages >3 clicks from homepage
   - `orphan_rescue`: Pages with 0 inbound links (urgency=1.0)
   - `link_velocity`: Pages with <40 inbound links
   - `anchor_diversity`: Pages with 0 exact-match anchors
   - 19 tests passing
   - Caps at 1000 opportunities per audit (T-35-08)

4. **Exports** - Updated `src/server/lib/linking/index.ts`

## Test Results

- 31 new tests for Phase 35-02
- All tests passing
- Coverage: click-depth.ts, opportunity-detector.ts

## Files Created/Modified

- `src/db/link-schema.ts` (modified - added linkOpportunities)
- `src/server/lib/linking/click-depth.ts` (created)
- `src/server/lib/linking/click-depth.test.ts` (created)
- `src/server/lib/linking/opportunity-detector.ts` (created)
- `src/server/lib/linking/opportunity-detector.test.ts` (created)
- `src/server/lib/linking/index.ts` (modified)

## Verification

```bash
npx vitest run src/server/lib/linking/click-depth.test.ts    # 12 passing
npx vitest run src/server/lib/linking/opportunity-detector.test.ts  # 19 passing
```
