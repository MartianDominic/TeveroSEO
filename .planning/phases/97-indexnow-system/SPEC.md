# Phase 97: IndexNow Multi-Tenant Indexing System

> **Complete Technical Specification**
> 
> Created: 2026-05-08
> Status: Research Complete, Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Discovery: Google Indexing API Limitations](#2-critical-discovery-google-indexing-api-limitations)
3. [IndexNow Protocol Overview](#3-indexnow-protocol-overview)
4. [Existing TeveroSEO Infrastructure](#4-existing-teveroseo-infrastructure)
5. [Multi-Tenant Architecture](#5-multi-tenant-architecture)
6. [Database Schema](#6-database-schema)
7. [Redis Batching Layer](#7-redis-batching-layer)
8. [BullMQ Queue Configuration](#8-bullmq-queue-configuration)
9. [Worker Implementation](#9-worker-implementation)
10. [Rate Limiting & Resilience](#10-rate-limiting--resilience)
11. [WordPress Integration](#11-wordpress-integration)
12. [Trigger Integration Points](#12-trigger-integration-points)
13. [Sitemap Management](#13-sitemap-management)
14. [Dashboard & Monitoring](#14-dashboard--monitoring)
15. [Security Considerations](#15-security-considerations)
16. [Implementation Plan](#16-implementation-plan)
17. [Appendix: Code Templates](#17-appendix-code-templates)

---

## 1. Executive Summary

### Goal

Build a multi-tenant indexing notification system that instantly notifies search engines when client content is published, updated, or optimized — enabling faster discovery and indexing across Bing, Yandex, Naver, and Seznam.

### Key Decision

**Use IndexNow protocol instead of Google Indexing API.**

The Google Indexing API is restricted to `JobPosting` and `BroadcastEvent` structured data only. Using it for regular content (articles, service pages, products) actively harms SEO by signaling to Google that content is ephemeral. IndexNow has no content restrictions and is completely free.

### Scope

| In Scope | Out of Scope |
|----------|--------------|
| IndexNow integration for all content types | Google Indexing API (no job postings) |
| Per-client API key management | Paid indexing services |
| WordPress auto-deployment | Non-WordPress CMS auto-deployment (manual only) |
| Batching with priority-based delays | Real-time WebSocket notifications |
| Sitemap lastmod synchronization | Full sitemap generation |
| Submission logging & analytics | Historical trend analysis |

### Cost

**$0** — IndexNow is a free, open protocol with no API fees or rate limits.

### Coverage

| Search Engine | Protocol | Status |
|---------------|----------|--------|
| **Bing** | IndexNow | ✅ Instant notification |
| **Yandex** | IndexNow | ✅ Instant notification |
| **Naver** | IndexNow | ✅ Instant notification |
| **Seznam** | IndexNow | ✅ Instant notification |
| **Google** | Sitemap lastmod | ⚡ Crawl scheduling signal |

---

## 2. Critical Discovery: Google Indexing API Limitations

### The Hard Truth

The `google-indexing-script` repository README is misleading for general SEO use cases. Deep research revealed critical limitations:

#### Official Restrictions

| Fact | Source |
|------|--------|
| Google Indexing API **ONLY** supports `JobPosting` and `BroadcastEvent` schema | [Google Documentation](https://developers.google.com/search/apis/indexing-api/v3/quickstart) |
| Using it for other content types is explicitly discouraged | Google Search Relations team |
| Submissions signal "ephemeral" content to Google | API design intent |

#### Evidence of Harm

1. **MiroMind SEO Agency Case Study:**
   - Disabled Indexing API for non-job content
   - Result: **2x impressions increase** (3,000 → 6,000)
   - Result: **300% click increase**
   - Conclusion: The API was actively harming their rankings

2. **Google Engineer Warnings:**
   - John Mueller (May 2025): *"We see a lot of spammers misuse the Indexing API like this, so I'd recommend just sticking to the documented & supported use-cases"*
   - Gary Illyes: *"The API may stop supporting unsupported content formats without notice"*

3. **Reported Permanent Damage:**
   - Multiple SEOs report traffic drops that "never recovered" after using API for non-job pages
   - Content marked as ephemeral loses long-term ranking potential

#### Why This Happens

The Indexing API was designed for:
- **Job postings** — which expire and need rapid index/deindex cycles
- **Livestream events** — time-sensitive content that becomes irrelevant quickly

When you submit evergreen content (articles, product pages, service descriptions), Google's systems interpret the submission as: *"This content is time-sensitive and will become irrelevant soon"* — exactly the opposite of what you want for SEO.

#### Google Indexing API Quotas (For Reference Only)

| Quota | Limit | Notes |
|-------|-------|-------|
| Publish requests | 200/day | Per GCP project |
| Metadata requests | 600/minute | Read-only |
| Batch size | 100 URLs | Per HTTP request |
| Quota increase | Manual approval | Takes weeks, not guaranteed |

**Decision: Do NOT use Google Indexing API for TeveroSEO clients (no job posting use case).**

---

## 3. IndexNow Protocol Overview

### What is IndexNow?

IndexNow is an open protocol that allows websites to instantly notify participating search engines about content changes. It was launched by Microsoft (Bing) and Yandex in October 2021.

### How It Works

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Your Site     │         │  IndexNow API   │         │ Search Engines  │
│                 │         │                 │         │                 │
│  Content        │  POST   │  Validates      │  Share  │  Bing           │
│  Changed        │────────►│  API Key        │────────►│  Yandex         │
│                 │         │  Distributes    │         │  Naver          │
│                 │         │                 │         │  Seznam         │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Protocol Requirements

1. **API Key Generation**
   - Any string (UUID recommended)
   - Must be unique per domain
   - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

2. **Key File Verification**
   - Host at: `https://yourdomain.com/{api-key}.txt`
   - File content: The API key itself (plain text)
   - Must return HTTP 200

3. **Submission Endpoint**
   ```
   POST https://api.indexnow.org/IndexNow
   Content-Type: application/json
   
   {
     "host": "yourdomain.com",
     "key": "your-api-key",
     "keyLocation": "https://yourdomain.com/your-api-key.txt",
     "urlList": [
       "https://yourdomain.com/page1",
       "https://yourdomain.com/page2"
     ]
   }
   ```

### Limits and Quotas

| Limit | Value | Notes |
|-------|-------|-------|
| URLs per request | 10,000 | Can batch up to 10K URLs |
| Requests per day | Unlimited | No daily cap |
| Rate limit | None specified | Be reasonable (don't spam) |
| Cost | Free | No API fees |

### Participating Search Engines

| Engine | Endpoint | Market |
|--------|----------|--------|
| Generic | `https://api.indexnow.org/IndexNow` | All |
| Bing | `https://www.bing.com/IndexNow` | Global |
| Yandex | `https://yandex.com/indexnow` | Russia, CIS |
| Naver | `https://searchadvisor.naver.com/indexnow` | South Korea |
| Seznam | `https://search.seznam.cz/indexnow` | Czech Republic |

**Note:** Search engines share IndexNow data with each other. Submitting to one endpoint notifies all participating engines.

### Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | URLs accepted |
| 202 | Accepted | Will process later |
| 400 | Bad Request | Check payload format |
| 403 | Forbidden | Key verification failed |
| 422 | Unprocessable | Invalid URLs in list |
| 429 | Too Many Requests | Slow down (rare) |

### What About Google?

**Google has NOT adopted IndexNow.** They acknowledged the protocol but have not implemented it as of May 2026.

For Google, the best approach is:
1. Accurate `lastmod` dates in XML sitemaps
2. Submit sitemaps via Google Search Console
3. Natural crawl frequency based on content quality

---

## 4. Existing TeveroSEO Infrastructure

### Codebase Inventory

Research identified the following existing infrastructure relevant to indexing:

#### AI-Writer (Python/FastAPI)

| File | Purpose | Relevance |
|------|---------|-----------|
| `backend/services/gsc_service.py` | GSC OAuth + Indexing API | Has `submit_url_for_indexing()` — **needs replacement with IndexNow** |
| `backend/services/client_oauth_service.py` | Per-client OAuth tokens | Model for per-client credential storage |
| `backend/services/auto_publish_executor.py` | Post-publish hooks | Has `_submit_to_gsc()` — **integration point for IndexNow** |
| `backend/services/encryption.py` | Fernet encryption | Can reuse for API key encryption |
| `backend/models/client_oauth.py` | OAuth token models | Pattern for IndexNow config model |

**Key Finding:** AI-Writer already has a post-publish hook (`_submit_to_gsc()`) that we need to redirect to IndexNow.

#### open-seo-main (TypeScript/TanStack Start)

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/server/features/analytics/clients/GscUrlInspectionClient.ts` | URL Inspection + Indexing API | Has `submitIndexRequest()` — **do not use for content** |
| `src/server/features/platform-oauth/services/GoogleSearchConsoleService.ts` | GSC API wrapper | Reference for service pattern |
| `src/db/platform-connection-schema.ts` | OAuth credential storage | AES-256-GCM encryption pattern to reuse |
| `src/server/lib/encryption.ts` | AES-256-GCM encryption | **Reuse for IndexNow API keys** |
| `src/server/middleware/rate-limit.ts` | Sliding window rate limiter | Pattern for IndexNow rate limiting |
| `src/server/lib/circuit-breaker.ts` | Redis circuit breaker | Pattern for IndexNow resilience |
| `src/worker-entry.ts` | BullMQ worker setup | Add IndexNow worker here |

**Key Finding:** open-seo-main has mature patterns for encryption, rate limiting, circuit breakers, and BullMQ workers that we should reuse.

#### Existing Encryption

**AI-Writer:**
```python
# Fernet encryption (AES-128-CBC + HMAC-SHA256)
# Env var: FERNET_KEY
from services.encryption import encrypt, decrypt
```

**open-seo-main:**
```typescript
// AES-256-GCM encryption
// Env var: PAYMENT_ENCRYPTION_KEY
import { encrypt, decrypt } from "@/server/lib/encryption";
```

**Decision:** Use open-seo-main's AES-256-GCM encryption for IndexNow API keys (stronger, already used for credentials).

#### Existing BullMQ Patterns

```typescript
// Standard worker pattern from open-seo-main
export const exampleWorker = new Worker<JobData, JobResult>(
  "queue-name",
  async (job) => { /* processor */ },
  {
    connection: getSharedBullMQConnection("worker:name"),
    lockDuration: 600_000, // 10 min for long-running jobs
    maxStalledCount: 2,
    concurrency: 1,
    limiter: { max: 50, duration: 60000 },
  }
);
```

#### Gaps to Fill

| Gap | Description | Solution |
|-----|-------------|----------|
| IndexNow worker | No dedicated BullMQ worker | Create `indexnow-worker.ts` |
| IndexNow config table | No per-client IndexNow storage | Create Drizzle schema |
| Batching layer | No URL batching mechanism | Redis-based batching |
| WordPress key deployment | No key file deployment | REST API integration |
| Trigger hooks | Only GSC hooks exist | Add IndexNow hooks |

---

## 5. Multi-Tenant Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MULTI-TENANT INDEXNOW ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Client A   │  │  Client B   │  │  Client C   │  │  Client D   │        │
│  │             │  │             │  │             │  │             │        │
│  │ domain-a.com│  │ domain-b.com│  │ domain-c.com│  │ domain-d.com│        │
│  │ blog.a.com  │  │             │  │ shop.c.com  │  │             │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        IndexNowService                               │   │
│  │                                                                      │   │
│  │  • Per-client API key generation                                    │   │
│  │  • Encrypted key storage (AES-256-GCM)                              │   │
│  │  • Domain verification management                                    │   │
│  │  • URL queueing with batching                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Redis Batching Layer                             │   │
│  │                                                                      │   │
│  │  indexnow:pending:{clientId}:{domain} → SET of URLs                 │   │
│  │  indexnow:flush:{clientId}:{domain} → Timestamp when to flush       │   │
│  │                                                                      │   │
│  │  Priority-based delays:                                             │   │
│  │  • Priority 0 (publish): 30 seconds                                 │   │
│  │  • Priority 1 (update): 5 minutes                                   │   │
│  │  • Priority 2 (seo_fix): 1 hour                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  BullMQ: indexnow-submit                             │   │
│  │                                                                      │   │
│  │  Jobs: { clientId, domain, urls[], triggerType }                    │   │
│  │  Concurrency: 5 (multiple clients in parallel)                      │   │
│  │  Rate limit: 10 jobs/minute                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      IndexNowWorker                                  │   │
│  │                                                                      │   │
│  │  1. Decrypt client's API key                                        │   │
│  │  2. Build IndexNow payload                                          │   │
│  │  3. POST to IndexNow endpoint (with fallback)                       │   │
│  │  4. Log submission result                                           │   │
│  │  5. Update client statistics                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    IndexNow Endpoints                                │   │
│  │                                                                      │   │
│  │  Primary:  https://api.indexnow.org/IndexNow                        │   │
│  │  Fallback: https://www.bing.com/IndexNow                            │   │
│  │                                                                      │   │
│  │  → Bing, Yandex, Naver, Seznam all receive notification            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Client Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT ONBOARDING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Client Added to TeveroSEO                                              │
│              │                                                              │
│              ▼                                                              │
│  2. Admin enables IndexNow for client                                      │
│     POST /api/clients/{id}/indexnow/setup                                  │
│     Body: { domains: ["example.com", "blog.example.com"] }                 │
│              │                                                              │
│              ▼                                                              │
│  3. System generates UUID v4 API key                                       │
│     Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"                        │
│              │                                                              │
│              ▼                                                              │
│  4. API key encrypted with AES-256-GCM                                     │
│     Stored in indexnow_config.api_key_encrypted                            │
│              │                                                              │
│              ▼                                                              │
│  5. Verification status set to "pending" for each domain                   │
│              │                                                              │
│              ├──► WordPress site detected?                                 │
│              │         │                                                    │
│              │        YES                                                   │
│              │         │                                                    │
│              │         ▼                                                    │
│              │    Auto-deploy via REST API                                 │
│              │    • Store key in wp_options                                │
│              │    • Plugin serves /{key}.txt endpoint                      │
│              │         │                                                    │
│              │         ▼                                                    │
│              │    Auto-verify: GET https://site.com/{key}.txt              │
│              │         │                                                    │
│              │         ├──► 200 + matches → status: "verified" ✅          │
│              │         └──► Failed → status: "pending" + show instructions │
│              │                                                              │
│              └──► Other CMS                                                │
│                        │                                                    │
│                        ▼                                                    │
│                   Show manual instructions:                                │
│                   "Upload {key}.txt to your site root"                     │
│                        │                                                    │
│                        ▼                                                    │
│                   User clicks "Verify" button                              │
│                        │                                                    │
│                        ▼                                                    │
│                   GET https://site.com/{key}.txt                           │
│                        │                                                    │
│                        ├──► 200 + matches → status: "verified" ✅          │
│                        └──► Failed → show error + retry                    │
│              │                                                              │
│              ▼                                                              │
│  6. Once verified, IndexNow submissions enabled for that domain            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### URL Submission Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         URL SUBMISSION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER EVENTS                                                            │
│  ══════════════                                                            │
│                                                                             │
│  ┌──────────────────┐                                                      │
│  │ AI-Writer        │                                                      │
│  │                  │                                                      │
│  │ • Article        │──► publish ──► Priority 0 (30s)                      │
│  │   published      │                                                      │
│  │                  │                                                      │
│  │ • Article        │──► update ───► Priority 1 (5min)                     │
│  │   updated        │                                                      │
│  └──────────────────┘                                                      │
│                                                                             │
│  ┌──────────────────┐                                                      │
│  │ open-seo-main    │                                                      │
│  │                  │                                                      │
│  │ • SEO fix        │──► seo_fix ──► Priority 2 (1hr)                      │
│  │   applied        │                                                      │
│  │                  │                                                      │
│  │ • Manual         │──► manual ───► Priority 0 (30s)                      │
│  │   submission     │                                                      │
│  │                  │                                                      │
│  │ • Bulk           │──► bulk ─────► Priority 2 (1hr)                      │
│  │   import         │                                                      │
│  └──────────────────┘                                                      │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  IndexNowService.queueUrl(clientId, url, triggerType)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. Lookup client's IndexNow config                                  │   │
│  │  2. Check if enabled                                                 │   │
│  │  3. Extract domain from URL                                          │   │
│  │  4. Check domain is verified                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  REDIS BATCHING                                                      │   │
│  │                                                                      │   │
│  │  SADD indexnow:pending:{clientId}:{domain} {url}                    │   │
│  │  (Automatically deduplicates if same URL queued multiple times)     │   │
│  │                                                                      │   │
│  │  SETNX indexnow:flush:{clientId}:{domain} {flushTimestamp}          │   │
│  │  (Only first URL sets the timer; subsequent URLs just add to set)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         │  ┌──────────────────────────────────────────────────────────┐    │
│         │  │  Flush Scheduler (runs every 30 seconds)                  │    │
│         │  │                                                           │    │
│         │  │  1. KEYS indexnow:flush:*                                │    │
│         │  │  2. For each key where timestamp <= now:                 │    │
│         │  │     a. SMEMBERS indexnow:pending:{clientId}:{domain}     │    │
│         │  │     b. DEL both keys                                     │    │
│         │  │     c. Create BullMQ job with URLs                       │    │
│         │  └──────────────────────────────────────────────────────────┘    │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  BullMQ Job: indexnow-submit                                         │   │
│  │                                                                      │   │
│  │  {                                                                   │   │
│  │    clientId: "uuid",                                                │   │
│  │    domain: "example.com",                                           │   │
│  │    urls: ["https://example.com/page1", "https://example.com/page2"],│   │
│  │    triggerType: "batched"                                           │   │
│  │  }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  IndexNowWorker processes job                                        │   │
│  │                                                                      │   │
│  │  1. Decrypt API key from indexnow_config                            │   │
│  │  2. Build payload:                                                  │   │
│  │     {                                                               │   │
│  │       host: "example.com",                                          │   │
│  │       key: "decrypted-api-key",                                     │   │
│  │       keyLocation: "https://example.com/decrypted-api-key.txt",     │   │
│  │       urlList: [...]                                                │   │
│  │     }                                                               │   │
│  │  3. POST to https://api.indexnow.org/IndexNow                       │   │
│  │  4. If fails, retry https://www.bing.com/IndexNow                   │   │
│  │  5. Log result to indexnow_submissions                              │   │
│  │  6. Update stats in indexnow_config                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Schema

### Tables

#### indexnow_config

Stores IndexNow configuration per client.

```sql
CREATE TABLE indexnow_config (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Foreign key to clients table (AI-Writer)
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- API key (encrypted with AES-256-GCM)
  -- Decrypted format: UUID v4 string
  api_key_encrypted TEXT NOT NULL,
  
  -- Domains configured for this client
  -- JSON array: ["example.com", "blog.example.com"]
  domains JSONB DEFAULT '[]'::jsonb,
  
  -- Verification status per domain
  -- JSON object: {"example.com": "verified", "blog.example.com": "pending"}
  -- Possible values: "pending", "verified", "failed"
  verification_status JSONB DEFAULT '{}'::jsonb,
  
  -- Last successful verification timestamp
  last_verified_at TIMESTAMPTZ,
  
  -- Feature toggles
  enabled BOOLEAN DEFAULT true,
  auto_submit_publish BOOLEAN DEFAULT true,
  auto_submit_update BOOLEAN DEFAULT true,
  auto_submit_seo_fix BOOLEAN DEFAULT true,
  
  -- Batching configuration (in seconds)
  delay_publish INTEGER DEFAULT 30,      -- 30 seconds for new content
  delay_update INTEGER DEFAULT 300,      -- 5 minutes for updates
  delay_seo_fix INTEGER DEFAULT 3600,    -- 1 hour for SEO fixes
  
  -- Statistics
  total_urls_submitted INTEGER DEFAULT 0,
  urls_submitted_today INTEGER DEFAULT 0,
  stats_reset_at DATE,                    -- Date when daily stats were last reset
  last_submission_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT uq_indexnow_client UNIQUE(client_id)
);

-- Indexes
CREATE INDEX idx_indexnow_config_enabled 
  ON indexnow_config(enabled) 
  WHERE enabled = true;

CREATE INDEX idx_indexnow_config_client 
  ON indexnow_config(client_id);
```

#### indexnow_submissions

Stores submission history for debugging and analytics.

```sql
CREATE TABLE indexnow_submissions (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Foreign keys
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  config_id TEXT NOT NULL REFERENCES indexnow_config(id) ON DELETE CASCADE,
  
  -- Submission details
  domain TEXT NOT NULL,
  urls JSONB NOT NULL,                    -- Array of submitted URLs
  url_count INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,             -- 'publish', 'update', 'seo_fix', 'manual', 'bulk', 'batched'
  
  -- Response details
  endpoint TEXT NOT NULL,                 -- Which IndexNow endpoint was used
  http_status INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_body TEXT,                     -- Raw response for debugging
  
  -- Timing
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  processing_time_ms INTEGER,             -- How long the HTTP request took
  
  -- Constraints
  CONSTRAINT chk_trigger_type CHECK (
    trigger_type IN ('publish', 'update', 'seo_fix', 'manual', 'bulk', 'batched')
  )
);

-- Indexes
CREATE INDEX idx_indexnow_submissions_client 
  ON indexnow_submissions(client_id, submitted_at DESC);

CREATE INDEX idx_indexnow_submissions_success 
  ON indexnow_submissions(success, submitted_at DESC);

CREATE INDEX idx_indexnow_submissions_recent 
  ON indexnow_submissions(submitted_at DESC) 
  WHERE submitted_at > NOW() - INTERVAL '7 days';

-- Optional: Partition by month for high-volume deployments
-- CREATE TABLE indexnow_submissions_y2026m05 
--   PARTITION OF indexnow_submissions
--   FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

### Drizzle ORM Schema

```typescript
// open-seo-main/src/db/indexnow-schema.ts

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  uuid,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";

// ============================================================================
// IndexNow Configuration
// ============================================================================

export const indexnowConfig = pgTable(
  "indexnow_config",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // API key (encrypted)
    apiKeyEncrypted: text("api_key_encrypted").notNull(),

    // Domains and verification
    domains: jsonb("domains").$type<string[]>().default([]),
    verificationStatus: jsonb("verification_status")
      .$type<Record<string, "pending" | "verified" | "failed">>()
      .default({}),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    // Feature toggles
    enabled: boolean("enabled").default(true),
    autoSubmitPublish: boolean("auto_submit_publish").default(true),
    autoSubmitUpdate: boolean("auto_submit_update").default(true),
    autoSubmitSeoFix: boolean("auto_submit_seo_fix").default(true),

    // Batching config (seconds)
    delayPublish: integer("delay_publish").default(30),
    delayUpdate: integer("delay_update").default(300),
    delaySeoFix: integer("delay_seo_fix").default(3600),

    // Statistics
    totalUrlsSubmitted: integer("total_urls_submitted").default(0),
    urlsSubmittedToday: integer("urls_submitted_today").default(0),
    statsResetAt: date("stats_reset_at"),
    lastSubmissionAt: timestamp("last_submission_at", { withTimezone: true }),
    lastError: text("last_error"),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_indexnow_client").on(table.clientId),
    index("idx_indexnow_config_enabled").on(table.enabled),
  ]
);

export const indexnowConfigRelations = relations(indexnowConfig, ({ one, many }) => ({
  client: one(clients, {
    fields: [indexnowConfig.clientId],
    references: [clients.id],
  }),
  submissions: many(indexnowSubmissions),
}));

// ============================================================================
// IndexNow Submissions Log
// ============================================================================

export const TRIGGER_TYPES = [
  "publish",
  "update",
  "seo_fix",
  "manual",
  "bulk",
  "batched",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const indexnowSubmissions = pgTable(
  "indexnow_submissions",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    configId: text("config_id")
      .notNull()
      .references(() => indexnowConfig.id, { onDelete: "cascade" }),

    // Submission details
    domain: text("domain").notNull(),
    urls: jsonb("urls").$type<string[]>().notNull(),
    urlCount: integer("url_count").notNull(),
    triggerType: text("trigger_type").$type<TriggerType>().notNull(),

    // Response
    endpoint: text("endpoint").notNull(),
    httpStatus: integer("http_status"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    responseBody: text("response_body"),

    // Timing
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
    processingTimeMs: integer("processing_time_ms"),
  },
  (table) => [
    index("idx_indexnow_submissions_client").on(
      table.clientId,
      table.submittedAt
    ),
    index("idx_indexnow_submissions_success").on(
      table.success,
      table.submittedAt
    ),
  ]
);

export const indexnowSubmissionsRelations = relations(
  indexnowSubmissions,
  ({ one }) => ({
    client: one(clients, {
      fields: [indexnowSubmissions.clientId],
      references: [clients.id],
    }),
    config: one(indexnowConfig, {
      fields: [indexnowSubmissions.configId],
      references: [indexnowConfig.id],
    }),
  })
);

// ============================================================================
// Types
// ============================================================================

export type IndexNowConfig = typeof indexnowConfig.$inferSelect;
export type NewIndexNowConfig = typeof indexnowConfig.$inferInsert;
export type IndexNowSubmission = typeof indexnowSubmissions.$inferSelect;
export type NewIndexNowSubmission = typeof indexnowSubmissions.$inferInsert;
```

---

## 7. Redis Batching Layer

### Key Structure

```
indexnow:pending:{clientId}:{domain}
  Type: SET
  Content: URLs waiting to be submitted
  TTL: 24 hours (safety cleanup)
  
indexnow:flush:{clientId}:{domain}
  Type: STRING
  Content: Unix timestamp (ms) when batch should be flushed
  TTL: 24 hours (safety cleanup)
```

### Example

```
# After 3 URLs queued for client abc123, domain example.com:

indexnow:pending:abc123:example.com
  Type: SET
  Members:
    - "https://example.com/blog/new-post"
    - "https://example.com/blog/updated-post"
    - "https://example.com/services/seo"

indexnow:flush:abc123:example.com
  Type: STRING
  Value: "1715187600000"  # Unix timestamp when to flush
```

### Operations

#### Queue URL

```typescript
async function queueUrl(
  clientId: string,
  domain: string,
  url: string,
  delayMs: number
): Promise<void> {
  const pendingKey = `indexnow:pending:${clientId}:${domain}`;
  const flushKey = `indexnow:flush:${clientId}:${domain}`;
  
  // Add URL to pending set (auto-dedupes)
  await redis.sadd(pendingKey, url);
  await redis.expire(pendingKey, 86400);
  
  // Set flush time if not already set
  const flushAt = Date.now() + delayMs;
  const wasSet = await redis.setnx(flushKey, flushAt.toString());
  if (wasSet) {
    await redis.expire(flushKey, 86400);
  }
}
```

#### Flush Batch

```typescript
async function flushBatch(
  clientId: string,
  domain: string
): Promise<string[]> {
  const pendingKey = `indexnow:pending:${clientId}:${domain}`;
  const flushKey = `indexnow:flush:${clientId}:${domain}`;
  
  // Get all URLs atomically
  const urls = await redis.smembers(pendingKey);
  
  // Clear both keys
  await redis.del(pendingKey, flushKey);
  
  return urls;
}
```

#### Check Ready Batches

```typescript
async function checkReadyBatches(): Promise<Array<{
  clientId: string;
  domain: string;
}>> {
  const pattern = "indexnow:flush:*";
  const keys = await redis.keys(pattern);
  const now = Date.now();
  const ready: Array<{ clientId: string; domain: string }> = [];
  
  for (const key of keys) {
    const flushAt = parseInt(await redis.get(key) || "0", 10);
    if (flushAt <= now) {
      // Parse key: indexnow:flush:{clientId}:{domain}
      const parts = key.split(":");
      ready.push({
        clientId: parts[2],
        domain: parts[3],
      });
    }
  }
  
  return ready;
}
```

### Priority Delays

| Trigger Type | Priority | Default Delay | Rationale |
|--------------|----------|---------------|-----------|
| `publish` | 0 | 30 seconds | New content should be indexed ASAP |
| `manual` | 0 | 30 seconds | User explicitly requested fast submission |
| `update` | 1 | 5 minutes | Batch updates to avoid spam |
| `seo_fix` | 2 | 1 hour | SEO fixes can wait; batch for efficiency |
| `bulk` | 2 | 1 hour | Distribute bulk imports over time |

### Deduplication

The Redis SET data structure automatically deduplicates URLs. If the same URL is queued multiple times before the batch flushes, it only appears once in the final submission.

Example:
```
# These three operations:
SADD indexnow:pending:abc:example.com "https://example.com/page1"
SADD indexnow:pending:abc:example.com "https://example.com/page1"  # duplicate
SADD indexnow:pending:abc:example.com "https://example.com/page1"  # duplicate

# Result in only one URL in the set:
SMEMBERS indexnow:pending:abc:example.com
→ ["https://example.com/page1"]
```

---

## 8. BullMQ Queue Configuration

### Queue Definition

```typescript
// open-seo-main/src/server/queues/indexnow-queue.ts

import { Queue, QueueEvents } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";

export const INDEXNOW_QUEUE_NAME = "indexnow-submit" as const;

export interface IndexNowJobData {
  clientId: string;
  domain: string;
  urls: string[];
  triggerType: string;
  configId: string;
}

export interface IndexNowJobResult {
  success: boolean;
  urlCount: number;
  endpoint: string;
  httpStatus?: number;
  error?: string;
}

let indexNowQueue: Queue<IndexNowJobData, IndexNowJobResult> | null = null;

export function getIndexNowQueue(): Queue<IndexNowJobData, IndexNowJobResult> {
  if (!indexNowQueue) {
    indexNowQueue = new Queue<IndexNowJobData, IndexNowJobResult>(
      INDEXNOW_QUEUE_NAME,
      {
        connection: getSharedBullMQConnection("queue:indexnow"),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 30000, // 30s, 60s, 120s
          },
          removeOnComplete: {
            count: 500, // Keep last 500 completed jobs
          },
          removeOnFail: {
            count: 1000, // Keep last 1000 failed jobs
          },
        },
      }
    );
  }
  return indexNowQueue;
}

export async function enqueueIndexNowJob(
  data: IndexNowJobData
): Promise<string> {
  const queue = getIndexNowQueue();
  
  // Dedupe by clientId + domain + URL hash
  const jobId = `${data.clientId}:${data.domain}:${Date.now()}`;
  
  const job = await queue.add("submit", data, {
    jobId,
    priority: 5, // Default priority
  });
  
  return job.id!;
}
```

### Scheduler Job

```typescript
// open-seo-main/src/server/jobs/indexnow-scheduler.ts

import { CronJob } from "cron";
import { indexNowService } from "../features/indexing/services/IndexNowService";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "indexnow-scheduler" });

let schedulerJob: CronJob | null = null;

/**
 * Start the IndexNow flush scheduler.
 * Runs every 30 seconds to check for batches ready to submit.
 */
export function startIndexNowScheduler(): void {
  if (schedulerJob) return;

  schedulerJob = new CronJob(
    "*/30 * * * * *", // Every 30 seconds
    async () => {
      try {
        const flushed = await indexNowService.checkAndFlushBatches();
        if (flushed > 0) {
          log.info("Flushed IndexNow batches", { urlCount: flushed });
        }
      } catch (error) {
        log.error("IndexNow scheduler error", { error });
      }
    },
    null,
    true, // Start immediately
    "UTC"
  );

  log.info("IndexNow scheduler started");
}

export function stopIndexNowScheduler(): void {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    log.info("IndexNow scheduler stopped");
  }
}
```

### Daily Stats Reset Job

```typescript
// open-seo-main/src/server/jobs/indexnow-stats-reset.ts

import { CronJob } from "cron";
import { db } from "@/db";
import { indexnowConfig } from "@/db/indexnow-schema";
import { sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "indexnow-stats-reset" });

let resetJob: CronJob | null = null;

/**
 * Reset daily stats at midnight UTC.
 */
export function startStatsResetJob(): void {
  if (resetJob) return;

  resetJob = new CronJob(
    "0 0 0 * * *", // Midnight UTC
    async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        
        await db
          .update(indexnowConfig)
          .set({
            urlsSubmittedToday: 0,
            statsResetAt: sql`${today}::date`,
          });
        
        log.info("Reset daily IndexNow stats");
      } catch (error) {
        log.error("Stats reset error", { error });
      }
    },
    null,
    true,
    "UTC"
  );

  log.info("IndexNow stats reset job started");
}
```

---

## 9. Worker Implementation

### Main Worker

```typescript
// open-seo-main/src/server/workers/indexnow-worker.ts

import { Worker, Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { db } from "@/db";
import { indexnowConfig, indexnowSubmissions } from "@/db/indexnow-schema";
import { eq, sql } from "drizzle-orm";
import { decrypt } from "@/server/lib/encryption";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";
import {
  INDEXNOW_QUEUE_NAME,
  IndexNowJobData,
  IndexNowJobResult,
} from "../queues/indexnow-queue";

const log = createLogger({ module: "indexnow-worker" });

// IndexNow endpoints (try primary, fallback to secondary)
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/IndexNow",
  "https://www.bing.com/IndexNow",
] as const;

// Worker instance
let worker: Worker<IndexNowJobData, IndexNowJobResult> | null = null;

/**
 * Process a single IndexNow submission job.
 */
async function processIndexNowJob(
  job: Job<IndexNowJobData, IndexNowJobResult>
): Promise<IndexNowJobResult> {
  const { clientId, domain, urls, triggerType, configId } = job.data;
  const startTime = Date.now();

  log.info("Processing IndexNow job", {
    jobId: job.id,
    clientId,
    domain,
    urlCount: urls.length,
  });

  // Get client's API key
  const config = await db.query.indexnowConfig.findFirst({
    where: eq(indexnowConfig.id, configId),
  });

  if (!config) {
    throw new Error(`IndexNow config not found: ${configId}`);
  }

  if (!config.enabled) {
    log.warn("IndexNow disabled for client", { clientId });
    return {
      success: false,
      urlCount: 0,
      endpoint: "",
      error: "IndexNow disabled for client",
    };
  }

  // Decrypt API key
  const apiKey = decrypt(config.apiKeyEncrypted);

  // Build request payload
  const payload = {
    host: domain,
    key: apiKey,
    keyLocation: `https://${domain}/${apiKey}.txt`,
    urlList: urls,
  };

  // Try endpoints
  let success = false;
  let lastError: string | undefined;
  let usedEndpoint: string = INDEXNOW_ENDPOINTS[0];
  let httpStatus: number | undefined;
  let responseBody: string | undefined;

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      log.debug("Submitting to IndexNow", { endpoint, urlCount: urls.length });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "TeveroSEO-IndexNow/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      httpStatus = response.status;
      usedEndpoint = endpoint;
      responseBody = await response.text();

      if (response.status === 200 || response.status === 202) {
        success = true;
        log.info("IndexNow submission successful", {
          endpoint,
          status: response.status,
          urlCount: urls.length,
        });
        break;
      }

      // Non-retryable errors
      if (response.status === 400 || response.status === 422) {
        lastError = `Bad request (${response.status}): ${responseBody}`;
        log.error("IndexNow bad request", { endpoint, status: response.status, body: responseBody });
        break;
      }

      if (response.status === 403) {
        lastError = "Key verification failed - check key file is accessible";
        log.error("IndexNow key verification failed", { endpoint, domain });
        break;
      }

      lastError = `HTTP ${response.status}: ${responseBody}`;
      log.warn("IndexNow endpoint failed, trying next", { endpoint, status: response.status });

    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      log.warn("IndexNow request error", { endpoint, error: lastError });
    }
  }

  const processingTimeMs = Date.now() - startTime;

  // Log submission to database
  await db.insert(indexnowSubmissions).values({
    id: nanoid(),
    clientId,
    configId,
    domain,
    urls,
    urlCount: urls.length,
    triggerType,
    endpoint: usedEndpoint,
    httpStatus,
    success,
    errorMessage: success ? null : lastError,
    responseBody,
    processingTimeMs,
  });

  // Update config stats
  if (success) {
    await db
      .update(indexnowConfig)
      .set({
        totalUrlsSubmitted: sql`${indexnowConfig.totalUrlsSubmitted} + ${urls.length}`,
        urlsSubmittedToday: sql`${indexnowConfig.urlsSubmittedToday} + ${urls.length}`,
        lastSubmissionAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(indexnowConfig.id, configId));
  } else {
    await db
      .update(indexnowConfig)
      .set({
        lastError,
        updatedAt: new Date(),
      })
      .where(eq(indexnowConfig.id, configId));
  }

  if (!success) {
    throw new Error(lastError);
  }

  return {
    success: true,
    urlCount: urls.length,
    endpoint: usedEndpoint,
    httpStatus,
  };
}

/**
 * Start the IndexNow worker.
 */
export function startIndexNowWorker(): Worker<IndexNowJobData, IndexNowJobResult> {
  if (worker) return worker;

  worker = new Worker<IndexNowJobData, IndexNowJobResult>(
    INDEXNOW_QUEUE_NAME,
    processIndexNowJob,
    {
      connection: getSharedBullMQConnection("worker:indexnow"),
      concurrency: 5, // Process 5 jobs in parallel (different clients)
      limiter: {
        max: 20,
        duration: 60000, // Max 20 jobs per minute
      },
      lockDuration: 60000, // 1 minute lock
      maxStalledCount: 2,
    }
  );

  worker.on("ready", () => {
    log.info("IndexNow worker ready");
  });

  worker.on("completed", (job, result) => {
    log.debug("IndexNow job completed", {
      jobId: job.id,
      urlCount: result.urlCount,
      endpoint: result.endpoint,
    });
  });

  worker.on("failed", (job, error) => {
    log.error("IndexNow job failed", {
      jobId: job?.id,
      clientId: job?.data.clientId,
      error: error.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on("error", (error) => {
    log.error("IndexNow worker error", { error: error.message });
  });

  return worker;
}

/**
 * Stop the IndexNow worker gracefully.
 */
export async function stopIndexNowWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  await current.close();
  log.info("IndexNow worker stopped");
}
```

### Worker Registration

Add to `worker-entry.ts`:

```typescript
// open-seo-main/src/worker-entry.ts

import { startIndexNowWorker, stopIndexNowWorker } from "./server/workers/indexnow-worker";
import { startIndexNowScheduler, stopIndexNowScheduler } from "./server/jobs/indexnow-scheduler";
import { startStatsResetJob } from "./server/jobs/indexnow-stats-reset";

// In the worker startup section:
startIndexNowWorker();
startIndexNowScheduler();
startStatsResetJob();

// In the graceful shutdown section:
await stopIndexNowWorker();
stopIndexNowScheduler();
```

---

## 10. Rate Limiting & Resilience

### Rate Limiting Strategy

Although IndexNow has no official rate limits, we implement rate limiting for:
1. **Fair resource distribution** across clients
2. **Protection against runaway jobs**
3. **Avoiding potential future rate limits**

```typescript
// BullMQ limiter configuration
{
  limiter: {
    max: 20,        // Max 20 jobs
    duration: 60000 // Per minute
  }
}
```

This allows up to 20 batches per minute across all clients, which is more than sufficient for typical usage.

### Retry Strategy

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 30000 // 30s base delay
  }
}
// Retry timeline: 30s, 60s, 120s
```

### Error Classification

| Error Type | HTTP Status | Retry | Action |
|------------|-------------|-------|--------|
| Success | 200, 202 | No | Log success |
| Bad Request | 400 | No | Log error, alert |
| Forbidden | 403 | No | Mark domain unverified, alert |
| Unprocessable | 422 | No | Log invalid URLs |
| Too Many Requests | 429 | Yes | Exponential backoff |
| Server Error | 5xx | Yes | Exponential backoff |
| Network Error | N/A | Yes | Exponential backoff |

### Circuit Breaker (Optional)

For high-volume deployments, implement a circuit breaker:

```typescript
import { RedisCircuitBreaker } from "@/server/lib/circuit-breaker";

const indexNowCircuitBreaker = new RedisCircuitBreaker({
  name: "indexnow-api",
  failureThreshold: 10,      // Open after 10 failures
  resetTimeoutMs: 60000,     // Try again after 1 minute
  halfOpenRequests: 3,       // Allow 3 test requests
});
```

### Fallback Strategy

When the circuit is open or all endpoints fail:

1. **Queue for later** — Store URLs in a Redis sorted set with timestamp
2. **Alert administrators** — Notify via in-app notification
3. **Retry on recovery** — Process queued URLs when circuit closes

---

## 11. WordPress Integration

### Overview

WordPress sites represent the majority of TeveroSEO clients. We provide semi-automated key deployment:

1. Store API key in WordPress options
2. Provide code snippet for key file endpoint
3. Auto-verify after deployment

### Key File Endpoint (PHP Snippet)

```php
<?php
/**
 * IndexNow Key File Handler
 * Add this to your theme's functions.php or a custom plugin
 */
add_action('init', function() {
    $indexnow_key = get_option('tevero_indexnow_key');
    
    if (!$indexnow_key) {
        return;
    }
    
    $request_uri = $_SERVER['REQUEST_URI'];
    $expected_path = '/' . $indexnow_key . '.txt';
    
    // Handle both with and without trailing content
    if ($request_uri === $expected_path || strpos($request_uri, $expected_path) === 0) {
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: public, max-age=86400'); // Cache for 24 hours
        header('X-Robots-Tag: noindex');
        echo $indexnow_key;
        exit;
    }
}, 1); // Priority 1 to run early
```

### WordPress REST API Integration

```typescript
// open-seo-main/src/server/features/indexing/wordpress/WordPressIndexNowDeployer.ts

import { WordPressClient } from "@/server/features/cms/clients/WordPressClient";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "wp-indexnow-deployer" });

export interface DeployResult {
  success: boolean;
  keyStored: boolean;
  endpointActive: boolean;
  error?: string;
  instructions?: string;
}

/**
 * Deploy IndexNow API key to a WordPress site.
 */
export async function deployIndexNowToWordPress(
  siteUrl: string,
  credentials: { username: string; appPassword: string },
  apiKey: string
): Promise<DeployResult> {
  const client = new WordPressClient(siteUrl, credentials);

  try {
    // Step 1: Store API key in WordPress options
    await client.updateOption("tevero_indexnow_key", apiKey);
    log.info("Stored IndexNow key in WordPress options", { siteUrl });

    // Step 2: Check if the endpoint is working
    const keyFileUrl = `${siteUrl.replace(/\/$/, "")}/${apiKey}.txt`;
    
    try {
      const response = await fetch(keyFileUrl, {
        headers: { "User-Agent": "TeveroSEO-Verifier/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const content = (await response.text()).trim();
        if (content === apiKey) {
          return {
            success: true,
            keyStored: true,
            endpointActive: true,
          };
        }
      }
    } catch {
      // Endpoint not working yet
    }

    // Step 3: Endpoint not active - provide instructions
    const phpSnippet = generatePhpSnippet(apiKey);
    
    return {
      success: false,
      keyStored: true,
      endpointActive: false,
      error: "KEY_ENDPOINT_NOT_ACTIVE",
      instructions: `
The API key has been stored in WordPress, but the key file endpoint is not active.

Add this code to your theme's functions.php file:

${phpSnippet}

After adding the code, click "Verify" to complete setup.
      `.trim(),
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("WordPress IndexNow deployment failed", { siteUrl, error: message });
    
    return {
      success: false,
      keyStored: false,
      endpointActive: false,
      error: message,
    };
  }
}

function generatePhpSnippet(apiKey: string): string {
  return `
<?php
// IndexNow Key File Handler - Add to functions.php
add_action('init', function() {
    if (\$_SERVER['REQUEST_URI'] === '/${apiKey}.txt') {
        header('Content-Type: text/plain');
        echo '${apiKey}';
        exit;
    }
}, 1);
  `.trim();
}
```

### TeveroSEO WordPress Plugin (Future Enhancement)

For full automation, a WordPress plugin could:

1. Automatically serve the key file endpoint
2. Notify TeveroSEO on content publish/update
3. Show IndexNow status in WordPress admin

```php
<?php
/**
 * Plugin Name: TeveroSEO Connector
 * Description: Connects WordPress to TeveroSEO for instant indexing
 * Version: 1.0.0
 */

// Serve IndexNow key file
add_action('init', function() {
    $key = get_option('tevero_indexnow_key');
    if ($key && $_SERVER['REQUEST_URI'] === "/{$key}.txt") {
        header('Content-Type: text/plain');
        echo $key;
        exit;
    }
});

// Notify TeveroSEO on publish
add_action('publish_post', function($post_id) {
    $api_url = get_option('tevero_api_url');
    $api_key = get_option('tevero_api_key');
    
    if (!$api_url || !$api_key) return;
    
    wp_remote_post($api_url . '/api/indexnow/notify', [
        'headers' => ['X-API-Key' => $api_key],
        'body' => json_encode([
            'url' => get_permalink($post_id),
            'action' => 'publish'
        ])
    ]);
});
```

---

## 12. Trigger Integration Points

### AI-Writer Integration

#### Replace `_submit_to_gsc()` with IndexNow

```python
# AI-Writer/backend/services/auto_publish_executor.py

import httpx
from app.config import settings

async def _submit_to_indexnow(self, article: Article, published_url: str) -> None:
    """
    Queue published URL for IndexNow submission via open-seo-main API.
    
    This replaces the previous _submit_to_gsc() method which used
    Google Indexing API (only valid for job postings).
    """
    if not settings.OPEN_SEO_API_URL:
        logger.warning("OPEN_SEO_API_URL not configured, skipping IndexNow")
        return
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{settings.OPEN_SEO_API_URL}/api/indexnow/queue",
                json={
                    "clientId": str(article.client_id),
                    "url": published_url,
                    "triggerType": "publish",
                },
                headers={
                    "X-Internal-Key": settings.INTERNAL_API_KEY,
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            logger.info(f"Queued URL for IndexNow: {published_url}")
            
    except httpx.HTTPStatusError as e:
        # Non-blocking - don't fail publish if IndexNow queue fails
        logger.warning(f"Failed to queue IndexNow (HTTP {e.response.status_code}): {e}")
    except Exception as e:
        logger.warning(f"Failed to queue IndexNow: {e}")


# In the publish flow, replace:
# await self._submit_to_gsc(article, published_url)
# With:
await self._submit_to_indexnow(article, published_url)
```

#### Content Update Hook

```python
# AI-Writer/backend/services/article_service.py

async def update_article(self, article_id: str, updates: ArticleUpdate) -> Article:
    """Update an article and optionally queue for re-indexing."""
    
    article = await self.get_article(article_id)
    
    # Apply updates...
    updated_article = await self._apply_updates(article, updates)
    
    # If published and significant update, queue for re-indexing
    if updated_article.status == "published" and updates.is_significant:
        await self._submit_to_indexnow(
            updated_article, 
            updated_article.published_url,
            trigger_type="update"
        )
    
    return updated_article
```

### open-seo-main Integration

#### API Endpoint for Queueing

```typescript
// open-seo-main/src/routes/api/indexnow/queue.ts

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { indexNowService } from "@/server/features/indexing/services/IndexNowService";
import { verifyInternalKey } from "@/server/middleware/internal-auth";

const QueueRequestSchema = z.object({
  clientId: z.string().uuid(),
  url: z.string().url(),
  triggerType: z.enum(["publish", "update", "seo_fix", "manual", "bulk"]),
});

export const Route = createAPIFileRoute("/api/indexnow/queue")({
  POST: async ({ request }) => {
    // Verify internal API key
    const authResult = await verifyInternalKey(request);
    if (!authResult.valid) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const parsed = QueueRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clientId, url, triggerType } = parsed.data;

    try {
      await indexNowService.queueUrl(clientId, url, triggerType);
      return json({ success: true, queued: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return json({ error: message }, { status: 500 });
    }
  },
});
```

#### SEO Fix Trigger

```typescript
// open-seo-main/src/server/features/audit/services/SeoFixService.ts

import { indexNowService } from "@/server/features/indexing/services/IndexNowService";

export class SeoFixService {
  async applyFix(siteId: string, pageUrl: string, fix: SeoFix): Promise<void> {
    // Apply the SEO fix...
    await this.executeFix(fix);
    
    // Queue for re-indexing
    const site = await this.getSite(siteId);
    if (site.clientId) {
      await indexNowService.queueUrl(site.clientId, pageUrl, "seo_fix");
    }
  }
}
```

#### Manual Submission Endpoint

```typescript
// open-seo-main/src/routes/api/indexnow/submit.ts

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { indexNowService } from "@/server/features/indexing/services/IndexNowService";
import { requireAuth } from "@/server/middleware/auth";

const SubmitRequestSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(1000),
});

export const Route = createAPIFileRoute("/api/indexnow/submit")({
  POST: async ({ request }) => {
    const { user, clientId } = await requireAuth(request);

    const body = await request.json();
    const parsed = SubmitRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    const { urls } = parsed.data;

    try {
      await indexNowService.queueUrls(clientId, urls, "manual");
      return json({ 
        success: true, 
        queued: urls.length,
        message: `${urls.length} URLs queued for IndexNow submission`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return json({ error: message }, { status: 500 });
    }
  },
});
```

---

## 13. Sitemap Management

### Why Sitemap lastmod Matters

While IndexNow notifies Bing/Yandex/Naver/Seznam instantly, **Google has not adopted IndexNow**. For Google, the primary signal for content freshness is the `lastmod` date in XML sitemaps.

### lastmod Update Strategy

```typescript
// open-seo-main/src/server/features/sitemap/SitemapService.ts

export class SitemapService {
  /**
   * Update lastmod for a URL in the sitemap.
   * Should be called whenever content is modified.
   */
  async updateLastmod(siteId: string, pageUrl: string): Promise<void> {
    const now = new Date().toISOString();
    
    await db
      .update(sitemapUrls)
      .set({ lastmod: now, updatedAt: now })
      .where(
        and(
          eq(sitemapUrls.siteId, siteId),
          eq(sitemapUrls.url, pageUrl)
        )
      );
  }

  /**
   * Regenerate sitemap XML with accurate lastmod dates.
   */
  async generateSitemapXml(siteId: string): Promise<string> {
    const urls = await db.query.sitemapUrls.findMany({
      where: eq(sitemapUrls.siteId, siteId),
      orderBy: [desc(sitemapUrls.lastmod)],
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.url)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq || 'weekly'}</changefreq>
    <priority>${url.priority || '0.5'}</priority>
  </url>`).join('\n')}
</urlset>`;

    return xml;
  }
}
```

### Integration with IndexNow Triggers

When a URL is queued for IndexNow, also update its sitemap lastmod:

```typescript
// In IndexNowService.queueUrl()

async queueUrl(clientId: string, url: string, triggerType: TriggerType): Promise<void> {
  // ... existing queue logic ...

  // Also update sitemap lastmod (for Google)
  const site = await this.getSiteForClient(clientId, domain);
  if (site) {
    await sitemapService.updateLastmod(site.id, url);
  }
}
```

### GSC Sitemap Ping (Deprecated but Useful)

While Google deprecated the sitemap ping endpoint in 2023, submitting sitemaps via GSC API still works:

```typescript
// Notify GSC about sitemap update (via existing GSC OAuth)
async function notifyGscSitemapUpdate(siteId: string): Promise<void> {
  const gscService = new GoogleSearchConsoleService();
  const site = await getSite(siteId);
  
  if (site.gscConnected) {
    await gscService.submitSitemap(
      site.gscPropertyUrl,
      `${site.url}/sitemap.xml`
    );
  }
}
```

---

## 14. Dashboard & Monitoring

### IndexNow Status Card

```tsx
// apps/web/src/features/indexing/components/IndexNowStatusCard.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIndexNowConfig, useIndexNowStats } from "../hooks";

interface IndexNowStatusCardProps {
  clientId: string;
}

export function IndexNowStatusCard({ clientId }: IndexNowStatusCardProps) {
  const { data: config, isLoading: configLoading } = useIndexNowConfig(clientId);
  const { data: stats } = useIndexNowStats(clientId);

  if (configLoading) {
    return <Card><CardContent>Loading...</CardContent></Card>;
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>IndexNow</CardTitle>
          <CardDescription>Instant search engine notification</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            IndexNow is not configured for this client.
          </p>
          <Button>Set Up IndexNow</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>IndexNow</CardTitle>
            <CardDescription>Instant notification to Bing, Yandex, Naver</CardDescription>
          </div>
          <Badge variant={config.enabled ? "success" : "secondary"}>
            {config.enabled ? "Active" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Domain Verification Status */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Domains</h4>
          <div className="space-y-2">
            {config.domains.map((domain) => (
              <div key={domain} className="flex items-center justify-between">
                <span className="text-sm">{domain}</span>
                <Badge 
                  variant={
                    config.verificationStatus[domain] === "verified" 
                      ? "success" 
                      : "warning"
                  }
                >
                  {config.verificationStatus[domain] || "pending"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-2xl font-bold">{stats?.today || 0}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.thisWeek || 0}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
            <p className="text-xs text-muted-foreground">All Time</p>
          </div>
        </div>

        {/* Last Error */}
        {config.lastError && (
          <div className="p-3 bg-destructive/10 rounded-md mb-4">
            <p className="text-sm text-destructive">{config.lastError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm">View History</Button>
          <Button variant="outline" size="sm">Manual Submit</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Submission History View

```tsx
// apps/web/src/features/indexing/components/IndexNowSubmissionHistory.tsx

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useIndexNowSubmissions } from "../hooks";

export function IndexNowSubmissionHistory({ clientId }: { clientId: string }) {
  const { data: submissions, isLoading } = useIndexNowSubmissions(clientId);

  const columns = [
    {
      header: "Time",
      accessorKey: "submittedAt",
      cell: ({ row }) => formatDistanceToNow(new Date(row.original.submittedAt), { addSuffix: true }),
    },
    {
      header: "Domain",
      accessorKey: "domain",
    },
    {
      header: "URLs",
      accessorKey: "urlCount",
    },
    {
      header: "Trigger",
      accessorKey: "triggerType",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.triggerType}</Badge>
      ),
    },
    {
      header: "Status",
      accessorKey: "success",
      cell: ({ row }) => (
        <Badge variant={row.original.success ? "success" : "destructive"}>
          {row.original.success ? "Success" : "Failed"}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={submissions || []}
      isLoading={isLoading}
    />
  );
}
```

### Monitoring Metrics

Track these metrics for operational visibility:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `indexnow_submissions_total` | Total submissions (counter) | N/A |
| `indexnow_submissions_success` | Successful submissions (counter) | N/A |
| `indexnow_submissions_failed` | Failed submissions (counter) | > 10/hour |
| `indexnow_submission_latency_ms` | HTTP request latency (histogram) | p99 > 30s |
| `indexnow_queue_size` | Pending URLs in Redis (gauge) | > 10,000 |
| `indexnow_batch_size` | URLs per submission (histogram) | N/A |

---

## 15. Security Considerations

### API Key Storage

- API keys encrypted with AES-256-GCM before storage
- Encryption key from environment variable (`PAYMENT_ENCRYPTION_KEY`)
- Keys never logged or exposed in error messages
- Keys never sent to frontend

### Internal API Authentication

```typescript
// Verify internal API key for cross-service calls
async function verifyInternalKey(request: Request): Promise<{ valid: boolean }> {
  const key = request.headers.get("X-Internal-Key");
  
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return { valid: false };
  }
  
  return { valid: true };
}
```

### Key File Security

The IndexNow key file at `/{api-key}.txt` should:
- Return `X-Robots-Tag: noindex` header
- Use a random UUID (not guessable)
- Be served with appropriate caching

### Rate Limiting

Even though IndexNow has no official limits, implement rate limiting to:
- Prevent abuse by compromised accounts
- Ensure fair resource distribution
- Protect against runaway processes

---

## 16. Implementation Plan

### Phase 97: IndexNow Multi-Tenant Indexing System

**Total Duration:** ~9 days

#### 97-01: Core Infrastructure (2 days)

| Task | Description | Files |
|------|-------------|-------|
| Create Drizzle schema | `indexnow_config`, `indexnow_submissions` tables | `src/db/indexnow-schema.ts` |
| Run migration | Create tables in PostgreSQL | `drizzle/migrations/` |
| Create IndexNowService | Core service class with setup, verify, queue methods | `src/server/features/indexing/services/IndexNowService.ts` |
| API key encryption | Integrate with existing AES-256-GCM encryption | Reuse `src/server/lib/encryption.ts` |

#### 97-02: BullMQ Submission Engine (1 day)

| Task | Description | Files |
|------|-------------|-------|
| Create queue definition | `indexnow-submit` queue with job types | `src/server/queues/indexnow-queue.ts` |
| Create worker | Process jobs, submit to IndexNow, log results | `src/server/workers/indexnow-worker.ts` |
| Register worker | Add to `worker-entry.ts` | `src/worker-entry.ts` |
| Dual endpoint fallback | Try api.indexnow.org, fallback to bing.com | Worker implementation |

#### 97-03: Redis Batching Layer (1 day)

| Task | Description | Files |
|------|-------------|-------|
| Implement batching | Redis SET for pending URLs, STRING for flush timer | `IndexNowService.queueUrl()` |
| Create flush scheduler | Cron job every 30 seconds | `src/server/jobs/indexnow-scheduler.ts` |
| Deduplication | Automatic via Redis SET | Built-in |
| Priority delays | 30s / 5min / 1hr based on trigger type | `IndexNowService` |

#### 97-04: WordPress Integration (2 days)

| Task | Description | Files |
|------|-------------|-------|
| WordPress deployer | Store key via REST API | `src/server/features/indexing/wordpress/` |
| Verification checker | GET key file, validate content | `IndexNowService.verifyDomain()` |
| PHP snippet generator | Generate code for functions.php | Helper function |
| Manual instructions | Fallback for non-WordPress sites | UI component |

#### 97-05: Trigger Integration (1 day)

| Task | Description | Files |
|------|-------------|-------|
| AI-Writer publish hook | Replace `_submit_to_gsc()` with IndexNow | `auto_publish_executor.py` |
| AI-Writer update hook | Queue on content update | `article_service.py` |
| SEO fix trigger | Queue on fix applied | `SeoFixService.ts` |
| Manual submission API | Endpoint for bulk submit | `src/routes/api/indexnow/submit.ts` |

#### 97-06: Sitemap lastmod Sync (1 day)

| Task | Description | Files |
|------|-------------|-------|
| lastmod update | Update on any content change | `SitemapService.ts` |
| Integration | Call from IndexNow queue | `IndexNowService` |
| GSC notification | Optional sitemap resubmit | Existing GSC service |

#### 97-07: Dashboard UI (1 day)

| Task | Description | Files |
|------|-------------|-------|
| Status card | Show config, stats, domains | `IndexNowStatusCard.tsx` |
| Submission history | DataTable of recent submissions | `IndexNowSubmissionHistory.tsx` |
| Setup wizard | Onboarding flow for new clients | `IndexNowSetupWizard.tsx` |
| Manual submit form | UI for ad-hoc URL submission | `ManualSubmitForm.tsx` |

### Dependencies

```
97-01 (Infrastructure)
  │
  ├──► 97-02 (Queue/Worker)
  │       │
  │       └──► 97-03 (Batching)
  │               │
  │               └──► 97-05 (Triggers)
  │
  ├──► 97-04 (WordPress)
  │
  └──► 97-06 (Sitemap)
          │
          └──► 97-07 (Dashboard)
```

### Environment Variables

```bash
# Required
PAYMENT_ENCRYPTION_KEY=<32-byte-base64>  # Existing, for API key encryption
INTERNAL_API_KEY=<random-string>          # For cross-service auth

# Optional
INDEXNOW_DEFAULT_DELAY_PUBLISH=30
INDEXNOW_DEFAULT_DELAY_UPDATE=300
INDEXNOW_DEFAULT_DELAY_SEO_FIX=3600
```

---

## 17. Appendix: Code Templates

### A. Complete IndexNowService

```typescript
// open-seo-main/src/server/features/indexing/services/IndexNowService.ts

import { redis } from "@/server/lib/redis";
import { db } from "@/db";
import { indexnowConfig, indexnowSubmissions } from "@/db/indexnow-schema";
import { eq, and } from "drizzle-orm";
import { decrypt, encrypt } from "@/server/lib/encryption";
import { nanoid } from "nanoid";
import { getIndexNowQueue } from "@/server/queues/indexnow-queue";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "indexnow-service" });

// Redis key helpers
const PENDING_KEY = (clientId: string, domain: string) =>
  `indexnow:pending:${clientId}:${domain}`;
const FLUSH_KEY = (clientId: string, domain: string) =>
  `indexnow:flush:${clientId}:${domain}`;

export type TriggerType = "publish" | "update" | "seo_fix" | "manual" | "bulk";
type Priority = 0 | 1 | 2;

const TRIGGER_PRIORITY: Record<TriggerType, Priority> = {
  publish: 0,
  manual: 0,
  update: 1,
  seo_fix: 2,
  bulk: 2,
};

export class IndexNowService {
  // ========================================================================
  // Setup & Configuration
  // ========================================================================

  /**
   * Initialize IndexNow for a client.
   */
  async setupClient(
    clientId: string,
    domains: string[]
  ): Promise<{
    apiKey: string;
    instructions: string;
  }> {
    const apiKey = crypto.randomUUID();
    const apiKeyEncrypted = encrypt(apiKey);

    const verificationStatus: Record<string, string> = {};
    for (const domain of domains) {
      verificationStatus[domain] = "pending";
    }

    await db
      .insert(indexnowConfig)
      .values({
        id: nanoid(),
        clientId,
        apiKeyEncrypted,
        domains,
        verificationStatus,
      })
      .onConflictDoUpdate({
        target: indexnowConfig.clientId,
        set: {
          apiKeyEncrypted,
          domains,
          verificationStatus,
          updatedAt: new Date(),
        },
      });

    log.info("IndexNow setup complete", { clientId, domains });

    return {
      apiKey,
      instructions: this.generateInstructions(apiKey, domains),
    };
  }

  /**
   * Get client's IndexNow configuration.
   */
  async getConfig(clientId: string) {
    return db.query.indexnowConfig.findFirst({
      where: eq(indexnowConfig.clientId, clientId),
    });
  }

  /**
   * Verify domain has key file accessible.
   */
  async verifyDomain(
    clientId: string,
    domain: string
  ): Promise<{ verified: boolean; error?: string }> {
    const config = await this.getConfig(clientId);
    if (!config) {
      return { verified: false, error: "IndexNow not configured" };
    }

    const apiKey = decrypt(config.apiKeyEncrypted);
    const keyFileUrl = `https://${domain}/${apiKey}.txt`;

    try {
      const response = await fetch(keyFileUrl, {
        headers: { "User-Agent": "TeveroSEO-IndexNow-Verifier/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { verified: false, error: `HTTP ${response.status}` };
      }

      const content = (await response.text()).trim();
      if (content !== apiKey) {
        return { verified: false, error: "Key file content mismatch" };
      }

      // Update verification status
      const newStatus = { ...config.verificationStatus, [domain]: "verified" };
      await db
        .update(indexnowConfig)
        .set({
          verificationStatus: newStatus,
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(indexnowConfig.clientId, clientId));

      log.info("Domain verified", { clientId, domain });
      return { verified: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { verified: false, error: message };
    }
  }

  // ========================================================================
  // URL Queueing
  // ========================================================================

  /**
   * Queue a single URL for IndexNow submission.
   */
  async queueUrl(
    clientId: string,
    url: string,
    triggerType: TriggerType
  ): Promise<void> {
    const config = await this.getConfig(clientId);
    if (!config?.enabled) {
      return;
    }

    // Check trigger type is enabled
    if (triggerType === "publish" && !config.autoSubmitPublish) return;
    if (triggerType === "update" && !config.autoSubmitUpdate) return;
    if (triggerType === "seo_fix" && !config.autoSubmitSeoFix) return;

    const domain = new URL(url).hostname;

    // Check domain is verified
    if (config.verificationStatus[domain] !== "verified") {
      log.warn("Domain not verified, skipping", { clientId, domain });
      return;
    }

    const pendingKey = PENDING_KEY(clientId, domain);
    const flushKey = FLUSH_KEY(clientId, domain);

    // Add to pending set
    await redis.sadd(pendingKey, url);
    await redis.expire(pendingKey, 86400);

    // Set flush timer
    const priority = TRIGGER_PRIORITY[triggerType];
    const delayMs = this.getDelayMs(config, priority);
    const flushAt = Date.now() + delayMs;

    const wasSet = await redis.setnx(flushKey, flushAt.toString());
    if (wasSet) {
      await redis.expire(flushKey, 86400);
    }

    log.debug("URL queued", { clientId, domain, url, triggerType });
  }

  /**
   * Queue multiple URLs at once.
   */
  async queueUrls(
    clientId: string,
    urls: string[],
    triggerType: TriggerType
  ): Promise<void> {
    // Group by domain
    const byDomain = new Map<string, string[]>();
    for (const url of urls) {
      try {
        const domain = new URL(url).hostname;
        if (!byDomain.has(domain)) {
          byDomain.set(domain, []);
        }
        byDomain.get(domain)!.push(url);
      } catch {
        log.warn("Invalid URL skipped", { url });
      }
    }

    // Queue each domain
    for (const [domain, domainUrls] of byDomain) {
      const pendingKey = PENDING_KEY(clientId, domain);
      const flushKey = FLUSH_KEY(clientId, domain);

      await redis.sadd(pendingKey, ...domainUrls);
      await redis.expire(pendingKey, 86400);

      const wasSet = await redis.setnx(
        flushKey,
        (Date.now() + 60000).toString()
      );
      if (wasSet) {
        await redis.expire(flushKey, 86400);
      }
    }

    log.info("Bulk URLs queued", { clientId, count: urls.length });
  }

  // ========================================================================
  // Batch Flushing
  // ========================================================================

  /**
   * Check and flush any ready batches.
   * Called by scheduler every 30 seconds.
   */
  async checkAndFlushBatches(): Promise<number> {
    const pattern = "indexnow:flush:*";
    const keys = await redis.keys(pattern);
    const now = Date.now();
    let totalFlushed = 0;

    for (const key of keys) {
      const flushAt = parseInt((await redis.get(key)) || "0", 10);

      if (flushAt <= now) {
        const parts = key.split(":");
        const clientId = parts[2];
        const domain = parts[3];

        const pendingKey = PENDING_KEY(clientId, domain);
        const urls = await redis.smembers(pendingKey);

        if (urls.length > 0) {
          await redis.del(pendingKey, key);

          // Get config for configId
          const config = await this.getConfig(clientId);
          if (!config) continue;

          // Split into batches of 10,000
          const batches = this.chunkArray(urls, 10000);
          const queue = getIndexNowQueue();

          for (const batch of batches) {
            await queue.add("submit", {
              clientId,
              domain,
              urls: batch,
              triggerType: "batched",
              configId: config.id,
            });
          }

          totalFlushed += urls.length;
          log.info("Batch flushed", { clientId, domain, urlCount: urls.length });
        } else {
          await redis.del(key);
        }
      }
    }

    return totalFlushed;
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getDelayMs(
    config: { delayPublish?: number; delayUpdate?: number; delaySeoFix?: number },
    priority: Priority
  ): number {
    switch (priority) {
      case 0:
        return (config.delayPublish ?? 30) * 1000;
      case 1:
        return (config.delayUpdate ?? 300) * 1000;
      case 2:
        return (config.delaySeoFix ?? 3600) * 1000;
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private generateInstructions(apiKey: string, domains: string[]): string {
    return `
# IndexNow Setup Instructions

## Step 1: Create Key File

Create a file that returns your API key when accessed.

**File URL:** \`https://yourdomain.com/${apiKey}.txt\`
**File Content:** \`${apiKey}\`

## For WordPress

Add this code to your theme's \`functions.php\`:

\`\`\`php
add_action('init', function() {
    if (\$_SERVER['REQUEST_URI'] === '/${apiKey}.txt') {
        header('Content-Type: text/plain');
        echo '${apiKey}';
        exit;
    }
}, 1);
\`\`\`

## For Other Platforms

Upload a text file named \`${apiKey}.txt\` to your site's root directory.
The file should contain only: \`${apiKey}\`

## Step 2: Verify

After setup, verify each domain:
${domains.map((d) => `- https://${d}/${apiKey}.txt`).join("\n")}

Click "Verify" in the TeveroSEO dashboard to complete setup.
    `.trim();
  }
}

// Singleton export
export const indexNowService = new IndexNowService();
```

### B. API Endpoints

```typescript
// open-seo-main/src/routes/api/indexnow/setup.ts

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { indexNowService } from "@/server/features/indexing/services/IndexNowService";
import { requireAuth } from "@/server/middleware/auth";

const SetupSchema = z.object({
  domains: z.array(z.string()).min(1),
});

export const Route = createAPIFileRoute("/api/indexnow/setup")({
  POST: async ({ request }) => {
    const { clientId } = await requireAuth(request);

    const body = await request.json();
    const parsed = SetupSchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await indexNowService.setupClient(clientId, parsed.data.domains);

    return json({
      success: true,
      apiKey: result.apiKey,
      instructions: result.instructions,
    });
  },
});
```

```typescript
// open-seo-main/src/routes/api/indexnow/verify.ts

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { z } from "zod";
import { indexNowService } from "@/server/features/indexing/services/IndexNowService";
import { requireAuth } from "@/server/middleware/auth";

const VerifySchema = z.object({
  domain: z.string(),
});

export const Route = createAPIFileRoute("/api/indexnow/verify")({
  POST: async ({ request }) => {
    const { clientId } = await requireAuth(request);

    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await indexNowService.verifyDomain(clientId, parsed.data.domain);

    return json(result);
  },
});
```

```typescript
// open-seo-main/src/routes/api/indexnow/config.ts

import { json } from "@tanstack/start";
import { createAPIFileRoute } from "@tanstack/start/api";
import { indexNowService } from "@/server/features/indexing/services/IndexNowService";
import { requireAuth } from "@/server/middleware/auth";

export const Route = createAPIFileRoute("/api/indexnow/config")({
  GET: async ({ request }) => {
    const { clientId } = await requireAuth(request);

    const config = await indexNowService.getConfig(clientId);

    if (!config) {
      return json({ configured: false });
    }

    // Don't expose encrypted API key
    return json({
      configured: true,
      enabled: config.enabled,
      domains: config.domains,
      verificationStatus: config.verificationStatus,
      autoSubmitPublish: config.autoSubmitPublish,
      autoSubmitUpdate: config.autoSubmitUpdate,
      autoSubmitSeoFix: config.autoSubmitSeoFix,
      totalUrlsSubmitted: config.totalUrlsSubmitted,
      urlsSubmittedToday: config.urlsSubmittedToday,
      lastSubmissionAt: config.lastSubmissionAt,
      lastError: config.lastError,
    });
  },
});
```

---

## Summary

This document provides a complete specification for Phase 97: IndexNow Multi-Tenant Indexing System. Key takeaways:

1. **Do NOT use Google Indexing API** — It's restricted to job postings and harms regular content SEO
2. **IndexNow is free and unlimited** — Perfect for multi-tenant deployment
3. **Batching with priorities** — Publish (30s), Update (5min), SEO Fix (1hr)
4. **WordPress integration** — Semi-automated key deployment
5. **Comprehensive monitoring** — Submission history, stats, error tracking

**Estimated implementation time:** 9 days

**Cost:** $0 (IndexNow is free)

**Coverage:** Bing, Yandex, Naver, Seznam (instant) + Google (via sitemap lastmod)
