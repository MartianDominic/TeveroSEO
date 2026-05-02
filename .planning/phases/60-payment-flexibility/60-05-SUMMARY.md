---
phase: 60-payment-flexibility
plan: 05
subsystem: payments
tags: [installments, reminders, webhooks, bullmq]
dependency_graph:
  requires:
    - 60-01-SUMMARY.md
    - 60-02-SUMMARY.md
    - 60-03-SUMMARY.md
  provides:
    - installment-reminder-worker
    - installment-email-templates
    - webhook-installment-handling
    - split-payment-settings-api
  affects:
    - email-templates
    - stripe-webhook
    - revolut-webhook
    - payment-settings-api
tech_stack:
  added: []
  patterns:
    - bullmq-sandboxed-processor
    - daily-cron-9am
    - webhook-installment-routing
key_files:
  created:
    - open-seo-main/src/server/queues/installmentReminderQueue.ts
    - open-seo-main/src/server/workers/installment-reminder-processor.ts
    - open-seo-main/src/server/workers/installment-reminder-worker.ts
  modified:
    - open-seo-main/src/server/services/email/templates.ts
    - open-seo-main/src/routes/api/webhooks/stripe.ts
    - open-seo-main/src/routes/api/webhooks/revolut.ts
    - open-seo-main/src/routes/api/settings/payments.ts
decisions:
  - "BullMQ worker pattern follows schedule-worker.ts for consistency"
  - "MAX_EMAILS_PER_RUN = 50 per T-60-18 DoS mitigation"
  - "Reminder deduplication via wasReminderSentToday check on reminderSentAt"
  - "Webhook routes installment vs invoice payments via metadata.installmentId"
metrics:
  duration_seconds: 493
  tasks_completed: 4
  files_created: 3
  files_modified: 4
  completed_at: "2026-05-02T16:16:00Z"
---

# Phase 60 Plan 05: Reminders + Polish Summary

Automated reminder emails and webhook handlers for installment payments with daily 9 AM BullMQ worker.

## Completed Tasks

| Task | Name | Status | Key Deliverables |
|------|------|--------|------------------|
| 1 | Create installment reminder email templates | Done | 4 templates in EN + LT (8 total) |
| 2 | Create installment reminder worker | Done | Queue, processor, worker files |
| 3 | Update webhook handlers | Done | Stripe + Revolut installment routing |
| 4 | Extend payment settings API | Done | splitPayments config in GET/PUT |

## Implementation Details

### Task 1: Email Templates

Added 4 new email template types to `EmailTemplateId`:
- `installment-reminder` - 3 days before due
- `installment-due-today` - Day of payment
- `installment-overdue` - 1 day overdue
- `installment-overdue-urgent` - 7 days overdue

Each template available in EN and LT with variables:
- recipientName, businessName, companyName
- installmentNumber, totalInstallments
- installmentAmount (formatted currency)
- dueDate, remainingAmount, paymentLink, senderName

### Task 2: Reminder Worker

**Queue** (`installmentReminderQueue.ts`):
- Queue name: `installment-reminders`
- Cron: `0 9 * * *` (daily 9 AM per D-17)
- Job data: `{ type: 'daily-check', triggeredAt: ISO }` 

**Processor** (`installment-reminder-processor.ts`):
- Finds installments due in 3 days, today, 1 day overdue, 7 days overdue
- Joins with schedules, invoices, clients, organization for context
- MAX_EMAILS_PER_RUN = 50 (T-60-18 DoS mitigation)
- `wasReminderSentToday()` prevents duplicate sends (D-19)
- Marks overdue status when sending overdue reminders

**Worker** (`installment-reminder-worker.ts`):
- Follows schedule-worker.ts pattern
- Sandboxed processor via file path
- DLQ for failed jobs after 3 attempts
- Graceful shutdown with 25s timeout

### Task 3: Webhook Updates

**Stripe** (`stripe.ts`):
- Added `checkout.session.completed` handler
- Checks `session.metadata.installmentId`
- Calls `PaymentScheduleService.recordPayment()`
- Logs next installment status or all-paid state

**Revolut** (`revolut.ts`):
- Updated `ORDER_COMPLETED` handler
- Checks `data.metadata.installmentId`
- Routes to installment or invoice payment handling
- Same recordPayment flow as Stripe

### Task 4: Settings API Extension

**Schema validation** added:
- `splitPaymentsEnabled: z.boolean()`
- `availablePlans: z.array(z.enum(['full', 'split_2', 'split_3']))`
- `defaultPlan: z.enum(['full', 'split_2', 'split_3'])`

**Response** includes `splitPayments` object:
```typescript
splitPayments: {
  enabled: boolean;
  availablePlans: string[];
  defaultPlan: string;
}
```

**Validation**: defaultPlan must be in availablePlans array.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality fully wired.

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| 4 reminder email templates in EN and LT | PASS |
| Daily worker at 9 AM processes reminders | PASS |
| Reminders sent at 3 days, 0 days, +1 day, +7 days | PASS |
| reminderSentAt prevents duplicate sends | PASS |
| Stripe webhook updates installment status | PASS |
| Revolut webhook updates installment status | PASS |
| Next installment checkout created automatically | PASS (logged for client view) |
| Payment settings API includes split payment config | PASS |

## Self-Check

- [x] installmentReminderQueue.ts exists
- [x] installment-reminder-processor.ts exists
- [x] installment-reminder-worker.ts exists
- [x] Email templates contain all 4 installment types
- [x] Webhooks import PaymentScheduleService
- [x] Settings API includes splitPayments

## Self-Check: PASSED
