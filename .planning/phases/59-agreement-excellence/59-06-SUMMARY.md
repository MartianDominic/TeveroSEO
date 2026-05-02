---
phase: 59-agreement-excellence
plan: 06
subsystem: agreements
tags: [pre-signing, signer-management, email-notifications, magic-links]
dependency_graph:
  requires: [59-01, 59-02]
  provides: [pre-signing-flow, signer-notification-service]
  affects: [agreement-workflow, signing-invitations]
tech_stack:
  added: ["@radix-ui/react-radio-group"]
  patterns: [server-actions, drag-and-drop, email-templates]
key_files:
  created:
    - apps/web/src/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/page.tsx
    - apps/web/src/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/actions.ts
    - apps/web/src/components/agreement/PreSigningForm.tsx
    - apps/web/src/components/agreement/SignerList.tsx
    - apps/web/src/components/agreement/AddSignerDialog.tsx
    - apps/web/src/components/agreement/index.ts
    - open-seo-main/src/server/features/agreements/services/SignerNotificationService.ts
  modified:
    - apps/web/src/components/ui/radio-group.tsx
    - apps/web/src/i18n/locales/en/agreement.json
    - apps/web/src/i18n/locales/lt/agreement.json
decisions:
  - "D-06 compliance: 32-char nanoid tokens with 14-day expiry for magic links"
  - "D-07 compliance: Sequential mode sends to signers in order (provider first)"
  - "D-08 compliance: Parallel mode sends to all signers simultaneously"
  - "D-16 compliance: Magic links use /c/{token} format for client contract page"
  - "Server actions call open-seo-main API rather than direct DB access"
  - "RadioGroup component added to apps/web (was missing from @tevero/ui)"
metrics:
  duration: "7 minutes"
  completed: "2026-05-02T14:39:13Z"
  tasks_completed: 3
  files_created: 7
  files_modified: 3
---

# Phase 59 Plan 06: Pre-Signing Flow Summary

Pre-signing flow with admin signer configuration, signing mode selection, and email invitation system with magic links.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RadioGroup component missing from @tevero/ui**
- **Found during:** Task 3
- **Issue:** The plan referenced `RadioGroup` from `@tevero/ui` but the component was not exported
- **Fix:** Created RadioGroup component in `apps/web/src/components/ui/radio-group.tsx` using @radix-ui/react-radio-group
- **Files modified:** apps/web/src/components/ui/radio-group.tsx
- **Dependency added:** @radix-ui/react-radio-group

**2. [Rule 3 - Blocking] SignerNotificationService location**
- **Found during:** Task 2
- **Issue:** Plan specified `apps/web/src/server/services/` but apps/web doesn't have direct database access
- **Fix:** Created service in `open-seo-main/src/server/features/agreements/services/` following existing patterns
- **Rationale:** Email sending belongs in backend (open-seo-main) where Resend is already installed

## Completed Tasks

### Task 1: Pre-Signing Server Actions
Created server actions for pre-signing configuration in apps/web:
- `getPreSigningData`: Fetches agreement and signers from API
- `addSigner`: Adds new signer with next available signingOrder
- `removeSigner`: Removes signer by ID (cannot remove signed signers)
- `updateSigningOrder`: Batch updates signingOrder based on array position
- `updateSigningMode`: Switches between sequential/parallel modes
- `sendInvitations`: Triggers invitation sending via API

All actions call open-seo-main API endpoints rather than direct DB access.

### Task 2: Signer Notification Service
Created `SignerNotificationService` in open-seo-main with:
- `sendSigningInvitation`: Sends magic link email to signer
- `sendReminder`: Sends reminder with days remaining
- `sendSignedConfirmation`: Sends confirmation after successful signing
- `getMagicLink`: Builds URL as `{baseUrl}/{locale}/c/{token}` per D-16

Features:
- HTML email templates with inline styles
- EN/LT locale support with localized content
- Professional styling matching v6 design system colors
- Uses existing Resend integration from open-seo-main

### Task 3: Pre-Signing UI Components
Created pre-signing page and components:

**PreSignPage** (`page.tsx`):
- Server component that fetches pre-signing data
- Renders error state if agreement not found
- Passes data to PreSigningForm

**PreSigningForm**:
- Signing mode selection (sequential/parallel) with RadioGroup
- SignerList management with add/remove
- Send invitations button with success/error states
- Success state shows confirmation message

**SignerList**:
- Drag-and-drop reordering using @dnd-kit (sequential mode only)
- Order numbers displayed in sequential mode
- Status badges: Pending, Invited, Viewed, Signed, Declined
- Role badges: Provider, Client
- Remove button (disabled for signed signers)

**AddSignerDialog**:
- Modal form for adding signers
- Fields: Name (required), Email (required), Phone, Title, Role
- Role selection: Provider or Client
- Form validation with disabled submit until valid

## i18n Updates
Added `preSigning` and `common` translation keys to:
- `apps/web/src/i18n/locales/en/agreement.json`
- `apps/web/src/i18n/locales/lt/agreement.json`

## Build Verification
- All new TypeScript files compile without errors
- Pre-existing ESLint errors in other files are out of scope
- RadioGroup dependency installed via pnpm

## Known Stubs
None - all components are fully implemented with API integration.

## API Endpoints Required (Backend)
The server actions expect these API endpoints in open-seo-main:
- `GET /api/agreements/:id/pre-sign` - Get pre-signing data
- `POST /api/agreements/:id/signers` - Add signer
- `DELETE /api/agreements/:id/signers/:signerId` - Remove signer
- `PUT /api/agreements/:id/signing-order` - Update signing order
- `PUT /api/agreements/:id/signing-mode` - Update signing mode
- `POST /api/agreements/:id/send-invitations` - Send invitations

These endpoints should be implemented in a subsequent plan (59-07 or later).

## Self-Check: PASSED
- All created files exist and compile
- SignerNotificationService available for use by MultiSignerOrchestrator
- UI components ready for integration with backend API
