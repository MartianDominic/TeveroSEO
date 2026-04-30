---
phase: 45-data-foundation
plan: 04
subsystem: open-seo-main/server
tags:
  - repository
  - validation
  - zod
  - crud
  - state-machine
dependency_graph:
  requires:
    - 45-01 (contract-schema)
    - 45-02 (invoice-schema)
    - 45-03 (onboarding-schema, activity-schema)
  provides:
    - ContractRepository with state transitions
    - InvoiceRepository with Stripe integration
    - ChecklistRepository with JSONB item updates
    - ActivityRepository with polymorphic queries
    - Zod validation schemas for all 4 entities
  affects:
    - Phase 46-53 API endpoints
    - Phase 48 Stripe webhooks
tech_stack:
  added: []
  patterns:
    - Namespace exports (ContractRepository, etc.)
    - Optimistic locking (WHERE status = fromState)
    - Zod schema validation with custom error messages
key_files:
  created:
    - open-seo-main/src/server/features/contracts/repositories/ContractRepository.ts
    - open-seo-main/src/server/features/contracts/repositories/InvoiceRepository.ts
    - open-seo-main/src/server/features/contracts/repositories/ChecklistRepository.ts
    - open-seo-main/src/server/features/contracts/repositories/ActivityRepository.ts
    - open-seo-main/src/server/features/contracts/validation/contract.schema.ts
    - open-seo-main/src/server/features/contracts/validation/invoice.schema.ts
    - open-seo-main/src/server/features/contracts/validation/checklist.schema.ts
    - open-seo-main/src/server/features/contracts/validation/activity.schema.ts
    - open-seo-main/src/server/features/contracts/repositories/ContractRepository.test.ts
    - open-seo-main/src/server/features/contracts/validation/contract.schema.test.ts
  modified: []
decisions:
  - Optimistic locking via WHERE current_status = fromState for state transitions
  - Namespace exports following ChangeRepository pattern
  - Zod z.enum() references const arrays from schema files
metrics:
  duration: 6m
  completed: 2026-04-30
  tasks_completed: 8
  tasks_total: 8
  files_created: 10
  files_modified: 0
  test_coverage: 32 tests passing
---

# Phase 45 Plan 04: Repository Layer and Validation Summary

Repository layer with CRUD operations, state transitions, and Zod validation schemas for agency pipeline.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create directory structure | ad6da8b75 | contracts/repositories/, contracts/validation/ |
| 2 | ContractRepository with state transitions | ad6da8b75 | ContractRepository.ts |
| 3 | InvoiceRepository with Stripe integration | ad6da8b75 | InvoiceRepository.ts |
| 4 | ChecklistRepository with JSONB updates | ad6da8b75 | ChecklistRepository.ts |
| 5 | ActivityRepository with polymorphic queries | ad6da8b75 | ActivityRepository.ts |
| 6 | Zod validation schemas | ad6da8b75 | 4 schema files |
| 7 | ContractRepository tests | ad6da8b75 | ContractRepository.test.ts |
| 8 | contract.schema tests | ad6da8b75 | contract.schema.test.ts |

## Key Deliverables

### Repository Layer

- **ContractRepository**: insertContract, getContractById, getContractsByWorkspace, getContractsByClient, transitionContractState, updateContract, deleteContract
- **InvoiceRepository**: insertInvoice, getInvoiceById, getInvoiceByStripeId, getInvoicesByWorkspace, getInvoicesByClient, updateInvoiceStatus, updateInvoiceStripeDetails, deleteInvoice
- **ChecklistRepository**: insertChecklist, getChecklistById, getChecklistByClient, getChecklistsByWorkspace, updateChecklistItem, completeChecklistItem, uncompleteChecklistItem, deleteChecklist
- **ActivityRepository**: insertActivity, getActivityById, getActivitiesByEntity, getActivitiesByWorkspace, getActivitiesByActor, recordStatusChange, deleteActivitiesByEntity

### Validation Schemas

- **contract.schema.ts**: createContractSchema, updateContractSchema, transitionContractSchema
- **invoice.schema.ts**: createInvoiceSchema, updateInvoiceStatusSchema
- **checklist.schema.ts**: createChecklistSchema, completeChecklistItemSchema
- **activity.schema.ts**: createActivitySchema, getActivitiesSchema

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-45-12 | All getByWorkspace functions require workspaceId parameter |
| T-45-13 | Optimistic locking via WHERE current_status = fromState |
| T-45-14 | Zod schemas whitelist allowed fields |
| T-45-15 | Repository functions scope queries by workspaceId or clientId |
| T-45-16 | Drizzle ORM parameterizes all queries |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] 4 repository files exist with namespace exports
- [x] 4 validation files exist with Zod schemas
- [x] ContractRepository has transitionContractState with optimistic locking
- [x] All repositories have workspace-scoped query functions
- [x] 32 tests pass
- [x] Commit ad6da8b75 verified
