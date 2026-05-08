---
gsd_state_version: 1.0
milestone: v11.0
milestone_name: Agency Analytics
status: completed
last_updated: "2026-05-08T12:45:00.000Z"
last_activity: 2026-05-08 -- Phase 96 COMPLETE (Agency Analytics Platform)
progress:
  total_phases: 15
  completed_phases: 15
  total_plans: 63
  completed_plans: 63
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)
See: .planning/PHASE-WORK-SUMMARY.md (updated 2026-04-24) — comprehensive phase documentation

**Core value:** Fully autonomous SEO platform. Client connects → system optimizes → rankings improve. Zero human oversight required for routine optimization.

**Current focus:** Phase 92 complete — On-Page SEO Mastery

## Current Position

Phase: 96 (Agency Analytics Platform) — COMPLETE
Plan: 96-05 complete
Milestone: v11.0 Agency Analytics
Status: Phase 96 COMPLETE
Last activity: 2026-05-08 -- Phase 96 Plan 05 complete (Client Portal)

### Phase 96 Progress (2026-05-08) — COMPLETE

| Plan | Name | Status | Commit |
|------|------|--------|--------|
| 96-01 | GSC Data Foundation | Complete | 4d8c4e9 |
| 96-02 | Master Dashboard | Complete | 23c29f0 |
| 96-03 | Actionable Insights & Annotations | Complete | 407c8b5 |
| 96-04 | Content Intelligence Layer | Complete | 8f9c1f0 |
| 96-05 | Client Portal | Complete | f05cd6a |

**Key Deliverables (96-05):**

- ClientVisibilityService with API-layer enforcement (403 on unauthorized access)
- BrandedKeywordService with auto-detection from domain/site name
- CtrBenchmarkService with Advanced Web Rankings 2024 position-based CTR curves
- PortfolioMetricsService for cross-client workspace aggregation
- AnalyticsExportService with CSV (formula injection protection) and Google Sheets
- 5 API routes: visibility, branded-split, ctr-benchmark, portfolio, export
- Client Portal UI: Dashboard, BrandedSplitCard, CtrBenchmarkChart, PortfolioMetrics
- Admin UI: VisibilityConfigPanel, ExportMenu, ReportScheduleModal
- 95 tests passing across all services (TDD)

**Key Deliverables (96-04):**

- Content Groups with folder/regex/manual pattern matching and GSC metrics aggregation
- Topic Clusters with hub+spoke SVG visualization and gap detection
- Index Coverage with URL Inspection API (2000/day) and Indexing API (200/day)
- 23 tests passing across ContentGroupService, TopicClusterService, IndexCoverageService
- API routes for content-groups, topic-clusters, index-coverage
- UI components: ContentGroupCard, TopicClusterVisualization, IndexCoverageChart

### Phase 94 Progress (2026-05-06)

| Plan | Name | Status | Commit |
|------|------|--------|--------|
| 94-01 | Foundation: Tokens + Fonts | Complete | 23c29f013 |
| 94-02 | Primitives: Card + Button + Badge + ProgressBlock | Complete | ff88d1de4 |
| 94-03 | Pipeline & Quality: Article Pipeline + Quality Score | Complete | 3027978b2 |
| 94-04 | Data Views: Keywords + Calendar | Complete | 5cafd6660 |
| 94-05 | Portal Polish: GoalProgressCard + ClusterCard + StatCard | Complete | 4fe204557 |

**Key Deliverables (94-05):**

- GoalProgressCard uses ProgressBlock from @tevero/ui for editorial numerals
- GoalProgressCard status icons have semantic background colors
- ClusterCard tier/status badges use Badge component with v6 semantic variants
- ClusterCard removed all hardcoded Tailwind colors
- StatCard uses Card component from @tevero/ui with v6 shadows
- All portal components verified for v6 consistency

**Key Deliverables (94-04):**

- KeywordTable with v6 sliding underline tabs and Newsreader serif volume
- Difficulty badges with semantic colors (success/warning/error-soft)
- Queue button with hover-reveal pattern
- CalendarViews: MonthView (Notion), WeekView (Linear), ListView (Superhuman)
- ContentCalendar wrapper with view switching and status legend
- Status dot system: solid, hollow, half-filled, halo patterns

**Key Deliverables (94-03):**

- PipelineStep with three semantic states (complete, active, pending)
- ArticlePipelineCard with ProgressBlock header and expandable steps
- QualityCheckRow with pass/warning/fail states and tree details
- QualityScoreCard with mega numeral and grade badge

**Key Deliverables (94-01):**

- v6 shadow tokens with inset highlights (glass-edge effect)
- Type role classes: .num-mega, .num-hero, .num-card, .num-row
- Typography classes: .t-page-title, .t-eyebrow, .t-smallcaps, .t-mono, .t-tnum
- Verified font loading (Newsreader with optical sizing, Geist, Geist Mono)

### Phase 92 Progress (2026-05-06) — COMPLETE

| Plan | Name | Status | Commit |
|------|------|--------|--------|
| 92-01 | Database Schema + VerticalClassifier | Complete | b6b537f4f, 970767176 |
| 92-02 | Text Processing Utilities | Complete | aab978b10, f51aae5bb |
| 92-03 | QualityGateService (Tier 5 checks) | Complete | 03a9ae0 |
| 92-04 | RuleEngineService (41-point scorecard) | Complete | 3e8f4c2 |
| 92-05 | SchemaGenerator | Complete | 13d638f |
| 92-06 | InternalLinkGraph PageRank | Complete | df99c15, a5b6cf8 |
| 92-07 | Tier 1 Page Structure Checks | Complete | 0f8372850, 6b295adbd |
| 92-08 | Tier 5 Content Quality Checks | Complete | bff2508af, 1d8ab7c9c |
| 92-09 | API Routes + UI Components | Complete | 20b43726d |
| 92-10 | Integration Tests | Complete | af24eafe4, 5674c77c6 |

**Key Deliverables:**

- 41-point SEO-AGI scorecard with rule hierarchy (Universal < Vertical < Client)
- Vertical classification: 12 industries + YMYL detection (90%+ heuristic-first)
- 7 Quality Gates: Reddit Test, Information Gain, Prove-It Details, QDD, Thin Content, AI Slop, Fluff Detection
- 16 new Tier 1 page structure checks (T1-70 to T1-85)
- 13 new Tier 5 content quality checks (opt-in)
- PageRank authority calculation using ngraph.pagerank
- Schema.org JSON-LD generation with schema-dts types
- 500-token semantic chunking with tiktoken cl100k_base
- NLP entity extraction with PII stripping
- 241 tests passing across 9 test files (80%+ coverage)

### Phase 86 Semantic Intelligence Summary (2026-05-06)

**All 10 plans complete:**

| Plan | Focus | Completed |
|------|-------|-----------|
| 86-01 | Embedding Service + Config | 10:28 |
| 86-02 | Classification Pipeline | 10:42 |
| 86-03 | HDBSCAN Clustering | 13:47 |
| 86-04 | Funnel Distribution | 13:57 |
| 86-05 | Cascade Selection | 11:05 |
| 86-06 | Proposal Integration | 11:17 |
| 86-07 | Proposal Editing UI | 11:31 |
| 86-08 | BERT Embeddings | 11:22 |
| 86-09 | Backfill + Learning | 14:48 |
| 86-10 | Dashboard UI | 14:38 |

**Key Documentation:**

- `.planning/SEMANTIC-INTELLIGENCE-MASTER.md` — Unified LLM architecture, cost optimization, semantic understanding

### Phase 90 Client Portal Overview

| Plan | Name | Duration | Status |
|------|------|----------|--------|
| 90-01 | Trust Foundation | 3 weeks | Ready |
| 90-02 | Progress & Value | 2 weeks | Ready |
| 90-03 | Self-Service | 2 weeks | Ready |
| 90-04 | Intelligence & Integrations | 3 weeks | Ready |
| 90-05 | Polish & PWA | 2 weeks | Ready |

**Total Duration:** 12 weeks

**Key Design Principles:**

- Trust hierarchy: Verified (GSC) → Calculated → Defensible (CPC*) → Client-owned → Integrated (GA4)
- V6 design system: Newsreader (display) + Geist (sans) + Geist Mono; ghost-edge shadows; #FAFAF7 canvas
- Never show a number you can't defend in a client meeting
- Proactive > Reactive — portal comes to the client

**Source Documents:**

- `.planning/phases/CLIENT-PORTAL-PRD.md` — Full PRD (1100+ lines)
- `.planning/phases/90-client-portal/90-CONTEXT.md` — Design context and decisions

### Phase 84-89 Execution Summary

| Phase | Focus | Context | Status |
|-------|-------|---------|--------|
| 84 | Export & Integration | - | ✓ Complete |
| 85 | Analysis Experience | 85-CONTEXT.md | ✓ Complete |
| 86 | Semantic Intelligence | 86-CONTEXT.md | ✓ Complete |
| 87 | Agency Business (Portal) | 87-CONTEXT.md | ✓ Complete |
| 88 | Learning & Collaboration | 88-CONTEXT.md | ✓ Complete |
| 89 | Keyword Lock-in | 89-CONTEXT.md | ✓ Complete |

### Phase 89 Keyword Lock-in Summary

| Plan | Focus | Status |
|------|-------|--------|
| 89-01 | Schema (4 tables, 5 enums) | ✓ Complete |
| 89-02 | Repositories (4 modules) | ✓ Complete |
| 89-03 | LockEventService | ✓ Complete |
| 89-04 | OutOfScopeService | ✓ Complete |
| 89-05 | ConflictDetectionService | ✓ Complete |
| 89-06 | Progress Tracking UI | ✓ Complete |

**Milestone v9.0 Foundation & Reliability: COMPLETE**

**Key Documents Created:**

- `.planning/phases/CLIENT-PORTAL-SPEC.md` — Comprehensive spec for Phases 87-89 (1500+ lines)
- `.planning/phases/87-agency-business/87-CONTEXT.md` — Content Calendar + Client Portal
- `.planning/phases/88-learning-collaboration/88-CONTEXT.md` — Outcome Tracking + Learning
- `.planning/phases/89-client-acquisition/89-CONTEXT.md` — Keyword Lock-in

**Key Decisions:**

- All portal/notification features optional, OFF by default
- Communication style presets (High-Touch/Hybrid/Self-Service) instead of feature toggles
- Portal authentication: 3 levels (token-only, email-verify, full-login)
- Keyword Lock-in ON by default (infrastructure) but strict enforcement optional
- Value math: delivered ÷ contracted target × 100 (no ranges)
- Multi-client conflict detection for overlapping keywords

### Phase 41 Focus

Based on 10-agent architecture audit (SYSTEM-ARCHITECTURE-AUDIT.md):

- Remove dead code (research_utilities.py, legacy SERP files)
- Fix factory patterns (InMemoryFindingsRepository)
- Wire pattern detection to real GSC data
- Complete autonomous pipeline wiring
- Polish CMS integrations (Wix categories, connection test)

### v4.0 Completion Summary (2026-04-22)

| Phase | Name | Status | Verification |
|-------|------|--------|--------------|
| 26 | Prospect Data Model | PASS | 26-VERIFICATION.md |
| 27 | Website Scraping | PASS | 27-VERIFICATION.md |
| 28 | Keyword Gap Analysis | PASS | 28-VERIFICATION.md |
| 29 | AI Opportunity Discovery | PASS | 29-VERIFICATION.md |
| 30 | Conversion & Sales Tools | PASS | 30-VERIFICATION.md |
| 30.5 | Pipeline Automation | PASS | 30.5-VERIFICATION.md |

## Completed Milestones

### v1.0 Platform Unification (Phases 1-7)

All 7 phases complete. AI-Writer backend cleanup, CF bindings removal, BullMQ/Redis, unified Docker, CI/CD, Clerk auth, AppShell integration.

### v2.0 Unified Product (Phases 8-14)

All 7 phases complete. Next.js unified shell, shared UI package, open-seo frontend absorption, Clerk auth unified, per-client credentials, analytics data layer, agency dashboard.

### v3.0 Agency Intelligence (Phases 15-25 + 18.5)

All 12 phases complete (19-20 AI phases skipped per user). Report generation, scheduling, white-label, rank tracking, alerts, webhooks, command center, goal metrics, performance, power user, team intelligence.

### v4.0 Prospecting & Sales (Phases 26-30.5)

All 6 phases complete. Prospect data model, website scraping, keyword gap analysis, AI opportunity discovery, conversion tools, pipeline automation.

## v4.0 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 26 | Prospect Data Model | ✓ Complete |
| 27 | Website Scraping & Business Understanding | ✓ Complete |
| 28 | Keyword Gap Analysis | ✓ Complete |
| 29 | AI Opportunity Discovery | ✓ Complete |
| 30 | Prospect Conversion & Sales Tools | ✓ Complete |
| 30.5 | Prospect Pipeline Automation | ✓ Complete |

## Sub-project Status

| Sub-project | Status | Notes |
|-------------|--------|-------|
| AI-Writer backend (FastAPI) | ✅ Stable | Ready for v5.0 integration |
| open-seo backend (Node.js/Nitro) | ✅ Stable | All v4.0 features complete |
| apps/web (Next.js) | ✅ Stable | Prospect UI complete |
| packages/ui (shared components) | ✅ Stable | All components available |

## Decisions

- **83-01:** v5-nano as default model (12x faster, 98.3% recall vs v3 98.0%); Python FastAPI server for local embeddings (sentence-transformers); 4-level fallback cascade (local server -> local ONNX -> Jina API -> zero vectors); Cache prefix bumped from emb:v2 to emb:v3 to invalidate old embeddings; Health check caching (30s interval) to avoid excessive server pings
- **82-02:** CopilotKit handler uses generic args type with cast for type safety; Session storage uses in-memory Map for development (TODO wire to open-seo-main); useKeywordAnalysis uses fetch+ReadableStream instead of EventSource (POST not supported)
- **82-01:** Removed drizzle-zod dependency to match existing codebase pattern; Stub implementations use realistic delays (60-100ms) for pipeline testing; SSE events use data: prefix only for simpler client parsing
- **72-02:** Tier weight documentation added to types.ts and scoring.ts for reference; Test assertions verify structure rather than specific implementation behavior; Skipped checks (severity=info, skipped=true) excluded from scoring calculations
- **72-01:** Service-layer enforcement via assertTenantAccess chosen over repository-level enforcement; Added *Scoped() variants to repositories rather than breaking existing APIs; System templates (workspaceId=null) remain globally accessible
- **71-03:** All 22 Alembic migrations already had downgrade() - no changes needed; Migration test script uses PID-suffixed database name for isolation; SQL migrations wrapped in BEGIN/COMMIT for atomic execution
- **71-02:** Pre-commit regex patterns for OpenAI/Stripe/GitHub/AWS/Slack/Google secrets; Gitleaks with full history scan; CSP strict-dynamic with nonce via x-nonce header; Security deps pinned exact (no ^)
- **71-01:** BACKEND_URL -> OPEN_SEO_URL, AIWRITER_INTERNAL_URL -> AI_WRITER_URL for consistent naming; Zod refine() for production-only required validation; Legacy fallbacks removed to enforce standardized naming
- **70-03:** Minimum 300ms overlay duration prevents jarring flash on fast client switches; Help redirects in middleware for external URL handling; Breadcrumb uses aria-current=page for accessibility; safeParseJsonString for strings, safeParseJson for Response objects; Debug-level logging for localStorage errors (expected in private browsing)
- **70-01:** useRef for timer cleanup on unmount (prevents memory leaks); Stable keys from content.slice(0,30).replace(/\s/g,'-') when no ID; item.href as key for nav items; aria-describedby points to hint normally, error when invalid; role=alert on error messages
- **69-04:** Optimistic locking via version field in WHERE clause (not pessimistic FOR UPDATE); Redis SET NX EX for atomic lock acquisition; Lua scripts for ownership-safe lock release/extend; Circuit breaker state in Redis for cross-worker sharing; DLQ stores job data + metadata for replay capability
- **69-03:** Cursor pagination uses base64url encoding for opaque cursors; Compound cursors support (sortColumn, primaryKey) row comparison; BATCH_SIZE=50 for background jobs, MAX_PAGE_SIZE=100 for list endpoints; All composite indexes use CONCURRENTLY for non-blocking creation; Partial indexes where applicable (deleted_at IS NULL, is_deleted = false)
- **69-02:** Soft delete cascades to audits (archive), contracts (cancel), reportSchedules (disable), siteConnections (disconnect); PostgreSQL ENUMs created for type safety but CHECK constraints used for flexibility; Conditional DDL pattern (IF NOT EXISTS) for idempotent migrations
- **69-01:** INTERNAL_ERROR code for transaction failures; PostCommitJob queued but not enqueued until after commit; Row-level FOR UPDATE locking for concurrent conversion prevention; Saga compensation runs all compensations even if some fail; noOpCompensation helper for irreversible operations
- **68-04:** 5-minute staleTime + 10-minute gcTime for client query cache; BroadcastChannel for cross-tab sync (not localStorage events); Store retains legacy methods for gradual migration; Direct setState in broadcast handler to avoid circular broadcasts
- **68-03:** Zod schemas inline in webhooks.ts for co-location; Version column integer default 1 incremented on update; Event schema uses snake_case (event_type, client_id); api_version literal "2026-05-01"; Error envelope includes code, message, optional details
- **68-02:** VALIDATION_ERROR code for 400 responses (consistent with error-codes.ts); AbortManager singleton for cross-component abort coordination; 30s cache TTL matches existing ownership cache; In-memory cache supplements Redis for dual-layer invalidation; 58 tests across 4 modules
- **68-01:** JWT validation required before trusting user identity headers; Reuse existing verifyClerkJWT (jose-based) via clerk-verify.ts wrapper; resolveClientContext() as primary API with ResolvedContext interface; service:internal userId for internal service token bypass; 21 tests for auth flow validation
- **67-03:** Fire-and-forget pattern for shadow writes (non-blocking); SHADOW_WRITE_ENABLED defaults to false (opt-in); DB_READ_PERCENTAGE_TEVERO uses Math.random for distribution; Tevero connection pool size 5 (smaller than primary); 3-week phased cutover timeline
- **67-02:** ORPHAN_ prefix for NULL workspace_id handling; wp_ prefix for alwrity writing_personas ID collision; uuid_generate_v5 for deterministic UUID mapping; Base64 encoding for encrypted credentials migration
- **66-11:** Playwright for E2E testing (modern, cross-browser, built-in mocking); data-testid attributes for stable test selectors; API route mocking for deterministic tests; Integration tests with mocked Redis/DB for pipeline verification
- **66-10:** {{variable}} interpolation syntax matching existing patterns; Lithuanian uses natural phrasing not literal translations; CMS guide i18n via translation keys
- **66-09:** Facade routes to best source (GA OAuth > pixel for traffic); GSC required for rankings (no fallback); CWV always pixel; Prompt dismissal 7-day localStorage TTL; window.location for navigation (avoids Next.js typed routes)
- **66-04:** useState+useCallback for wizard state (simpler than useReducer); 9-step state machine (url/detecting/choice/diy/developer/oauth/verifying/success/error); ConnectApiError for typed error handling; snippet prop for siteId personalization
- **66-07:** Change lifecycle: pending -> live (immediate on approve) -> rolled_back; Rollback creates new live change (preserves audit trail); HTML sanitization strips script tags and event handlers; JSON validation for schema type; Native title attribute for tooltips (Tooltip not in @tevero/ui)
- **66-05:** 32-char nanoid tokens (~10^57 entropy); 30-day magic link expiry; Rate limit 5 handoffs/site/day; Email injection prevention via sender name sanitization; Max 3 reminders per handoff
- **66-03:** Subdomain patterns detect with 100% confidence (no fetch); HTML signatures 90-95%; Response headers 80%; SSRF blocks all internal IPs; 3s timeout; GTM as enhancement feature
- **64-02:** L0 treated as negative-only signal for Shopify-like platforms; Accept weak ETags (W/ prefix) per Cloudflare; 30s timeout for conditional GET
- **64-01:** SET NX EX for atomic lock (not separate SETNX + EXPIRE); Subscribe before check pattern for lost wakeup prevention; Tenant-prefixed keys for isolation
- **62-04:** Pre-computed aggregations in pipeline_metrics; 5-min refresh via BullMQ repeatable; stale-while-revalidate at 10 min; cents for financial precision; pct*10000 for conversion rate precision; in-memory rate limiting (1 req/workspace/min)
- **57-07:** Context checkboxes dynamically show availability; 4 tone presets (professional/friendly/technical/urgent); Section prompts return structured JSON; Confidence scoring based on JSON validity, length, structure; AI-generated content creates version with changeType: ai_generated
- **57-08:** 50 state limit for temporal history; platform detection for Mac vs Windows shortcuts; 32-char nanoid tokens for magic links (~10^57 entropy); 30-day default expiry; Beacon API for page leave duration tracking
- **57-01:** Three-layer template hierarchy (system/workspace/instance); soft delete via isArchived; sectionOrder jsonb array; i18n suffix pattern (name, nameEn, nameLt)
- **57-06:** 2s debounce auto-save via use-debounce; SaveIndicator with 3 states (saving/saved/error); proposal_versions table with changeType enum; VersionHistory sidebar with restore confirmation
- **57-05:** 8 custom section types (text/image/testimonial/case_study/video/comparison/timeline/custom); SECTION_TYPE_CONFIGS registry; video platform detection (YouTube/Vimeo/Loom); section data as JSON in content field
- **57-03:** TipTap with StarterKit as rich text foundation; variable nodes as inline atoms (cannot split); category colors match palette; red dashed border for unresolved; VariableProvider fetches all in single request; character count excludes variable markup
- **57-02:** 6 variable categories (client/provider/pricing/audit/dates/custom); entity path resolution with dot notation; computed functions for dynamic values; drag transfer uses text/plain + application/x-variable
- **52-03:** shadow-lift hover pattern for EntrySelector; bg-accent-soft for selected states; border-hairline-2 for dividers; text-accent for links
- **52-02:** cn() utility for shadow-card merging; text-error over text-destructive for v6 semantic colors; bg-accent-soft text-accent-ink for primary badges; var(--radius-input) for nested panels
- **52-01:** text-[12px] over text-xs for WCAG floor; remove dark mode variants (v6 tokens handle theming); bg-surface-2 for neutral ignore tier; var(--success/error/text-3) in chart components
- **47-01:** Fallback AI recommendations when backend endpoint not ready; auto-set awareness only when at default; Lithuanian UI labels for proposal builder
- **46-02:** Add 'proposal' to ENTITY_TYPES; fire-and-forget beacon tracking; ProposalStatus from proposal-schema.ts for type safety
- **46-01:** AUTH_CONFIG_MISSING error code for missing RESEND_API_KEY; Rate limit 20 sends/hr per user; STATUS_MAP for 9 proposal statuses to 4 Badge variants
- **44-05:** SVG arc gauge uses circumference-based dasharray; SeverityDots shows numeral on overflow; ConnectionStatusCard detects 7-day token expiration; KeyboardShortcutHint maps keys to symbols; IntentBadge uses all-small-caps
- **44-04:** Use React.ElementType for polymorphic typography; TypographyCardTitle to avoid card.tsx conflict; inline SVG sparkline; NumDelta infers direction from value sign
- **44-03:** Compound components pattern for Checklist/ChecklistItem and KanbanColumn/KanbanCard; KanbanColumn uses role="listbox" with KanbanCard role="option"; TodayFeedItem uses 44px fixed timestamp column
- **44-02:** Use CSS var() syntax for v6 tokens in ProgressBar CVA variants; add getStatusConfig helper for status lookups; fix format-time export naming to match actual functions
- **44-01:** Use @theme inline for Tailwind v4 token mapping (CSS-first approach); export all token categories as TypeScript const objects for type safety; configure vitest with 80% coverage thresholds
- **43-05:** Schema and services pre-existed from security audit; focused on migration + UI; vi.hoisted() for mock function hoisting; three-tab UI (Rules, Discovery, Settings)
- **41-04:** Wix categories API already implemented via WixBlogService.list_categories(); Connection test uses platform dispatch pattern; Workspace opportunities aggregates up to 20 per client
- **41-02:** Traffic status thresholds: dropped <= -20%, growing >= 10%, stable in between; ranking positive change = improvement (lower position is better)
- **41-03:** Use auto_publish as proxy for auto_optimize; CTR opportunity threshold 50% of expected; 3 AM UTC daily cycle with 5s rate limit between clients
- **41-01:** Agent framework fallback replaced with RuntimeError; startup validation rejects DISABLE_AUTH/SKIP_AUTH/DEBUG_MODE in production
- **35-01:** Link position classification via tag name + class patterns; DoS limits 1000/page, 50000/audit
- **34-02:** Decision tree: position <= 20 -> optimize, relevance >= 60 -> optimize, else create
- **34-02:** Lazy-load repository to enable pure function testing without DB connection
- **34-01:** Relevance scoring weights: title=35, h1=25, first100=15, url=15, frequency=10 (Kyle Roof research)
- **34-01:** Good match threshold: 60+ points
- **32-05:** ScoreCard uses 4-tier breakdown matching check runner scoring system
- **32-05:** FindingsTable filters by severity, tier, category, pass/fail with CSV export
- **32-04:** Tier 3 runs after Lighthouse, Tier 4 runs after Tier 3 (once with SiteContext)
- **32-04:** BFS click depth calculation with DoS limits (max 10 depth, 10k iterations)
- **32-04:** Link graph capped at 50k entries per threat model T-32-08
- **32-04:** Checks gracefully skip when data unavailable (severity: info)
- **32-03:** Tier 2 checks run after crawl completes (all HTML available) but before Lighthouse
- **32-03:** HTML accumulated across crawl batches and passed via CrawlPhaseResult
- **32-03:** currentPhase set to "analyzing" during Tier 2 execution
- **32-02:** Modified crawlPage to return HTML alongside analysis for check execution
- **32-02:** Tier 1 checks run as separate workflow step after each crawl batch
- **32-02:** Check failures are logged but non-blocking - crawl continues
- **30-05:** Use existing Puppeteer PDF infrastructure from Phase 15
- **30-05:** RGB colors for Puppeteer compatibility (no hex values)
- **30-05:** VALIDATION_ERROR for invalid state (matches shared error-codes.ts)
- **30.5-04:** Pipeline stages: new, analyzing, scored, qualified, contacted, negotiating, converted, archived
- **30.5-04:** Auto-qualify threshold: score >= 70
- **30.5-01:** CSV parser uses papaparse with header normalization
- **30.5-03:** Priority score computed after analysis via automation triggers
- **29-01:** AI keyword generation via Claude API with Zod schema validation
- **29-02:** DataForSEO volume validation with caching
- **28-02:** DA-based achievability scoring
- **27-03:** Multi-page scraping (homepage + 3 business pages max)
- **27-02:** Smart link detection for /products, /about, /services, /contact
- **26-02:** keywordsForSite and competitorsDomain map to domain_overview credit feature
- **26-02:** exclude_top_domains enabled for competitorsDomain to filter generic sites
- **26-03:** Rate limit 10 analyses per day per workspace (MAX_ANALYSES_PER_DAY)
- **26-03:** 100ms API_RATE_LIMIT_MS between DataForSEO calls
- **26-01:** Domain normalization strips protocol, www, path, port before storage
- Use TanStack Start createFileRoute pattern instead of h3 handlers
- Add upsert method to VoiceProfileService for get-or-create pattern
- Use pdf-lib for contract PDF generation instead of Puppeteer - already in stack, faster for structured documents
- Dokobit environment variables optional at startup - allows development without credentials
- State machine enforces draft -> sent only - unidirectional signing prevents data inconsistency
- Extended existing webhook-schema.ts for incoming webhooks instead of creating new file
- IP whitelist verification for Dokobit webhooks (no HMAC available)
- Generic saveFile function in storage.ts for workspace-scoped documents
- Contract status 'executed' (not 'paid'/'active') per contract-schema.ts constraints
- OnboardingService does not transition contract status (already 'executed' after payment)
- Dynamic import for OnboardingService prevents circular dependency
- useReportBuilder returns enabledSections Set for efficient section toggle UI
- aggregateReportData fetches only needed data sources based on selected sections
- Section types defined locally to avoid @tevero/types dependency in open-seo-main
- Chart snapshots use inline SVG for reliable Puppeteer rendering with table fallback
- Two-phase worker: schedule check then email delivery in same job cycle
- MAX_EMAILS_PER_RUN = 50 per 5-minute cycle for rate limiting (T-53-09)
- 53-04: Use organization.id as workspaceId for template scoping; crypto.randomUUID() for IDs; v6 tokens without var() syntax
- 54-01: AES-256-GCM encryption with PAYMENT_ENCRYPTION_KEY; Factory pattern with provider caching per workspace; Stripe env var fallback for backwards compatibility
- QUANT-01: halfvec(768) with HNSW indexes for 50% storage reduction
- QUANT-02: Validation at application layer to prevent pgvector crashes from NaN/Inf values
- Use immutable state pattern: all edit operations return NEW state objects
- Grok 4.1 Fast for CopilotKit chat (per LLM-ARCHITECTURE.md)
- Full state snapshots in proposal_edits table for instant undo/redo

## v5.0 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 31 | Site Connection | ✓ Complete |
| 32 | 107 SEO Checks | ✓ Complete |
| 33 | Auto-Fix System | ✓ Complete |
| 34 | Keyword-to-Page Mapping | ✓ Complete |
| 35 | Internal Linking | ✓ Complete |
| 36 | Content Brief Generation | ✓ Complete |
| 37 | Brand Voice Management | ✓ Complete |
| 38 | Autonomous Orchestration | ✓ Complete |
| 39 | AI-Writer Integration | ✓ Complete |
| 40 | Gap Closure | ✓ Complete |

## v5.1 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 41 | Production Hardening | ✓ Complete |

### Phase 40 Gap Closure Summary (2026-04-25)

Closed implementation gaps across P32, P35, P36, P37, P39:

| Plan | Focus | Tasks |
|------|-------|-------|
| 40-01 | Foundation | P32 tier weights, P35 services, P37 voice |
| 40-02 | SERP & Content | SerpAnalyzer H2/word counts, PAA wiring |
| 40-03 | Quality Gate | SEO validation, GSC URL submission |
| 40-04 | Links & Final | Link suggestions API, auto-insert, graph update, check proxy |

**v5.0 Autonomous SEO Pipeline: COMPLETE**

## Blockers/Concerns

None currently.

## v5.2 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 42 | Keyword Intelligence Infrastructure | Complete |
| 43 | Prospect Keyword Pipeline | Complete (5/6 plans, 43-06 deferred) |

### Phase 43 Progress

| Plan | Name | Status |
|------|------|--------|
| 43-01 | Entry Point Architecture + Schema | Complete |
| 43-02 | Quick Check + Competitor Spy | Complete |
| 43-03 | CSV Import + Metric Detection | Complete |
| 43-04 | Prioritization Engine + UI | Complete |
| 43-05 | Scraping Customization + AI Extraction | Complete |
| 43-06 | Proposal Generation + Copywriting AI | Deferred to P46-47 |

**Phase 43 Status:** COMPLETE (5/6 plans done, 1 deferred)
**Deferred:** 43-06 UI components require design-system-v6 foundation; backend services remain in plan scope for future execution.

## v6.0 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 44 | Component Library Foundation | ✓ Complete |
| 45 | Data Foundation | ✓ Complete |
| 46-47 | Proposal System | ✓ Complete |
| 48 | Contract & Payment | ✓ Complete |
| 49-51 | Onboarding & Dashboard | ✓ Complete |
| 52 | v6 UI Compliance | ✓ Complete |
| 53 | Reports & PDF | ✓ Complete |
| 54 | Multi-Provider Payments | ✓ Complete |
| 55 | Platform i18n | ✓ Complete |

### Phase 45 Summary (2026-04-30)

Database schemas and repository layer for agency pipeline:

| Plan | Focus | Tests |
|------|-------|-------|
| 45-01 | Contract schema with state machine | 9 |
| 45-02 | Invoice schema with Stripe/JSONB | 14 |
| 45-03 | Onboarding + Activity schemas | 25 |
| 45-04 | Repositories + Zod validation | 32 |

Key deliverables:

- 4 Drizzle schemas (contracts, invoices, onboarding_checklists, pipeline_activities)
- 4 repository modules with namespace exports
- 4 Zod validation schemas
- State machine transitions with optimistic locking
- 71+ tests passing

## Next Up

**v6.0 Agency Pipeline & Design System** — COMPLETE (2026-04-30)

All 12 phases complete:

- Phase 44: Component Library Foundation
- Phase 45: Data Foundation
- Phases 46-47: Proposal System
- Phase 48: Contract & Payment
- Phases 49-51: Onboarding & Dashboard
- Phase 52: v6 UI Compliance
- Phase 53: Reports & PDF
- Phase 54: Multi-Provider Payments (Revolut + Stripe)
- Phase 55: Platform i18n (Lithuanian localization)

### Phase 55 Summary (2026-04-30)

Full platform internationalization with Lithuanian as primary target:

| Plan | Focus | Key Deliverables |
|------|-------|------------------|
| 55-01 | i18n Framework Setup | next-intl, i18next, routing middleware |
| 55-02 | Gemini Translation Service | API wrapper, SHA256 caching, quality validation |
| 55-03 | UI String Extraction | 254 translation keys, ICU plurals |
| 55-04 | Multi-Tenant Language Settings | workspace/prospect preferences, 6-step resolution |
| 55-05 | Dynamic Content Translation | ProposalTranslationService, email templates, invoices |
| 55-06 | Legal Agreement Templates | Lithuanian SEO services template, variable substitution |
| 55-07 | Language Switcher UI | Header switcher, ProspectLanguageField, preview toggle |
| 55-08 | Text Fitting & QA | Length analysis (66 high-risk), CSS overflow fixes, _short variants |

**Milestone v6.0: COMPLETE**

## v7.0 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 56 | Prospect Input Excellence | ✓ Complete |
| 57 | Proposal Editor Revolution | ✓ Complete |
| 58 | Service Catalog & Extra Services | ✓ Complete |
| 59 | Agreement & Signing Excellence | ✓ Complete |
| 60 | Payment Flexibility | ✓ Complete |
| 61 | Platform Integration | ✓ Complete |
| 62 | Agency Command Center | In Progress |

### Phase 61 Summary (2026-05-02)

| Plan | Name | Status |
|------|------|--------|
| 61-01 | Schema + Token Encryption + OAuth Base | ✓ Complete |
| 61-02 | Google OAuth (GSC, GA, GBP) | ✓ Complete |
| 61-03 | Shopify + Wix OAuth | ✓ Complete |
| 61-04 | WordPress App Passwords + Other Platforms | ✓ Complete |
| 61-05 | Universal Crawler (tiered providers) | ✓ Complete |
| 61-06 | Token Refresh Worker + Dashboard UI | ✓ Complete |

**Phase 61: COMPLETE** — OAuth for 15 platforms with encrypted token storage, token refresh worker (15-minute scheduler), connection dashboard UI, and world-class tiered crawler (DataForSEO primary for JS sites, NO auto-Playwright burn).

### Phase 62 Progress (2026-05-02)

| Plan | Name | Status |
|------|------|--------|
| 62-01 | Schema + Base Types | ✓ Complete |
| 62-02 | Follow-Up System | ✓ Complete |
| 62-03 | Engagement Workflow Engine | ✓ Complete |
| 62-04 | Pipeline Metrics Worker | ✓ Complete |
| 62-05 | Dashboard Core UI | In Progress |
| 62-06 | Needs Attention List | In Progress |
| 62-07 | Deal Flow Board | Pending |
| 62-08 | Automation Hub | Pending |

### Phase 58 Summary (2026-05-02)

| Plan | Name | Status |
|------|------|--------|
| 58-01 | Service Templates Schema + API | ✓ Complete |
| 58-02 | Settings UI + CRUD | ✓ Complete |
| 58-03 | Service Selector + Proposal Builder | ✓ Complete |
| 58-04 | Agreement Integration + Terms | ✓ Complete |

**Phase 58: COMPLETE** — Service catalog with 8 default templates, package/addon selection, proposal integration, agreement terms display.

### Phase 59 Summary (2026-05-02)

| Plan | Name | Status |
|------|------|--------|
| 59-01 | Schema + i18n Foundation | ✓ Complete |
| 59-02 | Multi-Signer Orchestration + Dokobit | ✓ Complete |
| 59-03 | Variable Resolution Service | ✓ Complete |
| 59-04 | Client Contract Page /c/:token | ✓ Complete |
| 59-05 | Template Editor with Drag-Drop | ✓ Complete |
| 59-06 | Pre-Signing Flow | ✓ Complete |
| 59-07 | PDF Generation with Inter Fonts | ✓ Complete |
| 59-08 | Success Page + Status Tracking | ✓ Complete |

**Phase 59: COMPLETE** — 3-click signing experience with multi-signer support, sequential/parallel signing modes, pre-signing flow, professional PDF generation with custom fonts, EN/LT localization, Dokobit Smart-ID/Mobile-ID integration.

## v8.0 Phases Summary (SaaS Hardening)

| Phase | Title | Status | Duration |
|-------|-------|--------|----------|
| 67 | Database Consolidation | ✓ Complete | 3 weeks |
| 68 | Integration Hardening | ✓ Complete | 2 weeks |
| 69 | Data Integrity & Performance | ✓ Complete | 2.5 weeks |
| 70 | Frontend Quality | Pending | 2 weeks |
| 71 | Security & Configuration | Pending | 2 weeks |
| 72 | SaaS Readiness | Pending | 1.5 weeks |
| 73 | Infrastructure Optimization | Ready | 2 weeks |

### v8.0 Dependencies

- Phase 67 (DB Consolidation) has no dependencies - start here
- Phase 68 depends on 67-03 (unified DB)
- Phase 69 depends on 68
- Phase 70 can run parallel with 69 (no DB deps)
- Phase 71 depends on 67 (migrations)
- Phase 72 depends on all prior phases

### v8.0 Source Documents

- `.planning/UNIFIED_REMEDIATION_PLAN.md` - Consolidated 20-agent review
- `.planning/phases/DB-CONSOLIDATION-PLAN.md` - Phase 67 details

## v7.1 Phases Summary

| Phase | Title | Status |
|-------|-------|--------|
| 63 | AI Search Optimization | Complete |
| 64 | Crawling Infrastructure | Complete |
| 65 | Job Queue Excellence | Complete |
| 66 | Platform Observability | Complete |

### Phase 64 Progress (2026-05-02)

| Plan | Name | Status |
|------|------|--------|
| 64-01 | Crawl Singleflight (Redis SET NX EX) | ✓ Complete |
| 64-02 | Delta Crawling Cascade (L0-L3) | ✓ Complete |
| 64-03 | Queue Lane Separation | Pending (Wave 2) |
| 64-04 | Metrics Dashboard | Pending (Wave 2) |

**Wave 1 Status:** COMPLETE

Key deliverables:

- Redis singleflight with SET NX EX atomic locks
- Delta cascade L0->L1->L2->L3 orchestration
- Conditional GET with ETag/Last-Modified support
- 17 tests across both modules

**Next:** Wave 2 (64-03, 64-04) - Queue lane separation and metrics dashboard

## v10.0 Phases Summary (On-Page SEO Mastery)

| Phase | Title | Status |
|-------|-------|--------|
| 92 | On-Page SEO Mastery | ✓ Complete |
| 93 | Coverage Dashboard UI | Planning |
| 94 | Design System v6 Migration | ✓ Complete |
| 95 | Unified Scraping Infrastructure | ✓ Complete |

**Milestone v10.0: COMPLETE** (2026-05-06)

### Phase 95 Unified Scraping Infrastructure (2026-05-07) — COMPLETE

**Status:** Complete
**Estimated Effort:** 5-6 weeks
**Cost Impact:** 96-98% reduction in scraping costs ($0.02/page → $0.0002/page)

| Plan | Focus | Duration | Status |
|------|-------|----------|--------|
| 95-01 | TieredFetcher + Domain Learning | 1.5 weeks | ✓ Complete |
| 95-02 | Multi-Level Caching (L1-L4) | 1 week | ✓ Complete |
| 95-03 | Queue & Rate Limiting | 1 week | ✓ Complete |
| 95-04 | DataForSEO Optimization | 0.5 week | ✓ Complete |
| 95-05 | Migration & Monitoring | 1 week | ✓ Complete |
| 95-10 | Consumer Integration Completion | 0.5 day | ✓ Complete |
| 95-11 | Health & Metrics | 0.5 day | ✓ Complete |
| 95-13 | E2E Testing & Migration Rollout | 0.5 day | ✓ Complete |
| 95-14 | Admin Security | 0.5 day | ✓ Complete |
| 95-16 | Metrics & Observability | 0.5 day | ✓ Complete |
| 95-17 | Consumer Integration Completion | 0.5 day | ✓ Complete |
| 95-18 | Resilience Hardening | 0.5 day | ✓ Complete |

**95-18 Key Deliverables:**

- CruxRateLimiter with Redis daily counters, 80%/95% warning/critical thresholds
- DatabaseCircuitBreaker wrapping PostgreSQL operations with health checks
- BandwidthTracker for Geonode (10GB/$0.77/GB) and Webshare (50GB/$0.10/GB)
- Circuit breaker integration in L3Cache, DomainLearningService, DfsCostTracker
- Bandwidth tracking integration in GeonodeFetcher and WebshareFetcher
- Prometheus metrics for CrUX quota, DB circuit state, proxy bandwidth
- 4 commits, TypeScript compilation passing

**95-17 Key Deliverables:**

- DfsCostTracker wired into ScrapingService with fire-and-forget cost recording
- ProspectAnalysisService cost tracking for competitors_domain and domain_intersection APIs
- SerpAnalyzer SERP API cost tracking with domain='serp-api' distinction
- SerpContentAnalyzer clientId/workspaceId propagation through scrapeOptions
- serpApi migration flag added to feature flags system
- 5 commits, all TypeScript compilation passing

**95-16 Key Deliverables:**

- MetricsCollector with Prometheus histogram/counter/gauge support
- Standard latency buckets (0.01s to 60s) with percentile calculation
- Pino structured JSON logging with AsyncLocalStorage correlation IDs
- 8 component loggers (fetcher, cache, queue, cost, domain, alert, migration, circuit)
- Request context propagation for full request tracing
- 25 unit tests for MetricsCollector
- Console.log replacement in 7 modules

**95-13 Key Deliverables:**

- E2E test suite for 7-tier escalation (direct → webshare → geonode → camoufox → dfs_basic → dfs_js → dfs_browser)
- Load testing infrastructure with RPS control, latency percentiles (p50/p95/p99), cost tracking
- CacheWarmer service: batch warming, audit pre-warming, sitemap warming, intelligent domain warming
- MigrationRollout state machine: legacy → shadow → canary → rollout → migrated with criteria-based advancement
- DomainFeedbackService for check-based learning (JS failures, quality issues, content extraction)
- Admin dashboard endpoints for migration control, cache warming, feedback management, system operations
- 7 commits, 3769 lines of new code

**95-10 Key Deliverables:**

- SerpContentAnalyzer wired through MigrationRouter with batch transformation
- CompetitorSpyService page fetching routed through MigrationRouter
- TaskRouter CRAWL source integrated with ScrapingService
- Volume Refresh processor integrated with DfsCostTracker for cost attribution
- Crawl Workflow migrated to ScrapingService with automatic legacy fallback
- 2 new migration flags: volumeRefresh, crawlWorkflow (all default to legacy)
- 6 commits, all TypeScript compilation passing

**95-05 Key Deliverables:**

- ScrapingService unified facade: scrape(), scrapeBatch(), warmCache(), getMetrics(), getCostReport()
- 5-state feature flag system: legacy → shadow → canary → rollout → migrated
- Shadow mode runner for parallel execution comparison (always returns legacy result)
- Comparators for single scrape, parsed data, prospect, SERP, and batch results
- MigrationRouter for request routing based on feature flag states
- 50+ dashboard type definitions for cost, performance, cache, and migration metrics
- Environment-based flag loading with runtime override support for testing
- 39 integration tests passing

**95-02 Key Deliverables:**

- 4-tier caching: L1 Memory LRU (100MB), L2 Redis (2GB), L3 PostgreSQL, L4 R2 Archive
- URL normalization stripping 20+ tracking parameters (utm_*, fbclid, gclid, etc.)
- Content-type-aware TTL strategy with level multipliers (L1=10%, L2=50%, L3=100%, L4=300%)
- Content deduplication via SHA-256 content hashing
- Cascade invalidation (L4 → L3 → L2 → L1) with stale-while-revalidate
- Prometheus-compatible metrics with 13 metric definitions
- TieredFetcher integration with cache-first lookup
- 355 tests passing across 10 test files

**95-03 Key Deliverables:**

- Redis sliding window rate limiting (2 req/sec per domain) with Lua scripts
- Domain normalization groups subdomains (www.example.com → example.com)
- Adaptive backoff: doubles on 429/503 (max 16x), halves on success
- Distributed semaphore (200 concurrent) using Redis sorted sets
- Three BullMQ queues: priority (50 concurrent), standard (100), background (50)
- Priority assignment based on source (UI/API/scheduler) and feature context
- Queue orchestrator pauses background when priority >50% utilized
- Prometheus-compatible metrics with queue depth, processing rate, blocked domains
- 99 unit tests passing

**95-01 Key Deliverables:**

- 7-tier escalation: direct → webshare → geonode → camoufox → dfs_basic → dfs_js → dfs_browser
- Per-domain learning with Redis L1 cache + PostgreSQL persistence
- ContentQualityAssessor: SPA detection, bot detection, technology fingerprinting
- CamoufoxPool: stealth browser management with fingerprint spoofing
- Migration adapters for HybridCrawler and UniversalCrawler
- 14 commits, 40 core tests passing

**Architecture:**

- Tiered proxy escalation: Direct → Webshare → Geonode ($0.77/GB) → DataForSEO
- Per-domain learning: Remember which tier works for each domain
- Multi-level caching: L1 (memory) → L2 (Redis) → L3 (PostgreSQL) → L4 (R2)
- Unified ScrapingService consumed by all 6 features (Site Audits, Hybrid Crawler, Prospect Analysis, SERP Content, Competitor Spy, Content Briefs)

**Source Documents:**

- `.planning/phases/95-scraping-infrastructure/PHASE-95-CONTEXT.md` — Phase context
- `.planning/phases/95-scraping-infrastructure/95-01-TIERED-FETCHER-PLAN.md` — TieredFetcher + Domain Learning
- `.planning/phases/95-scraping-infrastructure/95-02-CACHING-PLAN.md` — Multi-Level Caching
- `.planning/phases/95-scraping-infrastructure/95-03-QUEUE-RATE-LIMITING-PLAN.md` — Queue & Rate Limiting
- `.planning/phases/95-scraping-infrastructure/95-04-DATAFORSEO-OPTIMIZATION-PLAN.md` — DataForSEO Optimization
- `.planning/phases/95-scraping-infrastructure/95-05-MIGRATION-MONITORING-PLAN.md` — Migration & Monitoring
