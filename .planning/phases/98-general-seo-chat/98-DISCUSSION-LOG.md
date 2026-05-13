# Phase 98: SEO Chat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 98-general-seo-chat
**Areas discussed:** Streaming UX, Error Recovery, Topical Map Interaction, Map Node Styling, Map Edge Styling, Error Message Tone

---

## Streaming Response UX

| Option | Description | Selected |
|--------|-------------|----------|
| Card-first (Recommended) | Show empty metric cards immediately, then fill values as they arrive. Domain Health card skeleton visible in <200ms, metrics populate in 1-3s. | |
| Text-first + cards | ChatGPT-style: stream prose explanation first, then render full cards after complete. Feels more conversational but delays metrics. | |
| Progressive skeleton | Show full skeleton layout (cards + topical map placeholder), reveal sections as data arrives. Most sophisticated but higher complexity. | |

**User's choice:** Text-first + cards, but evolved into **parallel streaming** after discussing world-class approach.

**Follow-up decision:** Parallel perception — prose streams in chat while Right Rail cards fill simultaneously with count-up animations and highlight sync between prose references and cards.

---

## Error Recovery Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Inline retry UI (Recommended) | Show error inline with 'Retry' button. 3 automatic retries with exponential backoff. | ✓ |
| Chat-based recovery | AI acknowledges failure conversationally with suggestions. | |
| Graceful partial | Show whatever data we have, mark missing sections as 'unavailable'. | |

**User's choice:** Inline retry UI (Recommended)

**Notes:** User clarified: "retry only the failed parts not succeeded ones" — preserved results from successful tools, only retry failures.

---

## Topical Map Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Full interaction (Recommended) | Click, drag, zoom, minimap. React Flow with Dagre auto-layout. | |
| View-only + click | Static layout, click to select only. | |
| Differentiated by context | Full interaction agency side, view-only on prospect portal. Two components with shared rendering. | ✓ |

**User's choice:** Differentiated by context with **3-level toggle system**

**Notes:** User specified:
- Per-prospect toggle (default OFF = view-only)
- Global "always on" option
- Global "always off" option
This gives agencies control over prospect experience interactivity.

---

## Map Node Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Funnel color + volume size (Recommended) | BOFU=green, MOFU=amber, TOFU=blue. Node size scales with cluster volume (48px-120px). | ✓ |
| Difficulty gradient | Color from green (easy) → red (hard) based on KD. Size by keyword count. | |
| Neutral + badges | All nodes same color, badge chips show funnel/difficulty. | |

**User's choice:** Funnel color + volume size (Recommended)

---

## Map Edge Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic thickness (Recommended) | Line thickness based on semantic similarity (0.7+ thick, 0.5-0.7 medium, <0.5 thin dashed). | ✓ |
| Uniform lines | All connections same weight, curved bezier. | |
| Hierarchy arrows | Pillar → subtopic → longtail with directional arrows. | |

**User's choice:** Semantic thickness (Recommended)

---

## Error Message Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Agency-smart (Recommended) | "Site may be blocking our analysis — this sometimes happens with Cloudflare-protected domains. Retrying with a different approach..." | ✓ |
| Friendly minimal | "Taking longer than expected. Retrying..." No technical details. | |
| Technical transparent | "DataForSEO API timeout (503). Retry 2/3 in 4s." For power users. | |

**User's choice:** Agency-smart (Recommended)

---

## Claude's Discretion

- Exact animation timing (spring tension, count-up duration)
- Skeleton placeholder design
- Highlight sync debounce timing
- Error retry toast positioning

## Deferred Ideas

None — discussion stayed within phase scope.
