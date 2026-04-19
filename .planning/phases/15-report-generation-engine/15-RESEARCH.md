# Phase 15: Report Generation Engine - Research

**Researched:** 2026-04-19
**Domain:** PDF generation, React SSR, BullMQ job queues, i18n
**Confidence:** HIGH

## Summary

Phase 15 implements a digital-first report generation system where React components render to both interactive HTML (primary) and PDF (secondary export). The architecture uses Puppeteer running in a dedicated Docker container to convert server-rendered HTML to PDF, with BullMQ handling the job queue for non-blocking PDF generation. Recharts SVG charts work natively in both HTML and PDF output since Puppeteer renders SVG as vectors.

The existing BullMQ patterns from phases 3 and 13 (audit-worker, analytics-worker) provide exact templates for the report-generation worker. The established `getSharedBullMQConnection`, sandboxed processor pattern, graceful shutdown, and DLQ handling all apply directly. The main new element is the Puppeteer container, which requires specific Docker configuration for memory management and Chrome sandboxing.

**Primary recommendation:** Use a Debian-based Puppeteer image (not Alpine) for stability, configure `--shm-size=1gb` or `--disable-dev-shm-usage`, and implement content-hash caching to skip regeneration when report data has not changed. For localization, use `next-intl` which is already compatible with the Next.js 15 stack in apps/web.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Primary format is interactive HTML (responsive, scrollable, hover states)
- PDF is a secondary export option via Puppeteer
- Template-based system with configurable sections (builder-ready)
- Same React components render to both HTML and PDF
- Puppeteer containerized in Docker (isolated, consistent, no system deps)
- BullMQ job with dedicated worker (non-blocking, handles long renders, retry support)
- Cache generated PDFs by content hash (regenerate only when data changes)
- 60 second timeout with graceful failure and clear error messaging
- Local filesystem `/data/reports/` (volume-mounted in Docker)
- File naming: `{client_id}/{YYYY-MM-DD}_{report_type}.pdf`
- Access control via Clerk session + client ownership check
- Keep all reports indefinitely
- Default date range: Last 30 days
- Report UI language selectable per report
- Keywords/queries shown in original language
- Date/number formatting follows selected locale

### Claude's Discretion
- Specific chart styling details (line thickness, colors, tooltips)
- Loading states and skeleton components
- Error boundary implementation
- Report preview thumbnail generation (if needed)

### Deferred Ideas (OUT OF SCOPE)
- Report Builder UI (drag-and-drop, visual configuration)
- Client Self-Service Reports (shareable links, embedded widgets)
- Report Scheduling (Phase 16)
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Report template rendering | Frontend Server (SSR) | Browser (hydration) | SSR renders React to HTML string for PDF; browser gets hydrated interactive version |
| PDF generation | Worker Container | -- | Puppeteer runs in isolated Docker container via BullMQ worker |
| Job queue management | API / Backend | Worker Container | Queue lives in Redis; API enqueues, worker dequeues |
| Report storage | Filesystem | Database (metadata) | PDFs stored on disk; metadata (client_id, path, hash) in PostgreSQL |
| Chart rendering | Browser (SVG) | Frontend Server (static markup) | Recharts SVG works in both; server renders static for PDF |
| Localization | Frontend Server | -- | next-intl handles message formatting server-side |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | 24.41.0 | Headless Chrome automation | [VERIFIED: npm registry] Industry standard for HTML-to-PDF, maintained by Google |
| bullmq | 5.74.1 | Job queue for PDF generation | [VERIFIED: npm registry] Already used in codebase (phases 3, 13) |
| next-intl | 4.9.1 | Localization/i18n | [VERIFIED: npm registry] Native Next.js integration, ICU message format, date/number formatting |
| recharts | 3.8.1 | SVG charting | [VERIFIED: existing] Already installed in apps/web, works for both HTML and PDF |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-pdf/renderer | -- | Alternative PDF approach | NOT recommended: different rendering model, not same-as-HTML |
| html2canvas | -- | Client-side screenshot | NOT recommended: rasterizes text, not vector-quality |
| ioredis | 5.10.1 | Redis client | [VERIFIED: existing] Already used via getSharedBullMQConnection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Puppeteer container | Browserless.io hosted | Simpler setup but requires network calls + paid service |
| next-intl | react-intl | react-intl is lower-level; next-intl wraps it with Next.js-specific features |
| Recharts (SVG) | Chart.js (canvas) | Canvas rasterizes; SVG stays vector in PDF |

**Installation:**
```bash
# In apps/web
pnpm add next-intl

# Puppeteer goes in the worker Docker image, not the app
```

**Version verification:** [VERIFIED: npm registry 2026-04-19]
- puppeteer@24.41.0 (published 2026-04-11)
- bullmq@5.74.1 (published 2026-04-15)
- next-intl@4.9.1 (published 2026-04-08)
- recharts@3.8.1 (already in package.json)

## Architecture Patterns

### System Architecture Diagram

```
                                    [User Request]
                                          |
                                          v
+--------------------+            +------------------+
|   apps/web         |   HTTP     |  open-seo        |
|   (Next.js 15)     |<---------->|  (API/Worker)    |
|                    |            |                  |
|  Report Preview    |            |  /api/reports/   |
|  (Interactive HTML)|            |  generate        |
+--------------------+            +------------------+
                                          |
                                          | BullMQ add()
                                          v
                               +---------------------+
                               |       Redis         |
                               |  report-generation  |
                               |       queue         |
                               +---------------------+
                                          |
                                          | Worker consumes
                                          v
+---------------------------+    +------------------------+
|  open-seo-worker          |    |  puppeteer-pdf         |
|  (report-worker.ts)       |--->|  (Docker container)    |
|                           |    |                        |
|  1. Fetch report data     |    |  1. Receive HTML       |
|  2. Render React to HTML  |    |  2. page.pdf()         |
|  3. Send to Puppeteer     |    |  3. Return PDF buffer  |
+---------------------------+    +------------------------+
            |
            | Write PDF
            v
+---------------------------+
|  /data/reports/           |
|  {client_id}/             |
|    {date}_{type}.pdf      |
+---------------------------+
            |
            | Update metadata
            v
+---------------------------+
|      PostgreSQL           |
|  report_metadata table    |
|  - id, client_id, path    |
|  - content_hash           |
|  - generated_at           |
+---------------------------+
```

### Recommended Project Structure
```
open-seo-main/src/server/
  queues/
    reportQueue.ts           # BullMQ queue definition
  workers/
    report-worker.ts         # Worker factory (start/stop)
    report-processor.ts      # Sandboxed processor
  services/
    report/
      pdf-generator.ts       # Puppeteer integration
      content-hasher.ts      # Hash report data for caching
      report-renderer.ts     # React SSR to HTML string

apps/web/src/
  components/
    reports/
      ReportTemplate.tsx     # Main template wrapper
      ReportHeader.tsx       # Header section
      ReportSummaryStats.tsx # Summary cards
      ReportGSCChart.tsx     # GSC chart (wraps existing GSCChart)
      ReportGA4Chart.tsx     # GA4 chart (wraps existing GA4Chart)
      ReportQueriesTable.tsx # Top queries table
      ReportFooter.tsx       # Footer with branding
  i18n/
    messages/
      en.json                # English translations
      de.json                # German translations
      lt.json                # Lithuanian translations
    request.ts               # next-intl config

docker/
  puppeteer/
    Dockerfile              # Puppeteer container image
```

### Pattern 1: BullMQ Report Queue (following analytics-queue pattern)
**What:** Queue definition with job data interface, default options, and scheduler
**When to use:** All report generation jobs
**Example:**
```typescript
// Source: Adapted from open-seo-main/src/server/queues/analyticsQueue.ts
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";

export const REPORT_QUEUE_NAME = "report-generation" as const;

export interface ReportJobData {
  reportId: string;
  clientId: string;
  reportType: "monthly-seo" | "weekly-summary";
  dateRange: { start: string; end: string };
  locale: string; // "en", "de", "lt", etc.
  contentHash: string; // Hash of data inputs for cache check
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const reportQueue = new Queue<ReportJobData>(REPORT_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:report"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});
```

### Pattern 2: Report Worker (following audit-worker pattern)
**What:** BullMQ Worker with sandboxed processor, 60s timeout via lockDuration
**When to use:** PDF generation jobs
**Example:**
```typescript
// Source: Adapted from open-seo-main/src/server/workers/audit-worker.ts
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { REPORT_QUEUE_NAME, type ReportJobData } from "@/server/queues/reportQueue";

const LOCK_DURATION_MS = 90_000; // 90s to allow 60s render + buffer
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

const PROCESSOR_PATH = fileURLToPath(
  new URL("./report-processor.js", import.meta.url),
);

let worker: Worker<ReportJobData> | null = null;

export function startReportWorker(): Worker<ReportJobData> {
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
  // ... event handlers same as analytics-worker
  return worker;
}
```

### Pattern 3: Content Hash Caching
**What:** Hash report input data to skip regeneration when unchanged
**When to use:** Before PDF generation to check if cached PDF exists
**Example:**
```typescript
// Source: [CITED: https://www.alainschlesser.com/bust-cache-content-hash/]
import { createHash } from "node:crypto";

export interface ReportInputData {
  clientId: string;
  dateRange: { start: string; end: string };
  gscData: GSCDataPoint[];
  ga4Data: GA4DataPoint[];
  queriesData: QueryMetrics[];
  locale: string;
}

export function computeReportHash(data: ReportInputData): string {
  const serialized = JSON.stringify({
    clientId: data.clientId,
    dateRange: data.dateRange,
    gscRowCount: data.gscData.length,
    gscLastDate: data.gscData[data.gscData.length - 1]?.date,
    ga4RowCount: data.ga4Data.length,
    queriesCount: data.queriesData.length,
    locale: data.locale,
  });
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}

// In processor:
const hash = computeReportHash(inputData);
const existingPath = `/data/reports/${clientId}/${date}_${type}_${hash}.pdf`;
if (await fileExists(existingPath)) {
  return { path: existingPath, cached: true };
}
```

### Pattern 4: React SSR to HTML String
**What:** Server-side render React components to HTML for Puppeteer
**When to use:** In report-processor.ts before sending to Puppeteer
**Example:**
```typescript
// Source: [CITED: https://dev.to/jordykoppen/turning-react-apps-into-pdfs-with-nextjs-nodejs-and-puppeteer-mfi]
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "next-intl";
import { ReportTemplate } from "@/components/reports/ReportTemplate";

export async function renderReportToHTML(
  data: ReportData,
  locale: string,
  messages: Record<string, string>,
): Promise<string> {
  const html = renderToStaticMarkup(
    <IntlProvider locale={locale} messages={messages}>
      <ReportTemplate data={data} />
    </IntlProvider>
  );
  
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <style>${getReportStyles()}</style>
</head>
<body>${html}</body>
</html>`;
}
```

### Pattern 5: next-intl Message Formatting
**What:** ICU message format with date/number localization
**When to use:** All user-facing text in reports
**Example:**
```typescript
// Source: [CITED: https://next-intl.dev/docs/usage/configuration]
// i18n/request.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
  formats: {
    dateTime: {
      short: { day: "numeric", month: "short", year: "numeric" },
      monthYear: { month: "long", year: "numeric" },
    },
    number: {
      compact: { notation: "compact", maximumFractionDigits: 1 },
      percent: { style: "percent", maximumFractionDigits: 2 },
    },
  },
}));

// messages/en.json
{
  "report.title": "Monthly SEO Report",
  "report.dateRange": "Performance from {startDate, date, short} to {endDate, date, short}",
  "report.clicks": "{count, number} clicks",
  "report.impressions": "{count, number, compact} impressions",
  "report.ctr": "{value, number, percent} CTR"
}
```

### Anti-Patterns to Avoid
- **Rendering PDF client-side:** Flattens content, hits browser limits, exposes data
- **Using html2canvas:** Rasterizes text and charts, loses vector quality
- **Alpine Docker for Puppeteer:** Known timeout issues with Chromium in Alpine 3.20; use Debian
- **Single-process Puppeteer:** Memory leaks accumulate; use worker pool or fresh browser per job
- **Hex colors in SVG for PDF:** Known Puppeteer bug renders empty PDF; use RGB values

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML to PDF | Custom rendering engine | Puppeteer page.pdf() | Complex rendering, CSS support, maintained by Google |
| Date/number localization | Custom formatters | next-intl / Intl API | ICU message format standard, locale data maintained |
| Job queue | setTimeout/setInterval | BullMQ | Persistence, retries, concurrency, visibility |
| Content hashing | String comparison | crypto.createHash | Collision-resistant, efficient |
| SVG charts | Canvas-based charts | Recharts (SVG) | Vector quality preserved in PDF |

**Key insight:** PDF generation has many edge cases (fonts, CSS, memory, sandboxing) that Puppeteer handles. The cost of hand-rolling is months of debugging; the cost of Puppeteer is a Docker image.

## Common Pitfalls

### Pitfall 1: Shared Memory Exhaustion in Docker
**What goes wrong:** Chrome crashes with "out of memory" or renders blank pages
**Why it happens:** Docker default /dev/shm is 64MB; Chrome needs more
**How to avoid:** Use `--shm-size=1gb` or `--disable-dev-shm-usage` flag
**Warning signs:** Random crashes, blank pages, "SIGKILL" in logs

### Pitfall 2: Puppeteer SVG Hex Color Bug
**What goes wrong:** PDF renders as empty/blank despite HTML looking correct
**Why it happens:** Puppeteer bug with hex colors (#RRGGBB) in SVG elements
**How to avoid:** Replace hex colors with `rgb()` format before rendering, or use CSS variables
**Warning signs:** Empty PDF, SVG elements missing, works in browser but not PDF

### Pitfall 3: Recharts Legend Off-Screen in PDF
**What goes wrong:** Chart legend draws outside the visible area in screenshots/PDFs
**Why it happens:** ResponsiveContainer width calculation differs in headless Chrome
**How to avoid:** Set explicit width on chart container, use `onAnimationEnd` callback to signal ready
**Warning signs:** Partial charts, missing legends in PDF but visible in browser

### Pitfall 4: Memory Leaks from Unclosed Browsers
**What goes wrong:** Worker memory grows to 2GB+ after hundreds of generations
**Why it happens:** Browser instances not properly closed in error paths
**How to avoid:** Always close browser in `finally` block, consider fresh browser per job
**Warning signs:** Growing memory usage, eventual OOM kills

### Pitfall 5: Long-Running Jobs Stalling
**What goes wrong:** Jobs marked as stalled and retried while still processing
**Why it happens:** lockDuration too short for PDF render time
**How to avoid:** Set lockDuration > expected render time + buffer (90s for 60s timeout)
**Warning signs:** "Job stalled" logs, duplicate job processing

## Code Examples

### Puppeteer PDF Generation with Timeout
```typescript
// Source: [CITED: https://docs.bullmq.io/patterns/manually-fetching-jobs]
import puppeteer from "puppeteer";

const PDF_TIMEOUT_MS = 60_000;

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.connect({
    browserWSEndpoint: process.env.PUPPETEER_WS_ENDPOINT,
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Load HTML content
    await page.setContent(html, { waitUntil: "networkidle0" });
    
    // Generate PDF with timeout
    const pdfBuffer = await Promise.race([
      page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF generation timed out")), PDF_TIMEOUT_MS)
      ),
    ]);
    
    await page.close();
    return Buffer.from(pdfBuffer);
  } finally {
    // Always disconnect (browser instance is shared/pooled)
    browser.disconnect();
  }
}
```

### Puppeteer Docker Container
```dockerfile
# Source: [CITED: https://pptr.dev/troubleshooting]
FROM node:22-slim

# Install Chrome dependencies for Debian
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create non-root user
RUN groupadd -r pptruser && useradd -r -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod

COPY . .

USER pptruser

# Chrome sandbox args for container
CMD ["node", "server.js", "--disable-dev-shm-usage", "--no-sandbox"]
```

### Report Queue Job Addition
```typescript
// Source: Adapted from existing auditQueue.ts pattern
import { reportQueue } from "@/server/queues/reportQueue";
import { computeReportHash } from "@/server/services/report/content-hasher";

export async function enqueueReportGeneration(params: {
  clientId: string;
  reportType: string;
  dateRange: { start: string; end: string };
  locale: string;
  inputData: ReportInputData;
}): Promise<string> {
  const contentHash = computeReportHash(params.inputData);
  const reportId = crypto.randomUUID();
  
  await reportQueue.add(
    `report-${params.clientId}`,
    {
      reportId,
      clientId: params.clientId,
      reportType: params.reportType,
      dateRange: params.dateRange,
      locale: params.locale,
      contentHash,
    },
    {
      jobId: `${params.clientId}-${params.dateRange.end}-${params.reportType}`,
      priority: 1,
    },
  );
  
  return reportId;
}
```

### Worker Lock Extension for Long Jobs
```typescript
// Source: [CITED: https://docs.bullmq.io/patterns/manually-fetching-jobs]
export default async function processReportJob(
  job: Job<ReportJobData>,
): Promise<void> {
  const lockExtensionInterval = 30_000; // 30s
  
  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token!, lockExtensionInterval);
    } catch (error) {
      console.error("Failed to extend lock:", error);
    }
  }, lockExtensionInterval - 5000); // Extend 5s before expiry
  
  try {
    // Long-running PDF generation work
    const result = await generateReport(job.data);
    return result;
  } finally {
    clearInterval(lockExtender);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PhantomJS for PDF | Puppeteer (Chrome) | 2018 | Better CSS support, maintained |
| wkhtmltopdf | Puppeteer | 2020 | Modern CSS, JavaScript support |
| react-pdf library | SSR + Puppeteer | 2023 | Same React components for web + PDF |
| Alpine Puppeteer | Debian-slim Puppeteer | 2025 | Alpine 3.20 Chromium timeout issues |
| Per-job browser launch | Browser pool/connection | 2024 | 50-80% memory reduction |

**Deprecated/outdated:**
- PhantomJS: Abandoned project, no longer maintained
- wkhtmltopdf: Limited CSS3 support, font rendering issues
- Alpine 3.20 + Puppeteer: Known timeout issues with bundled Chromium version

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | next-intl works with React SSR outside Next.js pages | Pattern 4 | May need custom IntlProvider setup |
| A2 | Recharts SVG renders identically in headless Chrome | Standard Stack | May need explicit viewBox settings |
| A3 | 60 second timeout is sufficient for complex reports | Pattern 2 | May need to increase or add progress updates |

## Open Questions

1. **Browser Pool vs Fresh Browser**
   - What we know: Pooling reduces startup time; fresh browser per job prevents memory leaks
   - What's unclear: Optimal strategy for this workload (2-5 reports/hour typical)
   - Recommendation: Start with fresh browser per job, add pooling if startup latency is problematic

2. **Puppeteer as Separate Container vs Embedded**
   - What we know: Separate container isolates Chrome; embedded is simpler
   - What's unclear: Whether existing open-seo-worker can handle Chromium deps
   - Recommendation: Separate container (`puppeteer-pdf`) per CONTEXT.md decision

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Puppeteer container | Yes | 29.4.0 | -- |
| Node.js | Worker/API | Yes | 20.20.2 | -- |
| Redis | BullMQ | Yes (via docker-compose) | 7-alpine | -- |
| PostgreSQL | Report metadata | Yes (via docker-compose) | 16-alpine | -- |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (presumed from existing Next.js setup) |
| Config file | apps/web/vitest.config.ts (or create in Wave 0) |
| Quick run command | `pnpm --filter @tevero/web test` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPT-01 | Report queue enqueue | unit | `pnpm test -- report-queue.test.ts -t "enqueue"` | Wave 0 |
| RPT-02 | Content hash generation | unit | `pnpm test -- content-hasher.test.ts` | Wave 0 |
| RPT-03 | HTML to PDF conversion | integration | `pnpm test -- pdf-generator.test.ts` | Wave 0 |
| RPT-04 | Locale message formatting | unit | `pnpm test -- report-i18n.test.ts` | Wave 0 |
| RPT-05 | Report file storage | integration | `pnpm test -- report-storage.test.ts` | Wave 0 |

### Wave 0 Gaps
- [ ] `open-seo-main/src/server/queues/__tests__/reportQueue.test.ts` -- covers RPT-01
- [ ] `open-seo-main/src/server/services/report/__tests__/content-hasher.test.ts` -- covers RPT-02
- [ ] `apps/web/src/components/reports/__tests__/ReportTemplate.test.tsx` -- covers component rendering

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Clerk session validation before report access |
| V3 Session Management | yes | Clerk session, no custom session handling |
| V4 Access Control | yes | Client ownership check (clientId matches user's clients) |
| V5 Input Validation | yes | Zod schema for report parameters |
| V6 Cryptography | no | No custom crypto (hash is for caching, not security) |

### Known Threat Patterns for PDF Generation

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via Puppeteer | Spoofing | Only render self-generated HTML, no external URLs |
| Path traversal in filename | Tampering | Validate clientId format, use path.join safely |
| Unauthorized report access | Information Disclosure | Clerk auth + client ownership check |
| Resource exhaustion (memory) | Denial of Service | Memory limits on Puppeteer container, job concurrency limits |
| Malicious report data injection | Tampering | Sanitize data before React render, CSP in HTML |

## Sources

### Primary (HIGH confidence)
- [/puppeteer/puppeteer](https://github.com/puppeteer/puppeteer) - Docker troubleshooting, Alpine configuration
- [/websites/bullmq_io](https://docs.bullmq.io) - Worker configuration, lock duration, stalled jobs
- [/websites/next-intl_dev](https://next-intl.dev/docs) - Message formatting, date/number configuration

### Secondary (MEDIUM confidence)
- [Run Puppeteer in Docker with Chromium](https://nulldog.com/run-puppeteer-in-docker-with-chromium) - Alpine vs Debian comparison
- [WebScraping.AI Headless Chromium best practices](https://webscraping.ai/faq/headless-chromium/what-are-the-best-practices-for-managing-memory-usage-in-headless-chromium) - Memory management
- [Puppeteer HTML to PDF Generation](https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/) - Basic PDF generation pattern
- [React and Puppeteer PDF generation](https://dev.to/lwhiteley/react-and-puppeteer-pdf-generation-pdf-generation-api-c7o) - React SSR to PDF workflow
- [BullMQ long-running jobs](https://oneuptime.com/blog/post/2026-01-21-bullmq-long-running-jobs/view) - Lock extension patterns
- [DEV Community: Generating PDF reports with charts](https://dev.to/carlbarrdahl/generating-pdf-reports-with-charts-using-react-and-puppeteer-4245) - Recharts + Puppeteer

### Tertiary (needs validation)
- [Recharts issue #6218](https://github.com/recharts/recharts/issues/6218) - Legend off-screen in Puppeteer (workaround exists)
- [Puppeteer SVG rendering issue #2556](https://github.com/puppeteer/puppeteer/issues/2556) - Hex color bug in PDF

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against npm registry, existing codebase patterns
- Architecture: HIGH - follows established BullMQ patterns from phases 3, 13
- Pitfalls: MEDIUM - based on community reports, may need validation in this specific setup

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days for stable ecosystem)
