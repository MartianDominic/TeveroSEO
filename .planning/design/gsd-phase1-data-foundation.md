# GSD Plan: Phase 1 - Data Foundation

> **Purpose**: Establish the data layer that ALL subsequent phases depend on
> **Estimated Duration**: 2-3 days
> **Dependencies**: None (foundation phase)
> **Unblocks**: Phase 2 (UI/Kanban), Phase 3 (Email/Tracking), Phase 4 (Integrations)

---

## Executive Summary

Phase 1 creates the complete database schema, repository layer, and validation schemas for the agency pipeline. This is a **data-only phase** with no UI work. The existing `proposals` table is already robust; we need to add `contracts`, `invoices`, `onboarding_checklists`, and `pipeline_activities` tables plus update the `prospect_status` enum.

### What Already Exists (DO NOT RECREATE)

| Entity | Location | Status |
|--------|----------|--------|
| `prospects` table | `open-seo-main/src/db/prospect-schema.ts` | Complete (has `pipelineStage`) |
| `proposals` table | `open-seo-main/src/db/proposal-schema.ts` | Complete |
| `proposal_views` table | `open-seo-main/src/db/proposal-schema.ts` | Complete |
| `proposal_signatures` table | `open-seo-main/src/db/proposal-schema.ts` | Complete |
| `proposal_payments` table | `open-seo-main/src/db/proposal-schema.ts` | Complete |
| `clients` table | `open-seo-main/src/db/client-schema.ts` | Complete |
| ProposalService | `open-seo-main/src/server/features/proposals/services/` | Complete |
| Onboarding service | `open-seo-main/src/server/features/proposals/onboarding/` | Partial |

### What Needs to Be Built

| Entity | Purpose | Priority |
|--------|---------|----------|
| `contracts` table | E-signature tracking, contract lifecycle | Critical |
| `invoices` table | Stripe invoicing integration | Critical |
| `onboarding_checklists` table | Dynamic checklist items per client | Critical |
| `pipeline_activities` table | Polymorphic activity feed | Critical |
| Updated enums | `contract_state`, `invoice_state` | Critical |
| Repository layer | CRUD + state machines for new tables | High |
| Zod schemas | API validation for new entities | High |

---

## Task Breakdown

### Phase 1.1: Database Schema (Estimated: 4 hours)

#### Task 1.1.1: Create Contract Schema [S]
**File**: `open-seo-main/src/db/contract-schema.ts`

```typescript
// New file with:
// - CONTRACT_STATE enum: ['draft', 'sent', 'client_signed', 'fully_executed', 'expired']
// - contracts table with FK to proposals.id and prospects.id
// - E-signature provider fields (esign_provider, esign_envelope_id)
// - Signature timestamps (client_signed_at, agency_signed_at)
// - Standard audit fields (created_at, updated_at)
```

**Dependencies**: None
**Success Criteria**:
- [ ] Schema file compiles without errors
- [ ] Types exported: `ContractSelect`, `ContractInsert`, `ContractState`
- [ ] Relations defined to proposals and prospects

#### Task 1.1.2: Create Invoice Schema [S]
**File**: `open-seo-main/src/db/invoice-schema.ts`

```typescript
// New file with:
// - INVOICE_STATE enum: ['draft', 'sent', 'viewed', 'paid', 'overdue', 'void']
// - invoices table with FK to prospects.id and contracts.id
// - Stripe fields (stripe_invoice_id, stripe_payment_intent_id)
// - Amount fields in cents (amount_cents, currency)
// - Line items as JSONB
// - Due date and paid_at timestamps
```

**Dependencies**: None
**Success Criteria**:
- [ ] Schema file compiles without errors
- [ ] Types exported: `InvoiceSelect`, `InvoiceInsert`, `InvoiceState`
- [ ] JSONB type for line items properly typed

#### Task 1.1.3: Create Onboarding Checklist Schema [S]
**File**: `open-seo-main/src/db/onboarding-checklist-schema.ts`

> **Source of Truth**: This is the CANONICAL schema definition for `onboarding_checklists`.
> Phase 48 (Onboarding Dashboard) uses this schema - it does NOT redefine it.
> See [v8-agency-pipeline.md](./v8-agency-pipeline.md) for the checklist item structure and tier definitions.

```typescript
// New file with:
// - onboarding_checklists table with FK to clients.id
// - workspace_id for multi-tenancy
// - service_tier: 'starter' | 'growth' | 'enterprise' (determines checklist items)
// - template_version: integer for checklist template versioning
// - items JSONB: [{key, label, category, type, required, serviceTiers, completed, completedAt, completedBy, autoCompleteEvent?, externalLink?, notes?}]
// - Progress tracking fields (total_items, completed_items, progress_pct)
// - started_at, completed_at timestamps
```

**ChecklistItem Interface** (from v8-agency-pipeline.md):
```typescript
interface ChecklistItem {
  key: string;                    // e.g., 'gsc_connected'
  label: string;                  // e.g., 'GSC access granted'
  category: 'account_setup' | 'technical_connections' | 'brand_strategy' | 'initial_deliverables';
  type: 'manual' | 'auto_oauth' | 'auto_system' | 'external';
  required: boolean;
  serviceTiers: ('starter' | 'growth' | 'enterprise')[];
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;     // 'system' | userId
  autoCompleteEvent?: string;     // e.g., 'oauth.gsc.connected'
  externalLink?: string;          // For external action items
  notes?: string;
}
```

**Dependencies**: None
**Success Criteria**:
- [ ] Schema file compiles without errors
- [ ] Types exported: `OnboardingChecklistSelect`, `OnboardingChecklistInsert`
- [ ] ChecklistItem interface properly defined
- [ ] service_tier and template_version columns included

#### Task 1.1.4: Create Pipeline Activities Schema [M]
**File**: `open-seo-main/src/db/pipeline-activities-schema.ts`

> **Source of Truth**: This is the CANONICAL schema definition for `pipeline_activities`.
> Phase 48 (Agency Dashboard) uses this schema - it does NOT redefine it.
> See [v8-agency-pipeline.md](./v8-agency-pipeline.md) for activity action types.

```typescript
// New file with:
// - ENTITY_TYPE enum: ['prospect', 'proposal', 'contract', 'invoice', 'client']
// - ACTOR_TYPE enum: ['system', 'user', 'client', 'webhook']
// - pipeline_activities table with polymorphic entity reference
// - workspace_id for multi-tenancy
// - action field (created, sent, viewed, accepted, signed, paid, etc.)
// - metadata JSONB for context
// - created_at timestamp (no updated_at - activities are immutable)
```

**Activity Actions** (from v8-agency-pipeline.md):
```typescript
const ACTIVITY_ACTIONS = [
  // Prospect actions
  'prospect.created', 'prospect.analyzed', 'prospect.qualified',
  // Proposal actions
  'proposal.created', 'proposal.sent', 'proposal.viewed', 'proposal.accepted', 'proposal.declined',
  // Contract/Payment actions
  'contract.signed', 'payment.received', 'payment.failed',
  // Onboarding actions
  'onboarding.started', 'onboarding.item_completed', 'onboarding.completed',
  // Client actions
  'client.activated', 'client.paused', 'client.churned',
] as const;
```

**Dependencies**: None
**Success Criteria**:
- [ ] Schema file compiles without errors
- [ ] Types exported: `PipelineActivitySelect`, `PipelineActivityInsert`
- [ ] Indexes on (entity_type, entity_id) and created_at DESC
- [ ] workspace_id column included for multi-tenancy

#### Task 1.1.5: Update Schema Barrel Export [S]
**File**: `open-seo-main/src/db/schema.ts`

Add exports:
```typescript
export * from "./contract-schema";
export * from "./invoice-schema";
export * from "./onboarding-checklist-schema";
export * from "./pipeline-activities-schema";
```

**Dependencies**: 1.1.1, 1.1.2, 1.1.3, 1.1.4
**Success Criteria**:
- [ ] All new schemas exported from barrel
- [ ] No circular dependency errors

---

### Phase 1.6: Lead Management Schema (NEW)

**Source:** [v8-agency-pipeline.md](./v8-agency-pipeline.md) Stage 1: Lead

> **Purpose**: Structured lead qualification with 9-item checklist (5 auto, 4 manual), lead source tracking, and qualification decision gate. This section addresses the 20% coverage gap in Lead stage implementation.

#### Tables

##### lead_checklists

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| prospect_id | text | FK to prospects (NOT NULL, UNIQUE) |
| workspace_id | text | FK to organization (NOT NULL) |
| domain_analysis_complete | boolean | AUTO: Domain analysis completed |
| keywords_researched | boolean | AUTO: 50+ keyword opportunities identified |
| competitors_identified | boolean | AUTO: Top 5 competitors identified |
| opportunity_score_calculated | boolean | AUTO: Opportunity score computed |
| lead_source_tagged | boolean | MANUAL: Lead source assigned |
| notes_added | boolean | MANUAL: Contact info and context captured |
| discovery_call_scheduled | boolean | MANUAL: Discovery call booked |
| call_notes_captured | boolean | MANUAL: Call notes recorded |
| qualified_decision | boolean | DECISION GATE: Qualified as opportunity |
| total_items | integer | Always 9 |
| completed_items | integer | Count of completed items (0-9) |
| progress_pct | numeric(5,2) | Completion percentage (0-100) |
| created_at | timestamptz | Record creation time |
| updated_at | timestamptz | Last update time |

**v8 Checklist Mapping:**

| # | v8 Checklist Item | Schema Column | Type |
|---|-------------------|---------------|------|
| 1 | Domain analysis complete | domain_analysis_complete | AUTO |
| 2 | Keywords researched (50+ opportunities) | keywords_researched | AUTO |
| 3 | Competitors identified (top 5) | competitors_identified | AUTO |
| 4 | Opportunity score calculated | opportunity_score_calculated | AUTO |
| 5 | Lead source tagged | lead_source_tagged | MANUAL |
| 6 | Notes added (contact info, context) | notes_added | MANUAL |
| 7 | Discovery call scheduled | discovery_call_scheduled | MANUAL |
| 8 | Call notes captured | call_notes_captured | MANUAL |
| 9 | Qualified as opportunity? (decision gate) | qualified_decision | MANUAL (GATE) |

**Rationale**: Using explicit boolean columns instead of JSONB for:
1. Type safety at the database level
2. Direct SQL queries on individual checklist items
3. Easy indexing for analytics (e.g., "how many leads have discovery calls scheduled?")
4. Simpler repository logic vs. JSONB path operations

#### Columns to Add to prospects Table

| Column | Type | Description |
|--------|------|-------------|
| lead_source | text | Enum: 'website_form', 'referral', 'cold_outreach', 'demo_request' |
| referrer_id | text | FK to users (nullable, set when lead_source = 'referral') |
| qualified_at | timestamptz | Timestamp when qualification gate passed (nullable) |
| qualified_by | text | FK to users who marked lead as qualified (nullable) |
| lead_status | text | Enum: 'new', 'in_qualification', 'qualified', 'disqualified' |
| initial_audit_score | integer | Snapshot of audit score at lead entry (0-100) |
| initial_audit_top_issues | jsonb | Array of top issues from initial audit |
| estimated_monthly_traffic | integer | Estimated monthly traffic from analysis |

#### Task 1.6.1: Migration - Prospects Lead Columns [S]
**File**: `open-seo-main/drizzle/0040_prospects_lead_columns.sql`

```sql
-- Phase 1: Agency Pipeline - Add Lead Management columns to prospects
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "lead_source" text;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "referrer_id" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "qualified_at" timestamp with time zone;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "qualified_by" text REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "lead_status" text DEFAULT 'new';
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "initial_audit_score" integer;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "initial_audit_top_issues" jsonb;
ALTER TABLE "prospects" ADD COLUMN IF NOT EXISTS "estimated_monthly_traffic" integer;

-- Constraints
ALTER TABLE "prospects" ADD CONSTRAINT "chk_lead_source_valid" 
  CHECK (lead_source IS NULL OR lead_source IN ('website_form', 'referral', 'cold_outreach', 'demo_request'));
ALTER TABLE "prospects" ADD CONSTRAINT "chk_lead_status_valid" 
  CHECK (lead_status IN ('new', 'in_qualification', 'qualified', 'disqualified'));

-- Referrer constraint: referrer_id only valid when lead_source = 'referral'
ALTER TABLE "prospects" ADD CONSTRAINT "chk_referrer_requires_referral_source"
  CHECK (referrer_id IS NULL OR lead_source = 'referral');

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_prospects_lead_source" ON "prospects" ("lead_source") WHERE lead_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_prospects_lead_status" ON "prospects" ("lead_status");
CREATE INDEX IF NOT EXISTS "ix_prospects_qualified_at" ON "prospects" ("qualified_at") WHERE qualified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_prospects_referrer" ON "prospects" ("referrer_id") WHERE referrer_id IS NOT NULL;

-- Composite index for lead pipeline queries
CREATE INDEX IF NOT EXISTS "ix_prospects_workspace_lead_status" 
  ON "prospects" ("workspace_id", "lead_status", "created_at" DESC);
```

**Dependencies**: None
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] All columns added to prospects table
- [ ] Constraints validated

#### Task 1.6.2: Migration - Lead Checklists Table [S]
**File**: `open-seo-main/drizzle/0040_lead_checklists_table.sql`

```sql
-- Phase 1: Agency Pipeline - Lead Checklists Table
CREATE TABLE IF NOT EXISTS "lead_checklists" (
  "id" text PRIMARY KEY NOT NULL,
  "prospect_id" text NOT NULL REFERENCES "prospects"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  
  -- AUTO checklist items (system-completed)
  "domain_analysis_complete" boolean NOT NULL DEFAULT false,
  "keywords_researched" boolean NOT NULL DEFAULT false,
  "competitors_identified" boolean NOT NULL DEFAULT false,
  "opportunity_score_calculated" boolean NOT NULL DEFAULT false,
  
  -- MANUAL checklist items (user-completed)
  "lead_source_tagged" boolean NOT NULL DEFAULT false,
  "notes_added" boolean NOT NULL DEFAULT false,
  "discovery_call_scheduled" boolean NOT NULL DEFAULT false,
  "call_notes_captured" boolean NOT NULL DEFAULT false,
  
  -- DECISION GATE (qualification checkpoint)
  "qualified_decision" boolean NOT NULL DEFAULT false,
  
  -- Progress tracking
  "total_items" integer NOT NULL DEFAULT 9,
  "completed_items" integer NOT NULL DEFAULT 0,
  "progress_pct" numeric(5,2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_lead_checklists_prospect" ON "lead_checklists" ("prospect_id");
CREATE INDEX IF NOT EXISTS "ix_lead_checklists_workspace" ON "lead_checklists" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lead_checklists_prospect" ON "lead_checklists" ("prospect_id");

-- Index for checklist items analytics
CREATE INDEX IF NOT EXISTS "ix_lead_checklists_qualified_decision" 
  ON "lead_checklists" ("workspace_id", "qualified_decision") WHERE qualified_decision = true;

-- Constraints
ALTER TABLE "lead_checklists" ADD CONSTRAINT "chk_lead_progress_range" 
  CHECK (progress_pct >= 0 AND progress_pct <= 100);
ALTER TABLE "lead_checklists" ADD CONSTRAINT "chk_lead_completed_items_range" 
  CHECK (completed_items >= 0 AND completed_items <= total_items);
```

**Dependencies**: 1.6.1 (prospects columns must exist)
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] Table created with all 9 boolean checklist columns
- [ ] Unique constraint on prospect_id

#### Task 1.6.3: Create Lead Checklist Schema [S]
**File**: `open-seo-main/src/db/lead-checklist-schema.ts`

```typescript
// New file with:
// - lead_checklists table matching migration
// - 9 boolean columns for checklist items
// - Progress tracking fields
// - Types exported: LeadChecklistSelect, LeadChecklistInsert
```

**Dependencies**: None
**Success Criteria**:
- [ ] Schema file compiles without errors
- [ ] Types exported correctly
- [ ] Relations defined to prospects and organization

#### Services

##### LeadQualificationService

**File**: `open-seo-main/src/server/features/leads/services/LeadQualificationService.ts`

```typescript
interface LeadQualificationService {
  // Checklist operations
  getChecklist(prospectId: string): Promise<LeadChecklist>;
  createChecklist(prospectId: string, workspaceId: string): Promise<LeadChecklist>;
  updateChecklistItem(prospectId: string, item: LeadChecklistItem, completed: boolean): Promise<LeadChecklist>;
  
  // Auto-completion triggers (called by audit/analysis services)
  markDomainAnalysisComplete(prospectId: string): Promise<void>;
  markKeywordsResearched(prospectId: string, count: number): Promise<void>;
  markCompetitorsIdentified(prospectId: string, count: number): Promise<void>;
  markOpportunityScoreCalculated(prospectId: string, score: number): Promise<void>;
  
  // Qualification gate
  checkComplete(prospectId: string): Promise<ChecklistStatus>;
  markQualified(prospectId: string, userId: string): Promise<void>;
  markDisqualified(prospectId: string, userId: string, reason?: string): Promise<void>;
  
  // Lead status transitions
  transitionToInQualification(prospectId: string): Promise<void>;
  
  // Query helpers
  getLeadsReadyForQualification(workspaceId: string): Promise<Prospect[]>;
  getLeadsBySource(workspaceId: string, source: LeadSource): Promise<Prospect[]>;
}

// Types
type LeadChecklistItem = 
  | 'domain_analysis_complete'
  | 'keywords_researched'
  | 'competitors_identified'
  | 'opportunity_score_calculated'
  | 'lead_source_tagged'
  | 'notes_added'
  | 'discovery_call_scheduled'
  | 'call_notes_captured'
  | 'qualified_decision';

type LeadSource = 'website_form' | 'referral' | 'cold_outreach' | 'demo_request';

type LeadStatus = 'new' | 'in_qualification' | 'qualified' | 'disqualified';

interface ChecklistStatus {
  complete: boolean;
  totalItems: number;
  completedItems: number;
  progressPct: number;
  missingItems: LeadChecklistItem[];
  autoItems: { item: LeadChecklistItem; completed: boolean }[];
  manualItems: { item: LeadChecklistItem; completed: boolean }[];
}
```

**State Machine Logic:**
```
new --> in_qualification --> qualified
                         \-> disqualified
```

- `new`: Lead just created, no checklist interaction yet
- `in_qualification`: At least one checklist item completed (auto or manual)
- `qualified`: Decision gate checked (qualified_decision = true)
- `disqualified`: Explicitly marked as not qualified

##### LeadChecklistRepository

**File**: `open-seo-main/src/server/features/leads/repositories/LeadChecklistRepository.ts`

```typescript
interface LeadChecklistRepository {
  getByProspectId(prospectId: string): Promise<LeadChecklist | null>;
  create(data: CreateLeadChecklistInput): Promise<LeadChecklist>;
  updateItem(prospectId: string, item: LeadChecklistItem, completed: boolean): Promise<LeadChecklist>;
  updateProgress(prospectId: string): Promise<LeadChecklist>;
  delete(prospectId: string): Promise<void>;
}
```

#### API Routes

```
# Lead listing and filtering
GET    /api/prospects/leads                    # List prospects in lead stage
GET    /api/prospects/leads/by-source/:source  # Filter by lead source
GET    /api/prospects/leads/ready              # Leads ready for qualification decision

# Lead checklist operations
GET    /api/prospects/:id/checklist            # Get lead checklist state
POST   /api/prospects/:id/checklist            # Create checklist for prospect
PATCH  /api/prospects/:id/checklist/:item      # Update single checklist item

# Qualification actions
POST   /api/prospects/:id/qualify              # Mark lead as qualified (decision gate)
POST   /api/prospects/:id/disqualify           # Mark lead as disqualified with reason

# Lead source management
PATCH  /api/prospects/:id/lead-source          # Set lead source and referrer
```

**Route Implementation Notes:**

1. `GET /api/prospects/leads` - Filters `prospects` where `pipelineStage = 'lead'` or `lead_status IN ('new', 'in_qualification')`
2. `POST /api/prospects/:id/qualify` - Sets `qualified_at`, `qualified_by`, `lead_status = 'qualified'`, logs pipeline activity
3. `PATCH /api/prospects/:id/checklist/:item` - Validates item is a valid LeadChecklistItem, updates boolean, recalculates progress

#### UI Components (Phase 44 Reference)

> **Note**: These components will be built in Phase 44 (UI/Kanban). Listed here for planning completeness.

##### LeadCard

**File**: `apps/web/src/components/pipeline/LeadCard.tsx`

```typescript
interface LeadCardProps {
  prospect: Prospect;
  checklist: LeadChecklist;
  onChecklistUpdate: (item: LeadChecklistItem, completed: boolean) => void;
  onQualify: () => void;
}
```

**Visual States (from v8 design):**
- `bg-zinc-100` - New lead (unqualified)
- `bg-amber-50` - In qualification (some items completed)
- `bg-emerald-50` - Qualified, ready for proposal

##### LeadQualificationGate

**File**: `apps/web/src/components/pipeline/LeadQualificationGate.tsx`

Modal that appears when user attempts to mark lead as qualified:
- Shows all checklist items with completion status
- Requires confirmation of `qualified_decision` checkbox
- Displays any missing required items
- "Qualify" and "Cancel" actions

##### LeadListView

**File**: `apps/web/src/components/pipeline/LeadListView.tsx`

Table/list view of leads with:
- Sortable columns: Company, Lead Source, Progress, Created At
- Filterable by lead_source, lead_status
- Bulk actions: Qualify, Disqualify, Export
- Inline checklist progress indicator

##### LeadSourceBadge

**File**: `apps/web/src/components/pipeline/LeadSourceBadge.tsx`

```typescript
// Badge variants per source:
// website_form:   bg-blue-100 text-blue-800
// referral:       bg-purple-100 text-purple-800  
// cold_outreach:  bg-orange-100 text-orange-800
// demo_request:   bg-green-100 text-green-800
```

#### Validation Schemas

**File**: `open-seo-main/src/server/features/leads/validation/lead-schemas.ts`

```typescript
import { z } from 'zod';

export const LEAD_SOURCES = ['website_form', 'referral', 'cold_outreach', 'demo_request'] as const;
export const LEAD_STATUSES = ['new', 'in_qualification', 'qualified', 'disqualified'] as const;
export const LEAD_CHECKLIST_ITEMS = [
  'domain_analysis_complete',
  'keywords_researched',
  'competitors_identified',
  'opportunity_score_calculated',
  'lead_source_tagged',
  'notes_added',
  'discovery_call_scheduled',
  'call_notes_captured',
  'qualified_decision',
] as const;

export const leadSourceSchema = z.enum(LEAD_SOURCES);
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export const leadChecklistItemSchema = z.enum(LEAD_CHECKLIST_ITEMS);

export const updateLeadSourceSchema = z.object({
  leadSource: leadSourceSchema,
  referrerId: z.string().optional(),
}).refine(
  data => data.leadSource !== 'referral' || data.referrerId !== undefined,
  { message: 'referrerId is required when leadSource is referral' }
);

export const updateChecklistItemSchema = z.object({
  item: leadChecklistItemSchema,
  completed: z.boolean(),
});

export const qualifyLeadSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const disqualifyLeadSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type LeadSource = z.infer<typeof leadSourceSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type LeadChecklistItem = z.infer<typeof leadChecklistItemSchema>;
export type UpdateLeadSourceInput = z.infer<typeof updateLeadSourceSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
```

#### Auto-Completion Triggers

The 4 AUTO checklist items are completed by system events:

| Item | Trigger Event | Service |
|------|--------------|---------|
| domain_analysis_complete | Prospect site audit completes | AuditService |
| keywords_researched | KeywordService finds 50+ opportunities | KeywordService |
| competitors_identified | CompetitorService identifies 5+ competitors | CompetitorService |
| opportunity_score_calculated | ScoringService computes opportunity score | OpportunityScoreService |

**Integration Pattern:**
```typescript
// In AuditService after audit completes:
await leadQualificationService.markDomainAnalysisComplete(prospectId);

// In KeywordService after keyword research:
if (keywords.length >= 50) {
  await leadQualificationService.markKeywordsResearched(prospectId, keywords.length);
}
```

#### Estimated Hours for Lead Management

| Task | Est. Hours | Notes |
|------|------------|-------|
| Task 1.6.1: Migration - prospects columns | 0.5h | ALTER TABLE statements |
| Task 1.6.2: Migration - lead_checklists table | 0.5h | CREATE TABLE with indexes |
| Task 1.6.3: Schema - lead-checklist-schema.ts | 1h | Drizzle schema file |
| Task 1.6.4: LeadChecklistRepository | 2h | CRUD + progress calculation |
| Task 1.6.5: LeadQualificationService | 3h | State machine, auto-triggers |
| Task 1.6.6: Validation schemas | 1h | Zod schemas for API |
| Task 1.6.7: API routes | 2h | 6 routes with auth |
| Task 1.6.8: Repository tests | 2h | TDD for repository |
| Task 1.6.9: Service tests | 2h | TDD for service |
| **Total** | **14h** | ~2 days |

---

### Phase 1.2: Database Migrations (Estimated: 2 hours)

#### Task 1.2.1: Create Contracts Migration [S]
**File**: `open-seo-main/drizzle/0039_contracts_table.sql`

```sql
-- Phase 1: Agency Pipeline - Contracts Table
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" text PRIMARY KEY NOT NULL,
  "proposal_id" text REFERENCES "proposals"("id") ON DELETE SET NULL,
  "prospect_id" text REFERENCES "prospects"("id") ON DELETE SET NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "state" text NOT NULL DEFAULT 'draft',
  "template_id" text,
  "document_url" text,
  "esign_provider" text,
  "esign_envelope_id" text,
  "client_signed_at" timestamp with time zone,
  "agency_signed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_contracts_workspace" ON "contracts" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_contracts_prospect" ON "contracts" ("prospect_id");
CREATE INDEX IF NOT EXISTS "ix_contracts_proposal" ON "contracts" ("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_contracts_state" ON "contracts" ("state");

-- Constraint
ALTER TABLE "contracts" ADD CONSTRAINT "chk_contract_state_valid" 
  CHECK (state IN ('draft', 'sent', 'client_signed', 'fully_executed', 'expired'));
```

**Dependencies**: None
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] Table created with all columns
- [ ] Indexes and constraint created

#### Task 1.2.2: Create Invoices Migration [S]
**File**: `open-seo-main/drizzle/0039_invoices_table.sql`

```sql
-- Phase 1: Agency Pipeline - Invoices Table
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" text PRIMARY KEY NOT NULL,
  "prospect_id" text REFERENCES "prospects"("id") ON DELETE SET NULL,
  "contract_id" text REFERENCES "contracts"("id") ON DELETE SET NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "state" text NOT NULL DEFAULT 'draft',
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'EUR',
  "line_items" jsonb,
  "stripe_invoice_id" text,
  "stripe_payment_intent_id" text,
  "invoice_number" text,
  "issued_at" timestamp with time zone,
  "due_date" date,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_invoices_workspace" ON "invoices" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_invoices_prospect" ON "invoices" ("prospect_id");
CREATE INDEX IF NOT EXISTS "ix_invoices_contract" ON "invoices" ("contract_id");
CREATE INDEX IF NOT EXISTS "ix_invoices_state" ON "invoices" ("state");
CREATE INDEX IF NOT EXISTS "ix_invoices_stripe" ON "invoices" ("stripe_invoice_id");

-- Constraint
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoice_state_valid" 
  CHECK (state IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void'));
```

**Dependencies**: 1.2.1 (contracts table must exist first)
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] Table created with all columns
- [ ] Indexes and constraint created

#### Task 1.2.3: Create Onboarding Checklists Migration [S]
**File**: `open-seo-main/drizzle/0039_onboarding_checklists_table.sql`

> **Source of Truth**: This migration defines the CANONICAL `onboarding_checklists` table.
> Phase 48 references this table - schema changes must be made here, not in Phase 48.

```sql
-- Phase 1: Agency Pipeline - Onboarding Checklists Table
-- Source of truth for onboarding_checklists schema. Phase 48 uses this, does not redefine.
CREATE TABLE IF NOT EXISTS "onboarding_checklists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  
  -- Template tracking (added from Phase 48 requirements)
  "service_tier" text NOT NULL DEFAULT 'growth',
  "template_version" integer NOT NULL DEFAULT 1,
  
  -- Checklist items (JSONB for flexibility)
  "items" jsonb NOT NULL DEFAULT '[]',
  
  -- Progress tracking
  "total_items" integer NOT NULL DEFAULT 0,
  "completed_items" integer NOT NULL DEFAULT 0,
  "progress_pct" numeric(5,2) NOT NULL DEFAULT 0,
  
  -- Lifecycle timestamps
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_onboarding_checklists_client" ON "onboarding_checklists" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_onboarding_checklists_workspace" ON "onboarding_checklists" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_onboarding_checklists_client" ON "onboarding_checklists" ("client_id");

-- Constraints
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "chk_progress_range" 
  CHECK (progress_pct >= 0 AND progress_pct <= 100);
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "chk_completed_items_range" 
  CHECK (completed_items >= 0 AND completed_items <= total_items);
ALTER TABLE "onboarding_checklists" ADD CONSTRAINT "chk_service_tier_valid"
  CHECK (service_tier IN ('starter', 'growth', 'enterprise'));
```

**Dependencies**: None
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] Unique constraint on client_id (one checklist per client)
- [ ] Progress constraints working
- [ ] service_tier constraint validated

#### Task 1.2.4: Create Pipeline Activities Migration [M]
**File**: `open-seo-main/drizzle/0039_pipeline_activities_table.sql`

> **Source of Truth**: This migration defines the CANONICAL `pipeline_activities` table.
> Phase 48 references this table - schema changes must be made here, not in Phase 48.

```sql
-- Phase 1: Agency Pipeline - Pipeline Activities Table (Polymorphic Activity Feed)
-- Source of truth for pipeline_activities schema. Phase 48 uses this, does not redefine.
CREATE TABLE IF NOT EXISTS "pipeline_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  
  -- Polymorphic reference
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  
  -- Activity details
  "action" text NOT NULL,
  "actor_type" text,
  "actor_id" text,
  
  -- Context (flexible JSONB for activity-specific data)
  "metadata" jsonb,
  
  -- Timestamp (immutable - no updated_at)
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "ix_activities_workspace" ON "pipeline_activities" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_activities_entity" ON "pipeline_activities" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "ix_activities_created" ON "pipeline_activities" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "ix_activities_actor" ON "pipeline_activities" ("actor_type", "actor_id");
CREATE INDEX IF NOT EXISTS "ix_activities_action" ON "pipeline_activities" ("action");

-- Composite index for common query pattern: workspace + recent activities
CREATE INDEX IF NOT EXISTS "ix_activities_workspace_recent" 
  ON "pipeline_activities" ("workspace_id", "created_at" DESC);

-- Constraints
ALTER TABLE "pipeline_activities" ADD CONSTRAINT "chk_entity_type_valid" 
  CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client'));
ALTER TABLE "pipeline_activities" ADD CONSTRAINT "chk_actor_type_valid" 
  CHECK (actor_type IS NULL OR actor_type IN ('system', 'user', 'client', 'webhook'));
```

**Dependencies**: None
**Success Criteria**:
- [ ] Migration runs without errors
- [ ] All indexes created (including action index)
- [ ] Constraints working

---

### Phase 1.3: Repository Layer (Estimated: 4 hours)

#### Task 1.3.1: Create Contract Repository [M]
**File**: `open-seo-main/src/server/features/contracts/repositories/ContractRepository.ts`

```typescript
// Implement:
// - listContracts(workspaceId, filters?)
// - getContractById(contractId, workspaceId)
// - getContractByProposalId(proposalId)
// - createContract(data)
// - updateContract(contractId, updates)
// - transitionState(contractId, newState) - enforces state machine
// - softDeleteContract(contractId)
```

**State Machine Logic**:
```
draft → sent → client_signed → fully_executed
  ↓                              ↑
  └───────── expired ────────────┘
```

**Dependencies**: 1.1.1, 1.2.1
**Success Criteria**:
- [ ] All CRUD operations working
- [ ] State transitions validated
- [ ] Invalid transitions throw AppError

#### Task 1.3.2: Create Invoice Repository [M]
**File**: `open-seo-main/src/server/features/invoices/repositories/InvoiceRepository.ts`

```typescript
// Implement:
// - listInvoices(workspaceId, filters?)
// - getInvoiceById(invoiceId, workspaceId)
// - getInvoicesByProspect(prospectId)
// - createInvoice(data)
// - updateInvoice(invoiceId, updates)
// - transitionState(invoiceId, newState) - enforces state machine
// - markAsPaid(invoiceId, stripePaymentIntentId)
// - markAsOverdue(invoiceId) - called by cron job
```

**State Machine Logic**:
```
draft → sent → viewed → paid
         ↓       ↓
         └───────┴──→ overdue → void
```

**Dependencies**: 1.1.2, 1.2.2
**Success Criteria**:
- [ ] All CRUD operations working
- [ ] State transitions validated
- [ ] Stripe ID properly tracked

#### Task 1.3.3: Create Onboarding Checklist Repository [M]
**File**: `open-seo-main/src/server/features/onboarding/repositories/OnboardingChecklistRepository.ts`

```typescript
// Implement:
// - getChecklistForClient(clientId)
// - createChecklist(clientId, template?) - uses default template if not provided
// - completeItem(checklistId, itemKey) - updates progress
// - uncompleteItem(checklistId, itemKey) - for undoing
// - updateProgress(checklistId) - recalculates progress_pct
// - isComplete(checklistId) - returns boolean
```

**Default Checklist Template**:

> **Full checklist structure defined in**: [v8-agency-pipeline.md](./v8-agency-pipeline.md) Section "Stage 5: Onboarding"
> Phase 48 extends this with tier-specific templates in `checklist-templates.ts`

```typescript
// Simplified default items - see v8-agency-pipeline.md for full tier-based templates
const DEFAULT_ITEMS = [
  // Account Setup
  { key: 'client_created', label: 'Client record created', category: 'account_setup', type: 'auto_system', auto_completable: true },
  { key: 'keywords_migrated', label: 'Keywords migrated from analysis', category: 'account_setup', type: 'auto_system', auto_completable: true },
  
  // Technical Connections
  { key: 'gsc_connected', label: 'GSC access granted', category: 'technical_connections', type: 'auto_oauth', auto_completable: true },
  { key: 'ga4_connected', label: 'GA4 access granted', category: 'technical_connections', type: 'auto_oauth', auto_completable: true },
  { key: 'cms_connected', label: 'CMS access granted', category: 'technical_connections', type: 'manual', auto_completable: false },
  
  // Brand & Strategy
  { key: 'voice_configured', label: 'Voice profile configured', category: 'brand_strategy', type: 'manual', auto_completable: false },
  { key: 'competitors_confirmed', label: 'Competitor list confirmed', category: 'brand_strategy', type: 'manual', auto_completable: false },
  { key: 'monthly_goal_defined', label: 'Monthly goal defined', category: 'brand_strategy', type: 'manual', auto_completable: false },
  
  // Initial Deliverables
  { key: 'first_audit_complete', label: 'First audit completed', category: 'initial_deliverables', type: 'auto_system', auto_completable: true },
  { key: 'first_content_generated', label: 'First content piece generated', category: 'initial_deliverables', type: 'auto_system', auto_completable: true },
  { key: 'kickoff_scheduled', label: 'Kickoff call scheduled', category: 'initial_deliverables', type: 'external', auto_completable: false },
  { key: 'kickoff_completed', label: 'Kickoff call completed', category: 'initial_deliverables', type: 'manual', auto_completable: false },
];
```

**Dependencies**: 1.1.3, 1.2.3
**Success Criteria**:
- [ ] Checklist created with default items
- [ ] Progress calculation accurate
- [ ] Auto-completable items flagged correctly

#### Task 1.3.4: Create Pipeline Activity Repository [M]
**File**: `open-seo-main/src/server/features/pipeline/repositories/PipelineActivityRepository.ts`

```typescript
// Implement:
// - logActivity(data) - main logging function
// - listActivities(workspaceId, filters?) - pagination, entity type filter
// - getActivitiesForEntity(entityType, entityId) - all activities for one entity
// - getRecentActivities(workspaceId, limit?) - for dashboard feed
// - countActivitiesByType(workspaceId, dateRange?) - for analytics
```

**Helper Functions**:
```typescript
// Convenience wrappers for common activities
export function logProspectActivity(prospectId, action, metadata?, actorId?) {}
export function logProposalActivity(proposalId, action, metadata?, actorId?) {}
export function logContractActivity(contractId, action, metadata?, actorId?) {}
export function logInvoiceActivity(invoiceId, action, metadata?, actorId?) {}
export function logClientActivity(clientId, action, metadata?, actorId?) {}
```

**Dependencies**: 1.1.4, 1.2.4
**Success Criteria**:
- [ ] All logging functions working
- [ ] Pagination working for list queries
- [ ] Activity count analytics accurate

---

### Phase 1.4: Validation Schemas (Estimated: 2 hours)

#### Task 1.4.1: Create Contract Validation Schemas [S]
**File**: `open-seo-main/src/server/features/contracts/validation/contract-schemas.ts`

```typescript
import { z } from 'zod';

export const CONTRACT_STATES = ['draft', 'sent', 'client_signed', 'fully_executed', 'expired'] as const;
export const contractStateSchema = z.enum(CONTRACT_STATES);

export const createContractSchema = z.object({
  proposalId: z.string().min(1),
  prospectId: z.string().min(1),
  templateId: z.string().optional(),
  documentUrl: z.string().url().optional(),
  esignProvider: z.enum(['docusign', 'pandadoc', 'dokobit']).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateContractSchema = z.object({
  state: contractStateSchema.optional(),
  documentUrl: z.string().url().optional(),
  esignEnvelopeId: z.string().optional(),
  clientSignedAt: z.string().datetime().optional(),
  agencySignedAt: z.string().datetime().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
```

**Dependencies**: None
**Success Criteria**:
- [ ] All schemas compile
- [ ] Type exports work
- [ ] State enum matches database constraint

#### Task 1.4.2: Create Invoice Validation Schemas [S]
**File**: `open-seo-main/src/server/features/invoices/validation/invoice-schemas.ts`

```typescript
import { z } from 'zod';

export const INVOICE_STATES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'void'] as const;
export const invoiceStateSchema = z.enum(INVOICE_STATES);

export const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});

export const createInvoiceSchema = z.object({
  prospectId: z.string().min(1),
  contractId: z.string().optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('EUR'),
  lineItems: z.array(lineItemSchema).optional(),
  dueDate: z.string().datetime().optional(),
  invoiceNumber: z.string().max(50).optional(),
});

export const updateInvoiceSchema = z.object({
  state: invoiceStateSchema.optional(),
  stripeInvoiceId: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
  paidAt: z.string().datetime().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
```

**Dependencies**: None
**Success Criteria**:
- [ ] All schemas compile
- [ ] Line items properly validated
- [ ] Currency validates to 3-char ISO code

#### Task 1.4.3: Create Onboarding Validation Schemas [S]
**File**: `open-seo-main/src/server/features/onboarding/validation/checklist-schemas.ts`

```typescript
import { z } from 'zod';

export const CHECKLIST_CATEGORIES = ['account', 'connections', 'brand', 'strategy', 'deliverables'] as const;
export const checklistCategorySchema = z.enum(CHECKLIST_CATEGORIES);

export const checklistItemSchema = z.object({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  category: checklistCategorySchema,
  completed: z.boolean().default(false),
  completedAt: z.string().datetime().nullable().optional(),
  autoCompletable: z.boolean().default(false),
});

export const completeItemSchema = z.object({
  itemKey: z.string().min(1).max(50),
});

export const createChecklistSchema = z.object({
  clientId: z.string().uuid(),
  items: z.array(checklistItemSchema).optional(), // Uses default if not provided
});

export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type CompleteItemInput = z.infer<typeof completeItemSchema>;
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
```

**Dependencies**: None
**Success Criteria**:
- [ ] All schemas compile
- [ ] Category enum matches expected values
- [ ] Item key properly constrained

#### Task 1.4.4: Create Pipeline Activity Validation Schemas [S]
**File**: `open-seo-main/src/server/features/pipeline/validation/activity-schemas.ts`

```typescript
import { z } from 'zod';

export const ENTITY_TYPES = ['prospect', 'proposal', 'contract', 'invoice', 'client'] as const;
export const ACTOR_TYPES = ['system', 'user', 'client', 'webhook'] as const;

export const entityTypeSchema = z.enum(ENTITY_TYPES);
export const actorTypeSchema = z.enum(ACTOR_TYPES);

export const logActivitySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().min(1),
  action: z.string().min(1).max(50),
  actorType: actorTypeSchema.optional(),
  actorId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listActivitiesSchema = z.object({
  entityType: entityTypeSchema.optional(),
  entityId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;
export type ListActivitiesInput = z.infer<typeof listActivitiesSchema>;
```

**Dependencies**: None
**Success Criteria**:
- [ ] All schemas compile
- [ ] Entity types match database constraint
- [ ] Pagination parameters validated

---

### Phase 1.5: Testing (Estimated: 3 hours)

#### Task 1.5.1: Create Contract Repository Tests [M]
**File**: `open-seo-main/src/server/features/contracts/repositories/ContractRepository.test.ts`

Test cases:
- Create contract from proposal
- State transitions (valid and invalid)
- List contracts with filters
- Get by proposal ID

**Dependencies**: 1.3.1
**Success Criteria**:
- [ ] All CRUD operations tested
- [ ] State machine edge cases covered
- [ ] 80%+ coverage

#### Task 1.5.2: Create Invoice Repository Tests [M]
**File**: `open-seo-main/src/server/features/invoices/repositories/InvoiceRepository.test.ts`

Test cases:
- Create invoice
- State transitions (valid and invalid)
- Mark as paid with Stripe ID
- Mark as overdue

**Dependencies**: 1.3.2
**Success Criteria**:
- [ ] All CRUD operations tested
- [ ] State machine edge cases covered
- [ ] 80%+ coverage

#### Task 1.5.3: Create Onboarding Checklist Repository Tests [M]
**File**: `open-seo-main/src/server/features/onboarding/repositories/OnboardingChecklistRepository.test.ts`

Test cases:
- Create checklist with default items
- Complete/uncomplete items
- Progress calculation
- Check completion status

**Dependencies**: 1.3.3
**Success Criteria**:
- [ ] All operations tested
- [ ] Progress math verified
- [ ] 80%+ coverage

#### Task 1.5.4: Create Pipeline Activity Repository Tests [M]
**File**: `open-seo-main/src/server/features/pipeline/repositories/PipelineActivityRepository.test.ts`

Test cases:
- Log activity
- List with pagination
- Filter by entity type
- Get recent activities

**Dependencies**: 1.3.4
**Success Criteria**:
- [ ] All operations tested
- [ ] Pagination verified
- [ ] 80%+ coverage

---

## File Structure Summary

### New Files to Create

```
open-seo-main/
├── src/
│   ├── db/
│   │   ├── contract-schema.ts              # Task 1.1.1
│   │   ├── invoice-schema.ts               # Task 1.1.2
│   │   ├── onboarding-checklist-schema.ts  # Task 1.1.3
│   │   ├── pipeline-activities-schema.ts   # Task 1.1.4
│   │   └── lead-checklist-schema.ts        # Task 1.6.3 (NEW)
│   └── server/
│       └── features/
│           ├── contracts/
│           │   ├── repositories/
│           │   │   ├── ContractRepository.ts       # Task 1.3.1
│           │   │   └── ContractRepository.test.ts  # Task 1.5.1
│           │   └── validation/
│           │       └── contract-schemas.ts         # Task 1.4.1
│           ├── invoices/
│           │   ├── repositories/
│           │   │   ├── InvoiceRepository.ts        # Task 1.3.2
│           │   │   └── InvoiceRepository.test.ts   # Task 1.5.2
│           │   └── validation/
│           │       └── invoice-schemas.ts          # Task 1.4.2
│           ├── onboarding/
│           │   ├── repositories/
│           │   │   ├── OnboardingChecklistRepository.ts       # Task 1.3.3
│           │   │   └── OnboardingChecklistRepository.test.ts  # Task 1.5.3
│           │   └── validation/
│           │       └── checklist-schemas.ts        # Task 1.4.3
│           ├── pipeline/
│           │   ├── repositories/
│           │   │   ├── PipelineActivityRepository.ts       # Task 1.3.4
│           │   │   └── PipelineActivityRepository.test.ts  # Task 1.5.4
│           │   └── validation/
│           │       └── activity-schemas.ts         # Task 1.4.4
│           └── leads/                              # NEW - Lead Management
│               ├── repositories/
│               │   ├── LeadChecklistRepository.ts       # Task 1.6.4
│               │   └── LeadChecklistRepository.test.ts  # Task 1.6.8
│               ├── services/
│               │   ├── LeadQualificationService.ts      # Task 1.6.5
│               │   └── LeadQualificationService.test.ts # Task 1.6.9
│               └── validation/
│                   └── lead-schemas.ts                  # Task 1.6.6
└── drizzle/
    ├── 0039_contracts_table.sql            # Task 1.2.1
    ├── 0039_invoices_table.sql             # Task 1.2.2
    ├── 0039_onboarding_checklists_table.sql # Task 1.2.3
    ├── 0039_pipeline_activities_table.sql   # Task 1.2.4
    ├── 0040_prospects_lead_columns.sql      # Task 1.6.1 (NEW)
    └── 0040_lead_checklists_table.sql       # Task 1.6.2 (NEW)
```

### Files to Modify

```
open-seo-main/
└── src/
    └── db/
        ├── schema.ts                       # Task 1.1.5 (add exports)
        └── prospect-schema.ts              # Task 1.6.1 (add lead columns to Drizzle schema)
```

---

## Execution Order (Dependency Graph)

```
Phase 1.1: Schema Files (parallel)
├── 1.1.1: contract-schema.ts
├── 1.1.2: invoice-schema.ts
├── 1.1.3: onboarding-checklist-schema.ts
└── 1.1.4: pipeline-activities-schema.ts
         │
         ▼
Phase 1.1.5: Update schema.ts barrel
         │
         ▼
Phase 1.2: Migrations (sequential)
├── 1.2.1: contracts_table.sql
├── 1.2.2: invoices_table.sql (depends on contracts)
├── 1.2.3: onboarding_checklists_table.sql
└── 1.2.4: pipeline_activities_table.sql
         │
         ▼
Phase 1.3: Repositories (parallel after migrations)
├── 1.3.1: ContractRepository.ts
├── 1.3.2: InvoiceRepository.ts
├── 1.3.3: OnboardingChecklistRepository.ts
└── 1.3.4: PipelineActivityRepository.ts
         │
         ▼
Phase 1.4: Validation Schemas (parallel)
├── 1.4.1: contract-schemas.ts
├── 1.4.2: invoice-schemas.ts
├── 1.4.3: checklist-schemas.ts
└── 1.4.4: activity-schemas.ts
         │
         ▼
Phase 1.5: Tests (parallel)
├── 1.5.1: ContractRepository.test.ts
├── 1.5.2: InvoiceRepository.test.ts
├── 1.5.3: OnboardingChecklistRepository.test.ts
└── 1.5.4: PipelineActivityRepository.test.ts
         │
         ▼
Phase 1.6: Lead Management (NEW - can run parallel to 1.3-1.5)
├── 1.6.1: prospects_lead_columns.sql (migration)
├── 1.6.2: lead_checklists_table.sql (migration, depends on 1.6.1)
├── 1.6.3: lead-checklist-schema.ts (Drizzle schema)
├── 1.6.4: LeadChecklistRepository.ts
├── 1.6.5: LeadQualificationService.ts (depends on 1.6.4)
├── 1.6.6: lead-schemas.ts (Zod validation)
├── 1.6.7: API routes (depends on 1.6.5)
├── 1.6.8: LeadChecklistRepository.test.ts
└── 1.6.9: LeadQualificationService.test.ts
```

---

## Success Criteria (Phase Complete When)

- [ ] All 5 new schema files created and compiling (including lead-checklist-schema.ts)
- [ ] All 6 migrations run successfully on dev database (including lead management)
- [ ] All 5 repositories implemented with full CRUD (including LeadChecklistRepository)
- [ ] State machines enforced (contract, invoice, lead_status)
- [ ] All 5 validation schema files created (including lead-schemas.ts)
- [ ] LeadQualificationService implements 9-item checklist logic
- [ ] All repository/service tests pass with 80%+ coverage
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes

---

## What This Unblocks

### Phase 2: UI/Kanban View
- Pipeline kanban component can query `pipeline_activities` for feed
- Contract/invoice cards can display state badges
- Onboarding progress bar can read checklist data
- **Lead cards can show 9-item checklist progress** (NEW)

### Phase 3: Email/Tracking
- Email service can log activities via `PipelineActivityRepository`
- View tracking can update invoice state

### Phase 4: Integrations (Stripe, E-sign)
- Stripe webhooks can update invoice state via `InvoiceRepository.markAsPaid()`
- E-sign webhooks can update contract state via `ContractRepository.transitionState()`
- Onboarding auto-completion can use `OnboardingChecklistRepository.completeItem()`

### Phase 44: UI/Kanban (NEW)
- LeadCard component can render checklist items
- LeadQualificationGate modal can enforce decision gate
- LeadListView can filter by lead_source and lead_status
- LeadSourceBadge can render source-specific colors

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration conflicts with existing tables | Low | High | Use `IF NOT EXISTS`, test on dev first |
| Circular dependencies in schema | Medium | Medium | Keep FKs nullable, define constraints in migrations |
| State machine complexity | Low | Medium | Document valid transitions in code comments |
| Test database setup | Low | Low | Use existing test infrastructure |
| Lead checklist auto-triggers | Medium | Medium | Ensure audit/keyword services call LeadQualificationService |

---

## Estimated Timeline

| Phase | Tasks | Est. Hours | Parallelizable |
|-------|-------|------------|----------------|
| 1.1 | Schema files | 4h | Yes (4 tasks) |
| 1.2 | Migrations | 2h | Partial (1.2.2 depends on 1.2.1) |
| 1.3 | Repositories | 4h | Yes (4 tasks) |
| 1.4 | Validation | 2h | Yes (4 tasks) |
| 1.5 | Tests | 3h | Yes (4 tasks) |
| 1.6 | Lead Management (NEW) | 14h | Partial (see dependency graph) |
| **Total** | **29 tasks** | **29h** | **~10h with parallelization** |

---

## Cross-References & Schema Ownership

### Tables Defined Here (Source of Truth)

| Table | Used By | Notes |
|-------|---------|-------|
| `contracts` | Phase 48 (Onboarding Dashboard) | Contract lifecycle management |
| `invoices` | Phase 48 (Onboarding Dashboard) | Stripe integration |
| `onboarding_checklists` | Phase 48 (Onboarding Dashboard) | **Schema changes MUST be made here** |
| `pipeline_activities` | Phase 48 (Agency Dashboard) | **Schema changes MUST be made here** |
| `lead_checklists` | Phase 44 (UI/Kanban) | **NEW: 9-item lead qualification checklist** |
| `prospects` (lead columns) | Phase 44 (UI/Kanban) | **NEW: lead_source, lead_status, qualified_at, etc.** |

### Related Design Documents

- **[v8-agency-pipeline.md](./v8-agency-pipeline.md)** - Canonical checklist structure, activity actions, pipeline stages, **Lead stage specification**
- **[phase4-onboarding-dashboard-plan.md](./phase4-onboarding-dashboard-plan.md)** - SERVICE logic that operates on these tables (does not redefine schema)

### Schema Governance

> **Rule**: Schema definitions belong in Phase 45 (Data Foundation). 
> Phase 48 and Phase 44 should REFERENCE these tables, not redefine them.
> Any schema modifications require updating this file first.

---

*Last updated: 2026-04-30*
