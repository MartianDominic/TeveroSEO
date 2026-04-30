---
phase: 49-51-onboarding-dashboard
plan: "02"
title: "Checklist UI: Progress View, Item Actions, OAuth Triggers"
subsystem: apps/web/onboarding
tags: [onboarding, checklist, magic-link, oauth, white-label, ui]

dependency_graph:
  requires:
    - phase-49-01 (ChecklistCompletionService, MagicLinkService)
  provides:
    - ChecklistProgress component (overall + per-category progress)
    - ChecklistItemRow component (dual-mode actions)
    - MagicLinkButton component (generate + copy + email)
    - /connect/[token] white-label page
    - /clients/[clientId]/onboarding page
    - API routes for complete-item and magic-link
  affects:
    - Client onboarding flow
    - Agency checklist management

tech_stack:
  added: []
  patterns:
    - Client-side state with useEffect for checklist loading
    - Server action wrappers via API client functions
    - White-label branding via CSS custom properties

key_files:
  created:
    - open-seo-main/src/routes/api/onboarding/complete-item.ts
    - open-seo-main/src/routes/api/onboarding/magic-link.ts
    - apps/web/src/components/onboarding/ChecklistProgress.tsx
    - apps/web/src/components/onboarding/ChecklistItemRow.tsx
    - apps/web/src/components/onboarding/MagicLinkButton.tsx
    - apps/web/src/lib/api/onboarding.ts
    - apps/web/src/app/(shell)/clients/[clientId]/onboarding/page.tsx
  modified:
    - apps/web/src/app/connect/[token]/page.tsx (added onboarding magic link support)

decisions:
  - Merged magic link validation into existing /connect/[token] page (backward compatible with legacy invites)
  - Used client-side state for checklist to enable optimistic updates
  - CSS custom properties for accent color (--accent-color) for white-label flexibility

metrics:
  duration_minutes: 8
  completed_at: "2026-04-30T14:22:00Z"
  tasks_completed: 6
  tasks_total: 7
---

# Phase 49-51 Plan 02: Checklist UI Summary

Onboarding checklist UI with progress visualization, dual-mode credential completion, and white-label magic link pages.

## One-Liner

Agency-facing checklist view with per-category progress and client-facing white-label OAuth connection pages.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 86fd5837e | feat(49-02): create API routes for checklist completion and magic link |
| 2-4 | f6e1003f3 | feat(49-02): create onboarding UI components |
| 5-6 | 1684fe2aa | feat(49-02): create magic link page and onboarding checklist view |

## Task Breakdown

### Task 1: API Routes

Created API endpoints for checklist operations:
- `POST /api/onboarding/complete-item`: Manual item completion with auth (T-49-06)
- `POST /api/onboarding/magic-link`: Generate 24h-expiry invitation links

Both routes use Zod validation, require authentication, and return proper error responses.

### Tasks 2-4: UI Components

**ChecklistProgress** (D-04):
- Overall progress bar with percentage
- Per-category counts grid (credentials, kickoff, setup, content)
- Success variant when 100% complete

**ChecklistItemRow** (D-01, D-03):
- Visual checkbox indicator (green when complete)
- "Mark Complete" button for all items (D-03 hybrid approach)
- Credential items get dual-mode: "Send to Client" + "Connect Myself" (D-01)
- Copy-to-clipboard feedback on magic link generation

**MagicLinkButton**:
- Standalone component for generating links
- Shows generated URL with copy button
- Optional mailto: link for email sharing

### Tasks 5-6: Pages

**White-label magic link page** (`/connect/[token]`):
- Updated existing page to support onboarding magic links
- Shows agency branding (logo or name) when valid onboarding token
- OAuth buttons for GSC and GA connection
- Falls back to legacy invite flow for backward compatibility
- No platform branding visible (D-02)

**Onboarding page** (`/clients/[clientId]/onboarding`):
- Service tier display in header
- Progress bar + per-category counts
- Items grouped by category
- All action buttons wired to API endpoints

## Deviations from Plan

None - plan executed exactly as written.

## Security Considerations

Per threat model:
- **T-49-06 (Spoofing)**: Both API routes require authenticated session
- **T-49-07 (Info Disclosure)**: Branding info is public; no sensitive data exposed
- **T-49-08 (DoS)**: Rate limiting deferred to API gateway layer

## Checkpoint Status

**Task 7 is a human-verify checkpoint.** Awaiting manual verification of:
1. Progress bar and per-category counts display
2. Dual-mode buttons on credential items
3. Magic link generation and copy functionality
4. White-label branding on /connect/[token] page

## Self-Check: PASSED

All files verified:
- [x] open-seo-main/src/routes/api/onboarding/complete-item.ts exists
- [x] open-seo-main/src/routes/api/onboarding/magic-link.ts exists
- [x] apps/web/src/components/onboarding/ChecklistProgress.tsx exists
- [x] apps/web/src/components/onboarding/ChecklistItemRow.tsx exists
- [x] apps/web/src/components/onboarding/MagicLinkButton.tsx exists
- [x] apps/web/src/app/(shell)/clients/[clientId]/onboarding/page.tsx exists
- [x] Commits 86fd5837e, f6e1003f3, 1684fe2aa verified in git log
