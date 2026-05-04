# Keyword Intelligence System Analysis

> **Purpose**: Map what exists vs what's missing for the AI-powered keyword analysis system.
> **Method**: 10 Opus subagents exploring different focus areas.
> **Output**: This single document with findings from all agents.

---

## Vision: The Complete Product Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     KEYWORD INTELLIGENCE SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE A: INPUT EXCELLENCE                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Prospect conversation → AI extracts:                                │   │
│  │   • Priority categories (e.g., "šampūnai dažytiems plaukams first") │   │
│  │   • Geographic focus (e.g., "Vilnius, Kaunas only")                 │   │
│  │   • Service focus (e.g., "plaukų dažymas, kirpimas")                │   │
│  │   • Funnel preference (BOFU only, MOFU+BOFU, all)                   │   │
│  │   • Site URL (if exists) or "no site yet"                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE B: AI PLANNING                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ AI creates analysis plan:                                           │   │
│  │   • Scrape site structure (if exists)                               │   │
│  │   • Identify categories from site                                    │   │
│  │   • Map priority categories to site structure                       │   │
│  │   • Plan keyword research queries                                    │   │
│  │   • Set filtering criteria                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE C: USER CONFIRMS PLAN                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ User reviews and adjusts:                                           │   │
│  │   • "Yes, but add 'natūrali kosmetika' category"                    │   │
│  │   • "Skip 'aksesuarai' for now"                                     │   │
│  │   • "Focus on search volume > 100"                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE D: AI EXECUTES ANALYSIS                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Scrape site via sitemap                                          │   │
│  │ 2. Extract categories, products, content                           │   │
│  │ 3. Fetch keywords from DataForSEO                                  │   │
│  │ 4. Classify intent: BOFU / MOFU / TOFU                              │   │
│  │ 5. Classify geography: city-specific vs generic                     │   │
│  │ 6. Match keywords → site pages (semantic)                           │   │
│  │ 7. Discover "side keywords" (fitdaily.eu example)                   │   │
│  │    "fitline produktai" → "papildai nuo sąnarių skausmo"             │   │
│  │ 8. Score and rank all keywords                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE E: FILTERING & OUTPUT                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Filter to top 100-200 keywords (or specified N)                   │   │
│  │ • Apply user criteria (BOFU only, cities, etc.)                     │   │
│  │ • Generate proposal with selected keywords                          │   │
│  │ • Export excluded keywords for reference                            │   │
│  │ • Save analysis for future refinement                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE F: CONVERSATION MEMORY                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Remember previous analyses                                        │   │
│  │ • "Last time you wanted BOFU only, same this time?"                 │   │
│  │ • Refine based on feedback                                          │   │
│  │ • Chat interface like ChatGPT/Claude                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Use Cases

### Use Case 1: Client with Site (plaukupasaka.lt)
- Has existing site with categories
- AI scrapes, maps keywords to existing structure
- Priority categories weighted higher
- Output: Proposal with top 150 keywords + export of 2850 excluded

### Use Case 2: Client without Site (new business)
- No site to scrape
- AI uses competitor analysis + user priorities
- More reliance on DataForSEO competitor gaps
- Output: Keyword strategy for new site build

### Use Case 3: Side Keyword Discovery (fitdaily.eu)
- Main keyword: "fitline produktai"
- Side keywords discovered: "papildai nuo sąnarių skausmo", "energijos papildai", etc.
- AI understands semantic relationships
- Expands beyond obvious keywords

### Use Case 4: Intent-Filtered Analysis
- Client: "We only want BOFU keywords for Vilnius dental services"
- AI filters: intent=BOFU, geo=Vilnius, category=dental
- Output: 50 high-intent local keywords

---

## Existing Infrastructure (To Be Mapped)

### AI-Writer (FastAPI Backend)
- `/backend/services/scraping/` - Scraping pipeline
- `/backend/services/intelligence/` - AI agents
- `/backend/lib/graphrag/` - Embedding service (Jina v3)
- `/backend/api/intelligence.py` - Intelligence endpoints

### open-seo-main (TanStack Start)
- `/src/server/features/` - Domain services
- `/src/db/` - Drizzle schemas
- BullMQ workers for async processing

### Shared Resources
- PostgreSQL (alwrity + open_seo databases)
- Redis (caching, job queues)
- DataForSEO API
- Jina Embeddings API

---

## Agent Focus Areas

Each agent will explore one aspect and write findings below:

1. **KEYWORD-CORE**: Keyword analysis capabilities
2. **SCRAPING**: Site scraping pipeline
3. **INTENT**: BOFU/MOFU/TOFU + geo classification
4. **CHAT-UI**: Conversation interface + memory
5. **PROPOSALS**: Proposal generation from keywords
6. **ONBOARDING**: Client/prospect data collection
7. **DATAFORSEO**: External data integrations
8. **TAXONOMY**: Category/priority systems
9. **FILTERING**: Top-N filtering + export
10. **EMBEDDINGS**: Semantic matching infrastructure

---

## AGENT FINDINGS

### 1. KEYWORD-CORE: Keyword Analysis Capabilities
<!-- Agent 1 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/server/features/keywords/` - Main keyword intelligence module (13 subdirectories)
- `open-seo-main/src/server/features/keywords/services/KeywordIntelligenceService.ts` - Main orchestration service
- `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` - Multi-factor scoring
- `open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts` - DataForSEO enrichment
- `open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts` - Quick win opportunities
- `open-seo-main/src/server/features/keywords/services/CsvImportService.ts` - CSV import with format detection
- `open-seo-main/src/server/features/keywords/services/KeywordInputService.ts` - Unified entry point orchestrator
- `open-seo-main/src/server/features/keywords/classification/ClassificationPipeline.ts` - Two-pass AI classification
- `open-seo-main/src/server/features/keywords/intent/AdaptiveIntentRouter.ts` - Intent detection routing
- `open-seo-main/src/server/features/keywords/universe/KeywordUniverseBuilder.ts` - Seed expansion
- `open-seo-main/src/db/prospect-keyword-schema.ts` - Main keyword storage schema
- `open-seo-main/src/db/app.schema.ts` - savedKeywords + keywordMetrics tables
- `open-seo-main/src/db/ranking-schema.ts` - Daily ranking snapshots
- `open-seo-main/src/serverFunctions/keywords.ts` - TanStack server functions
- `open-seo-main/src/routes/api/seo/keywords.ts` - REST API endpoints
- `open-seo-main/src/routes/api/seo/keyword-rankings.ts` - Ranking history API
- `open-seo-main/src/routes/api/seo/keyword-mapping.ts` - Keyword-to-page mapping
- `apps/web/src/actions/seo/keywords.ts` - Next.js server actions
- `AI-Writer/backend/services/ai_service_manager.py` - Keyword analysis prompts

**What Exists**:

**Database Schemas:**
- `prospect_keywords` table: keyword, normalizedKeyword, source (5 types: dataforseo, manual, csv_upload, competitor_gap, quick_check), searchVolume, keywordDifficulty, cpc, competition, currentPosition, currentUrl, enrichmentStatus, tier (must_do, should_do, nice_to_have, ignore), quickWinType, compositeScore, relevanceScore, mappedUrl, mappedAction, mappingConfidence
- `saved_keywords` table: projectId, keyword, locationCode, languageCode, trackingEnabled, dropAlertThreshold
- `keyword_metrics` table: searchVolume, cpc, competition, keywordDifficulty, intent, monthlySearches (JSON)
- `keyword_rankings` table: Daily position snapshots with serpFeatures JSON
- `keyword_page_mapping` table: keyword-to-URL mappings with action (optimize/create)

**Core Services:**
- `KeywordIntelligenceService`: Main orchestrator combining ContentHasher, EmbeddingService, LithuanianNormalizer, PageValidator, TaskRouter, ClassificationSingleflight, ResilientClassifier
- `KeywordIntelligenceService.analyzeKeywords(clientId, keywords, categories)`: Batch keyword analysis
- `KeywordIntelligenceService.classifyKeyword(keyword, categories)`: Single keyword classification
- `KeywordIntelligenceService.detectGaps(keywords, existingCategories)`: Category gap detection with clustering
- `KeywordIntelligenceService.extractProductMatches(keyword, products)`: Semantic product matching
- `KeywordIntelligenceService.analyzeBatch(input)`: Full batch analysis with gap detection

**Prioritization (PrioritizationService):**
- 5-factor scoring: volume (0.15), competition (0.10), relevance (0.25), focus (0.35), position (0.15)
- Tier assignment: must_do >= 0.75, should_do >= 0.50, nice_to_have >= 0.25, ignore < 0.25
- Quick win multipliers: striking_distance (1.3x), low_hanging (1.2x), fresh_opportunity (1.15x)
- `computeCompositeScore()`, `assignTier()`, `prioritizeKeywords(prospectId)`, `bulkUpdateTier()`

**Classification Pipeline (Two-Pass):**
- Pass 1: Grok 4.1 (primary, $0.20/1M tokens) or Gemini (fallback) - resolves ~80% at >= 0.85 confidence
- Pass 2: Claude Sonnet for remaining uncertain keywords
- Circuit breakers for graceful degradation
- Cost tracking per workspace integrated

**Intent Routing (AdaptiveIntentRouter):**
- `quick_check`: < 10 keywords, no expansion, completes < 30s
- `full_analysis`: > 10 keywords OR seed expansion needed
- Negative association extraction for better filtering

**Enrichment (KeywordEnrichmentService):**
- DataForSEO API integration with batch processing (up to 1000/call)
- 7-day Redis caching (CACHE_TTL_SECONDS = 604800)
- Skip logic for CSV imports with existing metrics
- Cost tracking: $0.005/keyword (COST_PER_KEYWORD_CENTS = 0.5)

**Keyword Input (5 Entry Points):**
- quick_check, csv_import, full_discovery, gap_analysis, competitor_spy, manual
- Unified KeywordInputService orchestrates normalization, deduplication, enrichment

**CSV Import:**
- Auto-detection of Ahrefs, SEMrush, Moz formats
- ColumnDetector for intelligent field mapping
- BOM handling, line ending normalization
- Preview mode before import

**Universe Expansion:**
- KeywordUniverseBuilder expands seeds into 150-300 candidates
- Uses DataForSEO: autocomplete, keywordIdeas, relatedKeywords
- Deduplication with normalization (diacritics removal, lowercase, space collapse)

**Clustering (Basic):**
- Simple prefix-based clustering (3+ char common prefix) in KeywordIntelligenceService.clusterKeywords()
- Used for gap detection grouping

**Lithuanian Support:**
- LithuanianNormalizer for morphology handling
- LEMMA_MAP with Lithuanian-specific lemmas
- Diacritic mapping (LITHUANIAN_DIACRITIC_MAP)

**API Endpoints:**
- GET/POST `/api/seo/keywords` - Research, save, remove, SERP analysis
- GET `/api/seo/keyword-rankings` - Ranking history, latest, with-rankings
- GET/POST `/api/seo/keyword-mapping` - Suggest mappings, override mappings

**Next.js Server Actions (apps/web):**
- `researchKeywords()`, `saveKeywords()`, `getSavedKeywords()`, `removeSavedKeyword()`
- `getSerpAnalysis()`, `getKeywordHistory()`, `getKeywordLatestRanking()`
- `getSavedKeywordsWithRankings()` - For sparklines

**Background Processing:**
- BullMQ ranking-worker for daily keyword position tracking
- ranking-processor.js for batch position checks

**What's Missing (vs Vision in SYSTEM-ANALYSIS.md):**

1. **AI Planning Phase (Phase B)**: No automated analysis plan creation from prospect conversations
2. **User Confirmation UI (Phase C)**: No review/adjust interface for AI-generated plans
3. **Site Structure Integration**: Site scraping exists but not integrated into keyword mapping workflow
4. **Funnel Classification (BOFU/MOFU/TOFU)**: Intent field exists but no automated funnel classification
5. **Geographic Classification**: No city-specific vs generic keyword tagging
6. **Side Keyword Discovery**: No semantic relationship expansion (e.g., "fitline produktai" -> "papildai nuo sanariu skausmo")
7. **Conversation Memory (Phase F)**: No memory of previous analyses or preference learning
8. **Chat Interface**: No conversational UI for keyword analysis refinement
9. **Proposal Integration**: Keyword analysis not automatically feeding into proposal generation
10. **Advanced Clustering**: Only prefix-based clustering; no semantic/embedding-based clustering
11. **Category Gap Prioritization**: Gaps detected but not ranked by business priority
12. **Competitor Gap Analysis**: Schema exists (competitor_gap source) but implementation unclear
13. **Real-time Collaboration**: No multi-user simultaneous analysis support

**Key Functions**:
- `KeywordIntelligenceService.analyzeKeywords(clientId, keywords, categories)` - Main entry point
- `KeywordIntelligenceService.detectGaps(keywords, existingCategories)` - Gap detection
- `PrioritizationService.prioritizeKeywords(prospectId, focusScores?)` - Tier assignment
- `PrioritizationService.computeCompositeScore(keyword, focusScore)` - 5-factor scoring
- `QuickWinDetector.detect(keyword)` - Quick win opportunity detection
- `KeywordEnrichmentService.enrichBatch(keywordIds)` - DataForSEO enrichment
- `CsvImportService.importCsv(options)` - CSV import with format detection
- `KeywordInputService.addKeywords(input)` - Unified entry point
- `ClassificationPipeline.classify(keywords, context, workspaceId?)` - Two-pass AI classification
- `AdaptiveIntentRouter.analyze(input)` - Intent-based routing
- `KeywordUniverseBuilder.expand(seeds, domain?)` - Seed expansion
- `createKeywordIntelligence(config, redis?)` - Factory function
- TanStack: `researchKeywords()`, `saveKeywords()`, `getSavedKeywords()`, `getSerpAnalysis()`

---

### 2. SCRAPING: Site Scraping Pipeline
<!-- Agent 2 writes here -->

**Status**: complete

**Files Explored**:
- `AI-Writer/backend/services/scraping/brightdata_scraper.py` - BrightData Playwright CDP integration
- `AI-Writer/backend/services/component_logic/web_crawler_logic.py` - General web crawler with SSRF protection
- `AI-Writer/backend/models/crawled_content.py` - EndUserWebsiteContent SQLAlchemy model
- `open-seo-main/src/db/crawl-schema.ts` - PageSnapshots Drizzle schema for delta sync
- `open-seo-main/src/db/prospect-scrape-config-schema.ts` - ProspectScrapeConfigs with AI selectors
- `open-seo-main/src/server/lib/crawler/hybrid-crawler.ts` - HTTP-first crawler with Playwright fallback
- `open-seo-main/src/server/lib/crawler/sitemap-parser.ts` - XML sitemap parsing with lastmod
- `open-seo-main/src/server/lib/crawler/delta-sync.ts` - DeltaSyncService with split hashes
- `open-seo-main/src/server/lib/crawler/delta-cascade.ts` - L0->L1->L2->L3 delta crawling cascade
- `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts` - DataForSEO JS-rendered HTML
- `open-seo-main/src/server/lib/scraper/multiPageScraper.ts` - Multi-page prospect scraper
- `open-seo-main/src/server/lib/scraper/businessExtractor.ts` - AI-powered business info extraction
- `open-seo-main/src/server/lib/metrics/crawl-metrics.ts` - Redis-backed crawl metrics
- `open-seo-main/src/server/queues/crawlLaneRouter.ts` - Job routing to heavy/fast queues
- `open-seo-main/src/server/features/platform-oauth/crawler/SitemapParser.ts` - Sitemap discovery
- `open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.ts` - robots.txt parsing

**What Exists**:

1. **BrightData Integration** (`AI-Writer/backend/services/scraping/brightdata_scraper.py`):
   - Playwright CDP connection via `BRIGHTDATA_WS_ENDPOINT` env var
   - Fallback to aiohttp GET when env var absent (dev/CI)
   - `scrape_page(url)` -> rendered HTML string
   - `crawl_client_site(start_url)` -> list[{url, text}] with 25-page hard cap
   - Site type detection: blog, ecommerce, service
   - Internal link collection and noise stripping (nav/header/footer removed)

2. **Sitemap Parsing** (`open-seo-main/src/server/lib/crawler/sitemap-parser.ts`):
   - XML sitemap parsing with `fast-xml-parser`
   - Sitemap index recursive parsing (max depth 2)
   - `lastmod` extraction with garbage timestamp handling (Magento 0000-00-00)
   - `filterByLastmod()` for delta crawling L0 layer
   - Platform-aware warnings (Shopify lastmod flips on any admin mutation)

3. **Sitemap Discovery** (`open-seo-main/src/server/features/platform-oauth/crawler/SitemapParser.ts`):
   - Checks 5 common locations: /sitemap.xml, /sitemap_index.xml, /sitemap/sitemap.xml, /wp-sitemap.xml, /sitemap/index.xml
   - Falls back to robots.txt Sitemap directive

4. **Robots.txt Compliance** (`open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.ts`):
   - Full robots.txt parsing (User-Agent, Allow, Disallow, Crawl-Delay, Sitemap)
   - `isAllowed(robots, path, userAgent)` permission check
   - `getCrawlDelay()` rate limiting support

5. **Hybrid Crawler** (`open-seo-main/src/server/lib/crawler/hybrid-crawler.ts`):
   - HTTP-first approach with Playwright fallback for JS-heavy pages
   - Concurrency control via semaphore (default 50)
   - Delta sync integration via `lastCrawlDate` filtering
   - Redirect loop detection with visited URL tracking (max 10 redirects)
   - Page validation to detect consent/challenge blocking

6. **Delta Sync / Change Detection** (`open-seo-main/src/server/lib/crawler/delta-sync.ts`):
   - Split hashes: `seoContentHash` (name+desc+categories), `inventoryHash` (price+stock), `fullHash`
   - `ChangeType` enum: ADD, SEO_MODIFY, PRICE_UPDATE, DELETE, UNCHANGED
   - `DeltaSyncService.batchDetectChanges()` for bulk comparison
   - `PageSnapshots` table stores hashes per tenant/URL

7. **Delta Cascade** (`open-seo-main/src/server/lib/crawler/delta-cascade.ts`):
   - 4-layer cascade: L0 (sitemap lastmod) -> L1 (HTTP 304) -> L2 (hash) -> L3 (full)
   - Target: 80%+ skip rate on stable sites
   - Integrates with `recordDeltaSkip()` metrics

8. **Crawl Metrics** (`open-seo-main/src/server/lib/metrics/crawl-metrics.ts`):
   - Redis-backed counters for multi-worker safety
   - Tracks: singleflight hits/misses, delta skips by layer, queue completions
   - Cost savings calculation ($0.0001/crawl)
   - API endpoint at `/api/metrics/crawl`

9. **Per-Client Crawls**:
   - `tenantId` passed through all crawl functions
   - `PageSnapshots` table indexed by `(tenant_id, url_hash)`
   - `ProspectScrapeConfigs` stores per-prospect extraction rules

10. **Crawl Budget Management**:
    - `_CRAWL_BUDGET = 25` in BrightData scraper
    - `clampAuditMaxPages()` limits to 10-10,000 pages
    - `maxPages`, `maxDepth`, `rateLimit` in ProspectScrapeConfigs

11. **Content Extraction** (`AI-Writer/backend/services/component_logic/web_crawler_logic.py`):
    - `crawl_website(url)` -> title, description, main_content, headings, links, images, meta_tags
    - Domain info extraction (is_blog, is_ecommerce, is_corporate)
    - Social media link detection (Facebook, Twitter, LinkedIn, etc.)
    - Brand information extraction (logo, company name, tagline, contact)
    - Content structure analysis (heading counts, paragraphs, lists)
    - SSRF protection with private IP blocking

12. **DataForSEO Scraper** (`open-seo-main/src/server/lib/scraper/dataforseoScraper.ts`):
    - JS-rendered HTML via `/v3/on_page/content_parsing/live` + `/v3/on_page/raw_html`
    - Cost: ~$0.02/page
    - SSRF protection built-in
    - Integrates with `analyzeHtml()` for SEO extraction

13. **Business Extractor** (`open-seo-main/src/server/lib/scraper/businessExtractor.ts`):
    - Claude-powered extraction of products, brands, services, location, target market
    - Confidence scoring (0-1)
    - Uses PageAnalysis data from multi-page scraper

14. **Queue System** (`open-seo-main/src/server/queues/crawlLaneRouter.ts`):
    - Type A (FULL_AUDIT) -> heavy-crawl queue (<15 min SLA)
    - Types B/C/D/E/F -> fast-api queue (<1 min SLA)
    - Job type validation for security

**What's Missing** (for Keyword Intelligence vision):

1. **Category Extraction from Site**:
   - No dedicated category hierarchy extraction
   - BrightData scraper detects site type but doesn't map category structure
   - Need: Extract product categories, menu structure, breadcrumbs

2. **Keyword-to-Page Mapping**:
   - No semantic matching of keywords to site pages
   - Need: Given keyword "sampunai dazytiems plaukams", find which site page covers it

3. **Product/Content Inventory**:
   - EndUserWebsiteContent stores raw content but no structured product data
   - Need: Product catalog extraction with name, description, category, price

4. **Scheduled/Triggered Crawls**:
   - Crawls are manual via audit system
   - Need: Scheduled delta crawls per client (daily/weekly)
   - Need: Webhook trigger for "re-crawl this client"

5. **Crawl Status Tracking**:
   - Limited to job queue status
   - Need: Client-facing crawl status dashboard (last crawl, pages indexed, next scheduled)

6. **Content Structure Analysis for Keywords**:
   - No extraction of which keywords a page targets
   - Need: Extract H1, title, meta description -> infer page's target keywords

7. **Competitor Site Crawling**:
   - BrightData scraper is client-site focused
   - Need: Competitor crawling for gap analysis (may use same infra)

8. **Platform-Specific Extractors**:
   - ProspectScrapeConfigs schema exists for Shopify/WooCommerce/Magento
   - AI selector discovery schema exists but extractors not implemented
   - Need: Platform detection -> auto-apply extraction rules

**Key Functions**:

| Function | Location | Purpose |
|----------|----------|---------|
| `crawl_client_site(url)` | `AI-Writer/backend/services/scraping/brightdata_scraper.py:117` | BrightData site crawl with 25-page cap |
| `scrape_page(url)` | `AI-Writer/backend/services/scraping/brightdata_scraper.py:34` | Single page HTML fetch |
| `HybridCrawler.crawlSite()` | `open-seo-main/src/server/lib/crawler/hybrid-crawler.ts:147` | HTTP+Playwright hybrid crawl |
| `parseSitemap(url)` | `open-seo-main/src/server/lib/crawler/sitemap-parser.ts:36` | XML sitemap parsing |
| `fetchAllSitemapUrls(url)` | `open-seo-main/src/server/lib/crawler/sitemap-parser.ts:127` | Recursive sitemap fetch |
| `filterByLastmod()` | `open-seo-main/src/server/lib/crawler/sitemap-parser.ts:164` | Delta sync L0 filtering |
| `DeltaSyncService.batchDetectChanges()` | `open-seo-main/src/server/lib/crawler/delta-sync.ts:217` | Bulk hash comparison |
| `deltaCascade()` | `open-seo-main/src/server/lib/crawler/delta-cascade.ts:80` | L0-L3 cascade decision |
| `scrapeProspectPage(url)` | `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts:402` | DataForSEO JS scrape |
| `scrapeProspectSite(domain)` | `open-seo-main/src/server/lib/scraper/multiPageScraper.ts:50` | Multi-page business scrape |
| `extractBusinessInfo(pages)` | `open-seo-main/src/server/lib/scraper/businessExtractor.ts:67` | Claude AI extraction |
| `WebCrawlerLogic.crawl_website()` | `AI-Writer/backend/services/component_logic/web_crawler_logic.py:154` | Full page analysis |
| `RobotsTxtParser.isAllowed()` | `open-seo-main/src/server/features/platform-oauth/crawler/RobotsTxtParser.ts:139` | Crawl permission check |
| `routeJob(type, data)` | `open-seo-main/src/server/queues/crawlLaneRouter.ts:141` | Queue lane routing |
| `getMetrics()` | `open-seo-main/src/server/lib/metrics/crawl-metrics.ts:224` | Redis crawl metrics | 

---

### 3. INTENT: BOFU/MOFU/TOFU + Geo Classification
<!-- Agent 3 writes here -->

**Status**: _complete_

**Files Explored**:
- `open-seo-main/src/server/features/keywords/classification/types.ts` - KeywordTypeEnum with 5 intent types
- `open-seo-main/src/server/features/keywords/classification/GrokClassifier.ts` - LLM-based classification (Pass 1)
- `open-seo-main/src/server/features/keywords/classification/GeminiClassifier.ts` - Fallback classifier (Pass 2)
- `open-seo-main/src/server/features/keywords/classification/ClassificationPipeline.ts` - Two-pass cascade
- `open-seo-main/src/server/features/keywords/intent/AdaptiveIntentRouter.ts` - Quick check vs full analysis routing
- `open-seo-main/src/types/keywords.ts` - KeywordIntent type (informational, commercial, transactional, navigational)
- `open-seo-main/src/types/schemas/keywords.ts` - saveKeywordsSchema with intent field
- `open-seo-main/src/db/app.schema.ts` - keywordMetrics table has `intent` column
- `open-seo-main/src/client/features/keywords/components/DisplayPrimitives.tsx` - IntentBadge UI component
- `open-seo-main/src/server/features/keywords/types/tasks.ts` - TaskType includes 'local_seo'
- `AI-Writer/backend/services/research/intent/` - 10 intent-related modules for research intent
- `AI-Writer/backend/models/research_intent_models.py` - ResearchPurpose, ContentOutput, ExpectedDeliverable enums

**What Exists**:

1. **Two Intent Classification Systems (Different Purposes)**:

   **A. open-seo-main: Keyword Type Classification**
   - `KeywordTypeEnum`: product, long_tail, question, local, comparison (`types.ts:14-21`)
   - `KeywordIntent`: informational, commercial, transactional, navigational, unknown (`keywords.ts:1-6`)
   - Stored in `keywordMetrics.intent` column (`app.schema.ts:119`)
   - IntentBadge displays color-coded badges: Info (blue), Comm (yellow), Trans (green), Nav (default) (`DisplayPrimitives.tsx:271-296`)

   **B. AI-Writer: Research Intent Analysis**
   - `ResearchPurpose`: learn, create_content, make_decision, compare, solve_problem, find_data, explore_trends, validate, generate_ideas (`research_intent_models.py:18-28`)
   - `ContentOutput`: blog, podcast, video, social_post, newsletter, etc. (`research_intent_models.py:32-43`)
   - `ExpectedDeliverable`: key_statistics, expert_quotes, case_studies, trends, etc. (`research_intent_models.py:46-58`)
   - `ResearchIntentInference.infer_intent()` - LLM-based intent inference (`research_intent_inference.py:46-148`)

2. **Two-Pass Classification Cascade (Phase 63)**:
   - Pass 1: `GrokClassifier` - High-volume, cheap ($0.20/1M tokens), confidence >= 0.85 is final
   - Pass 2: Claude/Gemini refinement for low-confidence results
   - `AdaptiveIntentRouter`: Routes to quick_check (<10 keywords, <30s) or full_analysis
   - `NegativeAssociationExtractor`: Extracts wrong intent signals (e.g., "nemokamas", "DIY")

3. **Geographic/Local Intent**:
   - `KeywordTypeEnum` includes "local" for location-based searches
   - `TaskType` includes "local_seo" task type (`tasks.ts:54`)
   - `locationCode` parameter used throughout (default 2440 for Lithuania, 2840 for US)
   - No explicit city/region extraction - just location-based search tagging

4. **LLM Prompts for Classification**:
   - `GrokClassifier.buildSystemPrompt()` - "You are an expert keyword classifier for Lithuanian e-commerce and B2B businesses"
   - Classifies into: product, long_tail, question, local, comparison
   - Uses business context and negative associations for filtering

5. **Intent Storage**:
   - `keywordMetrics.intent` - Text field in database
   - Intent passed through `saveKeywordsSchema.metrics[].intent` enum validation
   - Monthly searches stored as JSONB

6. **UI Intent Display**:
   - `IntentBadge` component shows color-coded badges
   - No intent filtering in UI (keywords can be sorted/filtered by volume, CPC, KD, competition - not intent)

**What's Missing (vs Vision)**:

1. **NO BOFU/MOFU/TOFU Classification**:
   - Vision requires funnel stage classification (Bottom/Middle/Top of Funnel)
   - Current system uses informational/commercial/transactional/navigational (traditional SEO intent)
   - These roughly map but are NOT the same:
     - BOFU ≈ transactional (but misses "comparison" which is also BOFU)
     - MOFU ≈ commercial
     - TOFU ≈ informational
   - Need explicit BOFU/MOFU/TOFU enum and classification logic

2. **NO Geographic Intent Detection**:
   - Vision: "city-specific vs generic" classification
   - Current: Only "local" keyword type, no city/region extraction
   - Missing: Extract city names from keywords (e.g., "dantistas vilnius" → geo=Vilnius)
   - Missing: Geo-specific filtering in UI

3. **NO Intent-Based Filtering in UI**:
   - Vision: "Filter to top 100-200 keywords with BOFU only, cities, etc."
   - Current: IntentBadge displays intent but no filter controls
   - Missing: Dropdown/checkbox filters for intent, funnel stage, geo

4. **NO Intent-Based Prioritization**:
   - Vision: Priority weighting by funnel stage
   - Current: Classification provides include/exclude + confidence
   - Missing: Scoring that weights BOFU higher than TOFU

5. **NO Funnel Preference in Prospect Onboarding**:
   - Vision: "Funnel preference (BOFU only, MOFU+BOFU, all)"
   - Current: No funnel preference captured in onboarding
   - Missing: Funnel preference field in prospect/client schema

6. **AI-Writer and open-seo-main Intent Systems Not Unified**:
   - AI-Writer has rich research intent (purpose, deliverables)
   - open-seo-main has keyword type classification
   - No shared intent model between systems

**Key Functions**:
- `GrokClassifier.classify(keywords, context)` → `ClassificationItem[]` (open-seo-main)
- `ClassificationPipeline.classify(keywords, context)` → Two-pass cascade (open-seo-main)
- `AdaptiveIntentRouter.analyze(input)` → Routes to quick_check or full_analysis (open-seo-main)
- `ResearchIntentInference.infer_intent(user_input, keywords, ...)` → `IntentInferenceResponse` (AI-Writer)
- `IntentAwareAnalyzer.analyze(raw_results, intent, ...)` → `IntentDrivenResearchResult` (AI-Writer) 

---

### 4. CHAT-UI: Conversation Interface + Memory
<!-- Agent 4 writes here -->

**Status**: complete

**Files Explored**:
- `AI-Writer/frontend/src/App.tsx` - CopilotKit integration
- `AI-Writer/frontend/src/components/App/CopilotWrappers.tsx` - CopilotKit provider
- `AI-Writer/frontend/src/components/shared/CopilotKit/PlatformPersonaChat.tsx` - Chat sidebar component
- `AI-Writer/frontend/src/types/copilotkit-react-ui.d.ts` - Type declarations
- `AI-Writer/backend/services/agent_framework.py` - Agent execution framework
- `AI-Writer/backend/api/brainstorm.py` - AI brainstorm endpoints
- `AI-Writer/backend/api/writing_assistant.py` - Writing suggestions endpoint
- `AI-Writer/backend/models/agent_activity_models.py` - Agent run/event tracking
- `AI-Writer/backend/services/task_memory_service.py` - Task history memory
- `AI-Writer/backend/services/intelligence/txtai_service.py` - Semantic search/embedding
- `apps/web/src/stores/intelligenceStore.ts` - Client intelligence state

**What Exists**:

1. **CopilotKit Chat UI** (`PlatformPersonaChat.tsx:168-301`)
   - CopilotSidebar component from @copilotkit/react-ui
   - Platform-specific chat configs (LinkedIn, Instagram, Twitter, blog, etc.)
   - Persona-aware system prompts with linguistic fingerprint context
   - Suggested prompts and quick actions per platform
   - React state for chat toggle (isChatOpen)

2. **CopilotKit Provider** (`CopilotWrappers.tsx:20-81`)
   - AuthenticatedCopilotWrapper with Clerk auth check
   - publicApiKey configuration via localStorage or env var
   - Error handling with window events

3. **Agent Activity Tracking** (`agent_activity_models.py:9-109`)
   - AgentRun: user_id, agent_type, prompt, status, result_summary, started_at, finished_at
   - AgentEvent: run_id, event_type, severity, message, payload, created_at
   - AgentProfile: user_id, agent_key, system_prompt, task_prompt_template

4. **Task Memory Service** (`task_memory_service.py:80-257`)
   - TaskMemoryService with user_id + DB session
   - record_task_outcome() - saves to TaskHistory table
   - filter_redundant_proposals() - deduplicates via hash + semantic similarity
   - Uses TxtaiIntelligenceService for vector search

5. **Txtai Intelligence Service** (`txtai_service.py:29-655`)
   - Semantic indexing with sentence-transformers (all-MiniLM-L6-v2)
   - search(query, limit) - semantic search with caching
   - index_content(items) - index (id, text, metadata) tuples
   - get_similarity(text1, text2) - cosine similarity
   - Per-user vector indices in workspace/workspace_{user_id}/indices/txtai

6. **Brainstorm API** (`brainstorm.py:53-135`)
   - POST /api/brainstorm/prompts - generate Google search prompts
   - POST /api/brainstorm/search - run grounded search
   - POST /api/brainstorm/ideas - generate brainstorm ideas
   - Uses Gemini structured JSON responses

7. **Writing Assistant API** (`writing_assistant.py:41-65`)
   - POST /api/writing-assistant/suggest - text suggestions with sources

**What's Missing** (vs Keyword Intelligence Vision):

1. **NO dedicated keyword chat endpoint** - brainstorm/suggest endpoints exist but not for keyword analysis
2. **NO conversation history table** - AgentRun/AgentEvent track agent runs, not chat messages
3. **NO per-client conversation isolation** - current chat is user-level, not client-scoped
4. **NO streaming response support** - all endpoints are request/response, no SSE/WebSocket
5. **NO conversation memory across sessions** - CopilotKit state is ephemeral (React useState)
6. **NO keyword analysis tools in CopilotKit** - only persona/platform tools, not DataForSEO or keyword analysis
7. **NO chat-triggered keyword analysis** - brainstorm endpoints do generic search, not keyword discovery
8. **NO BOFU/MOFU/TOFU intent classification in chat** - intent classification not connected to conversation
9. **NO refinement loop** - chat does not allow "adjust analysis" or "filter differently" commands
10. **NO conversation export** - cannot save or share chat analysis results

**Key Functions**:
- `PlatformPersonaChat` (React component) - `PlatformPersonaChat.tsx:168`
- `generateEnhancedSystemMessage(platform, corePersona, platformPersona)` - `PlatformPersonaChat.tsx:56`
- `TxtaiIntelligenceService.search(query, limit)` - `txtai_service.py:336`
- `TxtaiIntelligenceService.index_content(items)` - `txtai_service.py:279`
- `TaskMemoryService.record_task_outcome(task, feedback_score, feedback_text)` - `task_memory_service.py:111`
- `BaseALwrityAgent.run(prompt)` - `agent_framework.py:328`
- POST `/api/brainstorm/prompts` - `brainstorm.py:53`
- POST `/api/brainstorm/ideas` - `brainstorm.py:207`

**Gap Assessment for Vision**:

The current system has foundational pieces:
- CopilotKit provides a chat UI framework (but not connected to keyword analysis)
- Agent framework supports running AI prompts with activity tracking
- Txtai enables semantic search and embedding (could power conversation memory)
- Task memory shows pattern for recording outcomes (extend to conversation turns)

To achieve the vision of AI chat for keyword analysis:
1. Create `/api/keyword-chat/message` endpoint with conversation history
2. Add `conversations` and `conversation_messages` tables (client_id, user_id, messages JSONB)
3. Connect DataForSEO keyword APIs as CopilotKit tools
4. Add streaming support (FastAPI StreamingResponse + EventSource)
5. Build KeywordAnalysisChat component in apps/web with client context
6. Implement conversation memory retrieval for context-aware responses 

---

### 5. PROPOSALS: Proposal Generation from Keywords
<!-- Agent 5 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/db/proposal-schema.ts` - Core proposal schema
- `open-seo-main/src/db/proposal-template-schema.ts` - Template system with localization
- `open-seo-main/src/serverFunctions/proposals.ts` - TanStack server functions for CRUD
- `open-seo-main/src/server/features/proposals/services/ProposalService.ts` - Core proposal service
- `open-seo-main/src/server/features/proposals/services/ProposalGeneratorService.ts` - Full proposal generation from prospects
- `open-seo-main/src/server/features/proposals/services/VersionService.ts` - Version history/auto-save
- `open-seo-main/src/server/features/proposals/services/ProposalAIGenerationService.ts` - AI content generation
- `open-seo-main/src/server/features/proposals/signing/` - E-signature (Dokobit) + PDF
- `open-seo-main/src/server/features/proposals/payment/` - Stripe payment integration
- `open-seo-main/src/server/features/proposals/tracking/` - View tracking + engagement signals
- `open-seo-main/src/routes/_app/prospects/$prospectId/proposal.tsx` - Proposal builder UI
- `open-seo-main/src/routes/_app/proposals/$proposalId.edit.tsx` - Proposal edit page
- `open-seo-main/src/client/components/proposals/` - 17+ UI components
- `open-seo-main/src/client/utils/export.ts` - CSV export for keyword gaps
- `open-seo-main/src/server/services/report/pdf-generator.ts` - Puppeteer PDF generation
- `apps/web/src/app/proposals/[token]/actions.ts` - Next.js public proposal actions
- `apps/web/src/app/proposals/[token]/page.tsx` - Public proposal viewing page

**What Exists**:

1. **Comprehensive Proposal Schema** (`proposal-schema.ts:96-157`)
   - Full lifecycle states: `draft` -> `sent` -> `viewed` -> `accepted` -> `signed` -> `paid` -> `onboarded` (+ `expired`, `declined`)
   - JSONB `content` field with `ProposalContent` type containing:
     - `hero` (headline, subheadline, trafficValue)
     - `currentState` (traffic, keywords, value, chartData)
     - `opportunities` (keyword, volume, difficulty, potential) - **up to 10 keywords**
     - `roi` (projectedTrafficGain, trafficValue, conversionRate, aov)
     - `investment` (setupFee, monthlyFee, inclusions)
     - `nextSteps` array
   - Public access via `token` field (nanoid 32 chars)
   - Expiration support via `expiresAt`

2. **Template System** (`proposal-template-schema.ts`)
   - Three-layer hierarchy: System -> Workspace -> Instance
   - Template types: `proposal`, `case_study`, `report`
   - Categories: `seo`, `local_seo`, `ecommerce`, `enterprise`, `custom`
   - Section types: `hero`, `opportunities`, `methodology`, `pricing`, etc.
   - Multi-language support (en/lt) for all text fields
   - Variable substitution system with `VariableDefinition[]`
   - Branding settings (colors, fonts, logo)

3. **Keyword Integration** (`ProposalGeneratorService.ts:121-128, 332`)
   - Fetches `keywordGaps` from prospect analysis
   - Filters quick wins: `difficulty <= 50 && searchVolume >= 200`
   - Slices **top 10 keywords** for `opportunities` array (`keywordGaps.slice(0, 10)`)
   - Calculates `trafficPotential` from searchVolume
   - Maps difficulty score to `easy`/`medium`/`hard`

4. **Proposal Scenarios** (`ProposalGeneratorService.ts:44-63`)
   - `focused`: 3-10 keywords, EUR150 + EUR25/kw
   - `full_audit`: 100+ keywords, top 20 mapping, EUR800 flat
   - `competitor_only`: Gap list only, EUR250 + EUR75/comp
   - Each scenario has different section types

5. **Version History** (`VersionService.ts`)
   - Auto-save with version snapshots
   - `createVersion()`, `listVersions()`, `restoreVersion()`
   - Change tracking: `changeType`, `changeDescription`, `changedSections`
   - Significant change detection: >1% content change or >100 chars

6. **Public Sharing** (`proposals.ts:257-274, $proposalId.edit.tsx:118-124`)
   - `getProposalByToken()` - unauthenticated access via token
   - Expiration checking before serving
   - Copy link button in edit UI
   - Public URL pattern: `/p/{token}`

7. **PDF Generation** (`pdf-generator.ts`, `signing/pdf.ts`)
   - Puppeteer-based PDF generation from HTML
   - Contract PDF for e-signatures (Dokobit)
   - Connects to external Puppeteer container via WebSocket
   - 60s timeout, A4 format, proper margins

8. **CSV Export** (`export.ts`)
   - `exportKeywordGaps()` - exports KeywordGap array to CSV
   - `downloadCsv()` - triggers browser download
   - CSV injection prevention (formula sanitization)
   - Columns: Keyword, Competitor, Position, Search Volume, CPC, Difficulty, Opportunity Score

9. **Engagement Tracking** (`tracking/ViewTrackingService.ts`, `EngagementSignals.ts`)
   - IP hashing for GDPR compliance
   - Device type detection
   - Section visibility tracking
   - ROI calculator usage tracking
   - Engagement signals: viewCount, totalDuration, sectionsViewedPercentage, etc.

10. **AI Content Generation** (`ProposalAIGenerationService.ts`)
    - Context injection: audit, keywords, prospect, competitor
    - Tone presets: professional, friendly, technical, urgent
    - Multi-language support (en/lt)
    - Section-specific generation

**What's Missing (vs Vision)**:

1. **Keyword Selection UI** - No UI to select/deselect keywords before adding to proposal
   - Currently auto-selects top 10 from `keywordGaps.slice(0, 10)`
   - Vision requires: checkbox selection, drag-and-drop ranking, bulk select/deselect

2. **Configurable Top-N Limit** - Hardcoded `slice(0, 10)` not configurable
   - Vision requires: User-defined limit (100-200 keywords)
   - Current max is 10 keywords per proposal

3. **Excluded Keywords Export** - No mechanism to export non-selected keywords
   - Vision: "Export excluded keywords for reference"
   - Current CSV export is for all keyword gaps, not filtered by proposal selection

4. **Keyword Intent Filtering in Proposal Flow** - No BOFU/MOFU/TOFU filtering
   - Vision: "Filter to BOFU only" before adding to proposal
   - ProposalGeneratorService doesn't filter by intent

5. **Geographic Filtering for Proposals** - No city-specific filtering
   - Vision: "Vilnius, Kaunas only" filter
   - No geo fields in proposal content structure

6. **Category Priority Weighting** - No category/priority system in proposal
   - Vision: "Priority categories weighted higher"
   - ProposalContent.opportunities has no category field

7. **Side Keyword Discovery Link** - No semantic expansion from proposal
   - Vision: "fitline produktai" -> "papildai nuo sanarių skausmo"
   - No embedding-based keyword expansion in proposal flow

8. **Proposal PDF with Full Keyword List** - PDF only for contract signing
   - Vision needs: downloadable PDF with all 100-200 keywords
   - Current PDF is for signed agreement, not keyword report

9. **Keyword Refresh/Sync** - No refresh from DataForSEO after initial generation
   - Proposals are static after creation
   - No way to update keyword metrics in existing proposal

**Key Functions**:
- `ProposalService.create(input: CreateProposalInput)` - Create proposal from prospect
- `ProposalService.findByToken(token: string)` - Public access lookup
- `generateDefaultContent(prospect: ProspectWithAnalyses)` - Auto-generate from analysis
- `ProposalGeneratorService.generateProposal(input: GenerateProposalInput)` - Full orchestration
- `VersionService.createVersion(input: CreateVersionInput)` - Save version snapshot
- `exportKeywordGaps(gaps: KeywordGap[])` - CSV string generation
- `generatePDF(html: string, options: PDFOptions)` - Puppeteer PDF
- `ViewTrackingService.trackProposalView(input)` - Engagement tracking
- `calculateEngagementSignals(proposalId: string)` - Aggregate engagement metrics 

---

### 6. ONBOARDING: Client/Prospect Data Collection
<!-- Agent 6 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/db/prospect-schema.ts` - Prospect data model with extraction fields
- `open-seo-main/src/db/client-schema.ts` - Client data model (converted prospects)
- `open-seo-main/src/db/schema/shared-clients.ts` - Unified client schema for consolidation
- `open-seo-main/src/db/onboarding-schema.ts` - Onboarding checklists schema
- `open-seo-main/src/routes/_app/prospects/index.tsx` - Prospects list page
- `open-seo-main/src/routes/_app/prospects/$prospectId.tsx` - Prospect detail page
- `open-seo-main/src/routes/api/prospects/extract.ts` - AI extraction endpoint (Phase 56)
- `open-seo-main/src/routes/api/prospects/confirm.ts` - Confirm extraction endpoint (Phase 56)
- `open-seo-main/src/server/features/prospects/services/ConversationExtractor.ts` - Claude AI extraction
- `open-seo-main/src/server/features/prospects/services/ProspectService.ts` - Prospect CRUD + conversion
- `open-seo-main/src/server/features/onboarding/services/OnboardingService.ts` - Checklist creation
- `open-seo-main/src/server/features/onboarding/services/ConversionService.ts` - Prospect-to-client conversion
- `apps/web/src/app/(shell)/clients/[clientId]/onboarding/page.tsx` - Onboarding page
- `apps/web/src/app/(shell)/clients/[clientId]/onboarding/onboarding-checklist.tsx` - Checklist UI
- `apps/web/src/lib/api/onboarding.ts` - Onboarding API client
- `AI-Writer/backend/models/client.py` - AI-Writer Client + ClientSettings models
- `AI-Writer/backend/services/progressive_setup_service.py` - Progressive onboarding
- `AI-Writer/backend/services/sif_onboarding_service.py` - SIF semantic onboarding integration

**What Exists**:

1. **Prospect Data Model** (`prospect-schema.ts:192-252`)
   - Core fields: domain, companyName, contactEmail, contactName, industry, notes, source, assignedTo
   - Status tracking: new, analyzing, analyzed, converted, archived
   - Pipeline stages: new, analyzing, scored, qualified, contacted, negotiating, converted, archived
   - Priority scoring: `priorityScore` (0-100, auto-computed after analysis)
   - Multi-modal input (Phase 56): `inputMode` (website, website_with_context, conversation)
   - AI extraction fields: `rawInput` (up to 50KB), `extractedData`, `confirmedData`, `confirmationStatus`
   - Language preferences: `preferredLanguage`, `country` (ISO 3166-1 alpha-2)
   - Conversion tracking: `convertedClientId` (UUID link to clients table)

2. **Client Data Model** (`client-schema.ts:44-112`)
   - Same core fields as prospect (name, domain, contactEmail, contactName, industry)
   - Status: onboarding, active, paused, churned
   - GSC credentials: `gscRefreshToken`, `gscSiteUrl`, `gscConnectedAt`
   - Onboarding tracking: `kickoffScheduledAt`, `kickoffCompletedAt`, `onboardingCompletedAt`
   - Baseline metrics: `baselineMetrics` (traffic, keywords, domainRank JSONB)
   - Target keywords: `targetKeywords` (string[] JSONB)
   - Language preferences: `preferredLanguage`, `country`
   - Soft delete: `isDeleted`, `deletedAt`

3. **AI-Writer Client Model** (`client.py:66-158`)
   - Basic: id (UUID), name, website_url, workspace_id
   - Archive support: is_archived
   - Settings relationship (ClientSettings):
     - Content preferences: brand_voice, image_prompt_template, text_model_override, image_model_override
     - CMS routing: cms_type (wordpress/shopify/wix/webhook), webhook_url
     - WordPress: wp_url, wp_username, wp_app_password_encrypted
     - Shopify: shopify_store_url, shopify_api_key_encrypted
     - Wix: wix_site_id, wix_blog_id, wix_api_key_encrypted

4. **Unified Shared Client Schema** (`shared-clients.ts:66-196`)
   - Merges open-seo-main + AI-Writer client fields
   - Full CMS credentials, brand voice, GSC OAuth
   - Planned for Phase 67 database consolidation

5. **AI-Powered Extraction** (`ConversationExtractor.ts:77-184`)
   - Claude Sonnet 4 extracts from conversation/email/notes
   - Outputs: businessName, industry, services[], targetAudience, keywords[], location
   - Confidence score (0-100)
   - Platform detection for website modes (WordPress/Shopify/etc.)

6. **Extraction API** (`extract.ts:61-116`)
   - POST /api/prospects/extract
   - Rate limited: 50 extractions/day/workspace
   - Input: content (50 chars - 50KB), inputMode, domain?, contextNotes?
   - Returns: extracted data with confidence

7. **Confirm API** (`confirm.ts:30-141`)
   - POST /api/prospects/confirm
   - Creates prospect with user-confirmed extraction data
   - Stores: extractedData, confirmedData, confirmationStatus

8. **Prospect-to-Client Conversion** (`ProspectService.ts:411-490`)
   - `convertProspectToClient(prospectId, userId, workspaceId)`
   - Atomic transaction with row locking
   - Collects post-commit webhook job for "client.created"

9. **Onboarding Checklists** (`onboarding-schema.ts:58-85`)
   - Per-client checklist created after payment
   - Service tiers: starter (5 items), growth (8 items), enterprise (12 items)
   - Categories: setup, credentials, kickoff, content
   - Auto-complete events: gsc_connected, ga_connected, cms_connected, kickoff_completed

10. **Checklist Items by Tier** (`OnboardingService.ts:29-109`)
    - Starter: GSC, GA, schedule kickoff, complete kickoff, submit brief
    - Growth: + CMS, review brand voice, approve first draft
    - Enterprise: + GBP, competitor analysis, content strategy, link building

11. **Conversion on Checklist Completion** (`ConversionService.ts:44-165`)
    - Triggered when checklist reaches 100%
    - Updates client status to "active", sets `onboardingCompletedAt`
    - Returns ConversionSummary with connected services + next steps

12. **Progressive Setup (AI-Writer)** (`progressive_setup_service.py:17-252`)
    - Step-based feature unlocking (AI, Content, Research, Integration services)

13. **Prospect Analysis Data** (`prospect-schema.ts:259-293`)
    - `prospectAnalyses` table stores DataForSEO results
    - domainMetrics, organicKeywords, competitorKeywords, keywordGaps, opportunityKeywords

**What's Missing (vs Vision in SYSTEM-ANALYSIS.md)**:

1. **NO Priority Categories Capture**
   - Vision: "Priority categories (e.g., 'sampunai dazytiems plaukams first')"
   - Current: No `priorityCategories` field in prospect or client schema
   - Missing: Array field like `focusCategories: string[]` with ordering

2. **NO Geographic Focus Capture**
   - Vision: "Geographic focus (e.g., 'Vilnius, Kaunas only')"
   - Current: Only `country` (ISO code) and `location` (single string from extraction)
   - Missing: `targetCities: string[]` or `geoFocus: { cities: string[], regions: string[] }`

3. **NO Funnel Preference Capture (BOFU/MOFU/TOFU)**
   - Vision: "Funnel preference (BOFU only, MOFU+BOFU, all)"
   - Current: No funnel preference field anywhere
   - Missing: `funnelFocus: ('bofu' | 'mofu' | 'tofu')[]` in prospect/client schema

4. **NO Service/Product Focus Areas Transfer**
   - Vision: "Service focus (e.g., 'plauku dazymas, kirpimas')"
   - Current: extraction has `services[]` but not surfaced in client schema
   - Missing: Transfer `services[]` to client record on conversion

5. **Site URL Handling Limited**
   - Vision: "Site URL (if exists) or 'no site yet'"
   - Current: `domain` required, conversation mode generates placeholder (.prospect)
   - Missing: Explicit "no_site" flag and site creation workflow

6. **Keywords Not Carried Through**
   - Current: `targetKeywords` exists on client but not populated from extraction
   - Missing: opportunityKeywords from analysis linked to client keyword priorities

7. **No Onboarding Wizard/Flow for Keyword Intelligence**
   - Current: Onboarding is credentials/kickoff focused
   - Missing: Steps for keyword priorities, category selection, geo targeting

8. **Missing Integration Between Extraction and Keyword Analysis**
   - extraction generates `keywords[]` but not used in KeywordIntelligenceService

9. **No Client Questionnaire**
   - Vision implies interactive conversation to capture priorities
   - Current: One-shot extraction from paste-in text
   - Missing: Multi-turn conversation or form wizard

**Key Functions**:

| Function | Location | Purpose |
|----------|----------|---------|
| `ProspectService.create(input)` | `ProspectService.ts:115` | Create prospect with validation |
| `ProspectService.convertProspectToClient(...)` | `ProspectService.ts:411` | Atomic prospect-to-client conversion |
| `extractFromConversation(input)` | `ConversationExtractor.ts:77` | Claude AI extraction from text |
| `POST /api/prospects/extract` | `extract.ts:61` | Extraction API endpoint |
| `POST /api/prospects/confirm` | `confirm.ts:30` | Confirm extraction + create prospect |
| `OnboardingService.createFromContract(...)` | `OnboardingService.ts:127` | Create tier-based checklist |
| `ConversionService.completeOnboarding(...)` | `ConversionService.ts:44` | Complete onboarding, activate client |
| `ConversionService.checkAndTriggerConversion(...)` | `ConversionService.ts:175` | Auto-trigger on 100% checklist |
| `ProgressiveSetupService.initialize_user_environment(...)` | `progressive_setup_service.py:24` | Progressive feature setup |

**Gap Analysis for Keyword Intelligence Vision**:
To support the vision, onboarding needs:
1. Add schema fields: `focusCategories`, `targetCities`, `funnelPreference`, `serviceAreas`
2. Extend extraction prompt to ask about priorities, geo, funnel stage
3. Create onboarding wizard step for "Keyword Intelligence Setup"
4. Transfer extraction data to client record on conversion
5. Connect client priorities to KeywordIntelligenceService for filtering/weighting 

---

### 7. DATAFORSEO: External Data Integrations
<!-- Agent 7 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/server/lib/dataforseo.ts` - Main TypeScript client (batch keywords, SERP, suggestions)
- `open-seo-main/src/server/lib/dataforseoKeywordGap.ts` - Competitor keyword gap analysis
- `open-seo-main/src/server/lib/redis-rate-limiter.ts` - Redis token bucket rate limiter (5 req/sec)
- `open-seo-main/src/server/features/keywords/services/KeywordEnrichmentService.ts` - Batch enrichment with 7-day Redis cache
- `open-seo-main/src/server/features/keywords/schema/dataforseo.ts` - Zod response schemas
- `open-seo-main/src/server/workers/ranking-worker.ts` - BullMQ worker for ranking tracking
- `AI-Writer/backend/services/scraping/dataforseo_client.py` - Python async client (domain analytics, backlinks, gaps)
- `AI-Writer/backend/models/dataforseo_models.py` - Pydantic models for DataForSEO responses
- `open-seo-main/src/server/lib/scraper/dataforseoScraper.ts` - JS-rendered HTML scraper
- `open-seo-main/src/server/features/keywords/services/CsvImportService.ts` - Ahrefs/SEMrush/Moz CSV import
- `open-seo-main/src/server/features/audit/workers/queue.ts` - Metered billing via Autumn
- `open-seo-main/src/db/metering-schema.ts` - Usage tracking schema
- `open-seo-main/src/server/lib/r2-cache.ts` - R2/file-based caching for SERP
- `apps/web/src/actions/seo/keywords.ts` - Next.js server actions calling DataForSEO
- `open-seo-main/src/server/queues/crawlLaneRouter.ts` - Job routing for crawl/API tasks
- `open-seo-main/src/config/env.ts` - DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD env vars
- `AI-Writer/backend/config/env_validator.py` - Python env validation

**What Exists**:

1. **DataForSEO Endpoints Used (open-seo-main)**:
   - `/v3/keywords_data/google_ads/search_volume/live` - Batch keyword metrics (up to 1000/call)
   - `/v3/keywords_data/google_ads/keywords_for_keywords/live` - Related keywords
   - `/v3/keywords_data/google_ads/keywords_for_site/live` - Site keyword suggestions
   - `/v3/keywords_data/google/keyword_ideas/live` - Keyword ideas from seeds
   - `/v3/serp/google/organic/live/regular` - Live SERP results (depth=100)
   - `/v3/dataforseo_labs/google/domain_intersection/live` - Competitor keyword gaps
   - `/v3/on_page/content_parsing/live` - JS-rendered HTML scraping
   - `/v3/on_page/raw_html` - Raw HTML fetching

2. **DataForSEO Endpoints Used (AI-Writer Python)**:
   - `/v3/domain_analytics/overview/live` - Domain metrics (authority, backlinks, traffic)
   - `/v3/backlinks/summary/live` - Backlink summary
   - `/v3/dataforseo_labs/google/competitors_domain/live` - Competitor discovery
   - `/v3/dataforseo_labs/google/relevant_pages/live` - Top pages by traffic
   - `/v3/keywords_data/google_ads/search_volume/task_post` - Async keyword volume

3. **Rate Limiting (Redis Token Bucket)**:
   - `dataForSeoRateLimiter = new RedisRateLimiter("dataforseo", 5, 5)` - 5 req/sec, bucket size 5
   - Lua scripting for atomic token acquisition
   - Exponential backoff on 429 responses
   - `acquireToken()` blocks until rate limit allows

4. **Caching Strategy**:
   - **Redis Cache (Keywords)**: 7-day TTL (`CACHE_TTL_SECONDS = 604800`)
   - **R2/File Cache (SERP)**: Persistent storage with TTL-based invalidation
   - **In-Memory Cache**: LRU cache for frequently accessed keyword metrics
   - Cache key pattern: `dataforseo:keyword:{normalized}:{location}:{language}`

5. **Cost Tracking & Metering**:
   - `COST_PER_KEYWORD_CENTS = 0.5` ($0.005/keyword)
   - `recordUsage(workspaceId, 'keyword_enrichment', count)` - Per-workspace metering
   - Autumn integration for billing aggregation
   - `metering_events` table with workspace_id, event_type, quantity, cost_cents

6. **Keyword Gap Analysis** (`dataforseoKeywordGap.ts`):
   - `fetchDomainIntersectionRaw(domains, location, language)` - Up to 5 domains
   - `calculateOpportunityScore(kw)` = searchVolume * cpc * (100 - difficulty) / 100
   - `calculateAchievability(kw, domainAuthority)` = 100 - max(0, difficulty - DA)
   - Returns sorted gaps with opportunity scores

7. **CSV Import (No Direct API)**:
   - Auto-detection of export format: Ahrefs, SEMrush, Moz
   - ColumnDetector maps columns to standard schema
   - Imports keyword, volume, difficulty, CPC, position
   - No direct API integration with Ahrefs/SEMrush/Moz

8. **Authentication**:
   - **open-seo-main**: `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` env vars
   - **AI-Writer**: Same env vars, validated on startup
   - Basic auth header: `Authorization: Basic {base64(login:password)}`

9. **Zod Schema Validation** (`schema/dataforseo.ts`):
   - `KeywordMetricsResponseSchema` - Validates API responses
   - `SerpResultSchema` - SERP result validation
   - `DomainIntersectionSchema` - Gap analysis validation
   - Strict schema parsing with `.parse()` for type safety

10. **Background Processing**:
    - `ranking-worker` BullMQ worker for daily ranking checks
    - `enqueueRankingJob(keywordId, domain, location)` - Schedule ranking check
    - Stores results in `keyword_rankings` table with serpFeatures JSON

11. **Error Handling & Resilience**:
    - Circuit breaker pattern for API failures
    - Retry with exponential backoff (1s, 2s, 4s, max 3 retries)
    - Graceful degradation: returns cached data on API failure
    - Detailed error logging with request context

**What's Missing** (vs Vision in SYSTEM-ANALYSIS.md):

1. **No Direct Ahrefs/SEMrush/Moz API Integration** - Only CSV import, no live API calls

2. **No Competitor Keyword Discovery via API** - Python client has `competitors_domain` but not integrated with keyword intelligence

3. **No Historical Keyword Trends** - Monthly search data exists in response but not visualized

4. **No Backlink Data in Keyword Analysis** - Backlink endpoints exist but not connected to keyword scoring

5. **No Automated Competitor Discovery** - Must manually provide competitor domains for gap analysis

6. **No DataForSEO Cost Optimization** - No batching optimization to reduce API calls

7. **No SERP Feature Tracking** - `serpFeatures` stored but not analyzed for opportunity scoring

8. **No Topic/Question Extraction from SERP** - Live SERP fetched but PAA boxes not extracted

9. **No DataForSEO Labs Location-Based Endpoints** - Missing local pack, map rankings

10. **No Unified DataForSEO Client** - Two separate implementations (Python + TypeScript) with different capabilities

11. **No Cost Alerting** - Metering exists but no alerts when approaching budget limits

**Key Functions**:

| Function | Location | Purpose |
|----------|----------|---------|
| `fetchKeywordMetrics(keywords, location, language)` | `dataforseo.ts:67` | Batch keyword metrics (up to 1000) |
| `fetchRelatedKeywordsRaw(keyword, location, language)` | `dataforseo.ts:165` | Related keyword suggestions |
| `fetchKeywordSuggestionsRaw(domain, location, language)` | `dataforseo.ts:221` | Site-based keyword ideas |
| `fetchKeywordIdeasRaw(seeds, location, language)` | `dataforseo.ts:277` | Keyword ideas from seeds |
| `fetchLiveSerpItemsRaw(keyword, domain, location, language)` | `dataforseo.ts:333` | Live SERP with depth=100 |
| `fetchDomainIntersectionRaw(domains, location, language)` | `dataforseoKeywordGap.ts:45` | Competitor keyword gaps |
| `calculateOpportunityScore(keyword)` | `dataforseoKeywordGap.ts:112` | Volume * CPC * (100-KD) / 100 |
| `calculateAchievability(keyword, da)` | `dataforseoKeywordGap.ts:125` | 100 - max(0, KD - DA) |
| `KeywordEnrichmentService.enrichBatch(keywordIds)` | `KeywordEnrichmentService.ts:89` | Batch enrichment with cache |
| `dataForSeoRateLimiter.acquireToken()` | `redis-rate-limiter.ts:67` | Rate limit acquisition |
| `get_domain_analytics(domain)` | `dataforseo_client.py:34` | Python: domain metrics |
| `get_backlinks_summary(domain)` | `dataforseo_client.py:78` | Python: backlink summary |
| `get_competitor_gaps(domain, competitors)` | `dataforseo_client.py:122` | Python: competitor gap analysis |
| `fetch_all_seo_data(domain)` | `dataforseo_client.py:166` | Python: orchestrated data fetch |
| `scrapeProspectPage(url)` | `dataforseoScraper.ts:402` | JS-rendered HTML via DataForSEO |
| `recordUsage(workspaceId, type, count)` | `queue.ts:189` | Usage metering for billing |
| `CsvImportService.detectFormat(rows)` | `CsvImportService.ts:89` | Ahrefs/SEMrush/Moz detection | 

---

### 8. TAXONOMY: Category/Priority Systems
<!-- Agent 8 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/db/prospect-keyword-schema.ts` - Keyword tiers and composite scoring
- `open-seo-main/src/db/prospect-schema.ts` - OpportunityKeywordCategory enum, KeywordClass enum
- `open-seo-main/src/server/features/keywords/services/KeywordIntelligenceService.ts` - Clustering and gap detection
- `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` - 5-factor scoring with focus weights
- `open-seo-main/src/server/features/keywords/classification/types.ts` - KeywordTypeEnum (product, long_tail, question, local, comparison)
- `open-seo-main/src/server/features/keywords/types/focus-directive.ts` - FocusDirective with CategoryPriority, weight_modifier
- `open-seo-main/src/server/features/keywords/prompts/business-priority-parser.xml` - LLM prompt for extracting priorities
- `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts` - Hardcoded Lithuanian product categories
- `open-seo-main/src/client/components/prospects/OpportunityKeywordsTable.tsx` - Category filter UI
- `AI-Writer/backend/services/intelligence/agents.py` - StrategyArchitectAgent with pillar discovery

**What Exists**:

1. **Keyword Tier System** (`prospect-keyword-schema.ts:40-47`):
   - `KEYWORD_TIERS`: `must_do` (>= 0.75), `should_do` (>= 0.50), `nice_to_have` (>= 0.25), `ignore` (< 0.25)
   - Stored in `prospect_keywords.tier` column
   - Indexed for filtering: `index("ix_prospect_keywords_tier")`

2. **Opportunity Keyword Categories** (`prospect-schema.ts:134-142`):
   - `OPPORTUNITY_KEYWORD_CATEGORIES`: `product`, `brand`, `service`, `commercial`, `informational`
   - Flat enum - NO hierarchy, NO parent-child relationships
   - Used in `OpportunityKeyword.category` field in JSONB

3. **Keyword Classification Types** (`classification/types.ts:14-21`):
   - `KeywordTypeEnum`: `product`, `long_tail`, `question`, `local`, `comparison`
   - Used for intent/type classification, not hierarchical organization

4. **Focus Directive System** (`types/focus-directive.ts`):
   - `CategoryPriority`: `name`, `name_lt`, `weight_modifier` (0.5-2.0), `scope`, `confidence`
   - `AttributePriority`: `attribute`, `boost_factor` (1.1-2.0)
   - `BrandPriority`: `brand`, `action` (PROMOTE/NEUTRAL), `weight_modifier`
   - `CategorySuppression`: `suppress_factor` (0.1-0.9), `reason`
   - `ScoringWeights.category_weights`: `Map<string, number>` for downstream scoring
   - `toScoringWeights(directive)`: Converts FocusDirective to scoring weights

5. **Priority Weighting (5-factor scoring)** (`PrioritizationService.ts:19-33`):
   - Volume: 0.15, Competition: 0.10, Relevance: 0.25, **Focus: 0.35**, Position: 0.15
   - Focus weight is highest - designed to boost priority categories
   - `focusScores: Map<string, number>` passed to `prioritizeKeywords()`
   - Quick win multipliers: striking_distance (1.3x), low_hanging (1.2x), fresh_opportunity (1.15x)

6. **Simple Prefix-Based Clustering** (`KeywordIntelligenceService.ts:489-507`):
   - `clusterKeywords(keywords)`: Groups by 3-character prefix
   - Returns `string[][]` - clusters of keywords
   - Used for gap detection, NOT semantic clustering

7. **Category Suggestion from Clusters** (`KeywordIntelligenceService.ts:513-540`):
   - `suggestCategoryName(keywords)`: Finds most common words in cluster
   - Creates suggested category names from frequent terms

8. **Hardcoded Lithuanian Product Categories** (`ResilientClassifier.ts:75-95`):
   - 15 product type patterns: Sampunai, Kondicionieriai, Kaukes, Aliejai, Serumai, etc.
   - 7 hair type patterns: Riebiems, Sausiems, Dazytiems, Pazeistiems, etc.
   - Pattern-based classification fallback when LLMs unavailable

9. **Category Filter in UI** (`OpportunityKeywordsTable.tsx:214-236`):
   - `categoryFilter: OpportunityKeywordCategory | null` state
   - Dropdown to filter by product/brand/service/commercial/informational
   - `CATEGORY_COLORS` for badge styling

10. **AI Content Pillar Discovery (AI-Writer)** (`agents.py:26-55`):
    - `StrategyArchitectAgent.discover_pillars()`: Uses txtai semantic clustering
    - `cluster(min_score=0.6)` groups related content
    - Returns `pillar_id`, `indices`, `size`, `confidence`

**What's Missing** (vs Vision in SYSTEM-ANALYSIS.md):

1. **NO Persistent Category Table**:
   - Categories are inferred at runtime (FocusDirective, hardcoded patterns)
   - No `categories` table with `id`, `name`, `parent_id`, `weight`, `client_id`
   - Cannot store user-defined categories per client

2. **NO Parent-Child Hierarchy**:
   - OpportunityKeywordCategory is flat enum (product/brand/service/commercial/informational)
   - No `parent_id` foreign key for nested categories
   - No breadcrumb-style category paths (e.g., "Electronics > Phones > iPhones")

3. **NO User-Defined Custom Categories**:
   - Categories are hardcoded or LLM-generated
   - No CRUD API for managing categories
   - No UI for creating/editing category taxonomy

4. **NO Category-to-Site-Structure Mapping**:
   - ScrapedContent has `businessLinks.categories[]` but just URLs
   - No mapping from scraped site categories to keyword taxonomy
   - Missing: "Map /produktai/sampunai to category 'Sampunai'"

5. **Semantic Clustering is Primitive**:
   - Only prefix-based (3-char) clustering in open-seo-main
   - StrategyArchitectAgent uses txtai but not integrated with keyword system
   - Missing: Embedding-based keyword clustering (group "sampunas dazytiems plaukams", "dazytu plauku sampunas" together)

6. **FocusDirective Not Persisted**:
   - Generated per-request via LLM
   - No storage in database for reuse
   - Missing: `focus_directives` table linked to prospect/client

7. **NO Category Weight Persistence**:
   - `toScoringWeights()` creates ephemeral Map objects
   - Missing: Store per-category weights in database
   - Missing: UI to adjust category weights visually

8. **NO Topic Modeling**:
   - No LDA/NMF topic extraction
   - No automatic topic discovery from keyword corpus
   - Keywords are classified into existing categories, not auto-grouped

9. **NO Category Analytics**:
   - Missing: "Category X has 500 keywords, 45% must_do tier"
   - Missing: Volume-by-category dashboard
   - Missing: Category performance tracking over time

10. **Site Hierarchy Integration Missing**:
    - Scraping extracts categories but doesn't build taxonomy
    - No automatic category creation from sitemap/menu structure
    - Missing: "Extract categories from /sitemap.xml and create taxonomy"

**Key Functions**:
- `PrioritizationService.computeCompositeScore(keyword, focusScore)` - 5-factor + focus scoring (`PrioritizationService.ts:73`)
- `PrioritizationService.prioritizeKeywords(prospectId, focusScores?)` - Batch tier assignment (`PrioritizationService.ts:118`)
- `KeywordIntelligenceService.classifyKeyword(keyword, categories)` - Category classification (`KeywordIntelligenceService.ts:138`)
- `KeywordIntelligenceService.detectGaps(keywords, existingCategories)` - Gap detection with clustering (`KeywordIntelligenceService.ts:179`)
- `KeywordIntelligenceService.clusterKeywords(keywords)` - Prefix-based clustering (`KeywordIntelligenceService.ts:489`)
- `KeywordIntelligenceService.suggestCategoryName(cluster)` - Category name suggestion (`KeywordIntelligenceService.ts:513`)
- `toScoringWeights(directive)` - FocusDirective to scoring weights (`focus-directive.ts:406`)
- `getActiveItems(directive, currentDate)` - Extract active priorities/suppressions (`focus-directive.ts:265`)
- `isValidFocusDirective(obj)` - Validate LLM output (`focus-directive.ts:224`)
- `filterByCategory(keywords, category)` - UI category filtering (`OpportunityKeywordsTable.tsx:149`)
- `StrategyArchitectAgent.discover_pillars()` - Semantic pillar discovery (`agents.py:26`) 

---

### 9. FILTERING: Top-N Filtering + Export
<!-- Agent 9 writes here -->

**Status**: complete

**Files Explored**:
- `open-seo-main/src/client/utils/export.ts` - CSV export utilities for keyword gaps
- `open-seo-main/src/client/components/prospects/GapFilterBar.tsx` - Gap analysis filter controls
- `open-seo-main/src/client/components/prospects/KeywordGapTable.tsx` - Virtualized keyword gap table
- `open-seo-main/src/client/components/prospects/QuickWinsTab.tsx` - Quick wins filtering
- `open-seo-main/src/client/components/prospects/OpportunityKeywordsTable.tsx` - Opportunity keywords with category filter
- `open-seo-main/src/client/features/keywords/hooks/useKeywordFiltering.ts` - Keyword research filtering hook
- `open-seo-main/src/client/features/keywords/keywordResearchTypes.ts` - Filter types and result limits
- `open-seo-main/src/client/features/keywords/page/keywordResearchDesktopFilters.tsx` - Desktop filter UI components
- `open-seo-main/src/client/features/domain/domainFiltering.ts` - Domain keyword filtering logic
- `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` - Tier-based prioritization
- `open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts` - Top-N competitor keywords
- `open-seo-main/src/server/features/keywords/types/focus-directive.ts` - Excluded brands/terms tracking
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/page.tsx` - Keyword list page with filters
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/actions.ts` - Server actions for keyword filtering
- `apps/web/src/app/(shell)/prospects/[prospectId]/keywords/components/TierFilter.tsx` - Tier filter UI
- `apps/web/src/components/prospects/KeywordSelector.tsx` - Keyword checkbox selection
- `apps/web/src/components/dashboard/ExportDialog.tsx` - Export dialog with column selection
- `apps/web/src/lib/export/csv.ts` - Generic CSV export utility
- `apps/web/src/lib/export/pdf.ts` - Print-friendly PDF generation

**What Exists**:

1. **Multi-Criteria Filtering (Client-Side)**:
   - `KeywordFilterValues` type: include/exclude terms, minVol/maxVol, minCpc/maxCpc, minKd/maxKd (`keywordResearchTypes.ts:7-16`)
   - `GapFilters` interface: minVolume, maxDifficulty, selectedCompetitors (`GapFilterBar.tsx:27-31`)
   - `applyKeywordFiltersAndSort()`: Filters by include/exclude terms AND numeric ranges (`useKeywordFiltering.ts:8-63`)
   - `applyGapFilters()`: Filters by volume, difficulty, competitors (`GapFilterBar.tsx:264-288`)
   - `filterByCategory()`: Filters by keyword category (product/brand/service/commercial/informational) (`OpportunityKeywordsTable.tsx:149-154`)
   - `filterAndSortKeywords()`: Domain keywords with traffic, volume, CPC, KD, rank filters (`domainFiltering.ts:29-111`)

2. **Tier-Based Filtering**:
   - `TierFilter` component: Must-Do, Should-Do, Nice-to-Have, Ignore with badge counts (`TierFilter.tsx:18-74`)
   - Server-side tier filtering via `getKeywords(prospectId, { tier: 'must_do' })` (`actions.ts:86-169`)
   - Quick win toggle filter: `showQuickWins` checkbox (`page.tsx:63`)

3. **Quick Win Filtering**:
   - Quick Win criteria: `difficulty < 30 AND searchVolume > 100 AND achievability > 70` (`QuickWinsTab.tsx:38-41`)
   - `filterQuickWins()`: Applies quick win criteria (`QuickWinsTab.tsx:46-48`)
   - Achievability calculated from difficulty and domain authority

4. **Result Limit Options**:
   - `ResultLimit` type: 150, 300, 500 options (`keywordResearchTypes.ts:1-2`)
   - Server-side limit parameter: `limit: 100` default in keyword fetch (`page.tsx:86`)
   - Competitor spy default: `DEFAULT_LIMIT = 100` (`CompetitorSpyService.ts:24`)

5. **CSV Export**:
   - `exportKeywordGaps()`: Exports gaps with headers: Keyword, Competitor, Position, Volume, CPC, Difficulty, Opportunity Score (`export.ts:48-75`)
   - `downloadCsv()`: Triggers browser download with blob URL (`export.ts:82-96`)
   - `generateExportFilename()`: Creates timestamped filename with domain (`export.ts:104-109`)
   - CSV injection prevention: FORMULA_TRIGGERS sanitization (`export.ts:11`)
   - `exportKeywordsCsv()`: Server action for keyword CSV export (`actions.ts:338-365`)
   - `generateCSV()` and `generateCSVContent()`: Generic CSV with BOM for Excel (`apps/web/src/lib/export/csv.ts:57-95`)

6. **PDF Export**:
   - `generatePDF()`: Opens print-friendly HTML in new window (`apps/web/src/lib/export/pdf.ts:316-342`)
   - Column selection, orientation (portrait/landscape), page numbers, footer
   - `ExportDialog` component: Format selection (CSV/PDF), column picker, filename input (`ExportDialog.tsx:65-294`)

7. **Bulk Selection**:
   - `KeywordSelector` component: Checkbox-based keyword selection (`KeywordSelector.tsx:19-129`)
   - `selectedIds` state with Set for bulk actions (`page.tsx:68`)
   - Bulk tier update: `bulkUpdateTier(prospectId, keywordIds, tier)` (`actions.ts:264-333`)

8. **Excluded Terms Tracking**:
   - `ScoringWeights.excluded_brands` and `excluded_terms` Sets (`focus-directive.ts:210-211`)
   - Used in keyword scoring to demote or exclude certain keywords

**What's Missing (vs Vision in SYSTEM-ANALYSIS.md)**:

1. **NO Configurable Top-N Limit for Proposals**:
   - Proposals hardcoded to `keywordGaps.slice(0, 10)` (`ProposalGeneratorService.ts:332`)
   - Vision requires: User-defined limit (100-200 keywords for proposals)
   - Missing: UI to set top-N limit, backend support for variable limits

2. **NO Excluded Keywords Export**:
   - Vision: "Export excluded keywords for reference"
   - Current: CSV exports only selected/filtered keywords
   - Missing: "Export excluded" button, separate file for non-selected keywords

3. **NO Filter Presets/Templates**:
   - No saved filter configurations
   - Missing: "Save as preset", "Load preset" for common filter combinations
   - No "BOFU only" or "Quick wins in Vilnius" preset buttons

4. **NO Intent-Based Filtering (BOFU/MOFU/TOFU)**:
   - Intent badge exists but NO filter control for it
   - Current filters: volume, difficulty, CPC, category, tier
   - Missing: Intent dropdown/checkbox in GapFilterBar

5. **NO Geographic Filtering**:
   - Vision: "city-specific vs generic" filtering
   - No geo field in filter UI
   - Missing: City/region extraction and filter controls

6. **NO AND/OR Filter Logic Configuration**:
   - All filters use implicit AND logic (all conditions must match)
   - Missing: OR option for filter groups (e.g., "BOFU OR volume > 1000")
   - Missing: Grouped filter UI with AND/OR toggle

7. **NO Filtering + Prioritization Integration**:
   - Filters and prioritization (tier assignment) are separate
   - Missing: "Apply filters, then prioritize remaining" workflow
   - Missing: Filtered keywords auto-mapped to tier

8. **NO JSON Export for Keywords**:
   - Only CSV and PDF export available
   - Missing: JSON export for programmatic use

9. **LIMITED Top-N in UI**:
   - `ResultLimit` only offers 150/300/500
   - Vision requires: Custom top-N input (e.g., "Top 100", "Top 200")
   - CompetitorSpyService allows variable limit but no UI control

**Key Functions**:

| Function | Location | Purpose |
|----------|----------|---------|
| `applyKeywordFiltersAndSort()` | `useKeywordFiltering.ts:8` | Multi-criteria keyword filtering + sorting |
| `applyGapFilters()` | `GapFilterBar.tsx:264` | Volume/difficulty/competitor filter |
| `filterByCategory()` | `OpportunityKeywordsTable.tsx:149` | Category-based filtering |
| `filterAndSortKeywords()` | `domainFiltering.ts:29` | Domain keyword filtering with traffic |
| `filterQuickWins()` | `QuickWinsTab.tsx:46` | Quick win criteria filter |
| `useKeywordFiltering()` | `useKeywordFiltering.ts:65` | React hook for keyword filtering |
| `exportKeywordGaps()` | `export.ts:48` | CSV string generation for gaps |
| `downloadCsv()` | `export.ts:82` | Browser download trigger |
| `generateCSV()` | `csv.ts:83` | Generic CSV with BOM |
| `generatePDF()` | `pdf.ts:316` | Print-friendly PDF generation |
| `exportKeywordsCsv()` | `actions.ts:338` | Server action for keyword export |
| `TierFilter` component | `TierFilter.tsx:25` | Tier filter buttons with counts |
| `GapFilterBar` component | `GapFilterBar.tsx:51` | Gap analysis filter controls |
| `KeywordSelector` component | `KeywordSelector.tsx:19` | Checkbox keyword selection |
| `ExportDialog` component | `ExportDialog.tsx:65` | Export format/column picker |
| `bulkUpdateTier()` | `actions.ts:264` | Bulk tier assignment server action |
| `spyOnCompetitor()` | `CompetitorSpyService.ts:65` | Top-N competitor keywords with limit param | 

---

### 10. EMBEDDINGS: Semantic Matching Infrastructure
<!-- Agent 10 writes here -->

**Status**: complete

**Files Explored**:
- `AI-Writer/backend/lib/graphrag/embedding_service.py` - Jina v3 API client with in-memory caching
- `AI-Writer/backend/services/txtai_service.py` - TxtAI service with sentence-transformers (all-MiniLM-L6-v2)
- `AI-Writer/benchmark/run_benchmark.py` - Jina v3/v5-nano/v5-small benchmark orchestrator
- `AI-Writer/benchmark/embed_local.py` - Local sentence-transformers embedding for benchmarks
- `AI-Writer/benchmark/results/REPORT.md` - Benchmark results (v5-nano: 98.3% recall, 12x faster)
- `open-seo-main/src/db/embedding-schema.ts` - Product/keyword embeddings schema (halfvec(384))
- `open-seo-main/src/db/graphrag-schema.ts` - GraphRAG chunks schema (halfvec(768))
- `open-seo-main/src/server/features/keywords/services/EmbeddingService.ts` - Unified embedding service (stub implementation)
- `open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts` - Resilient embedding with ONNX/Jina cascade
- `open-seo-main/src/server/features/keywords/services/KeywordIntelligenceService.ts` - Uses embeddings for product matching
- `open-seo-main/src/server/features/keywords/config/embeddings.ts` - Embedding configuration (jina-v3, 384-dim storage)
- `open-seo-main/src/server/features/keywords/types/embeddings.ts` - Embedding type definitions
- `.planning/prompts/keyword-product-matcher.ts` - Keyword-to-product matching with embedding scores

**What Exists**:

**1. Two Independent Embedding Systems:**

**A. AI-Writer (Python/FastAPI):**
- `JinaEmbeddingService` (`embedding_service.py:20-156`): Jina v3 API client
  - 768-dim embeddings (configurable via `dimensions` parameter)
  - Task-specific embeddings: `retrieval.query`, `retrieval.passage`, `text-matching`, `classification`, `separation`
  - In-memory SHA256-based cache for deduplication
  - Singleton pattern with `get_embedding_service()` and `embed_passages()`/`embed_query()` module functions
  - Uses httpx async client with 60s timeout

- `TxtaiIntelligenceService` (`txtai_service.py:127-497`): Local semantic indexing
  - Model: `sentence-transformers/all-MiniLM-L6-v2` (~80MB)
  - SharedEmbeddingsManager singleton for memory efficiency (model shared across users)
  - FAISS backend with quantization for CPU inference
  - Per-user indices stored at `workspace/workspace_{user_id}/indices/txtai`
  - Methods: `index_content()`, `search()`, `get_similarity()`, `cluster()`, `classify()`
  - Semantic caching integration with TTL support

**B. open-seo-main (TypeScript/Node.js):**
- `UnifiedEmbeddingService` (`EmbeddingService.ts:157-449`): Primary service
  - Model: jina-embeddings-v3 (native 1024-dim, Matryoshka truncation to 384-dim)
  - Fallback: multilingual-e5-base
  - Prefixes: "query: " for queries, "passage: " for documents
  - Float32Array for memory efficiency
  - Batch processing with configurable batch size (default 32)
  - Cache layer interface with `setCache()` method
  - **NOTE: Uses stub/mock DefaultModelProvider - not actual ONNX inference yet**

- `ResilientEmbedding` (`ResilientEmbedding.ts:209-423`): Fault-tolerant embedding
  - Three-tier cascade: Local ONNX (primary) -> Jina API (fallback) -> Zero vectors (last resort)
  - Circuit breaker for Jina API (failureThreshold=3, resetTimeout=60s)
  - In-memory LRU cache (10,000 entries, 1hr TTL)
  - **NOTE: LocalONNXEmbedding uses hash-based mock vectors, not actual inference**

**2. Database Schemas (Drizzle):**

- `productEmbeddings` table (`embedding-schema.ts:64-95`):
  - `halfvec(384)` custom type for 50% storage reduction
  - Columns: tenantId, productSku, productUrl, contentHash (for deduplication), productName, embedding
  - Indexes: tenant isolation, tenant+SKU lookup, unique tenant+contentHash

- `keywordEmbeddings` table (`embedding-schema.ts:103-123`):
  - Global (not per-tenant) for cross-tenant cache sharing
  - Columns: keyword (unique), normalizedKeyword, embedding
  - Indexes: keyword lookup, normalized search

- `graphragChunks` table (`graphrag-schema.ts:66-114`):
  - `halfvec(768)` for higher fidelity GraphRAG retrieval
  - Columns: tenantId, workspaceId, docId, chunkIndex, content, embedding, metadata
  - Unique constraint on (tenantId, docId, chunkIndex) for incremental updates

**3. Vector Search Infrastructure:**
- DiskANN indexes via pgvectorscale extension for 100M+ vector scale
- `halfvec_cosine_ops` distance metric with memory_optimized storage layout
- `diskann.query_rescore = 50` for filtered query recall improvement
- SQL helpers: `vectorQueries.findSimilarProducts()`, `vectorQueries.findSimilarKeywords()`

**4. Embedding Configuration (`config/embeddings.ts`):**
- Primary: `jinaai/jina-embeddings-v3` (native 1024-dim)
- Fallback: `intfloat/multilingual-e5-base` (native 768-dim)
- Storage: 384-dim (Matryoshka truncation)
- INT8 quantization for CPU inference
- Environment overrides: `EMBEDDING_MODEL`, `EMBEDDING_STORAGE_DIM`, `EMBEDDING_DEVICE`

**5. Keyword-to-Product Semantic Matching (`KeywordIntelligenceService.ts:273-290`):**
- `extractProductMatches(keyword, products)` method
- Embeds keyword with `embedQuery()` and products with `embedPassages()`
- Calculates `cosineSimilarity()` for semantic scoring
- Returns ranked matches with similarity scores

**6. Benchmark Results (`benchmark/results/REPORT.md`):**
- v3: 98.0% LT Recall@10, 458ms/doc
- v5-nano: 98.3% LT Recall@10, 37ms/doc (**12x faster with equal quality**)
- v5-small: 98.3% LT Recall@10, 527ms/doc
- 100% category accuracy across all models

**7. Utility Functions:**
- `cosineSimilarity(a, b)` - Dot product of normalized vectors
- `findTopK(query, candidates, k)` - Top-k similar vector search
- `normalizeVector()`, `truncateVector()` - Vector processing

**What's Missing (vs Vision)**:

1. **No Production Model Inference**: Both `UnifiedEmbeddingService` and `ResilientEmbedding` use mock/stub implementations. Real ONNX or Transformers.js inference not implemented.

2. **No Keyword -> Page Semantic Matching**: Vision requires matching keywords to site pages. Current implementation only has keyword -> product matching in KeywordIntelligenceService.

3. **No Side Keyword Discovery**: No semantic expansion (e.g., "fitline produktai" -> "papildai nuo sanariu skausmo"). Need embedding-based related keyword suggestion.

4. **No Embedding-Based Clustering**: `TxtaiIntelligenceService.cluster()` exists but uses fallback method. No proper HDBSCAN/k-means clustering integrated.

5. **No Semantic Deduplication**: Schema mentions `contentHash` for deduplication but no embedding-based duplicate detection (cosine similarity threshold).

6. **No Cross-Platform Embedding Sync**: AI-Writer (Python) and open-seo-main (TypeScript) use different embedding systems. No unified embedding API or shared embedding cache.

7. **Not Using v5-nano**: Benchmark shows v5-nano is 12x faster with equal/better quality (98.3% vs 98.0% recall), but code still references jina-embeddings-v3.

8. **No pgvector Migration**: DiskANN index SQL defined but migration not executed. Embedding tables exist in schema but not in production.

9. **No Streaming Embeddings**: Large batch embedding could use streaming response for progress tracking.

10. **No Embedding Quality Monitoring**: No tracking of embedding latency, cache hit rates, or quality metrics in production.

**Key Functions**:

**AI-Writer (Python):**
- `JinaEmbeddingService.embed(texts, task, dimensions)` - Jina v3 API call with caching (`embedding_service.py:55-126`)
- `JinaEmbeddingService.embed_query(query)` - Single query embedding (`embedding_service.py:128-139`)
- `JinaEmbeddingService.embed_passages(passages)` - Batch passage embedding (`embedding_service.py:141-151`)
- `TxtaiIntelligenceService.index_content(items)` - Index (id, text, metadata) tuples (`txtai_service.py:195-237`)
- `TxtaiIntelligenceService.search(query, limit)` - Semantic search with caching (`txtai_service.py:239-278`)
- `TxtaiIntelligenceService.get_similarity(text1, text2)` - Cosine similarity (`txtai_service.py:280-326`)
- `TxtaiIntelligenceService.cluster(min_score)` - Graph-based clustering (`txtai_service.py:328-390`)
- `embed_products_local(model, model_key, products)` - Local benchmark embedding (`embed_local.py:167-175`)

**open-seo-main (TypeScript):**
- `UnifiedEmbeddingService.embedQuery(text, options)` - Query embedding (`EmbeddingService.ts:209-224`)
- `UnifiedEmbeddingService.embedPassages(texts, options)` - Batch passage embedding (`EmbeddingService.ts:181-199`)
- `UnifiedEmbeddingService.embedQueryWithMetadata(text)` - Query with metadata (`EmbeddingService.ts:261-283`)
- `getEmbeddingService()` - Singleton accessor (`EmbeddingService.ts:461-466`)
- `lightragEmbeddingFunc(texts)` - LightRAG adapter (`EmbeddingService.ts:498-504`)
- `cosineSimilarity(a, b)` - Vector similarity (`EmbeddingService.ts:514-525`)
- `findTopK(query, candidates, k)` - Top-k search (`EmbeddingService.ts:530-543`)
- `ResilientEmbedding.embed(text)` - Single embedding with fallback (`ResilientEmbedding.ts:245-248`)
- `ResilientEmbedding.embedBatch(texts)` - Batch with cascade fallback (`ResilientEmbedding.ts:257-326`)
- `vectorQueries.findSimilarProducts(tenantId, queryVector, limit)` - SQL query helper (`embedding-schema.ts:170-189`)
- `vectorQueries.findSimilarKeywords(queryVector, limit)` - SQL query helper (`embedding-schema.ts:199-210`)

**Recommendation:**
Switch from jina-embeddings-v3 to jina-embeddings-v5-text-nano for production use:
- **12x faster** (37ms vs 458ms per document)
- **Equal or better quality** (98.3% vs 98.0% LT Recall@10)
- Lower API costs at scale
- Same API interface (just change model parameter)
- Maintain v3 as fallback for edge cases 

---

## SYNTHESIS (All 10 Agents Complete)

### Summary: What Exists (Strong Foundation)

| Area | Score | Key Capabilities |
|------|-------|------------------|
| **KEYWORD-CORE** | 85% | 5 keyword tables, KeywordIntelligenceService, 5-factor prioritization, QuickWinDetector, CSV import (Ahrefs/SEMrush/Moz), LithuanianNormalizer |
| **SCRAPING** | 75% | BrightData CDP, sitemap parsing, robots.txt compliance, delta sync (hash-based), 4-layer cascade, per-client isolation |
| **INTENT** | 40% | Two-pass LLM classification (Grok + Claude), 5 keyword types, 4 intent types, AdaptiveIntentRouter |
| **CHAT-UI** | 30% | CopilotKit PlatformPersonaChat, agent framework, TxtAI semantic memory, brainstorm APIs |
| **PROPOSALS** | 80% | Full lifecycle (draft→signed→paid), template system (3-tier), versioning, PDF/CSV export, e-signature, payments |
| **ONBOARDING** | 60% | AI extraction (Claude Sonnet), tier-based checklists, auto-completion, prospect→client conversion |
| **DATAFORSEO** | 90% | 13 endpoints (8 TS + 5 Python), Redis rate limiting, 7-day cache, R2 SERP cache, cost metering, gap analysis |
| **TAXONOMY** | 35% | 4-tier system, FocusDirective types (ephemeral), prefix-based clustering, hardcoded LT categories |
| **FILTERING** | 55% | Volume/difficulty/CPC/category/tier filters, CSV/PDF export, bulk tier ops, quick win toggle |
| **EMBEDDINGS** | 45% | Jina v3 API (AI-Writer), TxtAI local, stub in open-seo-main, DiskANN schema ready, benchmark complete |

**Overall Foundation Score: 60%** — Solid infrastructure exists but key vision components missing.

---

### Summary: What's Missing (Critical Gaps)

#### 🔴 HIGH PRIORITY (Blocks Vision)

| Gap | Vision Need | Current State | Impact |
|-----|-------------|---------------|--------|
| **BOFU/MOFU/TOFU Classification** | Funnel-based filtering | Only 4 generic intent types | Can't filter by purchase intent |
| **Priority Categories Capture** | Client specifies focus | No schema field | Can't weight categories |
| **Geographic Intent Detection** | City-specific keywords | Only ISO country code | Can't do local SEO |
| **Chat Keyword Endpoint** | AI chat for analysis | CopilotKit exists but no keyword tools | No conversational workflow |
| **Configurable Top-N Proposals** | Select 100-200 keywords | Hardcoded `slice(0, 10)` | Can't customize proposal size |
| **Excluded Keywords Export** | Export non-selected | No implementation | Client can't see alternatives |

#### 🟡 MEDIUM PRIORITY (Enhances Vision)

| Gap | Vision Need | Current State | Impact |
|-----|-------------|---------------|--------|
| **Side Keyword Discovery** | Semantic expansion | No embedding-based expansion | Miss "fitline → papildai" opportunities |
| **Conversation Memory** | Remember preferences | In-memory only (React state) | Repeat setup each session |
| **Category Persistence** | Save category hierarchy | FocusDirective ephemeral | Recreate each request |
| **Embedding v5-nano Switch** | 12x faster inference | Still using v3 | Slower API, higher costs |
| **Keyword→Page Matching** | Match to site structure | Only keyword→product | Can't map to pages |
| **Intent Filter UI** | Filter by BOFU/MOFU | Badge exists, no filter control | Display-only intent |

#### 🟢 LOWER PRIORITY (Nice to Have)

| Gap | Vision Need | Current State |
|-----|-------------|---------------|
| Streaming chat responses | Progressive display | Full response only |
| JSON export | Programmatic access | CSV/PDF only |
| Filter presets | Save filter configs | Manual each time |
| Cross-platform embedding sync | Unified API | Python/TS separate |
| Embedding quality monitoring | Track performance | No metrics |

---

### Gap Analysis: Priority Implementation Order

Based on user vision (chat-first, priority-weighted keyword analysis), here's the recommended order:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PRIORITY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: SCHEMA + CLASSIFICATION (Foundation)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Add schema fields: focusCategories, targetCities, funnelFocus   │   │
│  │ 2. Implement BOFU/MOFU/TOFU classifier (LLM-based)                  │   │
│  │ 3. Add geographic intent detection (city extraction)               │   │
│  │ 4. Switch embedding model to v5-nano (12x faster)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE 2: CHAT INTERFACE (Primary Endpoint)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Create /api/keyword-chat endpoint                                │   │
│  │ 2. Connect CopilotKit to keyword analysis tools                     │   │
│  │ 3. Add conversation memory (persist to DB)                          │   │
│  │ 4. Implement streaming responses                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE 3: FILTERING + EXPORT (User Workflow)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Add intent filter UI (BOFU/MOFU/TOFU toggles)                    │   │
│  │ 2. Add geographic filter UI (city dropdown)                         │   │
│  │ 3. Make top-N configurable (not hardcoded 10)                       │   │
│  │ 4. Add excluded keywords export                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE 4: SEMANTIC EXPANSION (Intelligence)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Implement side keyword discovery (embedding similarity)          │   │
│  │ 2. Add keyword → page matching (scrape + match)                     │   │
│  │ 3. Create persistent category taxonomy table                        │   │
│  │ 4. Implement embedding-based clustering                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  PHASE 5: INTEGRATION (End-to-End)                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Connect onboarding → keyword preferences                         │   │
│  │ 2. Auto-populate proposals with top-N keywords                      │   │
│  │ 3. Cross-platform embedding sync (Python ↔ TypeScript)              │   │
│  │ 4. Production deployment + monitoring                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Recommended GSD Phases

| Phase | Name | Priority | Est. Hours | Dependencies |
|-------|------|----------|------------|--------------|
| **75** | Schema: Focus Categories + Geo + Funnel Fields | P0 | 2h | None |
| **76** | BOFU/MOFU/TOFU Classifier | P0 | 4h | 75 |
| **77** | Geographic Intent Detector | P0 | 3h | 75 |
| **78** | Embedding Model Switch (v3 → v5-nano) | P0 | 2h | None |
| **79** | Keyword Chat Endpoint | P1 | 6h | 76, 77 |
| **80** | Conversation Memory Persistence | P1 | 4h | 79 |
| **81** | Intent + Geo Filter UI | P1 | 4h | 76, 77 |
| **82** | Configurable Top-N Proposals | P1 | 3h | None |
| **83** | Excluded Keywords Export | P1 | 2h | 82 |
| **84** | Side Keyword Discovery | P2 | 6h | 78 |
| **85** | Keyword → Page Matching | P2 | 5h | 78, scraping |
| **86** | Persistent Category Taxonomy | P2 | 4h | 75 |
| **87** | Embedding-Based Clustering | P2 | 4h | 78 |
| **88** | Onboarding → Keyword Preferences | P2 | 3h | 75, 86 |
| **89** | Auto-Populate Proposals | P2 | 3h | 82, 88 |
| **90** | Cross-Platform Embedding Sync | P3 | 4h | 78 |

**Total Estimated: 59 hours across 16 phases**

---

### Quick Wins (Can Ship This Week)

1. **Switch to v5-nano** (Phase 78, 2h) — Change model config, 12x faster
2. **Configurable top-N** (Phase 82, 3h) — Remove hardcoded `slice(0,10)`
3. **Schema fields** (Phase 75, 2h) — Add focusCategories, targetCities, funnelFocus to schema

### Blockers to Investigate

1. **pgvector migration** — DiskANN schema defined but migration not run
2. **CopilotKit tools** — Need to understand tool definition API
3. **Conversation persistence** — Where to store? Separate table vs existing?

---

### Key Files to Modify (Reference)

| Component | Primary Files |
|-----------|---------------|
| Schema | `open-seo-main/src/db/prospect-schema.ts`, `client-schema.ts` |
| Classification | `open-seo-main/src/server/features/keywords/classification/` |
| Chat | `AI-Writer/frontend/src/components/shared/CopilotKit/` |
| Filtering | `open-seo-main/src/client/components/prospects/GapFilterBar.tsx` |
| Export | `open-seo-main/src/client/utils/export.ts` |
| Proposals | `open-seo-main/src/server/features/proposals/` |
| Embeddings | `AI-Writer/backend/lib/graphrag/embedding_service.py` |
