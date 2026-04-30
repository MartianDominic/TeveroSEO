# Phase 45: Data Foundation - Research

**Researched:** 2026-04-30
**Domain:** Database schema design, Drizzle ORM, Zod validation, state machines
**Confidence:** HIGH

## Summary

Phase 45 establishes the database foundation for the agency pipeline: contracts, invoices, onboarding checklists, and pipeline activities. This is a data-layer-only phase with no UI components -- all tables feed into Phases 46-53.

The codebase has well-established patterns: 30+ existing schema files in `open-seo-main/src/db/`, consistent use of pgTable with text IDs (nanoid), JSONB for complex structures, relations via drizzle-orm, and repository layers using exported function collections. The proposal-schema.ts and change-schema.ts provide direct templates for state machine patterns with CHECK constraints.

**Primary recommendation:** Follow existing schema conventions exactly. Use text IDs with nanoid, CHECK constraints for state enums, JSONB for line items and checklist items, and the established repository pattern (exported functions, not classes).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contract schema/state machine | Database | -- | Persistence layer only |
| Invoice schema/Stripe fields | Database | -- | Schema extends existing Stripe patterns |
| Onboarding checklist schema | Database | -- | JSONB items structure |
| Pipeline activity schema | Database | -- | Polymorphic event sourcing |
| Repository CRUD | API/Backend | -- | Data access layer |
| Zod validation schemas | API/Backend | -- | Runtime validation at API boundary |
| State transition helpers | API/Backend | -- | Business logic for valid transitions |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | ORM for PostgreSQL | [VERIFIED: package.json] Already used across 30+ schemas |
| drizzle-kit | 0.31.4 | Migration generation | [VERIFIED: package.json] Established migration workflow |
| zod | 4.3.6 | Schema validation | [VERIFIED: package.json] Used for API validation |
| nanoid | 5.1.9 | ID generation | [VERIFIED: package.json] All text PKs use nanoid |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | 8.20.0 | PostgreSQL driver | [VERIFIED: package.json] Connection pool |
| stripe | 22.0.2 | Payment processing | [VERIFIED: package.json] Invoice webhook integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| text IDs (nanoid) | UUID | Codebase uses text PKs consistently; mixing would create inconsistency |
| JSONB for line items | Separate table | JSONB matches existing patterns (recipients, health_breakdown, snapshot_data) |
| CHECK constraints | Application-only validation | Database-level enforcement is safer; matches existing patterns |

**Installation:**
No new packages required. All dependencies already in place.

## Architecture Patterns

### System Architecture Diagram

```
                    Phase 45 Data Foundation
                    
    [API Routes]                [BullMQ Workers]
         |                            |
         v                            v
    +---------+                  +---------+
    |  Zod    |                  |  Zod    |
    | Schemas |                  | Schemas |
    +---------+                  +---------+
         |                            |
         v                            v
    +----------------------------------------+
    |           Repository Layer              |
    | ContractRepository  InvoiceRepository   |
    | ChecklistRepository ActivityRepository  |
    +----------------------------------------+
         |                            |
         v                            v
    +----------------------------------------+
    |           Drizzle ORM                   |
    | contracts  invoices  onboarding_checklists |
    | pipeline_activities                      |
    +----------------------------------------+
         |
         v
    +----------------------------------------+
    |           PostgreSQL                    |
    | CHECK constraints  JSONB  Relations     |
    +----------------------------------------+
```

### Recommended Project Structure
```
open-seo-main/src/
├── db/
│   ├── contract-schema.ts          # contracts table + state enum
│   ├── invoice-schema.ts           # invoices table + Stripe fields
│   ├── onboarding-schema.ts        # onboarding_checklists table
│   └── activity-schema.ts          # pipeline_activities polymorphic
├── server/features/
│   └── contracts/
│       ├── repositories/
│       │   ├── ContractRepository.ts
│       │   ├── InvoiceRepository.ts
│       │   ├── ChecklistRepository.ts
│       │   └── ActivityRepository.ts
│       └── validation/
│           ├── contract.schema.ts   # Zod schemas
│           ├── invoice.schema.ts
│           ├── checklist.schema.ts
│           └── activity.schema.ts
```

### Pattern 1: State Machine with CHECK Constraint
**What:** Database-enforced state enum with TypeScript const array
**When to use:** Any status/state field with finite valid values
**Example:**
```typescript
// Source: [VERIFIED: open-seo-main/src/db/change-schema.ts:259-266]
export const CONTRACT_STATUS = [
  "draft",
  "sent", 
  "signed",
  "executed",
  "expired",
  "cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

// In table definition:
(table) => [
  check("chk_contract_status_valid", 
    sql`status IN ('draft', 'sent', 'signed', 'executed', 'expired', 'cancelled')`),
]
```

### Pattern 2: JSONB Complex Structures
**What:** Store structured data as JSONB with TypeScript interface
**When to use:** Arrays of items, nested objects, variable-schema data
**Example:**
```typescript
// Source: [VERIFIED: open-seo-main/src/db/dashboard-schema.ts:32-38]
export interface ChecklistItem {
  id: string;
  label: string;
  category: "setup" | "credentials" | "kickoff" | "content";
  autoCompleteEvent?: string;  // e.g., "gsc_connected"
  completedAt?: string;
  completedBy?: string;
}

// In table:
items: jsonb("items").$type<ChecklistItem[]>().notNull(),
```

### Pattern 3: Repository Layer
**What:** Exported functions (not class) for CRUD operations
**When to use:** All database access
**Example:**
```typescript
// Source: [VERIFIED: open-seo-main/src/server/features/changes/repositories/ChangeRepository.ts]
export async function insertContract(contract: ContractInsert): Promise<ContractSelect> {
  const [inserted] = await db.insert(contracts).values(contract).returning();
  return inserted;
}

export async function transitionContractState(
  contractId: string,
  fromState: ContractStatus,
  toState: ContractStatus,
): Promise<ContractSelect | undefined> {
  // Only transition if current state matches expected
  const [updated] = await db
    .update(contracts)
    .set({ status: toState, updatedAt: new Date() })
    .where(and(
      eq(contracts.id, contractId),
      eq(contracts.status, fromState)
    ))
    .returning();
  return updated;
}

export const ContractRepository = {
  insertContract,
  transitionContractState,
  // ... other exports
};
```

### Pattern 4: Polymorphic Activity Feed
**What:** Single table storing multiple event types with discriminator
**When to use:** Activity feeds, audit logs, event sourcing
**Example:**
```typescript
// Source: [VERIFIED: open-seo-main/src/db/dashboard-schema.ts:71-85]
export const pipelineActivities = pgTable(
  "pipeline_activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    entityType: text("entity_type").notNull(), // "prospect", "contract", "invoice"
    entityId: text("entity_id").notNull(),
    activityType: text("activity_type").notNull(), // "created", "status_changed", etc.
    activityData: jsonb("activity_data").$type<Record<string, unknown>>().notNull(),
    actorId: text("actor_id"), // nullable for system events
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_activities_workspace_created").on(table.workspaceId, table.createdAt),
    index("ix_activities_entity").on(table.entityType, table.entityId),
  ],
);
```

### Anti-Patterns to Avoid
- **UUID for new tables when codebase uses text:** Mix of ID types creates confusion. Stick with text + nanoid.
- **Class-based repositories:** Codebase uses function exports with namespace object. Don't introduce class pattern.
- **Computed columns in schema:** Use runtime computation; PostgreSQL computed columns have limited support.
- **Missing CHECK constraints:** All status/state enums must have database-level validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | Custom ID logic | nanoid | [VERIFIED: consistent across codebase] |
| State transitions | Unchecked updates | CHECK constraints + conditional WHERE | Database-level safety |
| Line item structures | Separate normalized tables | JSONB arrays | Matches invoice patterns; simpler queries |
| Timestamp handling | Date strings | timestamp({ withTimezone: true, mode: "date" }) | [VERIFIED: standard pattern] |

**Key insight:** The existing codebase has solved these problems. Copy patterns from proposal-schema.ts (Stripe integration), change-schema.ts (state machines), and schedule-schema.ts (JSONB arrays).

## Common Pitfalls

### Pitfall 1: Forgetting CHECK Constraints for Status Fields
**What goes wrong:** Invalid status values slip into database
**Why it happens:** TypeScript types only enforce at compile time
**How to avoid:** Every status field must have a corresponding CHECK constraint
**Warning signs:** Status field without `check()` in table definition

### Pitfall 2: Inconsistent ID Column Types
**What goes wrong:** clients.id is UUID but contracts.clientId is text
**Why it happens:** clients table uses uuid(), other tables use text()
**How to avoid:** Use UUID for clientId FK columns referencing clients table; text for everything else
**Warning signs:** Type errors in relations or joins

### Pitfall 3: Missing Workspace Scoping
**What goes wrong:** Queries return data from other workspaces
**Why it happens:** Forgetting to add workspaceId to new tables
**How to avoid:** All entity tables must have workspaceId with index
**Warning signs:** Table without workspaceId column

### Pitfall 4: JSONB Without TypeScript Interface
**What goes wrong:** Runtime type errors, no IDE completion
**Why it happens:** Using `jsonb()` without `.$type<Interface>()`
**How to avoid:** Always define interface and use `.$type<T>()`
**Warning signs:** `jsonb("column")` without type annotation

### Pitfall 5: State Transition Without Optimistic Locking
**What goes wrong:** Race condition allows invalid state transitions
**Why it happens:** UPDATE without WHERE on current state
**How to avoid:** Always include current state check in WHERE clause
**Warning signs:** `updateStatus()` without checking fromState

## Code Examples

Verified patterns from official codebase:

### Contract Schema (Template)
```typescript
// Source: [TEMPLATE: based on proposal-schema.ts:22-33]
import {
  pgTable, text, uuid, timestamp, jsonb, index, check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { proposals } from "./proposal-schema";
import { clients } from "./client-schema";

export const CONTRACT_STATUS = [
  "draft",
  "sent",
  "signed",
  "executed",
  "expired",
  "cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id")
      .references(() => proposals.id, { onDelete: "set null" }),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }),
    
    // Contract details
    title: text("title").notNull(),
    content: jsonb("content").$type<ContractContent>().notNull(),
    
    // E-signature (Dokobit)
    dokobitSessionId: text("dokobit_session_id"),
    signedPdfUrl: text("signed_pdf_url"),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    signerName: text("signer_name"),
    
    // State
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    executedAt: timestamp("executed_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_contracts_workspace").on(table.workspaceId),
    index("ix_contracts_proposal").on(table.proposalId),
    index("ix_contracts_client").on(table.clientId),
    index("ix_contracts_status").on(table.status),
    check("chk_contract_status_valid", 
      sql`status IN ('draft', 'sent', 'signed', 'executed', 'expired', 'cancelled')`),
  ],
);
```

### Invoice Schema (Template with Stripe Fields)
```typescript
// Source: [TEMPLATE: based on proposal-schema.ts:217-246 and payment.ts]
export const INVOICE_STATUS = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: text("contract_id")
      .references(() => contracts.id, { onDelete: "set null" }),
    
    // Invoice details
    invoiceNumber: text("invoice_number").notNull(),
    lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").default("EUR"),
    
    // Stripe integration
    stripeInvoiceId: text("stripe_invoice_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePaymentUrl: text("stripe_payment_url"),
    
    // Status
    status: text("status").notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_invoices_workspace").on(table.workspaceId),
    index("ix_invoices_client").on(table.clientId),
    index("ix_invoices_contract").on(table.contractId),
    index("ix_invoices_status").on(table.status),
    index("ix_invoices_stripe").on(table.stripeInvoiceId),
    check("chk_invoice_status_valid",
      sql`status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')`),
  ],
);
```

### Zod Schema Pattern
```typescript
// Source: [TEMPLATE: based on existing Zod patterns in codebase]
import { z } from "zod";
import { CONTRACT_STATUS } from "@/db/contract-schema";

export const createContractSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  content: z.object({
    sections: z.array(z.object({
      title: z.string(),
      body: z.string(),
    })),
    terms: z.string(),
    signatures: z.array(z.object({
      role: z.string(),
      name: z.string().optional(),
    })),
  }),
  expiresAt: z.string().datetime().optional(),
});

export const transitionContractSchema = z.object({
  contractId: z.string(),
  toState: z.enum(CONTRACT_STATUS),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type TransitionContractInput = z.infer<typeof transitionContractSchema>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgEnum for status | CHECK constraint + TypeScript const | Drizzle 0.30+ | Simpler migrations; CHECK is more flexible |
| Class repositories | Function exports | Established pattern | Matches existing codebase; tree-shakeable |
| Separate line items table | JSONB arrays | N/A | Simpler queries; atomic updates |

**Deprecated/outdated:**
- `pgEnum()`: Still works but CHECK constraints are simpler for string enums in this codebase

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migration number starts at 0039 | Standard Stack | Low - easy to renumber if conflicts |
| A2 | Dokobit is e-signature provider | Code Examples | Medium - contract schema fields may need adjustment |
| A3 | Invoices use existing Stripe patterns | Code Examples | Low - existing payment.ts confirms patterns |

## Open Questions

1. **Service tier to checklist item mapping**
   - What we know: Different service tiers (starter/growth/enterprise) need different checklist templates
   - What's unclear: Exact items per tier; should templates be database-seeded or code-defined?
   - Recommendation: Code-defined templates (like industry templates in voice); easier to version control

2. **Invoice numbering scheme**
   - What we know: invoiceNumber field is text
   - What's unclear: Auto-increment? Workspace-scoped sequence? Format (INV-2026-0001)?
   - Recommendation: Use `{workspace_prefix}-{YYYY}-{sequence}` format; sequence table or Redis counter

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies identified) -- Phase is code/schema-only, no external tools required beyond existing PostgreSQL and Drizzle CLI which are already verified working.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | vitest.config.ts (server), vitest.client.config.ts (client) |
| Quick run command | `pnpm test -- --run -t "contract"` |
| Full suite command | `pnpm test:ci` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P45-01 | contracts table with state machine | unit | `pnpm test -- --run src/db/contract-schema.test.ts` | Wave 0 |
| P45-02 | invoices table with Stripe fields | unit | `pnpm test -- --run src/db/invoice-schema.test.ts` | Wave 0 |
| P45-03 | onboarding_checklists with JSONB items | unit | `pnpm test -- --run src/db/onboarding-schema.test.ts` | Wave 0 |
| P45-04 | pipeline_activities polymorphic | unit | `pnpm test -- --run src/db/activity-schema.test.ts` | Wave 0 |
| P45-05 | Repository CRUD + state transitions | integration | `pnpm test -- --run src/server/features/contracts/` | Wave 2 |
| P45-06 | Zod schemas validate correctly | unit | `pnpm test -- --run src/server/features/contracts/validation/` | Wave 2 |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run --reporter=dot`
- **Per wave merge:** `pnpm test:ci`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/db/contract-schema.test.ts` -- covers P45-01
- [ ] `src/db/invoice-schema.test.ts` -- covers P45-02
- [ ] `src/db/onboarding-schema.test.ts` -- covers P45-03
- [ ] `src/db/activity-schema.test.ts` -- covers P45-04

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A - data layer only |
| V3 Session Management | no | N/A - data layer only |
| V4 Access Control | yes | Workspace-scoped queries; repository layer enforces workspaceId |
| V5 Input Validation | yes | Zod schemas for all API inputs |
| V6 Cryptography | no | No encryption in this phase; existing SOPS for secrets |

### Known Threat Patterns for Database Layer

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle ORM parameterized queries (no raw SQL) |
| Cross-workspace data access | Information Disclosure | workspaceId on all tables; repository enforces scoping |
| Invalid state transitions | Tampering | CHECK constraints; conditional UPDATE WHERE |
| Mass assignment | Tampering | Zod schemas whitelist allowed fields |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: package.json] drizzle-orm 0.45.2, zod 4.3.6, stripe 22.0.2
- [VERIFIED: open-seo-main/src/db/] 30+ existing schema files confirming patterns
- [VERIFIED: open-seo-main/src/server/features/changes/repositories/ChangeRepository.ts] Repository pattern
- [VERIFIED: open-seo-main/src/db/proposal-schema.ts] State machine and Stripe patterns

### Secondary (MEDIUM confidence)
- [Context7: /drizzle-team/drizzle-orm-docs] CHECK constraint syntax confirmed
- [Context7: /colinhacks/zod] Discriminated union and enum patterns

### Tertiary (LOW confidence)
- None - all claims verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against package.json and existing schemas
- Architecture: HIGH - patterns directly copied from existing codebase
- Pitfalls: HIGH - derived from real codebase issues (UUID vs text inconsistency)

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable patterns, low churn)
