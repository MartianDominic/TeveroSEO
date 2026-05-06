---
plan: 89-04
status: complete
completed_at: "2026-05-05T20:23:00Z"
---

# 89-04 Summary: Out-of-Scope Service

## Completed

Created `OutOfScopeService.ts` for detecting and handling keyword requests outside contracted scope.

### Functions

**`detectOutOfScope(contractId, keywordText)`**
- Case-insensitive comparison against contracted keywords
- Returns `{ isOutOfScope: boolean, keywordText, contractedKeywords[] }`

**`flagOutOfScopeRequest(clientId, contractId, keywordText, requestedBy?)`**
- Creates pending out-of-scope request
- Tracks who requested and when

**`checkAndFlagIfOutOfScope(clientId, contractId, keywordText)`**
- Convenience wrapper: detect + flag if out of scope
- Returns null if keyword is contracted

**`approveRequestDirect(requestId, notes)`**
- Approves request without change order
- Used for complimentary additions

**`rejectRequest(requestId, reason)`**
- Rejects with documented reason

**`resolveWithChangeOrder(requestId, contractId, changeOrderData)`**
- Creates linked change order
- Updates request status to `change_order_created`

**`getPendingSummary(contractId)`**
- Returns pending count and request list for portal display

## Tests

12 tests in `OutOfScopeService.test.ts` — all passing.

## Files Created
- `open-seo-main/src/server/features/keyword-lockin/services/OutOfScopeService.ts`
- `open-seo-main/src/server/features/keyword-lockin/services/OutOfScopeService.test.ts`
