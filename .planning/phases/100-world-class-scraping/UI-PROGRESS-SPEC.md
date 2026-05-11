# World-Class Progress UI Specification

> **Design Principle:** Show WHAT is happening, HIDE HOW it's happening.
> **Compliance:** design-system-v6.md, v7-master-design-architecture.md

---

## Security Through Abstraction

Competitors watching our UI should NOT be able to reverse-engineer our architecture.

| Internal Process | User-Facing Label | Metric Example |
|-----------------|-------------------|----------------|
| `TieredFetcher.scrapeBatch()` | "Analyzing site structure" | "89 of 127 pages" |
| `DataForSEO domain_intersection` | "Discovering opportunities" | "847 keywords found" |
| `Cheerio HTML parsing` | "Evaluating content quality" | "24 pages reviewed" |
| `Grok 4.1 classification` | "Scoring opportunities" | "127 high-value gaps" |
| `FalkorDB graph query` | "Mapping topical clusters" | "12 clusters identified" |
| `domainScrapeHistory.escalate()` | "Retry in 12s" | Hidden implementation |

---

## Component: `<ProspectAnalysisProgress />`

**Purpose:** Modal overlay during prospect analysis (2-5 minutes)

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Analyzing Prospect                                            │
│   acmecorp.com                                           [×]    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                         │   │
│   │              127                                        │   │
│   │         opportunities                                   │   │
│   │            found                                        │   │
│   │                                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░]  72%             │
│                                                                 │
│   ✓ Gathering site intelligence       Domain rank: 45,231      │
│   ✓ Identifying competitors           3 competitors            │
│   ● Mapping keyword landscape          → 847 analyzed          │
│   ○ Scoring opportunities              Pending                 │
│   ○ Finalizing analysis                Pending                 │
│                                                                 │
│   ─────────────────────────────────────────────────────────    │
│   Est. 45 seconds remaining                      [Cancel]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Mapping

| Internal Phase | User Label | Metric |
|---------------|------------|--------|
| `domain_metrics` | "Gathering site intelligence" | Domain rank |
| `competitors_discovery` | "Identifying competitors" | Count |
| `keyword_fetch` | "Mapping keyword landscape" | Keywords analyzed |
| `gap_analysis` | "Scoring opportunities" | High-value gaps |
| `finalize` | "Finalizing analysis" | "Complete" |

---

## Component: `<ClientAuditProgress />`

**Purpose:** Inline card or modal during 109-check technical audit

### Visual Structure (Inline Mode)

```
┌─────────────────────────────────────────────────────────────────┐
│ Site Audit                                                      │
│ Running...                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Analyzing site structure                                      │
│   89 of 127 pages                                              │
│                                                                 │
│   [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░]  68%          │
│                                                                 │
│   ────────────────────────────────────────────────────────     │
│                                                                 │
│   Critical    Core SEO    Content    Optimization               │
│      3           12          8            -                     │
│   ● ● ●      ● ● ● ●      ● ● ● ●      ○ ○ ○ ○               │
│                                                                 │
│   Est. 2 minutes remaining                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tier Abstraction

| Internal | User-Facing | Why Hide |
|----------|-------------|----------|
| Tier 1 checks | "Critical issues" | Don't reveal tier structure |
| Tier 2 checks | "Core SEO" | Generic, competitor-safe |
| Tier 3 checks | "Content quality" | No implementation hints |
| Tier 4 checks | "Optimization" | Sounds like polish, not audit |

---

## Component: `<ArticleGenerationProgress />`

**Purpose:** Modal during AI article generation (30-90 seconds)

### Visual Structure (Matches User's Image)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ⏳ Generating article                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ✓ Researching topic              G  24 sources               │
│   ✓ Analyzing top results              18 pages                │
│   ✓ Writing content                    3,247 words             │
│   ● Generating images                  4 of 6                  │
│   ○ Adding links                       20 links                │
│   ○ Publishing article             W  9:00 AM                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Mapping

| Internal | User Label | Metric |
|----------|------------|--------|
| `serp_scrape` | "Researching topic" | Sources found |
| `content_analysis` | "Analyzing top results" | Pages reviewed |
| `llm_generation` | "Writing content" | Word count |
| `image_gen` | "Generating images" | X of Y |
| `internal_linking` | "Adding links" | Link count |
| `cms_publish` | "Publishing article" | Scheduled time |

---

## Design System Compliance

### Typography (v6 §2.3)

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Main metric (127) | Newsreader | `--num-card` (36-44px) | 400 |
| Metric label | Geist | `--type-body` (14px) | 400 |
| Phase label | Geist | `--type-body` (14px) | 500 |
| Phase metric | Geist | `--type-small` (13px) | 400 |
| Time estimate | Geist | `--type-small` (13px) | 400 |

### Colors (v6 §2.1)

| State | Icon | Text | Background |
|-------|------|------|------------|
| Complete | `--success` | `--text-2` | None |
| Active | `--accent` | `--text-1` | `--accent-soft` |
| Pending | `--text-4` | `--text-3` | None |
| Error | `--error` | `--error` | `--error-soft` |

### Motion (v6 §2.10)

| Animation | Duration | Easing |
|-----------|----------|--------|
| Phase transition | 280ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Progress bar fill | 280ms | Same |
| Metric counter | Spring | `stiffness: 100, damping: 20` |
| Active shimmer | 1.5s | `ease-in-out infinite` |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .progress-bar-fill.active::after { animation: none; }
  .phase-icon { transition: none; }
}
```

---

## Error Handling (Competitor-Safe)

| Internal Error | User Message | Action |
|---------------|--------------|--------|
| `RATE_LIMIT_EXCEEDED` | "Analyzing many sites. Retrying shortly..." | Auto-retry |
| `PROXY_FAILED` | "Having trouble reaching the site." | Auto-retry |
| `TIMEOUT` | "Site responding slowly." | Manual retry |
| `API_ERROR` | "Something went wrong." | Report button |

**Never expose:** Proxy names, API endpoints, tier numbers, internal service names.

---

## File Locations

| Component | Path |
|-----------|------|
| `ProspectAnalysisProgress` | `apps/web/src/components/prospects/ProspectAnalysisProgress.tsx` |
| `ClientAuditProgress` | `apps/web/src/components/audit/ClientAuditProgress.tsx` |
| `ArticleGenerationProgress` | `apps/web/src/components/articles/ArticleGenerationProgress.tsx` |
| Shared: `ProgressPhaseList` | `packages/ui/src/components/progress-phase-list.tsx` |
| Shared: `ProgressMetricCard` | `packages/ui/src/components/progress-metric-card.tsx` |
| Hook: `useAnalysisProgress` | `apps/web/src/hooks/use-analysis-progress.ts` |

---

## WebSocket Events (Internal)

```typescript
type ProgressEvent = 
  | { type: 'phase_start'; phase: string; }
  | { type: 'phase_complete'; phase: string; metrics: Record<string, number>; }
  | { type: 'progress_update'; progress: number; }
  | { type: 'error'; message: string; canRetry: boolean; }
  | { type: 'complete'; finalMetrics: Record<string, number>; };
```

Events are internal - users see translated labels, not phase IDs.
