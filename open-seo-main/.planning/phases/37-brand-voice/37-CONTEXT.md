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
- Use existing Cheerio scraper (Phase 27) + Claude AI for voice extraction
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

### Database Schema
- `voice_profiles` table:
  - id, clientId, mode (preservation/application/best_practices)
  - tone_primary, tone_secondary, formality_level (1-10)
  - personality_traits (JSONB array)
  - archetype (professional/casual/technical/friendly/authoritative)
  - sentence_length_avg, paragraph_length_avg
  - contraction_usage (never/sometimes/frequently)
  - vocabulary_patterns (JSONB: preferred words, avoided words)
  - signature_phrases, forbidden_phrases (JSONB arrays)
  - heading_style (title_case/sentence_case/all_caps)
  - confidence_score (0-100)
  - analyzed_at, last_updated
- `voice_analysis` table:
  - id, profileId, url, raw_analysis (JSONB)
  - extracted_tone, extracted_formality
  - sample_sentences (JSONB)
  - created_at
- `content_protection_rules` table:
  - id, profileId, rule_type (page/section/pattern)
  - target (URL, CSS selector, or regex)
  - expires_at (nullable)
  - reason, created_by

### Industry Templates
- 8 pre-configured voice templates:
  - Healthcare (empathetic, clear, authoritative)
  - Legal (formal, precise, trustworthy)
  - E-commerce (friendly, action-oriented)
  - B2B SaaS (professional, technical, solution-focused)
  - Financial (trustworthy, precise, compliant)
  - Real Estate (warm, professional, local)
  - Home Services (friendly, reliable, local)
  - Technology (innovative, clear, expert)
- Templates provide sensible defaults, user can customize any dimension

### AI-Writer Integration
- **Dynamic voice-constrained prompts**: Full profile injected into article generation with tone, vocabulary constraints, structure requirements, required/forbidden phrases
- **Post-generation compliance audit**: AI checks generated content against profile, scores each dimension (tone, vocabulary, structure, personality), flags issues with severity and suggestions
- **Pre-generation filtering**: In preservation mode, protected sections excluded from content generation
- **Weighted voice blending**: 0.0-1.0 slider to blend client voice with industry template — useful for new clients building their voice

### Voice Compliance Scoring
- Score generated content against voice profile
- 5 dimension scores: tone_match, vocabulary_match, structure_match, personality_match, rule_compliance
- Overall compliance percentage
- Specific flags for violations with line numbers and suggestions
- Integrate with Phase 36 brief quality gate

### Claude's Discretion
- Specific component composition within shadcn/ui and Radix patterns
- Error handling and loading state implementations
- Background job retry and failure handling specifics
- Redis caching strategy for voice profiles

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/server/lib/scraper/` — Cheerio scraper from Phase 27
- `src/db/brief-schema.ts` — Voice mode enum already defined (preservation/application/best_practices)
- `src/server/lib/proposals/gemini.ts` — AI generation patterns
- `@tevero/ui` — Card, Tabs, RadioGroup, Slider, Badge, Dialog components
- BullMQ patterns from existing background jobs

### Established Patterns
- Drizzle pg-core tables with UUID primary keys, timestamps, JSONB for flexible data
- BullMQ for async job processing (analysis, audit logging)
- TanStack Query for data fetching in Next.js
- Server actions for API calls

### Integration Points
- `apps/web/src/app/(shell)/clients/[clientId]/settings/voice/` — new settings route
- `src/server/features/voice/` — new voice services directory
- `src/db/voice-schema.ts` — new schema file
- Phase 36 BriefGenerator — inject voice profile into brief generation
- AI-Writer article generation — voice-constrained prompts

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
