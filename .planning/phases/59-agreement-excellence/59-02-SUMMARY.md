---
phase: 59-agreement-excellence
plan: 02
subsystem: agreements
tags: [multi-signer, dokobit, orchestration, webhooks]
dependency_graph:
  requires: [59-01-schema]
  provides: [SignerRepository, MultiSignerOrchestrator, DokobitWebhookExtension]
  affects: [agreement-signing-flow, client-contract-page]
tech_stack:
  added: []
  patterns: [repository-pattern, event-driven-orchestration]
key_files:
  created:
    - open-seo-main/src/db/schema/agreement-signers-schema.ts
    - open-seo-main/src/server/features/agreements/repositories/SignerRepository.ts
    - open-seo-main/src/server/features/agreements/services/MultiSignerOrchestrator.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/routes/api/webhooks/dokobit.ts
decisions:
  - "Created agreement-signers-schema.ts inline since Plan 59-01 not yet executed (Wave 1 parallel execution)"
  - "Used 32-char nanoid tokens with 14-day expiry per D-06 specification"
  - "Magic links use format /c/{token} per D-16 specification"
  - "Webhook checks agreement signers before falling back to contract handling"
metrics:
  duration_seconds: 446
  completed: 2026-05-02T14:21:00Z
---

# Phase 59 Plan 02: Multi-Signer Orchestration Summary

Multi-signer orchestration service with sequential/parallel signing modes and Dokobit webhook integration for agreement status callbacks.

## Files Created

### Schema (Deviation - created as dependency for this plan)
- `open-seo-main/src/db/schema/agreement-signers-schema.ts`
  - `agreementSigners` table with status state machine (pending/invited/viewed/signing/signed/declined)
  - `signatureRequirements` table for template-level signer configuration
  - Type exports: `SignerSelect`, `SignerInsert`, `SignerStatus`, `SignerSignatureData`
  - Index on `dokobitSessionId` for webhook lookup

### Repository
- `open-seo-main/src/server/features/agreements/repositories/SignerRepository.ts`
  - `findById(id)` - Get signer by ID
  - `findByAgreement(agreementId)` - Get all signers ordered by signingOrder
  - `findByToken(token)` - Get signer by non-expired access token
  - `findByDokobitSession(sessionId)` - Get signer by Dokobit session (webhook lookup)
  - `findNextPending(agreementId)` - Get next pending signer for sequential mode
  - `create(data)` - Create new signer
  - `updateStatus(signerId, status, data?)` - Transition status with timestamp
  - `setAccessToken(signerId)` - Generate 32-char nanoid with 14-day expiry
  - `setDokobitSession(signerId, sessionId)` - Link signer to Dokobit session

### Service
- `open-seo-main/src/server/features/agreements/services/MultiSignerOrchestrator.ts`
  - `processSignerCallback(signerId, status, data?)` - Handle Dokobit webhook callbacks
  - `activateNextSigner(agreementId)` - Activate next signer in sequential mode, return magic link
  - `activateAllSigners(agreementId)` - Activate all signers in parallel mode, return magic links
  - `finalizeAgreement(agreementId)` - Mark agreement as signed when all signers complete
  - `canSignerSign(signer)` - Check if signer can sign based on sequential order
  - `getSigningProgress(agreementId)` - Get signing progress stats

## Files Modified

### Schema Barrel Export
- `open-seo-main/src/db/schema.ts`
  - Added export for `./schema/agreement-signers-schema`

### Dokobit Webhook
- `open-seo-main/src/routes/api/webhooks/dokobit.ts`
  - Added imports for `SignerRepository` and `MultiSignerOrchestrator`
  - Extended webhook handler to check for agreement signers first
  - On signer match: calls `MultiSignerOrchestrator.processSignerCallback`
  - Falls back to existing contract handling if no signer found

## Key Implementation Details

### Token Generation (D-06)
- 32-character nanoid providing ~10^57 bits of entropy
- 14-day expiration window
- Unique constraint on database column

### Sequential Signing (D-07)
- `signingOrder` integer determines sequence (1, 2, 3...)
- After each signature, `activateNextSigner` finds next pending signer
- Previous signers must have status "signed" before next can proceed

### Parallel Signing (D-08)
- All signers have `signingOrder = 0`
- `activateAllSigners` generates links for all pending signers simultaneously
- Any signer can sign independently

### Magic Link Format (D-16)
- Pattern: `{APP_URL}/c/{token}`
- Example: `https://teveroseo.com/c/aBcD1234...`

## Deviations from Plan

### Created Schema File Inline
- **Reason:** Plan 59-01 (which creates the schema) had not been executed yet
- **Action:** Created `agreement-signers-schema.ts` with full schema as specified in Plan 59-01's interface block
- **Impact:** Plan 59-02 can now execute independently; Plan 59-01 may need to skip schema creation task if executed later

### Logger Error Signature Fix
- **Issue:** Initial code used `log.error(message, data)` but logger expects `log.error(message, error?, data?)`
- **Fix:** Changed to `log.error(message, undefined, data)` for correct signature

## Build Verification

```
Build completed successfully.
Total size: 42.4 MB (9.91 MB gzip)
```

All TypeScript compiles. Only unrelated `@ts-expect-error` directive warnings in other files (pre-existing).

## Self-Check: PASSED

- [x] `SignerRepository.ts` exists
- [x] `MultiSignerOrchestrator.ts` exists
- [x] `agreement-signers-schema.ts` exists
- [x] Schema exported from `schema.ts`
- [x] Webhook imports both new modules
- [x] All required methods implemented
- [x] Build succeeds
