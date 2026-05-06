---
plan: 89-02
status: complete
completed_at: "2026-05-05T20:21:00Z"
---

# 89-02 Summary: Keyword Lock-in Repositories

## Completed

Created 4 repository modules following existing codebase patterns:

### ContractedKeywordRepository
- `insertContractedKeywords(contractId, keywords[])` — Bulk insert with baseline data
- `getContractedKeywordsByContract(contractId)` — Get all keywords for contract
- `getActiveKeywordCount(contractId)` — Count active locked keywords
- `getContractedKeywordById(id)` — Get single keyword
- `updateContractedKeywordStatus(id, status)` — Update keyword status

### ContractGoalRepository
- `insertContractGoal(goal)` — Create goal with target value
- `getGoalsByContract(contractId)` — Get all goals
- `getGoalById(id)` — Get single goal
- `updateGoalProgress(id, currentValue)` — Update progress, recalc achievement
- `markGoalMissed(id)` — Mark goal as missed

### OutOfScopeRepository
- `insertOutOfScopeRequest(request)` — Create pending request
- `getRequestsByContract(contractId)` — Get all requests
- `getRequestsByClient(clientId)` — Get requests across contracts
- `getPendingRequestCount(contractId)` — Count pending
- `resolveRequest(id, resolution)` — Approve/reject/change order
- `getRequestById(id)` — Get single request

### ChangeOrderRepository
- `insertChangeOrder(changeOrder)` — Create draft change order
- `getChangeOrdersByContract(contractId)` — Get all change orders
- `getChangeOrderById(id)` — Get single change order
- `sendChangeOrder(id)` — Mark as sent
- `approveChangeOrder(id)` — Approve with signature
- `rejectChangeOrder(id, reason)` — Reject with reason
- `updateChangeOrder(id, data)` — Update draft

## Tests

Tests created for ContractedKeywordRepository — all passing.

## Files Created
- `open-seo-main/src/server/features/keyword-lockin/repositories/ContractedKeywordRepository.ts`
- `open-seo-main/src/server/features/keyword-lockin/repositories/ContractedKeywordRepository.test.ts`
- `open-seo-main/src/server/features/keyword-lockin/repositories/ContractGoalRepository.ts`
- `open-seo-main/src/server/features/keyword-lockin/repositories/OutOfScopeRepository.ts`
- `open-seo-main/src/server/features/keyword-lockin/repositories/ChangeOrderRepository.ts`
