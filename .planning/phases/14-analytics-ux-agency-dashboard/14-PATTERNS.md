# Phase 14: Analytics UX - Agency Dashboard + Per-Client Views - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 12
**Analogs found:** 10 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/app/(shell)/dashboard/page.tsx` | page (RSC) | request-response | `apps/web/src/app/(shell)/clients/page.tsx` | role-match |
| `apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx` | page (hybrid) | request-response | `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` | exact |
| `apps/web/src/components/analytics/DashboardTable.tsx` | component | transform | `apps/web/src/app/(shell)/clients/page.tsx` (client grid) | role-match |
| `apps/web/src/components/analytics/StatusBadge.tsx` | component | transform | `apps/web/src/components/seo/audit/StatusBadge.tsx` | exact |
| `apps/web/src/components/analytics/GSCChart.tsx` | component | transform | `packages/ui/src/components/chart.tsx` | role-match |
| `apps/web/src/components/analytics/GA4Chart.tsx` | component | transform | `packages/ui/src/components/chart.tsx` | role-match |
| `apps/web/src/components/analytics/QueriesTable.tsx` | component | transform | `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/page.tsx` (ResultsView) | role-match |
| `apps/web/src/components/analytics/DateRangeSelector.tsx` | component | event-driven | `packages/ui/src/components/select.tsx` | partial |
| `apps/web/src/components/analytics/StatCard.tsx` | component | transform | `apps/web/src/app/(shell)/clients/[clientId]/page.tsx` (StatCard) | exact |
| `apps/web/src/actions/analytics.ts` | action | request-response | `apps/web/src/actions/seo/audit.ts` | exact |
| `apps/web/src/lib/analytics/queries.ts` | utility | CRUD | `apps/web/src/lib/server-fetch.ts` | role-match |
| `apps/web/src/lib/analytics/types.ts` | type | N/A | `apps/web/src/stores/analyticsStore.ts` | role-match |

## Pattern Assignments

### `apps/web/src/app/(shell)/dashboard/page.tsx` (page, request-response)

**Analog:** `apps/web/src/app/(shell)/clients/page.tsx`

**Note:** Current clients page is a client component. For /dashboard, convert to RSC pattern for server-side data fetching. The structure and layout patterns remain the same.

**Imports pattern** (lines 1-15):
```typescript
"use client";  // NOTE: Remove for RSC - use only for client sub-components

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import {
  Button,
  PageHeader,
  Skeleton,
  StatusChip,
} from "@tevero/ui";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { AddClientModal } from "@/components/onboarding/AddClientModal";
import { Building2, Globe, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
```

**Page layout pattern** (lines 51-63):
```typescript
export default function ClientsPage() {
  // ... hooks and state

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle="Manage your agency clients"
        actions={
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus />
            Add Client
          </Button>
        }
      />
```

**Loading state pattern** (lines 70-84):
```typescript
{/* Loading state - 3 skeleton cards */}
{isLoading && (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="bg-card border border-border rounded-lg p-4 space-y-3"
      >
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    ))}
  </div>
)}
```

**Error state pattern** (lines 86-94):
```typescript
{/* Error state */}
{!isLoading && error && (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <p className="text-sm text-destructive">Failed to load clients</p>
    <Button variant="outline" onClick={fetchClients}>
      Retry
    </Button>
  </div>
)}
```

**Card/row click pattern** (lines 117-157):
```typescript
{clients.map((client) => {
  return (
    <div
      key={client.id}
      onClick={() => handleCardClick(client.id)}
      className={cn(
        "bg-card border border-border rounded-lg p-4",
        "hover:border-border/80 transition-colors cursor-pointer",
        "flex flex-col gap-3"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground truncate">
          {client.name}
        </h3>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      {/* ... additional content */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <StatusChip
          status={(c.cms_type as string) || "draft"}
          label={getCmsLabel(c.cms_type as string | null)}
        />
      </div>
    </div>
  );
})}
```

---

### `apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx` (page, hybrid)

**Analog:** `apps/web/src/app/(shell)/clients/[clientId]/page.tsx`

**Imports pattern** (lines 1-31):
```typescript
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Button,
  CmsHealthBadge,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";
import {
  FileText,
  Calendar,
  Brain,
  Settings,
  PlusCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
```

**StatCard component pattern** (lines 45-61):
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtitle }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
    {subtitle && (
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    )}
  </div>
);
```

**Page header with back navigation** (lines 151-162):
```typescript
<PageHeader
  title={displayClient?.name ?? "Dashboard"}
  subtitle={displayClient?.website_url ?? undefined}
  backHref="/clients"
  actions={
    analytics ? (
      <CmsHealthBadge lastPublishedAt={analytics.last_published_at} />
    ) : undefined
  }
/>
```

**Stat cards grid pattern** (lines 312-351):
```typescript
{/* Stat cards */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  {loading ? (
    <>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      {/* ... more skeleton cards */}
    </>
  ) : analytics ? (
    <>
      <StatCard
        label="Articles Published"
        value={analytics.articles_published_this_month}
        subtitle="this month"
      />
      <StatCard
        label="Total Words"
        value={formatWordCount(analytics.total_word_count_this_month)}
        subtitle="this month"
      />
      <StatCard
        label="Failed Publishes"
        value={analytics.failed_count_this_month}
        subtitle="this month"
      />
    </>
  ) : null}
</div>
```

**Table with StatusChip pattern** (lines 445-489):
```typescript
<div className="rounded-lg border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="text-sm font-medium text-muted-foreground">
          article
        </TableHead>
        <TableHead className="text-sm font-medium text-muted-foreground">
          status
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {publishingLogs.slice(0, 10).map((log) => (
        <TableRow key={log.id}>
          <TableCell className="font-mono text-xs">
            {log.article_id.slice(0, 8)}&hellip;
          </TableCell>
          <TableCell>
            <StatusChip status={log.status} />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

### `apps/web/src/components/analytics/StatusBadge.tsx` (component, transform)

**Analog:** `apps/web/src/components/seo/audit/StatusBadge.tsx`

**Imports pattern** (lines 1-4):
```typescript
"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@tevero/ui";
```

**Badge with icon pattern** (lines 6-28):
```typescript
export function StatusBadge({ status }: { status: string }) {
  if (status === "running") {
    return (
      <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs border-blue-500/30 gap-1">
        <Loader2 className="size-3 animate-spin" /> Running
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge className="bg-green-500/5 text-green-700 dark:text-green-400 text-xs border-green-500/30 gap-1">
        <CheckCircle className="size-3" /> Done
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="text-xs gap-1">
      <AlertCircle className="size-3" /> Failed
    </Badge>
  );
}
```

**Alternative: StatusChip pattern** from `packages/ui/src/components/status-chip.tsx` (lines 72-99):
```typescript
const STATUS_MAP: Record<string, StatusConfig> = {
  published: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  success: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  failed: {
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  warning: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  pulse: forcePulse,
  className,
}) => {
  const config = STATUS_MAP[status] ?? FALLBACK;
  const shouldPulse = forcePulse ?? config.pulse ?? false;
  const displayLabel = label ?? autoLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {shouldPulse && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {displayLabel}
    </span>
  );
};
```

---

### `apps/web/src/components/analytics/GSCChart.tsx` (component, transform)

**Analog:** `packages/ui/src/components/chart.tsx`

**ChartContainer pattern** (lines 1-33):
```typescript
"use client";

import * as React from "react";
import { Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "../lib/utils";

export type ChartConfig = Record<string, { label?: string; color?: string }>;

interface ChartContainerProps {
  config: ChartConfig;
  children: React.ReactElement;
  className?: string;
}

export function ChartContainer({ config, children, className }: ChartContainerProps) {
  const cssVars = Object.entries(config).reduce<Record<string, string>>((acc, [key, val]) => {
    if (val.color) {
      acc[`--color-${key}`] = val.color;
    }
    return acc;
  }, {});

  return (
    <div
      className={cn("relative w-full", className)}
      style={cssVars as React.CSSProperties}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
```

**ChartTooltipContent pattern** (lines 35-63):
```typescript
interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  dataKey?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function ChartTooltipContent({ active, payload, label }: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-sm p-2 text-xs">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((item, index) => (
        <p key={index} className="text-muted-foreground">
          {item.name ?? item.dataKey}: <span className="font-semibold text-foreground">{item.value}</span>
        </p>
      ))}
    </div>
  );
}
```

---

### `apps/web/src/components/analytics/QueriesTable.tsx` (component, transform)

**Analog:** `apps/web/src/app/(shell)/clients/[clientId]/seo/[projectId]/audit/page.tsx` (ResultsView)

**Table pattern** (lines 659-688):
```typescript
{results.pages && results.pages.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle>Crawled Pages</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-1">
        {results.pages.slice(0, 50).map((page) => (
          <div
            key={page.url}
            className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <HttpStatusBadge code={page.statusCode} />
              <span className="truncate text-sm" title={page.url}>
                {extractPathname(page.url)}
              </span>
            </div>
            {page.issues > 0 && (
              <Badge variant="destructive" className="text-xs">
                {page.issues} issues
              </Badge>
            )}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

**Summary cards pattern** (lines 609-655):
```typescript
{/* Summary Cards */}
{results.summary && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Pages Scanned
        </p>
        <p className="text-2xl font-semibold">
          {results.summary.pagesScanned}
        </p>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Issues Found
        </p>
        <p className="text-2xl font-semibold text-red-600">
          {results.summary.issuesFound}
        </p>
      </CardContent>
    </Card>
  </div>
)}
```

---

### `apps/web/src/actions/analytics.ts` (action, request-response)

**Analog:** `apps/web/src/actions/seo/audit.ts`

**Server action imports** (lines 1-3):
```typescript
"use server";

import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
```

**Query builder pattern** (lines 19-30):
```typescript
/**
 * Build query string with client_id and project_id.
 * Phase 10 uses query param fallback (Phase 11 adds Clerk JWT).
 */
function buildQuery(params: AuditParams, extra?: Record<string, string>): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    project_id: params.projectId,
    ...extra,
  });
  return query.toString();
}
```

**Server action function pattern** (lines 36-44):
```typescript
/**
 * Start a new site audit.
 */
export async function startAudit(params: StartAuditParams): Promise<{ auditId: string }> {
  const query = buildQuery(params);
  return postOpenSeo<{ auditId: string }>(`/api/seo/audits?${query}`, {
    action: "start",
    startUrl: params.startUrl,
    maxPages: params.maxPages,
    lighthouseStrategy: params.lighthouseStrategy,
  });
}
```

---

### `apps/web/src/lib/server-fetch.ts` (utility, request-response)

**Analog:** Self (this is the server fetch utility to use)

**Full pattern** (lines 1-70):
```typescript
import "server-only";
import { auth } from "@clerk/nextjs/server";

const AI_WRITER_BACKEND_URL =
  process.env.AI_WRITER_BACKEND_URL ?? "http://ai-writer-backend:8000";
const OPEN_SEO_URL =
  process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

export class FastApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "FastApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: init?.cache ?? "no-store",
    next: init?.next,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new FastApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`);
  }
  return parsed as T;
}

export const getFastApi = <T>(path: string, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "GET", path, undefined, init);
export const postFastApi = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "POST", path, body, init);
```

---

## Shared Patterns

### Table Component
**Source:** `packages/ui/src/components/table.tsx`
**Apply to:** DashboardTable, QueriesTable

```typescript
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@tevero/ui";

// Usage pattern
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="text-sm font-medium text-muted-foreground">
        Column Name
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow key={item.id}>
        <TableCell className="p-4">{item.value}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Badge Component
**Source:** `packages/ui/src/components/badge.tsx`
**Apply to:** StatusBadge, all status indicators

```typescript
import { Badge, badgeVariants } from "@tevero/ui";
import type { BadgeProps } from "@tevero/ui";

// Variants available: default, secondary, destructive, outline, zinc
<Badge variant="destructive" className="text-xs gap-1">
  <Icon className="size-3" />
  Label
</Badge>
```

### Card Component
**Source:** `packages/ui/src/components/card.tsx`
**Apply to:** StatCard, chart containers, section wrappers

```typescript
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "@tevero/ui";

// Stat card pattern
<Card>
  <CardContent className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      Label
    </p>
    <p className="text-2xl font-semibold">{value}</p>
  </CardContent>
</Card>
```

### PageHeader Component
**Source:** `packages/ui/src/components/page-header.tsx`
**Apply to:** All page components

```typescript
import { PageHeader } from "@tevero/ui";

<PageHeader
  title="Page Title"
  subtitle="Optional subtitle"
  backHref="/previous-page"  // Optional back button
  actions={<Button>Action</Button>}  // Optional right-side actions
/>
```

### Zustand Store
**Source:** `apps/web/src/stores/analyticsStore.ts`
**Apply to:** Dashboard filter/sort state (if needed)

```typescript
"use client";

import { create } from "zustand";
import { apiGet } from "@/lib/api-client";

interface StoreState {
  data: DataType | null;
  loading: boolean;
  error: string | null;
  fetchData: (params: Params) => Promise<void>;
}

export const useStore = create<StoreState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchData: async (params) => {
    set({ loading: true, error: null });
    try {
      const data = await apiGet<DataType>(`/api/endpoint/${params.id}`);
      set({ data, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      set({ error: msg, loading: false });
    }
  },
}));
```

### AppShell Navigation
**Source:** `apps/web/src/components/shell/AppShell.tsx`
**Apply to:** Adding Dashboard and Analytics nav items

```typescript
// CLIENT_NAV array pattern (lines 121-164)
const CLIENT_NAV: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (id) => `/clients/${id}`,
    clientScoped: true,
  },
  {
    label: "Analytics",
    icon: BarChart3,  // Already exists at line 156
    href: (id) => `/clients/${id}/analytics`,
    clientScoped: true,
  },
  // ... other items
];

// Add global Dashboard to GLOBAL_NAV or as first item before CLIENT section
```

---

## No Analog Found

Files with no close match in the codebase (use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/components/analytics/DateRangeSelector.tsx` | component | event-driven | No existing date range selector; use Select component as base |
| `apps/web/src/lib/analytics/types.ts` | type | N/A | New type definitions; follow analyticsStore.ts interface patterns |

**DateRangeSelector recommendation:** Use `packages/ui/src/components/select.tsx` as base pattern:
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";

// From audit/page.tsx lines 184-195
<Select value={dateRange} onValueChange={setDateRange}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="30">Last 30 days</SelectItem>
    <SelectItem value="90">Last 90 days</SelectItem>
  </SelectContent>
</Select>
```

---

## Metadata

**Analog search scope:**
- `apps/web/src/app/` - Next.js pages and layouts
- `apps/web/src/components/` - React components
- `apps/web/src/stores/` - Zustand stores
- `apps/web/src/actions/` - Server actions
- `apps/web/src/lib/` - Utilities
- `packages/ui/src/` - Shared UI components

**Files scanned:** 45
**Pattern extraction date:** 2026-04-19

---

## Key Patterns Summary

1. **Page structure:** Use `PageHeader` + sections with `space-y-8` spacing + stat card grids
2. **Loading states:** Skeleton components in same layout as loaded content
3. **Error states:** Centered error message with retry button
4. **Tables:** `@tevero/ui` Table components with `TableHead` for headers
5. **Status indicators:** Badge with icon for status, StatusChip for simpler cases
6. **Server data:** `getFastApi` from `@/lib/server-fetch` for RSC, `apiGet` from `@/lib/api-client` for client components
7. **Server actions:** `"use server"` directive + typed async functions calling `getOpenSeo`/`postOpenSeo`
8. **Charts:** Use `packages/ui/src/components/chart.tsx` ChartContainer with Recharts components
