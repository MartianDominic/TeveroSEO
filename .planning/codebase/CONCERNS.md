# Codebase Concerns

**Analysis Date:** 2026-04-22

## Tech Debt

**Mock Data in Production Code:**
- Issue: Pattern detection uses mock/placeholder data instead of real API calls
- Files: `apps/web/src/actions/analytics/detect-patterns.ts`
- Impact: Pattern detection feature shows fake data, not real client analytics
- Fix approach: Replace `generateMockTrafficData()` and `generateMockRankingData()` with actual API calls to fetch workspace traffic/ranking data

**Incomplete Database Operations:**
- Issue: `dismissPattern()` and `resolvePattern()` functions have no implementation
- Files: `apps/web/src/actions/analytics/detect-patterns.ts` (lines 180-196)
- Impact: Users cannot dismiss or resolve detected patterns; actions have no effect
- Fix approach: Implement database updates via API calls as indicated in TODO comments

**AI-Writer Integration Stubs:**
- Issue: Multiple placeholders for AI-Writer database integration
- Files:
  - `open-seo-main/src/server/workers/report-processor.ts` (lines 283-286, 290-294)
  - `open-seo-main/src/routes/api/clients/$clientId.reports.ts` (line 44)
  - `open-seo-main/src/routes/api/reports/$id.ts` (line 46)
- Impact: Report generation uses placeholder "Client" name instead of actual client names
- Fix approach: Query AI-Writer's clients table via `ALWRITY_DATABASE_URL` as noted in TODOs

**Missing Position Delta Computation:**
- Issue: Keyword position changes not computed from previous period
- Files: `open-seo-main/src/server/workers/report-processor.ts` (line 170)
- Impact: Reports show `position_delta: 0` for all keywords instead of actual movement
- Fix approach: Implement historical comparison query to compute position changes

**Alert System Incomplete:**
- Issue: Email notification stub for alerts; SMS/Slack channels not implemented
- Files: `open-seo-main/src/server/workers/alert-processor.ts` (lines 164, 198, 203)
- Impact: Alert notifications partially functional; some channels silently fail
- Fix approach: Implement remaining notification channels (SMS via Twilio, Slack via webhook)

**Priority Score Placeholders:**
- Issue: Client priority scoring uses dummy values for touch and renewal data
- Files: `open-seo-main/src/server/workers/priority-score.ts` (lines 94-95)
- Impact: Priority calculations inaccurate without actual touch/renewal tracking
- Fix approach: Implement `client_touches` and `client_contracts` tables

**Deprecated Authentication Code:**
- Issue: Multiple deprecated auth functions still in codebase
- Files:
  - `open-seo-main/src/lib/auth-client.ts` (lines 4, 27, 43)
  - `open-seo-main/src/lib/auth-mode.ts` (lines 4, 23)
  - `open-seo-main/src/lib/auth-session.ts` (lines 4, 20)
- Impact: Confusion between old patterns and new Clerk-based auth
- Fix approach: Remove deprecated exports and migrate all consumers to Clerk SDK hooks

**Deprecated Redis Connection Factory:**
- Issue: `createRedisConnection()` marked deprecated but still exported
- Files: `open-seo-main/src/server/lib/redis.ts` (line 48)
- Impact: Risk of connection leaks if consumers use deprecated function
- Fix approach: Remove export or add runtime warning; ensure all callers use `getSharedBullMQConnection()`

## Known Bugs

**Proposal Signing Redirect Missing:**
- Symptoms: After signing, user may see incomplete flow
- Files: `open-seo-main/src/routes/p/$token.tsx` (line 81)
- Trigger: Complete proposal signing flow
- Workaround: None documented; TODO for Phase 30-05

**Silent Error Swallowing:**
- Symptoms: Some operations fail silently without user feedback
- Files:
  - `apps/web/src/actions/analytics/get-opportunities.ts` (line 98-100) - returns 0 on error
  - `apps/web/src/app/(shell)/dashboard/actions.ts` (multiple empty catch blocks)
  - `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` (lines 128, 136)
- Trigger: Network failures or backend errors during data fetching
- Workaround: Check console for errors; user sees stale/empty data

**Voice Templates Fetch Failure Silent:**
- Symptoms: Voice template dropdown empty without error message
- Files: `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` (lines 188-190)
- Trigger: Backend voice templates endpoint failure
- Workaround: Refresh page; no user-visible error

## Security Considerations

**XSS Risk in Report Footer:**
- Risk: HTML content rendered directly in report footer from user input
- Files: `apps/web/src/components/reports/ReportFooter.tsx` (line 53)
- Current mitigation: Comment claims DOMPurify sanitization in API layer
- Recommendations: Verify sanitization is actually applied in branding API; add CSP headers for reports

**XSS Risk in Article Content:**
- Risk: Article HTML rendered directly from AI-generated content
- Files:
  - `apps/web/src/app/(shell)/clients/[clientId]/articles/new/page.tsx` (line 90)
  - `apps/web/src/app/(shell)/clients/[clientId]/articles/[articleId]/page.tsx` (line 119)
- Current mitigation: Comments indicate content is sanitized
- Recommendations: Verify sanitization implementation; consider iframe sandboxing for untrusted content

**TypeScript Type Safety Bypasses:**
- Risk: `any` types and eslint-disable comments reduce compile-time safety
- Files:
  - `apps/web/src/lib/active-client.ts` (line 6) - `type AnyRoute = any`
  - `apps/web/src/app/page.tsx` (line 3) - same pattern
  - `open-seo-main/src/routes/api/reports/$id.ts` (line 17)
  - `open-seo-main/src/routes/api/branding/index.ts` (line 66)
- Current mitigation: None
- Recommendations: Replace `any` with proper types; investigate why typed routes don't work

**Missing Rate Limiting on Public Endpoints:**
- Risk: API abuse possible on endpoints without rate limits
- Files: Most `apps/web/src/app/api/` route handlers
- Current mitigation: Some internal rate limiting exists (`prospect-analysis`, `admin/dlq`)
- Recommendations: Add middleware-level rate limiting for all public API routes

**Hardcoded Fallback URLs:**
- Risk: Development URLs exposed in production builds
- Files:
  - `apps/web/src/lib/server-fetch.ts` - `http://ai-writer-backend:8000`
  - `apps/web/src/lib/websocket/socket-client.ts` - `http://localhost:3002`
  - `apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx` - `http://localhost:8000`
- Current mitigation: Environment variables override when set
- Recommendations: Throw error if env vars missing in production; remove localhost defaults

## Performance Bottlenecks

**Large React Component Files:**
- Problem: Several page components exceed 800+ lines
- Files:
  - `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` (1365 lines)
  - `apps/web/src/app/(shell)/settings/page.tsx` (980 lines)
  - `apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx` (885 lines)
  - `apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx` (862 lines)
  - `apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx` (800 lines)
- Cause: Multiple concerns combined in single components
- Improvement path: Extract sub-components; use composition; split by feature tabs

**Polling Without Debounce:**
- Problem: Multiple setInterval polling without cleanup optimization
- Files:
  - `apps/web/src/components/reports/ReportPreview.tsx` (line 20)
  - `apps/web/src/components/alerts/AlertDrawer.tsx` (line 45)
  - `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` (line 119)
- Cause: Intervals may overlap or continue after unmount
- Improvement path: Use React Query or SWR for polling; verify cleanup in useEffect

**Toast Timeout Accumulation:**
- Problem: Multiple setTimeout calls for toast notifications without cleanup
- Files:
  - `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` (line 145)
  - `apps/web/src/app/(shell)/settings/page.tsx` (line 509)
  - `apps/web/src/components/settings/BrandingForm.tsx` (line 74)
- Cause: Timeouts not cleared on component unmount
- Improvement path: Use useRef to track timeout IDs; clear in cleanup function

## Fragile Areas

**Client Settings Page:**
- Files: `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx`
- Why fragile: 1365 lines with 30+ state variables; multiple useEffect dependencies
- Safe modification: Extract individual settings sections into separate components
- Test coverage: No unit tests found for this component

**Pattern Detection System:**
- Files: `apps/web/src/actions/analytics/detect-patterns.ts`, `apps/web/src/lib/analytics/pattern-detection.ts`
- Why fragile: Uses mock data; cache invalidation may cause stale patterns
- Safe modification: Implement real API integration before modifying detection logic
- Test coverage: No tests for pattern detection actions

**Report Generation Pipeline:**
- Files: `open-seo-main/src/server/workers/report-processor.ts`
- Why fragile: 10-step pipeline with multiple external dependencies (Puppeteer, email, file system)
- Safe modification: Add step-level error handling; implement retry for transient failures
- Test coverage: Limited; relies on integration with BullMQ

**React Hooks Dependencies:**
- Files: Multiple components with `eslint-disable-next-line react-hooks/exhaustive-deps`
- Why fragile: Stale closure bugs possible; updates may not trigger re-renders
- Safe modification: Audit each disabled rule; fix or document why exception is needed
- Locations:
  - `apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx` (line 43)
  - `apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx` (line 366)
  - `apps/web/src/app/(shell)/clients/page.tsx` (line 44)
  - `apps/web/src/components/editor/ImageGenerationPanel.tsx` (line 106)
  - `apps/web/src/components/ClientSwitcher/ClientSwitcher.tsx` (line 59)

## Scaling Limits

**Redis Connection Per Key:**
- Current capacity: One connection per BullMQ key (queue/worker pair)
- Limit: ioredis default connection limit; Redis server `maxclients`
- Scaling path: Connection pooling if many queues added; monitor with `INFO clients`

**Report PDF Generation:**
- Current capacity: Single Puppeteer instance via WebSocket endpoint
- Limit: Concurrent PDF generation limited by Puppeteer instance memory
- Scaling path: Multiple Puppeteer workers; queue-based throttling already in place

**File System Report Storage:**
- Current capacity: Local filesystem at `REPORTS_DIR`
- Limit: Disk space; no cleanup strategy visible
- Scaling path: Implement retention policy; consider object storage (S3/R2) for large scale

## Dependencies at Risk

**Deprecated Auth Libraries:**
- Risk: Deprecated `better-auth` patterns replaced by Clerk
- Impact: Authentication could break if deprecated code paths exercised
- Migration plan: Complete removal of deprecated auth modules after Clerk migration verified

**Console Logging in Production:**
- Risk: `console.log` statements in production code
- Impact: Performance overhead; log noise; potential info leakage
- Migration plan: Replace with structured logging via `createLogger()`

## Missing Critical Features

**Localization System Incomplete:**
- Problem: Report labels hardcoded; i18n system mentioned but not implemented
- Files: `open-seo-main/src/server/workers/report-processor.ts` (lines 290-294)
- Blocks: Multi-language report generation

**Workspace ID Not From Auth:**
- Problem: Dashboard hardcodes workspace ID extraction
- Files: `apps/web/src/app/(shell)/dashboard/page.tsx` (line 44)
- Blocks: Multi-tenant workspace support

## Test Coverage Gaps

**Web App Severely Undertested:**
- What's not tested: 680 source files, only 1 test file
- Files: `apps/web/src/` (entire directory)
- Risk: Regressions undetected; refactoring unsafe
- Priority: High

**Server Actions Not Tested:**
- What's not tested: All `apps/web/src/actions/` server actions
- Files:
  - `apps/web/src/actions/analytics/detect-patterns.ts`
  - `apps/web/src/actions/analytics/get-predictions.ts`
  - `apps/web/src/actions/dashboard/get-portfolio-aggregates.ts`
  - `apps/web/src/actions/webhooks.ts`
- Risk: Business logic changes could break silently
- Priority: High

**API Routes Not Tested:**
- What's not tested: All `apps/web/src/app/api/` routes
- Files: 30+ route handlers in `apps/web/src/app/api/`
- Risk: HTTP layer bugs; authentication bypasses possible
- Priority: Medium

**open-seo-main Has Good Coverage:**
- Coverage: 85 test files for backend services
- Tested areas: Proposals, payments, onboarding, analytics, workers
- Notable: Comprehensive test coverage in `open-seo-main/src/server/features/`

---

*Concerns audit: 2026-04-22*
