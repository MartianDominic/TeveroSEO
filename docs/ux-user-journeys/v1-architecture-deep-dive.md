# TeveroSEO v1 Architecture Deep Dive

> **Generated**: 2026-04-29 by 10 parallel Opus 4.5 agents
> **Related**: [v1-ux-missing.md](./v1-ux-missing.md) | [v2-layout-analysis.md](./v2-layout-analysis.md) | [v3-critical-gaps.md](./v3-critical-gaps.md)

This document contains the complete, verbatim output from 10 specialized architecture analysis agents. Each agent performed a deep-dive into a specific domain of the TeveroSEO platform.

---

## Table of Contents

1. [Agent 1: Global Shell & Navigation Architecture](#agent-1-global-shell--navigation-architecture)
2. [Agent 2: Client Management & Onboarding Architecture](#agent-2-client-management--onboarding-architecture)
3. [Agent 3: SEO Audit Workflow Architecture](#agent-3-seo-audit-workflow-architecture)
4. [Agent 4: Keyword Intelligence Architecture](#agent-4-keyword-intelligence-architecture)
5. [Agent 5: Content & Articles Architecture](#agent-5-content--articles-architecture)
6. [Agent 6: Backlinks & Link Building Architecture](#agent-6-backlinks--link-building-architecture)
7. [Agent 7: Analytics & Reporting Architecture](#agent-7-analytics--reporting-architecture)
8. [Agent 8: Integrations & Connections Architecture](#agent-8-integrations--connections-architecture)
9. [Agent 9: Settings & Configuration Architecture](#agent-9-settings--configuration-architecture)
10. [Agent 10: Cross-Domain Journey Synthesis](#agent-10-cross-domain-journey-synthesis)

---

# Agent 1: Global Shell & Navigation Architecture

## 1. Shell Architecture Map

### 1.1 Layout Component Hierarchy

```
apps/web/src/app/(shell)/layout.tsx
  |
  +--> ThemeProvider (Context: theme, toggleTheme)
       |
       +--> AppShell
            |
            +--> <aside> (Sidebar - fixed left)
            |    |
            |    +--> Logo Row (TeveroMark + "TeveroSEO")
            |    +--> ClientSwitcherButton (Popover with Command search)
            |    +--> <nav> (Primary navigation links)
            |    |    +--> Dashboard (global)
            |    |    +--> Client Section: Dashboard, Calendar, Articles, Intelligence, Settings, Analytics, SEO Audit
            |    |    +--> Workspace Section: Global Settings
            |    +--> Bottom Section
            |         +--> UserButton (Clerk)
            |         +--> Theme Toggle
            |         +--> Collapse Toggle
            |
            +--> <div> (Main content column)
                 |
                 +--> TopBar (fixed top - centered search trigger)
                 +--> <main> (scrollable content area)
                      |
                      +--> ErrorBoundary
                           |
                           +--> {children}
            |
            +--> CommandPalette (Dialog overlay)
            +--> KeyboardShortcutsHelp (Dialog overlay)
```

### 1.2 Fixed Regions and Their Contents

| Region | Type | Contents | Behavior |
|--------|------|----------|----------|
| Sidebar (`<aside>`) | Fixed left | Logo, client switcher, nav, user controls | Collapsible (220px expanded / 48px collapsed) |
| TopBar (`<header>`) | Fixed top | Command palette trigger (centered) | Always visible, h-14 |
| Main (`<main>`) | Scrollable | Page content | flex-1 overflow-y-auto |

### 1.3 Responsive Breakpoints

The current implementation has **limited responsive handling**:

- **Sidebar**: No mobile-specific behavior - sidebar is always visible
- **TopBar**: Uses `sm:inline-block` for keyboard shortcut badge visibility
- **Client pages**: Use `sm:grid-cols-*`, `md:grid-cols-*`, `lg:grid-cols-*` for grid layouts
- **Missing**: No hamburger menu, no mobile drawer, no responsive sidebar collapse

**Critical Gap**: The sidebar has no mobile breakpoint behavior - it will always render at its fixed width, causing layout issues on mobile devices.

---

## 2. Navigation Inventory

### 2.1 Primary Sidebar Navigation

| Nav Element | Type | Destination | Context Params | Active State | Badge/Indicator |
|-------------|------|-------------|----------------|--------------|-----------------|
| Dashboard (Global) | Button | `/dashboard` | None | `pathname.startsWith(href)` | None |
| Client Dashboard | Button | `/clients/{clientId}` | clientId | Exact match only | None |
| Calendar | Button | `/clients/{clientId}/calendar` | clientId | `pathname.startsWith(href)` | None |
| Articles | Button | `/clients/{clientId}/articles` | clientId | `pathname.startsWith(href)` | None |
| Intelligence | Button | `/clients/{clientId}/intelligence` | clientId | `pathname.startsWith(href)` | None |
| Settings | Button | `/clients/{clientId}/settings` | clientId | `pathname.startsWith(href)` | None |
| Analytics | Button | `/clients/{clientId}/analytics` | clientId | `pathname.startsWith(href)` | None |
| SEO Audit | Button | `/clients/{clientId}/seo` | clientId | `pathname.startsWith(href)` | None |
| Global Settings | Button | `/settings` | None | `pathname.startsWith(href)` | **Platform health dot** (green/amber/red) |

### 2.2 Secondary Navigation (Nested Pages)

| Parent Page | Child Tabs/Pages | Context |
|-------------|------------------|---------|
| `/clients/{id}/settings` | Brand & AI, CMS Integration, Publishing, Goals | clientId |
| `/clients/{id}/settings/voice` | Mode, Tone, Vocabulary, Writing, Protection, Preview | clientId |
| `/clients/{id}/seo/{projectId}` | Audit, Backlinks | clientId, projectId |
| `/clients/{id}/intelligence` | Overview, Keywords, Brand Voice & ICP, Content Gaps | clientId |
| `/clients/{id}/calendar` | Calendar View, Approval Pipeline | clientId |
| `/clients/{id}/analytics` | Search Performance (GSC), Traffic (GA4) | clientId |
| `/clients/{id}/connections` | CMS Connections, OAuth Connections | clientId |
| `/settings` (global) | API Integrations, Voice Templates, Model Defaults | None |

### 2.3 PageHeader Back Navigation

The `PageHeader` component provides contextual back navigation via `backHref` prop:

| Page | Back Link |
|------|-----------|
| Client Dashboard | `/clients` |
| Client Settings | `/clients/{clientId}` |
| Voice Settings | `/clients/{clientId}/settings` |
| Analytics | `/clients/{clientId}` |
| Intelligence | `/clients/{clientId}` |
| Connections | `/clients/{clientId}` |

---

## 3. Client Context Flow

### 3.1 How Client Switching Works

**State Management**: Zustand store (`useClientStore`) with cookie persistence

```typescript
// Key state:
interface ClientState {
  clients: Client[];
  activeClientId: string | null;
  activeClient: Client | null;
  isLoading: boolean;
}
```

**Persistence**: `tevero-active-client-id` cookie via `js-cookie` with 365-day expiration

**Switching Flow**:
1. User clicks client in `ClientSwitcherButton` popover
2. `setActiveClient(clientId)` updates Zustand state
3. `router.push(/clients/{clientId})` navigates
4. `router.refresh()` triggers server-side re-render
5. Cookie is synced via Zustand persist middleware

### 3.2 State Persistence vs Reset on Client Switch

| State | Persists | Resets |
|-------|----------|--------|
| `activeClientId` | Yes (cookie) | No |
| Theme preference | Yes (localStorage) | No |
| Sidebar collapsed | Yes (localStorage) | No |
| Analytics data | No | Yes (per-client fetch) |
| Articles list | No | Yes (per-client fetch) |
| Intelligence data | No | Yes (per-client fetch) |
| Calendar articles | No | Yes (per-client fetch) |

### 3.3 URL Structure with Client Context

```
/dashboard                           # Global agency dashboard
/clients                             # Client list
/clients/{clientId}                  # Client dashboard
/clients/{clientId}/calendar         # Content calendar
/clients/{clientId}/articles         # Article library
/clients/{clientId}/articles/new     # New article editor
/clients/{clientId}/articles/{id}    # Article editor
/clients/{clientId}/intelligence     # Website intelligence
/clients/{clientId}/analytics        # GSC/GA4 analytics
/clients/{clientId}/settings         # Client settings
/clients/{clientId}/settings/voice   # Voice profile (nested)
/clients/{clientId}/connections      # OAuth/CMS connections
/clients/{clientId}/seo              # SEO landing (redirects)
/clients/{clientId}/seo/{projectId}/audit     # SEO audit
/clients/{clientId}/seo/{projectId}/backlinks # Backlinks
/settings                            # Global settings (API keys, templates)
```

---

## 4. Global UI Patterns

### 4.1 Search Functionality

**Command Palette** (`Cmd/Ctrl + K`):
- Opens via keyboard shortcut or TopBar button click
- Searches clients by name
- Provides navigation shortcuts to client pages
- "Add new client" quick action
- **Location**: `apps/web/src/components/shell/CommandPalette.tsx`

**Client Switcher Search**:
- Built into sidebar popover
- Uses `@tevero/ui` Command component (cmdk)
- Filters clients by name in real-time

### 4.2 Notifications

**Current Implementation**: Minimal notification system

- **Platform Health Indicator**: Red/amber/green dot on Global Settings nav item
- **Intelligence Status Banner**: Shows scrape progress with WebSocket live updates
- **Toast Notifications**: Local component-level toasts (not global)

**Missing**:
- No global notification center/bell
- No real-time notification stream
- No notification history/inbox

### 4.3 Quick Actions

| Action | Trigger | Location |
|--------|---------|----------|
| Open Command Palette | `Cmd/Ctrl + K` | Global |
| Show Keyboard Help | `?` | Global |
| Navigate up/down | `j/k` or arrows | Tables |
| Focus search | `/` | Dashboard tables |
| Toggle theme | Sidebar button | Global |
| Add new client | Command palette or button | Multiple |

### 4.4 User Menu

**Location**: Bottom of sidebar (not header)
- Clerk `UserButton` component for auth management
- Theme toggle (sun/moon icon)
- Sidebar collapse toggle

---

## 5. UX Gap Analysis

### 5.1 Missing Navigation Patterns for $100M Software

| Pattern | Benchmarks (Notion, Linear, Ahrefs) | TeveroSEO Status | Impact |
|---------|-------------------------------------|------------------|--------|
| **Breadcrumbs** | Standard in Ahrefs, Notion | Missing | Users lose context in nested pages |
| **Mobile Navigation** | Drawer/hamburger on mobile | Missing | Mobile unusable |
| **Global Notifications** | Bell icon with dropdown | Missing | Users miss important events |
| **Favorites/Pins** | Star frequently used items | Missing | Extra clicks for power users |
| **Recent Items** | Quick access to recent pages | Missing | No context continuity |
| **Search Results Page** | Dedicated search results | Missing | Search only navigates |
| **Secondary Sidebar** | Project/context sidebar | Missing | Deep pages lack hierarchy |
| **Workspace Switcher** | Multi-org/team support | Partial (Clerk orgs) | Single-workspace assumption |

### 5.2 Cognitive Load Issues

1. **Deep Nesting Without Context**: Voice settings is 3 levels deep (`/clients/{id}/settings/voice`) with no breadcrumb trail

2. **Inconsistent Tab Placement**: Some pages use horizontal tabs (`TabsList`), others use vertical sections, some use neither

3. **Client Context Ambiguity**: When on global pages like `/dashboard` or `/settings`, active client badge still shows but nav items are disabled

4. **Missing Loading States**: TopBar has no loading indicator for route transitions

5. **Overloaded Settings**: Client settings page has 4 tabs with 50+ fields - no progressive disclosure

### 5.3 Interlinking Opportunities

| From | To | Suggestion |
|------|-----|------------|
| Articles table row | Intelligence (keyword source) | "View keyword data" link |
| Intelligence keywords | Article editor | "Create article" CTA (exists) |
| Client dashboard | All client pages | Quick action cards (exists) |
| Calendar article | Article editor | Click to edit (exists) |
| Analytics | SEO Audit | "Go to SEO Audit" button (exists) |
| Missing: SEO Audit | Recommendations | No "Fix this" actions |
| Missing: Global dashboard | Client deep pages | Only goes to client dashboard |

---

## 6. Recommendations

### 6.1 World-Class Navigation Improvements

#### P0 - Critical (Mobile Unusable)

1. **Implement Mobile Navigation Drawer**
   - Add hamburger menu trigger in TopBar on `md:` breakpoint
   - Slide-out drawer with full navigation
   - Backdrop overlay to close

2. **Add Breadcrumb Trail**
   - Component: `<Breadcrumb items={[{label, href}]} />`
   - Auto-generate from route segments
   - Place below TopBar or in PageHeader

#### P1 - High Value

3. **Global Notification Center**
   - Bell icon in TopBar with unread count badge
   - Dropdown with notification list
   - Categories: Alerts, Intelligence Complete, Publishing Status, Audit Findings

4. **Recent Items / History**
   - Last 5-10 visited pages
   - Store in localStorage
   - Access via Command Palette "Recent" section

5. **Favorites/Starred Clients**
   - Star icon on client cards and in switcher
   - "Starred" section at top of client switcher
   - Persist in user preferences (Clerk metadata or DB)

#### P2 - Quality of Life

6. **Enhanced Command Palette**
   - Add "Go to [section]" commands for all nav items
   - Add "Create article for [client]" quick action
   - Add "Run audit on [client]" quick action
   - Fuzzy search across clients and pages

7. **Secondary Sidebar for SEO Tools**
   - When in `/clients/{id}/seo/*` show project-specific sidebar
   - List audit history, saved views, quick filters

### 6.2 Power-User Shortcuts Needed

| Shortcut | Action | Status |
|----------|--------|--------|
| `Cmd+K` | Command palette | Implemented |
| `?` | Keyboard help | Implemented |
| `j/k` | Navigate rows | Implemented (tables) |
| `g d` | Go to Dashboard | Documented, not implemented |
| `g c` | Go to Clients | Documented, not implemented |
| `g s` | Go to Settings | Documented, not implemented |
| `c n` | Create new article | Not implemented |
| `Esc` | Close modal/sheet | Standard (Radix) |
| `[/]` | Collapse/expand sidebar | Not implemented |
| `1-7` | Switch to nth client nav item | Not implemented |

### 6.3 Mobile Experience Gaps

| Issue | Current Behavior | Recommendation |
|-------|------------------|----------------|
| Sidebar always visible | Takes ~220px on all screens | Hide on `<md:`, show drawer |
| TopBar search button | Visible but small | Increase tap target, full-width on mobile |
| Tables not scrollable | Overflow hidden/breaks | Horizontal scroll wrapper |
| Tab lists | Horizontal scroll | Consider vertical or accordion on mobile |
| Client switcher | Popover may clip | Full-screen modal on mobile |
| PageHeader | May wrap poorly | Stack title/actions vertically |

---

## 7. Key File Paths

### Shell & Navigation
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/layout.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/TopBar.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/CommandPalette.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/dashboard/KeyboardShortcutsHelp.tsx`

### State Management
- `/home/dominic/Documents/TeveroSEO/apps/web/src/stores/clientStore.ts`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/cookies.ts`

### Shared UI Components
- `/home/dominic/Documents/TeveroSEO/packages/ui/src/components/page-header.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/components/error-boundary.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/contexts/ThemeContext.tsx`

### Client-Scoped Pages
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/voice/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/articles/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/calendar/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/intelligence/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/analytics/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/connections/page.tsx`

### Global Pages
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/dashboard/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/settings/page.tsx`
- `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/page.tsx`

---

## Summary

TeveroSEO has a solid foundation for a B2B SaaS shell with:
- Clean sidebar-based navigation with collapsible state
- Client context switching with cookie persistence
- Command palette for keyboard-first users
- Consistent page header pattern with back navigation

However, to reach $100M software standards (Notion, Linear, Ahrefs, Figma), the platform needs:

1. **Mobile navigation** - currently broken/unusable
2. **Breadcrumbs** - users lose context in nested routes
3. **Global notifications** - no bell icon or notification center
4. **Enhanced keyboard shortcuts** - documented but many not implemented
5. **Favorites/recent items** - no quick access patterns
6. **Secondary navigation** - deep pages lack hierarchy visualization

The most critical gap is mobile responsiveness - the sidebar has no breakpoint handling and will render at full width on all screen sizes, making the app unusable on phones and tablets.

---

# Agent 2: Client Management & Onboarding Architecture

## Executive Summary

TeveroSEO is a multi-tenant B2B SEO platform where agencies manage multiple client accounts. The client context is the central architectural element - all content generation, SEO audits, analytics, and publishing flow from "which client am I working on." This analysis documents the complete client lifecycle from creation through mature usage, identifying strengths and UX gaps.

---

## 1. Client Data Model

### Core Entity Definition

**Location:** `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py`

```
Table: clients (SharedBase - PostgreSQL)
├── id: UUID (primary key, auto-generated)
├── name: VARCHAR(255) (required)
├── website_url: VARCHAR(500) (optional)
├── workspace_id: VARCHAR(255) (nullable, Clerk org linkage)
├── is_archived: BOOLEAN (default: false, soft-delete flag)
├── created_at: TIMESTAMP
└── updated_at: TIMESTAMP
```

**TypeScript Interface:** `/home/dominic/Documents/TeveroSEO/packages/types/src/client.ts`
```typescript
interface Client {
  id: string;
  name: string;
  website_url: string | null;
  is_archived: boolean;
}
```

### Related Entities

| Entity | Relationship | Purpose |
|--------|--------------|---------|
| `ClientSettings` | 1:1 | Brand voice, model overrides, CMS credentials |
| `ClientPublishingSettings` | 1:1 | Publishing frequency, word counts, auto-publish |
| `ScheduledArticle` | 1:many | Content calendar items |
| `CsvImportBatch` | 1:many | Bulk article imports |
| `ClientAnalyticsSnapshot` | 1:many | GSC/GA4 data snapshots |
| `OAuthConnection` | 1:many | Google/Bing OAuth tokens |
| `ClientIntelligence` | 1:1 | Scraped brand voice, keywords, competitors |

### Required vs Optional Fields

| Field | Required | Validation | Notes |
|-------|----------|------------|-------|
| `name` | Yes | 1-255 chars | Displayed in sidebar, cards |
| `website_url` | No | Valid URL with http(s):// | Triggers intelligence scrape |
| `workspace_id` | No | Clerk org ID | Future multi-tenant isolation |

---

## 2. Client Selection Experience

### 2.1 Client List Page

**Path:** `/clients` (route: `apps/web/src/app/(shell)/clients/page.tsx`)

**Layout:**
- Page header with "Clients" title and "Add Client" primary action button
- `GettingStartedCard` component showing onboarding progress (auto-hides when complete)
- 3-column responsive grid of client cards

**Client Card Content:**
- Client name (truncated)
- Website URL with Globe icon
- CMS type badge (WordPress/Shopify/Wix/Webhook/Not configured)
- Last published date

**States:**
| State | Display |
|-------|---------|
| Loading | 3 skeleton cards in grid |
| Error | "Failed to load clients" with Retry button |
| Empty | Building2 icon + "No clients yet" + Add Client CTA |
| Populated | Grid of clickable client cards |

### 2.2 Client Switcher (Sidebar)

**Location:** `ClientSwitcherButton` in `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx`

**Position:** Top of sidebar, most prominent element after logo

**Expanded State:**
- Colored initial circle (HSL color seeded from name)
- Client name (truncated)
- Chevron dropdown indicator

**Collapsed State:**
- Just the colored initial circle
- Popover on click

**Popover Features:**
- Search input with "Search clients..." placeholder
- List of all clients with checkmark on active
- "Add new client" action at bottom
- Keyboard navigable (Command/Combobox pattern)

**Missing Features:**
- No "recent clients" quick access
- No favorites/pinning
- No keyboard shortcut for switching (e.g., Cmd+1-9)

### 2.3 Search/Filter/Sort Capabilities

**Client List Page:** None currently - clients are fetched as a flat list sorted by name

**Gaps:**
- No search within client list
- No filter by CMS type, last activity, or status
- No sorting options (name only)
- No pagination (all clients loaded)

---

## 3. Client Creation Flow

### Flow Diagram

```
[Clients List] → [Click "Add Client"] → [AddClientModal opens]
                                              ↓
                                    [Step 1: Form]
                                    • Client name (required)
                                    • Website URL (required)
                                              ↓
                                    [Step 2: Creating]
                                    • Loader spinner
                                    • "Creating client and gathering intelligence..."
                                              ↓
                                    [API: POST /api/clients]
                                              ↓
                                    [Conditional: Intelligence Scrape]
                                    • If BrightData + DataForSEO configured:
                                      Fire POST /api/client-intelligence/{id}/scrape
                                              ↓
                                    [Navigate to /clients/{id}]
```

### Detailed Steps

| Step | Component | Required Fields | Validation | Next Action |
|------|-----------|-----------------|------------|-------------|
| 1 | Form inputs | `name`, `website_url` | Name: non-empty; URL: starts with http(s):// | Click "Add Client →" |
| 2 | Loading spinner | - | - | Auto-transitions on success |
| 3 | Client created | - | - | Navigate to client dashboard |

### API Contract

**Endpoint:** `POST /api/clients`

**Request Schema:**
```typescript
{
  name: string;         // 1-255 chars
  website?: string;     // Valid URL
  industry?: string;    // Max 100 chars
  description?: string; // Max 2000 chars
  primaryContact?: {
    name?: string;
    email?: string;
    phone?: string;
  }
}
```

**Response:** `201 Created` with `ClientResponse`

**Rate Limit:** 20 requests/minute (HEAVY)

---

## 4. Onboarding Journey Map

### 4.1 Global Platform Onboarding

**Component:** `GettingStartedCard` in `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/GettingStartedCard.tsx`

```
[Account Created] ✓ (always done)
        ↓
[Configure API Integrations] → Settings link
        ↓ (checks /api/platform-secrets/status)
[Add First Client] → Add Client button
        ↓
[CARD AUTO-HIDES when steps 2+3 complete]
```

**Triggers "onboarding complete":**
- All required platform secrets configured (Gemini, DataForSEO, BrightData)
- At least one client exists

### 4.2 Per-Client Onboarding

**Location:** Client Dashboard (`/clients/[clientId]/page.tsx`)

```
[Client Added] ✓ (always done on this page)
        ↓
[Intelligence Gathering] → Polls status every 5s
        ↓
[Configure CMS Publishing] → Settings link
        ↓
[Publish First Article] → Calendar link
```

**Status Banners:**
- `not_started`: Gray banner with "Run now →" action
- `in_progress`: Amber animated banner, "30-90 seconds"
- `failed`: Red banner with "Retry" action
- `completed`: Checklist shows checkmark

### 4.3 Features Locked Until Setup

| Feature | Blocked Until |
|---------|---------------|
| Article generation | Intelligence gathered (brand voice extracted) |
| CMS publishing | CMS credentials configured in Settings |
| Analytics dashboard | Google OAuth connected |
| SEO audit | Project auto-creates on first audit run |

---

## 5. Client Settings Architecture

### Settings Tabs

| Tab | Path | Purpose | Key Fields |
|-----|------|---------|------------|
| Brand & AI | `/clients/[id]/settings` | Voice, models, templates | `brand_voice`, `image_prompt_template`, `text_model_override`, `image_model_override`, `voice_template_id`, `voice_blend_weight` |
| CMS Integration | Same page | WordPress/Shopify/Wix/Webhook | `wp_url`, `wp_username`, `wp_app_password`, `shopify_store_url`, `shopify_api_key`, `webhook_url` |
| Publishing | Same page | Automation settings | `articles_per_week`, `min_word_count`, `max_word_count`, `auto_publish`, `review_delay_hours` |
| Goals | Same page | SEO targets | Managed via `ClientGoalsManager` component |

### Additional Settings Pages

| Page | Path | Purpose |
|------|------|---------|
| Voice Profile | `/clients/[id]/settings/voice` | 40+ field voice configuration |
| Connections | `/clients/[id]/connections` | OAuth + CMS site connections |

---

## 6. Client-Scoped URL Patterns

### Route Structure

```
/clients                              # Client list (global)
/clients/[clientId]                   # Client dashboard
/clients/[clientId]/calendar          # Content calendar
/clients/[clientId]/articles          # Article library
/clients/[clientId]/articles/new      # New article creation
/clients/[clientId]/articles/[id]     # Article editor
/clients/[clientId]/intelligence      # Website intelligence
/clients/[clientId]/settings          # Client settings
/clients/[clientId]/settings/voice    # Voice profile
/clients/[clientId]/connections       # OAuth + CMS connections
/clients/[clientId]/analytics         # GSC/GA4 dashboards
/clients/[clientId]/seo               # SEO landing (redirects to audit)
/clients/[clientId]/seo/[projectId]/audit     # SEO audit
/clients/[clientId]/seo/[projectId]/backlinks # Backlinks
```

### Layout Hierarchy

```
(shell)/layout.tsx
    └── AppShell (sidebar + topbar)
            └── clients/layout.tsx (passthrough)
                    └── clients/[clientId]/layout.tsx
                            └── Syncs activeClientId to store on route change
                                    └── [Page Content]
```

---

## 7. UX Gap Analysis

### 7.1 Onboarding Friction Points

| Issue | Severity | Description |
|-------|----------|-------------|
| No guided wizard | Medium | User must discover settings tabs manually |
| Intelligence timeout | High | No cancel/skip option; 90s blocking wait |
| CMS test hidden | Low | "Test Connection" button below fold |
| No sample client | Medium | New users face blank slate |

### 7.2 Missing Client Management Features

| Feature | Competitor Reference | Status |
|---------|---------------------|--------|
| Client search | Ahrefs, SEMrush | Missing |
| Client filters (CMS, activity) | SEMrush | Missing |
| Client archival UI | - | API exists, no UI |
| Bulk client operations | - | Missing |
| Client duplication | - | Missing |
| Client export/import | - | Missing |
| Recent clients quick-access | Most SaaS | Missing |
| Keyboard shortcuts for switching | Figma, Linear | Missing |
| Client usage/billing visibility | SEMrush | Missing |

### 7.3 Comparison to Industry Leaders

**Ahrefs:**
- Client switcher in top-left with search
- Recent projects prominently displayed
- Clear usage/limits per project

**SEMrush:**
- Project dropdown with search
- Filters by status, product type
- Quick actions in list view

**TeveroSEO Gaps:**
- No search in switcher or list
- No recent clients
- No quick actions from list view

---

## 8. Recommendations

### 8.1 World-Class Onboarding Improvements

1. **Progressive Disclosure Wizard**
   - Multi-step modal after first client creation
   - Step 1: Wait for intelligence (with skip option)
   - Step 2: Choose CMS platform (WordPress/Shopify/Custom)
   - Step 3: Enter credentials with inline validation
   - Step 4: Generate first article

2. **Sample/Demo Client**
   - Pre-populate a "Demo Agency" client for new signups
   - Shows fully configured example with sample articles
   - Clear "Delete demo" action when ready

3. **Intelligence Timeout Handling**
   - Add "Skip for now" button after 30s
   - Background retry with notification
   - Manual trigger from Intelligence page

### 8.2 Client Switching UX Enhancements

1. **Keyboard Shortcuts**
   - `Cmd+K` already opens command palette; add `/client` command
   - `Cmd+1` through `Cmd+9` for recent clients
   - `Cmd+Shift+C` to open client switcher directly

2. **Recent Clients Section**
   - Store last 5 accessed clients in localStorage
   - Show above full client list in switcher
   - Visual separator: "Recent" / "All Clients"

3. **Search in Client List Page**
   - Add search input above client grid
   - Filter by name, website URL, CMS type
   - Debounced search with instant results

### 8.3 Multi-Client Operations

1. **Bulk Selection**
   - Checkboxes on client cards
   - "Select All" / "Select None" actions
   - Bulk archive, bulk export settings

2. **Client Health Dashboard**
   - `/clients/overview` aggregate view
   - Publishing activity across all clients
   - Clients needing attention (stale, failed publishes)

3. **Client Grouping**
   - Tags or folders for client organization
   - Filter by group in list and switcher
   - Useful for agencies with 20+ clients

---

## 9. Key Files Reference

| Purpose | Path |
|---------|------|
| Client list page | `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/page.tsx` |
| Add client modal | `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/AddClientModal.tsx` |
| Getting started card | `/home/dominic/Documents/TeveroSEO/apps/web/src/components/onboarding/GettingStartedCard.tsx` |
| Client dashboard | `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/page.tsx` |
| Client settings | `/home/dominic/Documents/TeveroSEO/apps/web/src/app/(shell)/clients/[clientId]/settings/page.tsx` |
| Client store (Zustand) | `/home/dominic/Documents/TeveroSEO/apps/web/src/stores/clientStore.ts` |
| AppShell with switcher | `/home/dominic/Documents/TeveroSEO/apps/web/src/components/shell/AppShell.tsx` |
| Client API route | `/home/dominic/Documents/TeveroSEO/apps/web/src/app/api/clients/route.ts` |
| Backend clients API | `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/api/clients.py` |
| Client ORM model | `/home/dominic/Documents/TeveroSEO/AI-Writer/backend/models/client.py` |
| TypeScript Client type | `/home/dominic/Documents/TeveroSEO/packages/types/src/client.ts` |

---

## 10. Summary

The TeveroSEO client management architecture provides a solid foundation with:
- Clear client data model with settings and relationships
- Functional creation flow with intelligence gathering
- Per-client onboarding checklist
- Comprehensive settings UI across 4 tabs

Key gaps to address for world-class UX:
1. Add search/filter to client list and switcher
2. Implement recent clients quick-access
3. Add keyboard shortcuts for power users
4. Create progressive onboarding wizard
5. Enable bulk client operations

The client context is properly scoped throughout the application via URL parameters and the `clientStore` Zustand store, ensuring consistent state as users navigate between client workspaces.

---

# Agent 3: SEO Audit Workflow Architecture

## Executive Summary

The TeveroSEO platform implements a technical SEO audit system with **129 checks across 4 tiers**. The audit workflow is split between the Next.js frontend (`apps/web/`) and the open-seo-main backend. While the technical foundation is solid, the **findings presentation and action workflow is underdeveloped** -- currently showing only basic summary statistics rather than actionable, filterable findings.

---

## 1. Audit Data Model

### 1.1 Project/Audit/Finding Relationships

```
Organization (Clerk)
  └── Client (clients table)
       └── Project (projects table)
            └── Audit (audits table)
                 ├── AuditPage (audit_pages table)
                 │    └── LighthouseResult (audit_lighthouse_results table)
                 └── Findings (computed at runtime, not persisted)
```

**Key Files:**
- `/home/dominic/Documents/TeveroSEO/open-seo-main/src/db/app.schema.ts` (lines 139-277) -- Core audit tables
- `/home/dominic/Documents/TeveroSEO/apps/web/src/lib/audit/repositories/FindingsRepository.ts` -- Findings interface (not yet integrated)

### 1.2 Severity Levels

```typescript
type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";
```

**Severity Distribution:**
- **Critical**: Missing title, broken internal links, noindex, not mobile-friendly, no HTTPS
- **High**: Title/meta length issues, missing H1, CWV failures
- **Medium**: Content structure, schema, internal linking issues
- **Low**: CTR optimization, freshness signals, minor technical issues
- **Info**: Passed checks, informational notices

### 1.3 Check Tiers (129 Total Checks)

| Tier | Count | Category | Execution | Score Contribution |
|------|-------|----------|-----------|-------------------|
| **T1** | 68 | DOM/Regex (on-page fundamentals) | <100ms | Base 60 + up to 20 points |
| **T2** | 21 | Calculation (content quality) | Light compute | Up to 10 points |
| **T3** | 13 | API-based (CWV, NLP, engagement) | External APIs | Up to 10 points |
| **T4** | 7 | Crawl-based (site architecture) | Site-wide context | Hard gates only |

**Note:** The `apps/web/` definitions show 107 checks (legacy count), but open-seo-main implements the full 129.

### 1.4 Scoring Formula

```
Score = Base(60) + Tier1(max 20) + Tier2(max 10) + Tier3(max 10) + Tier4(max 4)
```

**Hard Gates (Score Caps):**
| Gate | Trigger | Score Cap |
|------|---------|-----------|
| `noindex` | T1-67 fails | 0 |
| `duplicate-content` | T4-06 with >60% duplicate | 50 |
| `ymyl-no-author` | T1-68 fails on YMYL page | 60 |
| `cwv-poor` | T3-01/02/03 critical fail | 75 |

---

## 2. Audit Creation Flow

| Step | UI Element | Options | Validation | Output |
|------|------------|---------|------------|--------|
| 1. Navigate | `/clients/[clientId]/seo/` | Auto-redirect to default project | Project existence check | Project context |
| 2. Enter URL | `<Input>` Website URL | Placeholder: "https://example.com" | `z.string().url()` | Start URL |
| 3. Set Max Pages | `<Select>` dropdown | 10, 25, 50, 100, 250 | `.int().min(1).max(10000)` | Page limit |
| 4. Lighthouse Strategy | `<Select>` dropdown | Mobile, Desktop, Skip Lighthouse | Enum validation | Strategy |
| 5. Start Audit | `<Button>` Start Audit | Disabled when pending | Rate limit: 5/hour | `auditId` returned |

---

## 3. Scan Progress Experience

### 3.1 Progress Indicators

The audit progresses through distinct phases:

| Phase | Description | Progress Display |
|-------|-------------|------------------|
| `discovery` | Finding URLs to crawl | Badge: "Discovery" |
| `crawling` | Fetching page content | Progress bar: pages crawled/total |
| `lighthouse` | Running performance tests | Progress bar: checks completed/total |
| `finalizing` | Processing results | Badge: "Finalizing" |
| `completed` | Audit finished | Badge: "Done" (green) |
| `failed` | Error occurred | Badge: "Failed" (red) |

### 3.2 Real-Time Updates

**Polling-based** (not WebSocket):
- Status polling: Every 3000ms while `status === "running"`
- Crawl progress polling: Every 1500ms for live URL list

---

## 4. Findings Architecture

### 4.1 Current State (Incomplete)

**CRITICAL GAP:** The findings are **not persisted** or **displayed in detail**. The current `ResultsView` component shows only:

1. **Summary Cards** (4 metrics):
   - Pages Scanned
   - Issues Found (count only)
   - Performance Score (Lighthouse avg)
   - SEO Score (Lighthouse avg)

2. **Crawled Pages Table**:
   - URL path
   - HTTP status code
   - Issue count per page (number only, no breakdown)

### 4.2 Missing Findings Features

| Feature | Status | Impact |
|---------|--------|--------|
| Findings list with filtering | NOT IMPLEMENTED | Users cannot see individual issues |
| Finding detail view | NOT IMPLEMENTED | No remediation guidance |
| Group by severity | NOT IMPLEMENTED | Cannot prioritize fixes |
| Group by category | NOT IMPLEMENTED | Cannot focus on specific areas |
| Group by page | PARTIAL (count only) | No drill-down to issues |
| Export findings | NOT IMPLEMENTED | Cannot share with team |
| Bulk actions | NOT IMPLEMENTED | Cannot manage at scale |

### 4.3 FindingsRepository (Exists but Not Integrated)

The codebase has a `FindingsRepository` interface with:

```typescript
interface FindingsRepository {
  insertFindings(auditId, pageId, results): Promise<void>;
  getFindingsByAudit(auditId): Promise<AuditFinding[]>;
  getFindingsByPage(auditId, pageId): Promise<AuditFinding[]>;
  getFindingsBySeverity(auditId, severity): Promise<AuditFinding[]>;
  getFailedFindingsByAudit(auditId): Promise<AuditFinding[]>;
  deleteFindingsByAudit(auditId): Promise<void>;
}
```

**This is NOT connected to the UI.** Only an in-memory implementation exists for testing.

---

## 5. Critical Recommendations

### 5.1 Implement Findings List Page

Create `/clients/[clientId]/seo/[projectId]/audit/[auditId]/findings`:
- Filter by severity (critical/high/medium/low)
- Filter by category (12 categories defined)
- Filter by tier (T1-T4)
- Group by page or by check type
- Pagination for large audits

### 5.2 Connect FindingsRepository

Persist findings to database with new `audit_findings` table:

```sql
CREATE TABLE audit_findings (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES audit_pages(id) ON DELETE CASCADE,
  check_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  category TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  auto_editable BOOLEAN NOT NULL DEFAULT FALSE,
  edit_recipe TEXT,
  status TEXT DEFAULT 'open',
  fixed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

# Agent 4: Keyword Intelligence Architecture

## 1. Keyword Data Model

### Core Entities and Relationships

The keyword intelligence system spans multiple databases and contexts:

**AI-Writer Database (PostgreSQL `alwrity`):**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `client_website_intelligence` | Per-client keyword/SEO data | `organic_keywords` (JSONB), `traffic_estimate`, `domain_rating`, `top_competitors`, `content_gaps` |

**open-seo-main Database (PostgreSQL `open_seo`):**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `saved_keywords` | User-curated keyword lists per project | `keyword`, `location_code`, `tracking_enabled`, `drop_alert_threshold` |
| `keyword_metrics` | Cached DataForSEO metrics | `search_volume`, `cpc`, `competition`, `keyword_difficulty`, `intent` |
| `keyword_rankings` | Daily position snapshots | `position`, `previous_position`, `url`, `date`, `serp_features` |
| `keyword_page_mapping` | Keyword-to-URL assignments | `keyword`, `target_url`, `action` (optimize/create), `relevance_score` |

### Metrics Tracked

| Metric | Source | Storage |
|--------|--------|---------|
| Search Volume | DataForSEO Labs | JSONB in intelligence, INT in keyword_metrics |
| Position | DataForSEO SERP | keyword_rankings.position (0-100) |
| CPC | DataForSEO | REAL in keyword_metrics |
| Competition | DataForSEO | REAL (0-1 scale) |
| Keyword Difficulty | DataForSEO | INTEGER (0-100) |
| Intent | DataForSEO | TEXT enum |
| SERP Features | DataForSEO | JSONB array of strings |

---

## 2. Missing Features vs Competitors

| Feature | Ahrefs | SEMrush | SERanking | TeveroSEO Status |
|---------|--------|---------|-----------|------------------|
| Keyword clustering/grouping | Yes | Yes | Yes | **Not implemented** |
| SERP volatility tracker | Yes | Yes | Yes | **Not implemented** |
| Position distribution chart | Yes | Yes | Yes | **Not implemented** |
| Competitor keyword overlap | Yes | Yes | Yes | **Partial** (gaps only) |
| Keyword cannibalization detection | Yes | Yes | Yes | **Not implemented** |
| Search intent labeling | Yes | Yes | Yes | **Schema exists, no UI** |
| Custom tags/labels | Yes | Yes | Yes | **Not implemented** |
| Bulk keyword import (CSV) | Yes | Yes | Yes | **Schema exists, no UI** |

---

# Agent 5: Content & Articles Architecture

## 1. Content Data Model

### Article Entity Structure (`ScheduledArticle`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | GUID | Primary key |
| `client_id` | GUID (FK) | Owner client |
| `title` | String(500) | Article title |
| `keyword` | String(255) | Target SEO keyword |
| `status` | String(20) | Lifecycle state |
| `content_html` | Text | Generated HTML |
| `content_markdown` | Text | Markdown version |
| `meta_description` | String(500) | SEO description |
| `publish_date` | DateTime | Scheduled publish |
| `published_at` | DateTime | Actual publish time |
| `cms_post_id` | String(255) | External CMS ID |
| `cms_post_url` | String(1000) | Live post URL |
| `quality_score` | Integer | Quality gate score |

### Status States (Lifecycle)

```
draft -> generating -> generated -> pending_review -> approved -> publishing -> published
                  \-> failed  (from any non-terminal state)
```

---

## 2. Quality Gate System

- **Threshold**: 80 points minimum for auto-publish
- **Validation Endpoint**: `OPEN_SEO_API_URL/api/seo/content/validate`
- **Behavior**: FAIL-CLOSED (if quality gate unavailable, article requires manual review)

---

## 3. Critical Gaps

| Feature | Jasper | Writer | Copy.ai | TeveroSEO |
|---------|--------|--------|---------|-----------|
| In-line content editing | Yes | Yes | Yes | **No** - read-only preview |
| Real-time collaboration | Yes | Yes | Limited | **No** |
| Version history | Yes | Yes | Yes | **No** |
| Content calendar view | Basic | Yes | Yes | **No** - list only |
| Team comments/feedback | Yes | Yes | Limited | **No** |

---

# Agent 6: Backlinks & Link Building Architecture

## 1. Backlink Data Model

**Primary**: DataForSEO Backlinks API
- `/v3/backlinks/summary/live` - Overview metrics
- `/v3/backlinks/backlinks/live` - Individual backlink rows
- `/v3/backlinks/referring_domains/live` - Domain aggregation

**Cache TTL**: 6 hours

---

## 2. Current Features

The Overview tab shows 5 metric cards:
1. **Total Backlinks** - Raw count of all backlinks
2. **Referring Domains** - Count of unique linking domains
3. **Domain Rank** - 0-100 authority score
4. **Trust Rank** - Quality/trust metric
5. **Spam Score** - Risk indicator with color coding

---

## 3. Critical Gaps

| Feature | Ahrefs | TeveroSEO | Gap |
|---------|--------|-----------|-----|
| Real-time link alerts | Yes | No | Critical |
| Lost/new backlink tracking | Yes | Data exists, not surfaced | High |
| Anchor text distribution | Yes | No | High |
| Link intersect | Yes | No | Critical |
| Disavow file generator | Yes | No | High |
| Outreach integration | Yes | No | Critical |

---

# Agent 7: Analytics & Reporting Architecture

## 1. Dashboard Architecture

### Main Dashboard Layout (`/dashboard`)

- **Header**: Title + Export button (right-aligned)
- **Quick Stats Cards**: Draggable, reorderable via @dnd-kit
- **Portfolio Health Summary**: 4-card grid showing aggregate KPIs
- **Two-column Section**: Needs Attention + Wins Milestones
- **Main Content Area**: 3-column grid with Client Portfolio Table + Sidebar

### Widget Inventory

| Widget | Component | Data Source |
|--------|-----------|-------------|
| Quick Stats Cards | QuickStatsCards.tsx | PortfolioSummary |
| Portfolio Health Summary | PortfolioHealthSummary.tsx | PortfolioSummary |
| Client Portfolio Table | ClientPortfolioTable.tsx | getDashboardMetrics() |
| Needs Attention | NeedsAttentionSection.tsx | getAttentionItems() |
| Wins & Milestones | WinsMilestonesSection.tsx | getWins() |
| Activity Feed | ActivityFeed.tsx | WebSocket real-time events |
| Team Workload | TeamWorkloadSection.tsx | getTeamWorkload() |
| Sparkline Charts | LazySparkline.tsx | /api/sparkline/{clientId}/{metric} |

---

## 2. Export Capabilities

| Format | Implementation | Features |
|--------|----------------|----------|
| CSV | `/lib/export/csv.ts` | BOM for Excel UTF-8, escaping, nested value support |
| PDF | `/lib/export/pdf.ts` | Browser print dialog, HTML template |

---

# Agent 8: Integrations & Connections Architecture

## 1. Integration Inventory

| Integration | Auth Type | Data Types | Status |
|-------------|-----------|------------|--------|
| **Google (GSC)** | OAuth 2.0 | Search performance, queries | **Active** |
| **Google (GA4)** | OAuth 2.0 | Analytics, sessions | **Active** |
| **Google (GBP)** | OAuth 2.0 | Business Profile data | **Active** |
| **WordPress** | App Password | Posts, pages, publishing | **Active** |
| **Shopify** | API Token | Blog publishing | **Active** |

---

## 2. OAuth Flow

### Google OAuth (Primary Integration)

**Scopes Requested:**
```python
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/business.manage",
]
```

**Dual Flow Architecture:**
1. **Direct Agency Connection** - Agency staff OAuth
2. **Magic Link Client Self-Authorization** - Token-based invite system

---

## 3. Critical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| No property selection UI | Users can't choose which GSC site/GA4 property | HIGH |
| No token expiry warnings | Users discover broken connections too late | HIGH |
| No reconnection notifications | Agency unaware when client tokens fail | HIGH |

---

# Agent 9: Settings & Configuration Architecture

## 1. Settings Architecture Overview

```
Global Settings (Not Yet Implemented)
└── Organization Settings (Not Yet Implemented)
    └── Client Settings (/clients/[clientId]/settings)
        ├── Main Settings Page (tabs: Brand & AI, CMS Integration, Publishing, Goals)
        ├── Voice Profile (/clients/[clientId]/settings/voice)
        └── Branding (/clients/[clientId]/settings/branding)
```

**Key Finding**: Settings system is CLIENT-CENTRIC. No global or organization-level settings pages implemented.

---

## 2. Brand Voice System (40+ Fields)

### VoiceProfile Interface

**Identity & Mode (4 fields)**
- `mode`: preservation, application, best_practices
- `voiceStatus`: draft, active, archived
- `voiceName`: Custom name
- `voiceTemplateId`: Selected industry template

**Tone & Personality (7 fields)**
- `primaryTone`: professional, casual, friendly, etc.
- `secondaryTones`: Up to 3 tones
- `formalityLevel`: 1-10 scale
- `emotionalRange`: reserved, moderate, expressive
- `personalityTraits`: Free-form traits
- `archetype`: The Expert, The Friend, etc.

**Vocabulary (6 fields)**
- `jargonLevel`: none, light, moderate, heavy
- `acronymPolicy`: always_expand, first_use, assume_known
- `industryTerms`, `signaturePhrases`, `forbiddenPhrases`, `requiredPhrases`

**Writing Mechanics (8 fields)**
- `contractionUsage`, `sentenceLengthTarget`, `paragraphLengthTarget`
- `listPreference`, `headingStyle`, `ctaTemplate`
- `keywordDensityTolerance`, `seoVsVoicePriority`

---

# Agent 10: Cross-Domain Journey Synthesis

## 1. Primary User Journeys

### Journey 1: New Client Setup to First Win

```
[/clients] Create Client → [/clients/:id] Setup → [/clients/:id/connections] Connect GSC 
→ [/clients/:id/intelligence] Run Scrape → [/clients/:id/settings] Configure Voice 
→ [/clients/:id/articles/new] Generate Article → [/clients/:id/calendar] Approve & Publish
→ [/clients/:id/analytics] See Improvement
```

**Status:** 6 manual navigation steps, no guided flow
**Fix:** One-click setup wizard

### Journey 2: Audit Finding to Resolution

```
[/clients/:id/seo/:projectId/audit] Run Audit → View Issues 
→ [Manual: Identify Content Issue] → [/clients/:id/articles/new] Create Fix Content
→ [/clients/:id/seo/:projectId/audit] Re-run to Verify
```

**Status:** BROKEN - no link from audit to content
**Fix:** "Fix with content" button on each finding

### Journey 3: Keyword Discovery to Published Content

```
[/clients/:id/intelligence] → Keywords Tab → Select Keyword → [/clients/:id/articles/new?keyword=X]
→ Generate → Edit → [/clients/:id/calendar] Approve → Published
```

**Status:** WORKS - `?keyword=X` param passing exists
**Model:** Replicate this pattern for other cross-domain links

---

## 2. Inter-Domain Link Matrix

| From ↓ / To → | Audit | Content | Keywords | Analytics | Settings |
|---------------|-------|---------|----------|-----------|----------|
| **Audit** | - | ❌ MISSING | ❌ MISSING | ✅ Link exists | ❌ MISSING |
| **Content** | ❌ MISSING | - | ✅ Keyword param | ❌ MISSING | ✅ Voice link |
| **Keywords** | ❌ MISSING | ✅ Create Article | - | ❌ MISSING | - |
| **Analytics** | ✅ "Go to Audit" | ❌ MISSING | ❌ MISSING | - | - |
| **Settings** | - | ✅ Voice affects gen | - | - | - |

---

## 3. Top 5 Journey Improvements

| Priority | Improvement | Impact | Effort | ROI |
|----------|-------------|--------|--------|-----|
| 1 | Add "Fix with content" link from audit issues | High | Low | Very High |
| 2 | Make onboarding checklist items clickable | High | Low | Very High |
| 3 | Auto-trigger intelligence after GSC connect | High | Medium | High |
| 4 | Add notifications/toasts for milestones | Medium | Medium | Medium |
| 5 | Command palette cross-domain actions | Medium | Low | Medium |

---

## Conclusion

TeveroSEO has solid individual domain implementations but lacks the inter-domain connective tissue that makes $100M platforms feel seamless. The platform is currently a collection of good tools rather than a unified workflow system.

**Critical Gap:** The audit-to-content link is the highest-impact missing connection.

**Biggest Opportunity:** Surface insights and suggest actions across domain boundaries, transforming TeveroSEO from "tools you use" into "a system that guides you."
