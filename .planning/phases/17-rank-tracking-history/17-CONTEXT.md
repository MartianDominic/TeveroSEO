# Phase 17: Rank Tracking History - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add daily rank history to existing `saved_keywords` system. BullMQ worker checks positions for all saved keywords daily. Rank history stored for trend analysis. Extends existing DataForSEO SERP integration.

</domain>

<decisions>
## Implementation Decisions

### Rank History Storage
- `keyword_rankings` table stores daily position snapshots
- Foreign key to `saved_keywords` table
- Store: position, date, URL, SERP features present
- Partition by month for efficient querying (future optimization)
- Retain 365 days of history per keyword

### Daily Ranking Check
- BullMQ job `check-keyword-rankings` runs daily at 03:00 UTC
- Reuse existing DataForSEO SERP client with rate limiting
- Process keywords in batches of 100 to avoid API rate limits
- Skip keywords with `tracking_enabled: false`
- Graceful handling of API failures (retry, skip, continue)

### Existing Foundation to Extend
- `saved_keywords` table — keywords to track per project
- `keyword_metrics` table — cached latest metrics
- DataForSEO SERP live API — on-demand position checks
- BullMQ infrastructure — audit + analytics + report workers

### UI Extensions
- `/clients/[id]/seo/keywords` — add position history column and trend sparkline
- Keyword detail view — show 30/90-day position chart
- Position change indicators (up/down arrows with delta)
- SERP feature badges when present

### Claude's Discretion
- Specific sparkline library/implementation
- Chart styling and tooltip format
- Batch size optimization
- Error retry strategy details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- DataForSEO SERP client in open-seo-main
- BullMQ worker patterns from phases 15, 16
- Recharts for charts (used in reports)
- Keywords page components

### Established Patterns
- BullMQ with sandboxed processors
- Drizzle schema patterns
- Server actions for data fetching
- shadcn/ui components

### Integration Points
- Extend: `saved_keywords` table (add tracking_enabled)
- New: `keyword_rankings` table
- New: BullMQ queue `ranking-check`
- Extend: `/clients/[id]/seo/keywords` page

</code_context>

<specifics>
## Specific Ideas

### Ranking Schema
```typescript
interface KeywordRanking {
  id: string;
  keywordId: string; // FK to saved_keywords
  position: number;
  previousPosition?: number;
  url?: string; // ranking URL
  date: Date;
  serpFeatures?: string[]; // featured snippet, local pack, etc.
  createdAt: Date;
}
```

### Sparkline Component
- Show last 30 days of position data
- Green for improvement, red for decline
- Tooltip shows exact position on hover
- Click opens full chart view

</specifics>

<deferred>
## Deferred Ideas

### Advanced Analytics (Future)
- Competitor rank tracking
- SERP feature opportunity detection
- Rank volatility alerts
- Position clustering analysis

### Performance Optimizations (Future)
- Table partitioning by month
- Materialized views for aggregations
- Redis caching for recent data

</deferred>
