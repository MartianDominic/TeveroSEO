# Phase 99: Service Architecture Catalog

> **Created:** 2026-05-11  
> **Status:** Architecture Design  
> **Scope:** 13 services across 3 streams (A, B, C, E)

---

## Architecture Overview

```
                              SERVICE TOPOLOGY
                              
                    ┌──────────────────────────────────────┐
                    │           apps/web (Next.js)         │
                    │         UI + Server Actions          │
                    └───────────────┬──────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  open-seo-main    │   │    AI-Writer      │   │   Shared Redis    │
│  (Node.js/TS)     │   │    (FastAPI)      │   │   (BullMQ/Pub)    │
│                   │   │                   │   │                   │
│  - Keywords       │   │  - Content Gen    │   │  - Event Bus      │
│  - Proposals      │   │  - Voice          │   │  - Job Queues     │
│  - Audits         │   │  - Publishing     │   │  - Cache          │
│  - Links          │   │  - Quality Gate   │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │      Shared PostgreSQL        │
                    │   (open_seo + alwrity dbs)    │
                    └───────────────────────────────┘
```

---

## Service Catalog

### Stream A: Keywords → Proposal

| Service | Location | Purpose |
|---------|----------|---------|
| KeywordScrapingService | open-seo-main | DataForSEO batch processing, deduplication |
| KeywordClassificationService | open-seo-main | Funnel classification, geo detection |
| ProposalGenerationService | open-seo-main | Awareness classification, ROI projections |
| ClientConversionService | open-seo-main | Prospect → Client migration |

### Stream B: Content Calendar → Publishing

| Service | Location | Purpose |
|---------|----------|---------|
| ContentCalendarService | AI-Writer | CRUD, view transformations, scheduling |
| PriorityQueueService | AI-Writer | Scoring, quick win detection |
| EditorialWorkflowService | AI-Writer | State machine, role enforcement |
| PublishingService | AI-Writer | IndexNow, sitemap, CMS adapters |

### Stream C: AI Content Generation

| Service | Location | Purpose |
|---------|----------|---------|
| ContentGenerationService | AI-Writer | Gemini 3.1 Pro, 500-token chunks |
| VoiceComplianceService | AI-Writer | 40+ voice fields, scoring |
| QualityGateService | AI-Writer | 41-point checklist, auto/manual routing |

### Stream E: Internal Linking

| Service | Location | Purpose |
|---------|----------|---------|
| LinkArchitectureService | open-seo-main | Hub/spoke topology, cluster mapping |
| LinkOpportunityService | open-seo-main | Detection, scoring, suggestions |
| DeadLinkService | open-seo-main | Health monitoring, replacement generation |

---

## Stream A Services

### 1. KeywordScrapingService

**Location:** `open-seo-main/src/server/features/keywords/services/KeywordScrapingService.ts`

**Purpose:** Batch scrape keywords from DataForSEO, manage deduplication, handle webhooks.

**Interface:**

```typescript
interface KeywordScrapingService {
  // Queue keyword scrape tasks
  queueKeywordScrape(params: {
    prospectId: string;
    keywords: string[];
    locale: string; // "lt_LT", "en_US", etc.
  }): Promise<{ taskId: string; estimatedCost: number }>;

  // Receive DataForSEO webhook results
  processWebhookPayload(payload: DataForSEOWebhookPayload): Promise<void>;

  // Get scrape status
  getTaskStatus(taskId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    keywordsProcessed: number;
    errors: string[];
  }>;

  // Deduplicate keywords before scraping
  deduplicateKeywords(keywords: string[]): Promise<{
    unique: string[];
    duplicates: string[];
    existing: { keyword: string; lastScrapedAt: Date }[];
  }>;

  // Get keyword data by prospect
  getKeywordsByProspect(prospectId: string): Promise<KeywordData[]>;
}

interface KeywordData {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
  intent: "informational" | "navigational" | "commercial" | "transactional";
  trendData: number[]; // 12-month trend
  serpFeatures: string[];
  relatedKeywords: string[];
}
```

**Dependencies:**
- `DataForSEOClient` (external API wrapper)
- `KeywordClassificationService` (post-scrape classification)
- Redis (BullMQ job queue)

**Events:**
- Publishes: `keyword.scrape.completed`, `keyword.scrape.failed`
- Subscribes: `prospect.created` (trigger initial scrape)

**Storage:**
- `prospect_keywords` table (existing in `prospect-keyword-schema.ts`)
- `keyword_scrape_tasks` table (new)

---

### 2. KeywordClassificationService

**Location:** `open-seo-main/src/server/features/keywords/services/KeywordClassificationService.ts`

**Purpose:** Classify keywords by funnel stage (BOFU/MOFU/TOFU), detect geo signals, identify pSEO opportunities.

**Interface:**

```typescript
interface KeywordClassificationService {
  // Classify a single keyword
  classifyKeyword(keyword: string, locale: string): Promise<KeywordClassification>;

  // Batch classification
  classifyBatch(keywords: string[], locale: string): Promise<KeywordClassification[]>;

  // Detect geo signals
  detectGeoSignals(keyword: string): Promise<GeoSignal | null>;

  // Identify pSEO patterns
  detectPseoPatterns(keywords: string[]): Promise<PseoOpportunity[]>;

  // Get classification stats for prospect
  getClassificationStats(prospectId: string): Promise<ClassificationStats>;
}

interface KeywordClassification {
  keyword: string;
  funnelStage: "bofu" | "mofu" | "tofu";
  confidence: number; // 0-1
  matchedPatterns: string[]; // Pattern types that matched
  intentType: string; // "purchase", "comparison", "learning", etc.
  geoSignal: GeoSignal | null;
  isPseoCandidate: boolean;
}

interface GeoSignal {
  city: string;
  region: string | null;
  variants: string[];
}

interface PseoOpportunity {
  pattern: string; // e.g., "{city} + grožio salonai"
  matchedKeywords: string[];
  estimatedPageCount: number;
  totalSearchVolume: number;
}

interface ClassificationStats {
  total: number;
  bofu: number;
  mofu: number;
  tofu: number;
  withGeo: number;
  pseoOpportunities: number;
}
```

**Dependencies:**
- `patterns.ts` (existing BOFU/MOFU/TOFU patterns)
- `cities.ts` (existing geo patterns)
- DataForSEO intent data (fallback)

**Events:**
- Publishes: `keyword.classified`
- Subscribes: `keyword.scrape.completed`

**Storage:**
- Updates `prospect_keywords.funnel_stage`, `prospect_keywords.geo_city`

---

### 3. ProposalGenerationService

**Location:** `open-seo-main/src/server/features/proposals/services/ProposalGenerationService.ts`

**Purpose:** Generate AI-powered proposals using Schwartz awareness classification and Halbert fascinations.

**Interface:**

```typescript
interface ProposalGenerationService {
  // Generate full proposal
  generateProposal(params: {
    prospectId: string;
    templateId?: string;
    options?: ProposalOptions;
  }): Promise<Proposal>;

  // Classify prospect awareness level
  classifyAwareness(prospectId: string): Promise<AwarenessClassification>;

  // Generate fascinations (headline hooks)
  generateFascinations(params: {
    prospectId: string;
    count: number;
  }): Promise<string[]>;

  // Calculate ROI projections
  calculateRoiProjections(prospectId: string): Promise<RoiProjection>;

  // Get proposal by ID
  getProposal(proposalId: string): Promise<Proposal | null>;

  // List proposals for prospect
  listProposals(prospectId: string): Promise<ProposalSummary[]>;
}

interface AwarenessClassification {
  level: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
  confidence: number;
  signals: string[]; // What indicated this level
  recommendedApproach: string;
}

interface RoiProjection {
  currentTraffic: number;
  projectedTraffic: number;
  trafficGrowth: number;
  currentRevenue: number;
  projectedRevenue: number;
  roiPercentage: number;
  breakEvenMonths: number;
  assumptions: string[];
}

interface Proposal {
  id: string;
  prospectId: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected";
  awarenessLevel: string;
  fascinations: string[];
  roiProjection: RoiProjection;
  keywordSummary: KeywordSummary;
  competitorInsights: CompetitorInsight[];
  pricingTiers: PricingTier[];
  createdAt: Date;
  sentAt: Date | null;
}
```

**Dependencies:**
- `KeywordClassificationService` (classified keywords)
- `GrokClient` (AI for awareness classification, fascinations)
- Proposal templates

**Events:**
- Publishes: `proposal.generated`, `proposal.sent`, `proposal.accepted`
- Subscribes: `keyword.classified`

**Storage:**
- `proposals` table (existing in `proposal-schema.ts`)
- `proposal_sections` table
- `proposal_analytics` table

---

### 4. ClientConversionService

**Location:** `open-seo-main/src/server/features/clients/services/ClientConversionService.ts`

**Purpose:** Convert prospects to clients upon agreement signing, migrate all data atomically.

**Interface:**

```typescript
interface ClientConversionService {
  // Convert prospect to client (main transaction)
  convertProspectToClient(params: {
    prospectId: string;
    agreementId: string;
    paymentPlanId?: string;
  }): Promise<Client>;

  // Validate conversion prerequisites
  validateConversion(prospectId: string): Promise<ConversionValidation>;

  // Migrate prospect keywords to client keywords
  migrateKeywords(prospectId: string, clientId: string): Promise<{
    migrated: number;
    skipped: number;
  }>;

  // Generate initial voice profile draft
  generateInitialVoiceProfile(clientId: string): Promise<string>; // profileId

  // Connect GSC/GA (post-conversion)
  initiateGscConnection(clientId: string): Promise<{ oauthUrl: string }>;

  // Get conversion status
  getConversionStatus(prospectId: string): Promise<ConversionStatus>;
}

interface ConversionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  proposalAccepted: boolean;
  agreementSigned: boolean;
  paymentConfigured: boolean;
}

interface ConversionStatus {
  status: "pending" | "in_progress" | "completed" | "failed";
  steps: {
    name: string;
    status: "pending" | "completed" | "failed";
    error?: string;
  }[];
  clientId?: string;
  completedAt?: Date;
}
```

**Dependencies:**
- `VoiceProfileService` (generate initial profile)
- `KeywordService` (migrate keywords)
- Database transaction manager

**Events:**
- Publishes: `client.created`, `client.keywords.migrated`, `client.voice_profile.created`
- Subscribes: `agreement.signed`, `stripe.subscription.created`

**Storage:**
- `clients` table (creates new record)
- `client_keywords` table (migrated from prospect_keywords)
- `voice_profiles` table (initial draft)

---

## Stream B Services

### 5. ContentCalendarService

**Location:** `AI-Writer/backend/services/content_calendar_service.py`

**Purpose:** Manage content calendar with CRUD, view transformations (Calendar/Kanban/Timeline), and scheduling.

**Interface:**

```python
class ContentCalendarService:
    async def create_calendar_item(
        self,
        client_id: str,
        item: CalendarItemCreate
    ) -> CalendarItem:
        """Create a new calendar item (content piece)."""
        
    async def update_calendar_item(
        self,
        item_id: str,
        updates: CalendarItemUpdate
    ) -> CalendarItem:
        """Update calendar item (reschedule, change status, etc.)."""
        
    async def delete_calendar_item(self, item_id: str) -> None:
        """Soft-delete a calendar item."""
        
    async def get_calendar_view(
        self,
        client_id: str,
        view_type: Literal["calendar", "kanban", "timeline"],
        start_date: date,
        end_date: date,
        filters: Optional[CalendarFilters] = None
    ) -> CalendarView:
        """Get calendar data transformed for specific view."""
        
    async def bulk_reschedule(
        self,
        item_ids: list[str],
        new_dates: list[date]
    ) -> list[CalendarItem]:
        """Bulk reschedule multiple items."""
        
    async def get_publishing_schedule(
        self,
        client_id: str,
        period: Literal["week", "month", "quarter"]
    ) -> PublishingSchedule:
        """Get publishing schedule with distribution analysis."""
        
    async def get_calendar_stats(
        self,
        client_id: str
    ) -> CalendarStats:
        """Get stats: published/pending/overdue counts."""

@dataclass
class CalendarItem:
    id: str
    client_id: str
    keyword_id: Optional[str]
    title: str
    target_keyword: str
    funnel_stage: str  # bofu, mofu, tofu
    status: str  # idea, outline, draft, review, approved, scheduled, published
    scheduled_date: Optional[date]
    published_date: Optional[date]
    assigned_to: Optional[str]
    priority_score: float
    word_count_target: int
    tags: list[str]
    created_at: datetime
    updated_at: datetime

@dataclass
class CalendarView:
    view_type: str
    items: list[CalendarItem]
    # Calendar view specific
    days: Optional[dict[str, list[CalendarItem]]]  
    # Kanban view specific
    columns: Optional[dict[str, list[CalendarItem]]]  
    # Timeline view specific
    timeline: Optional[list[TimelineRow]]
```

**Dependencies:**
- `PriorityQueueService` (scoring)
- `EditorialWorkflowService` (status validation)
- PostgreSQL (alwrity db)

**Events:**
- Publishes: `calendar.item.created`, `calendar.item.updated`, `calendar.item.scheduled`
- Subscribes: `keyword.selected_for_content`, `content.published`

**Storage:**
- `content_calendar` table (new in alwrity db)
- `calendar_item_history` table (audit trail)

---

### 6. PriorityQueueService

**Location:** `AI-Writer/backend/services/priority_queue_service.py`

**Purpose:** Score keywords for content priority, detect quick wins, optimize publishing schedule.

**Interface:**

```python
class PriorityQueueService:
    async def score_keyword(
        self,
        keyword_data: KeywordData,
        client_context: ClientContext
    ) -> PriorityScore:
        """Score a single keyword for content priority."""
        
    async def score_batch(
        self,
        keywords: list[KeywordData],
        client_id: str
    ) -> list[PriorityScore]:
        """Batch score keywords."""
        
    async def detect_quick_wins(
        self,
        client_id: str,
        limit: int = 10
    ) -> list[QuickWin]:
        """Find quick win opportunities (pos 11-30, KD ≤40, vol ≥100)."""
        
    async def get_priority_queue(
        self,
        client_id: str,
        tier: Optional[Literal["must_do", "should_do", "nice_to_have"]] = None
    ) -> list[QueuedKeyword]:
        """Get prioritized keyword queue."""
        
    async def optimize_schedule(
        self,
        client_id: str,
        target_articles_per_month: int,
        funnel_distribution: FunnelDistribution
    ) -> OptimizedSchedule:
        """Generate optimized publishing schedule."""
        
    async def recalculate_priorities(
        self,
        client_id: str
    ) -> None:
        """Recalculate all priorities (after GSC data update)."""

@dataclass
class PriorityScore:
    keyword: str
    total_score: float  # 0-100
    tier: str  # must_do (≥75), should_do (≥50), nice_to_have (≥25), skip (<25)
    components: PriorityComponents
    is_quick_win: bool
    
@dataclass
class PriorityComponents:
    volume_score: float  # 25% weight
    difficulty_score: float  # 25% weight (inverse)
    intent_score: float  # 20% weight
    position_score: float  # 15% weight (quick win bonus)
    trend_score: float  # 15% weight

@dataclass
class QuickWin:
    keyword: str
    current_position: int
    search_volume: int
    keyword_difficulty: int
    potential_clicks_gain: int
    recommended_action: str  # "optimize", "refresh", "create"

@dataclass
class FunnelDistribution:
    bofu_percent: int = 30
    mofu_percent: int = 40
    tofu_percent: int = 30
```

**Dependencies:**
- GSC data (positions, clicks)
- `KeywordClassificationService` (funnel stage)

**Events:**
- Publishes: `priority.recalculated`, `quick_win.detected`
- Subscribes: `gsc.data.updated`, `keyword.scraped`

**Storage:**
- `keyword_priorities` table (new in alwrity db)
- Updates `content_calendar.priority_score`

---

### 7. EditorialWorkflowService

**Location:** `AI-Writer/backend/services/editorial_workflow_service.py`

**Purpose:** Manage content states, enforce role-based transitions, track revision history.

**Interface:**

```python
class EditorialWorkflowService:
    async def transition_state(
        self,
        content_id: str,
        to_state: ContentState,
        user_id: str,
        comment: Optional[str] = None
    ) -> ContentStateTransition:
        """Transition content to new state with validation."""
        
    async def validate_transition(
        self,
        content_id: str,
        from_state: ContentState,
        to_state: ContentState,
        user_role: UserRole
    ) -> TransitionValidation:
        """Check if transition is allowed."""
        
    async def request_revision(
        self,
        content_id: str,
        reviewer_id: str,
        feedback: RevisionFeedback
    ) -> Revision:
        """Request revision with feedback."""
        
    async def approve_content(
        self,
        content_id: str,
        approver_id: str,
        notes: Optional[str] = None
    ) -> ContentApproval:
        """Approve content for publishing."""
        
    async def get_workflow_history(
        self,
        content_id: str
    ) -> list[WorkflowEvent]:
        """Get full workflow history."""
        
    async def get_pending_reviews(
        self,
        user_id: str,
        role: UserRole
    ) -> list[PendingReview]:
        """Get items pending review for user."""
        
    async def create_version(
        self,
        content_id: str,
        content_snapshot: ContentSnapshot,
        commit_message: str
    ) -> ContentVersion:
        """Create new version snapshot."""

class ContentState(str, Enum):
    IDEA = "idea"
    OUTLINE = "outline"
    DRAFT = "draft"
    REVIEW = "review"
    REVISION_REQUESTED = "revision_requested"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"

class UserRole(str, Enum):
    VIEWER = "viewer"
    WRITER = "writer"
    EDITOR = "editor"
    ADMIN = "admin"

# State machine definition
ALLOWED_TRANSITIONS: dict[tuple[ContentState, ContentState], set[UserRole]] = {
    (ContentState.IDEA, ContentState.OUTLINE): {UserRole.WRITER, UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.OUTLINE, ContentState.DRAFT): {UserRole.WRITER, UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.DRAFT, ContentState.REVIEW): {UserRole.WRITER, UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.REVIEW, ContentState.REVISION_REQUESTED): {UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.REVIEW, ContentState.APPROVED): {UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.REVISION_REQUESTED, ContentState.DRAFT): {UserRole.WRITER, UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.APPROVED, ContentState.SCHEDULED): {UserRole.EDITOR, UserRole.ADMIN},
    (ContentState.SCHEDULED, ContentState.PUBLISHED): {UserRole.ADMIN},
    # Rollbacks
    (ContentState.SCHEDULED, ContentState.APPROVED): {UserRole.ADMIN},
    (ContentState.APPROVED, ContentState.REVIEW): {UserRole.ADMIN},
}
```

**Dependencies:**
- User auth context
- `ContentCalendarService`

**Events:**
- Publishes: `content.state.changed`, `revision.requested`, `content.approved`
- Subscribes: `content.generated`, `quality_gate.passed`

**Storage:**
- `content_workflow_history` table
- `content_versions` table
- `content_revisions` table

---

### 8. PublishingService

**Location:** `AI-Writer/backend/services/publishing_service.py`

**Purpose:** Publish content to CMS platforms, submit to IndexNow, update sitemaps.

**Interface:**

```python
class PublishingService:
    async def publish_content(
        self,
        content_id: str,
        options: PublishOptions
    ) -> PublishResult:
        """Publish content to configured CMS."""
        
    async def schedule_publish(
        self,
        content_id: str,
        publish_at: datetime,
        options: PublishOptions
    ) -> ScheduledPublish:
        """Schedule content for future publishing."""
        
    async def submit_to_indexnow(
        self,
        urls: list[str],
        client_id: str
    ) -> IndexNowResult:
        """Submit URLs to IndexNow for faster indexing."""
        
    async def update_sitemap(
        self,
        client_id: str,
        url: str,
        lastmod: datetime,
        priority: float = 0.8
    ) -> None:
        """Update sitemap entry for published content."""
        
    async def get_publishing_status(
        self,
        content_id: str
    ) -> PublishingStatus:
        """Get current publishing status."""
        
    async def unpublish_content(
        self,
        content_id: str,
        reason: str
    ) -> UnpublishResult:
        """Remove content from CMS."""
        
    # CMS Adapters
    async def get_cms_adapter(
        self,
        platform: Literal["wordpress", "shopify", "wix", "webflow", "custom"]
    ) -> CMSAdapter:
        """Get CMS-specific adapter."""

@dataclass
class PublishOptions:
    cms_platform: str
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    featured_image_url: Optional[str] = None
    author_id: Optional[str] = None
    seo_title: Optional[str] = None
    meta_description: Optional[str] = None
    schema_markup: Optional[dict] = None
    submit_to_indexnow: bool = True
    update_sitemap: bool = True

@dataclass
class IndexNowResult:
    submitted: int
    accepted: int
    rejected: int
    errors: list[str]

class CMSAdapter(Protocol):
    async def create_post(self, content: ContentPayload) -> str:
        """Create new post, return post ID."""
    async def update_post(self, post_id: str, content: ContentPayload) -> None:
        """Update existing post."""
    async def delete_post(self, post_id: str) -> None:
        """Delete post."""
    async def get_post(self, post_id: str) -> Optional[CMSPost]:
        """Get post by ID."""
```

**Dependencies:**
- CMS API credentials (per client)
- IndexNow API keys
- `SitemapService`

**Events:**
- Publishes: `content.published`, `indexnow.submitted`, `sitemap.updated`
- Subscribes: `content.approved`, `scheduled_publish.due`

**Storage:**
- `published_content` table
- `publishing_history` table
- `indexnow_submissions` table

---

## Stream C Services

### 9. ContentGenerationService

**Location:** `AI-Writer/backend/services/content_generation_service.py`

**Purpose:** Generate SEO-optimized content using Gemini 3.1 Pro with 500-token chunking for AI retrieval.

**Interface:**

```python
class ContentGenerationService:
    async def generate_article(
        self,
        params: ArticleGenerationParams
    ) -> GeneratedArticle:
        """Generate full article with voice compliance."""
        
    async def generate_outline(
        self,
        keyword: str,
        client_id: str,
        serp_analysis: Optional[SerpAnalysis] = None
    ) -> ArticleOutline:
        """Generate article outline with H2/H3 structure."""
        
    async def generate_chunk(
        self,
        heading: str,
        context: ChunkContext,
        voice_constraints: VoiceConstraints
    ) -> ContentChunk:
        """Generate single ~500 token chunk."""
        
    async def generate_introduction(
        self,
        keyword: str,
        article_context: ArticleContext,
        voice_constraints: VoiceConstraints
    ) -> str:
        """Generate hook introduction."""
        
    async def generate_conclusion(
        self,
        keyword: str,
        article_summary: ArticleSummary,
        cta: str,
        voice_constraints: VoiceConstraints
    ) -> str:
        """Generate conclusion with CTA."""
        
    async def regenerate_section(
        self,
        content_id: str,
        section_id: str,
        feedback: str
    ) -> ContentChunk:
        """Regenerate specific section based on feedback."""
        
    async def estimate_generation_cost(
        self,
        params: ArticleGenerationParams
    ) -> CostEstimate:
        """Estimate generation cost before running."""

@dataclass
class ArticleGenerationParams:
    keyword: str
    client_id: str
    word_count_target: int = 1500
    outline: Optional[ArticleOutline] = None
    include_faq: bool = True
    include_schema: bool = True
    internal_link_targets: Optional[list[str]] = None
    competitor_urls: Optional[list[str]] = None

@dataclass
class GeneratedArticle:
    id: str
    title: str
    meta_description: str
    content_html: str
    content_markdown: str
    chunks: list[ContentChunk]  # For AI retrieval
    word_count: int
    reading_time_minutes: int
    schema_markup: dict
    internal_links: list[InternalLink]
    voice_score: float
    seo_score: float
    generation_cost: float
    generated_at: datetime

@dataclass
class ContentChunk:
    id: str
    heading: str
    content: str
    token_count: int  # Target: ~500
    qfo_facet: str  # cost, timing, comparison, etc.
    contains_proof_detail: bool  # Reddit Test compliance
```

**Dependencies:**
- `GeminiClient` (Gemini 3.1 Pro)
- `VoiceComplianceService`
- `LinkArchitectureService` (internal link suggestions)
- SERP analysis data

**Events:**
- Publishes: `content.generated`, `content.chunk.generated`
- Subscribes: `calendar.item.generation_requested`

**Storage:**
- `generated_content` table
- `content_chunks` table
- `generation_costs` table

---

### 10. VoiceComplianceService

**Location:** `AI-Writer/backend/services/voice_compliance_service.py`

**Purpose:** Enforce brand voice compliance in generated content, score voice adherence.

**Interface:**

```python
class VoiceComplianceService:
    async def get_voice_constraints(
        self,
        client_id: str
    ) -> VoiceConstraints:
        """Build voice constraints from client profile."""
        
    async def score_content(
        self,
        content: str,
        voice_profile_id: str
    ) -> VoiceScore:
        """Score content against voice profile."""
        
    async def check_compliance(
        self,
        content: str,
        voice_constraints: VoiceConstraints
    ) -> ComplianceResult:
        """Check content for voice violations."""
        
    async def suggest_corrections(
        self,
        content: str,
        violations: list[VoiceViolation]
    ) -> list[VoiceCorrection]:
        """Suggest corrections for voice violations."""
        
    async def apply_voice_to_content(
        self,
        content: str,
        voice_constraints: VoiceConstraints
    ) -> str:
        """Rewrite content to match voice constraints."""
        
    async def extract_voice_from_samples(
        self,
        sample_urls: list[str],
        client_id: str
    ) -> VoiceProfile:
        """Extract voice profile from content samples."""

@dataclass
class VoiceConstraints:
    # Tone
    primary_tone: str
    secondary_tones: list[str]
    formality_level: int  # 1-10
    emotional_range: str
    
    # Language
    required_phrases: list[str]
    forbidden_phrases: list[str]
    jargon_level: str
    industry_terms: list[str]
    contraction_usage: str
    
    # Structure
    sentence_length_target: str
    paragraph_length_target: str
    heading_style: str
    cta_template: str
    
    # SEO balance
    keyword_density_tolerance: int
    seo_vs_voice_priority: int  # 1-10

@dataclass
class VoiceScore:
    total_score: float  # 0-100
    dimensions: VoiceDimensions
    violations: list[VoiceViolation]
    suggestions: list[str]

@dataclass
class VoiceDimensions:
    tone_score: float  # 20%
    vocabulary_score: float  # 20%
    structure_score: float  # 20%
    personality_score: float  # 20%
    rules_score: float  # 20%
```

**Dependencies:**
- `voice_profiles` table (open-seo-main, via dual-write)
- `GrokClient` (voice analysis)
- `VoiceConstraintBuilder` (existing in open-seo-main)

**Events:**
- Publishes: `voice.scored`, `voice.violation.detected`
- Subscribes: `content.generated`

**Storage:**
- Reads `voice_profiles` (open_seo db)
- Writes `voice_audit_log` (open_seo db, via dual-write)

---

### 11. QualityGateService

**Location:** `AI-Writer/backend/services/quality_gate_service.py`

**Purpose:** Run 41-point quality checklist, route content to auto-publish or manual review.

**Interface:**

```python
class QualityGateService:
    async def evaluate_content(
        self,
        content_id: str
    ) -> QualityEvaluation:
        """Run full 41-point quality evaluation."""
        
    async def check_eeat_compliance(
        self,
        content: str,
        author_info: AuthorInfo
    ) -> EEATScore:
        """Check E-E-A-T compliance."""
        
    async def run_reddit_test(
        self,
        content: str
    ) -> RedditTestResult:
        """Check for 3+ prove-it details per QFO facet."""
        
    async def check_readability(
        self,
        content: str
    ) -> ReadabilityScore:
        """Check Flesch score, grade level, sentence length."""
        
    async def detect_ai_slop(
        self,
        content: str
    ) -> AIDetectionResult:
        """Detect AI-generated patterns."""
        
    async def determine_routing(
        self,
        evaluation: QualityEvaluation
    ) -> RoutingDecision:
        """Determine auto-publish vs manual review."""
        
    async def get_quality_report(
        self,
        content_id: str
    ) -> QualityReport:
        """Get detailed quality report."""

@dataclass
class QualityEvaluation:
    content_id: str
    total_score: float  # 0-100
    checks_passed: int  # Out of 41
    checks_failed: int
    checks_skipped: int
    categories: dict[str, CategoryScore]  # eeat, readability, seo, voice, technical
    blocking_issues: list[BlockingIssue]
    warnings: list[Warning]
    routing: RoutingDecision
    evaluated_at: datetime

@dataclass
class RoutingDecision:
    action: Literal["auto_publish", "manual_review", "regenerate", "reject"]
    reason: str
    confidence: float
    # Thresholds
    # ≥80: auto_publish
    # 70-79: manual_review
    # 60-69: regenerate specific sections
    # <60: regenerate full article

@dataclass
class EEATScore:
    experience_score: float  # 20%
    expertise_score: float  # 30%
    authority_score: float  # 25%
    trust_score: float  # 25%
    total_score: float
    signals: list[EEATSignal]

@dataclass
class RedditTestResult:
    passed: bool
    facets_tested: int
    facets_with_proof: int
    proof_details: list[ProofDetail]
    # Requires 3+ prove-it details per facet
```

**Dependencies:**
- `VoiceComplianceService`
- `EEATDetector`
- `ReadabilityAnalyzer`
- `AIDetector`

**Events:**
- Publishes: `quality_gate.passed`, `quality_gate.failed`, `quality_gate.manual_required`
- Subscribes: `content.generated`

**Storage:**
- `quality_evaluations` table
- `quality_check_results` table

---

## Stream E Services

### 12. LinkArchitectureService

**Location:** `open-seo-main/src/server/features/linking/services/LinkArchitectureService.ts`

**Purpose:** Design and maintain hub-spoke link topology, manage topic clusters.

**Interface:**

```typescript
interface LinkArchitectureService {
  // Analyze current link structure
  analyzeStructure(clientId: string): Promise<LinkStructureAnalysis>;

  // Identify hub pages
  identifyHubPages(clientId: string): Promise<HubPage[]>;

  // Map topic clusters
  mapTopicClusters(clientId: string): Promise<TopicCluster[]>;

  // Get optimal link targets for new content
  getOptimalLinkTargets(params: {
    clientId: string;
    sourceUrl: string;
    sourceKeyword: string;
    limit?: number;
  }): Promise<LinkTarget[]>;

  // Calculate click depth from homepage
  calculateClickDepth(clientId: string, url: string): Promise<number>;

  // Get PageRank flow analysis
  getPageRankFlow(clientId: string): Promise<PageRankAnalysis>;

  // Suggest hub pages to create
  suggestNewHubPages(clientId: string): Promise<HubPageSuggestion[]>;

  // Validate link architecture health
  validateArchitectureHealth(clientId: string): Promise<ArchitectureHealth>;
}

interface LinkTarget {
  url: string;
  pageId: string;
  relevanceScore: number;  // 30% weight
  linkDeficitScore: number;  // 25% weight
  orphanScore: number;  // 20% weight
  depthScore: number;  // 15% weight
  trafficScore: number;  // 10% weight
  totalScore: number;
  suggestedAnchor: string;
  anchorType: "exact" | "partial" | "semantic";
  insertionMethod: "wrap_existing" | "append_sentence";
}

interface TopicCluster {
  id: string;
  name: string;
  hubPage: HubPage;
  spokePages: SpokePage[];
  internalLinkCount: number;
  topicCoherence: number;  // 0-1
  missingLinks: MissingLink[];
}

interface HubPage {
  url: string;
  pageId: string;
  topic: string;
  inboundLinks: number;
  outboundLinks: number;
  pageRank: number;
  isDesignatedHub: boolean;
}

interface ArchitectureHealth {
  score: number;  // 0-100
  orphanPageCount: number;
  avgClickDepth: number;
  maxClickDepth: number;
  hubCoverage: number;  // % of pages in clusters
  linkDensity: number;  // links per page
  issues: ArchitectureIssue[];
}
```

**Dependencies:**
- `link-schema.ts` tables (existing)
- Content embeddings for semantic relevance
- GSC data for traffic scores

**Events:**
- Publishes: `link_architecture.analyzed`, `hub_page.identified`, `cluster.mapped`
- Subscribes: `audit.completed`, `content.published`

**Storage:**
- `link_graph` table (existing)
- `page_links` table (existing)
- `topic_clusters` table (new)
- `hub_pages` table (new)

---

### 13. LinkOpportunityService

**Location:** `open-seo-main/src/server/features/linking/services/LinkOpportunityService.ts`

**Purpose:** Detect linking opportunities, score and prioritize, generate suggestions.

**Interface:**

```typescript
interface LinkOpportunityService {
  // Detect all opportunities for client
  detectOpportunities(clientId: string, auditId: string): Promise<Opportunity[]>;

  // Score opportunities
  scoreOpportunities(opportunities: Opportunity[]): Promise<ScoredOpportunity[]>;

  // Get prioritized opportunity queue
  getOpportunityQueue(clientId: string, limit?: number): Promise<ScoredOpportunity[]>;

  // Generate link suggestions for opportunity
  generateSuggestions(opportunityId: string): Promise<LinkSuggestion[]>;

  // Accept suggestion (mark for implementation)
  acceptSuggestion(suggestionId: string, userId: string): Promise<void>;

  // Reject suggestion
  rejectSuggestion(suggestionId: string, userId: string, reason: string): Promise<void>;

  // Apply suggestions in bulk
  applySuggestions(suggestionIds: string[]): Promise<ApplicationResult>;

  // Get opportunity stats
  getOpportunityStats(clientId: string): Promise<OpportunityStats>;
}

interface Opportunity {
  id: string;
  type: "depth_reduction" | "orphan_rescue" | "link_velocity" | "anchor_diversity";
  pageUrl: string;
  pageId: string;
  urgency: number;  // 0-1
  currentMetrics: OpportunityMetrics;
  targetMetrics: OpportunityMetrics;
  reason: string;
}

interface ScoredOpportunity extends Opportunity {
  score: number;  // 0-100
  tier: "critical" | "high" | "medium" | "low";
  estimatedImpact: ImpactEstimate;
  suggestedActions: string[];
}

interface OpportunityMetrics {
  clickDepth?: number;
  inboundLinkCount?: number;
  exactMatchAnchorCount?: number;
  pageRank?: number;
}

interface LinkSuggestion {
  id: string;
  opportunityId: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  anchorType: "exact" | "branded" | "misc";
  confidence: number;
  insertionMethod: "wrap_existing" | "append_sentence";
  existingTextMatch?: string;
  newSentence?: string;
  status: "pending" | "accepted" | "rejected" | "applied";
}

interface ApplicationResult {
  applied: number;
  failed: number;
  errors: { suggestionId: string; error: string }[];
}
```

**Dependencies:**
- `LinkArchitectureService`
- `link_opportunities` table (existing)
- `link_suggestions` table (existing)

**Events:**
- Publishes: `opportunity.detected`, `suggestion.generated`, `suggestion.applied`
- Subscribes: `audit.completed`, `link_architecture.analyzed`

**Storage:**
- `link_opportunities` table (existing)
- `link_suggestions` table (existing)

---

### 14. DeadLinkService

**Location:** `open-seo-main/src/server/features/linking/services/DeadLinkService.ts`

**Purpose:** Monitor link health, detect dead links, generate replacement suggestions with autopilot/HITL routing.

**Interface:**

```typescript
interface DeadLinkService {
  // Scan for dead links
  scanForDeadLinks(clientId: string): Promise<DeadLinkScan>;

  // Check single URL health
  checkUrlHealth(url: string): Promise<UrlHealth>;

  // Get dead links for client
  getDeadLinks(clientId: string, filters?: DeadLinkFilters): Promise<DeadLink[]>;

  // Generate replacement suggestions
  generateReplacements(deadLinkId: string): Promise<ReplacementSuggestion[]>;

  // Apply replacement (internal, autopilot eligible)
  applyReplacement(params: {
    deadLinkId: string;
    replacementUrl: string;
    userId?: string;  // Optional if autopilot
  }): Promise<ReplacementResult>;

  // Review queue for HITL
  getReviewQueue(clientId: string): Promise<DeadLinkReview[]>;

  // Approve replacement (HITL)
  approveReplacement(deadLinkId: string, replacementUrl: string, userId: string): Promise<void>;

  // Dismiss dead link
  dismissDeadLink(deadLinkId: string, userId: string, reason: string): Promise<void>;

  // Get dead link stats
  getDeadLinkStats(clientId: string): Promise<DeadLinkStats>;

  // Schedule regular health checks
  scheduleHealthChecks(clientId: string, frequency: "daily" | "weekly"): Promise<void>;
}

interface DeadLink {
  id: string;
  clientId: string;
  sourceUrl: string;
  targetUrl: string;
  anchorText: string;
  statusCode: number;
  isInternal: boolean;
  detectedAt: Date;
  lastCheckedAt: Date;
  status: "detected" | "replacement_pending" | "replaced" | "dismissed";
  autopilotEligible: boolean;  // Internal + confidence ≥0.85 + relevance ≥0.7
}

interface ReplacementSuggestion {
  id: string;
  deadLinkId: string;
  replacementUrl: string;
  replacementType: "internal_page" | "wayback_archive" | "alternative" | "remove";
  confidence: number;
  relevanceScore: number;
  anchorCompatibility: number;
  isAutopilotEligible: boolean;
  requiresHitl: boolean;
  hitlReason?: string;
}

interface UrlHealth {
  url: string;
  status: "healthy" | "redirect" | "broken" | "timeout";
  statusCode: number;
  redirectChain?: string[];
  responseTime: number;
  lastCheckedAt: Date;
}

// Autopilot criteria
const AUTOPILOT_CRITERIA = {
  isInternal: true,
  minConfidence: 0.85,
  minRelevance: 0.70,
  anchorUnchanged: true,
  replacementType: "internal_page" as const,  // Only internal replacements
};

// HITL required for
const HITL_REQUIRED = [
  "external links",
  "archive replacements",
  "alternative suggestions",
  "link removal",
  "confidence < 0.85",
  "anchor text change required",
];
```

**Dependencies:**
- `LinkArchitectureService` (find replacements)
- HTTP client (health checks)
- Wayback Machine API

**Events:**
- Publishes: `dead_link.detected`, `dead_link.replaced`, `dead_link.review_required`
- Subscribes: `audit.completed`, `scheduled_check.due`

**Storage:**
- `link_health` table (new)
- `dead_link_replacements` table (new)
- `link_health_history` table (new)

---

## Event Bus Architecture

All services communicate via Redis Pub/Sub for loose coupling:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REDIS EVENT BUS                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Stream A Events:                                                   │
│  ├── keyword.scrape.completed                                       │
│  ├── keyword.classified                                             │
│  ├── proposal.generated                                             │
│  ├── proposal.accepted                                              │
│  └── client.created                                                 │
│                                                                     │
│  Stream B Events:                                                   │
│  ├── calendar.item.created                                          │
│  ├── calendar.item.scheduled                                        │
│  ├── content.state.changed                                          │
│  ├── content.approved                                               │
│  └── content.published                                              │
│                                                                     │
│  Stream C Events:                                                   │
│  ├── content.generated                                              │
│  ├── voice.scored                                                   │
│  ├── quality_gate.passed                                            │
│  └── quality_gate.manual_required                                   │
│                                                                     │
│  Stream E Events:                                                   │
│  ├── link_architecture.analyzed                                     │
│  ├── opportunity.detected                                           │
│  ├── suggestion.applied                                             │
│  └── dead_link.detected                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Overview

### open_seo Database (PostgreSQL)

```
Existing Tables:
├── clients
├── prospect_keywords
├── proposals
├── voice_profiles
├── voice_analysis
├── voice_audit_log
├── link_graph
├── page_links
├── orphan_pages
├── link_opportunities
├── link_suggestions
├── keyword_cannibalization
└── schedule_schema (cron)

New Tables:
├── keyword_scrape_tasks
├── topic_clusters
├── hub_pages
├── link_health
├── dead_link_replacements
└── link_health_history
```

### alwrity Database (PostgreSQL)

```
Existing Tables:
├── articles
├── clients (AI-Writer specific)
├── voice_constraints
└── generation_jobs

New Tables:
├── content_calendar
├── calendar_item_history
├── keyword_priorities
├── content_workflow_history
├── content_versions
├── content_revisions
├── published_content
├── publishing_history
├── indexnow_submissions
├── generated_content
├── content_chunks
├── generation_costs
├── quality_evaluations
└── quality_check_results
```

---

## Cross-Service Integration

### Dual-Write Pattern

For data that needs to be consistent across both databases:

```typescript
// open-seo-main/src/db/dual-write.ts
export async function dualWriteVoiceAudit(audit: VoiceAuditLog): Promise<void> {
  // Write to open_seo.voice_audit_log
  await db.insert(voiceAuditLog).values(audit);
  
  // Publish event for AI-Writer to sync
  await redis.publish("voice.audit.created", JSON.stringify(audit));
}
```

### Service-to-Service Calls

```typescript
// Internal API calls between services
const AI_WRITER_BASE = process.env.AI_WRITER_URL || "http://localhost:8000";

export async function callContentGeneration(params: ArticleParams): Promise<Article> {
  const response = await fetch(`${AI_WRITER_BASE}/api/internal/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth": process.env.INTERNAL_API_KEY,
    },
    body: JSON.stringify(params),
  });
  return response.json();
}
```

---

## Implementation Priority

### Phase 1: Foundation (Sprint 1-2)
1. KeywordScrapingService - DataForSEO integration
2. KeywordClassificationService - Wire existing patterns
3. VoiceComplianceService - Extend existing

### Phase 2: Pipeline Core (Sprint 3-4)
4. ProposalGenerationService
5. ClientConversionService
6. ContentCalendarService

### Phase 3: Content System (Sprint 5-6)
7. PriorityQueueService
8. EditorialWorkflowService
9. ContentGenerationService

### Phase 4: Quality & Publishing (Sprint 7-8)
10. QualityGateService
11. PublishingService

### Phase 5: Linking (Sprint 9-10)
12. LinkArchitectureService
13. LinkOpportunityService
14. DeadLinkService

---

*Document created for Phase 99 service architecture. All services follow the existing codebase patterns and integrate via Redis event bus.*
