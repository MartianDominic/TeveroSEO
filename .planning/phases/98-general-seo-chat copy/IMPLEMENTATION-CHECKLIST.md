# Phase 98: SEO Sales Chat — Implementation Checklist

> **Purpose:** Sales tool to close deals. Answer prospect questions live, show opportunity, generate proposals.
> 
> **Core Loop:** Sales call → Answer questions → Show data → Generate proposal → Close deal
> 
> **Updated:** 2026-05-10

---

## The 3 Analyses

| # | Analysis | Purpose | Cost | Time |
|---|----------|---------|------|------|
| 1 | **Domain Health Check** | "Let me look at your site" | $0.01 | 2-3s |
| 2 | **Keyword Feasibility** | "Can we get you to page 1?" | $0.02-0.04 | 3-5s |
| 3 | **Proposal Generator** | Close the deal | $0.05 | 5-8s |

That's it. Everything else is overhead.

---

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Tenant Isolation | ✅ COMPLETE | 7 files in `apps/web/src/lib/tenant/` |
| Database Migration | ✅ COMPLETE | `0010_tenant_isolation.sql` |
| Domain Health Check | 🔲 TODO | |
| Keyword Feasibility | 🔲 TODO | Core analysis |
| Proposal Generator | 🔲 TODO | |
| Chat UI | 🔲 TODO | CopilotKit provider exists |
| PDF Export | 🔲 TODO | |

---

## Analysis 1: Domain Health Check

**Trigger:** New domain entered, "look at [domain]", "check [domain]"

**Purpose:** First impression. "Let me take a quick look at your site..."

**Output:**
```
┌─────────────────────────────────────────────────────────────┐
│ meistreliokampas.lt                                         │
│                                                             │
│ Domain Authority: 15                                        │
│ Indexed Pages: 2,400                                        │
│ Monthly Traffic: ~500 visits                                │
│ Top Keywords: 12 ranking (positions 10-50)                  │
│                                                             │
│ Health: ✓ Good foundation                                   │
│ • SSL active                                                │
│ • Mobile-friendly                                           │
│ • Fast loading (2.1s)                                       │
│                                                             │
│ Quick Wins Available:                                       │
│ • 8 keywords in positions 4-10 (easy to push up)            │
│ • Missing meta descriptions on 40% of pages                 │
└─────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- DataForSEO Domain Overview API
- DataForSEO Ranked Keywords API
- Basic technical check (SSL, mobile, speed)

**Implementation:**
```typescript
interface DomainHealthResult {
  domain: string;
  authority: number;
  indexedPages: number;
  monthlyTraffic: number;
  rankingKeywords: number;
  health: 'good' | 'needs_work' | 'critical';
  flags: string[];
  quickWins: string[];
}
```

---

## Analysis 2: Keyword Feasibility

**Trigger:** "Can [domain] rank for [keywords]?", "feasibility for [keywords]"

**Purpose:** Answer THE question. Can WE get them to page 1?

**Key Insight:** If they don't have content, we create it. Feasibility = can our agency achieve this with our services.

### Feasibility Calculation

**Inputs:**
```typescript
interface FeasibilityInputs {
  keyword: string;
  keywordDifficulty: number;      // 0-100 from DataForSEO
  searchVolume: number;
  avgTop10DA: number;             // Average DA of top 10 results
  clientDA: number;
  avgTop3Backlinks: number;       // Backlinks of top 3 results
  clientBacklinks: number;
  hasExistingPage: boolean;       // Do they have content for this?
  isYMYL: boolean;                // Health/finance/legal
}
```

**Logic:**
```typescript
function calculateFeasibility(inputs: FeasibilityInputs): FeasibilityResult {
  const MONTHLY_LINK_CAPACITY = 10;
  const CONTENT_CREATE_MONTHS = 2;
  const CONTENT_OPTIMIZE_MONTHS = 1;
  
  // DA gap analysis
  const daGap = inputs.avgTop10DA - inputs.clientDA;
  
  // Links needed
  const linksNeeded = Math.max(0, inputs.avgTop3Backlinks - inputs.clientBacklinks);
  const monthsForLinks = Math.ceil(linksNeeded / MONTHLY_LINK_CAPACITY);
  
  // Content timeline
  const contentMonths = inputs.hasExistingPage 
    ? CONTENT_OPTIMIZE_MONTHS 
    : CONTENT_CREATE_MONTHS;
  
  // Difficulty multiplier
  let difficultyMultiplier = 1;
  if (inputs.keywordDifficulty > 30) difficultyMultiplier = 1.5;
  if (inputs.keywordDifficulty > 50) difficultyMultiplier = 2;
  if (inputs.keywordDifficulty > 70) difficultyMultiplier = 3;
  if (inputs.keywordDifficulty > 85) return { feasible: false, reason: 'KD too high' };
  
  // YMYL penalty
  if (inputs.isYMYL && inputs.keywordDifficulty > 60) {
    return { feasible: false, reason: 'YMYL + high difficulty' };
  }
  
  // Calculate timeline
  const baseMonths = Math.max(monthsForLinks, contentMonths);
  const totalMonths = Math.ceil(baseMonths * difficultyMultiplier);
  
  // Determine effort level
  let effort: 'easy_win' | 'standard' | 'challenging' | 'major_project';
  if (inputs.keywordDifficulty <= 30 && daGap <= 10) effort = 'easy_win';
  else if (inputs.keywordDifficulty <= 50 && daGap <= 25) effort = 'standard';
  else if (inputs.keywordDifficulty <= 70) effort = 'challenging';
  else effort = 'major_project';
  
  // Traffic value (assuming €0.90 per visit for commercial keywords)
  const trafficValue = Math.round(inputs.searchVolume * 0.3 * 0.90); // 30% CTR estimate
  
  return {
    feasible: true,
    confidence: daGap < 20 ? 'high' : daGap < 35 ? 'medium' : 'low',
    timelineMonths: totalMonths,
    effort,
    trafficValue,
    requirements: {
      contentPieces: inputs.hasExistingPage ? 0 : 1,
      backlinksNeeded: linksNeeded,
      optimizeExisting: inputs.hasExistingPage,
    }
  };
}
```

**Output:**
```
┌─────────────────────────────────────────────────────────────┐
│ meistreliokampas.lt → "makita dalys"                        │
│                                                             │
│ ✓ FEASIBLE — High Confidence                                │
│                                                             │
│ Keyword: "makita dalys" (makita parts)                      │
│ Volume: 200/mo | Difficulty: 28 | Worth: €180/mo            │
│                                                             │
│ Timeline: Page 1 in 3-4 months                              │
│ Effort: Standard                                            │
│                                                             │
│ What we'd do:                                               │
│ • Create dedicated "Makita dalys" landing page              │
│ • Optimize existing /collections/makita                     │
│ • Build 15-20 local links over 3 months                     │
│                                                             │
│ Why you'll win:                                             │
│ Competitor aceraservisas.lt has DA 22 but thin content.     │
│ Your 25K product catalog gives you topical authority.       │
└─────────────────────────────────────────────────────────────┘
```

**Data Sources:**
- DataForSEO Keyword Data API (volume, difficulty)
- DataForSEO SERP API (top 10 results, their DA)
- DataForSEO Domain Overview (client DA, backlinks)
- Site search: `site:domain.com keyword` (check existing content)

---

## Analysis 3: Proposal Generator

**Trigger:** "Create proposal", "send proposal", "generate proposal for [domain]"

**Purpose:** Close the deal. Generate PDF-ready proposal from conversation.

### Input: Conversation Context

During chat, accumulate:
```typescript
interface ConversationContext {
  clientDomain: string;
  clientName?: string;
  keywords: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    feasibility: 'high' | 'medium' | 'low';
    timeline: number;
  }>;
  competitors: string[];
  painPoints: string[];        // What they said matters
  currentState: {
    da: number;
    traffic: number;
    issues: string[];
  };
  servicesDiscussed: string[];
  budgetSignals?: string;      // Any pricing discussion
}
```

### Output: Proposal Sections

```typescript
interface ProposalOutput {
  // Header
  clientDomain: string;
  generatedAt: string;
  
  // Executive Summary (2 paragraphs, uses their words)
  executiveSummary: string;
  
  // Opportunity (keywords + traffic value)
  keywords: Array<{
    keyword: string;
    volume: number;
    currentPosition: string;
    targetPosition: string;
    timelineMonths: number;
  }>;
  totalTrafficPotential: number;
  totalTrafficValue: number;
  
  // Competitive Edge (why they'll win)
  competitiveAdvantages: string[];
  
  // Scope of Work
  phases: Array<{
    name: string;
    months: string;
    deliverables: string[];
  }>;
  
  // Investment
  packages: Array<{
    name: string;
    price: string;
    includes: string[];
    recommended: boolean;
  }>;
  
  // Expected Outcomes
  projectedOutcomes: Array<{
    metric: string;
    current: string;
    projected: string;
    timeframe: string;
  }>;
  
  // Next Steps
  nextSteps: string[];
}
```

### Personalization Rules

1. **Use their domain name** throughout
2. **Use their exact keywords** from conversation
3. **Reference competitors** they mentioned
4. **Quote their stated goal**: "You mentioned wanting to rank for [X]..."
5. **Include specific findings**: "Your competitor [Name] has 40% more content"

### PDF Template

Clean, scannable layout:
- Agency logo + branding
- Client domain in header
- Clear sections with headers
- Tables for keywords and pricing
- Call-to-action at end

### Delivery Options

```typescript
interface ProposalDelivery {
  pdf: {
    download: () => Promise<Blob>;
    url: string;  // Temporary signed URL
  };
  email: {
    send: (to: string) => Promise<void>;
    preview: string;  // HTML preview
  };
  edit: {
    url: string;  // Link to editable version
  };
}
```

---

## File Structure

```
apps/web/src/app/api/seo-chat/
├── route.ts                    # SSE endpoint
├── types.ts                    # All types
├── context-accumulator.ts      # Build conversation context
├── analyses/
│   ├── domain-health.ts        # Analysis 1
│   ├── keyword-feasibility.ts  # Analysis 2
│   └── proposal-generator.ts   # Analysis 3
└── proposal/
    ├── template.tsx            # React PDF template
    ├── sections.ts             # Section generators
    └── pdf-export.ts           # PDF generation

apps/web/src/components/seo-chat/
├── ChatProvider.tsx
├── ChatInput.tsx
├── ChatMessage.tsx
├── AnalysisCard.tsx            # Renders analysis results
├── ProposalPreview.tsx
└── ProposalActions.tsx         # Download/Email/Edit buttons
```

---

## Implementation Phases

### Week 1: Core
- [ ] Domain Health Check analysis
- [ ] Keyword Feasibility analysis (with calculation logic)
- [ ] Basic chat UI with SSE streaming
- [ ] Wire tenant isolation to endpoints

### Week 2: Proposals
- [ ] Conversation context accumulator
- [ ] Proposal generator logic
- [ ] PDF template (React-PDF or similar)
- [ ] Download + email delivery

### Week 3: Polish
- [ ] Personalization (use conversation data)
- [ ] Multiple keywords in one feasibility check
- [ ] Quick wins extraction from domain health
- [ ] Error handling + loading states
- [ ] E2E testing

---

## What We're NOT Building

| Feature | Why Not |
|---------|---------|
| Competitor deep dive | One line in feasibility is enough |
| Backlink analysis | Implementation detail, not sales |
| Technical audit (109 checks) | Too detailed for sales calls |
| Content gap analysis | Tactical, not sales-focused |
| SERP deep dive | Too nerdy for prospects |
| Full keyword research | Post-close work |
| Monthly reports | Not needed for sales |
| GEO/AI Overviews | Future phase |
| Video/voice input | Future phase |
| Autonomous monitoring | Not requested |

---

## Success Criteria

1. **Speed:** Domain health in <3s, feasibility in <5s, proposal in <8s
2. **Accuracy:** Feasibility predictions match reality (track over time)
3. **Closes deals:** Proposals lead to signed contracts
4. **Easy to use:** Sales team can use during live calls without training

---

## Example Sales Call

```
SALES REP: [opens chat, types domain]
"meistreliokampas.lt"

SYSTEM: [2 sec - Domain Health]
DA 15 | 2,400 pages | 500 visits/mo
✓ Good foundation, 8 quick win keywords

PROSPECT: "Can you rank us for makita dalys?"

SALES REP: [types]
"Can meistreliokampas.lt rank for makita dalys"

SYSTEM: [4 sec - Keyword Feasibility]
✓ FEASIBLE — High Confidence
Timeline: 3-4 months | Worth: €180/mo
What we'd do: Landing page + 15 links

PROSPECT: "What would this cost?"

SALES REP: [types]
"Create proposal"

SYSTEM: [6 sec - Proposal Generator]
📄 Proposal ready
[Download PDF] [Email to Prospect]

SALES REP: "I'll send this over right now."

DEAL CLOSED.
```
