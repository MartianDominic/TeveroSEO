---
phase: 55-platform-i18n
plan: 04
subsystem: i18n
tags: [language-settings, multi-tenant, formality, drizzle, api]
dependency_graph:
  requires:
    - "55-01"
  provides:
    - Language columns on organization, prospects, clients tables
    - LanguageResolutionService with 6-step hierarchy
    - Language settings API (GET/PUT /api/settings/language)
    - Language settings UI at /[locale]/(shell)/settings/language
  affects:
    - open-seo-main/src/db/user-schema.ts
    - open-seo-main/src/db/prospect-schema.ts
    - open-seo-main/src/db/client-schema.ts
tech_stack:
  added: []
  patterns:
    - 6-step language resolution hierarchy
    - Zod validation for API endpoints
    - Workspace-level language defaults with entity overrides
key_files:
  created:
    - open-seo-main/drizzle/0055_language_settings.sql
    - open-seo-main/src/server/services/LanguageResolutionService.ts
    - open-seo-main/src/routes/api/settings/language.ts
    - apps/web/src/app/[locale]/(shell)/settings/language/page.tsx
  modified:
    - open-seo-main/src/db/user-schema.ts
    - open-seo-main/src/db/prospect-schema.ts
    - open-seo-main/src/db/client-schema.ts
decisions:
  - "Add language columns directly to existing tables rather than separate settings table"
  - "Use 6-step resolution: user > prospect > client > workspace > browser > default"
  - "Store formality at workspace level only (not entity level)"
metrics:
  duration: 4m18s
  completed: 2026-04-30T18:14:02Z
  tasks: 3/3
  files_created: 4
  files_modified: 3
---

# Phase 55 Plan 04: Multi-Tenant Language Settings Summary

Database schema extended with language columns, LanguageResolutionService implementing 6-step hierarchy, API endpoints for workspace settings, and settings UI page with formality configuration

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add language columns to organization and prospects tables | 2d4671054 | Done |
| 2 | Create LanguageResolutionService with hierarchy logic | 87506194e | Done |
| 3 | Create language settings API and UI | 4910c3540 | Done |

## Implementation Details

### Task 1: Database Schema Updates

Added language-related columns to three tables:

**organization table:**
- `default_language` (text, default 'en')
- `supported_languages` (text[], default ['en'])
- `country` (text, nullable - ISO 3166-1 alpha-2)
- `formality` (text, default 'formal')

**prospects table:**
- `preferred_language` (text, nullable - null = inherit)
- `country` (text, nullable)

**clients table:**
- `preferred_language` (text, nullable - null = inherit)
- `country` (text, nullable)

Created migration `0055_language_settings.sql` with check constraints for valid enum values.

### Task 2: LanguageResolutionService

Created `/open-seo-main/src/server/services/LanguageResolutionService.ts` with:

**Types:**
- `LanguageContext`: userId, userSelection, prospectId, clientId, workspaceId, acceptLanguage
- `ResolvedLanguage`: locale, formality, source

**Methods:**
- `resolveLanguage(context)`: 6-step resolution hierarchy
- `resolveForCommunication(workspaceId, entityId, entityType)`: Convenience method
- `isSupported(locale)`: Type guard for SupportedLocale
- `parseAcceptLanguage(header)`: Browser header parsing
- `getWorkspaceLanguageSettings(workspaceId)`: Database query
- `getProspectLanguage(prospectId)`: Database query
- `getClientLanguage(clientId)`: Database query

Exported singleton via `getLanguageResolutionService()`.

### Task 3: API and UI

**API Route** (`/api/settings/language`):
- GET: Returns workspace language settings
- PUT: Validates and updates settings with Zod schema
- Validates defaultLanguage is in supportedLanguages

**Settings UI** (`/[locale]/(shell)/settings/language/page.tsx`):
- Checkbox group for supported languages
- Select for default language (filtered to supported)
- Select for formality (formal/informal)
- Info card explaining resolution hierarchy
- Uses next-intl for translations

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- Language columns added to schemas: PASSED (5 column definitions found)
- LanguageResolutionService methods: PASSED (4 method exports found)
- API and UI files created: PASSED (2 files found)

## Self-Check: PASSED

All 4 created files verified to exist:
- open-seo-main/drizzle/0055_language_settings.sql
- open-seo-main/src/server/services/LanguageResolutionService.ts
- open-seo-main/src/routes/api/settings/language.ts
- apps/web/src/app/[locale]/(shell)/settings/language/page.tsx

All 3 commits verified in git log.
