---
phase: 58-service-catalog
plan: 04
subsystem: proposals
tags: [ui, backend, services, agreements, i18n]
dependency_graph:
  requires: [58-01-schema, 58-03-service-selector]
  provides: [ServicesSection, ServiceLineItems, AgreementGenerationService, resolved-services-api]
  affects: [proposal-view, agreement-generation]
tech_stack:
  added: []
  patterns: [conditional-rendering, locale-aware-display, legal-content-protection]
key_files:
  created:
    - apps/web/src/components/proposals/ServiceLineItems.tsx
    - apps/web/src/app/proposals/[token]/components/ServicesSection.tsx
    - open-seo-main/src/server/features/proposals/services/AgreementGenerationService.ts
    - open-seo-main/src/routes/api/proposals/[id]/services/resolved.ts
  modified:
    - apps/web/src/app/proposals/[token]/components/ProposalView.tsx
    - apps/web/src/app/proposals/[token]/page.tsx
    - apps/web/src/app/proposals/[token]/actions.ts
decisions:
  - Services grouped by category (seo_package, addon, one_time) in display
  - Service terms marked isLegal: true to prevent AI translation
  - Conditional rendering falls back to legacy investment display when no services
  - Resolved services API returns merged template + selection data
metrics:
  duration_seconds: 270
  completed_at: "2026-05-02T13:12:28Z"
---

# Phase 58 Plan 04: Agreement Integration + Service Display Summary

Service catalog integration into proposal view and agreement generation with automatic terms inclusion and i18n support.

## One-Liner

ServiceLineItems displays grouped services with pricing in proposal view, AgreementGenerationService extracts service terms for agreements with legal content protection.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ServiceLineItems + ServicesSection | 359dbadc8 | ServiceLineItems.tsx, ServicesSection.tsx |
| 2 | ProposalView integration | 60c2cfb12 | ProposalView.tsx, page.tsx, actions.ts |
| 3 | AgreementGenerationService + API | a542b35cd | AgreementGenerationService.ts, resolved.ts |

## What Was Built

### ServiceLineItems Component (Task 1)

Displays selected services grouped by category:
- **seo_package**: Core SEO packages
- **addon**: Add-on services
- **one_time**: One-time services

Features:
- Custom price display when overridden (customPriceCents)
- Service inclusions shown with checkmarks
- Dynamic icon rendering from lucide-react
- Calculates monthly, setup, and one-time totals
- "First Month Total" summary
- Full i18n support (EN/LT locales)

### ServicesSection Component (Task 1)

Wraps ServiceLineItems in a Card for the proposal view with:
- Localized section title ("Investment" / "Investicija")
- Conditional rendering (null if no services)

### ProposalView Integration (Task 2)

Updated proposal view to support structured services:
- Added `services` and `locale` props
- Conditional rendering: ServicesSection when services exist
- Falls back to legacy investment display when no structured services
- Added getProposalServices server action for fetching

### AgreementGenerationService (Task 3)

Three main functions:

1. **getServiceTermsForProposal**: Extracts service-specific terms from selected services with locale support

2. **generateServiceTermsSections**: Creates AgreementSection objects for each service with terms:
   - `isLegal: true` prevents AI translation
   - Sequential ordering starting from specified order

3. **getResolvedServicesForProposal**: Returns merged template + selection data for display

### Resolved Services API (Task 3)

`GET /api/proposals/:id/services/resolved`
- Returns services with template data merged with proposal selection data
- Used by public proposal view to display service line items
- Public endpoint (accessed via proposal token validation)

## Deviations from Plan

None - plan executed exactly as written.

## Security Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-58-10 (Disclosure) | Services only returned for proposals user has access to via token validation |
| T-58-11 (Tampering) | Service terms marked isLegal: true, not AI-translatable |
| T-58-12 (Spoofing) | Proposal access validated before returning data |

## Integration Points

### Frontend (apps/web)
- ProposalView receives services from page.tsx
- ServicesSection conditionally replaces legacy investment section
- getProposalServices action fetches from backend API

### Backend (open-seo-main)
- AgreementGenerationService provides service terms for agreement generation
- Resolved services API merges proposalServices with serviceTemplates
- Integration point documented for agreement generation flow

## Self-Check: PASSED

All files verified:
- [x] apps/web/src/components/proposals/ServiceLineItems.tsx exists
- [x] apps/web/src/app/proposals/[token]/components/ServicesSection.tsx exists
- [x] open-seo-main/src/server/features/proposals/services/AgreementGenerationService.ts exists
- [x] open-seo-main/src/routes/api/proposals/[id]/services/resolved.ts exists
- [x] Commit 359dbadc8 exists (Task 1)
- [x] Commit 60c2cfb12 exists (Task 2)
- [x] Commit a542b35cd exists (Task 3)
- [x] ServicesSection in ProposalView.tsx
- [x] generateServiceTermsSections in AgreementGenerationService.ts
- [x] isLegal: true in AgreementGenerationService.ts
