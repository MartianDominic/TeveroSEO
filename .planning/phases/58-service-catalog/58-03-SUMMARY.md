---
phase: 58
plan: 03
subsystem: proposal-builder
tags: [ui, service-catalog, api, integration]
dependency_graph:
  requires: [58-01-schema, 58-02-settings]
  provides: [ServiceSelector, proposal-services-api]
  affects: [proposal-builder, proposals]
tech_stack:
  added: []
  patterns: [server-actions, radio-checkbox-selection, price-customization]
key_files:
  created:
    - apps/web/src/components/proposals/ServiceSelector.tsx
    - apps/web/src/components/proposals/PackageSelector.tsx
    - apps/web/src/components/proposals/AddonCheckbox.tsx
    - apps/web/src/components/proposals/ServiceSummary.tsx
    - apps/web/src/components/proposals/PriceEditModal.tsx
    - open-seo-main/src/routes/api/proposals/[id]/services.ts
  modified:
    - apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/page.tsx
    - apps/web/src/app/(shell)/prospects/[prospectId]/proposal/builder/actions.ts
decisions:
  - PackageSelector uses RadioGroup for mutually exclusive SEO package selection
  - AddonCheckbox uses Checkbox for multi-select add-on services
  - ServiceSummary calculates monthly, setup, one-time, and first month totals
  - PriceEditModal allows per-proposal price customization with reset option
  - Price validation capped at 100M cents (1M EUR) per threat model T-58-07
  - Services loaded on mount via getServicesForWorkspace server action
metrics:
  duration_seconds: 379
  completed_at: "2026-05-02T13:13:37Z"
---

# Phase 58 Plan 03: Service Selector for Proposal Builder Summary

Service selection component integrated into proposal builder pricing step with API for saving selections.

## One-Liner

Service selector with radio packages, checkbox add-ons, real-time price summary, and per-proposal customization modal in proposal builder.

## What Was Built

### UI Components (Task 1 & 2)

**PackageSelector.tsx** - SEO package radio buttons
- Mutually exclusive selection (only one package)
- Shows package name, price/mo, setup fee, inclusions preview
- "Recommended" badge on middle tier
- i18n support via locale prop

**AddonCheckbox.tsx** - Add-on/one-time service checkboxes
- Multi-select capability
- Edit button appears when selected
- Shows custom price indicator when overridden
- Supports monthly, one-time, and per-unit pricing types

**ServiceSelector.tsx** - Main container component
- Combines PackageSelector + AddonCheckbox
- Splits services by category (seo_package, addon, one_time)
- Manages selection state and price updates
- Renders ServiceSummary and PriceEditModal

**ServiceSummary.tsx** - Price totals display
- Calculates monthly total, setup total, one-time total
- Displays first month total (all combined)
- Respects custom prices when set

**PriceEditModal.tsx** - Per-proposal price override
- Edit base price and setup fee
- Shows original template values for reference
- Reset button to restore defaults
- Validates price bounds (0-1M EUR)

### API & Server Actions (Task 3)

**Proposal Services API** (`/api/proposals/:id/services`)
- GET: Fetch services for proposal with template data
- PUT: Update all service selections (replace pattern)
- Validates proposal ownership (T-58-08)
- Validates service template access (T-58-09)
- Price bounds validation (T-58-07)

**Server Actions** (actions.ts)
- `getServicesForWorkspace()` - Load available templates
- `getProposalServices(proposalId)` - Load current selections
- `updateProposalServices(proposalId, selections)` - Save selections

**Builder Integration** (page.tsx)
- ServiceSelector rendered in pricing step
- Services loaded on component mount
- Save before generate proposal

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ServiceSelector Components | d368495c0 | ServiceSelector.tsx, PackageSelector.tsx, AddonCheckbox.tsx |
| 2 | Summary & Edit Modal | cc5708e1b | ServiceSummary.tsx, PriceEditModal.tsx |
| 3 | Builder Integration + API | bac314d91 | page.tsx, actions.ts, services.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-58-07 (Tampering) | Price validation: 0 <= cents <= 100,000,000 in both modal and API |
| T-58-08 (Spoofing) | Proposal ownership verified before service updates via workspace check |
| T-58-09 (Disclosure) | Service templates filtered by workspace - only system or same workspace |

## Technical Notes

### Selection State Management
- Package selection is mutually exclusive (radio behavior)
- Add-ons are multi-select (checkbox behavior)
- All selections stored in flat array with `isIncluded` flag
- Custom prices stored per selection, null means use template

### Price Calculation
```typescript
// Monthly services add to monthlyTotal + setupTotal
// One-time services add to oneTimeTotal
// First month = monthlyTotal + setupTotal + oneTimeTotal
```

### Integration Pattern
- Services loaded once on mount (cached for session)
- Selections saved before proposal generation
- API uses replace-all pattern (delete + insert in transaction)

## Self-Check: PASSED

- [x] apps/web/src/components/proposals/ServiceSelector.tsx exists
- [x] apps/web/src/components/proposals/PackageSelector.tsx exists
- [x] apps/web/src/components/proposals/AddonCheckbox.tsx exists
- [x] apps/web/src/components/proposals/ServiceSummary.tsx exists
- [x] apps/web/src/components/proposals/PriceEditModal.tsx exists
- [x] open-seo-main/src/routes/api/proposals/[id]/services.ts exists
- [x] Commit d368495c0 exists (Task 1)
- [x] Commit cc5708e1b exists (Task 2)
- [x] Commit bac314d91 exists (Task 3)
- [x] ServiceSelector integrated in proposal builder pricing step
