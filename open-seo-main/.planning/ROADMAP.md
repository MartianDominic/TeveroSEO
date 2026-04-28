# Roadmap: Unified Platform Infrastructure

## Overview

A brownfield runtime migration: detach open-seo-main from Cloudflare proprietary bindings (D1, KV, Workflows, vite-plugin) and run it as a self-hosted Node.js service alongside the existing AI-Writer platform on a single VPS — fully automated via GitHub Actions CI/CD, backed by shared PostgreSQL and Redis.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: CF Bindings Removal + Schema Migration** - Strip all Cloudflare-specific code; migrate Drizzle schema from SQLite to PostgreSQL; verify Node.js build compiles clean
- [x] **Phase 2: BullMQ + Redis KV Replacement** - Replace env.KV with ioredis and env.SITE_AUDIT_WORKFLOW with BullMQ; audit queue runs reliably in Node.js
- [x] **Phase 3: Docker Compose + Infrastructure Assembly** - Package the app in a production Dockerfile; wire all 7 services in docker-compose.vps.yml; verify manual VPS deployment
- [ ] **Phase 4: CI/CD + Deployment Pipeline** - GitHub Actions auto-deploys both platforms on push to main with zero manual intervention
- [x] **Phase 27: Website Scraping** - Scrape prospect websites, extract business info with AI (products, brands, services)
- [x] **Phase 28: Keyword Gap Analysis** - Identify keywords competitors rank for that prospect doesn't
- [x] **Phase 29: AI Opportunity Discovery** - Generate keyword opportunities from scraped content for zero-ranking sites
- [x] **Phase 30: Interactive Proposals** - Scrollytelling proposals, Lithuanian AI generation, Smart-ID signing, Stripe payments
- [x] **Phase 30.5: Prospect Pipeline Automation** - CSV bulk import, pipeline stage tracking, automation rules, bulk actions UI
- [x] **Phase 31: Site Connection & Platform Detection** - Unified site connection model with platform auto-detection for WordPress, Shopify, Wix, Squarespace, Webflow, custom sites
- [x] **Phase 37: Brand Voice Management** - Voice profiles with 12 dimensions, AI voice learning, industry templates, protection rules, compliance scoring

## Phase Details

### Phase 1: CF Bindings Removal + Schema Migration
**Goal**: The open-seo-main codebase compiles and runs as a Node.js server with no Cloudflare runtime dependencies
**Depends on**: Nothing (first phase)
**Requirements**: CF-01, CF-02, CF-03, CF-04, CF-05, CF-06, DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, BUILD-01, BUILD-02, BUILD-03
**Success Criteria** (what must be TRUE):
  1. `grep -r "cloudflare:workers" src/` returns zero matches
  2. `pnpm run build` completes with no TypeScript or Rollup errors and produces `.output/server/index.mjs`
  3. `node .output/server/index.mjs` starts an HTTP server and all routes (auth, server functions, API) return correct responses
  4. `drizzle-kit migrate` applies all PG-dialect migrations to a fresh PostgreSQL instance without errors
  5. `runtime-env.ts` throws a clear startup error when a required environment variable is missing
**Plans**: TBD

### Phase 2: BullMQ + Redis KV Replacement
**Goal**: Site audit jobs are queued and executed via BullMQ on Redis; audit crawl progress is stored in Redis KV — no Cloudflare runtime references remain in the audit path
**Depends on**: Phase 1
**Requirements**: KV-01, KV-02, KV-03, BQ-01, BQ-02, BQ-03, BQ-04, BQ-05, BQ-06, BQ-07
**Success Criteria** (what must be TRUE):
  1. Triggering a site audit enqueues a BullMQ job and the worker picks it up and executes all steps to completion
  2. Audit crawl progress can be read and written via ioredis with correct TTL semantics (30-min expiry, `audit-progress:` prefix)
  3. Redis connection failure at startup prints a clear error and exits the process (not a silent hang)
  4. A failed audit job that exhausts retries appears in the `failed-audits` dead-letter queue
  5. A Lighthouse audit running concurrently does not block the main event loop (sandboxed processor, `lockDuration` >= 120 000 ms)
**Plans**: TBD

### Phase 3: Docker Compose + Infrastructure Assembly
**Goal**: All 7 services (open-seo, open-seo-worker, ai-writer-frontend, ai-writer-backend, postgres, redis, nginx) start from a single `docker compose up` on the VPS and serve both domains over HTTPS
**Depends on**: Phase 2
**Requirements**: DOCKER-01, DOCKER-02, DOCKER-03, DOCKER-04, DOCKER-05, DOCKER-06, DOCKER-07, OPS-01, OPS-02
**Success Criteria** (what must be TRUE):
  1. `docker compose -f docker-compose.vps.yml up -d` starts all 7 services with all healthchecks passing
  2. `GET https://app.openseo.so/healthz` returns `{ "status": "ok" }` after a fresh deployment
  3. Both `app.openseo.so` and the AI-Writer domain serve HTTPS responses with valid SSL certificates via Nginx
  4. `open-seo` and `open-seo-worker` services refuse to start until postgres and redis healthchecks pass (`depends_on: service_healthy`)
  5. Structured JSON request logs appear in `docker compose logs open-seo` for each inbound HTTP request
**Plans**: TBD
**UI hint**: yes

### Phase 4: CI/CD + Deployment Pipeline
**Goal**: A push to `main` automatically builds, migrates, and deploys the updated open-seo containers on the VPS — no SSH or manual steps required
**Depends on**: Phase 3
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05
**Success Criteria** (what must be TRUE):
  1. Pushing a commit to `main` triggers the GitHub Actions workflow and the new version is live on the VPS within the workflow run
  2. Database migrations run in a separate `docker compose run --rm` step that completes before the new container receives traffic
  3. The deploy workflow uses pre-generated `KNOWN_HOSTS` and never sets `StrictHostKeyChecking=no`
  4. SSH access to the VPS uses a dedicated `deploy` user (not root) with an ed25519 key stored as a GitHub Actions secret
**Plans**: TBD

### Phase 27: Website Scraping
**Goal**: Scrape prospect websites and extract business information using AI
**Depends on**: Phase 26 (Prospect Data Model)
**Success Criteria** (what must be TRUE):
  1. DataForSEO raw_html endpoint fetches rendered HTML for prospect domains
  2. Multi-page scraper visits homepage + key business pages (products, services, about)
  3. AI business extractor (Claude) identifies products, brands, services, location, target market
  4. Scraped content and business info stored in analysis record
  5. Manual business info form allows user override
**Plans**: 27-01, 27-02, 27-03
**Status**: Complete

### Phase 28: Keyword Gap Analysis
**Goal**: Identify keywords competitors rank for that the prospect doesn't
**Depends on**: Phase 27
**Success Criteria** (what must be TRUE):
  1. Competitors auto-discovered via DataForSEO
  2. Domain intersection API returns gap keywords
  3. Top 100 gap keywords stored with volume, CPC, difficulty
  4. Gap analysis UI displays sortable keyword table
**Plans**: 28-01

### Phase 29: AI Opportunity Discovery
**Goal**: Generate keyword opportunities from scraped business content for zero-ranking sites
**Depends on**: Phase 27, Phase 28
**Success Criteria** (what must be TRUE):
  1. AI generates keyword ideas from products, brands, services
  2. DataForSEO validates keywords (filters zero-volume)
  3. Opportunity scoring ranks keywords by potential
  4. UI shows categorized opportunities
**Plans**: 29-01

### Phase 30: Interactive Proposals
**Goal**: One link → signed paying client with zero manual work
**Depends on**: Phase 27, Phase 28, Phase 29
**Success Criteria** (what must be TRUE):
  1. Proposal schema stores content, pricing, status state machine
  2. Gemini 3.1 Pro generates Lithuanian proposal text (segment-by-segment)
  3. Scrollytelling proposal page with ROI calculator
  4. View tracking and engagement signals
  5. Dokobit Smart-ID/Mobile-ID signing integration
  6. Stripe payment checkout
  7. Auto-onboarding creates client, project, sends GSC invite
  8. Pipeline view with automated follow-ups
**Plans**: 30-01, 30-02, 30-03, 30-04, 30-05, 30-06, 30-07, 30-08
**UI hint**: yes

### Phase 30.5: Prospect Pipeline Automation
**Goal**: Enable agencies managing 500+ prospects to automate their sales pipeline with CSV bulk import, pipeline stage tracking, automation rules, and bulk UI actions
**Depends on**: Phase 30
**Requirements**: 30.5-01-a, 30.5-01-b, 30.5-01-c, 30.5-04-a, 30.5-04-b, 30.5-05-a, 30.5-05-b, 30.5-05-c
**Success Criteria** (what must be TRUE):
  1. CSV import creates prospects with validation and error reporting
  2. Prospects have pipeline_stage column with 8 stages (new -> converted)
  3. Analysis completion auto-transitions prospects through pipeline stages
  4. High-scoring prospects (>=70) auto-qualify
  5. Bulk actions UI supports analyze, archive, and CSV export
  6. Pipeline distribution chart visualizes prospects by stage
**Plans**: 3 plans
Plans:
- [ ] 30.5-01-PLAN.md — CSV import with papaparse, validation, preview UI
- [ ] 30.5-04-PLAN.md — Pipeline stages schema, automation rules engine
- [ ] 30.5-05-PLAN.md — Bulk actions UI, pipeline chart (depends on 30.5-04)
**UI hint**: yes

### Phase 31: Site Connection & Platform Detection
**Goal**: Unified site connection model with platform auto-detection. Connects to WordPress, Shopify, Wix, Squarespace, Webflow, and custom sites for content management.
**Depends on**: Phase 30 (client model)
**Requirements**: CONN-01, CONN-02, CONN-03, CONN-04, CONN-05, CONN-06
**Success Criteria** (what must be TRUE):
  1. site_connections table exists with encrypted credentials column (AES-256-GCM)
  2. Platform detection correctly identifies WordPress, Shopify, Wix, Squarespace, Webflow
  3. WordPress adapter connects via REST API with App Password auth
  4. Shopify adapter connects via GraphQL with OAuth token
  5. Connection wizard auto-detects platform and presents appropriate credential form
  6. Write permission verified before connection marked active
**Plans**: 4 plans
Plans:
- [ ] 31-01-PLAN.md — site_connections schema + encryption utilities
- [ ] 31-02-PLAN.md — Platform detection service (multi-probe fingerprinting)
- [ ] 31-03-PLAN.md — Platform adapters (WordPress REST, Shopify GraphQL)
- [ ] 31-04-PLAN.md — Connection wizard UI + write verification
**UI hint**: yes

### Phase 37: Brand Voice Management
**Goal**: Full brand voice system with three modes (preservation, application, best_practices), voice learning from existing content via AI analysis, and agency-grade UI
**Depends on**: Phase 31 (client model), Phase 27 (scraper)
**Success Criteria** (what must be TRUE):
  1. voice_profiles, voice_analysis, content_protection_rules tables exist with all 12 voice dimensions
  2. VoiceAnalyzer extracts voice dimensions from 5-10 client pages using Claude AI
  3. 8 industry templates provide sensible voice defaults (Healthcare, Legal, E-commerce, B2B SaaS, Financial, Real Estate, Home Services, Technology)
  4. Protection rules support page/section/pattern types with expiration dates and CSV bulk import
  5. VoiceComplianceService scores generated content across 5 dimensions with violation line numbers
  6. VoiceConstraintBuilder injects voice profile into AI-Writer prompts by mode
  7. Voice settings UI at /clients/[clientId]/voice with tabbed interface, preview suite, and guided wizard
**Plans**: 5 plans
Plans:
- [ ] 37-01-PLAN.md — Database schema (voice_profiles, voice_analysis, content_protection_rules)
- [ ] 37-02-PLAN.md — Voice analysis service with BullMQ background jobs
- [ ] 37-03-PLAN.md — Voice profile CRUD, industry templates, protection rules service
- [ ] 37-04-PLAN.md — Voice compliance scoring and AI-Writer integration
- [ ] 37-05-PLAN.md — Agency-grade settings UI with tabbed interface and preview suite
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CF Bindings Removal + Schema Migration | 0/TBD | Not started | - |
| 2. BullMQ + Redis KV Replacement | 0/TBD | Not started | - |
| 3. Docker Compose + Infrastructure Assembly | 0/TBD | Not started | - |
| 4. CI/CD + Deployment Pipeline | 0/TBD | Not started | - |
| 27. Website Scraping | 3/3 | Complete | 2026-04-21 |
| 28. Keyword Gap Analysis | 0/1 | Not started | - |
| 29. AI Opportunity Discovery | 0/1 | Not started | - |
| 30. Interactive Proposals | 0/8 | Not started | - |
| 30.5. Prospect Pipeline Automation | 0/3 | Not started | - |
| 31. Site Connection & Platform Detection | 0/4 | Not started | - |
| 37. Brand Voice Management | 5/5 | Complete | 2026-04-23 |
