---
phase: 48-contract-payment
plan: 02
subsystem: webhook-handling-ui
tags: [dokobit-webhook, idempotency, ui-components, v6-design]
dependencies:
  requires: [contract-schema, DokobitService, ContractService]
  provides: [webhook-utils, dokobit-webhook-handler, ContractTable, SignatureStatus]
  affects: [contract-lifecycle, ui-navigation]
tech-stack:
  added: []
  patterns: [ip-verification, idempotent-webhooks, badge-status-ui]
key-files:
  created:
    - open-seo-main/src/db/webhook-schema.ts (extended with incomingWebhookEvents)
    - open-seo-main/src/server/lib/webhook-utils.ts
    - open-seo-main/src/routes/api/webhooks/dokobit.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/actions.ts
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/components/ContractTable.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/contracts/components/SignatureStatus.tsx
  modified:
    - open-seo-main/src/db/index.ts
    - open-seo-main/src/server/features/contracts/services/ContractService.ts
    - open-seo-main/src/server/lib/storage.ts
decisions:
  - id: D-48-02-01
    choice: Extended existing webhook-schema.ts instead of replacing it
    rationale: Phase 18.5 webhook schema is for outgoing webhooks; added incomingWebhookEvents table for incoming webhooks (Dokobit, Stripe)
  - id: D-48-02-02
    choice: IP whitelist verification for Dokobit webhooks
    rationale: Dokobit does not provide HMAC signatures; IP whitelisting is the recommended security pattern per research
  - id: D-48-02-03
    choice: Generic saveFile function in storage.ts
    rationale: Existing storage.ts focused on branding assets; added generic file storage for signed PDFs and future contract documents
metrics:
  duration_seconds: 497
  tasks_completed: 3
  files_created: 7
  files_modified: 3
  tests_added: 0
  lines_added: 750
completed_at: "2026-04-30T11:20:21Z"
---

# Phase 48 Plan 02: Webhook Handler & Contract UI Summary

Dokobit webhook handling with IP verification, signed PDF storage, and contract management UI components.

## One-liner

IP-verified Dokobit webhook handler with idempotent processing, signed PDF storage in workspace directories, and v6-compliant ContractTable + SignatureStatus UI.

## What Was Built

### Backend - Webhook Infrastructure

**incomingWebhookEvents Table** - Idempotency tracking for external webhooks
- Primary key: `eventId` (generated from source + session + status)
- Columns: `eventType`, `source` (dokobit/stripe), `status` (processing/processed/failed)
- Indexes on type, source, status for efficient lookups
- Separate from existing Phase 18.5 outgoing webhooks schema

**webhook-utils.ts** - Shared webhook processing utilities
- `verifyDokobitIp(clientIp)` - IP whitelist verification (185.44.192.0/24, 52.58.0.0/16)
- `isIpInRange(ip, cidr)` - CIDR range matching with bitwise operations
- `processWebhookIdempotently(eventId, handler)` - Atomic event processing with status tracking
- Development mode allows localhost (127.0.0.1, ::1) for testing

**DokobitService.handleSigningComplete** - Webhook callback handler
- Finds contract by `dokobitSessionId`
- Downloads signed PDF via `DokobitService.downloadSignedDocument`
- Stores signed PDF in `contracts/{workspaceId}/{contractId}/signed.pdf`
- Transitions contract status: sent → signed
- Records activity log for audit trail
- Returns updated contract with `signedAt`, `signedPdfUrl`, `signerName`

**storage.saveFile** - Generic workspace-scoped file storage
- Validates path (no `..` or leading `/` for traversal prevention)
- Creates directory structure recursively
- Stores files relative to `DATA_DIR` (defaults to `{cwd}/data`)
- Used for signed contract PDFs, extensible for other document types

**POST /api/webhooks/dokobit** - Webhook endpoint
- IP verification via `verifyDokobitIp` (403 Forbidden if unauthorized)
- Zod schema validation: `session_id`, `status` (signed/rejected/expired), `signer_name`
- Event ID: `dokobit-{sessionId}-{status}` for idempotency
- Handles `signed` status → calls `ContractService.handleSigningComplete`
- Logs `rejected`/`expired` statuses (future: transition to cancelled/expired)
- Returns 200 OK on success, 500 on error

### Frontend - Contract UI

**actions.ts** - Contract server actions
- `getContracts(prospectId)` - Fetches contracts from open-seo API
- `sendContract(contractId, prospectId)` - Sends contract for e-signature, returns signing URL
- Authentication via `requireActionAuth` + prospect ownership validation
- Revalidates path after send action

**SignatureStatus Component** - E-signature progress indicator (per D-13)
- Badge variants: outline (draft), secondary (sent), default (signed/executed), destructive (expired/cancelled)
- Icons: Clock, Send, FileCheck, AlertCircle
- Lithuanian labels: "Laukia parengimo", "Išsiųsta pasirašyti", "Pasirašyta", etc.
- Displays signer name + signed date for signed contracts
- Follows v6 design tokens (Badge component with gap-1 icon spacing)

**ContractTable Component** - Contract list with actions (per D-12)
- Table columns: Pavadinimas, Pasirašymo būsena, Sukurta, Veiksmai
- Empty state: "Sutarčių dar nėra" when no contracts
- Actions:
  - Draft → Send button (opens Dokobit signing URL in new tab)
  - Signed → Download button (opens `/api/contracts/{id}/download`)
  - All → View button (navigates to contract detail page)
- Loading state with Loader2 spinner during actions
- Error display with destructive background for failed actions
- Follows ProposalTable pattern (Card, CardHeader, CardTitle, table structure)

**page.tsx** - Contracts list page
- Server component with Suspense boundary
- Back link to prospect detail page ("Grįžti į prospektą")
- Title: "Sutartys" with subtitle "Sutarčių valdymas ir pasirašymo būsena"
- Loading skeleton with Card + Loader2
- Error handling with destructive-styled Card

## Deviations from Plan

None - plan executed exactly as written.

All Lithuanian UI labels applied per plan spec.
v6 design tokens used throughout (Badge variants, Card styling, spacing).

## Key Architectural Patterns

**IP Whitelisting for Dokobit**
```typescript
export function verifyDokobitIp(clientIp: string | null): boolean {
  if (!clientIp) return false;
  
  // Development mode: allow localhost
  if (process.env.NODE_ENV === "development" && 
      (clientIp === "127.0.0.1" || clientIp === "::1")) {
    return true;
  }
  
  return DOKOBIT_IP_WHITELIST.some(range => isIpInRange(clientIp, range));
}
```

**Idempotent Webhook Processing**
```typescript
await processWebhookIdempotently(
  eventId,
  `signing.${payload.status}`,
  "dokobit",
  async () => {
    if (payload.status === "signed") {
      await ContractService.handleSigningComplete(
        payload.session_id,
        payload.signer_name || "Unknown"
      );
    }
  }
);
```

**Workspace-Scoped File Storage**
```typescript
const pdfPath = `contracts/${contract.workspaceId}/${contract.id}/signed.pdf`;
await saveFile(pdfPath, Buffer.from(signedDoc.signedPdfBase64, "base64"));
```

## Testing Summary

No automated tests added in this wave (UI components + webhook endpoint).

**Manual verification checklist:**
- [ ] Dokobit webhook rejects unauthorized IPs (403)
- [ ] Dokobit webhook accepts whitelisted IPs (200)
- [ ] Signed PDF stored in correct workspace directory
- [ ] Contract status transitions from sent → signed
- [ ] ContractTable displays contracts with status badges
- [ ] Send button opens Dokobit signing URL
- [ ] Download button works for signed contracts
- [ ] SignatureStatus shows correct badge for each status

## Integration Points

**Upstream (Inputs)**
- DokobitService from Plan 48-01 (downloadSignedDocument)
- ContractService from Plan 48-01 (state machine, transitionContractState)
- ContractRepository from Phase 45 (getContractById, transitionContractState)
- ActivityRepository from Phase 45 (recordStatusChange)

**Downstream (Outputs)**
- Contract status "signed" triggers invoice creation (Plan 48-03)
- Signed PDF URL stored for download endpoint (future plan)
- Activity feed consumed by onboarding dashboard (Phase 49-51)

## Known Limitations

1. **Dokobit IP whitelist hardcoded** - IP ranges from research docs, not verified with Dokobit support. May need updates if Dokobit infrastructure changes.

2. **No download endpoint** - ContractTable Download button links to `/api/contracts/{id}/download`, but endpoint not implemented yet (deferred to future plan).

3. **Rejected/expired status not handled** - Webhook logs these statuses but doesn't transition contract state. Should add state machine transitions: sent → cancelled/expired.

4. **No contract detail page** - View button navigates to `/prospects/{prospectId}/contracts/{contractId}`, but detail page doesn't exist (deferred to future plan).

5. **No test coverage** - Webhook handler and UI components lack automated tests. Should add:
   - Unit tests for `verifyDokobitIp` and `isIpInRange`
   - Integration tests for webhook endpoint
   - Component tests for ContractTable and SignatureStatus

## Security Considerations

**Mitigations Implemented:**
- T-48-06: IP whitelist verification via `verifyDokobitIp` before processing (mitigated)
- T-48-07: Idempotent processing via `incomingWebhookEvents` table with unique eventId (mitigated)
- T-48-08: Signed PDF stored in workspace-scoped path (mitigated)
- T-48-10: Activity log records all state transitions with timestamps (mitigated)

**Accepted Risks:**
- T-48-09: Webhook flood DoS - IP whitelist limits sources, but no rate limiting yet (accepted for MVP)

**Path Traversal Prevention:**
- `saveFile` rejects paths with `..` or leading `/`
- Workspace ID and contract ID from database (validated before storage)
- No user-supplied path components in signed PDF storage

## Next Steps (Phase 48-03)

1. Implement `/api/contracts/:id/download` endpoint for signed PDF retrieval
2. Add contract state transitions for rejected/expired statuses
3. Create contract detail page at `/prospects/:prospectId/contracts/:contractId`
4. Implement Stripe invoice creation after contract signed
5. Add Stripe webhook handler for `invoice.payment_succeeded`

## Self-Check: PASSED

**Files Created:**
- ✓ webhook-schema.ts extended with incomingWebhookEvents table
- ✓ webhook-utils.ts exists
- ✓ dokobit.ts webhook route exists
- ✓ contracts/actions.ts exists
- ✓ contracts/page.tsx exists
- ✓ contracts/components/ContractTable.tsx exists
- ✓ contracts/components/SignatureStatus.tsx exists

**Commits:**
- ✓ db5f85b45 - feat(48-02): add incoming webhook events schema for idempotency
- ✓ b469a0886 - feat(48-02): implement Dokobit webhook handler with IP verification
- ✓ 0f2bb1b72 - feat(48-02): create ContractTable and SignatureStatus UI components

**Build:**
- ✓ open-seo-main TypeScript compiles without errors
- ✓ apps/web Next.js build succeeds
- ✓ No console.log statements in production code
