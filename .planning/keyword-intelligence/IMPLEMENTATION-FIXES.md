# Implementation Fixes for Keyword Intelligence System

> **Purpose:** Concrete solutions for all 10 gaps identified in GAPS-AND-CONTRADICTIONS.md  
> **Source of Truth:** `docs/infra-research/cpu-only-rag-graph.md` and `docs/infra-research/crawling-10-5000-tasks-day.md`  
> **Status:** Ready to implement

---

## Fix 1: Split Content Hash (Critical)

### Problem
Current code hashes price into content, breaking delta detection:
```python
content = f"{name}|{price}|{sku}|{brand_canonical}|{description}"
```

The crawling doc warns: *"Trafilatura extracts prices into the content hash — your SHA256 changes constantly, defeating the entire strategy"*

### Solution
Create TWO hashes serving different purposes:

```python
@dataclass
class ExtractedProduct:
    # ... existing fields ...
    
    # NEW: Separate hashes for different change detection needs
    seo_content_hash: str      # name + description + categories (stable, for delta crawling)
    inventory_hash: str        # price + stock (volatile, for inventory tracking)
    full_content_hash: str     # everything (for debugging/audit trail)

def compute_hashes(self, product_data: dict) -> tuple[str, str, str]:
    """Compute three separate hashes for different purposes."""
    
    # SEO content hash - EXCLUDES price/stock
    # Used by delta crawling cascade at L2
    seo_parts = [
        product_data['name_original'],
        product_data['description'],
        '|'.join(product_data.get('categories', [])),
        product_data.get('brand_canonical', ''),
    ]
    seo_hash = hashlib.sha256('|'.join(filter(None, seo_parts)).encode()).hexdigest()[:16]
    
    # Inventory hash - ONLY price/stock
    # Triggers lightweight price updates, not full re-extraction
    inv_parts = [
        str(product_data.get('price', '')),
        str(product_data.get('in_stock', '')),
        product_data.get('sku', ''),
    ]
    inv_hash = hashlib.sha256('|'.join(inv_parts).encode()).hexdigest()[:16]
    
    # Full hash - everything (for audit trail)
    full_hash = hashlib.sha256(json.dumps(product_data, sort_keys=True).encode()).hexdigest()[:16]
    
    return seo_hash, inv_hash, full_hash
```

### Change Detection Logic
```python
class ChangeType(Enum):
    ADD = "add"
    SEO_MODIFY = "seo_modify"      # Full re-extraction needed
    PRICE_UPDATE = "price_update"  # Just update price/stock node properties
    DELETE = "delete"
    UNCHANGED = "unchanged"

def detect_change(old: EntitySnapshot, new: EntitySnapshot) -> ChangeType:
    if old is None:
        return ChangeType.ADD
    
    if old.seo_content_hash != new.seo_content_hash:
        # Name, description, or categories changed
        # Requires full re-extraction + re-embedding
        return ChangeType.SEO_MODIFY
    
    if old.inventory_hash != new.inventory_hash:
        # Only price/stock changed
        # Just update node properties, skip NLP/embedding
        return ChangeType.PRICE_UPDATE
    
    return ChangeType.UNCHANGED
```

### Impact
- Delta crawling savings restored: **65-80% of fetches eliminated**
- Price changes no longer trigger expensive re-embedding

---

## Fix 2: Unify Embedding Model (High Priority)

### Problem
Multiple documents specify different dimensions: 384, 768, 1024, 1536

### Decision (from infra doc)
> "jina-embeddings-v3 best for Lithuanian (Cohen's κ 0.62, AUC-ROC 0.887)"  
> "OpenAI text-embedding-3... Weak [for Lithuanian]"

### Unified Configuration
```python
# config/embeddings.py
EMBEDDING_CONFIG = {
    # Primary model - best Lithuanian quality
    "model": "jinaai/jina-embeddings-v3",
    "model_fallback": "intfloat/multilingual-e5-base",
    
    # Dimensions
    "native_dim": 1024,      # jina-v3 native
    "storage_dim": 384,      # Matryoshka truncation for storage
    "query_dim": 768,        # Full precision for queries (optional)
    
    # Prefixes (required for e5 models)
    "query_prefix": "query: ",
    "passage_prefix": "passage: ",
    
    # Runtime
    "device": "cpu",
    "quantization": "int8",  # ONNX INT8 for CPU inference
    "batch_size": 32,
}
```

### Single Embedding Service
```python
class UnifiedEmbeddingService:
    """Single source of truth for all embeddings in the system."""
    
    def __init__(self, config: dict = EMBEDDING_CONFIG):
        self.config = config
        self._model = None
    
    @property
    def model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(
                self.config["model"],
                device=self.config["device"]
            )
        return self._model
    
    def embed_passages(self, texts: list[str], truncate: bool = True) -> np.ndarray:
        """Embed documents/passages for storage."""
        prefixed = [f"{self.config['passage_prefix']}{t}" for t in texts]
        embeddings = self.model.encode(prefixed, normalize_embeddings=True)
        
        if truncate:
            # Matryoshka truncation to storage dimension
            embeddings = embeddings[:, :self.config["storage_dim"]]
        
        return embeddings.astype(np.float16)  # halfvec for pgvector
    
    def embed_query(self, text: str, truncate: bool = True) -> np.ndarray:
        """Embed query for search."""
        prefixed = f"{self.config['query_prefix']}{text}"
        embedding = self.model.encode([prefixed], normalize_embeddings=True)[0]
        
        if truncate:
            embedding = embedding[:self.config["storage_dim"]]
        
        return embedding.astype(np.float32)
```

### LightRAG Integration
```python
# Use the SAME embedding service for LightRAG
embedding_service = UnifiedEmbeddingService()

async def lightrag_embedding_func(texts: list[str]) -> list[list[float]]:
    """Adapter for LightRAG to use our unified embeddings."""
    embeddings = embedding_service.embed_passages(texts, truncate=True)
    return embeddings.tolist()

rag = LightRAG(
    working_dir=f"./lightrag/{tenant_id}",
    embedding_func=lightrag_embedding_func,
    embedding_dim=EMBEDDING_CONFIG["storage_dim"],  # 384
    # Use NetworkX for simplicity (per infra doc recommendation for <50k entities)
    graph_storage="NetworkXStorage",
    vector_storage="NanoVectorDBStorage",
)
```

### Schema Update
```sql
-- All vector columns use the SAME dimension
ALTER TABLE product_embeddings 
    ALTER COLUMN embedding TYPE halfvec(384);

-- FalkorDB schema
CALL db.idx.vector.createNodeIndex(
  'Product', 'embedding', 384, 'cosine'  -- Not 768!
)
```

---

## Fix 3: Lithuanian Morphology — Use Stanza

### Problem
Code claims spaCy `lt_core_news_sm` which has limited quality.

### Solution
```python
class LithuanianNormalizer:
    """
    Lithuanian text normalization with proper morphological handling.
    
    Cascade:
    1. Stanza (best for Baltic languages)
    2. Rule-based LEMMA_MAP (domain-specific fallback)
    3. Lowercase passthrough (last resort)
    """
    
    # Expanded domain-specific lemma map (100+ terms)
    LEMMA_MAP: dict[str, str] = {
        # Dative plural -> Nominative (category names)
        "plaukams": "plaukai",
        "dažytiems": "dažytas",
        "pažeistiems": "pažeistas",
        "riebiems": "riebus",
        "sausiems": "sausas",
        "normaliems": "normalus",
        "garbanotiems": "garbanotas",
        "ploniems": "plonas",
        "storiems": "storas",
        "silpniems": "silpnas",
        "stipriems": "stiprus",
        "spalvotiems": "spalvotas",
        
        # Product types (plural -> singular)
        "šampūnai": "šampūnas",
        "kondicionieriai": "kondicionierius",
        "kaukės": "kaukė",
        "aliejai": "aliejus",
        "serumai": "serumas",
        "purškikliai": "purškiklis",
        "balzamai": "balzamas",
        "losjonai": "losjonas",
        "kremai": "kremas",
        "putos": "puta",
        "geliai": "gelis",
        "vaškai": "vaškas",
        "dažai": "dažas",
        
        # Actions/treatments (genitive/dative -> nominative)
        "priežiūrai": "priežiūra",
        "priežiūros": "priežiūra",
        "stiprinimui": "stiprinimas",
        "stiprinimo": "stiprinimas",
        "drėkinimui": "drėkinimas",
        "drėkinimo": "drėkinimas",
        "atstatymui": "atstatymas",
        "atstatymo": "atstatymas",
        "apsaugai": "apsauga",
        "apsaugos": "apsauga",
        "formavimui": "formavimas",
        "formavimo": "formavimas",
        
        # Hair types
        "plaukų": "plaukai",
        "galvos": "galva",
        "odos": "oda",
    }
    
    def __init__(self):
        self._stanza_nlp = None
        self._init_stanza()
    
    def _init_stanza(self):
        try:
            import stanza
            # Check if model exists, download if not
            try:
                self._stanza_nlp = stanza.Pipeline(
                    'lt', 
                    processors='tokenize,lemma',
                    download_method=None  # Don't auto-download
                )
            except Exception:
                # Download model first time
                stanza.download('lt', processors='tokenize,lemma')
                self._stanza_nlp = stanza.Pipeline('lt', processors='tokenize,lemma')
        except ImportError:
            logger.warning("Stanza not installed, using rule-based lemmatization")
    
    def lemmatize(self, text: str) -> str:
        """Convert text to lemmatized form (nominative case)."""
        text_lower = text.lower().strip()
        
        # Try Stanza first
        if self._stanza_nlp:
            try:
                doc = self._stanza_nlp(text_lower)
                lemmas = [word.lemma for sent in doc.sentences for word in sent.words]
                return ' '.join(lemmas)
            except Exception as e:
                logger.debug(f"Stanza failed, falling back to rules: {e}")
        
        # Rule-based fallback
        words = text_lower.split()
        lemmatized = [self.LEMMA_MAP.get(word, word) for word in words]
        return ' '.join(lemmatized)
    
    def normalize_for_search(self, text: str) -> str:
        """Full normalization: lemmatize + remove diacritics + lowercase."""
        lemmatized = self.lemmatize(text)
        # Remove Lithuanian diacritics for fuzzy matching
        ascii_map = str.maketrans('ąčęėįšųūž', 'aceeisuuz')
        return lemmatized.translate(ascii_map)
```

---

## Fix 4: Cookie Consent / Bot Challenge Detection

### Problem
HTTP 200 responses with consent shells are extracted as products.

### Solution
```python
class PageValidator:
    """Detect consent walls, bot challenges, and other blocking pages."""
    
    # Platform signatures in HTML
    CONSENT_SIGNATURES = [
        # Cookie consent platforms
        'cookiebot', 'onetrust', 'iubenda', 'cookieconsent', 
        'cookie-law-info', 'gdpr-cookie-compliance', 'cookie-notice',
        'tarteaucitron', 'cookiefirst', 'quantcast',
        
        # Cloudflare challenges
        'cf-challenge', 'cf-turnstile', 'cf-chl-bypass', 
        'challenge-platform', 'cf-browser-verification',
        
        # Bot detection services
        'captcha', 'recaptcha', 'hcaptcha', 'datadome', 
        'perimeterx', 'kasada', 'akamai-bot-manager',
        
        # Generic blocking
        'browser-check', 'checking your browser', 
        'please wait', 'verifying', 'access denied',
    ]
    
    # DOM elements that indicate consent banners
    CONSENT_DOM_SELECTORS = [
        '#onetrust-consent-sdk',
        '#CookiebotDialog',
        '#CookiebotDialogBody',
        '.cc-banner',
        '#gdpr-cookie-notice',
        '[data-cookieconsent]',
        '.cookie-consent-banner',
        '#tarteaucitronRoot',
        '.qc-cmp-ui-container',
    ]
    
    # Minimum content thresholds
    MIN_HTML_SIZE = 5000        # Consent pages are usually small
    MIN_CONTENT_LENGTH = 200   # Main content text length
    
    def validate(self, html: str, tree: HTMLParser) -> ValidationResult:
        """
        Validate that a page contains real content, not a consent/challenge wall.
        
        Returns:
            ValidationResult with is_valid, reason, and suggested_action
        """
        html_lower = html.lower()
        
        # Check 1: Known platform signatures
        for sig in self.CONSENT_SIGNATURES:
            if sig in html_lower:
                # Signature found - but is content also present?
                if not self._has_main_content(tree):
                    return ValidationResult(
                        is_valid=False,
                        reason=f"consent_or_challenge:{sig}",
                        suggested_action="retry_with_js"
                    )
        
        # Check 2: Suspiciously small page
        if len(html) < self.MIN_HTML_SIZE:
            if 'cookie' in html_lower or 'captcha' in html_lower:
                return ValidationResult(
                    is_valid=False,
                    reason="small_page_with_consent_keywords",
                    suggested_action="retry_with_js"
                )
        
        # Check 3: Consent banner DOM without main content
        for selector in self.CONSENT_DOM_SELECTORS:
            if tree.css_first(selector):
                if not self._has_main_content(tree):
                    return ValidationResult(
                        is_valid=False,
                        reason=f"consent_banner_blocking:{selector}",
                        suggested_action="retry_with_js"
                    )
        
        # Check 4: No product-like content at all
        if not self._looks_like_product_page(tree):
            return ValidationResult(
                is_valid=False,
                reason="no_product_content_found",
                suggested_action="skip_or_reclassify"
            )
        
        return ValidationResult(is_valid=True, reason="ok", suggested_action=None)
    
    def _has_main_content(self, tree: HTMLParser) -> bool:
        """Check if page has substantial main content."""
        content_selectors = [
            'main', 'article', '.product-description', 
            '[itemprop="description"]', '.content', '#content'
        ]
        for sel in content_selectors:
            elem = tree.css_first(sel)
            if elem:
                text = elem.text(strip=True)
                if len(text) > self.MIN_CONTENT_LENGTH:
                    return True
        return False
    
    def _looks_like_product_page(self, tree: HTMLParser) -> bool:
        """Check for product page indicators."""
        indicators = [
            '[itemprop="product"]',
            '[itemtype*="schema.org/Product"]',
            '.product-title', '.product-name',
            '[data-product-id]', '[data-sku]',
            '.add-to-cart', '.buy-button',
        ]
        return any(tree.css_first(sel) for sel in indicators)


@dataclass
class ValidationResult:
    is_valid: bool
    reason: str
    suggested_action: str | None  # "retry_with_js", "skip_or_reclassify", None
```

### Integration with Extractor
```python
class ProductExtractor:
    def __init__(self):
        self.validator = PageValidator()
        self.normalizer = LithuanianNormalizer()
    
    def extract(self, html: str, url: str) -> ExtractedProduct | None:
        tree = HTMLParser(html)
        
        # CRITICAL: Validate page BEFORE extraction
        validation = self.validator.validate(html, tree)
        if not validation.is_valid:
            logger.info(f"Page validation failed: {url} - {validation.reason}")
            # Return None signals "needs JS rendering" to crawler
            return None
        
        # ... proceed with extraction
```

---

## Fix 5: Architectural Decision — FalkorDB + AGE Coexistence

### Decision
Both can coexist serving different purposes:

| Component | Technology | Purpose |
|-----------|------------|---------|
| Product Catalog Graph | **FalkorDB** | Per-tenant, real-time, keyword classification |
| Vector Storage | **PostgreSQL + pgvector** | Multi-tenant embeddings, DiskANN |
| LightRAG Storage | **NetworkX + NanoVectorDB** | Per-tenant, in-memory, entity extraction |

### Rationale
- FalkorDB: Graph-per-tenant isolation, sub-10ms traversals, Redis-native
- pgvector: 100M vectors with DiskANN, halfvec storage, proven at scale
- LightRAG with NetworkX: Simpler than AGE, sufficient for <50k entities per tenant

### Configuration
```python
# services/storage.py

class StorageConfig:
    # FalkorDB for product catalog graphs
    FALKORDB_HOST = "localhost"
    FALKORDB_PORT = 6379
    FALKORDB_GRAPH_PREFIX = "kg"  # kg:{tenant_id}
    
    # PostgreSQL for vectors and relational data
    POSTGRES_DSN = "postgresql://user:pass@localhost:5432/tevero_seo"
    PGVECTOR_DIMENSION = 384
    
    # LightRAG uses local storage per tenant
    LIGHTRAG_BASE_DIR = "./data/lightrag"
    LIGHTRAG_STORAGE = "NetworkXStorage"  # NOT PGGraphStorage

def get_tenant_graph(tenant_id: str) -> FalkorDBGraph:
    """Get or create tenant's product catalog graph."""
    db = FalkorDB(host=StorageConfig.FALKORDB_HOST)
    return db.select_graph(f"{StorageConfig.FALKORDB_GRAPH_PREFIX}:{tenant_id}")

def get_tenant_lightrag(tenant_id: str) -> LightRAG:
    """Get or create tenant's LightRAG instance."""
    return LightRAG(
        working_dir=f"{StorageConfig.LIGHTRAG_BASE_DIR}/{tenant_id}",
        graph_storage=StorageConfig.LIGHTRAG_STORAGE,
        vector_storage="NanoVectorDBStorage",
        embedding_func=unified_embedding_func,
    )
```

---

## Fix 6: Task Decomposition — Route 60-70% to APIs

### Problem
System assumes crawling everything. Crawling doc says 60-70% should use APIs.

### Solution
```python
from enum import Enum
from dataclasses import dataclass

class DataSource(Enum):
    CRAWL = "crawl"                    # Client site - must crawl
    DATAFORSEO_LABS = "dataforseo_labs"  # Competitor keywords
    DATAFORSEO_SERP = "dataforseo_serp"  # SERP analysis
    DATAFORSEO_BACKLINKS = "dataforseo_backlinks"
    CACHE = "cache"                    # Already have data

@dataclass
class KeywordTask:
    keywords: list[str]
    task_type: str    # "client_audit", "competitor_gap", "serp_analysis", "backlinks"
    domain: str
    client_id: str
    
class TaskRouter:
    """
    Routes tasks to optimal data source based on type and cache state.
    
    Cost comparison (from infra doc):
    - Crawl competitor: $0.30-0.75
    - DataForSEO Labs: $0.01-0.05
    - Savings: 6-15x
    """
    
    # Task type -> Default data source
    ROUTING_TABLE = {
        "client_audit": DataSource.CRAWL,           # Must crawl client's site
        "competitor_gap": DataSource.DATAFORSEO_LABS,  # API is 10x cheaper
        "keyword_research": DataSource.DATAFORSEO_LABS,
        "serp_analysis": DataSource.DATAFORSEO_SERP,
        "backlink_audit": DataSource.DATAFORSEO_BACKLINKS,
        "local_seo": DataSource.DATAFORSEO_SERP,
    }
    
    def __init__(self, cache: RedisCache, dataforseo: DataForSEOClient):
        self.cache = cache
        self.api = dataforseo
    
    async def route(self, task: KeywordTask) -> DataSource:
        """Determine optimal data source for task."""
        
        # Check cache first (shared across tenants)
        cache_key = f"keywords:{task.domain}:{hash(tuple(sorted(task.keywords)))}"
        if await self.cache.exists(cache_key):
            return DataSource.CACHE
        
        # Route based on task type
        default_source = self.ROUTING_TABLE.get(task.task_type, DataSource.CRAWL)
        
        # Override: Client site ALWAYS requires crawl (to get their product catalog)
        if task.task_type == "client_audit":
            return DataSource.CRAWL
        
        return default_source
    
    async def execute(self, task: KeywordTask) -> TaskResult:
        """Execute task via optimal source."""
        source = await self.route(task)
        
        if source == DataSource.CACHE:
            return await self._from_cache(task)
        elif source == DataSource.CRAWL:
            return await self._crawl_and_extract(task)
        elif source == DataSource.DATAFORSEO_LABS:
            return await self._dataforseo_labs(task)
        elif source == DataSource.DATAFORSEO_SERP:
            return await self._dataforseo_serp(task)
        elif source == DataSource.DATAFORSEO_BACKLINKS:
            return await self._dataforseo_backlinks(task)
    
    async def _dataforseo_labs(self, task: KeywordTask) -> TaskResult:
        """
        Use DataForSEO Labs for competitor keyword data.
        
        Cost: $0.01 + $0.0001/keyword = $0.11 per 1000 keywords
        vs Crawl: $0.30-0.75 per competitor site
        """
        result = await self.api.keywords_for_domain(
            domain=task.domain,
            location_code=2440,  # Lithuania
            language_code="lt",
            limit=len(task.keywords) or 1000,
        )
        
        # Cache result (shared across tenants)
        await self.cache.set(
            f"keywords:{task.domain}",
            result,
            ttl=86400 * 7  # 7 days
        )
        
        return TaskResult(source=DataSource.DATAFORSEO_LABS, data=result)
```

### Workflow Change
```
BEFORE (naive):
  Every keyword task → Crawl → Extract → Classify

AFTER (optimized):
  Client site audit → Crawl → Extract → Classify (5-10% of tasks)
  Competitor keywords → DataForSEO Labs API → Classify (35-45%)
  SERP analysis → DataForSEO SERP API → Analyze (15-20%)
  Backlinks → DataForSEO Backlinks API (10-15%)
```

### Cost Impact
| Task Type | Before (Crawl) | After (API) | Savings |
|-----------|----------------|-------------|---------|
| Competitor gap | $0.50 | $0.05 | 10x |
| Keyword research | $0.30 | $0.03 | 10x |
| SERP analysis | $0.20 | $0.006 | 33x |
| **Blended 5000 tasks/day** | $1,500/day | $150/day | **10x** |

---

## Fix 7: Singleflight Implementation for Classification

### Implementation
```python
class ClassificationSingleflight:
    """
    Ensures only one LLM classification runs for identical requests.
    50 clients classifying "šampūnas dažytiems plaukams" share ONE LLM call.
    
    Key insight: Cache key must include category set hash!
    Two clients with different product catalogs get different results.
    """
    
    LEADER_TTL = 60      # Classification is fast
    RESULT_TTL = 604800  # 7 days cache
    
    def __init__(self, redis: Redis):
        self.redis = redis
        self._claim_script = self.redis.register_script("""
            if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then
                return 1
            end
            return 0
        """)
    
    def _cache_key(self, keyword: str, categories: list[str]) -> str:
        """
        Cache key = keyword + hash of available categories.
        
        Two clients with SAME categories CAN share results.
        Two clients with DIFFERENT categories CANNOT.
        """
        keyword_normalized = keyword.lower().strip()
        cat_hash = hashlib.sha256(
            '|'.join(sorted(c.lower() for c in categories)).encode()
        ).hexdigest()[:8]
        
        combined = f"{keyword_normalized}:{cat_hash}"
        return hashlib.sha256(combined.encode()).hexdigest()[:16]
    
    async def classify(
        self,
        keyword: str,
        categories: list[str],
        classifier: Callable,
    ) -> ClassificationResult:
        """
        Classify with cross-tenant deduplication.
        
        Pattern from infra doc:
        1. Check cache
        2. Try to become leader (SET NX EX - atomic!)
        3. If leader: classify, cache, notify waiters
        4. If follower: subscribe BEFORE recheck, wait for result
        """
        k = self._cache_key(keyword, categories)
        lkey = f"classify:leader:{k}"
        rkey = f"classify:result:{k}"
        chan = f"classify:done:{k}"
        
        # Check cache first
        cached = await self.redis.get(rkey)
        if cached:
            return ClassificationResult.from_json(cached)
        
        # Try to become leader (atomic SET NX EX)
        worker_id = f"{os.getpid()}:{time.monotonic()}"
        am_leader = await self._claim_script(
            keys=[lkey], 
            args=[worker_id, self.LEADER_TTL]
        )
        
        if am_leader:
            return await self._do_as_leader(
                keyword, categories, classifier, lkey, rkey, chan
            )
        else:
            return await self._wait_as_follower(
                keyword, categories, classifier, lkey, rkey, chan
            )
    
    async def _do_as_leader(
        self, keyword, categories, classifier, lkey, rkey, chan
    ) -> ClassificationResult:
        """Leader executes classification and shares result."""
        try:
            result = await classifier(keyword, categories)
            
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.set(rkey, result.to_json(), ex=self.RESULT_TTL)
                pipe.delete(lkey)
                pipe.publish(chan, "done")
                await pipe.execute()
            
            return result
            
        except Exception as e:
            # Release lock and notify waiters of failure
            await self.redis.delete(lkey)
            await self.redis.publish(chan, "fail")
            raise
    
    async def _wait_as_follower(
        self, keyword, categories, classifier, lkey, rkey, chan
    ) -> ClassificationResult:
        """Follower waits for leader's result."""
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(chan)
        
        try:
            # CRITICAL: Check cache AFTER subscribe (no lost wakeup)
            cached = await self.redis.get(rkey)
            if cached:
                return ClassificationResult.from_json(cached)
            
            # Wait for leader
            deadline = time.monotonic() + 55  # Slightly less than LEADER_TTL
            while time.monotonic() < deadline:
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, 
                    timeout=5.0
                )
                
                if msg and msg["data"] == b"done":
                    cached = await self.redis.get(rkey)
                    if cached:
                        return ClassificationResult.from_json(cached)
                
                if msg and msg["data"] == b"fail":
                    # Leader failed, try to become new leader
                    return await self.classify(keyword, categories, classifier)
            
            # Timeout - leader probably crashed without notify
            raise TimeoutError(f"Classification timeout for {keyword}")
            
        finally:
            await pubsub.unsubscribe(chan)
            await pubsub.close()
```

---

## Fix 8: Document Cold Start Costs

### Cost Curve Documentation
```python
# docs/COST_MODEL.md content

"""
## Classification Cost Curve

The cache flywheel improves costs as more clients join:

| Client # | Cache Hit Rate | Cost per 500 Keywords | Notes |
|----------|----------------|----------------------|-------|
| 1        | 0%             | $0.50                | All LLM calls |
| 10       | 30%            | $0.35                | Some overlap |
| 50       | 60%            | $0.20                | Significant sharing |
| 100      | 70%            | $0.15                | Good cache coverage |
| 500      | 90%            | $0.05                | Mature cache |
| 1000     | 95%            | $0.025               | Cache flywheel engaged |

## Cost Mitigation Strategies

### 1. Pre-warm Cache
```python
COMMON_LITHUANIAN_KEYWORDS = [
    # Load 500+ common hair care keywords
    "šampūnas", "kondicionierius", "plaukų kaukė", ...
]

async def warm_cache_for_vertical(vertical: str, categories: list[str]):
    keywords = load_common_keywords(vertical)
    for kw in keywords:
        await singleflight.classify(kw, categories, classifier)
```

### 2. Seed from DataForSEO
Get top keywords in the vertical before first client:
```python
top_keywords = await dataforseo.get_top_keywords(
    category="beauty_and_personal_care",
    location="Lithuania",
    limit=1000
)
```

### 3. Tiered Pricing
- First client in vertical: $50 setup fee (covers cache seeding)
- Subsequent clients: No setup fee (benefit from cache)
"""
```

---

## Fix 9: Clarify LightRAG vs Classification Costs

### Updated README Section
```markdown
## Cost Model

### One-Time Costs (Per Client Onboarding)

| Operation | Cost | Frequency | Notes |
|-----------|------|-----------|-------|
| Site crawl (500 products) | $0.024 | Once | Delta after first crawl |
| LightRAG indexing | $9.20 | Once | Incremental updates after |
| Cache warming | $0.50 | Once | If first in vertical |
| **Total onboarding** | ~$10 | Once | |

### Ongoing Costs (Per Analysis Run)

| Operation | Cost | Frequency | Notes |
|-----------|------|-----------|-------|
| Keyword classification | $0.00008/kw | Per run | 95% cache hit assumed |
| 500 keywords analysis | $0.04 | Weekly | After cache maturity |
| Delta crawl (20% changed) | $0.005 | Weekly | Template-aware hash |
| DataForSEO competitor data | $0.05 | Weekly | API, not crawl |
| **Monthly (4 runs)** | ~$0.40 | Recurring | Per client |

### Cost Breakdown by Operation Type

| Operation | What It Does | When It Runs |
|-----------|--------------|--------------|
| **LightRAG indexing** | Extract entities from pages, build knowledge graph | Onboarding + incremental |
| **Keyword classification** | Match keyword to client's categories | Every analysis run |
| **Delta crawling** | Check for content changes | Weekly monitoring |
| **DataForSEO API** | Get competitor/SERP data | Every analysis run |
```

---

## Fix 10: Graceful Degradation

### Circuit Breaker Pattern
```python
from dataclasses import dataclass, field
from enum import Enum
import time

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery

@dataclass
class CircuitBreaker:
    failure_threshold: int = 3
    reset_timeout: float = 60.0
    
    _failures: int = field(default=0, init=False)
    _state: CircuitState = field(default=CircuitState.CLOSED, init=False)
    _last_failure: float = field(default=0.0, init=False)
    
    @property
    def is_open(self) -> bool:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure > self.reset_timeout:
                self._state = CircuitState.HALF_OPEN
                return False
            return True
        return False
    
    def record_failure(self):
        self._failures += 1
        self._last_failure = time.monotonic()
        if self._failures >= self.failure_threshold:
            self._state = CircuitState.OPEN
    
    def record_success(self):
        self._failures = 0
        self._state = CircuitState.CLOSED
```

### Service With Fallbacks
```python
class ResilientClassifier:
    """
    Classifier with multiple fallback levels.
    
    Cascade:
    1. Claude Sonnet (primary)
    2. GPT-4o-mini (fallback)
    3. Rule-based heuristics (last resort)
    """
    
    def __init__(self):
        self.claude = ClaudeClient()
        self.openai = OpenAIClient()
        self.rules = RuleBasedClassifier()
        
        self.claude_circuit = CircuitBreaker(failure_threshold=3, reset_timeout=60)
        self.openai_circuit = CircuitBreaker(failure_threshold=5, reset_timeout=120)
    
    async def classify(self, keyword: str, categories: list[str]) -> ClassificationResult:
        # Try Claude first
        if not self.claude_circuit.is_open:
            try:
                result = await self.claude.classify(keyword, categories)
                self.claude_circuit.record_success()
                return result
            except (RateLimitError, TimeoutError, APIError) as e:
                self.claude_circuit.record_failure()
                logger.warning(f"Claude failed: {e}")
        
        # Fallback to GPT-4o-mini
        if not self.openai_circuit.is_open:
            try:
                result = await self.openai.classify(keyword, categories)
                self.openai_circuit.record_success()
                return result.with_source("openai_fallback")
            except (RateLimitError, TimeoutError, APIError) as e:
                self.openai_circuit.record_failure()
                logger.warning(f"OpenAI failed: {e}")
        
        # Last resort: rule-based
        logger.error("All LLM services down, using rule-based classification")
        return self.rules.classify(keyword, categories).with_source("rules_fallback")


class ResilientEmbedding:
    """
    Embedding service with local + API fallback.
    """
    
    def __init__(self):
        self.local = LocalONNXEmbedding()  # Always available
        self.api = JinaEmbeddingAPI()       # Higher quality fallback
        self.cache = EmbeddingCache()
        
        self.api_circuit = CircuitBreaker()
    
    async def embed(self, texts: list[str]) -> np.ndarray:
        # Check cache first
        cached = await self.cache.get_many(texts)
        uncached = [t for t, c in zip(texts, cached) if c is None]
        
        if not uncached:
            return np.array(cached)
        
        # Try local model first (always available, no external dependency)
        try:
            embeddings = self.local.encode(uncached)
        except Exception as e:
            logger.error(f"Local embedding failed: {e}")
            
            # Fallback to API
            if not self.api_circuit.is_open:
                try:
                    embeddings = await self.api.embed(uncached)
                    self.api_circuit.record_success()
                except Exception as e2:
                    self.api_circuit.record_failure()
                    logger.error(f"API embedding failed: {e2}")
                    # Return zero vectors as last resort
                    embeddings = np.zeros((len(uncached), 384))
        
        # Cache results
        await self.cache.set_many(uncached, embeddings)
        
        # Merge cached and new
        result = []
        embed_iter = iter(embeddings)
        for c in cached:
            result.append(c if c is not None else next(embed_iter))
        
        return np.array(result)
```

### Graph Storage Fallback
```python
class ResilientGraph:
    """
    FalkorDB with PostgreSQL+AGE fallback.
    """
    
    def __init__(self):
        self.falkordb = FalkorDBClient()
        self.postgres = PostgresAGEClient()
        self.circuit = CircuitBreaker(failure_threshold=3, reset_timeout=30)
    
    async def query(self, tenant_id: str, cypher: str, params: dict = None):
        if not self.circuit.is_open:
            try:
                result = await self.falkordb.query(f"kg:{tenant_id}", cypher, params)
                self.circuit.record_success()
                return result
            except (MemoryError, ConnectionError, TimeoutError) as e:
                self.circuit.record_failure()
                logger.warning(f"FalkorDB failed: {e}")
        
        # Fallback to PostgreSQL + AGE
        # AGE uses mostly compatible Cypher
        return await self.postgres.query(tenant_id, cypher, params)
```

---

## Implementation Order

1. **Fix 1 (Content Hash)** — 2 hours — Unblocks delta crawling savings
2. **Fix 4 (Consent Detection)** — 1 hour — Prevents garbage extraction
3. **Fix 2 (Embedding Model)** — 3 hours — Single source of truth
4. **Fix 3 (Stanza)** — 1 hour — Better Lithuanian morphology
5. **Fix 7 (Singleflight)** — 3 hours — Cross-tenant cost sharing
6. **Fix 6 (Task Router)** — 4 hours — 10x cost reduction on competitor tasks
7. **Fix 10 (Degradation)** — 4 hours — Production resilience
8. **Fixes 5,8,9 (Docs)** — 2 hours — Documentation updates

**Total: ~20 hours of focused work**
