---
phase: 66-platform-unification
plan: 09
subsystem: api, ui
tags: [facade, oauth, platform-integration, pixel, react, typescript]

# Dependency graph
requires:
  - phase: 66-01
    provides: pixel installation schema and service
  - phase: 61
    provides: OAuth platform connections infrastructure
  - phase: 31
    provides: write adapter interfaces
  - phase: 39
    provides: CMS publisher registry
provides:
  - PlatformIntegrationFacade unifying all integration systems
  - OAuth enhancement prompts for pixel-to-OAuth upgrade
  - /connect/enhance page for enhancement flow
affects: [66-10, 66-11, dashboard, content-publishing]

# Tech tracking
tech-stack:
  added: []
  patterns: [facade-pattern, contextual-prompts, localStorage-dismissal]

key-files:
  created:
    - open-seo-main/src/server/features/pixel/platform-facade.ts
    - open-seo-main/src/server/features/pixel/platform-facade.test.ts
    - apps/web/src/components/connect/oauth-enhancement.tsx
    - apps/web/src/components/connect/oauth-prompts.tsx
    - apps/web/src/app/connect/enhance/page.tsx
  modified:
    - open-seo-main/src/server/features/pixel/index.ts
    - apps/web/src/components/connect/index.ts

key-decisions:
  - "Facade routes to best available source (GA OAuth > pixel for traffic)"
  - "GSC OAuth required for rankings (no pixel fallback)"
  - "CWV always from pixel (primary use case)"
  - "Prompt dismissal persists 7 days via localStorage"
  - "window.location for navigation to avoid Next.js typed routes issues"

patterns-established:
  - "FacadeDependencies injection for testability"
  - "useOAuthPrompts hook for prompt state management"
  - "EnhancementPlatform type for platform metadata"

requirements-completed: [P66-PLATFORM-FACADE, P66-OAUTH-ENHANCEMENT]

# Metrics
duration: 10min
completed: 2026-05-03
---

# Phase 66 Plan 09: Platform Integration Facade Summary

**PlatformIntegrationFacade unifying P61 OAuth, P31/33 adapters, P39 publishers, and P66 pixel with intelligent routing and contextual OAuth enhancement prompts**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-03T11:26:19Z
- **Completed:** 2026-05-03T11:36:14Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- PlatformIntegrationFacade provides unified API for all platform integrations with intelligent routing
- OAuth enhancement prompts (GscPrompt, GaPrompt, GbpPrompt, CmsPublishPrompt) appear contextually
- /connect/enhance page enables users to upgrade pixel connections with OAuth
- 47 tests passing (20 facade + 27 OAuth prompts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement PlatformIntegrationFacade** - `f6572556` (feat)
   - Unified facade for P61 OAuth, P31/33 adapters, P39 publishers, P66 pixel
   - getConnectionStatus, getAvailableIntegrations, getAnalytics, updateSeoField, publishContent
   - 20 tests with graceful fallback handling

2. **Task 2: Create OAuth enhancement prompts** - `e9701785` (feat)
   - OAuthEnhancement full-page view for pixel->OAuth upgrades
   - GscPrompt, GaPrompt, GbpPrompt, CmsPublishPrompt contextual inline prompts
   - useOAuthPrompts hook for state management
   - 27 tests for components and hook

3. **Task 3: Build enhancement flow page** - `d44aa694` (feat)
   - /connect/enhance route with OAuth upgrade flow
   - Platform-specific OAuth redirect handling
   - Loading, error, and no-site states

## Files Created/Modified

- `open-seo-main/src/server/features/pixel/platform-facade.ts` - Unified platform integration facade
- `open-seo-main/src/server/features/pixel/platform-facade.test.ts` - 20 unit tests
- `open-seo-main/src/server/features/pixel/index.ts` - Export facade and types
- `apps/web/src/components/connect/oauth-enhancement.tsx` - Full-page enhancement view
- `apps/web/src/components/connect/oauth-enhancement.test.tsx` - 10 component tests
- `apps/web/src/components/connect/oauth-prompts.tsx` - Contextual prompt components
- `apps/web/src/components/connect/oauth-prompts.test.tsx` - 17 component tests
- `apps/web/src/components/connect/index.ts` - Export new components
- `apps/web/src/app/connect/enhance/page.tsx` - Enhancement flow page

## Decisions Made

- **Routing strategy:** getAnalytics routes traffic to GA OAuth if available, else pixel; rankings require GSC (no fallback); CWV always pixel
- **Capabilities computation:** Combined from pixel features + OAuth scopes with write scope pattern matching
- **Prompt dismissal:** localStorage with 7-day TTL (DISMISSAL_DURATION_MS)
- **Navigation:** Used window.location.href instead of Next.js router.push to avoid typed routes issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in other files (ConnectionCard, cwv-card) unrelated to this plan
- All 47 new tests passing

## Self-Check: PASSED

Verified all artifacts:
- [x] platform-facade.ts exists and exports PlatformIntegrationFacade
- [x] oauth-enhancement.tsx exists (260+ lines, exceeds 80 min requirement)
- [x] All 3 task commits exist in git log
- [x] Tests passing: 20 facade + 27 prompts = 47 total

## Next Phase Readiness

- PlatformIntegrationFacade ready for use by dashboard and content features
- OAuth enhancement prompts can be shown contextually throughout the app
- Ready for Phase 66-10 (i18n) and 66-11 (E2E tests)

---
*Phase: 66-platform-unification*
*Completed: 2026-05-03*
