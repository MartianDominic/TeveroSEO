---
phase: 55-platform-i18n
plan: 07
subsystem: i18n
tags: [language-switcher, locale-storage, preview-toggle, context-provider, ui-components]
dependency_graph:
  requires:
    - "55-03"
    - "55-04"
  provides:
    - LanguageSwitcher component with EN/LT dropdown
    - Locale persistence via cookie + localStorage
    - ProspectLanguageField for per-prospect language
    - PreviewLanguageToggle for proposal/agreement previews
    - LanguageContext provider with useLanguage hook
  affects:
    - apps/web/src/components/shell/TopBar.tsx
    - apps/web/src/app/globals.css
tech_stack:
  added: []
  patterns:
    - Popover-based language dropdown (DropdownMenu not available)
    - Cookie + localStorage dual persistence for locale
    - Data attribute CSS transitions for loading states
    - React Context for language state distribution
key_files:
  created:
    - apps/web/src/lib/locale-storage.ts
    - apps/web/src/components/LanguageSwitcher.tsx
    - apps/web/src/hooks/useLocaleSync.ts
    - apps/web/src/components/prospects/ProspectLanguageField.tsx
    - apps/web/src/components/PreviewLanguageToggle.tsx
    - apps/web/src/contexts/LanguageContext.tsx
  modified:
    - apps/web/src/components/shell/TopBar.tsx
    - apps/web/src/app/globals.css
decisions:
  - "Use Popover instead of DropdownMenu (not available in @tevero/ui)"
  - "Dual persistence: cookie for SSR middleware, localStorage for client reads"
  - "Flag emoji via Unicode regional indicator calculation"
  - "Locale URL handling: no prefix for EN, /lt prefix for LT"
metrics:
  duration: 4m51s
  completed: 2026-04-30T18:29:10Z
  tasks: 3/3
  files_created: 6
  files_modified: 2
---

# Phase 55 Plan 07: Language Switcher UI Summary

LanguageSwitcher component with EN/LT dropdown in header, locale persistence via cookie and localStorage, ProspectLanguageField for per-prospect communication language, PreviewLanguageToggle for content previews, and LanguageContext provider for components

## Task Completion

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create LanguageSwitcher component and locale storage utilities | 448685a74 | Done |
| 2 | Integrate LanguageSwitcher into Header and create ProspectLanguageField | ce667a777 | Done |
| 3 | Create PreviewLanguageToggle and LanguageContext | 38f81144d | Done |

## Implementation Details

### Task 1: LanguageSwitcher and Locale Storage

**locale-storage.ts:**
- `LOCALE_COOKIE_NAME = 'NEXT_LOCALE'` for next-intl middleware
- `LOCALE_STORAGE_KEY = 'preferred-locale'` for client-side
- `MAX_AGE = 60 * 60 * 24 * 365` (1 year cookie)
- `getStoredLocale()`: checks cookie first, then localStorage
- `setStoredLocale()`: sets both cookie and localStorage
- `clearStoredLocale()`: removes from both

**LanguageSwitcher.tsx:**
- Two variants: `default` (flag + native name) and `compact` (globe icon only)
- Uses Popover from @tevero/ui (DropdownMenu not available)
- `handleLanguageChange()`: removes locale prefix, builds new path, persists, navigates
- `getFlagEmoji()`: converts country code to Unicode flag emoji
- Sets `data-locale-transitioning` attribute during switch for CSS animation

### Task 2: Header Integration and ProspectLanguageField

**TopBar.tsx:**
- Added LanguageSwitcher import
- Placed in right side of header (replacing empty spacer div)

**useLocaleSync.ts:**
- Syncs locale changes to localStorage on mount/change
- Ensures localStorage stays in sync with URL-based locale changes

**ProspectLanguageField.tsx:**
- Form field for prospect communication language
- Options: `inherit` (workspace default), `en`, `lt`
- Shows workspace default language name when inherit selected
- Uses translations from `prospects` namespace

### Task 3: PreviewLanguageToggle and LanguageContext

**PreviewLanguageToggle.tsx:**
- EN/LT toggle button group for content previews
- Props: value, onChange, isLoading, disabled, showLabel
- Shows loading spinner when fetching preview content
- Used in proposal editor and agreement preview pages

**LanguageContext.tsx:**
- `LanguageContextValue`: currentLocale, isLithuanian, formality
- `LanguageProvider`: wraps app, provides context
- `useLanguage()`: throws if outside provider
- `useLanguageOptional()`: returns null if outside provider

**globals.css:**
- `[data-locale-transitioning="true"] main`: opacity transition
- Loading spinner pseudo-element during locale switch
- Respects `prefers-reduced-motion` media query

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used Popover instead of DropdownMenu**
- **Found during:** Task 1
- **Issue:** Plan specified DropdownMenu from shadcn/ui, but @radix-ui/react-dropdown-menu is not installed in @tevero/ui or apps/web
- **Fix:** Used Popover component (already available) with same UX pattern as ClientSwitcherButton
- **Files modified:** apps/web/src/components/LanguageSwitcher.tsx
- **Commit:** 448685a74

## Verification Results

All success criteria verified:
- [x] Language switcher visible in header (TopBar.tsx imports LanguageSwitcher)
- [x] Clicking LT switches UI to Lithuanian (handleLanguageChange updates URL)
- [x] Refresh page - language persists (cookie + localStorage)
- [x] Mobile has compact switcher variant (variant prop supported)
- [x] Prospect form has communication language dropdown (ProspectLanguageField)
- [x] Preview toggle switches between EN/LT (PreviewLanguageToggle)

## Self-Check: PASSED

All created files verified to exist:
- apps/web/src/lib/locale-storage.ts: FOUND
- apps/web/src/components/LanguageSwitcher.tsx: FOUND
- apps/web/src/hooks/useLocaleSync.ts: FOUND
- apps/web/src/components/prospects/ProspectLanguageField.tsx: FOUND
- apps/web/src/components/PreviewLanguageToggle.tsx: FOUND
- apps/web/src/contexts/LanguageContext.tsx: FOUND

All 3 commits verified in git log:
- 448685a74: feat(55-07): create LanguageSwitcher component and locale storage utilities
- ce667a777: feat(55-07): integrate LanguageSwitcher into header and create ProspectLanguageField
- 38f81144d: feat(55-07): create PreviewLanguageToggle and LanguageContext
