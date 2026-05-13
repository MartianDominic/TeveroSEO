# Phase 101: Direct Proposal & Manual Deal Pipeline - Research

**Researched:** 2026-05-13
**Domain:** Payment Reconciliation, Command Palette, Document Management, Pipeline Automation
**Confidence:** HIGH

## Summary

Phase 101 enables sending interactive proposals without prior analysis, inserting prospects at any pipeline stage (signed or not), handling offline-closed deals, and tracking payments via Revolut/Stripe integration with cross-platform linking.

The phase builds on extensive existing infrastructure: PaymentProviderFactory for multi-provider payments, pipelineActivities for polymorphic activity logging, proposals/contracts/invoices schemas with soft delete and optimistic locking, and cmdk-based Command component in @tevero/ui. New work focuses on payment reconciliation with confidence-based auto-matching, a global command palette with context-aware groups, Google Drive integration for document management, and a content library for reusable proposal blocks.

**Primary recommendation:** Implement payment reconciliation as the foundation (new schema + auto-match engine), then command palette (extends existing cmdk component), then quick capture modal, and finally document management with content library as polish layers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Two-layer entry system (Quick Capture < 5s, Full Entry when time permits)
- D-02: Payment reconciliation with multi-provider architecture (Stripe webhooks real-time, Revolut API polling every 15 min, manual entry/CSV import)
- D-02: Auto-match engine with priority order: Invoice # in memo (100%), Exact amount + client email (95%), Exact amount + date within 7 days (85%), Fuzzy amount (+-EUR0.50) + client name (70%), No match (0% review queue)
- D-02: New tables: payments, payment_allocations, client_credits, payment_groups, payment_group_members
- D-03: 4-tier AI involvement: Full AI Generation, AI-Assisted, Template + Manual, Blank Manual
- D-03: Flexible closing at any point (send to client, mark as accepted, upload signed doc, record payment, create invoice only)
- D-03: Command Palette (Cmd+K) available anywhere with context-aware suggestions
- D-04: Hybrid document storage (PostgreSQL metadata + Google Drive integration)
- D-04: Content Library with reusable blocks (case studies, testimonials, pricing tables, legal clauses)
- D-04: Enhanced tracking (time per section, scroll depth, forward detection, re-engagement alerts)

### Claude's Discretion
- Exact confidence thresholds for auto-match (suggested 90% but can tune)
- Specific keyboard shortcuts (can adjust based on conflicts)
- Heatmap visualization style
- Content library category structure

### Deferred Ideas (OUT OF SCOPE)
- Visual drag-drop template builder
- Side-by-side version comparison with diff highlighting
- Real-time collaboration (co-editing)
- Conditional content blocks
- Content library analytics (which blocks correlate with closed deals)
- Approval workflows
- CRM sync (Pipedrive, HubSpot)
- Bulk document operations
- AI-powered content suggestions based on client industry
- Payment forecasting based on pipeline
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Payment Reconciliation | API / Backend | Database | Business logic for matching, audit trails, 7-year retention |
| Auto-Match Engine | API / Backend | -- | Complex matching algorithms run server-side |
| Revolut Polling | API / Backend (Worker) | -- | BullMQ repeatable job, 15-min intervals |
| Stripe Webhooks | API / Backend | -- | Webhook handler validates signatures, enqueues |
| Command Palette | Browser / Client | -- | Client-side routing, context detection |
| Quick Capture Modal | Browser / Client | API / Backend | UI in browser, persists to DB |
| Content Library | API / Backend | Database | CRUD operations, usage tracking |
| Google Drive Sync | API / Backend | -- | OAuth token management, Drive API calls |
| Document Tracking | API / Backend | -- | Section-level analytics, forward detection |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard | Provenance |
|---------|---------|---------|--------------|------------|
| cmdk | 1.1.1 | Command palette primitive | Already in @tevero/ui, unstyled, accessible [VERIFIED: package.json] | [VERIFIED: npm registry] |
| googleapis | 171.4.0 | Google Drive API | Already installed for GSC/GA4/GBP OAuth [VERIFIED: package.json] | [VERIFIED: npm registry] |
| drizzle-orm | 0.45.2 | Database schema/queries | Project standard, type-safe, PostgreSQL | [VERIFIED: npm registry] |
| bullmq | 5.76.8 | Job queues (Revolut polling) | Project standard, Redis-backed | [VERIFIED: npm registry] |
| zod | ^3.x | Schema validation | Project standard for all input validation | [VERIFIED: codebase pattern] |

### Supporting
| Library | Version | Purpose | When to Use | Provenance |
|---------|---------|---------|-------------|------------|
| nanoid | ^3.x | ID generation | Payment IDs, magic links (32-char, ~10^57 entropy) | [VERIFIED: codebase pattern] |
| papaparse | ^5.x | CSV parsing | Manual payment CSV import | [VERIFIED: Phase 30.5 pattern] |
| date-fns | ^3.x | Date handling | 7-day match window, expiration | [VERIFIED: codebase pattern] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cmdk | kbar | kbar has more features but cmdk already in stack |
| googleapis | @google-cloud/local-auth | More complex, we already have OAuth patterns |
| BullMQ polling | Revolut webhooks | Webhooks more real-time but less reliable per docs |

**Installation:**
```bash
# All packages already installed - no new dependencies required
```

## Architecture Patterns

### System Architecture Diagram

```
                                    Payment Ingestion Layer
                                    =======================
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │ Stripe Webhooks │    │ Revolut Polling │    │ Manual Entry/CSV│
    │   (real-time)   │    │  (15 min cron)  │    │   (user input)  │
    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
             │                      │                      │
             ▼                      ▼                      ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     PaymentIngestionService                      │
    │  • Normalize to PaymentEntity                                   │
    │  • Calculate provider_fee, net_amount                           │
    │  • Fire PaymentReceived event                                   │
    └───────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                      AutoMatchEngine                             │
    │  Priority Cascade:                                               │
    │  1. Invoice # in memo → 100%                                    │
    │  2. Exact amount + client email → 95%                           │
    │  3. Exact amount + date ±7 days → 85%                           │
    │  4. Fuzzy amount (±€0.50) + client name → 70%                   │
    │  5. No match → 0% (review queue)                                │
    └────────────────────────┬────────────────────────────────────────┘
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │  AUTO-MATCHED   │             │  REVIEW QUEUE   │
    │  (>90% conf)    │             │  (<90% conf)    │
    │  • Auto-allocate│             │  • Show in UI   │
    │  • Log activity │             │  • Suggest match│
    └─────────────────┘             │  • One-click    │
                                    └─────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                      Payment Allocation                          │
    │  • Split payments across multiple invoices                       │
    │  • Partial payment tracking (invoice stays open with balance)    │
    │  • Overpayment → auto-credit to client_credits                   │
    │  • Cross-platform linking via payment_groups                     │
    └─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── db/
│   ├── payment-schema.ts         # payments, payment_allocations, client_credits
│   ├── payment-group-schema.ts   # payment_groups, payment_group_members
│   ├── content-library-schema.ts # content_blocks, block_usage
│   └── document-schema.ts        # documents, document_sections, section_analytics
├── server/
│   ├── features/
│   │   ├── payments/
│   │   │   ├── services/
│   │   │   │   ├── PaymentIngestionService.ts
│   │   │   │   ├── AutoMatchEngine.ts
│   │   │   │   ├── PaymentAllocationService.ts
│   │   │   │   └── PaymentReviewService.ts
│   │   │   ├── repositories/
│   │   │   │   ├── PaymentRepository.ts
│   │   │   │   └── PaymentGroupRepository.ts
│   │   │   └── workers/
│   │   │       └── revolut-polling-processor.ts
│   │   ├── documents/
│   │   │   ├── services/
│   │   │   │   ├── DocumentService.ts
│   │   │   │   ├── GoogleDriveService.ts
│   │   │   │   └── ContentLibraryService.ts
│   │   │   └── repositories/
│   │   │       └── ContentBlockRepository.ts
│   │   └── deals/
│   │       └── services/
│   │           ├── QuickCaptureService.ts
│   │           └── DealEntryService.ts
│   └── workers/
│       └── revolut-polling-worker.ts
└── routes/
    └── api/
        ├── payments/
        │   ├── ingest.ts
        │   ├── match.ts
        │   └── review.ts
        └── webhooks/
            └── stripe.ts  # Extend existing
```

### Pattern 1: Payment Reconciliation with Confidence Scoring
**What:** Auto-match incoming payments to invoices using a priority cascade with confidence scores
**When to use:** Every payment ingestion (webhook, poll, manual entry)
**Example:**
```typescript
// Source: D-02 from CONTEXT.md, Stripe webhook best practices
interface MatchResult {
  invoiceId: string | null;
  confidence: number; // 0-100
  matchType: 'invoice_memo' | 'exact_amount_email' | 'exact_amount_date' | 'fuzzy_amount_name' | 'none';
  suggestedInvoices?: Array<{ id: string; confidence: number }>;
}

async function autoMatch(payment: NormalizedPayment): Promise<MatchResult> {
  // Priority 1: Invoice number in memo (100% confidence)
  const invoiceFromMemo = await findInvoiceByMemo(payment.memo);
  if (invoiceFromMemo) {
    return { invoiceId: invoiceFromMemo.id, confidence: 100, matchType: 'invoice_memo' };
  }

  // Priority 2: Exact amount + client email (95% confidence)
  const byAmountAndEmail = await findInvoiceByAmountAndEmail(
    payment.grossAmountCents,
    payment.payerEmail
  );
  if (byAmountAndEmail) {
    return { invoiceId: byAmountAndEmail.id, confidence: 95, matchType: 'exact_amount_email' };
  }

  // Priority 3: Exact amount + date within 7 days (85% confidence)
  const byAmountAndDate = await findInvoiceByAmountAndDateRange(
    payment.grossAmountCents,
    payment.receivedAt,
    7 // days
  );
  if (byAmountAndDate) {
    return { invoiceId: byAmountAndDate.id, confidence: 85, matchType: 'exact_amount_date' };
  }

  // Priority 4: Fuzzy amount + client name (70% confidence)
  const fuzzyMatch = await findInvoiceByFuzzyAmountAndName(
    payment.grossAmountCents,
    50, // +-EUR0.50 = 50 cents tolerance
    payment.payerName
  );
  if (fuzzyMatch) {
    return { invoiceId: fuzzyMatch.id, confidence: 70, matchType: 'fuzzy_amount_name' };
  }

  // No match - suggest candidates for review queue
  const suggestions = await findSuggestedMatches(payment);
  return { invoiceId: null, confidence: 0, matchType: 'none', suggestedInvoices: suggestions };
}
```

### Pattern 2: Command Palette with Context-Aware Groups
**What:** Global Cmd+K palette that shows different command groups based on current view/selection
**When to use:** Any view that needs quick actions
**Example:**
```typescript
// Source: cmdk documentation, UI-SPEC Command Palette section
// Extends existing @tevero/ui Command component

interface CommandContext {
  currentView: 'pipeline' | 'deal-detail' | 'payment-review' | 'documents';
  selectedDealId?: string;
  selectedDealStage?: PipelineStage;
}

function getCommandGroups(context: CommandContext): CommandGroup[] {
  const baseGroups: CommandGroup[] = [
    {
      heading: 'Quick Actions',
      items: [
        { label: 'New deal', shortcut: 'N', action: 'new-deal' },
        { label: 'Search deals...', shortcut: '/', action: 'search' },
      ],
    },
  ];

  if (context.currentView === 'pipeline') {
    baseGroups.push({
      heading: 'Pipeline',
      items: [
        { label: 'Quick capture', shortcut: 'Shift+N', action: 'quick-capture' },
        { label: 'Record payment', shortcut: 'P', action: 'record-payment' },
        { label: 'Close deal', shortcut: 'C', action: 'close-deal' },
      ],
    });
  }

  if (context.currentView === 'deal-detail' && context.selectedDealId) {
    const stageActions = getStageSpecificActions(context.selectedDealStage);
    baseGroups.push({
      heading: 'Deal Actions',
      items: stageActions,
    });
  }

  return baseGroups;
}
```

### Pattern 3: Entity Chain Creation for Manual Deals
**What:** When inserting a deal at a later stage, auto-create upstream entities
**When to use:** Quick capture or full entry at stage "signed" or later
**Example:**
```typescript
// Source: D-01 Entity Chain Creation from CONTEXT.md
async function createDealAtStage(
  input: QuickCaptureInput,
  targetStage: PipelineStage
): Promise<{ prospectId: string; proposalId?: string; contractId?: string }> {
  const result: { prospectId: string; proposalId?: string; contractId?: string } = {
    prospectId: '',
  };

  // Always create prospect
  const prospect = await ProspectRepository.create({
    domain: input.domain,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
    pipelineStage: targetStage,
    workspaceId: input.workspaceId,
  });
  result.prospectId = prospect.id;

  // Create upstream entities if inserting at later stage
  if (['signed', 'paid', 'onboarded'].includes(targetStage)) {
    // Create proposal stub (status = accepted)
    const proposal = await ProposalRepository.create({
      prospectId: prospect.id,
      workspaceId: input.workspaceId,
      status: 'accepted',
      template: 'standard',
      content: createMinimalProposalContent(input),
      token: generateToken(),
    });
    result.proposalId = proposal.id;

    // Create contract if signed or beyond
    if (['signed', 'paid', 'onboarded'].includes(targetStage)) {
      const contract = await ContractRepository.create({
        proposalId: proposal.id,
        workspaceId: input.workspaceId,
        status: targetStage === 'signed' ? 'signed' : 'executed',
        title: `Contract - ${input.domain}`,
        content: createMinimalContractContent(input),
      });
      result.contractId = contract.id;
    }
  }

  // Log activity
  await ActivityRepository.create({
    entityType: 'prospect',
    entityId: prospect.id,
    activityType: 'created',
    activityData: {
      source: 'manual_entry',
      insertedAtStage: targetStage,
      chainCreated: Object.keys(result).filter(k => result[k as keyof typeof result]),
    },
    workspaceId: input.workspaceId,
  });

  return result;
}
```

### Anti-Patterns to Avoid
- **Don't poll Stripe:** Use webhooks exclusively for Stripe - they're reliable and real-time [CITED: docs.stripe.com/webhooks]
- **Don't trust redirect callbacks:** Never fulfill orders based on redirect URL - use webhooks [CITED: docs.stripe.com/payments]
- **Don't skip signature verification:** Both Stripe and Revolut webhooks must verify signatures before processing
- **Don't expose server IP for scraping:** Unrelated to this phase but a project constraint

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Command palette search | Fuzzy search algorithm | cmdk's built-in search | cmdk uses command-score library, handles edge cases [CITED: cmdk docs] |
| CSV parsing | Manual string splitting | papaparse | Handles quoted fields, BOM, encoding, edge cases [VERIFIED: Phase 30.5 pattern] |
| OAuth token refresh | Manual expiry tracking | googleapis built-in | Handles refresh 5-10 min before expiry automatically [CITED: Google OAuth docs] |
| Payment signature verification | Manual HMAC | Provider SDK methods | RevolutProvider.verifyWebhook, Stripe SDK verification |
| Webhook idempotency | Manual dedup | processWebhookIdempotently | Already implemented, handles Redis-based deduplication |

**Key insight:** Payment reconciliation looks simple but has edge cases: split payments, partial payments, overpayments, refunds, currency conversion, fee tracking. The auto-match engine handles the happy path but review queue handles all the complexity.

## Common Pitfalls

### Pitfall 1: Webhook Event Ordering
**What goes wrong:** Revolut TransactionStateChanged arrives before TransactionCreated [CITED: developer.revolut.com]
**Why it happens:** If TransactionCreated fails delivery, it's queued for retry while TransactionStateChanged succeeds immediately
**How to avoid:** Process events idempotently, don't assume order, store payment by external_id as primary key
**Warning signs:** "Payment not found" errors when processing state changes

### Pitfall 2: Stripe Webhook Timeout
**What goes wrong:** Handler times out, Stripe retries, duplicate processing [CITED: docs.stripe.com/webhooks]
**Why it happens:** Synchronous email sends, ERP syncs, or slow DB operations inline
**How to avoid:** Verify signature, enqueue to BullMQ, return 200 immediately. Process async.
**Warning signs:** Webhook delivery failures in Stripe dashboard, retries with same event ID

### Pitfall 3: Google OAuth Token Expiry
**What goes wrong:** Access token expires during long-running sync, operation fails partway
**Why it happens:** Google access_token expires in 1 hour (3600s) [CITED: Google OAuth docs]
**How to avoid:** Always use refresh_token flow, refresh 5-10 min before expiry
**Warning signs:** 401 errors from Drive API mid-operation

### Pitfall 4: Command Palette Key Conflicts
**What goes wrong:** Cmd+K conflicts with browser's URL bar focus (Firefox), Cmd+N conflicts with new window
**Why it happens:** Platform-specific key handling differences
**How to avoid:** Use event.preventDefault(), check platform via navigator.platform, provide alternative shortcuts
**Warning signs:** Hotkey works in dev but not production, works on macOS but not Windows

### Pitfall 5: Split Payment Allocation Order
**What goes wrong:** Allocating to newest invoice first leaves oldest unpaid, triggers overdue alerts
**Why it happens:** Natural tendency to match most recent activity
**How to avoid:** Sort invoices by dueAt ASC before allocation, pay oldest first
**Warning signs:** Old invoices stuck at "partial" while new ones marked "paid"

## Code Examples

### Payment Schema Definition
```typescript
// Source: D-02 from CONTEXT.md, existing Drizzle patterns
import { pgTable, text, integer, timestamp, jsonb, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { softDeleteColumns } from "./soft-delete-columns";
import { organization } from "./user-schema";
import { invoices } from "./invoice-schema";
import { clients } from "./client-schema";

export const PAYMENT_PROVIDERS = ["stripe", "revolut", "bank_transfer", "cash", "other"] as const;
export type PaymentProviderType = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUS = ["pending", "matched", "allocated", "review", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // External reference for idempotency
    provider: text("provider").notNull(),
    externalId: text("external_id"), // stripe_payment_intent_id, revolut_order_id, etc.

    // Amount breakdown (all in cents)
    grossAmountCents: integer("gross_amount_cents").notNull(),
    providerFeeCents: integer("provider_fee_cents").default(0),
    netAmountCents: integer("net_amount_cents").notNull(),
    currency: text("currency").default("EUR"),

    // Payer info for matching
    payerReference: text("payer_reference"), // What appears on bank statement
    payerEmail: text("payer_email"),
    payerName: text("payer_name"),
    memo: text("memo"), // Transaction description/memo field

    // Matching
    matchedInvoiceId: text("matched_invoice_id").references(() => invoices.id),
    confidence: integer("confidence"), // 0-100
    matchType: text("match_type"),
    status: text("status").notNull().default("pending"),

    // Timestamps
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Soft delete for audit trail (7-year retention)
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_payments_workspace").on(table.workspaceId),
    index("ix_payments_external").on(table.provider, table.externalId),
    index("ix_payments_status").on(table.status),
    index("ix_payments_matched_invoice").on(table.matchedInvoiceId),
    check("chk_payment_provider_valid", sql`provider IN ('stripe', 'revolut', 'bank_transfer', 'cash', 'other')`),
    check("chk_payment_status_valid", sql`status IN ('pending', 'matched', 'allocated', 'review', 'failed')`),
  ]
);

// Split payment allocations
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    allocatedCents: integer("allocated_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_allocations_payment").on(table.paymentId),
    index("ix_allocations_invoice").on(table.invoiceId),
  ]
);

// Client credits (overpayments, prepayments)
export const clientCredits = pgTable(
  "client_credits",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id),
    sourcePaymentId: text("source_payment_id").references(() => payments.id),
    amountCents: integer("amount_cents").notNull(),
    usedCents: integer("used_cents").default(0),
    currency: text("currency").default("EUR"),
    reason: text("reason"), // 'overpayment', 'prepayment', 'refund_credit'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_credits_workspace").on(table.workspaceId),
    index("ix_credits_client").on(table.clientId),
  ]
);
```

### Revolut Polling Worker
```typescript
// Source: Existing BullMQ patterns from auto-revert-worker.ts, D-02 polling requirement
import { Worker, Queue } from 'bullmq';
import { getSharedBullMQConnection } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/logger';
import { PaymentIngestionService } from '@/server/features/payments/services/PaymentIngestionService';
import { RevolutProvider } from '@/server/features/payments/providers/RevolutProvider';

const log = createLogger({ module: 'revolut-polling-worker' });

const QUEUE_NAME = 'revolut-polling';
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes per D-02

interface RevolutPollingJobData {
  workspaceId: string;
}

interface RevolutPollingJobResult {
  transactionsFound: number;
  newPayments: number;
  errors: string[];
}

let queue: Queue<RevolutPollingJobData, RevolutPollingJobResult> | null = null;
let worker: Worker<RevolutPollingJobData, RevolutPollingJobResult> | null = null;

export function getRevolutPollingQueue() {
  if (!queue) {
    queue = new Queue<RevolutPollingJobData, RevolutPollingJobResult>(QUEUE_NAME, {
      connection: getSharedBullMQConnection('queue:revolut-polling'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function scheduleRevolutPolling(workspaceId: string) {
  const q = getRevolutPollingQueue();
  await q.add(
    'poll',
    { workspaceId },
    {
      repeat: { every: POLL_INTERVAL_MS },
      jobId: `revolut-poll-${workspaceId}`,
    }
  );
}

export async function startRevolutPollingWorker() {
  if (worker) return worker;

  worker = new Worker<RevolutPollingJobData, RevolutPollingJobResult>(
    QUEUE_NAME,
    async (job) => {
      const { workspaceId } = job.data;
      const result: RevolutPollingJobResult = { transactionsFound: 0, newPayments: 0, errors: [] };

      try {
        // Get Revolut provider for workspace
        const provider = await PaymentProviderFactory.getProvider({
          workspaceId,
          preferredProvider: 'revolut',
        });

        if (!(provider instanceof RevolutProvider)) {
          log.warn('Revolut not configured for workspace', { workspaceId });
          return result;
        }

        // Fetch recent transactions (last 24 hours to handle any missed webhooks)
        const transactions = await provider.getRecentTransactions({ hours: 24 });
        result.transactionsFound = transactions.length;

        // Ingest each transaction
        for (const tx of transactions) {
          try {
            const isNew = await PaymentIngestionService.ingestFromRevolut(tx, workspaceId);
            if (isNew) result.newPayments++;
          } catch (err) {
            result.errors.push(`${tx.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        log.info('Revolut polling complete', { workspaceId, ...result });
        return result;
      } catch (err) {
        log.error('Revolut polling failed', { workspaceId, error: err });
        throw err;
      }
    },
    {
      connection: getSharedBullMQConnection('worker:revolut-polling'),
      concurrency: 5, // Multiple workspaces can poll concurrently
      lockDuration: 5 * 60 * 1000, // 5 min lock
    }
  );

  return worker;
}
```

### Content Library Schema
```typescript
// Source: D-04 Content Library from CONTEXT.md
export const CONTENT_BLOCK_CATEGORIES = [
  "case_study",
  "testimonial",
  "pricing_table",
  "legal_clause",
  "team_bio",
  "methodology",
  "faq",
  "custom",
] as const;
export type ContentBlockCategory = (typeof CONTENT_BLOCK_CATEGORIES)[number];

export const contentBlocks = pgTable(
  "content_blocks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Block metadata
    name: text("name").notNull(),
    category: text("category").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Localized content
    content: text("content").notNull(),
    contentEn: text("content_en"),
    contentLt: text("content_lt"),

    // Usage tracking
    usageCount: integer("usage_count").default(0),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),

    // Soft delete
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_content_blocks_workspace").on(table.workspaceId),
    index("ix_content_blocks_category").on(table.category),
    check(
      "chk_content_block_category",
      sql`category IN ('case_study', 'testimonial', 'pricing_table', 'legal_clause', 'team_bio', 'methodology', 'faq', 'custom')`
    ),
  ]
);

// Track block usage in proposals/documents
export const blockUsage = pgTable(
  "block_usage",
  {
    id: text("id").primaryKey(),
    blockId: text("block_id")
      .notNull()
      .references(() => contentBlocks.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // 'proposal', 'contract', 'document'
    entityId: text("entity_id").notNull(),
    insertedAt: timestamp("inserted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    insertedBy: text("inserted_by"),
  },
  (table) => [
    index("ix_block_usage_block").on(table.blockId),
    index("ix_block_usage_entity").on(table.entityType, table.entityId),
  ]
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling all payment providers | Webhooks (Stripe) + selective polling (Revolut) | 2024 | Real-time updates, reduced API calls |
| Manual reconciliation | AI-assisted auto-matching with confidence scores | 2025 | 80%+ automatic matching in modern systems |
| Keyboard shortcuts everywhere | Command palette (Cmd+K) | 2023 | Linear/Superhuman pattern is now expected |
| Simple view tracking | Section-level time tracking + scroll depth | 2025 | PandaDoc/DocSend standard |

**Deprecated/outdated:**
- Revolut API v1 webhooks: Use v2 webhooks for better event coverage [CITED: developer.revolut.com/docs/business/webhooks-v-2]
- Google OAuth2 without offline refresh: Always request offline access for background sync

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 90% confidence threshold is correct for auto-matching | Auto-Match Engine | May auto-allocate incorrectly or flood review queue |
| A2 | 15-minute polling interval is sufficient for Revolut | Revolut Polling | May miss time-sensitive payment notifications |
| A3 | Content library categories match agency workflow | Content Library Schema | May need additional categories |

## Open Questions

1. **Audit Trail Retention Period**
   - What we know: D-02 specifies 7-year retention for payments (legal requirement)
   - What's unclear: Does this apply to all activity logs or just payment records?
   - Recommendation: Apply 7-year retention to payments, payment_allocations, client_credits; standard retention for other entities

2. **Google Drive Folder Structure**
   - What we know: D-04 says "Drive link maintained" and "folder structure respected"
   - What's unclear: Should we create a TeveroSEO folder in user's Drive, or use existing structure?
   - Recommendation: Create workspace-level folder, mirror client folder structure

3. **Cross-Platform Payment Linking**
   - What we know: payment_groups table links payments across providers
   - What's unclear: What's the user workflow for creating a group? Auto-detect or manual?
   - Recommendation: Auto-suggest when same client pays via different providers within 48 hours

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All schemas | Yes | 15+ | -- |
| Redis | BullMQ, caching | Yes | 7+ | -- |
| googleapis | Google Drive | Yes | 171.4.0 | -- |
| cmdk | Command palette | Yes | 1.1.1 | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x |
| Config file | vitest.config.ts |
| Quick run command | `pnpm test:unit` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PM-01 | Payment ingestion normalizes across providers | unit | `pnpm vitest run src/server/features/payments/services/PaymentIngestionService.test.ts` | Wave 0 |
| PM-02 | Auto-match returns correct confidence for each match type | unit | `pnpm vitest run src/server/features/payments/services/AutoMatchEngine.test.ts` | Wave 0 |
| PM-03 | Split payments allocate correctly | unit | `pnpm vitest run src/server/features/payments/services/PaymentAllocationService.test.ts` | Wave 0 |
| PM-04 | Overpayments create client credits | unit | `pnpm vitest run src/server/features/payments/services/PaymentAllocationService.test.ts` | Wave 0 |
| CMD-01 | Command palette shows context-aware groups | integration | `pnpm vitest run src/components/command-palette/CommandPalette.test.tsx` | Wave 0 |
| QC-01 | Quick capture creates entity chain for later stages | unit | `pnpm vitest run src/server/features/deals/services/QuickCaptureService.test.ts` | Wave 0 |
| DOC-01 | Content library CRUD operations | unit | `pnpm vitest run src/server/features/documents/services/ContentLibraryService.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --changed`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/server/features/payments/services/PaymentIngestionService.test.ts` - covers PM-01
- [ ] `src/server/features/payments/services/AutoMatchEngine.test.ts` - covers PM-02
- [ ] `src/server/features/payments/services/PaymentAllocationService.test.ts` - covers PM-03, PM-04
- [ ] `src/server/features/deals/services/QuickCaptureService.test.ts` - covers QC-01
- [ ] `src/server/features/documents/services/ContentLibraryService.test.ts` - covers DOC-01

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Clerk (existing) |
| V3 Session Management | Yes | Clerk (existing) |
| V4 Access Control | Yes | Workspace scoping via workspaceId FK |
| V5 Input Validation | Yes | Zod schemas for all API inputs |
| V6 Cryptography | Yes | AES-256-GCM for payment credentials (existing) |

### Known Threat Patterns for Payment Systems

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook spoofing | Spoofing | Signature verification (RevolutProvider.verifyWebhook, Stripe SDK) |
| Payment replay attacks | Tampering | Idempotency via processWebhookIdempotently + external_id uniqueness |
| Unauthorized allocation | Elevation | Workspace-scoped queries, optimistic locking version field |
| CSV injection | Tampering | papaparse sanitization, formula injection prevention |
| OAuth token theft | Info Disclosure | Encrypted storage (PAYMENT_ENCRYPTION_KEY), refresh token rotation |

## Sources

### Primary (HIGH confidence)
- [cmdk npm] - v1.1.1 verified in apps/web/package.json
- [googleapis npm] - v171.4.0 verified in open-seo-main/package.json
- [open-seo-main/src/db/proposal-schema.ts] - Proposal lifecycle patterns
- [open-seo-main/src/db/invoice-schema.ts] - Invoice schema patterns
- [open-seo-main/src/server/features/payments/PaymentProviderFactory.ts] - Multi-provider pattern
- [open-seo-main/src/db/activity-schema.ts] - Polymorphic activity logging

### Secondary (MEDIUM confidence)
- [Stripe Webhook Docs](https://docs.stripe.com/webhooks) - Webhook best practices
- [Revolut Business API Docs](https://developer.revolut.com/docs/business/business-api) - API integration patterns
- [Google Drive API Quickstart](https://developers.google.com/workspace/drive/api/quickstart/nodejs) - OAuth flow

### Tertiary (LOW confidence)
- None - all critical claims verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already in use, versions verified
- Architecture: HIGH - extends existing patterns (PaymentProviderFactory, activity logging)
- Pitfalls: HIGH - documented from official sources (Stripe, Revolut, Google)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days - stable domain)
