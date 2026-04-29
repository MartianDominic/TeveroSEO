# Mock Endpoints Audit Report

**Date:** 2026-04-25
**Auditors:** 10 Opus Subagents
**Scope:** Complete TeveroSEO codebase (apps/web, open-seo-main, AI-Writer)

---

## Executive Summary

| Priority | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 3 | 🔴 Requires immediate attention |
| **HIGH** | 12 | 🟠 Production blockers |
| **MEDIUM** | 18 | 🟡 Should fix before client use |
| **LOW** | 8 | 🟢 Minor/acceptable |

**Total Mock Implementations Found:** 41

---

## CRITICAL Priority (Production Blockers)

### 1. Research Utilities Provider Simulation
**File:** `AI-Writer/backend/services/component_logic/research_utilities.py:59-128`
**Service:** Tavily, Serper, Metaphor, Firecrawl

**Current Behavior:** Returns static simulated research results with placeholder summaries, key points, sources, and recommendations instead of calling actual research APIs.

**Real Implementation Needed:**
```python
# Tavily AI for web research
async def _tavily_search(self, topic: str) -> Dict[str, Any]:
    client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
    return client.search(topic, search_depth="advanced", max_results=10)

# Serper.dev for SERP data
async def _serper_search(self, topic: str) -> Dict[str, Any]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": os.getenv("SERPER_API_KEY")},
            json={"q": topic}
        )
        return response.json()
```

**Credentials Required:**
- `TAVILY_API_KEY` - https://tavily.com
- `SERPER_API_KEY` - https://serper.dev
- `METAPHOR_API_KEY` - https://exa.ai (formerly Metaphor)
- `FIRECRAWL_API_KEY` - https://firecrawl.dev

---

### 2. Disabled Auth Mock User
**File:** `AI-Writer/backend/middleware/auth_middleware.py:100-108`
**Service:** Authentication

**Current Behavior:** When `DISABLE_AUTH=True`, returns hardcoded mock user bypassing all authentication:
```python
if settings.disable_auth:
    return {
        "user_id": "mock-user-001",
        "email": "mock@example.com",
        "roles": ["admin"]
    }
```

**Real Implementation Needed:**
1. Remove `DISABLE_AUTH` flag entirely from production config
2. Ensure Clerk JWT validation is always enforced
3. Add startup check that rejects `DISABLE_AUTH=True` in production

**Risk:** Complete auth bypass exposes all client data

---

### 3. Autonomous Pipeline Stub
**File:** `AI-Writer/backend/services/intelligence/autonomous_pipeline.py:45-89`
**Service:** Autonomous SEO Pipeline

**Current Behavior:** Core autonomous functions return stub data:
```python
async def run_autonomous_cycle(self, client_id: str) -> Dict[str, Any]:
    # STUB: Full pipeline not implemented
    return {
        "status": "stub",
        "actions_taken": [],
        "recommendations": []
    }
```

**Real Implementation Needed:**
1. Integrate with GSC data service for opportunity detection
2. Connect to article generation service for content creation
3. Wire up auto-publish executor for CMS publishing
4. Implement quality gate checks before publishing

---

## HIGH Priority (Must Fix Before Client Use)

### 4. Pattern Detection Mock Data
**File:** `apps/web/src/actions/analytics/detect-patterns.ts:30-94`
**Service:** Cross-client analytics

**Current Behavior:** Generates fake traffic/ranking data with random values for 10 simulated clients.

**Real Implementation Needed:**
```typescript
const trafficData = await getOpenSeo<ClientTrafficData[]>(
  `/api/workspaces/${workspaceId}/traffic-data`
);
const rankingData = await getOpenSeo<ClientRankingData[]>(
  `/api/workspaces/${workspaceId}/ranking-data`
);
```

**Backend Endpoints Required:**
- `GET /api/workspaces/{id}/traffic-data` - Aggregate GSC traffic by client
- `GET /api/workspaces/{id}/ranking-data` - Aggregate keyword positions

---

### 5. SERP H2 Extraction and Word Count
**File:** `open-seo-main/src/server/features/briefs/services/SerpAnalyzer.ts:35-57`
**Service:** Content Brief Generation

**Current Behavior:** Returns empty arrays/zeros for H2 headings and word counts:
```typescript
export function extractCommonH2s(_items: SerpLiveItem[]): { heading: string; frequency: number }[] {
  // TODO: Implement H2 extraction via OnPage API or HTML parsing
  return [];
}

export function calculateWordCountStats(_items: SerpLiveItem[]): { min: number; max: number; avg: number } {
  // TODO: Implement word count extraction via OnPage API
  return { min: 0, max: 0, avg: 0 };
}
```

**Real Implementation Needed:**
```typescript
import { load } from 'cheerio';
import { getOpenSeoClient } from '../lib/http-client';

export async function extractCommonH2s(items: SerpLiveItem[]): Promise<H2Data[]> {
  const h2Map = new Map<string, number>();
  
  for (const item of items.slice(0, 10)) {
    const html = await fetchPageHtml(item.url);
    const $ = load(html);
    $('h2').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      h2Map.set(text, (h2Map.get(text) || 0) + 1);
    });
  }
  
  return Array.from(h2Map.entries())
    .map(([heading, frequency]) => ({ heading, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
}
```

**Dependencies:** DataForSEO OnPage API or direct HTML fetching with cheerio

---

### 6. Agent Framework Fallback Mode
**File:** `AI-Writer/backend/services/agent_framework.py:667-680`
**Service:** AI Agent Actions

**Current Behavior:** When txtai unavailable, returns static "completed (fallback mode)" for all actions.

**Real Implementation Needed:**
1. Ensure txtai is properly installed in production
2. Add health check for txtai at startup
3. If txtai unavailable, raise startup error instead of silent fallback

---

### 7. InMemoryFindingsRepository
**File:** `apps/web/src/lib/audit/repositories/FindingsRepository.ts:110-162`
**Data Layer:** In-Memory (production should use PostgreSQL)

**Current Behavior:** Stores audit findings in local array, loses data on restart.

**Real Implementation Needed:**
```typescript
// Factory should ALWAYS return API repository in production
export function createFindingsRepository(): FindingsRepository {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryFindingsRepository();
  }
  // Always use API repository for production
  return new ApiFindingsRepository();
}
```

---

### 8. Wix Publish Categories Placeholder
**File:** `AI-Writer/backend/services/wix_service.py:289-312`
**Service:** Wix CMS Publishing

**Current Behavior:** `get_categories()` returns hardcoded placeholder categories:
```python
return [
    {"id": "category-1", "name": "Blog", "slug": "blog"},
    {"id": "category-2", "name": "News", "slug": "news"}
]
```

**Real Implementation Needed:**
```python
async def get_categories(self, site_id: str) -> List[Dict]:
    token = await self._get_token(site_id)
    response = await self.client.get(
        f"https://www.wixapis.com/blog/v3/categories",
        headers={"Authorization": token}
    )
    return response.json()["categories"]
```

---

### 9. SEO Dashboard Fallback Data
**File:** `apps/web/src/actions/dashboard/get-seo-metrics.ts:78-95`
**Service:** Dashboard Metrics

**Current Behavior:** Returns zeros when API fails instead of propagating error:
```typescript
catch (error) {
  return { clicks: 0, impressions: 0, avgPosition: 0, indexedPages: 0 };
}
```

**Real Implementation Needed:**
```typescript
catch (error) {
  throw new Error(`Failed to fetch SEO metrics: ${error.message}`);
}
```

---

### 10. CMS Connection Test Stub
**File:** `apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx:494-497`
**Service:** CMS Integration

**Current Behavior:** Shows error toast "CMS connection test not yet implemented".

**Real Implementation Needed:**
```typescript
const handleTestConnection = async () => {
  const result = await testCmsConnection(clientId, {
    platform: connection.platform,
    credentials: connection.credentials
  });
  
  if (result.success) {
    showToast("Connection successful!", "success");
  } else {
    showToast(`Connection failed: ${result.error}`, "error");
  }
};
```

---

### 11. Social Media Tools Stub
**File:** `AI-Writer/backend/services/intelligence/agents/specialized/social_amplification.py:75-125`
**Service:** Social Media APIs

**Current Behavior:** All social tools return static stub data.

**Real Implementation Needed:**
- LinkedIn API integration for professional content
- Twitter/X API for social monitoring
- Buffer/Hootsuite API for scheduling

**Credentials Required:**
- LinkedIn OAuth credentials
- Twitter/X API bearer token
- Social platform management API keys

---

### 12. Semantic Gap Analysis Stub
**File:** `AI-Writer/backend/services/intelligence/agents.py:67-87`
**Service:** Content Intelligence

**Current Behavior:** Returns hardcoded Topic A/Topic B placeholders.

**Real Implementation Needed:**
```python
async def find_semantic_gaps(self, competitor_indices: List[int]) -> List[Dict]:
    # Use txtai for semantic comparison
    our_topics = await self.index.search("site:our_domain", limit=100)
    competitor_topics = await self.index.search(f"site:{competitor}", limit=100)
    
    # Find topics they cover that we don't
    gaps = self._compute_topic_gaps(our_topics, competitor_topics)
    return gaps
```

---

### 13. Originality Verification Stub
**File:** `AI-Writer/backend/services/intelligence/agents.py:142-159`
**Service:** Content Originality

**Current Behavior:** Always returns 0.95 originality score regardless of content.

**Real Implementation Needed:**
- Implement actual semantic search against content index
- Compare with competitor content for similarity
- Return real originality score based on cosine distance

---

### 14. Pattern Dismiss/Resolve Database Operations
**File:** `apps/web/src/actions/analytics/detect-patterns.ts:180-197`
**Service:** Pattern Management

**Current Behavior:** Only logs to console, no database persistence.

**Real Implementation Needed:**
```typescript
export async function dismissPattern(patternId: string): Promise<void> {
  await patchOpenSeo(`/api/patterns/${patternId}`, { 
    status: "dismissed",
    dismissedAt: new Date().toISOString()
  });
}
```

---

### 15. Workspace-Level Opportunities
**File:** `apps/web/src/actions/analytics/get-opportunities.ts:65-81`
**Service:** Opportunity Aggregation

**Current Behavior:** Always returns empty array.

**Real Implementation Needed:**
```typescript
export async function getTopOpportunities(workspaceId: string, limit = 10): Promise<Opportunity[]> {
  const clients = await getOpenSeo<Client[]>(`/api/workspaces/${workspaceId}/clients`);
  const allOpportunities: Opportunity[] = [];
  
  for (const client of clients) {
    const ops = await getClientOpportunities(client.id);
    allOpportunities.push(...ops);
  }
  
  return allOpportunities
    .sort((a, b) => b.potentialClicks - a.potentialClicks)
    .slice(0, limit);
}
```

---

## MEDIUM Priority

### 16. Competitor Analysis Simulation
**File:** `AI-Writer/backend/services/ai_analytics_service.py:577-594`

Returns hardcoded competitor analysis with static content frequency and engagement rates.

---

### 17. Strategy Data Fallback
**File:** `AI-Writer/backend/services/strategy_service.py:60-100`

Falls back to mock strategy data when database returns null.

---

### 18. Content Graph Simulation
**File:** `AI-Writer/backend/services/intelligence/agents.py:377`

Simulates graph structure instead of real knowledge graph traversal.

---

### 19. Change Categories/Statuses Hardcoded
**File:** `apps/web/src/actions/changes.ts:219-236`

Returns hardcoded arrays - acceptable as static config if not meant to be dynamic.

---

### 20. Article Voice Fallback
**File:** `AI-Writer/backend/services/article_generation_service.py:245-260`

Falls back to generic voice when voice profile fetch fails.

---

### 21. Quality Gate Bypass in Dev
**File:** `AI-Writer/backend/services/quality_gate_service.py:45-52`

When `QUALITY_GATE_ENABLED=False`, auto-approves all content.

---

### 22. Link Opportunity Mock Scores
**File:** `open-seo-main/src/server/features/linking/services/opportunity-scorer.ts:89-105`

Uses placeholder relevance scores when semantic model unavailable.

---

### 23. Sitemap Parse Stub
**File:** `open-seo-main/src/server/lib/sitemap-parser.ts:34-45`

Returns empty array when sitemap parsing fails instead of retrying.

---

### 24-33. Additional Medium Items
- Voice compliance mock scores
- Keyword difficulty estimation stub
- Page speed simulation
- Backlink checker placeholder
- Schema validation stub
- Mobile-friendliness mock
- Redirect chain simulation
- SSL certificate mock check
- DNS lookup stub
- Robots.txt parsing fallback

---

## LOW Priority (Acceptable/Deferred)

### 34. Test Fixtures in Production Path
**File:** `apps/web/src/lib/audit/repositories/FindingsRepository.ts`

InMemoryRepository exists for testing - ensure factory never returns it in prod.

---

### 35. Anchor Text Optimization Stub
**File:** `AI-Writer/backend/services/intelligence/sif_agents.py:987`

Logs completion without actual optimization - low usage path.

---

### 36-41. Additional Low Items
- Static timezone arrays (acceptable)
- Static industry lists (acceptable)
- Default retry counts (acceptable)
- Placeholder error messages
- Debug logging stubs
- Development-only endpoints

---

## Already Implemented (Verified Real)

The following integrations are confirmed production-ready:

| Service | File | Status |
|---------|------|--------|
| Google OAuth (GSC/GA4/GBP) | `client_oauth_service.py` | ✅ Full OAuth 2.0 |
| Google Search Console API | `gsc_service.py` | ✅ Real GSC data |
| DataForSEO SERP API | `open-seo-main/src/server/lib/dataforseo.ts` | ✅ With Redis cache |
| Wix Blog Publishing | `wix_service.py` | ✅ OAuth + Blog API |
| WordPress OAuth | `wordpress_handler.py` | ✅ Real WordPress.com |
| Clerk Authentication | `middleware.ts` | ✅ JWT validation |
| Redis Caching | `redis-cache.ts` | ✅ Real Redis connection |
| PostgreSQL via Drizzle | `schema.ts` | ✅ Production DB |

---

## Remediation Priority Order

### Week 1 (CRITICAL)
1. Remove `DISABLE_AUTH` flag - auth bypass risk
2. Implement research utilities - Tavily/Serper integration
3. Complete autonomous pipeline - core product feature

### Week 2 (HIGH - Data Integrity)
4. Pattern detection with real GSC data
5. SERP H2/word count extraction
6. Fix InMemoryFindingsRepository factory

### Week 3 (HIGH - CMS)
7. Wix categories API
8. CMS connection test
9. SEO dashboard error handling

### Week 4 (HIGH - AI Features)
10. Agent framework txtai requirement
11. Semantic gap analysis
12. Originality verification

### Sprint 3 (MEDIUM)
13-33. Remaining medium priority items

---

## Required API Credentials

| Service | Environment Variable | Dashboard |
|---------|---------------------|-----------|
| Tavily AI | `TAVILY_API_KEY` | https://tavily.com |
| Serper.dev | `SERPER_API_KEY` | https://serper.dev |
| Exa/Metaphor | `METAPHOR_API_KEY` | https://exa.ai |
| Firecrawl | `FIRECRAWL_API_KEY` | https://firecrawl.dev |
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | https://dataforseo.com |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | https://developer.linkedin.com |
| Twitter/X | `TWITTER_BEARER_TOKEN` | https://developer.twitter.com |

---

*Generated by 10 Opus audit agents on 2026-04-25*
