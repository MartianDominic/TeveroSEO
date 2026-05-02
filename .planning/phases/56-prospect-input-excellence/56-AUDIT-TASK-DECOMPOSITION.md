# Task Decomposition & Queue Architecture Audit

**Date:** 2026-05-01  
**Auditor:** Claude Opus 4.5  
**Reference:** `docs/infra-research/crawling-10-5000-tasks-day.md`

---

## Executive Summary

The infra doc's core insight: **60-70% of workload should NEVER touch the crawler**. It defines 6 task shapes and recommends dual queue lanes (heavy-crawl vs fast API-only).

The current implementation has solid BullMQ infrastructure but **lacks explicit task type decomposition and dual-lane separation**. Most tasks follow a unified pattern regardless of whether they need crawling.

### Overall Status: 50% Implemented

---

## 6 Task Shapes Coverage

### Reference (from infra doc):

| Type | Description | API-replaceable? | Volume Share |
|------|-------------|------------------|--------------|
| A | Full client site audit | No - must crawl | 5-10% |
| B | Competitor snapshot | Partial | 15-20% |
| C | Keyword gap | **FULLY** - DataForSEO Labs | 35-45% |
| D | Backlink profile | **FULLY** - DataForSEO Backlinks | 10-15% |
| E | Content gap / topical authority | Partial - Exa + selective | 10-15% |
| F | Local SEO audit | **FULLY** - DataForSEO Business Data | 10-15% |

### Current Implementation:

| Type | Status | Location | Assessment |
|------|--------|----------|------------|
| A | **IMPLEMENTED** | `auditQueue.ts`, `siteAuditWorkflowPhases.ts` | Full BFS crawl, Lighthouse, Tier 1-4 |
| B | **PARTIAL** | `prospect-analysis-processor.ts` | DataForSEO Labs, no separate queue |
| C | **IMPLEMENTED** (pure API) | `dataforseoKeywordGap.ts` | Zero crawling - CORRECT |
| D | **IMPLEMENTED** (pure API) | `dataforseoBacklinks.ts` | Zero crawling - CORRECT |
| E | **PARTIAL** | `OpportunityDiscoveryService.ts` | AI + selective scraping |
| F | **NOT IMPLEMENTED** | - | No Local SEO audit found |

---

## Queue Architecture Assessment

### Infra Doc Requirement:

> Build **two queue lanes**: a heavy-crawl lane with headless capability and 15-min SLA, and a fast lane (sub-minute) that runs API workflows.

### Current Queues:

| Queue | File | Purpose | Lock Duration |
|-------|------|---------|---------------|
| `audit-queue` | `auditQueue.ts` | Site audits | 120s |
| `prospect-analysis` | `prospectAnalysisQueue.ts` | Prospect analysis | 300s |
| `keyword-ranking` | `rankingQueue.ts` | Daily rank checks | 300s |
| `failed-audits` | `auditQueue.ts` | DLQ for audits | N/A |

### Gap Analysis:

| Requirement | Status | Gap |
|-------------|--------|-----|
| Heavy-crawl lane (15-min SLA) | PARTIAL | audit-queue has 120s lock, not 15 min |
| Fast API lane (sub-minute) | **MISSING** | No dedicated fast queue |
| Task type routing | **MISSING** | All analyses go to same queue |
| Backlink queue | **MISSING** | Fetched inline, not queued |
| Keyword gap queue | **MISSING** | Fetched inline in prospect analysis |

---

## Critical Finding: No Lane Separation

The `prospect-analysis-processor.ts` runs ALL operations sequentially in ONE job:

```typescript
// prospect-analysis-processor.ts - MONOLITHIC
async processJob(job: Job) {
  // 1. Domain rank overview (API) ← Should be fast lane
  // 2. Keywords for site (API) ← Should be fast lane
  // 3. Competitor domains (API) ← Should be fast lane
  // 4. Keyword gaps (API) ← Should be fast lane
  // 5. Website scraping (CRAWL) ← Should be heavy lane
  // 6. AI opportunity discovery (API + LLM) ← Should be fast lane
}
```

**This violates the infra doc principle:** Types C (keyword gap) and D (backlinks) should never queue behind crawl operations.

---

## Task Type Definitions

**Found:**
```typescript
// prospect-schema.ts:48-54
export const ANALYSIS_TYPE = [
  "quick_scan",
  "deep_dive", 
  "opportunity_discovery",
] as const;
```

These represent **depth levels**, not the 6 task shapes. No explicit task shape enum exists.

---

## Recommendations

### Priority 1: Add Task Shape Enumeration

```typescript
// Proposed: server/lib/task-types.ts
export const TASK_SHAPES = {
  FULL_SITE_AUDIT: "A",      // Must crawl
  COMPETITOR_SNAPSHOT: "B",   // Partial API/crawl
  KEYWORD_GAP: "C",          // Pure API
  BACKLINK_PROFILE: "D",     // Pure API
  CONTENT_GAP: "E",          // Partial API/crawl
  LOCAL_SEO: "F",            // Pure API
} as const;

export const API_ONLY_SHAPES = ["C", "D", "F"] as const;
export const CRAWL_REQUIRED_SHAPES = ["A"] as const;
```

### Priority 2: Create Dual Queue Lanes

```typescript
// Heavy Crawl Lane (15 min SLA)
export const crawlQueue = new Queue("heavy-crawl", {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
  },
});

// Fast Lane (sub-minute SLA)  
export const fastApiQueue = new Queue("fast-api", {
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 1_000 },
  },
});
```

### Priority 3: Decompose Prospect Analysis

Split `prospect-analysis-processor.ts` into separate jobs using BullMQ Flow:

```typescript
const flow = new FlowProducer();
await flow.add({
  name: 'prospect-analysis',
  queueName: 'orchestrator',
  children: [
    { name: 'domain-overview', queueName: 'fast-api', data: {...} },
    { name: 'keyword-gap', queueName: 'fast-api', data: {...} },
    { name: 'backlink-snapshot', queueName: 'fast-api', data: {...} },
    { name: 'site-scrape', queueName: 'heavy-crawl', data: {...} },
    { name: 'ai-discovery', queueName: 'fast-api', data: {...} },
  ],
});
```

### Priority 4: Implement Type F (Local SEO)

Add DataForSEO Business Data API integration:
- `/v3/business_data/google/reviews/live`
- `/v3/business_data/google/my_business_info/live`

---

## Summary Table

| Aspect | Requirement | Current | Gap Severity |
|--------|-------------|---------|--------------|
| 6 Task Shapes | Explicit enum | 3 depth levels | **HIGH** |
| Heavy Crawl Lane | 15-min SLA | 120s audit queue | MEDIUM |
| Fast API Lane | Sub-minute | **MISSING** | **HIGH** |
| Type C/D pure API | Never crawl | Correct but not separated | MEDIUM |
| Type F Local SEO | Pure API | **NOT IMPLEMENTED** | LOW |
| 60-70% API-only | Never touch crawler | All prospect analyses touch scraper | **HIGH** |

---

## Files Audited

| File | Relevance |
|------|-----------|
| `open-seo-main/src/server/queues/prospectAnalysisQueue.ts` | Queue definition |
| `open-seo-main/src/server/queues/auditQueue.ts` | Audit queue |
| `open-seo-main/src/server/workers/prospect-analysis-processor.ts` | Monolithic processor |
| `open-seo-main/src/server/lib/dataforseoKeywordGap.ts` | Type C - correct |
| `open-seo-main/src/server/lib/dataforseoBacklinks.ts` | Type D - correct |
| `open-seo-main/src/db/prospect-schema.ts` | Depth levels, not shapes |

---

## Effort Estimate

| Task | Effort | Impact |
|------|--------|--------|
| Task shape enumeration | 2h | Foundation |
| Create fast-api queue | 4h | 60-70% workload separation |
| Decompose prospect processor | 16h | Full lane separation |
| Implement Type F | 8h | Feature completeness |
| **Total** | **30h** | **60-70% throughput gain** |
