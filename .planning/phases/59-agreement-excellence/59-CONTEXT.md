# Phase 59: Agreement & Signing Excellence - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated from DESIGN.md

<domain>
## Phase Boundary

Create a 3-click signing experience with template system, multi-signer support, pre-signing capability, and polished client contract page.

**Core Capabilities:**
- Agreement template system (system → workspace) with reusable clauses
- Multi-signer support (1-3 signers with roles: provider, client)
- Sequential signing (provider first) and parallel modes
- Pre-signing flow: agency signs before sending to client
- Client contract page `/c/:token` with professional branded UI
- Variable resolution shared with proposal system (P57)
- Drag-and-drop variable insertion in template editor
- Professional PDF with custom fonts (Inter) and agency branding
- EN/LT language toggle in client view
- Dokobit integration for Smart-ID/Mobile-ID signing

**Key Constraint:** Target 3 clicks from link to signed (open, review, sign).

</domain>

<decisions>
## Implementation Decisions

### Template System
- **D-01:** Agreement templates stored in `agreement_templates` table with `workspaceId` null for system templates
- **D-02:** Clauses stored in `agreement_clauses` with types: parties, services, payment, term, termination, confidentiality, liability, gdpr, dispute, signatures, custom
- **D-03:** Clause order stored as `clauseOrder` jsonb array
- **D-04:** Templates have `isDefault` flag per workspace

### Multi-Signer Architecture
- **D-05:** `agreement_signers` table tracks individual signer status: pending → invited → viewed → signing → signed | declined
- **D-06:** Each signer gets unique `accessToken` with 14-day expiry
- **D-07:** Sequential signing: `signingOrder` integer determines sequence (provider = 1, client = 2+)
- **D-08:** Parallel signing: all signers have `signingOrder = 0`

### Pre-Signing Flow
- **D-09:** `allowPreSigning` boolean on template enables provider-first signing
- **D-10:** After provider signs, system generates partially-signed PDF
- **D-11:** Client sees provider signature already present when opening

### Variable System
- **D-12:** Reuse P57 variable infrastructure with agreement-specific variables
- **D-13:** Categories: client, provider, services, agreement, signatures, payment
- **D-14:** `AgreementVariableService.resolveVariables(agreementId, locale)` returns all resolved values
- **D-15:** Service variables from proposal: `{{services.list}}`, `{{services.monthly}}`, `{{services.setup}}`

### Client Contract Page
- **D-16:** Route: `/c/:token` in apps/web
- **D-17:** Responsive mobile-first design
- **D-18:** Progress indicator shows section completion
- **D-19:** Language toggle EN/LT persists to URL param `?lang=lt`
- **D-20:** Consent checkbox required before signing
- **D-21:** Multiple sign methods: Smart-ID, Mobile-ID (via Dokobit)

### Template Editor UI
- **D-22:** Clause editor with drag-and-drop reordering
- **D-23:** Variable palette shows all categories, searchable
- **D-24:** Signature configuration panel for adding/removing signer requirements
- **D-25:** Preview mode shows resolved variables before saving

### PDF Generation
- **D-26:** Use pdf-lib (already in stack) for generation
- **D-27:** Embed Inter fonts (Regular, Bold) for professional look
- **D-28:** Include agency logo from workspace settings
- **D-29:** Signature section shows signed/pending status visually
- **D-30:** Page numbers in footer

### Success Page
- **D-31:** Shows confirmation with agreement number and timestamp
- **D-32:** PDF download button
- **D-33:** "What's next" section with onboarding steps
- **D-34:** Localized for EN/LT

### Claude's Discretion
- Loading states and skeleton UI patterns
- Error boundary design for failed signing
- Animation timing for progress indicators
- Toast notification styling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Design
- `.planning/phases/59-agreement-excellence/DESIGN.md` — Full specification with schemas, UI mockups, and implementation examples

### Prior Art
- `.planning/phases/57-proposal-editor-revolution/57-CONTEXT.md` — Variable system design (reused)
- `open-seo-main/src/db/proposal-schema.ts` — Proposal schema patterns
- `open-seo-main/src/server/features/proposals/services/` — Proposal service patterns

### Existing Infrastructure
- `open-seo-main/src/routes/api/webhooks/dokobit.ts` — Dokobit webhook handler (Phase 48)
- `open-seo-main/src/server/lib/dokobit/` — Dokobit client service
- `open-seo-main/src/db/contract-schema.ts` — Contract schema (upgrade path)

### i18n
- `apps/web/src/i18n/` — Next.js i18n setup
- `open-seo-main/src/server/lib/i18n/` — Backend translation utilities

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DokobitService` from Phase 48 — signing session management
- `ProposalVariableService` from P57 — variable resolution pattern
- `pdf-lib` already installed — PDF generation
- `@tevero/ui` components — form inputs, modals, buttons
- TipTap from P57 — rich text editor for clause content

### Established Patterns
- Route pattern: TanStack Start createFileRoute with @ts-expect-error
- Service pattern: static methods, transaction handling
- i18n pattern: `*En`/`*Lt` suffix columns
- Token pattern: 32-char nanoid with 14-day expiry

### Integration Points
- Proposal detail page → "Create Agreement" button
- Workspace settings → Agreement templates management
- Client portal route → `/c/:token`
- Dokobit webhooks → status updates

</code_context>

<specifics>
## Specific Ideas

- **3-click target**: Landing → Review content → Click sign button (no intermediate pages)
- **Professional look**: Agency logo prominent, Inter fonts for documents
- **Lithuania first**: Default to LT locale, EN toggle always available
- **Mobile signing**: Many clients sign on phone via SMS link

</specifics>

<deferred>
## Deferred Ideas

- Email templates for signing invitations (P60+ scope)
- Automated reminders for unsigned agreements (P60+ scope)
- Agreement analytics dashboard (future phase)
- Multiple document types (NDA, addendum) — templates foundation in place

</deferred>

---

*Phase: 59-agreement-excellence*
*Context gathered: 2026-05-02*
