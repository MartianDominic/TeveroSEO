---
phase: 45-data-foundation
plan: 01
subsystem: open-seo-main/db
tags:
  - schema
  - contracts
  - drizzle
  - state-machine
dependency_graph:
  requires: []
  provides:
    - contracts table with state machine (draft, sent, signed, executed, expired, cancelled)
    - CONTRACT_STATUS const array and ContractStatus type
    - ContractContent interface for JSONB content
    - contractsRelations for query joins
    - ContractSelect and ContractInsert type exports
  affects:
    - Phase 46-47 proposal-to-contract flow
    - Phase 48 e-signature integration (Dokobit)
tech_stack:
  added:
    - Drizzle pgTable with CHECK constraint
  patterns:
    - State machine via const array + CHECK constraint
    - UUID FK for clients (matching clients.id type)
    - JSONB typed content field
key_files:
  created:
    - open-seo-main/src/db/contract-schema.ts
    - open-seo-main/src/db/contract-schema.test.ts
  modified: []
decisions:
  - CHECK constraint named chk_contract_status_valid enforces valid status at DB level
  - clientId uses uuid() type to match clients.id (not text)
  - ContractContent structured with sections, terms, and signatures arrays
metrics:
  duration: 3m
  completed: 2026-04-30
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  test_coverage: 9 tests passing
---

# Phase 45 Plan 01: Contract Schema Summary

Contracts table with 6-state lifecycle and e-signature integration fields using Drizzle ORM CHECK constraint pattern.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create contract-schema.ts with contracts table | 67a485d06 | contract-schema.ts |
| 2 | Create contract-schema.test.ts with schema validation tests | 67a485d06 | contract-schema.test.ts |

## Key Deliverables

### Contract Schema (contract-schema.ts)

- **Table:** `contracts` with 17 columns
- **Status:** 6-value state machine (draft, sent, signed, executed, expired, cancelled)
- **CHECK constraint:** `chk_contract_status_valid` enforces valid status at database level
- **E-signature fields:** dokobitSessionId, signedPdfUrl, signedAt, signerName
- **Foreign keys:** workspaceId -> organization (cascade), clientId -> clients (uuid, set null), proposalId -> proposals (set null)
- **Indexes:** workspace, proposal, client, status

### Exports

```typescript
export const CONTRACT_STATUS = ["draft", "sent", "signed", "executed", "expired", "cancelled"] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];
export interface ContractContent { sections, terms, signatures }
export const contracts = pgTable(...)
export const contractsRelations = relations(...)
export type ContractSelect = typeof contracts.$inferSelect;
export type ContractInsert = typeof contracts.$inferInsert;
```

## Test Coverage

9 tests covering:
- CONTRACT_STATUS array length and values
- Readonly array type verification
- Core column presence (id, workspaceId, clientId, proposalId, title, content, status)
- E-signature fields (dokobitSessionId, signedPdfUrl, signedAt, signerName)
- Lifecycle timestamps (sentAt, executedAt, expiresAt)
- ContractContent interface validation
- ContractSelect and ContractInsert type exports

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-45-01 | CHECK constraint `chk_contract_status_valid` enforces valid status values at database level |
| T-45-03 | FK constraint with cascade delete on workspaceId; repository layer will enforce workspace scoping |

## Self-Check: PASSED

- [x] contract-schema.ts exists with required exports
- [x] contract-schema.test.ts exists with 9 passing tests
- [x] Commit 67a485d06 verified in git log
- [x] TypeScript compiles without errors
- [x] All acceptance criteria met
