# GSD Phase 3: Contract & Payment System

> **Purpose**: Contract signing (Dokobit) + Payment collection (Stripe + Bank Transfer)  
> **Dependencies**: Phase 1 (Data Foundation), Phase 2 (Proposal System)  
> **Design System**: [design-system-v6.md](./design-system-v6.md)

---

## v6 Design System Compliance

**All components in this phase MUST use v6 tokens from [design-system-v6.md](./design-system-v6.md).**

### Quick Reference: Required v6 Tokens

| Category | Tokens |
|----------|--------|
| **Surfaces** | `--surface`, `--surface-2`, `--surface-3`, `--canvas`, `--canvas-dim` |
| **Shadows** | `--shadow-card` (at rest), `--shadow-lift` (on hover), `--shadow-pop` (buttons), `--shadow-cta` / `--shadow-cta-hover` (primary CTA) |
| **Text** | `--text-1`, `--text-2`, `--text-3`, `--text-4` |
| **Hairlines** | `--hairline`, `--hairline-2`, `--hairline-3` |
| **Accent** | `--accent`, `--accent-soft`, `--accent-ink` (ONE accent color only) |
| **Semantic** | `--success` / `--success-soft`, `--error` / `--error-soft`, `--warning` / `--warning-soft` |
| **Type** | `--type-tiny` (12px floor), `--type-small`, `--type-body`, `--type-h3`, `--type-h2`, `--type-h1` |
| **Numerals** | `--num-mega`, `--num-hero`, `--num-card`, `--num-row` (Newsreader serif) |
| **Radii** | `--radius-input` (6px), `--radius-button` (8px), `--radius-card` (12px), `--radius-pill` (999px) |
| **Motion** | `--motion-fast` (160ms), `--motion-hover` (280ms), `--motion-reveal` (240ms) |

### Critical v6 Rules

1. **12px text floor** - No visible text below 12px (WCAG compliance)
2. **One accent color** - Status differentiation via icons + semantic tokens, NOT multiple colors
3. **No animate-pulse** - Use opacity transition with `--motion-fast` (160ms) for live indicators
4. **Cards float on shadow** - Never use `border: 1px solid` on cards, use `--shadow-card`
5. **Lift on hover** - Cards get `transform: translateY(-1px)` + `--shadow-lift`
6. **Newsreader for numerals** - All hero amounts use serif display numerals with `tabular-nums lining-nums`

---

## Executive Summary

This phase implements the conversion flow: **Proposal Accepted → Contract Signed → Invoice Paid → Onboarding Triggered**

**Key Decisions:**
- Contract signing via **Dokobit** (already integrated) with clear View vs Sign UI
- V1 payments: **Stripe** (automated) + **Bank Transfer** (manual) 
- Support both **one-time** and **recurring** payment types with clear tracking
- Agency configures enabled providers in settings
- Customer sees only enabled options

---

## Part 1: Contract Signing (Dokobit)

### Existing Infrastructure
Agent 3 found Dokobit is **already integrated** in `open-seo-main/src/server/features/proposals/`. The gap is clear UI distinction between viewing and signing.

### Contract States
```
DRAFT → SENT → CLIENT_VIEWED → CLIENT_SIGNED → AGENCY_COUNTERSIGNED → FULLY_EXECUTED
                    ↓
                 DECLINED
```

### UI: Client View (Unsigned)

**v6 Tokens Required:**
- Card: `--shadow-card` at rest, `--shadow-lift` on hover, `--radius-card` (12px)
- Status badge "UNSIGNED": `--surface-2` background, `--text-3` text, `--radius-pill`
- Title "CONTRACT": `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Subtitle: `--type-h3` (15-16px), `--text-1`
- Body text: `--type-body` (14px), `--text-2`
- Preview button: `--shadow-card`, `--radius-button` (8px), hover: `--shadow-pop`
- Sign Contract CTA: `.btn-primary` with `--shadow-cta`, hover: `--shadow-cta-hover`
- Internal divider: `border-bottom: 1px solid var(--hairline-2)`

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTRACT                                            ○ UNSIGNED  │
│ SEO Services Agreement                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  [Preview Contract]                                        │ │
│  │                                                            │ │
│  │  Opens PDF in modal — read-only, no signature              │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Ready to Sign                                              │ │
│  │                                                            │ │
│  │  You'll be redirected to Dokobit to sign using:           │ │
│  │  • Smart-ID                                                │ │
│  │  • Mobile-ID                                               │ │
│  │  • ID card                                                 │ │
│  │                                                            │ │
│  │  [Sign Contract]  ← .btn-primary with --shadow-cta         │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI: Client View (Signed)

**v6 Tokens Required:**
- Status badge "FULLY EXECUTED": `--success-soft` background, `--success` text, `--radius-pill`
- Check icon: `--success` color
- Download button: `.btn` with `--shadow-card`, hover: `--shadow-pop`
- Signature rows: `--type-body` (14px), timestamps in `--font-mono` with `tabular-nums`
- Section dividers: `border-bottom: 1px solid var(--hairline-2)`
- Next step text: `--type-body`, `--text-2`
- View Invoice link: `--accent` color, hover: `--accent-2`

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTRACT                                    ✓ FULLY EXECUTED    │
│ SEO Services Agreement                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Download Signed PDF]                                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Signatures:                                                    │
│  ✓ TeveroSEO UAB         2026-04-28 10:15    via Smart-ID      │
│  ✓ Jonas Jonaitis        2026-04-29 14:32    via Mobile-ID     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  → Next Step: Invoice has been sent to your email              │
│  [View Invoice]                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Contract API Routes
```
GET    /api/contracts/:id              # Get contract details (agency)
GET    /api/c/:token                   # Client-facing contract view (public)
GET    /api/c/:token/preview           # Get PDF for preview modal
POST   /api/c/:token/sign              # Initiate Dokobit signing flow
POST   /api/webhooks/dokobit           # Dokobit signature completion webhook
```

---

## Part 2: Payment System

### Payment Types

| Type | Trigger | Recurrence | Example |
|------|---------|------------|---------|
| `setup_fee` | Contract signed | One-time | €2,000 setup |
| `monthly_retainer` | 1st of month | Recurring | €3,500/month |
| `project_milestone` | Milestone completed | One-time | €1,500 per deliverable |
| `overage` | Usage exceeds plan | One-time | €50 per extra article |

### Invoice Schema Addition
```typescript
// Add to invoices table
type: 'one_time' | 'recurring',
recurringInterval: 'monthly' | 'quarterly' | 'yearly' | null,
recurringStartDate: Date | null,
recurringEndDate: Date | null,
isFirstRecurring: boolean, // true for first invoice in a series
parentInvoiceId: UUID | null, // links recurring invoices together
```

### Payment States
```
DRAFT → SENT → VIEWED → PAID
                 ↓
              OVERDUE → REMINDER_SENT → PAID
                 ↓
              VOID (cancelled)
```

For recurring:
```
PAID → (next month) → NEW INVOICE GENERATED → SENT → ...
```

---

## Part 3: Payment Providers

### V1: Stripe + Bank Transfer

#### Agency Settings Schema
```typescript
interface PaymentSettings {
  stripe: {
    enabled: boolean;
    accountId: string;
    liveMode: boolean;
    acceptedMethods: ('card' | 'sepa_debit')[];
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;       // "Revolut Business"
    iban: string;           // "LT12 3456 7890 1234 5678"
    bic: string;            // "REVOLT21"
    accountHolder: string;  // "TeveroSEO UAB"
    referenceTemplate: string; // "INV-{invoiceNumber}"
  };
  defaultMethod: 'stripe' | 'bank_transfer';
  
  // Recurring settings
  recurring: {
    enabled: boolean;
    autoCharge: boolean;  // Auto-charge saved payment method
    reminderDaysBefore: number; // Send reminder X days before due
  };
}
```

#### Why This Combination

| Provider | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Stripe** | Excellent API, SEPA support, recurring built-in, webhooks | 1.5-2.9% fees | Automated payments, international clients |
| **Bank Transfer** | Zero fees, familiar to LT businesses, universal | Manual confirmation | Large invoices, traditional businesses |

**Skipped for V1:**
- Paysera — adds complexity, most LT businesses accept Stripe SEPA
- Revolut — no payment collection API (only for agency banking)

---

## Part 4: Customer Payment UI

**v6 Tokens Required (All Invoice Views):**
- Page background: `--canvas`
- Invoice card: `--surface`, `--shadow-card`, `--radius-card` (12px)
- Card hover: `--shadow-lift`, `transform: translateY(-1px)`
- Invoice number: `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Amount numeral: `--num-card` (36-44px), Newsreader serif, `tabular-nums lining-nums`, `--text-1`
- Due date: `--type-body` (14px), `--text-2`
- Section headers "PAY ONLINE": `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Divider "OR PAY BY...": `--hairline-2`, `--text-4` for text
- Payment option cards: `--surface-2` background, `--radius-button` (8px)
- Pay CTA button: `.btn-primary` with `--shadow-cta`, hover: `--shadow-cta-hover`
- Secondary buttons: `.btn` with `--shadow-card`, hover: `--shadow-pop`
- Bank details: `--font-mono`, `--type-body`, `tabular-nums` for IBAN
- Motion: `--motion-hover` (280ms) for card lift, `--motion-fast` (160ms) for button states

### Invoice View (Both Providers Enabled)
```
┌─────────────────────────────────────────────────────────────────┐
│ INVOICE #INV-2026-042                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  €4,500                              Due: May 15, 2026  │   │
│  │  ───────                                                │   │
│  │  Setup Fee (one-time)                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PAY ONLINE                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Card or Bank                                             │   │
│  │    Visa, Mastercard, SEPA Direct Debit                  │   │
│  │                                                          │   │
│  │    [Pay €4,500]  ← .btn-primary with --shadow-cta       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── OR PAY BY BANK TRANSFER ──                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Bank Transfer                                            │   │
│  │                                                          │   │
│  │    Bank: Revolut Business                               │   │
│  │    IBAN: LT12 3456 7890 1234 5678  (--font-mono)        │   │
│  │    BIC: REVOLT21                                        │   │
│  │    Reference: INV-2026-042                              │   │
│  │                                                          │   │
│  │    [Copy Details]  [I've Made the Transfer]             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Invoice View (Bank Transfer Only — Stripe Disabled)
```
┌─────────────────────────────────────────────────────────────────┐
│ INVOICE #INV-2026-042                              €4,500 DUE   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PAY BY BANK TRANSFER                                           │
│                                                                 │
│  Bank: Revolut Business                                         │
│  IBAN: LT12 3456 7890 1234 5678                                │
│  BIC: REVOLT21                                                  │
│  Reference: INV-2026-042                                        │
│                                                                 │
│  [Copy Details]  [I've Made the Transfer]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Recurring Invoice Indicator

**v6 Tokens Required:**
- Recurring badge: `--accent-soft` background, `--accent-ink` text, `--radius-pill`
- Recurring icon: Use static icon (NOT animated), `--accent` color
- Sequence text "Invoice 3 of 12": `--type-small` (13px), `--text-3`
- Date "Started Apr 2026": `--type-small`, `--text-3`, italic for date

```
┌─────────────────────────────────────────────────────────────────┐
│ INVOICE #INV-2026-043                                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  €3,500                              Due: Jun 1, 2026   │   │
│  │  ───────                                                │   │
│  │  [recurring-icon] Monthly Retainer (recurring)          │   │
│  │     Invoice 3 of 12 • Started Apr 2026                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ...payment options...                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### "I've Made the Transfer" Flow
1. Client clicks button
2. Modal: "Please confirm the transfer details"
   - Amount transferred: €____
   - Transfer date: ____
   - [Confirm]
3. Invoice status → `awaiting_confirmation`
4. Agency sees: "🔔 Client claims transfer made for INV-2026-042"
5. Agency checks bank account
6. Agency clicks "Confirm Payment" or "Payment Not Found"
7. If confirmed: status → `paid`, trigger onboarding

---

## Part 5: Agency Payment Settings UI

**v6 Tokens Required:**
- Page title "PAYMENT SETTINGS": `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Settings card: `--surface`, `--shadow-card`, `--radius-card` (12px)
- Section headers "PAYMENT PROVIDERS": `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Provider cards: `--surface-2` background, `--radius-button` (8px)
- Status badges "Connected/Enabled": `--success-soft` background, `--success` text, `--radius-pill`
- Form inputs: `--radius-input` (6px), `border: 1px solid var(--hairline)`, focus: `--accent` border
- Checkboxes: Custom with `--accent` fill when checked
- Dropdown: `--surface`, `--shadow-card`, `--radius-input`
- Divider: `border-bottom: 1px solid var(--hairline-2)`
- Save button: `.btn-primary` with `--shadow-cta`
- Disconnect link: `--error` color (destructive action)
- Motion: `--motion-fast` (160ms) for form interactions

### Settings Page Section
```
┌─────────────────────────────────────────────────────────────────┐
│ PAYMENT SETTINGS                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PAYMENT PROVIDERS                                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [✓] Stripe                                    Connected │   │
│  │     Accept: [✓] Cards  [✓] SEPA Direct Debit            │   │
│  │     Account: acct_1234...  [Disconnect]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [✓] Bank Transfer                              Enabled  │   │
│  │                                                          │   │
│  │     Bank Name: [Revolut Business        ]               │   │
│  │     IBAN:      [LT12 3456 7890 1234 5678]               │   │
│  │     BIC/SWIFT: [REVOLT21                ]               │   │
│  │     Account Holder: [TeveroSEO UAB      ]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Default Method: [Stripe ▼]                                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  RECURRING PAYMENTS                                             │
│                                                                 │
│  [✓] Enable recurring invoices                                 │
│  [✓] Auto-charge saved payment methods                         │
│  Send reminder [ 3 ] days before due date                      │
│                                                                 │
│  [Save Settings]  ← .btn-primary with --shadow-cta             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Data Model

### New/Updated Tables

```sql
-- Update invoices table
ALTER TABLE invoices ADD COLUMN type TEXT DEFAULT 'one_time'; -- 'one_time' | 'recurring'
ALTER TABLE invoices ADD COLUMN recurring_interval TEXT; -- 'monthly' | 'quarterly' | 'yearly'
ALTER TABLE invoices ADD COLUMN recurring_start_date DATE;
ALTER TABLE invoices ADD COLUMN recurring_end_date DATE;
ALTER TABLE invoices ADD COLUMN recurring_sequence INT DEFAULT 1; -- which invoice in series
ALTER TABLE invoices ADD COLUMN parent_invoice_id UUID REFERENCES invoices(id);
ALTER TABLE invoices ADD COLUMN payment_method TEXT; -- 'stripe' | 'bank_transfer'
ALTER TABLE invoices ADD COLUMN bank_transfer_claimed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN bank_transfer_confirmed_at TIMESTAMPTZ;

-- Agency payment settings (add to agency/organization table or separate)
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Stripe
  stripe_enabled BOOLEAN DEFAULT false,
  stripe_account_id TEXT,
  stripe_live_mode BOOLEAN DEFAULT false,
  stripe_accepted_methods JSONB DEFAULT '["card", "sepa_debit"]',
  
  -- Bank Transfer
  bank_transfer_enabled BOOLEAN DEFAULT true,
  bank_name TEXT,
  bank_iban TEXT,
  bank_bic TEXT,
  bank_account_holder TEXT,
  
  -- Defaults
  default_method TEXT DEFAULT 'stripe',
  
  -- Recurring
  recurring_enabled BOOLEAN DEFAULT true,
  recurring_auto_charge BOOLEAN DEFAULT false,
  recurring_reminder_days INT DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Drizzle Schema
```typescript
// packages/db/src/schema/payment-settings.ts

export const paymentSettings = pgTable('payment_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  
  // Stripe
  stripeEnabled: boolean('stripe_enabled').default(false),
  stripeAccountId: text('stripe_account_id'),
  stripeLiveMode: boolean('stripe_live_mode').default(false),
  stripeAcceptedMethods: jsonb('stripe_accepted_methods').default(['card', 'sepa_debit']),
  
  // Bank Transfer
  bankTransferEnabled: boolean('bank_transfer_enabled').default(true),
  bankName: text('bank_name'),
  bankIban: text('bank_iban'),
  bankBic: text('bank_bic'),
  bankAccountHolder: text('bank_account_holder'),
  
  // Defaults
  defaultMethod: text('default_method').default('stripe'),
  
  // Recurring
  recurringEnabled: boolean('recurring_enabled').default(true),
  recurringAutoCharge: boolean('recurring_auto_charge').default(false),
  recurringReminderDays: integer('recurring_reminder_days').default(3),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Invoice type additions
export const invoiceTypeEnum = pgEnum('invoice_type', ['one_time', 'recurring']);
export const recurringIntervalEnum = pgEnum('recurring_interval', ['monthly', 'quarterly', 'yearly']);
export const paymentMethodEnum = pgEnum('payment_method', ['stripe', 'bank_transfer']);
```

---

## Part 7: API Routes

### Invoices
```
GET    /api/invoices                      # List all invoices (agency)
GET    /api/invoices/:id                  # Get invoice details (agency)
POST   /api/invoices                      # Create invoice
PATCH  /api/invoices/:id                  # Update invoice
POST   /api/invoices/:id/send             # Send invoice to client

# Client-facing (public, token-based)
GET    /api/i/:token                      # Client invoice view
POST   /api/i/:token/pay/stripe           # Initiate Stripe checkout
POST   /api/i/:token/pay/bank-claimed     # Client claims bank transfer made
POST   /api/invoices/:id/bank-confirm     # Agency confirms bank transfer (agency)

# Webhooks
POST   /api/webhooks/stripe               # Stripe payment events
```

### Payment Settings
```
GET    /api/settings/payments             # Get payment settings
PATCH  /api/settings/payments             # Update payment settings
POST   /api/settings/payments/stripe/connect    # Start Stripe Connect OAuth
GET    /api/settings/payments/stripe/callback   # Stripe Connect callback
DELETE /api/settings/payments/stripe/disconnect # Disconnect Stripe
```

### Recurring Invoice Jobs
```
# Cron job (daily at 00:00)
- Check for recurring invoices due for generation
- Generate new invoice from parent template
- Send if auto-send enabled
- Charge if auto-charge enabled and Stripe payment method saved
```

---

## Part 8: Task Breakdown

### Sprint 1: Contract Signing UI (12h)

**v6 Tokens Required:**
- Modal overlay: `rgba(20, 20, 26, 0.4)` backdrop, `--radius-modal` (14px)
- Modal card: `--surface`, `--shadow-lift`
- Close button: `.icon-btn` with `--shadow-card`
- Contract preview: PDF embed with `--radius-card` container
- Sign CTA: `.btn-primary` with `--shadow-cta`, hover: `--shadow-cta-hover`, `--motion-hover` (280ms)
- Status badges: Use semantic tokens (`--success-soft`/`--success` for signed, `--surface-2`/`--text-3` for unsigned)
- Status differentiation: Icons + text labels, NOT multiple accent colors
- Shadows: `--shadow-card` at rest, `--shadow-lift` on hover for all cards

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 1.1 | Create contract preview modal component | 2 | — |
| 1.2 | Create contract signing CTA component | 2 | — |
| 1.3 | Build client contract page (`/c/:token`) | 4 | 1.1, 1.2 |
| 1.4 | Add signature status display component | 2 | — |
| 1.5 | Connect Dokobit webhook to update contract status | 2 | 1.3 |

### Sprint 2: Invoice Data Model (8h)

**v6 Tokens Required:** N/A (backend data model, no UI components)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 2.1 | Add invoice type columns (one_time/recurring) | 2 | — |
| 2.2 | Add payment method tracking columns | 1 | — |
| 2.3 | Create payment_settings table | 2 | — |
| 2.4 | Create Drizzle schema + migration | 2 | 2.1-2.3 |
| 2.5 | Create InvoiceRepository with type support | 1 | 2.4 |

### Sprint 3: Stripe Integration (16h)

**v6 Tokens Required:**
- Connect button: `.btn-primary` with `--shadow-cta`
- Loading states: Opacity transition using `--motion-fast` (160ms), NO animate-pulse
- Success toast: `--success-soft` background, `--success` text, `--radius-button`
- Error toast: `--error-soft` background, `--error` text
- Status indicator "Connected": Static dot with `--success` color (no pulse animation)

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 3.1 | Stripe Connect OAuth flow for agency setup | 4 | 2.3 |
| 3.2 | Create Stripe checkout session endpoint | 3 | 3.1 |
| 3.3 | Stripe webhook handler (payment success/fail) | 4 | 3.2 |
| 3.4 | Stripe SEPA Direct Debit support | 2 | 3.2 |
| 3.5 | Save payment method for recurring | 3 | 3.3 |

### Sprint 4: Bank Transfer Flow (8h)

**v6 Tokens Required:**
- Bank details card: `--surface-2` background, `--radius-button` (8px)
- IBAN/BIC display: `--font-mono`, `--type-body`, `tabular-nums lining-nums`
- Copy button: `.btn` with `--shadow-card`, hover: `--shadow-pop`
- "I've Made Transfer" button: `.btn` secondary style
- Confirmation modal: `--radius-modal` (14px), `--surface`, `--shadow-lift`
- Form inputs in modal: `--radius-input` (6px), `--hairline` border
- Confirm button: `.btn-primary` with `--shadow-cta`
- Notification badge: `--warning-soft` background, `--warning` text (awaiting confirmation)
- Shadows: `--shadow-card` at rest, `--shadow-lift` on hover

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 4.1 | Bank transfer details display component | 2 | — |
| 4.2 | "I've Made the Transfer" flow + modal | 2 | 4.1 |
| 4.3 | Agency bank confirmation UI | 2 | 4.2 |
| 4.4 | Notification when client claims transfer | 2 | 4.2 |

### Sprint 5: Client Invoice Page (12h)

**v6 Tokens Required:**
- Page background: `--canvas`
- Invoice card: `--surface`, `--shadow-card`, `--radius-card` (12px), hover: `--shadow-lift`
- Amount display: `--num-card` (36-44px), Newsreader serif, `tabular-nums lining-nums`, `--text-1`
- Due date: `--type-body` (14px), `--text-2`
- Recurring badge: `--accent-soft` background, `--accent-ink` text, `--radius-pill`, static icon (no pulse)
- Payment option toggle: `--surface-2` inactive, `--accent-soft` active, `--radius-button`
- Pay button: `.btn-primary` with `--shadow-cta`, hover: `--shadow-cta-hover`
- Paid confirmation: `--success-soft` background card, `--success` check icon
- Success page: Large check icon with `--success`, Newsreader "Payment Complete" heading
- Motion: `--motion-hover` (280ms) for card transitions

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 5.1 | Build client invoice page (`/i/:token`) | 4 | 3.2, 4.1 |
| 5.2 | Payment method selection based on agency settings | 2 | 5.1 |
| 5.3 | Recurring invoice indicator component | 2 | 5.1 |
| 5.4 | Invoice paid confirmation page | 2 | 5.1 |
| 5.5 | Trigger onboarding on payment complete | 2 | 5.4 |

### Sprint 6: Agency Settings UI (8h)

**v6 Tokens Required:**
- Settings page: `--canvas` background
- Settings card: `--surface`, `--shadow-card`, `--radius-card` (12px)
- Section titles: `--type-tiny` (12px), `font-variant-caps: all-small-caps`, `--text-3`
- Provider cards: `--surface-2` background, `--radius-button` (8px)
- Form labels: `--type-small` (13px), `--text-2`
- Form inputs: `--radius-input` (6px), `--hairline` border, focus: `--accent` border
- Checkboxes: Custom with `--accent` fill when checked, `--radius-input` (6px)
- Toggle switches: `--surface-3` track, `--accent` active, `--motion-fast` (160ms) transition
- Status badges: `--success-soft`/`--success` for connected, `--surface-2`/`--text-3` for disabled
- Save button: `.btn-primary` with `--shadow-cta`
- Disconnect link: `--error` color
- Shadows: `--shadow-card` at rest

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 6.1 | Payment settings page layout | 2 | — |
| 6.2 | Stripe connection UI | 2 | 3.1 |
| 6.3 | Bank transfer configuration form | 2 | — |
| 6.4 | Recurring payment settings | 2 | — |

### Sprint 7: Recurring Invoice Engine (10h)

**v6 Tokens Required:**
- Reminder email: Use brand colors (`--accent` for CTA button in email)
- Email typography: System font stack for email compatibility, but match v6 hierarchy
- Invoice sequence badge in UI: `--accent-soft` background, `--accent-ink` text, `--radius-pill`
- Processing indicator: Opacity transition `--motion-fast` (160ms), NO animate-pulse
- Auto-charge status: Static icons with semantic colors (`--success`, `--error`), no animations

| # | Task | Hours | Depends On |
|---|------|-------|------------|
| 7.1 | Recurring invoice generation service | 4 | 2.5 |
| 7.2 | Auto-charge with saved payment method | 3 | 3.5, 7.1 |
| 7.3 | Reminder email before due date | 2 | 7.1 |
| 7.4 | Cron job setup for daily invoice generation | 1 | 7.1 |

---

## Summary

| Sprint | Focus | Hours |
|--------|-------|-------|
| 1 | Contract Signing UI | 12h |
| 2 | Invoice Data Model | 8h |
| 3 | Stripe Integration | 16h |
| 4 | Bank Transfer Flow | 8h |
| 5 | Client Invoice Page | 12h |
| 6 | Agency Settings UI | 8h |
| 7 | Recurring Invoice Engine | 10h |
| **Total** | | **74h** |

### Success Criteria

- [ ] Client can view contract PDF without signing
- [ ] Client can sign contract via Dokobit (Smart-ID/Mobile-ID)
- [ ] Agency can configure Stripe and/or Bank Transfer
- [ ] Client sees only enabled payment methods
- [ ] One-time vs recurring clearly indicated on invoices
- [ ] Bank transfer "claimed" → agency confirmation flow works
- [ ] Stripe payments auto-update invoice status via webhook
- [ ] Recurring invoices auto-generate monthly
- [ ] Payment completion triggers onboarding checklist

### V2 Backlog (Not in V1)

- [ ] Paysera integration
- [ ] Per-client default payment method
- [ ] Partial payments
- [ ] Payment plans (split into installments)
- [ ] Late payment fees

---

*Created: 2026-04-29*
