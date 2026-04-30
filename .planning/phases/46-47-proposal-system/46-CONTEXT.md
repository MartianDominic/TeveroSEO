# Phase 46-47: Proposal System - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete proposal lifecycle from draft to accepted. Send proposals via email (Resend/Loops), track views via beacon, handle accept/reject flow, log to pipeline_activities. Includes deferred 43-06 UI (AI copywriting + recommendations) with v6 design system compliance.

</domain>

<decisions>
## Implementation Decisions

### Email Integration
- **D-01:** Use Resend as primary transactional email provider (already in stack)
- **D-02:** Loops for marketing/sequence emails if needed; Resend for transactional
- **D-03:** Email templates as React Email components (consistent with existing patterns)

### Client-Facing Proposal Page
- **D-04:** Public route at `/proposals/[token]` — no auth required, token-based access
- **D-05:** Token is nanoid (21 chars) stored in proposals table
- **D-06:** Token expires after proposal expiration date or acceptance
- **D-07:** View tracking via 1x1 beacon image on page load (records timestamp, IP hash, user agent)

### Accept/Reject Flow
- **D-08:** Accept button triggers state transition: sent → accepted
- **D-09:** Reject button triggers state transition: sent → rejected
- **D-10:** Both actions log to pipeline_activities with actor_type = 'client'
- **D-11:** Accept triggers contract generation (Phase 48 downstream)

### Proposal List UI
- **D-12:** Table view with status badges (draft, sent, viewed, accepted, rejected, expired)
- **D-13:** Quick actions: Edit (draft), Resend (sent), View (all)
- **D-14:** Filter by status, sort by date
- **D-15:** Inline view count indicator for sent proposals

### AI Copywriting (Deferred 43-06)
- **D-16:** AI generates proposal sections based on keyword analysis + scraping results
- **D-17:** Uses existing AI-Writer Claude integration (no new AI provider)
- **D-18:** Editable output — AI suggests, user refines
- **D-19:** Recommendations from Phase 43 AI selector discovery flow into proposal

### v6 Design Compliance
- **D-20:** All UI uses Phase 44 component library (design tokens, components)
- **D-21:** Proposal cards use EntityCard pattern
- **D-22:** Status badges use existing v6 status configuration
- **D-23:** Forms use shadcn/ui form components with v6 token styling

### Claude's Discretion
- Loading states and skeleton patterns (from Phase 44 components)
- Error handling UI patterns
- Mobile responsiveness approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `.planning/design/design-system-v6.md` — v6 design tokens and patterns
- `.planning/design/gsd-phase0-component-library.md` — Component specifications

### Schema Foundation
- `open-seo-main/src/db/contract-schema.ts` — Contract table for downstream integration
- `open-seo-main/src/db/activity-schema.ts` — pipeline_activities for logging
- `open-seo-main/src/server/features/contracts/repositories/ActivityRepository.ts` — Activity logging API

### Existing Patterns
- `open-seo-main/src/server/features/prospects/` — Prospect services pattern
- `apps/web/src/app/(shell)/clients/` — Client page patterns

### Deferred 43-06
- `.planning/phases/43-prospect-keyword-pipeline/43-06-PLAN.md` — Deferred proposal generation UI

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/ui/src/components/` — All v6 components from Phase 44
- `open-seo-main/src/server/features/contracts/repositories/` — Repository pattern from Phase 45
- `open-seo-main/src/db/proposal-schema.ts` — Existing proposals table (if exists)
- Resend integration in AI-Writer backend

### Established Patterns
- Repository functions with namespace exports (ContractRepository pattern)
- Zod validation schemas for API inputs
- Server actions in apps/web for Next.js integration
- BullMQ for background jobs (email sending could be async)

### Integration Points
- `/clients/[id]/proposals/` — Proposal management routes
- `/proposals/[token]` — Public client-facing route (outside shell)
- `pipeline_activities` table for all state change logging
- Email templates in shared package or Next.js

</code_context>

<specifics>
## Specific Ideas

- Proposal view page should feel professional — like DocuSign or PandaDoc style
- View tracking should be subtle (beacon, not intrusive)
- AI recommendations should highlight value (SEO opportunities discovered)
- Accept flow should feel celebratory (confetti? success animation?)

</specifics>

<deferred>
## Deferred Ideas

- Proposal templates library (future phase)
- Multi-signer proposals (enterprise feature)
- Proposal analytics dashboard (views over time, A/B testing)
- Custom branding per workspace on proposal pages

</deferred>

---

*Phase: 46-47-proposal-system*
*Context gathered: 2026-04-30*
