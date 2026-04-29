# Agency CRM/Pipeline Architecture

> **Purpose**: Complete prospect → client → results pipeline with checklist-driven automation  
> **Design System**: [design-system-v6.md](/.planning/design/design-system-v6.md)  
> **Design Rationale**: [design-decisions-and-rationale.md](/.planning/design/design-decisions-and-rationale.md)  
> **Journey Map**: [v7-master-design-architecture.md](./v7-master-design-architecture.md)

---

## Executive Summary

The Agency Pipeline transforms prospects into paying clients through a 6-stage funnel with automated task generation at each transition. Every manual action appears as a checklist item; every automated action shows in an activity feed with override capability.

**Core Principle**: The system does the work, the agency user validates and intervenes only when needed.

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AGENCY PIPELINE (6 STAGES)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐ │
│  │  LEAD   │───▶│ PROPOSAL │───▶│ CONTRACT │───▶│ PAYMENT │───▶│ONBOARD- │ │
│  │         │    │          │    │          │    │         │    │  ING    │ │
│  └─────────┘    └──────────┘    └──────────┘    └─────────┘    └─────────┘ │
│       │              │               │               │              │       │
│       ▼              ▼               ▼               ▼              ▼       │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐    ┌─────────┐ │
│  │Checklist│    │Checklist │    │Checklist │    │Checklist│    │Checklist│ │
│  │ (5 pts) │    │ (7 pts)  │    │ (4 pts)  │    │ (3 pts) │    │(12 pts) │ │
│  └─────────┘    └──────────┘    └──────────┘    └─────────┘    └─────────┘ │
│                                                                             │
│                              ┌──────────┐                                   │
│                              │  ACTIVE  │ ◀── Ongoing relationship          │
│                              │  CLIENT  │                                   │
│                              └──────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Lead Capture

### Definition
A lead is any potential client who has entered the system but hasn't received a formal proposal.

### Entry Points
| Source | Auto-Action | Manual Follow-up |
|--------|-------------|------------------|
| Website form submission | Create prospect record, run initial site audit | Review audit, schedule call |
| Referral introduction | Create prospect, link referrer for commission | Personal outreach |
| Cold outreach response | Create prospect from email thread | Qualify interest level |
| Demo request | Create prospect, schedule demo slot | Prepare custom demo |

### Lead Checklist (Auto-Generated)
```
☐ Domain analysis complete (auto)
☐ Keywords researched (50+ opportunities) (auto)
☐ Competitors identified (top 5) (auto)
☐ Opportunity score calculated (auto)
☐ Lead source tagged
☐ Notes added (contact info, context)
☐ Discovery call scheduled
☐ Call notes captured
☐ Qualified as opportunity? (decision gate)
→ READY FOR PROPOSAL
```

### Data Captured
- Company name, domain, industry
- Contact info (name, email, phone)
- Lead source + referrer (if applicable)
- Initial audit snapshot (score, top issues)
- Estimated monthly traffic
- Qualification status

### Visual Design
> **Reference**: [design-system-v6.md §4 Card Primitive](/.planning/design/design-system-v6.md)

Lead cards use ghost-edge shadow (3px blur, 6% opacity) with status indicator:
- `bg-zinc-100` — New lead (unqualified)
- `bg-amber-50` — In qualification
- `bg-emerald-50` — Qualified, ready for proposal

---

## Stage 2: Proposal

### Proposal States
```
DRAFT ──▶ SENT ──▶ VIEWED ──▶ ACCEPTED
                      │           │
                      ▼           ▼
                  REJECTED    [Contract]
```

### State Definitions
| State | Trigger | Next Action |
|-------|---------|-------------|
| `draft` | Proposal created | Edit, add services, set pricing |
| `sent` | Agency clicks "Send Proposal" | Wait for client view |
| `viewed` | Client opens proposal link | Follow up if no response in 48h |
| `accepted` | Client clicks "Accept" | Generate contract |
| `rejected` | Client declines | Archive or re-engage |

### Proposal Checklist
```
☐ Template selected
☐ Services selected (SEO audit, content, links, etc.)
☐ Pricing configured (one-time + monthly)
☐ Timeline set (start date, milestones)
☐ Custom sections added
☐ Internal review (optional)
☐ Proposal sent to prospect
→ AWAITING RESPONSE
```

### Post-Acceptance Checklist (Auto-created when accepted)
```
☐ Contract sent for signature
☐ Contract signed by both parties
☐ First invoice sent
☐ First payment received
→ READY FOR ONBOARDING
```

### Auto-Generated Proposal Content
The system generates proposal drafts using:
1. **Initial audit data** — Current score, top 10 issues, competitor gap
2. **Service templates** — Pre-written scope for each service tier
3. **Pricing rules** — Based on site size, complexity, scope
4. **Timeline calculator** — Based on scope and current capacity

Agency user reviews, edits, and sends.

### Proposal Tracking Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│ PROPOSALS                                         [+ New] [↓]  │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ● Acme Corp         $4,500/mo    Viewed 2h ago    [Follow]  │ │
│ │   Sent Apr 25 · 3 views · Last: Apr 29 14:22                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ TechStart Inc     $2,800/mo    Sent Apr 28      [Resend]  │ │
│ │   No views yet · Sent 1 day ago                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ FoodieApp         $6,200/mo    Accepted Apr 27  [→ Cont.] │ │
│ │   Viewed 8 times · Accepted after 2 days                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Visual Design
> **Reference**: [design-system-v6.md §10.2 Today Feed](/.planning/design/design-system-v6.md)

Proposal cards follow Today feed pattern:
- Timestamp relative ("2h ago")
- Status indicator (●○✓✗)
- Primary action button contextual to state
- Expandable detail row on hover

---

## Stage 3: Contract

### Contract Flow
```
[Proposal Accepted]
        │
        ▼
┌───────────────────┐
│ Generate Contract │ ◀── Auto-populated from proposal
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Agency Review     │ ◀── Verify terms, add custom clauses
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Send for Signature│ ◀── E-sign link sent to client
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Client Signs      │ ◀── Webhook from e-sign provider
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Counter-Sign      │ ◀── Agency signs (optional auto)
└───────────────────┘
        │
        ▼
[Generate Invoice]
```

### Contract Checklist
```
☐ Contract auto-generated from accepted proposal
☐ Terms reviewed by agency
☐ Custom clauses added (if any)
☐ Sent for client signature
☐ Client signed
☐ Agency counter-signed
```

### E-Signature Integration
| Provider | Webhook Events | Auto-Actions |
|----------|----------------|--------------|
| DocuSign | `envelope-completed` | Mark contract signed, trigger invoice |
| PandaDoc | `document_state_changed` | Update contract status |
| HelloSign | `signature_request_all_signed` | Mark complete |

### Visual Design
> **Reference**: [design-system-v6.md §7.1 Goal Progress](/.planning/design/design-system-v6.md)

Contract status uses progress bar:
```
Contract: TechStart Inc
[████████████░░░░░░░░] 60% — Awaiting client signature
```

---

## Stage 4: Payment

### Payment States
```
INVOICE_GENERATED ──▶ SENT ──▶ VIEWED ──▶ PAID
                                  │
                                  ▼
                              OVERDUE ──▶ REMINDER_SENT
```

### Invoice Types
| Type | Trigger | Amount Source |
|------|---------|---------------|
| Setup fee | Contract signed | One-time from proposal |
| Monthly retainer | 1st of month (or custom date) | Monthly from proposal |
| Overage | Usage exceeds plan | Rate × overage units |
| Project milestone | Milestone completed | Milestone amount |

### Payment Checklist
```
☐ Invoice generated (auto on contract sign)
☐ Invoice sent to client
☐ Payment received
☐ Receipt sent (auto)
```

### Stripe Integration
```typescript
// Webhook handlers
stripe.webhooks.on('invoice.paid', async (event) => {
  await updateProspectStatus(prospectId, 'payment_received');
  await createOnboardingChecklist(prospectId);
  await sendReceiptEmail(clientEmail, event.data.object);
});

stripe.webhooks.on('invoice.payment_failed', async (event) => {
  await flagForFollowUp(prospectId, 'payment_failed');
  await scheduleRetryReminder(prospectId, 3); // 3 days
});
```

### Auto-Actions
| Event | System Action |
|-------|---------------|
| Contract signed | Generate & send invoice |
| Invoice viewed | Log view timestamp |
| Payment received | Send receipt, create onboarding checklist |
| Payment failed | Flag prospect, schedule reminder |
| 7 days overdue | Send reminder email |
| 14 days overdue | Flag as "needs intervention" |

### Visual Design
> **Reference**: [design-system-v6.md §4 Card States](/.planning/design/design-system-v6.md)

Payment status cards:
- `border-l-4 border-emerald-500` — Paid
- `border-l-4 border-amber-500` — Pending
- `border-l-4 border-red-500` — Overdue

---

## Stage 5: Onboarding

### Onboarding Checklist (Auto-Created on Payment)
```
ACCOUNT SETUP
☐ Client record created from prospect (auto)
☐ Keywords migrated from prospect analysis (auto)

TECHNICAL CONNECTIONS
☐ GSC access granted (magic link sent)
☐ GA4 access granted
☐ CMS access granted (if applicable)

BRAND & STRATEGY
☐ Voice profile configured OR analyzed from existing content
☐ Competitor list confirmed
☐ Monthly goal defined

INITIAL DELIVERABLES
☐ First audit completed (auto)
☐ First content piece generated
☐ Kickoff call scheduled
→ CLIENT ACTIVE
```

### Access Request Flow
```
┌──────────────────────────────────────────────────────────────────┐
│ PENDING ACCESS REQUESTS                                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 🔗 Google Search Console                                    │ │
│  │    Status: Awaiting client                                  │ │
│  │    Sent: Apr 29, 10:15am                                    │ │
│  │    [Resend Request] [Mark Complete]                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 📊 Google Analytics                                         │ │
│  │    Status: ✓ Connected                                      │ │
│  │    Connected: Apr 29, 11:42am                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### OAuth Connection Flow
1. System sends client a secure link: `app.tevero.io/connect/{token}`
2. Client clicks link, sees requested permissions
3. Client authorizes via OAuth (Google, etc.)
4. Webhook fires, checklist item auto-completes
5. Agency notified in activity feed

### Visual Design
> **Reference**: [design-system-v6.md §6 Form Patterns](/.planning/design/design-system-v6.md)

Onboarding uses stepped wizard with progress indicator:
```
┌──────────────────────────────────────────────────────────────────┐
│ ONBOARDING: Acme Corp                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░ 65%           │
├──────────────────────────────────────────────────────────────────┤
│  [1. Access ✓] [2. Brand ✓] [3. Strategy ●] [4. Kickoff ○]      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stage 6: Active Client

### Transition Trigger
All onboarding checklist items complete → Status changes to `active`

### Ongoing Relationship
Once active, the client moves into the main application experience documented in [v7-master-design-architecture.md](./v7-master-design-architecture.md):

- **Today Feed** — Daily activity stream (new content, rank changes, issues)
- **Intelligence Dashboard** — Keyword tracking, competitor monitoring
- **Content Pipeline** — Article generation with brand voice
- **Audit System** — Continuous site health monitoring
- **Link Building** — Prospect tracking, outreach management

### Monthly Touchpoints (Auto-Generated)
```
☐ Monthly report generated (auto)
☐ Report sent to client (auto)
☐ Strategy call scheduled (manual or auto)
☐ Next month priorities confirmed
```

### Churn Prevention Signals
| Signal | Threshold | Auto-Action |
|--------|-----------|-------------|
| No login in 14 days | Days since last login > 14 | Alert agency |
| Declining engagement | Page views down 50% MoM | Schedule check-in |
| Support tickets spike | > 3 tickets in 7 days | Flag for review |
| Invoice overdue | > 30 days | Escalate to agency owner |

---

## Agency Dashboard

### Pipeline View
```
┌────────────────────────────────────────────────────────────────────────────┐
│ AGENCY PIPELINE                                            MRR: $47,200    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  LEADS (12)      PROPOSALS (5)    CONTRACTS (2)   ONBOARDING (3)          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │ ████████ │    │ █████    │    │ ██       │    │ ███      │             │
│  │ $34,800  │    │ $18,500  │    │ $8,200   │    │ $12,600  │             │
│  │ potential│    │ pending  │    │ closing  │    │ starting │             │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘             │
│                                                                            │
│  ──────────────────────────────────────────────────────────────────────── │
│                                                                            │
│  ACTIVE CLIENTS (14)                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ ████████████████████████████████████████████████████████████████   │   │
│  │ $47,200/mo MRR · 98% retention · Avg. client tenure: 14 months     │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Today's Tasks (Agency User)
```
┌──────────────────────────────────────────────────────────────────┐
│ TODAY                                          Apr 29, 2026      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ● 9:30am  Discovery call with TechStart Inc                    │
│            Lead · $4,500/mo potential                            │
│                                                                  │
│  ○ 11:00am Review proposal for Acme Corp                         │
│            Proposal · Draft ready, needs pricing                 │
│                                                                  │
│  ● 2:00pm  Kickoff call with FoodieApp                          │
│            Onboarding · 80% complete                             │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  OVERDUE TASKS (3)                                               │
│  ○ Follow up on CloudBase proposal (sent 5 days ago, no view)   │
│  ○ Collect GSC access from MediaBuzz (3 days overdue)           │
│  ○ Send April report to RetailMax (due yesterday)               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Visual Design
> **Reference**: [design-system-v6.md §10.2 Today Feed](/.planning/design/design-system-v6.md)

Dashboard uses:
- **Kanban-style pipeline** for visual stage distribution
- **Today feed** for chronological task stream
- **Metric cards** for MRR, retention, capacity
- **Ghost-edge shadows** on all cards (no harsh borders)

---

## Built vs. Missing Analysis

### Detailed Feature Matrix

| Stage | Feature | Status | Priority |
|-------|---------|--------|----------|
| **Lead** | Create prospect | ✅ Built | — |
| | Domain analysis | ✅ Built | — |
| | Keyword research | ✅ Built | — |
| | Opportunity scoring | ✅ Built | — |
| | CSV import | ❌ Missing | Medium |
| **Proposal** | Generate proposal | ✅ Built | — |
| | Customize sections | ✅ Built | — |
| | Export PDF | 🟡 Partial | Medium |
| | Send via email | ❌ Missing | **Critical** |
| | Track opens/views | ❌ Missing | **Critical** |
| | Proposal states (sent/viewed/accepted) | ❌ Missing | **Critical** |
| | Follow-up reminders | ❌ Missing | Medium |
| **Contract** | e-Signature integration | ❌ Missing | **Critical** |
| | Contract templates | ❌ Missing | Medium |
| | Contract tracking | ❌ Missing | Medium |
| **Payment** | Invoice generation | ❌ Missing | **Critical** |
| | Stripe integration | ❌ Missing | **Critical** |
| | Payment tracking | ❌ Missing | Medium |
| | Recurring billing | ❌ Missing | Medium |
| **Onboarding** | Convert to client | ❌ Missing | **Critical** |
| | Onboarding checklist | ❌ Missing | **Critical** |
| | Data migration (keywords→client) | ❌ Missing | Medium |
| | Magic link for GSC | ✅ Built | — |
| **Execution** | Audits | ✅ Built | — |
| | Content generation | ✅ Built | — |
| | Ranking tracking | ✅ Built | — |
| | Client deliverables tracking | ❌ Missing | Medium |
| | Client communication log | ❌ Missing | Medium |
| **Retention** | Client health score | ❌ Missing | Medium |
| | Renewal alerts | ❌ Missing | Medium |
| | Churn prediction | ❌ Missing | Low |

### Current Codebase Locations
| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| Prospect list | ✅ Built | `apps/web/src/app/(shell)/prospects/page.tsx` | Basic list, no pipeline stages |
| Prospect creation | ✅ Built | `apps/web/src/app/api/prospects/` | Form + API working |
| Site audit trigger | ✅ Built | `open-seo-main/` | Full Tier 1-4 audit system |
| Proposal system | ❌ Missing | — | No proposal entity or UI |
| Proposal tracking | ❌ Missing | — | No view tracking, states |
| Contract management | ❌ Missing | — | No contract entity |
| E-signature integration | ❌ Missing | — | No DocuSign/PandaDoc |
| Invoice generation | ❌ Missing | — | No Stripe invoicing |
| Payment tracking | ❌ Missing | — | No payment states |
| Onboarding checklist | ❌ Missing | — | No auto-generated checklists |
| OAuth connection flow | 🟡 Partial | `apps/web/src/app/connect/` | Token page exists, needs expansion |
| Pipeline dashboard | ❌ Missing | — | No kanban/pipeline view |
| Agency calendar | ❌ Missing | — | No scheduling integration |

### Critical Gap Summary
**8 Critical features missing** that block the prospect → client conversion flow:
1. Send proposal via email
2. Track proposal opens/views
3. Proposal state machine (sent/viewed/accepted)
4. e-Signature integration
5. Invoice generation
6. Stripe integration
7. Convert prospect to client
8. Onboarding checklist generation

### Implementation Priority
```
Phase 1: Pipeline Foundation
├── ProspectStatus enum (lead/proposal/contract/payment/onboarding/active)
├── Proposal entity + CRUD
├── Proposal builder UI
└── Proposal sending (email + tracking link)

Phase 2: Conversion Flow
├── Proposal view tracking (pixel/webhook)
├── Accept/reject flow
├── Contract generation
└── E-signature integration

Phase 3: Payment & Onboarding
├── Stripe invoice integration
├── Payment webhook handlers
├── Onboarding checklist generator
└── OAuth connection expansion

Phase 4: Agency Dashboard
├── Pipeline kanban view
├── Today's tasks feed
├── MRR/retention metrics
└── Calendar integration
```

---

## Data Model

### New Enums
```sql
CREATE TYPE prospect_status AS ENUM (
  'lead',
  'qualified',
  'proposal_draft',
  'proposal_sent',
  'proposal_viewed',
  'proposal_accepted',
  'proposal_rejected',
  'contract_pending',
  'contract_signed',
  'payment_pending',
  'payment_received',
  'onboarding',
  'active',
  'churned'
);

CREATE TYPE proposal_state AS ENUM (
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired'
);

CREATE TYPE contract_state AS ENUM (
  'draft',
  'sent',
  'client_signed',
  'fully_executed'
);

CREATE TYPE invoice_state AS ENUM (
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'void'
);
```

### New Tables
```sql
-- Proposals
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id),
  state proposal_state DEFAULT 'draft',
  
  -- Content
  title TEXT NOT NULL,
  intro_text TEXT,
  services JSONB NOT NULL, -- [{service, description, price_monthly, price_setup}]
  total_monthly DECIMAL(10,2),
  total_setup DECIMAL(10,2),
  
  -- Timeline
  start_date DATE,
  milestones JSONB, -- [{title, date, deliverables}]
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Proposal views (for analytics)
CREATE TABLE proposal_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  duration_seconds INT
);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES proposals(id),
  prospect_id UUID REFERENCES prospects(id),
  state contract_state DEFAULT 'draft',
  
  -- Document
  template_id UUID,
  document_url TEXT, -- PDF or e-sign URL
  
  -- E-signature
  esign_provider TEXT, -- 'docusign', 'pandadoc', etc.
  esign_envelope_id TEXT,
  
  -- Signatures
  client_signed_at TIMESTAMPTZ,
  agency_signed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id),
  contract_id UUID REFERENCES contracts(id),
  state invoice_state DEFAULT 'draft',
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  line_items JSONB, -- [{description, qty, unit_price, total}]
  
  -- Stripe
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Dates
  issued_at TIMESTAMPTZ,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding checklists
CREATE TABLE onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  
  -- Items
  items JSONB NOT NULL, -- [{key, label, category, completed, completed_at}]
  
  -- Progress
  total_items INT,
  completed_items INT DEFAULT 0,
  progress_pct DECIMAL(5,2) DEFAULT 0,
  
  -- Dates
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log (all pipeline events)
CREATE TABLE pipeline_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic reference
  entity_type TEXT NOT NULL, -- 'prospect', 'proposal', 'contract', 'invoice'
  entity_id UUID NOT NULL,
  
  -- Activity
  action TEXT NOT NULL, -- 'created', 'sent', 'viewed', 'accepted', etc.
  actor_type TEXT, -- 'system', 'user', 'client'
  actor_id UUID,
  
  -- Context
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_proposals_prospect ON proposals(prospect_id);
CREATE INDEX idx_proposals_state ON proposals(state);
CREATE INDEX idx_contracts_prospect ON contracts(prospect_id);
CREATE INDEX idx_invoices_prospect ON invoices(prospect_id);
CREATE INDEX idx_invoices_state ON invoices(state);
CREATE INDEX idx_activities_entity ON pipeline_activities(entity_type, entity_id);
CREATE INDEX idx_activities_created ON pipeline_activities(created_at DESC);
```

### Drizzle Schema (TypeScript)
```typescript
// packages/db/src/schema/pipeline.ts

import { pgTable, uuid, text, timestamp, decimal, integer, jsonb, inet, date, pgEnum } from 'drizzle-orm/pg-core';

export const prospectStatusEnum = pgEnum('prospect_status', [
  'lead', 'qualified', 'proposal_draft', 'proposal_sent', 'proposal_viewed',
  'proposal_accepted', 'proposal_rejected', 'contract_pending', 'contract_signed',
  'payment_pending', 'payment_received', 'onboarding', 'active', 'churned'
]);

export const proposalStateEnum = pgEnum('proposal_state', [
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
]);

export const contractStateEnum = pgEnum('contract_state', [
  'draft', 'sent', 'client_signed', 'fully_executed'
]);

export const invoiceStateEnum = pgEnum('invoice_state', [
  'draft', 'sent', 'viewed', 'paid', 'overdue', 'void'
]);

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  prospectId: uuid('prospect_id').references(() => prospects.id),
  state: proposalStateEnum('state').default('draft'),
  
  title: text('title').notNull(),
  introText: text('intro_text'),
  services: jsonb('services').notNull(),
  totalMonthly: decimal('total_monthly', { precision: 10, scale: 2 }),
  totalSetup: decimal('total_setup', { precision: 10, scale: 2 }),
  
  startDate: date('start_date'),
  milestones: jsonb('milestones'),
  
  sentAt: timestamp('sent_at'),
  firstViewedAt: timestamp('first_viewed_at'),
  viewCount: integer('view_count').default(0),
  acceptedAt: timestamp('accepted_at'),
  rejectedAt: timestamp('rejected_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id').references(() => proposals.id),
  prospectId: uuid('prospect_id').references(() => prospects.id),
  state: contractStateEnum('state').default('draft'),
  
  templateId: uuid('template_id'),
  documentUrl: text('document_url'),
  
  esignProvider: text('esign_provider'),
  esignEnvelopeId: text('esign_envelope_id'),
  
  clientSignedAt: timestamp('client_signed_at'),
  agencySignedAt: timestamp('agency_signed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  prospectId: uuid('prospect_id').references(() => prospects.id),
  contractId: uuid('contract_id').references(() => contracts.id),
  state: invoiceStateEnum('state').default('draft'),
  
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('USD'),
  lineItems: jsonb('line_items'),
  
  stripeInvoiceId: text('stripe_invoice_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  
  issuedAt: timestamp('issued_at'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const onboardingChecklists = pgTable('onboarding_checklists', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id),
  
  items: jsonb('items').notNull(),
  
  totalItems: integer('total_items'),
  completedItems: integer('completed_items').default(0),
  progressPct: decimal('progress_pct', { precision: 5, scale: 2 }).default('0'),
  
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pipelineActivities = pgTable('pipeline_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  
  action: text('action').notNull(),
  actorType: text('actor_type'),
  actorId: uuid('actor_id'),
  
  metadata: jsonb('metadata'),
  
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## API Routes

### Proposals
```
GET    /api/proposals                    # List all proposals
GET    /api/proposals/:id                # Get proposal details
POST   /api/proposals                    # Create new proposal
PATCH  /api/proposals/:id                # Update proposal
POST   /api/proposals/:id/send           # Send proposal to client
GET    /api/proposals/:id/preview        # Preview proposal (agency)
GET    /api/p/:token                     # Client-facing proposal view (public)
POST   /api/p/:token/accept              # Client accepts proposal
POST   /api/p/:token/reject              # Client rejects proposal
```

### Contracts
```
GET    /api/contracts                    # List all contracts
GET    /api/contracts/:id                # Get contract details
POST   /api/contracts                    # Create contract from proposal
POST   /api/contracts/:id/send           # Send for signature
POST   /api/webhooks/docusign            # DocuSign webhook handler
POST   /api/webhooks/pandadoc            # PandaDoc webhook handler
```

### Invoices
```
GET    /api/invoices                     # List all invoices
GET    /api/invoices/:id                 # Get invoice details
POST   /api/invoices                     # Create invoice
POST   /api/invoices/:id/send            # Send invoice to client
POST   /api/webhooks/stripe              # Stripe webhook handler
```

### Onboarding
```
GET    /api/onboarding/:clientId         # Get onboarding checklist
PATCH  /api/onboarding/:clientId/items/:key  # Complete checklist item
POST   /api/connect/:token/complete      # OAuth connection complete
```

### Pipeline
```
GET    /api/pipeline                     # Get pipeline overview
GET    /api/pipeline/activities          # Get activity feed
GET    /api/pipeline/metrics             # Get MRR, retention, etc.
```

---

## Component Mapping to Design System

### Cards
| Component | Design System Reference |
|-----------|------------------------|
| Lead card | [§4 Card Primitive](/.planning/design/design-system-v6.md) — ghost-edge shadow, status border |
| Proposal card | [§4 Card Primitive](/.planning/design/design-system-v6.md) + [§10.2 Feed Item](/.planning/design/design-system-v6.md) |
| Contract card | [§4 Card Primitive](/.planning/design/design-system-v6.md) + [§7.1 Progress](/.planning/design/design-system-v6.md) |
| Invoice card | [§4 Card Primitive](/.planning/design/design-system-v6.md) — left border status indicator |
| Checklist | [§6 Form Patterns](/.planning/design/design-system-v6.md) — checkbox group |

### Layouts
| Component | Design System Reference |
|-----------|------------------------|
| Pipeline kanban | [§2 Three-Column Shell](/.planning/design/design-system-v6.md) — full-width main |
| Today's tasks | [§10.2 Today Feed](/.planning/design/design-system-v6.md) — chronological stream |
| Proposal builder | [§6 Form Patterns](/.planning/design/design-system-v6.md) — stepped wizard |
| Onboarding wizard | [§6 Form Patterns](/.planning/design/design-system-v6.md) — progress stepper |

### Typography
| Element | Design System Reference |
|---------|------------------------|
| Page titles | [§3 Typography](/.planning/design/design-system-v6.md) — Newsreader 2rem |
| Card headers | [§3 Typography](/.planning/design/design-system-v6.md) — Geist 500 |
| Metadata | [§3 Typography](/.planning/design/design-system-v6.md) — Geist 400 muted |
| Amounts | [§3 Typography](/.planning/design/design-system-v6.md) — Geist Mono tabular |

### Motion
| Interaction | Design System Reference |
|-------------|------------------------|
| Card hover | [§8 Motion](/.planning/design/design-system-v6.md) — 150ms shadow lift |
| Stage transition | [§8 Motion](/.planning/design/design-system-v6.md) — 200ms ease-out |
| Progress update | [§8 Motion](/.planning/design/design-system-v6.md) — 300ms width transition |

---

## Cross-References

- **User Journeys**: [v6-comprehensive-journeys.md](./v6-comprehensive-journeys.md) — Domain 1 (Prospect-to-Client)
- **Design Architecture**: [v7-master-design-architecture.md](./v7-master-design-architecture.md) — Interlinking patterns
- **Design System**: [design-system-v6.md](/.planning/design/design-system-v6.md) — Visual specifications
- **Design Rationale**: [design-decisions-and-rationale.md](/.planning/design/design-decisions-and-rationale.md) — Why decisions were made

---

## Implementation Checklist

```
PHASE 1: PIPELINE FOUNDATION (Sprint 1-2)
☐ Add ProspectStatus enum to schema
☐ Create proposals table + Drizzle schema
☐ Create proposal CRUD API routes
☐ Build proposal builder UI
☐ Build proposal list/card components
☐ Implement proposal sending (email + tracking pixel)
☐ Create client-facing proposal view page

PHASE 2: CONVERSION FLOW (Sprint 3-4)
☐ Add proposal view tracking (pixel + analytics)
☐ Build accept/reject flow for clients
☐ Create contracts table + Drizzle schema
☐ Build contract generation from proposal
☐ Integrate e-signature provider (DocuSign or PandaDoc)
☐ Implement signature webhook handlers
☐ Build contract status UI

PHASE 3: PAYMENT & ONBOARDING (Sprint 5-6)
☐ Create invoices table + Drizzle schema
☐ Integrate Stripe Invoicing API
☐ Implement invoice generation on contract sign
☐ Build payment webhook handlers
☐ Create onboarding_checklists table
☐ Build checklist generator
☐ Expand OAuth connection flow
☐ Build onboarding progress UI

PHASE 4: AGENCY DASHBOARD (Sprint 7-8)
☐ Create pipeline_activities table
☐ Build activity logging across all entities
☐ Build pipeline kanban view
☐ Build Today's tasks feed
☐ Build MRR/retention metrics
☐ Build capacity planning view
☐ Optional: Calendar integration (Google/Outlook)
```

---

*Last updated: 2026-04-29*
