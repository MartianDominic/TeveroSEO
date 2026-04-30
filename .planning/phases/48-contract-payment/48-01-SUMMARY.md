---
phase: 48-contract-payment
plan: 01
subsystem: contract-generation
tags: [e-signature, dokobit, pdf-generation, state-machine]
dependencies:
  requires: [proposal-schema, contract-schema, activity-schema]
  provides: [ContractService, ContractPdfGenerator, DokobitService]
  affects: [proposal-lifecycle, payment-pipeline]
tech-stack:
  added: [pdf-lib@1.17.1, dokobit-api]
  patterns: [state-machine, activity-logging, TDD-cycle]
key-files:
  created:
    - open-seo-main/src/server/features/contracts/services/ContractService.ts
    - open-seo-main/src/server/features/contracts/services/ContractService.test.ts
    - open-seo-main/src/server/features/contracts/services/ContractPdfGenerator.ts
    - open-seo-main/src/server/features/contracts/services/ContractPdfGenerator.test.ts
    - open-seo-main/src/server/features/contracts/services/DokobitService.ts
    - open-seo-main/src/server/features/contracts/services/DokobitService.test.ts
    - open-seo-main/src/routes/api/contracts/-create.ts
    - open-seo-main/src/routes/api/contracts/$contractId.-send.ts
  modified:
    - open-seo-main/src/shared/error-codes.ts
    - open-seo-main/src/server/lib/runtime-env.ts
decisions:
  - id: D-48-01-01
    choice: Use pdf-lib for contract PDF generation instead of Puppeteer
    rationale: pdf-lib already in stack from proposal signing, faster for structured documents, no headless browser dependency
  - id: D-48-01-02
    choice: Dokobit environment variables optional at startup
    rationale: Allows development/testing without Dokobit credentials, fails at runtime when feature used
  - id: D-48-01-03
    choice: State machine enforces draft -> sent only, no backward transitions
    rationale: Contract signing is unidirectional, prevents data inconsistency
metrics:
  duration_seconds: 545
  tasks_completed: 4
  files_created: 8
  files_modified: 2
  tests_added: 24
  lines_added: 1500
completed_at: "2026-04-30T11:05:31Z"
---

# Phase 48 Plan 01: Contract Generation with E-Signature Summary

Contract generation from accepted proposals with state machine, PDF generation, and Dokobit e-signature session creation.

## One-liner

State-machine-controlled contract lifecycle with pdf-lib PDF generation and Dokobit API integration for e-signature sessions.

## What Was Built

### Services

**ContractService** - State machine + lifecycle management
- `VALID_TRANSITIONS` map (draft -> sent -> signed -> executed)
- `canTransition(from, to)` validator
- `createFromProposal(proposalId, workspaceId)` - converts ProposalContent to ContractContent
- `sendForSigning(contractId, workspaceId, actorId?)` - generates PDF, creates Dokobit session, transitions to "sent"
- Activity logging via ActivityRepository for all state changes
- 10 tests covering state machine, transitions, error paths

**ContractPdfGenerator** - PDF creation using pdf-lib
- `generateContractPdf(input)` - creates multi-page A4 PDF with sections, terms, signatures
- Text wrapping at 80 chars per line
- Automatic page breaks when content exceeds page height
- Professional formatting with title (24pt), section headers (14pt), body (11pt)
- 5 tests covering Buffer output, PDF magic bytes, multi-page rendering

**DokobitService** - E-signature API client
- `createSigningSession(contractId, pdfBuffer, webhookUrl)` - uploads PDF, returns session ID + signing URL
- `downloadSignedDocument(sessionId)` - retrieves signed PDF after webhook completion
- Base64 PDF encoding for API transmission
- IP whitelisting security (Dokobit lacks HMAC signatures)
- 9 tests covering success, auth errors, API errors, payload validation

### API Routes

**POST /api/contracts/create** - Create contract from proposal
- Requires authentication (API key or Clerk JWT)
- Zod schema validation: `{ proposalId: string }`
- Returns 201 with contract data on success
- Error handling: 401 (unauth), 403 (forbidden), 404 (not found), 400 (validation), 500 (server)

**POST /api/contracts/:contractId/send** - Send for e-signature
- Requires authentication
- Transitions contract from draft to sent
- Returns contract + signingUrl for client redirect
- Error handling: 409 for invalid state transitions (CONTRACT_INVALID_STATE)

### Infrastructure

**Error Codes** - Added to error-codes.ts
- `DOKOBIT_API_ERROR` - Dokobit API failures
- `CONTRACT_INVALID_STATE` - State machine violations

**Environment Variables** - Added to runtime-env.ts
- `DOKOBIT_ACCESS_TOKEN` (optional, required for signing features)
- `DOKOBIT_API_URL` (optional, defaults to https://beta.dokobit.com)
- `DOKOBIT_WEBHOOK_URL` (optional, for postback configuration)

## Deviations from Plan

None - plan executed exactly as written.

TDD workflow followed for Task 1:
- RED: Created failing tests for ContractService (10 tests)
- GREEN: Implemented ContractService to pass all tests
- REFACTOR: N/A (implementation clean from start)

## Key Architectural Patterns

**State Machine with Optimistic Locking**
```typescript
const [updated] = await db
  .update(contracts)
  .set({ status: toState, updatedAt: new Date(), ...additionalFields })
  .where(and(eq(contracts.id, contractId), eq(contracts.status, fromState)))
  .returning();

if (!updated) {
  throw new AppError("CONFLICT", "Contract status changed by another request");
}
```

**Activity Logging for Audit Trail**
```typescript
await ActivityRepository.recordStatusChange(
  workspaceId,
  "contract",
  contractId,
  "draft",
  "sent",
  actorId
);
```

**ProposalContent to ContractContent Conversion**
```typescript
function proposalToContractContent(content: ProposalContent, companyName: string): ContractContent {
  const sections = [
    { title: "Service Overview", body: `${companyName} agrees to provide...` },
    { title: "Scope of Work", body: content.investment.inclusions.join(". ") },
    // ...
  ];
  return { sections, terms, signatures };
}
```

## Testing Summary

| Test File | Tests | Coverage |
|-----------|-------|----------|
| ContractService.test.ts | 10 | State machine, transitions, createFromProposal, sendForSigning |
| ContractPdfGenerator.test.ts | 5 | PDF generation, multi-page, Buffer output, magic bytes |
| DokobitService.test.ts | 9 | API success, auth errors, API errors, payload format |

**Total:** 24 tests, all passing

## Integration Points

**Upstream (Inputs)**
- Proposal schema (`ProposalContent`) from Phase 46-47
- Contract schema (`ContractStatus`, `ContractContent`) from Phase 45
- Activity schema (`EntityType`, `ActivityType`) from Phase 45

**Downstream (Outputs)**
- Contract state "sent" triggers Phase 48-02 webhook handling
- Dokobit signing URL used in Phase 48-02 client UI
- Activity feed consumed by Phase 49-51 onboarding dashboard

## Known Limitations

1. **Dokobit credentials required at runtime** - Development/testing without Dokobit access token will fail when calling `sendForSigning`. Consider adding mock mode or test credentials.

2. **Hardcoded workspace/client names in PDF** - `generateContractPdf` uses placeholders "TeveroSEO" and "Client". Should fetch from workspace settings and contract.clientId.

3. **No multi-signer support** - Current implementation assumes single signer (client). Enterprise contracts may require multiple signatories (client + agency).

4. **IP whitelisting not implemented** - DokobitService documented but webhook endpoint (Plan 48-02) must verify source IP against Dokobit whitelist.

## Security Considerations

**Mitigations Implemented:**
- T-48-01: Authentication required via `requireApiAuth` on all contract endpoints (Clerk JWT or API key)
- T-48-02: State machine with optimistic locking prevents race conditions in status updates
- T-48-03: Dokobit access token stored in environment variable, not logged
- T-48-05: workspaceId from auth session used in all queries, contracts scoped to workspace

**Accepted Risks:**
- T-48-04: pdf-lib is synchronous (DoS potential) - acceptable for MVP, defer to worker queue if volume increases

## Next Steps (Phase 48-02)

1. Implement Dokobit webhook handler at `/api/webhooks/dokobit`
2. Add IP whitelisting middleware for Dokobit webhook security
3. Download signed PDF via `DokobitService.downloadSignedDocument`
4. Transition contract status from "sent" to "signed"
5. Trigger invoice creation (Phase 48-03)

## Self-Check: PASSED

**Files Created:**
- ✓ ContractService.ts exists
- ✓ ContractService.test.ts exists
- ✓ ContractPdfGenerator.ts exists
- ✓ ContractPdfGenerator.test.ts exists
- ✓ DokobitService.ts exists
- ✓ DokobitService.test.ts exists
- ✓ /api/contracts/-create.ts exists
- ✓ /api/contracts/$contractId.-send.ts exists

**Commits:**
- ✓ cfbf0f572 - test(48-01): add failing tests for ContractService state machine
- ✓ 2fbbc2a46 - feat(48-01): implement ContractPdfGenerator with pdf-lib
- ✓ e2e2783b2 - feat(48-01): implement DokobitService for e-signature API integration
- ✓ 11bd17ad9 - feat(48-01): create API routes for contract creation and sending

**Tests:**
- ✓ ContractService: 10/10 passing
- ✓ ContractPdfGenerator: 5/5 passing
- ✓ DokobitService: 9/9 passing
- ✓ Total: 24/24 passing
