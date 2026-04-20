# Prospecting: Dashboard Positioning & Migration Design

> Design document for how prospects integrate into the dashboard and convert to clients

## Dashboard Positioning

### Recommended: Tab Toggle Within Dashboard

```
Dashboard:
┌─────────────────────────────────────────────────────┐
│ [Clients] [Prospects]  ← Tab toggle                 │
├─────────────────────────────────────────────────────┤
│ When "Clients" selected:                            │
│   - Portfolio health, client table, activity feed   │
│   - Everything that exists today                    │
│                                                     │
│ When "Prospects" selected:                          │
│   - Prospect pipeline table                         │
│   - Analysis status, opportunity scores             │
│   - "Convert to Client" actions                     │
└─────────────────────────────────────────────────────┘
```

**Why this approach:**
- Minimal navigation change (no new sidebar items)
- Easy toggle between modes
- Dashboard metrics stay clean (clients only, prospects separate)
- Prospects have their own focused view
- Natural mental model: "dashboard for my business" with two pipelines

### Alternatives Considered

**Option A: Separate Top-Level Section**
```
Sidebar:
├── Dashboard (clients only)
├── Clients
├── Prospects  ← Separate section
├── Reports
└── Settings
```
Rejected: Another navigation item, feels disconnected from workflow.

**Option B: Unified Pipeline View**
```
Sidebar:
├── Pipeline
│   ├── Prospects
│   └── Clients
```
Rejected: Requires rethinking entire dashboard structure.

---

## Database Schema

### Prospects Table

```sql
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  
  -- Core identity
  domain TEXT NOT NULL,
  name TEXT,                    -- Company name
  
  -- CRM fields
  contact_name TEXT,
  contact_email TEXT,
  source TEXT,                  -- "referral", "cold", "inbound"
  notes TEXT,
  assigned_to UUID REFERENCES users(id),
  
  -- Lifecycle
  status TEXT DEFAULT 'new',    -- new, analyzing, analyzed, converted, archived
  converted_to_client_id UUID,  -- Links to clients.id after conversion
  converted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(workspace_id, domain)
);

CREATE INDEX idx_prospects_workspace ON prospects(workspace_id);
CREATE INDEX idx_prospects_status ON prospects(status);
```

### Prospect Analyses Table

```sql
CREATE TABLE prospect_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  
  -- Config
  analysis_type TEXT NOT NULL,  -- 'basic', 'gap', 'opportunity'
  target_region TEXT,           -- "EU", "US", "UK"
  target_language TEXT,         -- "en", "de", "fi"
  
  -- Results (JSONB for flexibility)
  domain_metrics JSONB,         -- {authority, traffic, age}
  scraped_content JSONB,        -- {products, brands, services, location}
  current_keywords JSONB,       -- What they rank for
  competitor_domains JSONB,     -- Who they compete with
  gap_keywords JSONB,           -- Competitor keywords they lack
  opportunity_keywords JSONB,   -- AI-discovered keywords
  ai_insights JSONB,            -- Executive summary, recommendations
  
  -- Tracking
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  cost_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_prospect_analyses_prospect ON prospect_analyses(prospect_id);
CREATE INDEX idx_prospect_analyses_status ON prospect_analyses(status);
```

### Client Intelligence Table (for imported data)

```sql
CREATE TABLE client_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Link to source prospect analysis
  prospect_analysis_id UUID REFERENCES prospect_analyses(id),
  
  -- Imported data
  domain_metrics JSONB,
  initial_opportunities JSONB,
  conversion_insights JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Migration: Prospect → Client

### Conversion Function

```typescript
async function convertProspectToClient(prospectId: string): Promise<Client> {
  return await db.transaction(async (tx) => {
    // 1. Get prospect and latest analysis
    const prospect = await tx.query.prospects.findFirst({
      where: eq(prospects.id, prospectId),
    });
    
    const latestAnalysis = await tx.query.prospectAnalyses.findFirst({
      where: eq(prospectAnalyses.prospectId, prospectId),
      orderBy: desc(prospectAnalyses.createdAt),
    });

    // 2. Create client record
    const [client] = await tx.insert(clients).values({
      workspaceId: prospect.workspaceId,
      name: prospect.name || prospect.domain,
      websiteUrl: `https://${prospect.domain}`,
    }).returning();

    // 3. Create default project for tracking
    const [project] = await tx.insert(projects).values({
      clientId: client.id,
      name: 'SEO Campaign',
      domain: prospect.domain,
    }).returning();

    // 4. Import top 20 opportunity keywords for tracking
    if (latestAnalysis?.opportunityKeywords?.length) {
      const topKeywords = latestAnalysis.opportunityKeywords
        .slice(0, 20)
        .map(kw => ({
          projectId: project.id,
          keyword: kw.keyword,
          locationCode: kw.locationCode || 2840,
          languageCode: kw.languageCode || 'en',
          trackingEnabled: true,
        }));
      
      await tx.insert(savedKeywords).values(topKeywords);
    }

    // 5. Store analysis insights in client intelligence
    if (latestAnalysis) {
      await tx.insert(clientIntelligence).values({
        clientId: client.id,
        prospectAnalysisId: latestAnalysis.id,
        domainMetrics: latestAnalysis.domainMetrics,
        initialOpportunities: latestAnalysis.opportunityKeywords,
        conversionInsights: latestAnalysis.aiInsights,
      });
    }

    // 6. Mark prospect as converted (keep record for history)
    await tx.update(prospects)
      .set({
        status: 'converted',
        convertedToClientId: client.id,
        convertedAt: new Date(),
      })
      .where(eq(prospects.id, prospectId));

    return client;
  });
}
```

### What Gets Migrated

| From Prospect | To Client | Notes |
|---------------|-----------|-------|
| `domain` | `website_url`, `project.domain` | Used for tracking |
| `name` | `name` | Company name |
| `workspace_id` | `workspace_id` | Same workspace |
| Top 20 opportunity keywords | `saved_keywords` | Start tracking immediately |
| Analysis insights | `client_intelligence` | Reference for onboarding |

### What Gets Created Fresh

| New for Client | Why |
|----------------|-----|
| `client_dashboard_metrics` | BullMQ worker computes from real data |
| `keyword_rankings` | Start tracking from conversion date |
| OAuth connections | Client needs to connect GSC/GA4 |
| Goals | User sets up based on opportunity analysis |

### What Stays on Prospect

| Field | Status |
|-------|--------|
| `status` | Changed to 'converted' |
| `converted_to_client_id` | Links to new client |
| `converted_at` | Timestamp of conversion |
| All analyses | Preserved for history |

---

## UI Flows

### Prospects List Page

```
┌─────────────────────────────────────────────────────────────────┐
│ Prospects                                    [+ Add Prospect]   │
├─────────────────────────────────────────────────────────────────┤
│ Domain              Status      Opportunities    Actions        │
│ ─────────────────────────────────────────────────────────────── │
│ helsinkisaunas.com  ● Analyzed  156 keywords     [Convert] [→]  │
│ saunaworld.fi       ◐ Analyzing ...              [View]         │
│ newprospect.com     ○ New       —                [Analyze]      │
│ oldlead.com         ✓ Converted → Client #42     [View Client]  │
└─────────────────────────────────────────────────────────────────┘
```

### Conversion Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ Convert helsinkisaunas.com to Client?                           │
│                                                                 │
│ This will:                                                      │
│ ✓ Create a new client record                                    │
│ ✓ Create a project with domain tracking                         │
│ ✓ Import top 20 opportunity keywords for tracking               │
│ ✓ Save analysis insights to client profile                      │
│                                                                 │
│ The prospect record will be kept and linked to the new client.  │
│                                                                 │
│ Client name: [Helsinki Saunas_____________]                     │
│                                                                 │
│                              [Cancel]  [Convert to Client]      │
└─────────────────────────────────────────────────────────────────┘
```

### Post-Conversion Success

```
┌─────────────────────────────────────────────────────────────────┐
│ ✓ Client created: Helsinki Saunas                               │
│                                                                 │
│ What's been set up:                                             │
│ • Client record created                                         │
│ • 20 keywords imported and tracking enabled                     │
│ • Analysis insights saved                                       │
│                                                                 │
│ Recommended next steps:                                         │
│ 1. Connect Google Search Console for ranking data               │
│ 2. Connect Google Analytics for traffic data                    │
│ 3. Set up goals based on opportunity analysis                   │
│ 4. Review imported keywords and adjust tracking                 │
│                                                                 │
│        [View Prospect Analysis]  [Go to Client Dashboard]       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dashboard Tab Behavior

### Clients Tab (Default)

Shows existing dashboard:
- Portfolio health summary (clients only)
- Client table with metrics
- Activity feed
- Quick stats cards

Prospects are NOT included in any metrics here.

### Prospects Tab

Shows prospect-specific view:
- Pipeline summary (new, analyzing, analyzed, converted counts)
- Prospect table with analysis status
- Recent analyses feed
- Opportunity highlights

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard                                                       │
│ [Clients] [Prospects]                                           │
├─────────────────────────────────────────────────────────────────┤
│ Pipeline Summary                                                │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│ │ 3 New   │ │ 2 Analyz│ │ 8 Ready │ │ 12 Conv │                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
├─────────────────────────────────────────────────────────────────┤
│ Prospects Ready for Conversion                                  │
│ ─────────────────────────────────────────────────────────────── │
│ helsinkisaunas.com    156 opportunities   Score: 8.5  [Convert] │
│ premiumspa.fi         89 opportunities    Score: 7.2  [Convert] │
│ saunastore.com        203 opportunities   Score: 9.1  [Convert] │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
# Prospects CRUD
GET    /api/prospects                    # List prospects
POST   /api/prospects                    # Create prospect
GET    /api/prospects/:id                # Get prospect details
PATCH  /api/prospects/:id                # Update prospect
DELETE /api/prospects/:id                # Archive prospect

# Analysis
POST   /api/prospects/:id/analyze        # Start analysis
GET    /api/prospects/:id/analyses       # List analyses
GET    /api/prospects/:id/analyses/:aid  # Get analysis details

# Conversion
POST   /api/prospects/:id/convert        # Convert to client
```

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Dashboard position | Tab toggle | Minimal change, clean separation |
| Prospect storage | Separate table | Don't pollute client metrics |
| Analysis storage | JSONB columns | Flexible, no schema per type |
| Conversion | Single transaction | Atomic, consistent state |
| Keyword import | Top 20 opportunities | Start tracking best chances |
| Prospect after conversion | Keep, mark converted | History + traceability |
| Client intelligence | Optional table | Store imported insights |
