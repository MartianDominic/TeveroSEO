---
phase: 59-agreement-excellence
plan: 04
subsystem: apps/web
tags: [contract-page, signing, dokobit, i18n, mobile-first]
dependency_graph:
  requires: [59-01, 59-02]
  provides: [contract-viewing, signing-initiation, language-toggle]
  affects: [open-seo-main/api/contracts]
tech_stack:
  added: []
  patterns: [server-actions, next-intl, dompurify-sanitization]
key_files:
  created:
    - apps/web/src/app/[locale]/c/[token]/actions.ts
    - apps/web/src/app/[locale]/c/[token]/layout.tsx
    - apps/web/src/app/[locale]/c/[token]/page.tsx
    - apps/web/src/components/contract/ContractViewer.tsx
    - apps/web/src/components/contract/LanguageToggle.tsx
    - apps/web/src/components/contract/ProgressIndicator.tsx
    - apps/web/src/components/contract/SignatureSection.tsx
    - apps/web/src/components/contract/SigningButtons.tsx
    - apps/web/src/components/contract/ConsentCheckbox.tsx
    - apps/web/src/components/contract/index.ts
  modified: []
decisions:
  - Used window.location.href for locale switching to avoid Next.js router type issues
  - DOMPurify sanitization with restricted ALLOWED_TAGS for XSS prevention
  - Server actions call open-seo-main API for contract data and signing
metrics:
  duration: 3m 37s
  completed: 2026-05-02T14:27:00Z
  tasks_completed: 3
  files_created: 10
---

# Phase 59 Plan 04: Client Contract Page Summary

Client-facing contract viewing page at `/c/:token` with server actions for contract operations and 6 UI components for viewing, language switching, progress tracking, and signing initiation.

## One-liner

Public contract page with EN/LT toggle, DOMPurify-sanitized content viewer, multi-signer progress indicator, and Dokobit signing integration via Smart-ID/Mobile-ID.

## Tasks Completed

| Task | Name | Status | Files |
|------|------|--------|-------|
| 1 | Server Actions for Contract Operations | Done | actions.ts |
| 2 | Contract Page and Layout | Done | page.tsx, layout.tsx |
| 3 | Contract UI Components (6 components) | Done | 6 component files + index.ts |

## Implementation Details

### Task 1: Server Actions

Created 4 server actions in `apps/web/src/app/[locale]/c/[token]/actions.ts`:

- `getContractByToken(token)` - Fetches contract data via open-seo-main API, validates token expiry
- `markContractViewed(token)` - Fire-and-forget to update signer viewedAt timestamp
- `initiateSigning(token, method)` - Creates Dokobit signing session, returns redirect URL
- `checkSigningStatus(token)` - Polling endpoint for signing status

All actions call the open-seo-main backend API at `/api/contracts/public/{token}/*`.

### Task 2: Contract Page and Layout

**Layout** (`layout.tsx`):
- Minimal public layout with no authentication
- Provides NextIntlClientProvider for i18n in client components
- Awaits params Promise per Next.js 15 pattern

**Page** (`page.tsx`):
- Server component that fetches contract by token
- Handles error states (expired, not_found, network_error) with user-friendly ContractError component
- Calls markContractViewed on load (fire and forget)
- Renders all 4 components: LanguageToggle, ProgressIndicator, ContractViewer, SignatureSection
- Mobile-first responsive design per D-17

### Task 3: Contract UI Components

| Component | Purpose |
|-----------|---------|
| `ContractViewer` | Displays contract sections with DOMPurify.sanitize() per T-59-04-04 |
| `LanguageToggle` | EN/LT switcher using window.location.href for locale switching |
| `ProgressIndicator` | Sequential mode step indicators with icons, parallel mode message |
| `SignatureSection` | Combines consent checkbox and signing buttons based on signer status |
| `SigningButtons` | Smart-ID, Mobile-ID, ID Card buttons calling initiateSigning |
| `ConsentCheckbox` | Legal consent with i18n text, required before signing per D-20 |

## Security Mitigations

| Threat ID | Mitigation |
|-----------|------------|
| T-59-04-01 (Spoofing) | Token validation via API - checks exists, not expired |
| T-59-04-02 (Tampering) | Content from DB (trusted), variables resolved server-side |
| T-59-04-03 (Info Disclosure) | Only return data for valid, non-expired token |
| T-59-04-04 (XSS) | DOMPurify.sanitize() with restricted ALLOWED_TAGS |
| T-59-04-05 (DoS) | 32-char nanoid entropy, rate limiting at edge |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed router.push to window.location.href**
- **Found during:** Task 3 - LanguageToggle component
- **Issue:** Next.js strict route typing rejected dynamic locale routes
- **Fix:** Used window.location.href instead of router.push for locale switching
- **Files modified:** LanguageToggle.tsx

## Dependencies on Backend API

This plan creates the frontend components but requires backend API endpoints in open-seo-main:

- `GET /api/contracts/public/{token}` - Returns ContractData
- `POST /api/contracts/public/{token}/viewed` - Marks signer as viewed
- `POST /api/contracts/public/{token}/sign` - Initiates Dokobit session
- `GET /api/contracts/public/{token}/status` - Returns signing status

These endpoints should be created in a future plan (59-05 or 59-06).

## Verification

- [x] All 10 files created successfully
- [x] TypeScript compilation passes for all contract files
- [x] DOMPurify sanitization implemented with restricted tags
- [x] i18n keys used from existing agreement.json (en/lt)
- [x] Mobile-first responsive layout applied
- [x] Consent checkbox required before signing buttons enable

## Self-Check: PASSED

All created files exist:
- apps/web/src/app/[locale]/c/[token]/actions.ts - FOUND
- apps/web/src/app/[locale]/c/[token]/layout.tsx - FOUND
- apps/web/src/app/[locale]/c/[token]/page.tsx - FOUND
- apps/web/src/components/contract/ContractViewer.tsx - FOUND
- apps/web/src/components/contract/LanguageToggle.tsx - FOUND
- apps/web/src/components/contract/ProgressIndicator.tsx - FOUND
- apps/web/src/components/contract/SignatureSection.tsx - FOUND
- apps/web/src/components/contract/SigningButtons.tsx - FOUND
- apps/web/src/components/contract/ConsentCheckbox.tsx - FOUND
- apps/web/src/components/contract/index.ts - FOUND
