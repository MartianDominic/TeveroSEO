# Phase 98: SEO Agency Chat — Complete Specification

> **Purpose:** Chat tool for agency owner to answer prospect questions, run analyses, generate proposals, and close deals via magic link.
>
> **Flow:** Prospect DMs on Facebook → Agency pastes question → Chat analyzes → Proposal generated → Magic link sent → Prospect pays → Client
>
> **Updated:** 2026-05-10

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Chat Intents](#2-chat-intents)
3. [Analysis Registry](#3-analysis-registry)
4. [Configuration System](#4-configuration-system)
5. [Routing System](#5-routing-system)
6. [Architecture](#6-architecture)
7. [Proposal Flow](#7-proposal-flow)
8. [Existing Systems Integration](#8-existing-systems-integration)
9. [Implementation Plan](#9-implementation-plan)

---

## 1. System Overview

### The Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENCY SIDE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Facebook DM: "Can you rank me for these 10 keywords?"                  │
│                              ↓                                          │
│              Agency pastes into SEO Chat                                │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CHAT INTERFACE                                                   │   │
│  │                                                                  │   │
│  │ > Can meistreliokampas.lt rank for makita dalys, dewalt dalys?  │   │
│  │                                                                  │   │
│  │ ┌──────────────────────────────────────────────────────────────┐│   │
│  │ │ KEYWORD FEASIBILITY                                          ││   │
│  │ │                                                              ││   │
│  │ │ makita dalys: ✓ Feasible (3-4 mo) | €180/mo value           ││   │
│  │ │ dewalt dalys: ✓ Feasible (2-3 mo) | €120/mo value           ││   │
│  │ │                                                              ││   │
│  │ │ Expanded to 47 related keywords                              ││   │
│  │ │ [View Topical Map] [Generate Proposal]                       ││   │
│  │ └──────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│              Agency clicks "Generate Proposal"                          │
│                              ↓                                          │
│              Magic link: tevero.lt/p/abc123xyz                          │
│                              ↓                                          │
│              Agency sends link via Facebook DM                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROSPECT SIDE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Prospect opens tevero.lt/p/abc123xyz                                   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ YOUR SEO OPPORTUNITY                                             │   │
│  │ meistreliokampas.lt                                              │   │
│  │                                                                  │   │
│  │ We found 47 keyword opportunities worth €2,400/mo                │   │
│  │                                                                  │   │
│  │ [View Analysis] [View Topical Map]                               │   │
│  │                                                                  │   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐                          │   │
│  │ │ Starter  │ │ Growth ⭐ │ │  Scale   │                          │   │
│  │ │ €800/mo  │ │€1,200/mo │ │€2,000/mo │                          │   │
│  │ │ 10 kw    │ │ 25 kw    │ │ 47 kw    │                          │   │
│  │ │ [Select] │ │ [Select] │ │ [Select] │                          │   │
│  │ └──────────┘ └──────────┘ └──────────┘                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│              Prospect selects package                                   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CHECKOUT                                                         │   │
│  │                                                                  │   │
│  │ Growth Package: €1,200/mo                                        │   │
│  │ 25 keywords included                                             │   │
│  │                                                                  │   │
│  │ ☑ I agree to the Service Terms                                  │   │
│  │                                                                  │   │
│  │ [Pay with Stripe]                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│              Payment complete → Client created                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### What Already Exists

| System | Status | Location |
|--------|--------|----------|
| Keyword Intelligence | ✅ COMPLETE | `open-seo-main/src/server/features/keywords/` |
| Proposals | ✅ COMPLETE | `open-seo-main/src/server/features/proposals/` |
| Prospects/Clients | ✅ COMPLETE | `prospect-schema.ts`, `client-schema.ts` |
| Stripe Payments | ✅ COMPLETE | Multi-provider integrated |
| DataForSEO | ✅ COMPLETE | All APIs wrapped |
| Tenant Isolation | ✅ COMPLETE | `apps/web/src/lib/tenant/` |
| Chat Infrastructure | ⚠️ PARTIAL | CopilotKit + keyword-chat exist |

### What Needs Building

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| Intent Router | 1 week | - |
| Analysis Registry | 1 week | - |
| Chat → Proposal integration | 1 week | Analysis Registry |
| Prospect Portal enhancements | 1 week | Proposal integration |
| Configuration UI | 3 days | - |
| Testing + Polish | 1 week | All above |

**Total: ~5 weeks**

---

## 2. Chat Intents

The chat recognizes 9 intent types:

### 2.1 Domain Analysis
**Trigger:** New domain mentioned, "look at [domain]", "check [domain]"

**Example:** "What does meistreliokampas.lt look like?"

**Analyses:** `domain_health`

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ meistreliokampas.lt                                    │
│                                                        │
│ Authority: DA 15 | DR 12                               │
│ Pages: 2,400 indexed                                   │
│ Traffic: ~500/mo                                       │
│ Keywords: 45 ranking (8 in positions 4-10)            │
│                                                        │
│ Health: ✓ Good foundation                              │
│ • SSL active                                           │
│ • Mobile-friendly                                      │
│ • Core Web Vitals: Pass                                │
│                                                        │
│ Issues: 2 found                                        │
│ • Missing meta descriptions (40% of pages)             │
│ • No FAQ schema                                        │
└────────────────────────────────────────────────────────┘
```

### 2.2 Keyword Feasibility
**Trigger:** "Can [domain] rank for [keywords]?", "feasibility", "ranking potential"

**Example:** "Can meistreliokampas.lt rank for makita dalys, dewalt dalys?"

**Analyses:** `keyword_feasibility`, `domain_health` (if not cached)

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ KEYWORD FEASIBILITY                                    │
│                                                        │
│ makita dalys                                           │
│ ✓ FEASIBLE — High Confidence                           │
│ Volume: 200/mo | KD: 28 | Value: €180/mo              │
│ Timeline: 3-4 months to page 1                         │
│ What we'd do: Landing page + 15 links                  │
│                                                        │
│ dewalt dalys                                           │
│ ✓ FEASIBLE — High Confidence                           │
│ Volume: 150/mo | KD: 22 | Value: €120/mo              │
│ Timeline: 2-3 months to page 1                         │
│ What we'd do: Optimize collection + 10 links           │
│                                                        │
│ [Expand Keywords] [Generate Proposal]                  │
└────────────────────────────────────────────────────────┘
```

### 2.3 Keyword Discovery
**Trigger:** "What keywords should [domain] target?", "keyword ideas", "opportunities"

**Example:** "What keywords should meistreliokampas.lt target?"

**Analyses:** `keyword_universe`, `topical_map`

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ KEYWORD DISCOVERY                                      │
│                                                        │
│ Expanded from seed → 156 keywords found                │
│ Clustered into 5 topic pillars                         │
│                                                        │
│ TOPICAL MAP:                                           │
│ ├─ Makita dalys (pillar)           KD 28 | 850/mo     │
│ │   ├─ makita akumuliatorius       KD 18 | 320/mo     │
│ │   ├─ makita angliniai šepetėliai KD 12 | 90/mo      │
│ │   └─ makita reduktorius          KD 35 | 70/mo      │
│ ├─ Dewalt dalys (pillar)           KD 22 | 420/mo     │
│ │   └─ ...                                             │
│ ├─ Milwaukee dalys (pillar)        KD 15 | 180/mo     │
│ │   └─ ...                                             │
│ ├─ Įrankių remontas (pillar)       KD 32 | 650/mo     │
│ │   └─ ...                                             │
│ └─ Atsarginės dalys (pillar)       KD 25 | 340/mo     │
│                                                        │
│ Total opportunity: 2,440/mo searches | €2,100/mo value │
│                                                        │
│ [View Full Map] [Generate Proposal]                    │
└────────────────────────────────────────────────────────┘
```

### 2.4 Competitor Analysis
**Trigger:** "What is [competitor] doing?", "compare to [competitor]", "competitor analysis"

**Example:** "What is aceraservisas.lt doing that we're not?"

**Analyses:** `competitor_discovery`, `content_gaps`

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ COMPETITOR ANALYSIS: aceraservisas.lt                  │
│                                                        │
│ Their Stats:                                           │
│ DA 22 | 180 pages | 3,200/mo traffic                   │
│                                                        │
│ What they have that you don't:                         │
│ • Dedicated brand landing pages (Makita, Dewalt, etc.) │
│ • Repair service pages with pricing                    │
│ • 12 blog posts on tool maintenance                    │
│ • FAQ schema on all service pages                      │
│                                                        │
│ Where you beat them:                                   │
│ • Catalog size: 50K products vs their 2K              │
│ • Multi-language: You have DE/EN, they're LT only     │
│                                                        │
│ Keywords they rank for that you don't:                 │
│ • makita remontas kaunas (pos 3)                       │
│ • dewalt garantinis servisas (pos 5)                   │
│ • elektrinis įrankis remontas (pos 4)                  │
│                                                        │
│ [Full Gap Report] [Add to Proposal]                    │
└────────────────────────────────────────────────────────┘
```

### 2.5 Technical Diagnosis
**Trigger:** "What's wrong with [domain]?", "technical issues", "why rankings dropped"

**Example:** "Why did our rankings drop last month?"

**Analyses:** `technical_audit`, `domain_health`

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ TECHNICAL DIAGNOSIS                                    │
│                                                        │
│ Ranking Changes (Last 30 Days):                        │
│ • 8 keywords dropped 5+ positions                      │
│ • Traffic down 23%                                     │
│                                                        │
│ Likely Causes:                                         │
│ 1. Core Web Vitals degraded (LCP: 4.2s → 6.1s)        │
│ 2. New competitor content outranking you               │
│ 3. 404 errors on 12 product pages                      │
│                                                        │
│ Algorithm Updates:                                     │
│ • No major updates in this period                      │
│                                                        │
│ Recommended Actions:                                   │
│ 1. Fix image optimization (causing slow LCP)           │
│ 2. Redirect 404 pages to category                      │
│ 3. Update content on affected pages                    │
│                                                        │
│ [Full Technical Audit] [Add to Proposal]               │
└────────────────────────────────────────────────────────┘
```

### 2.6 Content Recommendations
**Trigger:** "What content should I create?", "content ideas", "what to write"

**Example:** "What content should we create for meistreliokampas.lt?"

**Analyses:** `content_gaps`, `keyword_universe`

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ CONTENT RECOMMENDATIONS                                │
│                                                        │
│ High-Impact Content Opportunities:                     │
│                                                        │
│ 1. "Makita akumuliatoriaus keitimas" (guide)          │
│    KD 15 | 280/mo | No good content exists             │
│    → Create: 2000-word how-to with images              │
│                                                        │
│ 2. "Dewalt vs Milwaukee: kuris geresnis?" (comparison)│
│    KD 22 | 450/mo | Competitors have thin content      │
│    → Create: Detailed comparison table + video         │
│                                                        │
│ 3. "Įrankių priežiūra žiemą" (seasonal)               │
│    KD 8 | 320/mo (seasonal peak in Nov)                │
│    → Create: Seasonal guide, publish in October        │
│                                                        │
│ Content Calendar:                                      │
│ • Month 1: #1, #3 (quick wins)                         │
│ • Month 2: #2 (higher effort)                          │
│ • Month 3: Supporting content for pillars              │
│                                                        │
│ [Full Content Plan] [Add to Proposal]                  │
└────────────────────────────────────────────────────────┘
```

### 2.7 Quick Wins
**Trigger:** "What should I fix first?", "quick wins", "easy wins", "priority"

**Example:** "What quick wins can we get for meistreliokampas.lt?"

**Analyses:** `quick_wins` (combines domain_health + keyword_feasibility)

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ QUICK WINS                                             │
│                                                        │
│ 1. Add meta descriptions to 40% of pages              │
│    Effort: 2 hours | Impact: +15% CTR potential        │
│                                                        │
│ 2. Push 8 keywords from pos 4-10 to top 3             │
│    Effort: 1 week | Impact: +800 visits/mo             │
│    Method: Internal linking + content refresh          │
│                                                        │
│ 3. Create "Makita dalys" landing page                  │
│    Effort: 3 days | Impact: +200 visits/mo             │
│    You have 25K products, no dedicated page            │
│                                                        │
│ 4. Add LocalBusiness schema                            │
│    Effort: 1 hour | Impact: Local pack visibility      │
│                                                        │
│ 5. Fix 12 broken internal links                        │
│    Effort: 30 min | Impact: Better crawl efficiency    │
│                                                        │
│ Total Impact: +1,200 visits/mo in 30 days              │
│                                                        │
│ [Generate Proposal with Quick Wins]                    │
└────────────────────────────────────────────────────────┘
```

### 2.8 Generate Proposal
**Trigger:** "Generate proposal", "create proposal", "send proposal"

**Example:** "Generate proposal for meistreliokampas.lt"

**Analyses:** Uses accumulated analysis results from conversation

**Output:**
```
┌────────────────────────────────────────────────────────┐
│ PROPOSAL READY                                         │
│                                                        │
│ Client: meistreliokampas.lt                            │
│ Keywords: 47 (from topical map)                        │
│ Opportunity: €2,100/mo traffic value                   │
│                                                        │
│ Packages:                                              │
│ ├─ Starter (€800/mo): 10 keywords, on-page only       │
│ ├─ Growth (€1,200/mo): 25 keywords, on-page + content │
│ └─ Scale (€2,000/mo): 47 keywords, full service       │
│                                                        │
│ Magic Link: tevero.lt/p/abc123xyz                      │
│ Expires: 14 days                                       │
│                                                        │
│ [Copy Link] [Send via Email] [Preview] [Edit]          │
└────────────────────────────────────────────────────────┘
```

### 2.9 General Q&A
**Trigger:** Questions that don't match other intents

**Example:** "How does internal linking work?"

**Analyses:** None (knowledge-based response)

**Output:** Conversational explanation with examples

---

## 3. Analysis Registry

All analyses are registered in a central registry with dependencies.

### 3.1 Analysis Types

| ID | Description | Dependencies | DataForSEO APIs | Cost |
|----|-------------|--------------|-----------------|------|
| `domain_health` | Site authority, traffic, issues | - | Domain Analytics, On-Page | $0.01 |
| `keyword_feasibility` | Can we rank? Timeline, effort | - | SERP, Keyword Data | $0.02 |
| `keyword_universe` | Expand seeds to full keyword list | - | Keywords for Site, Related | $0.03 |
| `topical_map` | Cluster keywords into hierarchy | `keyword_universe` | - (local clustering) | $0.01 |
| `competitor_discovery` | Find and analyze competitors | `domain_health` | Competitors Domain | $0.02 |
| `technical_audit` | Full technical SEO check | - | On-Page, Lighthouse | $0.05 |
| `content_gaps` | Missing content opportunities | `keyword_universe` | Ranked Keywords | $0.02 |
| `quick_wins` | Low-effort, high-impact fixes | `domain_health` | - (computed) | $0.01 |

### 3.2 Analysis Interface

```typescript
interface Analysis<TInput, TOutput> {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  requiredContext: ('domain' | 'keywords' | 'competitor')[];
  estimatedCostMicros: number;
  estimatedTimeMs: number;
  execute(input: TInput, context: ConversationContext): Promise<TOutput>;
}
```

### 3.3 Registry Implementation

```typescript
// apps/web/src/lib/seo-chat/analyses/registry.ts

const registry = new Map<string, Analysis>();

registry.set('domain_health', {
  id: 'domain_health',
  name: 'Domain Health Check',
  dependencies: [],
  requiredContext: ['domain'],
  estimatedCostMicros: 10000, // $0.01
  estimatedTimeMs: 3000,
  execute: async (input, context) => {
    // Uses: dataforseoClient, domain analysis service
  }
});

registry.set('keyword_feasibility', {
  id: 'keyword_feasibility',
  name: 'Keyword Feasibility',
  dependencies: [],
  requiredContext: ['domain', 'keywords'],
  estimatedCostMicros: 20000, // $0.02
  estimatedTimeMs: 4000,
  execute: async (input, context) => {
    // Uses: SERP analysis, keyword difficulty, timeline calculation
  }
});

// ... etc for all analyses
```

### 3.4 DAG Executor

```typescript
// apps/web/src/lib/seo-chat/analyses/executor.ts

async function runAnalyses(
  requested: string[],
  context: ConversationContext
): Promise<Map<string, AnalysisOutput>> {
  // Build dependency graph
  const dag = buildDependencyGraph(requested, registry);
  
  // Execute in topological order
  const results = new Map<string, AnalysisOutput>();
  
  for (const level of dag.levels) {
    // Execute all analyses at this level in parallel
    const levelResults = await Promise.all(
      level.map(id => registry.get(id)!.execute(context))
    );
    
    // Merge into results
    level.forEach((id, i) => {
      results.set(id, levelResults[i]);
      context.analysisResults.set(id, levelResults[i]);
    });
  }
  
  return results;
}
```

---

## 4. Configuration System

### 4.1 Feasibility Settings

**Storage:** `workspace_settings.feasibility` (JSONB)

```typescript
interface FeasibilitySettings {
  // Difficulty thresholds
  maxFeasibleKD: number;        // Default: 85 (above = not feasible)
  easyKDThreshold: number;      // Default: 30
  mediumKDThreshold: number;    // Default: 50
  hardKDThreshold: number;      // Default: 70
  
  // Agency capacity
  linksPerMonth: number;        // Default: 10
  contentPagesPerMonth: number; // Default: 12
  technicalHoursPerMonth: number; // Default: 20
  
  // Timeline calculation
  baselineMonths: number;       // Default: 3
  monthsPerKDPoint: number;     // Default: 0.1 (KD 50 = +5 months)
  maxTimelineMonths: number;    // Default: 18
  
  // Special rules
  ymylPenalty: number;          // Default: 20 (added to effective KD)
  localBonus: number;           // Default: -10 (subtracted from KD)
}
```

### 4.2 Package Settings

**Storage:** `service_templates` table (existing)

```typescript
interface PackageSettings {
  packages: Array<{
    id: string;
    name: string;                // "Starter", "Growth", "Scale"
    monthlyPriceCents: number;
    setupFeeCents: number;
    keywordLimit: number | 'unlimited';
    services: {
      onPage: boolean;
      technical: boolean;
      content: boolean;
      linkBuilding: boolean;
      localSeo: boolean;
    };
    deliverables: string[];      // ["Monthly report", "Keyword tracking", ...]
    isDefault: boolean;          // Highlighted package
  }>;
  
  // Keyword assignment rules
  keywordAssignment: 'first_n' | 'by_priority' | 'by_feasibility' | 'manual';
  
  // Custom quote threshold
  customQuoteAbove: number;      // Default: 5000 (€)
}
```

### 4.3 Proposal Settings

**Storage:** `workspace_settings.proposal` (JSONB)

```typescript
interface ProposalSettings {
  // Branding
  logoUrl: string | null;
  brandColor: string;            // Default: "#2563eb"
  
  // Terms
  expiryDays: number;            // Default: 14
  minimumContractMonths: number; // Default: 3
  paymentTerms: string;          // Default: "Due on acceptance"
  cancellationNotice: number;    // Default: 30 (days)
  
  // Templates
  introTemplate: string;         // Opening paragraph template
  closingTemplate: string;       // Closing/CTA template
  
  // Notifications
  sendViewNotification: boolean; // Default: true
  sendExpiryReminder: boolean;   // Default: true
  reminderDaysBefore: number;    // Default: 3
}
```

### 4.4 Response Settings

**Storage:** `workspace_settings.response` (JSONB)

```typescript
interface ResponseSettings {
  // Tone
  tone: 'professional' | 'casual' | 'technical';
  language: string;              // Default: "en"
  
  // Detail level
  defaultDetail: 'brief' | 'detailed' | 'comprehensive';
  includeDataSources: boolean;   // Show "Source: DataForSEO"
  showCompetitorNames: boolean;  // Default: false (privacy)
  
  // Suggestions
  autoSuggestProposal: boolean;  // After feasibility shows opportunity
  autoSuggestExpand: boolean;    // After single keyword, offer expansion
}
```

### 4.5 Business Rules

**Storage:** `workspace_settings.business` (JSONB)

```typescript
interface BusinessRuleSettings {
  // Minimums
  minMonthlyBudget: number;      // Default: 500
  minKeywords: number;           // Default: 5
  
  // Restrictions
  excludedIndustries: string[];  // ["gambling", "adult", ...]
  serviceRegions: string[];      // ["EU", "US", ...]
  
  // Legal
  requireNDA: boolean;           // Default: false
  termsUrl: string;              // Link to full terms
}
```

### 4.6 Configuration UI

Location: `/settings/seo-chat/`

```
┌─────────────────────────────────────────────────────────────┐
│ SEO CHAT SETTINGS                                           │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ FEASIBILITY                                             │ │
│ │                                                         │ │
│ │ Maximum feasible keyword difficulty: [85]               │ │
│ │ Our monthly link building capacity: [10] links          │ │
│ │ Our monthly content capacity: [12] pages                │ │
│ │ Maximum timeline to show: [18] months                   │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PACKAGES                                                │ │
│ │                                                         │ │
│ │ [Starter] [Growth] [Scale] [+ Add Package]              │ │
│ │                                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Growth                                     ⭐ Default│ │ │
│ │ │ Monthly: €[1200]  Setup: €[0]                       │ │ │
│ │ │ Keywords: [25]                                      │ │ │
│ │ │ ☑ On-page ☑ Technical ☑ Content ☐ Links ☐ Local   │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ Keyword assignment: ○ First N  ○ By priority  ● Manual │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PROPOSAL                                                │ │
│ │                                                         │ │
│ │ Logo: [Upload]                                          │ │
│ │ Brand color: [#2563eb]                                  │ │
│ │ Expiry: [14] days                                       │ │
│ │ Minimum contract: [3] months                            │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Save Settings]                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Routing System

### 5.1 Intent Detection

**Hybrid approach:** Pattern matching first, LLM fallback for ambiguous queries.

```typescript
// apps/web/src/lib/seo-chat/router/intent-detector.ts

const INTENT_PATTERNS: Record<Intent, RegExp | null> = {
  domain_analysis: /^(look at|check|analyze|show me)\s+.+\.(com|lt|io|net|org)/i,
  keyword_feasibility: /can\s+.+\s+rank|ranking\s+potential|feasib(le|ility)/i,
  keyword_discovery: /what\s+keywords?|should\s+target|keyword\s+(ideas|opportunities)/i,
  competitor_analysis: /competitor|what\s+is\s+.+\s+doing|compare\s+to|vs\.?\s+/i,
  technical_diagnosis: /what'?s\s+wrong|technical\s+issues?|rankings?\s+(drop|fell)/i,
  content_recommendations: /what\s+(content|should\s+I\s+write)|content\s+(ideas|gaps?)/i,
  quick_wins: /quick\s+wins?|easy\s+wins?|fix\s+first|low\s+hanging|priorit/i,
  generate_proposal: /generate\s+proposal|create\s+proposal|send\s+(proposal|quote)/i,
  general_qa: null, // Fallback
};

async function detectIntent(query: string, context: ConversationContext): Promise<DetectedIntent> {
  // Try pattern matching first
  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (pattern && pattern.test(query)) {
      return { type: intent as Intent, confidence: 0.9 };
    }
  }
  
  // LLM fallback for ambiguous queries
  const llmResult = await classifyWithGrok(query, context);
  
  if (llmResult.confidence < 0.7) {
    // Ask for clarification
    return { type: 'clarification_needed', suggestions: llmResult.suggestions };
  }
  
  return llmResult;
}
```

### 5.2 Required Context

| Intent | Domain | Keywords | Competitor | Timeframe |
|--------|--------|----------|------------|-----------|
| `domain_analysis` | ✅ Required | - | - | - |
| `keyword_feasibility` | ✅ Required | ✅ Required | - | - |
| `keyword_discovery` | ✅ Required | ⚪ Optional (seeds) | - | - |
| `competitor_analysis` | ⚪ Optional | - | ✅ Required | - |
| `technical_diagnosis` | ✅ Required | - | - | ⚪ Optional |
| `content_recommendations` | ✅ Required | - | - | - |
| `quick_wins` | ✅ Required | - | - | - |
| `generate_proposal` | ✅ Required | ⚪ From context | - | - |
| `general_qa` | - | - | - | - |

### 5.3 Analysis Pipeline Mapping

```typescript
const INTENT_PIPELINES: Record<Intent, string[]> = {
  domain_analysis: ['domain_health'],
  keyword_feasibility: ['domain_health', 'keyword_feasibility'],
  keyword_discovery: ['domain_health', 'keyword_universe', 'topical_map'],
  competitor_analysis: ['domain_health', 'competitor_discovery', 'content_gaps'],
  technical_diagnosis: ['domain_health', 'technical_audit'],
  content_recommendations: ['domain_health', 'keyword_universe', 'content_gaps'],
  quick_wins: ['domain_health', 'keyword_feasibility', 'quick_wins'],
  generate_proposal: [], // Uses accumulated results
  general_qa: [],
};
```

### 5.4 Context Extraction

```typescript
// apps/web/src/lib/seo-chat/router/context-extractor.ts

interface ExtractedContext {
  domains: string[];
  keywords: string[];
  competitors: string[];
  timeframe?: { start: Date; end: Date };
}

function extractContext(query: string, history: Message[]): ExtractedContext {
  // Extract domains (regex for common TLDs)
  const domains = query.match(/[\w-]+\.(com|lt|io|net|org|eu|co\.uk)/gi) || [];
  
  // Extract keywords (quoted strings or after "for"/"rank for")
  const quotedKeywords = query.match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
  const afterFor = query.match(/(?:for|rank\s+for)\s+([^,?]+)/i)?.[1]?.trim();
  
  // Check conversation history for context
  const historyDomain = findDomainInHistory(history);
  
  return {
    domains: domains.length ? domains : historyDomain ? [historyDomain] : [],
    keywords: [...quotedKeywords, ...(afterFor ? [afterFor] : [])],
    competitors: extractCompetitors(query),
  };
}
```

---

## 6. Architecture

### 6.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CHAT LAYER                                   │
│                                                                         │
│  ┌───────────────┐     ┌──────────────┐     ┌───────────────────────┐  │
│  │   CopilotKit  │────▶│ Intent Router │────▶│ Analysis Orchestrator│  │
│  │   Interface   │     │              │     │                       │  │
│  └───────────────┘     └──────────────┘     └───────────────────────┘  │
│                                                        │                │
└────────────────────────────────────────────────────────│────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          ANALYSIS LAYER                                 │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │domain_health │  │kw_feasibility│  │kw_universe   │  │topical_map │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │competitor    │  │technical     │  │content_gaps  │  │quick_wins  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐    ┌─────────────────────────────────────────────┐
│   DataForSEO APIs   │    │            EXISTING SERVICES                │
│                     │    │                                             │
│ • Domain Analytics  │    │ • KeywordUniverseBuilder                    │
│ • SERP API          │    │ • HierarchyBuilder                          │
│ • Keyword Data      │    │ • HDBSCANClusterer                          │
│ • Backlinks         │    │ • IntentClassifier                          │
│ • On-Page           │    │ • ProposalGeneratorService                  │
│ • Lighthouse        │    │                                             │
└─────────────────────┘    └─────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          PROPOSAL LAYER                                 │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Proposal Generator                                                │  │
│  │                                                                   │  │
│  │ • Collects analysis results from conversation                     │  │
│  │ • Assigns keywords to packages based on rules                     │  │
│  │ • Generates proposal with ProposalGeneratorService               │  │
│  │ • Creates magic link token                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                      │                                  │
│                                      ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Prospect Portal (/proposals/[token])                              │  │
│  │                                                                   │  │
│  │ • View proposal + topical map                                     │  │
│  │ • Select package                                                  │  │
│  │ • Accept terms                                                    │  │
│  │ • Pay via Stripe                                                  │  │
│  │ • → Client created                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Conversation State

```typescript
// apps/web/src/lib/seo-chat/state/conversation-context.ts

interface ConversationContext {
  // Session
  sessionId: string;
  workspaceId: string;
  startedAt: Date;
  
  // Prospect (created on first domain mention)
  prospectId?: string;
  prospectDomain?: string;
  
  // Accumulated analysis results
  analysisResults: Map<string, AnalysisOutput>;
  
  // Keywords collected from conversation
  keywords: Array<{
    keyword: string;
    source: 'user_input' | 'expansion' | 'gap_analysis';
    feasibility?: FeasibilityResult;
    inTopicalMap?: boolean;
  }>;
  
  // Proposal draft
  proposalDraft?: {
    keywords: string[];
    packages: PackageSelection[];
    customizations: Record<string, unknown>;
  };
  
  // History
  messages: Message[];
}
```

### 6.3 File Structure

```
apps/web/src/lib/seo-chat/
├── index.ts                      # Main exports
├── types.ts                      # All TypeScript types
│
├── router/
│   ├── intent-detector.ts        # Pattern + LLM intent detection
│   ├── context-extractor.ts      # Extract domain, keywords, etc.
│   └── pipeline-mapper.ts        # Intent → analyses mapping
│
├── analyses/
│   ├── registry.ts               # Analysis registry
│   ├── executor.ts               # DAG executor
│   ├── domain-health.ts
│   ├── keyword-feasibility.ts
│   ├── keyword-universe.ts
│   ├── topical-map.ts
│   ├── competitor-discovery.ts
│   ├── technical-audit.ts
│   ├── content-gaps.ts
│   └── quick-wins.ts
│
├── proposal/
│   ├── generator.ts              # Generate proposal from analyses
│   ├── keyword-assigner.ts       # Assign keywords to packages
│   └── magic-link.ts             # Create shareable link
│
├── state/
│   ├── conversation-context.ts   # Conversation state management
│   └── prospect-manager.ts       # Create/update prospect records
│
├── config/
│   ├── settings-loader.ts        # Load workspace settings
│   └── defaults.ts               # Default configuration values
│
└── api/
    └── route.ts                  # SSE endpoint for chat

apps/web/src/components/seo-chat/
├── ChatProvider.tsx
├── ChatInput.tsx
├── ChatMessage.tsx
├── AnalysisCard.tsx
├── TopicalMapView.tsx
├── ProposalActions.tsx
└── SettingsPanel.tsx

apps/web/src/app/(dashboard)/seo-chat/
├── page.tsx                      # Main chat page
└── settings/
    └── page.tsx                  # Configuration UI
```

---

## 7. Proposal Flow

### 7.1 Analysis → Proposal

```typescript
// apps/web/src/lib/seo-chat/proposal/generator.ts

interface ProposalInput {
  prospectId: string;
  domain: string;
  analysisResults: Map<string, AnalysisOutput>;
  keywords: KeywordWithFeasibility[];
  packageSettings: PackageSettings;
}

async function generateProposal(input: ProposalInput): Promise<Proposal> {
  const { keywords, packageSettings } = input;
  
  // 1. Assign keywords to packages
  const keywordAssignments = assignKeywordsToPackages(
    keywords,
    packageSettings.packages,
    packageSettings.keywordAssignment
  );
  
  // 2. Calculate opportunity value per package
  const packageOpportunities = calculateOpportunities(keywordAssignments);
  
  // 3. Generate proposal content
  const proposalContent = await ProposalAIGenerationService.generate({
    domain: input.domain,
    health: input.analysisResults.get('domain_health'),
    topicalMap: input.analysisResults.get('topical_map'),
    packages: packageOpportunities,
  });
  
  // 4. Create proposal record
  const proposal = await ProposalService.create({
    prospectId: input.prospectId,
    ...proposalContent,
    packages: packageOpportunities,
    keywordAssignments,
  });
  
  // 5. Generate magic link
  const token = await createMagicLink(proposal.id);
  
  return { ...proposal, magicLink: `${BASE_URL}/p/${token}` };
}
```

### 7.2 Keyword Assignment

```typescript
// apps/web/src/lib/seo-chat/proposal/keyword-assigner.ts

type AssignmentStrategy = 'first_n' | 'by_priority' | 'by_feasibility' | 'manual';

function assignKeywordsToPackages(
  keywords: KeywordWithFeasibility[],
  packages: Package[],
  strategy: AssignmentStrategy
): Map<string, string[]> {
  // Sort packages by keyword limit (ascending)
  const sortedPackages = [...packages].sort((a, b) => 
    (a.keywordLimit === 'unlimited' ? Infinity : a.keywordLimit) -
    (b.keywordLimit === 'unlimited' ? Infinity : b.keywordLimit)
  );
  
  // Sort keywords by strategy
  let sortedKeywords: KeywordWithFeasibility[];
  switch (strategy) {
    case 'by_priority':
      sortedKeywords = [...keywords].sort((a, b) => b.priorityScore - a.priorityScore);
      break;
    case 'by_feasibility':
      sortedKeywords = [...keywords].sort((a, b) => 
        a.feasibility.timelineMonths - b.feasibility.timelineMonths
      );
      break;
    case 'first_n':
    default:
      sortedKeywords = keywords;
  }
  
  // Assign keywords to packages
  const assignments = new Map<string, string[]>();
  
  for (const pkg of sortedPackages) {
    const limit = pkg.keywordLimit === 'unlimited' 
      ? sortedKeywords.length 
      : pkg.keywordLimit;
    
    assignments.set(pkg.id, sortedKeywords.slice(0, limit).map(k => k.keyword));
  }
  
  return assignments;
}
```

### 7.3 Prospect Portal

The existing `/proposals/[token]` route needs enhancements:

```typescript
// apps/web/src/app/proposals/[token]/page.tsx (enhanced)

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const proposal = await getProposalByToken(params.token);
  
  if (!proposal) {
    return <ProposalNotFound />;
  }
  
  if (proposal.status === 'expired') {
    return <ProposalExpired />;
  }
  
  // Track view
  await ProposalService.recordView(proposal.id);
  
  return (
    <ProposalPortal proposal={proposal}>
      {/* Header with client domain */}
      <ProposalHeader domain={proposal.domain} />
      
      {/* Opportunity summary */}
      <OpportunitySummary 
        totalKeywords={proposal.keywords.length}
        totalValue={proposal.totalTrafficValue}
      />
      
      {/* Topical map visualization */}
      <TopicalMapViewer clusters={proposal.topicalMap} />
      
      {/* Package selection */}
      <PackageSelector 
        packages={proposal.packages}
        keywordAssignments={proposal.keywordAssignments}
        onSelect={handlePackageSelect}
      />
      
      {/* Terms & Payment */}
      <CheckoutFlow 
        proposalId={proposal.id}
        selectedPackage={selectedPackage}
      />
    </ProposalPortal>
  );
}
```

---

## 8. Existing Systems Integration

### 8.1 Keyword Intelligence

**Location:** `open-seo-main/src/server/features/keywords/`

| Component | Use In Chat |
|-----------|-------------|
| `KeywordUniverseBuilder` | `keyword_universe` analysis |
| `HierarchyBuilder` | `topical_map` analysis |
| `HDBSCANClusterer` | Clustering for topical map |
| `ClassificationPipeline` | Intent classification for keywords |
| `IntentSplitter` | Grouping by search intent |

**Integration:**
```typescript
// apps/web/src/lib/seo-chat/analyses/keyword-universe.ts

import { KeywordUniverseBuilder } from '@/server/features/keywords/universe/KeywordUniverseBuilder';

export const keywordUniverseAnalysis: Analysis = {
  id: 'keyword_universe',
  execute: async (input, context) => {
    const builder = new KeywordUniverseBuilder(context.workspaceId);
    
    const universe = await builder.expand({
      seeds: input.keywords,
      domain: input.domain,
      maxKeywords: 200,
    });
    
    return {
      keywords: universe.keywords,
      totalVolume: universe.totalVolume,
      clusters: universe.initialClusters,
    };
  },
};
```

### 8.2 Proposals

**Location:** `open-seo-main/src/server/features/proposals/`

| Component | Use In Chat |
|-----------|-------------|
| `ProposalService` | CRUD, status management |
| `ProposalGeneratorService` | Auto-generation from data |
| `ProposalAIGenerationService` | AI content for proposals |
| Magic link tokens | `/proposals/[token]` access |

**Integration:**
```typescript
// apps/web/src/lib/seo-chat/proposal/generator.ts

import { ProposalService } from '@/server/features/proposals/services/ProposalService';
import { ProposalGeneratorService } from '@/server/features/proposals/services/ProposalGeneratorService';

// Reuse existing services, just wire them to chat context
```

### 8.3 DataForSEO

**Location:** `open-seo-main/src/server/lib/dataforseo*.ts`

| API | Use In Analysis |
|-----|-----------------|
| `dataforseo.ts` | Keyword data, SERP |
| `dataforseoBacklinks.ts` | Backlink profile |
| `dataforseoKeywordGap.ts` | Competitor keywords |
| `dataforseoProspect.ts` | Keywords for site |
| `dataforseoLighthouse.ts` | Technical audit |

### 8.4 Tenant Isolation

**Location:** `apps/web/src/lib/tenant/`

All chat endpoints use tenant middleware:
```typescript
// apps/web/src/lib/seo-chat/api/route.ts

import { withTenant } from '@/lib/tenant';

export const POST = withTenant(async (req, tenant) => {
  // tenant.workspaceId available
  // All analyses scoped to workspace
});
```

---

## 9. Implementation Plan

### Phase 1: Core Chat (Week 1-2)

- [ ] Intent router with pattern matching
- [ ] Context extractor (domain, keywords)
- [ ] Analysis registry + DAG executor
- [ ] `domain_health` analysis
- [ ] `keyword_feasibility` analysis
- [ ] Basic chat UI with CopilotKit
- [ ] SSE streaming for analysis progress

### Phase 2: Keyword Intelligence (Week 2-3)

- [ ] `keyword_universe` analysis (wire to KeywordUniverseBuilder)
- [ ] `topical_map` analysis (wire to HierarchyBuilder)
- [ ] `competitor_discovery` analysis
- [ ] `content_gaps` analysis
- [ ] `quick_wins` analysis
- [ ] Topical map visualization component

### Phase 3: Proposal Integration (Week 3-4)

- [ ] Keyword assignment logic
- [ ] Proposal generation from chat context
- [ ] Magic link generation
- [ ] Prospect auto-creation
- [ ] "Send link" action in chat

### Phase 4: Prospect Portal (Week 4-5)

- [ ] Enhanced `/proposals/[token]` page
- [ ] Topical map viewer for prospects
- [ ] Package selection UI
- [ ] Terms acceptance
- [ ] Stripe checkout integration
- [ ] Client creation on payment

### Phase 5: Configuration (Week 5)

- [ ] Settings UI for feasibility
- [ ] Package configuration UI
- [ ] Proposal branding settings
- [ ] Response tone settings
- [ ] Business rules configuration

### Phase 6: Polish (Week 5-6)

- [ ] LLM fallback for ambiguous intents
- [ ] `technical_audit` analysis
- [ ] General Q&A handling
- [ ] Error handling + edge cases
- [ ] E2E testing
- [ ] Documentation

---

## Success Criteria

1. **Speed:** Intent detection <500ms, analyses <5s, proposal <8s
2. **Accuracy:** Intent classification >90% accuracy
3. **Conversion:** Proposals lead to payment (track funnel)
4. **Usability:** Agency can answer prospect questions in <30 seconds
5. **Reliability:** All analyses handle errors gracefully
