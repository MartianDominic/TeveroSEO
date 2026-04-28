# Phase 30: Prospect Conversion & Sales Tools - Context

**Gathered:** 2026-04-22
**Status:** 30-01 through 30-04 complete, 30-05 pending

## Phase Boundary

Sales enablement tools for converting prospects to clients. PDF reports, proposal generation, and conversion workflows.

## Current State (from codebase audit)

**COMPLETE (30-01 through 30-04):**
- Prospect pipeline management (CRUD, status transitions)
- Analysis workflow with BullMQ queue
- Priority scoring system (30.5-03)
- Bulk analysis actions

**30-05 PENDING:** Analysis PDF Export

## Existing Infrastructure

### PDF Generation Pipeline
Location: `open-seo-main/src/server/services/report/`

1. **pdf-generator.ts** - Puppeteer service connecting to external container
   - Connects via WebSocket endpoint (PUPPETEER_WS_ENDPOINT)
   - 60 second timeout
   - A4 format with 1cm margins

2. **report-renderer.ts** - Server-side HTML renderer
   - RGB colors for Puppeteer compatibility
   - Generates static HTML (no React/client components)
   - White-label branding support
   - Localization support

3. **report-processor.ts** - BullMQ worker
   - Fetches data, renders HTML, generates PDF
   - Writes to filesystem: `{REPORTS_DIR}/{clientId}/{date}_{type}.pdf`
   - Email delivery integration

### Client-side Export
Location: `apps/web/src/lib/export/pdf.ts`
- Browser print-to-PDF approach
- Data table export utility
- Not suitable for server-side generation

### Prospect Analysis Data
Location: `open-seo-main/src/db/prospect-schema.ts`

Available data for PDF:
- `domainMetrics`: domainRank, organicTraffic, organicKeywords, backlinks, referringDomains
- `organicKeywords[]`: keyword, position, searchVolume, cpc, url
- `keywordGaps[]`: keyword, competitorDomain, position, volume, cpc, difficulty, achievability
- `opportunityKeywords[]`: keyword, category, searchVolume, cpc, difficulty, opportunityScore, classification
- `scrapedContent.businessInfo`: products, brands, services, location, targetMarket, summary

## Integration Points

1. Use existing `generatePDF()` from pdf-generator.ts
2. Create new renderer similar to report-renderer.ts pattern
3. Add API route for PDF download
4. Button on prospect detail page to trigger export

## Success Criteria

1. PDF contains domain metrics summary
2. PDF shows top 20 keyword gap opportunities
3. PDF includes opportunity keywords section
4. AI executive summary from business info
5. Clean, professional template
6. Download via API endpoint
