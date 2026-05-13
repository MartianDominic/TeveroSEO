---
phase: 98-general-seo-chat
plan: 06
subsystem: ui
tags: [react-flow, dagre, visualization, zustand, seo-chat]

# Dependency graph
requires:
  - phase: 98-01
    provides: TopicalCluster type definition
  - phase: 98-05
    provides: Tool result card patterns
provides:
  - TopicalMapView React Flow component with Dagre layout
  - calculateLayout and calculateClusterSimilarity utilities
  - TopicalMapSettings 3-level toggle (D-03)
  - useTopicalMapSettings Zustand store with localStorage persistence
affects: [98-07, 98-08]

# Tech tracking
tech-stack:
  added: [@xyflow/react@12.10.2, dagre@0.8.5, @types/dagre@0.7.54]
  patterns: [React Flow visualization, Dagre graph layout, Jaccard similarity calculation]

key-files:
  created:
    - apps/web/src/lib/seo-chat/topical-map-layout.ts
    - apps/web/src/components/seo-chat/TopicalMapView.tsx
    - apps/web/src/components/seo-chat/TopicalMapSettings.tsx
  modified: []

key-decisions:
  - "Dagre TB (top-to-bottom) layout with 180x60 node size for cluster cards"
  - "Jaccard similarity threshold 0.1 for edge creation (filters weak connections)"
  - "onlyRenderVisibleElements enabled for 50+ clusters per RESEARCH.md performance guidance"
  - "Per-prospect mode as default (D-03) - users explicitly toggle map per session"

patterns-established:
  - "Pattern 1: Edge width reflects similarity (D-05) - 1px (0.1-0.4), 2px (0.4-0.6), 3px (0.6-0.8), 4px (0.8+)"
  - "Pattern 2: Funnel color system (D-04) - BOFU=green-500, MOFU=amber-500, TOFU=blue-500"
  - "Pattern 3: Zustand persist with partialize for localStorage optimization"

requirements-completed: [CHAT-08]

# Metrics
duration: 5min
completed: 2026-05-13
---

# Phase 98 Plan 06: Topical Map View Summary

**React Flow visualization with Dagre layout, funnel-based node coloring, semantic edge weights, and 3-level display toggle**

## Performance

- **Duration:** 5 min (281s)
- **Started:** 2026-05-13T19:55:41Z
- **Completed:** 2026-05-13T20:00:22Z
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments
- Dagre layout calculation with Jaccard similarity edge weights
- React Flow TopicalMapView with custom ClusterNode components
- Funnel-based coloring (BOFU=green, MOFU=amber, TOFU=blue) per D-04
- Edge thickness reflects cluster similarity per D-05
- 3-level toggle (Always Off / Per-Prospect / Always On) per D-03
- useTopicalMapSettings Zustand store with localStorage persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Dagre layout utility** - `fc6feb6aa` (feat)
2. **Task 2: Create TopicalMapView component** - `c3fa17112` (feat)
3. **Task 3: Create TopicalMapSettings toggle per D-03** - `5d8eb0b90` (feat)

## Files Created/Modified

### Created
- `apps/web/src/lib/seo-chat/topical-map-layout.ts` - Dagre layout calculation and Jaccard similarity edge computation
- `apps/web/src/components/seo-chat/TopicalMapView.tsx` - React Flow visualization with custom ClusterNode components, MiniMap, and performance optimizations
- `apps/web/src/components/seo-chat/TopicalMapSettings.tsx` - 3-level toggle component and useTopicalMapSettings Zustand store

### Modified
- `apps/web/package.json` - Added @xyflow/react, dagre, @types/dagre

## Decisions Made

**Dagre layout configuration:**
- TB (top-to-bottom) direction for funnel flow visualization
- 180x60 node size optimized for cluster name + metadata display
- 80px rank separation, 40px node separation for readability

**Similarity threshold:**
- 0.1 Jaccard similarity minimum for edge creation (filters weak connections)
- Prevents visual clutter with hundreds of clusters

**Performance optimizations:**
- onlyRenderVisibleElements enabled for 50+ clusters (per RESEARCH.md guidance for 400+ node scalability)
- MiniMap uses simple color mapping (no complex rendering)

**Default settings:**
- Per-prospect mode as default (D-03) - respects user's desire to control map visibility per conversation
- perProspectEnabled default `false` - map hidden until user explicitly toggles on

## Deviations from Plan

None - plan executed exactly as written. All D-03, D-04, and D-05 design specifications followed precisely.

## Issues Encountered

**Dependency installation:**
- React Flow (@xyflow/react) and dagre not pre-installed
- Resolution: Added dependencies via pnpm (28s install time)

**TypeScript NodeProps typing:**
- Initial generic NodeProps<Data> caused type conflicts with React Flow internals
- Resolution: Used NodeProps without generic, type assertion on `data` property

**Unrelated TypeScript errors:**
- Pre-existing errors in seo-chat.ts (nanoid) and ProposalSlideOver.tsx (sheet)
- Resolution: Out of scope - verified new files compile without errors

## User Setup Required

None - no external service configuration required. All dependencies installed via pnpm.

## Next Phase Readiness

**Ready for 98-07 (Proposal Portal):**
- TopicalMapView can be embedded in proposal preview context
- useTopicalMapSettings provides display control

**Ready for 98-08 (Chat Page Routes):**
- All visualization components available for /seo-chat/[sessionId] route
- Settings component ready for sidebar integration

**Integration points:**
- TopicalMapView requires `clusters: TopicalCluster[]` prop from keyword analysis results
- onClusterClick callback allows navigation to cluster detail view

## Known Stubs

None - all components render real data from TopicalCluster type. No hardcoded empty values or placeholders.

## Threat Surface Scan

None - visualization is pure client-side rendering of already-analyzed data. No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/lib/seo-chat/topical-map-layout.ts
✓ apps/web/src/components/seo-chat/TopicalMapView.tsx
✓ apps/web/src/components/seo-chat/TopicalMapSettings.tsx
```

**Commits exist:**
```
✓ fc6feb6aa - Task 1 (Dagre layout utility)
✓ c3fa17112 - Task 2 (TopicalMapView component)
✓ 5d8eb0b90 - Task 3 (TopicalMapSettings toggle)
```

**TypeScript compilation:**
```
✓ No errors in topical-map-layout.ts
✓ No errors in TopicalMapView.tsx
✓ No errors in TopicalMapSettings.tsx
```

---
*Phase: 98-general-seo-chat*
*Completed: 2026-05-13*
