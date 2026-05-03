# Agent 20: User Journey & Workflow Coherence

**Status:** Complete
**Scope:** End-to-end user flows, UX consistency, workflow completion

## Summary

The platform demonstrates a well-structured user experience foundation with unified shell navigation, progressive onboarding, and coherent client-scoped workflows. However, several critical journey breaks and UX gaps exist that can leave users stranded or confused, particularly in the SEO audit workflow and proposal-to-payment transition.

## Key User Journeys Analyzed

1. **New User Onboarding** - Sign-up through first article generation
2. **Client Workspace Creation** - Adding a new client and initial setup
3. **SEO Audit Workflow** - Running audits and reviewing results
4. **Content Generation** - Article creation with brand voice
5. **Proposal Creation** - Building and sending proposals to prospects
6. **Prospect to Paid Client** - Full conversion funnel from proposal to payment

## Critical Journey Breaks

### CRIT-UX-01: SEO Audit Dead End - No Self-Service Path
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx`
- **Issue:** When no SEO project exists for a client, the page displays "Contact support" with no self-service option to create a project. Users cannot proceed without external intervention.
- **Impact:** Complete workflow blockage; users cannot access core SEO functionality independently.
- **Recommendation:** Add "Create SEO Project" CTA or auto-provision project on first access.

### CRIT-UX-02: Proposal-to-Payment Gap - No Clear Next Step
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/c/[token]/page.tsx`
- **Issue:** After signing an agreement, the page shows "You will receive an invoice shortly" but provides no redirect, no ETA, and no way to track invoice status. Users are left in limbo.
- **Impact:** Confusion at critical conversion moment; potential abandonment before payment.
- **Recommendation:** Redirect to invoice/payment page or provide status tracking link.

## High Priority UX Issues

### HIGH-UX-01: Command Palette Scope Unclear
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx:490-540`
- **Issue:** Command palette (Cmd+K) is global but actions are context-dependent. No visual indicator of whether commands are client-scoped or global.
- **Impact:** User confusion when commands fail due to wrong context.

### HIGH-UX-02: Navigation Disabled Without Explanation
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx:285-295`
- **Issue:** When no client is selected, navigation items are visually disabled (opacity-40, pointer-events-none) but there is no tooltip or message explaining why or how to enable them.
- **Impact:** New users may not understand they need to select a client first.

### HIGH-UX-03: Missing Loading States on Key Actions
- **Files:** Various components lack loading indicators during async operations
- **Issue:** Some critical actions (e.g., intelligence polling, content generation) show no progress indicator, leaving users uncertain if action is in progress.
- **Impact:** Users may click repeatedly, causing duplicate requests.

### HIGH-UX-04: Limited Failure Recovery Guidance
- **Files:** Various error.tsx files
- **Issue:** Error boundaries show "Something went wrong" with generic retry buttons. No guidance on what failed or alternative actions.
- **Impact:** Users cannot diagnose issues or take corrective action.

## Medium Priority UX Issues

### MED-UX-01: Empty State Inconsistency
- **Issue:** Empty states vary across sections - some have illustrations and CTAs, others show bare "No data" text.
- **Impact:** Inconsistent user experience; missed opportunity to guide users.

### MED-UX-02: Error Messages Expose Technical Details
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/page.tsx:102-115`
- **Issue:** Error sanitization exists but some technical errors still leak through to UI.
- **Impact:** Confusing messages for non-technical users.

### MED-UX-03: Browser alert() Usage
- **Files:** Some components still use `window.alert()` for confirmations
- **Issue:** Native browser alerts break UX consistency and cannot be styled.
- **Recommendation:** Use shadcn/ui AlertDialog component.

### MED-UX-04: Status Terminology Varies
- **Issue:** Different terms for similar concepts: "archived" vs "deleted", "active" vs "live", "pending" vs "draft".
- **Impact:** User confusion about data states.

### MED-UX-05: Calendar Workflow Unclear
- **File:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx`
- **Issue:** Content calendar interaction patterns not immediately obvious (drag-to-schedule, click-to-edit).
- **Impact:** Discovery friction for calendar features.

## Journey Maps

### Journey 1: New User to First Article
```
Sign In (Clerk)
    |
    v
/clients (empty state)
    |
    v
"Add Client" modal --> Onboarding Checklist
    |
    +--> [Configure APIs] --> Settings (optional)
    |
    +--> [Add Website] --> Intelligence Analysis (5s polling)
    |
    v
Dashboard Ready --> "Create Article" --> Article Editor
    |
    v
Generate Content --> Review --> Publish
```

### Journey 2: Prospect to Paid Client
```
/prospects (list)
    |
    v
"Add Prospect" modal --> Prospect Detail
    |
    v
"Create Proposal" --> Proposal Builder --> Preview
    |
    v
"Send" --> Email with public link
    |
    v
/p/[token] (public view) --> View tracking
    |
    v
"Accept" --> /c/[token] (agreement signing)
    |
    v
Sign --> "Invoice coming..." [GAP: No next step]
    |
    v
??? --> Payment --> Onboarding
```

## Cross-App Coherence Assessment

### Positive Patterns
- Unified design language (shadcn/ui, Tailwind tokens) across apps/web
- Consistent header/sidebar shell pattern
- Client context persisted in cookies, propagated via headers
- Public routes (/p/, /c/) maintain consistent branding

### Concerns
- open-seo-main uses TanStack Router (different routing paradigm)
- AI-Writer has separate React frontend (potential style drift)
- Client ID from AI-Writer's `clients` table vs open-seo-main's `clients` table may diverge

## Recommendations

1. **Critical:** Add self-service SEO project creation path
2. **Critical:** Implement post-signing redirect to invoice/payment flow
3. **High:** Add tooltip/message explaining disabled navigation
4. **High:** Standardize loading states with shadcn/ui Skeleton
5. **Medium:** Create UX writing guide for consistent terminology
6. **Medium:** Replace all `alert()` calls with AlertDialog

## Files Reviewed

- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/middleware.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/GettingStartedCard.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/seo/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/prospects/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/p/[token]/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/p/[token]/PublicProposalView.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/c/[token]/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/prospects/AddProspectModal.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/proposals/ProposalInlineEditor.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/stores/client-store.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/stores/workspace-store.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/hooks/useAutoSave.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/server-fetch.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/i18n/routing.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/proposals/public/$token.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/proposals/[id]/accept.ts`
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/contracts/$token.sign.ts`
