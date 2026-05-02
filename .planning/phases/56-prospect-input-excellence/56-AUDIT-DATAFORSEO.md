# DataForSEO Integration Audit

**Date:** 2026-04-30  
**Auditor:** Claude Opus 4.5  
**Scope:** `open-seo-main/src/server/lib/dataforseo*.ts` and keyword intelligence flow

---

## DataForSEO Endpoint Inventory

| Endpoint | API Path | Implemented | Function Name | Wired to UI | Called From |
|----------|----------|-------------|---------------|-------------|-------------|
| Search Volume | `/v3/keywords_data/google_ads/search_volume/live` | Yes | `fetchKeywordMetrics()` | Yes | `dataforseo.ts:77-134` |
| Related Keywords | `/v3/dataforseo_labs/google/related_keywords/live` | Yes | `fetchRelatedKeywordsRaw()` | Yes | `dataforseo.ts:143-162` |
| Keyword Suggestions | `/v3/dataforseo_labs/google/keyword_suggestions/live` | Yes | `fetchKeywordSuggestionsRaw()` | Yes | `dataforseo.ts:167-185` |
| Keyword Ideas | `/v3/dataforseo_labs/google/keyword_ideas/live` | Yes | `fetchKeywordIdeasRaw()` | Yes | `dataforseo.ts:190-208` |
| Domain Rank Overview | `/v3/dataforseo_labs/google/domain_rank_overview/live` | Yes | `fetchDomainRankOverviewRaw()` | Yes | `dataforseo.ts:213-230` |
| Ranked Keywords | `/v3/dataforseo_labs/google/ranked_keywords/live` | Yes | `fetchRankedKeywordsRaw()` | Yes | `dataforseo.ts:235-254` |
| Live SERP | `/v3/serp/google/organic/live/regular` | Yes | `fetchLiveSerpItemsRaw()` | Yes | `dataforseo.ts:263-280` |
| On-Page Instant Pages | `/v3/on_page/instant_pages` | Yes | `fetchOnPageInstantPages()` | Yes | `dataforseo.ts:296-322` |
| Keywords For Site | `/v3/dataforseo_labs/google/keywords_for_site/live` | Yes | `fetchKeywordsForSiteRaw()` | Yes | `dataforseoProspect.ts:140-181` |
| Competitors Domain | `/v3/dataforseo_labs/google/competitors_domain/live` | Yes | `fetchCompetitorsDomainRaw()` | Yes | `dataforseoProspect.ts:205-245` |
| Domain Intersection | `/v3/dataforseo_labs/google/domain_intersection/live` | Yes | `fetchDomainIntersectionRaw()` | Yes | `dataforseoKeywordGap.ts:142-218` |
| Backlinks Summary | `/v3/backlinks/summary/live` | Yes | `fetchBacklinksSummaryRaw()` | Yes | `dataforseoBacklinks.ts` |
| Backlinks Rows | `/v3/backlinks/backlinks/live` | Yes | `fetchBacklinksRowsRaw()` | Yes | `dataforseoBacklinks.ts` |
| Referring Domains | `/v3/backlinks/referring_domains/live` | Yes | `fetchReferringDomainsRaw()` | Yes | `dataforseoBacklinks.ts` |
| Domain Pages | `/v3/backlinks/domain_pages_summary/live` | Yes | `fetchDomainPagesSummaryRaw()` | Yes | `dataforseoBacklinks.ts` |
| Backlinks History | `/v3/backlinks/history/live` | Yes | `fetchBacklinksHistoryRaw()` | Yes | `dataforseoBacklinks.ts` |
| Lighthouse | `/v3/on_page/lighthouse/live` | Yes | `fetchDataforseoLighthouseResultRaw()` | Yes | `dataforseoLighthouse.ts` |

### UI Wiring Evidence

The `dataforseoClient.ts` creates a metered client that wraps all raw functions:

```typescript
// dataforseoClient.ts:99-293
export function createDataforseoClient(customer: BillingCustomerContext) {
  return {
    backlinks: { summary, rows, referringDomains, domainPages, history },
    keywords: { related, suggestions, ideas },
    domain: { rankOverview, rankedKeywords },
    serp: { live },
    lighthouse: { live },
    prospect: { keywordsForSite, competitorsDomain, domainIntersection },
    onPage: { fetchRawHtml, scrapePage },
  } as const;
}
```

Keyword research UI calls via `research-data.ts:152-181`:

```typescript
export async function fetchResearchRowsBySource(
  params: FetchResearchRowsParams,
  billingCustomer: BillingCustomerContext,
): Promise<EnrichedKeyword[]> {
  const dataforseo = createDataforseoClient(billingCustomer);

  if (params.source === "related") {
    return fetchRelatedRows(params, dataforseo);
  }
  if (params.source === "suggestions") {
    return mapKeywordDataItems(await dataforseo.keywords.suggestions({...}));
  }
  return mapKeywordDataItems(await dataforseo.keywords.ideas({...}));
}
```

---

## Adaptive Logic Assessment

### Does the code decide WHICH endpoints to call based on:

- [ ] **Prospect industry?** NO - No industry-based endpoint selection
- [x] **Keyword count needed?** PARTIAL - Uses `limit` parameter but static defaults
- [ ] **User preferences?** NO - No preference-driven selection
- [ ] **Previous results?** NO - No result-based adaptive calls

### Decision-Making Code

The only decision logic is simple source-based branching in `research-data.ts:158-181`:

```typescript
if (params.source === "related") {
  return fetchRelatedRows(params, dataforseo);
}
if (params.source === "suggestions") {
  return mapKeywordDataItems(await dataforseo.keywords.suggestions({...}));
}
return mapKeywordDataItems(await dataforseo.keywords.ideas({...}));
```

**Assessment:** The system uses a **static source selector** (dropdown in UI) rather than intelligent endpoint selection. Users manually choose between "related", "suggestions", or "ideas" sources. There is no:

1. Automatic fallback if one source returns few results
2. Parallel querying of multiple sources
3. Context-aware source selection (e.g., broad vs narrow keywords)
4. Budget-aware endpoint selection

---

## Missing Endpoints (Keyword Expansion)

| Endpoint | DataForSEO Path | Use Case | Priority |
|----------|-----------------|----------|----------|
| **Autocomplete** | `/v3/keywords_data/google/autocomplete/live` | Real-time query suggestions | HIGH |
| **Questions (PAA)** | `/v3/dataforseo_labs/google/bulk_keyword_difficulty/live` with PAA | "People Also Ask" questions | HIGH |
| **Google Trends** | `/v3/keywords_data/google_trends/explore/live` | Seasonality, trending topics | MEDIUM |
| **Search Intent** | `/v3/dataforseo_labs/google/search_intent/live` | Intent classification | MEDIUM |
| **Historical Search Volume** | `/v3/keywords_data/google_ads/search_volume/task_get` | Trend analysis | LOW |
| **Keyword Categories** | `/v3/keywords_data/google_ads/categories` | Category mapping | LOW |
| **App Store Keywords** | `/v3/app_data/google/keywords` | Mobile app keywords | LOW |

### Most Impactful Missing Endpoints for Keyword Expansion:

1. **Autocomplete** - Would provide real-time, low-competition long-tail keywords
2. **Google Trends** - Would enable seasonality analysis and trend detection
3. **Bulk Search Intent** - Would allow batch intent classification without LLM costs

---

## Code Quality Rating

### Score: 7/10

### Strengths (+)

1. **Excellent Schema Validation**: Uses Zod schemas for all API responses (`dataforseoSchemas.ts`)
2. **Centralized Auth**: Single auth module (`dataforseo-auth.ts`) prevents credential leaks
3. **Rate Limiting**: Redis-backed token bucket limiter (5 req/sec)
4. **Circuit Breaker**: Prevents cascading failures on API issues
5. **Billing Integration**: Every call metered through `meterDataforseoCall()`
6. **Type Safety**: Full TypeScript types for all endpoints
7. **Cost Tracking**: `calculateApiCallCost()` for budget visibility

### Weaknesses (-)

1. **No Adaptive Selection**: Static endpoint selection, no intelligent routing
2. **No Caching Strategy**: Missing Redis caching for expensive keyword data
3. **No Batch Optimization**: Each keyword research call is independent
4. **Missing Autocomplete**: Critical for long-tail keyword discovery
5. **PAA Extraction Limited**: Only extracts from SERP, no dedicated endpoint

### Code Evidence

Well-structured rate limiting:
```typescript
// dataforseo.ts:34-42
import { dataForSeoRateLimiter } from "@/server/lib/redis-rate-limiter";
export { dataForSeoRateLimiter };
```

Cost tracking:
```typescript
// dataforseoClient.ts:349-410
async function trackDataforseoCost(args: {
  customer: BillingCustomerContext;
  customerId: string;
  billing: DataforseoApiCallCost;
  monthlyRemaining: number;
}) { ... }
```

---

## Recommendations

### Immediate (Phase 56)

1. Add `fetchAutocompleteRaw()` for keyword expansion
2. Implement intelligent source selection based on seed keyword characteristics
3. Add parallel multi-source querying with deduplication

### Future

1. Google Trends integration for seasonality
2. Bulk search intent endpoint to reduce LLM classification costs
3. Redis caching layer for keyword metrics (24h TTL)

---

## Summary

The DataForSEO integration is **production-grade** with excellent error handling, billing, and type safety. However, it lacks **intelligent endpoint selection** - the system relies on users to choose data sources rather than automatically selecting optimal endpoints based on context. The missing **Autocomplete endpoint** is the biggest gap for keyword expansion use cases.
