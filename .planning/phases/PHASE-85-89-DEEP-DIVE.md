# Phases 85-89 Deep Dive & Next Steps

> **Generated:** 2026-05-05
> **Updated:** 2026-05-05
> **Purpose:** Technical deep-dive into each phase with revised priorities
> **Status:** PLANNING COMPLETE — Context files created, ready for execution

## Related Documents

| Document | Purpose |
|----------|---------|
| [CLIENT-PORTAL-SPEC.md](./CLIENT-PORTAL-SPEC.md) | Comprehensive spec for Phases 87-89 (Keyword Lock-in + Client Portal) |
| [86-CONTEXT.md](./86-semantic-intelligence/86-CONTEXT.md) | Phase 86 context and decisions |
| [87-CONTEXT.md](./87-agency-business/87-CONTEXT.md) | Phase 87 context (Content Calendar + Client Portal) |
| [88-CONTEXT.md](./88-learning-collaboration/88-CONTEXT.md) | Phase 88 context (Outcome Tracking + Learning) |
| [89-CONTEXT.md](./89-client-acquisition/89-CONTEXT.md) | Phase 89 context (Keyword Lock-in) |

---

## Phase 85: Analysis Experience

### "Why This Keyword?" Feature — How It Works

The CompositeScorer at `filtering/scoring.ts` already returns a full breakdown:

```typescript
interface CompositeScore {
  baseScore: number;        // 0-1, weighted combination
  priorityMultiplier: number; // 1.0-2.0 from category match
  quickWinBonus: number;    // 0-0.2 from position opportunity
  finalScore: number;       // baseScore * priorityMultiplier + quickWinBonus
}
```

**baseScore formula:**
```
baseScore = relevance × 0.4 + funnelConfidence × 0.3 + geoScore × 0.2 + volumeNormalized × 0.1
```

**"Why this keyword?" popover would show:**

| Factor | Value | Contribution | Explanation |
|--------|-------|--------------|-------------|
| Relevance | 0.85 | +0.34 | High semantic match to your business |
| Funnel Stage | BOFU (0.9) | +0.27 | Ready-to-buy intent |
| Geo Match | Šiauliai (1.0) | +0.20 | Exact city match |
| Volume | 320 | +0.06 | Moderate search volume |
| **Base Score** | | **0.87** | |
| Priority Boost | detailing × 1.5 | ×1.5 | Matches priority category |
| Quick Win | Pos 15, Vol 320 | +0.20 | Striking distance opportunity |
| **Final Score** | | **1.51** | |

**Implementation:**
1. Store component scores during `CompositeScorer.score()` (already done — it returns breakdown)
2. Create `ScoreExplanation.tsx` popover component
3. Map technical terms to human-readable Lithuanian explanations
4. Show as hover/click on any keyword row

**Effort:** ~4 hours (component + translations)

---

## Phase 86: Semantic Intelligence Pipeline

### Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT PIPELINE (Partial)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  INPUT                                                              │
│  ┌─────────────┐                                                    │
│  │ Raw Keywords│ → from GSC, CSV, KeywordGenerator                  │
│  └─────┬───────┘                                                    │
│        ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ KeywordDeduplicator (TEXT ONLY)                              │   │
│  │ • Lowercase, trim, remove diacritics (ą→a, č→c)             │   │
│  │ • Collapse spaces                                            │   │
│  │ ❌ NO embedding-based semantic dedup                         │   │
│  └─────┬───────────────────────────────────────────────────────┘   │
│        ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ UnifiedEmbeddingService ✅ COMPLETE                          │   │
│  │ • Model: jina-embeddings-v5-text-nano (best Lithuanian quality) │   │
│  │ • Native: 768-dim → Storage: 768-dim                        │   │
│  │ • Prefixes: "query: " / "passage: "                         │   │
│  │ • Caching layer ready                                        │   │
│  │ • cosineSimilarity(), findTopK() helpers                    │   │
│  └─────┬───────────────────────────────────────────────────────┘   │
│        ▼                                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ CLUSTERING ❌ MISSING                                        │   │
│  │ • Current: naive 3-char prefix grouping (PSEODetector)      │   │
│  │ • Needed: HDBSCAN for semantic clusters                     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Target Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TARGET PIPELINE (Phase 86)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. EMBEDDING GENERATION (✅ EXISTS)                                │
│     ┌──────────────────────────┐                                   │
│     │ jina-v5-text-nano embeds │ → 768-dim vectors for all keywords │
│     │ (Lithuanian tuned)       │                                   │
│     └────────┬─────────────────┘                                           │
│              ▼                                                      │
│  2. SEMANTIC DEDUPLICATION (❌ NEW)                                 │
│     ┌──────────────────────────────────────────────────────────┐   │
│     │ For each keyword pair with cosine similarity > 0.92:     │   │
│     │ • "šampūnas plaukams" ≈ "plaukų šampūnas" → MERGE        │   │
│     │ • Keep higher volume variant as canonical                │   │
│     │ • Sum volumes, avg difficulty                            │   │
│     └────────┬─────────────────────────────────────────────────┘   │
│              ▼                                                      │
│  3. HDBSCAN CLUSTERING (❌ NEW)                                     │
│     ┌──────────────────────────────────────────────────────────┐   │
│     │ Algorithm: HDBSCAN (density-based, auto cluster count)   │   │
│     │ • min_cluster_size: 3                                    │   │
│     │ • min_samples: 2                                         │   │
│     │ • metric: cosine                                         │   │
│     │                                                          │   │
│     │ Output clusters:                                         │   │
│     │ • Cluster 0: [šampūnas, kondicionierius, plaukų...] 23kw │   │
│     │ • Cluster 1: [kaukė veidui, kremas, serumai...] 18kw     │   │
│     │ • Cluster 2: [nagų lakas, manikiūras...] 12kw            │   │
│     │ • Noise: [-1] keywords that don't cluster                │   │
│     └────────┬─────────────────────────────────────────────────┘   │
│              ▼                                                      │
│  4. TOPIC LABELING (❌ NEW)                                         │
│     ┌──────────────────────────────────────────────────────────┐   │
│     │ For each cluster, extract topic label:                   │   │
│     │ • Method 1: Most frequent n-gram in cluster              │   │
│     │ • Method 2: Centroid nearest keyword                     │   │
│     │ • Method 3: LLM summarization (Grok 4.1 Fast)             │   │
│     │                                                          │   │
│     │ Example: Cluster 0 → "Plaukų priežiūra"                  │   │
│     └────────┬─────────────────────────────────────────────────┘   │
│              ▼                                                      │
│  5. VISUAL OUTPUT (❌ NEW)                                          │
│     ┌──────────────────────────────────────────────────────────┐   │
│     │ • 2D cluster map (UMAP projection)                       │   │
│     │ • Colored by cluster, sized by volume                    │   │
│     │ • Click cluster → expand keywords                        │   │
│     └──────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Model Decision: jina-embeddings-v5-text-nano

Already configured in `config/embeddings.ts`:

| Aspect | Value | Rationale |
|--------|-------|-----------|
| Model | `jina-embeddings-v5-text-nano` | Best Lithuanian quality (Cohen's kappa 0.62) |
| Native dim | 768 | jina-v5-text-nano native |
| Storage dim | 768 | Full dimension storage |
| Fallback | `e5-base` | If jina unavailable |
| Quantization | INT8 | CPU inference (~15-25 docs/s) |
| Prefixes | "query: " / "passage: " | Required for E5/jina models |

**Cross-language (LT↔EN):** jina-embeddings-v5-text-nano supports 89 languages including Lithuanian. Same model handles both.

### HDBSCAN Implementation Options

**Option A: Python microservice (Recommended)**
```python
# clustering_service.py
from hdbscan import HDBSCAN
import numpy as np

def cluster_keywords(embeddings: list[list[float]], min_cluster_size: int = 3):
    clusterer = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=2,
        metric='euclidean',  # cosine via preprocessing
        cluster_selection_method='eom'
    )
    labels = clusterer.fit_predict(np.array(embeddings))
    return labels.tolist()
```
- Pros: Battle-tested hdbscan library, numpy optimized
- Cons: Another service to deploy

**Option B: JavaScript port**
```typescript
// Using ml-hdbscan (npm package)
import HDBSCAN from 'ml-hdbscan';

const clusterer = new HDBSCAN({
  minClusterSize: 3,
  minSamples: 2,
});
const labels = clusterer.fit(embeddings);
```
- Pros: Same runtime, no service boundary
- Cons: Less mature than Python hdbscan

**Recommendation:** Option A (Python microservice) — add to AI-Writer which already has Python stack.

---

## Phase 87: Agency Business

### Scope

#### Priority 1: Content Calendar Enhancement (Already 80% Built)

**What already exists in AI-Writer:**
- `ContentCalendarPage.tsx` — react-big-calendar with monthly/weekly/agenda views
- `contentCalendarStore.ts` — article state management with `publish_date`
- `ScheduledArticle` model — has `keyword`, `publish_date`, `status` fields
- PATCH endpoint — already supports changing `publish_date`
- CSV import — bulk scheduling with dates
- Status visualization — color-coded chips (draft → published)

**What's missing (small scope):**

| Gap | Effort |
|-----|--------|
| Drag-drop scheduling | ~4 hours (add @dnd-kit handlers) |
| Date picker per article | ~2 hours (add to detail sheet) |
| Keyword research → calendar link | ~3 hours (connect keyword_id) |

**Total effort:** ~1-2 days (not 1-2 weeks)

#### Priority 2: Client Portal (Read-Only)

**What it does:**
- Shareable link for clients to see their keyword strategy
- No login required (secure link with token)
- Read-only view of:
  - Selected keywords with funnel breakdown
  - Content calendar (what's coming)
  - Progress tracking (published vs. planned)
  - Performance trends (if GSC connected)

**Implementation:**
```
/portal/:token → ClientPortalView.tsx
  - Token maps to client_id in DB
  - Expires after 30 days (configurable)
  - Watermarked with agency brand
```

**Security:**
- Unique token per client (uuid v4)
- Rate limited (100 views/hour)
- No write operations
- Can revoke token from admin panel

---

## Phase 88: Learning & Collaboration — Confirmed

### Focus: Internal Learning Loop

**Outcome Tracking Schema:**
```typescript
keywordOutcome: {
  id: uuid,
  keywordId: string,
  clientId: string,
  // Selection data
  selectedAt: timestamp,
  selectedScore: number,
  selectedFunnel: 'BOFU' | 'MOFU' | 'TOFU',
  // Outcome data (tracked over time)
  publishedAt: timestamp | null,
  rankingAt30Days: number | null,
  rankingAt90Days: number | null,
  trafficAt90Days: number | null,
  // Success flag
  success: boolean | null, // ranked top 10 within 90 days
}
```

**Learning Queries:**
- "What score threshold predicts top 10 ranking?" → Logistic regression on (selectedScore, success)
- "Which funnel stages perform best for this industry?" → Group by industry + funnel
- "What's the average time to rank?" → Percentiles on (publishedAt → first top 10)

**Cross-client Benchmarks:**
- Aggregate success rates by industry vertical
- "E-commerce in Lithuania: 67% of BOFU keywords rank within 90 days"
- Privacy: Aggregate only, never expose individual client data

---

## Phase 89: Client Acquisition

### Keyword Lock-in

**Problem:** Scope creep. Client signs for 50 keywords, then asks "can you also do X, Y, Z?"

**Solution:** Contract explicitly lists locked keywords.

**Schema:**
```typescript
contractedKeywords: {
  id: uuid,
  contractId: string,
  keywordId: string,
  lockedAt: timestamp,
  status: 'active' | 'completed' | 'replaced',
  // Change tracking
  replacedBy: keywordId | null,  // If swapped
  replacedAt: timestamp | null,
  changeOrderId: string | null,  // If added via change order
}
```

**Features:**
1. **Baseline snapshot:** When contract signed, lock the keyword list
2. **Deviation tracking:** Client asks for new keyword → flag as "out of scope"
3. **Change orders:** New keywords become upsells with their own pricing
4. **Success measurement:** Compare contracted keywords vs. actual rankings

**UI in client view:**
```
CONTRACTED SCOPE (50 keywords)
├── ✅ Ranked Top 10: 23
├── 🔄 In Progress: 18
├── ⏳ Not Started: 9
└── 📊 Out of Scope Requests: 12 (see change order options)
```

---

## Next Steps

### Immediate (This Week)

| # | Task | Phase | Effort |
|---|------|-------|--------|
| 1 | Execute 84-01-PLAN.md | 84 | ~2 days |
| 2 | Create 85-01-PLAN.md for "Why this keyword?" | 85 | 1 day plan |

### Short-term (Next 2 Weeks)

| # | Task | Phase | Effort |
|---|------|-------|--------|
| 3 | Create 86-01-PLAN.md for HDBSCAN clustering | 86 | 1 day plan |
| 4 | Create 87-01-PLAN.md for Content Calendar | 87 | 1 day plan |
| 5 | Create 87-02-PLAN.md for Client Portal | 87 | 1 day plan |

### Medium-term (Month 2)

| # | Task | Phase | Effort |
|---|------|-------|--------|
| 6 | Create 88-01-PLAN.md for Outcome Tracking | 88 | 1 day plan |
| 7 | Create 89-01-PLAN.md for Keyword Lock-in | 89 | 1 day plan |

### Deferred (Backlog)

| Feature | Phase | Reason |
|---------|-------|--------|
| Google Sheets sync | 84 | CSV export works |
| Cross-language LT↔EN | 86 | jina-v5-text-nano already handles it |

---

## Summary of Scope

| Phase | Focus |
|-------|-------|
| 85 | **"Why this keyword?" popover** (high impact, low effort) |
| 86 | **HDBSCAN clustering** (core value), defer visual map |
| 87 | **Calendar drag-drop enhancement + Client Portal** (calendar 80% exists) |
| 88 | **Outcome tracking + learning loop** (internal) |
| 89 | **Keyword Lock-in** (scope control) |

---

*Deep dive completed: 2026-05-05*
*Priorities revised based on user input*
