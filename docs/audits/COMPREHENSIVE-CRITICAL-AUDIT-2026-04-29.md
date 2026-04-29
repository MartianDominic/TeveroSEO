# TeveroSEO Comprehensive Critical/High Audit
**Date:** 2026-04-29  
**Auditors:** 20 Opus agents in parallel  
**Scope:** Full platform audit for issues preventing app from working

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 12 |
| HIGH | 68 |
| **Total** | **80** |

### Top Blockers
1. **Authorization bypass** - AI-Writer's `verify_client_ownership()` always returns true
2. **Command injection** - FFmpeg subprocess in video editing
3. **DELETE without WHERE** - Full table wipe in automation.ts
4. **Missing auth headers** - Cross-service API calls without authentication
5. **Async/sync confusion** - `await` on synchronous Gemini functions

---

## CRITICAL Issues (12)

### 1. Authorization Completely Bypassed
**File:** `AI-Writer/backend/api/clients.py:755`  
**Issue:** `verify-access` endpoint always returns `hasAccess=True` for ALL authenticated users  
**Impact:** Any authenticated user can access any client's data, voice profiles, articles  
**Fix:** Implement actual `client_user_access` table lookup

### 2. Authorization Check Always True
**File:** `AI-Writer/backend/auth/dependencies.py:296-317`  
**Issue:** `verify_client_ownership()` unconditionally returns `True`  
**Impact:** All authorization checks in AI-Writer backend are no-ops  
**Fix:** Implement actual ownership check against `client_user_access` table

### 3. Command Injection via FFmpeg
**File:** `AI-Writer/backend/services/video_studio/edit_service.py:183-198`  
**Issue:** FFmpeg commands constructed with user-provided parameters without proper sanitization  
**Impact:** Arbitrary command execution on server  
**Fix:** Validate all parameters, use `shlex.quote()` for strings, validate numerics

### 4. DELETE Without WHERE Clause
**File:** `open-seo-main/src/server/features/proposals/automation/automation.ts:391`  
**Issue:** `await db.delete(automationLogs)` deletes ALL records when `proposalId` is undefined  
**Impact:** Full table wipe - destroys all automation logs across all tenants  
**Fix:** Add guard: `if (!proposalId) throw new Error("proposalId required")`

### 5. INTERNAL_API_KEY Optional with Bypass
**File:** `apps/web/src/lib/env.ts:43-47`  
**Issue:** `INTERNAL_API_KEY` marked optional with refine bypass  
**Impact:** Service-to-service auth silently passes with `undefined == undefined`  
**Fix:** Change to `.min(32)` for all environments

### 6. Missing Auth Headers in Facade
**File:** `apps/web/src/lib/audit/checks/facade.ts:44-46`  
**Issue:** Missing `INTERNAL_API_KEY` silently degrades to no auth headers  
**Impact:** Calls to open-seo-main proceed without authentication  
**Fix:** Throw error when `INTERNAL_API_KEY` is undefined

### 7. asyncio.run() in Async Context
**File:** `AI-Writer/backend/services/article_generation_service.py:962`  
**Issue:** `asyncio.run()` from within async context raises RuntimeError  
**Impact:** Daily article generation fails with "cannot be called from a running event loop"  
**Fix:** Use `loop.run_until_complete()` pattern with loop detection

### 8. Gemini Calls Without Timeout
**File:** `AI-Writer/backend/services/ai_quality_analysis_service.py:180,238,293,350,404,458,547`  
**Issue:** Multiple `gemini_structured_json_response()` calls with no timeout  
**Impact:** Quality analysis threads block indefinitely if API hangs  
**Fix:** Add `timeout` parameter or wrap in `asyncio.wait_for()`

### 9. Await on Sync Function
**File:** `AI-Writer/backend/services/ai_quality_analysis_service.py:238,293,350,404,458,547`  
**Issue:** `gemini_structured_json_response()` is synchronous but called with `await`  
**Impact:** TypeError at runtime  
**Fix:** Remove `await` or wrap in `asyncio.to_thread()`

### 10. Anthropic API Without Timeout
**File:** `open-seo-main/src/serverFunctions/voice.ts:475-509`  
**Issue:** `anthropic.messages.create()` has no timeout parameter  
**Impact:** Voice preview generation can hang indefinitely  
**Fix:** Add timeout to Anthropic client or use AbortController

### 11. SQLite Incompatible skip_locked
**File:** `AI-Writer/backend/services/article_recovery_service.py:41`  
**Issue:** `with_for_update(skip_locked=True)` is PostgreSQL-specific  
**Impact:** Recovery sweep crashes in development on SQLite  
**Fix:** Add dialect check like in `auto_publish_executor.py`

### 12. Goal Processor Blocks Event Loop
**File:** `open-seo-main/src/server/workers/goal-processor.ts:214-222`  
**Issue:** Inline processor runs heavy DB operations without sandboxing  
**Impact:** Stalls all other workers in the same process  
**Fix:** Extract to separate file and use file path like other workers

---

## HIGH Issues by Category (68)

### Build & Dependencies (3)

| File | Issue | Impact |
|------|-------|--------|
| `AI-Writer/backend/requirements.txt:64` | click version mismatch with gTTS | gTTS text-to-speech may break |
| `AI-Writer/backend` | Orphaned transitive deps (aiograpi, ccxt, optimum-onnx) | Runtime errors if imported |
| `AI-Writer/frontend/package.json:44` | React 18 vs workspace React 19 | Shared components blocked |

### Environment & Secrets (5)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/lib/env.ts:51-62` | Default localhost URLs bypass production validation | Production uses localhost |
| `Multiple .env files` | Inconsistent Clerk key naming across services | Auth failures |
| `.env.vps.example:165-166` | DISABLE_SUBSCRIPTION=true by default | Bypasses subscription enforcement |
| `AI-Writer/backend/api/assets_serving.py:28-32` | Dev fallback key used in non-production | URL forgery if exposed |
| `open-seo-main/src/server/lib/runtime-env.ts:120-121` | Security keys not validated in development | Missing security in dev |

### Database & Migrations (7)

| File | Issue | Impact |
|------|-------|--------|
| `open-seo-main/src/db/link-schema.ts:451` | Missing FK constraint on appliedChangeId | Orphan records |
| `open-seo-main/drizzle/0034_client_id_to_uuid.sql` | audits/rank_drop_events/report_schedules missing FK | Schema mismatch |
| `AI-Writer/backend/models/publishing.py` | Missing indexes on frequently queried columns | Full table scans |
| `open-seo-main/src/db/voice-schema.ts:143` | voiceProfiles allows NULL with no orphan cleanup | Storage waste |
| `open-seo-main/src/db/change-schema.ts:62` | Self-referential FK without CASCADE | Cannot delete records |
| `open-seo-main/drizzle/` | Multiple 0032_*.sql files | Migration order ambiguity |
| `open-seo-main/src/db/dashboard-schema.ts:75-76` | portfolioActivity.clientId nullable without partial index | Slow queries |

### CI/CD & Deployment (6)

| File | Issue | Impact |
|------|-------|--------|
| `.github/workflows/deploy-phase4.yml:236` | health-check runs git rev-parse without checkout | Rollback fails |
| `docker-compose.vps.yml:94` | open-seo-worker depends_on without service_healthy | Race condition |
| `Multiple deploy workflows` | Rollback SHA stores current (broken) commit | Rollback to wrong commit |
| `docker-compose.vps.yml:93-134` | open-seo-worker lacks DATAFORSEO_API_KEY | SEO audits fail silently |
| `docker-compose.vps.yml:177-211` | puppeteer-pdf missing INTERNAL_API_KEY | /ws endpoint fails |
| `docker/nginx/nginx.conf:79-82` | SSL cert paths assume Let's Encrypt exists | First deploy fails |

### Next.js App Router (5)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/app/(shell)/prospects/page.tsx:6` | Async server component lacks error handling | Page crash |
| `apps/web/src/app/(shell)/clients/.../backlinks/page.tsx` | Missing loading.tsx for heavy data | Jarring UX |
| `Multiple pages` | useSearchParams without Suspense boundary | Streaming bailout |
| `apps/web/src/app/(shell)/clients/.../audit/page.tsx:74` | useSearchParams causes CSR bailout | Performance impact |
| `apps/web/src/app/(shell)/prospects/.../preview/page.tsx:14` | useSearchParams without Suspense | Same issue |

### Authentication & Authorization (4)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/lib/auth/client-ownership.ts:196-209` | Backend verification has no auth header | 401 if backend enforced auth |
| `apps/web/src/actions/webhooks.ts:136-148` | TOCTOU race in getWebhook | Potential bypass |
| `apps/web/src/actions/webhooks.ts:326-334` | TOCTOU race in getWebhookDeliveries | Same issue |
| `open-seo-main/src/server/middleware/authz.ts:23` | 5-minute cache allows stale authorization | Delayed revocation |

### API Routes (8)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/app/api/client-intelligence/.../route.ts:26-28` | Duplicate auth call | Performance issue |
| `apps/web/src/app/connect/[token]/page.tsx:26-43` | Missing timeout on backend fetch | Page hangs |
| `open-seo-main/src/routes/api/seo/backlinks.ts:35-93` | Missing client ownership verification | Data access bypass |
| `open-seo-main/src/routes/api/seo/keyword-rankings.ts:36-98` | Missing client ownership verification | Same issue |
| `open-seo-main/src/routes/api/seo/briefs.ts:188-243` | POST doesn't verify ownership chain | Create briefs for any client |
| `open-seo-main/src/routes/api/reverts/execute.ts:100-110` | Incomplete client validation for non-single scopes | Potential bypass |
| `open-seo-main/src/routes/api/webhooks.ts:28-58` | Missing scope ownership validation | List other's webhooks |
| `apps/web/src/app/api/dashboard/export/route.ts:80` | Backend must enforce user-scoped filtering | Data leak risk |

### Server Actions (5)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/lib/api/goals.ts:168-317` | Client-side API functions lack server auth | Auth delegated to routes |
| `apps/web/src/lib/api/schedules.ts:52-119` | Same pattern | Same issue |
| `apps/web/src/lib/api/branding.ts:64-134` | Same pattern | Same issue |
| `apps/web/src/actions/analytics/get-predictions.ts:380-406` | N+1 auth calls | Performance |
| `apps/web/src/lib/auth/client-ownership.ts:66-67` | 2-minute cache allows stale access | Delayed revocation |

### React Components (8)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/components/dashboard/LazySparkline.tsx:63-103` | Memory leak from async cleanup | Orphaned requests |
| `apps/web/src/components/dashboard/ExportDialog.tsx:81-82` | State update during render | Infinite re-render |
| `apps/web/src/components/shell/AppShell.tsx:236` | setTimeout without cleanup | Memory leak |
| `apps/web/src/hooks/useScrollPosition.ts:86-89` | Missing cleanup return | Memory leak |
| `apps/web/src/components/dashboard/ClientPortfolioTable.tsx:223-349` | SortButton defined inside render | Re-mount every render |
| `apps/web/src/components/dashboard/ClientPortfolioTable.tsx:351-352` | useCallback with empty deps | Stale closure |
| `AI-Writer/frontend/src/components/shell/ClientSwitcher.tsx:42-47` | Missing dependency in useEffect | Stale data |
| `apps/web/src/components/goals/GoalSetupWizard.tsx:68-89` | Async loop without abort | Inconsistent state |

### TanStack Start (10)

| File | Issue | Impact |
|------|-------|--------|
| `open-seo-main/src/routes/_app/clients/$clientId/voice/index.tsx:25-27` | useParams with hardcoded string | Hydration mismatch |
| `open-seo-main/src/routes/_app/clients/$clientId/connections/new.tsx:17-19` | Same pattern | Same issue |
| `open-seo-main/src/routes/_app/clients/$clientId/connections/index.tsx:61-63` | Same pattern | Same issue |
| `open-seo-main/src/routes/_app/clients/$clientId/briefs/index.tsx:66-68` | Same pattern | Same issue |
| `open-seo-main/src/routes/_app/clients/$clientId/briefs/$briefId.tsx:52-54` | Same pattern | Same issue |
| `open-seo-main/src/routes/_app/clients/$clientId/briefs/new.tsx:66-68` | Same pattern | Same issue |
| `open-seo-main/src/routes/pipeline/dashboard.tsx:31-36` | Loader without error boundary | Unhandled rejection |
| `open-seo-main/src/routes/_project/p/$projectId/audit/$pageId/index.tsx:31-36` | Raw fetch without auth headers | 401 in production |
| `open-seo-main/src/routes/_app/route.tsx:27-29` | Infinite loading for non-hosted | App never renders |
| `open-seo-main/src/routes/_app/index.tsx:31-34` | useEffect mutate without guard | Infinite loops |

### BullMQ & Background Jobs (5)

| File | Issue | Impact |
|------|-------|--------|
| `open-seo-main/src/server/workers/prospect-analysis-worker.ts:96-97` | DLQ jobs never auto-cleaned | Unbounded Redis growth |
| `open-seo-main/src/server/workers/webhook-worker.ts:121-122` | DLQ jobs never auto-cleaned | Same issue |
| `open-seo-main/src/server/workers/onboarding-worker.ts:125` | DLQ removeOnFail is false | Memory leak |
| `open-seo-main/src/server/lib/redis.ts:140-144` | retryStrategy returns null | Connection dies permanently |
| `open-seo-main/src/server/queues/dlq.ts:106` | Potential infinite loop in cleanup | Cleanup hangs |

### Drizzle ORM (6)

| File | Issue | Impact |
|------|-------|--------|
| `open-seo-main/src/server/features/prospects/automation/prospectAutomation.ts:107-117` | Unbounded SELECT without LIMIT | OOM |
| `open-seo-main/src/routes/api/cron/automations.ts:30` | Unbounded SELECT all organizations | OOM at scale |
| `open-seo-main/src/server/workers/portfolio-aggregates-processor.ts:90` | Dynamic IN clause unbounded | Query timeout |
| `open-seo-main/src/server/features/keywords/services/ranking-history.ts:106-115` | Unbounded inArray query | Millions of rows |
| `open-seo-main/src/server/features/audit/repositories/AuditRepository.ts:234-240` | findMany without limit | Slow queries |
| `open-seo-main/src/server/features/audit/repositories/AuditRepository.ts:255-258` | Parallel unbounded findMany | Concurrent OOM |

### SEO Audit Engine (7)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/lib/audit/services/CheckService.ts:150` | Division by zero in score calculation | NaN scores |
| `open-seo-main/src/server/lib/audit/checks/scoring.ts:72-73` | Score can exceed 100 | Incorrect quality gate |
| `open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts:245-255` | Findings silently lost on DB error | Incomplete audits |
| `open-seo-main/src/server/workflows/site-audit-workflow-helpers.ts:97` | Failed crawls return statusCode 0 | No error differentiation |
| `open-seo-main/src/server/lib/audit/checks/tier3/cwv.ts:37-83` | CrUX cache unbounded | Memory leak |
| `apps/web/src/lib/audit/checks/facade.ts:109-114` | No retry logic for API calls | Complete failure on blips |
| `open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts:26-28` | No rate limiting on crawl | IP blacklisting |

### FastAPI Backend (5)

| File | Issue | Impact |
|------|-------|--------|
| `services/video_studio/edit_service.py:383-386` | FFmpeg volume_factor injection | Command injection |
| `api/internal.py:293` | Sync httpx.post blocks event loop | Request timeouts |
| `services/video_studio/edit_service.py:284-302` | Text escaping incomplete for FFmpeg | Filter injection |
| `routers/frontend_env_manager.py:122-136` | Arbitrary env var write in dev | Malicious injection |
| `middleware/api_key_injection_middleware.py:141-147` | Race condition in env injection | Key leakage |

### Voice & Content Generation (6)

| File | Issue | Impact |
|------|-------|--------|
| `AI-Writer/backend/services/ai_service_manager.py:492-499` | Missing fallback on quota exceeded | No graceful degradation |
| `AI-Writer/backend/services/article_generation_service.py:809-813` | Voice profile fetch failure not handled | Generation fails |
| `AI-Writer/backend/services/content_planning_service.py` | Database session leak pattern | Resource exhaustion |
| `open-seo-main/src/serverFunctions/voice.ts:429` | Static model constant may become outdated | Silent failures |
| `AI-Writer/backend/services/persona_replication_engine.py:202-207` | LLM call may timeout | Complex analysis hangs |
| `apps/web/src/lib/voiceApi.ts:134` | 60s timeout insufficient for batch | Generic failure |

### AI-Writer Frontend (10)

| File | Issue | Impact |
|------|-------|--------|
| `pages/ArticleEditorPage.tsx:189-202` | No navigation guard | Data loss |
| `pages/ClientSettingsPage.tsx:170-200` | No navigation guard | Settings loss |
| `stores/contentCalendarStore.ts:91-93` | API error silently swallowed | False success |
| `api/clientSettings.ts:86-89` | fetchVoiceTemplates errors swallowed | Empty dropdown |
| `pages/ArticleLibraryPage.tsx:493-510` | Bulk ops no transaction rollback | Inconsistent state |
| `pages/ClientIntelligencePage.tsx:451-459` | URLSearchParams injection | Parameter injection |
| `stores/articleEditorStore.ts:82-120` | Persisted state shows stale after login | Cross-user data |
| `pages/ContentCalendarPage.tsx:192` | External link without validation | XSS risk |
| `pages/ArticleLibraryPage.tsx:831` | Same external link issue | Same risk |
| `pages/ClientIntelligencePage.tsx:107-110` | Competitor links without validation | Harmful URLs |

### Scheduler & Background Tasks (6)

| File | Issue | Impact |
|------|-------|--------|
| `services/scheduler/core/scheduler.py:142-150` | In-memory job store loses one-time jobs | Jobs never execute |
| `services/scheduler/__init__.py:219-243` | run_coroutine_threadsafe can hang | Scheduler hangs |
| `services/article_generation_service.py:960-963` | asyncio.run() in sync cron | Daily gen fails |
| `services/background_jobs.py:103-104` | In-memory fallback loses jobs | Jobs lost on restart |
| `services/auto_publish_executor.py:150-162` | No max articles per cycle | Cycles overlap |
| `services/today_workflow_service.py:425` | Agent gather with no timeout | Workflow hangs |

### Security (8)

| File | Issue | Impact |
|------|-------|--------|
| `services/wavespeed/infinitetalk.py:197` | SSRF via unvalidated URL | Internal exposure |
| `services/wavespeed/generators/video/background.py:107` | SSRF via unvalidated URL | Same |
| `services/wavespeed/generators/prompt.py:152` | SSRF via unvalidated URL | Same |
| `services/wavespeed/generators/image.py:365` | SSRF via unvalidated URL | Same |
| `services/wavespeed/generators/video/enhancement.py:97` | SSRF via unvalidated URL | Same |
| `services/analytics/handlers/wordpress_handler.py:61` | SSRF via user-controlled site | Same |
| `api/goals.py:229` | Missing IDOR protection | Cross-client access |
| `api/brainstorm.py:53,152,207` | Missing authentication check | Unauthenticated access |

### Cross-Service Integration (5)

| File | Issue | Impact |
|------|-------|--------|
| `open-seo-main/src/server/features/briefs/services/AIWriterClient.ts:70-75` | Missing auth header for cross-service | 401/403 errors |
| `scheduler.py vs BullMQ` | Redis key collision risk | Data corruption |
| `docker/nginx/nginx.conf:196` | CSP blocks cross-origin calls | JS API calls blocked |
| `docker-compose.vps.yml:246` | Connection pool exhaustion risk | DB connection limit |
| `nginx/nginx.conf` | No CORS headers configured | Browser blocks requests |

### Critical Data Flows (9)

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/src/app/(shell)/clients/.../connections/page.tsx:184-188` | OAuth redirect falls back to localhost | OAuth broken |
| `AI-Writer/backend/services/client_oauth_service.py:571-572` | Expired tokens show as disconnected | False status |
| `AI-Writer/backend/services/client_oauth_service.py:110-112` | OAUTH_REDIRECT_URI defaults localhost | Callback fails |
| `apps/web/src/lib/clientOAuth.ts:152-153` | getGoogleOAuthUrl uses internal URL | Browser can't reach |
| `open-seo-main/src/server/workers/audit-worker.ts:72-103` | Audit stuck "in_progress" on failure | Perpetual stuck |
| `apps/web/src/lib/audit/repositories/FindingsRepository.ts:277-288` | baseUrl may not be passed | Runtime crash |
| `AI-Writer/backend/services/gsc_service.py:385-396` | Token refresh failure returns None | Silent empty data |
| `AI-Writer/backend/api/client_oauth.py:413-419` | OAuth callback no error params | False success |
| `apps/web/src/app/connect/success/page.tsx:11-46` | Success page no verification | False success shown |

---

## Priority Remediation Order

### P0 - Fix Immediately (Blocks All Users)
1. Authorization bypass in AI-Writer (CRITICAL #1, #2)
2. Command injection in video editing (CRITICAL #3)
3. DELETE without WHERE (CRITICAL #4)
4. Missing cross-service auth headers (CRITICAL #5, #6)

### P1 - Fix This Week (Major Functionality Broken)
1. asyncio.run() in async context (CRITICAL #7)
2. Await on sync Gemini functions (CRITICAL #9)
3. API timeouts missing (CRITICAL #8, #10)
4. OAuth localhost fallbacks (HIGH - Data Flows)
5. Missing client ownership verification (HIGH - API Routes)

### P2 - Fix This Sprint (Degraded Experience)
1. React component memory leaks (HIGH - React)
2. BullMQ DLQ cleanup (HIGH - BullMQ)
3. Unbounded queries (HIGH - Drizzle)
4. Score calculation bugs (HIGH - SEO Audit)

### P3 - Fix Next Sprint (Tech Debt)
1. useSearchParams Suspense boundaries (HIGH - Next.js)
2. TanStack useParams patterns (HIGH - TanStack)
3. Navigation guards (HIGH - AI-Writer Frontend)
4. SSRF validations (HIGH - Security)

---

*Generated by 20 parallel Opus agents on 2026-04-29*
