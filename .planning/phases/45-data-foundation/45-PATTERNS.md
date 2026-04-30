# Phase 45: Data Foundation - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 12 (4 schema + 4 repository + 4 validation)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/contract-schema.ts` | schema | state-machine | `src/db/proposal-schema.ts` | exact |
| `src/db/invoice-schema.ts` | schema | CRUD + Stripe | `src/db/proposal-schema.ts` | exact |
| `src/db/onboarding-schema.ts` | schema | JSONB-items | `src/db/dashboard-schema.ts` | exact |
| `src/db/activity-schema.ts` | schema | polymorphic-events | `src/db/dashboard-schema.ts` | exact |
| `src/server/features/contracts/repositories/ContractRepository.ts` | repository | CRUD + state | `src/server/features/changes/repositories/ChangeRepository.ts` | exact |
| `src/server/features/contracts/repositories/InvoiceRepository.ts` | repository | CRUD | `src/server/features/changes/repositories/ChangeRepository.ts` | role-match |
| `src/server/features/contracts/repositories/ChecklistRepository.ts` | repository | CRUD | `src/server/features/changes/repositories/ChangeRepository.ts` | role-match |
| `src/server/features/contracts/repositories/ActivityRepository.ts` | repository | CRUD + polymorphic | `src/server/features/changes/repositories/ChangeRepository.ts` | role-match |
| `src/server/features/contracts/validation/contract.schema.ts` | validation | Zod | `src/server/features/goals/types.ts` | exact |
| `src/server/features/contracts/validation/invoice.schema.ts` | validation | Zod | `src/serverFunctions/proposals.ts` | exact |
| `src/server/features/contracts/validation/checklist.schema.ts` | validation | Zod | `src/server/features/goals/types.ts` | exact |
| `src/server/features/contracts/validation/activity.schema.ts` | validation | Zod | `src/server/features/goals/types.ts` | exact |

## Pattern Assignments

### `src/db/contract-schema.ts` (schema, state-machine)

**Analog:** `src/db/proposal-schema.ts`

**Imports pattern** (lines 1-19):
```typescript
import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { proposals } from "./proposal-schema";
import { clients } from "./client-schema";
```

**Status enum pattern** (lines 21-33 from proposal-schema.ts):
```typescript
// Contract status enum values - follows a state machine flow
export const CONTRACT_STATUS = [
  "draft",
  "sent",
  "signed",
  "executed",
  "expired",
  "cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];
```

**Table definition with CHECK constraint** (based on change-schema.ts lines 27-92):
```typescript
export const contracts = pgTable(
  "contracts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }),
    
    // Contract details
    title: text("title").notNull(),
    content: jsonb("content").$type<ContractContent>().notNull(),
    
    // E-signature fields
    dokobitSessionId: text("dokobit_session_id"),
    signedPdfUrl: text("signed_pdf_url"),
    signedAt: timestamp("signed_at", { withTimezone: true, mode: "date" }),
    
    // State
    status: text("status").notNull().default("draft"),
    
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
    index("ix_contracts_client").on(table.clientId),
    index("ix_contracts_status").on(table.status),
    check("chk_contract_status_valid", 
      sql`status IN ('draft', 'sent', 'signed', 'executed', 'expired', 'cancelled')`),
  ],
);
```

**Relations pattern** (lines 249-261 from proposal-schema.ts):
```typescript
export const contractsRelations = relations(contracts, ({ one }) => ({
  workspace: one(organization, {
    fields: [contracts.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [contracts.clientId],
    references: [clients.id],
  }),
}));
```

**Type exports pattern** (lines 291-298 from proposal-schema.ts):
```typescript
export type ContractSelect = typeof contracts.$inferSelect;
export type ContractInsert = typeof contracts.$inferInsert;
```

---

### `src/db/invoice-schema.ts` (schema, CRUD + Stripe)

**Analog:** `src/db/proposal-schema.ts` (proposalPayments table)

**Stripe fields pattern** (lines 217-246 from proposal-schema.ts):
```typescript
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
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").default("EUR"),
    
    // Stripe integration
    stripeInvoiceId: text("stripe_invoice_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePaymentUrl: text("stripe_payment_url"),
    
    // Status
    status: text("status").notNull().default("draft"),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_invoices_workspace").on(table.workspaceId),
    index("ix_invoices_client").on(table.clientId),
    index("ix_invoices_stripe").on(table.stripeInvoiceId),
    check("chk_invoice_status_valid",
      sql`status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')`),
  ],
);
```

**JSONB interface pattern** (lines 47-80 from proposal-schema.ts):
```typescript
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}
```

---

### `src/db/onboarding-schema.ts` (schema, JSONB-items)

**Analog:** `src/db/dashboard-schema.ts`

**JSONB array items pattern** (based on dashboard-schema.ts lines 32-38):
```typescript
export interface ChecklistItem {
  id: string;
  label: string;
  category: "setup" | "credentials" | "kickoff" | "content";
  autoCompleteEvent?: string;  // e.g., "gsc_connected"
  completedAt?: string;
  completedBy?: string;
}

export const onboardingChecklists = pgTable(
  "onboarding_checklists",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    
    // Checklist data
    serviceTier: text("service_tier").notNull(), // 'starter', 'growth', 'enterprise'
    items: jsonb("items").$type<ChecklistItem[]>().notNull(),
    
    // Progress
    completedCount: integer("completed_count").notNull().default(0),
    totalCount: integer("total_count").notNull(),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_checklists_workspace").on(table.workspaceId),
    index("ix_checklists_client").on(table.clientId),
  ],
);
```

---

### `src/db/activity-schema.ts` (schema, polymorphic-events)

**Analog:** `src/db/dashboard-schema.ts` (portfolioActivity table)

**Polymorphic activity pattern** (lines 71-85 from dashboard-schema.ts):
```typescript
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

---

### `src/server/features/contracts/repositories/ContractRepository.ts` (repository, CRUD + state)

**Analog:** `src/server/features/changes/repositories/ChangeRepository.ts`

**Imports pattern** (lines 1-9):
```typescript
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db';
import { contracts, type ContractInsert, type ContractSelect, CONTRACT_STATUS } from '@/db/contract-schema';
```

**Insert function pattern** (lines 14-17):
```typescript
export async function insertContract(contract: ContractInsert): Promise<ContractSelect> {
  const [inserted] = await db.insert(contracts).values(contract).returning();
  return inserted;
}
```

**Get by ID pattern** (lines 30-44):
```typescript
export async function getContractById(
  contractId: string
): Promise<ContractSelect | undefined> {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);
  return contract;
}
```

**State transition with optimistic locking pattern** (based on lines 152-167):
```typescript
export async function transitionContractState(
  contractId: string,
  fromState: ContractStatus,
  toState: ContractStatus,
): Promise<ContractSelect | undefined> {
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
```

**Namespace export pattern** (lines 277-293):
```typescript
export const ContractRepository = {
  insertContract,
  getContractById,
  getContractsByClient,
  getContractsByWorkspace,
  transitionContractState,
  updateContract,
  deleteContract,
};
```

---

### `src/server/features/contracts/repositories/InvoiceRepository.ts` (repository, CRUD)

**Analog:** `src/server/features/changes/repositories/ChangeRepository.ts`

Follow the same patterns as ContractRepository:
- Insert function
- Get by ID
- Get by client/workspace with filters
- Update status
- Namespace export

---

### `src/server/features/contracts/repositories/ChecklistRepository.ts` (repository, CRUD)

**Analog:** `src/server/features/changes/repositories/ChangeRepository.ts`

**Additional pattern for JSONB updates:**
```typescript
export async function updateChecklistItem(
  checklistId: string,
  itemId: string,
  updates: Partial<ChecklistItem>
): Promise<ChecklistSelect | undefined> {
  // Fetch current, update item in array, save back
  const checklist = await getChecklistById(checklistId);
  if (!checklist) return undefined;
  
  const updatedItems = checklist.items.map(item =>
    item.id === itemId ? { ...item, ...updates } : item
  );
  
  const [updated] = await db
    .update(onboardingChecklists)
    .set({ 
      items: updatedItems,
      completedCount: updatedItems.filter(i => i.completedAt).length,
      updatedAt: new Date()
    })
    .where(eq(onboardingChecklists.id, checklistId))
    .returning();
  return updated;
}
```

---

### `src/server/features/contracts/repositories/ActivityRepository.ts` (repository, CRUD + polymorphic)

**Analog:** `src/server/features/changes/repositories/ChangeRepository.ts`

**Polymorphic query pattern:**
```typescript
export async function getActivitiesByEntity(
  entityType: string,
  entityId: string,
  options?: { limit?: number; offset?: number }
): Promise<ActivitySelect[]> {
  return await db
    .select()
    .from(pipelineActivities)
    .where(and(
      eq(pipelineActivities.entityType, entityType),
      eq(pipelineActivities.entityId, entityId)
    ))
    .orderBy(desc(pipelineActivities.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}
```

---

### `src/server/features/contracts/validation/contract.schema.ts` (validation, Zod)

**Analog:** `src/server/features/goals/types.ts`

**Imports and schema pattern** (lines 1-16):
```typescript
import { z } from "zod";
import { CONTRACT_STATUS } from "@/db/contract-schema";

export const createContractSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(500),
  content: z.object({
    sections: z.array(z.object({
      title: z.string(),
      body: z.string(),
    })),
    terms: z.string(),
  }),
  expiresAt: z.string().datetime().optional(),
});

export const transitionContractSchema = z.object({
  contractId: z.string().min(1),
  toState: z.enum(CONTRACT_STATUS),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type TransitionContractInput = z.infer<typeof transitionContractSchema>;
```

---

### `src/server/features/contracts/validation/invoice.schema.ts` (validation, Zod)

**Analog:** `src/serverFunctions/proposals.ts`

**Nested object schema pattern** (lines 21-58 from proposals.ts):
```typescript
import { z } from "zod";
import { INVOICE_STATUS } from "@/db/invoice-schema";

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  contractId: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1),
  dueAt: z.string().datetime().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().min(1),
  status: z.enum(INVOICE_STATUS),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
```

---

### `src/server/features/contracts/validation/checklist.schema.ts` (validation, Zod)

**Analog:** `src/server/features/goals/types.ts`

```typescript
import { z } from "zod";

export const completeChecklistItemSchema = z.object({
  checklistId: z.string().min(1),
  itemId: z.string().min(1),
  completedBy: z.string().optional(),
});

export const createChecklistSchema = z.object({
  clientId: z.string().uuid(),
  serviceTier: z.enum(["starter", "growth", "enterprise"]),
});

export type CompleteChecklistItemInput = z.infer<typeof completeChecklistItemSchema>;
```

---

### `src/server/features/contracts/validation/activity.schema.ts` (validation, Zod)

**Analog:** `src/server/features/goals/types.ts`

```typescript
import { z } from "zod";

export const createActivitySchema = z.object({
  entityType: z.enum(["prospect", "contract", "invoice", "client"]),
  entityId: z.string().min(1),
  activityType: z.string().min(1),
  activityData: z.record(z.unknown()).optional().default({}),
  actorId: z.string().optional(), // null for system events
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
```

---

## Shared Patterns

### ID Generation
**Source:** All schema files use text PKs with nanoid
**Apply to:** All new schema files
```typescript
import { nanoid } from "nanoid";

// When inserting
const id = nanoid();
```

### Workspace Scoping
**Source:** `src/db/client-schema.ts` lines 48-50
**Apply to:** All entity tables
```typescript
workspaceId: text("workspace_id")
  .notNull()
  .references(() => organization.id, { onDelete: "cascade" }),
```

### Client FK (UUID)
**Source:** `src/db/client-schema.ts` line 47
**Apply to:** contracts, invoices, onboarding_checklists
```typescript
// clients.id is UUID, so FK must use uuid()
clientId: uuid("client_id")
  .references(() => clients.id, { onDelete: "set null" }),
```

### CHECK Constraint for Status
**Source:** `src/db/change-schema.ts` lines 89-90
**Apply to:** All status/state fields
```typescript
check("chk_contract_status_valid", 
  sql`status IN ('draft', 'sent', 'signed', 'executed', 'expired', 'cancelled')`),
```

### Timestamp Pattern
**Source:** All schema files
**Apply to:** All tables
```typescript
createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
  .notNull()
  .defaultNow(),
updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
  .notNull()
  .defaultNow(),
```

### Repository Export Pattern
**Source:** `src/server/features/changes/repositories/ChangeRepository.ts` lines 277-293
**Apply to:** All repository files
```typescript
// Export individual functions for tree-shaking
export async function insertEntity(...) { ... }
export async function getEntityById(...) { ... }

// Namespace export for convenience
export const EntityRepository = {
  insertEntity,
  getEntityById,
  // ...
};
```

### Zod Type Export Pattern
**Source:** `src/server/features/goals/types.ts` lines 31-33
**Apply to:** All validation files
```typescript
export const mySchema = z.object({ ... });
export type MyInput = z.infer<typeof mySchema>;
```

---

## No Analog Found

No files without close matches. All 12 files have exact or role-match analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `open-seo-main/src/db/`, `open-seo-main/src/server/features/`
**Files scanned:** 8 analog files read
**Pattern extraction date:** 2026-04-30
