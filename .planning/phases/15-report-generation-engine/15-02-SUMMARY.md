---
phase: 15
plan: 02
subsystem: report-generation
tags: [drizzle, bullmq, api-routes, caching]
dependency_graph:
  requires: []
  provides: [reports-table, report-queue, content-hasher, report-api]
  affects: [report-worker, report-ui]
tech_stack:
  added: []
  patterns: [bullmq-queue, drizzle-schema, content-hashing]
key_files:
  created:
    - open-seo-main/src/db/report-schema.ts
    - open-seo-main/drizzle/0004_report_metadata.sql
    - open-seo-main/src/server/queues/reportQueue.ts
    - open-seo-main/src/server/services/report/content-hasher.ts
    - open-seo-main/src/server/services/report/__tests__/content-hasher.test.ts
  modified:
    - open-seo-main/src/db/schema.ts
    - open-seo-main/drizzle/meta/_journal.json
decisions:
  - Content hash uses 16-char hex SHA256 prefix for collision resistance with reasonable uniqueness
  - Report queue uses same exponential backoff pattern as analytics queue (10s, 20s, 40s)
  - Unique index on (clientId, contentHash) enables cache deduplication at database level
metrics:
  duration: 8m
  completed: 2026-04-19T13:51:59Z
---

# Phase 15 Plan 02: Report Data Layer Summary

PostgreSQL schema for report metadata with BullMQ queue integration and content-hash caching for report regeneration detection.

## One-Liner

Drizzle schema (reports table), BullMQ queue (reportQueue), and SHA256 content hasher for cache invalidation, plus API routes (already committed in 15-01).

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Drizzle schema and migration | 341aa96 | report-schema.ts, 0004_report_metadata.sql |
| 2 | BullMQ queue and content hasher | 5060897 | reportQueue.ts, content-hasher.ts |
| 3 | API routes and server actions | b422e67f (15-01) | Already committed |

## Key Implementation Details

### Reports Table Schema

```typescript
reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  reportType: text("report_type").notNull(),
  dateRangeStart: text("date_range_start").notNull(),
  dateRangeEnd: text("date_range_end").notNull(),
  locale: text("locale").notNull().default("en"),
  contentHash: text("content_hash").notNull(),
  pdfPath: text("pdf_path"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Indexes:**
- `ix_reports_client_id` - for listing client reports
- `uq_reports_client_content_hash` - unique constraint for cache deduplication
- `ix_reports_status` - for filtering by generation status

### BullMQ Queue Configuration

```typescript
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
```

**Exports:** `REPORT_QUEUE_NAME`, `reportQueue`, `enqueueReportGeneration`, `ReportJobData`, `ReportDLQJobData`

### Content Hasher

Returns consistent 16-char hex prefix of SHA256 hash based on:
- clientId, dateRange, gscDataCount, gscLastDate, ga4DataCount, queriesCount, locale

Enables cache hits when report data hasn't changed.

## Tests Added

- `content-hasher.test.ts` - 6 unit tests
  - Returns consistent 16-char hex for same input
  - Returns different hash for different clientId/dateRange/locale/counts
  - Handles null gscLastDate correctly

## Deviations from Plan

None - plan executed exactly as written.

Note: Task 3 (API routes and server actions) was already committed as part of Phase 15-01 plan. The files match the plan specification exactly, so no additional commit was needed.

## Success Criteria Verification

- [x] reports table schema defined with id, clientId, contentHash, pdfPath, status columns
- [x] Migration file 0004_report_metadata.sql exists
- [x] reportQueue exports queue, REPORT_QUEUE_NAME, enqueueReportGeneration
- [x] computeReportHash returns consistent 16-char hex
- [x] POST /api/reports/generate route proxies to open-seo and returns 202 (committed in 15-01)
- [x] GET /api/reports/[id] route returns report metadata (committed in 15-01)
- [x] GET /api/reports/[id]/download returns PDF with application/pdf Content-Type (committed in 15-01)
- [x] Server actions exported for client-side use (committed in 15-01)
- [x] TypeScript compilation passes in both workspaces

## Self-Check: PASSED

Files verified:
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/db/report-schema.ts
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/drizzle/0004_report_metadata.sql
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/queues/reportQueue.ts
- FOUND: /home/dominic/Documents/TeveroSEO/open-seo-main/src/server/services/report/content-hasher.ts

Commits verified:
- FOUND: 341aa96 (Task 1)
- FOUND: 5060897 (Task 2)
- FOUND: b422e67f (Task 3 - from 15-01)
