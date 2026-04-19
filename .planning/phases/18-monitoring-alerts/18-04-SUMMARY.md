---
phase: 18-monitoring-alerts
plan: 04
subsystem: alert-ui
tags: [react, nextjs, ui, alerts, shadcn]
dependency_graph:
  requires: [alerts API from open-seo, 18-01 schema]
  provides: [AlertBadge, AlertDrawer, AlertItem, AlertsTable, alerts page]
  affects: [AppShell integration]
tech_stack:
  added: []
  patterns: [server actions, optimistic UI, sheet drawer]
key_files:
  created:
    - apps/web/src/actions/alerts.ts
    - apps/web/src/components/alerts/AlertBadge.tsx
    - apps/web/src/components/alerts/AlertItem.tsx
    - apps/web/src/components/alerts/AlertDrawer.tsx
    - apps/web/src/components/alerts/AlertsTable.tsx
    - apps/web/src/components/alerts/index.ts
    - apps/web/src/app/(shell)/clients/[clientId]/alerts/page.tsx
  modified:
    - apps/web/src/lib/server-fetch.ts
decisions:
  - "AlertBadge pulses on critical alerts"
  - "AlertDrawer uses Sheet component for slide-out"
  - "AlertsTable has status and severity filters"
  - "60-second polling for badge count refresh"
  - "Imports from @tevero/ui barrel export"
metrics:
  duration_minutes: 20
  completed_at: "2026-04-19T20:37:00Z"
---

# Phase 18 Plan 04: Alert UI Components Summary

React components and Next.js page for alert management

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-6 | Full implementation | 8e60f55a | 8 files |

## Implementation Details

### Server Actions (alerts.ts)

- `getAlertCount()` - Badge count via count_only param
- `getClientAlerts()` - List with optional status filter
- `updateAlertStatus()` - Acknowledge/resolve/dismiss

### AlertBadge.tsx

- Bell icon with count badge
- Pulse animation on critical alerts
- Green dot when count is 0
- Click handler for drawer toggle

### AlertItem.tsx

- Severity icon (AlertTriangle/AlertCircle/Info)
- Severity-colored background
- Title, message, timestamp
- Acknowledge and dismiss buttons
- Compact mode for drawer

### AlertDrawer.tsx

- Sheet slide-out panel
- Loads pending alerts on open
- 60-second count polling
- Acknowledge/dismiss handlers
- Link to full alerts page

### AlertsTable.tsx

- Full-width table with all alerts
- Status filter (all/pending/acknowledged/resolved/dismissed)
- Severity filter (all/critical/warning/info)
- Action buttons per row based on status
- Optimistic UI updates

### Alerts Page

- Standard page layout with PageHeader
- Suspense boundary with skeleton loading
- Card wrapper for table

## Self-Check: PASSED

- [x] Server actions call open-seo API
- [x] AlertBadge with pulse animation
- [x] AlertItem with severity icons
- [x] AlertDrawer with Sheet
- [x] AlertsTable with filters
- [x] Alerts page with Suspense
- [x] TypeScript compiles clean
