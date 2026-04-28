# Phase 35-02: Opportunity Detection - Summary

## Status: COMPLETE

## Tasks Completed

### 1. Schema: linkOpportunities Table
- **File**: `src/db/link-schema.ts`
- Added `OPPORTUNITY_TYPES` constant with 4 types: `depth_reduction`, `orphan_rescue`, `link_velocity`, `anchor_diversity`
- Added `OpportunityType` type export
- Added `linkOpportunities` table with columns:
  - `id`, `clientId`, `auditId` (core identifiers)
  - `pageId`, `pageUrl` (target page)
  - `opportunityType` (classification)
  - `urgency` (0.0-1.0 scoring)
  - `currentDepth`, `targetDepth` (for depth_reduction)
  - `currentInboundCount` (for link_velocity)
  - `currentExactMatchCount` (for anchor_diversity)
  - `suggestedSourcePages` (JSONB array)
  - `suggestedAnchorText`, `reason` (recommendations)
  - `status`, `implementedAt`, `implementedByChangeId` (tracking)
  - `detectedAt` (timestamp)
- Added indexes for efficient querying: `client_audit`, `type`, `urgency`, `status`, `page_url`
- Added `linkOpportunitiesRelations` for Drizzle ORM
- Added `LinkOpportunitiesSelect` and `LinkOpportunitiesInsert` type exports

### 2. Migration Generation
- **Status**: Requires TTY - user must run manually:
  ```bash
  npx drizzle-kit generate --name add_link_opportunities
  ```

### 3. Click Depth Computation (TDD)
- **File**: `src/server/lib/linking/click-depth.ts`
- **Tests**: `src/server/lib/linking/click-depth.test.ts` (12 tests)
- Implemented BFS algorithm for computing click depth from homepage
- Features:
  - Shortest path calculation (BFS guarantees minimum clicks)
  - Configurable `maxDepth` (default: 10)
  - Configurable `maxIterations` (default: 10,000 - DoS protection T-35-08)
  - Cycle handling (visited set prevents infinite loops)
  - URL normalization option
  - Unreachable page detection
- Exports:
  - `computeClickDepths()` - main function
  - `LinkEdge`, `ComputeClickDepthsParams`, `ClickDepthResult` types

### 4. Opportunity Detection (TDD)
- **File**: `src/server/lib/linking/opportunity-detector.ts`
- **Tests**: `src/server/lib/linking/opportunity-detector.test.ts` (19 tests)
- Detects 4 opportunity types:
  - **depth_reduction**: Pages with clickDepth > 3 (urgency scales with depth)
  - **orphan_rescue**: Pages with 0 inbound links (urgency = 1.0 maximum)
  - **link_velocity**: Pages with < 40 inbound links (urgency inverse to count)
  - **anchor_diversity**: Pages with 0 exact-match anchors (urgency scales with link count)
- DoS protection: `MAX_OPPORTUNITIES_PER_AUDIT = 1000`
- Prioritizes by urgency when capping
- Exports:
  - `detectOpportunities()` - combined detection
  - Individual detectors: `detectDepthReductionOpportunities()`, `detectOrphanRescueOpportunities()`, `detectLinkVelocityOpportunities()`, `detectAnchorDiversityOpportunities()`
  - Types: `PageMetrics`, `OrphanPage`, `DetectOpportunitiesParams`, `DetectOpportunitiesResult`

### 5. Module Exports
- **File**: `src/server/lib/linking/index.ts`
- Updated to export all new types and functions

## Test Results

```
 PASS  src/server/lib/linking/click-depth.test.ts (12 tests)
 PASS  src/server/lib/linking/opportunity-detector.test.ts (19 tests)
 
 Test Files  2 passed
      Tests  31 passed
```

## Files Changed

| File | Change |
|------|--------|
| `src/db/link-schema.ts` | Added `linkOpportunities` table and types |
| `src/server/lib/linking/click-depth.ts` | NEW - BFS click depth algorithm |
| `src/server/lib/linking/click-depth.test.ts` | NEW - 12 tests |
| `src/server/lib/linking/opportunity-detector.ts` | NEW - Opportunity detection |
| `src/server/lib/linking/opportunity-detector.test.ts` | NEW - 19 tests |
| `src/server/lib/linking/index.ts` | Updated exports |

## Key Implementation Details

### Opportunity Thresholds
- Depth threshold: > 3 clicks (target: 3)
- Inbound links threshold: < 40
- Exact-match threshold: 0 (no exact-match anchors)

### Urgency Calculations
- **depth_reduction**: `min(1.0, (depth - 3) / 4)` - depth 4=0.25, depth 7+=1.0
- **orphan_rescue**: Always 1.0 (maximum urgency)
- **link_velocity**: `1 - (inboundCount / 40)` - 0 links=1.0, 20 links=0.5
- **anchor_diversity**: `min(1.0, inboundTotal / 50)` - scales with opportunity size

### DoS Protection (T-35-08)
- BFS iterations capped at 10,000
- Max depth capped at 10
- Total opportunities capped at 1,000 per audit
- Higher urgency opportunities prioritized when capping

## Next Steps

- Phase 35-03: Target Page Selection (semantic matching)
- Phase 35-04: Anchor Text Generation
- Phase 35-05: Link Injection
