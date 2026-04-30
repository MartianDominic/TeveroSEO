# Phase 48: Contract & Payment - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

E-signature integration (Dokobit) and Stripe invoicing for signed proposals. Automated flow: accepted → signed → paid.

</domain>

<decisions>
## Implementation Decisions

### E-Signature Integration
- **D-01:** Use Dokobit as e-signature provider (Lithuanian market standard)
- **D-02:** Contract generated from accepted proposal content
- **D-03:** Signing flow: proposal accepted → contract created → Dokobit signing request → webhook callback on completion
- **D-04:** Store signed PDF in workspace storage after completion

### Payment Integration
- **D-05:** Use Stripe for invoicing (already in stack from AI-Writer)
- **D-06:** Invoice created after contract signed
- **D-07:** Stripe webhook handles payment.succeeded → update contract status to "paid"
- **D-08:** Support both setup fee (one-time) and monthly recurring via Stripe Subscriptions

### State Machine
- **D-09:** Contract status flow: draft → sent → signed → paid → active
- **D-10:** All state transitions log to pipeline_activities (same pattern as proposals)
- **D-11:** Status badges use v6 design tokens (same pattern as ProposalTable)

### UI Components
- **D-12:** ContractTable with status badges and quick actions (same pattern as ProposalTable)
- **D-13:** SignatureStatus component showing Dokobit signing progress
- **D-14:** PaymentStatus component showing Stripe invoice status

### Claude's Discretion
- Dokobit API client implementation details
- Stripe webhook verification approach
- PDF generation for contract document
- Error handling and retry patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Patterns
- `open-seo-main/src/db/contract-schema.ts` — Contract table schema (Phase 45)
- `open-seo-main/src/db/invoice-schema.ts` — Invoice table schema (Phase 45)
- `open-seo-main/src/server/features/contracts/repositories/ActivityRepository.ts` — Activity logging pattern
- `open-seo-main/src/server/features/proposals/services/ProposalService.ts` — State machine pattern

### Design System
- `.planning/design/design-system-v6.md` — v6 design tokens
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposals/components/ProposalTable.tsx` — Table pattern reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Contract/Invoice schemas from Phase 45 (contracts, invoices, onboarding_checklists tables)
- ActivityRepository for pipeline_activities logging
- ProposalTable component pattern for ContractTable
- StatusChip/Badge components from @tevero/ui

### Established Patterns
- State machine with VALID_TRANSITIONS pattern (from ProposalService)
- Webhook handling pattern (from existing Stripe integration in AI-Writer)
- Repository pattern with namespace exports

### Integration Points
- Proposal accepted → triggers contract creation
- Contract signed → triggers invoice creation
- Invoice paid → triggers onboarding start (Phase 49-51)

</code_context>

<specifics>
## Specific Ideas

- Dokobit is the standard e-signature provider in Lithuania
- Stripe already used in AI-Writer for subscriptions
- Flow should feel seamless: accept proposal → sign contract → pay invoice → start onboarding

</specifics>

<deferred>
## Deferred Ideas

- Multi-signer contracts (enterprise feature)
- Contract templates library
- Payment plan options (split payments)
- Contract amendment workflow

</deferred>

---

*Phase: 48-contract-payment*
*Context gathered: 2026-04-30*
