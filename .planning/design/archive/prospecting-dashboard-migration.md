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
  
  -- Brand info (extracted from scrape, migrates to client)
  brand_name TEXT,              -- "Helsinki Saunas" (display name)
  brand_logo_url TEXT,          -- Logo if found on site
  brand_primary_color TEXT,     -- "#2563eb" (extracted from site)
  brand_industry TEXT,          -- "Sauna Retail"
  brand_products JSONB,         -- ["barrel saunas", "cabin saunas", "infrared saunas"]
  brand_services JSONB,         -- ["installation", "delivery", "maintenance"]
  brand_location TEXT,          -- "Helsinki, Finland"
  brand_target_market TEXT,     -- "residential", "commercial", "both"
  
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

    // 2. Create client record (with brand info from prospect)
    const [client] = await tx.insert(clients).values({
      workspaceId: prospect.workspaceId,
      name: prospect.name || prospect.brandName || prospect.domain,
      websiteUrl: `https://${prospect.domain}`,
      // Brand fields migrate directly
      brandName: prospect.brandName,
      brandLogoUrl: prospect.brandLogoUrl,
      brandPrimaryColor: prospect.brandPrimaryColor,
      industry: prospect.brandIndustry,
    }).returning();

    // 3. Create default project for tracking
    const [project] = await tx.insert(projects).values({
      clientId: client.id,
      name: 'SEO Campaign',
      domain: prospect.domain,
    }).returning();

    // 4. Import ALL opportunity keywords (GSC tracking is FREE!)
    // Note: Prospects = one-time DataForSEO analysis (paid once)
    //       Clients = GSC provides ranking data for FREE
    if (latestAnalysis?.opportunityKeywords?.length) {
      const allKeywords = latestAnalysis.opportunityKeywords.map((kw) => ({
        projectId: project.id,
        keyword: kw.keyword,
        locationCode: kw.locationCode || 2840,
        languageCode: kw.languageCode || 'en',
        trackingEnabled: true,  // ALL keywords tracked - GSC is free!
        opportunityScore: kw.score,
        opportunitySource: kw.source,
      }));
      
      await tx.insert(savedKeywords).values(allKeywords);
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
| ALL opportunity keywords | `saved_keywords` | Top 20 tracked, rest saved |
| Brand info | `client.brand_*` fields | For reports, white-label |
| Analysis insights | `client_intelligence` | Reference for onboarding |

### What Gets Created Fresh

| New for Client | Why |
|----------------|-----|
| `client_dashboard_metrics` | BullMQ worker computes from real data |
| `keyword_rankings` | Start tracking from conversion date |
| OAuth connections | Client needs to connect GSC/GA4 |
| Goals | User sets up based on opportunity analysis |

---

## Ranking Data Sources

### The Key Insight: GSC is the Source of Truth

```
PROSPECT (pre-conversion):
├── DataForSEO: One-time analysis ($0.50-0.80)
│   └── Shows what they currently rank for (snapshot)
│   └── Generates opportunity keywords
│
CLIENT (post-conversion):
├── GSC (Google Search Console): FREE, ongoing
│   └── Daily ranking data for all connected properties
│   └── Keywords they actually rank for
│   └── If not in GSC → "Not ranked yet"
```

### Keyword Status Flow

When opportunity keywords are imported to a client:

```typescript
// Keyword states after import
interface ImportedKeyword {
  keyword: string;
  trackingEnabled: true;
  
  // From prospect analysis (snapshot)
  opportunityScore: number;
  opportunitySource: 'gap' | 'ai_discovered' | 'expansion';
  
  // From GSC (live truth)
  gscPosition: number | null;      // null = not ranked yet
  gscClicks: number | null;
  gscImpressions: number | null;
  
  // Display status
  rankingStatus: 'ranked' | 'not_ranked_yet';
}

// GSC sync determines status
function updateRankingStatus(keyword: ImportedKeyword, gscData: GSCData | null) {
  if (gscData && gscData.position) {
    keyword.rankingStatus = 'ranked';
    keyword.gscPosition = gscData.position;
    keyword.gscClicks = gscData.clicks;
    keyword.gscImpressions = gscData.impressions;
  } else {
    keyword.rankingStatus = 'not_ranked_yet';
    keyword.gscPosition = null;
    keyword.gscClicks = null;
    keyword.gscImpressions = null;
  }
}
```

### UI Display

```
Keywords (487 imported, 156 ranking, 331 not ranked yet)

┌─────────────────────────────────────────────────────────────────┐
│ Keyword                  GSC Position   Status         Actions  │
│ ─────────────────────────────────────────────────────────────── │
│ barrel sauna prices      #12            ● Ranked       [View]   │
│ Harvia sauna heater      #8             ● Ranked       [View]   │
│ sauna health benefits    —              ○ Not yet      [Track]  │
│ home spa installation    —              ○ Not yet      [Track]  │
│ barrel sauna delivery    #45            ● Ranked       [View]   │
└─────────────────────────────────────────────────────────────────┘

Filter: [All] [Ranked] [Not Ranked Yet] [Top 10] [Top 3]
```

### Why This Matters

| Data Source | Cost | Purpose | Freshness |
|-------------|------|---------|-----------|
| DataForSEO (prospects) | $0.50-0.80/analysis | Discover opportunities | One-time snapshot |
| GSC (clients) | FREE | Track actual rankings | Daily updates |

**For prospects:** DataForSEO shows what they COULD rank for.
**For clients:** GSC shows what they ACTUALLY rank for.

Keywords imported as opportunities may initially show "Not ranked yet" — this is expected. As the client's SEO improves, GSC will start showing rankings for these keywords.

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
| Keyword import | ALL keywords | Full data preserved |
| Client tracking | ALL via GSC | GSC is FREE - no cost concern! |
| Prospect analysis | One-time only | DataForSEO cost paid once per prospect |
| Brand migration | Direct field copy | Prospect brand → Client brand |
| Prospect after conversion | Keep, mark converted | History + traceability |
| Client intelligence | Optional table | Store imported insights |

---

## AI Keyword Verification

Before importing keywords to a client, AI verifies each keyword actually matches the brand/business.

### Why Verification is Needed

The opportunity discovery might include keywords that:
- Are tangentially related but not brand-appropriate
- Were suggested based on competitor data but don't fit this specific business
- Are technically relevant but off-brand (e.g., "cheap saunas" for a premium brand)

### Verification Flow

```typescript
async function verifyKeywordsForBrand(
  keywords: OpportunityKeyword[],
  brandContext: BrandContext
): Promise<VerifiedKeyword[]> {
  
  const prompt = `
You are verifying if keywords match a brand.

Brand: ${brandContext.brandName}
Products: ${brandContext.products.join(', ')}
Services: ${brandContext.services.join(', ')}
Target market: ${brandContext.targetMarket}
Location: ${brandContext.location}
Positioning: ${brandContext.positioning || 'not specified'}

For each keyword, score 1-10 how well it matches this brand:
- 10: Perfect fit, exactly what they should target
- 7-9: Good fit, relevant to their business
- 4-6: Marginal fit, might work but not ideal
- 1-3: Poor fit, off-brand or irrelevant

Keywords to verify:
${keywords.map(k => `- "${k.keyword}"`).join('\n')}

Output JSON: { "verified": [{ "keyword": string, "score": number, "reason": string }] }
`;

  const result = await ai.generate(prompt);
  
  return keywords.map(kw => {
    const verification = result.verified.find(v => v.keyword === kw.keyword);
    return {
      ...kw,
      brandFitScore: verification?.score || 5,
      brandFitReason: verification?.reason || 'Not verified',
      verified: (verification?.score || 5) >= 6,
    };
  });
}
```

### Example Verification

```
Brand: Helsinki Saunas (premium home saunas)
Products: barrel saunas, cabin saunas, Harvia heaters
Target: residential, premium

Keyword: "barrel sauna prices"
→ Score: 9/10 - "Direct product search, high intent"

Keyword: "cheap sauna deals"  
→ Score: 3/10 - "Off-brand, they position as premium not budget"

Keyword: "sauna health benefits"
→ Score: 8/10 - "Educational content, builds authority, attracts target audience"

Keyword: "commercial sauna installation"
→ Score: 4/10 - "They focus on residential, not commercial"
```

### Integration in Migration

```typescript
// 4. Import ALL keywords with brand verification
if (latestAnalysis?.opportunityKeywords?.length) {
  // Verify keywords match the brand
  const verifiedKeywords = await verifyKeywordsForBrand(
    latestAnalysis.opportunityKeywords,
    {
      brandName: prospect.brandName,
      products: prospect.brandProducts,
      services: prospect.brandServices,
      targetMarket: prospect.brandTargetMarket,
      location: prospect.brandLocation,
    }
  );
  
  // Import all, but flag low-fit keywords
  const allKeywords = verifiedKeywords.map((kw, index) => ({
    projectId: project.id,
    keyword: kw.keyword,
    locationCode: kw.locationCode || 2840,
    languageCode: kw.languageCode || 'en',
    // Only track verified keywords by default
    trackingEnabled: kw.verified && index < 50,
    opportunityScore: kw.score,
    opportunitySource: kw.source,
    brandFitScore: kw.brandFitScore,
    brandFitReason: kw.brandFitReason,
  }));
  
  await tx.insert(savedKeywords).values(allKeywords);
}
```

### UI Display

```
Keywords (487 imported, 312 verified, 50 tracking)

┌─────────────────────────────────────────────────────────────────┐
│ Keyword                  Volume   Diff   Brand Fit   Tracking   │
│ ─────────────────────────────────────────────────────────────── │
│ barrel sauna prices      1,200    25     ●●●●●●●●●○  [✓]        │
│ Harvia sauna heater        800    32     ●●●●●●●●●○  [✓]        │
│ sauna health benefits    2,400    45     ●●●●●●●●○○  [✓]        │
│ cheap sauna deals          900    20     ●●●○○○○○○○  [ ]        │
│ commercial sauna install   300    38     ●●●●○○○○○○  [ ]        │
└─────────────────────────────────────────────────────────────────┘

Filter: [All] [Verified Only] [Tracking] [Low Fit]
```
