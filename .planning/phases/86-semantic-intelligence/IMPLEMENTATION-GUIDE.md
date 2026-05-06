# Cost Optimization Implementation Guide

> **Purpose**: Step-by-step implementation guide for all cost optimizations  
> **Generated**: 2026-05-05  
> **Estimated Total Savings**: 60-75% reduction in external API costs

---

## Table of Contents

1. [Model Migration (42 Files)](#1-model-migration-42-files)
2. [GSC-First Ranking Implementation](#2-gsc-first-ranking-implementation)
3. [Batching Optimizations](#3-batching-optimizations)
4. [Local Embedding Server](#4-local-embedding-server)
5. [Caching Improvements](#5-caching-improvements)
6. [Implementation Checklist](#6-implementation-checklist)

---

## 1. Model Migration (42 Files)

### 1.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TARGET MODEL ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ANALYSIS LAYER (Grok 4.1)                                      │
│  ├── grok-4.1-fast      $0.20/1M   Bulk tasks, extraction      │
│  ├── grok-4.1           $0.40/1M   Moderate reasoning          │
│  └── grok-4.1-thinking  $2.00/1M   Complex analysis            │
│                                                                 │
│  CONTENT LAYER (Gemini 3.1)                                     │
│  ├── gemini-3.1-pro     $1.25/1M   Articles, voice, quality    │
│  ├── gemini-3.1-flash   $0.075/1M  Fast tasks, audio           │
│  └── gemini-3.1-flash-lite $0.02/1M Ultra-cheap fallback       │
│                                                                 │
│  IMAGE LAYER                                                    │
│  └── gemini-3.1-flash-image-preview  ~$0.02/img                │
│                                                                 │
│  VOICE (if Gemini insufficient)                                 │
│  └── claude-sonnet-4-6  $3.00/1M   Nuanced tone analysis       │
│                                                                 │
│  BACKUP PROVIDER                                                │
│  └── kimi-2.6           Competitive  Alternative reasoning     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Files to Update - open-seo-main (Priority 1)

#### Voice Services (Claude 3.5 → Gemini 3.1 Pro or Claude Sonnet 4.6)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/server/features/voice/services/VoiceAnalyzer.ts` | 16 | `claude-3-5-sonnet-20241022` | `gemini-3.1-pro` |
| `src/server/features/voice/services/VoiceComplianceService.ts` | 27 | `claude-3-5-sonnet-20241022` | `gemini-3.1-pro` |
| `src/server/features/voice/services/VoiceAnalysisService.ts` | 198 | `claude-3-5-sonnet-20241022` | `gemini-3.1-pro` |
| `src/routes/api/seo/voice.$clientId.preview.ts` | 24 | `claude-3-5-sonnet-20241022` | `gemini-3.1-pro` |

**Implementation**:
```typescript
// VoiceAnalyzer.ts - Change from:
const VOICE_MODEL = process.env.CLAUDE_MODEL_VOICE_ANALYZER || 'claude-3-5-sonnet-20241022';

// To:
const VOICE_MODEL = process.env.VOICE_ANALYZER_MODEL || 'gemini-3.1-pro';
```

#### Translation Services (Gemini 1.5 → 3.1)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/server/services/translation/TranslationService.ts` | 35 | `gemini-1.5-pro` | `gemini-3.1-pro` |
| `src/server/lib/proposals/gemini.ts` | 529 | `gemini-1.5-pro` | `gemini-3.1-pro` |

**Implementation**:
```typescript
// TranslationService.ts - Change from:
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

// To:
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro' });
```

#### Classification Services (Grok 2 → 4.1, GPT-4o → Grok)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/server/features/keywords/services/model-router.ts` | 57 | `grok-2-mini` | `grok-4.1-fast` |
| `src/server/features/keywords/services/provider-config.ts` | 49 | `grok-2-mini` | `grok-4.1-fast` |
| `src/server/features/keywords/services/ResilientClassifier.ts` | 334 | `gpt-4o-mini` | `grok-4.1-fast` |
| `src/server/features/keywords/classification/config.ts` | 42 | `gemini-2.5-flash-lite` | `gemini-3.1-flash-lite` |

**Implementation**:
```typescript
// model-router.ts - Change from:
{ model: 'grok-2-mini', provider: 'xai' }

// To:
{ model: 'grok-4.1-fast', provider: 'xai' }

// ResilientClassifier.ts - Change from:
const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

// To:
const FALLBACK_MODEL = 'grok-4.1-fast';
const FALLBACK_PROVIDER = 'xai';
```

#### Other Services

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/server/lib/scraper/businessExtractor.ts` | 18 | `claude-3-5-sonnet-20241022` | `grok-4.1-fast` |
| `src/server/lib/opportunity/keywordGenerator.ts` | 170 | `claude-3-5-sonnet-20241022` | `grok-4.1-fast` |

### 1.3 Files to Update - AI-Writer (Priority 2)

#### Main Text Generation

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `backend/services/llm_providers/main_text_generation.py` | 76 | `gemini-2.0-flash-001` | `gemini-3.1-flash` |
| `backend/services/llm_providers/main_text_generation.py` | 101 | `gemini-2.0-flash-001` | `gemini-3.1-flash` |
| `backend/services/client_context.py` | 21 | `gemini-2.5-pro` | `gemini-3.1-pro` |

**Implementation**:
```python
# main_text_generation.py - Change from:
DEFAULT_MODEL = "gemini-2.0-flash-001"

# To:
DEFAULT_MODEL = "gemini-3.1-flash"
```

#### Hallucination Detection

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `backend/services/hallucination_detector.py` | 215 | `gemini-1.5-flash` | `gemini-3.1-flash` |
| `backend/services/hallucination_detector.py` | 441 | `gemini-1.5-flash` | `gemini-3.1-flash` |
| `backend/services/hallucination_detector.py` | 671 | `gemini-1.5-flash` | `gemini-3.1-flash` |

#### Audio/Image Services

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `backend/services/llm_providers/audio_to_text_generation/gemini_audio_text.py` | 134 | `gemini-1.5-flash` | `gemini-3.1-flash` |
| `backend/services/llm_providers/audio_to_text_generation/gemini_audio_text.py` | 243 | `gemini-1.5-flash` | `gemini-3.1-flash` |

#### Legacy/Defaults

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `backend/services/user_workspace_manager.py` | 287 | `gemini-pro` | `gemini-3.1-pro` |
| `backend/services/progressive_setup_service.py` | 103 | `gemini-pro` | `gemini-3.1-pro` |
| `backend/services/persona_analysis_service.py` | 458 | `gemini-2.5-flash` | `gemini-3.1-flash` |
| `backend/services/seo_tools/meta_description_service.py` | 93 | `gemini-2.0-flash-001` | `gemini-3.1-flash` |

#### Pricing Service (Update model costs)

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `backend/services/subscription/pricing_service.py` | 99-181 | gemini-1.5/2.5 pricing | gemini-3.1 pricing |
| `backend/services/subscription/pricing_service.py` | 245 | `claude-3.5-sonnet` | `claude-sonnet-4-6` |
| `backend/services/subscription/usage_tracking_service.py` | 96 | `claude-3.5-sonnet` | `claude-sonnet-4-6` |

### 1.4 Files to Update - apps/web (Priority 3)

#### Client Settings UI

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/app/(shell)/clients/[clientId]/settings/page.tsx` | 57-62 | gemini-2.x models | gemini-3.1-x models |
| `src/app/(shell)/clients/[clientId]/settings/page.tsx` | 66-68 | imagen-4.x models | gemini-3.1-flash-image-preview |

**Implementation**:
```typescript
// settings/page.tsx - Change text model options from:
const textModels = [
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  // ...
];

// To:
const textModels = [
  { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
  { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash' },
  { value: 'grok-4.1-fast', label: 'Grok 4.1 Fast' },
  { value: 'grok-4.1-thinking', label: 'Grok 4.1 Thinking' },
];

// Change image model options from:
const imageModels = [
  { value: 'imagen-4.0-generate-001', label: 'Imagen 4.0' },
  // ...
];

// To:
const imageModels = [
  { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Image' },
];
```

#### Image Generation Panel

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `src/components/editor/ImageGenerationPanel.tsx` | 32-34 | imagen-4.x | gemini-3.1-flash-image-preview |

### 1.5 Safety/Config Files (Priority 4)

| File | Action |
|------|--------|
| `open-seo-main/src/lib/llm/safety.ts` | Update token limits for new model IDs |
| `AI-Writer/backend/utils/llm_safety.py` | Update token limits for new model IDs |

---

## 2. GSC-First Ranking Implementation

### 2.1 Overview

**Problem**: Daily ranking checks call DataForSEO for ALL keywords (~$150/mo for 1000 keywords).

**Solution**: Use GSC for keywords the domain IS ranking for (FREE), DataForSEO only for discovery.

**Savings**: 70-80% reduction in DataForSEO ranking costs (~$105-120/mo)

### 2.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GSC-FIRST RANKING FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [02:00 UTC] GSC Sync Job                                       │
│  └─> analytics-processor.ts syncs GSC data                     │
│  └─> Stores in seo_gsc_query_snapshots table                   │
│                                                                 │
│  [03:00 UTC] Ranking Check Job                                  │
│  │                                                              │
│  ├─> Step 1: Load tracked keywords                              │
│  │   SELECT * FROM saved_keywords WHERE tracking_enabled=true  │
│  │                                                              │
│  ├─> Step 2: Match against GSC data                             │
│  │   FOR EACH keyword:                                         │
│  │     gsc_match = SELECT FROM seo_gsc_query_snapshots         │
│  │                 WHERE query ILIKE keyword                   │
│  │                 AND date >= NOW() - INTERVAL '3 days'       │
│  │                                                              │
│  │   IF gsc_match FOUND:                                       │
│  │     → Store ranking with source='gsc' (FREE!)               │
│  │     → Include clicks, impressions, CTR from GSC             │
│  │   ELSE:                                                     │
│  │     → Add to dataforseo_queue                               │
│  │                                                              │
│  ├─> Step 3: DataForSEO for NOT-IN-GSC keywords                │
│  │   FOR EACH keyword in dataforseo_queue:                     │
│  │     IF not_ranking_streak >= 4 AND last_check < 7 days:     │
│  │       → Skip (save money)                                   │
│  │     ELSE:                                                   │
│  │       → Call DataForSEO SERP API                            │
│  │       → Store with source='dataforseo' or 'not_ranking'     │
│  │                                                              │
│  └─> Step 4: Update streaks                                     │
│      IF position = 0: not_ranking_streak++                     │
│      ELSE: not_ranking_streak = 0                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Database Schema Changes

**File**: `open-seo-main/drizzle/XXXX_gsc_ranking_source.sql`

```sql
-- Add ranking source enum
CREATE TYPE ranking_source AS ENUM ('gsc', 'dataforseo', 'not_ranking');

-- Add source column to keyword_rankings
ALTER TABLE keyword_rankings 
  ADD COLUMN source ranking_source NOT NULL DEFAULT 'dataforseo';

-- Add GSC-specific metrics
ALTER TABLE keyword_rankings
  ADD COLUMN gsc_clicks INTEGER,
  ADD COLUMN gsc_impressions INTEGER,
  ADD COLUMN gsc_ctr REAL;

-- Add not-ranking tracking to saved_keywords
ALTER TABLE saved_keywords
  ADD COLUMN not_ranking_streak INTEGER DEFAULT 0,
  ADD COLUMN last_not_ranking_check TIMESTAMP;

-- Index for efficient GSC matching
CREATE INDEX idx_gsc_snapshots_query_date 
  ON seo_gsc_query_snapshots (client_id, query, date DESC);
```

### 2.4 New Service: GscRankingMatcher.ts

**File**: `open-seo-main/src/server/services/GscRankingMatcher.ts`

```typescript
import { db } from '@/db';
import { seoGscQuerySnapshots } from '@/db/schema';
import { eq, and, gte, ilike } from 'drizzle-orm';
import { subDays } from 'date-fns';

export interface GscMatchResult {
  query: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
  date: Date;
}

export class GscRankingMatcher {
  /**
   * Match keywords against recent GSC snapshot data.
   * GSC data has ~3 day delay, so we look back 3-5 days.
   */
  async matchKeywords(
    clientId: string,
    keywords: string[],
    lookbackDays: number = 5
  ): Promise<Map<string, GscMatchResult | null>> {
    const results = new Map<string, GscMatchResult | null>();
    const cutoffDate = subDays(new Date(), lookbackDays);

    // Fetch all recent GSC data for this client
    const gscData = await db
      .select()
      .from(seoGscQuerySnapshots)
      .where(
        and(
          eq(seoGscQuerySnapshots.clientId, clientId),
          gte(seoGscQuerySnapshots.date, cutoffDate)
        )
      );

    // Build lookup map (normalized query -> best match)
    const gscLookup = new Map<string, GscMatchResult>();
    for (const row of gscData) {
      const normalized = this.normalizeKeyword(row.query);
      const existing = gscLookup.get(normalized);
      
      // Keep most recent data
      if (!existing || row.date > existing.date) {
        gscLookup.set(normalized, {
          query: row.query,
          position: row.position,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          date: row.date,
        });
      }
    }

    // Match each keyword
    for (const keyword of keywords) {
      const normalized = this.normalizeKeyword(keyword);
      results.set(keyword, gscLookup.get(normalized) || null);
    }

    return results;
  }

  /**
   * Normalize keyword for matching.
   * GSC queries may have slight variations.
   */
  private normalizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')      // Collapse whitespace
      .replace(/[""'']/g, '')    // Remove quotes
      .normalize('NFC');          // Unicode normalization
  }
}
```

### 2.5 Modified Ranking Processor

**File**: `open-seo-main/src/server/workers/ranking-processor.ts`

```typescript
import { GscRankingMatcher } from '@/server/services/GscRankingMatcher';

export default async function processor(job: Job<RankingJobData>) {
  const gscMatcher = new GscRankingMatcher();
  
  // 1. Fetch all tracking-enabled keywords grouped by client
  const keywordsByClient = await getTrackingKeywordsByClient();
  
  for (const [clientId, keywords] of keywordsByClient) {
    // 2. Check if client has GSC connected
    const hasGsc = await clientHasGscConnection(clientId);
    
    if (hasGsc) {
      // 3. GSC-FIRST: Match against GSC data
      const gscMatches = await gscMatcher.matchKeywords(
        clientId,
        keywords.map(k => k.keyword)
      );
      
      const gscRanking: KeywordWithGsc[] = [];
      const needsDataForSeo: Keyword[] = [];
      
      for (const kw of keywords) {
        const gscMatch = gscMatches.get(kw.keyword);
        if (gscMatch && gscMatch.position > 0) {
          gscRanking.push({ ...kw, gscData: gscMatch });
        } else {
          needsDataForSeo.push(kw);
        }
      }
      
      // 4. Store GSC-sourced rankings (FREE!)
      for (const kw of gscRanking) {
        await upsertRanking({
          keywordId: kw.id,
          position: kw.gscData.position,
          source: 'gsc',
          gscClicks: kw.gscData.clicks,
          gscImpressions: kw.gscData.impressions,
          gscCtr: kw.gscData.ctr,
          checkedAt: new Date(),
        });
      }
      
      // 5. DataForSEO only for NOT-IN-GSC keywords
      for (const kw of needsDataForSeo) {
        await processWithDataForSeo(kw);
      }
    } else {
      // No GSC connection - use DataForSEO for all (existing behavior)
      for (const kw of keywords) {
        await processWithDataForSeo(kw);
      }
    }
  }
}

async function processWithDataForSeo(kw: Keyword) {
  // Skip if consistently not ranking (cost saving)
  if (kw.notRankingStreak >= 4) {
    const daysSinceCheck = daysSince(kw.lastNotRankingCheck);
    if (daysSinceCheck < 7) {
      // Skip - re-check weekly instead of daily
      await upsertRanking({
        keywordId: kw.id,
        position: 0,
        source: 'not_ranking',
        checkedAt: new Date(),
      });
      return;
    }
  }
  
  // Call DataForSEO
  const serpData = await fetchLiveSerpItemsRaw(
    kw.keyword, 
    kw.locationCode, 
    kw.languageCode
  );
  
  const { position, url } = extractPosition(serpData.data, kw.projectDomain);
  
  await upsertRanking({
    keywordId: kw.id,
    position: position || 0,
    source: position > 0 ? 'dataforseo' : 'not_ranking',
    url,
    serpFeatures: extractSerpFeatures(serpData.data),
    checkedAt: new Date(),
  });
  
  // Update not-ranking streak
  if (position === 0) {
    await updateNotRankingStreak(kw.id, kw.notRankingStreak + 1);
  } else {
    await updateNotRankingStreak(kw.id, 0);
  }
}
```

### 2.6 Expected Impact

| Scenario | Before (DataForSEO only) | After (GSC-first) |
|----------|--------------------------|-------------------|
| 1000 tracked keywords | 1000 API calls/day | ~200-300 API calls/day |
| Keywords ranking (GSC) | $0.05-0.10 each | FREE |
| Keywords not ranking | $0.05-0.10 each | $0.05-0.10 (weekly, not daily) |
| Monthly cost | ~$150 | ~$30-45 |
| **Savings** | - | **$105-120/mo (70-80%)** |

---

## 3. Batching Optimizations

### 3.1 Keyword Classification (75% cost reduction)

**Current**: 50 keywords/batch
**Optimal**: 200 keywords/batch

**File**: `open-seo-main/src/server/features/keywords/classification/config.ts`

```typescript
// Change from:
export const CLASSIFICATION_CONFIG = {
  BATCH_SIZE: 50,
  MAX_TOKENS: 4000,
};

// To:
export const CLASSIFICATION_CONFIG = {
  BATCH_SIZE: 200,
  MAX_TOKENS: 12000,
};
```

**Prompt Structure for Batched Output**:
```typescript
const prompt = `
Classify these ${keywords.length} keywords for the business: ${businessContext}

<keywords>
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}
</keywords>

Return JSON array with one object per keyword:
{"classifications": [
  {"index": 1, "keyword": "...", "include": true, "confidence": 0.92, "type": "product"},
  ...
]}
`;
```

### 3.2 Quality Analysis Consolidation (85% cost reduction)

**Current**: 7 separate API calls per analysis
**Optimal**: 1 consolidated call

**File**: `AI-Writer/backend/services/ai_quality_analysis_service.py`

```python
# Change from 7 separate methods to 1 consolidated call:

COMBINED_QUALITY_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "strategic_completeness": QUALITY_METRIC_SCHEMA,
        "audience_intelligence": QUALITY_METRIC_SCHEMA,
        "competitive_intelligence": QUALITY_METRIC_SCHEMA,
        "content_strategy": QUALITY_METRIC_SCHEMA,
        "performance_alignment": QUALITY_METRIC_SCHEMA,
        "implementation_feasibility": QUALITY_METRIC_SCHEMA,
        "overall_recommendations": {
            "type": "ARRAY",
            "items": {"type": "STRING"}
        }
    }
}

async def analyze_quality_consolidated(self, strategy_data: dict) -> dict:
    """Single API call for all 6 quality dimensions."""
    prompt = f"""
    Analyze this content strategy across 6 quality dimensions.
    For each dimension, provide: score (0-100), status, description, recommendations.
    
    Strategy Data:
    {json.dumps(strategy_data, indent=2)}
    
    Dimensions to analyze:
    1. Strategic Completeness - Are all strategic elements present?
    2. Audience Intelligence - How well does it understand the audience?
    3. Competitive Intelligence - Is competitor analysis thorough?
    4. Content Strategy - Is the content approach sound?
    5. Performance Alignment - Are metrics aligned with goals?
    6. Implementation Feasibility - Is it practically executable?
    
    Return comprehensive analysis as JSON.
    """
    
    response = await self.model.generate_content(
        prompt,
        generation_config=GenerationConfig(
            response_mime_type="application/json",
            response_schema=COMBINED_QUALITY_SCHEMA,
        )
    )
    
    return json.loads(response.text)
```

### 3.3 Funnel Classification (60% cost reduction)

**Current**: 100 keywords/batch
**Optimal**: 250 keywords/batch

**File**: `open-seo-main/src/server/features/keywords/funnel/FunnelLLMClassifier.ts`

```typescript
// Change from:
const CONFIG = {
  batchSize: 100,
  maxTokens: 4096,
};

// To:
const CONFIG = {
  batchSize: 250,
  maxTokens: 15000,
};
```

### 3.4 Translation Batching (80% cost reduction)

**Current**: 10 strings in parallel (10 API calls)
**Optimal**: 50 strings in 1 batched call

**File**: `open-seo-main/src/server/services/translation/TranslationService.ts`

```typescript
async translateBatch(texts: string[]): Promise<string[]> {
  // Change from parallel individual calls to true batching
  const prompt = `
Translate the following ${texts.length} UI strings from English to Lithuanian.
- Preserve placeholders like {count}, {{variable}}, %s, %d
- Use formal "Jūs" form
- Maintain original casing style

Strings to translate:
${texts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Return JSON array of translations in same order:
["translation1", "translation2", ...]
`;

  const response = await this.model.generateContent(prompt, {
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });
  
  return JSON.parse(response.text);
}
```

### 3.5 Pass 2 Refinement Batching (70% cost reduction)

**Current**: 1 keyword per call
**Optimal**: 20 keywords per call

**File**: `open-seo-main/src/server/features/keywords/services/ResilientClassifier.ts`

```typescript
// Change classifyBatch from:
async classifyBatch(keywords: string[]): Promise<ClassificationResult[]> {
  const results = await Promise.all(
    keywords.map(kw => this.classify(kw))
  );
  return results;
}

// To:
async classifyBatch(keywords: string[]): Promise<ClassificationResult[]> {
  const BATCH_SIZE = 20;
  const results: ClassificationResult[] = [];
  
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);
    const batchResults = await this.classifyBatchInternal(batch);
    results.push(...batchResults);
  }
  
  return results;
}

private async classifyBatchInternal(keywords: string[]): Promise<ClassificationResult[]> {
  const prompt = `
Classify these ${keywords.length} keywords that had low confidence in Pass 1.
Provide definitive classification with reasoning.

Keywords:
${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Return JSON array:
[{"keyword": "...", "include": true/false, "confidence": 0.95, "reasoning": "..."}]
`;
  
  const response = await this.llm.generate(prompt);
  return JSON.parse(response);
}
```

### 3.6 Batching Summary

| Task | Current | Optimal | API Calls Reduction | Cost Reduction |
|------|---------|---------|---------------------|----------------|
| Keyword Classification | 50/batch | 200/batch | 4x fewer | 75% |
| Quality Analysis | 7 calls | 1 call | 7x fewer | 85% |
| Funnel Classification | 100/batch | 250/batch | 2.5x fewer | 60% |
| Translation | 10 parallel | 50 batched | 5x fewer | 80% |
| Pass 2 Refinement | 1/keyword | 20/batch | 20x fewer | 70% |

---

## 4. Local Embedding Server

### 4.1 Current State

**Existing Server**: `open-seo-main/src/server/services/embedding-server/server.py`
- Model: `jinaai/jina-embeddings-v5-text-nano`
- Port: 8001
- Output: 768-dim normalized embeddings

**Current Flow**:
```
1. Redis Cache (80%+ hit rate) ✅
2. Local embedding server ✅
3. Jina API fallback ← REMOVE THIS
4. THROW
```

### 4.2 Files to Modify

| File | Change |
|------|--------|
| `ResilientEmbedding.ts:551` | Remove Jina API from cascade |
| `embedding-service.ts:176-235` | Remove `callJinaApi()` method |
| `embedding-config.ts:117-151` | Remove Jina API URL and payload |
| `AI-Writer/.../embedding_service.py:97-113` | Use local server instead of Jina API |
| `.env.example` | Remove `JINA_API_KEY`, add `EMBEDDING_SERVER_URL` |

### 4.3 Implementation

**File**: `open-seo-main/src/server/features/keywords/services/ResilientEmbedding.ts`

```typescript
// Change cascade from:
const providers = [
  new CachedEmbedding(redis),
  new LocalEmbeddingClient(localServerUrl),
  new JinaEmbeddingAPI(jinaApiKey),  // REMOVE
];

// To:
const providers = [
  new CachedEmbedding(redis),
  new LocalEmbeddingClient(localServerUrl),
  // No external fallback - local server is the source of truth
];
```

**Docker Compose Addition**:
```yaml
# docker-compose.dev.yml
embedding-server:
  build: 
    context: ./open-seo-main/src/server/services/embedding-server
    dockerfile: Dockerfile
  environment:
    - EMBEDDING_MODEL=jinaai/jina-embeddings-v5-text-nano
    - PORT=8001
  ports:
    - "8001:8001"
  deploy:
    resources:
      limits:
        memory: 2G
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### 4.4 Cost Elimination

| Scale | Jina API Cost | Local Server Cost | Savings |
|-------|---------------|-------------------|---------|
| Dev (1K kw/day) | $5-10/mo | $0 | $5-10/mo |
| Small (10K kw/day) | $20-50/mo | $0 | $20-50/mo |
| Medium (100K kw/day) | $200-500/mo | +$10/mo VPS RAM | $190-490/mo |
| Large (1M kw/day) | $2,000+/mo | +$20/mo VPS RAM | $1,980/mo |

---

## 5. Caching Improvements

### 5.1 DataForSEO Endpoint Caching

| Endpoint | Current | Add | TTL | Savings |
|----------|---------|-----|-----|---------|
| Backlinks summary | ❌ None | Redis | 24h | 60-80% |
| Backlinks list | ❌ None | Redis | 24h | 60-80% |
| Domain overview | ❌ None | Redis | 24h | 50% |
| Lighthouse | ❌ None | Redis | 7 days | 90% |
| Keyword ideas | ❌ None | Redis | 1h | 30% |

**Implementation**:
```typescript
// Add to dataforseoBacklinks.ts
const CACHE_TTL = 24 * 60 * 60; // 24 hours

async function getBacklinksSummary(domain: string): Promise<BacklinksSummary> {
  const cacheKey = `dfs:backlinks:summary:${domain}`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Call API
  const data = await callDataForSeoBacklinksSummary(domain);
  
  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
  
  return data;
}
```

### 5.2 Replace DataForSEO Lighthouse with PageSpeed Insights

**File**: `open-seo-main/src/server/lib/pagespeed-insights.ts` (NEW)

```typescript
const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

export async function getLighthouseScores(url: string): Promise<LighthouseScores> {
  const cacheKey = `psi:lighthouse:${hashUrl(url)}`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Call FREE PageSpeed Insights API
  const response = await fetch(
    `${PAGESPEED_API}?url=${encodeURIComponent(url)}` +
    `&category=performance&category=accessibility` +
    `&category=best-practices&category=seo`
  );
  
  const data = await response.json();
  
  const scores = {
    performance: Math.round(data.lighthouseResult.categories.performance.score * 100),
    accessibility: Math.round(data.lighthouseResult.categories.accessibility.score * 100),
    bestPractices: Math.round(data.lighthouseResult.categories['best-practices'].score * 100),
    seo: Math.round(data.lighthouseResult.categories.seo.score * 100),
  };
  
  // Cache for 7 days
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(scores));
  
  return scores;
}
```

---

## 6. Implementation Checklist

### Phase 1: Quick Wins (Week 1)

- [ ] **Deploy local embedding server** (2h)
  - [ ] Add to docker-compose.dev.yml
  - [ ] Remove Jina API fallback from ResilientEmbedding.ts
  - [ ] Update environment variables
  - [ ] Test embedding generation

- [ ] **Replace Lighthouse with PageSpeed Insights** (1h)
  - [ ] Create pagespeed-insights.ts
  - [ ] Update dataforseoLighthouse.ts callers
  - [ ] Add 7-day Redis caching

- [ ] **Increase keyword classification batch size** (1h)
  - [ ] Update CLASSIFICATION_CONFIG.BATCH_SIZE to 200
  - [ ] Update MAX_TOKENS to 12000
  - [ ] Test with large keyword sets

### Phase 2: GSC-First Ranking (Week 2)

- [ ] **Database schema changes** (1h)
  - [ ] Create migration for source column
  - [ ] Add GSC metrics columns
  - [ ] Add not_ranking_streak columns
  - [ ] Run migration

- [ ] **Create GscRankingMatcher service** (2h)
  - [ ] Implement keyword matching
  - [ ] Add Redis caching layer
  - [ ] Write unit tests

- [ ] **Modify ranking-processor** (2h)
  - [ ] Add GSC-first logic
  - [ ] Implement not-ranking streak handling
  - [ ] Test with real data

### Phase 3: Batching Optimizations (Week 3)

- [ ] **Quality analysis consolidation** (2h)
  - [ ] Create combined schema
  - [ ] Implement consolidated method
  - [ ] Update callers
  - [ ] Test output quality

- [ ] **Translation batching** (2h)
  - [ ] Implement true batch translation
  - [ ] Update translateBatch method
  - [ ] Test with UI strings

- [ ] **Pass 2 refinement batching** (1h)
  - [ ] Update ResilientClassifier.classifyBatch
  - [ ] Test accuracy

### Phase 4: Model Migration (Week 4)

- [ ] **Update open-seo-main models** (2h)
  - [ ] Voice services → gemini-3.1-pro
  - [ ] Translation → gemini-3.1-pro
  - [ ] Classification fallbacks → grok-4.1-fast
  - [ ] Test all updated services

- [ ] **Update AI-Writer models** (2h)
  - [ ] Main text generation → gemini-3.1-flash
  - [ ] Client context → gemini-3.1-pro
  - [ ] Hallucination detector → gemini-3.1-flash
  - [ ] Test content generation

- [ ] **Update apps/web UI** (1h)
  - [ ] Update model selection dropdowns
  - [ ] Update image model options
  - [ ] Test settings pages

### Phase 5: Caching & Monitoring (Week 5)

- [ ] **Add DataForSEO caching** (2h)
  - [ ] Backlinks endpoints (24h TTL)
  - [ ] Domain overview (24h TTL)
  - [ ] Keyword ideas (1h TTL)

- [ ] **Add cost monitoring** (2h)
  - [ ] Track API calls by endpoint
  - [ ] Track cache hit rates
  - [ ] Create cost dashboard

---

## Summary: Expected Savings

| Optimization | Monthly Savings |
|--------------|-----------------|
| Local embedding server | $5-500 |
| GSC-first ranking | $105-120 |
| Quality analysis batching | ~$50-100 |
| Keyword classification batching | ~$30-50 |
| PageSpeed Insights (free Lighthouse) | $30-50 |
| Other batching improvements | ~$20-40 |
| DataForSEO caching | ~$30-50 |
| **TOTAL** | **$270-910/mo** |

**Percentage reduction**: 50-70% of external API costs
