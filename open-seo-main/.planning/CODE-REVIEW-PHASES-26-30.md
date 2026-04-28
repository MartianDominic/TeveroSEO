# Comprehensive Code Review: Phases 26-30

**Generated:** 2026-04-21
**Scope:** Prospect Data Model → Interactive Proposals
**Reviewers:** 20 Opus subagents

---

## Review Categories

Each agent reviews for:
- **Security** — Input validation, injection prevention, auth checks, secret handling
- **Code Quality** — Naming, complexity, error handling, type safety
- **Performance** — N+1 queries, memory leaks, caching, unnecessary computation
- **Testing** — Coverage, edge cases, mock quality, assertion strength
- **Architecture** — Separation of concerns, API design, patterns

---

## Phase 26: Prospect Data Model

### Agent 1: Schema & Database Review
**Files:** `src/db/prospect-schema.ts`, `src/db/prospect-schema.test.ts`, migrations
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] `contactEmail` field has no validation at schema level. While service layer validates domain, email format validation should be considered for data integrity.
- [P3] `notes` field is unbounded TEXT. Consider adding length validation to prevent excessively large entries (service layer should enforce max length).
- [P2] `assignedTo` field references user by TEXT but has no foreign key constraint. This could lead to orphaned references if users are deleted.

#### Code Quality
- [P3] Status fields use `text("status")` instead of `pgEnum`. While the TypeScript enum constants are well-defined, PostgreSQL native enums would provide DB-level validation.
- [P3] JSONB types are well-typed with TypeScript interfaces (`DomainMetrics`, `OrganicKeywordItem`, etc.) - good practice.
- [P3] `OpportunityKeyword.source` is hardcoded to `"ai_generated"` literal type. Consider using a const enum if additional sources are planned.
- [P2] Missing migration for `opportunity_keywords` column. The schema defines it but no migration adds it to the database.

#### Performance
- [P3] Good index coverage: `ix_prospects_workspace`, `ix_prospects_status`, unique constraint on `(workspace_id, domain)`.
- [P3] `ix_analyses_prospect` and `ix_analyses_status` provide adequate coverage for common queries.
- [P2] Consider adding a composite index on `prospect_analyses(prospect_id, status)` if filtering by both is common.
- [P3] JSONB columns (`keyword_gaps`, `organic_keywords`) are not indexed. Consider GIN indexes if querying within JSONB is needed.

#### Testing
- [P1] Test coverage is inadequate. Tests only verify TypeScript types compile correctly (type assertions), not actual database operations.
- [P1] No integration tests for schema validation (e.g., unique constraint enforcement, cascade deletes).
- [P1] No tests for JSONB field serialization/deserialization round-trips.
- [P2] `ScrapedContent` and `OpportunityKeyword` types are not tested.

#### Architecture
- [P3] Good normalization: prospects-to-analyses is 1:many with proper FK cascade.
- [P3] Relations are correctly defined using Drizzle `relations()` helper.
- [P2] `convertedClientId` on prospects should ideally reference a clients table FK, but this may be intentional for decoupling.
- [P3] Timestamp columns consistently use `{ withTimezone: true, mode: "date" }` - good practice.

#### Recommendations
1. Add migration `0015_add_opportunity_keywords.sql` for the missing `opportunity_keywords` column.
2. Significantly expand test coverage to include database integration tests (CRUD operations, constraint violations, cascade behavior).
3. Consider adding `pgEnum` for status fields to get DB-level validation.
4. Add FK constraint for `assignedTo` to user table, or document why it is intentionally a soft reference.
5. Add input length validation for `notes` field in the service layer (max ~10000 chars).

**Overall:** PASS_WITH_NOTES

---

### Agent 2: Server Services Review
**Files:** `src/server/features/prospects/services/ProspectService.ts`, `AnalysisService.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] ProspectService.update() relies on caller to verify workspace ownership (documented in T-26-02 comment). This is acceptable if consistently enforced at the API layer, but consider adding a workspaceId parameter for defense-in-depth.
- [P3] Domain validation regex allows punycode domains (xn--) but does not validate IDN encoding. Low risk since domain is normalized to lowercase.
- [P2] AnalysisService.triggerAnalysis() validates prospect belongs to workspace, but markRunning/markFailed/updateAnalysisResult do not verify ownership. Workers should be trusted but adds surface area.
- [P3] Rate limiting in getWorkspaceAnalysisCountToday() fetches up to 1000 completed jobs per call. Could be abused to cause memory pressure if attacker spams analyses.

#### Code Quality
- [P3] ProspectService.validateDomain() throws AppError("VALIDATION_ERROR") but UpdateProspectInput.status validation also uses "VALIDATION_ERROR" - consistent error codes, good.
- [P2] AnalysisService.markFailed() has unused `error` parameter in function signature. The error message is logged but not stored in the database.
- [P3] AnalysisService.updateAnalysisResult() performs two separate queries (update then select) that could be combined using RETURNING clause for better atomicity.
- [P3] LOCATION_CODES constant exported but not used in AnalysisService. Appears intended for future use or external callers.

#### Performance
- [P2] ProspectService.findById() makes two separate database queries (prospect + analyses). Could use a JOIN or single query with lateral for better performance at scale.
- [P2] AnalysisService.updateAnalysisResult() and markFailed() both re-query the database to get prospectId after update. Could use RETURNING clause to avoid extra query.
- [P1] getWorkspaceAnalysisCountToday() in queue module fetches up to 1200 jobs (1000 completed + 100 active + 100 waiting) to count today's analyses. This is O(n) on all jobs. Should use Redis ZRANGEBYSCORE with timestamp or database query on prospect_analyses table instead. **✅ FIXED** - Now queries prospect_analyses table directly with JOIN to prospects, filtered by workspaceId and createdAt >= startOfDay.

#### Testing
- [P1] No test file found for ProspectService.ts - missing unit tests for domain validation, CRUD operations, and edge cases.
- [P2] AnalysisService.test.ts has only 3 tests covering rate limiting and LOCATION_CODES. Missing tests for: markRunning, markFailed, updateAnalysisResult, findById, getRemainingAnalysesToday.
- [P2] Database mock in AnalysisService.test.ts is overly simplified - doesn't properly chain mock calls, may not catch real query issues.
- [P3] Test uses dynamic import which can mask initialization errors.

#### Architecture
- [P3] ProspectService and AnalysisService are exported as singleton objects rather than classes with dependency injection. Makes testing harder and prevents different instances for different contexts.
- [P3] index.ts re-exports all services - clean barrel file pattern, no issues.
- [P2] Status transitions (new -> analyzing -> analyzed/new, new -> converted) are managed across multiple methods without a formal state machine. Could lead to invalid state transitions.
- [P3] Domain normalization logic is duplicated implicitly (could be used by external callers). Consider extracting to shared utility.

#### Recommendations
1. **Add ProspectService tests** - Create comprehensive unit tests for domain validation, CRUD operations, and edge cases (duplicate domain, invalid status, etc.)
2. **Expand AnalysisService tests** - Add tests for all service methods, especially the status update flows and error handling paths
3. **Fix getWorkspaceAnalysisCountToday performance** - ✅ FIXED - Now queries prospect_analyses table with timestamp filter instead of scanning BullMQ job list
4. **Store error in analysis record** - markFailed() receives error string but doesn't persist it. Add error_message column or store in JSONB metadata
5. **Consider state machine** - Formalize prospect status transitions to prevent invalid states

**Overall:** PASS_WITH_NOTES

---

### Agent 3: DataForSEO Integration Review
**Files:** `src/server/lib/dataforseoClient.ts`, prospect queue/worker
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] API key validation missing - `dataforseoProspect.ts` line 32 uses `process.env.DATAFORSEO_API_KEY ?? ""` which sends an empty Authorization header if unset, rather than failing fast. Compare with `dataforseoBacklinks.ts` which uses `getRequiredEnvValue()` to throw early.
- [P3] Error message sanitization adequate - error responses truncate raw API responses to 500 chars (`rawText.slice(0, 500)`) preventing excessive data exposure.
- [P3] Rate limiting documented but enforced at queue level (10/day per workspace) - consider also adding per-minute limits to prevent burst abuse.

#### Code Quality
- [P1] Inconsistent API authentication patterns - `dataforseoProspect.ts`, `dataforseoKeywordGap.ts`, and `dataforseo.ts` each implement their own `createAuthenticatedFetch()` pattern, while `dataforseoBacklinks.ts` uses `getRequiredEnvValue()`. Should use a single shared utility.
- [P2] Error handling in processor is robust - re-throws after marking job failed to allow BullMQ retry logic, and website scraping failures are gracefully handled without failing the entire analysis (line 169-175).
- [P3] Type safety is good - Zod schemas validate all DataForSEO responses with `.passthrough()` for forward compatibility.

#### Performance
- [P1] Rate limiting between API calls uses fixed 100ms delay (`API_RATE_LIMIT_MS`) - adequate for serial calls but could be improved with adaptive rate limiting based on DataForSEO response headers or exponential backoff on rate limit errors.
- [P2] Sequential API calls in processor - `fetchDomainRankOverviewRaw`, `fetchKeywordsForSiteRaw`, `fetchCompetitorsDomainRaw` are called sequentially with `sleep()` between them. The first two could be parallelized since they're independent.
- [P3] Worker concurrency set to 2 - reasonable for API rate limiting concerns, but could be configurable via environment variable for scaling.

#### Testing
- [P2] Queue test coverage is good but relies on complex mock chain with `__mockAdd`, `__mockGetCompleted` etc. - fragile to module loading order changes.
- [P2] Missing processor integration tests - `prospect-analysis-processor.ts` has no dedicated test file; the complex multi-step workflow with rate limiting deserves explicit test coverage.
- [P3] DataForSEO API mock tests cover happy paths and basic errors but missing tests for rate limit responses (HTTP 429), partial API failures mid-analysis, and timeout scenarios.
- [P3] Schema tests in `dataforseoProspectSchemas.test.ts` validate structure but don't test schema evolution/backward compatibility scenarios.

#### Architecture
- [P2] Queue/worker separation is clean - queue defines types and submission, worker handles connection/events, processor handles business logic via BullMQ sandboxed processor pattern.
- [P3] Job data structure is well-typed with `ProspectAnalysisJobData` interface including audit fields (`triggeredAt`, `triggeredBy`).
- [P3] DLQ implementation is manual (line 84-104 in worker) - BullMQ has built-in dead letter queue support that could simplify this code.
- [P3] Idempotency partially addressed - job ID uses `prospectId + timestamp` preventing exact duplicates, but a re-triggered analysis for the same prospect creates a new job (which may be intentional).

#### Recommendations
1. Consolidate API authentication into a single shared `createDataforseoAuthenticatedFetch()` utility that throws on missing API key.
2. Add integration tests for `prospect-analysis-processor.ts` covering the full analysis flow with mocked DataForSEO responses.
3. Parallelize independent API calls in processor (domain overview + keywords can run concurrently before competitors).
4. Consider using BullMQ's built-in `removeOnFail` with `failParentOnFailure: false` and dead letter queue options instead of manual DLQ logic.
5. Add rate limit detection (HTTP 429) with exponential backoff in the DataForSEO fetch utilities.
6. Make worker concurrency configurable via `PROSPECT_ANALYSIS_CONCURRENCY` environment variable.

**Overall:** PASS_WITH_NOTES

---

### Agent 4: Prospects UI Review
**Files:** `src/client/components/prospects/`, `src/routes/_app/prospects/`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] `console.log` placeholder in `$prospectId.tsx:137` for "Add to targets" callback - should be removed or replaced with proper logging before production
- [P3] `notes` field in `$prospectId.tsx:232` uses `whitespace-pre-wrap` without sanitization - React auto-escapes, so XSS is mitigated, but worth noting for future rich text support
- [P3] Server function authorization is properly implemented in `prospects.ts` - all endpoints verify `organizationId` ownership before returning/modifying data

#### Code Quality
- [P3] `StatusBadge` component is duplicated in both `index.tsx` (lines 116-130) and `$prospectId.tsx` (lines 150-164) - should be extracted to shared component
- [P2] `ProposalBuilderPage` in `proposal.tsx` has 12+ useState hooks (lines 44-56) - consider consolidating into a reducer or custom hook for better maintainability
- [P2] `useMemo` in `proposal.tsx:59-66` is used for side effects (`setState`) - should use `useEffect` instead, as `useMemo` is for memoizing values, not triggering state updates
- [P3] Missing TypeScript interface for `prospect` return type in route components - relies on inferred types from server functions
- [P3] Clean barrel export in `index.ts` - proper organization of component exports with types

#### Performance
- [P3] `TooltipProvider` is nested inside table row map in `KeywordGapTable.tsx` (line 209) and `OpportunityKeywordsTable.tsx` (line 297) - should wrap the table once to avoid provider recreation per row
- [P2] No virtualization for large keyword/opportunity lists - tables with 500+ rows may have performance issues; consider `@tanstack/react-virtual` for large datasets
- [P3] `calculateGapSummary` and `calculateOpportunitySummary` are correctly memoized in tab components
- [P3] Immutable sorting patterns used correctly in both `KeywordGapTable` and `OpportunityKeywordsTable`

#### Testing
- [P2] `DifficultyBadge.test.ts` tests utility functions (`getDifficultyLevel`, `getDifficultyConfig`) thoroughly but does not test the React component rendering
- [P3] Tests for utility functions include good edge case coverage (null, undefined, out-of-range values)
- [P3] No tests for route components (`index.tsx`, `$prospectId.tsx`, `proposal.tsx`) - these rely on integration/E2E testing
- [P3] Tests use immutability assertions (e.g., "should not mutate the original array") - good practice

#### Architecture
- [P3] Route protection relies on client-side redirect in `_app/route.tsx` - acceptable since server functions have proper auth middleware
- [P2] `proposal.tsx` imports server function `generateDefaultContent` directly on client (line 13) - this may cause bundling issues; should use a server function wrapper
- [P3] Good separation of concerns: utility functions extracted and testable, components focused on rendering
- [P3] `OpportunityKeywordsTab` duplicates CSV export logic instead of reusing from `@/client/utils/export` - minor DRY violation
- [P3] Immutable patterns correctly used in sorting and filtering functions across all components

#### Recommendations
1. Extract `StatusBadge` to a shared component in `src/client/components/prospects/StatusBadge.tsx`
2. Replace `useMemo` with `useEffect` in `proposal.tsx` for the content initialization side effect
3. Wrap tables with single `TooltipProvider` at parent level instead of per-row providers
4. Add component rendering tests using `@testing-library/react` for `DifficultyBadge`, loading states, and empty states
5. Consider virtualizing tables for large datasets (500+ keywords) using `@tanstack/react-virtual`
6. Verify `generateDefaultContent` import in `proposal.tsx` works correctly with SSR/client boundary; may need server function wrapper
7. Consolidate CSV export logic from `OpportunityKeywordsTab` to reuse shared `export.ts` utilities

**Overall:** PASS_WITH_NOTES

---

## Phase 27: Website Scraping

### Agent 5: Scraper Core Review
**Files:** `src/server/lib/scraper/dataforseoScraper.ts`, `multiPageScraper.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] **No URL validation before scraping** — `fetchRawHtml()` and `scrapeProspectPage()` accept arbitrary URLs without validation. This enables SSRF attacks where an attacker could use the scraper to probe internal network resources (e.g., `http://169.254.169.254/` AWS metadata, `http://localhost:3000/admin`). Should validate URLs are publicly accessible external domains only.
- [P2] **Missing URL scheme enforcement** — `normalizeDomain()` accepts `http://` URLs which could expose traffic to MITM attacks. Consider enforcing HTTPS-only for prospect scraping.
- [P3] **API key exposure in error messages** — Error messages from `postDataforseo()` include raw response text which could potentially leak sensitive information in logs or error responses.

#### Code Quality
- [P3] **Good type safety** — Proper use of Zod schemas (`onPageContentParsingLiveItemSchema`, `onPageRawHtmlItemSchema`) for API response validation. Strong typing with discriminated unions in `ScrapeResponse`.
- [P3] **Clean error handling** — Consistent use of `AppError` with appropriate error codes. Errors are caught and converted to `ScrapeError` responses gracefully.
- [P3] **Well-documented functions** — Clear JSDoc comments explaining purpose, parameters, and cost implications.
- [P2] **Magic number in sleep delay** — `sleep(1000)` in `multiPageScraper.ts:89` should be a named constant (e.g., `SCRAPE_DELAY_MS`) for clarity and configurability.

#### Performance
- [P2] **Sequential scraping** — `scrapeProspectSite()` scrapes pages sequentially with 1s delays. For 4 pages, this takes 3+ seconds of artificial delay. Consider parallel requests with rate limiting instead.
- [P3] **No timeout configuration** — The scraper relies on DataForSEO's timeouts. Consider adding explicit timeout handling for hung requests.
- [P3] **Memory efficiency** — HTML strings are held in memory but appropriately processed through `analyzeHtml()` without unnecessary copies. Good pattern.

#### Testing
- [P3] **Good mock isolation** — Tests properly mock `fetch` globally and clear mocks between tests.
- [P3] **Comprehensive scenarios covered** — Tests cover: success paths, redirect handling, API errors, HTTP errors, individual page failures, domain normalization, homepage failure, no business links.
- [P2] **Missing SSRF test** — No tests verify URL validation rejects internal/private IPs. Should add tests for `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254`.
- [P2] **Missing malformed URL tests** — No tests for URLs with special characters, unicode, or path traversal attempts.

#### Architecture
- [P3] **Good separation of concerns** — Clean layering: `fetchRawHtml()` (low-level API) → `scrapeProspectPage()` (single page) → `scrapeProspectSite()` (multi-page orchestration).
- [P3] **Extensible link detection** — Pattern-based link detection in `linkDetector.ts` is easy to extend with new patterns.
- [P3] **Reusable types** — Shared types in `types.ts` enable clean interfaces between modules.
- [P2] **Page limit not configurable** — Hard-coded 4-page limit (1 homepage + 3 additional). Consider making configurable via options parameter.

#### Recommendations
1. **Add URL validation** — Implement a `validateScrapableUrl()` function that rejects private IPs, localhost, AWS metadata IPs, and other SSRF targets. Apply before any DataForSEO API calls.
2. **Extract constants** — Move `SCRAPE_DELAY_MS = 1000` and `MAX_ADDITIONAL_PAGES = 3` to named constants at module level.
3. **Add SSRF tests** — Add test cases that verify rejection of `http://localhost`, `http://127.0.0.1`, `http://10.0.0.1`, `http://169.254.169.254`.
4. **Consider parallel scraping** — Evaluate if DataForSEO supports concurrent requests, and if so, use `Promise.allSettled()` with rate limiting instead of sequential scraping.

**Overall:** PASS_WITH_NOTES

---

### Agent 6: Content Extraction Review
**Files:** `src/server/lib/scraper/businessExtractor.ts`, `linkDetector.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] **businessExtractor.ts**: No HTML sanitization needed since it processes structured PageAnalysis data rather than raw HTML - clean architecture prevents injection vectors
- [P3] **linkDetector.ts**: Regex patterns are simple anchored patterns (e.g., `/^\/products(\/|$|\?|#)/i`) - not vulnerable to ReDoS
- [P2] **linkDetector.ts**: Missing handling for dangerous URL schemes (`javascript:`, `data:`, `vbscript:`) - these could pass through `normalizeUrl` if crafted to match pattern structure (e.g., `javascript:void(/about/)`)
- [P3] **businessExtractor.ts**: API key from env var is secure; empty string fallback causes graceful degradation with warning log

#### Code Quality
- [P3] **businessExtractor.ts**: Good - Zod schema validation ensures type safety for Claude's JSON response with explicit bounds checking (`z.number().min(0).max(1)` for confidence)
- [P3] **businessExtractor.ts**: Good - Proper error handling with fallback to empty BusinessInfo on any failure (API error, JSON parse, schema validation)
- [P3] **linkDetector.ts**: Good - Clear separation between URL normalization, pathname extraction, and pattern matching
- [P3] **linkDetector.ts**: Good - Priority-based pattern matching ensures exact matches preferred over variants (e.g., `/products` before `/shop`)
- [P2] **businessExtractor.ts**: Magic number `2048` for `max_tokens` should be extracted to a named constant for clarity
- [P3] **businessExtractor.ts**: Model version `claude-3-5-sonnet-20241022` is hardcoded - consider making configurable via env var for model upgrades

#### Performance
- [P2] **businessExtractor.ts**: No caching of extraction results - repeated calls for same domain/pages will re-invoke Claude API (expensive)
- [P3] **linkDetector.ts**: O(patterns * links) complexity is acceptable for typical use cases (usually <100 links, 20 patterns)
- [P3] **linkDetector.ts**: Good - Early exit with `break` in `findCategories` after 3 matches prevents unnecessary iteration

#### Testing
- [P1] **businessExtractor.test.ts**: Missing test for when `ANTHROPIC_API_KEY` is not set - should verify empty result with confidence=0 is returned
- [P1] **businessExtractor.test.ts**: Missing test for invalid JSON response from Claude (e.g., malformed JSON, incomplete response)
- [P1] **businessExtractor.test.ts**: Missing test for Zod validation failure (e.g., confidence > 1, missing required fields)
- [P2] **linkDetector.test.ts**: Missing test for dangerous URL schemes (`javascript:void(0)`, `mailto:test@example.com`, `data:text/html`)
- [P2] **linkDetector.test.ts**: Missing test for empty link array and edge cases like undefined array elements
- [P3] **linkDetector.test.ts**: Excellent existing coverage - 19 test cases covering URL variants, case sensitivity, external filtering, priority ordering, category limits

#### Architecture
- [P3] **businessExtractor.ts**: Good - Clean separation between prompt building (`buildPrompt`) and API interaction (`extractBusinessInfo`)
- [P3] **linkDetector.ts**: Good - Single responsibility principle followed - only detects business-relevant links from link lists
- [P2] **businessExtractor.ts**: Consider dependency injection for Anthropic client to improve testability without needing `vi.mock`
- [P3] **linkDetector.ts**: Good - Pattern arrays are easily extensible for new URL conventions (e.g., adding `/marketplace` to products)

#### Recommendations
1. **Add missing API key test**: Test that `extractBusinessInfo` returns empty result with `confidence: 0` when `ANTHROPIC_API_KEY` is not set
2. **Add error response tests**: Test behavior when Claude returns invalid JSON, incomplete response, or schema-mismatched data
3. **Filter dangerous URL schemes**: Add explicit check in `normalizeUrl` to reject `javascript:`, `data:`, `vbscript:`, `mailto:` schemes
4. **Consider result caching**: For repeated analysis of same domain, cache BusinessInfo results with TTL (Redis or in-memory with LRU)
5. **Extract constants**: Move `max_tokens: 2048` and model name to named constants or configuration

**Overall:** PASS_WITH_NOTES


---

### Agent 7: Scraper Types & Integration Review
**Files:** `src/server/lib/scraper/types.ts`, `index.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] No sensitive field markers: The types do not explicitly mark or redact sensitive data. `RawHtmlResult.html` could potentially contain secrets from scraped pages. Consider adding a `@sensitive` JSDoc annotation for documentation purposes.
- [P3] No input validation types: The `ScrapeResponse` discriminated union relies on runtime checks but there are no Zod schemas for these types. The scraper itself uses Zod for DataForSEO responses, but the exported types lack runtime validation counterparts.

#### Code Quality
- [P2] Missing type guard: The `ScrapeResponse` discriminated union uses `success: true/false` but no type guard function (e.g., `isScrapeResult(r): r is ScrapeResult`) is exported. Consumers must use inline type narrowing.
- [P3] Incomplete JSDoc: `RawHtmlResult` has a module-level comment but individual fields lack documentation (e.g., what `statusCode` values are expected, what `responseTimeMs` measures exactly).
- [P3] `BusinessLinks.categories` uses `string[]` while other fields use `string | null`. Consistent pattern is good, but the `categories` field could benefit from a max length comment (currently limited to 3 in `linkDetector.ts` but not documented in the type).

#### Performance
- [P3] Types are pure compile-time constructs with no runtime overhead. Good design.
- [P3] `PageAnalysis` is imported from `@/server/lib/audit/types` which is appropriate reuse. No duplication.

#### Testing
- [P2] No dedicated type tests: While the scraper modules have tests (`dataforseoScraper.test.ts`, `linkDetector.test.ts`, `multiPageScraper.test.ts`), there are no tests validating type guard behavior or edge cases of the discriminated union at runtime.
- [P3] Consider adding a simple test that validates `ScrapeResult.success === true` vs `ScrapeError.success === false` type narrowing works correctly.

#### Architecture
- [P3] Clean barrel pattern: `index.ts` correctly exports all types and functions with named exports. No default exports, which is good.
- [P3] Good type reuse: `PageAnalysis` is imported from the audit module rather than duplicated, maintaining DRY principles.
- [P3] `MultiPageScrapeResult.errors` inline type `Array<{ url: string; error: string }>` could be extracted to a named type (e.g., `PageScrapeError`) for reusability if error handling patterns expand.
- [P3] Dependency direction is correct: types flow outward from `types.ts`, used by scrapers, and re-exported via barrel.

#### Recommendations
1. Add a type guard function `isScrapeSuccess(r: ScrapeResponse): r is ScrapeResult` for cleaner consumer code
2. Consider adding Zod schemas parallel to interfaces for runtime validation at API boundaries
3. Document the `categories` array max length constraint in the type itself

**Overall:** PASS_WITH_NOTES

---

## Phase 28: Keyword Gap Analysis

### Agent 8: Keyword Gap API Review
**Files:** `src/server/lib/dataforseoKeywordGap.ts`, schema extensions
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] API key fallback to empty string — `process.env.DATAFORSEO_API_KEY ?? ""` (line 31) silently uses empty auth if key missing; should validate presence at startup or throw meaningful error on first use
- [P3] Response truncation in error message — `rawText.slice(0, 500)` (line 61) is reasonable but could leak sensitive data in logs if API returns unexpected content

#### Code Quality
- [P3] Good Zod schema validation with `safeParse` for all response items
- [P3] Clean error handling with `AppError` wrapper and meaningful error messages
- [P3] Good null coalescing for optional fields (searchVolume, cpc, difficulty defaults to 0)
- [P2] Type assertion workaround — `(resultItem as { items: unknown[] }).items` (lines 180-182) uses type assertions instead of proper type narrowing; could use a discriminated union or more precise schema
- [P3] Function sizes are appropriate (<50 lines each)

#### Performance
- [P2] No retry logic — API calls have no exponential backoff for transient failures (unlike some other DataForSEO modules that use `getRequiredEnvValue` pattern)
- [P2] No request batching — Each call processes a single domain pair; could batch multiple competitor comparisons
- [P2] No rate limiting — No protection against hitting DataForSEO rate limits
- [P3] No caching — Results are not cached; repeated analysis of same domains hits API again
- [P3] `limit: 100` default is reasonable for cost control

#### Testing
- [P3] Good mock setup with `global.fetch = vi.fn()` pattern
- [P3] Tests cover success path, error handling, and filtering logic
- [P3] Edge cases covered: zero CPC, zero search volume, 100 difficulty
- [P2] Missing test for missing API key scenario
- [P2] Missing test for non-JSON response handling
- [P2] Missing test for malformed item data (partial keyword_data)
- [P3] Test file should use `vi.stubEnv` for consistency with `dataforseoProspect.test.ts`

#### Architecture
- [P3] Good reuse of shared schemas from `dataforseoSchemas.ts`
- [P3] Clean separation — API wrapper only, business logic in `calculateOpportunityScore`
- [P3] Billing info properly extracted with `buildTaskBilling`
- [P2] Auth pattern inconsistent — uses inline `process.env` access while other modules (dataforseoBacklinks) use `getRequiredEnvValue` helper for better validation
- [P3] Schema extension (`drizzle/0007_keyword_gaps.sql`) is minimal and appropriate — just adds JSONB column

#### Recommendations
1. Use `getRequiredEnvValue("DATAFORSEO_API_KEY")` pattern from `dataforseoBacklinks.ts` for consistent API key handling and early failure
2. Add retry logic with exponential backoff for transient HTTP errors (consider extracting shared retry utility)
3. Add missing test cases for error scenarios (missing API key, malformed responses)
4. Consider adding a shared DataForSEO client factory to reduce auth boilerplate across modules

**Overall:** PASS_WITH_NOTES

---

### Agent 9: Keyword Gap Service Logic Review
**Files:** `src/server/features/prospects/services/ProspectAnalysisService.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] No authorization checks - service methods accept `prospectId`/`analysisId` without verifying the caller has access to these resources. The `BillingCustomerContext` is only used for DataForSEO client creation, not authorization validation.
- [P1] Missing workspace/organization membership verification - any caller with a valid prospect ID could analyze another organization's prospect data.

#### Code Quality
- [P3] Redundant data fetching - `runGapAnalysis` fetches prospect and analysis, then `discoverCompetitors` fetches them again, then `analyzeKeywordGaps` fetches them again (6 DB queries instead of 2).
- [P3] Sequential loop error handling in `analyzeKeywordGaps` - if one competitor API call fails, partial results are lost; consider collecting errors and returning partial results.
- [P3] Nullable handling in competitor filtering uses `?? 0` which treats undefined intersections as 0; explicit null check would be clearer.

#### Performance
- [P2] Sequential API calls in `analyzeKeywordGaps` - `domainIntersection` calls for each competitor are made sequentially; these are independent and could be parallelized with `Promise.all` for ~3x speedup.
- [P2] No caching of competitor discovery or intersection results - expensive external API calls are made without any caching layer.
- [P3] Redundant DB queries as noted above - could pass fetched entities between methods.

#### Testing
- [P2] Mock setup fragility - tests use complex chains of `mockLimit.mockResolvedValueOnce` and `mockLimit.mockResolvedValue` which can lead to order-dependent failures; some tests switch from `Once` to non-`Once` mid-test.
- [P3] Missing edge case tests - no tests for undefined/null `full_domain_metrics.organic.etv` (line 105), or when `intersections` field is missing entirely.
- [P3] Test for deduplication should verify the higher `trafficPotential` value is kept when keywords collide (current test has same value for both duplicates).

#### Architecture
- [P3] Direct module imports - service directly imports `db` singleton and calls `createDataforseoClient`, making unit testing require mocking at module level; dependency injection would improve testability.
- [P3] Service method coupling - `runGapAnalysis` calls other service methods that re-fetch the same data; consider splitting into internal helpers that accept pre-fetched data.

#### Recommendations
1. Add authorization middleware or service method to verify prospect belongs to caller's workspace before any operation.
2. Parallelize competitor intersection API calls using `Promise.all` or `Promise.allSettled` for better performance.
3. Pass fetched prospect/analysis objects between methods to eliminate redundant DB queries.
4. Consider adding a Redis cache layer for competitor discovery results (TTL 24h would be reasonable for SEO data).
5. Improve test mock setup by creating factory functions for common mock scenarios.

**Overall:** PASS_WITH_NOTES

---

### Agent 10: Keyword Gap UI Review
**Files:** `src/client/components/prospects/KeywordGapTable.tsx`, `KeywordGapsTab.tsx`, `GapSummaryCard.tsx`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] User data (keyword, competitorDomain) is rendered directly in table cells. While React auto-escapes by default, explicit sanitization would add defense in depth for any future raw HTML usage.

#### Code Quality
- [P2] `SortableHeader` component is defined inside `KeywordGapTable` render function, causing it to be recreated on every render. Should be extracted to module level or memoized.
- [P3] The `Add to targets` button is permanently disabled with `disabled` prop hardcoded. Consider removing the feature or implementing it; dead UI elements confuse users.
- [P2] `GapSummaryCard` has duplicate `mb-6` margin class alongside parent's `space-y-6` in `KeywordGapsTab`, creating inconsistent spacing.
- [P3] Type imports are well-structured, importing `KeywordGap` from schema. Props interfaces are properly typed.
- [P3] Good use of aria-label on DifficultyBadge and action button for accessibility.

#### Performance
- [P1] No virtualization for large keyword gap datasets. With hundreds/thousands of gaps, rendering all rows will cause performance issues. Consider `@tanstack/react-virtual` or pagination.
- [P2] `sortKeywordGaps` is correctly memoized with `useMemo`, but sorting large arrays on every column change could be expensive. Consider debouncing rapid column toggles.
- [P3] `calculateGapSummary` is properly memoized in `KeywordGapsTab`. Good immutable pattern with spread operator in `sortKeywordGaps`.

#### Testing
- [P1] Tests only cover utility functions (`sortKeywordGaps`, `calculateGapSummary`). No component render tests for `KeywordGapTable`, `KeywordGapsTab`, or `GapSummaryCard`.
- [P1] No tests for user interactions: sorting by clicking headers, export button click, loading states, empty states.
- [P2] Missing edge case tests: negative values, extremely large numbers, special characters in keywords, null/undefined handling in component props.

#### Architecture
- [P3] Good separation: utility functions exported for testing, summary calculation decoupled from display.
- [P3] `GapSummary` interface exported from `KeywordGapTable` and consumed by `GapSummaryCard` - reasonable colocation but could be in a shared types file.
- [P2] Export functionality (`exportKeywordGaps`, `downloadCsv`) is imported from utils but not tested in the component tests. Integration point should be tested.
- [P3] Good component composition: `KeywordGapsTab` orchestrates `GapSummaryCard` and `KeywordGapTable` cleanly.

#### Recommendations
1. **Critical:** Add virtualization (`@tanstack/react-virtual`) for tables with >100 rows or implement server-side pagination
2. **High:** Add component tests with React Testing Library for render states, user interactions, and accessibility
3. **Medium:** Extract `SortableHeader` to module level to prevent recreation on each render
4. **Medium:** Either implement the "Add to targets" feature or remove the disabled button to avoid confusing users
5. **Low:** Consider moving `GapSummary` interface to a shared types file for better organization

**Overall:** PASS_WITH_NOTES

---

### Agent 11: Export Utils Review
**Files:** `src/client/utils/export.ts`, `export.test.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] CSV injection vulnerability - values starting with `=`, `+`, `-`, `@`, `\t`, `\r` are not sanitized and could be interpreted as formulas when opened in Excel/Google Sheets (e.g., `=CMD|'/C calc'!A0`). Should prefix dangerous characters with a single quote or tab.
- [P2] Incomplete CSV escaping - `escapeCsvField` only handles commas but not double quotes within values. A value like `keyword "test"` will produce malformed CSV. Double quotes inside quoted fields must be escaped as `""`.
- [P3] No filename sanitization in `downloadCsv` - while `generateExportFilename` sanitizes, if a caller passes a raw filename, no validation occurs.

#### Code Quality
- [P2] Newline characters not escaped - if a keyword contains newlines, it will break CSV row structure. Should be handled in `escapeCsvField`.
- [P3] Header/field mismatch - header says "Opportunity Score" but the actual field is `trafficPotential`. While functionally correct, this creates confusion when reading code.
- [P3] No error handling in `downloadCsv` - if `document.body.appendChild` or `link.click()` fails (e.g., in headless/popup-blocked contexts), the error is not caught.
- [P3] Missing JSDoc `@throws` documentation - functions don't document what exceptions they might throw.

#### Performance
- [P3] Full memory loading - for very large exports (10k+ rows), all data is held in memory and concatenated with `join()`. Not an issue for typical keyword gap datasets but could be for bulk exports.
- [P3] Multiple string concatenations - `rows.map().join()` creates intermediate arrays; for huge datasets a streaming approach would be more efficient.

#### Testing
- [P2] Missing test coverage for `downloadCsv` - browser download API not tested (acknowledged as challenging, but mock testing is possible with jsdom).
- [P2] Missing test coverage for `generateExportFilename` - no tests for domain sanitization, date format, or edge cases like very long domains.
- [P2] No CSV injection tests - malicious input like `=1+1` or `@SUM(A1:A10)` is not tested.
- [P2] No double-quote escaping test - keywords containing `"` are not tested.
- [P3] No Unicode/internationalization tests - keywords with non-ASCII characters (CJK, emojis) are not tested.
- [P3] No test for newline handling in keywords.

#### Architecture
- [P3] Not generalized - `exportKeywordGaps` is keyword-gap-specific; a generic `exportToCsv<T>(data: T[], columns: ColumnDef[])` pattern would enable reuse for other exports (prospects, audits, etc.).
- [P3] Tight coupling to KeywordGap type - if the type changes, both the export function and tests must be updated.
- [P3] No separation of CSV generation from file download - combining these concerns makes testing harder.

#### Recommendations
1. **Critical:** Add CSV injection protection by prefixing formula-triggering characters with `\t` or `'` (e.g., `'\t=1+1` displays as `=1+1` in Excel but won't execute).
2. **Important:** Fix `escapeCsvField` to properly escape double quotes by doubling them (`"` → `""`) and wrap any field containing `"`, `,`, or newlines in quotes.
3. Add unit tests for `generateExportFilename` covering domain sanitization, date formatting, and edge cases.
4. Consider extracting a reusable `CsvBuilder` class for other export needs.
5. Add mock-based tests for `downloadCsv` using jsdom or playwright.

**Overall:** PASS_WITH_NOTES

---

## Phase 29: AI Opportunity Discovery

### Agent 12: Opportunity Service Review
**Files:** `src/server/lib/opportunity/OpportunityDiscoveryService.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] No input validation on `locationCode` or `languageCode` — malformed values are passed directly to downstream API calls without sanitization or bounds checking.
- [P3] BusinessInfo arrays (`products`, `brands`, `services`) are not validated for maximum length — extremely large arrays could cause performance issues or API abuse.

#### Code Quality
- [P3] Service uses object literal pattern instead of class — acceptable but makes dependency injection harder; methods reference `this` which works but could be fragile if methods are destructured.
- [P3] `hasBusinessData()` helper is not exported — prevents reuse in other modules that may need the same check.
- [P3] Type safety is good — all interfaces are well-defined with proper TypeScript types; no `any` types present.
- [P3] Error handling relies entirely on downstream modules — no try-catch in `discoverOpportunities` means errors from `generateKeywordOpportunities` or `validateKeywordVolumes` propagate unhandled.

#### Performance
- [P3] No caching layer — repeated calls with same `businessInfo` will regenerate keywords and hit DataForSEO API each time; consider memoization for expensive AI generation step.
- [P3] Summary calculation iterates keywords twice (once for volume sum, once for score sum) — could combine into single reduce, though impact is minimal for typical keyword counts (<1000).

#### Testing
- [P2] No error path tests — missing tests for when `generateKeywordOpportunities` throws, or when `validateKeywordVolumes` fails.
- [P2] No test for `calculateSummary` method directly — only tested indirectly via `discoverOpportunities`; direct unit tests would improve coverage.
- [P3] Mock setup is clean and uses `vi.hoisted` correctly for proper hoisting — good pattern.
- [P3] Edge case coverage is adequate — tests null businessInfo, empty businessInfo, empty generated keywords.
- [P3] Missing test for category counting edge case — what if a keyword has an invalid category not in `CategorySummary`? Would cause `undefined++` which becomes `NaN`.

#### Architecture
- [P3] Clean separation of concerns — service orchestrates workflow, delegates to `keywordGenerator` and `volumeValidator` modules.
- [P3] Single responsibility maintained — service only handles discovery orchestration, not the details of AI generation or volume validation.
- [P3] Index exports are comprehensive — all public types and functions properly re-exported from `index.ts`.
- [P3] Logging is well-structured with appropriate log levels (`info`, `warn`) and contextual data.

#### Recommendations
1. Add input validation for `locationCode` (should be positive integer) and `languageCode` (should match ISO 639-1 pattern).
2. Add try-catch wrapper in `discoverOpportunities` with proper error logging and re-throw to handle failures gracefully.
3. Consider adding a memoization/caching layer for AI keyword generation results based on businessInfo hash.
4. Add direct unit tests for `calculateSummary` and `getCategorySummary` methods.
5. Add error path tests to verify proper behavior when dependencies fail.
6. Validate category values against `CategorySummary` keys to prevent runtime errors from invalid categories.

**Overall:** PASS_WITH_NOTES

---

### Agent 13: Opportunity Data Flow Review
**Files:** `src/server/lib/opportunity/keywordGenerator.ts`, `volumeValidator.ts`, `dataforseoVolume.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] Inconsistent API key validation - `keywordGenerator.ts` line 157-161 gracefully handles missing `ANTHROPIC_API_KEY` by returning empty array with warning, while `dataforseoVolume.ts` line 88-89 uses `process.env.DATAFORSEO_API_KEY ?? ""` which sends an empty Authorization header instead of failing fast. DataForSEO should follow the same pattern as Anthropic or throw early.
- [P3] Input sanitization adequate - AI-generated keywords are validated through Zod schema (`GeneratedKeywordSchema`) before being accepted, preventing injection of invalid categories.
- [P3] Error message truncation in `dataforseoVolume.ts` line 135 limits raw API response exposure to 500 characters, reducing information leakage risk.

#### Code Quality
- [P2] Robust response parsing in `parseKeywordResponse` - handles markdown code blocks, validates with Zod, deduplicates keywords, and filters empty strings. Defensive against malformed AI output.
- [P2] Clear opportunity score formula documented in `volumeValidator.ts` - formula `volume * cpc * (100 - difficulty) / 100` is well-commented with rationale for each factor (lines 33-46).
- [P3] Language mapping in `keywordGenerator.ts` uses hardcoded `LANGUAGE_NAMES` object - could be extracted to a shared locale configuration.
- [P3] Default difficulty value of 50 in `transformVolumeItem` (line 175) is reasonable fallback but could be configurable.

#### Performance
- [P1] Missing parallelization opportunity - `validateKeywordVolumes` batches keywords in groups of 1000 but processes batches sequentially (line 129-152). Independent batches could use `Promise.all` for concurrent requests, reducing total API wait time by ~Nx for N batches.
- [P2] Efficient volume lookup - `enrichKeywordsWithMetrics` creates a `Map` for O(1) lookups (line 70-73) instead of nested loops, good for 50-100+ keywords.
- [P3] Claude API call uses `max_tokens: 4096` which is adequate for 50-100 keywords but could be reduced if token usage is a cost concern.
- [P3] Duplicate keyword filtering in `parseKeywordResponse` uses case-insensitive comparison via `.toLowerCase()` preventing redundant API volume checks.

#### Testing
- [P1] Missing test for batch boundary - `validateKeywordVolumes` batches at 1000 keywords but test only uses 1500, missing test for exact boundary (1000, 1001, 2000 keywords) to verify batch logic.
- [P2] Test coverage for `parseKeywordResponse` is comprehensive - tests for markdown code blocks, invalid categories, empty keywords, duplicates, and invalid JSON (lines 104-188).
- [P2] Missing negative test cases for `calculateOpportunityScore` - no test for negative difficulty values or difficulty > 100, which would produce invalid multipliers.
- [P3] Test for 50-100 keywords (line 278-300) verifies range but doesn't test prompt generates appropriate category distribution.
- [P3] No integration test combining `generateKeywordOpportunities` -> `validateKeywordVolumes` -> `enrichKeywordsWithMetrics` end-to-end flow.

#### Architecture
- [P2] Clean data pipeline - `keywordGenerator` -> `volumeValidator` -> `enrichKeywordsWithMetrics` creates clear separation: AI generation, external validation, and scoring/enrichment are distinct steps.
- [P3] DataForSEO API response schemas use `.passthrough()` for forward compatibility with API changes.
- [P3] `KeywordVolumeResult` interface (lines 22-27) provides clean abstraction over raw DataForSEO response shape.
- [P3] API authentication pattern in `dataforseoVolume.ts` (`createAuthenticatedFetch`) duplicates pattern seen in other DataForSEO modules - should use shared utility.

#### Recommendations
1. Parallelize batch processing in `validateKeywordVolumes` using `Promise.all` for multiple batches.
2. Consolidate DataForSEO authentication into a shared `createDataforseoAuthenticatedFetch()` utility that throws on missing API key.
3. Add boundary tests for exact batch sizes (1000, 1001 keywords).
4. Add input validation for `calculateOpportunityScore` to clamp difficulty between 0-100.
5. Consider adding an integration test for the complete keyword discovery pipeline.
6. Add configurable concurrency limit for parallel batch requests to respect API rate limits.

**Overall:** PASS_WITH_NOTES

---

### Agent 14: Opportunity UI Review
**Files:** `src/client/components/prospects/OpportunityKeywordsTable.tsx`, `OpportunitySummaryCard.tsx`, `OpportunityKeywordsTab.tsx`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P3] Data rendering is safe - all numeric values use `.toLocaleString()` or `.toFixed()`, string values are rendered directly into React JSX (auto-escaped by React).
- [P3] CSV export properly escapes quotes - `exportOpportunityKeywords` uses `k.keyword.replace(/"/g, '""')` preventing CSV injection via double-quote escaping.
- [P3] No dangerouslySetInnerHTML usage - XSS risk is minimal.

#### Code Quality
- [P2] Disabled button still has onClick handler - in `OpportunityKeywordsTable.tsx` line 300-305, the "Add to Proposal" button is `disabled` but still has `onClick={() => onAddToProposal?.(keyword.keyword)}`. While browsers ignore clicks on disabled buttons, this could cause confusion and the disabled prop should be conditional based on `onAddToProposal` availability.
- [P3] Props typing is complete - all component props have proper TypeScript interfaces with optional/required annotations.
- [P3] Empty state handling is good - both table and tab components render helpful messages when no data is available.
- [P3] Table key uses `keyword-index` pattern - acceptable since keyword strings could theoretically be duplicated across different analyses.
- [P3] Inline `SortableHeader` component inside render - could be extracted to module level for better readability but performance impact is negligible due to React's reconciliation.

#### Performance
### Agent 16: Tracking & Analytics Review
**Files:** `src/server/features/proposals/tracking/`, `analytics/`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] Default IP salt in production - `hashIpAddress()` uses `process.env.IP_SALT ?? "default-salt-change-in-production"` (line 38). If `IP_SALT` is not set, all IP hashes will use this weak default salt, making IP addresses recoverable via rainbow table attacks. Should fail fast or use a secure random fallback.
- [P2] IP hash length (16 chars) may be insufficient - SHA256 truncated to 16 hex characters yields 64 bits of entropy. While adequate for deduplication, consider 32 characters for stronger collision resistance if compliance requires it.
- [P3] No rate limiting on tracking endpoints - `trackProposalView`, `updateViewDuration`, `updateSectionsViewed`, `markRoiCalculatorUsed` have no explicit rate limiting; malicious clients could spam these endpoints to inflate analytics.
- [P3] View ID exposed to client - The `viewId` returned from `trackProposalView` is used for subsequent heartbeat calls; consider whether this ID could be guessed/enumerated (nanoid is 21 chars by default, sufficient entropy).

#### Code Quality
- [P3] Engagement scoring algorithm is clear and well-documented - constants are named descriptively (`SCORE_PER_VIEW`, `SCORE_MAX_VIEWS`, etc.) with inline comments explaining point allocation.
- [P3] Good use of optional chaining - `v.sectionsViewed?.includes()` handles null/undefined gracefully in `EngagementSignals.ts`.
- [P3] Consistent error handling - All service methods throw `AppError` with appropriate error codes (`NOT_FOUND`, `VALIDATION_ERROR`).
- [P3] Lithuanian labels in `LOSS_REASONS` - Consider adding English fallbacks or i18n support for internationalization.

#### Performance
- [P2] Session deduplication query efficiency - `trackProposalView` performs two separate queries (proposal lookup + recent view lookup) that could be combined into a single query with JOIN for better performance.
- [P2] `calculateEngagementSignals` fetches all views - For proposals with many views, this could become expensive. Consider adding a limit or using aggregate queries for scoring.
- [P3] `calculateSalesAnalytics` fetches all proposals then filters in-memory - For large workspaces, this could load many records; consider using SQL aggregations instead of JavaScript filtering.
- [P3] Pipeline distribution queries (`getPipelineDistribution`, `getPipelineValueByStage`) iterate all proposals in JavaScript - Could be optimized with SQL `GROUP BY` for workspaces with many proposals.

#### Testing
- [P2] Test isolation issues - Tests use `vi.clearAllMocks()` but re-import modules with `await import()`, which can lead to cached module state between tests. Consider using `vi.resetModules()` before each import.
- [P2] Missing test for IP salt fallback behavior - No test verifies behavior when `IP_SALT` environment variable is unset.
- [P3] Mock chain complexity - Both test files use multi-level mock chains (`mockLimit.mockResolvedValueOnce`) that are fragile to call order changes.
- [P3] Edge case coverage is good - Tests include null `sectionsViewed`, undefined `roiCalculatorUsed`, empty arrays, and zero views scenarios.
- [P3] Missing test for max duration bounds - `updateViewDuration` validates `durationSeconds < 0` but no upper bound check exists; test does not verify extremely large values.

#### Architecture
- [P3] Clean separation between tracking and analytics - `ViewTrackingService` handles raw event capture, `EngagementSignals` calculates derived metrics, and `analytics.ts` handles aggregate reporting. This separation is appropriate.
- [P3] Event-driven design opportunity - Currently, engagement signals are calculated on-demand. Consider emitting events on view tracking to enable real-time signal updates or webhook triggers for "hot prospect" notifications.
- [P3] Module exports are well-organized - `index.ts` re-exports all public APIs with types, following barrel pattern.
- [P3] Helper functions exported for unit testing - `hashIpAddress`, `detectDeviceType`, `calculateAvgTimeToClose`, `aggregateLossReasons` are exported, allowing targeted unit tests without full service setup.

#### Recommendations
1. **[Critical]** Add startup validation requiring `IP_SALT` environment variable to be set, or generate a secure random salt on first run and persist it.
2. Combine proposal lookup and session deduplication into a single database query to reduce round trips.
3. Add SQL-level aggregations for `calculateSalesAnalytics` to improve performance for large workspaces.
4. Consider adding an upper bound validation on `durationSeconds` (e.g., max 3600 seconds per heartbeat) to prevent abuse.
5. Add rate limiting middleware on tracking endpoints to prevent analytics inflation attacks.
6. Consider emitting domain events (`ProposalViewed`, `HotProspectDetected`) for real-time integrations.

**Overall:** PASS_WITH_NOTES

---

## Phase 30: Interactive Proposals

### Agent 15: Proposal Schema & Core Services Review
**Files:** `src/db/proposal-schema.ts`, `src/server/features/proposals/services/ProposalService.ts`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] Token generation uses `nanoid(32)` - cryptographically secure (uses `crypto.getRandomValues()`) but 32 characters provides ~190 bits of entropy; consider documenting this is sufficient for public access tokens.
- [P2] No token expiration check in `findByToken` - the service retrieves proposals by token without checking if `expiresAt` has passed. Expired proposals can still be accessed via their token until explicitly checked in the calling code.
- [P3] IP address handling uses hash (`ipHash`) in proposal views - good practice for privacy compliance (GDPR), but the hashing algorithm is not specified in schema; consider documenting expected format.
- [P3] Workspace authorization in `create` is correct - throws same "not found" error for both missing prospect and wrong workspace to prevent workspace enumeration.
- [P3] Personal code is hashed (`signerPersonalCodeHash`) in signatures table - good PII handling practice.

#### Code Quality
- [P1] Missing status validation in `update` method - allows updating any fields regardless of proposal status. The comment says "Only allowed in draft status for most fields" but no enforcement exists. A sent/signed proposal could have its pricing changed.
- [P2] Race condition potential in `recordView` - the method checks `firstViewedAt` and `status`, then updates in a separate query. Concurrent views could both trigger the "first view" status update. Should use a transaction or atomic update with `WHERE firstViewedAt IS NULL`.
- [P2] `markAccepted` casts `proposal.status as ProposalStatus` - status column allows any text value in schema (no enum constraint), but code assumes it matches `PROPOSAL_STATUS`. A corrupted status value would fail silently in `canTransition`.
- [P3] Drizzle parameterized queries are used correctly throughout - SQL injection prevention is solid.
- [P3] Logging is present for key state changes (create, update, delete, markSent, recordView) - good for audit trails.

#### Performance
- [P3] `findById` executes 4 parallel queries (proposal + views + signatures + payments) - appropriate use of `Promise.all` for independent data fetches.
- [P3] Pagination in `findByWorkspace` limits page size to 100 max - good DoS prevention.
- [P3] Index coverage is appropriate - indexes on `workspaceId`, `prospectId`, `status`, and `token` cover the main query patterns.
- [P3] JSONB columns (`content`, `brandConfig`) have no GIN indexes - acceptable since these are not queried by content, only fetched.

#### Testing
- [P1] Mock quality is fragile - mocks use static chain returns (`db.select().from().where().limit()`) that don't accurately represent Drizzle query builder behavior. Adding a method to a query chain would break mocks.
- [P2] `findByWorkspace` pagination tests only test the math logic, not the actual service method - the complex `Promise.all` with `count()` is not tested through the service.
- [P2] Missing test for expired proposal access via `findByToken` - should verify behavior when `expiresAt < now`.
- [P2] Missing test for race condition in `recordView` - concurrent first views scenario.
- [P3] State machine tests are comprehensive - all valid/invalid transitions are tested.
- [P3] Missing negative fee validation tests - what happens if `setupFeeCents` or `monthlyFeeCents` is negative?

#### Architecture
- [P3] Schema design is clean - separate tables for views, signatures, and payments allow proper normalization while maintaining cascade delete integrity.
- [P3] State machine pattern via `VALID_TRANSITIONS` and `canTransition` is well-implemented - clear, testable, and prevents invalid transitions.
- [P3] `generateDefaultContent` helper is well-placed in service - keeps content generation logic close to the domain.
- [P3] Feature index (`index.ts`) re-exports all submodules - clean public API for the feature.
- [P3] Prospect `onDelete: "set null"` vs workspace `onDelete: "cascade"` is appropriate - proposals survive prospect deletion but not workspace deletion.

#### Recommendations
1. Add status guard to `update` method: only allow content/pricing updates in `draft` status; throw for other statuses.
2. Fix race condition in `recordView` by using `WHERE firstViewedAt IS NULL AND status = 'sent'` in the update query, or wrap in a transaction.
3. Add `expiresAt` check in `findByToken` or document that callers must check expiration.
4. Improve test mocks with a factory pattern that better represents Drizzle query builder, or use actual in-memory database for integration tests.
5. Add schema-level CHECK constraint or service validation for non-negative fee amounts.
6. Consider adding a `pgEnum` for status instead of text column to enforce valid values at database level.

**Overall:** PASS_WITH_NOTES

---

### Agent 17: Signing & PDF Review
**Files:** `src/server/features/proposals/signing/`, `src/server/lib/dokobit/`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] Personal code salt fallback is empty string - `signing.ts` line 69 uses `process.env.PERSONAL_CODE_SALT ?? ""` which silently uses an empty salt if env var is missing. This weakens GDPR-compliant personal code hashing. Should throw an error on startup if `PERSONAL_CODE_SALT` is not configured.
- [P1] No authorization check before signing - `initiateProposalSigning` verifies the proposal exists and is in "accepted" status but does not verify the caller is authorized to sign this proposal. Any user with a valid proposal ID could potentially initiate signing.
- [P2] Missing phone number validation for Mobile-ID - `initiateProposalSigning` accepts `phoneNumber` without validation. When `method === "mobile_id"`, the `phoneNumber!` non-null assertion is used (line 137) but no prior validation ensures the format is correct (e.g., `+370XXXXXXXX`).
- [P2] Dokobit API error responses may leak sensitive information - `client.ts` lines 85-86 and 109-110 throw the raw error text from Dokobit API which could potentially include sensitive data. Consider sanitizing or truncating error messages.
- [P3] PDF tampering prevention relies solely on Dokobit - the unsigned PDF is not cryptographically sealed before submission; tampering prevention depends entirely on Dokobit's qualified e-signature process, which is appropriate for eIDAS compliance.
- [P3] Dokobit access token validation is good - `client.ts` line 61-63 throws early if `DOKOBIT_ACCESS_TOKEN` is not configured.

#### Code Quality
- [P2] Type assertion on `phoneNumber!` - `signing.ts` line 137 uses non-null assertion when calling `initiateMobileIdSigning`. Should either make `phoneNumber` required when `method === "mobile_id"` at the type level (discriminated union) or add runtime validation with a helpful error message.
- [P2] `.returning()` unused - `signing.ts` lines 153, 226, 237 call `.returning()` on database operations but the returned values are not used. Either remove `.returning()` to reduce unnecessary data transfer or use the returned values for logging/verification.
- [P3] Magic numbers in PDF generation - `pdf.ts` uses hardcoded values (A4 dimensions, margin 50, lineHeight 14) without named constants. Consider extracting these for clarity.
- [P3] PDF content is Lithuanian-only - contract text is hardcoded in Lithuanian ("SEO PASLAUGU SUTARTIS", "SALYS", etc.). This is fine if Lithuanian-only is intentional, but consider internationalization if multi-language support is needed.
- [P3] Good type safety overall - TypeScript types are well-defined in `dokobit/types.ts` with clear interface definitions and JSDoc comments.

#### Performance
- [P2] PDF generation is synchronous blocking - `generateContractPdf` uses `pdf-lib` which is CPU-bound and synchronous. For high-volume scenarios, consider offloading to a worker thread or BullMQ job.
- [P2] No retry logic for Dokobit API calls - `client.ts` makes direct fetch calls without retry logic. External API failures (network issues, rate limits, temporary outages) will immediately fail the signing process. Consider implementing exponential backoff for transient failures.
- [P3] New Dokobit client created per operation - `createDokobitClient()` is called fresh in `initiateProposalSigning` and `checkSigningStatus` rather than reusing a singleton. This is fine for correctness but creates minor overhead.
- [P3] No connection pooling or timeout configuration for fetch calls to Dokobit API.

#### Testing
- [P1] Missing test for `handleSigningCompletion` error scenarios - the private function handles PDF download, R2 upload, and database updates, but tests only cover the happy path via `checkSigningStatus`. Should test: R2 upload failure, DB update failure, and download failure scenarios.
- [P2] Global `fetch` mock pattern - `client.test.ts` modifies `global.fetch` directly which can cause test pollution. Consider using a more isolated mocking approach or ensuring proper cleanup in `afterEach`.
- [P2] Missing webhook/callback tests - signing flow mentions "Poll for completion" but there's no webhook endpoint implementation or tests for asynchronous notification from Dokobit.
- [P3] Dokobit client test coverage is good - tests cover Smart-ID, Mobile-ID, status polling (pending/completed/failed/expired), and document download with both success and error scenarios.
- [P3] PDF generation tests verify PDF validity (starts with %PDF) and basic properties but cannot verify internal content rendering without a PDF parser.

#### Architecture
- [P2] No state machine for signing flow - signing has implicit states (initiated, pending, completed, failed, expired) but no explicit state machine to manage transitions. This makes it harder to reason about valid state transitions and could lead to inconsistent states if `handleSigningCompletion` partially fails.
- [P2] Tight coupling between signing service and R2 storage - `handleSigningCompletion` directly calls `putTextToR2` with base64 encoding. Consider abstracting storage behind an interface for testability and potential storage backend changes.
- [P3] Polling vs. webhook - current implementation relies on polling (`checkSigningStatus`). Dokobit supports webhooks which would be more efficient. Consider adding webhook support as an enhancement.
- [P3] Clean separation of concerns - `signing.ts` handles workflow orchestration, `pdf.ts` handles document generation, `dokobit/client.ts` handles API communication. This is well-structured.
- [P3] Module exports are well-organized via `index.ts` files in both `signing/` and `dokobit/` directories.

#### Recommendations
1. **Critical:** Add authorization check to `initiateProposalSigning` to verify the caller owns/has access to the proposal's workspace before initiating signing.
2. **Critical:** Fail fast if `PERSONAL_CODE_SALT` environment variable is missing - do not fall back to empty string for GDPR-compliant hashing.
3. Add phone number format validation when `method === "mobile_id"` with a clear error message.
4. Implement retry logic with exponential backoff for Dokobit API calls to handle transient failures.
5. Consider using a discriminated union type for `InitiateSigningInput` where `phoneNumber` is required only for `mobile_id` method.
6. Add integration tests for error scenarios in `handleSigningCompletion` (R2 failure, DB failure).
7. Consider implementing webhook support for Dokobit callbacks to reduce polling overhead.
8. Add request timeout configuration for Dokobit API fetch calls.

**Overall:** PASS_WITH_NOTES

---

### Agent 18: Payment & Onboarding Review
**Files:** `src/server/features/proposals/payment/`, `onboarding/`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P0] **Webhook signature verification requires raw body** - `verifyWebhookSignature()` in `payment.ts` (line 199-211) correctly calls `stripe.webhooks.constructEvent()`, but the function accepts a `string` payload. Stripe SDK requires the **raw request body bytes** (not parsed JSON) for signature verification. If the caller parses JSON before passing to this function, signature verification will fail or be bypassable. The route handler must pass `req.rawBody` or equivalent.
- [P2] Environment variable validation is good - `getStripeClient()` throws early if `STRIPE_SECRET_KEY` is missing (line 29); `verifyWebhookSignature()` throws if `STRIPE_WEBHOOK_SECRET` is missing (line 206-208). Uses standard `process.env` rather than `getRequiredEnvValue()` but still fails fast.
- [P2] No PCI data stored - payment.ts only stores `stripeSessionId`, `stripePaymentIntentId`, and `stripeSubscriptionId` references (line 168-176, 279-289). No card numbers, CVVs, or sensitive payment details are persisted - PCI compliance maintained.
- [P3] Session URL non-null assertion - `session.url!` (line 186) assumes Stripe always returns a URL. While this is true for valid sessions, defensive coding would handle null case.
- [P3] Email recipient validation missing - `sendLoopsEmail()` in `email.ts` (line 194-258) does not validate email format before sending. Malformed emails could leak info in error logs.

#### Code Quality
- [P2] Stripe client singleton pattern is good - lazy initialization in `getStripeClient()` prevents multiple client instances (line 21-38).
- [P2] Idempotency implemented in onboarding - `triggerOnboarding()` checks `proposal.status === "onboarded" && prospect.convertedClientId` before creating duplicates (line 112-132). Returns existing IDs gracefully.
- [P2] Error isolation in webhook handler - `handleCheckoutCompleted()` wraps `triggerOnboarding()` in try-catch (line 307-321), logging failure but not failing the webhook response. This prevents retry storms but could mask persistent failures.
- [P3] Line items type defined inline - `payment.ts` lines 103-111 define a complex inline type. Could be extracted to a named interface for reusability.
- [P3] Magic strings for status values - `"pending"`, `"completed"`, `"paid"`, `"onboarding"`, `"onboarded"`, `"converted"` scattered throughout. Should use const enums or a shared status type.
- [P3] Consistent logging pattern - all modules use `createLogger()` with module names for traceability.

#### Performance
- [P2] No database transaction - `handleCheckoutCompleted()` performs two separate `db.update()` calls (line 279-299) without a transaction. If proposal update fails after payment update succeeds, data becomes inconsistent.
- [P2] No database transaction in onboarding - `triggerOnboarding()` performs 5 database operations (insert client, update prospect, insert project, update proposal) without wrapping in a transaction (lines 136-213). Partial failure could leave orphaned records.
- [P3] Sequential email sending - `triggerOnboarding()` sends 3 emails sequentially (lines 170-189). Could use `Promise.all()` for ~3x speedup since emails are independent.
- [P3] Slack notification is fire-and-forget - `notifyAgencySlack()` failures don't block onboarding completion (good for resilience).

#### Testing
- [P1] Missing webhook raw body test - `payment.test.ts` tests `verifyWebhookSignature()` with string payload but doesn't verify the integration with actual route handler raw body handling. The critical P0 security issue above needs explicit test coverage.
- [P2] Good test coverage breadth - tests cover checkout session creation, webhook events (checkout.session.completed, invoice.paid), subscription handling, missing metadata, and missing env vars.
- [P2] Onboarding test coverage is comprehensive - tests idempotency (line 394-417), missing contact email (line 443-464), missing company name (line 419-441), proposal/prospect not found errors.
- [P3] Mock chain complexity - tests rely on deep mock chains (`mockInsertValues.mockReturnValue({ returning: mockReturning })`) which are fragile to refactoring.
- [P3] Missing tests for concurrent webhook delivery - Stripe may deliver the same event multiple times; should test idempotency under race conditions.
- [P3] No test for Loops API failure scenarios in `email.ts` - only mocked to succeed in onboarding tests.

#### Architecture
- [P2] Clean payment-to-onboarding flow - `handleCheckoutCompleted()` calls `triggerOnboarding()` as a side effect (line 307-308), maintaining single responsibility. Onboarding failure is logged but doesn't fail the webhook.
- [P2] Good email template separation - `email.ts` separates template generation (`generateGscInviteEmail()`) from sending (`sendGscInviteEmail()`), allowing template testing without API mocking.
- [P3] Notification abstraction is clean - `notifications.ts` provides `formatSlackNotification()` for testable formatting and `notifyAgencySlack()` for the actual HTTP call.
- [P3] Index exports present - both `payment/index.ts` and `onboarding/index.ts` exist for clean imports.
- [P3] Lithuanian localization hardcoded - email templates and Slack messages are in Lithuanian. Consider i18n extraction for multi-language support.
- [P3] Hardcoded transactional template ID - `email.ts` line 226 uses `transactionalId: "onboarding-generic"` which must exist in Loops dashboard. Should be configurable or documented.

#### Recommendations
1. **CRITICAL**: Verify route handler passes raw request body (not parsed JSON) to `verifyWebhookSignature()`. Add integration test that verifies signature with actual Stripe test webhook payload.
2. Wrap `handleCheckoutCompleted()` database updates in a transaction to ensure atomicity.
3. Wrap `triggerOnboarding()` operations in a transaction to prevent orphaned records on partial failure.
4. Add const enums or union types for proposal/client/prospect status values.
5. Parallelize email sending in `triggerOnboarding()` using `Promise.all()`.
6. Add retry mechanism for failed onboarding (e.g., BullMQ job for manual retry) since current error-swallowing approach could silently fail.
7. Document the required Loops transactional template ID and its expected data variables.

**Overall:** PASS_WITH_NOTES

---

### Agent 19: Automation & Pipeline Review
**Files:** `src/server/features/proposals/automation/`, `src/client/components/proposals/PipelineView.tsx`
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P1] No authorization checks in automation engine - `processAutomations()` in `automation.ts` processes all proposals matching criteria without verifying workspace/organization ownership. Cron job could accidentally process proposals from other organizations if run globally.
- [P1] Missing cron job authorization - No documented mechanism for authorizing who can trigger `processAutomations()`. The function is exported directly and could be called by any code path.
- [P2] Email recipient validation missing - `sendFollowUpEmail()` in `email.ts` accepts any email address without validation. Could be exploited to send emails to arbitrary addresses if `proposal.prospect.contactEmail` is tampered with.
- [P2] No rate limiting on automation execution - A malicious actor who can create proposals could trigger unlimited automation actions (emails, Slack notifications).
- [P3] API key exposure risk - While `LOOPS_API_KEY` missing case is handled gracefully (returns false), the actual key is sent in Authorization header. Consider using environment variable validation at startup.

#### Code Quality
- [P1] In-memory execution log is not persistent - `executionLogs` in `automation.ts` line 114 uses `Map<string, AutomationLog>` which resets on server restart, causing duplicate automation executions. Comment acknowledges this ("would be a database table in production") but this is a significant gap.
- [P2] Type casting without validation - `automation.ts` line 180-181 casts `matches as ProposalWithProspect[]` without actually joining the prospect data, so `proposal.prospect` will be undefined.
- [P2] Email template type assertion - `executeAction()` line 261 casts `action.template as "proposal_reminder" | "any_questions"` without validating the template string matches expected values.
- [P3] Rule engine clarity is good - `AutomationRule`, `AutomationTrigger`, and `AutomationAction` interfaces are well-defined with clear type constraints.
- [P3] Error handling is comprehensive - Both individual action failures and rule processing failures are caught and logged separately, with error counts returned.
- [P3] Lithuanian email templates are well-structured with proper greeting personalization.

#### Performance
- [P2] N+1 query pattern in engagement signal matching - `findEngagementSignalMatches()` fetches all viewed proposals, then calls `calculateEngagementSignals()` for each one sequentially (lines 200-214). Should batch this operation.
- [P2] Sequential rule processing - `processAutomations()` processes rules sequentially with nested proposal loops. For large proposal counts, this could be slow; consider batching or parallel processing.
- [P3] Pipeline UI grouping is efficient - `groupProposalsByStage()` in `pipeline-utils.ts` is O(n) with a single pass through proposals.
- [P3] Drag-and-drop uses native HTML5 API which is lightweight compared to external libraries.

#### Testing
- [P2] Missing tests for `executeAction()` function - Only `processAutomations()` return shape is tested, not the actual action execution logic.
- [P2] No integration tests for full automation flow - Tests mock everything; no test verifies the actual trigger-to-action flow with real-ish data.
- [P2] Pipeline component tests only cover utility functions - `PipelineView.test.tsx` tests `pipeline-utils.ts` but doesn't test the React component's drag-drop behavior or state management.
- [P2] LossReasonModal tests don't test component rendering - Only validates constants and types, not the modal interaction (submit, cancel, state reset).
- [P3] Edge case missing - No test for when `proposal.prospect` is undefined in email sending path.
- [P3] Fake timer setup is good - `vi.setSystemTime(new Date("2026-04-21T12:00:00Z"))` ensures deterministic time-based tests.

#### Architecture
- [P2] Rule engine design is simplistic but adequate - Uses static `DEFAULT_AUTOMATIONS` array instead of database-driven rules. Comment on line 311 acknowledges this limitation.
- [P2] Pipeline state machine is implicit - `STAGE_TRANSITIONS` in `pipeline-utils.ts` defines valid transitions but there's no formal state machine enforcement; callers must use `canTransitionTo()` manually.
- [P2] Drag-drop implementation lacks accessibility - Native HTML5 drag-drop doesn't provide keyboard navigation or screen reader announcements for stage changes.
- [P3] Clean separation of concerns - `pipeline-utils.ts` contains pure functions, `PipelineView.tsx` handles UI, `LossReasonModal.tsx` handles the decline flow.
- [P3] Automation module exports are clean - `index.ts` re-exports both `automation.ts` and `email.ts`.
- [P3] `DeclineProposalInput` in `LossReasonModal.tsx` uses a const object pattern instead of a proper type definition, which is unusual but functional.

#### Recommendations
1. **Critical:** Persist execution logs to database to prevent duplicate automations after server restart. Add schema similar to:
   ```sql
   CREATE TABLE automation_logs (
     id TEXT PRIMARY KEY,
     proposal_id TEXT NOT NULL,
     rule_id TEXT NOT NULL,
     executed_at TIMESTAMP NOT NULL
   );
   ```
2. **Critical:** Add workspace filtering to `findMatchingProposals()` to ensure automations only process proposals belonging to the automation's workspace/organization.
3. Add email validation using a Zod schema before sending follow-up emails.
4. Add keyboard navigation support to PipelineView for accessibility (arrow keys to move between stages, Enter to confirm drop).
5. Consider using `@dnd-kit` or similar library for better accessibility and mobile support in drag-drop.
6. Add integration tests that verify the full automation flow from trigger detection through action execution.
7. Fix the type casting issue by joining prospect data when fetching proposals for automation.
8. Add rate limiting: maximum N automations per proposal per day, maximum M emails per hour per workspace.

**Overall:** NEEDS_WORK

---

### Agent 20: Proposal UI & Scrollytelling Review
**Files:** `src/client/components/proposals/sections/`, `ProposalPageView.tsx`, hooks
**Status:** Complete
**Findings:**

**Reviewed:** 2026-04-21

#### Security
- [P2] Logo URL in HeroSection uses `brandConfig?.logoUrl` directly in `<img src={...}>` (line 63-67) - should validate URL protocol to prevent javascript: XSS if user-controlled logo URLs are stored without sanitization on the backend.
- [P2] SigningModal personal code input stores sensitive PII (Lithuanian personal ID) in component state - consider whether this data is logged anywhere or persists beyond the session.
- [P3] Public tracking endpoints (`/api/proposals/track/*`) in useProposalTracking send proposalId and token via POST body - ensure server validates token ownership before recording views.

#### Testing
- [P2] Missing tests for `executeAction()` function - Only `processAutomations()` return shape is tested, not the actual action execution logic.
- [P2] No integration tests for full automation flow - Tests mock everything; no test verifies the actual trigger-to-action flow with real-ish data.
- [P2] Pipeline component tests only cover utility functions - `PipelineView.test.tsx` tests `pipeline-utils.ts` but doesn't test the React component's drag-drop behavior or state management.
- [P2] LossReasonModal tests don't test component rendering - Only validates constants and types, not the modal interaction (submit, cancel, state reset).
- [P3] Edge case missing - No test for when `proposal.prospect` is undefined in email sending path.
- [P3] Fake timer setup is good - `vi.setSystemTime(new Date("2026-04-21T12:00:00Z"))` ensures deterministic time-based tests.

#### Architecture
- [P2] Rule engine design is simplistic but adequate - Uses static `DEFAULT_AUTOMATIONS` array instead of database-driven rules. Comment on line 311 acknowledges this limitation.
- [P2] Pipeline state machine is implicit - `STAGE_TRANSITIONS` in `pipeline-utils.ts` defines valid transitions but there's no formal state machine enforcement; callers must use `canTransitionTo()` manually.
- [P2] Drag-drop implementation lacks accessibility - Native HTML5 drag-drop doesn't provide keyboard navigation or screen reader announcements for stage changes.
- [P3] Clean separation of concerns - `pipeline-utils.ts` contains pure functions, `PipelineView.tsx` handles UI, `LossReasonModal.tsx` handles the decline flow.
- [P3] Automation module exports are clean - `index.ts` re-exports both `automation.ts` and `email.ts`.
- [P3] `DeclineProposalInput` in `LossReasonModal.tsx` uses a const object pattern instead of a proper type definition, which is unusual but functional.

#### Recommendations
1. **Critical:** Persist execution logs to database to prevent duplicate automations after server restart. Add schema similar to:
   ```sql
   CREATE TABLE automation_logs (
     id TEXT PRIMARY KEY,
     proposal_id TEXT NOT NULL,
     rule_id TEXT NOT NULL,
     executed_at TIMESTAMP NOT NULL
   );
   ```
2. **Critical:** Add workspace filtering to `findMatchingProposals()` to ensure automations only process proposals belonging to the automation's workspace/organization.
3. Add email validation using a Zod schema before sending follow-up emails.
4. Add keyboard navigation support to PipelineView for accessibility (arrow keys to move between stages, Enter to confirm drop).
5. Consider using `@dnd-kit` or similar library for better accessibility and mobile support in drag-drop.
6. Add integration tests that verify the full automation flow from trigger detection through action execution.
7. Fix the type casting issue by joining prospect data when fetching proposals for automation.
8. Add rate limiting: maximum N automations per proposal per day, maximum M emails per hour per workspace.

**Overall:** NEEDS_WORK

---


#### Performance
- [P2] TrafficChart creates new animated data array on every rAF frame (line 110-115) - creates GC pressure; consider mutating a ref for frame-by-frame values and only setting state at end.
- [P2] AnimatedCounter and TrafficChart both independently track inView state - if multiple counters are on screen, each creates its own IntersectionObserver; consider a shared observer context for proposals.
- [P3] useScrollSection creates observer with threshold array `[0, 0.25, 0.5, 0.75, 1]` (line 79) - 5 callbacks per section per intersection change; for 6 sections this is manageable but consider reducing thresholds for simpler use cases.
- [P3] SECTIONS array in ProposalPageView is recreated on every render due to spread `[...SECTIONS]` on line 146 - minor but could be memoized or passed directly.
- [P3] OpportunitiesSection recalculates `totalPotential` and `totalVolume` on every render (lines 118-119) - should use useMemo since opportunities array rarely changes.

#### Testing
- [P1] Missing component tests for animated UI components - AnimatedCounter.tsx, TrafficChart.tsx, ProgressIndicator.tsx, StickyCtaButton.tsx have no test files; these are critical for the scrollytelling experience.
- [P1] Missing section component tests - HeroSection, CurrentStateSection, OpportunitiesSection, RoiCalculatorSection, InvestmentSection, CtaSection have no dedicated tests.
- [P2] useProposalTracking.test.ts has most tests marked `.skip` due to fake timer flakiness (line 18) - reduces effective coverage to ~15% of the documented scenarios.
- [P2] SigningModal.test.ts only tests exports and validation functions - no render tests for the multi-step wizard flow or polling behavior.
- [P3] useRoiCalculator.test.ts has good coverage (357 lines) including edge cases and industry defaults - serves as a model for other hook tests.
- [P3] useScrollSection.test.ts tests observer behavior well but missing tests for multiple simultaneous visible sections.

#### Architecture
- [P2] Section components follow consistent pattern (brandConfig prop, motion animations, responsive design) - good compositional architecture.
- [P2] useProposalTracking fires multiple fetch calls on section changes without debouncing - could batch section updates or use a queue.
- [P3] SigningModal is a large component (459 lines) managing complex state machine - consider extracting step components (MethodStep, InputStep, VerificationStep) or using useReducer for state transitions.
- [P3] ROI calculator logic split well between hook (calculation) and component (UI) - clean separation of concerns.
- [P3] Currency is passed as prop to InvestmentSection but hardcoded as "EUR" in other sections (HeroSection line 132, CurrentStateSection line 112) - inconsistent localization.

#### Recommendations
1. Add component tests for all animated UI components (AnimatedCounter, TrafficChart, ProgressIndicator, StickyCtaButton) with mocked IntersectionObserver.
2. Fix skipped tests in useProposalTracking.test.ts or document why server-side tests suffice.
3. Consider shared IntersectionObserver context for proposal page to reduce observer count.
4. Add URL validation for brandConfig.logoUrl before rendering in img src.
5. Use performance.now() in animation loops for more consistent frame timing.
6. Debounce section tracking calls in useProposalTracking to reduce API load.
7. Extract SigningModal step components for better testability and maintainability.
8. Add proper ARIA roles (tablist/tab) to ProgressIndicator for better screen reader navigation.

**Overall:** PASS_WITH_NOTES

---

## Summary

**Total Reviews:** 20 agents | **Verdicts:** 18 PASS_WITH_NOTES, 2 NEEDS_WORK

### Critical Issues (P0)

| # | Phase | Issue | File | Impact | Status |
|---|-------|-------|------|--------|--------|
| 1 | 30 | **Stripe webhook signature bypass** - `verifyWebhookSignature()` accepts string but Stripe requires raw bytes | `payment.ts:199-211` | Payment security bypass | ✅ FIXED - Updated function to accept `Buffer \| string`, added documentation requiring raw body, added integration test for Buffer payload |

### High Priority (P1)

| # | Phase | Issue | File |
|---|-------|-------|------|
| 1 | 26 | Test coverage inadequate - only TS types tested, no DB operations | `prospect-schema.test.ts` |
| 2 | 26 | Missing ProspectService tests | `ProspectService.ts` | ✅ FIXED |
| 3 | 26 | Inefficient rate limiting via BullMQ job scan | `prospectAnalysisQueue.ts` |
| 4 | 27 | **SSRF vulnerability** - no URL validation before scraping | `dataforseoScraper.ts` | ✅ FIXED - Added `validateScrapableUrl()` rejecting private IPs, localhost, AWS metadata, link-local, non-HTTP(S) |
| 5 | 27 | Missing error scenario tests in businessExtractor | `businessExtractor.test.ts` | ✅ FIXED |
| 6 | 28 | No authorization checks - caller not verified | `ProspectAnalysisService.ts` | ✅ FIXED |
| 7 | 28 | No virtualization for large keyword tables | `KeywordGapTable.tsx` | ✅ FIXED |
| 8 | 28 | **CSV injection vulnerability** - formula chars not sanitized | `export.ts` | ✅ FIXED |
| 9 | 29 | Sequential batch processing instead of parallel | `volumeValidator.ts` | ✅ FIXED |
| 10 | 29 | No React component render tests | `OpportunityKeywordsTable.tsx` | ✅ FIXED |
| 11 | 30 | **Default IP salt** creates GDPR risk | `ViewTrackingService.ts:38` | ✅ FIXED |
| 12 | 30 | **Default personal code salt** weakens GDPR hashing | `signing.ts:69` | ✅ FIXED |
| 13 | 30 | No authorization check before signing | `signing.ts` | ✅ FIXED |
| 14 | 30 | Missing status validation - signed proposals editable | `ProposalService.ts` | ✅ FIXED |
| 15 | 30 | **In-memory execution log** causes duplicate automations | `automation.ts:114` | ✅ FIXED |
| 16 | 30 | No workspace filtering in automations | `automation.ts` | ✅ FIXED |
| 17 | 30 | Missing animated component tests | `AnimatedCounter.tsx`, etc | ✅ FIXED |

### Medium Priority (P2) - Top 15

| # | Phase | Issue | File |
|---|-------|-------|------|
| 1 | 26 | Missing migration for `opportunity_keywords` | Schema |
| 2 | 26 | Inconsistent API auth patterns across DataForSEO | Multiple files |
| 3 | 27 | Missing dangerous URL scheme filtering | `linkDetector.ts` | ✅ FIXED |
| 4 | 28 | Sequential competitor API calls (should parallelize) | `ProspectAnalysisService.ts` | ✅ FIXED |
| 5 | 28 | No retry logic for DataForSEO | `dataforseoKeywordGap.ts` |
| 6 | 29 | No input validation on locationCode/languageCode | `OpportunityDiscoveryService.ts` |
| 7 | 30 | No token expiration check in findByToken | `ProposalService.ts` | ✅ FIXED |
| 8 | 30 | Race condition in recordView | `ProposalService.ts` | ✅ FIXED |
| 9 | 30 | Session dedup uses 2 queries instead of JOIN | `ViewTrackingService.ts` |
| 10 | 30 | No DB transaction in handleCheckoutCompleted | `payment.ts` | ✅ FIXED |
| 11 | 30 | No DB transaction in triggerOnboarding | `onboarding.ts` | ✅ FIXED |
| 12 | 30 | Logo URL without protocol validation | `HeroSection.tsx` |
| 13 | 30 | TrafficChart creates GC pressure | `TrafficChart.tsx` |
| 14 | 30 | Multiple IntersectionObservers per component | `AnimatedCounter.tsx` |
| 15 | 30 | N+1 query in engagement signal matching | `automation.ts` |

### Test Coverage Gaps

| Phase | Gap |
|-------|-----|
| 26 | ~~ProspectService has no tests~~ (FIXED); schema tests only verify types |
| 27 | Missing SSRF tests, malformed URL tests |
| 28 | Keyword gap UI components not render-tested |
| 29 | No component render tests for opportunity UI |
| 30 | Most useProposalTracking tests skipped; ~~no animated component tests~~ (FIXED) |
| 30 | Missing webhook raw body integration test |
| 30 | Pipeline/LossReasonModal only test utilities, not rendering |

### Security Checklist

- [x] No hardcoded secrets - env vars used throughout
- [ ] Input validation on all boundaries - **GAPS**: URL validation (SSRF), locationCode, phoneNumber
- [x] SQL injection prevention - parameterized queries via Drizzle
- [x] XSS prevention - React escapes output; some logo URL concerns
- [ ] Auth checks on protected routes - **GAPS**: signing, automation engine
- [ ] Rate limiting on public endpoints - **GAPS**: tracking endpoints, automation
- [x] CSRF protection - Stripe webhook signatures (when correctly implemented)

### Top Recommendations (Priority Order)

1. **[CRITICAL]** Fix Stripe webhook to pass raw body, not parsed JSON
2. **[CRITICAL]** Add SSRF protection - validate URLs before scraping
3. **[CRITICAL]** Require `IP_SALT` and `PERSONAL_CODE_SALT` env vars - no empty fallbacks
4. **[CRITICAL]** Persist automation execution logs to database
5. **[HIGH]** Add workspace filtering to automation engine
6. **[HIGH]** Fix CSV injection - prefix formula-triggering characters
7. **[HIGH]** Add authorization check to signing initiation
8. **[HIGH]** Parallelize DataForSEO API calls where independent
9. **[MEDIUM]** ~~Wrap payment/onboarding DB ops in transactions~~ ✅ FIXED
10. **[MEDIUM]** Add virtualization to large keyword tables
11. **[MEDIUM]** Consolidate DataForSEO auth pattern across modules
12. **[MEDIUM]** Add component render tests for UI
