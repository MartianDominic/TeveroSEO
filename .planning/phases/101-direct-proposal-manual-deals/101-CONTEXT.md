# Phase 101: Direct Proposal & Manual Deal Pipeline - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable manual deal entry at any pipeline stage, bypassing automatic analysis, with full payment reconciliation across Revolut/Stripe, tiered AI proposal generation, and world-class document management with content library and smart tracking.

**Core capability:** Agency users can add deals that started/closed outside the system, record payments manually, and manage all client documents in one place.

</domain>

<decisions>
## Implementation Decisions

### D-01: Entry Point Architecture

**Two-layer system for maximum flexibility:**

1. **Quick Capture (< 5 seconds)**
   - Global hotkey (Cmd+K → "New deal" or Cmd+N)
   - Floating action button in header
   - Minimum fields: Domain + Contact (email or phone) + Stage
   - Creates "stub" record for later enrichment

2. **Full Entry (when time permits)**
   - Accessible from: Pipeline view, Command Center, clicking any stub
   - Stage-aware form showing relevant fields per stage
   - Progressive disclosure: Start simple, expand as needed

**Entity Chain Creation:**
- Follows existing Prospect → Proposal → Contract → Client flow
- When inserting at later stage (e.g., "signed"), auto-creates upstream records:
  - Prospect (with domain + contact)
  - Proposal stub (status = "accepted", minimal content)
  - Contract with actual details
- Maintains data consistency with existing pipeline

### D-02: Payment Reconciliation (World-Class)

**Multi-Provider Architecture:**

```
INGESTION LAYER
├── Stripe Webhooks (real-time)
├── Revolut API Polling (every 15 min)
└── Manual Entry / CSV Import (bank transfers, cash)
         │
         ▼
NORMALIZED PAYMENT ENTITY
{ id, gross_amount, provider_fee, net_amount, payer_reference,
  memo, received_at, provider, external_id, confidence }
         │
         ▼
AUTO-MATCH ENGINE (Priority Order)
1. Invoice # in memo → 100% confidence
2. Exact amount + client email → 95%
3. Exact amount + date within 7 days → 85%
4. Fuzzy amount (±€0.50) + client name → 70%
5. No match → 0% (review queue)
         │
    ┌────┴────┐
    ▼         ▼
AUTO-MATCHED   REVIEW QUEUE
(>90%)         (<90% confidence)
```

**New Database Tables:**

- `payments` — Normalized payment from any source
- `payment_allocations` — Many-to-many: one payment covers multiple invoices
- `client_credits` — Overpayments, prepayments (liability tracking)
- `payment_groups` — Cross-platform linking (Revolut → Stripe flows)
- `payment_group_members` — Links payments to groups with role

**Features:**
- Split payments across invoices
- Partial payment tracking (invoice stays open with balance)
- Overpayment → auto-credit to client balance
- Fee tracking per provider for cost comparison dashboard
- Full audit trail (7-year retention, immutable)
- One-click PDF export for disputes

**Review Queue UX:**
- Suggested matches with confidence %
- One-click confirm
- Manual search by invoice/client/amount
- Create credit option
- Daily digest for unmatched > 48 hours (no per-payment spam)

### D-03: Direct Proposal Flow

**Tiered AI Involvement:**

| Mode | Use Case | AI Level |
|------|----------|----------|
| **Full AI Generation** | "Generate proposal for plaukupasaka.lt, premium package" | AI pulls template + generates all copy + pricing |
| **AI-Assisted** | Provide key details, AI fills gaps | AI expands into full proposal sections |
| **Template + Manual** | Pick template, fill in client specifics | No AI, fastest when you know what you want |
| **Blank Manual** | Start from scratch | No AI, no template, for custom deals |

**All modes use existing proposal templates as source of truth for:**
- Service packages and pricing
- Inclusions/deliverables
- Terms and conditions
- Brand styling

**Flexible Closing (Choice at Close Time, Not Creation):**

Every deal starts the same, but at ANY point:

| Action | Creates | Audit Trail |
|--------|---------|-------------|
| **Send to client** | Magic link | Normal flow begins |
| **Mark as accepted** | Activity log | "Verbal agreement recorded by [user]" |
| **Upload signed doc** | Contract + file | "External contract uploaded" |
| **Record payment** | Payment + Invoice | "Manual payment: €X via [method]" |
| **Create invoice only** | Invoice (no proposal) | "Direct invoice, no proposal" |

**Command Palette + Contextual Actions:**

- `Cmd+K` available anywhere — type "close deal", "record payment", "upload contract"
- Context-aware suggestions based on current deal state
- Deal cards show 4 primary actions (keyboard shortcuts 1-4)
- Actions change based on stage (sent vs viewed vs signed)

**Keyboard Shortcuts (Power User):**
- `Cmd+K` — Command palette
- `Cmd+N` — New deal (quick)
- `Cmd+Shift+N` — New deal (full form)
- `1-4` — Quick action on focused deal
- `E` — Edit, `P` — Payment, `S` — Send, `C` — Comment

**Reporting Visibility:**
- Dashboard shows close method breakdown (formal flow vs external sig vs verbal)
- Track conversion rates by close type

### D-04: Document Management (World-Class)

**Storage Architecture:**
- Hybrid: PostgreSQL metadata + Google Drive integration
- Flexible sync modes per file:
  - Two-way sync (default) — changes reflect in both places
  - Import copy — file copied to TeveroSEO, Drive link maintained
  - Link only — just store URL, file stays in Drive

**Organization:**
- Dual views: Files attached to deals AND viewable as client folder
- Same files, two access patterns

**Full Document Hub:**
- All file types: contracts, proposals, briefs, reports, invoices, any client file
- Version tracking for uploaded files
- Audit trail for all document actions

**Content Library (NEW):**
- Reusable blocks: case studies, testimonials, pricing tables, legal clauses
- Per-workspace, tagged, searchable
- One-click insert into any document
- Track usage (which blocks used most)
- Categories: Case Studies, Testimonials, Pricing Tables, Legal Clauses, Team Bios

**Enhanced Tracking (NEW):**
- Time spent per section (not just "viewed")
- Scroll depth / section heatmap
- Forward detection (new email opens doc)
- Re-engagement alerts (opened after 7+ days dormant)

**Smart Automation (NEW):**
- Configurable reminders (unopened X days)
- Auto follow-up email triggers
- Expiration handling
- Forwarding notifications
- "Needs attention" surfacing in Command Center

### Claude's Discretion

- Exact confidence thresholds for auto-match (suggested 90% but can tune)
- Specific keyboard shortcuts (can adjust based on conflicts)
- Heatmap visualization style
- Content library category structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Schema (MUST understand current data models)
- `open-seo-main/src/db/prospect-schema.ts` — Prospect entity, pipeline stages, status enums
- `open-seo-main/src/db/proposal-schema.ts` — Proposal lifecycle, views, signatures, payments, edits
- `open-seo-main/src/db/contract-schema.ts` — Contract status, Dokobit integration
- `open-seo-main/src/db/invoice-schema.ts` — Invoice lifecycle, Stripe + Revolut fields
- `open-seo-main/src/db/client-schema.ts` — Client entity, conversion tracking
- `open-seo-main/src/db/activity-schema.ts` — Polymorphic activity feed

### Existing Payment Infrastructure
- `open-seo-main/src/routes/api/webhooks/revolut.ts` — Revolut webhook handler
- `open-seo-main/src/server/features/payments/PaymentProviderFactory.ts` — Multi-provider pattern
- `open-seo-main/src/db/workspace-payment-settings-schema.ts` — Per-workspace payment config

### Existing Proposal System
- `open-seo-main/src/db/proposal-template-schema.ts` — Template structure
- Phase 57 context (proposal variables, section types, version history)
- Phase 86 context (semantic clustering, proposal editing, undo/redo)

### Design System
- `.planning/design/design-system-v6.md` — Newsreader + Geist, ghost-edge shadows, interaction patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `proposalViews` table — Already tracks views, can extend for section-level tracking
- `proposalEdits` table — Version history with full snapshots, reuse pattern for documents
- `pipelineActivities` table — Polymorphic activity feed, extend for payment/document events
- `PaymentProviderFactory` — Multi-provider pattern, extend for manual payments
- Variable system (Phase 57) — 6 categories, entity path resolution, extend to content library

### Established Patterns
- Soft delete with `softDeleteColumns` — Apply to new tables
- Optimistic locking with `version` field — Apply to payments
- Webhook idempotency with `processWebhookIdempotently` — Reuse for all providers
- Activity logging pattern — Extend for document and payment events

### Integration Points
- Command Center (Phase 62) — Add "Unmatched Payments" and "Needs Attention" widgets
- Proposal Builder (Phase 57) — Integrate content library insert
- Pipeline View (existing) — Add quick-add buttons per stage column

</code_context>

<specifics>
## Specific Ideas

### UX References
- **Command Palette:** Linear/Superhuman style — Cmd+K everywhere, context-aware suggestions
- **Deal Cards:** Show 4 contextual actions with keyboard shortcuts (1-4)
- **Payment Review:** Xero-style — no separate inbox, items live on reconciliation screen until processed
- **Section Heatmap:** PandaDoc-style analytics showing time per section

### Specific Behaviors
- Quick Capture creates stub that appears in pipeline immediately
- "Already Closed Outside System" flow creates full entity chain in one action
- Payment auto-match runs on webhook receipt AND on manual "Find matches" trigger
- Content library blocks maintain link to source (update source → option to update all uses)
- Google Drive sync respects folder structure (client folder in Drive = client folder in TeveroSEO)

</specifics>

<deferred>
## Deferred Ideas (Phase 102+)

### Phase 102: Advanced Document Builder
- Visual drag-drop template builder (blocks, conditions, library insert)
- Side-by-side version comparison with diff highlighting
- Real-time collaboration (co-editing)
- Conditional content blocks (show if package = premium)
- Content library analytics (which blocks correlate with closed deals)

### Phase 103+: Advanced Features
- Approval workflows for larger teams
- CRM sync (Pipedrive, HubSpot)
- Bulk document operations
- AI-powered content suggestions based on client industry
- Payment forecasting based on pipeline

</deferred>

---

*Phase: 101-direct-proposal-manual-deals*
*Context gathered: 2026-05-13*
