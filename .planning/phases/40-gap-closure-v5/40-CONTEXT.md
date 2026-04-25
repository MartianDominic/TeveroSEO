# Phase 40: v5.0 Gap Closure - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated (plans pre-exist from gap closure audit)

<domain>
## Phase Boundary

Close all implementation gaps across Phases 32, 35, 36, 37, and 39 to achieve 100% completion of the Autonomous SEO Pipeline milestone. This phase wires existing implementations to real data sources and creates missing API endpoints.

</domain>

<decisions>
## Implementation Decisions

### P32: 107 SEO Checks
- Wire FindingsRepository.getByPageId() to audit route
- Create API endpoint at /api/audit/pages/$pageId/findings
- Remove hardcoded mock data from audit page

### P35: Internal Linking
- Implement getGscKeywordData() to query gsc_snapshots table
- Wire isTargetCannibalized() to CannibalizationService
- Use real GSC ranking data for cannibalization detection

### P36: Content Briefs
- Implement extractCommonH2s() using DataForSEO OnPage API
- Implement calculateWordCountStats() by parsing SERP HTML
- Create combined SerpContentAnalyzer for cost optimization

### P37: Brand Voice
- Create /api/voice/$clientId/preview endpoint
- Create /api/voice/$clientId/constraints endpoint
- Create /api/voice/$clientId/compliance endpoint
- Connect AI-Writer to open-seo voice services

### P39: AI-Writer Integration
- Add PAA questions to _build_article_prompt()
- Create /api/seo/content/validate endpoint
- Implement QualityGate class with score >= 80 threshold
- Add GSC URL submission via Indexing API
- Create InternalLinkInserter class for auto-insertion
- Update link graph on successful publish
- Create apps/web proxy route for content validation

### Claude's Discretion
- Implementation details follow existing patterns in each codebase
- Error handling follows established conventions
- Test coverage per existing standards

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- FindingsRepository at `open-seo-main/src/server/features/audit/repositories/FindingsRepository.ts`
- CannibalizationService at `open-seo-main/src/server/features/linking/services/CannibalizationService.ts`
- VoiceConstraintBuilder at `open-seo-main/src/server/features/voice/services/VoiceConstraintBuilder.ts`
- VoiceComplianceService at `open-seo-main/src/server/features/voice/services/VoiceComplianceService.ts`
- LinkSuggestionService at `open-seo-main/src/server/features/linking/services/LinkSuggestionService.ts`
- dataForSeoClient at `open-seo-main/src/server/lib/dataforseo.ts`
- GSCService at `AI-Writer/backend/services/gsc_service.py`

### Established Patterns
- TanStack Router file-based API routes in open-seo-main
- Server actions in apps/web for backend calls
- httpx async client in AI-Writer for external API calls
- BullMQ for background job processing

### Integration Points
- open-seo-main APIs called from AI-Writer via HTTP
- apps/web proxies to open-seo-main via server actions
- Shared PostgreSQL with gsc_snapshots table
- Redis for caching SERP data

</code_context>

<specifics>
## Specific Ideas

- DataForSEO OnPage API costs ~$0.02/page, batch 5 URLs = $0.10/brief
- GSC Indexing API quota: 200 URLs/day
- Quality gate threshold: score >= 80 for auto-publish
- Voice compliance threshold: score >= 75
- Internal links per article: 3-7 contextual links

</specifics>

<deferred>
## Deferred Ideas

None — phase scope matches existing gap closure plans.

</deferred>
