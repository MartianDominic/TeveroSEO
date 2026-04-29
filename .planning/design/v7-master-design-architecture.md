# TeveroSEO Master Design Architecture

> **Purpose**: The unified blueprint that ties every journey to v6 design components, shows how screens interlink, and balances autonomy with power-user control
> **References**: 
> - [Design System v6](../../.planning/design/design-system-v6.md) — The visual rules
> - [Design Decisions & Rationale](../../.planning/design/design-decisions-and-rationale.md) — Why we made each choice
> - [v6 Comprehensive Journeys](./v6-comprehensive-journeys.md) — All 200 journeys mapped

---

## The Core Tension: Autonomy vs Control

The platform must feel like **two things simultaneously**:

1. **"It takes care of everything"** — Users trust the system to work autonomously, surface the right things, and handle complexity without babysitting
2. **"I can tweak whatever I need"** — Power users feel in control, can override defaults, configure deeply, and understand what's happening

This isn't a spectrum where you pick a point. **Both must be 100% true at once.** The design achieves this through **progressive disclosure** and **trust-building visibility**.

---

## The Design Philosophy Applied

From [design-decisions-and-rationale.md](../../.planning/design/design-decisions-and-rationale.md) §6:

| Principle | Autonomy Implication | Control Implication |
|-----------|---------------------|---------------------|
| **One editorial moment** | System surfaces THE answer | User can drill into evidence |
| **Calm at rest, depth on demand** | Defaults handle everything | Hover/click reveals all controls |
| **Cards as glass, not paper** | Premium feel builds trust | Interactive lift signals clickability |
| **Numbers want air** | Focus on what matters | Clear hierarchy for scanning |
| **Everything fluid** | Adapts to any context | Consistent experience across devices |

---

## App Architecture: The Three-Column Shell

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   APP SHELL                                  │
├──────────────┬────────────────────────────────────────────────┬──────────────┤
│              │                                                │              │
│   SIDEBAR    │                   MAIN CONTENT                 │    RAIL      │
│   (Nav)      │                  (The Answer)                  │   (Live)     │
│              │                                                │              │
│  • Client    │  ┌─────────────────────────────────────────┐   │  • Today     │
│    switcher  │  │         UTILITY BAR (sticky)            │   │    feed     │
│              │  │  🔍 Search · Breadcrumbs · Actions      │   │              │
│  • Main nav  │  ├─────────────────────────────────────────┤   │  • Health   │
│    - Dashboard│  │                                         │   │    gauge   │
│    - SEO     │  │         PAGE HERO SECTION                │   │              │
│    - Content │  │      (The editorial moment)              │   │  • Up next  │
│    - Reports │  │                                         │   │    (rec)    │
│              │  ├─────────────────────────────────────────┤   │              │
│  • Settings  │  │         SUPPORTING CONTENT               │   │  • Activity │
│              │  │      (Evidence, data, actions)          │   │    log      │
│  • User      │  │                                         │   │              │
│              │  └─────────────────────────────────────────┘   │              │
│              │                                                │              │
│  clamp(232,  │           minmax(0, 1fr)                       │  clamp(320,  │
│  16vw, 272)  │                                                │  22vw, 380)  │
└──────────────┴────────────────────────────────────────────────┴──────────────┘
```

**Design System Reference**: [design-system-v6.md §3](../../.planning/design/design-system-v6.md#3-layout-shell)

### Autonomy Points in Shell
- **Right rail** shows what the system did autonomously (Today feed, auto-fix queue)
- **Health gauge** automatically surfaces site health without user action
- **Up next** system-curated recommendations

### Control Points in Shell
- **Cmd+K** command palette for power navigation
- **Cmd+J** client quick-switcher
- **Sidebar** direct navigation to any section
- **Breadcrumbs** escape to any level

---

## Page Anatomy: The Hierarchical Structure

Every page follows the same hierarchical pattern:

```
┌─────────────────────────────────────────────────────────────┐
│ UTILITY BAR — Persistent, sticky, frosted glass             │
│ Search (Cmd+K) · Breadcrumbs · Period selector · Actions    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ PAGE HERO — One editorial moment (the answer)               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  The big serif numeral + supporting visualization       │ │
│ │  "12 / 20" or "Position #4" or "Score: 84"             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ SUPPORTING STRIP — KPIs, secondary metrics                  │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                    │
│ │ KPI 1 │ │ KPI 2 │ │ KPI 3 │ │ KPI 4 │  (hover: sparklines)│
│ └───────┘ └───────┘ └───────┘ └───────┘                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ VISUALIZATION — Primary chart/graph                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  Distribution bars, trajectory chart, etc.              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ DATA TABLE — Actionable list with filters/tabs             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  [Tab 1] [Tab 2] [Tab 3]                    Filter | Q  │ │
│ │  ─────────────────────────────────────────────────────── │ │
│ │  Row (hover: reveal → arrow)                            │ │
│ │  Row                                                    │ │
│ │  Row                                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ DIAGNOSTIC SECTION — Three-column insights                  │
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │  Quick Wins     │   Stuck         │   Falling           │ │
│ │  (actionable)   │   (needs help)  │   (investigate)     │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ STATUS STRIPS — Pipeline, audit tiers, ops                  │
│ ┌───────┬───────┬───────┬───────┬───────┐                  │
│ │ Idea  │Outline│ Draft │Review │Publish│  (pipeline)      │
│ └───────┴───────┴───────┴───────┴───────┘                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design System Reference**: [design-system-v6.md §17](../../.planning/design/design-system-v6.md#17-implementation-checklist-per-page)

---

## The Interlinking Map: How Screens Connect

### Level 1: Global Navigation

```
                              ┌──────────────┐
                              │   CLIENTS    │
                              │    LIST      │
                              └──────┬───────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │    CLIENT     │       │    CLIENT     │       │    CLIENT     │
    │   DASHBOARD   │       │   DASHBOARD   │       │   DASHBOARD   │
    │   (Acme)      │       │  (TechStart)  │       │   (Local)     │
    └───────┬───────┘       └───────────────┘       └───────────────┘
            │
    ┌───────┴───────┬───────────────┬───────────────┬───────────────┐
    │               │               │               │               │
    ▼               ▼               ▼               ▼               ▼
┌───────┐     ┌───────┐       ┌───────┐       ┌───────┐       ┌───────┐
│  SEO  │     │Content│       │Reports│       │ Alerts│       │Settings│
│       │     │       │       │       │       │       │       │       │
└───┬───┘     └───┬───┘       └───────┘       └───────┘       └───┬───┘
    │             │                                               │
    ├─ Audit      ├─ Articles                                     ├─ Voice
    ├─ Keywords   ├─ Calendar                                     ├─ Branding
    ├─ Backlinks  └─ Templates                                    ├─ Goals
    └─ Domain                                                     └─ Connections
```

### Level 2: Cross-Domain Linking (The Critical Flows)

These are the **interlinking patterns** that make the app feel unified:

#### Pattern A: Finding → Action

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   AUDIT PAGE    │ ──────► │  FINDINGS       │ ──────► │  ARTICLE/NEW    │
│                 │  drill  │  MODAL          │   fix   │                 │
│  "12 open"      │         │  "Missing H1"   │  with   │  Pre-filled     │
│                 │         │  [Fix w/Content]│ content │  context        │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy**: System categorizes findings by severity, suggests fixes
**Control**: User decides which to fix, can ignore or mark as fixed

#### Pattern B: Opportunity → Content

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  INTELLIGENCE   │ ──────► │  KEYWORD        │ ──────► │  ARTICLE/NEW    │
│                 │  click  │  DETAIL         │ create  │                 │
│  Quick Wins     │         │  "best running" │ article │  Pre-filled     │
│  (system-curated)│        │  [Create Article]│        │  + voice        │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy**: System surfaces quick wins, calculates opportunity score
**Control**: User chooses which to pursue, configures article options

#### Pattern C: Drop → Investigation → Action

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  DASHBOARD      │ ──────► │  RANKING        │ ──────► │  AUDIT PAGE     │
│                 │  click  │  INVESTIGATION  │  audit  │                 │
│  "Falling" tab  │         │  (causes panel) │  page   │  Filtered to    │
│  Position #12   │         │  [Audit Page]   │         │  affected URLs  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy**: System detects drops, suggests potential causes, correlates with audits
**Control**: User decides investigation depth, chooses remediation path

#### Pattern D: Prospect → Client

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  PROSPECTS      │ ──────► │  PROPOSAL       │ ──────► │  CLIENT         │
│                 │ generate│  PAGE           │ convert │  DASHBOARD      │
│  "Acme Corp"    │         │  [Send] [Export]│   to    │                 │
│  Keywords: 127  │         │  [Convert]      │ client  │  Keywords       │
│                 │         │                 │         │  imported       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy**: Keyword data flows automatically to new client
**Control**: User chooses when to convert, what data to include

#### Pattern E: Generation → Quality → Publish

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  ARTICLE        │ ──────► │  QUALITY        │ ──────► │  PUBLISHED      │
│  GENERATION     │  gate   │  GATE PANEL     │ publish │  (or scheduled) │
│                 │         │                 │         │                 │
│  [████████░░]   │         │  Score: 84 ✓    │  auto   │  GSC submitted  │
│  Writing sec 3  │         │  [View] [Edit]  │   or    │  Links inserted │
│                 │         │  [Auto-Publish] │ manual  │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

**Autonomy**: System auto-publishes if score ≥ threshold (configurable)
**Control**: User can edit, reject, adjust threshold, schedule instead

---

## The Autonomy/Control Matrix

Every feature sits on this matrix:

```
                    HIGH AUTONOMY
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    │  AUTO-PUBLISH      │   QUALITY GATE     │
    │  (score ≥ 80)      │   (shows score)    │
    │                    │                    │
    │  GSC SUBMISSION    │   ARTICLE GEN      │
    │  (post-publish)    │   (with progress)  │
    │                    │                    │
LOW │  LINK INSERTION    │   RECOMMENDATIONS  │ HIGH
VISI│  (auto-internal)   │   (Up Next rail)   │ VISIBILITY
BILI│                    │                    │
TY  │  NIGHTLY AUDITS    │   TODAY FEED       │
    │  (scheduled)       │   (what happened)  │
    │                    │                    │
    │  TOKEN REFRESH     │   CONNECTION       │
    │  (silent if ok)    │   HEALTH (rail)    │
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                    LOW AUTONOMY
                    (User initiates)
```

### The Trust Formula

**User Trust = Visibility × Reversibility × Predictability**

| Factor | How We Achieve It |
|--------|-------------------|
| **Visibility** | Today feed shows everything, ops strip shows system status, progress overlays show phases |
| **Reversibility** | Soft delete (7-day trash), automation pause toggle, edit before publish |
| **Predictability** | Consistent quality gate, configurable thresholds, transparent decision logic |

---

## Component Inventory: Mapping Journeys to v6 Components

### Layer 0: Foundation Components

| Component | Design System Ref | Used In Journeys |
|-----------|-------------------|------------------|
| App Shell (3-col) | [§3.1](../../.planning/design/design-system-v6.md#31-three-column-app-shell) | All |
| Sidebar | [§3.1](../../.planning/design/design-system-v6.md#31-three-column-app-shell) | All |
| Utility Bar | [§3.2](../../.planning/design/design-system-v6.md#32-sticky-utility-bar) | All |
| Right Rail | [§10](../../.planning/design/design-system-v6.md#10-right-rail-patterns) | All |
| Card Primitive | [§4](../../.planning/design/design-system-v6.md#4-card-primitive) | All |
| Button System | [§5](../../.planning/design/design-system-v6.md#5-button-system) | All |

### Layer 1: Page-Level Components

| Component | Design System Ref | Pages Using |
|-----------|-------------------|-------------|
| Goal Hero | [§7.1](../../.planning/design/design-system-v6.md#71-goal-hero-progress-block-the-v5-redesign) | Client Dashboard |
| KPI Strip | [§7.2](../../.planning/design/design-system-v6.md#72-kpi-numeral) | Dashboard, Analytics, Reports |
| Distribution Chart | [§9.2](../../.planning/design/design-system-v6.md#92-distribution-bars-signature-pattern) | Dashboard, Keywords |
| Data Table | [§8](../../.planning/design/design-system-v6.md#8-tables) | Keywords, Articles, Prospects, Audit |
| Trajectory Chart | [§9.3](../../.planning/design/design-system-v6.md#93-trajectory-chart-legend) | Goal Hero |
| Forecast/Diagnostics | §7 (3-col pattern) | Dashboard |

### Layer 2: Overlay Components (NEEDS DESIGN)

These are the **missing components** identified in the journey mapping:

| Component | Purpose | Priority | Journeys Blocked |
|-----------|---------|----------|------------------|
| **Welcome Modal** | First-time user greeting | P0 | 1.6, 1.7, 1.8 |
| **Setup Wizard** | 5-step onboarding | P0 | 1.7, 6.0 |
| **Client Creation Modal** | Business type selection | P0 | 6.0, 3.12 |
| **Property Selection Modal** | GSC/GA4 property picker | P0 | 9.7, 9.8 |
| **Generation Progress Overlay** | Phase-by-phase visibility | P0 | 7.4, 9.0 |
| **Quality Gate Panel** | Score breakdown + actions | P0 | 7.8, 3.0 |
| **Findings Modal** | Drill-down from audit | P0 | 5.6, 5.10 |
| **Keyword Detail Panel** | Opportunity analysis | P1 | 6.8, 4.0 |
| **Ranking Investigation Panel** | Drop cause analysis | P1 | 5.0, 4.13 |
| **Voice Profile Wizard** | Progressive voice setup | P1 | 8.19, 6.4 |
| **Connection Health Dashboard** | All integrations status | P1 | 9.11 |
| **Overnight Summary Banner** | AM check-in | P1 | 4.12, 2.2 |
| **All Clients View** | Portfolio with bulk actions | P2 | 7.0 |
| **Custom Report Builder** | Section picker | P2 | 10.3 |

### Layer 3: Empty State Variants (NEEDS DESIGN)

Every data component needs an empty state that:
1. Uses Newsreader editorial sentence
2. Has clear CTA
3. Shows why it's empty (no data vs error vs not configured)

| Component | Empty State Needed | CTA |
|-----------|-------------------|-----|
| Client List | "No clients yet" | Create your first client |
| Goal Hero | "No goal set" | Set a goal |
| Keywords Table | "No keywords tracked" | Run intelligence |
| Articles List | "No articles yet" | Create your first article |
| Today Feed | "Nothing yet today" | (no CTA, just message) |
| Audit Findings | "No issues found" | Run new audit |
| Prospects | "No prospects yet" | Add prospect |
| Connections | "No connections" | Connect Google |

### Layer 4: Error State Variants (NEEDS DESIGN)

From [design-decisions-and-rationale.md §10.5](../../.planning/design/design-decisions-and-rationale.md#105-error-states):

| Error Type | Visual Treatment | Recovery Action |
|------------|-----------------|-----------------|
| **Inline Error** | Red border, error-soft bg | Retry button |
| **Card Error** | Replaces card content | Retry / Report |
| **Toast Notification** | Top-right slide-in | Dismiss / Action |
| **Connection Error** | Badge on ops strip | Reconnect link |
| **Generation Error** | Modal overlay | Retry / Edit config |

### Layer 5: Progress State Variants (NEEDS DESIGN)

| Operation | Progress Display | Location |
|-----------|-----------------|----------|
| **Article Generation** | Phase stepper + % bar | Overlay on article card |
| **Audit Running** | Pages crawled / total | Inline in audit card |
| **Intelligence Scraping** | Spinner + time estimate | Modal or inline |
| **Bulk Operation** | X of Y complete | Bulk action bar |
| **Report Generating** | Section checklist | Modal |

---

## The Power User Escape Hatches

For every autonomous action, there's a control point:

### Keyboard Shortcuts (v6 has hints visible)

| Shortcut | Action | Reference |
|----------|--------|-----------|
| `Cmd+K` | Command palette | Search anything |
| `Cmd+J` | Client quick-switcher | Jump to any client |
| `G O` | Go to Overview | Dashboard |
| `G A` | Go to Audit | SEO Audit |
| `G K` | Go to Keywords | Keywords page |
| `G C` | Go to Content | Articles |
| `E` | Export current view | Context-sensitive |
| `Cmd+R` | Run action | Run audit, generate, etc. |
| `?` | Show all shortcuts | Help overlay |

**Design System Reference**: [design-system-v6.md §5.5](../../.planning/design/design-system-v6.md#55-inline-kbd-chip)

### Settings Hierarchy

```
GLOBAL SETTINGS (all clients)
├── API Keys (DataForSEO, etc.)
├── Default Quality Threshold (80)
├── Default Voice Mode
├── Notification Preferences
└── Keyboard Shortcuts

CLIENT SETTINGS (per client)
├── Goals
├── Voice Profile (40+ fields)
│   ├── Quick Setup (wizard)
│   └── Full Control (all fields)
├── Connections
│   ├── Google (GSC, GA4, GBP)
│   ├── CMS (WordPress, Shopify)
│   └── Custom Webhooks
├── Automation Rules
│   ├── Auto-publish Threshold
│   ├── Scheduled Audits
│   └── Alert Rules
└── Branding (logo, colors)
```

### Override Points

| Autonomous Behavior | Override Location |
|--------------------|-------------------|
| Auto-publish if score ≥ 80 | Settings → Auto-publish threshold |
| GSC submit after publish | Settings → Connections → GSC → Disable |
| Internal link insertion | Settings → Automation → Link insertion |
| Nightly audits | Settings → SEO → Audit schedule |
| Alert notifications | Settings → Alerts → Rules |
| Voice enforcement | Voice settings → Protection rules |

---

## The Trust-Building Patterns

### Pattern 1: Show What You Did (Today Feed)

The right rail's Today feed is the primary trust builder:

```
TODAY · 14 events
─────────────────────────────────────────────

14:23 │ 3 keywords moved into top 10
      │ RANKING · GAIN

11:08 │ "running shoes review" hit position 4
      │ TOP 10 · NEW

09:42 │ Article "Best Running Gear" published
      │ CONTENT · PUBLISHED

09:41 │ 3 internal links inserted
      │ LINKS · AUTO

08:15 │ GSC URL submission complete (5 URLs)
      │ SYSTEM · SYNC

─────────────────────────────────────────────
YESTERDAY
```

**Design System Reference**: [design-system-v6.md §10.2](../../.planning/design/design-system-v6.md#102-today-event-feed-linearsuperhuman-tell)

### Pattern 2: Show What You're Doing (Ops Strip)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ● All systems    GSC sync 2h ago    DataForSEO 14m ago    Auto-fix queue 3  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Click expands to show:
- Last successful sync per integration
- Pending operations
- Any warnings/errors

### Pattern 3: Show What You'll Do (Up Next)

```
UP NEXT (system-curated, user can dismiss)
─────────────────────────────────────────────

⚡ Fix 14 missing meta descriptions
   Tier 2 · LOW EFFORT · HIGH IMPACT
   [View] [Auto-fix]

📈 Create article for "marathon training"
   Quick win · Position #11
   [Create Article]

🔄 Reconnect GA4 (expires in 3 days)
   Connection · WARNING
   [Reconnect]
```

### Pattern 4: Explain Why (Quality Gate)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  QUALITY GATE: 84/100                                         ✓ PASSED     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Threshold: 80 (configurable in settings)                                  │
│                                                                             │
│  WHY THIS SCORE:                                                           │
│  ████████████████████░░░░  Readability        85  ✓                       │
│  ███████████████████░░░░░  Keyword Density    79  ⚠ (slightly low)        │
│  █████████████████████░░░  E-E-A-T Signals    88  ✓                       │
│  ████████████████████░░░░  Originality        82  ✓                       │
│  █████████████████████░░░  Voice Match        86  ✓                       │
│                                                                             │
│  Action: This article will auto-publish because score ≥ 80                 │
│  Override: [Edit First] [Hold for Review] [Change Threshold]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Journey → Component Mapping Table

| Journey | Page | Hero Component | Supporting | Overlays Needed |
|---------|------|----------------|------------|-----------------|
| **New User Onboarding** | /clients | Empty state | - | Welcome modal, Setup wizard |
| **Daily Check-in** | /clients/[id] | Goal Hero | KPI Strip, Today Feed | Overnight banner |
| **Run Audit** | /seo/audit | Audit score | Tier breakdown | Findings modal |
| **Fix Issue** | /seo/audit → /articles/new | - | Pre-filled form | Generation progress |
| **Create Content** | /articles/new | - | Options form | Generation progress, Quality gate |
| **Review Content** | /articles/[id] | Article preview | Quality gate | WYSIWYG editor |
| **Track Keywords** | /intelligence | Opportunities | Keywords table | Keyword detail panel |
| **Investigate Drop** | /clients/[id] | Falling tab | Diagnostics | Investigation panel |
| **Manage Prospect** | /prospects/[id] | Contact info | Keywords | Proposal, Convert modal |
| **Configure Voice** | /settings/voice | Tab interface | Preview | Voice wizard |
| **Connect Services** | /connections | Connection cards | Status | Property selection |
| **Generate Report** | /reports | Report preview | Sections | Custom builder |
| **Portfolio View** | /clients | All clients list | Bulk bar | Filters, Export |

---

## Implementation Priorities

### Sprint 1: Onboarding Layer (Weeks 1-2)

Components to build:
1. **WelcomeModal** — First-time detection, demo mode option
2. **SetupWizard** — 5 steps (account → GSC → client → voice → audit)
3. **EmptyState** variants — For all major cards
4. **GettingStartedCard** enhancement — Clickable checklist

Design references:
- [v5-journey-map.md Journey 1](./v5-journey-map.md#journey-1-new-user--first-value)
- [design-system-v6.md §5](../../.planning/design/design-system-v6.md#5-button-system) for button styling

### Sprint 2: Dashboard v6 Components (Weeks 3-4)

Components to build:
1. **GoalHero** — Progress block per [§7.1](../../.planning/design/design-system-v6.md#71-goal-hero-progress-block-the-v5-redesign)
2. **TodayRail** — Event feed per [§10.2](../../.planning/design/design-system-v6.md#102-today-event-feed-linearsuperhuman-tell)
3. **ForecastDiagnostics** — 3-col quick wins/stuck/falling
4. **OpsStrip** — System status bar
5. **ContentPipeline** — Stage visualization per [§14.5](../../.planning/design/design-system-v6.md#145-pipeline-stages-with-relative-volume-bars)

### Sprint 3: Content Workflow (Weeks 5-6)

Components to build:
1. **GenerationProgress** — Phase stepper overlay
2. **QualityGatePanel** — Score breakdown with actions
3. **ArticleEditor** — WYSIWYG (TipTap integration)
4. **PublishModal** — Schedule vs immediate

### Sprint 4: Cross-Domain Links (Weeks 7-8)

Components to build:
1. **FindingsModal** — Expandable audit findings
2. **FixWithContentButton** — Cross-link to articles
3. **KeywordDetailPanel** — Opportunity analysis
4. **PropertySelectionModal** — Post-OAuth picker
5. **ConvertToClientModal** — Prospect conversion

### Sprint 5: Bulk Operations (Weeks 9-10)

Components to build:
1. **AllClientsView** — Portfolio with filters
2. **BulkActionBar** — Multi-select actions
3. **CSVImportModal** — Keywords, prospects
4. **ClientQuickSwitcher** — Cmd+J modal

### Sprint 6: Trust & Visibility (Weeks 11-12)

Components to build:
1. **OvernightBanner** — Morning summary
2. **ConnectionHealth** — Dashboard with logs
3. **VoiceComplianceIndicator** — On articles
4. **Breadcrumbs** — Auto-generated from route

### Sprint 7: Reporting (Weeks 13-14)

Components to build:
1. **CustomReportBuilder** — Section picker
2. **EmailDeliveryModal** — Send to client
3. **ScheduledReportsConfig** — Recurring setup
4. **NotificationChannels** — Email/Slack config

### Sprint 8: Business Types (Weeks 15-17)

Components to build:
1. **BusinessTypeSelector** — In client creation
2. **LocalDashboardModules** — GBP, citations, NAP
3. **EcommerceDashboardModules** — Product schema, categories
4. **AffiliateDashboardModules** — Link pipeline, decay

---

## Conclusion: The Unified Vision

TeveroSEO achieves the impossible balance by:

1. **Autonomous by default** — The system does the work (audits run, content generates, links insert, GSC submits)

2. **Visible by design** — Every autonomous action appears in Today feed, ops strip, or progress overlay

3. **Controllable on demand** — Hover reveals controls, settings offer overrides, power users have shortcuts

4. **Connected throughout** — Every finding links to a fix, every opportunity links to content, every drop links to investigation

The v6 design system provides the visual language. The journey mapping provides the flows. This architecture document connects them into a unified whole that feels like **one product, not many tools** — where users trust the system to handle complexity while feeling in complete control.

---

*Cross-references:*
- [Design System v6](../../.planning/design/design-system-v6.md) — Visual rules
- [Design Decisions & Rationale](../../.planning/design/design-decisions-and-rationale.md) — Why we made each choice
- [v6 Comprehensive Journeys](./v6-comprehensive-journeys.md) — All 200 journeys
- [v5 Journey Map](./v5-journey-map.md) — Initial 10 journeys with wireframes
- [v4 Gap Analysis](./v4-prototype-gap-analysis.md) — How v6 addresses gaps
- [v3 Critical Gaps](./v3-critical-gaps.md) — Original gap analysis
