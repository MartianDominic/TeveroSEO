# General SEO Chat: User Journey Map

> **Purpose**: Map all user journeys for a conversational SEO assistant that serves new users, existing clients, and prospect analysis scenarios
> **Design Reference**: [v7-master-design-architecture.md](./v7-master-design-architecture.md)
> **Design System**: [design-system-v6.md](./design-system-v6.md)
> **Date**: 2026-05-08

---

## Executive Summary

The General SEO Chat is a conversational interface that handles open-ended SEO questions while intelligently routing users toward TeveroSEO features. It must balance the **Autonomy vs Control tension** from v7: automatically fetching data and making recommendations, while keeping the user in control of decisions.

**Key Principle**: The chat is not a standalone feature — it's a **discovery and routing layer** that connects to every domain in the platform.

---

## The Core Tension Applied to Chat

From [v7-master-design-architecture.md](./v7-master-design-architecture.md):

| Principle | Autonomy Implication | Control Implication |
|-----------|---------------------|---------------------|
| **One editorial moment** | Chat surfaces THE answer (can this rank?) | User can drill into evidence |
| **Calm at rest, depth on demand** | Quick assessment visible | Detailed analysis on request |
| **Cards as glass, not paper** | Results feel premium, not "chat bot" | Interactive, clickable outputs |
| **Numbers want air** | Key metrics prominent | Supporting data discoverable |
| **Everything fluid** | Works on any screen | Same quality mobile/desktop |

---

## Chat Entry Points

The chat can be invoked from multiple locations, each with different context:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHAT ENTRY POINTS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GLOBAL                    CLIENT CONTEXT           PROSPECT CONTEXT        │
│  ───────                   ──────────────           ────────────────        │
│                                                                             │
│  • Cmd+K → "Chat"          • Client Dashboard       • Prospect Page         │
│  • Header "?" icon           Rail Panel             • Proposal Builder      │
│  • Right Rail FAB          • /seo/[clientId]/chat   • /prospects/[id]/chat  │
│  • /chat (standalone)      • Audit Results Page     • Quick Check           │
│  • Mobile Bottom Sheet     • Keyword Intelligence   • Competitor Spy        │
│                                                                             │
│  Context: None             Context: Client data     Context: Prospect data  │
│                            Voice profile            Domain                  │
│                            Historical audits        Initial analysis        │
│                            GSC data                 Competitor data         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Journey 1: New User Discovery

**Scenario**: User asks "Can my site rank for these keywords?"

### 1.1 Entry Point Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │   "Can my site rank for these keywords?"                          │     │
│   │                                                                   │     │
│   │   [ marathon training   running shoes   best 5k programs ]       │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   WHAT WE DETECT                     WHAT WE NEED                          │
│   ────────────────                   ─────────────                          │
│   • Keywords provided (3)            • Domain to analyze                    │
│   • Intent: feasibility check        • Business type (optional)             │
│   • No client context                • Geographic target (optional)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Information Gathering (Progressive Disclosure)

The chat gathers missing information conversationally, not via forms:

```
PHASE 1: Domain Collection
───────────────────────────────────────────────────────────────────────────────

  CHAT                                USER INPUT
  ────                                ──────────

  "I can help you understand your     
  ranking potential for those          
  keywords. What's your website?"     →  "myrunningblog.com"

  [SYSTEM: Auto-detect domain type, check if already in system]

───────────────────────────────────────────────────────────────────────────────

PHASE 2: Contextual Clarification (only if needed)
───────────────────────────────────────────────────────────────────────────────

  IF unclear business type:

  "Is myrunningblog.com focused on:
   
   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
   │ E-commerce      │  │ Blog/Content    │  │ Local Service   │
   │ (selling gear)  │  │ (articles)      │  │ (coaching)      │
   └─────────────────┘  └─────────────────┘  └─────────────────┘"
   
                                       →  User clicks "Blog/Content"

  IF geographic ambiguity:

  "Are you targeting runners in:
   
   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
   │ United States   │  │ United Kingdom  │  │ Global          │
   └─────────────────┘  └─────────────────┘  └─────────────────┘"

───────────────────────────────────────────────────────────────────────────────
```

**Trust-Building Element**: Show system is working, not just waiting.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Analyzing myrunningblog.com...                                            │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │ ✓ Domain authority pulled        │ ○ Checking keyword difficulty │     │
│   │ ✓ Current rankings found (12)    │ ○ Analyzing SERP competition  │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   Estimated time: 15 seconds                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 The Answer (Editorial Moment)

Following v6 pattern: **One big serif numeral as THE answer**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   YOUR RANKING POTENTIAL                                                    │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │                          2 of 3                                   │     │
│   │                         ─────────                                 │     │
│   │                    KEYWORDS RANKABLE                              │     │
│   │                      within 6 months                              │     │
│   │                                                                   │     │
│   │    ────────────────────────────────────────────────────────       │     │
│   │                                                                   │     │
│   │    ✓ marathon training     Position 11-20 likely    Quick Win    │     │
│   │    ✓ best 5k programs      Position 6-15 likely     Achievable   │     │
│   │    ✗ running shoes         Position 50+ likely      Hard         │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   WHY THIS ASSESSMENT                                                       │
│   ───────────────────                                                       │
│   Your domain authority (DA 28) and existing topical coverage give you      │
│   a strong foundation for informational keywords. "Running shoes" is        │
│   dominated by e-commerce giants (Amazon, Nike, REI at DA 90+).             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Actions Available (Cross-Links)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   WHAT WOULD YOU LIKE TO DO?                                                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   ⚡ Create Content                                                 │   │
│   │      Write an article targeting "marathon training"                 │   │
│   │      [Go to Article Generator →]                                    │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   🔍 Run Full Audit                                                 │   │
│   │      Discover all technical SEO issues on myrunningblog.com         │   │
│   │      [Start Audit →]                                                │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   📊 Track These Keywords                                           │   │
│   │      Monitor rankings and get alerts on position changes            │   │
│   │      [Add to Intelligence →]                                        │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   💼 Save as Prospect                                               │   │
│   │      Add myrunningblog.com as a potential client                    │   │
│   │      [Create Prospect →]                                            │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   Or ask me anything else about SEO...                                      │
│                                                                             │
│   [ Type your question...                                           ] [→]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.5 Trust-Building Elements

| Element | Location | Purpose |
|---------|----------|---------|
| **Progress indicator** | During analysis | Show system is working |
| **Source attribution** | Under metrics | "Data from DataForSEO, updated today" |
| **Confidence level** | Assessment card | "Based on 500+ similar keyword analyses" |
| **Override option** | Collapsed | "Disagree? Tell me more about your niche" |

---

## Journey 2: Existing Client Query

**Scenario**: Client asks about their managed site

### 2.1 Context Detection

When chat is opened within a client context, the system has:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   AVAILABLE CONTEXT (auto-loaded)                                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   CLIENT: Acme Running Co.                                          │   │
│   │   Domain: acmerunning.com                                           │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   HISTORICAL DATA                                                   │   │
│   │   • 6 audits (last: 3 days ago)                                     │   │
│   │   • 127 tracked keywords                                            │   │
│   │   • 23 articles generated                                           │   │
│   │   • Voice profile: Complete (40/40 fields)                          │   │
│   │   • GSC: Connected (synced 2h ago)                                  │   │
│   │                                                                     │   │
│   │   CURRENT STATE                                                     │   │
│   │   • Goal progress: 12/20 (60%)                                      │   │
│   │   • Health score: 84                                                │   │
│   │   • 3 keywords in striking distance                                 │   │
│   │   • 2 keywords dropped this week                                    │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Query Examples with Smart Routing

```
USER: "Why did our rankings drop?"
───────────────────────────────────────────────────────────────────────────────

SYSTEM DETECTS:
• Query type: Ranking investigation
• Available data: GSC, audits, keyword tracking
• Relevant period: Last 7 days (from context)

RESPONSE:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   RANKING CHANGES THIS WEEK                                                 │
│                                                                             │
│   2 keywords dropped                                                        │
│   ─────────────────────                                                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ "marathon training schedule"                                        │   │
│   │ Position #8 → #14 (↓6)                                              │   │
│   │                                                                     │   │
│   │ LIKELY CAUSES                                                       │   │
│   │ ────────────                                                        │   │
│   │ ● New competitor article published (competitor.com, May 5)          │   │
│   │ ○ Page load speed increased (3.2s → 4.1s)                          │   │
│   │ ○ Backlink lost (blogroll removal detected)                         │   │
│   │                                                                     │   │
│   │ [View Page Details] [Compare to Competitor] [See Audit Findings]   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ "best running shoes 2026"                                           │   │
│   │ Position #12 → #18 (↓6)                                             │   │
│   │                                                                     │   │
│   │ LIKELY CAUSES                                                       │   │
│   │ ────────────                                                        │   │
│   │ ● Content freshness (article from Jan 2026, competitors updated)    │   │
│   │ ● Missing product schema (competitor pages have rich snippets)      │   │
│   │                                                                     │   │
│   │ [Refresh Article] [Add Schema] [View SERP Analysis]                │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Would you like me to create a content refresh plan for both pages?        │
│                                                                             │
│   [Yes, create plan] [Just the first one] [I'll handle it manually]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

CROSS-LINKS:
• "View Page Details" → /clients/[id]/seo/pages/[pageId]
• "Compare to Competitor" → /clients/[id]/intelligence/competitor-analysis
• "See Audit Findings" → /clients/[id]/seo/audit (filtered to page)
• "Refresh Article" → /clients/[id]/content/articles/[id]/refresh
• "Add Schema" → /clients/[id]/seo/audit (schema finding)
```

### 2.3 Historical Context Display

```
USER: "How have we improved since we started?"
───────────────────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   YOUR SEO JOURNEY                                                          │
│   Client since: January 2026 (4 months)                                     │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │                         +127%                                     │     │
│   │                        ─────────                                  │     │
│   │                   ORGANIC TRAFFIC                                 │     │
│   │                     Jan → May 2026                                │     │
│   │                                                                   │     │
│   │    ══════════════════════════════════════════════════════════     │     │
│   │    │                                              ●────●         │     │
│   │    │                              ●────●                         │     │
│   │    │              ●────●                                         │     │
│   │    │    ●────●                                                   │     │
│   │    └────────────────────────────────────────────────────────     │     │
│   │         Jan     Feb     Mar     Apr     May                       │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   KEY MILESTONES                                                            │
│   ──────────────                                                            │
│   • Jan 15: First audit (score 52 → now 84)                                 │
│   • Feb 8: "marathon training" hit page 1                                   │
│   • Mar 22: 10,000 organic visits milestone                                 │
│   • Apr 5: Featured snippet won for "5k training plan"                      │
│   • May 1: Goal checkpoint: 12/20 keywords in top 10                        │
│                                                                             │
│   [View Full Report] [Generate Client Report] [Share Progress]              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Voice-Aware Responses

When client has a voice profile, chat responses adapt:

```
USER: "Can you write an intro for an article about interval training?"
───────────────────────────────────────────────────────────────────────────────

SYSTEM CHECKS:
• Voice profile exists: Yes (Acme Running Co.)
• Tone: Encouraging, expert but accessible
• Perspective: First-person plural ("we")
• Vocabulary: Avoids jargon, explains technical terms

RESPONSE:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   DRAFT INTRO (in Acme Running Co. voice)                                   │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │   We've all been there — running the same route at the same       │     │
│   │   pace, wondering why our times aren't improving. The secret      │     │
│   │   that transformed our training? Interval training.               │     │
│   │                                                                   │     │
│   │   Don't worry if the term sounds intimidating. At its core,       │     │
│   │   interval training is simply alternating between faster and      │     │
│   │   slower running. And we're going to show you exactly how to      │     │
│   │   do it — no stopwatch degree required.                           │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   ┌────────────────────────────────────────────────────┐                    │
│   │ Voice compliance: 94%                              │                    │
│   │ ✓ Tone match   ✓ Perspective   ✓ Vocabulary       │                    │
│   └────────────────────────────────────────────────────┘                    │
│                                                                             │
│   [Use This] [Regenerate] [Edit in Article Builder →]                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Journey 3: Prospect Analysis

**Scenario**: Agency asks about a potential client's site

### 3.1 Entry Point

```
USER: "Analyze competitor.com - they're a potential client"
───────────────────────────────────────────────────────────────────────────────

SYSTEM DETECTS:
• Query type: Prospect analysis
• Domain provided: competitor.com
• Intent: Lead qualification

AUTO-ACTIONS:
1. Check if domain exists in prospects
2. Run quick domain analysis
3. Pull public backlink data
4. Estimate traffic from SimilarWeb/DataForSEO
```

### 3.2 Prospect Analysis Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   PROSPECT ANALYSIS: competitor.com                                         │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │   OPPORTUNITY SCORE                                               │     │
│   │                                                                   │     │
│   │                          78/100                                   │     │
│   │                         ─────────                                 │     │
│   │                      HIGH POTENTIAL                               │     │
│   │                                                                   │     │
│   │    ════════════════════════════════════════════════════════       │     │
│   │    ████████████████████████████████████████████░░░░░░░░░░░       │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   QUICK METRICS                                                             │
│   ─────────────                                                             │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │ DA: 34       │  │ Traffic: 8K  │  │ Keywords: 245│  │ Issues: 47   │   │
│   │ (moderate)   │  │ /month       │  │ ranking      │  │ detected     │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
│   WHY HIGH POTENTIAL                                                        │
│   ──────────────────                                                        │
│   • Domain age (5+ years) but underutilized                                 │
│   • Strong backlink profile (420 referring domains)                         │
│   • Many quick wins available (23 keywords at positions 11-20)              │
│   • Technical debt fixable (Core Web Vitals, schema gaps)                   │
│   • Industry growing (fitness e-commerce +18% YoY)                          │
│                                                                             │
│   REVENUE POTENTIAL                                                         │
│   ─────────────────                                                         │
│   Estimated monthly contract value: $3,500 - $5,500                         │
│   Based on: site complexity, keyword volume, industry benchmark             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Proposal Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   NEXT STEPS                                                                │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   📄 Generate Proposal                                              │   │
│   │      Create a customized proposal with this analysis                │   │
│   │      [Start Proposal Builder →]                                     │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   🔍 Deep Audit                                                     │   │
│   │      Run comprehensive 109-check SEO audit                          │   │
│   │      [Run Full Audit →]                                             │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   📊 Keyword Research                                               │   │
│   │      Discover full keyword opportunity landscape                    │   │
│   │      [Run Keyword Intelligence →]                                   │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────────────     │   │
│   │                                                                     │   │
│   │   📁 Save as Prospect                                               │   │
│   │      Add to pipeline for follow-up                                  │   │
│   │      [Create Prospect Record →]                                     │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────     │
│                                                                             │
│   "Tell me more about their competitors" or "What quick wins do they have?" │
│                                                                             │
│   [ Type your question...                                           ] [→]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Proposal Content Pre-Population

When user clicks "Start Proposal Builder", data flows:

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  CHAT ANALYSIS  │ ──────► │  PROPOSAL       │ ──────► │  AI SECTIONS    │
│                 │  export │  BUILDER        │ generate│  (editable)     │
│                 │         │                 │         │                 │
│  • Domain data  │         │  ☑ Include audit│         │  "Current Site  │
│  • Quick wins   │         │  ☑ Quick wins   │         │   Analysis"     │
│  • Revenue est. │         │  ☑ Revenue proj │         │                 │
│  • Key issues   │         │  ○ Custom scope │         │  "Opportunities"│
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## Journey 4: Follow-up Actions

After any ranking feasibility assessment, the chat presents contextual actions.

### 4.1 Action Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        FEASIBILITY RESULT                                   │
│                              │                                              │
│         ┌────────────────────┼────────────────────┐                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│   ┌───────────┐       ┌───────────┐       ┌───────────┐                    │
│   │  RANKABLE │       │  POSSIBLE │       │   HARD    │                    │
│   │  (Quick)  │       │  (Effort) │       │ (Strategy)│                    │
│   └─────┬─────┘       └─────┬─────┘       └─────┬─────┘                    │
│         │                   │                   │                          │
│         ▼                   ▼                   ▼                          │
│   ┌───────────┐       ┌───────────┐       ┌───────────┐                    │
│   │• Create   │       │• Run Audit│       │• Long-term│                    │
│   │  Content  │       │• Fix Tech │       │  Strategy │                    │
│   │• Track KW │       │• Build    │       │• Alt KWs  │                    │
│   │• Schedule │       │  Links    │       │• Niche    │                    │
│   │  Publish  │       │• Then     │       │  Down     │                    │
│   │           │       │  Content  │       │           │                    │
│   └───────────┘       └───────────┘       └───────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cross-Link Destinations

| User Selects | Destination | Pre-filled Data |
|--------------|-------------|-----------------|
| Create Content | `/clients/[id]/content/articles/new` | Target keyword, SERP analysis, suggested outline |
| Run Audit | `/clients/[id]/seo/audit/new` | Domain, focus areas from chat |
| Track Keywords | `/clients/[id]/intelligence` | Keywords + initial metrics |
| Generate Proposal | `/prospects/[id]/proposal/builder` | Domain analysis, quick wins, revenue estimate |
| Add to Intelligence | `/clients/[id]/intelligence/keywords/add` | Keywords, difficulty, volume |
| View Competitor Analysis | `/clients/[id]/intelligence/competitors` | Competitor domains identified |

### 4.3 Seamless Handoff Pattern

```
USER: "Create content for marathon training"
───────────────────────────────────────────────────────────────────────────────

CHAT RESPONSE:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   I'll set up an article for "marathon training" with everything we        │
│   learned from the analysis.                                                │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                                                                   │     │
│   │   ARTICLE PRE-CONFIGURATION                                       │     │
│   │                                                                   │     │
│   │   Target keyword: marathon training                               │     │
│   │   Secondary: marathon training plan, training for marathon        │     │
│   │   Word count target: 2,500 - 3,000 (based on SERP analysis)       │     │
│   │   Content type: Comprehensive guide                               │     │
│   │   Voice: Acme Running Co. profile (auto-applied)                  │     │
│   │                                                                   │     │
│   │   SUGGESTED OUTLINE (from SERP analysis)                          │     │
│   │   ─────────────────────────────────────                           │     │
│   │   1. Introduction to Marathon Training                            │     │
│   │   2. Choosing Your First Marathon                                 │     │
│   │   3. 16-Week Training Plan Overview                               │     │
│   │   4. Weekly Mileage Progression                                   │     │
│   │   5. Cross-Training and Recovery                                  │     │
│   │   6. Nutrition for Marathon Training                              │     │
│   │   7. Common Mistakes to Avoid                                     │     │
│   │   8. Race Day Preparation                                         │     │
│   │                                                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│   [Open Article Builder →] [Modify Outline First] [Just Save to Drafts]     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pattern: Chat-to-Feature Handoffs

Following v7 Pattern A (Finding → Action) and Pattern B (Opportunity → Content):

### Pattern G: Chat → Feature Handoff

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  CHAT           │ ──────► │  CONTEXT        │ ──────► │  FEATURE        │
│  CONVERSATION   │ prepare │  PREPARATION    │ handoff │  PAGE           │
│                 │         │                 │         │                 │
│  Q&A, analysis  │         │  Pre-fill data  │         │  Pre-populated  │
│  feasibility    │         │  Set defaults   │         │  Ready to act   │
│  recommendations│         │  Apply voice    │         │  One-click away │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy Points:**
- Chat auto-detects intent and prepares relevant feature
- Context carries over without re-entry
- Voice profile applied automatically
- SERP analysis pre-loaded

**Control Points:**
- User confirms before leaving chat
- "Modify before handoff" option always available
- Can return to chat without losing context
- Override any pre-filled values

---

## UI Component Specifications

### Chat Panel (Slide-out)

```css
.chat-panel {
  /* From design-system-v6.md */
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: clamp(400px, 35vw, 520px);
  background: var(--surface);
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
  
  /* Animation */
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-panel.open {
  transform: translateX(0);
}
```

### Chat Message Cards

Following v6 Card Primitive (ghost-edge shadows):

```css
.chat-message {
  background: var(--surface);
  box-shadow: 
    0 0 0 1px rgba(0, 0, 0, 0.03),
    0 1px 2px rgba(0, 0, 0, 0.04);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.chat-message:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.08);
}
```

### Editorial Moment in Chat

```css
.chat-hero-metric {
  font-family: var(--font-display); /* Newsreader */
  font-size: clamp(36px, 3vw, 48px);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-1);
}

.chat-hero-label {
  font-family: var(--font-sans); /* Geist */
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}
```

### Action Cards

```css
.chat-action-card {
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 150ms ease;
}

.chat-action-card:hover {
  background: var(--accent-soft);
  border-color: var(--accent-line);
}

.chat-action-card .icon {
  color: var(--accent);
}
```

---

## Today Feed Integration

New event types for chat interactions:

```
TODAY · 14 events
─────────────────────────────────────────────
14:23 │ Ranking analysis: myrunningblog.com
      │ CHAT · ANALYSIS · 2/3 keywords rankable

12:45 │ Prospect analyzed: competitor.com
      │ CHAT · PROSPECT · Score: 78/100

11:08 │ Content request → Article Builder
      │ CHAT · HANDOFF · "marathon training"

09:42 │ Quick check: "running shoes" — Hard
      │ CHAT · VALIDATION
```

---

## Up Next Recommendations

Chat interactions generate follow-up recommendations:

```
UP NEXT (system-curated)
─────────────────────────────────────────────

📝 Complete article for "marathon training"
   Chat analysis identified quick win
   [Open in Builder] [Dismiss]

🔍 Run audit on myrunningblog.com
   Initial analysis found 12 issues
   [Start Audit] [Schedule for Later]

💼 Follow up with competitor.com prospect
   Analyzed 3 days ago, high potential (78)
   [Create Proposal] [Schedule Call]
```

---

## Trust-Building Summary

| Trust Factor | Implementation |
|--------------|----------------|
| **Visibility** | Progress indicators during analysis; source attribution on metrics; confidence levels on assessments |
| **Reversibility** | "Modify before handoff" option; return to chat without losing context; edit all pre-filled data |
| **Predictability** | Consistent response format; same editorial moment pattern; clear action options |

---

## Implementation Checklist

### Phase 1: Core Chat Infrastructure
- [ ] Chat panel component (slide-out)
- [ ] Message rendering system
- [ ] Context detection (client/prospect/none)
- [ ] Basic Q&A with keyword feasibility
- [ ] Progress indicators

### Phase 2: Feature Handoffs
- [ ] Article Builder handoff
- [ ] Audit handoff
- [ ] Intelligence handoff
- [ ] Proposal Builder handoff

### Phase 3: Advanced Features
- [ ] Voice-aware responses
- [ ] Historical context loading
- [ ] Ranking drop investigation
- [ ] Competitor analysis in chat

### Phase 4: Polish
- [ ] Today Feed integration
- [ ] Up Next recommendations
- [ ] Mobile responsive
- [ ] Keyboard shortcuts (Cmd+/ for chat)

---

*Cross-references:*
- [v7-master-design-architecture.md](./v7-master-design-architecture.md) — Core architecture patterns
- [design-system-v6.md](./design-system-v6.md) — Visual rules
- [v8-agency-pipeline.md](./v8-agency-pipeline.md) — Prospect flow integration
- [KeywordAnalysisChat.tsx](/apps/web/src/components/keyword-analysis/KeywordAnalysisChat.tsx) — Existing chat implementation
