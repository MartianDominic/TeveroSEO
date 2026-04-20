# Phase 26: Prospect Data Model & Basic Analysis - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning
**Mode:** Auto-generated from existing design docs

## Phase Boundary

Store prospects by domain (separate from clients), run basic keyword analysis to show what they currently rank for and their competitive landscape.

**Key distinction:**
- **Prospects:** DataForSEO one-time analysis ($0.50-0.80) - no ongoing tracking
- **Clients:** GSC (FREE!) provides daily ranking truth after conversion

## Implementation Decisions

### Data Model (from prospecting-research.md)

```sql
-- Prospects: potential clients (not yet paying)
CREATE TABLE prospects (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  domain TEXT NOT NULL,
  company_name TEXT,
  contact_email TEXT,
  contact_name TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',  -- new, analyzing, analyzed, converted, archived
  source TEXT,
  assigned_to UUID,
  converted_client_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis results (one per analysis run)
CREATE TABLE prospect_analyses (
  id UUID PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES prospects(id),
  analysis_type TEXT NOT NULL,  -- 'quick_scan', 'deep_dive', 'opportunity_discovery'
  status TEXT DEFAULT 'pending',
  target_region TEXT,
  target_language TEXT,
  competitor_domains JSONB,
  domain_metrics JSONB,
  organic_keywords JSONB,
  competitor_keywords JSONB,
  cost_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### DataForSEO Endpoints (from prospecting-research.md)

| Endpoint | Use Case | Est. Cost |
|----------|----------|-----------|
| `googleKeywordsForSiteLive` | ALL keywords prospect ranks for | $0.05-0.10 |
| `googleCompetitorsDomainLive` | Auto-discover competitors | $0.05-0.10 |
| `googleDomainRankOverviewLive` | Domain authority, traffic metrics | $0.02-0.05 |

### Rate Limiting

- Max 10 analyses/day per workspace (soft limit)
- Max 20 analyses/day per workspace (hard limit)
- Re-analysis cooldown: 24 hours per prospect

## Existing Code Insights

- DataForSEO client exists in `open-seo-main/src/lib/dataforseo/`
- BullMQ infrastructure exists for async jobs
- Workspace/client patterns established in existing codebase

## Success Criteria

1. `prospects` and `prospect_analyses` tables exist with proper indexes
2. `/prospects` page lists prospects with status badges and domain
3. "Add Prospect" creates prospect record with domain validation
4. "Analyze" triggers BullMQ job that calls DataForSEO
5. Analysis shows: domain metrics, current keywords, top competitors
6. Results cached in `prospect_analyses` with cost tracking
7. Rate limiting: max 10 analyses/day per workspace

## Reference Docs

- `.planning/design/prospecting-research.md` - Full research
- `.planning/design/prospecting-dashboard-migration.md` - Migration patterns
- `.planning/design/opportunity-discovery-analysis.md` - AI opportunity framework
