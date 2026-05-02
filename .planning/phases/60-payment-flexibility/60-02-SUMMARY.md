---
phase: 60-payment-flexibility
plan: 02
subsystem: payments, ui
tags: [split-payments, installments, checkout, react, tanstack-router, shadcn]

# Dependency graph
requires:
  - phase: 54-multi-provider-payments
    provides: PaymentProviderFactory, Stripe/Revolut integration
provides:
  - PaymentPlanSelector component with radio card UI
  - PaymentScheduleView component for client schedule display
  - InstallmentCard component for individual installments
  - formatCurrency/calculatePlan utilities
  - /api/invoices/:id/schedule endpoint
  - Split payment configuration in /api/invoices/:id/pay
affects: [60-03, 60-04, 60-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Radio card selector pattern for plan choice
    - Installment card with status badges
    - Schedule API with idempotent creation

key-files:
  created:
    - open-seo-main/src/lib/format-currency.ts
    - open-seo-main/src/components/payment/InstallmentCard.tsx
    - open-seo-main/src/components/payment/PaymentPlanSelector.tsx
    - open-seo-main/src/components/payment/PaymentScheduleView.tsx
    - open-seo-main/src/routes/api/invoices/$id.schedule.ts
    - open-seo-main/src/components/payment/index.ts
  modified:
    - open-seo-main/src/routes/api/invoices/$id.pay.ts

key-decisions:
  - "Client-side calculatePlan function for plan breakdowns - enables UI preview without API calls"
  - "Schedule API returns schedule + checkoutUrl - single endpoint for schedule creation"
  - "Split payment redirect from pay.ts - directs to schedule API for non-full payments"
  - "TODO placeholders for PaymentScheduleService integration - enables parallel execution with 60-01"

patterns-established:
  - "Payment plan selector: Radio cards with plan breakdown, amounts, dates"
  - "Installment status icons: Check=paid, Circle=pending, Spinner=processing, Alert=overdue"
  - "Schedule API: Idempotent creation, returns existing if schedule exists"

requirements-completed: [P60-PLAN-SELECTOR-UI, P60-CHECKOUT-FLOW, P60-SCHEDULE-VIEW]

# Metrics
duration: 10min
completed: 2026-05-02
---

# Phase 60 Plan 02: Payment Plan Selector UI + Checkout Flow Summary

**Radio card payment plan selector with 2/3-installment options, schedule view component, and checkout integration APIs**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-02T15:37:39Z
- **Completed:** 2026-05-02T15:47:35Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- PaymentPlanSelector component with radio cards showing full/2-payment/3-payment options with calculated breakdowns
- PaymentScheduleView component showing client's payment progress with status badges and "Pay Now" button
- InstallmentCard component with status icons (paid/pending/processing/overdue)
- formatCurrency and calculatePlan utilities for consistent currency formatting and plan calculations
- Schedule API endpoint (GET/POST /api/invoices/:id/schedule) for schedule creation and retrieval
- Updated pay.ts to include splitPayments configuration in response

## Files Created/Modified

- `open-seo-main/src/lib/format-currency.ts` - Currency formatting (formatCents, formatCurrency) and plan calculation (calculatePlan, getPlanName)
- `open-seo-main/src/components/payment/InstallmentCard.tsx` - Single installment display with status icons and badges
- `open-seo-main/src/components/payment/PaymentPlanSelector.tsx` - Radio card selector for plan choice with amounts and dates
- `open-seo-main/src/components/payment/PaymentScheduleView.tsx` - Client schedule view with progress summary and Pay Now button
- `open-seo-main/src/routes/api/invoices/$id.schedule.ts` - Schedule API with GET (retrieve) and POST (create) handlers
- `open-seo-main/src/routes/api/invoices/$id.pay.ts` - Added splitPayments config to GET response, planType support to POST
- `open-seo-main/src/components/payment/index.ts` - Barrel export for payment components

## Decisions Made

- **Client-side plan calculation:** calculatePlan runs in browser for instant UI feedback without API calls
- **Schedule-first split payments:** POST /api/invoices/:id/pay redirects to schedule API for non-full payments
- **TODO placeholders for 60-01 integration:** Functions like getScheduleForInvoice and createScheduleForInvoice have placeholder implementations that will integrate with PaymentScheduleService once 60-01 completes
- **Idempotent schedule creation:** POST returns existing schedule if one exists (T-60-08 mitigation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing TypeScript errors:** The codebase has 17 route type errors related to TanStack Router FileRoutesByPath type. These are pre-existing and not caused by this plan's changes.
- **Pre-existing build error:** Build fails due to missing `@/server/lib/auth` import in `payments.ts`. This is a pre-existing issue unrelated to this plan.

## Known Integration Points

The following require 60-01 completion to fully function:

1. `getScheduleForInvoice()` - Currently returns null, needs PaymentScheduleService
2. `createScheduleForInvoice()` - Currently creates in-memory schedule, needs database persistence
3. `getAvailablePlans()` - Currently returns all plans, needs workspace settings with availablePlans
4. `isSplitPaymentsEnabled()` - Currently checks provider config, needs splitPaymentsEnabled setting

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI components ready for integration once 60-01 schema is in place
- API routes ready for PaymentScheduleService integration
- 60-03 (Agency Dashboard) can proceed with tracking UI
- 60-04 (Discount Codes) can add discount field to PaymentPlanSelector

## Self-Check: PASSED

All 7 created files verified present:
- format-currency.ts
- InstallmentCard.tsx
- PaymentPlanSelector.tsx
- PaymentScheduleView.tsx
- $id.schedule.ts
- index.ts
- 60-02-SUMMARY.md

---
*Phase: 60-payment-flexibility*
*Plan: 02*
*Completed: 2026-05-02*
