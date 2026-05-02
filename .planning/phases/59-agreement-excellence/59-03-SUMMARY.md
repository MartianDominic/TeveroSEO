---
phase: 59-agreement-excellence
plan: 03
subsystem: agreements
tags: [variable-resolution, i18n, localization]
dependency_graph:
  requires: [59-01-schema, 59-02-multi-signer]
  provides: [AgreementVariableService, AgreementResolutionContext]
  affects: [agreement-template-editor, client-contract-page]
tech_stack:
  added: []
  patterns: [service-pattern, intl-formatting, variable-substitution]
key_files:
  created:
    - open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts
    - open-seo-main/src/server/features/agreements/services/AgreementVariableService.test.ts
  modified: []
decisions:
  - "Reuse P57 variable resolution pattern with agreement-specific context per D-12"
  - "Use Intl.NumberFormat for locale-specific currency (lt-LT, en-US)"
  - "Use Intl.DateTimeFormat for locale-specific dates"
  - "Provider signer maps to signer1, first client signer maps to signer2"
metrics:
  duration_seconds: 240
  completed: 2026-05-02T14:28:00Z
---

# Phase 59 Plan 03: Variable Resolution Service Summary

AgreementVariableService for resolving template variables from agreement context with EN/LT locale support.

## Files Created

### Service
- `open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts`
  - `loadContext(agreementId, locale)` - Loads agreement, proposal, prospect, workspace, signers, services
  - `resolveVariables(agreementId, locale)` - Resolves all variables via loadContext
  - `resolveWithContext(ctx)` - Pure function to resolve variables from pre-loaded context
  - `replaceInText(text, resolved)` - Replaces {{key}} placeholders in template text
  - `getAvailableVariables(locale)` - Returns variable palette for UI

### Tests
- `open-seo-main/src/server/features/agreements/services/AgreementVariableService.test.ts`
  - 13 test cases covering resolveWithContext, replaceInText, getAvailableVariables
  - Tests for client/provider/signer variable resolution
  - Tests for currency and date formatting
  - Tests for service list formatting
  - Tests for EN/LT locale support

## Variable Categories (per D-12 to D-15)

| Category | Variables | Source |
|----------|-----------|--------|
| Client | client.name, client.companyCode, client.vatNumber, client.address, client.representative | prospect table |
| Provider | provider.name, provider.companyCode, provider.vatNumber, provider.address, provider.representative | organization table |
| Services | services.list, services.monthly, services.setup, services.total | proposalServices + serviceTemplates |
| Agreement | agreement.startDate, agreement.endDate, agreement.duration, agreement.city, agreement.date | generatedAgreements |
| Signatures | signer1.name, signer1.title, signer2.name, signer2.title, signer3.name, signer3.title | agreementSigners |
| Payment | payment.terms, payment.dueDate | generatedAgreements |

## Locale Support

- **Currency**: Uses `Intl.NumberFormat` with `lt-LT` or `en-US` locale
- **Dates**: Uses `Intl.DateTimeFormat` with `dateStyle: "long"`
- **Fallbacks**: Localized "Not provided" / "Nepateikta" for missing values
- **Titles**: Localized defaults "Director" / "Direktorius", "Authorized Representative" / "Igaliotas atstovas"

## Key Implementation Details

### Context Loading
- Parallel fetch of proposal, workspace, signers with `Promise.all`
- Services loaded from `proposalServices` joined with `serviceTemplates` for names
- Handles missing tables gracefully (catch block for services)

### Variable Resolution
- Provider signer = role "provider" from agreementSigners
- Client signers = role "client" from agreementSigners (first = signer2, second = signer3)
- Service totals computed from proposal services or fallback to proposal.monthlyFeeCents

### Text Replacement
- Regex: `/\{\{([^}]+)\}\}/g`
- Unknown variables kept unchanged (logged as warning)
- Handles multiple occurrences of same variable

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

All 13 test cases pass:
- 8 tests for resolveWithContext (client.name, provider.name, services.monthly, signer1/2.name, date formatting, service list, isEmpty flag)
- 3 tests for replaceInText (basic replacement, unknown variables, multiple occurrences)
- 2 tests for getAvailableVariables (LT labels, EN labels)

## Self-Check

- [x] `AgreementVariableService.ts` exists
- [x] `AgreementVariableService.test.ts` exists
- [x] Exports `AgreementVariableService` and `AgreementResolutionContext`
- [x] Has `loadContext`, `resolveVariables`, `resolveWithContext`, `replaceInText`
- [x] All 13 tests pass
- [x] Supports EN/LT locales

## Self-Check: PASSED
