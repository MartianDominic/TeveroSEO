---
phase: 55-platform-i18n
plan: 05
subsystem: i18n
tags: [translation, proposals, email, invoices, localization, lithuanian]
dependency_graph:
  requires:
    - "55-02"
    - "55-03"
    - "55-04"
  provides:
    - ProposalTranslationService for proposal localization
    - Localized email templates (EN/LT) for 7 email types
    - EmailService with language resolution
    - Invoice labels in EN and LT
    - ProposalPreview component with language toggle
  affects:
    - open-seo-main/src/server/features/proposals/services/ProposalService.ts
    - apps/web proposal editor UI
tech_stack:
  added: []
  patterns:
    - Parallel translation of proposal sections
    - On-demand translation fetch in React component
    - HTML escaping for email variable substitution (XSS prevention)
key_files:
  created:
    - open-seo-main/src/server/features/proposals/services/ProposalTranslationService.ts
    - open-seo-main/src/server/services/email/templates.ts
    - open-seo-main/src/server/services/email/EmailService.ts
    - apps/web/src/components/proposals/ProposalPreview.tsx
  modified:
    - open-seo-main/src/server/features/invoices/services/InvoiceService.ts
decisions:
  - "ProposalContent interface matches existing proposal structure for compatibility"
  - "Email templates use formal Lithuanian (jus form) for professional communication"
  - "Invoice labels stored as const object for type safety and tree-shaking"
  - "ProposalPreview fetches translation on-demand to avoid unnecessary API calls"
metrics:
  duration: 3m19s
  completed: 2026-04-30T18:19:15Z
  tasks: 3/3
  files_created: 4
  files_modified: 1
---

# Phase 55 Plan 05: Dynamic Content Translation Integration Summary

Translation service integrated with proposal generation, email sending, and invoices to produce localized dynamic content in prospect/client preferred language

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create ProposalTranslationService and integrate with ProposalService | 24bbf64a0 | Done |
| 2 | Create localized email templates and EmailService | c0f0feffc | Done |
| 3 | Add invoice localization and proposal preview toggle | cbb8329bf | Done |

## Implementation Details

### Task 1: ProposalTranslationService

Created `/open-seo-main/src/server/features/proposals/services/ProposalTranslationService.ts`:

**Interfaces:**
- `ProposalContent`: hero, problemStatements, solutions, investment, nextSteps, closingStatement
- `HeroContent`, `SolutionItem`, `InvestmentLineItem`, `InvestmentContent`
- `TranslatedProposal`: content + language + formality

**ProposalTranslationService class:**
- `translateProposal(content, prospectId, workspaceId)`: Main method
- Resolves language via `LanguageResolutionService.resolveForCommunication()`
- Returns unchanged content if target is English
- Translates all sections in parallel using `Promise.all()`
- Private helpers: `translateText()`, `translateArray()`, `translateHero()`, `translateSolutions()`, `translateInvestment()`, `translateInvestmentItems()`

Singleton: `getProposalTranslationService()`

### Task 2: Localized Email Templates and EmailService

**templates.ts:**
- `EmailTemplate` interface with subject, body, variables
- `EmailTemplateId` type: 7 template types
- `EMAIL_TEMPLATES_EN`: English templates
- `EMAIL_TEMPLATES_LT`: Lithuanian templates (formal jus form)
- Templates: proposal-sent, proposal-reminder, agreement-sent, agreement-signed, invoice-sent, invoice-reminder, welcome
- `getEmailTemplate(templateId, language)`: Returns template by language
- `substituteVariables(text, variables)`: Replaces {{var}} with values
- HTML escaping for XSS prevention (T-55-10 mitigation)

**EmailService.ts:**
- `SendEmailOptions`: templateId, to, prospectId, clientId, workspaceId, variables, dynamicContent
- `EmailService` class with `sendEmail()` and `prepareEmail()` methods
- Resolves recipient language via LanguageResolutionService
- Translates dynamic content if language is not English
- `sendViaProvider()` placeholder for email provider integration

### Task 3: Invoice Localization and Proposal Preview

**InvoiceService.ts updates:**
- Added `INVOICE_LABELS` constant with EN and LT translations
- Labels: invoice, invoiceNumber, date, dueDate, billTo, description, quantity, unitPrice, amount, subtotal, tax (VAT), total, paymentTerms, bankDetails, thankYou
- `getInvoiceLabels(language)` helper function

**ProposalPreview.tsx:**
- React component with props: proposalId, contentEn, contentLt?, defaultLanguage
- State: previewLang, isTranslating, translatedContent, error
- ToggleGroup for EN/LT selection using shadcn/ui
- `handleLanguageChange()`: Fetches translation on-demand via `/api/proposals/{id}/translate`
- Skeleton loading state during translation
- Renders: hero, problemStatements, solutions, investment, nextSteps, closingStatement
- Uses next-intl `useTranslations` for UI labels

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations

**T-55-10 (Injection via email variable substitution):**
- Implemented `escapeHtml()` function in templates.ts
- All variable values are HTML-escaped before substitution
- Prevents XSS attacks via user-controlled content in emails

## Self-Check: PASSED

All 4 created files verified present:
- open-seo-main/src/server/features/proposals/services/ProposalTranslationService.ts
- open-seo-main/src/server/services/email/templates.ts
- open-seo-main/src/server/services/email/EmailService.ts
- apps/web/src/components/proposals/ProposalPreview.tsx

All 3 commits verified in git log:
- 24bbf64a0: ProposalTranslationService
- c0f0feffc: Email templates and service
- cbb8329bf: Invoice localization and preview toggle

---
*Phase: 55-platform-i18n*
*Completed: 2026-04-30*
