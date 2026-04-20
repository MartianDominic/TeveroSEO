---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Agency Intelligence
status: complete
last_updated: "2026-04-20T22:45:00Z"
last_activity: 2026-04-20
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 55
  completed_plans: 55
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Transform the platform from a data viewer into an actionable intelligence tool. Automated PDF reports with white-label branding. Daily rank tracking with drop alerts. AI-powered insights. Multi-tenant webhook infrastructure. Agency command center dashboard.

**Current focus:** v3.0 Milestone — Phase 16 (Report Scheduling & White-Label)

## Current Position

Phase: 25 (team-intelligence)
Plan: 4 of 4
Status: Complete
Last activity: 2026-04-20

## Completed Milestones

### v1.0 Platform Unification (Phases 1-7)
All 7 phases complete. AI-Writer backend cleanup, CF bindings removal, BullMQ/Redis, unified Docker, CI/CD, Clerk auth, AppShell integration.

### v2.0 Unified Product (Phases 8-14)
All 7 phases complete. Next.js unified shell, shared UI package, open-seo frontend absorption, Clerk auth unified, per-client credentials, analytics data layer, agency dashboard.

## v3.0 Phases

| Phase | Title | Est. Effort | Status |
|-------|-------|-------------|--------|
| 15 | Report Generation Engine | 2 weeks | ✓ Complete (2026-04-19) |
| 16 | Report Scheduling & White-Label | 2 weeks | ✓ Complete (2026-04-19) |
| 17 | Rank Tracking History (Extends Existing) | 1.5 weeks | ✓ Complete (2026-04-19) |
| 18 | Monitoring & Alerts | 2 weeks | ✓ Complete (2026-04-19) |
| 18.5 | Webhook Infrastructure | 3 weeks | ✓ Complete (2026-04-19) |
| 19 | AI Insights — Report Summaries | 2 weeks | ○ Skipped |
| 20 | AI Content Briefs | 2 weeks | ○ Skipped |
| 21 | Agency Command Center | 3 weeks | ✓ Complete (2026-04-19) |
| 22 | Goal-Based Metrics System | 3 days | ✓ Complete (2026-04-20) |
| 23 | Performance & Scale | 2 days | ✓ Complete (2026-04-20) |
| 24 | Power User Features | 2 days | ✓ Complete (2026-04-20) |
| 25 | Team & Intelligence | 2 days | ✓ Complete (2026-04-20) |

## Sub-project Status

| Sub-project | Status | Notes |
|-------------|--------|-------|
| AI-Writer backend (FastAPI) | ✅ Stable | Report endpoints to be added |
| open-seo backend (Node.js/Nitro) | ✅ Stable | BullMQ workers to be added |
| apps/web (Next.js) | ✅ Stable | Report UI, webhook config, command center to be added |
| packages/ui (shared components) | ✅ Stable | Report components to be added |

## Decisions

- **25-04:** Priority matrix uses 9-point scale (high impact + low effort = 9, best opportunity)
- **25-04:** CTR gap threshold of 2% avoids noise from minor variations
- **25-04:** Ranking gap detection targets positions 11-20 (almost page 1)
- **25-03:** Linear regression for trend prediction with R-squared confidence scoring
- **25-02:** Pattern thresholds: 20% change, 3+ clients, 30% ratio, 70% confidence
- **25-02:** Cache TTL 1 hour for patterns (slow-changing data)
- **25-02:** Simple button accordion instead of Collapsible (not in @tevero/ui)
- **25-03:** 7+ data points required for meaningful projections (otherwise low confidence)
- **25-03:** Traffic decline alert when >10% decline predicted over 2 weeks
- **25-03:** Goal at-risk when declining trend or >90 days to target
- **25-03:** Workspace predictions cached 5 minutes in Redis
- **22-01:** 9 default goal templates covering keywords (top 10/3/1), clicks, CTR, growth, impressions, custom
- **22-01:** hasDenominator flag enables "X out of Y" goals (e.g., 7/10 keywords in Top 10)
- **22-01:** Seed script in migrate-entry.ts for automatic template seeding on deploy
- **22-01:** priorityScore column enables sorting clients by goal urgency in dashboard
- **22-02:** Computation methods as registry pattern for extensibility
- **22-02:** Daily snapshots via upsert to prevent duplicates
- **22-02:** Priority score uses tiered formula (alerts > goals > traffic > neglect)
- **21-05:** Default views included as fallback when API fails for graceful degradation
- **21-05:** CSV export with column selection dialog for flexibility
- **21-05:** Team workload hidden for solo operators (capacity tracking not relevant)
- **21-05:** Upcoming items sorted by scheduled time, limited to 5 visible with overflow count
- **21-04:** WebSocket server runs on port 3002 separate from main HTTP server for cleaner architecture
- **21-04:** Singleton Socket.IO client with reference counting prevents duplicate connections
- **21-04:** TouchSensor uses 250ms delay + 5px tolerance to prevent accidental drags while scrolling
- **21-04:** ActivityFeed in right sidebar, QuickStatsCards at top for optimal workflow
- **21-02:** Portfolio health summary displays 4 KPI cards: clients, wins, traffic change, keyword positions
- **21-02:** Position distribution bar uses 3-color gradient: emerald-500 (#1), emerald-400 (top 3), emerald-300 (top 10)
- **21-02:** Health score badge uses 4 color tiers: 80+ emerald (Healthy), 60+ yellow (Monitor), 40+ orange (At Risk), <40 red (Critical)
- **21-02:** Dashboard fetches data in parallel via Promise.all for optimal performance
- **21-01:** Dashboard metrics computed every 5 minutes via BullMQ worker with 5-min lock duration
- **21-01:** Health score weights: traffic 30%, rankings 25%, technical 20%, backlinks 15%, content 10%
- **21-01:** Critical alert penalty: -16 per alert in technical + -5 global to push 2 alerts below 60
- **15-02:** Content hash uses 16-char hex SHA256 prefix for cache deduplication
- **15-02:** Report queue uses exponential backoff (10s, 20s, 40s) matching analytics queue pattern
- **15-02:** Unique index on (clientId, contentHash) prevents duplicate report generation
- **15-03:** lockDuration 90_000 (60s render + 30s buffer) for PDF generation jobs
- **15-03:** concurrency 2 to limit concurrent Puppeteer renders
- **15-03:** Debian-slim base for Puppeteer (not Alpine) to avoid font rendering issues
- **15-03:** shm_size 1gb for Chromium shared memory
- **16-02:** Resend API for report email delivery (not Loops.so which handles auth)
- **16-02:** 10MB attachment threshold with download link fallback for larger PDFs
- **16-02:** Email failures non-blocking: logged but don't fail report job
- **16-01:** 5-minute repeatable job interval for schedule checking
- **16-01:** Minimum schedule frequency: daily (T-16-05 DoS mitigation)
- **16-01:** Max 100 schedules processed per check run
- **16-03:** Client branding stored in branding_data Docker volume at /data/branding
- **16-03:** Logo max 2MB, PNG/JPG/SVG only, one logo per client (replaces old)
- **16-03:** Footer HTML sanitized: scripts and event handlers stripped
- **16-04:** Local toast pattern matching existing settings page (no sonner dependency)
- **16-04:** User-friendly cron templates instead of raw cron input
- **16-04:** hexToRgb conversion for Puppeteer PDF color compatibility
- **17-01:** Text ID for keyword_rankings (UUID v7 for time-sortable IDs)
- **17-01:** Nullable tracking_enabled for backward compatibility with existing rows
- **17-02:** 100ms rate limit delay between DataForSEO API calls (T-17-03 DoS mitigation)
- **17-02:** 5-minute lockDuration for ranking worker batch processing
- **17-03:** Inverted Y-axis on charts (position 1 at top) for intuitive ranking visualization
- **17-03:** Router type cast pattern for dynamic routes matching codebase convention
- **23-01:** VirtualizedTable uses generic column definitions (not TanStack Table) for simpler integration
- **23-01:** LazySparkline wraps SparklineChart with IntersectionObserver lazy loading
- **23-01:** Sparkline API proxies to analytics backend, extracts time-series from existing endpoint
- **23-01:** Virtualization and sparklines are opt-in via props to preserve backward compatibility
- **23-02:** Server action proxies to backend API rather than direct DB access (BFF pattern)
- **23-02:** FilterBar uses Slider for goal attainment range (dual-thumb)
- **23-02:** Pagination mode is opt-in via usePagination prop for backward compatibility
- **23-02:** Cursor encoding uses base64url for URL-safe transmission
- **23-03:** Redis lazyConnect enabled for serverless-friendly initialization
- **23-03:** Tag-based invalidation allows clearing related caches together
- **23-03:** Cache TTL 60s for paginated data (short for data freshness)
- **23-03:** Optimistic updates use QueryClient pattern (not global singleton)
- **23-04:** Portfolio aggregates computed per-workspace from client_dashboard_metrics
- **23-04:** PortfolioHealthSummary supports both aggregates hook and legacy summary prop
- **24-04:** Print-to-PDF approach via browser print dialog (no jspdf dependency)
- **24-04:** BOM prefix for Excel UTF-8 CSV compatibility
- **24-04:** Blob URL for secure PDF window (avoids unsafe DOM manipulation)

## Blockers/Concerns

None currently.

## Next Up

v3.0 milestone phases 15-18, 18.5, 21-25 complete. AI phases 19-20 skipped per user request.
