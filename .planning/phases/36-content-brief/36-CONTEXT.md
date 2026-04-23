# Phase 36: Content Brief Generation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate content briefs from SERP analysis. Each brief includes target keyword, required H2s, competitor word counts, PAA questions, and voice mode selection. Briefs flow into AI-Writer for content generation.

</domain>

<decisions>
## Implementation Decisions

### SERP Analysis & Data Extraction
- Use DataForSEO `serp/google/organic/live/advanced` API (already integrated in `dataforseo.ts`)
- Analyze top 10 organic results for comprehensive competitor analysis
- Extract from competitors: word count, H2 headings, PAA questions, meta title/desc length
- Cache SERP results in Redis with 24h TTL to minimize API costs (~$0.005/query)

### Content Brief Schema & Storage
- Store briefs in `content_briefs` table in open-seo-main (Drizzle pg-core)
- Status workflow: `draft` → `ready` → `generating` → `published` (matches AI-Writer article flow)
- FK to `keyword_page_mapping` (Phase 34) for clear keyword → brief → content pipeline
- JSONB column `serpAnalysis` for flexible SERP extraction storage

### UI Wizard & AI-Writer Integration
- Route: `/clients/[clientId]/content-briefs` (new route under existing shell)
- 3-step wizard: Select keyword → SERP analysis preview → Configure & save
- Voice mode: Radio group with 3 options (preservation, application, best_practices) + tooltip explanations
- AI-Writer integration via internal API call to FastAPI `/api/articles/generate-from-brief`

### Claude's Discretion
- Specific component composition and styling within shadcn/ui patterns
- Error handling and loading state implementations
- Test coverage approach beyond minimum requirements

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `open-seo-main/src/server/lib/dataforseo.ts` — `fetchLiveSerpItemsRaw()` for SERP API calls
- `open-seo-main/src/db/` — Drizzle schema patterns (link-schema.ts, change-schema.ts as examples)
- `@tevero/ui` — Card, Table, Button, Badge, Radio components
- AI-Writer `/api/articles/` routes for content generation

### Established Patterns
- Drizzle pg-core tables with UUID primary keys, timestamps
- TanStack Query for data fetching in Next.js
- BullMQ for async job processing
- Server actions for Next.js → open-seo API calls

### Integration Points
- `apps/web/src/app/(shell)/clients/[clientId]/` — new `content-briefs/` route
- `open-seo-main/src/routes/api/seo/` — new brief API routes
- AI-Writer FastAPI for content generation trigger

</code_context>

<specifics>
## Specific Ideas

- Brief wizard should show SERP analysis preview before final save (competitor word counts, common H2s)
- Voice mode tooltips should explain when to use each mode (preservation for branded content, application for new content in client voice, best_practices for SEO-optimized defaults)
- "Generate Content" button sends brief to AI-Writer and shows generation status

</specifics>

<deferred>
## Deferred Ideas

- Bulk brief generation for multiple keywords (future enhancement)
- Brief templates based on content type (blog post vs landing page vs product page)
- AI-assisted H2 suggestions beyond competitor extraction

</deferred>
