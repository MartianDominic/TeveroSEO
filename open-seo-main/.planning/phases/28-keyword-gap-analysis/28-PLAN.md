# Phase 28: Keyword Gap Analysis

## Goal

Identify keywords competitors rank for that the prospect doesn't — "What are they missing?"

## DataForSEO Endpoint

`/v3/dataforseo_labs/google/domain_intersection/live`

- **Cost:** ~$0.02-0.05 per request
- **Returns:** Keywords where domain A ranks but domain B doesn't

## Deliverables

1. **Competitor Discovery**
   - Auto-detect top 3 competitors by keyword overlap
   - Manual competitor input option

2. **Gap Analysis**
   - Keywords competitors rank for (top 100)
   - Difficulty scoring
   - Traffic potential calculation

3. **UI Integration**
   - Gap analysis tab on prospect detail page
   - Sortable/filterable keyword table
   - Export to CSV

## Tasks

### 28-01: Competitor Discovery
- [ ] DataForSEO competitors/domain endpoint
- [ ] Filter by relevance score
- [ ] Store competitor list on analysis

### 28-02: Domain Intersection
- [ ] Call domain_intersection for each competitor
- [ ] Aggregate unique keywords
- [ ] Calculate opportunity score

### 28-03: Gap Analysis UI
- [ ] Keyword gap table component
- [ ] Difficulty badges
- [ ] Traffic value column
- [ ] "Add to targets" action

## Schema Addition

```typescript
// Add to ProspectAnalysis
interface KeywordGap {
  keyword: string;
  competitorDomain: string;
  competitorPosition: number;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  trafficPotential: number;
}

// analyses.keyword_gaps: KeywordGap[]
```

## Success Criteria

- [ ] Competitors auto-discovered
- [ ] Top 100 gap keywords retrieved
- [ ] Traffic potential calculated
- [ ] UI displays sortable table
- [ ] Keywords exportable
