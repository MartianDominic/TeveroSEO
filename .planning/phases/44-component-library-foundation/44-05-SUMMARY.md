---
phase: 44
plan: 05
subsystem: ui-components
tags: [health-gauge, severity-dots, tier-breakdown, connection-status, drop-causes, report-preview, ops-strip, velocity, period-selector, keyboard-shortcut, intent-badge, count-badge]
dependency_graph:
  requires: [44-02, 44-03, 44-04]
  provides: [audit-visualization, connection-management, report-preview, system-status, velocity-metrics, time-selection, keyboard-hints, intent-display, count-display]
  affects: [apps/web]
tech_stack:
  added: []
  patterns: [svg-arc-gauge, confidence-bars, tier-coloring, horizontal-strip, pill-selector, kbd-symbols, small-caps-badge]
key_files:
  created:
    - packages/ui/src/components/health-gauge.tsx
    - packages/ui/src/components/severity-dots.tsx
    - packages/ui/src/components/tier-breakdown-table.tsx
    - packages/ui/src/components/connection-status-card.tsx
    - packages/ui/src/components/drop-causes-panel.tsx
    - packages/ui/src/components/report-preview-card.tsx
    - packages/ui/src/components/ops-strip.tsx
    - packages/ui/src/components/velocity-strip.tsx
    - packages/ui/src/components/period-selector.tsx
    - packages/ui/src/components/keyboard-shortcut-hint.tsx
    - packages/ui/src/components/intent-badge.tsx
    - packages/ui/src/components/count-badge.tsx
  modified:
    - packages/ui/src/index.ts
decisions:
  - SVG arc gauge uses circumference-based dasharray for score visualization
  - SeverityDots shows numeral when count exceeds maxDots (overflow handling)
  - TierBreakdownTable groups findings by tier with collapsible headers
  - ConnectionStatusCard detects token expiration within 7 days for warning banner
  - DropCausesPanel uses confidence thresholds (70/40) for color coding
  - KeyboardShortcutHint maps common key names to symbols (Cmd -> command symbol)
  - IntentBadge uses font-variant-caps: all-small-caps for semantic styling
metrics:
  duration: 5m
  completed: 2026-04-30
  tasks: 3
  files: 13
---

# Phase 44 Plan 05: v6/v7 Components Summary

Twelve component patterns for audit visualization, connection management, and data display with full v6 design token integration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HealthGauge, SeverityDots, TierBreakdownTable | 5928fb1b4 | health-gauge.tsx, severity-dots.tsx, tier-breakdown-table.tsx |
| 2 | ConnectionStatusCard, DropCausesPanel, ReportPreviewCard, OpsStrip | 972ff3f37 | connection-status-card.tsx, drop-causes-panel.tsx, report-preview-card.tsx, ops-strip.tsx |
| 3 | VelocityStrip, PeriodSelector, KeyboardShortcutHint, IntentBadge, CountBadge | bdf101cd0 | velocity-strip.tsx, period-selector.tsx, keyboard-shortcut-hint.tsx, intent-badge.tsx, count-badge.tsx |

## What Was Built

### 1. HealthGauge (health-gauge.tsx)

SVG arc gauge for health scores (0-100):
- Three sizes: sm (64px), md (96px), lg (128px)
- Automatic grade calculation (A/B+/B/C/D)
- Circumference-based stroke-dasharray for arc rendering
- role="img" aria-label for accessibility
- Uses NumRow for score display

### 2. SeverityDots (severity-dots.tsx)

Visual severity indicator with tier colors:
- Configurable maxDots (default 5)
- Tier-based colors: 1=error, 2=warning, 3=info, 4=text-4
- Shows numeral when count exceeds maxDots
- Two sizes: sm (4px), md (6px)

### 3. TierBreakdownTable (tier-breakdown-table.tsx)

Audit findings grid by severity tier:
- Groups findings by tier with collapsible headers
- Colored left border per tier
- SeverityDots for visual tier indication
- Hover reveal for action arrow
- Grid layout: tier, title, count, action

### 4. ConnectionStatusCard (connection-status-card.tsx)

Integration connection status display:
- Service icon with status dot
- Last sync RelativeTimestamp
- 7-day token expiration warning banner
- Action buttons: Connect/Disconnect/Refresh
- Status variants: connected, disconnected, error, expiring, syncing

### 5. DropCausesPanel (drop-causes-panel.tsx)

Keyword ranking drop analysis:
- Header with keyword and position change
- error-soft background for drop indicator
- Confidence bars with threshold coloring (70/40)
- Cause type labels (technical, content, backlink, serp_change, competitor)
- Audit CTA footer

### 6. ReportPreviewCard (report-preview-card.tsx)

Report preview with status:
- Type icon (seo, performance, content, custom)
- Status badge with semantic variants
- Sections count (collapsed)
- Generating state with spinner
- Action buttons: View/Download/Send/Edit

### 7. OpsStrip (ops-strip.tsx)

Horizontal system status bar:
- bg-canvas-dim with hairline top border
- Status dots with semantic colors
- Items separated by dots
- Expandable details grid
- font-mono for timestamps/values

### 8. VelocityStrip (velocity-strip.tsx)

7-day/30-day velocity metrics:
- Two-column grid with hairline divider
- 2px left border: accent for 7d, text-4 for 30d
- Positive=success, negative=error coloring
- Tabular nums + optional trend arrows

### 9. PeriodSelector (period-selector.tsx)

Time period pill buttons:
- Options: 7D, 30D, 90D, 1Y, Custom
- Active state: bg-accent-soft, text-accent-ink
- radius-button container, radius-input buttons
- Custom range date display

### 10. KeyboardShortcutHint (keyboard-shortcut-hint.tsx)

Styled kbd elements:
- Maps key names to symbols (Cmd -> command symbol, Ctrl -> control symbol)
- Default and inverted variants
- Hairline border as box-shadow
- font-mono at type-tiny

### 11. IntentBadge (intent-badge.tsx)

Search intent badge:
- Intent types: commercial, informational, transactional, navigational
- Semantic colors per intent
- font-variant-caps: all-small-caps
- radius-pill shape

### 12. CountBadge (count-badge.tsx)

Count with overflow handling:
- Shows "99+" when count exceeds max
- Default and active variants
- tabular-nums lining-nums
- radius-pill shape

## Deviations from Plan

None - plan executed exactly as written.

## Dependencies Note

This plan depends on 44-02/03/04 outputs (RelativeTimestamp, NumRow, Button, Badge, formatTime) which were already committed in previous executions.

## Verification Results

- TypeScript compilation: PASSED
- Task 1 verification: PASSED (HealthGauge, SeverityDots, TierBreakdownTable, role="img")
- Task 2 verification: PASSED (ConnectionStatusCard, DropCausesPanel, ReportPreviewCard, OpsStrip)
- Task 3 verification: PASSED (VelocityStrip, PeriodSelector, IntentBadge, CountBadge)
- All 12 components exported from index.ts: VERIFIED

## Self-Check: PASSED

All files verified to exist:
- health-gauge.tsx: FOUND
- severity-dots.tsx: FOUND
- tier-breakdown-table.tsx: FOUND
- connection-status-card.tsx: FOUND
- drop-causes-panel.tsx: FOUND
- report-preview-card.tsx: FOUND
- ops-strip.tsx: FOUND
- velocity-strip.tsx: FOUND
- period-selector.tsx: FOUND
- keyboard-shortcut-hint.tsx: FOUND
- intent-badge.tsx: FOUND
- count-badge.tsx: FOUND
- index.ts (exports): FOUND

All commits verified:
- 5928fb1b4: FOUND
- 972ff3f37: FOUND
- bdf101cd0: FOUND
