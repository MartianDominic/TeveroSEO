# UI Component Library & Interaction Patterns

## Executive Summary

Design system for autonomous SEO platform managing 50+ clients with approval workflows, granular controls, and real-time feedback. Built on existing shadcn/ui foundation.

---

## 1. Approval Workflows

### When to Use
- Autonomous actions that modify client sites
- Batch operations affecting multiple items
- Actions with potential negative SEO impact

### Visual Example

```
+------------------------------------------------------------------+
| PENDING APPROVALS (12)                            [Approve All Safe]
+------------------------------------------------------------------+
| [ ] | Title Tag Update        | client-a.com/blog     | HIGH    |
|     | "Best SEO Tips" -> "10 Best SEO Tips for 2026"  | +2.3%   |
|     | [Preview] [Approve] [Reject] [Edit]                       |
+------------------------------------------------------------------+
| [ ] | Meta Description        | client-b.com/services | MEDIUM  |
|     | Missing -> "Professional web design services..." | +1.1%   |
|     | [Preview] [Approve] [Reject] [Edit]                       |
+------------------------------------------------------------------+
| [x] | Internal Link Added     | client-c.com/about    | LOW     |
|     | Link to /services from paragraph 3              | +0.4%   |
|     | [Preview] [Approve] [Reject] [Edit]                       |
+------------------------------------------------------------------+
|                                                                  |
| Selected: 1   [Approve Selected] [Reject Selected]               |
+------------------------------------------------------------------+
```

### Interaction Behavior

1. **Single Item Approval**
   - Click "Approve" -> Confirmation toast -> Action queued
   - Click "Preview" -> Slide-out panel with before/after diff
   - Click "Reject" -> Optional reason modal -> Item archived
   - Click "Edit" -> Inline edit mode or modal editor

2. **Batch Approval**
   - Checkbox selection with Shift+click range select
   - "Select All" respects current filters
   - Bulk action bar appears at bottom when items selected

3. **"Approve All Safe" Shortcut**
   - Only approves items with confidence >= 95%
   - Shows confirmation: "Approve 8 items? (4 require manual review)"
   - Items requiring review remain in queue

4. **Undo After Approval**
   - Toast with "Undo" button (10 second window)
   - Activity log has "Revert" option (24 hour window)
   - Beyond 24h: Manual revert via action history

### Accessibility
- All actions keyboard accessible (Enter to approve, Delete to reject)
- Screen reader announces: "12 pending approvals. 3 selected."
- Focus management: After action, focus moves to next item
- ARIA live regions for batch selection count

### Mobile Adaptation
- Swipe gestures: Right = approve, Left = reject
- Bottom sheet for batch actions
- Stacked card layout instead of table

---

## 2. Granular Controls

### When to Use
- Settings that affect automation behavior
- Risk threshold configuration
- Scope selection for bulk operations

### Visual Example

```
+------------------------------------------------------------------+
| AUTOMATION SETTINGS                                               |
+------------------------------------------------------------------+
|                                                                  |
| Auto-Fix Technical Issues                              [=====ON] |
| +--------------------------------------------------------------+|
| | Applies to: Broken links, 404s, redirect chains              ||
| | Confidence threshold: [========|--] 85%                      ||
| | Scope: (x) All clients  ( ) Selected  ( ) This client only   ||
| | Excluded: client-x.com, client-y.com  [Edit]                 ||
| +--------------------------------------------------------------+|
|                                                                  |
| Auto-Optimize Meta Tags                               [====OFF]  |
| [Click to expand settings]                                       |
|                                                                  |
| Auto-Generate Content                                 [====OFF]  |
| [Click to expand settings]                                       |
|                                                                  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| SEVERITY FILTER                                                   |
+------------------------------------------------------------------+
| Show issues:                                                     |
| [x] Critical (3)  [x] High (12)  [ ] Medium (45)  [ ] Low (128) |
|                                                                  |
| Applied: Showing 15 of 188 issues                                |
+------------------------------------------------------------------+
```

### Interaction Behavior

1. **Toggle with Details**
   - Toggle shows current state prominently
   - Click toggle OR row expands details
   - Expanded state persists across page loads
   - Changes auto-save with debounce (500ms)

2. **Confidence Sliders**
   - Snap to 5% increments
   - Color gradient: Red (<50%) -> Yellow (50-80%) -> Green (>80%)
   - Tooltip shows exact value while dragging
   - Input field for precise entry

3. **Severity Filters**
   - Checkbox pills with counts
   - Count updates in real-time
   - "Clear all" / "Select all" links
   - Filter state persists in URL for shareability

4. **Scope Selectors**
   - Radio buttons for mutually exclusive options
   - "Selected" option opens multi-select dropdown
   - Badge count shows affected clients

### Accessibility
- Sliders: Arrow keys for fine control, Page Up/Down for 10% jumps
- Toggles: Space to toggle, label announces state
- Expandable sections: Enter to toggle, aria-expanded
- Focus visible on all interactive elements

### Mobile Adaptation
- Full-width toggles with large touch targets (44px min)
- Sliders use full screen width
- Collapsible sections default to collapsed
- Filter chips horizontally scrollable

---

## 3. Status Indicators

### When to Use
- Show system health at a glance
- Indicate background process state
- Surface connection issues immediately

### Visual Example

```
+------------------------------------------------------------------+
| SYSTEM STATUS                                                     |
+------------------------------------------------------------------+
|                                                                  |
| [*] DataForSEO API        Connected       Last sync: 2m ago     |
| [!] Google Search Console Syncing...      45% (123/274 sites)   |
| [x] Ahrefs Integration    Error           Rate limited [Retry]  |
|                                                                  |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| CLIENT HEALTH: client-a.com                                       |
+------------------------------------------------------------------+
|                                                                  |
| Overall Health    [====|====|====|=   ] 78/100  Good            |
|                                                                  |
| Technical SEO     [====|====|====|====] 95     Excellent        |
| Content Quality   [====|====|=       ] 65     Needs Work        |
| Backlink Profile  [====|====|====    ] 82     Good              |
| Core Web Vitals   [====|====|==      ] 72     Fair              |
|                                                                  |
+------------------------------------------------------------------+
```

### Status States

| Status | Icon | Color | Animation |
|--------|------|-------|-----------|
| Connected | Green dot | `green-500` | None |
| Syncing | Spinner | `blue-500` | Rotate |
| Warning | Triangle | `yellow-500` | None |
| Error | X circle | `red-500` | Pulse (subtle) |
| Disabled | Dash | `gray-400` | None |

### Interaction Behavior

1. **Connection Status**
   - Hover shows last successful connection time
   - Click opens detailed connection log
   - Auto-retry with exponential backoff
   - Manual "Retry" button on error

2. **Sync Status**
   - Progress percentage and item count
   - ETA for completion
   - "Pause" option for long syncs
   - Toast notification on completion

3. **Health Indicators**
   - Click bar segment for drill-down
   - Trend arrow shows week-over-week change
   - Color thresholds: <50 Red, 50-75 Yellow, >75 Green

### Accessibility
- Color never sole indicator (icons + text always present)
- Status changes announced via aria-live
- High contrast mode: Icons become larger, borders added
- Screen reader: "DataForSEO API: Connected. Last synced 2 minutes ago."

### Mobile Adaptation
- Compact horizontal status bar in header
- Tap to expand full status panel
- Critical errors show as persistent banner

---

## 4. Action Feedback

### When to Use
- After any automated action completes
- To show impact of changes
- To enable quick reversal of mistakes

### Visual Example

```
+------------------------------------------------------------------+
| ACTIVITY FEED                                       [Filter] [v] |
+------------------------------------------------------------------+
| TODAY                                                             |
|                                                                  |
| 14:32  Title tag updated on client-a.com/blog                    |
|        Before: "Blog"                                            |
|        After:  "SEO Blog - Latest Tips & Strategies"             |
|        Impact: +2.3% estimated CTR improvement                   |
|        [View Page] [Revert]                                      |
|                                                                  |
| 14:15  3 internal links added to client-b.com                    |
|        /about -> /services (anchor: "our services")              |
|        /about -> /contact (anchor: "get in touch")               |
|        /services -> /pricing (anchor: "view pricing")            |
|        Impact: +0.8% internal PageRank flow                      |
|        [View Details] [Revert All]                               |
|                                                                  |
| 13:45  Crawl completed for client-c.com                          |
|        Pages: 1,234 | Errors: 12 | Warnings: 45                  |
|        [View Report]                                             |
|                                                                  |
+------------------------------------------------------------------+
```

### Change Preview (Before/After)

```
+------------------------------------------------------------------+
| PREVIEW: Title Tag Update                                    [x] |
+------------------------------------------------------------------+
|                                                                  |
| URL: https://client-a.com/blog/seo-tips                         |
|                                                                  |
| BEFORE                          AFTER                            |
| +---------------------------+   +---------------------------+    |
| | <title>                   |   | <title>                   |    |
| |   Blog Post               |   |   10 Best SEO Tips for    |    |
| | </title>                  |   |   2026 | Client A         |    |
| |                           |   | </title>                  |    |
| +---------------------------+   +---------------------------+    |
|                                                                  |
| ESTIMATED IMPACT                                                 |
| +---------------------------+                                    |
| | CTR Improvement: +2.3%    |                                    |
| | Confidence: 87%           |                                    |
| | Risk Level: Low           |                                    |
| +---------------------------+                                    |
|                                                                  |
|                              [Cancel] [Approve & Apply]          |
+------------------------------------------------------------------+
```

### Interaction Behavior

1. **Activity Feed**
   - Infinite scroll with date groupings
   - Filter by: client, action type, user, date range
   - Click action to expand full details
   - Batch revert available via selection

2. **Change Previews**
   - Side-by-side diff view (default)
   - Inline diff view (toggle)
   - Syntax highlighting for code changes
   - Mobile: Stacked view with swipe between

3. **Impact Indicators**
   - Percentage-based estimates with confidence
   - Green/yellow/red color coding
   - "?" icon links to methodology explanation
   - Historical accuracy shown: "Estimates 82% accurate"

4. **Revert Buttons**
   - Single click reverts immediately
   - Toast confirms with undo option
   - Audit log entry created
   - Cannot revert if site changed externally

### Accessibility
- Diff views have sr-only text: "Changed from X to Y"
- Color coding supplemented with text labels
- Timeline navigable via arrow keys
- Expandable items use proper disclosure pattern

### Mobile Adaptation
- Activity feed as primary mobile view
- Swipe to reveal revert action
- Previews open in full-screen modal
- Pull-to-refresh

---

## 5. Navigation Patterns

### Visual Example

```
+------------------------------------------------------------------+
| [Logo] OpenSEO    Dashboard | Clients | Reports | Settings  [?] |
+------------------------------------------------------------------+
|                                                                  |
| CLIENT SWITCHER                       BREADCRUMBS                |
| +---------------------------+         Dashboard > client-a.com > |
| | [Search clients...]       |         Technical SEO > Broken Links
| | -------------------------+|                                    |
| | * client-a.com    [95]   ||         QUICK ACTIONS (/)          |
| |   client-b.com    [82]   ||         Cmd+K to search...         |
| |   client-c.com    [78]   ||                                    |
| | + Add New Client         ||                                    |
| +---------------------------+                                    |
|                                                                  |
+------------------------------------------------------------------+
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + /` | Show all shortcuts |
| `G then D` | Go to Dashboard |
| `G then C` | Go to Clients |
| `G then S` | Go to Settings |
| `Esc` | Close modal/panel |
| `?` | Context help |

### Interaction Behavior

1. **Global Nav**
   - Always visible (desktop)
   - Collapses to hamburger (mobile)
   - Active state clearly indicated
   - Badge counts for pending items

2. **Client Switcher**
   - Dropdown with search/filter
   - Recently accessed at top
   - Health score badge per client
   - Keyboard navigable (arrow keys)

3. **Breadcrumbs**
   - Click any segment to navigate
   - Current page not clickable
   - Truncates middle segments on overflow
   - Mobile: Shows only parent + current

4. **Command Palette**
   - Fuzzy search across all actions
   - Recent commands remembered
   - Categories: Navigation, Actions, Settings
   - Shows keyboard shortcut next to each

### Accessibility
- Skip link to main content
- Landmarks properly defined (nav, main, aside)
- Focus trapped in modals
- Breadcrumbs use nav + aria-label="Breadcrumb"

### Mobile Adaptation
- Bottom tab bar for primary navigation
- Client switcher in header
- Breadcrumbs collapse to back button
- Command palette via search icon

---

## 6. Data Tables

### Visual Example

```
+------------------------------------------------------------------+
| ISSUES (188 total)                    [Export] [Columns] [Filter]|
+------------------------------------------------------------------+
| [Search issues...]                                               |
+------------------------------------------------------------------+
| [ ] | Issue          | Page           | Severity | Status   | ^ |
+------------------------------------------------------------------+
| [ ] | Missing H1     | /about         | Critical | Open     |   |
|     +--------------------------------------------------------+   |
|     | Page has no H1 tag. Add descriptive H1 for SEO.        |   |
|     | [Fix Now] [Ignore] [View Page]                         |   |
|     +--------------------------------------------------------+   |
+------------------------------------------------------------------+
| [x] | Duplicate Title| /blog          | High     | Open     |   |
+------------------------------------------------------------------+
| [x] | Slow LCP       | /services      | High     | Fixing...|   |
+------------------------------------------------------------------+
| [ ] | Missing Alt    | /gallery       | Medium   | Ignored  |   |
+------------------------------------------------------------------+
|                                                                  |
| Showing 1-25 of 188      [<] [1] [2] [3] ... [8] [>]            |
|                                                                  |
| 2 selected   [Mark Fixed] [Ignore] [Assign]                     |
+------------------------------------------------------------------+
```

### Interaction Behavior

1. **Sortable Columns**
   - Click header to sort (toggles asc/desc)
   - Shift+click for multi-column sort
   - Sort indicator arrow
   - Sortable columns have cursor pointer

2. **Filterable Rows**
   - Global search across all columns
   - Per-column filters (click filter icon)
   - Filter pills show active filters
   - Clear individual or all filters

3. **Bulk Selection**
   - Header checkbox selects visible page
   - "Select all 188" link for full selection
   - Selection count in action bar
   - Selection preserved across pagination

4. **Inline Actions**
   - Hover reveals action buttons (desktop)
   - Always visible on touch devices
   - Primary action emphasized
   - Overflow menu for additional actions

5. **Expandable Rows**
   - Click row to expand details
   - Only one expanded at a time (optional)
   - Keyboard: Enter to toggle
   - Nested actions in expanded view

### Accessibility
- Proper table semantics (thead, tbody, scope)
- Sort state announced: "Sorted by severity, descending"
- Row selection announced: "2 of 188 rows selected"
- Pagination announced: "Page 2 of 8"

### Mobile Adaptation
- Card view instead of table
- Swipe actions (mark fixed, ignore)
- Infinite scroll instead of pagination
- Filter panel as bottom sheet

---

## 7. Forms and Inputs

### Visual Example

```
+------------------------------------------------------------------+
| ADD NEW CLIENT                                                    |
+------------------------------------------------------------------+
|                                                                  |
| Website URL *                                                    |
| +----------------------------------------------------------+    |
| | https://example.com                                 [!]  |    |
| +----------------------------------------------------------+    |
| [!] This domain is already being tracked                        |
|                                                                  |
| Client Name                                                      |
| +----------------------------------------------------------+    |
| | Example Corp                                              |    |
| +----------------------------------------------------------+    |
| Suggested: Example Corp (from website)              [Use This]  |
|                                                                  |
| Crawl Frequency                                                  |
| ( ) Daily   (x) Weekly   ( ) Monthly                            |
| Recommended for sites with 500-5000 pages                       |
|                                                                  |
| +----------------------------------------------------------+    |
| | DANGER ZONE                                               |    |
| | +------------------------------------------------------+ |    |
| | | Delete this client permanently                       | |    |
| | | This will remove all historical data.                | |    |
| | |                                [Delete Client]       | |    |
| | +------------------------------------------------------+ |    |
| +----------------------------------------------------------+    |
|                                                                  |
|                                     [Cancel] [Add Client]        |
+------------------------------------------------------------------+
```

### Interaction Behavior

1. **Smart Defaults**
   - Pre-fill from detected data
   - Show suggestion below field
   - "Use This" button to accept
   - User override always possible

2. **Validation Feedback**
   - Validate on blur (not on every keystroke)
   - Error shown below field with icon
   - Success checkmark when valid
   - Submit button disabled until valid

3. **Auto-save vs Explicit Save**
   - Settings pages: Auto-save with indicator
   - Forms with consequences: Explicit save
   - Dirty state warning on navigation
   - "Saving..." indicator during auto-save

4. **Dangerous Action Confirmation**
   - Red "Danger Zone" section
   - Requires typing confirmation text
   - Double confirmation for irreversible
   - Cool-down period (can undo within 5 min)

### Accessibility
- Labels always visible (no placeholder-only)
- Error messages linked via aria-describedby
- Required fields marked with asterisk + aria-required
- Focus moves to first error on submit failure

### Mobile Adaptation
- Full-width inputs
- Number inputs use numeric keyboard
- Date pickers use native controls
- Confirmation dialogs as full-screen modal

---

## 8. Notifications and Alerts

### Visual Example

```
TOAST (temporary)
+------------------------------------------+
| [✓] Changes saved successfully      [x]  |
+------------------------------------------+

ALERT BANNER (persistent)
+------------------------------------------------------------------+
| [!] Your DataForSEO API key expires in 3 days. [Renew Now] [x]   |
+------------------------------------------------------------------+

BADGE COUNT
+------------------+
| Approvals [12]   |
+------------------+

IN-APP NOTIFICATION CENTER
+------------------------------------------------------------------+
| NOTIFICATIONS                                        [Mark All Read]
+------------------------------------------------------------------+
| [*] Crawl completed for client-a.com              2 hours ago    |
| [*] 5 new issues found on client-b.com            3 hours ago    |
| [ ] Weekly report ready for download              1 day ago      |
+------------------------------------------------------------------+
```

### Notification Types

| Type | Duration | Position | Use Case |
|------|----------|----------|----------|
| Toast | 5 seconds | Bottom-right | Action confirmation |
| Banner | Until dismissed | Top of page | System-wide alerts |
| Badge | Persistent | On nav item | Pending items count |
| Modal | Until action | Center | Critical decisions |

### Interaction Behavior

1. **Toast Notifications**
   - Auto-dismiss after 5 seconds
   - Hover pauses timer
   - Click to dismiss immediately
   - Queue multiple (max 3 visible)

2. **Alert Banners**
   - Persist until user dismisses
   - Can include action button
   - Dismissal preference saved
   - Priority order: Error > Warning > Info

3. **Badge Counts**
   - Update in real-time
   - Cap at "99+" for large numbers
   - Animate on increment
   - Clear when viewed

4. **Email/Webhook Triggers**
   - Configurable per notification type
   - Digest option (daily/weekly summary)
   - Severity threshold setting
   - Per-client overrides

### Accessibility
- Toasts announced via aria-live="polite"
- Alerts use role="alert" for critical
- Badges have aria-label with count
- Focus management when modal opens

### Mobile Adaptation
- Toasts appear at top (thumb zone)
- Banners slide down from top
- Badge count in tab bar
- Push notifications for critical

---

## Decision Trees

### Auto-Apply vs Ask for Approval

```
START
  |
  v
Is action reversible? ----NO----> REQUIRE APPROVAL
  |
 YES
  |
  v
Is confidence >= 95%? ----NO----> REQUIRE APPROVAL
  |
 YES
  |
  v
Is client setting "auto-apply"? ----NO----> REQUIRE APPROVAL
  |
 YES
  |
  v
Is risk level "low"? ----NO----> REQUIRE APPROVAL
  |
 YES
  |
  v
AUTO-APPLY (log action, allow revert)
```

### Modal vs Inline

```
START
  |
  v
Is action destructive? ----YES----> MODAL (with confirmation)
  |
  NO
  |
  v
Does action need context from current page? ----YES----> INLINE
  |
  NO
  |
  v
Is data complex (many fields)? ----YES----> MODAL (or page)
  |
  NO
  |
  v
Is action part of flow? ----YES----> INLINE
  |
  NO
  |
  v
MODAL (keeps focus, clear completion)
```

### Notification vs Silent

```
START
  |
  v
Is action user-initiated? ----YES----> TOAST confirmation
  |
  NO
  |
  v
Is it an error? ----YES----> TOAST (error) + BANNER if persistent
  |
  NO
  |
  v
Does it require action? ----YES----> BADGE + in-app notification
  |
  NO
  |
  v
Is it significant milestone? ----YES----> IN-APP notification only
  |
  NO
  |
  v
SILENT (log only, visible in activity feed)
```

---

## Component Inventory

### Core Components (Build/Extend)

| Component | Status | Base |
|-----------|--------|------|
| ApprovalCard | New | Card + Actions |
| BatchActionBar | New | Fixed bottom bar |
| ConfidenceSlider | New | Slider |
| SeverityFilter | New | Checkbox group |
| StatusIndicator | New | Badge + Icon |
| ActivityFeed | New | Timeline |
| DiffViewer | New | Code block |
| ImpactBadge | New | Badge |
| ClientSwitcher | New | Combobox |
| CommandPalette | New | cmdk |
| DataTable | Extend | Tanstack Table |
| ExpandableRow | New | Collapsible |
| DangerZone | New | Alert |
| AutoSaveIndicator | New | Badge |
| NotificationCenter | New | Dropdown |

### Existing Components (from shadcn/ui)

- Button, Badge, Card
- DropdownMenu, Dialog, Sheet
- Input, Select, Checkbox, Switch
- Table, Tabs, Tooltip
- Toast, Alert
- Slider, Progress

---

## Implementation Priority

### Phase 1: Foundation
1. StatusIndicator
2. SeverityFilter
3. DataTable enhancements
4. Toast/Alert patterns

### Phase 2: Approval System
1. ApprovalCard
2. BatchActionBar
3. DiffViewer
4. ActivityFeed

### Phase 3: Controls
1. ConfidenceSlider
2. CommandPalette
3. ClientSwitcher
4. AutoSaveIndicator

### Phase 4: Polish
1. NotificationCenter
2. Keyboard shortcuts
3. Mobile adaptations
4. Animation refinements

---

## Design Tokens

```css
/* Severity Colors */
--severity-critical: #dc2626;  /* red-600 */
--severity-high: #ea580c;      /* orange-600 */
--severity-medium: #ca8a04;    /* yellow-600 */
--severity-low: #65a30d;       /* lime-600 */

/* Status Colors */
--status-connected: #22c55e;   /* green-500 */
--status-syncing: #3b82f6;     /* blue-500 */
--status-warning: #eab308;     /* yellow-500 */
--status-error: #ef4444;       /* red-500 */
--status-disabled: #9ca3af;    /* gray-400 */

/* Health Score Thresholds */
--health-excellent: #22c55e;   /* 90-100 */
--health-good: #84cc16;        /* 75-89 */
--health-fair: #eab308;        /* 50-74 */
--health-poor: #ef4444;        /* 0-49 */

/* Animation Durations */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;

/* Z-Index Scale */
--z-dropdown: 50;
--z-sticky: 100;
--z-modal: 200;
--z-toast: 300;
```

---

## File Structure

```
src/components/
  ui/                    # shadcn primitives
  approval/
    ApprovalCard.tsx
    ApprovalList.tsx
    BatchActionBar.tsx
    DiffViewer.tsx
  controls/
    ConfidenceSlider.tsx
    SeverityFilter.tsx
    ScopeSelector.tsx
    ToggleWithDetails.tsx
  status/
    StatusIndicator.tsx
    HealthBar.tsx
    SyncProgress.tsx
  feedback/
    ActivityFeed.tsx
    ActivityItem.tsx
    ImpactBadge.tsx
    RevertButton.tsx
  navigation/
    ClientSwitcher.tsx
    CommandPalette.tsx
    Breadcrumbs.tsx
  data/
    DataTable.tsx
    ExpandableRow.tsx
    BulkSelectBar.tsx
    ColumnFilter.tsx
  forms/
    AutoSaveIndicator.tsx
    DangerZone.tsx
    SmartInput.tsx
  notifications/
    NotificationCenter.tsx
    AlertBanner.tsx
    ToastProvider.tsx
```
