# Codebase Concerns

**Analysis Date:** 2026-05-05

## Tech Debt

**Zustand Stores for Server State:**
- Issue: Four Zustand stores manage server state instead of using TanStack Query
- Files: `apps/web/src/stores/intelligenceStore.ts`, `apps/web/src/stores/contentCalendarStore.ts`, `apps/web/src/stores/articleLibraryStore.ts`, `apps/web/src/stores/analyticsStore.ts`
- Impact: Missing automatic caching, background refetching, stale-while-revalidate patterns, and request deduplication
- Fix approach: Migrate to TanStack Query hooks as documented in the TODO [HIGH-42] comments in each file

**Autonomous Integration Pipeline Not Wired:**
- Issue: Phase 38 integration service has all steps stubbed with TODO comments
- Files: `open-seo-main/src/server/pipeline/autonomous-integration.ts`
- Impact: 107 SEO checks, link graph building, auto-fixes, and link suggestions are not integrated post-audit
- Fix approach: Wire runChecks(), buildLinkGraph(), detectOpportunities(), applyChange(), and LinkApplyService as documented in the file

**Fast API Worker Placeholder Implementations:**
- Issue: Multiple analysis functions return placeholder data instead of real implementations
- Files: `open-seo-main/src/server/workers/fast-api-worker.ts`
- Impact: Competitor snapshots, keyword gap analysis, backlink profile, content gap analysis, and local SEO analysis return mock data
- Fix approach: Implement actual analysis logic by integrating with DataForSEO, Semrush, or other SEO data providers

**AI-Writer Content Gap Analyzer Stubs:**
- Issue: Multiple analyzer services have TODO comments with placeholder implementations
- Files: `AI-Writer/backend/services/content_gap_analyzer/website_analyzer.py`, `AI-Writer/backend/services/content_gap_analyzer/keyword_researcher.py`, `AI-Writer/backend/services/content_gap_analyzer/competitor_analyzer.py`
- Impact: Content analysis, structure analysis, performance analysis, SEO analysis all return placeholder data
- Fix approach: Integrate with actual analysis services or implement the analysis logic

**Keyword Chat Pipeline Unconnected:**
- Issue: Analysis pipeline has multiple TODO items for wiring to Phase 75-81 services
- Files: `apps/web/src/lib/keyword-chat/analysis-pipeline.ts`
- Impact: ConversationIntelligence, FunnelClassifier, GeoClassifier, ConstraintFilter, CascadeSelector, PSEODetector, SideKeywordExpander not connected
- Fix approach: Wire each service as documented in the TODO comments (lines 173-292)

**Goals System Backend Not Complete:**
- Issue: Frontend goal components disable fields waiting for backend support
- Files: `apps/web/src/components/goals/GoalSetupWizard.tsx`, `apps/web/src/components/goals/GoalConfigForm.tsx`, `apps/web/src/components/goals/GoalCard.tsx`, `apps/web/src/types/goals.ts`, `apps/web/src/lib/api/goals.ts`
- Impact: Denominator, visibility options, and trend direction/value fields commented out with "TODO: Phase 40+"
- Fix approach: Implement backend support for these goal fields and re-enable frontend

**Hardcoded Company Names:**
- Issue: "TeveroSEO" and related strings hardcoded instead of using workspace settings
- Files: `open-seo-main/src/server/features/contracts/services/ContractService.ts` (lines 119, 187, 480), `open-seo-main/src/server/features/agreements/services/SignerNotificationService.ts`, `open-seo-main/src/server/services/prospect-report/prospect-report-renderer.ts`
- Impact: Multi-tenant white-labeling not possible, all contracts/emails show "TeveroSEO"
- Fix approach: Fetch company name from workspace settings table

**Email Service Not Integrated:**
- Issue: EmailService has TODO comment for actual email provider integration
- Files: `open-seo-main/src/server/services/email/EmailService.ts` (line 220)
- Impact: Email sending may be stubbed or incomplete
- Fix approach: Integrate with Resend, SendGrid, or other email provider

**Deprecated Code Still in Use:**
- Issue: Multiple deprecated interfaces, methods, and modules remain in codebase
- Files: `apps/web/src/lib/server-fetch.ts` (SanitizedError), `apps/web/src/lib/redis/cache.ts` (cacheGetUnsafe), `open-seo-main/src/lib/auth-client.ts` (entire module), `open-seo-main/src/lib/auth-mode.ts`, `open-seo-main/src/db/analytics-schema.ts` (type aliases)
- Impact: Technical debt accumulation, potential confusion for developers
- Fix approach: Migrate callers to new APIs and remove deprecated code

## Known Bugs

**OAuth State Missing in Routes:**
- Symptoms: Some OAuth routes access process.env directly without env validation
- Files: `apps/web/src/app/api/oauth/wix/authorize/route.ts`, `apps/web/src/app/api/oauth/wix/callback/route.ts`, `apps/web/src/app/api/oauth/shopify/callback/route.ts`, `apps/web/src/app/api/oauth/google/callback/route.ts`
- Trigger: OAuth flow when env variables not properly set
- Workaround: Env validated at startup via `apps/web/src/lib/env.ts` catches most issues

## Security Considerations

**Direct process.env Access:**
- Risk: Some files access process.env directly instead of using validated env module
- Files: See grep results - approximately 40 direct process.env accesses in `apps/web/src/`
- Current mitigation: Central env validation at startup catches missing/invalid vars
- Recommendations: Refactor all direct process.env access to use `import { env } from '@/lib/env'`

**Raw SQL in AI-Writer:**
- Risk: Some raw SQL queries in AI-Writer backend could be vulnerable to injection
- Files: `AI-Writer/backend/services/dual_write.py`, `AI-Writer/backend/services/subscription/limit_validation.py`, `AI-Writer/backend/services/intelligence/agents/agent_usage_tracking.py`, `AI-Writer/backend/services/integrations/wordpress_oauth.py`
- Current mitigation: Most use parameterized queries via SQLAlchemy text() or ? placeholders
- Recommendations: Audit all raw SQL for proper parameterization

**Pixel API Authentication TODO:**
- Risk: Pixel analytics endpoints have TODO comments for authentication checks
- Files: `open-seo-main/src/routes/api/pixel/[siteId]/changes.pending.ts` (line 39), `open-seo-main/src/routes/api/pixel/[siteId]/changes.history.ts` (line 58), `open-seo-main/src/routes/api/pixel/[siteId]/analytics.ts` (line 114), `open-seo-main/src/routes/api/pixel/changes/[changeId].ts` (lines 116, 209)
- Current mitigation: None visible - these may be exposed without auth
- Recommendations: Implement authentication checks per T-66-20

**Environment Files:**
- Risk: `.env.dev` file present at monorepo root, `AI-Writer/.env` present
- Files: `/home/dominic/Documents/TeveroSEO/.env.dev`, `/home/dominic/Documents/TeveroSEO/AI-Writer/.env`
- Current mitigation: `.gitignore` properly excludes `.env` patterns
- Recommendations: Ensure `.env.dev` is not committed (it appears untracked in git status)

## Performance Bottlenecks

**Large Page Components:**
- Problem: Several page components exceed 800 lines
- Files: `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` (1425 lines), `apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx` (1015 lines), `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/page.tsx` (1008 lines), `apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx` (958 lines)
- Cause: Too much logic in single files, likely causing slow re-renders
- Improvement path: Extract sub-components, move data fetching to server actions, use React.memo for expensive renders

**Large Service Files in AI-Writer:**
- Problem: Multiple Python service files exceed 1000 lines
- Files: `AI-Writer/backend/services/content_gap_analyzer/keyword_researcher.py` (1513 lines), `AI-Writer/backend/services/intelligence/sif_integration.py` (1479 lines), `AI-Writer/backend/services/seo_tools/sitemap_service.py` (1260 lines), `AI-Writer/backend/services/ai_service_manager.py` (1223 lines)
- Cause: Services have grown organically without refactoring
- Improvement path: Split by responsibility into smaller modules

## Fragile Areas

**Keyword Filtering System:**
- Files: `open-seo-main/src/server/features/keywords/filtering/ConstraintFilter.ts`, `open-seo-main/src/server/features/keywords/filtering/types.ts`, `open-seo-main/src/server/features/keywords/filtering/scoring.ts`
- Why fragile: Recently modified (appears in git status as modified), new feature under development
- Safe modification: Ensure all test files pass before committing
- Test coverage: Has test files but coverage unknown

**Client Sync Service:**
- Files: `open-seo-main/src/server/services/client-sync/ClientSyncService.ts`
- Why fragile: Many `return null` paths (12 occurrences), complex URL parsing with fallbacks
- Safe modification: Test with various URL formats and edge cases
- Test coverage: No test file visible

## Scaling Limits

**Zustand Store Memory:**
- Current capacity: Client-side state limited by browser memory
- Limit: Large datasets in stores (intelligence, articles, calendar) could cause memory issues
- Scaling path: Migrate to TanStack Query with pagination and virtualization

**Timer-Based Polling:**
- Current capacity: Multiple setInterval/setTimeout for UI state
- Limit: Too many concurrent timers degrade performance
- Scaling path: Use refs properly to clean up timers (already done in some places like `api-integrations-tab.tsx`)

## Dependencies at Risk

**Deprecated Auth System:**
- Risk: `open-seo-main/src/lib/auth-client.ts`, `open-seo-main/src/lib/auth-mode.ts`, `open-seo-main/src/lib/auth-session.ts` are all marked deprecated
- Impact: Auth is now handled by Clerk via Next.js app, but these modules still exist
- Migration plan: Remove deprecated modules once all consumers migrated

**Invoice Repository Deprecated Methods:**
- Risk: `updateInvoiceStatus` and related methods deprecated in favor of version-checking alternatives
- Impact: Using deprecated methods could cause race conditions in concurrent updates
- Migration plan: All callers should use `updateInvoiceStatusWithVersion` and `updateInvoiceStatusWithProviderAndVersion`

## Missing Critical Features

**Email Service Integration:**
- Problem: Email service has TODO for actual provider integration
- Blocks: Automated notifications, alerts, reports via email

**Alert Notification System:**
- Problem: TODO comments in `open-seo-main/src/server/workers/failed-audits-worker.ts` for notification and Slack alerting
- Blocks: Critical failure alerts, audit failure notifications

**User Notification on Token Refresh:**
- Problem: TODO in `open-seo-main/src/server/workers/token-refresh-worker.ts` for user notification
- Blocks: Users not informed when OAuth tokens need attention

## Test Coverage Gaps

**apps/web (Next.js Frontend):**
- What's not tested: 884 source files, only 33 test files (~3.7% file coverage)
- Files: Most components, actions, and hooks lack tests
- Risk: UI regressions, action failures go unnoticed
- Priority: High - this is the main user-facing app

**AI-Writer Backend:**
- What's not tested: 985 Python files, only 22 test files (~2.2% file coverage)
- Files: Most services, routers, and API endpoints lack tests
- Risk: Content generation bugs, API failures
- Priority: High - critical for content pipeline

**open-seo-main (Better Coverage):**
- What's not tested: 1424 source files, 283 test files (~20% file coverage)
- Files: Better coverage but still gaps in newer features
- Risk: SEO check regressions, audit failures
- Priority: Medium - has better coverage than other projects

**Integration Tests:**
- What's not tested: Cross-service communication between apps/web, open-seo-main, and AI-Writer
- Risk: Service integration failures in production
- Priority: High - critical for monorepo architecture

---

*Concerns audit: 2026-05-05*
