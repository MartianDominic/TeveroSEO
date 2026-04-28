# Phase 29: AI Opportunity Discovery

## Goal

Generate keyword opportunities from scraped business content — "What SHOULD they target?"

Uses Phase 27 scraped content (products, brands, services) to suggest keywords even for zero-ranking sites.

## Why This Matters

- New sites have no ranking data
- DataForSEO only shows what they rank for, not potential
- AI generates relevant keywords from business context

## Approach

**AI generates → DataForSEO validates**

1. Extract products, brands, services from Phase 27
2. AI suggests keyword variations
3. DataForSEO checks volume/difficulty
4. Return validated opportunities

## Deliverables

1. **Keyword Generation**
   - Product-based keywords ("barrel sauna prices")
   - Brand-based keywords ("Harvia heaters")
   - Service-based keywords ("sauna installation")
   - Location modifiers ("sauna Helsinki")

2. **Volume Validation**
   - DataForSEO keyword data endpoint
   - Filter zero-volume suggestions
   - Add CPC and difficulty

3. **Opportunity Scoring**
   - Volume × CPC = traffic value
   - Difficulty penalty
   - Brand alignment bonus

## Tasks

### 29-01: AI Keyword Generator
- [ ] Build prompt from scraped content
- [ ] Generate 50-100 keyword ideas
- [ ] Handle multiple languages (LT, EN)

### 29-02: Volume Validation
- [ ] Batch DataForSEO keyword_data calls
- [ ] Filter keywords with 0 volume
- [ ] Enrich with difficulty/CPC

### 29-03: Opportunity Scoring
- [ ] Score formula implementation
- [ ] Ranking by opportunity
- [ ] Category grouping

### 29-04: UI Integration
- [ ] Opportunity table on analysis page
- [ ] Category filters
- [ ] "Add to proposal" action

## Implementation

```typescript
// AI prompt for keyword generation
const prompt = `
Generate SEO keyword opportunities based on this business:

PRODUCTS: ${businessInfo.products.join(', ')}
BRANDS: ${businessInfo.brands.join(', ')}
SERVICES: ${businessInfo.services.join(', ')}
LOCATION: ${businessInfo.location}
TARGET: ${businessInfo.targetMarket}

Generate 50 keyword ideas in these categories:
1. Product keywords (include brand names when relevant)
2. Service keywords (with location modifiers)
3. Commercial intent keywords (buying, prices, reviews)
4. Informational keywords (how to, guide, comparison)

Return JSON array: ["keyword1", "keyword2", ...]
`;

// Validation with DataForSEO
async function validateKeywords(keywords: string[], region: string) {
  const response = await dataforseo.post('/v3/keywords_data/google_ads/search_volume/live', {
    keywords,
    location_name: region,
  });
  
  return response.tasks[0].result.filter(k => k.search_volume > 0);
}
```

## Schema Addition

```typescript
interface OpportunityKeyword {
  keyword: string;
  category: 'product' | 'brand' | 'service' | 'commercial' | 'informational';
  searchVolume: number;
  cpc: number;
  difficulty: number;
  opportunityScore: number;
  source: 'ai_generated';
}

// analyses.opportunity_keywords: OpportunityKeyword[]
```

## Success Criteria

- [ ] AI generates relevant keywords from scraped content
- [ ] Zero-volume keywords filtered out
- [ ] Opportunity score ranks keywords usefully
- [ ] Works for sites with no ranking data
- [ ] UI shows categorized opportunities
- [ ] Keywords flow to Phase 30 proposals
