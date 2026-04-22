---
phase: "30"
plan: "05"
subsystem: prospect-reports
tags: [pdf, export, puppeteer, prospect-analysis]
dependency_graph:
  requires: [30-analysis-pipeline, 15-report-generation]
  provides: [prospect-pdf-export-api]
  affects: [prospect-detail-ui]
tech_stack:
  added: []
  patterns: [html-renderer, pdf-generator-service, api-proxy]
key_files:
  created:
    - open-seo-main/src/server/services/prospect-report/prospect-report-renderer.ts
    - open-seo-main/src/server/services/prospect-report/prospect-pdf-service.ts
    - open-seo-main/src/server/services/prospect-report/index.ts
    - open-seo-main/src/routes/api/prospects/$prospectId.report.ts
    - apps/web/src/app/api/prospects/[id]/report/route.ts
  modified:
    - apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx
decisions:
  - Use existing Puppeteer PDF infrastructure from Phase 15
  - RGB colors for Puppeteer compatibility (no hex values)
  - HTML template with domain metrics, keywords, gaps, insights
  - VALIDATION_ERROR for invalid state (matches shared error-codes.ts)
metrics:
  duration: 6m
  completed: "2026-04-22T12:52:00Z"
---

# Phase 30 Plan 05: Analysis PDF Export Summary

Prospect PDF report generation following existing report infrastructure patterns.

## One-Liner

Prospect analysis PDF export using Puppeteer with domain metrics, keyword opportunities, and AI insights.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create prospect report renderer | open-seo@53511c2 | prospect-report-renderer.ts |
| 2 | Create PDF generation service | open-seo@53511c2 | prospect-pdf-service.ts, index.ts |
| 3 | Add API endpoint in open-seo | open-seo@53511c2 | $prospectId.report.ts |
| 3b | Add API proxy in Next.js | main@2b963a5c7 | api/prospects/[id]/report/route.ts |
| 4 | Add export button to UI | main@6dea50f36 | [prospectId]/page.tsx |
| 5 | Fix TypeScript error codes | open-seo@1e2b0a1 | prospect-pdf-service.ts, $prospectId.report.ts |

## Implementation Details

### Prospect Report Renderer

HTML template for PDF generation with:
- Header with domain and generation date
- Business information section (from scraped content)
- Key insights section (AI-generated from analysis data)
- Domain metrics grid (5 cards: rank, traffic, keywords, backlinks, referring domains)
- AI-discovered keyword opportunities table (top 15 by opportunity score)
- Keyword gap analysis table (top 15 by traffic potential)
- Current rankings table (top 15 by position)
- Footer with analysis type and API cost

All colors use RGB format for Puppeteer compatibility (not hex or CSS variables).

### PDF Service

`ProspectPdfService.generateProspectPDF(prospectId, analysisId?, workspaceId?)`:
- Fetches prospect and analysis data from database
- Validates workspace ownership if workspaceId provided
- Falls back to latest completed analysis if analysisId not specified
- Generates HTML via renderer, PDF via Puppeteer
- Returns PDF buffer with filename and content-type

### API Routes

**open-seo**: `GET /api/prospects/:prospectId/report`
- Requires authentication via Bearer token
- Optional `?analysisId=xxx` query param
- Returns PDF with proper Content-Type and Content-Disposition headers

**apps/web**: `GET /api/prospects/:id/report`
- Proxies to open-seo backend
- Handles auth token forwarding
- Preserves all headers from backend response

### UI Integration

Export PDF button appears on prospect detail page when:
- Latest analysis exists AND
- Analysis status is "completed"

Button links directly to API endpoint with `download` attribute for browser download handling.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid error code**
- **Found during:** TypeScript verification
- **Issue:** `BAD_REQUEST` is not a valid ErrorCode in shared/error-codes.ts
- **Fix:** Changed to `VALIDATION_ERROR` which is valid
- **Files modified:** prospect-pdf-service.ts, $prospectId.report.ts
- **Commit:** open-seo@1e2b0a1

## Verification

- TypeScript: No errors in new files (`npx tsc --noEmit` shows 0 errors for prospect-report files)
- API route structure matches existing patterns (reports download route)
- HTML renderer follows existing report-renderer.ts patterns with RGB colors

## Self-Check: PASSED

- [x] prospect-report-renderer.ts exists
- [x] prospect-pdf-service.ts exists
- [x] $prospectId.report.ts exists
- [x] api/prospects/[id]/report/route.ts exists
- [x] page.tsx modified with Export PDF button
- [x] All commits verified in git log
