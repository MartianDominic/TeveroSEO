# Phase 15: Report Generation Engine - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 12 (new/modified files)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `open-seo-main/src/server/queues/reportQueue.ts` | queue | request-response | `analyticsQueue.ts` | exact |
| `open-seo-main/src/server/workers/report-worker.ts` | worker | request-response | `analytics-worker.ts` | exact |
| `open-seo-main/src/server/workers/report-processor.ts` | processor | batch | `analytics-processor.ts` | exact |
| `apps/web/src/app/api/reports/generate/route.ts` | api-route | request-response | `articles/route.ts` | exact |
| `apps/web/src/app/api/reports/[id]/download/route.ts` | api-route | file-I/O | `articles/[articleId]/route.ts` | role-match |
| `apps/web/src/components/reports/ReportHeader.tsx` | component | render | `StatCard.tsx` | role-match |
| `apps/web/src/components/reports/ReportSummaryStats.tsx` | component | render | `StatCard.tsx` | exact |
| `apps/web/src/components/reports/ReportGSCChart.tsx` | component | render | `GSCChart.tsx` | exact |
| `apps/web/src/components/reports/ReportGA4Chart.tsx` | component | render | `GA4Chart.tsx` | exact |
| `apps/web/src/components/reports/ReportQueriesTable.tsx` | component | render | `QueriesTable.tsx` | exact |
| `apps/web/src/components/reports/ReportContainer.tsx` | component | render | `StatCard.tsx` | role-match |
| `docker-compose.vps.yml` (modify) | config | N/A | existing file | exact |

---

## Pattern Assignments

### `open-seo-main/src/server/queues/reportQueue.ts` (queue, request-response)

**Analog:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/analyticsQueue.ts`

**Imports pattern** (lines 1-14):
```typescript
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "reportQueue" });

export const REPORT_QUEUE_NAME = "report-generation" as const;
```

**Job data interface pattern** (lines 35-45):
```typescript
export interface ReportJobData {
  reportId: string;
  clientId: string;
  dateRange: { startDate: string; endDate: string };
  templateId: string;
  locale: string;
  outputPath: string;
}
```

**Default job options pattern** (lines 61-69):
```typescript
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
```

**Queue instantiation pattern** (lines 71-76):
```typescript
export const reportQueue = new Queue<ReportJobData>(REPORT_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:report"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});
```

---

### `open-seo-main/src/server/workers/report-worker.ts` (worker, request-response)

**Analog:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/analytics-worker.ts`

**Imports pattern** (lines 1-26):
```typescript
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  REPORT_QUEUE_NAME,
  reportQueue,
  type ReportJobData,
  type ReportDLQJobData,
} from "@/server/queues/reportQueue";

const workerLogger = createLogger({ module: "report-worker" });
```

**Worker configuration pattern** (lines 30-50):
```typescript
const LOCK_DURATION_MS = 120_000; // BQ-05
const MAX_STALLED_COUNT = 2; // BQ-06
const SHUTDOWN_TIMEOUT_MS = 25_000; // BQ-06

const PROCESSOR_PATH = fileURLToPath(
  new URL("./report-processor.js", import.meta.url),
);

let worker: Worker<ReportJobData> | null = null;

export async function startReportWorker(): Promise<Worker<ReportJobData>> {
  if (worker) return worker;

  worker = new Worker<ReportJobData>(
    REPORT_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:report"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 2, // Limit concurrent PDF renders
    },
  );
```

**Event handlers pattern** (lines 109-140):
```typescript
  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: REPORT_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (job: Job<ReportJobData> | undefined, err: Error) => {
      // ... DLQ handling
    },
  );

  worker.on("completed", (job) => {
    const jobLogger = createLogger({
      module: "report-worker",
      jobId: job.id,
      clientId: job.data.clientId,
    });
    jobLogger.info("Job completed");
  });
```

**Graceful shutdown pattern** (lines 188-211):
```typescript
export async function stopReportWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    workerLogger.error("Graceful shutdown timeout exceeded, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }
}
```

---

### `open-seo-main/src/server/workers/report-processor.ts` (processor, batch)

**Analog:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/analytics-processor.ts`

**Imports pattern** (lines 1-16):
```typescript
import type { Job } from "bullmq";
import type { ReportJobData } from "@/server/queues/reportQueue";
import { createLogger, type Logger } from "@/server/lib/logger";
import { db } from "@/db";
```

**Main processor export pattern** (lines 105-126):
```typescript
export default async function processReportJob(
  job: Job<ReportJobData>,
): Promise<void> {
  const logger = createLogger({
    module: "report-processor",
    jobId: job.id,
    clientId: job.data.clientId,
  });

  logger.info("Starting report generation", {
    reportId: job.data.reportId,
    templateId: job.data.templateId,
  });

  // Step 1: Fetch data
  // Step 2: Render HTML
  // Step 3: Generate PDF via Puppeteer
  // Step 4: Write to filesystem
  // Step 5: Update database
}
```

---

### `apps/web/src/app/api/reports/generate/route.ts` (api-route, request-response)

**Analog:** `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/articles/route.ts`

**Imports pattern** (lines 1-5):
```typescript
import { NextResponse } from "next/server";
import { postOpenSeo, FastApiError } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

**POST handler pattern** (lines 23-38):
```typescript
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const body = await req.json();
    const data = await postOpenSeo(`/api/reports/generate${qs}`, body);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof FastApiError) {
      return NextResponse.json(err.body ?? { error: err.message }, {
        status: err.status,
      });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

### `apps/web/src/components/reports/ReportGSCChart.tsx` (component, render)

**Analog:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/analytics/GSCChart.tsx`

**Full pattern** (lines 1-85):
```typescript
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
import type { GSCDataPoint } from "@/lib/analytics/types";

interface ReportGSCChartProps {
  data: GSCDataPoint[];
  title?: string;
}

export function ReportGSCChart({ data, title }: ReportGSCChartProps) {
  const formatDate = (label: unknown) => {
    if (label == null) return "";
    const date = new Date(String(label));
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={formatDate}
          className="text-muted-foreground"
        />
        {/* ... dual Y-axis pattern for clicks/impressions */}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

### `apps/web/src/components/reports/ReportSummaryStats.tsx` (component, render)

**Analog:** `/home/dominic/Documents/TeveroSEO/apps/web/src/components/analytics/StatCard.tsx`

**Component import pattern** (lines 1-11):
```typescript
import { Card, CardContent } from "@tevero/ui";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
}
```

**Trend indicator pattern** (lines 25-36):
```typescript
{trend && (
  <p
    className={`text-xs mt-1 ${
      trend.value > 0
        ? "text-emerald-600"
        : trend.value < 0
        ? "text-red-600"
        : "text-muted-foreground"
    }`}
  >
    {trend.value > 0 ? "+" : ""}
    {trend.value.toFixed(1)}% {trend.label}
  </p>
)}
```

---

### `docker-compose.vps.yml` (modify — volume mounting)

**Analog:** Current file at `/home/dominic/Documents/TeveroSEO/docker-compose.vps.yml`

**Volume definition pattern** (lines 249-254):
```yaml
volumes:
  postgres_data:
  redis_data:
  ai_writer_workspace:
  reports_data:  # ADD THIS
  letsencrypt_conf:
  letsencrypt_www:
```

**Service volume mount pattern** (add to open-seo service, around line 78):
```yaml
    volumes:
      - reports_data:/data/reports
```

**Worker volume mount pattern** (add to open-seo-worker service, around line 114):
```yaml
    volumes:
      - reports_data:/data/reports
```

---

## Shared Patterns

### Clerk Auth via server-fetch

**Source:** `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/server-fetch.ts`
**Apply to:** All API routes in `apps/web/src/app/api/reports/`

```typescript
import "server-only";
import { auth } from "@clerk/nextjs/server";

async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

### Structured Logging

**Source:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/logger.ts`
**Apply to:** All worker and processor files

```typescript
import { createLogger, type Logger } from "@/server/lib/logger";

const logger = createLogger({
  module: "report-processor",
  jobId: job.id,
  clientId: job.data.clientId,
});

logger.info("Processing started", { mode: "pdf" });
logger.error("PDF generation failed", error, { timeout: 60000 });
```

### Shared Redis Connection

**Source:** `/home/dominic/Documents/TeveroSEO/open-seo-main/src/server/lib/redis.ts`
**Apply to:** Queue and worker files

```typescript
import { getSharedBullMQConnection } from "@/server/lib/redis";

// Queues use "queue:" prefix
connection: getSharedBullMQConnection("queue:report"),

// Workers use "worker:" prefix
connection: getSharedBullMQConnection("worker:report"),
```

### shadcn/ui Card Components

**Source:** `/home/dominic/Documents/TeveroSEO/packages/ui/src/components/card.tsx`
**Apply to:** All report components

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";

// Standard card layout
<Card>
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
  </CardHeader>
  <CardContent className="p-6 pt-0">
    {/* content */}
  </CardContent>
</Card>
```

### Recharts Container Pattern

**Source:** `/home/dominic/Documents/TeveroSEO/packages/ui/src/components/chart.tsx`
**Apply to:** All chart components in reports

```typescript
import { ResponsiveContainer } from "recharts";

// Always wrap charts in ResponsiveContainer
<ResponsiveContainer width="100%" height={280}>
  <LineChart data={data}>
    {/* ... */}
  </LineChart>
</ResponsiveContainer>
```

---

## Anti-Patterns to Avoid

### 1. Direct Redis Connection Creation

**Wrong:**
```typescript
// DO NOT create new Redis connections directly
const redis = new IORedis(process.env.REDIS_URL);
const queue = new Queue("reports", { connection: redis });
```

**Correct:**
```typescript
// USE shared connection pool
const queue = new Queue("reports", {
  connection: getSharedBullMQConnection("queue:report"),
});
```

### 2. Inline Processor Functions

**Wrong:**
```typescript
// DO NOT use inline processor (blocks main event loop)
const worker = new Worker("reports", async (job) => {
  // Heavy Puppeteer work here blocks everything
});
```

**Correct:**
```typescript
// USE sandboxed processor via file path
const PROCESSOR_PATH = fileURLToPath(
  new URL("./report-processor.js", import.meta.url),
);
const worker = new Worker("reports", PROCESSOR_PATH, { /* options */ });
```

### 3. Missing Graceful Shutdown

**Wrong:**
```typescript
// DO NOT forget shutdown handling
export function startWorker() {
  return new Worker(/* ... */);
}
// No stopWorker function = orphaned jobs on deploy
```

**Correct:**
```typescript
// ALWAYS implement graceful shutdown with timeout
export async function stopReportWorker(): Promise<void> {
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  // ... handle timeout case
}
```

### 4. Missing DLQ Handling

**Wrong:**
```typescript
// DO NOT ignore permanently failed jobs
worker.on("failed", (job, err) => {
  logger.error("Job failed", err);
  // Jobs disappear after max retries with no trace
});
```

**Correct:**
```typescript
// ALWAYS move exhausted jobs to DLQ for inspection
worker.on("failed", async (job, err) => {
  if (job.attemptsMade >= maxAttempts) {
    await reportQueue.add("dlq:report-generation", {
      originalJobId: job.id,
      error: err.message,
      // ... preserve context
    });
  }
});
```

### 5. Hardcoded Paths in Docker

**Wrong:**
```typescript
// DO NOT hardcode absolute paths
const outputPath = "/home/user/reports/output.pdf";
```

**Correct:**
```typescript
// USE environment-configured paths
const REPORTS_DIR = process.env.REPORTS_DIR ?? "/data/reports";
const outputPath = path.join(REPORTS_DIR, clientId, `${date}_report.pdf`);
```

---

## No Analog Found

All files for Phase 15 have close analogs in the existing codebase:

| File | Analog Source | Notes |
|------|---------------|-------|
| Puppeteer PDF logic | N/A (new) | Use Puppeteer docs + standard patterns; no existing Puppeteer code in codebase |
| Localization system | N/A (new) | Date/number formatting via Intl API; implement as utility module |
| Report template types | N/A (new) | Define interfaces per CONTEXT.md spec |

---

## Metadata

**Analog search scope:** `open-seo-main/src/server/`, `apps/web/src/`, `packages/ui/src/`
**Files scanned:** ~50 source files (excluding node_modules)
**Pattern extraction date:** 2026-04-19
