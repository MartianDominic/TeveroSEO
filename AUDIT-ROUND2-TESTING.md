# Test Coverage Audit Report - Round 2

**Date:** 2026-04-28  
**Scope:** Critical paths across apps/web, open-seo-main, and AI-Writer

---

## Executive Summary

The codebase has **significant test coverage gaps** despite having good test quality where tests exist. The primary concerns are:

1. **Low overall test-to-source ratio** in AI-Writer (17 tests for 545+ service files)
2. **No tests for server actions** in apps/web (19 action files, 0 test files)
3. **Missing E2E tests** for critical user flows
4. **Billing/payment logic tests are minimal** (only 4 tests covering subscription checks)

---

## 1. Missing Tests

### 1.1 Server Actions (apps/web) - CRITICAL

**Files without any test coverage:**
- `/apps/web/src/actions/seo/audit.ts`
- `/apps/web/src/actions/seo/keywords.ts`
- `/apps/web/src/actions/seo/backlinks.ts`
- `/apps/web/src/actions/seo/findings.ts`
- `/apps/web/src/actions/seo/mapping.ts`
- `/apps/web/src/actions/seo/domain.ts`
- `/apps/web/src/actions/seo/projects.ts`
- `/apps/web/src/actions/dashboard/get-clients-paginated.ts`
- `/apps/web/src/actions/dashboard/get-portfolio-aggregates.ts`
- `/apps/web/src/actions/analytics/detect-patterns.ts`
- `/apps/web/src/actions/analytics/get-opportunities.ts`
- `/apps/web/src/actions/analytics/get-predictions.ts`
- `/apps/web/src/actions/team/get-team-metrics.ts`
- `/apps/web/src/actions/voice.ts`
- `/apps/web/src/actions/webhooks.ts`
- `/apps/web/src/actions/alerts.ts`
- `/apps/web/src/actions/changes.ts`
- `/apps/web/src/actions/cms/test-connection.ts`
- `/apps/web/src/actions/views/saved-views.ts`

**Impact:** These actions contain authentication, authorization, rate limiting, and input validation logic that is completely untested.

### 1.2 AI-Writer Backend Services - CRITICAL

**Test-to-source ratio:** 17 test files / 545+ service files (~3%)

**Notable untested services:**
- `content_asset_service.py`
- `ai_analytics_service.py`
- `today_workflow_service.py`
- `platform_insights_monitoring_service.py`
- `strategy_copilot_service.py`
- `content_planning_db.py`

### 1.3 Authentication Flows

**Well tested:**
- API key validation (auth.test.ts) - 49 tests, comprehensive coverage
- OAuth state CSRF prevention (test_oauth_state_csrf_fix.py) - 11 tests
- Client OAuth tokens (test_client_oauth.py) - 5 tests

**Missing:**
- Clerk webhook handling tests
- Session token refresh flow tests
- Multi-tenant organization switching tests
- JWT expiration edge cases

### 1.4 Authorization Checks

**Well tested:**
- Client access authorization (authz.test.ts) - 17 tests with cache scenarios

**Missing:**
- Role-based permission tests (admin vs member)
- Cross-tenant data isolation tests
- Workspace invitation acceptance tests
- Permission inheritance tests

### 1.5 Billing/Payment Logic - CRITICAL

**Existing tests:** `/open-seo-main/src/server/billing/subscription.test.ts`
- Only 4 tests covering basic subscription checks
- Uses mocked Autumn billing SDK

**Missing:**
- Webhook signature verification tests
- Subscription state transition tests (upgrade/downgrade/cancel)
- Usage metering tests
- Payment failure handling tests
- Grace period logic tests
- Proration calculation tests

---

## 2. Test Quality Issues

### 2.1 Tests That Don't Assert Behavior (Empty/Weak Assertions)

No significant issues found. The existing tests have meaningful assertions.

### 2.2 Over-Mocking Hiding Bugs

**Concern areas:**

1. **subscription.test.ts** - Mocks the entire Autumn SDK. No integration test verifies:
   - Correct API calls are made to Autumn
   - Webhook payloads are correctly parsed
   - Database state is updated correctly after billing events

2. **auth.test.ts** - Heavy database mocking means:
   - No verification that SQL queries are correct
   - No verification that database transactions are properly committed
   - Race conditions in lastUsedAt updates are not tested

3. **test_publish_flow_integration.py** - Uses MockArticle/MockClient instead of real ORM models:
   - Database constraint violations are not caught
   - JSONB serialization issues are explicitly noted as avoided

### 2.3 Flaky Test Indicators

No obvious flaky tests identified. The use of `vi.useFakeTimers()` in rate limit tests is done correctly.

---

## 3. Edge Cases Not Tested

### 3.1 Error Paths

**Tested:**
- Redis connection failures (fail-open behavior)
- Database connection failures
- API timeout handling
- Malformed JSON responses

**Missing:**
- Partial database transaction failures (commit succeeds, post-commit hook fails)
- Network partition during long-running operations
- Concurrent modification conflicts
- Out-of-disk-space errors during file writes

### 3.2 Boundary Conditions

**Tested:**
- Empty input handling
- Maximum rate limit reached
- Score boundaries (0, 100, -1)

**Missing:**
- Maximum URL length limits
- Maximum HTML payload size
- Integer overflow in metrics aggregation
- Timezone edge cases (DST transitions)
- Unicode normalization edge cases

### 3.3 Concurrent Operations

**Tested:**
- Concurrent API key validation (auth.test.ts)
- Rate limit sliding window correctness

**Missing:**
- Concurrent article publishing attempts
- Concurrent audit runs on same URL
- Race conditions in keyword research caching
- Optimistic locking conflict resolution

---

## 4. Integration Test Gaps

### 4.1 API Contracts

**Tested:**
- apps/web <-> open-seo-main check proxy flow
- Client CRUD REST API (test_clients.py)
- OAuth callback handling

**Missing:**
- apps/web <-> AI-Writer API contracts
- Webhook payload format verification
- GraphQL schema validation (if applicable)
- API versioning/deprecation handling

### 4.2 Database Interactions

**Tested:**
- Schema constraint tests (cascade deletes, unique constraints)
- Basic CRUD operations

**Missing:**
- Transaction isolation level tests
- Connection pool exhaustion handling
- Migration rollback verification
- Index usage verification (slow query detection)

### 4.3 External Service Integrations

**Tested:**
- GSC service URL validation (SSRF prevention)
- GSC credential storage/retrieval

**Missing:**
- DataForSEO API response handling
- Clerk webhook signature verification
- Redis pub/sub message handling
- BullMQ job retry behavior

---

## 5. Recommendations

### Priority 1 (Critical) - Week 1

1. **Add server action tests for apps/web**
   - Focus on authentication and authorization assertions
   - Test input validation with invalid UUIDs, SQL injection attempts
   - Verify rate limiting is applied

2. **Add billing webhook tests**
   - Test webhook signature verification
   - Test subscription state machine transitions
   - Test payment failure handling

### Priority 2 (High) - Week 2

3. **Add integration tests with real database**
   - Use test database instead of SQLite for PostgreSQL-specific features
   - Test JSONB queries in AI-Writer
   - Test Row-Level Security policies

4. **Add E2E tests for critical flows**
   - Client onboarding flow
   - Audit initiation and result viewing
   - Article generation and publishing

### Priority 3 (Medium) - Week 3

5. **Add concurrent operation tests**
   - Use async/parallel test execution
   - Test optimistic locking in AI-Writer
   - Test BullMQ job deduplication

6. **Add AI-Writer service tests**
   - Prioritize services handling user data
   - Focus on error handling paths

---

## 6. Coverage Metrics Summary

| Component | Source Files | Test Files | Ratio | Grade |
|-----------|-------------|------------|-------|-------|
| apps/web/src/lib | 15 | 7 | 47% | C |
| apps/web/src/actions | 19 | 0 | 0% | F |
| open-seo-main/src/server | 345 | 139 | 40% | D |
| open-seo-main/src/db | 20 | 17 | 85% | A |
| AI-Writer/backend/services | 545 | 17 | 3% | F |

**Overall Grade: D** (Significant gaps in critical paths)

---

## 7. Files Examined

### apps/web Tests
- `/apps/web/src/lib/middleware/rate-limit.test.ts` - 17 tests, excellent coverage
- `/apps/web/src/lib/utils/api-validation.test.ts` - 29 tests, comprehensive
- `/apps/web/src/lib/audit/checks/facade.integration.test.ts` - 40+ tests, excellent

### open-seo-main Tests
- `/open-seo-main/src/server/middleware/auth.test.ts` - 49 tests, comprehensive
- `/open-seo-main/src/server/middleware/authz.test.ts` - 17 tests, good
- `/open-seo-main/src/server/middleware/rate-limit.test.ts` - 20 tests, good
- `/open-seo-main/src/server/billing/subscription.test.ts` - 4 tests, minimal

### AI-Writer Tests
- `/AI-Writer/backend/tests/test_client_oauth.py` - 5 tests, good
- `/AI-Writer/backend/tests/test_clients.py` - 11 tests, good
- `/AI-Writer/backend/tests/test_publish_flow_integration.py` - 30+ tests, good
- `/AI-Writer/backend/tests/test_oauth_state_csrf_fix.py` - 11 tests, excellent
- `/AI-Writer/backend/tests/test_gsc_service.py` - 80+ tests, excellent security coverage
