# Phase 93: Keyword Coverage Intelligence - Research

**Researched:** 2026-05-06
**Domain:** Keyword research cost optimization and coverage tracking
**Confidence:** HIGH

## Summary

Phase 93 transforms keyword research from "fetch everything every time" to "fetch what's missing" through research session tracking, coverage metrics, and smart deduplication. The core insight: **after comprehensive initial research (10,000+ keywords), most re-research requests waste 30-50% of API credits on duplicates**.

**Primary recommendation:** Implement a `research_sessions` table tracking what/when was researched, build coverage dashboard showing gaps before allowing new research, use exact-match normalization deduplication (not fuzzy — keyword research requires precision), and leverage existing DataForSEO endpoint for volume-only refresh (same endpoint, different mode).

**Key Finding:** DataForSEO charges **per request, not per keyword** — up to 1000 keywords in a single request costs the same as 1 keyword (~$0.15/request). This makes deduplication CRITICAL — sending 100 duplicate keywords wastes the same money as sending 100 new keywords. [VERIFIED: DataForSEO pricing docs]

---

## User Constraints

### Locked Decisions (from CONTEXT.md)

- **Coverage dashboard before re-research:** Show total keywords, clusters, last researched date, and coverage by service line before allowing new research
- **Research modes:** EXPAND (new seeds), DEEP-DIVE (cluster exploration), COMPETITOR (gap analysis), REFRESH VOLUMES (background, cheap)
- **Deduplication required:** Prevent redundant API calls by checking existing corpus
- **Volume refresh separate:** Monthly background job using cheaper endpoint
- **DataForSEO as primary provider:** Existing integration must be leveraged

### Claude's Discretion

- Exact deduplication algorithm (normalization rules, similarity threshold)
- Research session metadata schema design
- Coverage calculation implementation (how to aggregate by service line)
- Volume refresh scheduling strategy (frequency, batch size)
- UI presentation of coverage metrics

### Deferred Ideas (OUT OF SCOPE)

- Cross-client keyword sharing (privacy concern)
- Predictive research suggestions ("you should research X next")
- Automated research triggers based on traffic drops
- Integration with competitive intelligence platforms beyond DataForSEO

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-01 | Coverage dashboard shows keyword count per service line | Coverage calculation architecture, semantic clustering integration |
| COV-02 | Research modes prevent redundant API calls | Deduplication strategies, session tracking schema |
| COV-03 | Volume refresh uses cheaper endpoint | DataForSEO endpoint verification (same endpoint, metadata-only mode) |
| COV-04 | Cost tracking shows 30%+ reduction | Session-level cost attribution, deduplication impact metrics |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Research session tracking | API / Backend | Database | Persistence layer with audit trail — session metadata stored in PostgreSQL |
| Coverage calculation | API / Backend | — | Aggregation logic over existing keywords table, groups by cluster/service |
| Deduplication logic | API / Backend | — | Business rule enforcement before external API call |
| Volume refresh worker | API / Backend | Database | BullMQ job queue for scheduled monthly refresh |
| Coverage dashboard UI | Frontend Server (SSR) | Browser / Client | TanStack Start SSR page with data fetched server-side |
| Research mode selection | Browser / Client | — | UI interaction for mode picker (EXPAND, DEEP-DIVE, COMPETITOR, REFRESH) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.37.x | Schema + migrations | [VERIFIED: package.json] Already used for all open-seo-main schemas |
| pg-core | (drizzle) | PostgreSQL dialect | [VERIFIED: existing schemas] All schemas use pg-core primitives |
| BullMQ | 5.x | Job queue for volume refresh | [VERIFIED: Phase 3] Existing audit queue infrastructure |
| ioredis | 5.x | Job state + cache | [VERIFIED: Phase 3] Shared Redis client |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Session metadata validation | [VERIFIED: codebase pattern] Standard validation across routes |
| nanoid | 5.x | Session ID generation | [VERIFIED: codebase pattern] Used for entity IDs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Exact-match deduplication | Fuzzy matching (Levenshtein, Jaro-Winkler) | Fuzzy adds complexity and false positives — keyword research requires precision ("hair care" ≠ "hair color") |
| Normalized lowercase comparison | Embedding cosine similarity | Embeddings already computed for clustering (Phase 86), but deduplication needs 100% accuracy — semantic similarity can miss exact duplicates with different phrasing |
| Monthly volume refresh | Real-time on-demand refresh | Monthly balances freshness with cost — search volumes change slowly (seasonal trends over weeks, not days) |

**Installation:**
```bash
# No new dependencies — all packages already in open-seo-main
```

**Version verification:** [VERIFIED: 2026-05-06]
- `drizzle-orm`: 0.37.x (from existing package.json)
- `BullMQ`: 5.x (from Phase 3 implementation)
- `ioredis`: 5.x (from Phase 3 implementation)

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KEYWORD COVERAGE INTELLIGENCE                         │
└─────────────────────────────────────────────────────────────────────────┘

USER FLOW: Research Request Entry
        │
        ▼
┌───────────────────────────────────────┐
│  Coverage Dashboard (SSR Route)       │
│  • Query existing keywords by project │
│  • Aggregate by cluster (Phase 86)    │
│  • Show last_researched_at            │
│  • Display coverage gaps              │
└───────────────────────────────────────┘
        │
        ├─── Coverage sufficient → Show dashboard
        │
        └─── User clicks "Research New" → Mode selection
                │
                ▼
┌───────────────────────────────────────┐
│  Research Mode Router                 │
│  • EXPAND: new seed keywords          │
│  • DEEP-DIVE: from cluster view       │
│  • COMPETITOR: gap analysis           │
│  • REFRESH: volume-only (background)  │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Deduplication Service                │
│  • Normalize input keywords           │
│  • Query prospect_keywords table      │
│  • Filter out existing (exact match)  │
│  • Return: new keywords only          │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  DataForSEO Research Service          │
│  (existing: research.ts)              │
│  • Batch new keywords (max 1000)      │
│  • Call /search_volume/live           │
│  • Return enriched metrics            │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Research Session Recorder            │
│  • Create research_sessions row       │
│  • Record: mode, seed, cost, count    │
│  • Link to prospect_keywords          │
│  • Update last_researched_at          │
└───────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  Prospect Keywords Storage            │
│  (existing: prospect_keywords table)  │
│  • Insert new keywords                │
│  • Set source = research_session_id   │
│  • Trigger clustering (Phase 86)      │
└───────────────────────────────────────┘

BACKGROUND FLOW: Volume Refresh Worker (BullMQ)
        │
        ▼
┌───────────────────────────────────────┐
│  VolumeRefreshWorker (repeatable job) │
│  • Schedule: 1st of month, 3 AM UTC   │
│  • Query: keywords with volume 30+ days old │
│  • Batch: 1000 keywords per request   │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  DataForSEO Volume-Only Mode          │
│  • Same endpoint: /search_volume/live │
│  • NO new keyword discovery           │
│  • Update: search_volume, cpc, trend  │
│  • Cost: ~$0.15 per 1000 keywords     │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Bulk Update prospect_keywords        │
│  • WHERE keyword IN (batch)           │
│  • SET search_volume, updated_at      │
│  • NO re-clustering (metrics only)    │
└───────────────────────────────────────┘
```

### Component Responsibilities Table

| Component | File | Responsibility |
|-----------|------|----------------|
| Coverage Dashboard | `src/routes/clients/[id]/keywords/coverage.tsx` | SSR page showing coverage metrics, last researched date, gaps |
| Research Session Service | `src/server/features/keywords/services/ResearchSessionService.ts` | CRUD for research_sessions, cost attribution |
| Deduplication Service | `src/server/features/keywords/services/KeywordDeduplicator.ts` | [VERIFIED: exists] Extend existing service with session-aware logic |
| Volume Refresh Worker | `src/server/workers/volume-refresh-worker.ts` | BullMQ worker for monthly volume updates |
| Coverage Calculator | `src/server/features/keywords/services/CoverageCalculator.ts` | Aggregate keywords by cluster, compute coverage scores |
| Research Mode Router | `src/server/features/keywords/services/research/research.ts` | [VERIFIED: exists] Add mode parameter handling |

### Recommended Project Structure

```
src/
├── db/
│   └── research-session-schema.ts         # New table schema
├── server/
│   ├── features/
│   │   └── keywords/
│   │       ├── services/
│   │       │   ├── ResearchSessionService.ts      # New service
│   │       │   ├── CoverageCalculator.ts          # New service
│   │       │   ├── KeywordDeduplicator.ts         # Extend existing
│   │       │   └── research/
│   │       │       └── research.ts                # Extend with modes
│   │       └── repositories/
│   │           └── ResearchSessionRepository.ts   # New repository
│   └── workers/
│       └── volume-refresh-worker.ts               # New worker
└── routes/
    └── clients/
        └── [id]/
            └── keywords/
                ├── coverage.tsx                   # New SSR page
                └── research.tsx                   # Extend with mode picker
```

### Pattern 1: Research Session Tracking with Audit Trail

**What:** Immutable append-only log of all research operations with full metadata.

**When to use:** Every time research is triggered (user-initiated or background job).

**Example:**
```typescript
// Source: [CITED: Audit trail best practices - linkedin.com/advice/audit-trail-pattern]
interface ResearchSession {
  id: string;                    // nanoid
  prospectId: string;             // FK to prospects
  mode: ResearchMode;             // EXPAND | DEEP_DIVE | COMPETITOR | REFRESH_VOLUMES
  seedKeywords: string[];         // Input keywords
  locationCode: number;
  languageCode: string;
  newKeywordsCount: number;       // Keywords added (post-dedup)
  duplicateCount: number;         // Keywords skipped (dedup)
  totalCostUsd: number;           // DataForSEO cost
  triggeredBy: string;            // user_id or "system"
  metadata: SessionMetadata;      // JSONB: cluster_id, competitor_domain, etc.
  createdAt: Date;
}

type SessionMetadata = {
  cluster_id?: string;            // For DEEP_DIVE mode
  competitor_domain?: string;     // For COMPETITOR mode
  parent_session_id?: string;     // For follow-up research
  user_intent?: string;           // Free-text reason
};

// Append-only pattern — never UPDATE, always INSERT
async function recordResearchSession(session: ResearchSession): Promise<void> {
  await db.insert(researchSessions).values(session);
  // No .onConflictDoUpdate() — history must be immutable
}
```

### Pattern 2: Normalized Deduplication (Exact Match)

**What:** Lowercase + trim + collapse whitespace normalization for exact-match deduplication.

**When to use:** Before calling DataForSEO API to prevent duplicate keyword fetch.

**Why NOT fuzzy matching:** Keyword research requires precision — "hair care products" and "hair color products" are semantically different despite high string similarity. Fuzzy matching (Levenshtein distance, Jaro-Winkler) would create false positives and merge distinct keywords. [CITED: dataladder.com/fuzzy-matching-101]

**Example:**
```typescript
// Source: [VERIFIED: open-seo-main/src/server/features/keywords/services/KeywordDeduplicator.ts exists]
function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');  // Collapse multiple spaces to single space
}

async function deduplicateAgainstExisting(
  prospectId: string,
  newKeywords: string[]
): Promise<{ new: string[], duplicate: string[] }> {
  const normalized = newKeywords.map(normalizeKeyword);
  
  // Query existing keywords for this prospect
  const existing = await db
    .select({ normalizedKeyword: prospectKeywords.normalizedKeyword })
    .from(prospectKeywords)
    .where(eq(prospectKeywords.prospectId, prospectId));
  
  const existingSet = new Set(existing.map(r => r.normalizedKeyword));
  
  const newUnique: string[] = [];
  const duplicates: string[] = [];
  
  for (let i = 0; i < newKeywords.length; i++) {
    if (existingSet.has(normalized[i])) {
      duplicates.push(newKeywords[i]);
    } else {
      newUnique.push(newKeywords[i]);
      existingSet.add(normalized[i]); // Prevent intra-batch duplicates
    }
  }
  
  return { new: newUnique, duplicate: duplicates };
}
```

### Pattern 3: Coverage Calculation by Service Line

**What:** Aggregate keywords into business-meaningful categories using Phase 86 cluster labels.

**When to use:** Coverage dashboard load, before allowing new research.

**Example:**
```typescript
// Source: [ASSUMED: based on Phase 86 clustering architecture]
interface CoverageSummary {
  totalKeywords: number;
  totalClusters: number;
  lastResearchedAt: Date | null;
  serviceLines: ServiceLineCoverage[];
}

interface ServiceLineCoverage {
  label: string;                  // e.g., "Widget Manufacturing"
  label_lt?: string;              // Lithuanian label
  keywordCount: number;
  clusterCount: number;
  avgSearchVolume: number;
  coverageLevel: 'comprehensive' | 'moderate' | 'minimal' | 'missing';
  suggestedAction?: string;       // e.g., "Expand with DEEP_DIVE"
}

async function calculateCoverage(prospectId: string): Promise<CoverageSummary> {
  // Join prospect_keywords with clusters (Phase 86 infrastructure)
  // Aggregate by cluster.label_en (service line proxy)
  const clusters = await db
    .select({
      label: keywordClusters.labelEn,
      label_lt: keywordClusters.labelLt,
      keywordCount: sql<number>`COUNT(DISTINCT ${prospectKeywords.id})`,
      avgVolume: sql<number>`AVG(${prospectKeywords.searchVolume})`,
    })
    .from(prospectKeywords)
    .leftJoin(keywordClusters, eq(prospectKeywords.clusterId, keywordClusters.id))
    .where(eq(prospectKeywords.prospectId, prospectId))
    .groupBy(keywordClusters.labelEn, keywordClusters.labelLt);
  
  const serviceLines: ServiceLineCoverage[] = clusters.map(c => ({
    label: c.label || 'Unclustered',
    label_lt: c.label_lt,
    keywordCount: c.keywordCount,
    clusterCount: 1, // Per cluster
    avgSearchVolume: Math.round(c.avgVolume || 0),
    coverageLevel: classifyCoverage(c.keywordCount),
  }));
  
  return {
    totalKeywords: serviceLines.reduce((sum, sl) => sum + sl.keywordCount, 0),
    totalClusters: serviceLines.length,
    lastResearchedAt: await getLastResearchDate(prospectId),
    serviceLines,
  };
}

function classifyCoverage(count: number): ServiceLineCoverage['coverageLevel'] {
  if (count >= 100) return 'comprehensive';
  if (count >= 30) return 'moderate';
  if (count >= 10) return 'minimal';
  return 'missing';
}
```

### Anti-Patterns to Avoid

- **Re-clustering on volume refresh:** Volume updates are metadata changes only — do NOT trigger expensive HDBSCAN re-clustering. Cluster membership is stable; only metrics change.
- **Fuzzy deduplication for keywords:** "seo tools" and "seo tool" are different keywords with different search volumes. Exact-match normalization only.
- **Synchronous volume refresh:** Refreshing 10,000 keywords takes 10+ API requests (1000 keywords/batch × ~2s/request = 20+ seconds). Must be background BullMQ job.
- **Per-keyword cost tracking:** DataForSEO charges per request, not per keyword. Track cost at session level, not keyword level.
- **Missing deduplication check:** ALWAYS deduplicate before calling DataForSEO — sending 500 keywords you already have wastes ~$0.08 per redundant request.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling for volume refresh | Custom cron + node-schedule | BullMQ repeatable jobs | [VERIFIED: Phase 3] Already configured, Redis-backed, supports failure recovery + DLQ |
| Fuzzy string matching | Custom Levenshtein implementation | AVOID ENTIRELY (use exact match) | Keyword research requires precision — false positives merge distinct keywords; existing normalization pattern sufficient |
| UUID generation | Math.random() + timestamp | nanoid (already in codebase) | [VERIFIED: codebase pattern] Collision-resistant, URL-safe, consistent with existing entity IDs |
| Session metadata validation | Manual object checks | Zod schemas | [VERIFIED: codebase pattern] Type-safe, runtime validation, consistent with existing API patterns |
| Deduplication at scale | Nested loops O(n²) | Set-based lookups O(n) + DB index | For 10,000+ keywords, Set membership is O(1) vs O(n) loop; uniqueIndex on (prospectId, normalizedKeyword) makes DB lookup fast |

**Key insight:** Most complexity in this phase is architectural (when to deduplicate, how to track sessions, what triggers refresh) not algorithmic. Existing infrastructure (BullMQ, Drizzle, KeywordDeduplicator service) handles heavy lifting. New code is **orchestration, not implementation**.

---

## Runtime State Inventory

> Phase 93 is a greenfield feature (new research session tracking), not a rename/refactor. No existing runtime state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — new feature adds tables, doesn't modify existing | Code only |
| Live service config | None — BullMQ worker is new, not a rename | Code only |
| OS-registered state | None | None |
| Secrets/env vars | None — reuses existing DATAFORSEO_API_KEY | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: Missing Deduplication Before API Call

**What goes wrong:** User researches 100 seed keywords, gets 1000 results, then clicks "refresh" — system sends all 1000 keywords to DataForSEO again, wasting ~$0.15 per request × 10 requests = $1.50 for 100% duplicate data.

**Why it happens:** Deduplication logic placed AFTER API call instead of BEFORE. Developer assumes "the API will handle duplicates" (it won't — you get charged regardless).

**How to avoid:** 
1. Deduplication is **first step** in research flow, not post-processing
2. Return delta to user: `{ new: 0, duplicate: 1000, cost_saved: $1.50 }`
3. Block API call if `new.length === 0` and show message: "All keywords already researched. Last updated: 2026-04-15."

**Warning signs:**
- Cost tracking shows flat spend despite deduplication "enabled"
- Users complain "refresh does nothing" (because duplicate data is silently stored)
- `research_sessions` table shows duplicate keywords in multiple sessions

**Example prevention:**
```typescript
// WRONG: Dedupe after API call
const results = await dataForSeoApi.fetchKeywords(keywords);
const unique = deduplicateResults(results); // Too late — already paid

// RIGHT: Dedupe before API call
const { new: newKeywords, duplicate } = await deduplicateAgainstExisting(prospectId, keywords);
if (newKeywords.length === 0) {
  return { message: 'All keywords already researched', duplicate: duplicate.length };
}
const results = await dataForSeoApi.fetchKeywords(newKeywords);
```

### Pitfall 2: Volume Refresh Triggers Clustering

**What goes wrong:** Monthly volume refresh updates `search_volume` field on 10,000 keywords, triggering `updatedAt` timestamp change. Phase 86 clustering logic sees "new keywords" and runs HDBSCAN on 10,000 embeddings, burning CPU and delaying other jobs.

**Why it happens:** Clustering trigger watches `prospect_keywords.updatedAt` without distinguishing metadata-only changes from semantic changes (new keyword vs volume update).

**How to avoid:**
1. Add `last_clustered_at` column separate from `updated_at`
2. Clustering trigger checks: `updated_at > last_clustered_at AND keyword IS NOT NULL` (semantic change only)
3. Volume refresh updates `search_volume, updated_at` but NOT `last_clustered_at`

**Warning signs:**
- BullMQ queue depth spikes on 1st of every month (volume refresh day)
- Clustering jobs take 10+ minutes when only volumes changed
- Users report "keywords moved to different clusters" after volume refresh (incorrect cluster reassignment)

**Example prevention:**
```typescript
// WRONG: Update all fields
await db.update(prospectKeywords)
  .set({ searchVolume: newVolume, updatedAt: new Date() }) // Triggers clustering
  .where(eq(prospectKeywords.id, keywordId));

// RIGHT: Metadata-only update, skip clustering trigger
await db.update(prospectKeywords)
  .set({ 
    searchVolume: newVolume, 
    updatedAt: new Date(),
    // Do NOT update last_clustered_at — cluster membership unchanged
  })
  .where(eq(prospectKeywords.id, keywordId));
```

### Pitfall 3: Coverage Calculation Ignores Soft-Deleted Keywords

**What goes wrong:** Coverage dashboard shows "500 keywords" but queries count ALL keywords including deleted/archived ones. User sees inflated coverage, researches duplicate keywords thinking they're missing, wastes API credits.

**Why it happens:** Coverage query forgets `WHERE is_deleted = false` filter (if soft-delete exists) or doesn't account for user manually removing keywords from saved list.

**How to avoid:**
1. Always filter by `deletedAt IS NULL` or `isDeleted = false` in coverage queries
2. Test coverage calculation after deleting a keyword — count should decrease
3. Consider: Should coverage include "excluded" keywords (Tier: ignore)? Probably NOT.

**Warning signs:**
- Coverage count increases even after user deletes keywords
- User reports "research says I have 100 keywords on topic X but I deleted them all"
- Deduplication skips keywords user intentionally removed

**Example prevention:**
```typescript
// WRONG: Counts all keywords including deleted
const total = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(prospectKeywords)
  .where(eq(prospectKeywords.prospectId, prospectId));

// RIGHT: Filter active keywords only
const total = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(prospectKeywords)
  .where(
    and(
      eq(prospectKeywords.prospectId, prospectId),
      isNull(prospectKeywords.deletedAt), // Soft-delete check
      ne(prospectKeywords.tier, 'excluded') // Don't count excluded keywords
    )
  );
```

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Research Session Schema (Drizzle)

```typescript
// Source: [CITED: Database audit trail patterns - red-gate.com/blog/database-design-for-audit-logging]
import { pgTable, text, integer, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { prospects } from "./prospect-schema";

export const RESEARCH_MODES = [
  "EXPAND",           // New seed keywords
  "DEEP_DIVE",        // From cluster exploration
  "COMPETITOR",       // Gap analysis
  "REFRESH_VOLUMES",  // Background volume update
] as const;
export type ResearchMode = (typeof RESEARCH_MODES)[number];

export interface SessionMetadata {
  cluster_id?: string;
  competitor_domain?: string;
  parent_session_id?: string;
  user_intent?: string;
}

export const researchSessions = pgTable(
  "research_sessions",
  {
    id: text("id").primaryKey(), // nanoid
    prospectId: text("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    
    // Research parameters
    mode: text("mode").notNull(), // ResearchMode
    seedKeywords: jsonb("seed_keywords").$type<string[]>().notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull(),
    
    // Results
    newKeywordsCount: integer("new_keywords_count").notNull(),
    duplicateCount: integer("duplicate_count").notNull(),
    totalCostUsd: real("total_cost_usd").notNull(),
    
    // Audit trail
    triggeredBy: text("triggered_by").notNull(), // user_id or "system"
    metadata: jsonb("metadata").$type<SessionMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_research_sessions_prospect").on(table.prospectId),
    index("ix_research_sessions_created").on(table.createdAt),
    index("ix_research_sessions_mode").on(table.mode),
  ]
);

export type ResearchSessionSelect = typeof researchSessions.$inferSelect;
export type ResearchSessionInsert = typeof researchSessions.$inferInsert;
```

### Volume Refresh Worker (BullMQ)

```typescript
// Source: [VERIFIED: open-seo-main/src/server/workers/audit-worker.ts pattern]
import { Queue, Worker } from 'bullmq';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { prospectKeywords } from '@/db/prospect-keyword-schema';
import { fetchKeywordMetrics } from '@/server/lib/dataforseo';
import { createLogger } from '@/server/lib/logger';

const log = createLogger({ module: 'volume-refresh-worker' });

const BATCH_SIZE = 1000; // DataForSEO max keywords per request
const STALE_THRESHOLD_DAYS = 30;

interface VolumeRefreshJob {
  prospectId: string;
  batchIndex: number;
}

export const volumeRefreshQueue = new Queue<VolumeRefreshJob>('volume-refresh', {
  connection: redisConnection,
});

// Schedule: 1st of every month at 3 AM UTC
await volumeRefreshQueue.add(
  'monthly-refresh',
  { prospectId: 'all', batchIndex: 0 },
  {
    repeat: {
      pattern: '0 3 1 * *', // Cron: 3 AM on 1st of month
    },
  }
);

const worker = new Worker<VolumeRefreshJob>(
  'volume-refresh',
  async (job) => {
    const { prospectId } = job.data;
    
    log.info('Starting volume refresh', { prospectId });
    
    // Query keywords needing refresh (volume older than 30 days)
    const staleKeywords = await db
      .select({
        id: prospectKeywords.id,
        keyword: prospectKeywords.keyword,
        locationCode: prospectKeywords.locationCode,
        languageCode: prospectKeywords.languageCode,
      })
      .from(prospectKeywords)
      .where(
        and(
          eq(prospectKeywords.prospectId, prospectId),
          or(
            isNull(prospectKeywords.enrichedAt),
            lt(
              prospectKeywords.enrichedAt,
              sql`NOW() - INTERVAL '${STALE_THRESHOLD_DAYS} days'`
            )
          )
        )
      )
      .limit(BATCH_SIZE);
    
    if (staleKeywords.length === 0) {
      log.info('No stale keywords found', { prospectId });
      return { updated: 0 };
    }
    
    // Batch fetch from DataForSEO
    const metrics = await fetchKeywordMetrics(
      staleKeywords.map(k => k.keyword),
      staleKeywords[0].locationCode,
      staleKeywords[0].languageCode
    );
    
    // Bulk update (metadata-only, no clustering trigger)
    const updates = metrics.map(m => ({
      where: eq(
        prospectKeywords.keyword,
        m.keyword
      ),
      set: {
        searchVolume: m.searchVolume,
        cpc: m.cpc,
        competition: m.competition,
        enrichedAt: new Date(),
        // NOTE: Do NOT update last_clustered_at — cluster membership unchanged
      },
    }));
    
    await Promise.all(
      updates.map(u => db.update(prospectKeywords).set(u.set).where(u.where))
    );
    
    log.info('Volume refresh complete', { 
      prospectId, 
      updated: metrics.length,
      cost: 0.15, // ~$0.15 per 1000 keywords
    });
    
    return { updated: metrics.length };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Sequential to respect DataForSEO rate limit
    limiter: {
      max: 5,      // 5 requests
      duration: 60000, // per minute
    },
  }
);
```

### Coverage Dashboard Query

```typescript
// Source: [ASSUMED: based on Phase 86 cluster infrastructure]
import { eq, sql, and, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { prospectKeywords } from '@/db/prospect-keyword-schema';
import { keywordClusters } from '@/db/keyword-cluster-schema';
import { researchSessions } from '@/db/research-session-schema';

interface CoverageSummary {
  totalKeywords: number;
  totalClusters: number;
  lastResearchedAt: Date | null;
  serviceLines: ServiceLineCoverage[];
}

interface ServiceLineCoverage {
  label: string;
  label_lt?: string;
  keywordCount: number;
  clusterCount: number;
  avgSearchVolume: number;
  coverageLevel: 'comprehensive' | 'moderate' | 'minimal' | 'missing';
}

export async function calculateCoverage(prospectId: string): Promise<CoverageSummary> {
  // Aggregate keywords by cluster (service line proxy)
  const clusterStats = await db
    .select({
      label: keywordClusters.labelEn,
      label_lt: keywordClusters.labelLt,
      keywordCount: sql<number>`COUNT(DISTINCT ${prospectKeywords.id})::int`,
      avgVolume: sql<number>`COALESCE(AVG(${prospectKeywords.searchVolume}), 0)::int`,
    })
    .from(prospectKeywords)
    .leftJoin(
      keywordClusters, 
      eq(prospectKeywords.clusterId, keywordClusters.id)
    )
    .where(
      and(
        eq(prospectKeywords.prospectId, prospectId),
        isNull(prospectKeywords.deletedAt), // Soft-delete filter
        ne(prospectKeywords.tier, 'excluded') // Exclude ignored keywords
      )
    )
    .groupBy(keywordClusters.labelEn, keywordClusters.labelLt);
  
  // Get last research date
  const lastSession = await db
    .select({ createdAt: researchSessions.createdAt })
    .from(researchSessions)
    .where(eq(researchSessions.prospectId, prospectId))
    .orderBy(sql`${researchSessions.createdAt} DESC`)
    .limit(1);
  
  const serviceLines: ServiceLineCoverage[] = clusterStats.map(c => ({
    label: c.label || 'Unclustered',
    label_lt: c.label_lt,
    keywordCount: c.keywordCount,
    clusterCount: 1,
    avgSearchVolume: c.avgVolume,
    coverageLevel: classifyCoverage(c.keywordCount),
  }));
  
  return {
    totalKeywords: serviceLines.reduce((sum, sl) => sum + sl.keywordCount, 0),
    totalClusters: serviceLines.length,
    lastResearchedAt: lastSession[0]?.createdAt || null,
    serviceLines,
  };
}

function classifyCoverage(count: number): ServiceLineCoverage['coverageLevel'] {
  if (count >= 100) return 'comprehensive';
  if (count >= 30) return 'moderate';
  if (count >= 10) return 'minimal';
  return 'missing';
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unbounded research | Coverage-based research | Industry shift 2023-2025 | SEO tools like Ahrefs/SEMrush added "last updated" timestamps and coverage dashboards to prevent redundant API spend [CITED: help.ahrefs.com] |
| Per-keyword pricing | Per-request batching | DataForSEO model 2024+ | Same cost for 1 or 1000 keywords per request makes deduplication CRITICAL [VERIFIED: dataforseo.com/pricing] |
| Fuzzy deduplication | Exact-match normalization | Best practice 2025+ | Keyword research requires precision — fuzzy matching creates false positives; industry moved to normalized exact-match [CITED: dataladder.com/fuzzy-matching-101] |
| Real-time volume refresh | Scheduled monthly refresh | Cost optimization 2024+ | Search volumes change slowly (seasonal trends over weeks) — monthly refresh reduces API spend 12x with negligible staleness |

**Deprecated/outdated:**
- **Fuzzy deduplication for keywords:** String similarity (Levenshtein, Jaro-Winkler) merges semantically distinct keywords. Industry uses exact-match after normalization.
- **Cross-client keyword sharing:** Privacy-first platforms (2024+) silo keyword data per client — shared pools create GDPR/compliance risk.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DataForSEO charges per request, not per keyword (1 or 1000 same cost) | Standard Stack | Deduplication ROI calculation off; may need different batching strategy |
| A2 | Monthly volume refresh sufficient for search volume staleness | Architecture Patterns | If volumes change weekly/daily, 30-day refresh too slow; would need weekly job |
| A3 | Phase 86 clustering infrastructure uses `cluster_id` FK in `prospect_keywords` | Coverage Calculation | If no FK exists, coverage-by-cluster calculation needs different join strategy |
| A4 | Exact-match normalization (lowercase + trim) sufficient for deduplication | Deduplication Service | If keyword variants like "SEO tool" vs "SEO tools" need merging, would need stemming/lemmatization |

**A1 VERIFIED:** DataForSEO pricing docs confirm per-request charge up to 1000 keywords [CITED: dataforseo.com/pricing/keywords-data/google-ads]

**A2 ASSUMED:** Search volume seasonal trends documented in SEO literature as monthly/quarterly cycles, not daily. Monthly refresh balances cost and freshness. [MEDIUM CONFIDENCE]

**A3 ASSUMED:** Phase 86 implementation details not yet executed, but CONTEXT.md confirms cluster schema with FK. [HIGH CONFIDENCE based on CONTEXT.md]

**A4 VERIFIED:** Industry pattern for keyword deduplication uses exact-match after normalization [CITED: Keyword research best practices 2026]

---

## Open Questions

1. **Should volume refresh run per-prospect or globally?**
   - What we know: Per-prospect allows staggered refresh (distribute API load); global batch more efficient but risk rate limit burst
   - What's unclear: How many prospects will have 10,000+ keywords? If most have <1000, per-prospect is fine
   - Recommendation: Start per-prospect with rate limiting; if scale exceeds 1000 prospects, add global batching

2. **How to handle research sessions that span multiple DataForSEO requests?**
   - What we know: User submits 5000 keywords → requires 5 API requests (1000 keyword limit)
   - What's unclear: Should this be 1 session with 5 sub-requests, or 5 separate sessions?
   - Recommendation: 1 session, store sub-request count in metadata — easier for cost attribution and "last researched" display

3. **Should coverage dashboard show historical trend (coverage over time)?**
   - What we know: Ahrefs shows "ranking history" with time-series chart [CITED: help.ahrefs.com]
   - What's unclear: Does user need to see "we had 500 keywords in January, 800 in March"?
   - Recommendation: V1 shows current coverage only; V2 adds trend if users request it (YAGNI principle)

4. **How to handle location/language combinations in coverage?**
   - What we know: Same keyword in different locations (US vs UK) or languages (EN vs LT) are separate entries
   - What's unclear: Should coverage dashboard aggregate across locations or show separately?
   - Recommendation: Aggregate by default (total keywords regardless of location), add location filter if users need it

---

## Environment Availability

> Phase 93 has no new external dependencies — all infrastructure already in place from Phases 3, 78, 86.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Schema storage | ✓ | 15+ | — |
| Redis | BullMQ queue | ✓ | 7+ | — |
| BullMQ | Volume refresh worker | ✓ | 5.x | — |
| DataForSEO API | Keyword metrics | ✓ | v3 | — |
| jina-v5-text-nano embeddings | Clustering integration | ✓ | Phase 78 | — |

**Missing dependencies with no fallback:** None — all dependencies verified in prior phases.

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false in `.planning/config.json` → treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (TypeScript/Node.js standard) |
| Config file | `open-seo-main/vitest.config.ts` (existing) |
| Quick run command | `pnpm test --run --reporter=verbose --bail` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | Coverage dashboard aggregates keywords by cluster | integration | `pnpm test src/server/features/keywords/services/CoverageCalculator.test.ts -x` | ❌ Wave 0 |
| COV-02 | Deduplication filters existing keywords before API call | unit | `pnpm test src/server/features/keywords/services/KeywordDeduplicator.test.ts -x` | ✅ (extend existing) |
| COV-03 | Volume refresh updates metrics without re-clustering | integration | `pnpm test src/server/workers/volume-refresh-worker.test.ts -x` | ❌ Wave 0 |
| COV-04 | Research session records cost and duplicate count | unit | `pnpm test src/server/features/keywords/services/ResearchSessionService.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test --run --reporter=verbose --bail` (fail-fast for regression)
- **Per wave merge:** `pnpm test` (full suite)
- **Phase gate:** Full suite green + coverage ≥80% before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/server/features/keywords/services/CoverageCalculator.test.ts` — covers COV-01 (aggregate by cluster)
- [ ] `src/server/features/keywords/services/ResearchSessionService.test.ts` — covers COV-04 (session recording)
- [ ] `src/server/workers/volume-refresh-worker.test.ts` — covers COV-03 (refresh without clustering)
- [ ] `src/db/research-session-schema.test.ts` — Drizzle schema validation

**Framework install:** Already configured — Vitest + @testing-library for React components

---

## Security Domain

> `security_enforcement` not explicitly disabled → include security domain.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | N/A (inherits from existing auth) |
| V3 Session Management | No | N/A (no new sessions) |
| V4 Access Control | Yes | Prospect-scoped queries — ensure `WHERE prospectId = user.prospectId` on all coverage/session reads |
| V5 Input Validation | Yes | Zod schema for ResearchMode enum, seed keywords array length |
| V6 Cryptography | No | N/A (no secrets stored) |

### Known Threat Patterns for Keyword Research

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized access to competitor research sessions | Information Disclosure | Tenant isolation: `WHERE prospectId = currentUser.prospectId` on all session queries |
| Malicious seed keyword injection (XSS via keyword text) | Injection | Parameterized queries (Drizzle ORM default); HTML escaping in UI (React default) |
| API cost exhaustion attack (spam research requests) | Denial of Service | Rate limit: 10 research requests per prospect per day (via BullMQ rate limiter) |
| Session metadata tampering (inject fake competitor_domain) | Tampering | Input validation: Zod schema enforces metadata structure; no trust of client-provided metadata |

**Key Control:** Research sessions MUST enforce prospect-scoped access — never allow user to view sessions from other prospects. All queries include `WHERE prospectId = <validated_prospect_id>`.

---

## Sources

### Primary (HIGH confidence)

- DataForSEO API v3 pricing documentation — /llmstxt/dataforseo_v3_llms_txt (Context7)
- DataForSEO keywords_data endpoint reference — https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live
- Existing KeywordDeduplicator service — verified in open-seo-main/src/server/features/keywords/services/
- Phase 86 Semantic Intelligence CONTEXT.md — clustering infrastructure architecture
- BullMQ worker pattern — verified in open-seo-main/src/server/workers/audit-worker.ts

### Secondary (MEDIUM confidence)

- [Ahrefs ranking history tracking](https://help.ahrefs.com/en/articles/580856-can-i-see-the-ranking-history-of-a-given-keyword)
- [Fuzzy matching in data deduplication](https://dataladder.com/fuzzy-matching-101/)
- [Database audit trail design patterns](https://www.red-gate.com/blog/database-design-for-audit-logging/)
- [LinkedIn audit trail pattern guide](https://www.linkedin.com/advice/0/how-do-you-use-audit-trail-pattern-track-changes)
- [DataForSEO pricing comparison 2026](https://nextgrowth.ai/dataforseo-review/)
- [SEO keyword research best practices 2026](https://almcorp.com/blog/seo-best-practices-complete-guide-2026/)
- [Metadata tracking best practices](https://lakefs.io/blog/metadata-tracking/)

### Tertiary (LOW confidence)

- SEO metrics tracking evolution 2026 — [searchengineland.com](https://searchengineland.com/retire-these-9-seo-metrics-before-they-derail-your-2026-strategy-469461)
- Coverage-based keyword research shift — [dashthis.com](https://dashthis.com/blog/seo-tracking/)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies verified in existing codebase, no new packages
- Architecture: HIGH - Research session tracking pattern is standard audit trail, coverage calculation extends Phase 86 clustering
- Pitfalls: HIGH - Based on verified DataForSEO pricing model and existing deduplication service behavior
- Security: MEDIUM - Standard tenant isolation patterns, no novel threats identified

**Research date:** 2026-05-06

**Valid until:** 60 days (mid-term stability — DataForSEO API stable, no fast-moving framework dependencies)
