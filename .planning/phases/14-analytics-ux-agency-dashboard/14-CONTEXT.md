# Phase 14: Analytics UX — Agency Dashboard + Per-Client Views - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Build the analytics UI in `apps/web`. Two surfaces: (1) `/dashboard` — agency overview with all clients' traffic health, anomaly flags, and inline CTAs for unconnected clients; (2) `/clients/[clientId]/analytics` — per-client deep dive with GSC + GA4 side-by-side, trend charts, top queries, position movement. All data served from PostgreSQL snapshots (Phase 13) — no live Google API calls on page load.

</domain>

<decisions>
## Implementation Decisions

### Agency Dashboard `/dashboard`
- Server component (RSC) — data fetched server-side from PostgreSQL snapshot tables
- Shows all clients in a sortable table: name, 30-day clicks, WoW change, avg position, status badge
- Status badges:
  - ✓ Good — clicks within 10% of 30-day rolling avg
  - ↓ Drop — clicks down >20% WoW (shown at top in "Needs attention" section)
  - ! No GSC — no active Google token (shows "Send invite" inline button)
  - ⚠ Stale — last sync >48h ago (shows "Reconnect" inline button)
- "Needs attention" section pinned at top: clients with Drop or Stale status
- Default sort: by clicks descending (highest traffic first)
- Search/filter bar: filter by client name

### Per-Client Analytics `/clients/[clientId]/analytics`
- Hybrid: RSC for initial data, client components for interactive charts
- Three sections stacked vertically:
  1. Search Performance (GSC) — date range selector (30d/90d), summary stats row (clicks/impressions/CTR/position), line chart (clicks + impressions dual axis), top 10 queries table (query, clicks, impressions, CTR, avg position, WoW position change)
  2. Traffic (GA4) — summary stats row (sessions/users/conversions/conv rate), line chart (sessions over time)
  3. SEO Audit — last audit date, issue count, "Run audit" + "View report" buttons (links to Phase 10 audit route)
- Date range selector: 30d (default), 90d — changes both GSC and GA4 charts
- "Sync now" button (optional stretch) — triggers immediate BullMQ sync job for this client

### Charts
- Recharts library (already in both apps) — no new charting library
- GSC chart: dual Y-axis LineChart (clicks left, impressions right)
- GA4 chart: single LineChart (sessions)
- Responsive containers: `<ResponsiveContainer width="100%" height={280}>`

### Anomaly Detection Logic (server-side, computed at query time)
```sql
-- WoW drop detection
WITH recent AS (
  SELECT client_id,
    SUM(clicks) FILTER (WHERE date >= NOW() - INTERVAL '7 days') as clicks_this_week,
    SUM(clicks) FILTER (WHERE date >= NOW() - INTERVAL '14 days'
                         AND date < NOW() - INTERVAL '7 days') as clicks_last_week
  FROM gsc_snapshots GROUP BY client_id
)
SELECT *, 
  CASE WHEN clicks_last_week > 0 
    THEN (clicks_this_week - clicks_last_week)::FLOAT / clicks_last_week 
    ELSE 0 END as wow_change
FROM recent
```

### Navigation Addition
- Add "Dashboard" as first item in sidebar (global, not client-scoped)
- Add "Analytics" to `CLIENT_NAV` in AppShell (per-client, scoped)
- Use BarChart2 icon from lucide-react for analytics

### Claude's Discretion
- Exact color scheme for status badges (use existing shadcn/ui Badge variants)
- Whether to add sparklines to the dashboard table or just numbers
- Pagination vs infinite scroll for 100+ clients on dashboard

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/components/shell/AppShell.tsx` — add Dashboard + Analytics nav items
- Recharts already installed in both apps — `LineChart`, `ResponsiveContainer`, `Tooltip`, `Legend`
- `@tevero/ui` Badge, Card, Table components (from Phase 9)
- `AI-Writer/frontend/src/pages/ClientAnalyticsPage.tsx` — existing analytics page for reference; replace with new GSC+GA4 view

### Established Patterns
- Client pages use Zustand clientStore for activeClientId
- Server components fetch data directly from DB; client components receive as props
- TanStack Query for client-side data refresh (used in open-seo pages)

### Integration Points
- `gsc_snapshots`, `ga4_snapshots` tables — read via FastAPI endpoint or direct Drizzle query from Next.js server action
- `/clients/[clientId]/connections` — link from "No GSC" status in dashboard
- Phase 10 audit routes — linked from per-client analytics "SEO Audit" section

</code_context>

<specifics>
## Specific Ideas

- Agency overview loads fast — RSC with DB query, no loading spinners on initial render
- "Needs attention" clients pinned to top — most important operational signal
- GSC + GA4 side by side on same page — correlated view is the key product value
- All data from PostgreSQL snapshots — never blocks on live Google API

</specifics>

<deferred>
## Deferred Ideas

- Email digest (weekly per-client report) — post v2.0
- Content-to-ranking correlation (article published → ranking change) — post v2.0
- Custom date range picker — post v2.0
- Export to CSV/PDF — post v2.0
- Bing analytics charts — post v2.0

</deferred>
