---
phase: 55-platform-i18n
plan: 06
subsystem: i18n
tags: [agreement-templates, legal, variable-substitution, lithuanian, contracts]
dependency_graph:
  requires:
    - "55-04"
  provides:
    - Agreement template schema with sections and variables jsonb
    - Lithuanian SEO services template with 13 legal sections
    - TemplateSubstitutionService with HTML escaping
    - ContractService.generateAgreement with language resolution
  affects:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/server/features/contracts/services/ContractService.ts
tech_stack:
  added: []
  patterns:
    - isLegal boolean to protect legal sections from AI translation
    - translateValue flag for per-variable translation control
    - HTML escaping for XSS prevention in variable substitution
key_files:
  created:
    - open-seo-main/src/db/agreement-template-schema.ts
    - open-seo-main/src/db/seeds/agreement-templates.ts
    - open-seo-main/src/server/features/contracts/templates/seo-services-lt.ts
    - open-seo-main/src/server/features/contracts/templates/seo-services-en.ts
    - open-seo-main/src/server/features/contracts/services/TemplateSubstitutionService.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/src/server/features/contracts/services/ContractService.ts
decisions:
  - "Use isLegal boolean on sections to prevent AI translation of legal clauses"
  - "Only scopeDescription section marked as non-legal for translation"
  - "HTML escape all variable values before substitution (T-55-12)"
metrics:
  duration: 4m24s
  completed: 2026-04-30T18:20:20Z
  tasks: 3/3
  files_created: 5
  files_modified: 2
---

# Phase 55 Plan 06: Legal Agreement Templates Summary

Pre-approved Lithuanian legal agreement templates with safe variable substitution, ensuring legal accuracy without AI modification of legal clauses

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create agreement template schema and seed structure | 5bccebea3 | Done |
| 2 | Create Lithuanian SEO services agreement template | f41878776 | Done |
| 3 | Create TemplateSubstitutionService and update ContractService | ec8831086 | Done |

## Implementation Details

### Task 1: Agreement Template Schema

Created `agreement-template-schema.ts` with:

**Interfaces:**
- `AgreementSection`: id, title, content, isLegal boolean, order
- `TemplateVariable`: key, label, type, required, translateValue, validation

**Tables:**
- `agreementTemplates`: Pre-approved templates with sections jsonb, variables jsonb, version tracking, approvedAt/approvedBy for legal review
- `generatedAgreements`: Rendered agreements with templateId, templateVersion, renderedContent, variableValues, status lifecycle

Seed script structure at `src/db/seeds/agreement-templates.ts` using onConflictDoNothing.

### Task 2: Lithuanian SEO Services Template

Created `seo-services-lt.ts` with 13 sections:

1. header - Contract title and number
2. parties (SALYS) - Provider and client details
3. subject (SUTARTIES OBJEKTAS) - Service description
4. scope (PASLAUGU APIMTIS) - **isLegal: false** (can be translated)
5. price (KAINA IR MOKEJIMO SALYGOS) - Financial terms
6. term (SUTARTIES GALIOJIMAS) - Contract duration
7. obligations (SALIU TEISES IR PAREIGOS) - Rights and duties
8. confidentiality (KONFIDENCIALUMAS) - NDA terms
9. liability (ATSAKOMYBES RIBOJIMAS) - Liability limits
10. termination (SUTARTIES NUTRAUKIMAS) - Termination terms
11. disputes (GINCU SPRENDIMAS) - Lithuanian jurisdiction
12. final (BAIGIAMOSIOS NUOSTATOS) - Final provisions
13. signatures (SALIU REKVIZITAI IR PARASAI) - Signature block

32 variables defined with types and translateValue flags. Only `scopeDescription` has `translateValue: true`.

English template mirrors Lithuanian structure for consistency.

### Task 3: Template Substitution Service

`TemplateSubstitutionService` provides:

- `substituteVariables()`: Process sections with variable replacement
- `escapeHtml()`: XSS prevention (T-55-12 mitigation)
- `formatDate()`: Locale-aware date formatting
- `formatCurrency()`: Locale-aware currency formatting
- Validates required variables before processing
- Reports unsubstituted variables as warnings
- Only translates values when `!section.isLegal && variable.translateValue && targetLanguage !== 'en'`

`ContractService` extended with:

- `generateAgreement()`: Full agreement generation with language resolution
- `createAgreementFromProposal()`: Builds variables from proposal data
- `generateContractNumber()`: SEO-YYYY-NNNN format
- `getTemplate()`: Fetch template by ID or language

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-55-12 | HTML escape all variable values | Implemented in escapeHtml() |
| T-55-13 | Track approvedAt/approvedBy, version | Implemented in schema |
| T-55-14 | Store signatureData with timestamp | Implemented in generatedAgreements |

## Self-Check: PASSED

All 5 created files verified to exist:
- open-seo-main/src/db/agreement-template-schema.ts
- open-seo-main/src/db/seeds/agreement-templates.ts
- open-seo-main/src/server/features/contracts/templates/seo-services-lt.ts
- open-seo-main/src/server/features/contracts/templates/seo-services-en.ts
- open-seo-main/src/server/features/contracts/services/TemplateSubstitutionService.ts

All 3 commits verified in git log.
