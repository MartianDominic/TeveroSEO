### Agent 5: apps/web State Management & Client Logic

**Status:** Complete
**Scope:** React hooks, client state, data mutations, optimistic updates

#### Summary

The apps/web state management architecture is **well-designed** with clear separation between:
- **Zustand stores** for UI state with persistence (proposals, articles, clients)
- **TanStack Query hooks** for server state (metrics, views, alerts)
- **Custom hooks** for specialized features (WebSocket, auto-save, polling)

Overall quality is high with excellent optimistic update patterns, proper cleanup in effects, and sophisticated features like undo/redo and offline queues. Main improvement opportunity: standardize all server state on TanStack Query.

#### Files Reviewed

**Custom Hooks (22 files):**
- `/apps/web/src/hooks/useAutoSave.ts` - Auto-save with debounce and offline queue
- `/apps/web/src/hooks/use-connection-wizard.ts` - Multi-step wizard state machine
- `/apps/web/src/hooks/use-websocket.ts` - WebSocket with JWT auth and reconnect
- `/apps/web/src/hooks/use-optimistic-mutation.ts` - Generic optimistic updates
- `/apps/web/src/hooks/useRowSelection.ts` - Table row selection with Shift/Ctrl
- `/apps/web/src/hooks/useValidatedAIOutput.ts` - Client-side AI output validation
- `/apps/web/src/hooks/use-verification-poll.ts` - Long-poll verification status
- `/apps/web/src/hooks/useGoalMutations.ts` - Goal CRUD with optimistic updates
- `/apps/web/src/hooks/useVariableValue.tsx` - Variable resolution context
- `/apps/web/src/hooks/useTableKeyboardNav.ts` - Table keyboard navigation (j/k)
- `/apps/web/src/hooks/useScrollPosition.ts` - Scroll position persistence
- `/apps/web/src/hooks/useSavedViews.ts` - Saved views with TanStack Query
- `/apps/web/src/hooks/usePaginatedClients.ts` - Infinite scroll with memory limits
- `/apps/web/src/hooks/useMutationWithToast.ts` - Error logging utilities
- `/apps/web/src/hooks/useAnalysisProgress.ts` - SSE progress tracking
- `/apps/web/src/hooks/useTeamMetrics.ts` - Team metrics with TanStack Query
- `/apps/web/src/hooks/use-debounced-callback.ts` - Debounced callback utility
- `/apps/web/src/hooks/usePortfolioAggregates.ts` - Portfolio stats query
- `/apps/web/src/hooks/useLocaleSync.ts` - Locale localStorage sync
- `/apps/web/src/hooks/useMediaQuery.ts` - SSR-safe media queries
- `/apps/web/src/hooks/useResponsiveTranslation.ts` - Responsive i18n
- `/apps/web/src/hooks/command-center/*.ts` - Activity feed, alerts, metrics

**State Stores (8 files):**
- `/apps/web/src/stores/proposalStore.ts` - Undo/redo with zundo temporal
- `/apps/web/src/stores/articleEditorStore.ts` - Editor state with persistence
- `/apps/web/src/stores/intelligenceStore.ts` - Client intelligence data
- `/apps/web/src/stores/clientStore.ts` - Active client with cookie persistence
- `/apps/web/src/stores/analyticsStore.ts` - Publishing analytics
- `/apps/web/src/stores/contentCalendarStore.ts` - Articles and settings
- `/apps/web/src/stores/articleLibraryStore.ts` - Article library state
- `/apps/web/src/stores/prospect-wizard-store.ts` - Prospect wizard flow

**Contexts (2 files):**
- `/apps/web/src/contexts/ThemeContext.tsx` - Theme toggle
- `/apps/web/src/contexts/LanguageContext.tsx` - Language context

**Utilities:**
- `/apps/web/src/lib/dedup.ts` - Request deduplication with Redis + LRU fallback

#### Critical Issues

*None identified*

#### High Priority Issues

**H-STATE-001: Potential stale closure in useAutoSave**
- **File:** `/apps/web/src/hooks/useAutoSave.ts:181-182`
- **Issue:** `debouncedSave(content)` passes content from closure. If re-render occurs during debounce delay, stale content may be saved.
- **Risk:** Data loss in rapid edit scenarios.
- **Recommendation:** Parse content from `contentStringRef.current` in save callback.

**H-STATE-002: WebSocket reconnection on auth transitions**
- **File:** `/apps/web/src/hooks/use-websocket.ts:275-296`
- **Issue:** `connect` function in useCallback dependencies includes `isSignedIn`, causing unnecessary reconnections during auth state transitions.
- **Risk:** Multiple WebSocket connections during login/logout.

**H-STATE-003: Potential memory leak in useAnalysisProgress**
- **File:** `/apps/web/src/hooks/useAnalysisProgress.ts:120-126`
- **Issue:** Cleanup logic calls both `cleanup?.()` and `disconnect()`, but if `connect()` returns undefined, EventSource may not close.
- **Risk:** Orphaned EventSource connections.

**H-STATE-004: Zustand stores doing server state management**
- **Files:** `analyticsStore.ts`, `contentCalendarStore.ts`, `articleLibraryStore.ts`, `clientStore.ts`, `intelligenceStore.ts`
- **Issue:** These stores fetch data in Zustand actions instead of using TanStack Query. This bypasses caching, deduplication, and background refetching.
- **Impact:** Inconsistent data freshness, no automatic revalidation.
- **Recommendation:** Migrate to TanStack Query hooks.

#### Medium Priority Issues

**M-STATE-001: Inconsistent state management patterns**
- **Issue:** Three patterns for server state: Zustand+fetch, TanStack Query, custom hooks with useState.
- **Recommendation:** Standardize on TanStack Query for all server state.

**M-STATE-002: console.log in production code**
- **File:** `/apps/web/src/hooks/command-center/useActivityFeed.ts:171`
- **Code:** `console.log("Joined workspace:", data.workspaceId);`

**M-STATE-003: Misleading hook name**
- **File:** `/apps/web/src/hooks/useMutationWithToast.ts`
- **Issue:** Named "toast" but only provides error logging utilities, no toast integration.

**M-STATE-004: Missing error monitoring integration**
- **File:** `/apps/web/src/hooks/useVariableValue.tsx:243-250`
- **Issue:** Errors logged to console only, not reported to Sentry.

**M-STATE-005: useProposalHistory returns recreated functions**
- **File:** `/apps/web/src/stores/proposalStore.ts:205-224`
- **Issue:** Arrow functions in return object are recreated on every call.

**M-STATE-006: useRowSelection missing useMemo**
- **File:** `/apps/web/src/hooks/useRowSelection.ts:64`
- **Code:** `const itemIds = items.map(getItemId);`
- **Issue:** Recalculated on every render.

**M-STATE-007: Theme hydration flash**
- **File:** `/apps/web/src/contexts/ThemeContext.tsx:21`
- **Issue:** Hardcoded "dark" initial state causes flash for light-theme users.

**M-STATE-008: useIntelligenceStore client switching**
- **File:** `/apps/web/src/stores/intelligenceStore.ts`
- **Issue:** Rapid client switching can show stale data briefly.

#### Positive Patterns Observed

1. **Excellent optimistic updates** in `use-optimistic-mutation.ts`: Query cancellation, snapshot for rollback, invalidation on settled

2. **Well-designed WebSocket hook**: JWT auth with refresh, exponential backoff, Zod schema validation, callback refs

3. **Memory-conscious pagination** in `usePaginatedClients`: `maxPages` limit, proper `gcTime`/`staleTime`

4. **Solid undo/redo** in `proposalStore.ts`: zundo temporal middleware, 50-state limit, equality check for dedup

5. **Proper cleanup patterns** across hooks: AbortController, EventSource close, WebSocket cleanup, interval clearing

6. **Request deduplication** in `dedup.ts`: Redis-backed with LRU fallback, memory limits, periodic cleanup

#### Hooks Audit Results

| Hook | Rules | Dependencies | Cleanup | Responsibility |
|------|-------|--------------|---------|----------------|
| useAutoSave | Pass | Pass | Pass | Pass |
| use-connection-wizard | Pass | Issue | Pass | Pass |
| use-websocket | Pass | Pass | Pass | Pass |
| use-optimistic-mutation | Pass | Pass | N/A | Pass |
| useRowSelection | Pass | Issue | N/A | Pass |
| useValidatedAIOutput | Pass | Pass | N/A | Pass |
| use-verification-poll | Pass | Pass | Pass | Pass |
| useGoalMutations | Pass | Pass | N/A | Pass |
| useVariableValue | Pass | Pass | N/A | Pass |
| useTableKeyboardNav | Pass | Pass | N/A | Pass |
| useScrollPosition | Pass | Pass | Pass | Pass |
| useSavedViews | Pass | Pass | N/A | Pass |
| usePaginatedClients | Pass | Pass | N/A | Pass |
| useAnalysisProgress | Pass | Issue | Pass | Pass |
| useTeamMetrics | Pass | Pass | N/A | Pass |
| use-debounced-callback | Pass | Pass | Pass | Pass |
| usePortfolioAggregates | Pass | Pass | N/A | Pass |
| useActivityFeed | Pass | Pass | Pass | Pass |
| useSmartAlerts | Pass | Pass | N/A | Pass |
| useDashboardMetrics | Pass | Pass | N/A | Pass |

#### Performance Concerns

1. **No React.memo on context providers** - ThemeContext and LanguageContext could benefit from memoizing children.

2. **Large arrays in Zustand stores** - `contentCalendarStore.articles` and `articleLibraryStore.articles` cause all subscribers to re-render on any update.

3. **useResponsiveTranslation creates two media query listeners** - Could compute both from single breakpoint check.

#### Recommendations

1. **Migrate Zustand fetch-stores to TanStack Query**: `analyticsStore`, `contentCalendarStore`, `articleLibraryStore`, `intelligenceStore`

2. **Keep Zustand for**: `proposalStore` (undo/redo), `clientStore` (persistence), `articleEditorStore` (editor state), `prospectWizardStore` (wizard flow)

3. **Standardize query key factories** like `teamKeys`, `alertKeys`, `dashboardKeys`

4. **Consider entity normalization** for articles appearing in multiple stores

5. **Remove console.log** in `useActivityFeed.ts:171`
