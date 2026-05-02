# Phase 59 Plan 01: Schema + i18n Foundation Summary

**Completed:** 2026-05-02
**Duration:** 5.1 minutes
**Tasks:** 3/3 complete

## One-liner

Multi-signer agreement schema with workspace scoping, sequential/parallel signing order, and EN/LT i18n translations.

## Files Created

| File | Purpose |
|------|---------|
| `open-seo-main/src/db/schema/agreement-signers-schema.ts` | agreementSigners and signatureRequirements tables with status state machine |
| `open-seo-main/locales/en/agreement.json` | EN agreement translations for viewer, success, status, editor, create |
| `open-seo-main/locales/lt/agreement.json` | LT agreement translations |
| `apps/web/src/i18n/locales/en/agreement.json` | EN agreement translations for Next.js app |
| `apps/web/src/i18n/locales/lt/agreement.json` | LT agreement translations for Next.js app |

## Files Modified

| File | Changes |
|------|---------|
| `open-seo-main/src/db/agreement-template-schema.ts` | Added workspaceId (nullable for system templates), clauseOrder jsonb array, isDefault flag, allowPreSigning boolean, defaultSigningOrder text with check constraint |
| `open-seo-main/src/db/schema.ts` | Added export for agreement-signers-schema (already present from prior run) |

## Key Decisions

1. **Workspace Scoping (D-01):** Templates with `workspaceId: null` are system templates available to all workspaces
2. **Signing Order (D-07, D-08):** `signingOrder = 0` means parallel signing, `signingOrder = 1, 2, 3` means sequential
3. **Status State Machine (D-05):** pending -> invited -> viewed -> signing -> signed | declined
4. **i18n Directory Structure:** Created new `locales/en/` and `locales/lt/` directories alongside existing `src/i18n/locales/` files to allow namespace-based loading

## Schema Details

### agreementTemplates (Extended)

New columns:
- `workspaceId` - nullable FK to organization, enables workspace-specific templates
- `clauseOrder` - jsonb array for drag-and-drop clause ordering
- `isDefault` - boolean flag for default template per workspace
- `allowPreSigning` - boolean for provider-first signing flow
- `defaultSigningOrder` - text with check constraint for 'sequential' | 'parallel'

New index: `ix_agreement_templates_workspace`
New constraint: `chk_default_signing_order`

### signatureRequirements (New)

Template-level configuration for required signers:
- `templateId` - FK to agreementTemplates
- `role` - 'provider' | 'client'
- `label`, `labelEn`, `labelLt` - localized requirement labels
- `defaultTitle`, `defaultTitleEn`, `defaultTitleLt` - default job titles
- `signingOrder` - integer for sequential/parallel ordering
- `isRequired` - boolean

### agreementSigners (New)

Individual signers assigned to a generated agreement:
- `agreementId` - FK to generatedAgreements
- `requirementId` - FK to signatureRequirements (nullable)
- `role`, `name`, `email`, `title`, `companyName` - signer details
- `signingOrder` - integer for this specific agreement
- `status` - pending/invited/viewed/signing/signed/declined
- `invitedAt`, `viewedAt`, `signedAt`, `declinedAt` - lifecycle timestamps
- `accessToken` - unique token for signing link (D-06)
- `tokenExpiresAt` - 14-day expiry
- `dokobitSessionId`, `signatureData` - Dokobit integration
- `signedFromIp`, `signedUserAgent` - audit trail

Indexes: agreement, token, status, dokobit_session

## Deviations from Plan

None - plan executed exactly as written.

## Build Verification

Schema files compile and export correctly. Pre-existing build errors in the codebase (unused @ts-expect-error directives, ESLint errors in DeleteSectionDialog.tsx) are unrelated to this plan's changes.

## Self-Check

- [x] `open-seo-main/src/db/agreement-template-schema.ts` - FOUND
- [x] `open-seo-main/src/db/schema/agreement-signers-schema.ts` - FOUND
- [x] `open-seo-main/locales/en/agreement.json` - FOUND
- [x] `open-seo-main/locales/lt/agreement.json` - FOUND
- [x] `apps/web/src/i18n/locales/en/agreement.json` - FOUND
- [x] `apps/web/src/i18n/locales/lt/agreement.json` - FOUND
- [x] Schema export in schema.ts - FOUND

## Self-Check: PASSED
