# RESEARCH-08: Publishing Automation

> **Agent:** 8 of 20  
> **Stream:** B (Content Calendar)  
> **Topic:** GSC URL submission, IndexNow integration, WordPress/CMS publishing, social scheduling, post-publish monitoring  
> **Researched:** 2026-05-11  
> **Confidence:** HIGH

---

## Executive Summary

TeveroSEO already has mature publishing automation infrastructure. The key findings:

1. **GSC URL Submission** — Fully implemented in AI-Writer via `gsc_service.py` using Google Indexing API (service account auth)
2. **IndexNow Integration** — Comprehensive Phase 97 specification + UI hooks exist in `apps/web`, ready for integration
3. **CMS Publishing** — Multi-CMS support (WordPress, Shopify, Wix, Webhook) via abstract publisher pattern
4. **Social Scheduling** — Partial: LinkedIn persona generation exists, no direct social API integration yet
5. **Post-Publish Monitoring** — ArticleRankSnapshot model tracks keyword positions over time

**Critical Gap:** GSC URL Submission currently uses Google Indexing API which is harmful for non-job content. Must be replaced with IndexNow + sitemap lastmod signals.

---

## 1. GSC URL Submission

### Current Implementation

**Location:** `AI-Writer/backend/services/gsc_service.py`

```python
# GSCService.submit_url_for_indexing()
# Uses Google Indexing API v3 with service account authentication

INDEXING_SCOPES = ['https://www.googleapis.com/auth/indexing']
ALLOWED_INDEXING_ACTIONS = {'URL_UPDATED', 'URL_DELETED'}

def submit_url_for_indexing(self, url: str, action: str = "URL_UPDATED") -> Dict[str, Any]:
    """Submit URL to Google Indexing API."""
    # Validates URL, loads service account credentials
    # POSTs to indexing.googleapis.com/v3/urlNotifications:publish
```

**Integration Point:** `AI-Writer/backend/services/auto_publish_executor.py`

```python
def _submit_to_gsc(article_id: str, url: str) -> None:
    """Called post-publish in _save_result() after database commit."""
    gsc_service = GSCService()
    gsc_result = gsc_service.submit_url_for_indexing(url)
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURRENT GSC SUBMISSION FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Article Published                                                          │
│        │                                                                    │
│        ▼                                                                    │
│  _save_result() commits to DB                                               │
│        │                                                                    │
│        ▼                                                                    │
│  _submit_to_gsc(article_id, url)   ◄── Non-blocking, post-commit           │
│        │                                                                    │
│        ▼                                                                    │
│  GSCService.submit_url_for_indexing()                                       │
│        │                                                                    │
│        ▼                                                                    │
│  Google Indexing API v3                                                     │
│  POST indexing.googleapis.com/v3/urlNotifications:publish                   │
│        │                                                                    │
│        ├── 200: Success logged                                              │
│        └── Error: Logged as warning (non-blocking)                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Implementation

| Aspect | Implementation |
|--------|---------------|
| Authentication | Service account JSON file (`GSC_SERVICE_ACCOUNT_JSON` env var) |
| URL Validation | `validate_indexing_url()` prevents SSRF, validates scheme/host |
| Timeout | 30-second HTTP timeout (`GSC_API_TIMEOUT_SECONDS`) |
| Error Handling | `ExternalServiceError` with context, non-blocking failures |

### open-seo-main GSC Client

**Location:** `open-seo-main/src/server/services/analytics/gsc-client.ts`

Handles GSC analytics data fetching:
- `fetchGSCDateMetrics()` — Daily aggregate metrics
- `fetchGSCTopQueries()` — Top 50 queries per day
- `fetchGSCQueryPageMetrics()` — Query-page pairs for cannibalization detection
- 3-day data delay handling (GSC data is delayed)

**Note:** This client does NOT handle URL submission — that's in AI-Writer.

---

## 2. IndexNow Integration

### Phase 97 Specification (Complete)

TeveroSEO has comprehensive IndexNow planning in Phase 97:

| Document | Purpose |
|----------|---------|
| `97-RESEARCH.md` | Technical validation, pitfalls, patterns |
| `SPEC.md` | Full database schema, worker config, architecture |
| `ONBOARDING-INTEGRATION.md` | CMS adapter patterns |
| `VIBE-CODED-PLATFORM-INTEGRATION.md` | Platform detection signatures |

### Why IndexNow Instead of Google Indexing API

**Critical Finding from Phase 97 Research:**

> Google Indexing API is restricted to `JobPosting` and `BroadcastEvent` schema only. Using it for regular content signals to Google that content is "ephemeral" — actively harming SEO rankings.

| Protocol | Use Case | Search Engines |
|----------|----------|----------------|
| **IndexNow** | All content types | Bing, Yandex, Naver, Seznam |
| **Google Indexing API** | Job postings only | Google (restricted) |
| **Sitemap lastmod** | Crawl scheduling | Google, all engines |

### Current IndexNow Code

**Frontend Hooks:** `apps/web/src/hooks/use-indexnow-instructions.ts`

```typescript
// Manages manual IndexNow key deployment flow
export function useIndexNowInstructions({
  apiKey,
  domain,
  initialPlatform,
  // ...
}): UseIndexNowInstructionsReturn {
  // Platform selection → Instructions → Verification flow
}
```

**Platform Templates:** `apps/web/src/lib/indexnow/instruction-templates.ts`

Supports 10 platforms:
- WordPress (auto-deploy possible via REST API)
- Shopify (Liquid template modification)
- Wix (Velo router code)
- Squarespace (limited .txt support)
- Webflow (asset upload)
- Vercel (public folder)
- Netlify (static folder)
- cPanel (file manager)
- Cloudflare (Crawler Hints toggle)
- FTP (generic upload)

### Proposed IndexNow Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROPOSED PUBLISHING AUTOMATION FLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Article Published                                                          │
│        │                                                                    │
│        ▼                                                                    │
│  1. Database Commit (existing)                                              │
│        │                                                                    │
│        ├───────────────────────────────────────────────────────────┐        │
│        │                                                           │        │
│        ▼                                                           ▼        │
│  2a. IndexNow Submission                              2b. Sitemap Update   │
│      │                                                    │                 │
│      ▼                                                    ▼                 │
│  Queue URL to Redis batching                         Update lastmod        │
│  (30s delay for publish priority)                    Ping search engines   │
│      │                                                                      │
│      ▼                                                                      │
│  BullMQ: indexnow-submit                                                   │
│      │                                                                      │
│      ▼                                                                      │
│  POST api.indexnow.org/IndexNow                                            │
│  → Notifies: Bing, Yandex, Naver, Seznam                                   │
│                                                                             │
│        │                                                                    │
│        ▼                                                                    │
│  3. Link Graph Update (existing)                                           │
│        │                                                                    │
│        ▼                                                                    │
│  4. Rank Tracking Init (existing)                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### IndexNow Database Schema (from Phase 97 SPEC)

```sql
CREATE TABLE indexnow_config (
  id TEXT PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  api_key_encrypted TEXT NOT NULL,           -- AES-256-GCM
  domains JSONB DEFAULT '[]'::jsonb,
  verification_status JSONB DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT true,
  auto_submit_publish BOOLEAN DEFAULT true,
  delay_publish INTEGER DEFAULT 30,          -- seconds
  delay_update INTEGER DEFAULT 300,
  delay_seo_fix INTEGER DEFAULT 3600,
  total_urls_submitted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE indexnow_submissions (
  id SERIAL PRIMARY KEY,
  client_id UUID NOT NULL,
  domain TEXT NOT NULL,
  urls TEXT[] NOT NULL,
  response_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. WordPress/CMS Publishing

### Abstract Publisher Pattern

**Location:** `AI-Writer/backend/services/cms_publisher/`

```
cms_publisher/
├── abstract_publisher.py     # Base class + PublishResult dataclass
├── publisher_factory.py      # Factory: cms_type → concrete publisher
├── wordpress_publisher.py    # WordPress REST API implementation
├── shopify_publisher.py      # Shopify Admin API implementation
├── wix_publisher.py          # Wix API implementation
└── webhook_publisher.py      # Generic webhook for custom CMSs
```

### AbstractPublisher Interface

```python
@dataclass
class PublishResult:
    success: bool
    post_id: Optional[str] = None
    post_url: Optional[str] = None
    error: Optional[str] = None
    http_status_code: Optional[int] = None
    idempotency_key: Optional[str] = None  # DFI-010: Duplicate prevention

class AbstractPublisher(ABC):
    @abstractmethod
    def publish(
        self,
        title: str,
        content_html: str,
        meta_description: str = "",
        tags: list[str] | None = None,
        categories: list[str] | None = None,
        idempotency_key: Optional[str] = None,
    ) -> PublishResult:
        """Never raises — returns PublishResult(success=False) on error."""
```

### WordPress Publisher Details

**Authentication:** Application Passwords (WordPress 5.6+)
- Credentials stored encrypted in `ClientSettings.wp_app_password_encrypted`
- Basic Auth: `username:application_password` (base64 encoded)

**Features:**
- Category/tag creation on-the-fly via `get_or_create_category()`
- Idempotency cache (15-minute TTL) prevents duplicate posts
- SHA-256 content hashing for idempotency key generation

```python
class WordPressPublisher(AbstractPublisher):
    def publish(self, title, content_html, ...):
        # 1. Check idempotency cache
        # 2. Resolve categories/tags to IDs
        # 3. POST to /wp-json/wp/v2/posts
        # 4. Store result in idempotency cache
```

### Publisher Factory

```python
def get_publisher(client_settings: ClientSettings) -> AbstractPublisher:
    cms_type = (client_settings.cms_type or "").strip().lower()
    if cms_type == "wordpress":
        return WordPressPublisher(client_settings)
    elif cms_type == "shopify":
        return ShopifyPublisher(client_settings)
    elif cms_type == "wix":
        return WixPublisher(client_settings)
    elif cms_type == "webhook":
        return WebhookPublisher(client_settings)
    else:
        raise ValueError(f"Unknown cms_type {cms_type!r}")
```

### Auto-Publish Execution

**Location:** `AI-Writer/backend/services/auto_publish_executor.py`

Runs every 15 minutes via APScheduler:

```python
def run_publish_cycle():
    """
    1. Query approved articles with publish_date <= now
    2. Claim article with optimistic locking (version field)
    3. Load client credentials (separate session)
    4. Re-verify quality score (defense-in-depth)
    5. Check cannibalization risk via open-seo-main API
    6. Publish via get_publisher()
    7. Post-publish: GSC submit, link graph update
    """
```

**Safety Features:**
- Thread lock prevents overlapping cycles
- Optimistic locking with version field (DFI-001)
- Quality gate re-verification before publish
- Cannibalization check (CRITICAL risk blocks publish)
- Transaction rollback on failure

### Publishing Pipeline Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PUBLISHING PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ScheduledArticle                                                           │
│  status: approved                                                           │
│  publish_date: past                                                         │
│        │                                                                    │
│        ▼                                                                    │
│  run_publish_cycle() [APScheduler, 15 min]                                 │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Session 1: Claim Article                                            │   │
│  │  UPDATE scheduled_articles                                           │   │
│  │  SET status='publishing', version=version+1                          │   │
│  │  WHERE id=? AND status='approved' AND version=expected               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Session 2: Load Credentials                                         │   │
│  │  ClientSettings: cms_type, wp_url, wp_username, wp_app_password_enc  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Pre-Publish Checks (No DB session open)                             │   │
│  │  • Quality gate re-verification (score ≥ 80)                         │   │
│  │  • Cannibalization risk check via open-seo-main                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CMS Publish (No DB session open)                                    │   │
│  │  publisher = get_publisher(client_settings)                          │   │
│  │  result = publisher.publish(title, content_html, meta_description)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Session 3: Save Result                                              │   │
│  │  • Update article: status='published', cms_post_url                  │   │
│  │  • Create PublishingLog entry                                        │   │
│  │  • Commit transaction                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Post-Commit Operations (Non-blocking)                               │   │
│  │  • _submit_to_gsc() — URL indexing notification                      │   │
│  │  • _run_link_graph_update() — Internal link analysis                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Retry Logic

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | 5 min | status='approved', publish_date += 5 min |
| 2 | 30 min | status='approved', publish_date += 30 min |
| 3 | — | status='failed', error_detail saved |

---

## 4. Social Scheduling

### Current State: Partial Implementation

**What Exists:**
- LinkedIn persona generation service (`backend/services/persona/linkedin/`)
- Social optimizer services for image/video studios
- No direct social media API integration

**LinkedIn Persona Service:**
```
AI-Writer/backend/services/persona/linkedin/
├── linkedin_persona_prompts.py    # Prompt templates
├── linkedin_persona_schemas.py    # Pydantic schemas
└── linkedin_persona_service.py    # LLM-powered persona generation
```

### Recommended Social Scheduling Architecture

For Phase 99, implement a SocialScheduleService that integrates with:

| Platform | API | Auth Method |
|----------|-----|-------------|
| LinkedIn | Marketing API | OAuth 2.0 |
| Twitter/X | v2 API | OAuth 2.0 |
| Facebook | Graph API | OAuth 2.0 |
| Buffer | v1 API | OAuth 2.0 (preferred) |

**Recommendation:** Start with Buffer integration — single API covers all major platforms with unified scheduling.

### Proposed Social Scheduling Schema

```sql
CREATE TABLE social_schedules (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES scheduled_articles(id),
  client_id UUID REFERENCES clients(id),
  platform TEXT NOT NULL,           -- 'linkedin', 'twitter', 'facebook', 'buffer'
  scheduled_at TIMESTAMPTZ,
  post_content TEXT NOT NULL,
  post_url TEXT,                    -- Article URL to share
  image_url TEXT,                   -- Optional featured image
  status TEXT DEFAULT 'pending',    -- pending, posted, failed
  platform_post_id TEXT,            -- ID returned by platform
  error_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Social Post Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SOCIAL SCHEDULING FLOW (PROPOSED)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Article Published                                                          │
│        │                                                                    │
│        ▼                                                                    │
│  Generate Social Posts (per enabled platform)                               │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SocialPostGenerator                                                 │   │
│  │  • Load client's voice profile                                       │   │
│  │  • Generate platform-specific content via Gemini 3.1 Pro             │   │
│  │  • LinkedIn: Professional tone, 1300 char limit                      │   │
│  │  • Twitter: Concise, 280 char, hashtags                              │   │
│  │  • Facebook: Casual, longer form, engagement hooks                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│        │                                                                    │
│        ▼                                                                    │
│  Insert into social_schedules (status='pending')                           │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SocialScheduler (APScheduler, 5 min interval)                       │   │
│  │  • Query pending posts with scheduled_at <= now                      │   │
│  │  • POST to platform API or Buffer                                    │   │
│  │  • Update status: 'posted' or 'failed'                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Post-Publish Monitoring

### Current Implementation: ArticleRankSnapshot

**Location:** `AI-Writer/backend/models/publishing.py`

```python
class ArticleRankSnapshot(SharedBase):
    """Point-in-time ranking snapshot for a published article."""
    __tablename__ = "article_rank_snapshots"
    
    id = Column(GUID(), primary_key=True)
    article_id = Column(GUID(), ForeignKey("scheduled_articles.id"))
    client_id = Column(GUID(), ForeignKey("clients.id"))
    keyword = Column(String(255), nullable=False)
    position = Column(Integer, nullable=True)        # null = not ranking
    search_volume = Column(Integer, nullable=True)
    url = Column(String(1000), nullable=True)
    checked_at = Column(DateTime(timezone=True), default=func.now())
```

### Rank Tracking Service

**Location:** `AI-Writer/backend/services/scraping/rank_tracker.py`

Tracks keyword positions over time using DataForSEO or SerpAPI.

### Monitoring Data Service

**Location:** `AI-Writer/backend/services/monitoring_data_service.py`

Provides aggregated monitoring metrics across clients.

### Proposed Enhanced Monitoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    POST-PUBLISH MONITORING PIPELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Published Article                                                          │
│        │                                                                    │
│        ├─────────────────────────────────────────────────────────┐          │
│        │                                                         │          │
│        ▼                                                         ▼          │
│  Immediate (0-1 hour)                              Delayed (24-72 hours)    │
│  • IndexNow submission                             • GSC data sync          │
│  • Link graph update                               • Rank tracking init     │
│  • Social post scheduling                          • Impression monitoring  │
│        │                                                         │          │
│        ▼                                                         ▼          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MONITORING DASHBOARD                                                │   │
│  │                                                                      │   │
│  │  Per Article:                                                       │   │
│  │  • Indexing status (IndexNow: submitted, GSC: crawled)              │   │
│  │  • Keyword positions (sparkline over 30 days)                       │   │
│  │  • Impressions/clicks from GSC                                      │   │
│  │  • Internal link count (inbound/outbound)                           │   │
│  │  • Social engagement (likes, shares, comments)                      │   │
│  │                                                                      │   │
│  │  Aggregate:                                                         │   │
│  │  • Published this week/month                                        │   │
│  │  • Average quality score                                            │   │
│  │  • Keywords ranking (positions 1-10, 11-20, 21-100)                 │   │
│  │  • Publishing success rate                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Integration Points Summary

### Existing Code Inventory

| Component | Location | Status |
|-----------|----------|--------|
| GSC URL Submission | `AI-Writer/backend/services/gsc_service.py` | Implemented (needs IndexNow replacement) |
| Auto-Publish Executor | `AI-Writer/backend/services/auto_publish_executor.py` | Implemented |
| WordPress Publisher | `AI-Writer/backend/services/cms_publisher/wordpress_publisher.py` | Implemented |
| Shopify Publisher | `AI-Writer/backend/services/cms_publisher/shopify_publisher.py` | Implemented |
| Wix Publisher | `AI-Writer/backend/services/cms_publisher/wix_publisher.py` | Implemented |
| Webhook Publisher | `AI-Writer/backend/services/cms_publisher/webhook_publisher.py` | Implemented |
| IndexNow UI Hooks | `apps/web/src/hooks/use-indexnow-instructions.ts` | Implemented |
| IndexNow Templates | `apps/web/src/lib/indexnow/instruction-templates.ts` | Implemented |
| Article Rank Tracking | `AI-Writer/backend/models/publishing.py` | Implemented |
| GSC Analytics Client | `open-seo-main/src/server/services/analytics/gsc-client.ts` | Implemented |
| GSC Sync Job | `open-seo-main/src/server/features/analytics/jobs/gsc-sync.job.ts` | Implemented |

### Phase 97 Ready for Implementation

| Component | Location | Status |
|-----------|----------|--------|
| IndexNow Service | `open-seo-main/src/server/features/indexing/` | Specified, not built |
| IndexNow Worker | `open-seo-main/src/server/workers/indexnow-worker.ts` | Specified, not built |
| IndexNow Schema | `open-seo-main/src/db/indexnow-schema.ts` | Specified, not built |
| Redis Batching | Flush scheduler | Specified, not built |

### Gaps to Fill in Phase 99

| Gap | Priority | Complexity |
|-----|----------|------------|
| IndexNow backend implementation | HIGH | Medium (Phase 97 spec complete) |
| Replace GSC Indexing API calls with IndexNow | HIGH | Low (swap function call) |
| Social scheduling service | MEDIUM | High (multiple APIs) |
| Buffer API integration | MEDIUM | Low (unified social) |
| Enhanced monitoring dashboard | LOW | Medium |

---

## 7. Recommended Architecture for Phase 99

### Publishing Automation Orchestrator

```typescript
// open-seo-main/src/server/features/publishing/PublishingOrchestrator.ts

export class PublishingOrchestrator {
  /**
   * Called after successful CMS publish.
   * Coordinates all post-publish automation.
   */
  async onArticlePublished(params: {
    clientId: string;
    articleId: string;
    url: string;
    html: string;
    title: string;
    keyword?: string;
  }): Promise<void> {
    // 1. Queue IndexNow submission (30s delay)
    await this.indexNowService.queueUrl(params.clientId, params.url, 'publish');
    
    // 2. Update sitemap lastmod
    await this.sitemapService.updateLastmod(params.clientId, params.url);
    
    // 3. Update internal link graph
    await this.linkGraphService.updateGraph(params.clientId, params.url, params.html);
    
    // 4. Schedule social posts (if enabled)
    if (await this.socialSettings.isEnabled(params.clientId)) {
      await this.socialScheduler.scheduleForArticle(params);
    }
    
    // 5. Initialize rank tracking
    if (params.keyword) {
      await this.rankTracker.initTracking(params.articleId, params.keyword, params.url);
    }
  }
}
```

### Configuration Model

```typescript
interface PublishingAutomationConfig {
  // IndexNow
  indexNow: {
    enabled: boolean;
    delayPublishSeconds: number;      // Default: 30
    delayUpdateSeconds: number;       // Default: 300
    delaySeoFixSeconds: number;       // Default: 3600
  };
  
  // Social
  social: {
    enabled: boolean;
    platforms: ('linkedin' | 'twitter' | 'facebook' | 'buffer')[];
    bufferApiKey?: string;
    postDelayMinutes: number;         // Delay after publish
    voiceProfileId?: string;          // For content generation
  };
  
  // Monitoring
  monitoring: {
    rankTrackingEnabled: boolean;
    rankCheckFrequencyDays: number;   // Default: 7
    gscSyncEnabled: boolean;
  };
}
```

---

## 8. Security Considerations

### Credential Storage

| Secret | Storage | Encryption |
|--------|---------|------------|
| WordPress App Password | `client_settings.wp_app_password_encrypted` | Fernet |
| IndexNow API Key | `indexnow_config.api_key_encrypted` | AES-256-GCM |
| Social OAuth Tokens | `platform_oauth_tokens.token_encrypted` | AES-256-GCM |
| GSC Service Account | File system (`GSC_SERVICE_ACCOUNT_JSON`) | At-rest encryption |

### API Key Hygiene

From Phase 97 research:
- **Never log plaintext API keys** — use `[REDACTED]` placeholder
- **Tenant isolation** — always filter by `clientId`
- **Timing-safe comparison** — use `crypto.timingSafeEqual()`
- **URL validation** — prevent SSRF via `validate_indexing_url()`

### Rate Limiting

| Service | Limit | Implementation |
|---------|-------|----------------|
| IndexNow | No official limit | Self-impose 10 jobs/min |
| WordPress REST API | Varies by host | Respect `Retry-After` headers |
| Buffer API | 1000 posts/hour | Queue with backoff |
| GSC API | 200 requests/day | Daily quota tracking |

---

## 9. Dependencies

### Required (Already in Stack)

| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | 5.33.3 | Job queue for IndexNow batching |
| `ioredis` | 5.4.2 | Redis client for batching |
| `uuid` | 11.0.3 | API key generation |
| `googleapis` | existing | GSC analytics sync |

### Required (To Add)

| Package | Version | Purpose |
|---------|---------|---------|
| `buffer-api` | latest | Social scheduling (recommended) |
| (Alternative) `twitter-api-v2` | latest | Direct Twitter integration |
| (Alternative) `linkedin-api` | latest | Direct LinkedIn integration |

---

## 10. Validation Checklist

### Unit Tests Required

- [ ] `PublishingOrchestrator.onArticlePublished()` — all steps execute
- [ ] `IndexNowService.queueUrl()` — Redis batching works
- [ ] `SocialScheduler.scheduleForArticle()` — posts created per platform
- [ ] Idempotency key generation — SHA-256, time-windowed

### Integration Tests Required

- [ ] Full publish → IndexNow → sitemap flow
- [ ] WordPress REST API publish with real test site
- [ ] Buffer API post creation
- [ ] GSC analytics sync after publish

### E2E Tests Required

- [ ] Article approval → auto-publish → monitoring visible in dashboard
- [ ] Social post appears on scheduled platform
- [ ] Rank tracking data populates after 24 hours

---

## 11. Summary of Findings

### What Works Well

1. **CMS Publishing** — Mature abstract publisher pattern with WordPress, Shopify, Wix, Webhook support
2. **Quality Gates** — Re-verification before publish, cannibalization checks
3. **Transaction Safety** — Optimistic locking, separate DB sessions, post-commit hooks
4. **Monitoring Foundation** — ArticleRankSnapshot model, GSC sync jobs

### What Needs Improvement

1. **GSC Submission** — Replace Google Indexing API with IndexNow (actively harmful for SEO)
2. **Social Scheduling** — No direct API integration, only persona generation
3. **Unified Orchestrator** — Post-publish hooks are scattered, need central coordinator

### Recommended Immediate Actions

1. **Implement Phase 97 IndexNow** — All specs ready, just needs code
2. **Replace `_submit_to_gsc()` with `IndexNowService.queueUrl()`**
3. **Add Buffer API integration** for unified social scheduling
4. **Create `PublishingOrchestrator`** to coordinate all post-publish automation

---

## References

- Phase 97 IndexNow Research: `.planning/phases/97-indexnow-system/97-RESEARCH.md`
- Phase 97 IndexNow Spec: `.planning/phases/97-indexnow-system/SPEC.md`
- GSC Service: `AI-Writer/backend/services/gsc_service.py`
- Auto-Publish Executor: `AI-Writer/backend/services/auto_publish_executor.py`
- CMS Publishers: `AI-Writer/backend/services/cms_publisher/`
- IndexNow UI: `apps/web/src/hooks/use-indexnow-instructions.ts`
- Publishing Models: `AI-Writer/backend/models/publishing.py`
