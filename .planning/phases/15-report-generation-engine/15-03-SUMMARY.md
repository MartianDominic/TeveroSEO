---
phase: 15
plan: 03
subsystem: report-worker
tags: [bullmq, puppeteer, pdf, docker]
dependency_graph:
  requires: [15-01, 15-02]
  provides: [report-worker, pdf-generator, puppeteer-container]
  affects: [report-ui, report-scheduling]
tech_stack:
  added: [puppeteer@24]
  patterns: [sandboxed-processor, websocket-puppeteer, rgb-colors-pdf]
key_files:
  created:
    - open-seo-main/src/server/workers/report-worker.ts
    - open-seo-main/src/server/workers/report-processor.ts
    - open-seo-main/src/server/services/report/pdf-generator.ts
    - open-seo-main/src/server/services/report/report-renderer.ts
    - docker/puppeteer/Dockerfile
    - docker/puppeteer/browser-server.js
    - docker/puppeteer/package.json
  modified:
    - open-seo-main/src/worker-entry.ts
    - docker-compose.vps.yml
decisions:
  - lockDuration 90_000 (60s render + 30s buffer) for PDF generation jobs
  - concurrency 2 to limit concurrent Puppeteer renders
  - Debian-slim base for Puppeteer (not Alpine) to avoid font rendering issues
  - shm_size 1gb for Chromium shared memory
  - Static HTML renderer instead of React SSR for PDF simplicity
metrics:
  duration: 6m
  completed: 2026-04-19T14:02:00Z
---

# Phase 15 Plan 03: Report Worker Summary

BullMQ worker infrastructure with Puppeteer PDF generation in isolated Docker container, 60s timeout, DLQ handling, and graceful shutdown.

## One-Liner

BullMQ worker factory with sandboxed processor, Puppeteer PDF generation via WebSocket, Debian-based container with 1gb shm, and docker-compose volume/service wiring.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | BullMQ worker factory | f094333 | report-worker.ts |
| 2 | Sandboxed processor + PDF generator | f59128c | report-processor.ts, pdf-generator.ts, report-renderer.ts |
| 3 | Puppeteer Dockerfile + docker-compose | 42e324a, a18ecd43 | Dockerfile, browser-server.js, docker-compose.vps.yml, worker-entry.ts |

## Key Implementation Details

### Report Worker (report-worker.ts)

```typescript
const LOCK_DURATION_MS = 90_000; // 60s render + 30s buffer
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 25_000;

worker = new Worker<ReportJobData | ReportDLQJobData>(
  REPORT_QUEUE_NAME,
  PROCESSOR_PATH, // Sandboxed processor
  {
    connection: getSharedBullMQConnection("worker:report"),
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: MAX_STALLED_COUNT,
    concurrency: 2, // Limit concurrent PDF renders
  },
);
```

### PDF Generator (pdf-generator.ts)

```typescript
const PDF_TIMEOUT_MS = 60_000; // 60 second timeout

const pdfBuffer = await Promise.race([
  page.pdf({ format: "A4", printBackground: true, margin: {...} }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("PDF generation timed out")), PDF_TIMEOUT_MS),
  ),
]);
```

### Puppeteer Container

- Base: `node:22-slim` (Debian, not Alpine)
- System Chromium with font packages
- Non-root `pptruser` for security
- Health check at `/healthz`
- WebSocket endpoint exposed

### Docker Compose Configuration

```yaml
puppeteer-pdf:
  shm_size: "1gb"
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:3100/healthz || exit 1"]

open-seo-worker:
  environment:
    PUPPETEER_WS_ENDPOINT: "ws://puppeteer-pdf:9222"
    REPORTS_DIR: "/data/reports"
  volumes:
    - reports_data:/data/reports
  depends_on:
    puppeteer-pdf:
      condition: service_healthy
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Static HTML renderer instead of React SSR**
- **Found during:** Task 2
- **Issue:** ReportTemplate uses "use client" and Recharts which don't work well with server-side renderToString
- **Fix:** Created report-renderer.ts as a pure HTML generator with same styles/colors
- **Files modified:** report-renderer.ts (created)
- **Commit:** f59128c

This is intentional - the React components in apps/web are for interactive preview, while the HTML renderer in open-seo-main is for PDF generation. Both use the same RGB color palette and layout.

## Success Criteria Verification

- [x] report-worker.ts exports startReportWorker and stopReportWorker
- [x] Worker uses lockDuration: 90_000 (60s + 30s buffer)
- [x] Worker concurrency limited to 2
- [x] report-processor.ts fetches data, renders HTML, generates PDF, writes to filesystem
- [x] pdf-generator.ts has 60 second timeout with Promise.race
- [x] docker/puppeteer/Dockerfile uses Debian (not Alpine)
- [x] puppeteer-pdf service has shm_size: 1gb
- [x] docker-compose.vps.yml has reports_data volume
- [x] open-seo-worker mounts reports_data volume
- [x] open-seo-worker has PUPPETEER_WS_ENDPOINT environment variable
- [x] worker-entry.ts starts and stops report worker

## Self-Check: PASSED

Files verified:
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/report-worker.ts
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/workers/report-processor.ts
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/services/report/pdf-generator.ts
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/services/report/report-renderer.ts
- FOUND: /home/dominic/Documents/TeveroSEO/docker/puppeteer/Dockerfile
- FOUND: /home/dominic/Documents/TeveroSEO/docker/puppeteer/browser-server.js
- FOUND: /home/dominic/Documents/TeveroSEO/docker/puppeteer/package.json

Commits verified:
- FOUND: f094333 (Task 1)
- FOUND: f59128c (Task 2)
- FOUND: 42e324a (Task 3 - open-seo-main)
- FOUND: a18ecd43 (Task 3 - main repo)
