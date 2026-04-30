# Plan 51-01 Summary: MRR & Retention Dashboard

**Plan:** 51-01-PLAN.md
**Status:** Complete
**Completed:** 2026-04-30

## What Was Built

### Backend Services (open-seo-main)

1. **CurrencyService** (`/src/server/features/revenue/services/CurrencyService.ts`)
   - D-13: Multi-currency conversion with EUR as base
   - `convertToDisplayCurrency()` - converts between currencies
   - `formatCurrency()` - uses Intl.NumberFormat for locale-aware formatting
   - `sumInDisplayCurrency()` - sums multi-currency amounts
   - `getWorkspaceDisplayCurrency()` - returns workspace preference (defaults to EUR)
   - Static exchange rates for MVP (EUR, USD, GBP, PLN, SEK, NOK, DKK, CHF, CZK)

2. **RevenueService** (`/src/server/features/revenue/services/RevenueService.ts`)
   - D-12: MRR calculation from executed contracts with proposals
   - D-14: Contract type detection (recurring, prepaid_term, project, hybrid)
   - D-16: Outstanding payments grouped by urgency (overdue, due_this_week, upcoming)
   - D-17: Recognized vs cash received toggle support
   - `calculateMrr()` - MRR from active contracts
   - `getRevenueMetrics()` - 4 metrics (MRR, one-time, collected, outstanding)
   - `getOutstandingPayments()` - urgency-sorted payments with client names
   - `getMrrTrend()` - trend data for sparklines

3. **ChurnRiskService** (`/src/server/features/revenue/services/ChurnRiskService.ts`)
   - D-18: Service ending warnings (30/60/90 day thresholds)
   - D-19: No contact logged alerts (14/21/30 day thresholds)
   - D-20: Overdue deliverables (placeholder, tasks table not yet created)
   - D-21: SEO declining (placeholder, requires GSC integration)
   - `getChurnRisks()` - aggregates all risk signals sorted by severity

### Frontend Components (apps/web)

4. **RevenueCards** (`/src/components/revenue/RevenueCards.tsx`)
   - D-12: Grid of 4 MetricCard components
   - MRR with sparkline trend and delta
   - One-Time Revenue
   - Collected This Month
   - Outstanding

5. **MrrMovementBreakdown** (`/src/components/revenue/MrrMovementBreakdown.tsx`)
   - D-12: New MRR, Expansion MRR, Churn MRR
   - Net Movement calculation with color coding

6. **OutstandingPayments** (`/src/components/revenue/OutstandingPayments.tsx`)
   - D-16: Grouped by urgency (overdue=red, due_this_week=yellow, upcoming=gray)
   - Actions: Send Reminder, Log Call, View Invoice

7. **RevenueTrendChart** (`/src/components/revenue/RevenueTrendChart.tsx`)
   - D-12: Recharts LineChart with 3M/6M/12M toggle
   - Custom tooltip and axis formatting

8. **ChurnRiskAlerts** (`/src/components/revenue/ChurnRiskAlerts.tsx`)
   - D-18-21: Displays risk alerts with severity colors
   - Icon mapping for risk types
   - Click to navigate to client

9. **RevenueViewToggle** (`/src/app/(shell)/dashboard/revenue/RevenueViewToggle.tsx`)
   - D-17: Toggle between Recognized and Cash Received views

### Revenue Dashboard Page

10. **Revenue Page** (`/src/app/(shell)/dashboard/revenue/page.tsx`)
    - Complete dashboard integrating all components
    - Parallel data fetching with error boundaries
    - 3-column responsive layout

### Supporting Files

- `apps/web/src/lib/currency.ts` - formatCurrency utility
- `apps/web/src/lib/api/revenue.ts` - Revenue API client (mock data for MVP)
- `apps/web/src/lib/api/churn.ts` - Churn risk API client (mock data for MVP)

## Test Coverage

- **CurrencyService.test.ts**: 17 tests (conversion, formatting, sum, supported currencies)
- **RevenueService.test.ts**: 14 tests (contract types, urgency classification, calculations)
- **ChurnRiskService.test.ts**: 14 tests (severity calculations, sorting, risk types)

All 45 tests pass.

## Decisions Implemented

| Decision | Status | Implementation |
|----------|--------|----------------|
| D-12 | Complete | 4 metric cards + MRR breakdown + trend chart |
| D-13 | Complete | CurrencyService with static EUR-based rates |
| D-14 | Complete | determineContractType() function |
| D-15 | Partial | Types defined, schedule parsing not implemented |
| D-16 | Complete | OutstandingPayments with urgency grouping + actions |
| D-17 | Complete | RevenueViewToggle + recognizedRevenue option |
| D-18 | Complete | getExpiringServices() with 30/60/90 day severities |
| D-19 | Complete | getInactiveClients() with 14/21/30 day severities |
| D-20 | Placeholder | getOverdueDeliverables() returns [] (no tasks table) |
| D-21 | Placeholder | getDecliningMetrics() returns [] (needs GSC integration) |

## Files Created

```
open-seo-main/src/server/features/revenue/services/
  CurrencyService.ts
  CurrencyService.test.ts
  RevenueService.ts
  RevenueService.test.ts
  ChurnRiskService.ts
  ChurnRiskService.test.ts
  index.ts

apps/web/src/components/revenue/
  RevenueCards.tsx
  MrrMovementBreakdown.tsx
  OutstandingPayments.tsx
  RevenueTrendChart.tsx
  ChurnRiskAlerts.tsx
  index.ts

apps/web/src/app/(shell)/dashboard/revenue/
  page.tsx
  RevenueViewToggle.tsx

apps/web/src/lib/
  currency.ts
  api/revenue.ts
  api/churn.ts
```

## Known Limitations

1. **Mock Data**: API clients return mock data; real integration with RevenueService pending internal API setup
2. **D-20**: Tasks table not created, deliverables overdue returns empty
3. **D-21**: SEO declining requires GSC data integration
4. **Historical MRR**: Trend uses estimated data; historical MRR table not implemented
5. **Exchange Rates**: Static rates; production should use live API with caching

## Verification Commands

```bash
# Run revenue service tests
cd open-seo-main && pnpm vitest run src/server/features/revenue --reporter=verbose

# TypeScript check
cd apps/web && pnpm tsc --noEmit

# Verify files
ls open-seo-main/src/server/features/revenue/services/
ls apps/web/src/components/revenue/
```
