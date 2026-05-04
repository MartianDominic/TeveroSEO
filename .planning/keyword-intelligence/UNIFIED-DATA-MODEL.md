# Unified Data Model: Site Structure + Keywords + Page Types

> **Purpose**: Design the data architecture that unifies site category structure, client priority keywords, and page type targeting for the Keyword Intelligence System.
> **Context**: Client plaukupasaka.lt with 3000 analyzed keywords wants to rank for 10 priority menu categories.

---

## The Core Problem

Four separate data dimensions need unified modeling:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE FOUR DIMENSIONS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DIMENSION 1: SITE STRUCTURE (from scraping)                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Menu navigation hierarchy:                                          │   │
│  │   Korėjietiška kosmetika (top-level)                                │   │
│  │     ├── Veido šveitikliai (subcategory)                             │   │
│  │     ├── Veido kaukės (subcategory)                                  │   │
│  │     └── Veido serumai (subcategory)                                 │   │
│  │   Plaukų priežiūra                                                  │   │
│  │     ├── Šampūnai                                                    │   │
│  │     └── Kondicionieriai                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DIMENSION 2: PAGE TYPES (from sitemap analysis)                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ category_listing: /korejietiska-kosmetika (targets head terms)      │   │
│  │ product:          /veido-serumai/snail-mucin-123 (targets long-tail)│   │
│  │ blog:             /blog/kaip-pasirinkti-seruma (informational)      │   │
│  │ collection:       /rinkiniai/veido-prieziura (bundled products)     │   │
│  │ brand:            /brendai/cosrx (brand pages)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DIMENSION 3: KEYWORDS (from DataForSEO)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3000 keywords with:                                                 │   │
│  │   - search_volume, cpc, keyword_difficulty                          │   │
│  │   - current_position (if ranking)                                   │   │
│  │   - intent (informational/commercial/transactional)                 │   │
│  │   - funnel_stage (BOFU/MOFU/TOFU) [NEW - to be classified]         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DIMENSION 4: CLIENT PRIORITIES (from conversation)                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "Man norėtųsi iškilti aukščiau pagrindinėse meniu kategorijose.     │   │
│  │  Iš jų su 10 būtų tobula išsikelti į pirmą puslapį."                │   │
│  │                                                                     │   │
│  │ Translation: "I want to rank higher in main menu categories.        │   │
│  │              Getting 10 of them to page 1 would be perfect."        │   │
│  │                                                                     │   │
│  │ PRIORITY CATEGORIES (subset of menu):                               │   │
│  │   1. Korėjietiška kosmetika (whole category)                        │   │
│  │   2. Veido serumai                                                  │   │
│  │   3. Šampūnai                                                       │   │
│  │   ... (7 more to be selected)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Unified Entity Model

### Core Entities

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIP DIAGRAM                          │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐         ┌─────────────────┐         ┌──────────────┐       │
│   │   Client    │────────▶│  SiteCategory   │◀───────▶│    Page      │       │
│   │             │   1:N   │ (taxonomy)      │   N:N   │ (crawled)    │       │
│   └─────────────┘         └─────────────────┘         └──────────────┘       │
│         │                        │                           │               │
│         │                        │ 1:N (priority)            │               │
│         │                        ▼                           │               │
│         │                 ┌─────────────────┐                │               │
│         │                 │ ClientPriority  │                │               │
│         │                 │ (the 10 cats)   │                │               │
│         │                 └─────────────────┘                │               │
│         │                        │                           │               │
│         │                        │ affects scoring           │               │
│         │                        ▼                           │               │
│         │  1:N            ┌─────────────────┐         N:N    │               │
│         └────────────────▶│    Keyword      │◀───────────────┘               │
│                           │ (3000 analyzed) │                                │
│                           └─────────────────┘                                │
│                                  │                                           │
│                                  │ classification                            │
│                                  ▼                                           │
│                           ┌─────────────────┐                                │
│                           │  KeywordMatch   │                                │
│                           │ (kw → page)     │                                │
│                           └─────────────────┘                                │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Schema Definitions

#### 1. SiteCategory (Taxonomy from Scraping)

```typescript
// Represents the site's category structure extracted from menu/sitemap
export const siteCategories = pgTable('site_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  
  // Hierarchy
  name: text('name').notNull(),                    // "Veido serumai"
  slug: text('slug').notNull(),                    // "veido-serumai"
  parentId: uuid('parent_id'),                     // Self-reference for hierarchy
  depth: integer('depth').notNull().default(0),    // 0 = top-level, 1 = sub, etc.
  path: text('path'),                              // "korejietiska-kosmetika/veido-serumai"
  
  // Source
  sourceType: text('source_type').$type<'menu' | 'sitemap' | 'breadcrumb' | 'manual'>().notNull(),
  sourceUrl: text('source_url'),                   // URL where category was found
  
  // SEO metadata (extracted from category page)
  pageUrl: text('page_url'),                       // /korejietiska-kosmetika/veido-serumai
  pageTitle: text('page_title'),                   // "Veido serumai | Plaukų pasaka"
  metaDescription: text('meta_description'),
  h1: text('h1'),
  
  // Stats (updated by crawling)
  productCount: integer('product_count'),          // Number of products in category
  childCategoryCount: integer('child_category_count'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastCrawledAt: timestamp('last_crawled_at'),
}, (table) => ({
  parentFk: foreignKey({
    columns: [table.parentId],
    foreignColumns: [table.id],
  }),
  clientIdx: index('ix_site_categories_client').on(table.clientId),
  slugIdx: index('ix_site_categories_slug').on(table.clientId, table.slug),
  pathIdx: index('ix_site_categories_path').on(table.clientId, table.path),
}));
```

#### 2. ClientPriority (The 10 Categories Client Wants to Rank For)

```typescript
// Client's priority categories - links to site_categories with weight
export const clientPriorities = pgTable('client_priorities', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  categoryId: uuid('category_id').notNull().references(() => siteCategories.id),
  
  // Priority configuration
  rank: integer('rank').notNull(),                 // 1 = highest priority
  weightModifier: real('weight_modifier').notNull().default(1.5), // Scoring boost
  targetPosition: integer('target_position').default(10), // Where they want to rank
  
  // Current state (from GSC/tracking)
  currentAveragePosition: real('current_average_position'),
  keywordCount: integer('keyword_count'),          // Keywords mapped to this priority
  
  // Status
  status: text('status').$type<'active' | 'paused' | 'achieved'>().default('active'),
  
  // Notes
  notes: text('notes'),                            // "Focus on this first"
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientCategoryUnique: uniqueIndex('uq_client_priorities').on(table.clientId, table.categoryId),
  rankIdx: index('ix_client_priorities_rank').on(table.clientId, table.rank),
}));
```

#### 3. Page (Crawled Pages with Type Classification)

```typescript
// All crawled pages with type classification
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  
  // URL and identity
  url: text('url').notNull(),
  urlHash: text('url_hash').notNull(),             // For deduplication
  canonicalUrl: text('canonical_url'),
  
  // Page type classification
  pageType: text('page_type').$type<PageType>().notNull(),
  
  // SEO content
  title: text('title'),
  metaDescription: text('meta_description'),
  h1: text('h1'),
  contentSnippet: text('content_snippet'),         // First 500 chars for embedding
  wordCount: integer('word_count'),
  
  // Hierarchy (for category/product pages)
  categoryId: uuid('category_id').references(() => siteCategories.id),
  breadcrumbPath: text('breadcrumb_path'),         // "Home > Veido priežiūra > Serumai"
  
  // Status
  httpStatus: integer('http_status'),
  isIndexable: boolean('is_indexable').default(true),
  lastCrawledAt: timestamp('last_crawled_at'),
  contentHash: text('content_hash'),               // For delta sync
  
  // Embedding
  embeddingId: text('embedding_id'),               // Reference to vector store
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  urlHashIdx: uniqueIndex('uq_pages_url').on(table.clientId, table.urlHash),
  typeIdx: index('ix_pages_type').on(table.clientId, table.pageType),
  categoryIdx: index('ix_pages_category').on(table.categoryId),
}));

// Page types
export type PageType = 
  | 'category_listing'  // /sampunai - targets head terms
  | 'product'           // /sampunai/xyz-123 - targets long-tail
  | 'blog'              // /blog/article - informational content
  | 'collection'        // /rinkiniai/abc - bundled products
  | 'brand'             // /brendai/xyz - brand pages
  | 'service'           // /paslaugos/xyz - service pages
  | 'info'              // /apie-mus, /kontaktai - informational
  | 'unknown';          // Needs classification
```

#### 4. Keyword (Enhanced with Funnel Stage)

```typescript
// Enhanced keyword schema with funnel classification
export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  
  // Keyword identity
  keyword: text('keyword').notNull(),
  normalizedKeyword: text('normalized_keyword').notNull(), // Lithuanian normalization
  
  // DataForSEO metrics
  searchVolume: integer('search_volume'),
  cpc: real('cpc'),
  keywordDifficulty: integer('keyword_difficulty'),
  competition: real('competition'),
  
  // Position tracking
  currentPosition: integer('current_position'),
  currentUrl: text('current_url'),
  positionDate: timestamp('position_date'),
  
  // CLASSIFICATION (this is the key new addition)
  
  // Traditional intent
  intent: text('intent').$type<'informational' | 'commercial' | 'transactional' | 'navigational'>(),
  
  // Funnel stage (NEW - not yet implemented)
  funnelStage: text('funnel_stage').$type<'bofu' | 'mofu' | 'tofu'>(),
  funnelConfidence: real('funnel_confidence'),     // 0-1 confidence score
  
  // Keyword type
  keywordType: text('keyword_type').$type<'product' | 'long_tail' | 'question' | 'local' | 'comparison'>(),
  
  // Geographic classification (NEW)
  geoTarget: text('geo_target'),                   // "vilnius", "kaunas", null for generic
  isLocalIntent: boolean('is_local_intent').default(false),
  
  // Category assignment (semantic matching)
  primaryCategoryId: uuid('primary_category_id').references(() => siteCategories.id),
  categoryConfidence: real('category_confidence'), // 0-1 how confident the match is
  
  // Tier from prioritization
  tier: text('tier').$type<'must_do' | 'should_do' | 'nice_to_have' | 'ignore'>(),
  compositeScore: real('composite_score'),         // 0-1 from PrioritizationService
  
  // Source tracking
  source: text('source').$type<'dataforseo' | 'csv_import' | 'manual' | 'competitor_gap' | 'ai_discovery'>(),
  
  // Embedding
  embeddingId: text('embedding_id'),               // Reference to vector store
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  enrichedAt: timestamp('enriched_at'),
}, (table) => ({
  clientKeywordUnique: uniqueIndex('uq_keywords_client_keyword').on(table.clientId, table.normalizedKeyword),
  tierIdx: index('ix_keywords_tier').on(table.clientId, table.tier),
  funnelIdx: index('ix_keywords_funnel').on(table.clientId, table.funnelStage),
  categoryIdx: index('ix_keywords_category').on(table.primaryCategoryId),
  volumeIdx: index('ix_keywords_volume').on(table.clientId, table.searchVolume),
}));
```

#### 5. KeywordPageMatch (Many-to-Many with Relevance)

```typescript
// Semantic matching between keywords and pages
export const keywordPageMatches = pgTable('keyword_page_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  keywordId: uuid('keyword_id').notNull().references(() => keywords.id),
  pageId: uuid('page_id').notNull().references(() => pages.id),
  
  // Match quality
  relevanceScore: real('relevance_score').notNull(), // 0-1 from embedding similarity
  matchType: text('match_type').$type<'primary' | 'secondary' | 'potential'>().notNull(),
  
  // Action recommendation
  recommendedAction: text('recommended_action').$type<'optimize' | 'create' | 'none'>(),
  actionReason: text('action_reason'),             // "Page ranks #15, optimize for #1"
  
  // Source of match
  matchSource: text('match_source').$type<'embedding' | 'gsc' | 'manual' | 'heuristic'>(),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  keywordPageUnique: uniqueIndex('uq_keyword_page').on(table.keywordId, table.pageId),
  relevanceIdx: index('ix_kpm_relevance').on(table.relevanceScore),
  keywordIdx: index('ix_kpm_keyword').on(table.keywordId),
  pageIdx: index('ix_kpm_page').on(table.pageId),
}));
```

---

## The Unified Query Model

### Use Case 1: "Show keywords for priority categories only, BOFU only, sorted by opportunity"

```sql
SELECT 
  k.keyword,
  k.search_volume,
  k.keyword_difficulty,
  k.current_position,
  k.funnel_stage,
  sc.name as category_name,
  cp.rank as priority_rank,
  p.url as target_page_url,
  kpm.relevance_score
FROM keywords k
JOIN site_categories sc ON k.primary_category_id = sc.id
JOIN client_priorities cp ON cp.category_id = sc.id
LEFT JOIN keyword_page_matches kpm ON kpm.keyword_id = k.id AND kpm.match_type = 'primary'
LEFT JOIN pages p ON kpm.page_id = p.id
WHERE k.client_id = $1
  AND k.funnel_stage = 'bofu'           -- BOFU only
  AND cp.status = 'active'               -- Priority categories only
ORDER BY 
  cp.rank ASC,                           -- Priority order
  k.composite_score DESC                 -- Then by opportunity
LIMIT 200;
```

### Use Case 2: "Which category pages need optimization? Show gaps."

```sql
SELECT 
  sc.name as category,
  p.url as category_page,
  COUNT(k.id) as total_keywords,
  COUNT(CASE WHEN k.current_position <= 10 THEN 1 END) as ranking_top_10,
  COUNT(CASE WHEN k.current_position > 10 OR k.current_position IS NULL THEN 1 END) as opportunity_keywords,
  AVG(k.search_volume) as avg_volume,
  AVG(k.keyword_difficulty) as avg_difficulty
FROM site_categories sc
JOIN pages p ON p.category_id = sc.id AND p.page_type = 'category_listing'
LEFT JOIN keywords k ON k.primary_category_id = sc.id
WHERE sc.client_id = $1
GROUP BY sc.id, sc.name, p.url
ORDER BY opportunity_keywords DESC;
```

### Use Case 3: "For category 'Šampūnai', show keywords and which page should target each"

```sql
SELECT 
  k.keyword,
  k.search_volume,
  k.funnel_stage,
  k.keyword_type,
  CASE 
    WHEN k.keyword_type IN ('product', 'long_tail') THEN 'product_page'
    WHEN k.keyword_type = 'question' THEN 'blog_post'
    WHEN k.keyword_type = 'comparison' THEN 'collection_or_blog'
    ELSE 'category_page'
  END as recommended_page_type,
  p.url as existing_page,
  kpm.recommended_action
FROM keywords k
JOIN site_categories sc ON k.primary_category_id = sc.id
LEFT JOIN keyword_page_matches kpm ON kpm.keyword_id = k.id
LEFT JOIN pages p ON kpm.page_id = p.id
WHERE sc.slug = 'sampunai'
  AND k.client_id = $1
ORDER BY k.search_volume DESC;
```

---

## The Page Type → Keyword Type Mapping Logic

```typescript
/**
 * Determines which page type should target a keyword based on its characteristics.
 * This is the core logic for matching keywords to pages.
 */
export function getTargetPageType(keyword: Keyword): PageType {
  // Product keywords → product pages
  if (keyword.keywordType === 'product' || keyword.keywordType === 'long_tail') {
    // Long-tail with product intent goes to product pages
    // e.g., "cosrx snail mucin serum 96"
    return 'product';
  }
  
  // Question keywords → blog posts
  if (keyword.keywordType === 'question') {
    // e.g., "kaip pasirinkti veido serumą"
    return 'blog';
  }
  
  // Comparison keywords → could be collection or blog
  if (keyword.keywordType === 'comparison') {
    // e.g., "geriausi veido serumai 2024"
    // If high commercial intent, collection page
    // If informational, blog post
    return keyword.intent === 'commercial' ? 'collection' : 'blog';
  }
  
  // Local keywords → service pages (if service business)
  if (keyword.keywordType === 'local' || keyword.isLocalIntent) {
    // e.g., "kosmetikos parduotuvė vilniuje"
    return 'service';
  }
  
  // Head terms (short, high volume) → category listing pages
  // e.g., "veido serumai", "šampūnai"
  if (keyword.keyword.split(' ').length <= 2 && keyword.searchVolume > 500) {
    return 'category_listing';
  }
  
  // Default: category listing for commercial, blog for informational
  return keyword.intent === 'informational' ? 'blog' : 'category_listing';
}
```

---

## Funnel Stage Classification (BOFU/MOFU/TOFU)

This is the critical missing piece. Here's the classification logic:

```typescript
/**
 * Classifies keyword into funnel stage based on multiple signals.
 * 
 * BOFU (Bottom of Funnel) - Ready to buy:
 *   - "pirkti", "kaina", "nuolaida", "pristatymas"
 *   - Specific product names + transactional modifiers
 *   - Brand + product type combinations
 *   
 * MOFU (Middle of Funnel) - Considering options:
 *   - "geriausi", "palyginti", "vs", "ar verta"
 *   - Category + modifier (e.g., "veido serumai su vitaminu c")
 *   - Reviews, comparisons
 *   
 * TOFU (Top of Funnel) - Just learning:
 *   - "kas yra", "kaip", "kodėl"
 *   - Generic category terms without modifiers
 *   - Educational queries
 */
export function classifyFunnelStage(keyword: string, context: ClassificationContext): FunnelStage {
  const kw = keyword.toLowerCase();
  
  // BOFU signals (Lithuanian)
  const bofuPatterns = [
    /\b(pirkti|pirk|nusipirk)\b/,           // buy
    /\b(kaina|kainos|kainuoja)\b/,           // price
    /\b(nuolaida|akcija|išpardavimas)\b/,    // discount/sale
    /\b(pristatymas|siuntimas)\b/,           // delivery
    /\b(užsakyti|užsakymas)\b/,              // order
    /\b(atsiliepim|atsiliepimai|review)\b/,  // reviews (when with product)
    /\b(internetu|online)\b/,                // online (buying context)
  ];
  
  // MOFU signals
  const mofuPatterns = [
    /\b(geriausi|geriausias|top)\b/,         // best
    /\b(palyginti|palyginimas|vs)\b/,        // compare
    /\b(ar verta|verta|rekomenduo)\b/,       // is it worth
    /\b(alternatyv|pakaital)\b/,             // alternative
    /\b(skirtumai|skirtumas)\b/,             // differences
    /\b(reitingas|įvertinimas)\b/,           // rating
    /^(top \d+|geriausi \d+)/,               // top N lists
  ];
  
  // TOFU signals
  const tofuPatterns = [
    /\b(kas yra|kas tai)\b/,                 // what is
    /\b(kaip|kaip naudoti|kaip pasirinkti)\b/, // how to
    /\b(kodėl|ko reikia)\b/,                 // why
    /\b(ar reikia|ar būtina)\b/,             // do I need
    /\b(nauda|privalumai|trūkumai)\b/,       // benefits/drawbacks
    /\b(patarimai|patarimas)\b/,             // tips
  ];
  
  // Check patterns
  if (bofuPatterns.some(p => p.test(kw))) return { stage: 'bofu', confidence: 0.9 };
  if (mofuPatterns.some(p => p.test(kw))) return { stage: 'mofu', confidence: 0.85 };
  if (tofuPatterns.some(p => p.test(kw))) return { stage: 'tofu', confidence: 0.9 };
  
  // Use intent as fallback
  if (context.intent === 'transactional') return { stage: 'bofu', confidence: 0.7 };
  if (context.intent === 'commercial') return { stage: 'mofu', confidence: 0.7 };
  if (context.intent === 'informational') return { stage: 'tofu', confidence: 0.7 };
  
  // Default to MOFU with low confidence (needs LLM classification)
  return { stage: 'mofu', confidence: 0.4 };
}
```

---

## Site Structure Extraction Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SITE STRUCTURE EXTRACTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SITEMAP DISCOVERY                                                       │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ parseSitemap(domain)                                            │    │
│     │   → /sitemap.xml, /sitemap_index.xml                            │    │
│     │   → Extract all URLs with lastmod                               │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  2. URL PATTERN ANALYSIS                                                    │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ analyzeUrlPatterns(urls)                                        │    │
│     │   → Detect: /kategoria/subkategoria/produktas pattern           │    │
│     │   → Detect: /blog/article pattern                               │    │
│     │   → Detect: /brands/brand-name pattern                          │    │
│     │   → Classify each URL by page type                              │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  3. NAVIGATION MENU SCRAPE                                                  │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ scrapeNavigation(homepage)                                      │    │
│     │   → Extract <nav> structure                                     │    │
│     │   → Build parent-child relationships                            │    │
│     │   → Map menu items to URLs from sitemap                         │    │
│     │                                                                 │    │
│     │ Example output:                                                 │    │
│     │   Korėjietiška kosmetika (depth=0)                              │    │
│     │     ├── Veido šveitikliai (depth=1, parent=above)               │    │
│     │     ├── Veido kaukės (depth=1)                                  │    │
│     │     └── Veido serumai (depth=1)                                 │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  4. BREADCRUMB VALIDATION                                                   │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ validateWithBreadcrumbs(categories, productPages)               │    │
│     │   → For each product page, extract breadcrumb                   │    │
│     │   → Validate category hierarchy matches nav structure           │    │
│     │   → Resolve conflicts (breadcrumb wins)                         │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  5. CATEGORY METADATA ENRICHMENT                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ enrichCategoryMetadata(categories)                              │    │
│     │   → Fetch each category page                                    │    │
│     │   → Extract: title, H1, meta description                        │    │
│     │   → Count products (if e-commerce)                              │    │
│     │   → Calculate child category count                              │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  6. STORE TO DATABASE                                                       │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ saveSiteCategories(clientId, categories)                        │    │
│     │   → Insert into site_categories table                           │    │
│     │   → Preserve parent_id relationships                            │    │
│     │   → Store path for breadcrumb reconstruction                    │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Priority Selection Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRIORITY SELECTION WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Client conversation                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Client: "Man norėtųsi iškilti aukščiau pagrindinėse meniu          │   │
│  │          kategorijose. Iš jų su 10 būtų tobula."                   │   │
│  │                                                                     │   │
│  │ AI extracts:                                                        │   │
│  │   - Wants to rank higher in main menu categories                    │   │
│  │   - Target: 10 categories to page 1                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  STEP 2: Show site categories (from scraping)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ "Here are your main menu categories. Select up to 10 priorities:"  │   │
│  │                                                                     │   │
│  │ □ Korėjietiška kosmetika (45 keywords, avg pos 12.3)               │   │
│  │   □ Veido šveitikliai (23 keywords, avg pos 8.1)                   │   │
│  │   □ Veido kaukės (31 keywords, avg pos 15.2)                       │   │
│  │   ☑ Veido serumai (28 keywords, avg pos 18.5) ← Selected           │   │
│  │ □ Plaukų priežiūra (67 keywords, avg pos 11.2)                     │   │
│  │   ☑ Šampūnai (45 keywords, avg pos 9.8) ← Selected                 │   │
│  │   □ Kondicionieriai (22 keywords, avg pos 14.1)                    │   │
│  │ ...                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  STEP 3: Save priorities with ranking                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ client_priorities:                                                  │   │
│  │   1. Veido serumai (rank=1, weight=1.5)                            │   │
│  │   2. Šampūnai (rank=2, weight=1.4)                                 │   │
│  │   3. ... (8 more)                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  STEP 4: Re-score all keywords with priority weights                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ PrioritizationService.prioritizeKeywords(clientId, focusScores)    │   │
│  │                                                                     │   │
│  │ Keywords in "Veido serumai" get 1.5x focus boost                   │   │
│  │ Keywords in "Šampūnai" get 1.4x focus boost                        │   │
│  │ Non-priority keywords get 1.0x (no boost)                          │   │
│  │                                                                     │   │
│  │ Re-tier: more priority keywords become "must_do"                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1: Schema + Site Structure (2-3 days)
1. Add `site_categories` table
2. Add `client_priorities` table
3. Enhance `keywords` table with `funnel_stage`, `primary_category_id`
4. Add `keyword_page_matches` table
5. Implement site structure extraction from menu/sitemap

### Phase 2: Category-Keyword Mapping (2 days)
1. Semantic matching of keywords to categories (embedding-based)
2. Funnel stage classification (pattern + LLM)
3. Re-integrate with PrioritizationService using category weights

### Phase 3: Priority Selection UI (2 days)
1. Category tree visualization from site_categories
2. Checkbox selection for priorities
3. Drag-and-drop ranking
4. Save to client_priorities

### Phase 4: Page Type Targeting (1-2 days)
1. Page type classification logic
2. Keyword → Page matching service
3. "Optimize" vs "Create" recommendations
4. Gap analysis dashboard

---

## Key Design Decisions

### Why site_categories instead of just tags?

Tags are flat. Site structure is hierarchical. A client's menu literally shows the parent-child relationships:

```
Korėjietiška kosmetika           # Top-level
  └── Veido serumai              # Subcategory
        └── [Product pages]      # Leaf pages
```

If we just had tags, we'd lose:
- Which categories are "main menu" (depth=0)
- Which subcategories roll up to which parents
- The exact URL structure that maps to ranking signals

### Why separate client_priorities from site_categories?

Priorities are:
- Per-client business decisions (which categories to focus on)
- Ranked (priority 1 vs priority 10)
- Weighted (different boost factors)
- Stateful (achieved, paused, active)

Categories are:
- Site structure facts (what exists on the site)
- Hierarchical (parent-child)
- Static (changes only when site changes)

Separating them allows:
- Same site structure, different priority configs per use case
- Historical tracking of priority changes
- Easy "reset priorities" without touching category data

### Why keyword → category instead of keyword → page?

Keywords should map to *concepts* (categories), not specific pages. The page is a *targeting decision* that can change:

- "veido serumai" → Category: Veido serumai
  - Can target: /veido-serumai (category listing)
  - Or target: /blog/geriausi-veido-serumai-2024 (if blog ranks better)
  - Or target: /rinkiniai/veido-prieziura (collection)

The category is stable. The page is a tactical choice.

---

## Summary

This model unifies:
1. **Site structure** → `site_categories` (scraped from menu/sitemap)
2. **Client priorities** → `client_priorities` (the 10 categories to focus on)
3. **Keywords** → `keywords` with `primary_category_id` and `funnel_stage`
4. **Page targeting** → `keyword_page_matches` with relevance scores

The flow:
1. Scrape site → Build category taxonomy
2. Client selects priorities → Store weighted rankings
3. Match keywords to categories → Semantic classification
4. Classify funnel stage → BOFU/MOFU/TOFU
5. Re-prioritize with weights → New tier assignments
6. Match keywords to pages → Targeting recommendations
7. Filter to top N → Proposal generation
