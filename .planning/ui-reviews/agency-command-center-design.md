# Agency Command Center - Ultimate Dashboard Design

**Version:** 1.0
**Date:** 2026-04-30
**Status:** Design Complete

## Executive Summary

The Agency Command Center is a unified dashboard that gives agency owners instant visibility into their entire sales and client pipeline. It consolidates prospects, proposals, agreements, payments, and client health into a single actionable view.

---

## 1. Dashboard Layout Wireframe

```
+-----------------------------------------------------------------------------------+
|  AGENCY COMMAND CENTER                    [Date Range v] [Refresh] [Settings]     |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-- TODAY VIEW / ACTION REQUIRED (Priority Bar) --------------------------------+|
|  |  [!] 3 Overdue    [clock] 5 Due Today    [hand] 2 Awaiting You    [eye] 4 New  |
|  +-------------------------------------------------------------------------------+|
|                                                                                   |
|  +-- ROW 1: PIPELINE HEALTH (4 Cards - Draggable) -------------------------------+
|  | +----------------+ +----------------+ +----------------+ +----------------+    |
|  | |   PROSPECTS    | |   PROPOSALS    | |   AGREEMENTS   | |   PAYMENTS     |    |
|  | |     12 new     | |    8 sent      | |   6 pending    | |   EUR 45,200   |    |
|  | |   24 active    | |    3 viewed    | |   4 signed     | |   4 overdue    |    |
|  | |  [===>    ]    | |  [====>   ]    | |  [=====>  ]    | |   85% on-time  |    |
|  | +----------------+ +----------------+ +----------------+ +----------------+    |
|  +-------------------------------------------------------------------------------+|
|                                                                                   |
|  +-- ROW 2: MAIN CONTENT AREA ---------------------------------------------------+
|  | +-----------------------------+ +-------------------------------------------+ |
|  | |   NEEDS ATTENTION (List)    | |   PIPELINE FUNNEL (Visualization)        | |
|  | | [Critical] Invoice #INV-047 | |                                           | |
|  | |   Acme Corp - 14 days over  | |   Prospects     [==========] 48          | |
|  | | [High] Contract awaiting    | |   Qualified     [=======   ] 28 (58%)    | |
|  | |   TechFlow - sent 7 days    | |   Proposal Sent [=====     ] 18 (64%)    | |
|  | | [Medium] Proposal viewed    | |   Signed        [===       ] 12 (67%)    | |
|  | |   DataCo - no action 3 days | |   Paid/Active   [==        ] 10 (83%)    | |
|  | | [Low] Follow-up due         | |                                           | |
|  | |   NewTech - scheduled today | |   Avg Cycle: 23 days | Win Rate: 21%     | |
|  | +-----------------------------+ +-------------------------------------------+ |
|  +-------------------------------------------------------------------------------+|
|                                                                                   |
|  +-- ROW 3: FINANCIAL + CALENDAR -----------------------------------------------+|
|  | +-----------------------------+ +-------------------------------------------+ |
|  | |   REVENUE PIPELINE          | |   CALENDAR / TIMELINE                     | |
|  | |                             | |                                           | |
|  | | Draft:        EUR 12,400    | |   TODAY  Apr 30                           | |
|  | | Sent:         EUR 34,800    | |   [o] 10:00 Follow-up call - DataCo      | |
|  | | Signed:       EUR 28,500    | |   [!] Invoice due - TechFlow EUR 2,400   | |
|  | | ----------------------      | |                                           | |
|  | | Total Pipe:   EUR 75,700    | |   TOMORROW  May 1                         | |
|  | |                             | |   [o] 14:00 Proposal review - NewStart   | |
|  | | This Month:   EUR 18,200    | |   [clock] Contract expires - OldCo       | |
|  | | (vs LM: +12%)               | |                                           | |
|  | | MTD Collected: EUR 15,400   | |   THIS WEEK                               | |
|  | | Outstanding:   EUR 8,600    | |   3 payments due | 2 contracts expire     | |
|  | +-----------------------------+ +-------------------------------------------+ |
|  +-------------------------------------------------------------------------------+|
|                                                                                   |
|  +-- ROW 4: ACTIVITY FEED + QUICK ACTIONS ---------------------------------------+
|  | +-----------------------------+ +-------------------------------------------+ |
|  | |   ACTIVITY FEED (Live)      | |   SMART ALERTS                            | |
|  | |                             | |                                           | |
|  | | [2m ago] DataCo viewed      | |   [!] High-value deal stuck               | |
|  | |   proposal (3rd view)       | |   TechFlow - EUR 8,500 - 12 days no move  | |
|  | | [15m ago] NewTech signed    | |                                           | |
|  | |   contract via Smart-ID     | |   [trend] Win rate declining              | |
|  | | [1h ago] Invoice #INV-052   | |   Last 30d: 18% (was 24%)                 | |
|  | |   paid - Acme EUR 3,200     | |                                           | |
|  | | [2h ago] New prospect       | |   [user] Unassigned prospects             | |
|  | |   added: ecommerce-plus.eu  | |   7 prospects without owner               | |
|  | +-----------------------------+ +-------------------------------------------+ |
|  +-------------------------------------------------------------------------------+|
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [+ New Prospect] [+ New Proposal] [Send Reminder] [Bulk Actions v]               |
+-----------------------------------------------------------------------------------+
```

### Mobile Layout (Stacked)

```
+---------------------------+
| TODAY: 3 Overdue | 5 Due  |
+---------------------------+
| NEEDS ATTENTION           |
| [Critical] Invoice #047   |
| [High] Contract pending   |
| [Medium] Proposal viewed  |
+---------------------------+
| PIPELINE                  |
| [==>] Prospects: 48       |
| [==>] Proposals: 18       |
| [==>] Signed: 12          |
+---------------------------+
| REVENUE                   |
| Pipeline: EUR 75,700      |
| This Month: EUR 18,200    |
+---------------------------+
| [+ Action Button]         |
+---------------------------+
```

---

## 2. Widget Specifications

### 2.1 Today View / Action Required Bar

**Component:** `<TodayActionBar />`
**Type:** Server Component with client islands for interactions

| Section | Icon | Data Source | Click Action |
|---------|------|-------------|--------------|
| Overdue | `AlertTriangle` | invoices.status='overdue' OR contracts.expiresAt < today | Opens filtered list |
| Due Today | `Clock` | invoices.dueAt = today OR scheduled follow-ups | Opens timeline view |
| Awaiting You | `Hand` | items where nextAction = 'agency' | Opens work queue |
| New | `Eye` | items.createdAt within 24h | Opens recent items |

**Props:**
```typescript
interface TodayActionBarProps {
  overdueCount: number;
  dueTodayCount: number;
  awaitingYouCount: number;
  newCount: number;
  workspaceId: string;
}
```

### 2.2 Pipeline Health Cards

**Component:** `<PipelineHealthCard />`
**Type:** Client Component (draggable via dnd-kit)

| Card | Primary Metric | Secondary Metrics | Sparkline Data |
|------|----------------|-------------------|----------------|
| Prospects | `new` count | `total active`, conversion rate | 30-day trend |
| Proposals | `sent` count | `viewed`, `accepted`, avg days open | 30-day trend |
| Agreements | `pending sign` | `signed this week`, avg sign time | 30-day trend |
| Payments | Total EUR in pipeline | `overdue count`, on-time % | 30-day collections |

**Props:**
```typescript
interface PipelineHealthCardProps {
  id: string;
  title: string;
  primaryValue: number | string;
  primaryLabel: string;
  secondaryMetrics: { label: string; value: number | string }[];
  sparklineData: { date: string; value: number }[];
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
  onClick: () => void;
}
```

### 2.3 Needs Attention List

**Component:** `<NeedsAttentionList />`
**Type:** Server Component with client-side sorting

| Priority | Criteria | Visual |
|----------|----------|--------|
| Critical | Overdue > 14 days, High-value stuck > 10 days | Red badge |
| High | Overdue 7-14 days, Viewed but no action > 5 days | Orange badge |
| Medium | Overdue 3-7 days, Pending items > 3 days | Yellow badge |
| Low | Due today, Scheduled follow-ups | Blue badge |

**Props:**
```typescript
interface NeedsAttentionItem {
  id: string;
  entityType: 'prospect' | 'proposal' | 'contract' | 'invoice';
  entityId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  subtitle: string;
  daysOverdue?: number;
  valueCents?: number;
  currency?: string;
  actionRequired: string;
  quickActions: QuickAction[];
}

interface NeedsAttentionListProps {
  items: NeedsAttentionItem[];
  onItemClick: (item: NeedsAttentionItem) => void;
  maxItems?: number;
}
```

### 2.4 Pipeline Funnel Visualization

**Component:** `<PipelineFunnel />`
**Type:** Client Component (Recharts)

| Stage | Source Table | Status Filter | Color |
|-------|--------------|---------------|-------|
| Prospects | `prospects` | `pipelineStage IN ('new', 'analyzing', 'scored')` | Slate |
| Qualified | `prospects` | `pipelineStage = 'qualified'` | Blue |
| Proposal Sent | `proposals` | `status IN ('sent', 'viewed')` | Indigo |
| Signed | `contracts` | `status = 'signed'` | Purple |
| Paid/Active | `clients` | `status = 'active'` | Emerald |

**Props:**
```typescript
interface FunnelStage {
  name: string;
  count: number;
  conversionFromPrevious: number; // percentage
  avgDaysInStage: number;
  valueAtRisk: number; // EUR cents
}

interface PipelineFunnelProps {
  stages: FunnelStage[];
  avgCycleDays: number;
  winRate: number;
  dateRange: { start: Date; end: Date };
}
```

### 2.5 Revenue Pipeline Widget

**Component:** `<RevenuePipeline />`
**Type:** Server Component

| Metric | Calculation | Update Frequency |
|--------|-------------|------------------|
| Draft | SUM(proposals.totalValue) WHERE status='draft' | Real-time |
| Sent | SUM(proposals.totalValue) WHERE status IN ('sent','viewed') | Real-time |
| Signed | SUM(contracts.value) WHERE status='signed' AND NOT invoiced | Real-time |
| Total Pipeline | Draft + Sent + Signed | Real-time |
| This Month | SUM(invoices.totalCents) WHERE paidAt in current month | Daily |
| vs Last Month | (thisMonth - lastMonth) / lastMonth * 100 | Daily |
| MTD Collected | SUM(invoices.totalCents) WHERE status='paid' AND paidAt in MTD | Real-time |
| Outstanding | SUM(invoices.totalCents) WHERE status IN ('sent','overdue') | Real-time |

**Props:**
```typescript
interface RevenuePipelineProps {
  draftValueCents: number;
  sentValueCents: number;
  signedValueCents: number;
  currency: string;
  thisMonthCents: number;
  lastMonthCents: number;
  mtdCollectedCents: number;
  outstandingCents: number;
}
```

### 2.6 Calendar/Timeline Widget

**Component:** `<TimelineWidget />`
**Type:** Client Component

| Event Type | Source | Icon | Color |
|------------|--------|------|-------|
| Follow-up | `pipelineActivities` WHERE type='reminder_set' | `Calendar` | Blue |
| Invoice Due | `invoices.dueAt` | `DollarSign` | Yellow/Red |
| Contract Expires | `contracts.expiresAt` | `FileText` | Orange |
| Meeting | External calendar (future) | `Users` | Purple |

**Props:**
```typescript
interface TimelineEvent {
  id: string;
  type: 'follow_up' | 'invoice_due' | 'contract_expires' | 'meeting';
  title: string;
  entityType: EntityType;
  entityId: string;
  scheduledAt: Date;
  valueCents?: number;
  currency?: string;
  isOverdue: boolean;
}

interface TimelineWidgetProps {
  events: TimelineEvent[];
  groupBy: 'day' | 'week';
  onEventClick: (event: TimelineEvent) => void;
}
```

### 2.7 Activity Feed

**Component:** `<ActivityFeed />`
**Type:** Client Component (Socket.IO subscription)

| Event Type | Icon | Description Template |
|------------|------|---------------------|
| `created` | `Plus` | "{entity} created: {name}" |
| `status_changed` | `RefreshCw` | "{entity} status: {old} -> {new}" |
| `viewed` | `Eye` | "{name} viewed proposal ({count}x)" |
| `sent` | `Send` | "{entity} sent to {recipient}" |
| `signed` | `PenTool` | "{name} signed contract via {method}" |
| `paid` | `Check` | "Invoice #{number} paid - {amount}" |
| `note_added` | `MessageSquare` | "Note added to {entity}" |

**Props:**
```typescript
interface ActivityFeedProps {
  workspaceId: string;
  maxItems?: number;
  filterEntityTypes?: EntityType[];
  isPaused?: boolean;
}
```

### 2.8 Smart Alerts Widget

**Component:** `<SmartAlerts />`
**Type:** Server Component (computed by BullMQ worker)

| Alert Type | Detection Logic | Severity |
|------------|-----------------|----------|
| High-value stuck | proposals.totalValue > 5000 AND daysSinceUpdate > 7 | High |
| Win rate declining | 30d win rate < 90d win rate by > 5% | Medium |
| Unassigned prospects | prospects.assignedTo IS NULL AND age > 2 days | Low |
| Payment velocity drop | avg collection days > historical + 5 | Medium |
| Client health drop | healthScore dropped > 20 points in 7 days | High |

**Props:**
```typescript
interface SmartAlert {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  entityType?: EntityType;
  entityId?: string;
  metric?: { current: number; previous: number; unit: string };
  suggestedAction: string;
  createdAt: Date;
}

interface SmartAlertsProps {
  alerts: SmartAlert[];
  onAlertClick: (alert: SmartAlert) => void;
  onDismiss: (alertId: string) => void;
}
```

---

## 3. Metric Definitions and Calculations

### 3.1 Pipeline Metrics

```typescript
// Source: Computed by BullMQ worker every 5 minutes
interface PipelineMetrics {
  // Prospect funnel
  prospectsNew: number;           // COUNT WHERE pipelineStage = 'new'
  prospectsAnalyzing: number;     // COUNT WHERE pipelineStage = 'analyzing'
  prospectsScored: number;        // COUNT WHERE pipelineStage = 'scored'
  prospectsQualified: number;     // COUNT WHERE pipelineStage = 'qualified'
  prospectsContacted: number;     // COUNT WHERE pipelineStage = 'contacted'
  prospectsNegotiating: number;   // COUNT WHERE pipelineStage = 'negotiating'
  prospectsConverted: number;     // COUNT WHERE pipelineStage = 'converted' (30d)
  prospectsArchived: number;      // COUNT WHERE pipelineStage = 'archived' (30d)
  
  // Proposal metrics
  proposalsDraft: number;         // COUNT WHERE status = 'draft'
  proposalsSent: number;          // COUNT WHERE status = 'sent'
  proposalsViewed: number;        // COUNT WHERE status = 'viewed'
  proposalsAccepted: number;      // COUNT WHERE status = 'accepted'
  proposalsSigned: number;        // COUNT WHERE status = 'signed'
  proposalsDeclined: number;      // COUNT WHERE status = 'declined' (30d)
  proposalsExpired: number;       // COUNT WHERE status = 'expired' (30d)
  
  // Contract metrics
  contractsDraft: number;         // COUNT WHERE status = 'draft'
  contractsSent: number;          // COUNT WHERE status = 'sent'
  contractsSigned: number;        // COUNT WHERE status = 'signed'
  contractsExecuted: number;      // COUNT WHERE status = 'executed'
  contractsExpiringSoon: number;  // COUNT WHERE expiresAt < NOW() + 7 days
  
  // Invoice metrics
  invoicesDraft: number;          // COUNT WHERE status = 'draft'
  invoicesSent: number;           // COUNT WHERE status = 'sent'
  invoicesPaid: number;           // COUNT WHERE status = 'paid' (30d)
  invoicesOverdue: number;        // COUNT WHERE status = 'overdue'
  
  // Computed timestamps
  computedAt: Date;
}
```

### 3.2 Financial Calculations

```typescript
interface FinancialMetrics {
  // Pipeline value (in cents)
  pipelineValueDraft: number;     // SUM(proposals.setupFeeCents + 12*monthlyFeeCents) WHERE status='draft'
  pipelineValueSent: number;      // SUM(proposals value) WHERE status IN ('sent','viewed')
  pipelineValueSigned: number;    // SUM(contracts value) WHERE status='signed' NOT invoiced
  pipelineValueTotal: number;     // sum of above
  
  // Revenue (in cents)
  revenueThisMonth: number;       // SUM(invoices.totalCents) WHERE paidAt in current month
  revenueLastMonth: number;       // SUM(invoices.totalCents) WHERE paidAt in last month
  revenueTrend: number;           // (thisMonth - lastMonth) / lastMonth * 100
  
  // Receivables (in cents)
  mtdCollected: number;           // SUM(invoices.totalCents) WHERE status='paid' AND paidAt MTD
  outstanding: number;            // SUM(invoices.totalCents) WHERE status IN ('sent','overdue')
  overdueAmount: number;          // SUM(invoices.totalCents) WHERE status='overdue'
  
  // Averages
  avgDealSize: number;            // AVG(proposals value) WHERE status='paid' (90d)
  avgCollectionDays: number;      // AVG(paidAt - sentAt) for invoices (90d)
  
  currency: string;               // From workspace settings
}
```

### 3.3 Conversion Rate Formulas

```typescript
// Stage-to-stage conversion rates
const conversionRates = {
  // Prospect conversions (30-day rolling)
  prospectToQualified: prospectsQualified / (prospectsNew + prospectsAnalyzing + prospectsScored) * 100,
  qualifiedToProposal: proposalsSent / prospectsQualified * 100,
  proposalToSigned: contractsSigned / proposalsSent * 100,
  signedToPaid: invoicesPaid / contractsSigned * 100,
  
  // Overall win rate (90-day rolling)
  winRate: (prospectsConverted / (prospectsConverted + prospectsArchived)) * 100,
  
  // Loss reasons distribution
  lossReasons: {
    // SELECT declined_reason, COUNT(*) FROM proposals WHERE status='declined' GROUP BY declined_reason
  },
};
```

### 3.4 Cycle Time Calculations

```typescript
interface CycleTimeMetrics {
  // Average days in each stage (90-day rolling)
  avgDaysProspectToQualified: number;   // AVG(qualified_at - created_at)
  avgDaysQualifiedToProposal: number;   // AVG(proposal.created_at - prospect.qualified_at)
  avgDaysProposalToSigned: number;      // AVG(contract.signed_at - proposal.sent_at)
  avgDaysSignedToPaid: number;          // AVG(invoice.paid_at - contract.signed_at)
  
  // Total cycle
  avgDaysEndToEnd: number;              // AVG(invoice.paid_at - prospect.created_at)
  
  // Comparisons
  cycleTimeTrend: number;               // vs previous 90 days, percentage change
}
```

---

## 4. Filter/Sort Options

### 4.1 Global Filters (Persistent)

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| Date Range | DateRangePicker | Last 7d, 30d, 90d, This Month, Custom | Last 30 days |
| Team Member | MultiSelect | All users in workspace | All |
| Client/Prospect | Search + Select | Search by name/domain | All |
| Entity Type | MultiSelect | Prospect, Proposal, Contract, Invoice | All |

### 4.2 Widget-Specific Filters

**Needs Attention List:**
- Priority: Critical, High, Medium, Low
- Entity Type: Prospect, Proposal, Contract, Invoice
- Assigned To: Specific team member

**Pipeline Funnel:**
- Date Range (affects historical conversion rates)
- Exclude Archived: Yes/No

**Activity Feed:**
- Entity Type filter
- Activity Type filter
- Hide automated events

### 4.3 Sort Options

| Widget | Sort Options |
|--------|--------------|
| Needs Attention | Priority (default), Value, Days Overdue, Entity Type |
| Pipeline Table | Stage, Created Date, Value, Last Activity |
| Timeline | Chronological (default), Priority, Value |
| Activity Feed | Most Recent (default, no other options) |

### 4.4 Saved Views Schema

```typescript
// Stored in dashboard_views table
interface SavedView {
  id: string;
  workspaceId: string;
  userId: string | null;        // null = shared view
  name: string;
  filters: {
    dateRange: { start: string; end: string } | 'last_7d' | 'last_30d' | 'last_90d';
    teamMembers: string[];      // user IDs
    entityTypes: EntityType[];
    priorities?: Priority[];
  };
  layout: {
    cardOrder: string[];        // widget IDs in display order
    collapsedWidgets: string[]; // widgets that are collapsed
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. Quick Action Implementations

### 5.1 Quick Action Types

```typescript
type QuickActionType = 
  | 'send_reminder'
  | 'mark_lost'
  | 'snooze'
  | 'add_note'
  | 'reassign'
  | 'archive'
  | 'convert'
  | 'create_proposal'
  | 'create_invoice'
  | 'mark_paid';

interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: string;
  entityTypes: EntityType[];    // Which entity types this action applies to
  requiresConfirmation: boolean;
  fields?: QuickActionField[];  // Additional input fields
}
```

### 5.2 Action Definitions

| Action | Entity Types | Fields | Server Action |
|--------|--------------|--------|---------------|
| Send Reminder | Invoice, Contract, Proposal | Optional: message | `sendReminder(entityType, entityId, message?)` |
| Mark as Lost | Prospect, Proposal | Required: reason, Optional: notes | `markAsLost(entityType, entityId, reason, notes?)` |
| Snooze | Any | Required: snoozeUntil (date) | `snoozeFollowUp(entityType, entityId, snoozeUntil)` |
| Add Note | Any | Required: note text | `addNote(entityType, entityId, note)` |
| Reassign | Prospect, Client | Required: assignTo (user) | `reassign(entityType, entityId, userId)` |
| Archive | Prospect | Optional: reason | `archiveProspect(prospectId, reason?)` |
| Convert | Prospect | None | `convertToClient(prospectId)` |
| Create Proposal | Prospect | None | Navigate to `/proposals/new?prospectId={id}` |
| Create Invoice | Client, Contract | None | Navigate to `/invoices/new?clientId={id}` |
| Mark Paid | Invoice | Required: paidAt, Optional: paymentRef | `markInvoicePaid(invoiceId, paidAt, paymentRef?)` |

### 5.3 Quick Action Dialog Component

```typescript
interface QuickActionDialogProps {
  action: QuickAction;
  entityType: EntityType;
  entityId: string;
  entityName: string;
  onConfirm: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

// Example usage
<QuickActionDialog
  action={QUICK_ACTIONS.sendReminder}
  entityType="invoice"
  entityId="inv_123"
  entityName="Invoice #INV-047 - Acme Corp"
  onConfirm={async (data) => {
    await sendReminder('invoice', 'inv_123', data.message);
  }}
/>
```

### 5.4 Bulk Actions

| Action | Available For | Implementation |
|--------|---------------|----------------|
| Send Bulk Reminders | Multiple invoices | Loop + batch email |
| Archive Multiple | Multiple prospects | Transaction batch |
| Reassign Multiple | Multiple entities | Transaction batch |
| Export to CSV | Any filtered list | Server-side generation |

---

## 6. Real-Time Update Requirements

### 6.1 Update Strategies by Widget

| Widget | Update Strategy | Refresh Trigger |
|--------|-----------------|-----------------|
| Today Action Bar | Polling (30s) | On action completion |
| Pipeline Cards | Polling (60s) | On status change |
| Needs Attention | Polling (30s) + WebSocket | New overdue, status change |
| Pipeline Funnel | Polling (5m) | Manual refresh |
| Revenue Pipeline | Polling (60s) | Payment received |
| Timeline | Polling (60s) | Event added/completed |
| Activity Feed | WebSocket (real-time) | New activity event |
| Smart Alerts | Polling (5m) | BullMQ worker completion |

### 6.2 WebSocket Events

```typescript
// Socket.IO event types for real-time updates
interface DashboardSocketEvents {
  // Activity feed events (immediate)
  'activity:new': PipelineActivitySelect;
  
  // Entity state changes (immediate)
  'prospect:updated': { id: string; changes: Partial<ProspectSelect> };
  'proposal:updated': { id: string; changes: Partial<ProposalSelect> };
  'contract:updated': { id: string; changes: Partial<ContractSelect> };
  'invoice:updated': { id: string; changes: Partial<InvoiceSelect> };
  
  // Aggregated updates (batched, every 30s)
  'metrics:updated': Partial<PipelineMetrics>;
  
  // Alert triggers (immediate)
  'alert:new': SmartAlert;
  'alert:resolved': { alertId: string };
}
```

### 6.3 Optimistic Updates

```typescript
// For quick actions, apply optimistic update before server confirms
const useOptimisticAction = () => {
  const [pending, setPending] = useState<string[]>([]);
  
  const execute = async (entityId: string, action: () => Promise<void>) => {
    setPending(prev => [...prev, entityId]);
    try {
      await action();
    } catch (error) {
      // Revert optimistic update
      toast.error('Action failed');
    } finally {
      setPending(prev => prev.filter(id => id !== entityId));
    }
  };
  
  return { execute, isPending: (id: string) => pending.includes(id) };
};
```

### 6.4 Stale Data Handling

```typescript
// Show stale indicator when data is older than threshold
interface StaleDataConfig {
  widget: string;
  maxAge: number;        // seconds
  showIndicator: boolean;
  autoRefresh: boolean;
}

const STALE_CONFIGS: StaleDataConfig[] = [
  { widget: 'today_bar', maxAge: 60, showIndicator: true, autoRefresh: true },
  { widget: 'pipeline_cards', maxAge: 120, showIndicator: true, autoRefresh: true },
  { widget: 'revenue', maxAge: 300, showIndicator: false, autoRefresh: false },
  { widget: 'activity_feed', maxAge: 0, showIndicator: false, autoRefresh: false }, // Real-time
];
```

---

## 7. Priority Ranking of Features

### Phase 1: MVP (Week 1-2)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Today Action Bar | 2d | High - Immediate visibility |
| P0 | Needs Attention List | 3d | High - Actionable items |
| P0 | Pipeline Cards (static) | 2d | High - At-a-glance health |
| P0 | Revenue Pipeline (basic) | 2d | High - Financial visibility |
| P1 | Quick Actions (Send Reminder, Add Note) | 2d | High - Reduce context switch |

### Phase 2: Core (Week 3-4)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P1 | Pipeline Funnel Visualization | 3d | Medium - Conversion insights |
| P1 | Timeline Widget | 3d | Medium - Planning visibility |
| P1 | Activity Feed (polling) | 2d | Medium - Awareness |
| P1 | Quick Actions (Mark Lost, Snooze, Reassign) | 2d | Medium - Workflow |
| P2 | Saved Views | 2d | Low - Personalization |

### Phase 3: Enhancement (Week 5-6)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P2 | Smart Alerts | 3d | Medium - Proactive insights |
| P2 | Drag-and-drop Cards | 2d | Low - Customization |
| P2 | Activity Feed (WebSocket) | 2d | Low - Real-time |
| P2 | Bulk Actions | 2d | Medium - Efficiency |
| P3 | Mobile Responsive Layout | 2d | Medium - Accessibility |

### Phase 4: Polish (Week 7-8)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P3 | Hover Popovers with Sparklines | 3d | Low - Information density |
| P3 | Export to CSV | 1d | Low - Reporting |
| P3 | Keyboard Shortcuts | 1d | Low - Power users |
| P3 | Dark Mode Support | 1d | Low - Accessibility |

---

## 8. Database Schema Extensions

### 8.1 Pre-Computed Pipeline Metrics Table

```sql
-- Add to existing dashboard schema
CREATE TABLE pipeline_metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Prospect counts
  prospects_new INTEGER DEFAULT 0,
  prospects_qualified INTEGER DEFAULT 0,
  prospects_converted_30d INTEGER DEFAULT 0,
  prospects_archived_30d INTEGER DEFAULT 0,
  
  -- Proposal counts  
  proposals_draft INTEGER DEFAULT 0,
  proposals_sent INTEGER DEFAULT 0,
  proposals_viewed INTEGER DEFAULT 0,
  proposals_accepted INTEGER DEFAULT 0,
  proposals_declined_30d INTEGER DEFAULT 0,
  
  -- Contract counts
  contracts_draft INTEGER DEFAULT 0,
  contracts_sent INTEGER DEFAULT 0,
  contracts_signed INTEGER DEFAULT 0,
  contracts_expiring_7d INTEGER DEFAULT 0,
  
  -- Invoice counts
  invoices_draft INTEGER DEFAULT 0,
  invoices_sent INTEGER DEFAULT 0,
  invoices_paid_30d INTEGER DEFAULT 0,
  invoices_overdue INTEGER DEFAULT 0,
  
  -- Financial (cents)
  pipeline_value_draft INTEGER DEFAULT 0,
  pipeline_value_sent INTEGER DEFAULT 0,
  pipeline_value_signed INTEGER DEFAULT 0,
  revenue_this_month INTEGER DEFAULT 0,
  revenue_last_month INTEGER DEFAULT 0,
  outstanding INTEGER DEFAULT 0,
  overdue_amount INTEGER DEFAULT 0,
  
  -- Conversion rates (percentage * 100 for precision)
  win_rate INTEGER DEFAULT 0,
  prospect_to_qualified INTEGER DEFAULT 0,
  qualified_to_proposal INTEGER DEFAULT 0,
  proposal_to_signed INTEGER DEFAULT 0,
  
  -- Cycle times (days)
  avg_cycle_days INTEGER DEFAULT 0,
  avg_collection_days INTEGER DEFAULT 0,
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computation_duration_ms INTEGER,
  
  UNIQUE(workspace_id)
);

CREATE INDEX idx_pipeline_metrics_workspace ON pipeline_metrics(workspace_id);
```

### 8.2 Needs Attention Items View

```sql
-- Materialized view for needs attention list
CREATE MATERIALIZED VIEW needs_attention_items AS
SELECT 
  'invoice' AS entity_type,
  i.id AS entity_id,
  i.workspace_id,
  CASE 
    WHEN i.status = 'overdue' AND (i.due_at < NOW() - INTERVAL '14 days') THEN 'critical'
    WHEN i.status = 'overdue' AND (i.due_at < NOW() - INTERVAL '7 days') THEN 'high'
    WHEN i.status = 'overdue' THEN 'medium'
    ELSE 'low'
  END AS priority,
  CONCAT('Invoice #', i.invoice_number) AS title,
  c.name AS subtitle,
  EXTRACT(DAY FROM NOW() - i.due_at)::INTEGER AS days_overdue,
  i.total_cents AS value_cents,
  i.currency,
  'Send reminder' AS action_required,
  i.updated_at
FROM invoices i
JOIN clients c ON i.client_id = c.id
WHERE i.status IN ('sent', 'overdue')

UNION ALL

SELECT 
  'contract' AS entity_type,
  ct.id AS entity_id,
  ct.workspace_id,
  CASE 
    WHEN ct.sent_at < NOW() - INTERVAL '10 days' THEN 'high'
    WHEN ct.sent_at < NOW() - INTERVAL '5 days' THEN 'medium'
    ELSE 'low'
  END AS priority,
  ct.title,
  c.name AS subtitle,
  EXTRACT(DAY FROM NOW() - ct.sent_at)::INTEGER AS days_overdue,
  NULL AS value_cents,
  NULL AS currency,
  'Follow up on signature' AS action_required,
  ct.updated_at
FROM contracts ct
LEFT JOIN clients c ON ct.client_id = c.id
WHERE ct.status = 'sent'

UNION ALL

SELECT 
  'proposal' AS entity_type,
  p.id AS entity_id,
  p.workspace_id,
  CASE 
    WHEN p.status = 'viewed' AND p.first_viewed_at < NOW() - INTERVAL '5 days' THEN 'medium'
    WHEN p.status = 'sent' AND p.sent_at < NOW() - INTERVAL '7 days' THEN 'medium'
    ELSE 'low'
  END AS priority,
  'Proposal for ' || pr.company_name AS title,
  pr.domain AS subtitle,
  COALESCE(
    EXTRACT(DAY FROM NOW() - p.first_viewed_at),
    EXTRACT(DAY FROM NOW() - p.sent_at)
  )::INTEGER AS days_overdue,
  COALESCE(p.setup_fee_cents, 0) + COALESCE(p.monthly_fee_cents * 12, 0) AS value_cents,
  p.currency,
  CASE p.status 
    WHEN 'viewed' THEN 'Follow up - proposal viewed'
    ELSE 'Follow up - no response'
  END AS action_required,
  p.updated_at
FROM proposals p
LEFT JOIN prospects pr ON p.prospect_id = pr.id
WHERE p.status IN ('sent', 'viewed')

ORDER BY 
  CASE priority 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  days_overdue DESC NULLS LAST;

CREATE INDEX idx_needs_attention_workspace ON needs_attention_items(workspace_id);
CREATE INDEX idx_needs_attention_priority ON needs_attention_items(workspace_id, priority);
```

### 8.3 Smart Alerts Table

```sql
CREATE TABLE smart_alerts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metric_current NUMERIC,
  metric_previous NUMERIC,
  metric_unit TEXT,
  suggested_action TEXT,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_by TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_smart_alerts_workspace ON smart_alerts(workspace_id, is_dismissed);
CREATE INDEX idx_smart_alerts_type ON smart_alerts(alert_type);
```

---

## 9. API Endpoints

### 9.1 Dashboard Data Endpoints

```typescript
// GET /api/dashboard/overview
interface DashboardOverviewResponse {
  todayBar: {
    overdueCount: number;
    dueTodayCount: number;
    awaitingYouCount: number;
    newCount: number;
  };
  pipelineCards: {
    prospects: PipelineHealthCardProps;
    proposals: PipelineHealthCardProps;
    agreements: PipelineHealthCardProps;
    payments: PipelineHealthCardProps;
  };
  revenue: RevenuePipelineProps;
  computedAt: string;
}

// GET /api/dashboard/needs-attention?limit=10&priority=critical,high
interface NeedsAttentionResponse {
  items: NeedsAttentionItem[];
  total: number;
  hasMore: boolean;
}

// GET /api/dashboard/funnel?dateRange=30d
interface FunnelResponse {
  stages: FunnelStage[];
  avgCycleDays: number;
  winRate: number;
}

// GET /api/dashboard/timeline?start=2026-04-30&end=2026-05-07
interface TimelineResponse {
  events: TimelineEvent[];
}

// GET /api/dashboard/alerts?dismissed=false
interface AlertsResponse {
  alerts: SmartAlert[];
}

// GET /api/dashboard/activity?limit=50&since=2026-04-30T00:00:00Z
interface ActivityResponse {
  activities: PipelineActivitySelect[];
  hasMore: boolean;
}
```

### 9.2 Quick Action Endpoints

```typescript
// POST /api/actions/send-reminder
interface SendReminderRequest {
  entityType: EntityType;
  entityId: string;
  message?: string;
}

// POST /api/actions/mark-lost
interface MarkLostRequest {
  entityType: 'prospect' | 'proposal';
  entityId: string;
  reason: string;
  notes?: string;
}

// POST /api/actions/snooze
interface SnoozeRequest {
  entityType: EntityType;
  entityId: string;
  snoozeUntil: string; // ISO date
}

// POST /api/actions/add-note
interface AddNoteRequest {
  entityType: EntityType;
  entityId: string;
  note: string;
}

// POST /api/actions/reassign
interface ReassignRequest {
  entityType: EntityType;
  entityId: string;
  assignToUserId: string;
}
```

---

## 10. Component File Structure

```
apps/web/src/
├── app/
│   └── (dashboard)/
│       └── command-center/
│           ├── page.tsx                      # Server Component: main page
│           ├── actions.ts                    # Server Actions
│           ├── layout.tsx                    # Dashboard layout
│           └── _components/
│               ├── TodayActionBar.tsx        # Server Component
│               ├── PipelineHealthCards.tsx   # Client Component (dnd-kit)
│               ├── NeedsAttentionList.tsx    # Server + Client hybrid
│               ├── PipelineFunnel.tsx        # Client Component (Recharts)
│               ├── RevenuePipeline.tsx       # Server Component
│               ├── TimelineWidget.tsx        # Client Component
│               ├── ActivityFeed.tsx          # Client Component (Socket.IO)
│               ├── SmartAlerts.tsx           # Server Component
│               └── QuickActionDialog.tsx     # Client Component
├── components/
│   └── command-center/
│       ├── DraggableCard.tsx                 # dnd-kit wrapper
│       ├── PriorityBadge.tsx                 # Priority indicator
│       ├── EntityIcon.tsx                    # Entity type icons
│       ├── TrendIndicator.tsx                # Up/down/flat trend
│       ├── CurrencyDisplay.tsx               # Formatted currency
│       ├── RelativeTime.tsx                  # "2 hours ago"
│       └── Sparkline.tsx                     # Mini chart
├── hooks/
│   └── command-center/
│       ├── useActivityFeed.ts                # Socket.IO subscription
│       ├── useDashboardMetrics.ts            # SWR/React Query wrapper
│       ├── useQuickAction.ts                 # Optimistic update helper
│       └── useSavedViews.ts                  # View persistence
└── lib/
    └── command-center/
        ├── types.ts                          # TypeScript interfaces
        ├── calculations.ts                   # Client-side calculations
        └── constants.ts                      # Priority colors, etc.

open-seo-main/src/
├── server/
│   ├── workers/
│   │   └── pipeline-metrics-processor.ts     # BullMQ worker
│   └── features/
│       └── command-center/
│           ├── services/
│           │   ├── MetricsService.ts         # Metrics computation
│           │   ├── AlertsService.ts          # Smart alert detection
│           │   └── QuickActionService.ts     # Action handlers
│           ├── repositories/
│           │   ├── PipelineMetricsRepository.ts
│           │   └── SmartAlertsRepository.ts
│           └── validation/
│               └── quick-action.schema.ts    # Zod schemas
```

---

## 11. Performance Considerations

### 11.1 Query Optimization

- All dashboard queries hit pre-computed tables, not raw entity tables
- Materialized view for needs attention items, refreshed every minute
- Indexes on workspace_id + status for all entity tables
- Connection pooling via Drizzle for concurrent dashboard loads

### 11.2 Caching Strategy

| Data | Cache Location | TTL | Invalidation |
|------|---------------|-----|--------------|
| Pipeline metrics | PostgreSQL table | 5 min | BullMQ worker |
| Needs attention | Materialized view | 1 min | REFRESH MATERIALIZED VIEW |
| Smart alerts | PostgreSQL table | 5 min | BullMQ worker |
| Activity feed | Redis (last 100) | None | Socket.IO broadcast |
| User preferences | Client localStorage | Persistent | Manual clear |

### 11.3 Load Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial page load | < 1.5s | Time to interactive |
| Metrics refresh | < 500ms | API response time |
| Activity feed update | < 100ms | Socket.IO latency |
| Quick action response | < 1s | API + optimistic UI |

---

## Appendix A: Color Palette

```css
/* Priority colors */
--priority-critical: #ef4444; /* red-500 */
--priority-high: #f97316;     /* orange-500 */
--priority-medium: #eab308;   /* yellow-500 */
--priority-low: #3b82f6;      /* blue-500 */

/* Trend colors */
--trend-up: #10b981;          /* emerald-500 */
--trend-down: #ef4444;        /* red-500 */
--trend-flat: #6b7280;        /* gray-500 */

/* Entity colors */
--entity-prospect: #64748b;   /* slate-500 */
--entity-proposal: #6366f1;   /* indigo-500 */
--entity-contract: #8b5cf6;   /* violet-500 */
--entity-invoice: #f59e0b;    /* amber-500 */
--entity-client: #10b981;     /* emerald-500 */
```

---

## Appendix B: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `r` | Refresh all widgets |
| `n` | New prospect |
| `p` | New proposal |
| `/` | Focus search |
| `?` | Show keyboard shortcuts |
| `1-4` | Switch between saved views |
| `Esc` | Close modal/dialog |
