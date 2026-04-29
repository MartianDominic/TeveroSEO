# TeveroSEO Comprehensive Journey Map

> **Purpose**: Complete mapping of ALL user journeys across ALL screens from 10 specialized Opus agent audits
> **Foundation**: v6 prototype as populated destination state
> **Scope**: 200+ journeys across 10 domains, 44 routes

---

## Executive Summary

10 specialized agents exhaustively mapped every user journey in TeveroSEO. This document consolidates their findings into a single actionable reference.

### Coverage Statistics

| Domain | Journeys Mapped | Implemented | Gaps Found |
|--------|-----------------|-------------|------------|
| Auth & Onboarding | 14 | 10 (71%) | 4 |
| Global Dashboard | 15 | 12 (80%) | 3 |
| Prospects | 18 | 11 (61%) | 7 |
| Client Dashboard | 15 | 8 (53%) | 7 |
| SEO Audit | 24 | 16 (67%) | 8 |
| Keywords | 23 | 15 (65%) | 8 |
| Content/Articles | 25 | 14 (56%) | 11 |
| Voice & Branding | 20 | 12 (60%) | 8 |
| Connections | 21 | 13 (62%) | 8 |
| Reports & Alerts | 25 | 14 (56%) | 11 |
| **TOTAL** | **200** | **125 (63%)** | **75** |

### Critical Gaps by Priority

| Priority | Gap Count | Blocking Vision |
|----------|-----------|-----------------|
| P0 (Blocking) | 12 | Yes - core flows broken |
| P1 (Trust) | 23 | Yes - users can't trust system |
| P2 (Efficiency) | 25 | Partially - extra clicks |
| P3 (Polish) | 15 | No - nice to have |

---

## Domain 1: Auth & Onboarding (14 Journeys)

### Routes Covered
- `/sign-in`, `/sign-up`
- `/dashboard` (first-time state)

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 1.1 | Sign up (new user) | /sign-up | /clients (empty) | IMPLEMENTED |
| 1.2 | Sign in (returning) | /sign-in | Last visited page | IMPLEMENTED |
| 1.3 | Password reset | /sign-in | /sign-in | IMPLEMENTED (Clerk) |
| 1.4 | Social auth (Google) | /sign-up | /clients | IMPLEMENTED |
| 1.5 | Social auth (GitHub) | /sign-up | /clients | IMPLEMENTED |
| 1.6 | Welcome modal (first-time) | /clients | Setup wizard | **MISSING** |
| 1.7 | Setup wizard | Welcome modal | First client created | **MISSING** |
| 1.8 | Demo mode exploration | Welcome modal | Demo dashboard | **MISSING** |
| 1.9 | API key configuration | Setup wizard | /settings | PARTIAL |
| 1.10 | Getting started card | /dashboard | Various | IMPLEMENTED |
| 1.11 | Product tour | Welcome modal | Anywhere | **MISSING** |
| 1.12 | First client creation | /clients | /clients/[id] | IMPLEMENTED |
| 1.13 | Session timeout | Any page | /sign-in | IMPLEMENTED |
| 1.14 | Sign out | Any page | /sign-in | IMPLEMENTED |

### Critical Gaps

1. **Welcome Modal Missing**: New users land on empty `/clients` with no guidance
2. **Setup Wizard Missing**: No guided flow for first 5 minutes
3. **Demo Mode Missing**: Users can't explore without committing to setup
4. **Product Tour Missing**: No contextual tooltips or guided walkthrough

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      WELCOME MODAL                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Welcome to TeveroSEO                                     │  │
│  │                                                           │  │
│  │  Let's get your first client ranking in under 5 minutes.  │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Start Setup    │  │  Explore Demo   │                │  │
│  │  │  (5 min)        │  │  (skip setup)   │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  │                                                           │  │
│  │  Or import existing clients from CSV                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 2: Global Dashboard (15 Journeys)

### Routes Covered
- `/dashboard`
- `/clients`
- `/settings`
- Global navigation, command palette

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 2.1 | View all clients overview | /clients | - | IMPLEMENTED |
| 2.2 | Search clients | /clients | Client selected | IMPLEMENTED |
| 2.3 | Filter clients by status | /clients | Filtered view | IMPLEMENTED |
| 2.4 | Sort clients | /clients | Sorted view | IMPLEMENTED |
| 2.5 | Quick-switch client (Cmd+K) | Anywhere | Selected client | IMPLEMENTED |
| 2.6 | Quick-switch client (Cmd+J) | Anywhere | Selected client | **MISSING** |
| 2.7 | Navigate via sidebar | Anywhere | Selected page | IMPLEMENTED |
| 2.8 | Navigate via breadcrumbs | Deep page | Parent page | **MISSING** |
| 2.9 | Access recent items | Cmd+K | Recent item | **MISSING** |
| 2.10 | Global search | Cmd+K | Search result | IMPLEMENTED |
| 2.11 | View notifications | Bell icon | Notification list | IMPLEMENTED |
| 2.12 | Change global settings | /settings | - | IMPLEMENTED |
| 2.13 | Toggle dark mode | Settings | - | IMPLEMENTED |
| 2.14 | Collapse sidebar | Sidebar | Collapsed state | IMPLEMENTED |
| 2.15 | Mobile navigation | Hamburger | Drawer | IMPLEMENTED |

### Critical Gaps

1. **Breadcrumbs Missing**: Users get lost in deep pages (SEO > Audit > Tier 1)
2. **Client Quick-Switcher (Cmd+J)**: Need dedicated fuzzy-search for clients
3. **Recent Items Missing**: Command palette doesn't show recent clients/pages

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   BREADCRUMB TRAIL                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Clients > Acme Corp > SEO > Audit > Tier 1 Findings      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  CLIENT QUICK-SWITCHER (Cmd+J)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Switch to client...                                  ⌘J  │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  RECENT                                                   │  │
│  │  ⚠ Acme Corp          acmecorp.com       Goal at risk    │  │
│  │  ✓ TechStart          techstart.io       On track        │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  ALL (47)                                                 │  │
│  │  Filter: [At risk] [Local] [Ecommerce]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 3: Prospects (18 Journeys)

### Routes Covered
- `/prospects`
- `/prospects/keywords`
- `/prospects/[id]/proposal/*`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 3.1 | View all prospects | /prospects | - | IMPLEMENTED |
| 3.2 | Add new prospect | /prospects | Prospect created | IMPLEMENTED |
| 3.3 | Edit prospect details | /prospects/[id] | Saved | IMPLEMENTED |
| 3.4 | Delete prospect | /prospects | Deleted | IMPLEMENTED |
| 3.5 | Run keyword analysis | /prospects/[id] | Analysis complete | IMPLEMENTED |
| 3.6 | View prospect keywords | /prospects/keywords | - | IMPLEMENTED |
| 3.7 | Generate proposal | /prospects/[id] | /proposal | IMPLEMENTED |
| 3.8 | Customize proposal | /proposal | Saved | IMPLEMENTED |
| 3.9 | Export proposal as PDF | /proposal | PDF downloaded | **PARTIAL** |
| 3.10 | Send proposal via email | /proposal | Email sent | **MISSING** |
| 3.11 | Track proposal opens | /prospects | Open count | **MISSING** |
| 3.12 | Convert prospect to client | /prospects | /clients/[new] | **MISSING** |
| 3.13 | Bulk import prospects (CSV) | /prospects | Imported | **MISSING** |
| 3.14 | Bulk export prospects | /prospects | CSV downloaded | **MISSING** |
| 3.15 | Filter prospects by status | /prospects | Filtered view | IMPLEMENTED |
| 3.16 | Sort prospects | /prospects | Sorted view | IMPLEMENTED |
| 3.17 | Archive prospect | /prospects | Archived | IMPLEMENTED |
| 3.18 | Restore archived | /prospects | Restored | **MISSING** |

### Critical Gaps

1. **Convert to Client Missing**: No one-click path from prospect to client
2. **CSV Import Missing**: Can't bulk import prospects
3. **Proposal Sending Missing**: Can't email proposals directly
4. **Proposal Tracking Missing**: No open/view analytics
5. **Archive Restore Missing**: Archived prospects can't be recovered

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONVERT TO CLIENT MODAL                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Convert "Acme Corp" to Client                            │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ✓ Prospect data will be copied:                          │  │
│  │    • Company name: Acme Corp                              │  │
│  │    • Domain: acmecorp.com                                 │  │
│  │    • Contact: john@acmecorp.com                           │  │
│  │    • Keywords analyzed: 127                               │  │
│  │                                                           │  │
│  │  What happens next:                                       │  │
│  │  1. New client created from prospect data                 │  │
│  │  2. Keywords imported to Intelligence                     │  │
│  │  3. Initial audit scheduled                               │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Cancel         │  │  Convert →      │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 4: Client Dashboard (15 Journeys)

### Routes Covered
- `/clients/[id]` (main dashboard)
- Client-level shell and navigation

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 4.1 | View client dashboard | /clients/[id] | - | IMPLEMENTED |
| 4.2 | See goal progress | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.3 | See today's activity | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.4 | See quick wins | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.5 | See site health | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.6 | Navigate to sub-pages | Dashboard | Sub-page | IMPLEMENTED |
| 4.7 | Edit client info | Dashboard | Settings | IMPLEMENTED |
| 4.8 | Delete client | Settings | /clients | IMPLEMENTED |
| 4.9 | View KPIs | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.10 | Set/edit goals | Dashboard | Goal modal | **PARTIAL** |
| 4.11 | See content pipeline | Dashboard | - | **PARTIAL** (v6 needed) |
| 4.12 | See overnight summary | Dashboard (AM) | Activity detail | **MISSING** |
| 4.13 | Drill into forecast | Dashboard | Keyword detail | **MISSING** |
| 4.14 | Take recommended action | "Up next" | Action complete | **MISSING** |
| 4.15 | Configure dashboard | Dashboard | Settings | **MISSING** |

### Critical Gaps - v6 Components Needed

The v6 prototype defines these components that need implementation:

| Component | v6 Design | Current Code | Gap |
|-----------|-----------|--------------|-----|
| GoalHero | 12/20 progress, trajectory | Basic progress % | Needs trajectory chart |
| KPIStrip | Impressions, Clicks, Conversions | Basic numbers | Needs sparklines |
| TodayRail | Timestamped activity feed | No activity feed | Full build needed |
| RailHealth | Site health gauge | No gauge | Full build needed |
| ForecastDiagnostics | Quick wins, Falling, Stuck | Basic keyword list | Full build needed |
| ContentPipeline | Idea → Published flow | No pipeline view | Full build needed |
| OpsStrip | Sync status, auto-fix queue | No ops visibility | Full build needed |

### Recommended Implementation Priority

```
Priority 1: TodayRail (activity visibility)
Priority 2: GoalHero (progress tracking)  
Priority 3: ForecastDiagnostics (actionable insights)
Priority 4: OpsStrip (trust building)
Priority 5: ContentPipeline (workflow visibility)
```

---

## Domain 5: SEO Audit (24 Journeys)

### Routes Covered
- `/clients/[id]/seo/[projectId]/audit`
- `/clients/[id]/seo/[projectId]/domain`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 5.1 | View audit overview | /audit | - | IMPLEMENTED |
| 5.2 | Run new audit | /audit | Audit running | IMPLEMENTED |
| 5.3 | View audit history | /audit | History list | IMPLEMENTED |
| 5.4 | Compare audits | /audit | Comparison view | **MISSING** |
| 5.5 | View findings by tier | /audit | Tier view | IMPLEMENTED |
| 5.6 | Expand finding detail | Finding row | Detail panel | **PARTIAL** |
| 5.7 | View affected URLs | Finding | URL list | IMPLEMENTED |
| 5.8 | Mark finding as fixed | Finding | Marked | **MISSING** |
| 5.9 | Ignore finding | Finding | Ignored | **MISSING** |
| 5.10 | Fix with content | Finding | /articles/new | **MISSING** |
| 5.11 | View fix instructions | Finding | Instructions | IMPLEMENTED |
| 5.12 | Filter findings | /audit | Filtered | IMPLEMENTED |
| 5.13 | Search findings | /audit | Results | **MISSING** |
| 5.14 | Export findings CSV | /audit | Downloaded | **MISSING** |
| 5.15 | Export findings PDF | /audit | Downloaded | **MISSING** |
| 5.16 | View site health score | /audit | Score breakdown | IMPLEMENTED |
| 5.17 | View Core Web Vitals | /audit | CWV detail | IMPLEMENTED |
| 5.18 | Configure audit settings | /audit | Settings saved | IMPLEMENTED |
| 5.19 | Schedule recurring audit | /audit | Schedule saved | **MISSING** |
| 5.20 | Cancel running audit | /audit | Cancelled | IMPLEMENTED |
| 5.21 | Re-run failed audit | /audit | Restarted | IMPLEMENTED |
| 5.22 | View audit timeline | /audit | Timeline | **PARTIAL** |
| 5.23 | View domain analysis | /domain | - | IMPLEMENTED |
| 5.24 | View indexation status | /domain | - | IMPLEMENTED |

### Critical Gaps

1. **Mark as Fixed Missing**: Users can't track remediation
2. **Audit Comparison Missing**: Can't compare before/after
3. **Fix with Content Missing**: No cross-domain linking to articles
4. **Export Missing**: No PDF/CSV for client reporting
5. **Scheduled Audits Missing**: No recurring audit automation

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   FINDING DETAIL EXPANSION                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Missing H1 Tag                              Tier 1 🔴     │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Affected Pages (14):                                     │  │
│  │  • /products/running-shoes                                │  │
│  │  • /products/hiking-boots                                 │  │
│  │  • /blog/best-running-tips                                │  │
│  │  [View all 14 pages...]                                   │  │
│  │                                                           │  │
│  │  Why this matters:                                        │  │
│  │  H1 tags are critical for SEO. Search engines use them    │  │
│  │  to understand page topic and hierarchy.                  │  │
│  │                                                           │  │
│  │  How to fix:                                              │  │
│  │  Add exactly one H1 tag per page containing the primary   │  │
│  │  keyword. Current pages have 0 H1 tags.                   │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │  │
│  │  │ Mark    │ │ Ignore  │ │ Fix w/  │ │ Export  │        │  │
│  │  │ Fixed   │ │         │ │ Content │ │         │        │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 6: Keywords (23 Journeys)

### Routes Covered
- `/clients/[id]/seo/[projectId]/keywords`
- `/clients/[id]/intelligence`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 6.1 | View all keywords | /keywords | - | IMPLEMENTED |
| 6.2 | Run intelligence | /intelligence | Keywords populated | IMPLEMENTED |
| 6.3 | Add keyword manually | /keywords | Added | IMPLEMENTED |
| 6.4 | Import keywords (CSV) | /keywords | Imported | **MISSING** |
| 6.5 | Export keywords (CSV) | /keywords | Downloaded | **MISSING** |
| 6.6 | Track new keyword | /keywords | Tracking started | IMPLEMENTED |
| 6.7 | Stop tracking keyword | /keywords | Tracking stopped | IMPLEMENTED |
| 6.8 | View keyword detail | /keywords | Detail panel | **PARTIAL** |
| 6.9 | View ranking history | Keyword detail | History chart | IMPLEMENTED |
| 6.10 | View SERP features | Keyword detail | Feature list | **PARTIAL** |
| 6.11 | View competitor rankings | Keyword detail | Competitor list | IMPLEMENTED |
| 6.12 | Create article from keyword | /keywords | /articles/new | IMPLEMENTED |
| 6.13 | Tag keywords | /keywords | Tagged | **MISSING** |
| 6.14 | Group keywords | /keywords | Grouped | **MISSING** |
| 6.15 | Filter by position | /keywords | Filtered | IMPLEMENTED |
| 6.16 | Filter by intent | /keywords | Filtered | IMPLEMENTED |
| 6.17 | Sort keywords | /keywords | Sorted | IMPLEMENTED |
| 6.18 | Bulk select keywords | /keywords | Selected | **PARTIAL** |
| 6.19 | Bulk delete keywords | /keywords | Deleted | **MISSING** |
| 6.20 | Bulk tag keywords | /keywords | Tagged | **MISSING** |
| 6.21 | View keyword gap analysis | /keywords | Gap view | **MISSING** |
| 6.22 | View keyword clusters | /keywords | Cluster view | **MISSING** |
| 6.23 | Keyword-article mapping | /keyword-mapping | - | IMPLEMENTED |

### Critical Gaps

1. **CSV Import/Export Missing**: Can't bulk manage keywords
2. **Tagging/Grouping Missing**: Can't organize large keyword sets
3. **Bulk Operations Missing**: Can't act on multiple keywords
4. **Gap Analysis Missing**: Can't find keyword opportunities vs competitors
5. **Cluster View Missing**: Can't see topical groupings

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   KEYWORD BULK ACTION BAR                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  23 keywords selected   [Tag] [Group] [Create Articles]   │  │
│  │                         [Export] [Delete] [Clear]         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   KEYWORD GAP ANALYSIS                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Keyword Gaps vs Competitors                              │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Keywords competitors rank for (you don't):               │  │
│  │  • "marathon training schedule"     competitor.com #3     │  │
│  │  • "running shoe reviews 2026"      runnersite.com #2     │  │
│  │  • "best trail running gear"        outdoors.com #5       │  │
│  │                                                           │  │
│  │  Opportunity Score: 847 (high potential traffic)          │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Add to Track   │  │  Create Content │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 7: Content/Articles (25 Journeys)

### Routes Covered
- `/clients/[id]/articles`
- `/clients/[id]/articles/new`
- `/clients/[id]/articles/[articleId]`
- `/clients/[id]/calendar`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 7.1 | View all articles | /articles | - | IMPLEMENTED |
| 7.2 | Create new article | /articles/new | Editor | IMPLEMENTED |
| 7.3 | Generate article | /articles/new | Generation started | IMPLEMENTED |
| 7.4 | View generation progress | Article | Progress overlay | **MISSING** |
| 7.5 | Cancel generation | Article | Cancelled | IMPLEMENTED |
| 7.6 | View article preview | Article | Preview | IMPLEMENTED |
| 7.7 | Edit article (WYSIWYG) | Article | Editor | **MISSING** |
| 7.8 | View quality gate score | Article | Score panel | **MISSING** |
| 7.9 | Regenerate article | Article | New generation | IMPLEMENTED |
| 7.10 | Approve article | Article | Approved | IMPLEMENTED |
| 7.11 | Reject article | Article | Rejected | IMPLEMENTED |
| 7.12 | Publish article | Article | Published | IMPLEMENTED |
| 7.13 | Schedule article | Article | Scheduled | **PARTIAL** |
| 7.14 | Unpublish article | Article | Unpublished | IMPLEMENTED |
| 7.15 | Delete article | Article | Deleted | IMPLEMENTED |
| 7.16 | View article history | Article | History | **MISSING** |
| 7.17 | Compare article versions | Article | Comparison | **MISSING** |
| 7.18 | Export article (HTML) | Article | Downloaded | **MISSING** |
| 7.19 | Export article (Markdown) | Article | Downloaded | **MISSING** |
| 7.20 | Filter articles by status | /articles | Filtered | IMPLEMENTED |
| 7.21 | Search articles | /articles | Results | **MISSING** |
| 7.22 | Bulk approve articles | /articles | Approved | **MISSING** |
| 7.23 | Bulk publish articles | /articles | Published | **MISSING** |
| 7.24 | View calendar | /calendar | - | IMPLEMENTED |
| 7.25 | Drag article to reschedule | /calendar | Rescheduled | **PARTIAL** |

### Critical Gaps

1. **WYSIWYG Editor Missing**: Can't edit generated content
2. **Quality Gate Display Missing**: No visibility into scoring
3. **Generation Progress Missing**: No phase-by-phase visibility
4. **Version History Missing**: Can't see changes over time
5. **Export Missing**: Can't export for external use
6. **Article Search Missing**: Can't find articles
7. **Bulk Operations Missing**: Can't approve/publish multiple

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   ARTICLE GENERATION PROGRESS                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Generating: "Best Running Shoes 2026"                    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ✓ Research      ✓ Outline       ● Writing      ○ Review  │  │
│  │  ─────────────────●───────────────●────────────●───────── │  │
│  │                                                           │  │
│  │  Writing section 3 of 7: "Top Picks for Distance Running" │  │
│  │  ████████████████████░░░░░░░░░░  43%                      │  │
│  │                                                           │  │
│  │  ~2 minutes remaining                                     │  │
│  │                                                           │  │
│  │  [Cancel]                           [Run in Background]   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   QUALITY GATE PANEL                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Quality Gate: 84/100                        ✓ PASSED     │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  Threshold: 80 (configurable)                             │  │
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

## Domain 8: Voice & Branding (20 Journeys)

### Routes Covered
- `/clients/[id]/settings/voice`
- `/clients/[id]/settings` (branding section)

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 8.1 | View voice profile | /settings/voice | - | IMPLEMENTED |
| 8.2 | Edit voice mode | Mode tab | Saved | IMPLEMENTED |
| 8.3 | Edit voice tone | Tone tab | Saved | IMPLEMENTED |
| 8.4 | Edit vocabulary | Vocabulary tab | Saved | IMPLEMENTED |
| 8.5 | Edit writing style | Writing tab | Saved | IMPLEMENTED |
| 8.6 | Configure protection rules | Protection tab | Saved | IMPLEMENTED |
| 8.7 | Preview voice output | Preview tab | Preview shown | IMPLEMENTED |
| 8.8 | Analyze existing content | /settings/voice | Analysis complete | IMPLEMENTED |
| 8.9 | Import voice profile | /settings/voice | Imported | **MISSING** |
| 8.10 | Export voice profile | /settings/voice | Exported | **MISSING** |
| 8.11 | Reset voice to default | /settings/voice | Reset | **MISSING** |
| 8.12 | Clone voice from client | /settings/voice | Cloned | **MISSING** |
| 8.13 | View voice compliance score | Article | Score shown | **MISSING** |
| 8.14 | Upload brand logo | /settings | Logo saved | IMPLEMENTED |
| 8.15 | Set brand colors | /settings | Colors saved | IMPLEMENTED |
| 8.16 | Configure company info | /settings | Saved | IMPLEMENTED |
| 8.17 | Add brand guidelines | /settings | Saved | **PARTIAL** |
| 8.18 | View brand preview | /settings | Preview shown | **PARTIAL** |
| 8.19 | Quick voice setup wizard | First run | Voice configured | **MISSING** |
| 8.20 | Voice A/B testing | /settings/voice | Test results | **MISSING** |

### Critical Gaps

1. **Import/Export Missing**: Can't reuse voice profiles across clients
2. **Reset to Default Missing**: Can't undo all voice changes
3. **Clone from Client Missing**: Can't copy similar client's voice
4. **Compliance Display Missing**: Can't see voice match on articles
5. **Quick Setup Wizard Missing**: 40+ fields intimidate new users

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   VOICE PROFILE WIZARD                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Configure Brand Voice                     Step 1 of 3    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  How should we learn your brand voice?                    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  🔗 Analyze existing content (recommended)          │  │  │
│  │  │     We'll scan your website and learn your style    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📝 Answer 5 quick questions (3 min)                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  📋 Import from another client                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  ⚙️ Configure manually (40+ parameters)             │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   VOICE COMPLIANCE INDICATOR                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Voice Match: 86%  ████████████████████░░░░               │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │  ✓ Tone: Professional     ✓ Formality: Medium            │  │
│  │  ⚠ Vocabulary: 2 off-brand terms found                    │  │
│  │  [View details]                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 9: Connections (21 Journeys)

### Routes Covered
- `/clients/[id]/connections`
- `/connect/[token]`
- `/connect/success`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 9.1 | View all connections | /connections | - | IMPLEMENTED |
| 9.2 | Connect Google Search Console | /connections | Connected | IMPLEMENTED |
| 9.3 | Connect Google Analytics | /connections | Connected | IMPLEMENTED |
| 9.4 | Connect Google Business Profile | /connections | Connected | IMPLEMENTED |
| 9.5 | Connect WordPress | /connections | Connected | IMPLEMENTED |
| 9.6 | Connect Shopify | /connections | Connected | IMPLEMENTED |
| 9.7 | Select GSC property | OAuth callback | Property selected | **MISSING** |
| 9.8 | Select GA4 property | OAuth callback | Property selected | **MISSING** |
| 9.9 | Disconnect integration | /connections | Disconnected | IMPLEMENTED |
| 9.10 | Reconnect expired token | /connections | Reconnected | IMPLEMENTED |
| 9.11 | View connection health | /connections | Health status | **PARTIAL** |
| 9.12 | Test connection | /connections | Test result | **MISSING** |
| 9.13 | View connection logs | /connections | Log view | **MISSING** |
| 9.14 | Configure sync frequency | /connections | Saved | **MISSING** |
| 9.15 | Force sync now | /connections | Sync started | **PARTIAL** |
| 9.16 | View sync history | /connections | History | **MISSING** |
| 9.17 | Magic link connection | /connect/[token] | Connected | IMPLEMENTED |
| 9.18 | Magic link success | /connect/success | Dashboard | IMPLEMENTED |
| 9.19 | View token expiry | /connections | Expiry shown | **PARTIAL** |
| 9.20 | Configure webhooks | /connections | Webhooks saved | **MISSING** |
| 9.21 | Test webhook | /connections | Test result | **MISSING** |

### Critical Gaps

1. **Property Selection Missing**: OAuth completes but no way to select which site/property
2. **Connection Testing Missing**: Can't verify connection works
3. **Connection Logs Missing**: Can't debug sync issues
4. **Sync Configuration Missing**: Can't control how often data syncs
5. **Webhook Configuration Missing**: Can't set up real-time notifications

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   PROPERTY SELECTION MODAL                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Select Google Search Console Property                    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  You have access to 4 properties:                         │  │
│  │                                                           │  │
│  │  ○ sc-domain:acmecorp.com (recommended)                   │  │
│  │    Domain property - includes all subdomains              │  │
│  │                                                           │  │
│  │  ○ https://www.acmecorp.com/                              │  │
│  │    URL prefix - www subdomain only                        │  │
│  │                                                           │  │
│  │  ○ https://blog.acmecorp.com/                             │  │
│  │    URL prefix - blog subdomain                            │  │
│  │                                                           │  │
│  │  ○ https://shop.acmecorp.com/                             │  │
│  │    URL prefix - shop subdomain                            │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Cancel         │  │  Connect →      │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   CONNECTION HEALTH DASHBOARD                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Connection Health                                        │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ GSC         ✓ Connected    Last sync: 2h ago        │ │  │
│  │  │ [Test] [Sync Now] [View Logs]                       │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ GA4         ⚠ Expiring Soon   Token expires in 3d   │ │  │
│  │  │ [Refresh Token] [View Logs]                         │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ WordPress   🔴 Failed   Last error: 403 Forbidden   │ │  │
│  │  │ [Reconnect] [View Logs] [Test]                      │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Domain 10: Reports & Alerts (25 Journeys)

### Routes Covered
- `/clients/[id]/reports`
- `/clients/[id]/alerts`
- `/clients/[id]/analytics`

### Journey Inventory

| # | Journey | Entry Point | Exit Point | Status |
|---|---------|-------------|------------|--------|
| 10.1 | View all reports | /reports | - | IMPLEMENTED |
| 10.2 | Generate standard report | /reports | Report generated | IMPLEMENTED |
| 10.3 | Generate custom report | /reports | Report generated | **MISSING** |
| 10.4 | View report | /reports | Report view | IMPLEMENTED |
| 10.5 | Download report PDF | /reports | Downloaded | IMPLEMENTED |
| 10.6 | Download report CSV | /reports | Downloaded | **PARTIAL** |
| 10.7 | Email report to client | /reports | Emailed | **MISSING** |
| 10.8 | Schedule recurring report | /reports | Scheduled | **MISSING** |
| 10.9 | Customize report template | /reports | Saved | **MISSING** |
| 10.10 | Share report link | /reports | Link copied | **MISSING** |
| 10.11 | View all alerts | /alerts | - | IMPLEMENTED |
| 10.12 | Create alert rule | /alerts | Rule created | IMPLEMENTED |
| 10.13 | Edit alert rule | /alerts | Saved | IMPLEMENTED |
| 10.14 | Delete alert rule | /alerts | Deleted | IMPLEMENTED |
| 10.15 | View alert history | /alerts | History | IMPLEMENTED |
| 10.16 | Acknowledge alert | /alerts | Acknowledged | **PARTIAL** |
| 10.17 | Snooze alert | /alerts | Snoozed | **MISSING** |
| 10.18 | Configure notification channel | /alerts | Saved | **MISSING** |
| 10.19 | Test notification | /alerts | Test sent | **MISSING** |
| 10.20 | View analytics dashboard | /analytics | - | IMPLEMENTED |
| 10.21 | Change date range | /analytics | Updated | IMPLEMENTED |
| 10.22 | Compare periods | /analytics | Comparison view | **PARTIAL** |
| 10.23 | Export analytics | /analytics | Downloaded | **MISSING** |
| 10.24 | View traffic predictions | /analytics | Predictions | IMPLEMENTED |
| 10.25 | Configure analytics goals | /analytics | Saved | **PARTIAL** |

### Critical Gaps

1. **Custom Reports Missing**: Can't build tailored client reports
2. **Email Delivery Missing**: Can't send reports to clients
3. **Scheduled Reports Missing**: No automation of reporting
4. **Notification Channels Missing**: Only in-app alerts, no email/Slack
5. **Alert Snooze Missing**: Can't temporarily silence alerts
6. **Analytics Export Missing**: Can't export data for analysis

### Recommended Components

```
┌─────────────────────────────────────────────────────────────────┐
│                   CUSTOM REPORT BUILDER                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Build Custom Report                                      │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  Report Name: [Monthly SEO Summary                    ]   │  │
│  │                                                           │  │
│  │  Include Sections:                                        │  │
│  │  ☑ Executive Summary                                      │  │
│  │  ☑ Traffic Overview                                       │  │
│  │  ☑ Keyword Rankings                                       │  │
│  │  ☑ Top Pages                                              │  │
│  │  ☐ Technical Audit Summary                                │  │
│  │  ☑ Content Performance                                    │  │
│  │  ☐ Backlink Analysis                                      │  │
│  │  ☑ Goals Progress                                         │  │
│  │  ☐ Competitor Comparison                                  │  │
│  │                                                           │  │
│  │  Branding:                                                │  │
│  │  ○ Use client branding  ● Use agency branding            │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                │  │
│  │  │  Preview        │  │  Generate →     │                │  │
│  │  └─────────────────┘  └─────────────────┘                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION PREFERENCES                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Notification Channels                                    │  │
│  │  ──────────────────────────────────────────────────────── │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ In-App         ✓ Enabled                            │ │  │
│  │  │ All alerts appear in notification bell              │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Email          ○ Disabled                           │ │  │
│  │  │ [Configure Email Settings]                          │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Slack          ○ Disabled                           │ │  │
│  │  │ [Connect Slack Workspace]                           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Webhook        ○ Disabled                           │ │  │
│  │  │ [Configure Webhook URL]                             │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cross-Domain Gap Summary

### P0 Gaps (Blocking Core Vision)

| Gap | Domain | Impact |
|-----|--------|--------|
| No welcome modal/wizard | Auth | New users lost |
| No demo mode | Auth | Can't explore without setup |
| No v6 dashboard components | Client Dashboard | No activity/goal visibility |
| No property selection | Connections | OAuth flow incomplete |
| No generation progress | Content | Black box generation |
| No quality gate display | Content | Users can't trust auto-publish |
| No "fix with content" link | SEO Audit | Broken audit→content journey |
| No bulk operations | Keywords, Content | Agencies blocked |
| No convert-to-client | Prospects | Sales flow broken |
| No email delivery | Reports | Can't send to clients |
| No voice wizard | Voice | 40+ fields intimidating |
| No connection testing | Connections | Can't verify integration |

### P1 Gaps (Breaking User Trust)

| Gap | Domain | Impact |
|-----|--------|--------|
| No breadcrumbs | Global | Users lost in deep pages |
| No audit comparison | SEO Audit | Can't show progress |
| No mark-as-fixed | SEO Audit | Can't track remediation |
| No version history | Content | Can't see changes |
| No connection logs | Connections | Can't debug issues |
| No overnight summary | Client Dashboard | Don't know what system did |
| No voice compliance display | Voice | Can't verify voice match |
| No alert snooze | Alerts | Alert fatigue |
| No scheduled audits | SEO Audit | Manual operation |
| No scheduled reports | Reports | Manual operation |

### P2 Gaps (Killing Efficiency)

| Gap | Domain | Impact |
|-----|--------|--------|
| No CSV import/export | Keywords, Prospects | Bulk management blocked |
| No keyword tagging | Keywords | Can't organize |
| No WYSIWYG editor | Content | Can't edit articles |
| No article search | Content | Can't find articles |
| No report templates | Reports | Rebuilding each time |
| No client quick-switcher | Global | Slow switching |
| No recent items | Global | Repeated navigation |
| No sync configuration | Connections | No control |
| No notification channels | Alerts | In-app only |
| No analytics export | Analytics | Can't analyze offline |

---

## Implementation Roadmap

### Sprint 1: Onboarding Foundation (2 weeks)
- Welcome modal
- Setup wizard (5-step)
- Demo mode with sample data
- Getting started checklist enhancement

### Sprint 2: Dashboard v6 Components (2 weeks)
- TodayRail (activity feed)
- GoalHero with trajectory
- ForecastDiagnostics
- OpsStrip (system status)

### Sprint 3: Content Workflow (2 weeks)
- Generation progress stepper
- Quality gate panel
- WYSIWYG editor integration
- Article search

### Sprint 4: Cross-Domain Linking (2 weeks)
- Fix with content (audit→article)
- Property selection modal
- Convert prospect to client
- Keyword→Article linking

### Sprint 5: Bulk Operations (2 weeks)
- All clients view
- Bulk action bar
- CSV import/export
- Multi-select patterns

### Sprint 6: Trust & Visibility (2 weeks)
- Connection health dashboard
- Overnight summary banner
- Voice compliance indicator
- Breadcrumbs everywhere

### Sprint 7: Reporting Enhancement (2 weeks)
- Custom report builder
- Email delivery
- Scheduled reports
- Notification channels

### Sprint 8: Business Types (3 weeks)
- Business type selector
- Local business modules
- Ecommerce modules
- Affiliate modules

---

## Conclusion

This comprehensive journey mapping reveals that TeveroSEO has **63% of user journeys implemented** but critical paths are broken. The 75 identified gaps fall into clear categories:

1. **Onboarding gaps** (4) - New users have no guidance
2. **Visibility gaps** (15) - Users can't see what system does
3. **Workflow gaps** (20) - Key journeys have dead ends
4. **Efficiency gaps** (25) - Too many clicks, no bulk ops
5. **Integration gaps** (11) - Cross-domain links missing

Implementing the 8-sprint roadmap will close these gaps and transform TeveroSEO from a collection of tools into the $100M autonomous SEO platform the vision demands.
