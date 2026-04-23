# Phase 37: Brand Voice Management - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Full brand voice system with three modes: preservation (protect brand text from SEO changes), application (write in client's learned voice), best_practices (use industry defaults). Voice learning from existing content via AI analysis. Agency-grade UI with guided setup, full preview suite, and visual protection rules editor.

</domain>

<decisions>
## Implementation Decisions

### Voice Learning Architecture
- Use existing Cheerio scraper (Phase 27) + Claude AI for voice extraction — no additional API costs
- Analyze 5-10 pages per client for voice learning (homepage, about, blog posts, key pages)
- Extract core 12 dimensions: tone (primary + secondary), formality level, personality traits, archetype, sentence length, paragraph length, contraction frequency, vocabulary patterns, signature phrases, forbidden phrases, heading style
- Confidence threshold: 70% — below this, flag for manual review and adjustment
- Voice analysis runs as BullMQ background job with progress tracking

### Voice Settings UI/UX (Agency-Grade)
- **Tabbed interface + sidebar summary**: Tabs (Tone, Vocabulary, Writing, SEO Rules, Protection) with always-visible voice profile summary card showing current mode, confidence, last analysis
- **Full preview suite**: Generate 3 sample types (headline, paragraph, CTA) with compliance scores per dimension + regenerate button
- **Visual protection rules editor**: Page rules, section CSS selectors, regex text patterns, expiration dates, bulk import from CSV
- **Guided wizard for mode selection**: Decision tree ("Does client have existing brand text?" → "Do they want to preserve specific sections?") that recommends mode + shows onboarding steps
- Route: `/clients/[clientId]/settings/voice`

### Database & API Design (Full Spec)
- Implement complete schema from design doc:
  - `voice_profiles` — Full 40+ field profile with tone, personality, vocabulary, writing mechanics, SEO integration
  - `voice_analysis` — AI analysis results with metrics, extracted vocabulary, structural patterns, rhetorical devices
  - `content_protection_rules` — Page, section, and pattern-based protection rules with expiration
  - `voice_templates` — 8 industry templates + custom agency templates
  - `voice_audit_log` — Every content generation logged with compliance scores and issues
- Industry templates: healthcare, legal, ecommerce, B2B SaaS, financial, real estate, home services, technology
- Full audit trail: log content ID, voice scores per dimension, issues found, before/after for changes
- RESTful API with bulk operations: CRUD + bulk import/export + analyze-url + analyze-content + preview endpoints

### AI-Writer Integration
- **Dynamic voice-constrained prompts**: Full profile injected into `_build_article_prompt()` with tone, vocabulary constraints, structure requirements, required/forbidden phrases
- **Post-generation compliance audit**: AI checks generated content against profile, scores each dimension (tone, vocabulary, structure, personality), flags issues with severity and suggestions
- **Pre-generation filtering**: In preservation mode, protected sections excluded from content generation. System identifies protected areas before sending to AI.
- **Weighted voice blending**: 0.0-1.0 slider to blend client voice with industry template — useful for new clients building their voice

### Claude's Discretion
- Specific component composition within shadcn/ui and Radix patterns
- Error handling and loading state implementations
- Background job retry and failure handling specifics
- Redis caching strategy for voice profiles

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AI-Writer/backend/api/voice_templates.py` — Existing voice templates router (basic implementation)
- `AI-Writer/backend/services/persona_analysis_service.py` — Brand voice analysis patterns
- `AI-Writer/backend/services/article_generation_service.py` — `brand_voice` parameter in generation
- `open-seo-main/src/server/features/scraping/` — Cheerio scraper from Phase 27
- `open-seo-main/src/db/schema/` — Drizzle pg-core patterns (link-schema.ts, change-schema.ts)
- `@tevero/ui` — Card, Tabs, RadioGroup, Slider, Badge, Dialog components

### Established Patterns
- Drizzle pg-core tables with UUID primary keys, timestamps, JSONB for flexible data
- BullMQ for async job processing (analysis, audit logging)
- TanStack Query for data fetching in Next.js
- Server actions for Next.js → open-seo API calls
- AI-Writer FastAPI integration via internal API

### Integration Points
- `apps/web/src/app/(shell)/clients/[clientId]/settings/` — new `voice/` route
- `open-seo-main/src/routes/api/seo/` — new voice profile API routes
- `open-seo-main/src/server/features/voice/` — new voice services directory
- `AI-Writer/backend/services/article_generation_service.py` — enhanced with voice profile
- `AI-Writer/backend/api/` — new voice analysis endpoints

</code_context>

<specifics>
## Specific Ideas

- Guided wizard should include visual examples of each voice mode with before/after content samples
- "Learn Voice" button shows real-time progress as pages are scraped and analyzed
- Voice preview should highlight which parts of generated text match/violate profile constraints
- Protection rules editor should include "Test Rule" button to preview what would be protected on a URL
- Industry templates should show example content in that voice style before selection
- Dashboard should show voice consistency trends over time (per-client audit log visualization)

</specifics>

<deferred>
## Deferred Ideas

- Voice A/B testing: generate content in two voice variants, track performance
- Multi-language voice profiles (voice learning for non-English content)
- Voice collaboration: multiple team members can contribute to voice profile
- Voice version history with rollback
- Automated voice drift detection (alert when content deviates from profile)
- Voice export/import between clients (copy voice profile)

</deferred>
