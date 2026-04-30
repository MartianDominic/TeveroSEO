---
phase: 45-data-foundation
plan: 02
subsystem: database
tags: [schema, invoices, stripe, billing, drizzle]
dependency_graph:
  requires: [organization, clients]
  provides: [invoices, invoicesRelations, INVOICE_STATUS, InvoiceLineItem]
  affects: [Phase 46-53 billing features]
tech_stack:
  added: []
  patterns: [state-machine, jsonb-storage, cents-precision, check-constraint]
key_files:
  created:
    - open-seo-main/src/db/invoice-schema.ts
    - open-seo-main/src/db/invoice-schema.test.ts
  modified: []
decisions:
  - "Use integer cents for amounts (subtotalCents, taxCents, totalCents) to prevent floating-point rounding"
  - "Store line items as JSONB array with InvoiceLineItem interface for flexibility"
  - "CHECK constraint chk_invoice_status_valid enforces 6-value status enum at database level"
  - "UUID FK for clientId to match clients.id type (not text)"
metrics:
  duration_seconds: 164
  completed_at: "2026-04-30T00:25:17Z"
  tasks: 2
  files: 2
---

# Phase 45 Plan 02: Invoice Schema Summary

Invoice schema with Stripe integration and JSONB line items for agency billing pipeline.

## Objective

Create the invoices table schema with Stripe integration for the agency pipeline. Enables invoice lifecycle tracking from draft through payment, with line items stored as JSONB for flexibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create invoice-schema.ts with invoices table | ffc0f3534 (test), d6c842376 (impl) | invoice-schema.ts, invoice-schema.test.ts |
| 2 | Schema validation tests | ffc0f3534 | invoice-schema.test.ts |

## Implementation Details

### Invoice Status State Machine

```
draft -> sent -> paid
              -> overdue -> paid
                         -> cancelled
       -> cancelled
paid -> refunded
```

Six states: `draft`, `sent`, `paid`, `overdue`, `cancelled`, `refunded`

### Schema Structure

- **Primary key:** text id
- **Tenant scoping:** workspaceId (FK to organization.id)
- **Client reference:** clientId (UUID FK to clients.id - cascade delete)
- **Contract link:** contractId (nullable, for Plan 45-01 contracts)
- **Invoice identification:** invoiceNumber (text, not null)
- **Line items:** JSONB array with InvoiceLineItem interface
- **Amounts in cents:** subtotalCents, taxCents, totalCents (integer)
- **Currency:** defaults to EUR
- **Stripe integration:** stripeInvoiceId, stripePaymentIntentId, stripePaymentUrl
- **Status:** text with CHECK constraint, defaults to "draft"
- **Lifecycle timestamps:** sentAt, paidAt, dueAt
- **Audit timestamps:** createdAt, updatedAt

### Indexes

- ix_invoices_workspace (workspaceId)
- ix_invoices_client (clientId)
- ix_invoices_contract (contractId)
- ix_invoices_status (status)
- ix_invoices_stripe (stripeInvoiceId)

### Exports

- `invoices` - pgTable definition
- `invoicesRelations` - Drizzle relations for type-safe queries
- `INVOICE_STATUS` - const array of 6 status values
- `InvoiceStatus` - TypeScript union type
- `InvoiceLineItem` - interface for line item structure
- `InvoiceSelect` - inferred select type
- `InvoiceInsert` - inferred insert type

## Test Coverage

14 tests covering:
- INVOICE_STATUS enum values and length
- invoices table column structure
- Stripe integration fields presence
- Amount columns in cents
- Lifecycle timestamp fields
- Status default value
- InvoiceLineItem type validation
- Type export verification
- Relations export

## Threat Mitigations Applied

| Threat ID | Category | Mitigation |
|-----------|----------|------------|
| T-45-04 | Tampering | CHECK constraint enforces valid status values at database level |
| T-45-05 | Tampering | Integer cents prevents rounding manipulation |
| T-45-07 | Repudiation | createdAt/updatedAt timestamps provide audit trail |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

```
grep "INVOICE_STATUS" invoice-schema.ts: PASS (const array with 6 values)
grep "uuid.*client_id" invoice-schema.ts: PASS (uuid FK)
grep "chk_invoice_status_valid": PASS (1 match)
Stripe fields: PASS (4 matches - 3 fields + 1 index)
Amount fields: PASS (4 matches - 3 columns + currency)
lineItems jsonb: PASS
InvoiceLineItem: PASS (2 matches)
Tests: 14/14 passing
```

## Self-Check: PASSED

- [x] open-seo-main/src/db/invoice-schema.ts exists (146 lines)
- [x] open-seo-main/src/db/invoice-schema.test.ts exists (160 lines)
- [x] Commit ffc0f3534 exists (test)
- [x] Commit d6c842376 exists (impl)
- [x] All 14 tests pass
