---
phase: 55-platform-i18n
plan: 01
subsystem: i18n
tags: [next-intl, i18next, locale-routing, middleware, translations]
dependency_graph:
  requires: []
  provides:
    - next-intl framework in apps/web
    - i18next framework in open-seo-main
    - locale routing middleware
    - EN/LT message files
    - language resolution utility
  affects:
    - apps/web/src/app/layout.tsx
    - apps/web/next.config.ts
    - open-seo-main/src/routes/__root.tsx
tech_stack:
  added:
    - next-intl@latest
    - i18next@latest
    - react-i18next@latest
    - i18next-browser-languagedetector@latest
  patterns:
    - Locale prefix as-needed (no prefix for EN, /lt/ for LT)
    - Cookie-based locale sync (NEXT_LOCALE)
    - 5-level language resolution cascade
key_files:
  created:
    - apps/web/middleware.ts
    - apps/web/src/i18n/routing.ts
    - apps/web/src/i18n/request.ts
    - apps/web/src/app/[locale]/layout.tsx
    - apps/web/messages/en.json
    - apps/web/messages/lt.json
    - apps/web/types/i18n.d.ts
    - apps/web/src/lib/language-resolution.ts
    - apps/web/src/test-utils/i18n.tsx
    - open-seo-main/src/i18n/index.ts
    - open-seo-main/src/i18n/locales/en.json
    - open-seo-main/src/i18n/locales/lt.json
  modified:
    - apps/web/next.config.ts
    - apps/web/src/app/layout.tsx
    - apps/web/tsconfig.json
    - apps/web/package.json
    - open-seo-main/package.json
    - open-seo-main/src/routes/__root.tsx
    - pnpm-lock.yaml
decisions:
  - "Use localePrefix 'as-needed' for cleaner English URLs (no /en prefix)"
  - "Use NEXT_LOCALE cookie for cross-app locale synchronization"
  - "Keep SEO-specific translations separate in open-seo-main locale files"
  - "Implement 5-level language resolution cascade matching DESIGN.md spec"
metrics:
  duration: 8m27s
  completed: 2026-04-30T18:04:12Z
  tasks: 4/4
  files_created: 12
  files_modified: 7
---

# Phase 55 Plan 01: i18n Framework Setup Summary

next-intl configured in apps/web with locale routing middleware, i18next configured in open-seo-main with browser detection, EN/LT message files with 142 keys each, language resolution utility implementing 5-level cascade

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install next-intl and configure locale routing | b67fd62ce | Done |
| 2 | Create message file structure with initial translations | ab3325f30 | Done |
| 3 | Set up i18next in open-seo-main with locale files | 117931330 | Done |
| 4 | Create language resolution utility and test utilities | 126cd8710 | Done |

## Implementation Details

### Task 1: next-intl Setup

Installed next-intl in apps/web with:
- `routing.ts` defining locales ['en', 'lt'] with 'as-needed' prefix strategy
- `request.ts` with getRequestConfig for server-side message loading
- `middleware.ts` at project root with createMiddleware
- `[locale]/layout.tsx` wrapping children with NextIntlClientProvider
- Updated root layout to use dynamic locale in html lang attribute
- Integrated next-intl plugin in next.config.ts
- Added IntlMessages type declaration for type-safe translations

### Task 2: Message Files

Created apps/web/messages/ with:
- `en.json`: 142 translation keys across 9 namespaces (common, nav, dashboard, prospects, proposals, agreements, invoices, settings, errors, auth)
- `lt.json`: Matching Lithuanian translations with identical key structure
- Both files validated for structure parity

### Task 3: i18next in open-seo-main

Installed i18next with react-i18next and browser language detector:
- `i18n/index.ts` with cookie-first detection (NEXT_LOCALE for cross-app sync)
- `i18n/locales/en.json`: SEO-specific translations (audit, keywords, backlinks, briefs, links)
- `i18n/locales/lt.json`: Matching Lithuanian translations
- Import added to __root.tsx before React rendering

### Task 4: Language Resolution Utility

Created `language-resolution.ts` implementing DESIGN.md specification:
- `SupportedLocale` type ('en' | 'lt')
- `Formality` type ('formal' | 'informal')
- `resolveLanguage()` with 5-level cascade: user > prospect > workspace > accept-language > default
- `parseAcceptLanguage()` for browser header parsing
- `resolveProspectLanguage()` convenience wrapper

Created `test-utils/i18n.tsx`:
- `TestI18nProvider` wrapping NextIntlClientProvider for tests
- `TestI18nProviderLt` for Lithuanian locale testing
- `createTestI18nProvider()` for custom message overrides

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- TypeScript compilation: PASSED (no i18n-related errors)
- Message file structure validation: PASSED (142 keys in both EN and LT)
- Package installation: PASSED (next-intl, i18next, react-i18next, i18next-browser-languagedetector)

## Self-Check: PASSED

All 12 created files verified to exist:
- apps/web/middleware.ts
- apps/web/src/i18n/routing.ts
- apps/web/src/i18n/request.ts
- apps/web/src/app/[locale]/layout.tsx
- apps/web/messages/en.json
- apps/web/messages/lt.json
- apps/web/types/i18n.d.ts
- apps/web/src/lib/language-resolution.ts
- apps/web/src/test-utils/i18n.tsx
- open-seo-main/src/i18n/index.ts
- open-seo-main/src/i18n/locales/en.json
- open-seo-main/src/i18n/locales/lt.json

All 4 commits verified in git log.
