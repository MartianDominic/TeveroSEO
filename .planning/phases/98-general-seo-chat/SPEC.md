# World-Class SEO Chat: Complete Specification

> **Purpose**: Unified master document for Phase 98 SEO Chat - covering agency UX, prospect portal, technical architecture, component mapping, and conversion optimization.
> **Decision**: Sales-focused 3-analysis MVP (Domain Health + Keyword Feasibility + Proposal Generator) per WORLD-CLASS-VERDICT.md
> **Timeline**: 5-6 weeks
> **Models**: Grok 4.1-fast (intent classification), Gemini 3.1 Pro (content generation)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Core Flow](#2-the-core-flow)
3. [Agency-Side Chat Experience](#3-agency-side-chat-experience)
4. [Prospect Portal Experience](#4-prospect-portal-experience)
5. [Technical Architecture](#5-technical-architecture)
6. [Component Mapping](#6-component-mapping)
   - 6.5 [v7 Design Architecture Integration](#65-v7-design-architecture-integration)
7. [Conversion Optimization](#7-conversion-optimization)
8. [Implementation Plan](#8-implementation-plan)
9. [Decisions Made](#9-decisions-made-resolved)

---

## 1. Executive Summary

### What This Is

A **sales tool** that helps agency owners convert Facebook DM/email prospects into paying clients in under 30 seconds:

```
Prospect asks question → Agency pastes into chat → Chat analyzes → 
Proposal generated → Magic link sent → Prospect pays → Client created
```

### What This Is NOT

- A general-purpose chatbot
- A full SEO audit tool (that's post-conversion)
- An autonomous monitoring system (deferred)

### The 3-Analysis MVP

| Analysis | Purpose | Cost | Time |
|----------|---------|------|------|
| **Domain Health** | Quick site assessment | $0.01 | <3s |
| **Keyword Feasibility** | "Can we rank for X?" | $0.02-0.04 | <5s |
| **Proposal Generator** | Package + magic link | $0.05 | <8s |

**Total cost per proposal: ~$0.10**

### Success Metrics

| Metric | Target |
|--------|--------|
| Intent detection | <500ms |
| Analysis completion | <5s |
| Proposal generation | <8s |
| Intent accuracy | >90% |
| Prospect → Client conversion | >15% |

---

## 2. The Core Flow

### Prospect to Client Pipeline

```
STAGE 1: PROSPECT QUESTION
┌─────────────────────────────────────────────────────────────────────────────┐
│  Facebook DM / WhatsApp / Email                                            │
│  "Sveiki, turiu grožio saloną vilniuje. Ar galite padėti su SEO?"         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 2: AGENCY PASTES INTO CHAT
┌─────────────────────────────────────────────────────────────────────────────┐
│  SEO Chat                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ [Paste prospect message here]                                @domain   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│  Auto-extracted: domain=groziosalon.lt, niche=beauty salon, location=vilnius│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 3: INTENT DETECTION + ANALYSIS
┌─────────────────────────────────────────────────────────────────────────────┐
│  Intent: keyword_feasibility                                                │
│  Running: domain_health → keyword_feasibility                              │
│  ████████████░░░░░░░░ 60%                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 4: RESULTS DISPLAYED
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DOMAIN HEALTH: groziosalon.lt                                      │   │
│  │  DA: 12 │ Traffic: 340/mo │ Keywords: 23 ranked                     │   │
│  │  Status: Good foundation, room to grow                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  KEYWORD FEASIBILITY                                                │   │
│  │  "grožio salonas vilnius" (880/mo) — FEASIBLE (3-4 months)         │   │
│  │  "plaukų dažymas vilnius" (590/mo) — FEASIBLE (4-5 months)         │   │
│  │  "nagų priauginimas" (1.2K/mo) — CHALLENGING (6+ months)           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Generate Proposal]  [Copy Response]  [Ask Follow-up]                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 5: PROPOSAL GENERATED
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSAL PREVIEW                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Package: AUGIMAS (€3,500 / 6 mėn.)                                        │
│  Keywords: 47 assigned (12 BOFU, 20 MOFU, 15 TOFU)                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Magic Link: tevero.lt/p/abc123xyz                                         │
│  Expires: 14 days                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Copy Link]  [Send via Email]  [Edit Before Sending]                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 6: PROSPECT RECEIVES MAGIC LINK
┌─────────────────────────────────────────────────────────────────────────────┐
│  tevero.lt/p/abc123xyz                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  YOUR SEO PROPOSAL                                                         │
│  groziosalon.lt                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  "Radome 47 raktažodžius, kuriuos jūsų konkurentai jau užėmė"             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Topical Map] [Competitor Gaps] [Timeline] [Packages]                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Accept & Pay]                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
STAGE 7: PAYMENT + CLIENT CREATED
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✓ Payment successful                                                      │
│  ✓ Client created: groziosalon.lt                                          │
│  ✓ Keyword data migrated (no re-scrape needed)                             │
│  ✓ Full 109-check audit queued (overnight)                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Next: Onboarding call scheduling email sent                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agency-Side Chat Experience

### 3.1 Three-Column Layout (v7 Architecture)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               SEO CHAT                                       │
├──────────────┬────────────────────────────────────────────────┬──────────────┤
│              │                                                │              │
│   SIDEBAR    │                CHAT MAIN                       │  PROSPECT    │
│   (Nav)      │                                                │   CONTEXT    │
│              │  ┌──────────────────────────────────────────┐ │              │
│  • Dashboard │  │ [Tab: groziosalon.lt] [Tab: +New]        │ │  Domain:     │
│  • SEO Chat  │  ├──────────────────────────────────────────┤ │  groziosalon │
│    ← active  │  │                                          │ │  .lt         │
│  • Clients   │  │  USER MESSAGE                            │ │              │
│  • Prospects │  │  "Sveiki, turiu grožio saloną..."       │ │  DA: 12      │
│  • Reports   │  │                                          │ │  DR: 8       │
│              │  │  ASSISTANT RESPONSE                      │ │  Traffic:    │
│              │  │  ┌────────────────────────────────────┐  │ │  340/mo      │
│              │  │  │ DOMAIN HEALTH: groziosalon.lt     │  │ │              │
│              │  │  │ DA: 12 │ Traffic: 340/mo          │  │ │  ───────     │
│              │  │  └────────────────────────────────────┘  │ │  PROPOSAL    │
│              │  │                                          │ │  DRAFT       │
│              │  │  Based on my analysis...                 │ │              │
│              │  │                                          │ │  Keywords:   │
│              │  │  [Generate Proposal] [Copy]              │ │  47 selected │
│              │  │                                          │ │              │
│              │  ├──────────────────────────────────────────┤ │  Package:    │
│              │  │ ┌────────────────────────────────────┐   │ │  AUGIMAS     │
│              │  │ │ Type message... @domain @keywords  │   │ │  €3,500      │
│              │  │ └────────────────────────────────────┘   │ │              │
│              │  │ [Upload] [Voice] [Send ⌘↵]               │ │  [Generate]  │
│              │  └──────────────────────────────────────────┘ │              │
│              │                                                │              │
│  232-272px   │              minmax(0, 1fr)                    │  320-380px   │
└──────────────┴────────────────────────────────────────────────┴──────────────┘
```

### 3.2 Chat Input Features

#### Multi-Modal Input

| Input Type | Trigger | Use Case |
|------------|---------|----------|
| Text paste | Default | Facebook DM, email copy-paste |
| @-mention | `@` | Context injection (@domain, @keywords, @competitor) |
| File upload | 📎 button | Screenshot OCR, CSV keyword list |
| Voice memo | 🎤 button | Transcribe prospect call recording |

#### @-Mention System

```
Type @ to mention:
┌─────────────────────────────────────────┐
│  @domain    — Attach domain for analysis│
│  @keywords  — Reference keyword list    │
│  @competitor — Add competitor domain    │
│  @[url]     — Specific page URL         │
└─────────────────────────────────────────┘
```

**Auto-Extraction**: When pasting prospect messages, the system automatically extracts:
- Domain names (regex: `[a-z0-9-]+\.[a-z]{2,}`)
- Keywords (quoted phrases, "rank for X" patterns)
- Competitor mentions
- Location signals

#### Context Chips

Above the input field, extracted entities appear as removable chips:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Context: [groziosalon.lt ×] [grožio salonas vilnius ×] [vilnius ×]        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ What keywords can this salon rank for?                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Response Display

#### Analysis Cards

Each analysis type has a dedicated card component:

**Domain Health Card**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DOMAIN HEALTH                                              groziosalon.lt │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐               │
│  │    12     │  │    8      │  │   340     │  │    23     │               │
│  │    DA     │  │    DR     │  │  Traffic  │  │  Ranked   │               │
│  │           │  │           │  │   /month  │  │  Keywords │               │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘               │
│                                                                             │
│  Overall: Good foundation for SEO growth                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [View Full Audit] [Add to Proposal Context]                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Feasibility Card**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KEYWORD FEASIBILITY                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Keyword                         Volume   KD    Verdict      Timeline      │
│  ─────────────────────────────────────────────────────────────────────────  │
│  grožio salonas vilnius          880/mo   34    ✓ FEASIBLE   3-4 months   │
│  plaukų dažymas vilnius          590/mo   28    ✓ FEASIBLE   4-5 months   │
│  nagų priauginimas               1.2K/mo  58    ⚠ CHALLENGING 6+ months   │
│                                                                             │
│  Agency Capacity: 200 kw/6mo (AUGIMAS package)                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Add All to Proposal] [Select Keywords] [Expand Analysis]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Topical Map Card**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOPICAL MAP                                           47 keywords clustered│
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    [Interactive D3/React Flow Visualization]         │   │
│  │                                                                       │   │
│  │        ┌─────────┐                                                   │   │
│  │        │ PILLAR  │                                                   │   │
│  │        │ Grožio  │                                                   │   │
│  │        │ Paslaugos│                                                  │   │
│  │        └────┬────┘                                                   │   │
│  │      ┌──────┼──────┐                                                 │   │
│  │      ▼      ▼      ▼                                                 │   │
│  │  ┌──────┐┌──────┐┌──────┐                                           │   │
│  │  │Plaukai││Nagai ││Veidas│                                          │   │
│  │  │12 kw ││8 kw  ││15 kw │                                           │   │
│  │  └──────┘└──────┘└──────┘                                           │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Export as PDF] [Add to Proposal] [Edit Clusters]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Progress Indicators

During analysis, show phase-based progress:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Analyzing groziosalon.lt...                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ✓ Domain health fetched (1.2s)                                            │
│  ● Keyword feasibility calculating... (2.4s)                               │
│  ○ Topical map pending                                                     │
│                                                                             │
│  ████████████░░░░░░░░ 60%                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Proposal Generation Flow

#### Trigger Options

1. **Natural language**: "Generate a proposal for this domain"
2. **Keyboard shortcut**: `Cmd+P`
3. **Button**: [Generate Proposal] on analysis cards
4. **Accumulated context**: After 2+ analyses, system suggests "Ready to generate proposal?"

#### Slide-Over Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENERATE PROPOSAL                                              [×]        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PROSPECT                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Domain: groziosalon.lt                                               │ │
│  │  Contact: [Auto-filled or enter name]                                 │ │
│  │  Email: [Optional - for magic link delivery]                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  PACKAGE SELECTION                                                         │
│  ┌─────────────┐ ┌─────────────────┐ ┌─────────────┐                      │
│  │   PAMATAS   │ │  ★ AUGIMAS     │ │ AUTORITETAS │                      │
│  │   €2,500    │ │    €3,500      │ │   €7,100    │                      │
│  │   100 kw    │ │    200 kw      │ │   400 kw    │                      │
│  │   [Select]  │ │    [Selected]  │ │   [Select]  │                      │
│  └─────────────┘ └─────────────────┘ └─────────────┘                      │
│                                                                             │
│  KEYWORD ASSIGNMENT                                                        │
│  Strategy: [By Feasibility ▼]                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  BOFU (12)   ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  MOFU (20)   ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │  TOFU (15)   ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│  [Edit Keywords] [Auto-assign]                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  [Preview Proposal]                    [Generate & Copy Link]              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Session Management

#### Multi-Prospect Tabs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [groziosalon.lt] [plaukupasaka.lt] [naujasalonas.lt] [+ New Session]      │
│  ─────────────────────────────────────────────────────────────────────────  │
```

- Max 5 active tabs
- Sessions auto-save every 30 seconds
- Resume from any device (database-persisted)

#### Session History

Access via `Cmd+H` or right rail:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SESSION HISTORY                                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Today                                                                     │
│  • groziosalon.lt — 3 analyses, proposal generated                        │
│  • plaukupasaka.lt — 2 analyses, in progress                              │
│                                                                             │
│  Yesterday                                                                 │
│  • autoservisas.lt — Proposal sent, viewed (not converted)                │
│                                                                             │
│  Last 7 days                                                               │
│  • kavine.lt — Converted to client! ✓                                     │
│  • floristas.lt — Proposal expired                                        │
│                                                                             │
│  [Load More]                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.7 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Enter` | Send message |
| `Cmd+P` | Generate proposal |
| `Cmd+N` | New session |
| `Cmd+H` | Session history |
| `Cmd+1/2/3` | Switch session tabs |
| `Cmd+M` | Voice input |
| `@` | Start @-mention |
| `↑` | Edit last message |
| `Esc` | Close panels |

### 3.8 Right Rail Context Panel

During chat, the right rail transforms into prospect context:

```
┌──────────────────────────────────────┐
│  PROSPECT CONTEXT                    │
│  ────────────────────────────────────│
│                                      │
│  groziosalon.lt                      │
│  Beauty Salon · Vilnius              │
│                                      │
│  METRICS                             │
│  ┌────────┐ ┌────────┐               │
│  │   12   │ │   340  │               │
│  │   DA   │ │ Traffic│               │
│  └────────┘ └────────┘               │
│                                      │
│  ────────────────────────────────────│
│  PROPOSAL DRAFT                      │
│                                      │
│  Keywords: 47                        │
│  Package: AUGIMAS (€3,500)           │
│  Value: ~€2,400/mo potential         │
│                                      │
│  [Generate Proposal]                 │
│                                      │
│  ────────────────────────────────────│
│  ANALYSIS HISTORY                    │
│                                      │
│  ✓ Domain health (12:34)             │
│  ✓ Keyword feasibility (12:35)       │
│  ✓ Topical map (12:36)               │
│                                      │
│  ────────────────────────────────────│
│  SESSION                             │
│  Started: 12:30 today                │
│  Messages: 8                         │
│  Cost: $0.08                         │
└──────────────────────────────────────┘
```

---

## 4. Prospect Portal Experience

### 4.1 Landing (First 3 Seconds)

The magic link landing must build trust instantly:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Agency Logo]                                    [🇱🇹 LT] [💬 Klausti]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  JŪSŲ SEO PASIŪLYMAS                                                       │
│  groziosalon.lt                                   Paruošta: 2026-05-12     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │  "Radome 47 raktažodžius, kuriuos jūsų konkurentai                   │   │
│  │   jau užėmė — o jūs dar ne."                                         │   │
│  │                                                                       │   │
│  │   Potenciali vertė: ~€2,400/mėn.                                     │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                                │
│  │  ★★★★★    │ │  6 mėn.   │ │  100%     │                                │
│  │  156      │ │ garantija │ │  balta    │                                │
│  │ atsiliepi-│ │ raštu     │ │ metodika  │                                │
│  │ mų        │ │           │ │           │                                │
│  └───────────┘ └───────────┘ └───────────┘                                │
│                                                                             │
│                    ↓ Žiūrėti galimybes                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Value Communication Sections

#### Topical Map Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  JŪSŲ RAKTAŽODŽIŲ ŽEMĖLAPIS                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │            [Interactive Topical Map - Prospect's Keywords]           │   │
│  │                                                                       │   │
│  │                      ┌─────────────┐                                 │   │
│  │                      │   GROŽIO    │                                 │   │
│  │                      │   SALONAS   │                                 │   │
│  │                      └──────┬──────┘                                 │   │
│  │           ┌─────────────────┼─────────────────┐                      │   │
│  │           ▼                 ▼                 ▼                      │   │
│  │     ┌──────────┐     ┌──────────┐     ┌──────────┐                  │   │
│  │     │  PLAUKAI │     │   NAGAI  │     │  VEIDAS  │                  │   │
│  │     │  12 kw   │     │   8 kw   │     │  15 kw   │                  │   │
│  │     │  320/mėn │     │  180/mėn │     │  420/mėn │                  │   │
│  │     └──────────┘     └──────────┘     └──────────┘                  │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Kiekvienas apskritimas = raktažodžių grupė, kurią galite užimti          │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Competitor Comparison (Anonymized)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KAIP ATRODOTE PRIEŠ KONKURENTUS                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  JŪS                    KONKURENTAS A          KONKURENTAS B               │
│  groziosalon.lt                                                            │
│                                                                             │
│  ████████░░░░░░░░░░░░   ██████████████████░░   ████████████████░░░░        │
│  23 pozicijos           47 pozicijos           38 pozicijos                │
│  TOP 100                TOP 100                TOP 100                      │
│                                                                             │
│  SPRAGA: 24 raktažodžiai, kuriuos jie turi — o jūs dar ne                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Timeline Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KO TIKĖTIS PER 6 MĖNESIUS                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  MĖN 1        MĖN 2        MĖN 3        MĖN 4        MĖN 5        MĖN 6   │
│    │            │            │            │            │            │      │
│    ▼            ▼            ▼            ▼            ▼            ▼      │
│  ┌────┐      ┌────┐      ┌────┐      ┌────┐      ┌────┐      ┌────┐      │
│  │Audi│      │Turi│      │Pirm│      │Stab│      │Augim│     │Garanti│   │
│  │tas │      │nys │      │ieji│      │ilus│      │as   │     │ja     │   │
│  │    │      │    │      │rezu│      │     │      │     │     │       │   │
│  │    │      │    │      │ltat│      │     │      │     │     │       │   │
│  └────┘      └────┘      └────┘      └────┘      └────┘      └────┘      │
│                                                                             │
│  "SEO nėra greitas sprendimas. Garantuojame rezultatus per 6 mėnesius."   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Package Display

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PASIRINKITE PAKETĄ                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────┐ ┌───────────────────────┐ ┌─────────────────┐         │
│  │                 │ │  ★ POPULIARIAUSIAS   │ │                 │         │
│  │    PAMATAS      │ │                       │ │   AUTORITETAS   │         │
│  │                 │ │      AUGIMAS          │ │                 │         │
│  │   €2,500        │ │                       │ │    €7,100       │         │
│  │   / 6 mėn.      │ │     €3,500            │ │    / 6 mėn.     │         │
│  │                 │ │     / 6 mėn.          │ │                 │         │
│  │   ───────────   │ │                       │ │   ───────────   │         │
│  │                 │ │     ───────────       │ │                 │         │
│  │   100 raktaž.   │ │                       │ │   400 raktaž.   │         │
│  │   100 straipsn. │ │     200 raktaž.       │ │   400+ straipsn.│         │
│  │   Mėnesiniai    │ │     200 straipsn.     │ │   Savaitiniai   │         │
│  │   pokalbiai     │ │     Kas 2 sav.        │ │   pokalbiai     │         │
│  │                 │ │     pokalbiai         │ │   Dedikuotas    │         │
│  │   Garantija:    │ │     Konkurentų        │ │   kanalas       │         │
│  │   10 TOP 10     │ │     analizė           │ │                 │         │
│  │                 │ │                       │ │   Garantija:    │         │
│  │                 │ │     Garantija:        │ │   40 TOP 10     │         │
│  │                 │ │     20 TOP 10         │ │                 │         │
│  │                 │ │                       │ │                 │         │
│  │  [Pasirinkti]   │ │    [Pasirinkti]       │ │  [Pasirinkti]   │         │
│  └─────────────────┘ └───────────────────────┘ └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Trust & Guarantee Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MŪSŲ GARANTIJA                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   "Jei per 6 mėnesius nepasiekiame sutarto TOP 10 pozicijų          │   │
│  │    skaičiaus — grąžiname 100% investicijos."                         │   │
│  │                                                                       │   │
│  │   Kodėl galime taip garantuoti?                                      │   │
│  │                                                                       │   │
│  │   Mūsų garantija mus sužlugdytų, jei rizikuotume.                    │   │
│  │   Štai kodėl naudojame tik 100% baltus metodus.                      │   │
│  │   Jei Google nubausti — grąžiname pinigus.                           │   │
│  │   Mes negalime sau leisti rizikuoti.                                 │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  "Suprantame — agentūros nuvylė"                                           │
│                                                                             │
│  ✓ Rašytinė garantija — ne tik pažadai                                     │
│  ✓ GSC-patvirtinti duomenys — ne išgalvoti skaičiai                        │
│  ✓ Mokėjimas dalimis — be pabrangimo                                       │
│  ✓ Po 6 mėn. — geriausių praktikų dokumentas (nesate įkaitas)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Payment Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MOKĖJIMO BŪDAI                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Pasirinktas paketas: AUGIMAS (€3,500)                                     │
│                                                                             │
│  ● Vienu mokėjimu           €3,500                                         │
│  ○ 2 dalimis                €1,750 × 2 (kas mėnesį)      BE PABRANGIMO    │
│  ○ 3 dalimis                €1,167 × 3 (kas mėnesį)      BE PABRANGIMO    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  [Stripe Elements - Card Input]                                       │ │
│  │                                                                         │ │
│  │  Card number                                                           │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 4242 4242 4242 4242                                             │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                         │ │
│  │  Expiry          CVC                                                   │ │
│  │  ┌───────────┐   ┌───────────┐                                        │ │
│  │  │ 12/28     │   │ 123       │                                        │ │
│  │  └───────────┘   └───────────┘                                        │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     [PATVIRTINTI IR MOKĖTI €3,500]                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  🔒 Saugus mokėjimas per Stripe · Jūsų kortelės duomenys pas mus nesaugomi │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Ši nuoroda galioja iki 2026-05-26 (liko 11 dienų)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Mobile Experience

```
┌─────────────────────────┐
│ [Agency Logo]  [🇱🇹][💬]│
├─────────────────────────┤
│                         │
│ JŪSŲ SEO PASIŪLYMAS    │
│ groziosalon.lt          │
│                         │
│ ┌─────────────────────┐ │
│ │ "47 raktažodžiai,   │ │
│ │  kuriuos konkurentai│ │
│ │  jau užėmė"         │ │
│ │                     │ │
│ │  €2,400/mėn. vertė  │ │
│ └─────────────────────┘ │
│                         │
│ [▼ Raktažodžių žemėlapis]│
│ [▼ Konkurentų palyginimas]│
│ [▼ Laiko grafikas]      │
│ [▼ Paketai]             │
│ [▼ Garantija]           │
│                         │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │  [PRIIMTI PASIŪLYMĄ]│ │  ← Sticky bottom CTA
│ │      AUGIMAS €3,500 │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### 4.7 Post-Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                              ✓                                              │
│                                                                             │
│                    AČIŪ! INVESTICIJA PATVIRTINTA.                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  KAS VYKSTA DABAR:                                                         │
│                                                                             │
│  ┌─────┐  Per 24 val.                                                      │
│  │  1  │  Pilnas techninis auditas (138 patikrinimų)                       │
│  └─────┘  Gausite ataskaitą el. paštu                                      │
│                                                                             │
│  ┌─────┐  Per 48 val.                                                      │
│  │  2  │  Įvadinio pokalbio kvietimas                                      │
│  └─────┘  60-90 min. balso ir strategijos sesija                           │
│                                                                             │
│  ┌─────┐  Per 7 dienas                                                     │
│  │  3  │  Raktažodžių patvirtinimas                                        │
│  └─────┘  Jūs pasirenkate, kuriuos raktažodžius taikysime                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  [Rezervuoti įvadinį pokalbį dabar →]                                      │
│                                                                             │
│  (Cal.com/Calendly integration)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Technical Architecture

### 5.1 Vercel AI SDK Architecture (Command-Driven)

> **Decision**: Use Vercel AI SDK instead of CopilotKit or custom SSE.
> 
> **Rationale**:
> - Native `@ai-sdk/xai` for Grok 4.1-fast (intent routing)
> - Native `@ai-sdk/google` for Gemini 3.1 Pro (content generation)
> - Tool calling pattern handles variable parameters ("Do 100 keywords" vs "Do 200 keywords")
> - Built-in streaming with `useChat` hook
> - Simpler than CopilotKit (no custom adapters needed for our models)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SEO CHAT ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐   │
│  │   useChat   │───▶│  /api/seo-chat   │───▶│    Grok 4.1-fast        │   │
│  │  (Vercel)   │    │   streamText()   │    │  (Tool Selection)       │   │
│  └─────────────┘    └────────┬─────────┘    └───────────┬─────────────┘   │
│                              │                          │                  │
│                              │                          ▼                  │
│                              │              ┌─────────────────────────┐   │
│                              │              │       TOOL CALLS        │   │
│                              │              ├─────────────────────────┤   │
│                              │              │ • domain_health         │   │
│                              │              │ • keyword_analysis      │   │
│                              │              │ • feasibility_check     │   │
│                              │              │ • add_to_proposal       │   │
│                              │              │ • generate_proposal     │   │
│                              │              └───────────┬─────────────┘   │
│                              │                          │                  │
│                              │                          ▼                  │
│  ┌─────────────┐    ┌───────┴──────────┐    ┌─────────────────────────┐   │
│  │  useChat    │◀───│  Tool Results    │◀───│   Analysis Executors    │   │
│  │  Streaming  │    │  + LLM Response  │    │   (DataForSEO, etc.)    │   │
│  └─────────────┘    └──────────────────┘    └─────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tool Definitions (Zod Schemas)

```typescript
// lib/seo-chat/tools/index.ts
import { tool } from 'ai';
import { z } from 'zod';

// ============================================================================
// TOOL 1: domain_health
// Quick domain assessment - DA, DR, traffic, ranked keywords
// ============================================================================

export const domainHealthTool = tool({
  description: `Get domain health metrics for a prospect. Shows DA, DR, traffic, and ranked keywords.
Use when user says: "check domain", "how is this site", "domain metrics", "site health", or mentions a domain.`,
  parameters: z.object({
    domain: z.string()
      .describe("Domain to analyze (e.g., 'groziosalon.lt'). Auto-extracted from conversation if omitted.")
      .optional(),
  }),
  execute: async ({ domain }, { sessionContext }) => {
    const targetDomain = domain || sessionContext.prospectDomain;
    if (!targetDomain) throw new Error("No domain specified or detected");
    return await runDomainHealthAnalysis(targetDomain);
  },
});

// ============================================================================
// TOOL 2: keyword_analysis
// Discover keywords for prospect - SUPPORTS VARIABLE COUNT
// ============================================================================

export const keywordAnalysisTool = tool({
  description: `Discover and analyze keywords for a prospect domain. Returns keyword opportunities with volume, difficulty, and feasibility.
Use when user says: "do X keywords analysis", "find keywords", "keyword opportunities", "what can they rank for".
The count parameter allows 100 (quick), 200 (standard), or 400 (comprehensive) keywords.`,
  parameters: z.object({
    count: z.number()
      .min(50).max(500)
      .describe("Number of keywords to analyze: 100 (quick), 200 (standard), 400 (comprehensive)")
      .default(100),
    niche: z.string()
      .describe("Business niche (e.g., 'beauty salon'). Auto-detected from domain if omitted.")
      .optional(),
    location: z.string()
      .describe("Target location for local keywords (e.g., 'Vilnius'). Enables local keyword discovery.")
      .optional(),
  }),
  execute: async ({ count, niche, location }, { sessionContext }) => {
    const domain = sessionContext.prospectDomain;
    if (!domain) throw new Error("No prospect domain set");
    return await runKeywordDiscovery(domain, count, niche, location);
  },
});

// ============================================================================
// TOOL 3: feasibility_check
// Check specific keywords for rankability
// ============================================================================

export const feasibilityCheckTool = tool({
  description: `Check if specific keywords are rankable for the prospect. Returns per-keyword feasibility verdict with timeline.
Use when user asks: "can they rank for X", "is X feasible", "how hard to rank for", "chance of ranking".`,
  parameters: z.object({
    keywords: z.array(z.string())
      .min(1).max(20)
      .describe("List of specific keywords to check (1-20 keywords)"),
  }),
  execute: async ({ keywords }, { sessionContext }) => {
    const domain = sessionContext.prospectDomain;
    if (!domain) throw new Error("No prospect domain set");
    return await runFeasibilityCheck(domain, keywords);
  },
});

// ============================================================================
// TOOL 4: add_to_proposal
// Add keywords to the proposal draft
// ============================================================================

export const addToProposalTool = tool({
  description: `Add keywords to the proposal draft. Can filter by feasibility or specify exact keywords.
Use when user says: "add to proposal", "include these", "put in proposal", "use these keywords".`,
  parameters: z.object({
    filter: z.enum(['feasible', 'challenging', 'all'])
      .describe("Filter: 'feasible' (score ≤30), 'challenging' (score ≤50), 'all'")
      .default('feasible'),
    limit: z.number()
      .describe("Maximum keywords to add (respects package: 100/200/400)")
      .optional(),
    keywordIds: z.array(z.string())
      .describe("Specific keyword IDs to add. If empty, uses last analysis results.")
      .optional(),
  }),
  execute: async ({ filter, limit, keywordIds }, { sessionContext, proposalDraft }) => {
    const keywords = keywordIds?.length 
      ? await getKeywordsByIds(keywordIds)
      : await getLastAnalysisKeywords(sessionContext.sessionId, filter, limit);
    
    proposalDraft.addKeywords(keywords);
    return { added: keywords.length, total: proposalDraft.keywords.length };
  },
});

// ============================================================================
// TOOL 5: generate_proposal
// Create magic link proposal
// ============================================================================

export const generateProposalTool = tool({
  description: `Generate a proposal with magic link. Creates a shareable link the prospect can use to view and pay.
Use when user says: "generate proposal", "create proposal", "send proposal", "magic link".`,
  parameters: z.object({
    package: z.enum(['pamatas', 'augimas', 'autoritetas'])
      .describe("Package: pamatas (€2,500/100kw), augimas (€3,500/200kw), autoritetas (€7,100/400kw)"),
    email: z.string().email()
      .describe("Prospect email for sending magic link. Optional - can copy manually.")
      .optional(),
  }),
  execute: async ({ package: pkg, email }, { sessionContext, proposalDraft }) => {
    const proposal = await createProposal({
      sessionId: sessionContext.sessionId,
      domain: sessionContext.prospectDomain,
      package: pkg,
      keywords: proposalDraft.keywords,
      email,
    });
    return { 
      magicLink: proposal.magicLink, 
      expiresAt: proposal.expiresAt,
      keywordsAssigned: proposalDraft.keywords.length,
    };
  },
});

// Export all tools
export const seoTools = {
  domain_health: domainHealthTool,
  keyword_analysis: keywordAnalysisTool,
  feasibility_check: feasibilityCheckTool,
  add_to_proposal: addToProposalTool,
  generate_proposal: generateProposalTool,
};
```

### 5.3 API Route (Vercel AI SDK streamText)

```typescript
// app/api/seo-chat/route.ts
import { streamText, convertToCoreMessages } from 'ai';
import { xai } from '@ai-sdk/xai';
import { seoTools } from '@/lib/seo-chat/tools';
import { getSessionContext, saveMessage } from '@/lib/seo-chat/session';
import { getProposalDraft } from '@/lib/seo-chat/proposal-draft';

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
  
  // Load session context (domain, keywords, etc.)
  const sessionContext = await getSessionContext(sessionId);
  const proposalDraft = await getProposalDraft(sessionId);
  
  // System prompt with context
  const systemPrompt = `You are an SEO sales assistant for a Lithuanian agency. 
You help agency owners analyze prospects and generate proposals.

CURRENT SESSION:
- Prospect domain: ${sessionContext.prospectDomain || 'Not set yet'}
- Keywords analyzed: ${sessionContext.keywordsAnalyzed || 0}
- Proposal draft: ${proposalDraft.keywords.length} keywords selected

INSTRUCTIONS:
- Use tools to perform analyses - never make up data
- Extract domain from user messages automatically
- Respond in the same language as the user (Lithuanian or English)
- Keep responses concise and action-oriented
- After analyses, suggest next steps (e.g., "Want me to add these to the proposal?")

AVAILABLE ACTIONS:
- domain_health: Check site metrics
- keyword_analysis: Discover keywords (can specify count: 100, 200, 400)
- feasibility_check: Check if specific keywords are rankable
- add_to_proposal: Add keywords to proposal draft
- generate_proposal: Create magic link`;

  const result = await streamText({
    model: xai('grok-4.1-fast'),
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    tools: seoTools,
    toolChoice: 'auto', // LLM decides when to use tools
    maxSteps: 5, // Allow multi-step tool chains
    onFinish: async ({ text, toolCalls, toolResults }) => {
      // Persist message and tool results
      await saveMessage(sessionId, {
        role: 'assistant',
        content: text,
        toolCalls,
        toolResults,
      });
      
      // Update session context if domain was detected
      const domainCall = toolCalls?.find(t => t.toolName === 'domain_health');
      if (domainCall?.args?.domain) {
        await updateSessionContext(sessionId, { prospectDomain: domainCall.args.domain });
      }
    },
    experimental_toolCallStreaming: true, // Stream tool progress
  });

  return result.toDataStreamResponse();
}
```

### 5.4 Client-Side Hook (useChat)

```typescript
// hooks/useSEOChat.ts
import { useChat } from 'ai/react';
import { useProposalDraftStore } from '@/stores/proposalDraftStore';
import { useSessionStore } from '@/stores/sessionStore';

export function useSEOChat(sessionId: string) {
  const { updateProposalDraft } = useProposalDraftStore();
  const { updateContext } = useSessionStore();
  
  const chat = useChat({
    api: '/api/seo-chat',
    body: { sessionId },
    onToolCall: async ({ toolCall }) => {
      // Handle tool-specific UI updates
      switch (toolCall.toolName) {
        case 'domain_health':
          // Update right rail with domain metrics
          updateContext({ analyzing: 'domain_health' });
          break;
        case 'keyword_analysis':
          updateContext({ analyzing: 'keywords', count: toolCall.args.count });
          break;
        case 'add_to_proposal':
          // Optimistic UI update
          break;
        case 'generate_proposal':
          updateContext({ generatingProposal: true });
          break;
      }
    },
    onFinish: (message) => {
      updateContext({ analyzing: null, generatingProposal: false });
      
      // Extract tool results for UI cards
      const toolResults = message.toolInvocations?.filter(t => t.state === 'result');
      if (toolResults?.length) {
        // Update stores with results for card rendering
        toolResults.forEach(result => {
          if (result.toolName === 'add_to_proposal') {
            updateProposalDraft(result.result);
          }
        });
      }
    },
  });

  return {
    ...chat,
    // Convenience methods
    analyzeKeywords: (count: number) => 
      chat.append({ role: 'user', content: `Do ${count} keywords analysis` }),
    checkFeasibility: (keywords: string[]) =>
      chat.append({ role: 'user', content: `Can we rank for ${keywords.map(k => `"${k}"`).join(', ')}?` }),
    generateProposal: (pkg: string) =>
      chat.append({ role: 'user', content: `Generate ${pkg} proposal` }),
  };
}
```

### 5.5 Proposal Draft Store (Zustand)

```typescript
// stores/proposalDraftStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Keyword {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  feasibility: 'feasible' | 'challenging' | 'difficult' | 'unlikely';
  intent: string;
}

interface ProposalDraft {
  sessionId: string | null;
  domain: string | null;
  keywords: Keyword[];
  package: 'pamatas' | 'augimas' | 'autoritetas' | null;
  analysisResults: {
    domainHealth: any | null;
    keywordAnalysis: any | null;
    feasibilityResults: any[];
  };
}

interface ProposalDraftStore {
  draft: ProposalDraft;
  
  // Actions
  setSession: (sessionId: string, domain: string) => void;
  addKeywords: (keywords: Keyword[]) => void;
  removeKeyword: (keywordId: string) => void;
  setPackage: (pkg: ProposalDraft['package']) => void;
  setAnalysisResult: (type: string, result: any) => void;
  clearDraft: () => void;
}

const initialDraft: ProposalDraft = {
  sessionId: null,
  domain: null,
  keywords: [],
  package: null,
  analysisResults: {
    domainHealth: null,
    keywordAnalysis: null,
    feasibilityResults: [],
  },
};

export const useProposalDraftStore = create<ProposalDraftStore>()(
  persist(
    (set, get) => ({
      draft: initialDraft,
      
      setSession: (sessionId, domain) => 
        set({ draft: { ...initialDraft, sessionId, domain } }),
      
      addKeywords: (keywords) =>
        set((state) => ({
          draft: {
            ...state.draft,
            keywords: [...state.draft.keywords, ...keywords.filter(
              k => !state.draft.keywords.some(existing => existing.id === k.id)
            )],
          },
        })),
      
      removeKeyword: (keywordId) =>
        set((state) => ({
          draft: {
            ...state.draft,
            keywords: state.draft.keywords.filter(k => k.id !== keywordId),
          },
        })),
      
      setPackage: (pkg) =>
        set((state) => ({ draft: { ...state.draft, package: pkg } })),
      
      setAnalysisResult: (type, result) =>
        set((state) => ({
          draft: {
            ...state.draft,
            analysisResults: { ...state.draft.analysisResults, [type]: result },
          },
        })),
      
      clearDraft: () => set({ draft: initialDraft }),
    }),
    { name: 'proposal-draft' }
  )
);
```

### 5.6 Session Context Schema

```typescript
// lib/seo-chat/types.ts

export interface SessionContext {
  sessionId: string;
  workspaceId: string;
  
  // Prospect info (accumulated across messages)
  prospectDomain: string | null;
  prospectName: string | null;
  prospectEmail: string | null;
  niche: string | null;
  location: string | null;
  
  // Analysis state
  keywordsAnalyzed: number;
  analysisHistory: Array<{
    type: string;
    timestamp: Date;
    costMicros: number;
  }>;
  
  // Proposal state
  proposalId: string | null;
  proposalStatus: 'draft' | 'generated' | 'sent' | 'viewed' | 'converted' | null;
}

// Context accumulation rules
export function mergeContext(
  existing: SessionContext,
  extracted: Partial<SessionContext>
): SessionContext {
  return {
    ...existing,
    // Domain: once set, don't overwrite unless explicitly changed
    prospectDomain: extracted.prospectDomain || existing.prospectDomain,
    // Niche/location: update if provided
    niche: extracted.niche || existing.niche,
    location: extracted.location || existing.location,
    // Counters: accumulate
    keywordsAnalyzed: existing.keywordsAnalyzed + (extracted.keywordsAnalyzed || 0),
    // History: append
    analysisHistory: [...existing.analysisHistory, ...(extracted.analysisHistory || [])],
  };
}
```

### 5.7 Settings Schema

```typescript
// Settings stored in workspace.seo_chat_settings JSONB

interface SEOChatSettings {
  // Language
  language: 'lt' | 'en';               // Default: 'lt'
  
  // Behavior
  autoAnalyzeOnDomain: boolean;        // Default: true - auto-run domain_health when domain detected
  confirmExpensiveOps: boolean;        // Default: true - ask before >$0.05 operations
  costTrackingVisible: boolean;        // Default: true - show cost per analysis in UI
  
  // Defaults
  defaultPackage: 'pamatas' | 'augimas' | 'autoritetas';  // Default: 'augimas'
  defaultKeywordCount: 100 | 200 | 400; // Default: 100
  
  // Thresholds (feasibility formula)
  feasibility: {
    feasibleThreshold: number;         // Default: 30
    challengingThreshold: number;      // Default: 50
    difficultThreshold: number;        // Default: 70
  };
  
  // Proposal
  proposal: {
    expiryDays: number;                // Default: 14
    autoSendEmail: boolean;            // Default: false
  };
}

// Default settings
export const DEFAULT_SEO_CHAT_SETTINGS: SEOChatSettings = {
  language: 'lt',
  autoAnalyzeOnDomain: true,
  confirmExpensiveOps: true,
  costTrackingVisible: true,
  defaultPackage: 'augimas',
  defaultKeywordCount: 100,
  feasibility: {
    feasibleThreshold: 30,
    challengingThreshold: 50,
    difficultThreshold: 70,
  },
  proposal: {
    expiryDays: 14,
    autoSendEmail: false,
  },
};
```

### 5.3 The Feasibility Formula (Evidence-Based, Research-Backed)

> **Critical**: The original formula was fundamentally flawed. This version is based on:
> - Ahrefs/SEMrush/Moz methodology documentation
> - Backlinko 11.8M search results study
> - SEO ranking factors correlation research (2025)
> - Professional agency scoring methodologies (OXY Digital, Semrush PKD)

#### Why the Original Formula Was Wrong

| Issue | Original | Research Shows |
|-------|----------|----------------|
| KD is logarithmic | Added +15/-10 linearly | Can't add to log scale |
| DA gap weight | 0.5 (secondary) | 0.85 correlation (PRIMARY) |
| SERP features | Ignored | -7 to -19% CTR impact |
| Search intent | Ignored | "Paramount importance" |
| Topical authority | Ignored | Can beat higher-DR sites |
| YMYL penalty | +15 | +25 + 3-6 month extension |
| "Feasible" timeline | 3-4 months | Only 1.74% rank top 10 in a year |
| Domain sandbox | Ignored | 6-12 month delay for new domains |

#### The Corrected Formula

```typescript
// ============================================================================
// EVIDENCE-BASED KEYWORD FEASIBILITY CALCULATOR
// Sources: Ahrefs, Semrush PKD, Backlinko study, seoClarity correlation data
// ============================================================================

interface FeasibilityInput {
  // Core metrics (from DataForSEO)
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;      // 0-100 (logarithmic scale)
  currentPosition: number | null; // Our current rank, if any
  
  // Domain metrics
  ourDA: number;
  competitorAvgDA: number;
  domainAgeMonths: number;        // Critical for sandbox effect
  
  // Topical context
  relatedKeywordsRanked: number;  // How many related keywords we rank for
  totalClusterKeywords: number;   // Size of the topic cluster
  
  // SERP analysis (from DataForSEO serp_info)
  serpFeatures: {
    featuredSnippet: boolean;
    localPack: boolean;
    peopleAlsoAsk: boolean;
    aiOverview: boolean;
    hasGiantCompetitors: boolean; // Amazon, Wikipedia, gov sites
  };
  
  // Classification
  searchIntent: 'informational' | 'navigational' | 'commercial' | 'transactional';
  isYMYL: boolean;
  isLocal: boolean;
}

interface FeasibilityOutput {
  keyword: string;
  score: number;                  // 0-100 (lower = more feasible)
  verdict: 'feasible' | 'challenging' | 'difficult' | 'unlikely';
  confidence: 'high' | 'medium' | 'low';
  timeline: {
    minMonths: number;
    maxMonths: number;
    caveats: string[];
  };
  requirements: {
    backlinksNeeded: number;
    contentWordCount: number;
    technicalFixesFirst: boolean;
  };
  factors: {
    personalizedKD: number;       // KD adjusted for our domain
    serpDifficulty: number;       // SERP feature impact
    intentDifficulty: number;     // Search intent factor
    domainGapPenalty: number;     // DA gap impact
    topicalAuthorityBonus: number;
    positionAdvantage: number;
    ymylPenalty: number;
    localBonus: number;
    sandboxPenalty: number;
  };
}

function calculateFeasibility(input: FeasibilityInput): FeasibilityOutput {
  const factors = {
    personalizedKD: 0,
    serpDifficulty: 0,
    intentDifficulty: 0,
    domainGapPenalty: 0,
    topicalAuthorityBonus: 0,
    positionAdvantage: 0,
    ymylPenalty: 0,
    localBonus: 0,
    sandboxPenalty: 0,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 1: Personalized Keyword Difficulty (PKD)
  // Based on Semrush PKD methodology - adjusts raw KD for YOUR domain
  // ─────────────────────────────────────────────────────────────────────────
  
  // Calculate topical authority (0-100)
  // If we rank for many related keywords, we have topical authority
  const topicalAuthority = input.totalClusterKeywords > 0
    ? Math.min(100, (input.relatedKeywordsRanked / input.totalClusterKeywords) * 100)
    : 0;
  
  // Topical authority bonus (can reduce difficulty by up to 30 points)
  // Research shows topical authority can beat higher-DR competitors
  factors.topicalAuthorityBonus = topicalAuthority * 0.3;
  
  // Position advantage (already ranking = easier to push up)
  if (input.currentPosition !== null) {
    if (input.currentPosition <= 10) factors.positionAdvantage = 25;
    else if (input.currentPosition <= 20) factors.positionAdvantage = 20;
    else if (input.currentPosition <= 50) factors.positionAdvantage = 10;
    else if (input.currentPosition <= 100) factors.positionAdvantage = 5;
  }
  
  factors.personalizedKD = Math.max(0, 
    input.keywordDifficulty - factors.topicalAuthorityBonus - factors.positionAdvantage
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 2: Domain Authority Gap
  // Research: 0.85 correlation with rankings (highest single factor)
  // This should be weighted MORE than raw KD
  // ─────────────────────────────────────────────────────────────────────────
  
  const daGap = input.competitorAvgDA - input.ourDA;
  if (daGap > 0) {
    // Each point of DA gap adds difficulty
    // Capped at 40 points (massive gap)
    factors.domainGapPenalty = Math.min(40, daGap * 0.8);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 3: SERP Competitiveness
  // SERP features reduce organic CTR opportunity by 7-19 points
  // Giant competitors (Amazon, Wikipedia) are nearly impossible to outrank
  // ─────────────────────────────────────────────────────────────────────────
  
  if (input.serpFeatures.featuredSnippet) factors.serpDifficulty += 15;
  if (input.serpFeatures.localPack && !input.isLocal) factors.serpDifficulty += 20;
  if (input.serpFeatures.peopleAlsoAsk) factors.serpDifficulty += 5;
  if (input.serpFeatures.aiOverview) factors.serpDifficulty += 10;
  if (input.serpFeatures.hasGiantCompetitors) factors.serpDifficulty += 25;

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 4: Search Intent Alignment
  // Transactional keywords are harder (need links, harder to get backlinks)
  // Mismatched intent = almost impossible to rank
  // ─────────────────────────────────────────────────────────────────────────
  
  const intentDifficulty = {
    informational: 0,
    navigational: 10,
    commercial: 15,
    transactional: 20
  };
  factors.intentDifficulty = intentDifficulty[input.searchIntent];

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 5: YMYL Penalty
  // Google requires HIGHEST E-E-A-T for YMYL content
  // +25 difficulty AND timeline extension
  // ─────────────────────────────────────────────────────────────────────────
  
  if (input.isYMYL) {
    factors.ymylPenalty = 25; // Significant penalty
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 6: Local Bonus
  // Local keywords are easier (less competition, geographic constraint)
  // ─────────────────────────────────────────────────────────────────────────
  
  if (input.isLocal) {
    factors.localBonus = 15;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FACTOR 7: Domain Age / Sandbox Effect
  // New domains face 6-12 month delays even for excellent content
  // Research: avg #1 page is 5 years old (up from 2 years in 2017)
  // ─────────────────────────────────────────────────────────────────────────
  
  if (input.domainAgeMonths < 12) {
    factors.sandboxPenalty = 20; // New domain, significant penalty
  } else if (input.domainAgeMonths < 24) {
    factors.sandboxPenalty = 10; // Still relatively new
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPOSITE SCORE (weighted by research correlation data)
  // ─────────────────────────────────────────────────────────────────────────
  
  const compositeScore = Math.min(100, Math.max(0,
    factors.personalizedKD * 0.25 +      // Base difficulty (reduced weight)
    factors.domainGapPenalty * 0.35 +    // DA gap (PRIMARY factor per research)
    factors.serpDifficulty * 0.15 +      // SERP competition
    factors.intentDifficulty * 0.10 +    // Intent difficulty
    factors.ymylPenalty +                // Full penalty, not weighted
    factors.sandboxPenalty -             // Full penalty
    factors.localBonus                   // Full bonus
  ));

  // ─────────────────────────────────────────────────────────────────────────
  // VERDICT (more conservative thresholds based on research)
  // Research: Only 1.74% of newly published pages rank top 10 within a year
  // ─────────────────────────────────────────────────────────────────────────
  
  let verdict: 'feasible' | 'challenging' | 'difficult' | 'unlikely';
  if (compositeScore <= 30) verdict = 'feasible';
  else if (compositeScore <= 50) verdict = 'challenging';
  else if (compositeScore <= 70) verdict = 'difficult';
  else verdict = 'unlikely';

  // ─────────────────────────────────────────────────────────────────────────
  // TIMELINE (research-backed, conservative)
  // ─────────────────────────────────────────────────────────────────────────
  
  const baseTimelines = {
    feasible: { min: 3, max: 6 },
    challenging: { min: 6, max: 12 },
    difficult: { min: 9, max: 18 },
    unlikely: { min: 12, max: 24 }
  };
  
  let timeline = { ...baseTimelines[verdict] };
  const caveats: string[] = [];
  
  // YMYL adds 3-6 months
  if (input.isYMYL) {
    timeline.min += 3;
    timeline.max += 6;
    caveats.push('YMYL niche requires additional E-E-A-T building time');
  }
  
  // Sandbox adds 3-6 months for new domains
  if (input.domainAgeMonths < 12) {
    timeline.min += 3;
    timeline.max += 6;
    caveats.push('New domain may face Google sandbox delay');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESOURCE REQUIREMENTS (based on research)
  // KD 30-40 needs 25-40 links, KD 50+ needs 50-100 links
  // ─────────────────────────────────────────────────────────────────────────
  
  const baseBacklinks = 
    input.keywordDifficulty < 30 ? 10 :
    input.keywordDifficulty < 50 ? 30 :
    input.keywordDifficulty < 70 ? 75 : 150;
  
  const gapMultiplier = 1 + (Math.max(0, daGap) / 50);
  
  const requirements = {
    backlinksNeeded: Math.ceil(baseBacklinks * gapMultiplier),
    contentWordCount: input.keywordDifficulty < 30 ? 1500 : input.keywordDifficulty < 50 ? 2500 : 4000,
    technicalFixesFirst: factors.serpDifficulty > 30
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIDENCE (based on data completeness)
  // ─────────────────────────────────────────────────────────────────────────
  
  let confidenceScore = 100;
  if (input.currentPosition === null) confidenceScore -= 20;
  if (input.relatedKeywordsRanked === 0) confidenceScore -= 15;
  if (input.domainAgeMonths < 6) confidenceScore -= 15;
  if (input.serpFeatures.hasGiantCompetitors) confidenceScore -= 10;
  
  const confidence: 'high' | 'medium' | 'low' = 
    confidenceScore >= 70 ? 'high' :
    confidenceScore >= 50 ? 'medium' : 'low';

  return {
    keyword: input.keyword,
    score: Math.round(compositeScore),
    verdict,
    confidence,
    timeline: {
      minMonths: timeline.min,
      maxMonths: timeline.max,
      caveats
    },
    requirements,
    factors
  };
}
```

#### Data Sources for Each Factor

| Factor | DataForSEO API | Notes |
|--------|----------------|-------|
| `keywordDifficulty` | Keyword Data API | `keyword_difficulty` field |
| `searchVolume` | Keyword Data API | `search_volume` field |
| `currentPosition` | Ranked Keywords API | Our position for this keyword |
| `ourDA` | Domain Analytics API | Domain authority |
| `competitorAvgDA` | SERP API + Domain Analytics | Average of top 10 DAs |
| `domainAgeMonths` | Domain Analytics API | `domain_info.creation_date` |
| `relatedKeywordsRanked` | Ranked Keywords API | Count in same cluster |
| `serpFeatures` | SERP API | `serp_info` object |
| `searchIntent` | **Grok 4.1 classification** | Not in DataForSEO |
| `isYMYL` | **Pattern matching + Grok** | Not in DataForSEO |
| `isLocal` | Keyword contains location | Simple regex |

#### Research Sources

- [Ahrefs: How Long Does It Take to Rank?](https://ahrefs.com/blog/how-long-does-it-take-to-rank-in-google/) — Only 1.74% rank top 10 in a year
- [Backlinko: 11.8M Search Results Study](https://backlinko.com/search-engine-ranking) — DA correlation data
- [Semrush: Personal Keyword Difficulty](https://www.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated) — PKD methodology
- [seoClarity: Page Strength Correlation](https://www.seoclarity.net/blog/keyword-difficulty) — KD vs ranking correlation
- [OXY Digital: Keyword Prioritization](https://www.oxy.digital/how-we-actually-prioritize-keywords-and-why-most-agencies-get-it-wrong/) — Agency scoring formula
```

### 5.4 Database Schema

```sql
-- Chat sessions
CREATE TABLE seo_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  prospect_id UUID REFERENCES prospects(id),
  prospect_domain TEXT,
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'converted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_sessions_workspace ON seo_chat_sessions(workspace_id);
CREATE INDEX idx_sessions_prospect ON seo_chat_sessions(prospect_id);

-- Chat messages
CREATE TABLE seo_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  intent TEXT,
  extracted_context JSONB DEFAULT '{}',
  tool_calls JSONB DEFAULT '[]',
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON seo_chat_messages(session_id);
CREATE INDEX idx_messages_created ON seo_chat_messages(created_at);

-- Chat analyses (cached results)
CREATE TABLE seo_chat_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES seo_chat_sessions(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  cost_micros INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_analyses_cache ON seo_chat_analyses(session_id, analysis_type, input_hash);

-- Workspace settings (JSONB columns)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS seo_chat_settings JSONB DEFAULT '{
  "feasibility": {
    "feasibleThreshold": 40,
    "challengingThreshold": 60,
    "ymylPenaltyPoints": 15,
    "localBonusPoints": 10
  },
  "packages": {
    "tiers": ["pamatas", "augimas", "autoritetas"],
    "defaultTier": "augimas"
  },
  "proposal": {
    "expiryDays": 14,
    "language": "lt"
  },
  "response": {
    "tone": "professional",
    "language": "lt"
  }
}';
```

### 5.10 API Endpoints

```typescript
// ============================================================================
// MAIN CHAT ENDPOINT (Vercel AI SDK)
// POST /api/seo-chat
// ============================================================================
// See Section 5.3 for full implementation
// Uses streamText() with tool calling

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// GET /api/seo-chat/sessions
// List all sessions for workspace
export async function GET(req: Request) {
  const sessions = await db.query.seoChatSessions.findMany({
    where: eq(seoChatSessions.workspaceId, workspaceId),
    orderBy: desc(seoChatSessions.updatedAt),
    limit: 50,
  });
  return Response.json(sessions);
}

// POST /api/seo-chat/sessions
// Create new session
export async function POST(req: Request) {
  const { prospectDomain } = await req.json();
  const session = await db.insert(seoChatSessions).values({
    workspaceId,
    prospectDomain,
    status: 'active',
  }).returning();
  return Response.json(session[0]);
}

// GET /api/seo-chat/sessions/[id]
// Get session with messages
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await db.query.seoChatSessions.findFirst({
    where: eq(seoChatSessions.id, params.id),
    with: {
      messages: { orderBy: asc(seoChatMessages.createdAt) },
      analyses: true,
    },
  });
  return Response.json(session);
}

// DELETE /api/seo-chat/sessions/[id]
// Archive session (soft delete)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await db.update(seoChatSessions)
    .set({ status: 'archived' })
    .where(eq(seoChatSessions.id, params.id));
  return new Response(null, { status: 204 });
}

// ============================================================================
// PROPOSAL ENDPOINTS
// ============================================================================

// POST /api/seo-chat/proposals/generate
// Generate proposal from session (also callable via tool)
export async function POST(req: Request) {
  const { sessionId, package: pkg, email } = await req.json();
  
  const session = await getSessionWithDraft(sessionId);
  const proposal = await createProposal({
    sessionId,
    domain: session.prospectDomain,
    package: pkg,
    keywords: session.proposalDraft.keywords,
    email,
  });
  
  return Response.json({
    magicLink: `${process.env.NEXT_PUBLIC_URL}/p/${proposal.token}`,
    expiresAt: proposal.expiresAt,
    proposalId: proposal.id,
  });
}

// GET /api/seo-chat/proposals/[token]
// Public endpoint for magic link (no auth)
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.token, params.token),
    with: { keywords: true, session: true },
  });
  
  if (!proposal || proposal.expiresAt < new Date()) {
    return Response.json({ error: 'Proposal expired' }, { status: 410 });
  }
  
  // Track view
  await trackProposalView(proposal.id);
  
  return Response.json(proposal);
}

// ============================================================================
// SETTINGS ENDPOINT
// ============================================================================

// GET/PATCH /api/seo-chat/settings
export async function GET(req: Request) {
  const workspace = await getWorkspace();
  return Response.json(workspace.seoChatSettings ?? DEFAULT_SEO_CHAT_SETTINGS);
}

export async function PATCH(req: Request) {
  const updates = await req.json();
  await db.update(workspaces)
    .set({ seoChatSettings: sql`seo_chat_settings || ${updates}::jsonb` })
    .where(eq(workspaces.id, workspaceId));
  return Response.json({ success: true });
}
```

---

## 6. Component Mapping

### 6.1 Reuse Summary

| Layer | Components | Reuse % |
|-------|------------|---------|
| Foundation (v6 primitives) | Card, Button, Badge, Input, Dialog, Sheet | 100% |
| Typography | NumMega, NumCard, Eyebrow, Body, Mono | 100% |
| Page Components | ProgressBar, StatusChip, MetricCard, HealthGauge | 90% |
| Analysis Components | AnalysisProgress, AnalysisResults | 70% |
| Chat-Specific | ChatInput, ChatMessage, TopicalMapView | 0% (new) |
| Proposal Portal | ProposalPreview, ServiceLineItems | 80% |

### 6.2 New Components Required

| Component | Priority | Complexity | Description |
|-----------|----------|------------|-------------|
| `ChatPanel` | P0 | High | Main chat container with 3-column layout |
| `ChatInput` | P0 | Medium | Multi-modal input with @-mentions |
| `ChatMessage` | P0 | Medium | Message bubbles with variants |
| `ChatMessageList` | P0 | Low | Scrollable message container |
| `DomainHealthCard` | P1 | Low | Inline domain health display |
| `FeasibilityCard` | P1 | Low | Keyword feasibility results |
| `TopicalMapView` | P1 | High | React Flow visualization |
| `SuggestionChips` | P1 | Low | Quick action suggestions |
| `ProposalSlideOver` | P1 | Medium | Proposal generation panel |
| `StripeCheckout` | P2 | Medium | Embedded payment form |
| `PostPaymentSuccess` | P2 | Low | Success screen with next steps |

### 6.3 New Hooks Required

| Hook | Priority | Description |
|------|----------|-------------|
| `useSEOChat` | P0 | Wraps Vercel AI SDK `useChat` with SEO-specific helpers (see Section 5.4) |
| `useProposalDraft` | P0 | Zustand store hook for proposal state (see Section 5.5) |
| `useSession` | P0 | Session context management, domain/keywords tracking |
| `useChatSuggestions` | P1 | Contextual quick action chips based on conversation state |
| `useToolProgress` | P1 | Extract and display tool execution progress from stream |

### 6.4 File Structure (Vercel AI SDK Architecture)

```
apps/web/src/
├── app/
│   ├── (dashboard)/
│   │   └── seo-chat/
│   │       ├── page.tsx                    # Chat page (3-column layout)
│   │       └── settings/page.tsx           # Chat settings UI
│   ├── (public)/
│   │   └── p/
│   │       └── [token]/page.tsx            # Prospect proposal portal
│   └── api/
│       └── seo-chat/
│           ├── route.ts                    # Main chat endpoint (Vercel AI SDK streamText)
│           ├── sessions/
│           │   ├── route.ts                # List/create sessions
│           │   └── [id]/route.ts           # Get/delete session
│           ├── proposals/
│           │   ├── generate/route.ts       # Generate proposal
│           │   └── [token]/route.ts        # Public proposal data
│           └── settings/route.ts           # Workspace settings
├── components/
│   └── seo-chat/
│       ├── ChatPanel.tsx                   # Main 3-column container
│       ├── ChatInput.tsx                   # Multi-modal input (@-mentions, file upload)
│       ├── ChatMessage.tsx                 # Message bubble with tool result cards
│       ├── ChatMessageList.tsx             # Virtualized message list
│       ├── ChatHeader.tsx                  # Session tabs, title
│       ├── ChatSuggestions.tsx             # Quick action chips
│       ├── ProspectContext.tsx             # Right rail context panel
│       ├── tool-cards/                     # Tool result rendering
│       │   ├── DomainHealthCard.tsx
│       │   ├── KeywordAnalysisCard.tsx
│       │   ├── FeasibilityCard.tsx
│       │   └── ProposalGeneratedCard.tsx
│       ├── visualization/
│       │   └── TopicalMapView.tsx          # React Flow visualization
│       └── proposal/
│           ├── ProposalSlideOver.tsx       # Proposal config panel
│           ├── KeywordSelector.tsx         # Keyword selection for proposal
│           └── PackageSelector.tsx         # Package tier selection
├── lib/
│   └── seo-chat/
│       ├── tools/                          # Vercel AI SDK tool definitions
│       │   ├── index.ts                    # Export all tools
│       │   ├── domain-health.ts            # domain_health tool + executor
│       │   ├── keyword-analysis.ts         # keyword_analysis tool + executor
│       │   ├── feasibility-check.ts        # feasibility_check tool + executor
│       │   ├── add-to-proposal.ts          # add_to_proposal tool
│       │   └── generate-proposal.ts        # generate_proposal tool
│       ├── executors/                      # Analysis execution logic
│       │   ├── domain-health.executor.ts   # DataForSEO domain analytics
│       │   ├── keyword-discovery.executor.ts
│       │   └── feasibility.executor.ts     # Evidence-based formula (Section 5.8)
│       ├── types.ts                        # SessionContext, ProposalDraft types
│       ├── session.ts                      # Session CRUD, context merging
│       └── proposal.ts                     # Proposal creation, magic link
├── stores/
│   ├── proposalDraftStore.ts               # Zustand: proposal draft state
│   └── sessionStore.ts                     # Zustand: current session context
└── hooks/
    ├── useSEOChat.ts                       # Wraps useChat with helpers
    ├── useProposalDraft.ts                 # Re-export from store
    ├── useSession.ts                       # Session context hook
    └── useToolProgress.ts                  # Tool execution progress
```

### 6.5 v7 Design Architecture Integration

> **Source**: v7-master-design-architecture.md analysis via 5 parallel Opus agents
> **Goal**: Unified world-class UI/UX across all TeveroSEO surfaces

#### 6.5.1 Three-Column Shell Alignment

SEO Chat integrates into the existing v7 shell without layout changes:

| Zone | v7 Standard | SEO Chat Implementation |
|------|-------------|-------------------------|
| **Sidebar** | 232-272px, nav + workspace | Unchanged — Dashboard, SEO Chat, Clients, etc. |
| **Main Content** | `minmax(0, 1fr)` fluid | Chat panel with session tabs in Utility Bar zone |
| **Right Rail** | 320-380px, contextual | **Transforms** to Prospect Context panel |

**Critical Rule**: Chat header with session tabs sits in the **Utility Bar zone** (below the page header, above the content area), not floating inside the chat panel. This maintains v7 information hierarchy.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PAGE HEADER: SEO Chat                                          [Settings ⚙] │
├─────────────────────────────────────────────────────────────────────────────┤
│ UTILITY BAR: [groziosalon.lt] [plaukupasaka.lt] [+ New Session]             │
├──────────────┬───────────────────────────────────────┬──────────────────────┤
│   SIDEBAR    │         CHAT CONTENT                  │  PROSPECT CONTEXT    │
│              │   (messages, tool cards, input)       │  (Right Rail)        │
└──────────────┴───────────────────────────────────────┴──────────────────────┘
```

#### 6.5.2 Autonomy/Control Matrix (Per-Tool)

v7 defines a Trust Formula: **Trust = Visibility × Reversibility × Predictability**

Each SEO Chat tool scored against this matrix:

| Tool | Action Type | Visibility | Reversibility | Predictability | Trust Score | UX Treatment |
|------|-------------|------------|---------------|----------------|-------------|--------------|
| `domain_health` | Query (read-only) | ✓ Shows metrics | ✓ No side effects | ✓ Deterministic | **95%** | Auto-execute on domain detection |
| `keyword_analysis` | Query + cost | ✓ Count visible | ✓ No side effects | ✓ Count-based | **90%** | Show cost estimate, auto-execute |
| `feasibility_check` | Query + cost | ✓ Keywords listed | ✓ No side effects | ✓ Formula-based | **85%** | Auto-execute, explain formula |
| `add_to_proposal` | Accumulate state | ✓ Shows what's added | ✓ Can remove items | △ Filter varies | **75%** | Show preview, confirm on large adds |
| `generate_proposal` | Create external artifact | △ Preview only | ✗ Can't un-send link | △ AI narrative | **55%** | **ALWAYS CONFIRM** with preview |

**Implementation Rules**:
- Score ≥85%: Execute immediately with progress indicator
- Score 75-84%: Execute with expandable preview, toast notification
- Score <75%: **Confirmation dialog** before execution

```typescript
// Trust-based execution in useSEOChat hook
const TRUST_THRESHOLDS = {
  IMMEDIATE: 85,    // No confirmation, show progress
  PREVIEW: 75,      // Show preview, one-click confirm
  CONFIRM: 0,       // Full confirmation dialog
};

function shouldConfirm(toolName: string): 'immediate' | 'preview' | 'confirm' {
  const scores: Record<string, number> = {
    domain_health: 95,
    keyword_analysis: 90,
    feasibility_check: 85,
    add_to_proposal: 75,
    generate_proposal: 55,
  };
  const score = scores[toolName] || 50;
  if (score >= TRUST_THRESHOLDS.IMMEDIATE) return 'immediate';
  if (score >= TRUST_THRESHOLDS.PREVIEW) return 'preview';
  return 'confirm';
}
```

#### 6.5.3 Analysis Cards (v6 Typography System)

All tool result cards use the v6 design-system typography hierarchy:

| Element | Token | CSS | Usage |
|---------|-------|-----|-------|
| **NumMega** | `--text-num-mega` | `font-size: 32px; font-family: Geist Mono` | Hero metrics (DA, DR, Traffic) |
| **NumCard** | `--text-num-card` | `font-size: 24px; font-family: Geist Mono` | Secondary metrics in cards |
| **Eyebrow** | `--text-eyebrow` | `font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase` | Card labels |
| **Body** | `--text-body` | `font-size: 14px; line-height: 1.5` | Descriptions, explanations |
| **Mono** | `--text-mono` | `font-size: 13px; font-family: Geist Mono` | Keywords, domains, code |

**Card Hover Behavior** (v6 §4.2):
```css
.analysis-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.analysis-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-ghost-edge-hover); /* 0 4px 12px rgba(0,0,0,0.08) */
}
```

**DomainHealthCard Example**:
```tsx
<Card className="analysis-card">
  <CardHeader>
    <span className="text-eyebrow">DOMAIN HEALTH</span>
    <span className="text-mono text-muted-foreground">{domain}</span>
  </CardHeader>
  <CardContent className="grid grid-cols-3 gap-4">
    <div>
      <span className="text-eyebrow">DA</span>
      <span className="text-num-mega">{domainAuthority}</span>
    </div>
    <div>
      <span className="text-eyebrow">TRAFFIC</span>
      <span className="text-num-mega">{formatNumber(traffic)}/mo</span>
    </div>
    <div>
      <span className="text-eyebrow">KEYWORDS</span>
      <span className="text-num-mega">{rankedKeywords}</span>
    </div>
  </CardContent>
  <CardFooter className="text-body text-muted-foreground">
    {summaryText}
  </CardFooter>
</Card>
```

#### 6.5.4 Right Rail Transformation

In SEO Chat, the Right Rail **transforms** from generic context to **Prospect Context Panel**:

```tsx
// components/seo-chat/ProspectContext.tsx
interface ProspectContextProps {
  domain: string | null;
  metrics: {
    da: number;
    dr: number;
    traffic: number;
  } | null;
  proposalDraft: {
    keywordCount: number;
    package: string | null;
    estimatedCost: number;
  };
}

export function ProspectContext({ domain, metrics, proposalDraft }: ProspectContextProps) {
  return (
    <aside className="w-[320px] border-l bg-muted/30 p-4 space-y-6">
      {/* Domain Section */}
      <section>
        <h3 className="text-eyebrow mb-2">DOMAIN</h3>
        {domain ? (
          <>
            <p className="text-mono font-medium">{domain}</p>
            {metrics && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <MetricPill label="DA" value={metrics.da} />
                <MetricPill label="DR" value={metrics.dr} />
                <MetricPill label="Traffic" value={formatK(metrics.traffic)} />
              </div>
            )}
          </>
        ) : (
          <p className="text-body text-muted-foreground">No domain detected yet</p>
        )}
      </section>

      <Separator />

      {/* Proposal Draft Section */}
      <section>
        <h3 className="text-eyebrow mb-2">PROPOSAL DRAFT</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-body text-muted-foreground">Keywords</span>
            <span className="text-num-card">{proposalDraft.keywordCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-body text-muted-foreground">Package</span>
            <span className="text-body font-medium">{proposalDraft.package || '—'}</span>
          </div>
        </div>
        
        {proposalDraft.keywordCount > 0 && (
          <Button 
            className="w-full mt-4" 
            onClick={() => /* trigger generate_proposal */}
          >
            Generate Proposal
          </Button>
        )}
      </section>
    </aside>
  );
}
```

#### 6.5.5 Trust-Building Patterns

v7 mandates progressive disclosure and trust-building. SEO Chat implements:

**1. Today Feed Events** (Activity log integration):
```typescript
// Log significant chat events to the unified activity feed
interface ChatActivityEvent {
  type: 'seo_chat_analysis' | 'seo_chat_proposal' | 'seo_chat_conversion';
  sessionId: string;
  domain: string;
  action: string;
  costMicros?: number;
  timestamp: Date;
}

// Events logged:
// - "Analyzed 100 keywords for groziosalon.lt" (keyword_analysis)
// - "Generated AUGIMAS proposal for groziosalon.lt" (generate_proposal)  
// - "groziosalon.lt converted to client" (payment success)
```

**2. Ops Strip Equivalent** (Per-session status bar):
```tsx
// Inline status strip below chat input
<div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-t">
  <span>Session: {sessionDuration}</span>
  <span>•</span>
  <span>Analyses: {analysisCount}</span>
  <span>•</span>
  <span>Cost: ${totalCost.toFixed(2)}</span>
  {proposalGenerated && (
    <>
      <span>•</span>
      <Badge variant="outline" className="text-xs">Proposal Sent</Badge>
    </>
  )}
</div>
```

**3. Up Next Suggestions** (Contextual guidance):
```typescript
// After each tool completes, suggest logical next step
function getUpNextSuggestion(lastTool: string, context: SessionContext): Suggestion | null {
  switch (lastTool) {
    case 'domain_health':
      return {
        text: "Run keyword analysis?",
        action: () => analyzeKeywords(context.settings.defaultKeywordCount),
        rationale: "Domain looks healthy — find keyword opportunities"
      };
    case 'keyword_analysis':
      return {
        text: "Check feasibility for top keywords?",
        action: () => checkFeasibility(topKeywords.slice(0, 10)),
        rationale: `Found ${keywordCount} keywords — validate the best ones`
      };
    case 'feasibility_check':
      return {
        text: "Add feasible keywords to proposal?",
        action: () => addToProposal({ filter: 'feasible' }),
        rationale: `${feasibleCount} feasible keywords ready`
      };
    case 'add_to_proposal':
      return {
        text: "Generate proposal?",
        action: () => generateProposal(context.draft.package),
        rationale: `${context.draft.keywords.length} keywords selected`
      };
    default:
      return null;
  }
}
```

**4. Quality Gate Transparency** (Feasibility formula visibility):
```tsx
// On hover/expand of feasibility result, show formula breakdown
<FeasibilityCard 
  keyword={keyword}
  result={result}
  expandedContent={
    <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
      <p className="font-medium mb-1">How we calculated this:</p>
      <ul className="space-y-1">
        <li>KD: {result.kd} → {result.kdScore} pts</li>
        <li>DA Gap: {result.daGap} → {result.daGapScore} pts</li>
        <li>Authority: {result.authorityScore} pts</li>
        <li>SERP: {result.serpAdjustment} pts</li>
        <li className="font-medium pt-1 border-t">
          Final: {result.finalScore} = {result.verdict}
        </li>
      </ul>
    </div>
  }
/>
```

#### 6.5.6 Responsive Behavior

v7 defines breakpoints. SEO Chat adapts:

| Breakpoint | Sidebar | Main | Right Rail |
|------------|---------|------|------------|
| `≥1440px` | 272px | fluid | 380px |
| `1280-1439px` | 232px | fluid | 320px |
| `1024-1279px` | 232px | fluid | **Collapsed** (icon trigger) |
| `<1024px` | **Drawer** | full | **Sheet** (bottom) |

```tsx
// Responsive Right Rail
const ProspectContextResponsive = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWide = useMediaQuery('(min-width: 1280px)');
  
  if (!isDesktop) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed bottom-4 right-4">
            <InfoIcon />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[60vh]">
          <ProspectContext {...props} />
        </SheetContent>
      </Sheet>
    );
  }
  
  if (!isWide) {
    return (
      <Collapsible>
        <CollapsibleTrigger className="w-12 border-l flex items-center justify-center">
          <ChevronLeftIcon />
        </CollapsibleTrigger>
        <CollapsibleContent className="w-[320px]">
          <ProspectContext {...props} />
        </CollapsibleContent>
      </Collapsible>
    );
  }
  
  return <ProspectContext {...props} />;
};
```

---

## 7. Conversion Optimization

### 7.1 Friction Reduction Checklist

| Friction Point | Solution | Priority |
|----------------|----------|----------|
| "Is this legit?" on link click | Branded short domain, prospect's name in preview | P0 |
| Slow page load | Edge-cached static page, skeleton loaders | P0 |
| Jargon-heavy content | Business outcome language throughout | P0 |
| Price shock | Value anchoring table (agency rates vs ours) | P0 |
| No trust signals | Guarantee visible above fold | P0 |
| Payment plan hidden | Display by default with "BE PABRANGIMO" | P0 |
| Package paralysis | Pre-select "Most Popular" with highlight | P1 |
| Can't ask questions | SEO Chat widget in proposal portal | P1 |
| Mobile unfriendly | Single column, collapsible sections, sticky CTA | P1 |
| Post-payment uncertainty | Immediate value delivery (audit summary) | P1 |

### 7.2 Trust Acceleration

**The Trust Formula (v7 Architecture):**
```
User Trust = Visibility × Reversibility × Predictability
```

| Factor | Implementation |
|--------|----------------|
| **Visibility** | "This is YOUR data" - show scrape date, data sources |
| **Reversibility** | Money-back guarantee, no lock-in, exit path documented |
| **Predictability** | Timeline visualization, clear decision points, no surprises |

### 7.3 Lithuanian Market Insights

From real conversion data (Karolina/plaukupasaka.lt €3,500 closed):

| Insight | Application |
|---------|-------------|
| "Be pabrangimo" is critical | Display on all payment plan options |
| Economic logic > moral claims | Guarantee framed as "we can't afford to fail" |
| Past agency burns acknowledged | "Suprantame — agentūros nuvylė" section |
| Payment flexibility proactive | Show plans before they ask |
| Post-service independence | "Po 6 mėn. — geriausių praktikų dokumentas" |

### 7.4 Objection Pre-handling

| Objection | Pre-handle Location | Content |
|-----------|---------------------|---------|
| "Ar tai black SEO?" | Trust badge above fold | "100% balta — mūsų garantija mus sužlugdytų jei rizikuotume" |
| "Neturite case studies" | Guarantee section | "Turime kažką svarbesnio: garantiją raštu" |
| "Kaina labai maža" | Value anchoring table | Show agency rates comparison |
| "O kas po 6 mėnesių?" | Package details | "Geriausių praktikų dokumentas — nesate įkaitas" |
| "Ar dirbsite su konkurentu?" | Exclusivity policy | "Vienas klientas vienai nišai" |

---

## 8. Implementation Plan

### Week 1-2: Vercel AI SDK Foundation

**Deliverables:**
- [ ] Install dependencies: `ai`, `@ai-sdk/xai`, `@ai-sdk/google`, `zod`
- [ ] Database schema (seo_chat_sessions, seo_chat_messages, seo_chat_analyses)
- [ ] Main chat API route (`/api/seo-chat/route.ts`) with `streamText()`
- [ ] Tool definitions: `domain_health`, `keyword_analysis` (Zod schemas)
- [ ] Zustand stores: `proposalDraftStore`, `sessionStore`
- [ ] Basic ChatPanel, ChatInput, ChatMessage components
- [ ] `useSEOChat` hook wrapping Vercel AI SDK `useChat`

**Milestone:** Can send "check groziosalon.lt" and see domain health tool execute

### Week 3: Analysis Tools & Cards

**Deliverables:**
- [ ] Tool definitions: `feasibility_check`, `add_to_proposal`, `generate_proposal`
- [ ] Tool executors: DataForSEO integration for domain analytics, keyword data
- [ ] Evidence-based feasibility algorithm (Section 5.8)
- [ ] Tool result cards: DomainHealthCard, KeywordAnalysisCard, FeasibilityCard
- [ ] `onToolCall` handler for progress UI updates

**Milestone:** "Do 200 keywords analysis" works, "Can we rank for X?" returns feasibility

### Week 4: Proposal Flow & Context

**Deliverables:**
- [ ] ProposalSlideOver component with package selection
- [ ] KeywordSelector component (filter by feasibility, manual selection)
- [ ] `add_to_proposal` tool updates Zustand draft
- [ ] `generate_proposal` tool creates magic link
- [ ] Session context persistence and accumulation
- [ ] Multi-turn conversation (domain persists, keywords accumulate)

**Milestone:** Full conversation → proposal flow works end-to-end

### Week 5: Prospect Portal & Visualization

**Deliverables:**
- [ ] TopicalMapView (React Flow) with keyword clusters
- [ ] Prospect portal page (`/p/[token]`)
- [ ] Competitor comparison section (anonymized)
- [ ] Timeline visualization
- [ ] Payment options (Stripe Elements, installments)
- [ ] Mobile optimization (sticky CTA, collapsible sections)

**Milestone:** Prospect can view proposal and pay through magic link

### Week 6: Settings, Polish & Testing

**Deliverables:**
- [ ] Settings UI (language, thresholds, default package, cost tracking)
- [ ] Session tabs and history
- [ ] Keyboard shortcuts (Cmd+Enter, Cmd+P)
- [ ] Quick action suggestions (ChatSuggestions component)
- [ ] Error handling and retry logic
- [ ] Real prospect testing (5-10 test flows)

**Milestone:** Production-ready release

---

## 9. Decisions Made (Resolved)

### Technical Decisions (RESOLVED)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Chat Framework** | **Vercel AI SDK** | Native `@ai-sdk/xai` (Grok 4.1) + `@ai-sdk/google` (Gemini 3.1 Pro) support; CopilotKit requires custom adapters |
| **Intent Routing** | **LLM Tool Selection** | Variable parameters ("Do 100 keywords" vs "Do 200") handled naturally; no regex patterns needed |
| **State Management** | **Zustand** | `proposalDraftStore` for cross-command state accumulation |
| **Topical Map Library** | **React Flow** (9.2/10) | Used by n8n, Stripe; native React; built-in dark mode, touch, a11y |
| **Chat History Storage** | **PostgreSQL** | Auditable for disputes, persistent across devices |
| **Design System** | **v7 Architecture + v6 Typography** | Three-column shell, Trust Formula for tool autonomy, NumMega/NumCard metrics, ghost-edge shadows |
| **Right Rail** | **Transforms to Prospect Context** | Domain metrics + proposal draft visible at all times; collapses on narrow viewports |
| **Trust Pattern** | **85/75 Threshold Matrix** | ≥85% auto-execute, 75-84% preview confirm, <75% full dialog (generate_proposal = 55%) |

### Business Decisions (RESOLVED)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Feasibility Thresholds** | 30/50/70 (not 40/60) | Research-backed: only 1.74% rank top 10 in a year |
| **Proposal Flow** | **BOTH options** | Preview + Edit OR Instant generation |
| **Session Scope** | **Domain-centric** | One session = one prospect domain |

### Why Vercel AI SDK (Not CopilotKit)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FRAMEWORK COMPARISON                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Feature              │ CopilotKit          │ Vercel AI SDK                │
│  ─────────────────────┼─────────────────────┼─────────────────────────────  │
│  Grok 4.1 support     │ ❌ Custom adapter    │ ✅ @ai-sdk/xai native        │
│  Gemini 3.1 support   │ ⚠️ Custom adapter    │ ✅ @ai-sdk/google native     │
│  Tool calling         │ ✅ useCopilotAction  │ ✅ tool() with Zod           │
│  Streaming            │ ✅ AG-UI protocol    │ ✅ streamText()              │
│  Chat UI              │ ✅ Built-in          │ ❌ Bring your own            │
│  Complexity           │ Higher              │ Lower                         │
│  ─────────────────────┼─────────────────────┼─────────────────────────────  │
│                                                                             │
│  VERDICT: Vercel AI SDK wins because we use Grok + Gemini (not OpenAI),    │
│           and we already have custom chat UI components (shadcn/ui).        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposal Flow: Both Options Supported

```
Agency: "Generate proposal"
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  PROPOSAL PREVIEW                                           │
│  ───────────────────────────────────────────────────────────│
│  Package: AUGIMAS (€3,500)                                 │
│  Keywords: 47 assigned                                     │
│  ───────────────────────────────────────────────────────────│
│                                                             │
│  [Edit Before Sending]      [Generate & Copy Link NOW]     │
│          ↓                            ↓                    │
│    Human review                 Instant generation         │
│    (preview, tweak,             (magic link created        │
│     then generate)               immediately)              │
└─────────────────────────────────────────────────────────────┘
```

### Session Scope: Domain-Centric

**One Session = One Prospect Domain = One Proposal**

```
Session: groziosalon.lt
├── All analyses for groziosalon.lt
├── Competitor gaps stored in metadata.competitors[]
├── Keywords extracted
└── Proposal generated FOR groziosalon.lt only
```

**If prospect has multiple businesses:**
```
[Tab: groziosalon.lt] [Tab: mybakery.lt] [+New]
         │                    │
    Proposal €3,500      Proposal €2,500
    (separate)           (separate)
```

**Edge case: "Can you look at mybakery.lt too?"**
```
[Chat Response]:
Sure! I can analyze mybakery.lt — but it would need a separate proposal.

[Create New Session: mybakery.lt] ← Button

Would you like me to open a new tab for mybakery.lt?
```

### Technical Decisions (RESOLVED)

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Topical Map Library** | **React Flow** (9.2/10) | Used by n8n, Stripe; native React; built-in dark mode, touch, a11y |
| **Chat History Storage** | PostgreSQL | Auditable for disputes, persistent |
| **Feasibility Algorithm** | Evidence-based formula | See Section 5.3 — research-backed |

### React Flow: The Definitive Choice

**Why React Flow wins (9.2/10):**

| Factor | Score | Notes |
|--------|-------|-------|
| Visual Quality | 9/10 | Nodes ARE React components — full v6 design system |
| Dark Mode | Built-in | `colorMode="system"` prop |
| Mobile | Built-in | Touch gestures, pinch-zoom, drag |
| Layout | Dagre/ELK | Perfect for hierarchical keyword clusters |
| Performance | 9/10 | 400 nodes trivial; only changed nodes re-render |
| Accessibility | 8/10 | Keyboard nav, ARIA labels, customizable |
| Used By | Production | n8n, Stripe |

**Why NOT others:**
- D3.js: Overkill complexity, conflicts with React DOM
- Cytoscape.js: Canvas-based = harder to match v6 glass cards
- Sigma.js: WebGL = accessibility issues, overkill for 50-400 keywords

### Remaining Spike (Recommended)

**Feasibility Calibration Spike** (2-3 days)
- Test new evidence-based algorithm against 10 real prospect domains
- Compare predictions to actual outcomes (if historical data available)
- Adjust thresholds based on agency's risk tolerance

---

## References

| Document | Purpose |
|----------|---------|
| `.planning/design/v7-master-design-architecture.md` | Design architecture, autonomy/control balance |
| `.planning/design/design-system-v6.md` | Visual design tokens, components |
| `.planning/phases/98-general-seo-chat/PHASE-98-COMPLETE-SPEC.md` | Full technical spec (reference, not source of truth) |
| `.planning/phases/98-general-seo-chat/WORLD-CLASS-VERDICT.md` | Scope decision: 3-analysis MVP |
| `.planning/proposal-manual-v1/value-stack-analysis/` | Lithuanian market insights, conversion data |
| `CLAUDE.md` | Model architecture (Grok 4.1, Gemini 3.1 Pro) |

---

*Generated: 2026-05-12*
*Status: Ready for implementation*
*Estimated effort: 5-6 weeks*
