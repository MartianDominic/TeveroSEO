# v5.0 Autonomous SEO Pipeline — Gap Closure Plan

> **Document created**: 2026-04-24
> **Purpose**: Detailed solutions for all gaps identified in Phases 32, 35, 36, 37, and 39
> **Total gaps**: 15 critical items across 5 phases

---

## Executive Summary

| Phase | Current | Target | Gap Size | Priority |
|-------|---------|--------|----------|----------|
| 32 — 107 SEO Checks | 85% | 100% | 15% | HIGH |
| 35 — Internal Linking | 92% | 100% | 8% | MEDIUM |
| 36 — Content Briefs | 75% | 100% | 25% | HIGH |
| 37 — Brand Voice | 85% | 100% | 15% | MEDIUM |
| 39 — AI-Writer Integration | 35% | 100% | 65% | CRITICAL |

**Estimated total effort**: 3-4 weeks

---

## Phase 32: 107 SEO Checks — Gap Closure

### Current State
- All 107 checks implemented in `open-seo-main/src/server/lib/audit/checks/`
- Schema exists at `dashboard-schema.ts:171-197`
- FindingsRepository exists in both codebases
- **Problem**: Route uses mock data instead of real findings

### Gap 32-A: Route Uses Mock Data

**Location**: `open-seo-main/src/routes/_project/p/$projectId/audit/$pageId/index.tsx`

**Current code (lines 17-64)**:
```typescript
// MOCK DATA - needs to be replaced with real API call
const mockScore = { ... };
const mockFindings = [ ... ];
```

**Solution**:
1. Create API route `/api/audit/pages/$pageId/findings`
2. Wire FindingsRepository to fetch real data
3. Replace mock data with `useQuery` or `loader` fetching real findings

**Implementation**:

```typescript
// src/routes/api/audit/pages/$pageId/findings.ts
import { createFileRoute } from "@tanstack/react-router";
import { FindingsRepository } from "@/server/features/audit/repositories/FindingsRepository";

export const Route = createFileRoute("/api/audit/pages/$pageId/findings")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const findings = await FindingsRepository.getByPageId(params.pageId);
        const score = await FindingsRepository.getScoreByPageId(params.pageId);
        return Response.json({ findings, score });
      },
    },
  },
});
```

```typescript
// Update index.tsx loader
export const Route = createFileRoute("/_project/p/$projectId/audit/$pageId")({
  loader: async ({ params }) => {
    const response = await fetch(`/api/audit/pages/${params.pageId}/findings`);
    return response.json();
  },
  component: AuditPageDetail,
});

function AuditPageDetail() {
  const { findings, score } = Route.useLoaderData();
  // Use real data instead of mock
}
```

**Files to modify**:
- `src/routes/_project/p/$projectId/audit/$pageId/index.tsx` — remove mock, add loader
- `src/routes/api/audit/pages/$pageId/findings.ts` — new API route

**Effort**: 2-3 hours

---

### Gap 32-B: apps/web Check Runner Has Stubs

**Location**: `apps/web/src/lib/audit/checks/runner.ts`

**Problem**: ~60 of 107 checks return placeholder results like:
```typescript
return { passed: true, message: "check requires full HTML analysis" };
```

**Solution Options**:

**Option A (Recommended)**: Proxy to open-seo-main
- apps/web calls open-seo-main API for check execution
- open-seo-main has full implementations
- No duplication of check logic

```typescript
// apps/web/src/lib/audit/checks/facade.ts
export async function runAllChecks(url: string, keyword: string) {
  const response = await getOpenSeo(`/api/audit/run-checks`, {
    method: "POST",
    body: JSON.stringify({ url, keyword }),
  });
  return response.json();
}
```

**Option B**: Port check implementations
- Copy check implementations from open-seo-main to apps/web
- Maintain parity between codebases
- Higher maintenance burden

**Recommendation**: Option A — single source of truth in open-seo-main

**Effort**: 4-6 hours

---

## Phase 35: Internal Linking — Gap Closure

### Current State
- 92% complete with full schema and services
- Link graph, orphan detection, velocity control all working
- **Problem**: Cannibalization detection uses stub for GSC data

### Gap 35-A: GSC Integration in CannibalizationService

**Location**: `open-seo-main/src/server/features/linking/services/CannibalizationService.ts:243-251`

**Current code**:
```typescript
private async getGscKeywordData(
  clientId: string,
  _keyword: string
): Promise<GscKeywordData[]> {
  // TODO: Implement GSC data fetching
  // For now, return empty array to allow flow to continue
  return [];
}
```

**Solution**:
Wire to existing GSC snapshot data from Phase 13.

```typescript
import { db } from "@/db";
import { gscSnapshots } from "@/db/analytics-schema";
import { eq, and, like } from "drizzle-orm";

private async getGscKeywordData(
  clientId: string,
  keyword: string
): Promise<GscKeywordData[]> {
  // Fetch from gsc_snapshots table (populated by Phase 13 sync)
  const snapshots = await db
    .select({
      query: gscSnapshots.query,
      page: gscSnapshots.page,
      clicks: gscSnapshots.clicks,
      impressions: gscSnapshots.impressions,
      position: gscSnapshots.position,
    })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        like(gscSnapshots.query, `%${keyword}%`)
      )
    )
    .orderBy(desc(gscSnapshots.impressions))
    .limit(50);

  return snapshots.map((s) => ({
    keyword: s.query,
    url: s.page,
    clicks: s.clicks,
    impressions: s.impressions,
    position: s.position,
  }));
}
```

**Files to modify**:
- `src/server/features/linking/services/CannibalizationService.ts`

**Effort**: 2-3 hours

---

### Gap 35-B: Wire isTargetCannibalized

**Location**: `open-seo-main/src/server/features/linking/services/LinkSuggestionService.ts:198-203`

**Current code**:
```typescript
private async isTargetCannibalized(
  _clientId: string,
  _sourceKeyword: string,
  _targetUrl: string
): Promise<boolean> {
  // TODO: Implement cannibalization check
  return false;
}
```

**Solution**:
```typescript
private async isTargetCannibalized(
  clientId: string,
  sourceKeyword: string,
  targetUrl: string
): Promise<boolean> {
  const cannibalizationService = new CannibalizationService();
  const result = await cannibalizationService.isTargetCannibalized(
    clientId,
    sourceKeyword,
    targetUrl
  );
  return result.isCannibalized;
}
```

**Files to modify**:
- `src/server/features/linking/services/LinkSuggestionService.ts`

**Effort**: 1 hour

---

## Phase 36: Content Briefs — Gap Closure

### Current State
- 75% complete with schema, wizard UI, AI-Writer integration
- **Problems**: SERP H2 extraction and word count are stubs

### Gap 36-A: Implement extractCommonH2s

**Location**: `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts:27-39`

**Current code**:
```typescript
export function extractCommonH2s(
  _items: SerpLiveItem[]
): { heading: string; frequency: number }[] {
  // TODO: Implement H2 extraction via OnPage API or HTML parsing
  return [];
}
```

**Solution**: Use DataForSEO OnPage API to fetch full HTML, then parse H2s with cheerio.

```typescript
import * as cheerio from "cheerio";
import { dataForSeoClient } from "@/server/lib/dataforseo";

export async function extractCommonH2s(
  urls: string[]
): Promise<{ heading: string; frequency: number }[]> {
  const h2Counts = new Map<string, number>();

  // Fetch HTML for top 5 competitors via DataForSEO OnPage
  const htmlResults = await Promise.all(
    urls.slice(0, 5).map(async (url) => {
      try {
        const response = await dataForSeoClient.post("/on_page/raw_html", {
          url,
          enable_javascript: true,
        });
        return response.data?.tasks?.[0]?.result?.[0]?.html || null;
      } catch {
        return null;
      }
    })
  );

  // Parse H2s from each page
  for (const html of htmlResults) {
    if (!html) continue;
    const $ = cheerio.load(html);
    $("h2").each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.length > 3 && text.length < 100) {
        h2Counts.set(text, (h2Counts.get(text) || 0) + 1);
      }
    });
  }

  // Return H2s appearing in 2+ pages
  return Array.from(h2Counts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([heading, frequency]) => ({ heading, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}
```

**Cost**: ~$0.10 per 5 pages (DataForSEO OnPage API)

**Files to modify**:
- `src/server/features/briefs/services/SerpAnalyzer.ts`

**Effort**: 4-6 hours

---

### Gap 36-B: Implement calculateWordCountStats

**Location**: `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts:50-57`

**Current code**:
```typescript
export function calculateWordCountStats(
  _items: SerpLiveItem[]
): { min: number; max: number; avg: number } {
  // TODO: Implement word count extraction
  return { min: 0, max: 0, avg: 0 };
}
```

**Solution**: Extend the OnPage fetch to count words.

```typescript
export async function calculateWordCountStats(
  urls: string[]
): Promise<{ min: number; max: number; avg: number }> {
  const wordCounts: number[] = [];

  const htmlResults = await Promise.all(
    urls.slice(0, 5).map(async (url) => {
      try {
        const response = await dataForSeoClient.post("/on_page/raw_html", {
          url,
          enable_javascript: true,
        });
        return response.data?.tasks?.[0]?.result?.[0]?.html || null;
      } catch {
        return null;
      }
    })
  );

  for (const html of htmlResults) {
    if (!html) continue;
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, nav, footer
    $("script, style, nav, footer, header, aside").remove();
    
    // Get main content text
    const text = $("article, main, .content, body").first().text();
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    wordCounts.push(words.length);
  }

  if (wordCounts.length === 0) {
    return { min: 1500, max: 2500, avg: 2000 }; // Sensible defaults
  }

  return {
    min: Math.min(...wordCounts),
    max: Math.max(...wordCounts),
    avg: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
  };
}
```

**Optimization**: Combine with H2 extraction in single API call.

**Files to modify**:
- `src/server/features/briefs/services/SerpAnalyzer.ts`

**Effort**: 2-3 hours (if combined with Gap 36-A)

---

### Gap 36-C: 107 Checks on Generated Content

**Problem**: Generated content is NOT validated before publishing.

**Solution**: Add post-generation validation step in AI-Writer callback.

**Implementation**:

1. Create validation endpoint in open-seo-main:
```typescript
// src/routes/api/seo/content/validate.ts
export const Route = createFileRoute("/api/seo/content/validate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { html, keyword, clientId } = await request.json();
        
        // Run 107 checks on generated HTML
        const findings = await runAllChecks({ html, keyword });
        const score = calculateScore(findings);
        
        return Response.json({
          score,
          findings,
          approved: score >= 80,
        });
      },
    },
  },
});
```

2. Call from AI-Writer after generation:
```python
# AI-Writer/backend/services/article_generation_service.py
async def _post_generation_validation(self, article_id: str, html: str, keyword: str):
    response = await self.open_seo_client.post(
        "/api/seo/content/validate",
        json={"html": html, "keyword": keyword, "clientId": self.client_id}
    )
    result = response.json()
    
    if result["score"] < 80:
        # Flag for review instead of auto-publish
        await self._update_article_status(article_id, "needs_review", result["findings"])
    else:
        await self._update_article_status(article_id, "approved")
```

**Files to create/modify**:
- `open-seo-main/src/routes/api/seo/content/validate.ts` — new
- `AI-Writer/backend/services/article_generation_service.py` — add validation call

**Effort**: 6-8 hours

---

## Phase 37: Brand Voice — Gap Closure

### Current State
- 85% complete with full schema, services, UI
- **Problems**: AI-Writer integration, voice preview API, audit logging

### Gap 37-A: AI-Writer Voice Integration

**Problem**: AI-Writer has its own voice template system (`/api/voice-templates`) that doesn't use open-seo-main's `VoiceConstraintBuilder`.

**Solution**: Create bridge API that AI-Writer calls to get voice constraints.

```typescript
// open-seo-main/src/routes/api/voice/$clientId/constraints.ts
export const Route = createFileRoute("/api/voice/$clientId/constraints")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("mode") || "application";
        
        const builder = new VoiceConstraintBuilder();
        const constraints = await builder.build(params.clientId, mode as VoiceMode);
        
        return Response.json(constraints);
      },
    },
  },
});
```

```python
# AI-Writer/backend/services/article_generation_service.py
async def _get_voice_constraints(self, client_id: str, mode: str) -> dict:
    """Fetch voice constraints from open-seo-main instead of local templates."""
    response = await self.open_seo_client.get(
        f"/api/voice/{client_id}/constraints",
        params={"mode": mode}
    )
    return response.json()

def _build_article_prompt(self, settings, voice_constraints):
    # Use voice_constraints from open-seo-main
    prompt = f"""
    {voice_constraints['system_prompt']}
    
    TONE: {voice_constraints['tone']}
    FORMALITY: {voice_constraints['formality']}
    PERSONALITY: {voice_constraints['personality']}
    VOCABULARY TO USE: {', '.join(voice_constraints['preferred_vocabulary'])}
    VOCABULARY TO AVOID: {', '.join(voice_constraints['forbidden_phrases'])}
    ...
    """
```

**Files to create/modify**:
- `open-seo-main/src/routes/api/voice/$clientId/constraints.ts` — new
- `AI-Writer/backend/services/article_generation_service.py` — replace local voice with API call

**Effort**: 4-6 hours

---

### Gap 37-B: Voice Preview API

**Problem**: `VoicePreviewPanel` calls `/api/voice/${clientId}/preview` but endpoint not found.

**Solution**:
```typescript
// open-seo-main/src/routes/api/voice/$clientId/preview.ts
export const Route = createFileRoute("/api/voice/$clientId/preview")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const { sampleText, voiceMode } = await request.json();
        
        // Get voice profile
        const profile = await VoiceProfileRepository.getByClientId(params.clientId);
        if (!profile) {
          return Response.json({ error: "No voice profile" }, { status: 404 });
        }
        
        // Generate preview using Claude
        const builder = new VoiceConstraintBuilder();
        const constraints = await builder.build(params.clientId, voiceMode);
        
        const preview = await generateVoicePreview(sampleText, constraints);
        
        // Score compliance
        const compliance = await VoiceComplianceService.score(preview, profile);
        
        return Response.json({
          preview,
          compliance,
        });
      },
    },
  },
});
```

**Files to create**:
- `open-seo-main/src/routes/api/voice/$clientId/preview.ts`

**Effort**: 3-4 hours

---

## Phase 39: AI-Writer Integration — Gap Closure (CRITICAL)

### Current State
- 35% complete — only token tracking fully implemented
- **Major gaps**: Quality gate, GSC submission, internal link auto-insertion

### Gap 39-A: Quality Gate (Score >= 80)

**Problem**: `auto_publish_executor.py` uses simple boolean `auto_publish`, no quality scoring.

**Solution**: Add SEO score check before auto-publish approval.

```python
# AI-Writer/backend/services/auto_publish_executor.py

async def _should_auto_publish(self, article: Article) -> tuple[bool, str]:
    """Check if article meets quality gate for auto-publish."""
    
    # Get SEO score from open-seo-main
    validation = await self._validate_content(article)
    
    if validation["score"] < 80:
        return False, f"SEO score {validation['score']} below threshold (80)"
    
    # Check voice compliance if voice profile exists
    if article.voice_mode and article.voice_mode != "best_practices":
        compliance = await self._check_voice_compliance(article)
        if compliance["overall_score"] < 75:
            return False, f"Voice compliance {compliance['overall_score']} below threshold (75)"
    
    return True, "Quality gate passed"

async def _process_article(self, article: Article):
    # ... existing code ...
    
    if article.auto_publish:
        can_publish, reason = await self._should_auto_publish(article)
        if not can_publish:
            await self._flag_for_review(article, reason)
            return
    
    # Proceed with publishing
    await self._publish_article(article)
```

**Files to modify**:
- `AI-Writer/backend/services/auto_publish_executor.py`

**Effort**: 4-6 hours

---

### Gap 39-B: GSC URL Submission

**Problem**: No Indexing API integration after publish.

**Solution**: Add URL submission to GSC after successful publish.

```python
# AI-Writer/backend/services/gsc_service.py

async def submit_url_for_indexing(self, client_id: str, url: str) -> dict:
    """Submit URL to Google Search Console Indexing API."""
    credentials = await self._get_client_credentials(client_id)
    if not credentials:
        return {"success": False, "error": "No GSC credentials"}
    
    service = build("indexing", "v3", credentials=credentials)
    
    try:
        response = service.urlNotifications().publish(
            body={
                "url": url,
                "type": "URL_UPDATED"
            }
        ).execute()
        
        return {
            "success": True,
            "url_notification_metadata": response.get("urlNotificationMetadata")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
```

```python
# AI-Writer/backend/services/auto_publish_executor.py

async def _post_publish_actions(self, article: Article, published_url: str):
    """Actions after successful publish."""
    
    # 1. Submit to GSC
    gsc_result = await self.gsc_service.submit_url_for_indexing(
        article.client_id, 
        published_url
    )
    logger.info(f"GSC submission: {gsc_result}")
    
    # 2. Ping sitemap (optional)
    await self._ping_sitemap(article.client_id)
    
    # 3. Update link graph
    await self._update_link_graph(article.client_id, published_url, article.content)
```

**Files to modify**:
- `AI-Writer/backend/services/gsc_service.py` — add `submit_url_for_indexing`
- `AI-Writer/backend/services/auto_publish_executor.py` — add post-publish actions

**Effort**: 4-6 hours

---

### Gap 39-C: Internal Link Auto-Insertion

**Problem**: `LinkGraphAgent` returns suggestions but doesn't auto-insert into generated HTML.

**Solution**: Create post-generation processor that inserts links.

```python
# AI-Writer/backend/services/internal_link_inserter.py

class InternalLinkInserter:
    def __init__(self, client_id: str):
        self.client_id = client_id
        self.open_seo_client = OpenSeoClient()
    
    async def insert_links(self, html: str, keyword: str) -> str:
        """Auto-insert internal links into generated HTML."""
        
        # 1. Get link suggestions from open-seo-main
        suggestions = await self.open_seo_client.post(
            f"/api/seo/links/suggestions",
            json={
                "clientId": self.client_id,
                "content": html,
                "keyword": keyword,
                "maxLinks": 7,
            }
        )
        
        if not suggestions.get("links"):
            return html
        
        # 2. Parse HTML
        soup = BeautifulSoup(html, "html.parser")
        
        # 3. Insert each link
        inserted_count = 0
        for link in suggestions["links"]:
            if inserted_count >= 7:
                break
            
            # Find anchor text in content
            anchor = link["anchorText"]
            target = link["targetUrl"]
            
            # Find text nodes containing anchor
            for text_node in soup.find_all(string=re.compile(re.escape(anchor), re.I)):
                # Skip if already in a link
                if text_node.parent.name == "a":
                    continue
                
                # Replace first occurrence with link
                new_html = str(text_node).replace(
                    anchor,
                    f'<a href="{target}">{anchor}</a>',
                    1
                )
                text_node.replace_with(BeautifulSoup(new_html, "html.parser"))
                inserted_count += 1
                break
        
        return str(soup)
```

```python
# AI-Writer/backend/services/article_generation_service.py

async def generate_article(self, settings: ArticleSettings) -> Article:
    # ... existing generation code ...
    
    # Post-generation: Insert internal links
    link_inserter = InternalLinkInserter(settings.client_id)
    article.content = await link_inserter.insert_links(
        article.content, 
        settings.keyword
    )
    
    # ... save article ...
```

**Files to create/modify**:
- `AI-Writer/backend/services/internal_link_inserter.py` — new
- `AI-Writer/backend/services/article_generation_service.py` — call inserter
- `open-seo-main/src/routes/api/seo/links/suggestions.ts` — new endpoint

**Effort**: 8-10 hours

---

### Gap 39-D: Link Graph Update on Publish

**Problem**: `graph_builder()` exists but isn't triggered after publishing.

**Solution**: Call open-seo-main to update link graph after publish.

```python
# AI-Writer/backend/services/auto_publish_executor.py

async def _update_link_graph(self, client_id: str, url: str, html: str):
    """Update link graph in open-seo-main after publishing new content."""
    
    await self.open_seo_client.post(
        "/api/seo/links/graph/update",
        json={
            "clientId": client_id,
            "url": url,
            "html": html,
        }
    )
```

```typescript
// open-seo-main/src/routes/api/seo/links/graph/update.ts
export const Route = createFileRoute("/api/seo/links/graph/update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clientId, url, html } = await request.json();
        
        // Extract links from new content
        const links = extractLinksFromHtml(html, url);
        
        // Update link_graph table
        await LinkGraphRepository.upsertPageLinks(clientId, url, links);
        
        // Recalculate click depth if needed
        await ClickDepthService.recalculate(clientId);
        
        return Response.json({ success: true });
      },
    },
  },
});
```

**Files to create/modify**:
- `AI-Writer/backend/services/auto_publish_executor.py` — add `_update_link_graph`
- `open-seo-main/src/routes/api/seo/links/graph/update.ts` — new endpoint

**Effort**: 3-4 hours

---

### Gap 39-E: PAA Questions in Prompts

**Problem**: `paa_questions` passed to API but not confirmed in `_build_article_prompt()`.

**Solution**: Explicitly integrate PAA into prompt template.

```python
# AI-Writer/backend/services/article_generation_service.py

def _build_article_prompt(self, settings: ArticleSettings) -> str:
    prompt_parts = [
        f"Write an article about: {settings.keyword}",
        f"Target word count: {settings.target_word_count}",
    ]
    
    # Add H2 suggestions if available
    if settings.suggested_h2s:
        prompt_parts.append(
            f"\nSuggested H2 headings to include:\n" +
            "\n".join(f"- {h2}" for h2 in settings.suggested_h2s)
        )
    
    # Add PAA questions as FAQ section
    if settings.paa_questions:
        prompt_parts.append(
            f"\nInclude a FAQ section answering these questions:\n" +
            "\n".join(f"- {q}" for q in settings.paa_questions[:5])
        )
    
    # Add voice constraints
    if settings.voice_constraints:
        prompt_parts.append(f"\nVoice guidelines:\n{settings.voice_constraints}")
    
    return "\n\n".join(prompt_parts)
```

**Files to modify**:
- `AI-Writer/backend/services/article_generation_service.py`

**Effort**: 2-3 hours

---

## Implementation Order

### Week 1: Foundation
1. **Gap 32-A**: Wire real findings to route (2-3h)
2. **Gap 35-A**: GSC integration in CannibalizationService (2-3h)
3. **Gap 35-B**: Wire isTargetCannibalized (1h)
4. **Gap 37-B**: Voice preview API (3-4h)

### Week 2: SERP & Content
5. **Gap 36-A**: Implement extractCommonH2s (4-6h)
6. **Gap 36-B**: Implement calculateWordCountStats (2-3h)
7. **Gap 39-E**: PAA questions in prompts (2-3h)
8. **Gap 36-C**: 107 checks on generated content (6-8h)

### Week 3: AI-Writer Integration
9. **Gap 37-A**: AI-Writer voice integration (4-6h)
10. **Gap 39-A**: Quality gate (4-6h)
11. **Gap 39-B**: GSC URL submission (4-6h)

### Week 4: Links & Final
12. **Gap 39-C**: Internal link auto-insertion (8-10h)
13. **Gap 39-D**: Link graph update on publish (3-4h)
14. **Gap 32-B**: apps/web proxy to open-seo-main (4-6h)

---

## Success Criteria

After all gaps closed:

| Metric | Target |
|--------|--------|
| Phase 32 completion | 100% |
| Phase 35 completion | 100% |
| Phase 36 completion | 100% |
| Phase 37 completion | 100% |
| Phase 39 completion | 100% |
| Generated content auto-validated | Yes |
| Quality gate enforced | Score >= 80 |
| GSC submission on publish | Yes |
| Internal links auto-inserted | 3-7 per article |
| Link graph updated on publish | Yes |
| Voice constraints from open-seo | Yes |

---

## Risk Mitigation

1. **DataForSEO OnPage API costs**: Cache aggressively, batch requests
2. **GSC Indexing API quota**: 200 URLs/day limit — queue and rate limit
3. **AI-Writer backward compatibility**: Feature flag new integrations
4. **Link insertion quality**: Confidence threshold + human review queue

---

## References

- Phase 32 checks: `open-seo-main/src/server/lib/audit/checks/`
- Phase 35 linking: `open-seo-main/src/server/features/linking/`
- Phase 36 briefs: `open-seo-main/src/server/features/briefs/`
- Phase 37 voice: `open-seo-main/src/server/features/voice/`
- AI-Writer generation: `AI-Writer/backend/services/article_generation_service.py`
- AI-Writer publish: `AI-Writer/backend/services/auto_publish_executor.py`
