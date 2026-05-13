---
phase: 98-general-seo-chat
plan: 05
subsystem: seo-chat
tags: [ui, tool-results, cards, animations, design-v6]
dependency_graph:
  requires:
    - "98-01 (types, stores, schema)"
    - "98-02 (tool definitions)"
    - "98-04 (Chat UI components)"
  provides:
    - "ToolResultCard router component"
    - "5 specialized result cards (DomainHealth, KeywordAnalysis, Feasibility, AddToProposal, ProposalGenerated)"
  affects:
    - "98-08 (Chat Page Routes will embed ToolResultCard in ChatMessage)"
    - "98-06 (Topical Map View may reference similar card patterns)"
tech_stack:
  added: []
  patterns:
    - "Component routing via switch statement on toolName"
    - "Skeleton states with animate-pulse during tool execution"
    - "animate-in transitions per D-01 micro-animations spec"
    - "Funnel color coding: BOFU=green, MOFU=amber, TOFU=blue (D-04)"
    - "Internal component pattern (AddToProposalCard)"
key_files:
  created:
    - "apps/web/src/components/seo-chat/ToolResultCard.tsx"
    - "apps/web/src/components/seo-chat/cards/DomainHealthCard.tsx"
    - "apps/web/src/components/seo-chat/cards/KeywordAnalysisCard.tsx"
    - "apps/web/src/components/seo-chat/cards/FeasibilityCard.tsx"
    - "apps/web/src/components/seo-chat/cards/ProposalGeneratedCard.tsx"
  modified: []
decisions:
  - "AddToProposalCard kept as internal component within ToolResultCard.tsx (simple confirmation message)"
  - "Skeleton states use animate-pulse with Loader2 spinner during pending/streaming"
  - "Funnel colors follow D-04 spec: BOFU=green, MOFU=amber, TOFU=blue"
  - "ProposalGeneratedCard uses rel='noopener noreferrer' per T-98-07 threat mitigation"
  - "All cards use animate-in fade-in-50 slide-in-from-bottom-2 for smooth appearance"
metrics:
  duration: "180 seconds (~3 minutes)"
  completed: "2026-05-13T19:51:00Z"
  tasks: 3
  commits: 2
  files: 5
---

# Phase 98 Plan 05: Tool Result Cards Summary

**One-liner:** Five specialized card components with skeleton states and smooth animations that visualize domain health, keywords, feasibility, and proposals within chat messages.

## What Was Built

Created a complete tool result card system for displaying structured tool outputs in the SEO Chat interface:

### 1. ToolResultCard Router Component

**ToolResultCard.tsx:**
- Central routing component that renders appropriate card based on `toolName`
- Shows skeleton state during `pending`, `partial-call`, `call` states with `animate-pulse`
- Routes to specialized cards on `result` state
- Includes internal `AddToProposalCard` component (not exported separately)
- Handles unknown tools gracefully with JSON preview fallback

**State handling:**
- `pending` → Skeleton with Loader2 spinner
- `result` → Routed to appropriate card component
- Unknown tool → JSON preview with debug info

### 2. Domain Health and Keyword Analysis Cards

**DomainHealthCard.tsx:**
- Displays domain authority (DA), domain rating (DR), traffic, and ranked keywords
- 2x2 metrics grid with icons (BarChart, TrendingUp, Search)
- Health badge with color coding: Strong (≥40), Moderate (≥20), Weak (<20)
- Summary text at bottom
- Number formatting: 1.2K, 2.3M for large values

**KeywordAnalysisCard.tsx:**
- Top 5 keywords with volume and difficulty badges
- Summary stats: total volume, cluster count
- Cluster preview with funnel-coded badges (BOFU, MOFU, TOFU)
- "+X more keywords" indicator if list truncated
- Funnel colors per D-04: BOFU=green, MOFU=amber, TOFU=blue

### 3. Feasibility and Proposal Cards

**FeasibilityCard.tsx:**
- Verdict badge with color-coded icon (CheckCircle, AlertTriangle, XCircle)
- Feasibility score progress bar
- Confidence level badge (high, medium, low)
- Timeline estimate (min-max months)
- Caveats displayed with warning icon if present
- Requirements grid: backlinks needed, content word count

**ProposalGeneratedCard.tsx:**
- Package and keyword count summary
- Copy link button with success feedback (Check icon after copy)
- Open portal button with external link icon
- Uses `rel="noopener noreferrer"` per T-98-07 threat mitigation
- Green "Ready" badge
- Border and background highlight for emphasis

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Files Changed |
|------|--------|---------------|
| 1-2 | `06f317cfa` | ToolResultCard.tsx, DomainHealthCard.tsx, KeywordAnalysisCard.tsx (279 lines) |
| 3 | `5a794a574` | FeasibilityCard.tsx, ProposalGeneratedCard.tsx (193 lines) |

**Total:** 2 commits, 5 files created, 472 lines of code

## Key Technical Decisions

**Why AddToProposalCard is internal?**
AddToProposalCard is a simple confirmation message ("Added X keywords to proposal (Y total)"). It doesn't need the complexity of a separate file - keeping it inline within ToolResultCard.tsx maintains simplicity while providing clear JSDoc documentation explaining the pattern.

**Why skeleton states during all non-result states?**
Per D-01 spec, users should see progress indicators during tool execution. By showing skeleton during `pending`, `partial-call`, and `call` states, we provide continuous visual feedback. The `animate-pulse` creates a subtle breathing effect that signals "work in progress."

**Why funnel color coding?**
Per D-04 spec, funnel stages have semantic meaning:
- **BOFU (green)**: Bottom-of-funnel keywords are high-intent, conversion-focused
- **MOFU (amber)**: Middle-of-funnel keywords are consideration stage
- **TOFU (blue)**: Top-of-funnel keywords are awareness stage

Color coding helps agency owners quickly assess keyword mix in proposals.

**Why animate-in transitions?**
Smooth appearance animations (`fade-in-50 slide-in-from-bottom-2 duration-300`) provide professional polish per D-01 spec. The micro-animations signal "new information available" without being distracting. The 300ms duration is perceptible but not slow.

**Why rel="noopener noreferrer" on external links?**
Per threat model T-98-07, external links without `rel="noopener noreferrer"` can enable tab hijacking via `window.opener`. ProposalGeneratedCard opens the prospect portal in a new tab - this mitigation prevents the opened tab from accessing the parent window.

## Verification

- TypeScript compilation passes for all 5 card components
- All cards use shadcn/ui primitives (Card, Badge, Button, Skeleton, Progress)
- Skeleton states implemented with animate-pulse per D-01
- Funnel colors match D-04 spec (verified in getFunnelColor function)
- External link mitigation implemented per T-98-07
- No innerHTML usage (all text rendered safely)
- Animate-in transitions applied consistently

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/components/seo-chat/ToolResultCard.tsx
✓ apps/web/src/components/seo-chat/cards/DomainHealthCard.tsx
✓ apps/web/src/components/seo-chat/cards/KeywordAnalysisCard.tsx
✓ apps/web/src/components/seo-chat/cards/FeasibilityCard.tsx
✓ apps/web/src/components/seo-chat/cards/ProposalGeneratedCard.tsx
```

**Commits exist:**
```
✓ 06f317cfa (Tasks 1-2: Router + DomainHealth + KeywordAnalysis)
✓ 5a794a574 (Task 3: Feasibility + ProposalGenerated)
```

**Exports verified:**
```
✓ ToolResultCard exports main component
✓ DomainHealthCard exports card component
✓ KeywordAnalysisCard exports card component
✓ FeasibilityCard exports card component
✓ ProposalGeneratedCard exports card component
✓ AddToProposalCard is internal (not exported, documented via JSDoc)
```

## Next Steps

**Immediate integration (Wave 3 continuation):**
- Plan 98-08: Chat Page Routes will integrate ToolResultCard into ChatMessage
- ChatMessage component needs to replace stub tool invocation rendering with ToolResultCard

**Integration points:**
- ChatMessage (from 98-04) will render `<ToolResultCard toolName={...} state={...} result={...} />`
- useToolProgress hook (from 98-04) provides the state for each tool invocation
- Tool result types (from 98-01) are consumed by card components

**Required for production:**
- Wire ChatMessage to display ToolResultCard for each tool invocation
- Handle streaming states via useToolProgress hook
- Test card animations with real tool execution flow

## Threat Surface Scan

All threat model mitigations implemented:

| Threat ID | Component | Mitigation Status |
|-----------|-----------|-------------------|
| T-98-07 | ProposalGeneratedCard | ✓ Mitigated - rel="noopener noreferrer" on external link |
| T-98-08 | All cards | ✓ Accepted - Tool results are user's own data, no cross-user display |
| T-98-09 | ToolResultCard | ✓ Mitigated - Cards are read-only, no state mutation |

**No new threats introduced.** All components render data from props without mutation.

## Known Stubs

None - all components are fully functional and ready for integration.

**Note:** Cards currently receive mock data during development. Real data will flow when:
1. Tool executors (from 98-02) are fully wired
2. API route (from 98-03) streams tool results
3. ChatMessage (from 98-04) integrates ToolResultCard

Cards are ready for this integration - no changes needed to card components.
