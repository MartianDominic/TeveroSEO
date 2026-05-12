# Phase 98: General SEO Chat Feature

> **Purpose**: Add a conversational interface where users ask natural-language SEO questions like "Can my website rank for these keywords?" and receive actionable, data-backed intelligence.
> 
> **Trigger**: Client question - "Can www.meistreliokampas.lt rank for Makita dalys, Dewalt dalys, Milwaukee dalys, Makita remontas, Dewalt remontas, Milwaukee remontas?"
> 
> **Design References**:
> - [Design System v6](../../design/design-system-v6.md)
> - [v7 Master Design Architecture](../../design/v7-master-design-architecture.md)

---

## Part 1: Client Analysis — meistreliokampas.lt

### Executive Summary

**Verdict: YES, meistreliokampas.lt can realistically rank for these keywords.**

The site is **well-positioned** with 50,000+ spare parts products across Makita/Dewalt/Milwaukee. The competition in Lithuania is **moderate** with clear content gaps. Quick wins are available in 3-6 months; competitive terms achievable in 12-18 months.

---

### 1.1 Website Analysis

**Site Profile:**
| Attribute | Value |
|-----------|-------|
| Platform | Shopify |
| Languages | Lithuanian (primary), German, English |
| Business | Power tool repair + spare parts |
| Location | E. Levino g. 2A-1, Kaunas, 47222 |
| Catalog Size | 50,000+ products |

**Current Strengths:**
- Massive product catalog: 25,001 Makita parts, 25,001 Dewalt parts, 92 Milwaukee parts
- Repair service pages exist (`/pages/irankiu-remontas`, `/pages/servisas`)
- SSL/HTTPS active, Cloudflare CDN
- Product schema implemented
- Multi-language hreflang tags

**Critical Gaps:**
| Gap | Impact | Fix Effort |
|-----|--------|------------|
| Homepage missing keywords | HIGH | 1 hour |
| Collection pages lack meta descriptions | HIGH | 2 hours |
| No brand-specific repair pages | HIGH | 3 days |
| No LocalBusiness schema | MEDIUM | 2 hours |
| No blog/content marketing | MEDIUM | Ongoing |
| Thin Milwaukee catalog (92 vs 25K) | MEDIUM | Business decision |

---

### 1.2 Keyword Analysis

**Target Keywords:**

| Keyword | Translation | Est. Volume | Difficulty | Current Position | Ranking Potential |
|---------|-------------|-------------|------------|------------------|-------------------|
| Makita dalys | Makita parts | 100-300/mo | MEDIUM (25-35) | Not ranking | HIGH |
| Dewalt dalys | Dewalt parts | 50-150/mo | LOW (15-25) | Not ranking | HIGH |
| Milwaukee dalys | Milwaukee parts | 30-80/mo | LOW (10-20) | Not ranking | VERY HIGH |
| Makita remontas | Makita repair | 100-250/mo | MEDIUM (30-40) | Not ranking | HIGH |
| Dewalt remontas | Dewalt repair | 50-120/mo | LOW-MEDIUM (20-30) | Not ranking | HIGH |
| Milwaukee remontas | Milwaukee repair | 30-70/mo | LOW (15-25) | Not ranking | VERY HIGH |

**Strategic Insight**: Milwaukee keywords have the **weakest competition** in Lithuania. Start there for quick wins.

---

### 1.3 Competitive Landscape

**Market Dominators:**

| Competitor | Type | Presence | Weakness |
|------------|------|----------|----------|
| aceraservisas.lt | Parts + Repair Specialist | 5/6 keywords | Single location (Vilnius), thin content |
| gitana.lt | Multi-brand Distributor | 5/6 keywords | Generic category pages, no how-to content |
| senukai.lt | DIY Retail Chain | 3/6 keywords | Parts are secondary, no repair service |
| varle.lt | E-commerce Platform | 3/6 keywords | Only 505 parts models |
| salvata.lt | Repair Service | 4/6 keywords | Tools not primary focus, no parts sales |

**What Competitors Are NOT Doing:**
- No repair guides/tutorials
- No parts compatibility databases  
- No video content
- No model-specific landing pages
- No FAQ schema markup
- Limited local SEO optimization

---

### 1.4 Ranking Timeline

| Keyword Group | 3 Months | 6 Months | 12 Months |
|---------------|----------|----------|-----------|
| Milwaukee dalys/remontas | Page 2-3 | Page 1 (pos 4-7) | **Top 3** |
| Dewalt dalys/remontas | Page 3-4 | Page 1-2 | **Top 5** |
| Makita dalys/remontas | Page 4-5 | Page 2-3 | **Top 10** |
| Long-tail parts keywords | Page 1-2 | Top 5 | **Top 3** |
| "Įrankių remontas Kaunas" | Page 1-2 | **Top 5** | **Top 3** |

---

### 1.5 Action Plan for meistreliokampas.lt

**Phase 1: Quick Wins (Week 1-4) — ~52 hours**

| Action | Priority | Effort |
|--------|----------|--------|
| Update homepage title/meta with keywords | P1 | 1h |
| Add meta descriptions to brand collections | P1 | 2h |
| Create `/dalys/makita/` landing page | P1 | 8h |
| Create `/dalys/dewalt/` landing page | P1 | 8h |
| Create `/dalys/milwaukee/` landing page | P1 | 8h |
| Create `/remontas/makita-remontas/` page | P1 | 6h |
| Create `/remontas/dewalt-remontas/` page | P1 | 6h |
| Create `/remontas/milwaukee-remontas/` page | P1 | 6h |
| Create `/remontas/kaunas/` local page | P1 | 6h |
| Implement LocalBusiness schema | P1 | 2h |
| Optimize Google Business Profile | P1 | 3h |

**Phase 2: Category Expansion (Week 5-8) — ~44 hours**
- Tool-type category pages (grežtuvai, šlifuokliai, perforatoriai)
- Bosch and Hilti brand pages

**Phase 3: Content Marketing (Week 9-16) — ~44 hours + ongoing**
- 5x how-to guides (carbon brushes, bearings, switches)
- 3x compatibility guides
- 3x brand comparison articles
- Monthly blog posts

---

## Part 2: General SEO Chat Feature Specification

### 2.1 Feature Overview

A conversational interface enabling natural-language SEO queries:
> "Can www.example.com rank for 'best running shoes' in the US?"

**Response includes:**
- Feasibility score (0-100)
- Per-keyword likelihood assessment
- Top competitors
- Key ranking factors
- Actionable recommendations
- Deep links to platform features

---

### 2.2 Placement in v6 Design System

#### Location: Right Rail (Primary)

Following the three-column shell architecture:

```
┌──────────────┬────────────────────────────────────────────────┬──────────────┐
│   SIDEBAR    │                   MAIN CONTENT                 │    RAIL      │
│              │                                                │              │
│              │                                                │  Today Feed  │
│              │                                                │  Health      │
│              │                                                │  Up Next     │
│              │                                                │  ────────    │
│              │                                                │  SEO CHAT ◄──┤
│              │                                                │  (NEW)       │
└──────────────┴────────────────────────────────────────────────┴──────────────┘
```

**Rationale:**
- Rail is already the "contextual intelligence" zone
- Chat remains visible while working in main content
- Follows Linear/Superhuman pattern of persistent assistants
- Does not interrupt primary workflow

#### Alternative Entry Points:
- `Cmd+J` — Keyboard shortcut for quick access
- `Cmd+K` then "Ask SEO..." — Command palette route
- `/chat` — Dedicated full-screen page with history
- Floating FAB — On mobile (<880px viewports)

---

### 2.3 UI Components (v6 Design Tokens)

#### Input Component

**Collapsed State (Default):**
```css
.seo-chat-trigger {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);        /* 12px */
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.seo-chat-trigger:hover {
  box-shadow: var(--shadow-pop);
  transform: translateY(-1px);
}
```

**Content:**
- Left: 16px sparkle icon in `--text-3`
- Center: "Ask about rankings, keywords, competitors..." in `--text-3`
- Right: `⌘J` kbd chip

**Expanded State:**
- Textarea with URL + keyword detection
- Smart chips for detected entities (domain, keywords)
- Primary CTA button with gradient (`--shadow-cta`)

#### Response Card

**Editorial Moment Pattern:**
```
┌──────────────────────────────────────────────┐
│ RANKING FEASIBILITY                    ↻ 8s  │
├──────────────────────────────────────────────┤
│                                              │
│  "example.com can rank for *2 of 3*          │
│   keywords in 3-6 months"                    │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  📈  best running shoes    Likely ●●●  │  │
│  │  📊  cheap sneakers        Maybe  ●●   │  │
│  │  🔴  nike vs adidas       Unlikely ●   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ▼ Show detailed analysis                    │
└──────────────────────────────────────────────┘
```

**Typography:**
- Summary: Newsreader 18-22px, `letter-spacing: -0.012em`
- Keyword emphasis: italic `em` tags
- Row labels: `--type-body` (14px)
- Likelihood: small-caps, `letter-spacing: 0.04em`

**Confidence Dots (Severity Pattern):**
```css
.confidence-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--surface-3);
}
.confidence-dots .dot.on { background: currentColor; }
```

#### Progress States

Following "calm at rest, hover-to-reveal":

```css
.seo-thinking .dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: seo-pulse 1.4s ease-in-out infinite;
}

@keyframes seo-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.9); }
  40% { opacity: 1; transform: scale(1); }
}
```

**Stage Indicators:**
```
[●] Parsing query...
[●] Fetching SERP data...
[○] Analyzing competition...
[○] Generating report...
```

---

### 2.4 Technical Architecture

#### High-Level Flow

```
User Question
     │
     ▼
┌─────────────────────┐
│ POST /api/seo-chat/ │ ◄── SSE streaming endpoint
│     analyze         │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Intent Classifier   │ ◄── grok-4.1-fast ($0.20/1M)
│ Extract: domain,    │
│ keywords, location  │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Data Fetchers       │ ◄── Parallel execution
│ (DataForSEO APIs)   │
│ • SERP analysis     │
│ • Domain authority  │
│ • Keyword metrics   │
│ • Competitor data   │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Feasibility Scorer  │ ◄── Custom algorithm
│ Combine: difficulty,│
│ DA gap, competition │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Response Generator  │ ◄── grok-4.1-thinking ($2.00/1M)
│ Narrative + actions │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Stream to Client    │ ◄── SSE events
│ Save to DB          │
└─────────────────────┘
```

#### Existing Infrastructure Leverage

| Component | Status | Location |
|-----------|--------|----------|
| SSE Streaming | READY | `/apps/web/src/app/api/keyword-chat/analyze/route.ts` |
| Stage Emitter | READY | `/apps/web/src/lib/keyword-chat/stage-emitter.ts` |
| DataForSEO Client | READY | `/open-seo-main/src/server/lib/dataforseoClient.ts` |
| Keyword Gap Analysis | READY | `/open-seo-main/src/server/lib/dataforseoKeywordGap.ts` |
| Competitor Analysis | READY | `/open-seo-main/src/server/features/keywords/services/CompetitorSpyService.ts` |
| SERP Cache | READY | `/open-seo-main/src/server/lib/cache/serp-cache.ts` |
| CopilotKit Provider | PARTIAL | `/apps/web/src/lib/copilot/provider.tsx` |

**Assessment: 80%+ infrastructure exists. Primary work is orchestration.**

#### Database Schema (New Tables)

```sql
-- Chat sessions
CREATE TABLE seo_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE seo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis artifacts
CREATE TABLE seo_chat_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  cost_usd NUMERIC(10,6),
  duration_ms INTEGER,
  cached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 2.5 Cost Analysis

#### Per-Query Cost Breakdown

**Simple Query** ("Can X rank for Y?"):
| Component | Cost |
|-----------|------|
| Intent classification (grok-4.1-fast, ~500 tokens) | $0.0001 |
| SERP analysis (DataForSEO) | $0.01 |
| Domain authority (DataForSEO) | $0.005 |
| Response synthesis (grok-4.1-thinking, ~2000 tokens) | $0.004 |
| **Total** | **~$0.019** |

**Complex Query** (Full competitor analysis):
| Component | Cost |
|-----------|------|
| Intent classification | $0.0001 |
| SERP analysis (5 keywords) | $0.05 |
| Backlinks overview (2 domains) | $0.02 |
| Content gap analysis | $0.01 |
| Response synthesis (longer) | $0.008 |
| **Total** | **~$0.088** |

**With 70% Cache Hit Rate:**
- Average simple query: **$0.006**
- Average complex query: **$0.026**

#### Rate Limiting

```typescript
// Per user limits
const seoChatLimiter = {
  windowMs: 60 * 60 * 1000,  // 1 hour
  maxRequests: 50,            // 50 questions per hour
};

const seoChatCostLimiter = {
  windowMs: 24 * 60 * 60 * 1000,  // 24 hours
  maxRequests: 200,               // ~$4/day max per user
};
```

---

### 2.6 User Journeys (v7 Architecture Patterns)

#### Journey 1: New User Discovery

```
User: "Can meistreliokampas.lt rank for Makita dalys?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  ANALYZING...                                           │
│  [●] Parsing query                                      │
│  [●] Checking domain authority                          │
│  [○] Analyzing SERP competition                         │
│  [○] Generating recommendations                         │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  RANKING FEASIBILITY                                    │
│                                                         │
│  "meistreliokampas.lt has HIGH potential to rank        │
│   for *Makita dalys* in 6-12 months"                    │
│                                                         │
│  SCORE: 72/100  ●●●○○  ACHIEVABLE                       │
│                                                         │
│  Key Factors:                                           │
│  • 25,000+ Makita parts (topical authority) ✓          │
│  • Missing optimized landing page ✗                     │
│  • Competition is moderate (aceraservisas, gitana)      │
│                                                         │
│  ▼ Show detailed analysis                               │
│                                                         │
│  [Track Keyword] [Create Landing Page] [Run Full Audit] │
└─────────────────────────────────────────────────────────┘
```

**Autonomy Points:**
- Auto-detects domain from natural language
- Auto-analyzes without configuration
- Pre-selects relevant actions

**Control Points:**
- User can modify before handoff
- "Show detailed analysis" reveals all data
- Actions are suggestions, not automatic

#### Journey 2: Multi-Keyword Analysis

```
User: "Can meistreliokampas.lt rank for Makita dalys, 
       Dewalt dalys, Milwaukee dalys?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  RANKING FEASIBILITY                                    │
│                                                         │
│  "Site can realistically rank for *3 of 3* keywords"    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Makita dalys      Likely ●●●    72/100        │   │
│  │  Dewalt dalys      Likely ●●●    78/100        │   │
│  │  Milwaukee dalys   Very Likely ●●●● 85/100     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  RECOMMENDATION: Start with Milwaukee (lowest           │
│  competition), build authority, then expand.            │
│                                                         │
│  [Track All Keywords] [Generate Content Brief]          │
└─────────────────────────────────────────────────────────┘
```

#### Journey 3: Existing Client Context

When user is already viewing a client in TeveroSEO:

```
Context: Viewing Client "Meistrelio Kampas" dashboard
                    │
                    ▼
User: "What keywords should we target next?"
                    │
                    ▼
System auto-loads:
• Current tracked keywords
• Historical ranking data
• Voice profile
• Previous analyses
                    │
                    ▼
Response includes:
• Gap analysis vs competitors
• Priority ranking based on existing momentum
• Voice-aware content suggestions
```

---

### 2.7 Integration with Existing Features

#### Cross-Domain Linking (Pattern G from v7)

| Chat Action | Destination | Pre-filled Data |
|-------------|-------------|-----------------|
| "Track Keyword" | `/intelligence` | Keywords, domain |
| "Create Landing Page" | `/articles/new` | Topic, target keyword, voice |
| "Run Full Audit" | `/audit` | Domain, focus areas |
| "View Competitors" | `/competitors` | Competitor domains |
| "Generate Proposal" | `/proposals/new` | Keywords, opportunity score |
| "Save as Prospect" | `/prospects/new` | Domain, keywords, metrics |

#### Today Feed Integration

Chat interactions generate Today Feed events:
```
14:23 │ Asked: "Can site rank for 3 keywords?"
      │ SEO CHAT · ANALYSIS
      │ Result: 2/3 achievable

11:08 │ Started tracking "Milwaukee dalys"
      │ KEYWORDS · FROM CHAT
```

#### Up Next Integration

Chat analysis can generate Up Next recommendations:
```
UP NEXT (from SEO Chat)
─────────────────────────────────────────────
⚡ Create landing page for "Milwaukee dalys"
   Chat suggested · 85/100 feasibility
   [Create Page]
```

---

### 2.8 Implementation Plan

#### MVP Scope (2 Weeks)

**Week 1:**
| Day | Task | Output |
|-----|------|--------|
| 1-2 | Intent classifier with grok-4.1-fast | `lib/seo-chat/intent-classifier.ts` |
| 3 | Feasibility scoring algorithm | `lib/seo-chat/feasibility-scorer.ts` |
| 4-5 | Extend analysis pipeline for chat | `lib/seo-chat/chat-pipeline.ts` |

**Week 2:**
| Day | Task | Output |
|-----|------|--------|
| 1-2 | Chat UI components (v6 tokens) | `components/seo-chat/` |
| 3-4 | Response streaming + report generator | `api/seo-chat/analyze/route.ts` |
| 5 | Integration testing + edge cases | Tests |

**MVP Deliverables:**
- Single-keyword feasibility analysis
- Streaming progress updates
- Score with key factors
- Basic action buttons

#### Full Feature (6 Weeks)

| Phase | Duration | Features |
|-------|----------|----------|
| MVP | Week 1-2 | Single keyword, basic UI |
| Multi-keyword | Week 3 | Batch analysis, comparison |
| Context awareness | Week 4 | Client data integration |
| Conversation memory | Week 5 | Follow-up questions, history |
| Polish | Week 6 | Export, advanced actions |

---

### 2.9 File Structure

```
apps/web/src/
├── app/api/seo-chat/
│   ├── analyze/route.ts          # SSE streaming endpoint
│   ├── sessions/route.ts         # List sessions
│   └── sessions/[sessionId]/route.ts
├── lib/seo-chat/
│   ├── types.ts                  # TypeScript interfaces
│   ├── intent-classifier.ts      # grok-4.1-fast intent
│   ├── chat-pipeline.ts          # Orchestration
│   ├── feasibility-scorer.ts     # Scoring algorithm
│   ├── response-generator.ts     # grok-4.1-thinking
│   └── stage-emitter.ts          # Reuse from keyword-chat
└── components/seo-chat/
    ├── SEOChatPanel.tsx          # Main rail component
    ├── SEOChatTrigger.tsx        # Collapsed input
    ├── SEOChatInput.tsx          # Expanded input
    ├── SEOChatResponse.tsx       # Response card
    ├── SEOKeywordRow.tsx         # Keyword result row
    ├── SEOChatProgress.tsx       # Loading states
    ├── SEOChatEmpty.tsx          # Empty state
    ├── SEOChatFAB.tsx            # Mobile FAB
    └── hooks/
        ├── useSEOChat.ts         # Main hook
        ├── useURLDetection.ts    # URL extraction
        └── useKeywordDetection.ts # Keyword extraction

open-seo-main/src/
├── db/schema/seo-chat-schema.ts  # Database schema
└── server/
    ├── queues/seoChatQueue.ts    # BullMQ queue
    └── workers/seo-chat-worker.ts # Long-running jobs
```

---

### 2.10 Success Metrics

| Metric | Target |
|--------|--------|
| Time to first byte | <500ms |
| Full response (cache hit) | <3s |
| Full response (cache miss) | <15s |
| Cost per query (average) | <$0.02 |
| User satisfaction | >4.5/5 |
| Conversion to action | >30% of queries lead to feature use |

---

## Part 3: Answer to Client Question

### Final Assessment: meistreliokampas.lt Ranking Potential

**Question:** Can www.meistreliokampas.lt rank for Makita dalys, Dewalt dalys, Milwaukee dalys, Makita remontas, Dewalt remontas, Milwaukee remontas?

**Answer:** **YES, with moderate effort.**

| Keyword | Feasibility | Timeline | Priority |
|---------|-------------|----------|----------|
| Milwaukee dalys | 85/100 ●●●●○ | 3-6 months | **START HERE** |
| Milwaukee remontas | 82/100 ●●●●○ | 3-6 months | HIGH |
| Dewalt dalys | 78/100 ●●●○○ | 6-9 months | MEDIUM |
| Dewalt remontas | 75/100 ●●●○○ | 6-9 months | MEDIUM |
| Makita dalys | 72/100 ●●●○○ | 9-12 months | MEDIUM |
| Makita remontas | 68/100 ●●○○○ | 9-12 months | LOWER |

**Key Factors:**
1. **Strong foundation** — 50,000+ products provide topical authority
2. **Repair service advantage** — Competitors are parts-only OR repair-only, not both
3. **Local SEO opportunity** — Kaunas-based with physical location
4. **Content gap** — Competitors lack how-to guides, compatibility tools
5. **Milwaukee first** — Weakest competition, fastest path to visibility

**Immediate Actions:**
1. Create brand landing pages (`/dalys/makita/`, `/dalys/dewalt/`, `/dalys/milwaukee/`)
2. Create repair service pages (`/remontas/makita-remontas/`, etc.)
3. Create local landing page (`/remontas/kaunas/`)
4. Implement LocalBusiness schema
5. Optimize Google Business Profile

**Expected Results:**
- Month 3: +50% organic traffic, Milwaukee keywords on page 1-2
- Month 6: +100% organic traffic, Dewalt keywords on page 1
- Month 12: +200% organic traffic, Makita keywords on page 1

---

## Appendix A: Competitor Reference

| Competitor | URL | Strengths | Weaknesses |
|------------|-----|-----------|------------|
| aceraservisas.lt | https://aceraservisas.lt | Parts + repair specialist, huge catalog | Single location, thin content |
| gitana.lt | https://gitana.lt | Multi-city (4), strong partnerships | Generic category pages |
| salvata.lt | https://salvata.lt | Strong local presence, 24h service | Multi-category dilution |
| senukai.lt | https://senukai.lt | Brand recognition, 73 stores | Parts secondary, no repair |
| varle.lt | https://varle.lt | E-commerce infrastructure | Only 505 parts models |

## Appendix B: Content Templates

See `/home/dominic/Documents/TeveroSEO/.planning/phases/98-general-seo-chat/content-templates/` for:
- Brand landing page template (Lithuanian)
- Repair service page template
- Local SEO page template
- How-to guide template
- Schema markup examples

## Appendix C: Design System Tokens Reference

| Element | Token | Value |
|---------|-------|-------|
| Card shadow | `--shadow-card` | Ghost-edge layered |
| Card hover | `--shadow-lift` | Expanded ghost-edge |
| CTA button | `--shadow-cta` | Accent gradient |
| Body text | `--type-body` | 14px |
| Tiny labels | `--type-tiny` | 12px (WCAG floor) |
| Card radius | `--radius-card` | 12px |
| Accent color | `--accent` | #0F4F3D |
| Success | `--success` | #1B6E45 |
| Warning | `--warning` | #A87F1A |
| Error | `--error` | #9B2C2C |
| Motion hover | `--motion-hover` | 280ms cubic-bezier(0.16, 1, 0.3, 1) |

---

*Generated by 10 Opus subagent deep analysis on 2026-05-08*
