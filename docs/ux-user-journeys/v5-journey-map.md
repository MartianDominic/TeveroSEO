# TeveroSEO User Journey Map

> **Purpose**: Map all user journeys to design components, identifying what v6 covers vs what needs additional design
> **Foundation**: v6 prototype shows the populated "destination" state
> **Approach**: Layer overlays, modals, empty states, and error states on top of v6

---

## Design Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Error/Warning States (banners, toasts, badges)        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Drill-Down Modals (findings, keywords, quality gate)  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: In-Progress Overlays (generation, audit, sync)        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Empty State Variants (per component)                  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Onboarding Overlays (welcome, tour, checklist)        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 0: v6 Populated State (the destination)            ✅    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 1: New User → First Value

**Persona**: Agency owner just signed up, has no clients yet

### Flow
```
Sign Up → Empty Dashboard → Welcome Modal → Setup Wizard →
Connect GSC → Create Client → Run Intelligence → See First Data → 
Celebration
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Sign up complete | Redirect to /clients | - | Existing |
| 2. Empty dashboard | v6 shell with all sections empty | **Empty state variants** | NEEDS DESIGN |
| 3. Welcome modal | Overlay on empty dashboard | **Welcome modal** | NEEDS DESIGN |
| 4. Setup wizard | Step-through modal (5 steps) | **Wizard modal** | NEEDS DESIGN |
| 5. Connect GSC | OAuth popup + property selector | **Property selector modal** | NEEDS DESIGN |
| 6. Create client | Form modal with business type | **Client creation modal** | NEEDS DESIGN |
| 7. Run intelligence | Progress overlay on dashboard | **Progress stepper overlay** | NEEDS DESIGN |
| 8. First data appears | v6 populated state (partial) | v6 prototype | ✅ EXISTS |
| 9. Celebration | Success toast + confetti | **Celebration component** | NEEDS DESIGN |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                      WELCOME MODAL                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👋 Welcome to TeveroSEO                                  │  │
│  │                                                           │  │
│  │  Let's get your first client ranking in under 5 minutes. │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Start Setup    │  │  Explore Demo   │                │  │
│  │  │  (5 min)        │  │  (skip setup)   │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    SETUP WIZARD MODAL                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Step 2 of 5: Connect Google Search Console               │  │
│  │  ────●────●────○────○────○────                            │  │
│  │                                                           │  │
│  │  [Google icon] Connect with Google                        │  │
│  │                                                           │  │
│  │  Why? See your real search performance, keywords,         │  │
│  │  and submit URLs for faster indexing.                     │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐                        │  │
│  │  │  ← Back     │  │  Skip →     │                        │  │
│  │  └─────────────┘  └─────────────┘                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 2: Daily Check-In (Power User)

**Persona**: Agency owner with 15 clients, checking in at 9 AM

### Flow
```
Open App → See Overnight Summary → Scan Goal Progress → 
Check Alerts → Quick-Switch to At-Risk Client → Take Action → 
Next Client → Done
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Open app | Last viewed client dashboard | v6 prototype | ✅ EXISTS |
| 2. Overnight summary | Banner at top of Today rail | **Overnight banner** | NEEDS DESIGN |
| 3. Scan goal progress | Goal hero (12/20, On Track) | v6 goal hero | ✅ EXISTS |
| 4. Check alerts | Red badge on notification bell | v6 utility bar | ✅ EXISTS |
| 5. Quick-switch | Cmd+J → fuzzy search clients | **Client quick-switcher** | NEEDS DESIGN |
| 6. At-risk client | Dashboard with warning states | **Warning state variants** | NEEDS DESIGN |
| 7. Take action | Inline action buttons | v6 "Up next" section | ✅ EXISTS |
| 8. Next client | Client switcher dropdown | v6 sidebar | ✅ EXISTS |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   OVERNIGHT SUMMARY BANNER                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🌙 While you were away                              [×]  │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  3 articles generated · 2 published · 47 links inserted   │  │
│  │  5 URLs submitted to GSC · 1 client needs attention       │  │
│  │                                          [See details →]  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  CLIENT QUICK-SWITCHER (Cmd+J)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔍 Switch to client...                              ⌘J   │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  ⚠️ Acme Corp          acmecorp.com       Goal at risk    │  │
│  │  ✓  TechStart          techstart.io       On track        │  │
│  │  ✓  Local Plumber      plumber.com        On track        │  │
│  │  ⚠️ Fashion Store      fashion.co         3 issues        │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  Recent · All clients · At risk only                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 3: Audit Finding → Resolution

**Persona**: SEO specialist fixing technical issues

### Flow
```
See Audit Card (12 open) → Drill Into Findings → See Specific Issue →
Click "Fix" → Pre-filled Content Editor → Generate Article →
Quality Gate Review → Publish → Re-verify with Audit
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. See audit card | "12 open - 3 critical" with tier grid | v6 audit card | ✅ EXISTS |
| 2. Click to drill down | Expandable panel or modal | **Findings list modal** | NEEDS DESIGN |
| 3. See specific issue | Issue detail with URL, description | **Finding detail row** | NEEDS DESIGN |
| 4. Click "Fix with content" | Action button on finding | **Fix action button** | NEEDS DESIGN |
| 5. Content editor | Pre-filled with fix context | Articles page (existing) | PARTIAL |
| 6. Generate | Progress stepper overlay | **Generation progress** | NEEDS DESIGN |
| 7. Quality gate review | Score breakdown panel | **Quality gate panel** | NEEDS DESIGN |
| 8. Publish | Confirmation toast | Toast component | NEEDS DESIGN |
| 9. Re-verify | "Run audit" action | v6 "Run audit" button | ✅ EXISTS |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   AUDIT FINDINGS MODAL                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Audit Findings                    12 open · 3 critical   │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  Filter: [All ▾] [Critical ▾] [Tier 1 ▾]    🔍 Search     │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  🔴 Missing H1 tag                              Tier 1    │  │
│  │     /products/running-shoes                               │  │
│  │     [View page] [Fix with content] [Ignore]               │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  🔴 Core Web Vitals: LCP > 4.0s                 Tier 1    │  │
│  │     /blog/*, /products/* (14 pages)                       │  │
│  │     [View details] [Fix instructions]                     │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  🟡 Missing meta descriptions                   Tier 2    │  │
│  │     14 pages affected                                     │  │
│  │     [View all] [Auto-fix] [Ignore]                        │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  🟡 Images missing alt text                     Tier 2    │  │
│  │     /blog/seo-guide, /about (23 images)                   │  │
│  │     [View all] [Fix with content]                         │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   QUALITY GATE PANEL                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Quality Gate: 84/100                        ✓ PASSED     │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  Threshold: 80 (configurable in settings)                 │  │
│  │                                                           │  │
│  │  ████████████████████░░░░  Readability        85          │  │
│  │  ███████████████████░░░░░  Keyword Density    79          │  │
│  │  █████████████████████░░░  E-E-A-T Signals    88          │  │
│  │  ████████████████████░░░░  Originality        82          │  │
│  │  █████████████████████░░░  Voice Match        86          │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Edit Article   │  │  Auto-Publish   │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 4: Keyword Opportunity → Published Article

**Persona**: Content strategist finding quick wins

### Flow
```
See "Quick Wins" Section → Click Keyword → See Detail →
Click "Create Article" → Configure Options → Generate →
Review → Publish → Monitor in Activity
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. See quick wins | Forecast diagnostics section | v6 diagnostics | ✅ EXISTS |
| 2. Click keyword row | Row highlight + expand icon | v6 table row | ✅ EXISTS |
| 3. See keyword detail | Expanded row or modal | **Keyword detail panel** | NEEDS DESIGN |
| 4. Click "Create Article" | Action button | v6 row actions | ✅ EXISTS |
| 5. Configure options | Article creation modal | **Article config modal** | NEEDS DESIGN |
| 6. Generate | Progress stepper | **Generation progress** | NEEDS DESIGN |
| 7. Review | Article preview with quality gate | **Review panel** | NEEDS DESIGN |
| 8. Publish | Confirmation + scheduling options | **Publish modal** | NEEDS DESIGN |
| 9. Monitor | Event in Today rail | v6 activity feed | ✅ EXISTS |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   KEYWORD DETAIL PANEL                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "best running shoes 2026"                                │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Volume: 12,400/mo   KD: 34 (Medium)   Intent: Commercial │  │
│  │                                                           │  │
│  │  Your Position                     SERP Features          │  │
│  │  ┌─────────────────────────┐      ☑ Featured snippet     │  │
│  │  │  📈 Position History    │      ☑ People also ask      │  │
│  │  │  ───────────────────    │      ☐ Image pack           │  │
│  │  │  Now: #11 (page 2)      │      ☐ Video carousel       │  │
│  │  │  7d ago: #14            │                              │  │
│  │  │  30d ago: #23           │      Top Competitor          │  │
│  │  │  [chart visualization]  │      runnersworld.com (#1)   │  │
│  │  └─────────────────────────┘                              │  │
│  │                                                           │  │
│  │  Why this is a quick win:                                 │  │
│  │  • Already on page 2 (#11) - close to page 1              │  │
│  │  • Medium difficulty (34) - achievable                    │  │
│  │  • High volume (12.4K) - worth the effort                 │  │
│  │  • No existing article targeting this keyword             │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Create Article │  │  Add to Watchlist│                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 5: Troubleshooting Performance Drop

**Persona**: Agency owner investigating a client's traffic decline

### Flow
```
See "Falling" in Diagnostics → Click to Investigate →
See Ranking History → Check Potential Causes →
Click "Audit Page" → See Page-Specific Findings →
Take Action
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. See "Falling" section | Forecast diagnostics with red items | v6 diagnostics | ✅ EXISTS |
| 2. Click keyword | Expandable row | v6 table | ✅ EXISTS |
| 3. See ranking history | Historical chart | **Ranking history chart** | NEEDS DESIGN |
| 4. Check causes | Cause analysis panel | **Cause analysis** | NEEDS DESIGN |
| 5. Click "Audit page" | Action button | v6 row action | ✅ EXISTS |
| 6. Page-specific findings | Filtered audit view | **Page audit view** | NEEDS DESIGN |
| 7. Take action | Fix buttons | **Action buttons** | NEEDS DESIGN |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   RANKING INVESTIGATION PANEL                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "marathon training plan" — Position dropped #4 → #12     │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Position History (90 days)                               │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │     ╭──╮                                            │  │  │
│  │  │  #4 │  ╰──╮                    ← Stable at #4       │  │  │
│  │  │     │     ╰──────╮                                  │  │  │
│  │  │  #8 │            ╰──╮          ← Drop started       │  │  │
│  │  │     │               ╰────────╮                      │  │  │
│  │  │ #12 │                        ╰──  ← Current         │  │  │
│  │  │     └─────────────────────────────────────────────  │  │  │
│  │  │     Feb        Mar         Apr                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Potential Causes                                         │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  ⚠️  Algorithm update detected Mar 15 (Google Core)       │  │
│  │  ⚠️  Competitor runnersworld.com published new content    │  │
│  │  🔴 Page speed degraded (LCP: 2.1s → 3.8s)               │  │
│  │  ⚪ No significant backlink changes                       │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Audit Page     │  │  View Competitor│                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 6: Client Onboarding (Agency Adding New Client)

**Persona**: Agency account manager setting up a new client

### Flow
```
Click "+ Add Client" → Client Modal (name, domain, type) →
Connect Integrations → Voice Profile Wizard →
Set Goals → Run First Audit + Intelligence →
Client Ready
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Click "+ Add Client" | Button in sidebar or header | v6 sidebar | ✅ EXISTS |
| 2. Client creation modal | Form with business type | **Client modal** | NEEDS DESIGN |
| 3. Connect integrations | Multi-service connection step | **Integration step** | NEEDS DESIGN |
| 4. Voice profile wizard | Progressive form (quick or full) | **Voice wizard** | NEEDS DESIGN |
| 5. Set goals | Goal configuration form | **Goal modal** | NEEDS DESIGN |
| 6. First audit + intelligence | Progress overlay | **First run progress** | NEEDS DESIGN |
| 7. Client ready | Populated dashboard + success | v6 prototype | ✅ EXISTS |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENT CREATION MODAL                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Add New Client                                           │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Client Name                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Acme Corporation                                    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Website                                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ https://acmecorp.com                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  Business Type                                            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ 🏢      │ │ 🛒      │ │ 📍      │ │ 📝      │        │  │
│  │  │ SaaS/   │ │ Ecomm-  │ │ Local   │ │ Affili- │        │  │
│  │  │ B2B     │ │ erce    │ │ Business│ │ ate     │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  │       ✓ selected                                         │  │
│  │                                                           │  │
│  │  Why this matters:                                        │  │
│  │  We'll customize audits, recommendations, and             │  │
│  │  dashboards for your business type.                       │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Cancel         │  │  Continue →     │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   VOICE PROFILE WIZARD                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Configure Brand Voice               Step 1 of 3          │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  How should we learn your brand voice?                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  🔗 Analyze existing content                        │  │  │
│  │  │     We'll scan your website and learn your style    │  │  │
│  │  │     (Recommended - 2 minutes)                       │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📝 Answer a few questions                          │  │  │
│  │  │     Tell us about your brand in 5 quick questions   │  │  │
│  │  │     (3 minutes)                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  ⚙️ Configure manually                              │  │  │
│  │  │     Full control over 40+ voice parameters          │  │  │
│  │  │     (10+ minutes)                                   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────┐                                     │  │
│  │  │  Skip for now →  │                                     │  │
│  │  └─────────────────┘                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 7: Bulk Operations (Agency with 50+ Clients)

**Persona**: Agency owner managing portfolio

### Flow
```
Open "All Clients" View → Filter by Status → Multi-Select →
Bulk Action (Run Audits) → See Aggregate Progress →
Review Results
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Open all clients | List view with columns | **All clients view** | NEEDS DESIGN |
| 2. Filter by status | Filter bar | **Filter controls** | NEEDS DESIGN |
| 3. Multi-select | Checkboxes + select all | **Selection pattern** | NEEDS DESIGN |
| 4. Bulk action | Action bar appears | **Bulk action bar** | NEEDS DESIGN |
| 5. Progress | Aggregate progress modal | **Bulk progress** | NEEDS DESIGN |
| 6. Results | Results summary | **Bulk results** | NEEDS DESIGN |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   ALL CLIENTS VIEW                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  All Clients (47)               [+ Add Client]  [⚙️]      │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  Filter: [All ▾] [At Risk ▾] [Business Type ▾]  🔍        │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ☑ Select all (47)                                        │  │
│  │  ───────────────────────────────────────────────────────  │  │
│  │  ☑ Acme Corp        acmecorp.com     ⚠️ At Risk    SaaS   │  │
│  │  ☑ TechStart        techstart.io     ✓ On Track   SaaS   │  │
│  │  ☑ Local Plumber    plumber.com      ✓ On Track   Local  │  │
│  │  ☐ Fashion Store    fashion.co       ⚠️ 3 issues  Ecomm  │  │
│  │  ☐ Blog Network     blognet.io       ✓ On Track   Affil  │  │
│  │  ...                                                      │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  3 selected    [Run Audits] [Generate Reports] [Export]   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 8: Connection Recovery (Token Expired)

**Persona**: Any user whose OAuth token has expired

### Flow
```
See Warning in Ops Strip → Click for Details →
See Error Explanation → Click "Reconnect" →
OAuth Flow → Success → Data Refreshes
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Warning in ops strip | Red dot + "GSC sync failed" | **Warning state** | NEEDS DESIGN |
| 2. Click for details | Error detail panel | **Error panel** | NEEDS DESIGN |
| 3. See explanation | "Token expired" message | **Error messaging** | NEEDS DESIGN |
| 4. Click "Reconnect" | OAuth button | **Reconnect CTA** | NEEDS DESIGN |
| 5. OAuth flow | Popup window | Existing OAuth | ✅ EXISTS |
| 6. Success | Toast + ops strip updates | **Success state** | NEEDS DESIGN |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   ERROR STATE - OPS STRIP                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔴 GSC sync failed · DataForSEO 14m ago · Auto-fix 3     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   CONNECTION ERROR PANEL                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Google Search Console                                    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  🔴 Connection Failed                                     │  │
│  │                                                           │  │
│  │  Your access token expired. This happens every 7 days     │  │
│  │  and requires re-authentication.                          │  │
│  │                                                           │  │
│  │  Last successful sync: 2 days ago                         │  │
│  │  Data affected: Keywords, Rankings, Indexed pages         │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  🔗 Reconnect with Google                           │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [Dismiss] [Remind me tomorrow]                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 9: Article Generation with Progress

**Persona**: Content creator generating an article

### Flow
```
Click "Create Article" → Configure Options → Click "Generate" →
See Progress Stepper → Each Phase Updates → Quality Gate →
Review → Publish
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Click create | Button in nav or keyword row | v6 existing | ✅ EXISTS |
| 2. Configure | Article options modal | **Article config modal** | NEEDS DESIGN |
| 3. Generate | Button click | - | Existing |
| 4. Progress stepper | Overlay with phases | **Generation stepper** | NEEDS DESIGN |
| 5. Phase updates | Real-time status | **Phase indicators** | NEEDS DESIGN |
| 6. Quality gate | Score breakdown | **Quality gate panel** | NEEDS DESIGN |
| 7. Review | Article preview | Article preview | PARTIAL |
| 8. Publish | Confirmation | **Publish flow** | NEEDS DESIGN |

### Components Needed

```
┌─────────────────────────────────────────────────────────────────┐
│                   ARTICLE GENERATION PROGRESS                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Generating: "Best Running Shoes 2026"                    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ✓ Research          ✓ Outline          ● Sections        │  │
│  │  ──────────────────●─────────────────●───────────●─────   │  │
│  │     Complete           Complete         In Progress       │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Writing section 3 of 7: "Top Picks for..."        │  │  │
│  │  │  ████████████████████░░░░░░░░░░  43%               │  │  │
│  │  │                                                     │  │  │
│  │  │  ~2 minutes remaining                               │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  What's happening:                                        │  │
│  │  • Researching competitor content ✓                       │  │
│  │  • Building outline from keywords ✓                       │  │
│  │  • Writing introduction ✓                                 │  │
│  │  • Writing section 3... ●                                 │  │
│  │  • Quality gate check ○                                   │  │
│  │                                                           │  │
│  │  [Cancel]                           [Run in Background]   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Journey 10: Business Type-Specific Dashboard (Local Business)

**Persona**: Local business owner (plumber serving 3 cities)

### Flow
```
Login → See Local-Specific Dashboard →
GBP Insights Card → Local Pack Tracking →
Citation Health → Service Area Performance
```

### Step-by-Step Design Mapping

| Step | User Sees | Design Component | Status |
|------|-----------|------------------|--------|
| 1. Login | Client dashboard | v6 shell | ✅ EXISTS |
| 2. Local dashboard | Type-specific modules | **Local dashboard variant** | NEEDS DESIGN |
| 3. GBP insights | Google Business Profile card | **GBP card** | NEEDS DESIGN |
| 4. Local pack tracking | Position in map pack | **Local pack card** | NEEDS DESIGN |
| 5. Citations | NAP consistency | **Citation health card** | NEEDS DESIGN |
| 6. Service areas | Multi-location performance | **Service area card** | NEEDS DESIGN |

### Components Needed (Local Business Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│                   LOCAL BUSINESS DASHBOARD MODULES              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Google Business Profile              Connected ✓        │    │
│  │  ──────────────────────────────────────────────────────  │    │
│  │  Profile Views    Direction Requests    Phone Calls      │    │
│  │      1,247              89                 34            │    │
│  │      +12%              +5%               +18%            │    │
│  │  ────────────────────────────────────────────────────    │    │
│  │  Reviews: 4.7★ (127)    [Respond to 3 new reviews]       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Local Pack Positions                                    │    │
│  │  ──────────────────────────────────────────────────────  │    │
│  │  "plumber near me"           #2 in map pack    ↑1        │    │
│  │  "emergency plumber [city]"  #1 in map pack    ━         │    │
│  │  "drain cleaning"            #4 in map pack    ↓1        │    │
│  │  "water heater repair"       Not in pack       ⚠️        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Citation Health                              92%        │    │
│  │  ──────────────────────────────────────────────────────  │    │
│  │  NAP Consistency: ████████████████████░░  47/51 correct  │    │
│  │  ⚠️ 4 citations have wrong phone number                  │    │
│  │  [View all citations] [Fix inconsistencies]              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Service Areas                    3 locations            │    │
│  │  ──────────────────────────────────────────────────────  │    │
│  │  📍 Downtown        Top performing    142 leads/mo       │    │
│  │  📍 Suburbs         Good              87 leads/mo        │    │
│  │  📍 Industrial      Needs attention   23 leads/mo  ⚠️    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Design Inventory

### Priority 1: Core Journey Blockers (Must Have)

| Component | Used In Journeys | Complexity |
|-----------|------------------|------------|
| Welcome modal | J1 | Low |
| Setup wizard modal | J1, J6 | Medium |
| Client creation modal (with business type) | J1, J6 | Medium |
| Audit findings modal | J3 | Medium |
| Article generation progress | J4, J9 | Medium |
| Quality gate panel | J3, J4, J9 | Low |
| Empty state variants (all components) | J1 | Medium |

### Priority 2: Trust & Visibility (Should Have)

| Component | Used In Journeys | Complexity |
|-----------|------------------|------------|
| Overnight summary banner | J2 | Low |
| Connection error panel | J8 | Low |
| Warning states for ops strip | J8 | Low |
| Keyword detail panel | J4, J5 | Medium |
| Ranking investigation panel | J5 | Medium |

### Priority 3: Efficiency & Scale (Nice to Have)

| Component | Used In Journeys | Complexity |
|-----------|------------------|------------|
| Client quick-switcher (Cmd+J) | J2 | Medium |
| All clients view with bulk actions | J7 | High |
| Bulk action bar | J7 | Medium |
| Bulk progress modal | J7 | Medium |

### Priority 4: Business Type Differentiation (Future)

| Component | Used In Journeys | Complexity |
|-----------|------------------|------------|
| Local business dashboard modules | J10 | High |
| Ecommerce dashboard modules | Future | High |
| Affiliate dashboard modules | Future | High |
| Voice profile wizard | J6 | Medium |

---

## Next Steps

1. **Design Priority 1 components** as overlays/modals on v6
2. **Create empty state variants** for each v6 section
3. **Build progress overlays** for async operations
4. **Design error states** for failure scenarios
5. **Prototype business type dashboards** (Local first, then Ecommerce, Affiliate)

---

## Summary

v6 is the **correct foundation** — a beautiful, information-dense populated state. What's needed is not a redesign but **layering**:

| Layer | Purpose | Status |
|-------|---------|--------|
| Layer 0: Populated state | Show ideal working dashboard | ✅ v6 complete |
| Layer 1: Onboarding | Guide first-time users | NEEDS DESIGN |
| Layer 2: Empty states | Handle no-data scenarios | NEEDS DESIGN |
| Layer 3: Progress | Show in-flight operations | NEEDS DESIGN |
| Layer 4: Drill-downs | Enable deep investigation | NEEDS DESIGN |
| Layer 5: Errors | Handle failure gracefully | NEEDS DESIGN |
| Layer 6: Business types | Adapt to different verticals | NEEDS DESIGN |
