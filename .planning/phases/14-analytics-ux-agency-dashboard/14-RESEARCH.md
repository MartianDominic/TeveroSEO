# Phase 14: Analytics UX - Agency Dashboard + Per-Client Views - Research

**Researched:** 2026-04-19
**Domain:** Frontend data visualization, React Server Components, Recharts charting
**Confidence:** HIGH

## Summary

Phase 14 builds the analytics UI layer on top of Phase 13's data infrastructure. Two primary surfaces: (1) `/dashboard` as the agency-wide overview showing all clients' organic traffic health with anomaly detection, and (2) `/clients/[id]/analytics` for per-client deep dives with GSC + GA4 charts and top queries.

The implementation is straightforward because the data layer (Phase 13) already provides PostgreSQL snapshot tables (`gsc_snapshots`, `gsc_query_snapshots`, `ga4_snapshots`) and the frontend stack is established (Next.js 15, Recharts 3.8.1, @tevero/ui components). The primary work is composing server components for data fetching, building responsive chart layouts, and implementing the anomaly detection SQL queries.

**Primary recommendation:** Build `/dashboard` as a server component (RSC) that fetches all client analytics data in a single DB query, then pass data to client components for interactive sorting/filtering. Use Recharts' dual-axis LineChart for GSC (clicks/impressions) and single-axis for GA4 (sessions). Status badges via existing `@tevero/ui` Badge component variants.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Agency Dashboard `/dashboard`**
- Server component (RSC) - data fetched server-side from PostgreSQL snapshot tables
- Shows all clients in a sortable table: name, 30-day clicks, WoW change, avg position, status badge
- Status badges:
  - Good - clicks within 10% of 30-day rolling avg
  - Drop - clicks down >20% WoW (shown at top in "Needs attention" section)
  - No GSC - no active Google token (shows "Send invite" inline button)
  - Stale - last sync >48h ago (shows "Reconnect" inline button)
- "Needs attention" section pinned at top: clients with Drop or Stale status
- Default sort: by clicks descending (highest traffic first)
- Search/filter bar: filter by client name

**Per-Client Analytics `/clients/[clientId]/analytics`**
- Hybrid: RSC for initial data, client components for interactive charts
- Three sections stacked vertically:
  1. Search Performance (GSC) - date range selector (30d/90d), summary stats row, line chart (clicks + impressions dual axis), top 10 queries table
  2. Traffic (GA4) - summary stats row, line chart (sessions over time)
  3. SEO Audit - last audit date, issue count, "Run audit" + "View report" buttons
- Date range selector: 30d (default), 90d
- "Sync now" button (optional stretch)

**Charts**
- Recharts library (already in both apps) - no new charting library
- GSC chart: dual Y-axis LineChart (clicks left, impressions right)
- GA4 chart: single LineChart (sessions)
- Responsive containers: `<ResponsiveContainer width="100%" height={280}>`

**Anomaly Detection Logic (server-side, computed at query time)**
```sql
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

**Navigation Addition**
- Add "Dashboard" as first item in sidebar (global, not client-scoped)
- Add "Analytics" to CLIENT_NAV in AppShell (per-client, scoped)
- Use BarChart2 icon from lucide-react for analytics

### Claude's Discretion
- Exact color scheme for status badges (use existing shadcn/ui Badge variants)
- Whether to add sparklines to the dashboard table or just numbers
- Pagination vs infinite scroll for 100+ clients on dashboard

### Deferred Ideas (OUT OF SCOPE)
- Email digest (weekly per-client report) - post v2.0
- Content-to-ranking correlation - post v2.0
- Custom date range picker - post v2.0
- Export to CSV/PDF - post v2.0
- Bing analytics charts - post v2.0

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | `/dashboard` loads in < 1s (server-rendered) | RSC pattern with direct DB query; no client-side data fetch on initial render |
| UX-02 | Client with GSC token shows clicks, impressions, CTR, avg position | `gsc_snapshots` table provides all metrics; 30-day aggregation via SQL |
| UX-03 | Client with >20% WoW drop appears in "Needs attention" section | Anomaly SQL query computes wow_change; filter clients where wow_change < -0.20 |
| UX-04 | Client with no Google connection shows "Connect Google" CTA inline | Join clients with client_oauth_tokens; null token = show CTA |
| UX-05 | `/clients/[id]/analytics` renders GSC line chart | Recharts LineChart with dual YAxis pattern verified |
| UX-06 | GA4 summary + sessions chart displayed | `ga4_snapshots` table provides sessions, users, conversions |
| UX-07 | Top 10 queries table with position WoW change | `gsc_query_snapshots` table; join last 7d vs prior 7d for change |
| UX-08 | Date range selector (30d/90d) | Client component state controls SQL date filter; RSC re-fetches on change |
| UX-09 | Status badges (Good/Drop/No GSC/Stale) | Badge component from @tevero/ui; variant mapping to status |
| UX-10 | Dashboard search/filter by client name | Client-side filtering on pre-loaded client list |
| UX-11 | Dashboard sorted by clicks descending default | SQL ORDER BY clicks DESC; client-side re-sort possible |
| UX-12 | Recharts used for all charts; no new library | Recharts 3.8.1 already installed and verified |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dashboard data aggregation | Next.js Server (RSC) | PostgreSQL | Heavy SQL aggregation runs on DB; RSC orchestrates and returns HTML |
| Anomaly detection | PostgreSQL | Next.js Server | Window functions for WoW calculation belong in SQL |
| Client sorting/filtering | Browser (Client Component) | - | Interactive re-ordering of pre-fetched data |
| Chart rendering | Browser (Client Component) | - | Recharts requires client-side React for SVG interactivity |
| Date range selection | Browser (Client Component) | Next.js Server | State lives in browser; triggers server action for data refresh |
| Status badge rendering | Next.js Server (RSC) | - | Static badge based on computed status |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.15 | App Router, RSC, server actions | [VERIFIED: package.json] Already in use |
| Recharts | 3.8.1 | LineChart, ResponsiveContainer, dual-axis | [VERIFIED: npm ls] Already in apps/web and @tevero/ui |
| @tevero/ui | workspace:* | Badge, Card, Table, Skeleton, PageHeader | [VERIFIED: package.json] Phase 9 established |
| Tailwind CSS | 4.1.17 | Styling | [VERIFIED: package.json] Already configured |
| lucide-react | 0.543.0 | Icons (BarChart2, TrendingDown, AlertCircle) | [VERIFIED: package.json] Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.1.0 | Date formatting, relative time | [VERIFIED: package.json] Format dates in charts and tables |
| zustand | 5.0.12 | Client-side filter/sort state | [VERIFIED: package.json] Existing store pattern |
| @tanstack/react-query | 5.99.0 | Date range refresh (optional) | [VERIFIED: package.json] For "Sync now" stretch goal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Victory, Nivo | Recharts already installed; switching adds bundle size and learning curve |
| Server actions for date change | Client-side fetch | Server actions keep auth simple; no CORS, no exposed endpoints |
| Zustand for filter state | URL params | URL params better for shareable links but adds complexity |

**Installation:**
No new packages required. All dependencies already installed.

**Version verification:** [VERIFIED: npm view, pnpm ls]
- recharts: 3.8.1 (latest stable as of 2026-04)
- Next.js: 15.5.15 (matches apps/web)

## Architecture Patterns

### System Architecture Diagram

```
Browser Request
       |
       v
+------------------+
| /dashboard       | <-- RSC fetches all clients + analytics in one query
| (Server Comp.)   |
+------------------+
       |
       v
+------------------+     +--------------------+
| PostgreSQL       | --> | gsc_snapshots      |
|                  |     | gsc_query_snapshots|
|                  |     | ga4_snapshots      |
|                  |     | client_oauth_tokens|
|                  |     | clients            |
+------------------+     +--------------------+
       |
       v
+------------------+
| Server HTML      | --> Streamed to browser with initial data
+------------------+
       |
       v
+------------------+
| Client Component | --> Interactive sorting, filtering, sparklines
| (DashboardTable) |
+------------------+

Per-Client Analytics Flow:
Browser Request (/clients/[id]/analytics)
       |
       v
+------------------+
| page.tsx (RSC)   | <-- Fetches last 30/90 days of snapshots
+------------------+
       |
       +---> GSCChart (Client) --> Recharts LineChart (dual axis)
       |
       +---> GA4Chart (Client) --> Recharts LineChart (single axis)
       |
       +---> QueriesTable (Client) --> Sortable table with position delta
```

### Recommended Project Structure
```
apps/web/src/
├── app/
│   ├── (shell)/
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Agency dashboard (RSC)
│   │   └── clients/[clientId]/
│   │       └── analytics/
│   │           └── page.tsx         # Per-client analytics (RSC)
├── components/
│   └── analytics/
│       ├── DashboardTable.tsx       # Client component: sortable client table
│       ├── StatusBadge.tsx          # Status badge wrapper
│       ├── GSCChart.tsx             # Dual-axis LineChart for GSC
│       ├── GA4Chart.tsx             # Single-axis LineChart for GA4
│       ├── QueriesTable.tsx         # Top queries with position delta
│       ├── DateRangeSelector.tsx    # 30d/90d toggle
│       └── StatCard.tsx             # Reusable stat display card
├── lib/
│   └── analytics/
│       ├── queries.ts               # SQL query functions
│       └── types.ts                 # TypeScript interfaces
└── stores/
    └── analyticsFilterStore.ts      # Filter/sort state (optional)
```

### Pattern 1: RSC Data Fetching with SQL Aggregation
**What:** Server component fetches aggregated data directly via SQL, passes to client components as props
**When to use:** Dashboard pages where initial data is critical for LCP
**Example:**
```typescript
// Source: Next.js App Router docs + project patterns
// apps/web/src/app/(shell)/dashboard/page.tsx

import { getFastApi } from "@/lib/server-fetch";
import { DashboardTable } from "@/components/analytics/DashboardTable";

interface DashboardClient {
  id: string;
  name: string;
  clicks_30d: number;
  impressions_30d: number;
  avg_position: number;
  wow_change: number;
  status: "good" | "drop" | "no_gsc" | "stale";
  last_sync: string | null;
}

async function getDashboardData(): Promise<DashboardClient[]> {
  return getFastApi<DashboardClient[]>("/api/analytics/dashboard");
}

export default async function DashboardPage() {
  const clients = await getDashboardData();
  
  // Server-side: split into attention needed vs healthy
  const needsAttention = clients.filter(c => c.status === "drop" || c.status === "stale");
  const healthy = clients.filter(c => c.status === "good" || c.status === "no_gsc");
  
  return (
    <div className="p-8 space-y-8">
      {needsAttention.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-amber-600 mb-4">
            Needs Attention ({needsAttention.length})
          </h2>
          <DashboardTable clients={needsAttention} />
        </section>
      )}
      <section>
        <h2 className="text-lg font-semibold mb-4">All Clients</h2>
        <DashboardTable clients={healthy} />
      </section>
    </div>
  );
}
```

### Pattern 2: Recharts Dual-Axis LineChart
**What:** LineChart with two Y-axes for different scales (clicks vs impressions)
**When to use:** GSC chart where clicks and impressions have different magnitudes
**Example:**
```typescript
// Source: Context7 recharts docs - Bi-axial chart pattern
// apps/web/src/components/analytics/GSCChart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface GSCDataPoint {
  date: string;
  clicks: number;
  impressions: number;
}

interface GSCChartProps {
  data: GSCDataPoint[];
}

export function GSCChart({ data }: GSCChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis 
          yAxisId="left" 
          orientation="left" 
          stroke="hsl(var(--primary))"
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="clicks"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="Clicks"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="impressions"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={2}
          dot={false}
          name="Impressions"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 3: Server Action for Date Range Refresh
**What:** Client component triggers server action to refetch data with new date range
**When to use:** Date range selector that changes displayed data
**Example:**
```typescript
// apps/web/src/app/(shell)/clients/[clientId]/analytics/actions.ts
"use server";

import { getFastApi } from "@/lib/server-fetch";

export interface AnalyticsData {
  gsc_daily: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  gsc_summary: { clicks: number; impressions: number; ctr: number; position: number };
  ga4_daily: Array<{ date: string; sessions: number; users: number }>;
  ga4_summary: { sessions: number; users: number; conversions: number; bounce_rate: number };
  top_queries: Array<{ query: string; clicks: number; impressions: number; position: number; position_delta: number }>;
}

export async function fetchAnalyticsData(
  clientId: string,
  days: 30 | 90
): Promise<AnalyticsData> {
  return getFastApi<AnalyticsData>(`/api/analytics/${clientId}/full?days=${days}`);
}
```

### Anti-Patterns to Avoid
- **Client-side data fetching for initial render:** Never use useEffect to fetch dashboard data on mount. RSC fetches server-side, streams to browser. Client fetch adds loading spinners and hurts LCP.
- **Multiple small DB queries:** Don't fetch clients, then analytics, then tokens separately. Use JOIN queries to get all data in one roundtrip.
- **Hardcoded chart colors:** Use CSS variables (`hsl(var(--primary))`) so charts respect theme.
- **Unnecessary client components:** If a component just displays data with no interactivity, keep it as RSC.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG charts | Recharts 3.8.1 | Responsive containers, accessibility, touch support |
| Date formatting | Custom date functions | date-fns 4.1.0 | Already installed, handles edge cases |
| SQL aggregation | Application-level loops | PostgreSQL window functions | DB-level aggregation is faster, handles NULL edge cases |
| Table sorting | Custom sort implementation | Array.sort with Intl.Collator | Browser-native, locale-aware |
| Status badges | Custom badge component | @tevero/ui Badge | Already exists with proper variants |

**Key insight:** The analytics UI is a presentation layer over Phase 13's data infrastructure. All heavy lifting (data collection, token refresh, anomaly calculation) happens in the data layer. Phase 14 composes existing components.

## Common Pitfalls

### Pitfall 1: Client-Side Data Fetch Race Conditions
**What goes wrong:** Multiple date range changes trigger concurrent fetches; stale data overwrites fresh data
**Why it happens:** Server action returns out of order; component updates with stale response
**How to avoid:** Use transition or loading state to disable selector during fetch; abort previous fetch on new selection
**Warning signs:** Chart shows wrong date range; data flickers

### Pitfall 2: Missing Data for New Clients
**What goes wrong:** Client with recently connected Google shows empty charts
**Why it happens:** Backfill hasn't completed yet (up to 2 hours)
**How to avoid:** Check if `gsc_snapshots` has any rows for client; show "Data syncing..." placeholder if < 3 days of data
**Warning signs:** Blank charts, no error message

### Pitfall 3: ResponsiveContainer in SSR
**What goes wrong:** Recharts errors during server render; hydration mismatch
**Why it happens:** ResponsiveContainer uses window dimensions; no window on server
**How to avoid:** Mark chart components as `"use client"`; never put Recharts in RSC
**Warning signs:** Hydration error, chart not rendering, console warnings

### Pitfall 4: Timezone Confusion in Date Comparisons
**What goes wrong:** WoW calculation off by one day; wrong data shown
**Why it happens:** PostgreSQL stores UTC; JavaScript Date uses local timezone
**How to avoid:** All date comparisons in SQL (UTC); frontend just formats for display
**Warning signs:** Data mismatch between dashboard and per-client view; "yesterday" shows wrong date

### Pitfall 5: Status Badge Color Accessibility
**What goes wrong:** Red/green badges indistinguishable for colorblind users
**Why it happens:** Relying only on color to convey meaning
**How to avoid:** Include icon or text label alongside color (e.g., TrendingDown icon for "Drop")
**Warning signs:** User reports badges look the same

## Code Examples

### Dashboard API Endpoint SQL (FastAPI)
```python
# Source: Phase 13 schema + CONTEXT.md anomaly query
# AI-Writer/backend/api/seo_analytics.py

from datetime import datetime, timedelta
from sqlalchemy import text

DASHBOARD_QUERY = text("""
WITH gsc_recent AS (
  SELECT 
    client_id,
    SUM(clicks) FILTER (WHERE date >= NOW() - INTERVAL '30 days') as clicks_30d,
    SUM(impressions) FILTER (WHERE date >= NOW() - INTERVAL '30 days') as impressions_30d,
    AVG(position) FILTER (WHERE date >= NOW() - INTERVAL '30 days') as avg_position,
    SUM(clicks) FILTER (WHERE date >= NOW() - INTERVAL '7 days') as clicks_7d,
    SUM(clicks) FILTER (WHERE date >= NOW() - INTERVAL '14 days' 
                         AND date < NOW() - INTERVAL '7 days') as clicks_prev_7d,
    MAX(synced_at) as last_sync
  FROM gsc_snapshots
  GROUP BY client_id
),
client_status AS (
  SELECT 
    c.id,
    c.name,
    COALESCE(g.clicks_30d, 0) as clicks_30d,
    COALESCE(g.impressions_30d, 0) as impressions_30d,
    COALESCE(g.avg_position, 0) as avg_position,
    CASE 
      WHEN g.clicks_prev_7d > 0 
      THEN (g.clicks_7d - g.clicks_prev_7d)::FLOAT / g.clicks_prev_7d 
      ELSE 0 
    END as wow_change,
    g.last_sync,
    CASE
      WHEN t.id IS NULL THEN 'no_gsc'
      WHEN g.last_sync < NOW() - INTERVAL '48 hours' THEN 'stale'
      WHEN g.clicks_prev_7d > 0 
           AND (g.clicks_7d - g.clicks_prev_7d)::FLOAT / g.clicks_prev_7d < -0.20 THEN 'drop'
      ELSE 'good'
    END as status
  FROM clients c
  LEFT JOIN gsc_recent g ON c.id = g.client_id
  LEFT JOIN client_oauth_tokens t ON c.id = t.client_id 
    AND t.provider = 'google' 
    AND t.is_active = true
  WHERE c.is_archived = false
)
SELECT * FROM client_status
ORDER BY clicks_30d DESC
""")
```

### Status Badge Component
```typescript
// apps/web/src/components/analytics/StatusBadge.tsx
"use client";

import { Badge } from "@tevero/ui";
import { TrendingDown, AlertCircle, Link2Off, CheckCircle2 } from "lucide-react";

type ClientStatus = "good" | "drop" | "no_gsc" | "stale";

const STATUS_CONFIG: Record<ClientStatus, {
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  good: { variant: "default", icon: CheckCircle2, label: "Healthy" },
  drop: { variant: "destructive", icon: TrendingDown, label: "Traffic Drop" },
  no_gsc: { variant: "outline", icon: Link2Off, label: "Not Connected" },
  stale: { variant: "secondary", icon: AlertCircle, label: "Sync Stale" },
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </Badge>
  );
}
```

### Top Queries Table
```typescript
// apps/web/src/components/analytics/QueriesTable.tsx
"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tevero/ui";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Query {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  position_delta: number; // negative = improved (lower position is better)
}

function PositionDelta({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (delta < 0) {
    // Position improved (went down, e.g., 10 -> 5)
    return (
      <span className="flex items-center text-emerald-600">
        <TrendingUp className="h-4 w-4 mr-1" />
        {Math.abs(delta).toFixed(1)}
      </span>
    );
  }
  // Position worsened
  return (
    <span className="flex items-center text-red-600">
      <TrendingDown className="h-4 w-4 mr-1" />
      {delta.toFixed(1)}
    </span>
  );
}

export function QueriesTable({ queries }: { queries: Query[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Query</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
          <TableHead className="text-right">Impressions</TableHead>
          <TableHead className="text-right">CTR</TableHead>
          <TableHead className="text-right">Position</TableHead>
          <TableHead className="text-right">WoW</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {queries.map((q) => (
          <TableRow key={q.query}>
            <TableCell className="font-medium max-w-[200px] truncate" title={q.query}>
              {q.query}
            </TableCell>
            <TableCell className="text-right tabular-nums">{q.clicks.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">{q.impressions.toLocaleString()}</TableCell>
            <TableCell className="text-right tabular-nums">{(q.ctr * 100).toFixed(1)}%</TableCell>
            <TableCell className="text-right tabular-nums">{q.position.toFixed(1)}</TableCell>
            <TableCell className="text-right">
              <PositionDelta delta={q.position_delta} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side fetch + loading spinners | RSC with streamed HTML | Next.js 13+ (2022) | Faster LCP, no layout shift |
| Separate chart library per use case | Recharts composable components | Recharts 2.0 (2021) | Consistent API, smaller bundle |
| REST endpoints for each data slice | Single aggregate endpoint | GraphQL influence | Fewer roundtrips, simpler client |

**Deprecated/outdated:**
- `pages/` directory: Use App Router `app/` directory instead
- `getServerSideProps`: Use async server components
- Recharts 2.x: Now on 3.8.1 with improved SSR handling

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dashboard SQL query can run in < 200ms for 100 clients | Architecture Patterns | May need index tuning; worst case add pagination |
| A2 | @tevero/ui Badge supports "destructive" variant | Code Examples | May need to add variant or use different component |
| A3 | Recharts handles dark mode via CSS variables | Code Examples | May need explicit color props per theme |

## Open Questions

1. **Pagination vs infinite scroll for dashboard?**
   - What we know: CONTEXT.md marks as Claude's discretion
   - What's unclear: Typical client count (10? 100? 500?)
   - Recommendation: Start with client-side filtering on full list (up to ~200 clients); add pagination if > 200

2. **Sparklines in dashboard table?**
   - What we know: CONTEXT.md marks as Claude's discretion
   - What's unclear: Performance impact of 100+ tiny Recharts instances
   - Recommendation: Start without sparklines (just numbers); consider adding as stretch if time permits

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js | Y | 20.20.2 | - |
| pnpm | Workspace | Y | 10.26.0 | - |
| PostgreSQL | Data queries | Y | (Docker) | - |
| Recharts | Charts | Y | 3.8.1 | - |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently configured for apps/web |
| Config file | Wave 0 task: add vitest.config.ts |
| Quick run command | `pnpm --filter @tevero/web test` |
| Full suite command | `pnpm --filter @tevero/web test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Dashboard loads < 1s | e2e | Playwright timing assertion | Wave 0 |
| UX-02 | GSC metrics displayed | integration | Mock API, check rendered values | Wave 0 |
| UX-03 | Attention section shows drops | unit | Filter function test | Wave 0 |
| UX-04 | No GSC CTA displayed | unit | Conditional render test | Wave 0 |
| UX-05 | GSC LineChart renders | component | Recharts smoke test | Wave 0 |
| UX-06 | GA4 chart renders | component | Recharts smoke test | Wave 0 |
| UX-07 | Queries table with delta | unit | Position delta calculation test | Wave 0 |
| UX-08 | Date range selector | integration | State change triggers refetch | Wave 0 |
| UX-09 | Status badges | unit | Badge variant mapping test | Wave 0 |
| UX-10 | Client name filter | unit | Filter function test | Wave 0 |
| UX-11 | Default sort by clicks | unit | Sort function test | Wave 0 |
| UX-12 | Only Recharts used | manual | Package audit | N/A |

### Sampling Rate
- **Per task commit:** Build passes (`pnpm build`)
- **Per wave merge:** Full TypeScript check (`pnpm typecheck`)
- **Phase gate:** Manual smoke test of dashboard and per-client views

### Wave 0 Gaps
- [ ] `apps/web/vitest.config.ts` - test framework setup
- [ ] `apps/web/src/__tests__/` - test directory structure
- [ ] Component testing utilities for Recharts

*(Note: Test infrastructure is a Wave 0 consideration but not blocking for UI-only phase)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Clerk middleware on all /dashboard and /clients/* routes |
| V3 Session Management | Yes | Clerk handles session tokens |
| V4 Access Control | Yes | Client-scoped data queries validated server-side |
| V5 Input Validation | Yes | Date range selector: 30 or 90 only; no arbitrary dates |
| V6 Cryptography | No | No direct crypto operations in this phase |

### Known Threat Patterns for Next.js + Analytics

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on client analytics | Tampering | Server action validates user has access to clientId |
| SQL injection in date filter | Tampering | Parameterized queries; enum for days (30|90) |
| Sensitive data in client bundle | Information Disclosure | Analytics data fetched server-side only |
| Rate limiting on dashboard | Denial of Service | Clerk rate limits + edge cache |

## Sources

### Primary (HIGH confidence)
- [Context7 /recharts/recharts] - LineChart, ResponsiveContainer, dual-axis pattern
- [Context7 /vercel/next.js] - Server Components, async page data fetching
- [apps/web/package.json] - Version verification for all dependencies
- [AI-Writer/backend/models/analytics_snapshots.py] - Schema verification for gsc_snapshots, ga4_snapshots
- [14-CONTEXT.md] - Locked decisions from /gsd-discuss-phase

### Secondary (MEDIUM confidence)
- [apps/web/src/components/shell/AppShell.tsx] - Existing navigation pattern
- [apps/web/src/stores/analyticsStore.ts] - Existing store pattern for reference
- [@tevero/ui components] - Badge, Card, Table component APIs

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified as already installed
- Architecture: HIGH - RSC + Recharts pattern well-documented, matches existing codebase
- Pitfalls: MEDIUM - Based on common React/Recharts issues; may discover more during implementation

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days - stable stack, no major releases expected)
