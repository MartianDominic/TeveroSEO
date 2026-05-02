---
phase: 60-payment-flexibility
plan: 03
subsystem: payments
tags: [dashboard, installments, stats, agency-ui]
dependency_graph:
  requires: [60-01]
  provides: [installment-tracking-dashboard, payment-stats-api, installments-api]
  affects: [agency-dashboard]
tech_stack:
  added: []
  patterns: [responsive-grid, status-badges, fetch-api, filter-state]
key_files:
  created:
    - open-seo-main/src/routes/api/payments/installments.ts
    - open-seo-main/src/routes/api/payments/stats.ts
    - open-seo-main/src/components/payment/InstallmentTable.tsx
    - open-seo-main/src/components/payment/InstallmentTrackingDashboard.tsx
  modified:
    - open-seo-main/src/components/payment/PaymentStatsCards.tsx
decisions:
  - "Used fetch API directly instead of React Query for simplicity; can migrate to React Query later if caching needed"
  - "Status badges use custom className for warning/success colors since Badge variants limited to default/secondary/destructive/outline"
  - "Upcoming detection logic in InstallmentTable (pending + due within 7 days) matches API filter logic"
metrics:
  duration_minutes: 25
  completed: "2026-05-02T19:15:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 60 Plan 03: Agency Installment Tracking Dashboard Summary

API routes and dashboard components for agency payment tracking with stats cards, filtered tables, and status badges.

## One-liner

Installment tracking dashboard with 4 stat cards, status-filtered table, and recently paid section using workspace-scoped APIs.

## Tasks Completed

### Task 1: Create installments and stats API routes

Created two API routes for the dashboard:

**GET /api/payments/installments**
- Workspace-scoped via `requireApiAuth`
- Query params: status, from, to, clientId, limit, offset
- Joins paymentInstallments with paymentSchedules, invoices, and clients
- Returns paginated list with total count
- Response includes installmentNumber and totalInstallments for multi-payment display

**GET /api/payments/stats**
- Workspace-scoped via `requireApiAuth`
- Returns aggregated stats: upcoming (7 days), overdue, thisMonth, ytd
- Uses SQL aggregation for efficiency
- T-60-11 mitigation: 1-year date range limit for DoS prevention

### Task 2: Create payment stats cards component

Created `PaymentStatsCards.tsx`:
- 4-card responsive grid (1 col mobile, 2 col tablet, 4 col desktop)
- Cards: Upcoming, Overdue, This Month, Total YTD
- Icons: CalendarClock, AlertTriangle, CalendarCheck, TrendingUp
- Overdue card highlighted in red when count > 0
- Loading skeleton state
- Uses formatCurrency from 60-02

### Task 3: Create installment table and dashboard

**InstallmentTable.tsx:**
- Columns: Client, Invoice, Amount, Due Date, Status
- Status badges with appropriate colors:
  - pending: outline variant
  - upcoming (pending + due within 7 days): amber warning style
  - paid: green success style
  - overdue/failed: destructive variant
  - processing: blue info style
- Shows "X of Y" for multi-installment invoices
- Loading skeleton and empty states
- Optional row click handler for navigation

**InstallmentTrackingDashboard.tsx:**
- Full page dashboard component
- PaymentStatsCards at top
- "Upcoming Payments" section with filter dropdown
  - Filter options: All, Upcoming (7 days), Overdue, Paid
- InstallmentTable with filtered results
- "Recently Paid" section showing last 10 paid installments
- Uses fetch API for data loading

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Fetch API over React Query**: Used native fetch with useState/useEffect instead of React Query. Simpler for initial implementation; can migrate to React Query later if caching or optimistic updates needed.

2. **Custom Badge Styling**: Badge component only has default/secondary/destructive/outline variants. Added custom className for warning (amber) and success (green) colors.

3. **Upcoming Detection**: Both API filter and table badge logic detect "upcoming" as pending + due within 7 days. Keeps logic consistent between filtering and display.

## Verification Results

All acceptance criteria passed:
- InstallmentTable component created with status badges
- InstallmentTrackingDashboard composes stats + tables with filtering
- PaymentStatsCards displays 4 stat cards in responsive grid
- "Upcoming Payments" and "Recently Paid" sections present
- Filter dropdown for status filtering
- TypeScript compiles without errors for all payment components

## Files Summary

| File | Purpose |
|------|---------|
| `src/routes/api/payments/installments.ts` | GET endpoint for filtered, paginated installments |
| `src/routes/api/payments/stats.ts` | GET endpoint for aggregated payment stats |
| `src/components/payment/InstallmentTable.tsx` | Table component with status badges |
| `src/components/payment/InstallmentTrackingDashboard.tsx` | Full dashboard page component |
| `src/components/payment/PaymentStatsCards.tsx` | 4-card stats grid (fixed CardConfig type) |

## Self-Check: PASSED

- [x] `src/routes/api/payments/installments.ts` exists and exports Route
- [x] `src/routes/api/payments/stats.ts` exists and exports Route
- [x] `src/components/payment/InstallmentTable.tsx` exists
- [x] `src/components/payment/InstallmentTrackingDashboard.tsx` exists
- [x] `src/components/payment/PaymentStatsCards.tsx` exists
- [x] TypeScript compiles without errors for payment components
- [x] All acceptance criteria grep checks pass
