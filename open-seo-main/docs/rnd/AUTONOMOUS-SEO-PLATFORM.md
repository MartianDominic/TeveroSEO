# Autonomous SEO Platform Architecture

> Complete system design for a world-class, zero-human-oversight SEO platform that generates content, fixes technical SEO, optimizes on-page elements, and manages client sites on auto-pilot.

**Generation Model:** Gemini 3.1 Pro (2026)

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Content Generation Pipeline](#content-generation-pipeline)
3. [Client Knowledge Base](#client-knowledge-base)
4. [Data Input Methods](#data-input-methods)
5. [Data Sync & Update Mechanics](#data-sync--update-mechanics)
6. [RAG-Based Content Generation](#rag-based-content-generation)
7. [Autonomous SEO Engine](#autonomous-seo-engine)
8. [Quality Scoring](#quality-scoring)
9. [Technical Implementation](#technical-implementation)
10. [Keyword Discovery & Filtering Workflow](#keyword-discovery--filtering-workflow)
11. [GSC Sync Strategy](#gsc-sync-strategy)
12. [Brand Voice System](#brand-voice-system)
13. [Testimonials as Content Foundation](#testimonials-as-content-foundation)
14. [V1 Implementation Summary](#v1-implementation-summary)

## Related Documents

| Document | Description |
|----------|-------------|
| [KEYWORD-FILTERING-WORKFLOW.md](./KEYWORD-FILTERING-WORKFLOW.md) | 4-stage filtering pipeline details |
| [CONTENT-REFRESH-ENGINE.md](./CONTENT-REFRESH-ENGINE.md) | Autonomous content decay detection and refresh |
| [KEYWORD-PRIORITIZATION-ALGORITHMS.md](../../.planning/research/KEYWORD-PRIORITIZATION-ALGORITHMS.md) | Scoring formulas |
| [KEYWORD-CONSTRAINT-ENGINE.md](../../.planning/research/KEYWORD-CONSTRAINT-ENGINE.md) | Constraint engine spec |
| [POSITION-TRACKING-SYSTEM.md](../../.planning/research/POSITION-TRACKING-SYSTEM.md) | Position tracking architecture |

---

## Platform Overview

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Content Generation** | Fully autonomous SEO content using Gemini 3.1 Pro + client knowledge |
| **Technical SEO Fixes** | Auto-detect and fix crawlability, indexability, Core Web Vitals |
| **On-Page SEO Fixes** | Auto-optimize titles, meta, headings, images, internal links |
| **Existing Content Optimization** | Detect decay, refresh outdated content, fix broken elements |
| **Client Knowledge Integration** | RAG system pulling client-specific data for information gain |

### Design Principles

1. **Zero Human Oversight** — Fully autonomous operation
2. **Information Gain** — Every piece of content adds unique value competitors can't copy
3. **Gemini 3.1 Pro Only** — Single model for all generation tasks
4. **Simple RAG** — pgvector + embeddings, no over-engineering

---

## Content Generation Pipeline

### 7-Stage Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │ 1. RESEARCH  │──▶│ 2. PLANNING  │──▶│ 3. GENERATE  │                 │
│  │              │   │              │   │              │                 │
│  │ SERP Intel   │   │ Content Brief│   │ Gemini 3.1   │                 │
│  │ Competitor   │   │ Outline      │   │ Pro + RAG    │                 │
│  │ Entity Map   │   │ Knowledge    │   │ Knowledge    │                 │
│  │ Intent Match │   │ Injection    │   │ Injection    │                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                 │
│         │                                      │                         │
│         ▼                                      ▼                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │           QUALITY GATES - ALL MUST PASS 75+                    │     │
│  │  Semantic Coverage | E-E-A-T | Readability | Info Gain         │     │
│  └────────────────────────────────────────────────────────────────┘     │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │
│  │ 4. ON-PAGE   │──▶│ 5. TECHNICAL │──▶│ 6. PUBLISH   │                 │
│  │              │   │              │   │              │                 │
│  │ Title/Meta   │   │ Speed Check  │   │ CMS Push     │                 │
│  │ Headings     │   │ Mobile Check │   │ Schema Inject│                 │
│  │ Internal Link│   │ Crawlability │   │ Sitemap      │                 │
│  └──────────────┘   └──────────────┘   └──────────────┘                 │
│         │                                                                │
│         ▼                                                                │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                    7. POST-PUBLISH LOOP                        │     │
│  │   Monitor ──▶ Detect Decay ──▶ Auto-Refresh ──▶ Optimize      │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Client Knowledge Base

### What Gets Stored

```typescript
interface ClientKnowledgeBase {
  clientId: string;
  
  // Auto-collected (via pixel, APIs, integrations)
  automated: {
    analytics: AnalyticsData;        // GA4: conversions, engagement
    searchConsole: GSCData;          // Queries, CTR, impressions
    pixelTracking: PixelData;        // Scroll depth, clicks, time on page
    siteContent: ScrapedContent;     // Existing pages, testimonials
  };
  
  // Client-provided (via dashboard, API, uploads)
  manual: {
    brandVoice: BrandVoiceConfig;    // Tone, vocabulary, avoid words
    products: ProductInfo[];         // Products/services details
    caseStudies: CaseStudy[];        // Client success stories
    testimonials: Testimonial[];     // Customer quotes
    proprietaryStats: Statistic[];   // Internal data, benchmarks
    expertQuotes: Quote[];           // Team expertise
    topicsToAvoid: string[];         // Content restrictions
    competitors: CompetitorInfo[];   // Who to differentiate from
  };
}
```

### Autonomous Information Gain Sources

Since the platform runs with zero human oversight, "first-party data" comes from **automatic collection**:

| Source | Data Type | How It's Used |
|--------|-----------|---------------|
| Google Search Console | Real queries, CTR, impressions | "Pages with X structure rank better" |
| Google Analytics | Conversion rates, engagement | "This page type converts 34% higher" |
| Pixel Tracking | Scroll depth, click patterns | "Users engage most with Y format" |
| Site Scraping | Existing testimonials, case studies | Repurpose into new content |
| Competitor Delta | Changes over time | "Competitor added X, we should cover Y" |
| Real-Time APIs | Current pricing, stats | Always fresher than competitor content |

---

## Data Input Methods

### 1. Dashboard UI (Non-Technical Clients)

```
Client Portal
├── Brand Voice
│   ├── Tone: [Professional / Casual / Technical]
│   ├── Words to use: [input]
│   └── Words to avoid: [input]
├── Case Studies
│   └── + Add Case Study
│       ├── Client name, Industry
│       ├── Challenge, Solution
│       └── Results (with numbers)
├── Products/Services
│   └── + Add Product
│       ├── Name, Description
│       ├── Features, Pricing
│       └── Differentiators
├── Statistics
│   └── + Add Statistic
│       ├── Claim text
│       ├── Value
│       └── Can cite publicly? [yes/no]
└── Competitors
    └── + Add Competitor [URL]
```

### 2. API Endpoint (Technical Clients)

```typescript
// POST /api/v1/clients/{clientId}/knowledge
interface KnowledgeInput {
  type: 'case_study' | 'product' | 'statistic' | 'testimonial' | 'brand_voice';
  data: Record<string, unknown>;
  source?: string;
  expiresAt?: Date;
}

// Example: Add a case study
POST /api/v1/clients/acme-corp/knowledge
{
  "type": "case_study",
  "data": {
    "clientName": "TechCorp",
    "industry": "SaaS",
    "challenge": "Low organic traffic",
    "solution": "Content cluster strategy",
    "results": {
      "trafficIncrease": "312%",
      "timeframe": "8 months",
      "revenueImpact": "$2.4M ARR"
    }
  }
}
```

### 3. File Upload (Bulk Import)

Supported formats: CSV, JSON, PDF, DOCX

```typescript
// For structured files (CSV, JSON)
// → Parse directly into records

// For unstructured files (PDF, DOCX)
// → Gemini extracts structured data:
const extracted = await gemini.generateContent(`
  Extract all case studies, statistics, testimonials 
  from this document as structured JSON.
  
  Document content:
  ${documentText}
`);
```

### 4. CMS/CRM Sync (Automated)

```typescript
interface IntegrationConfig {
  wordpress?: {
    url: string;
    apiKey: string;
    sync: ['posts', 'products', 'testimonials'];
  };
  hubspot?: {
    apiKey: string;
    sync: ['case_studies', 'testimonials'];
  };
  shopify?: {
    storeUrl: string;
    sync: ['products', 'reviews'];
  };
}

// Runs on schedule (every 6 hours)
// Or triggered by webhook
```

---

## Data Sync & Update Mechanics

### The Core Problem

When data comes from multiple sources:
1. Is this new or an update to existing?
2. Which record does it update?
3. How do we merge without losing data?

### Solution: Fingerprinting

Files don't have IDs. We use **content-based identity**.

```typescript
// Key fields that identify uniqueness per type
const FINGERPRINT_KEYS = {
  case_study: ['client_name', 'industry'],
  product: ['name', 'sku'],
  statistic: ['claim', 'metric_type'],
  testimonial: ['author_name', 'company'],
  brand_voice: ['aspect'],
};

function generateFingerprint(type: string, data: Record<string, unknown>): string {
  const keyFields = FINGERPRINT_KEYS[type];
  const values = keyFields.map(field => normalize(data[field]));
  return hash(type + ':' + values.join('|'));
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

// Results:
// "TechCorp" and "techcorp" → same fingerprint
// "Tech Corp, Inc." and "TechCorp" → same fingerprint
```

### CMS Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CMS SYNC FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. TRIGGER: Webhook OR Schedule (every 6h)                      │
│                                                                  │
│  2. FETCH: GET /wp-json/wp/v2/posts?modified_after={last_sync}  │
│                                                                  │
│  3. FOR EACH ITEM:                                               │
│     │                                                            │
│     ├─ Check source_ref ("wordpress:post-123" exists?)          │
│     │  │                                                         │
│     │  ├─ YES + hash same → SKIP (no changes)                   │
│     │  ├─ YES + hash different → UPDATE                         │
│     │  └─ NO → Check fingerprint                                │
│     │         │                                                  │
│     │         ├─ Match → MERGE (same entity, different source)  │
│     │         └─ No match → INSERT (new record)                 │
│                                                                  │
│  4. HANDLE DELETIONS: Soft-delete if removed from source        │
│                                                                  │
│  5. UPDATE SYNC STATE: last_synced_at = now()                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE UPLOAD FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PARSE FILE                                                   │
│     ├─ CSV/JSON → Parse directly                                │
│     └─ PDF/DOCX → Gemini extracts structured data               │
│                                                                  │
│  2. FOR EACH RECORD:                                             │
│     │                                                            │
│     ├─ Generate fingerprint                                     │
│     │                                                            │
│     ├─ Find duplicates:                                         │
│     │  ├─ Exact fingerprint match? → confidence 100%            │
│     │  ├─ Fuzzy match > 70%? → candidate                        │
│     │  └─ AI verification for uncertain cases                   │
│     │                                                            │
│     └─ Decision:                                                │
│        ├─ confidence >= 95% → UPDATE automatically              │
│        ├─ confidence 70-95% → UPDATE or QUEUE FOR REVIEW        │
│        └─ confidence < 70% → INSERT as new                      │
│                                                                  │
│  3. MERGE STRATEGY (per-field rules):                           │
│     ├─ client_name: keep_existing                               │
│     ├─ results: replace (new numbers override)                  │
│     ├─ testimonials: append_unique                              │
│     └─ pricing: always_latest                                   │
│                                                                  │
│  4. RETURN REPORT:                                               │
│     { total: 47, created: 12, updated: 31, review: 4 }          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Merge Strategies

```typescript
type MergeStrategy = 
  | 'keep_existing'    // Don't change (e.g., canonical names)
  | 'replace'          // New value overwrites (e.g., pricing)
  | 'append_unique'    // Add to array, dedupe (e.g., testimonials)
  | 'merge_deep'       // Merge objects (e.g., results metrics)
  | 'use_newer'        // Compare timestamps
  | 'use_longer';      // Keep more detailed version

const MERGE_CONFIG = {
  case_study: {
    client_name: 'keep_existing',
    industry: 'keep_existing',
    challenge: 'replace',
    solution: 'replace',
    results: 'merge_deep',
    testimonials: 'append_unique',
  },
  statistic: {
    claim: 'keep_existing',
    value: 'replace',
    source: 'replace',
  },
  product: {
    name: 'keep_existing',
    features: 'append_unique',
    pricing: 'replace',
    description: 'use_longer',
  },
};
```

### Conflict Resolution (Multi-Source)

```typescript
// Source priority (higher wins)
const SOURCE_PRIORITY = {
  'manual': 100,    // Dashboard input always wins
  'api': 90,        // Direct API calls
  'upload': 80,     // File uploads
  'sync': 70,       // CMS sync is lowest
};

// Protected fields that manual edits lock
const PROTECTED_FIELDS = ['brand_voice', 'topics_to_avoid'];
```

### Audit Trail

Every change is logged:

```sql
CREATE TABLE knowledge_audit_log (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  knowledge_id UUID NOT NULL,
  action VARCHAR(20),      -- 'create', 'update', 'delete', 'merge'
  source VARCHAR(20),      -- 'manual', 'api', 'upload', 'sync'
  source_ref VARCHAR(255),
  previous_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## RAG-Based Content Generation

### Architecture

It's just RAG. Simple.

| Component | Tool |
|-----------|------|
| Vector DB | pgvector (already have Postgres) |
| Embeddings | Gemini `text-embedding-004` |
| Generation | **Gemini 3.1 Pro** |
| Orchestration | Raw TypeScript |

### pgvector Setup

```sql
-- Enable extension
CREATE EXTENSION vector;

-- Add embedding column
ALTER TABLE client_knowledge 
ADD COLUMN embedding vector(768);

-- Index for fast similarity search
CREATE INDEX ON client_knowledge 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### The Entire RAG System

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genai.getGenerativeModel({ model: 'text-embedding-004' });
const genModel = genai.getGenerativeModel({ model: 'gemini-3.1-pro' });

// 1. Embed (for indexing + retrieval)
async function embed(text: string): Promise<number[]> {
  const result = await embedModel.embedContent(text);
  return result.embedding.values;
}

// 2. Index knowledge (on ingest)
async function indexKnowledge(record: KnowledgeRecord): Promise<void> {
  const text = `${record.type}: ${JSON.stringify(record.data)}`;
  const embedding = await embed(text);
  
  await db.update(clientKnowledge)
    .set({ embedding })
    .where(eq(clientKnowledge.id, record.id));
}

// 3. Retrieve relevant knowledge
async function retrieve(clientId: string, topic: string, limit = 5) {
  const queryEmbed = await embed(topic);
  
  return db.execute(sql`
    SELECT data, type, 1 - (embedding <=> ${queryEmbed}::vector) as score
    FROM client_knowledge
    WHERE client_id = ${clientId}
    ORDER BY embedding <=> ${queryEmbed}::vector
    LIMIT ${limit}
  `);
}

// 4. Generate content
async function generate(
  keyword: string,
  knowledge: KnowledgeRecord[],
  brandVoice: BrandVoice
): Promise<string> {
  
  const prompt = `
Write SEO-optimized content about "${keyword}".

KNOWLEDGE TO USE:
${knowledge.map(k => `[${k.type}] ${JSON.stringify(k.data)}`).join('\n\n')}

BRAND VOICE:
- Tone: ${brandVoice.tone}
- Company: ${brandVoice.companyName}
${brandVoice.vocabulary ? `- Use words like: ${brandVoice.vocabulary.join(', ')}` : ''}
${brandVoice.avoid ? `- Avoid: ${brandVoice.avoid.join(', ')}` : ''}

RULES:
- Integrate knowledge naturally, don't dump it
- Include specific numbers and examples from the knowledge
- Write as practitioner, not observer
- Never start with "In today's digital world" or similar
- Front-load value in every section
`;

  const result = await genModel.generateContent(prompt);
  return result.response.text();
}

// 5. Full pipeline
async function generateContent(clientId: string, keyword: string) {
  const knowledge = await retrieve(clientId, keyword);
  const brandVoice = await getBrandVoice(clientId);
  return generate(keyword, knowledge, brandVoice);
}
```

### Data Flow: Knowledge to Content

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   CLIENT KNOWLEDGE BASE                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Case Studies │ Statistics │ Products │ Testimonials │ Brand    │   │
│   └──────────────┴────────────┴──────────┴──────────────┴──────────┘   │
│                              │                                           │
│                    [Indexed with embeddings]                            │
│                              │                                           │
│                              ▼                                           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │               VECTOR SIMILARITY SEARCH                           │   │
│   │                                                                  │   │
│   │   Input: "email marketing automation"                           │   │
│   │   Query: SELECT * FROM knowledge ORDER BY embedding <=> $1      │   │
│   │   Output: Top 5 relevant knowledge items                        │   │
│   └──────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │               GEMINI 3.1 PRO GENERATION                          │   │
│   │                                                                  │   │
│   │   Prompt: keyword + retrieved knowledge + brand voice           │   │
│   │   Output: SEO-optimized content with knowledge integrated       │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Autonomous SEO Engine

### Technical SEO Auto-Fix

Via pixel injection or edge worker:

```typescript
interface TechnicalSEOFixes {
  // Meta tags
  metaTags: {
    missingTitles: 'generate_and_inject';
    missingDescriptions: 'generate_and_inject';
    missingCanonicals: 'inject_self_referencing';
    duplicateTitles: 'generate_unique';
  };
  
  // Schema markup
  schema: {
    missingArticleSchema: 'generate_and_inject';
    missingBreadcrumbs: 'generate_from_url';
    missingFAQ: 'extract_from_content_and_inject';
    invalidSchema: 'fix_and_reinject';
  };
  
  // Images
  images: {
    missingAlt: 'generate_from_context';
    oversizedImages: 'compress_via_cdn';
    missingLazyLoad: 'inject_loading_lazy';
    wrongFormat: 'convert_to_webp';
  };
  
  // Links
  links: {
    brokenInternalLinks: 'find_closest_match_or_remove';
    brokenExternalLinks: 'find_archived_or_remove';
    orphanPages: 'inject_contextual_links';
    missingInternalLinks: 'identify_and_inject';
  };
  
  // URLs
  urls: {
    nonCanonicalVariations: 'redirect_to_canonical';
    parameterPollution: 'set_canonical_clean';
    trailingSlashInconsistency: 'normalize_and_redirect';
  };
}
```

### On-Page SEO Auto-Fix

```typescript
interface OnPageSEOFixes {
  // Headings
  headings: {
    missingH1: 'generate_from_content';
    multipleH1s: 'demote_extras_to_h2';
    skippedLevels: 'restructure_hierarchy';
    keywordMissing: 'rewrite_to_include';
  };
  
  // Keywords
  keywords: {
    missingInTitle: 'rewrite_title';
    missingInFirstPara: 'rewrite_intro';
    missingInHeadings: 'rewrite_relevant_h2';
    overOptimized: 'reduce_density';
  };
  
  // Content quality
  quality: {
    thinContent: 'expand_with_gemini';
    outdatedStats: 'update_with_current';
    missingFAQ: 'generate_from_paa';
    noConclusion: 'generate_summary';
  };
  
  // Media
  media: {
    missingImageAlt: 'generate_descriptive_alt';
    genericAlt: 'rewrite_with_context';
    missingVideoTranscript: 'generate_via_api';
  };
}
```

### Existing Content Auto-Optimization

```typescript
interface ContentRefreshEngine {
  // Monitoring triggers
  triggers: {
    rankingDrop: 'position dropped 5+ in 2 weeks';
    trafficDrop: 'organic down 20%+ month-over-month';
    competitorGain: 'new competitor in top 5';
    contentAge: 'older than 6 months';
  };
  
  // Autonomous refresh actions
  autoRefresh: [
    'update_statistics_to_current',
    'fix_broken_links',
    'update_screenshots',
    'add_missing_schema',
    'improve_meta_description',
    'add_internal_links_to_new_content',
    'add_faq_section_from_paa',
    'update_dates_and_years',
    'expand_thin_sections',
    'add_missing_subtopics',
  ];
}
```

### The Autonomous Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTONOMOUS SEO ENGINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   DETECT    │────▶│   DECIDE    │────▶│    FIX      │       │
│  │             │     │             │     │             │       │
│  │ Crawl site  │     │ Prioritize  │     │ Via pixel   │       │
│  │ Check GSC   │     │ by impact   │     │ Via CMS API │       │
│  │ Monitor     │     │             │     │ Via edge    │       │
│  │ rankings    │     │             │     │             │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│         ▲                                       │                │
│         │            ┌─────────────┐            │                │
│         └────────────│   VERIFY    │◀───────────┘                │
│                      │             │                             │
│                      │ Re-crawl    │                             │
│                      │ Check fix   │                             │
│                      │ Monitor     │                             │
│                      └─────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quality Scoring

### Information Gain Score

Since we can't rely on human-provided unique content, information gain comes from:

| Source | How It Creates Information Gain |
|--------|--------------------------------|
| Client Analytics | "Pages with X structure convert 34% better" |
| A/B Test Results | "CTA in position Y gets 2x clicks" |
| Proprietary Stats | Client-provided benchmarks and results |
| Case Studies | Real results with real numbers |
| Competitive Gap | Topics competitors don't cover well |
| Real-Time Data | Always fresher than static competitor content |

### Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Semantic Coverage | 20% | All required entities and topics covered |
| E-E-A-T Signals | 25% | Experience, expertise, authority, trust markers |
| Readability | 15% | Appropriate complexity, formatting, structure |
| Engagement Prediction | 20% | Hook strength, value density, scanability |
| Information Gain | 20% | Unique data points not in competitor content |

**Threshold:** All dimensions must score 75+ before content publishes.

---

## Technical Implementation

### Database Schema

```sql
-- Client knowledge with vector embeddings
CREATE TABLE client_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  
  -- Identity
  fingerprint VARCHAR(64),
  source VARCHAR(20) NOT NULL,        -- 'manual', 'api', 'upload', 'sync'
  source_ref VARCHAR(255),            -- 'wordpress:post-123'
  
  -- RAG
  embedding vector(768),
  topic_tags TEXT[],
  searchable_text TEXT,
  
  -- Metadata
  can_cite_publicly BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_knowledge_client ON client_knowledge(client_id);
CREATE INDEX idx_knowledge_type ON client_knowledge(client_id, type);
CREATE INDEX idx_knowledge_fingerprint ON client_knowledge(fingerprint);
CREATE INDEX idx_knowledge_embedding ON client_knowledge 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Sync state tracking
CREATE TABLE sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  integration VARCHAR(50) NOT NULL,
  last_synced_at TIMESTAMP,
  item_hashes JSONB DEFAULT '{}',
  UNIQUE(client_id, integration)
);

-- Audit log
CREATE TABLE knowledge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  knowledge_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL,
  source VARCHAR(20) NOT NULL,
  source_ref VARCHAR(255),
  previous_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

```typescript
// Knowledge management
POST   /api/v1/clients/:clientId/knowledge          // Add knowledge
GET    /api/v1/clients/:clientId/knowledge          // List knowledge
GET    /api/v1/clients/:clientId/knowledge/:id      // Get single
PUT    /api/v1/clients/:clientId/knowledge/:id      // Update
DELETE /api/v1/clients/:clientId/knowledge/:id      // Delete

// Bulk operations
POST   /api/v1/clients/:clientId/knowledge/upload   // File upload
POST   /api/v1/clients/:clientId/knowledge/sync     // Trigger sync

// Content generation
POST   /api/v1/clients/:clientId/content/generate   // Generate content
GET    /api/v1/clients/:clientId/content/:id        // Get generated content

// SEO fixes
POST   /api/v1/clients/:clientId/seo/audit          // Run audit
GET    /api/v1/clients/:clientId/seo/issues         // List issues
POST   /api/v1/clients/:clientId/seo/fix/:issueId   // Fix specific issue
POST   /api/v1/clients/:clientId/seo/fix-all        // Auto-fix all
```

### Environment Variables

```env
# Gemini
GEMINI_API_KEY=your-api-key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/openseo

# Integrations (per client, stored in DB)
# No global env vars needed
```

---

## Keyword Discovery & Filtering Workflow

### The Client Agreement Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KEYWORD WORKFLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: DISCOVERY (Automated)                                          │
│  ─────────────────────────────                                           │
│  • Scrape client site → Store all pages/content/meta                     │
│  • Pull GSC data → Store keywords + rankings + impressions               │
│  • Pull GA data → Store traffic + conversions per page                   │
│  • Output: 100-1000 raw keywords                                         │
│                                                                          │
│  PHASE 2: FILTERING (Automated)                                          │
│  ─────────────────────────────                                           │
│  • Apply client constraints ("only category pages")                      │
│  • Score feasibility for THIS client (not generic KD)                    │
│  • Map keywords to site categories                                       │
│  • Detect cannibalization issues                                         │
│  • Rank by opportunity × feasibility                                     │
│  • Output: 50-200 prioritized keywords                                   │
│                                                                          │
│  PHASE 3: APPROVAL (Human-in-Loop)                                       │
│  ─────────────────────────────────                                       │
│  • Present keyword list to client                                        │
│  • Client approves/rejects/adds keywords                                 │
│  • Final "working set" locked                                            │
│                                                                          │
│  PHASE 4: EXECUTION (Automated, on approved set only)                    │
│  ─────────────────────────────────────────────────────                   │
│  • Optimize pages targeting approved keywords                            │
│  • Create content for approved keywords without pages                    │
│  • Monitor only approved keyword positions                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Client-Specific Feasibility Scoring

Generic keyword difficulty is useless. A DA 80 site and DA 20 site face completely different realities.

**Feasibility Formula:**
```
Feasibility = (Authority × 0.35) + (Content × 0.30) + (Velocity × 0.35) × SERP Modifier
```

| Component | What It Measures |
|-----------|-----------------|
| **Authority Feasibility** | Client DA vs competitor average (the "authority gap") |
| **Content Feasibility** | Does client have topical authority in this area? |
| **Velocity Score** | How fast has client's content ranked historically? |
| **SERP Modifier** | Is AI Overview / Local Pack stealing organic clicks? |

**Verdicts:**
- **70-100:** Quick Win — Prioritize immediately
- **55-69:** Achievable — Include in 90-day plan
- **40-54:** Stretch — Plan with adequate resources
- **25-39:** Long Term — Strategic investment
- **0-24:** Not Feasible — Skip or revisit later

**Full specification:** [KEYWORD-FILTERING-WORKFLOW.md](./KEYWORD-FILTERING-WORKFLOW.md)

---

## GSC Sync Strategy

### Why Not Hourly?

GSC data has inherent 2-3 day lag. Hourly syncs re-fetch the same stale numbers 24 times.

### Optimal Sync Frequencies

| Data Type | Frequency | Rationale |
|-----------|-----------|-----------|
| **Initial backfill** | Once | Pull full 16 months of history on first connection |
| **Position tracking** | Daily | Matches GSC data availability |
| **Dashboard refresh** | On-demand | Pull fresh when client views |
| **Historical analysis** | Weekly | Sufficient for trend detection |

### Tiered SERP Tracking (Cost Optimization)

For real-time position data (not delayed like GSC):

| Tier | Keywords | Frequency | Source | Monthly Cost |
|------|----------|-----------|--------|--------------|
| **Critical** | Top 10% | Daily live | DataForSEO | ~$36 |
| **Standard** | Next 40% | Weekly queue | DataForSEO | ~$19 |
| **Monitor** | Bottom 50% | GSC only | Free | $0 |

**Total:** ~$55/month vs $1,200/month for all-live tracking.

### API Constraints

| Limit | Value |
|-------|-------|
| GSC rows per request | 25,000 max |
| GSC rows per day | 50,000 per property |
| Data freshness | 2-3 days lag (final), 1-2 days (preliminary) |
| URL Inspection | 2,000/day per site |

**For large sites (50K+ pages):** Use BigQuery Bulk Export instead of API.

---

## Brand Voice System

### Why Brand Voice Matters

Every piece of content must sound like the client, not like generic AI output.

### Brand Voice Schema

```typescript
interface BrandVoice {
  tone: {
    primary: 'formal' | 'casual' | 'technical' | 'friendly' | 'authoritative';
    intensity: 1-10;  // 1 = subtle, 10 = strong
  };
  
  vocabulary: {
    preferred: string[];    // Words to use: ["leverage", "optimize", "streamline"]
    forbidden: string[];    // Never use: ["synergy", "disrupt", "utilize"]
    jargonLevel: 'none' | 'minimal' | 'industry-standard' | 'technical';
  };
  
  personality: {
    pov: 'we' | 'you' | 'they';  // "We help you..." vs "You can..."
    humorLevel: 0-10;
    formality: 0-10;
  };
  
  examples: {
    good: Array<{ text: string; why: string }>;
    bad: Array<{ text: string; why: string }>;
  };
}
```

### Brand Voice Extraction

Automatically extract from client's existing content:

```typescript
async function extractBrandVoice(clientContent: string[]): Promise<BrandVoice> {
  const prompt = `
    Analyze these content samples from the same brand.
    Extract their consistent voice characteristics:
    
    ${clientContent.map((c, i) => `[Sample ${i+1}]: ${c.slice(0, 2000)}`).join('\n\n')}
    
    Return JSON matching the BrandVoice schema.
    Focus on:
    - Consistent word choices
    - Sentence structure patterns
    - Point of view usage
    - Formality level
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Per-Post Brand Voice Injection

Every generation prompt includes ~500 tokens of brand voice context:

```typescript
const brandVoiceDirective = `
BRAND VOICE (follow exactly):
- Tone: ${voice.tone.primary} (intensity ${voice.tone.intensity}/10)
- POV: Always use "${voice.personality.pov}" perspective
- Use these words: ${voice.vocabulary.preferred.slice(0, 10).join(', ')}
- NEVER use: ${voice.vocabulary.forbidden.slice(0, 10).join(', ')}
- Jargon level: ${voice.vocabulary.jargonLevel}

EXAMPLES TO EMULATE:
${voice.examples.good.slice(0, 2).map(e => `"${e.text}"`).join('\n')}

EXAMPLES TO AVOID:
${voice.examples.bad.slice(0, 2).map(e => `"${e.text}" (why: ${e.why})`).join('\n')}
`;
```

### Brand Voice Validation

Post-generation check that content matches voice profile:

```typescript
async function validateBrandVoice(content: string, voice: BrandVoice): Promise<{
  score: number;
  violations: string[];
}> {
  // Check forbidden words
  const forbiddenUsed = voice.vocabulary.forbidden.filter(w => 
    content.toLowerCase().includes(w.toLowerCase())
  );
  
  // Check POV consistency
  const povViolations = checkPOVConsistency(content, voice.personality.pov);
  
  // AI-based tone check
  const toneScore = await checkToneAlignment(content, voice.tone);
  
  return {
    score: calculateOverallScore(forbiddenUsed, povViolations, toneScore),
    violations: [...forbiddenUsed.map(w => `Used forbidden word: "${w}"`), ...povViolations],
  };
}
```

---

## Testimonials as Content Foundation

### Why Testimonials First

Testimonials are the ultimate information gain source:
- **Competitors can't copy** — These are YOUR client's results
- **Real numbers** — "312% traffic increase" is concrete
- **Named sources** — Real people, real companies
- **Use case variety** — Different industries, challenges, solutions

### Testimonial Schema

```typescript
interface ClientTestimonial {
  id: string;
  
  // Content
  text: string;
  authorName: string;
  authorTitle?: string;
  authorCompany?: string;
  authorIndustry?: string;
  
  // Extracted intelligence
  extractedMetrics: Array<{
    metric: string;       // "traffic increase"
    value: string;        // "312%"
    context: string;      // "over 8 months"
    isVerified: boolean;  // Can we cite this publicly?
  }>;
  
  useCases: string[];     // ["content marketing", "technical SEO"]
  challenges: string[];   // ["low organic traffic", "thin content"]
  
  // RAG
  embedding: number[];    // vector(768)
  
  // Source
  source: 'website' | 'g2' | 'capterra' | 'google' | 'crm' | 'manual';
  sourceUrl?: string;
  collectedAt: Date;
}
```

### Automatic Testimonial Collection

```typescript
// 1. Scrape client website
const websiteTestimonials = await scrapeTestimonials(clientUrl);

// 2. Pull from review platforms
const g2Reviews = await fetchG2Reviews(clientG2Profile);
const capterraReviews = await fetchCapterraReviews(clientCapterraProfile);

// 3. Extract from CRM (if integrated)
const crmTestimonials = await extractFromHubSpot(clientHubSpotKey);

// 4. Process and deduplicate
const allTestimonials = deduplicateByFingerprint([
  ...websiteTestimonials,
  ...g2Reviews,
  ...capterraReviews,
  ...crmTestimonials,
]);

// 5. Extract metrics with Gemini
for (const testimonial of allTestimonials) {
  testimonial.extractedMetrics = await extractMetrics(testimonial.text);
  testimonial.useCases = await classifyUseCases(testimonial.text);
  testimonial.embedding = await embed(testimonial.text);
}
```

### Using Testimonials in Generation

```typescript
async function generateWithTestimonials(
  keyword: string,
  clientId: string,
): Promise<string> {
  // Retrieve relevant testimonials
  const testimonials = await retrieveTestimonials(clientId, keyword, limit: 3);
  
  const prompt = `
    Write SEO content about "${keyword}".
    
    PROOF POINTS TO INCLUDE (from real client testimonials):
    ${testimonials.map(t => `
      "${t.text}"
      — ${t.authorName}, ${t.authorTitle} at ${t.authorCompany}
      Key metrics: ${t.extractedMetrics.map(m => `${m.metric}: ${m.value}`).join(', ')}
    `).join('\n\n')}
    
    RULES:
    - Integrate these testimonials naturally as social proof
    - Use the specific numbers and results
    - Reference by name when available
    - Don't bunch all testimonials together; spread throughout content
  `;
  
  return await gemini.generateContent(prompt);
}
```

---

## V1 Implementation Summary

### What's In V1

| Component | Status | Description |
|-----------|--------|-------------|
| Scoring Engine | Core | Quality gates, all 5 dimensions at 75+ |
| JS Pixel | Core | Monitoring engagement, scroll depth, clicks |
| Multi-Source Sync | Core | Fingerprinting, merge strategies, audit trail |
| Testimonials Collection | Core | Auto-scrape + review platforms + CRM |
| Brand Voice | Core | Extraction + per-post injection + validation |
| Keyword Filtering | Core | 4-stage pipeline with client approval |
| GSC Sync | Core | Daily sync, tiered SERP tracking |
| WordPress Plugin | V1.1 | For actual SEO changes (not just monitoring) |
| Content Generation | V1.2 | Full RAG pipeline with Gemini 3.1 Pro |

### Why Plugin Over Pixel for Changes

JS pixel is invisible to AI crawlers (Googlebot, ChatGPT, Perplexity). For SEO changes that need to be seen by crawlers:
- **Pixel:** Monitoring only (analytics, engagement tracking)
- **WordPress Plugin:** Actual changes (meta tags, schema, content)

---

## Summary

| What | How |
|------|-----|
| Content Generation | Gemini 3.1 Pro with RAG from client knowledge |
| Knowledge Storage | pgvector in PostgreSQL |
| Knowledge Retrieval | Vector similarity search |
| Data Input | Dashboard, API, file upload, CMS sync |
| Data Matching | Fingerprinting + fuzzy matching |
| Technical SEO | Auto-detect and fix via plugin (not pixel) |
| On-Page SEO | Auto-optimize titles, meta, headings |
| Content Refresh | Monitor decay, auto-update |
| Quality Gate | 75+ on all dimensions before publish |
| Keyword Filtering | 4-stage pipeline with feasibility scoring |
| GSC Sync | Daily (not hourly — data is 2-3 days stale) |
| Brand Voice | Auto-extract + per-post injection (~500 tokens) |
| Testimonials | First-party data moat, competitors can't copy |

**Core principle:** Zero human oversight. Everything autonomous. Gemini 3.1 Pro for all generation.
