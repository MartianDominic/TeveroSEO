# Prospecting Feature Research

> Research completed: 2026-04-20

## 1. Current Keyword System (open-seo)

### Schema

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `saved_keywords` | Keywords per project (client) | `projectId`, `keyword`, `locationCode`, `languageCode`, `trackingEnabled` |
| `keyword_metrics` | Cached metrics from DataForSEO | `searchVolume`, `cpc`, `competition`, `keywordDifficulty`, `intent` |
| `keyword_rankings` | Daily position snapshots | `keywordId`, `position`, `previousPosition`, `url`, `serpFeatures`, `date` |
| `rank_drop_events` | Alert-triggering rank drops | `keywordId`, `previousPosition`, `currentPosition`, `dropAmount`, `threshold` |

### Key Insight

Keywords are stored per **project** (which belongs to a **client**). Prospects don't fit this model - they have no client, no project. Need separate data model.

### Ranking Flow

1. BullMQ scheduler triggers at 03:00 UTC daily
2. Queries all `trackingEnabled=true` keywords
3. Calls DataForSEO SERP API per keyword (100ms rate limit)
4. Stores snapshot in `keyword_rankings`
5. Creates `rank_drop_events` if threshold exceeded

---

## 2. DataForSEO Integration

### Currently Used Endpoints

| Endpoint | Purpose |
|----------|---------|
| `googleRankedKeywordsLive` | What a domain currently ranks for |
| `googleRelatedKeywordsLive` | Semantically related keywords from seed |
| `googleKeywordSuggestionsLive` | Autocomplete-style suggestions |
| `googleKeywordIdeasLive` | Broader keyword ideation |
| `googleDomainRankOverviewLive` | Domain authority, traffic metrics |
| SERP API | Live ranking position checks |

### Available for Prospecting (Not Yet Implemented)

| Endpoint | Use Case | Est. Cost |
|----------|----------|-----------|
| `googleKeywordsForSiteLive` | ALL keywords prospect ranks for | $0.05-0.10 |
| `googleCompetitorsDomainLive` | Auto-discover competitors | $0.05-0.10 |
| `googleDomainIntersectionLive` | **Keyword gap analysis** | $0.05-0.10 |
| `googleCategoriesForDomainLive` | Identify domain's niche/topics | $0.02-0.05 |
| `googleSerpCompetitorsLive` | Who ranks for specific keywords | $0.02-0.05 |

### Regional Targeting

Fully supported via `location_code` + `language_code`:
- UK: 2826, Ireland: 2372 (English-speaking Europe)
- Germany: 2276, France: 2250, Netherlands: 2528, etc.
- Language codes: "en", "de", "fr", etc.

---

## 3. Proposed Data Model

### Prospects Table

```sql
CREATE TABLE prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  domain TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new', -- new, analyzing, analyzed, converted, archived
  source TEXT,
  assigned_to UUID,
  converted_client_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Prospect Analyses Table

```sql
CREATE TABLE prospect_analyses (
  id UUID PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES prospects(id),
  analysis_type TEXT NOT NULL, -- 'quick_scan', 'deep_dive', 'opportunity_discovery'
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Targeting
  target_region TEXT,           -- "EU", "US", "UK"
  target_language TEXT,         -- "en", "de", "fr"
  competitor_domains JSONB,     -- ["comp1.com", "comp2.com"]
  
  -- Results
  domain_metrics JSONB,         -- authority, traffic, etc.
  organic_keywords JSONB,       -- what they currently rank for
  keyword_gaps JSONB,           -- competitor keywords they lack
  expansion_keywords JSONB,     -- related/suggested keywords
  ai_suggested_keywords JSONB,  -- AI-generated opportunities
  top_opportunities JSONB,      -- scored and prioritized
  ai_insights JSONB,            -- executive summary, recommendations
  
  -- Tracking
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Migration Path: Prospect → Client

1. Create `clients` record from prospect data
2. Copy latest analysis to `client_website_intelligence`
3. Set `prospect.status = 'converted'`, link `converted_client_id`
4. Create project with tracked keywords from top opportunities

---

## 4. Analysis Pipeline

### Phase 1: Current State

```
DataForSEO.keywordsForSite(domain) → What they rank for now
DataForSEO.categoriesForDomain(domain) → Their niche/topics
DataForSEO.domainRankOverview(domain) → Authority, traffic
```

### Phase 2: Competitive Landscape

```
DataForSEO.competitorsDomain(domain) → Auto-discover competitors
DataForSEO.domainIntersection(prospect, competitor) → Keyword gaps
```

### Phase 3: Keyword Expansion

```
Extract seed keywords from current rankings
DataForSEO.relatedKeywords(seeds) → Semantic expansion
DataForSEO.keywordSuggestions(seeds) → Autocomplete variations
```

### Phase 4: AI Opportunity Discovery

```
AI analyzes business context → Suggests topics they SHOULD cover
DataForSEO.keywordIdeas(ai_topics) → Validate with real data
Filter by achievability (difficulty vs authority)
```

### Phase 5: Scoring & Prioritization

```
achievabilityScore = f(difficulty, domainAuthority)
valueScore = f(volume, cpc, intent)
priorityScore = achievabilityScore × valueScore
```

### Phase 6: AI Insights

```
Generate executive summary
Identify quick wins vs strategic plays
Create sales talking points
```

---

## 5. Cost Estimates

| Analysis Type | API Calls | Est. Cost |
|---------------|-----------|-----------|
| Quick Scan | domain metrics + top 20 gaps | $0.15-0.20 |
| Deep Dive | full analysis + all phases | $0.40-0.60 |
| With AI Insights | deep dive + Claude calls | $0.50-0.80 |

### Budget Controls

- Rate limit: 10 analyses/day per workspace (soft), 20 (hard)
- Concurrent: 2 workers max
- Re-analysis cooldown: 24 hours per prospect
- Monthly budget tracking with optional caps

---

## 6. Open Questions

1. **Analysis tiers:** Quick scan vs Deep dive vs Full AI?
2. **Monthly quota:** How many analyses per plan tier?
3. **Data retention:** 90 days for non-converted prospects?
4. **Competitor input:** Auto-discover, manual, or hybrid?
5. **AI usage:** Include in all analyses or premium only?
