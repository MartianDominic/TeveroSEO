# Phase 36: Content Brief Generation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

AI-powered content brief generation system. Identifies keyword-to-page gaps, generates comprehensive briefs with competitor analysis, SERP feature targets, and semantic keywords. Includes draft generation queue, quality scoring across 5 dimensions, and publish workflow with scheduling.

</domain>

<decisions>
## Implementation Decisions

### Content Gap Detection
- Integrate with Phase 34 keyword-page mapping to identify keywords without mapped pages
- Sort gaps by: `searchVolume * businessRelevance`
- Display top gaps in ContentGapDashboard with "Create Brief" action
- Auto-generate briefs for high-priority gaps when `briefs.auto_generate` is enabled

### Brief Generation Architecture
- Use Claude/Gemini for AI brief generation (consistent with existing AI services)
- Generate comprehensive brief components:
  - 3 suggested title options
  - Target word count range (default 1,500-2,500)
  - H2/H3 outline structure
  - Top 5 competitor analysis from SERP
  - Semantic keywords to include
  - Internal link opportunities (from Phase 35)
  - Required schema markup (FAQ, HowTo)
- BullMQ job for async brief generation with progress tracking

### Brief Editor & Enhancement
- Full WYSIWYG brief editor with section management (Accept/Edit/Remove/Add)
- KnowledgeInserter component pulls from client knowledge base:
  - Case studies, stats, testimonials
  - Product mentions and brand voice
- SEO parameter panel for:
  - Primary/secondary keywords
  - Target featured snippet type
  - Required schema types

### Quality Scoring System
- 5-dimension quality gate (all must score 75+ to pass):
  1. **Accuracy**: Factual correctness, source citations
  2. **Readability**: Flesch score, sentence length, paragraph structure
  3. **SEO**: Keyword density, meta tags, internal links
  4. **Voice**: Brand voice compliance (integrates with Phase 37)
  5. **Engagement**: CTAs, hooks, value propositions
- BriefQualityScore component shows completeness and missing items
- QualityGate runs before publish approval

### Draft Generation & Review
- AI draft generation from approved brief
- DraftReviewQueue for content manager workflow
- BriefComparisonView: side-by-side brief vs draft
- DraftEditor for inline editing
- Voice compliance score integration (Phase 37 dependency)

### Publishing Workflow
- PublishApproval decisions: Publish now / Schedule / Send back
- Calendar integration for scheduling
- Auto-notification to stakeholders
- Post-publish monitoring queue

### Database Schema
- `content_briefs` table:
  - id, clientId, keywordId, status (draft/ready/generating/review/approved/published)
  - title_options (JSONB array)
  - word_count_min, word_count_max
  - outline (JSONB with H2/H3 structure)
  - competitor_analysis (JSONB)
  - semantic_keywords (JSONB array)
  - internal_links (JSONB array)
  - schema_types (JSONB array)
  - quality_scores (JSONB with 5 dimensions)
  - assigned_to, due_date, publish_date
- `content_drafts` table:
  - id, briefId, content, version
  - quality_scores, voice_score
  - reviewer_notes
  - status (draft/review/approved/rejected)

### Settings Integration
- Workspace-level: auto_generate, word count defaults, required sections, competitor analysis toggle
- Client-level: review_required_before_publish, custom_sections

### Claude's Discretion
- Specific AI prompt engineering for brief generation
- Component composition within shadcn/ui patterns
- Caching strategy for SERP analysis results
- Error handling and retry logic

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/features/mapping/` — Keyword-page mapping from Phase 34
- `src/server/features/linking/` — Internal link opportunities from Phase 35
- `src/server/lib/dataforseoClient.ts` — SERP data fetching
- `src/server/lib/proposals/gemini.ts` — Gemini AI generation patterns
- `@tevero/ui` — Editor, Card, Tabs, Badge, Dialog components

### Established Patterns
- BullMQ for async job processing
- TanStack Query for data fetching
- Drizzle pg-core tables with JSONB for flexible data
- Quality scoring patterns from proposal generation

### Integration Points
- `src/server/features/briefs/` — New briefs feature module
- `src/routes/api/seo/briefs/` — New API routes
- `apps/web/src/app/(shell)/clients/[clientId]/briefs/` — New UI route

</code_context>

<specifics>
## Specific Ideas

- ContentGapDashboard should show keyword volume sparklines
- Brief editor should have keyboard shortcuts for common actions
- Quality scores should show trend over revisions
- Competitor analysis should highlight content gaps vs top 5 rankings
- Internal link suggestions should show anchor text previews
- Draft comparison should highlight differences with track changes style

</specifics>

<deferred>
## Deferred Ideas

- Multi-language brief generation
- Brief templates per content type (blog, landing page, product)
- Collaborative editing with multiple reviewers
- Brief performance tracking post-publish
- A/B testing for titles and meta descriptions
- Integration with external CMS for direct publishing

</deferred>
