# Phase 60: Payment Flexibility — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Enable split payments (2-3 installments) with discount codes, automated reminders, and tracking dashboards.

**Core Capabilities:**
- Payment schedule schema with installment tracking
- Fixed split plans: pay-in-full, 2-payment (50/50), 3-payment (40/30/30)
- Client plan selector UI on invoice page
- Agency installment tracking dashboard
- Discount/coupon code system
- Automated reminder emails (3 days before, day-of, overdue)

**Key Constraint:** Fixed splits only (no custom percentages) for v1.0.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01:** `payment_schedules` table with planType (full/split_2/split_3), totalInstallments
- **D-02:** `payment_installments` table with status enum: pending → processing → paid | overdue | failed
- **D-03:** Index on (status, due_at) for efficient overdue queries
- **D-04:** Extend workspace_payment_settings with splitPaymentsEnabled, availablePlans jsonb, defaultPlan

### Payment Plan Logic
- **D-05:** 2-payment split: 50% today, 50% in 30 days
- **D-06:** 3-payment split: 40% today, 30% in 30 days, 30% in 60 days
- **D-07:** Math.ceil for first installment to avoid rounding issues
- **D-08:** Each installment stores paymentUrl for checkout link

### UI Components
- **D-09:** PaymentPlanSelector with radio cards showing breakdown
- **D-10:** PaymentScheduleView for client to see progress
- **D-11:** InstallmentTrackingDashboard for agency with stats cards
- **D-12:** DiscountCodeInput with apply button and inline validation

### Discount Codes
- **D-13:** `discount_codes` table with code, discountType (percentage/fixed), discountValue
- **D-14:** maxUses limit with usedCount increment on apply
- **D-15:** minAmountCents minimum order threshold
- **D-16:** validFrom/validUntil date range validation

### Automated Reminders
- **D-17:** Daily worker at 9 AM checking upcoming/overdue installments
- **D-18:** 4 email templates: reminder, due-today, overdue, overdue-urgent
- **D-19:** reminderSentAt timestamp prevents duplicate sends
- **D-20:** Reminder triggers: 3 days before, day-of, 1 day overdue, 7 days overdue

### Integration Points
- **D-21:** Extends existing Stripe/Revolut payment flow from P54
- **D-22:** Creates installment-specific checkout sessions
- **D-23:** Webhook handlers update installment status on payment success

### Claude's Discretion
- Loading states for plan selection
- Skeleton UI for dashboard stats
- Error handling for failed discount code validation
- Animation for installment progress indicator

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Design
- `.planning/phases/60-payment-flexibility/DESIGN.md` — Full specification with schemas, UI mockups

### Prior Art
- `open-seo-main/src/db/invoice-schema.ts` — Invoice schema
- `open-seo-main/src/server/features/invoices/` — Invoice services
- `.planning/phases/54-multi-provider-payments/` — Stripe/Revolut integration

### Existing Infrastructure
- `open-seo-main/src/server/lib/stripe/` — Stripe client
- `open-seo-main/src/server/lib/revolut/` — Revolut client
- `open-seo-main/src/server/workers/` — BullMQ workers for background jobs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PaymentProviderFactory from P54 — provider abstraction
- Invoice schemas and services — extend for schedules
- Email templates from P55 — i18n support
- Worker patterns from schedule-worker.ts

### Established Patterns
- Drizzle pgTable + relations pattern
- Service layer with static methods
- BullMQ for background processing
- v6 design system tokens

### Integration Points
- Invoice payment page → add plan selector
- Workspace settings → payment settings panel
- Dashboard → add installment tracking section

</code_context>

<specifics>
## Specific Ideas

- **Clear breakdown**: Show exact amounts and dates, not just percentages
- **No surprises**: Client sees full schedule before confirming
- **Agency control**: Toggle which plans available per workspace
- **Simple validation**: Discount codes validate immediately on Apply click

</specifics>

<deferred>
## Deferred Ideas

- Custom split percentages (beyond fixed 50/50, 40/30/30)
- Automatic payment retry (Stripe handles this natively)
- Payment plan modification after creation
- Interest/late fees on overdue installments
- Recurring subscription billing (separate feature)

</deferred>

---

*Phase: 60-payment-flexibility*
*Context gathered: 2026-05-02*
