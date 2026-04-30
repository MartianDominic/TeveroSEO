# Phase 60: Payment Flexibility & Split Payments

**Goal:** Enable split payments (2-3 installments) with clear UX for both agency configuration and client selection

**Depends on:** Phase 59 (agreement flow complete)

**Estimated effort:** 45-55 hours

---

## Problem Statement

Current payment system is inflexible:

1. **No split payments** — only pay-in-full or subscription
2. **No installment tracking** — cannot see who paid what
3. **No payment schedule** — clients cannot see upcoming payments
4. **No discount codes** — common sales tool missing
5. **No failed payment retry** — only logging, no action

Many clients prefer paying setup fees in installments, especially for larger packages.

---

## Split Payment Models

### Option A: Fixed Splits
- **2 payments:** 50% now, 50% in 30 days
- **3 payments:** 40% now, 30% in 30 days, 30% in 60 days

### Option B: Custom Splits (Agency Configurable)
- Agency defines percentage per installment
- Agency sets due dates (relative or absolute)
- Maximum 4 installments

### Recommendation: Start with Fixed Splits (Option A)
Simpler implementation, covers 90% of use cases. Can add custom splits later.

---

## User Journeys

### Agency Journey (Configuring Split Payments)

```
Settings > Payments:
1. Enable "Offer payment plans" toggle
2. Configure available plans:
   ☑ Pay in full (always available)
   ☑ 2 payments (50/50)
   ☑ 3 payments (40/30/30)
3. Set default plan: "Pay in full"

Per Proposal (optional override):
1. In Investment section, see "Payment options"
2. Toggle which plans available for this proposal
3. Can disable split payments for specific proposals
```

### Client Journey (Choosing Payment Plan)

```
Invoice payment page:
1. See invoice total and details
2. See payment plan options:
   ┌─────────────────────────────────────────────────────┐
   │ How would you like to pay?                          │
   │                                                     │
   │ ○ Pay in full                          €4,200      │
   │   Single payment today                             │
   │                                                     │
   │ ● Pay in 2 installments                            │
   │   €2,100 today + €2,100 in 30 days                │
   │                                                     │
   │ ○ Pay in 3 installments                            │
   │   €1,680 today + €1,260 in 30 days + €1,260 in 60d│
   │                                                     │
   └─────────────────────────────────────────────────────┘
3. Select plan
4. Click "Continue to payment"
5. Pay first installment via Stripe/Revolut
6. Receive confirmation with payment schedule
```

---

## Data Model

### Payment Schedule Schema

```typescript
export const paymentSchedules = pgTable("payment_schedules", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").references(() => invoices.id).notNull(),
  
  // Schedule configuration
  planType: text("plan_type").notNull(), // 'full' | 'split_2' | 'split_3' | 'custom'
  totalInstallments: integer("total_installments").notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentInstallments = pgTable("payment_installments", {
  id: text("id").primaryKey(),
  scheduleId: text("schedule_id").references(() => paymentSchedules.id).notNull(),
  
  // Installment details
  installmentNumber: integer("installment_number").notNull(), // 1, 2, 3...
  amountCents: integer("amount_cents").notNull(),
  dueAt: timestamp("due_at").notNull(),
  
  // Status
  status: text("status").notNull().default('pending'), // 'pending' | 'processing' | 'paid' | 'overdue' | 'failed'
  paidAt: timestamp("paid_at"),
  
  // Payment provider reference
  paymentId: text("payment_id"), // Stripe/Revolut payment ID
  paymentProvider: text("payment_provider"), // 'stripe' | 'revolut'
  paymentUrl: text("payment_url"), // Checkout URL for this installment
  
  // Reminders
  reminderSentAt: timestamp("reminder_sent_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Index for finding overdue installments
CREATE INDEX idx_installments_status_due ON payment_installments(status, due_at);
```

### Workspace Payment Settings Extension

```typescript
// Add to workspace_payment_settings
splitPaymentsEnabled: boolean("split_payments_enabled").default(false),
availablePlans: jsonb("available_plans").default(['full', 'split_2', 'split_3']),
defaultPlan: text("default_plan").default('full'),
```

---

## Payment Plan Calculations

```typescript
interface PaymentPlan {
  type: 'full' | 'split_2' | 'split_3';
  installments: {
    number: number;
    amount: number;
    dueDate: Date;
    label: string;
  }[];
  totalAmount: number;
}

function calculatePlan(totalCents: number, planType: string): PaymentPlan {
  const today = new Date();
  
  switch (planType) {
    case 'full':
      return {
        type: 'full',
        installments: [
          { number: 1, amount: totalCents, dueDate: today, label: 'Today' }
        ],
        totalAmount: totalCents,
      };
      
    case 'split_2':
      const half = Math.ceil(totalCents / 2);
      return {
        type: 'split_2',
        installments: [
          { number: 1, amount: half, dueDate: today, label: 'Today' },
          { number: 2, amount: totalCents - half, dueDate: addDays(today, 30), label: 'In 30 days' },
        ],
        totalAmount: totalCents,
      };
      
    case 'split_3':
      const first = Math.ceil(totalCents * 0.4);
      const second = Math.ceil(totalCents * 0.3);
      const third = totalCents - first - second;
      return {
        type: 'split_3',
        installments: [
          { number: 1, amount: first, dueDate: today, label: 'Today' },
          { number: 2, amount: second, dueDate: addDays(today, 30), label: 'In 30 days' },
          { number: 3, amount: third, dueDate: addDays(today, 60), label: 'In 60 days' },
        ],
        totalAmount: totalCents,
      };
  }
}
```

---

## User Interface

### Client Payment Page (Plan Selection)

```
┌─────────────────────────────────────────────────────────────────┐
│ Invoice #INV-2024-0042                                          │
│ From: TeveroSEO                                                 │
│ Amount due: €4,200.00                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Choose your payment plan                                         │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Pay in full                                               │ │
│ │   €4,200.00 today                                           │ │
│ │   ────────────────────────────────────────────────────────  │ │
│ │   No additional payments required                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ● Pay in 2 installments                          Selected   │ │
│ │   €2,100.00 today                                           │ │
│ │   ────────────────────────────────────────────────────────  │ │
│ │   Payment 1: €2,100.00 ─ Today                             │ │
│ │   Payment 2: €2,100.00 ─ May 30, 2026                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Pay in 3 installments                                     │ │
│ │   €1,680.00 today                                           │ │
│ │   ────────────────────────────────────────────────────────  │ │
│ │   Payment 1: €1,680.00 ─ Today (40%)                       │ │
│ │   Payment 2: €1,260.00 ─ May 30, 2026 (30%)                │ │
│ │   Payment 3: €1,260.00 ─ Jun 29, 2026 (30%)                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                                                  │
│                              [Continue to Payment →]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Agency Installment Tracking Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Payment Tracking                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌────────────┬────────────┬────────────┬────────────┐           │
│ │ Upcoming   │ Overdue    │ This Month │ Total      │           │
│ │ €4,200     │ €0         │ €8,400     │ €24,500    │           │
│ │ 2 payments │ 0 payments │ 4 payments │ YTD        │           │
│ └────────────┴────────────┴────────────┴────────────┘           │
│                                                                  │
│ Upcoming Payments                                   [Filter ▾]   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Client          Invoice    Amount    Due        Status      │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │ Acme Corp       INV-0042   €2,100    May 30     ● Upcoming  │ │
│ │ Beta Inc        INV-0039   €1,260    May 30     ● Upcoming  │ │
│ │ Gamma Ltd       INV-0041   €2,500    Jun 5      ○ Pending   │ │
│ │ Delta Co        INV-0038   €1,260    Jun 15     ○ Pending   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Recently Paid                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Client          Invoice    Amount    Paid       Payment     │ │
│ │ ──────────────────────────────────────────────────────────  │ │
│ │ Acme Corp       INV-0042   €2,100    Apr 30     1 of 2 ✓   │ │
│ │ Beta Inc        INV-0039   €1,680    Apr 28     1 of 3 ✓   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Client Payment Schedule View

After first payment, client sees their schedule:

```
┌─────────────────────────────────────────────────────────────────┐
│ Your Payment Schedule                                            │
│ Invoice #INV-2024-0042                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ✓ Payment 1 of 2                                                │
│   €2,100.00 ─ Paid April 30, 2026                               │
│                                                                  │
│ ○ Payment 2 of 2                                                │
│   €2,100.00 ─ Due May 30, 2026                                  │
│   [Pay Now]                                                      │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ We'll send you a reminder 3 days before your next payment.      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Discount/Coupon Codes

### Schema

```typescript
export const discountCodes = pgTable("discount_codes", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  
  code: text("code").notNull(), // e.g., "WELCOME20"
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed'
  discountValue: integer("discount_value").notNull(), // 20 (%) or 5000 (cents)
  
  // Limits
  maxUses: integer("max_uses"), // null = unlimited
  usedCount: integer("used_count").default(0),
  minAmountCents: integer("min_amount_cents"), // Minimum order for discount
  
  // Validity
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

### UI in Checkout

```
┌─────────────────────────────────────────────────────────────────┐
│ Subtotal:                                           €4,200.00   │
│                                                                  │
│ Discount code: [WELCOME20        ] [Apply]                      │
│                                                                  │
│ Discount (20%):                                     -€840.00    │
│ ──────────────────────────────────────────────────────────────  │
│ Total:                                              €3,360.00   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Automated Reminders

### Reminder Schedule

| Trigger | Email Template |
|---------|----------------|
| 3 days before due | `installment-reminder` |
| Day of (if not paid) | `installment-due-today` |
| 1 day overdue | `installment-overdue` |
| 7 days overdue | `installment-overdue-urgent` |

### Worker Job

```typescript
// Run daily at 9 AM
async function processInstallmentReminders() {
  // Find installments due in 3 days
  const upcoming = await findInstallmentsDueIn(3);
  for (const installment of upcoming) {
    if (!installment.reminderSentAt) {
      await sendReminder(installment, 'upcoming');
      await markReminderSent(installment.id);
    }
  }
  
  // Find overdue installments
  const overdue = await findOverdueInstallments();
  for (const installment of overdue) {
    const daysPastDue = differenceInDays(new Date(), installment.dueAt);
    if (daysPastDue === 1 || daysPastDue === 7) {
      await sendReminder(installment, 'overdue');
    }
  }
}
```

---

## Success Criteria

1. Split payment toggle in workspace settings
2. Payment plan selector on invoice page
3. Client can choose 2 or 3 payment plan
4. First installment processed via Stripe/Revolut
5. Payment schedule created with future installments
6. Agency dashboard shows all installments
7. Client can view their payment schedule
8. Automated reminders sent 3 days before due
9. Discount codes can be applied
10. Discount reduces total correctly

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 60-01 | Schema + Payment Schedule Service | 1 |
| 60-02 | Plan Selector UI + Checkout Flow | 1 |
| 60-03 | Agency Dashboard + Tracking | 2 |
| 60-04 | Discount Codes | 2 |
| 60-05 | Reminders + Polish | 3 |

---

## Out of Scope

- Custom split percentages (fixed 50/50 and 40/30/30 only)
- Automatic payment retry (Stripe handles this for saved cards)
- Payment plan modification after creation
- Interest/late fees on overdue installments
