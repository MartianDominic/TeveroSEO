# TeveroSEO Layout & Interface Analysis

> **Related Document**: [v1-architecture-deep-dive.md](./v1-architecture-deep-dive.md) — Page inventory, user journeys, domain architecture
> **Related Document**: [v1-ux-missing.md](./v1-ux-missing.md) — Gap analysis summary
> **Related Document**: [v3-critical-gaps.md](./v3-critical-gaps.md) — Critical gap analysis from 10 critic agents

---

## Executive Summary

This document provides a comprehensive layout analysis of the TeveroSEO platform across all three applications: `apps/web` (Next.js), `AI-Writer` (FastAPI + React), and `open-seo-main` (TanStack Start). Ten specialized agents analyzed distinct layout domains to map the complete interface architecture.

### Key Findings

| Domain | Current State | Critical Gaps |
|--------|---------------|---------------|
| **Sidebar/Navbar** | 2 identical implementations (apps/web, AI-Writer) + 1 different (open-seo-main) | No mobile responsive behavior in apps/web |
| **Client Switcher** | Popover + Command palette | No favorites, grouping, or cross-app context |
| **TopBar/Header** | Minimal (search trigger only) | No breadcrumbs, notifications, or quick actions |
| **Stat Cards** | 12+ variants, inconsistent patterns | No unified component, trend indicators vary |
| **Data Tables** | Mixed (shadcn + TanStack Table) | No inline editing, column resizing missing |
| **Charts** | Recharts throughout | No pie/gauge charts, limited interactivity |
| **Right Rail** | Does not exist | Need "Today" feed implementation |
| **Modals** | Radix Dialog/Sheet | Uses native `confirm()` in 5 places |
| **Forms** | Mixed (TanStack Form + manual state) | No date picker, inconsistent validation |
| **Page Layouts** | 8 distinct patterns | No 3-column shell, max-w varies |

### Target Design Direction

```
Full-bleed 3-column shell:
+------------+---------------------------+------------+
| Sidebar    | Main Content (fluid)      | Right Rail |
| 48-220px   | 1080-4K responsive        | 280-320px  |
+------------+---------------------------+------------+

Typography: Newsreader / Geist / Geist Mono
```

---

## Agent 1: Sidebar/Navbar Analysis

### Component Inventory

| App | Component | Path | Lines |
|-----|-----------|------|-------|
| apps/web | AppShell | `/apps/web/src/components/shell/AppShell.tsx` | 666 |
| apps/web | TopBar | `/apps/web/src/components/shell/TopBar.tsx` | 45 |
| apps/web | CommandPalette | `/apps/web/src/components/shell/CommandPalette.tsx` | 181 |
| AI-Writer | AppShell | `/AI-Writer/frontend/src/components/shell/AppShell.tsx` | 593 |
| AI-Writer | TopBar | `/AI-Writer/frontend/src/components/shell/TopBar.tsx` | 43 |
| open-seo-main | AuthenticatedAppLayout | `/open-seo-main/src/client/layout/AppShell.tsx` | 339 |
| open-seo-main | Sidebar | `/open-seo-main/src/client/components/Sidebar.tsx` | 84 |

### Width & Position Measurements

**apps/web & AI-Writer (Identical)**
```
Sidebar widths:
- Expanded: w-[220px] (220px)
- Collapsed: w-12 (48px)
- Transition: duration-200 ease-in-out

Position: Fixed left, full height
Logo row height: h-14 (56px)
```

**open-seo-main**
```
Top nav height: h-14 (56px)
Mobile drawer sidebar: w-64 (256px)
Desktop: NO persistent sidebar - top nav only

Breakpoint: md: (768px)
- < 768px: hamburger menu + drawer sidebar
- >= 768px: horizontal top nav, no sidebar
```

### Navigation Hierarchy

**apps/web & AI-Writer Menu Structure**
```
[Agency Dashboard] ---- not client-scoped, always visible
--- Client Section ---
[Dashboard]        /clients/{id}
[Calendar]         /clients/{id}/calendar
[Articles]         /clients/{id}/articles
[Intelligence]     /clients/{id}/intelligence
[Settings]         /clients/{id}/settings
[Analytics]        /clients/{id}/analytics
[SEO Audit]        /clients/{id}/seo
--- Workspace Section ---
[Global Settings]  /settings
--- Bottom Section ---
[UserButton]       Clerk account
[Theme Toggle]     Light/Dark
[Collapse Toggle]  Expand/Collapse
```

**open-seo-main Menu Structure**
```
[OpenSEO logo] -------- Link to /
--- Top Nav (Desktop) ---
[Keyword Research]  /p/{projectId}/keywords
[Saved Keywords]    /p/{projectId}/saved
[Domain Overview]   /p/{projectId}/domain
[Backlinks]         /p/{projectId}/backlinks
[Site Audit]        /p/{projectId}/audit
[AI]                /p/{projectId}/ai
--- Right Side ---
[Help icon]         /support
[Project Picker]    "Default" (disabled, coming soon)
[Account Menu]      User dropdown
```

### State Management

| App | Storage | Key | Persistence |
|-----|---------|-----|-------------|
| apps/web | localStorage | `appshell_collapsed` | Session |
| AI-Writer | localStorage | `COLLAPSED_KEY` | Session |
| open-seo-main | None | N/A | No collapsed state |

### Responsive Behavior

| App | Mobile Support | Implementation |
|-----|----------------|----------------|
| apps/web | **NO** | Sidebar always visible, collapses to icons |
| AI-Writer | **NO** | Same as apps/web |
| open-seo-main | **YES** | Hamburger + drawer overlay |

### Gaps vs $100M SaaS Standard

| Gap | Severity |
|-----|----------|
| No mobile responsive sidebar (apps/web, AI-Writer) | HIGH |
| No keyboard navigation within sidebar | MEDIUM |
| Duplicated 600-line AppShell files | HIGH |
| Inconsistent architecture (top-nav vs sidebar) | HIGH |
| No breadcrumbs | MEDIUM |
| No notification badges | LOW |
| No recent/favorites | LOW |

---

## Agent 2: Client Switcher Analysis

### Component Locations

| App | Component | Pattern |
|-----|-----------|---------|
| apps/web | `ClientSwitcherButton` + `ClientSwitcherPopoverContent` | Popover in sidebar |
| apps/web | `CommandPalette` | Cmd+K with client switching |
| AI-Writer | `ClientSwitcher` | Building2 icon dropdown |
| open-seo-main | None | URL-based projectId only |

### State Management

| App | Storage | Key | Cross-App |
|-----|---------|-----|-----------|
| apps/web | Cookie | `tevero-active-client-id` | 365-day expiry |
| AI-Writer | localStorage | `alwrity-client-store` | Browser-local only |
| open-seo-main | URL params | `$projectId` in route | None |

**Cross-App Context: NOT SHARED**
- Cookie vs localStorage mismatch
- open-seo-main completely disconnected

### Feature Matrix

| Feature | apps/web | AI-Writer | open-seo-main |
|---------|----------|-----------|---------------|
| Dropdown switcher | Yes | Yes | No |
| Search/filter | Yes | Yes | N/A |
| Visual indicators | Colored initials | Colored initials | N/A |
| Command palette | Yes (Cmd+K) | Yes (Cmd+K) | No |
| Keyboard shortcuts | Cmd+K only | Cmd+K only | No |

### Gap Analysis vs Enterprise Tools

| Feature | Notion/Linear | TeveroSEO |
|---------|---------------|-----------|
| Client grouping/folders | YES | NO |
| Favorites/pinning | YES | NO |
| Last accessed ordering | YES | NO |
| Recent items display | YES | NO |
| Logo/avatar uploads | YES | NO |
| Drag reorder | YES | NO |
| Health indicators | YES | NO |

---

## Agent 3: TopBar/Header Analysis

### Zone Breakdown

**apps/web TopBar**
```
Height: h-14 (56px)
Position: Static
Background: bg-background
Border: border-b border-border

+----------------------------------------------+
|  Left Zone    |   Center Zone   | Right Zone |
|  w-[60px]     |     Search      |  w-[60px]  |
|  (spacer)     |   ⌘K trigger    |  (empty)   |
+----------------------------------------------+
```

**open-seo-main TopNav**
```
Height: h-14 (56px)
Position: Static (shrink-0)

+------------------------------------------------------+
| Left: Logo + Nav     | Center: (flex-1) | Right      |
| Menu (mobile) +      |     spacer       | Project    |
| OpenSEO + navItems   |                  | picker +   |
| (desktop)            |                  | AccountMenu|
+------------------------------------------------------+
```

### Breadcrumb Status

| App | Status | Notes |
|-----|--------|-------|
| apps/web | NOT IMPLEMENTED | No breadcrumb component |
| AI-Writer | NOT IMPLEMENTED | PageHeader with backHref only |
| open-seo-main | NOT IMPLEMENTED | No breadcrumb component |

### Gaps vs Vercel/Linear/Notion Headers

| Feature | Industry Standard | TeveroSEO |
|---------|-------------------|-----------|
| Breadcrumbs | Full path | None |
| Global search | Prominent | Minimal trigger |
| Notifications | Bell icon | None |
| Quick actions | + New button | Per-page only |
| Sticky headers | Yes | No |
| Blur/glass effect | Yes | None |

---

## Agent 4: Stat Cards & Metrics Analysis

### Component Inventory (12+ Components)

| Component | Path | Purpose |
|-----------|------|---------|
| `StatCard` | `/components/analytics/StatCard.tsx` | Simple metric card |
| `QuickStatsCards` | `/components/dashboard/QuickStatsCards.tsx` | Draggable 6-card grid |
| `DraggableCard` | `/components/dashboard/DraggableCard.tsx` | Drag wrapper |
| `ScoreCard` | `/components/seo/ScoreCard.tsx` | SEO score breakdown |
| `GoalCard` | `/components/goals/GoalCard.tsx` | Goal progress |
| `GoalProjectionCard` | `/components/goals/GoalProjectionCard.tsx` | Projections |
| `OpportunityCard` | `/components/dashboard/OpportunityCard.tsx` | Opportunity detail |
| `ProspectCard` | `/components/prospects/ProspectCard.tsx` | Prospect info |
| `PortfolioHealthSummary` | `/components/dashboard/PortfolioHealthSummary.tsx` | 4-card KPI grid |
| `SparklineChart` | `/components/dashboard/SparklineChart.tsx` | Mini line chart |
| `LazySparkline` | `/components/dashboard/LazySparkline.tsx` | Lazy-load sparkline |
| `PositionDistributionBar` | `/components/dashboard/PositionDistributionBar.tsx` | Position stacked bar |

### Design Token Usage

```css
/* Trend Colors */
Positive/Up: text-emerald-600, bg-emerald-500
Negative/Down: text-red-600, text-red-500
Warning: text-yellow-600, bg-yellow-500
Neutral: text-muted-foreground
```

### Grid System

| Pattern | Classes | Usage |
|---------|---------|-------|
| 6-column | `grid-cols-2 md:grid-cols-3 lg:grid-cols-6` | QuickStatsCards |
| 4-column | `grid-cols-2 md:grid-cols-4` | PortfolioHealthSummary |
| 3-column | `grid-cols-1 sm:grid-cols-3` | ClientDashboardPage |

### Gaps vs Stripe/Plausible

| Feature | Best Practice | TeveroSEO |
|---------|---------------|-----------|
| Animated counters | Yes | Static values |
| Sparkline in every card | Default | Optional |
| Click-through from cards | Yes | Inconsistent |
| Data freshness indicator | "Updated 2m ago" | Missing |
| Card actions menu | Three-dot | Some cards only |

---

## Agent 5: Data Tables Analysis

### Table Implementations

| Table | Technology | Sort | Filter | Pagination | Selection |
|-------|------------|------|--------|------------|-----------|
| ClientPortfolioTable | shadcn + custom | Client-side | Multi-field | Cursor + infinite | Multi |
| QueriesTable | shadcn | No | No | No | No |
| FindingsTable | shadcn | No | Multi-field | No | No |
| ArticlesTable | shadcn | Client-side | Status + search | No | Multi |
| BacklinksTable | TanStack Table | TanStack | No | No | No |
| ProspectsTable | TanStack Table | TanStack | TanStack | No | Multi |

### Technology Patterns

| App | Base | Sorting | Selection |
|-----|------|---------|-----------|
| apps/web | shadcn Table | Custom hooks | `useRowSelection` hook |
| open-seo-main | TanStack Table v8 | `getSortedRowModel()` | TanStack built-in |
| AI-Writer | Local shadcn copy | Same as apps/web | Same pattern |

### Advanced Features Present

- **Row Expansion**: FindingsTable, ArticlesTable, BacklinksTable
- **Bulk Actions**: BulkActionBar, ArticlesTable
- **Column Customization**: ColumnCustomizer with @dnd-kit
- **Saved Views**: ViewConfig persistence
- **Virtualization**: @tanstack/react-virtual (optional)

### Gaps vs Airtable/Notion

| Feature | Industry Standard | TeveroSEO |
|---------|-------------------|-----------|
| Column resizing | Drag handles | Missing |
| Inline editing | Click-to-edit | Missing |
| Views (kanban, gallery) | Multiple types | Table only |
| Conditional formatting | Rule-based | Manual badges |
| Row height toggle | Compact/Normal/Expanded | Fixed |

---

## Agent 6: Charts & Visualizations Analysis

### Chart Library

All three apps use **Recharts**:
- apps/web: recharts ^3.8.1
- open-seo-main: recharts ^3.7.0
- AI-Writer: recharts ^3.2.0

### Chart Component Inventory

| App | Component | Type | Purpose |
|-----|-----------|------|---------|
| apps/web | GA4Chart | Line | Google Analytics sessions |
| apps/web | GSCChart | Line (dual Y-axis) | Search Console metrics |
| apps/web | SparklineChart | Line (minimal) | Inline trends |
| apps/web | RankHistoryChart | Line + ReferenceLine | Keyword position history |
| apps/web | PositionDistributionBar | Stacked bar (CSS) | Position distribution |
| open-seo-main | BillingUsageChart | Bar | Usage tracking |
| open-seo-main | BacklinksTrendChart | Line (dual Y-axis) | Backlink trends |
| open-seo-main | TrafficChart | Area (animated) | Traffic projections |

### Color System

| Purpose | Color |
|---------|-------|
| Primary series | `hsl(var(--primary))` |
| Secondary series | `hsl(var(--chart-2))` |
| Positive trend | Emerald-600 |
| Negative trend | Red-500 |

### Gaps vs Plausible/Vercel Analytics

| Feature | Best Practice | TeveroSEO |
|---------|---------------|-----------|
| Pie/donut charts | Common | Not used |
| Gauge/radial charts | For scores | Not used |
| Date range picker (calendar) | Full calendar | Only 30/90 presets |
| Zoom/pan on charts | Standard | Not implemented |
| Comparison mode | Period over period | Not implemented |
| Annotations | Mark events | Not implemented |

---

## Agent 7: Right Rail/Activity Feed Analysis

### Current State

**Right Rail: DOES NOT EXIST**

Current AppShell is 2-column only:
```
[Sidebar] | [TopBar + Main Content]
```

**Activity Feed**: Exists but embedded in dashboard page, not in shell

### Activity Data Sources Available

| Source | Events | API |
|--------|--------|-----|
| WebSocket | alert.triggered, ranking.drop/gain, report.generated, sync.completed | Socket.IO |
| Agent Activity | AgentRun, AgentEvent, AgentAlert, AgentApprovalRequest | Huddle Feed API |
| Audit Logs | Entity mutations (create, update, delete) | getAuditHistory |
| Dashboard | AttentionItem, WinItem, ScheduledItem | Dashboard API |
| Today Workflow | plan, generate, publish, analyze, engage, remarket | Workflow Service |

### Design Specification for "Today" Feed

**Event Categories**:
- Agent Activity (High priority)
- SEO Wins (High priority)
- Alerts (Critical)
- Tasks (Medium)
- Sync (Low)
- Scheduled (Medium)
- Content (Medium)

**Grouping Strategy**:
- "Just Now" (< 5 min)
- "Earlier Today"
- "Yesterday"
- "This Week"

**Quick Actions**:
- Alert: View, Acknowledge, Dismiss, Snooze
- Approval: Approve, Reject, View details
- Task: Start, Skip, View
- Report: Download, Share, View

### Implementation Plan

1. **Phase 1**: Add RailSlot to AppShell
2. **Phase 2**: Create unified activity service
3. **Phase 3**: Implement real-time updates via Socket.IO
4. **Phase 4**: Add persistence layer

---

## Agent 8: Modals & Dialogs Analysis

### Base Components

| Component | Library | Location |
|-----------|---------|----------|
| Dialog | @radix-ui/react-dialog | `@tevero/ui` |
| Sheet | @radix-ui/react-dialog | `@tevero/ui` |
| AlertDialog | @radix-ui/react-alert-dialog | open-seo-main only |

### Modal Types in Use

| Type | Count | Examples |
|------|-------|----------|
| Form Dialog | 12 | AddClientModal, ExportDialog, AddProspectDialog |
| Command Palette | 2 | CommandPalette (apps/web, AI-Writer) |
| Side Sheet | 1 | AlertDrawer |
| Multi-step Wizard | 2 | GoalSetupWizard, SigningModal |
| Selection Dialog | 1 | LossReasonModal |

### Trigger Patterns

- **Controlled Mode** (60%): `<Dialog open={open} onOpenChange={onOpenChange}>`
- **DialogTrigger** (40%): `<DialogTrigger asChild><Button>Open</Button></DialogTrigger>`

### Sizing Conventions

| Size | Class | Usage |
|------|-------|-------|
| Small | `max-w-md` | Simple forms |
| Medium | `max-w-lg` | Export, multi-field |
| Large | `max-w-2xl` | Wizards, tables |

### Gaps vs Linear/Notion

| Issue | Impact |
|-------|--------|
| Uses native `confirm()` (5 places) | Non-standard UX |
| Missing DialogDescription (40%) | WCAG violation |
| No bottom sheet for mobile | Poor mobile UX |
| No stacked/nested modals | Limited composition |
| SubscriptionExpiredModal bypasses Radix | Inconsistent |

---

## Agent 9: Forms & Inputs Analysis

### Form Libraries

| App | Library | Pattern |
|-----|---------|---------|
| open-seo-main | @tanstack/react-form | Field-level validation |
| apps/web | Manual useState | Direct state management |
| AI-Writer | Manual useState | Same as apps/web |

### Input Components Available

| Component | Library | Present |
|-----------|---------|---------|
| Input | shadcn/Radix | Yes |
| Textarea | shadcn | Yes |
| Select | Radix Select | Yes |
| Checkbox | Radix Checkbox | Yes |
| Switch | Radix Switch | Yes |
| Slider | Radix Slider | Yes |
| RadioGroup | Radix RadioGroup | open-seo-main only |
| Date Picker | - | **NOT PRESENT** |
| Time Picker | - | **NOT PRESENT** |
| Rich Text Editor | - | **NOT PRESENT** |

### Validation Approach

| Layer | Implementation |
|-------|----------------|
| API routes | Zod schemas |
| Form-level (open-seo-main) | Custom validation functions |
| Form-level (apps/web) | None (relies on API) |

### Advanced Patterns

- **Autosave**: Save on blur/change/commit
- **Dirty State**: Manual tracking (BrandingForm only)
- **Dynamic Arrays**: TonePersonalityTab
- **Form Persistence**: Error recovery only

### Gaps vs Linear/Notion Forms

| Feature | Best Practice | TeveroSEO |
|---------|---------------|-----------|
| Client-side validation | All forms | Inconsistent |
| Required field indicators | Asterisk | Missing |
| Date picker | Native component | Missing |
| Multi-step wizard | Stepper with progress | Partial |
| Dirty state warnings | "Unsaved changes" dialog | BrandingForm only |
| Rich text editing | TipTap/ProseMirror | None |

---

## Agent 10: Page Layout Patterns Analysis

### Shell Structure

```
+---------------------+----------------------------------+
| Sidebar (flex col)  | Content Column (flex-1 flex-col) |
| w-12 or w-[220px]   | TopBar (h-14)                    |
|                     | main (flex-1 overflow-y-auto)    |
+---------------------+----------------------------------+
```

### Page Templates Identified (8)

| Pattern | Container | Example |
|---------|-----------|---------|
| Dashboard | `p-8 max-w-7xl mx-auto space-y-8` | `/dashboard` |
| List/Table | `p-6 space-y-4` | `/clients/[id]/articles` |
| Client Grid | `p-8 max-w-6xl mx-auto space-y-8` | `/clients` |
| Detail | `p-8 md:p-10 space-y-8` | `/clients/[id]` |
| Settings | `max-w-3xl mx-auto px-6 py-8` | `/clients/[id]/settings` |
| Editor/Wizard | `min-h-screen p-8 md:p-10` | `/articles/new` |
| SEO Audit | `px-4 py-4 md:px-6 md:py-6` | `/seo/[projectId]/audit` |
| Global Settings | `max-w-3xl mx-auto px-8 py-10` | `/settings` |

### Breakpoint System (Tailwind Defaults)

| Breakpoint | Width | Usage |
|------------|-------|-------|
| sm | 640px | Form grids 2-col |
| md | 768px | Client grid 2-col |
| lg | 1024px | Dashboard 2-col |
| xl | 1280px | Dashboard 3-col |
| 2xl | 1536px | (unused) |

### Container Width Inconsistencies

| Pattern | Max Width |
|---------|-----------|
| Dashboard | `max-w-7xl` |
| List Pages | `max-w-6xl` |
| Settings | `max-w-3xl` |
| Audit | `max-w-5xl` |

### Design System Gaps

| Gap | Impact |
|-----|--------|
| No right rail component | No "Today" feed |
| No full-bleed support | Tables truncate |
| No 4K breakpoints | Excessive whitespace |
| Inconsistent spacing tokens | Visual inconsistency |

### 3-Column Shell Implementation Plan

**Target Structure**:
```
+------------+---------------------------+------------+
| Sidebar    | Main Content (fluid)      | Right Rail |
| 48-220px   | 1080-4K responsive        | 280-320px  |
+------------+---------------------------+------------+
```

**Responsive Behavior**:

| Viewport | Sidebar | Main | Rail |
|----------|---------|------|------|
| < 1024px | collapsed | 100% | hidden |
| 1024-1280px | expanded | 100% | hidden/overlay |
| 1280-1536px | expanded | fluid | collapsed (icons) |
| 1536px+ | expanded | fluid | expanded |
| 2560px+ | expanded | constrained | expanded |

**Proposed CSS Variables**:
```css
:root {
  --shell-sidebar-collapsed: 48px;
  --shell-sidebar-expanded: 220px;
  --shell-rail-collapsed: 48px;
  --shell-rail-expanded: 280px;
  --shell-topbar-height: 56px;
  
  --content-max-narrow: 768px;
  --content-max-medium: 1024px;
  --content-max-wide: 1280px;
  --content-max-full: none;
  
  --page-padding-x: clamp(16px, 3vw, 40px);
  --page-padding-y: clamp(24px, 3vh, 40px);
}
```

---

## Implementation Priority Matrix

### P0: Critical for World-Class UX

| Item | Domain | Complexity | Impact |
|------|--------|------------|--------|
| Mobile sidebar drawer | Sidebar | Medium | Platform unusable on mobile |
| Breadcrumb system | TopBar | Low | Users lost in deep pages |
| Right rail infrastructure | Shell | High | Required for "Today" feed |
| AlertDialog component | Modals | Low | Replace native confirm() |
| Date picker component | Forms | Low | Missing basic input |

### P1: Enterprise-Grade

| Item | Domain | Complexity |
|------|--------|------------|
| Unified stat card variants | Stat Cards | Medium |
| Column resizing for tables | Tables | Medium |
| Cross-app client context | Client Switcher | High |
| Inline table editing | Tables | High |
| Form validation consistency | Forms | Medium |

### P2: $100M Polish

| Item | Domain | Complexity |
|------|--------|------------|
| Notification bell | TopBar | Medium |
| Client favorites/pinning | Client Switcher | Low |
| Chart zoom/pan | Charts | Medium |
| Animated counters | Stat Cards | Low |
| Sticky headers | TopBar | Low |
| Bottom sheet for mobile | Modals | Medium |

---

## Key File References

### Shell & Layout
- `/apps/web/src/components/shell/AppShell.tsx` — Main shell (666 lines)
- `/apps/web/src/components/shell/TopBar.tsx` — TopBar (45 lines)
- `/AI-Writer/frontend/src/components/shell/AppShell.tsx` — Duplicate shell (593 lines)
- `/open-seo-main/src/client/layout/AppShell.tsx` — Different pattern (339 lines)

### UI Components
- `/packages/ui/src/components/` — Shared shadcn components
- `/apps/web/src/components/dashboard/` — Dashboard components
- `/apps/web/src/components/analytics/` — Analytics components

### State Management
- `/apps/web/src/stores/clientStore.ts` — Zustand client store
- `/apps/web/src/lib/cookies.ts` — Cookie persistence

### Validation
- `/apps/web/src/lib/validations/api-schemas.ts` — Zod schemas

---

## Next Steps

1. **Consolidate shell components** — Extract to `packages/shell` or `packages/ui`
2. **Add mobile responsive drawer** — Match open-seo-main pattern
3. **Implement 3-column shell** — Per phased plan above
4. **Create component library** — Unified stat cards, trend indicators, date picker
5. **Standardize form patterns** — Single form library across apps
