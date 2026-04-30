# Phase 49-51: Onboarding & Agency Dashboard - Research

**Researched:** 2026-04-30
**Domain:** Client onboarding workflows, pipeline management, revenue analytics
**Confidence:** HIGH

## Summary

Phase 49-51 implements automated client onboarding with tier-based checklists, a full-featured agency command center dashboard with pipeline kanban, Today's tasks feed, and comprehensive MRR/revenue metrics. The phase builds heavily on existing Phase 48 infrastructure (OnboardingService, ChecklistRepository) and Phase 44 UI components (Kanban, Checklist, MetricCard, TodayFeedItem).

The technical approach is well-established: the checklist engine extends existing JSONB-based item tracking in `onboarding_checklists`, the magic link flow reuses Phase 12's OAuth invite pattern, the kanban leverages @dnd-kit (already installed), and revenue metrics build on the existing contracts/invoices schema with proper cents-based storage.

**Primary recommendation:** Extend existing infrastructure rather than rebuilding. The OnboardingService, ChecklistRepository, and UI components are production-ready foundations. Focus implementation on the completion service, magic link white-labeling, pipeline configuration, task aggregation, and revenue calculation services.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dual mode for credential items: "Send to client" (magic link flow) + "Connect myself" (direct OAuth). Most credentials are client-owned, so magic link is primary.
- **D-02:** Magic link page uses full white-label branding (workspace logo, colors, agency name). Client sees "[Agency Name] Onboarding" with no TeveroSEO branding.
- **D-03:** Non-credential items use hybrid approach: manual checkbox for all items + smart action buttons where applicable (Calendly for scheduling, file picker for uploads).
- **D-04:** Progress visualization: overall progress bar + percentage at top, items grouped by category with per-category counts (Credentials 2/4, Kickoff 1/2, etc.).
- **D-05:** Full prospect-to-client pipeline stages: New -> Analyzing -> Qualified -> Proposal Sent -> Negotiating -> Won -> Onboarding -> Active Client.
- **D-06:** Configurable stages with full flexibility: agencies can add, remove, reorder stages. Default stages provided as starting point.
- **D-07:** Kanban card displays: company name + domain, deal value (if proposal exists), days in stage, next action indicator, deal owner, days since first contact.
- **D-08:** Quick actions on cards: move to stage (dropdown), view details (modal), archive/mark lost.
- **D-09:** Task sources: overdue checklist items, stale pipeline cards (X+ days in stage), scheduled follow-ups, expiring proposals/contracts, SEO tasks stuck on human action, manually added tasks per client.
- **D-10:** Full task system with assignees, priority (high/medium/low), category, due date, and reminders. Not just notes with due dates.
- **D-11:** 5-layer priority system: Smart urgency score algorithm, user overrides (pin/snooze/priority), sort mode toggle, visual urgency indicators, "My Focus" section (up to 5 pinned tasks).
- **D-12:** Full revenue dashboard: 4 metric cards (MRR, One-Time, Collected This Month, Outstanding) + MRR movement breakdown (new/expansion/churn) + churn risk alerts + trend chart (toggle 3/6/12 months).
- **D-13:** Multi-currency support: store amounts in original currency, user picks display currency for dashboard totals.
- **D-14:** Contract types supported: recurring (MRR), prepaid term (e.g., 2,500 EUR for 6 months), project (one-time), hybrid (setup + recurring).
- **D-15:** Payment schedules: templates (Upfront, 50/50 split, 3 equal payments, On delivery) + custom schedule option with user-defined amounts/dates.
- **D-16:** Outstanding payments: dedicated dashboard section showing overdue (red), due this week (yellow), upcoming (gray) with actions (Send Reminder, Log Call, Send Invoice).
- **D-17:** Prepaid revenue display: toggle between "Recognized Revenue" view (2,500/6mo = 417/mo spread) and "Cash Received" view (2,500 when paid).
- **D-18:** Service period ending: 30/60/90 day warnings for contracts/prepaid terms approaching end.
- **D-19:** No contact logged: configurable threshold (e.g., 14 days) since last call/email/meeting logged.
- **D-20:** Deliverables overdue: internal tasks/milestones past due date.
- **D-21:** SEO metrics declining: rankings or traffic dropping vs. previous period (from GSC data we have access to).
- **D-22:** Defer auto-progress emails to Phase 53 (Report Cards). Client communication via scheduled PDF reports. No client portal in this phase.

### Claude's Discretion
- Urgency score algorithm weights fine-tuning
- Specific thresholds for "stale" pipeline cards (days in stage)
- UI component implementation details
- Database schema for tasks table
- Caching strategy for dashboard metrics

### Deferred Ideas (OUT OF SCOPE)
- Client portal - Clients logging in to see their own dashboard (separate phase, big scope)
- Auto-progress emails - Automated weekly/monthly digests to clients (defer to Phase 53 Report Cards)
- Client engagement tracking - Would require client portal to track logins/activity
- Email open tracking - Track if clients read communications

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-01 | Onboarding checklist auto-created on payment | OnboardingService.createFromContract() already implements this (Phase 48) |
| SC-02 | Service tier determines checklist items (starter/growth/enterprise) | CHECKLIST_TEMPLATES constant in OnboardingService with 5/8/12 items per tier |
| SC-03 | Auto-complete items via OAuth and system events | autoCompleteEvent field in ChecklistItem interface, needs completion service |
| SC-04 | Progress tracking with visual indicators | Checklist component from @tevero/ui, category grouping needs extension |
| SC-05 | Pipeline kanban with drag-and-drop between stages | @dnd-kit already installed, KanbanColumn/KanbanCard components exist |
| SC-06 | Today's tasks feed (what I need to do now) | TodayFeedItem component exists, needs task aggregation service |
| SC-07 | MRR metrics card with trend | MetricCard component with sparkline support, needs calculation service |
| SC-08 | One-time payment tracking per client | Invoice schema has lineItems JSONB, contracts have content JSONB |
| SC-09 | Retention signals and churn risk indicators | Needs new service aggregating multiple data sources |
| SC-10 | Prospect -> client conversion on checklist completion | Client schema exists, conversion logic needs implementation |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Checklist creation on payment | API / Backend | - | Triggered by Stripe webhook, not user action |
| Checklist item completion | API / Backend | Frontend Server | Backend validates and persists, SSR shows current state |
| Magic link OAuth flow | API / Backend | Browser / Client | Backend generates/validates tokens, client redirects to OAuth |
| Pipeline stage management | API / Backend | Frontend Server | Backend enforces stage config, SSR renders kanban |
| Kanban drag-and-drop | Browser / Client | API / Backend | Client handles DnD UX, backend persists stage changes |
| Task aggregation | API / Backend | - | Server-side computation from multiple tables |
| Revenue calculations | API / Backend | - | Server-side aggregation with currency conversion |
| Dashboard rendering | Frontend Server (SSR) | Browser / Client | RSC for initial load, client for interactions |
| White-label branding | API / Backend | Frontend Server | Workspace branding stored in DB, served by SSR |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | [VERIFIED: npm registry] Already in project, accessible, well-documented |
| @dnd-kit/sortable | 10.0.0 | Sortable lists for kanban | [VERIFIED: npm registry] Already in project, handles multi-list DnD |
| recharts | 3.8.1 | Sparklines and trend charts | [VERIFIED: npm registry] Already used in SparklineChart component |
| drizzle-orm | (existing) | Database queries | [VERIFIED: codebase] Project standard, all schemas use it |
| nanoid | (existing) | ID generation | [VERIFIED: codebase] Used throughout for entity IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | (existing) | Date manipulation | Relative time, period calculations |
| zod | (existing) | Validation schemas | API request/response validation |
| next/font | (existing) | Font loading | Newsreader for dashboard numerals |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit | @hello-pangea/dnd | @dnd-kit already installed, better for sortable lists |
| recharts | victory | recharts already integrated, simpler API |
| Custom currency conversion | money.js | Simple EUR-centric display, external service overkill |

**Installation:**
```bash
# All required packages already installed in apps/web
# No new packages needed
```

## Architecture Patterns

### System Architecture Diagram

```
[Stripe Webhook] ──> [Payment Handler] ──> [OnboardingService.createFromContract()]
                                                    │
                                                    ▼
                                          [onboarding_checklists]
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │                               │                               │
                    ▼                               ▼                               ▼
          [Checklist UI]                  [Magic Link Flow]              [Completion Service]
         /onboarding/[id]                /connect/[token]              (OAuth callbacks, events)
                    │                               │                               │
                    │                               │                               │
                    ▼                               ▼                               ▼
          [Manual Completion]           [White-label Page]            [Auto-completion]
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    │
                                                    ▼
                                    [Client Status: onboarding -> active]
                                                    │
    ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
    │                               │                               │                               │
    ▼                               ▼                               ▼                               ▼
[Pipeline Kanban]           [Today's Tasks]              [Revenue Dashboard]           [Churn Risk Alerts]
/dashboard/pipeline        /dashboard/tasks              /dashboard/revenue            /dashboard/alerts
    │                               │                               │                               │
    ▼                               ▼                               ▼                               ▼
[prospects table]           [tasks table NEW]            [contracts/invoices]          [clients + GSC data]
pipelineStage column        Multi-source aggregation     MRR calculations              Health scoring
```

### Recommended Project Structure

```
open-seo-main/src/
├── db/
│   ├── tasks-schema.ts                    # NEW: tasks table for Today's feed
│   └── pipeline-config-schema.ts          # NEW: workspace stage configuration
├── server/features/
│   ├── onboarding/
│   │   └── services/
│   │       ├── OnboardingService.ts       # EXTEND: completion logic
│   │       ├── ChecklistCompletionService.ts  # NEW: event-driven completion
│   │       └── MagicLinkService.ts        # NEW: white-label invite generation
│   ├── pipeline/
│   │   └── services/
│   │       ├── PipelineService.ts         # NEW: stage management, transitions
│   │       └── PipelineConfigService.ts   # NEW: workspace stage configuration
│   ├── tasks/
│   │   └── services/
│   │       ├── TaskService.ts             # NEW: CRUD for tasks
│   │       └── TaskAggregationService.ts  # NEW: multi-source task collection
│   └── revenue/
│       └── services/
│           ├── RevenueService.ts          # NEW: MRR, one-time calculations
│           ├── ChurnRiskService.ts        # NEW: risk signal aggregation
│           └── CurrencyService.ts         # NEW: display currency conversion

apps/web/src/
├── app/(shell)/
│   ├── onboarding/
│   │   └── [clientId]/
│   │       └── page.tsx                   # NEW: checklist view per client
│   ├── pipeline/
│   │   └── page.tsx                       # NEW: kanban board view
│   └── dashboard/
│       ├── tasks/
│       │   └── page.tsx                   # NEW: Today's tasks view
│       └── revenue/
│           └── page.tsx                   # NEW: revenue dashboard
├── app/connect/
│   └── [token]/
│       └── page.tsx                       # EXTEND: white-label branding
├── components/
│   ├── onboarding/
│   │   ├── ChecklistProgress.tsx          # NEW: category-grouped progress
│   │   ├── ChecklistItemRow.tsx           # NEW: item with actions
│   │   └── MagicLinkButton.tsx            # NEW: send-to-client flow
│   ├── pipeline/
│   │   ├── PipelineKanban.tsx             # NEW: full kanban implementation
│   │   ├── PipelineCard.tsx               # NEW: prospect/client card
│   │   └── StageConfigDialog.tsx          # NEW: stage customization
│   ├── tasks/
│   │   ├── TodaysFeed.tsx                 # NEW: task list with focus area
│   │   ├── TaskItem.tsx                   # NEW: task row with actions
│   │   └── UrgencyScoreBadge.tsx          # NEW: visual priority indicator
│   └── revenue/
│       ├── RevenueCards.tsx               # NEW: 4 metric cards grid
│       ├── MrrMovementBreakdown.tsx       # NEW: new/expansion/churn
│       ├── OutstandingPayments.tsx        # NEW: collections section
│       └── RevenueTrendChart.tsx          # NEW: 3/6/12 month trend
```

### Pattern 1: Event-Driven Checklist Completion

**What:** Checklist items auto-complete when system events occur (OAuth success, kickoff scheduled, etc.)
**When to use:** Items with `autoCompleteEvent` field set
**Example:**
```typescript
// Source: Established pattern from OnboardingService.ts
import { ChecklistRepository } from "../repositories/ChecklistRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import { nanoid } from "nanoid";

type AutoCompleteEvent = "gsc_connected" | "ga_connected" | "cms_connected" | "kickoff_completed";

export async function handleAutoCompleteEvent(
  workspaceId: string,
  clientId: string,
  event: AutoCompleteEvent
): Promise<void> {
  const checklist = await ChecklistRepository.getChecklistByClient(clientId);
  if (!checklist) return;

  // Find item with matching autoCompleteEvent
  const item = checklist.items.find(i => i.autoCompleteEvent === event && !i.completedAt);
  if (!item) return;

  // Complete the item
  await ChecklistRepository.completeChecklistItem(checklist.id, item.id, "system");

  // Log activity
  await ActivityRepository.insertActivity({
    id: nanoid(),
    workspaceId,
    entityType: "onboarding",
    entityId: checklist.id,
    activityType: "item_completed",
    activityData: { itemId: item.id, event, automatic: true },
  });
}
```

### Pattern 2: Multi-Source Task Aggregation

**What:** Today's feed pulls tasks from multiple sources into a unified priority-sorted list
**When to use:** Dashboard task feed requiring cross-entity aggregation
**Example:**
```typescript
// Source: Pattern derived from D-09 task sources decision
interface AggregatedTask {
  id: string;
  source: "checklist" | "pipeline" | "follow_up" | "expiring" | "seo" | "manual";
  entityType: string;
  entityId: string;
  title: string;
  dueAt: Date | null;
  urgencyScore: number;
  clientId?: string;
  clientName?: string;
}

export async function aggregateTasks(workspaceId: string, userId: string): Promise<AggregatedTask[]> {
  const [overdueChecklists, stalePipeline, followUps, expiring, seoTasks, manualTasks] = await Promise.all([
    getOverdueChecklistItems(workspaceId),
    getStalePipelineCards(workspaceId, STALE_THRESHOLD_DAYS),
    getScheduledFollowUps(workspaceId, userId),
    getExpiringContracts(workspaceId, EXPIRY_WINDOW_DAYS),
    getSeoTasksNeedingHuman(workspaceId),
    getManualTasks(workspaceId, userId),
  ]);

  const allTasks = [
    ...overdueChecklists.map(toTask("checklist")),
    ...stalePipeline.map(toTask("pipeline")),
    ...followUps.map(toTask("follow_up")),
    ...expiring.map(toTask("expiring")),
    ...seoTasks.map(toTask("seo")),
    ...manualTasks.map(toTask("manual")),
  ];

  return allTasks.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
```

### Pattern 3: Multi-List Kanban with @dnd-kit

**What:** Drag-and-drop between pipeline stages using @dnd-kit sortable
**When to use:** Pipeline kanban board
**Example:**
```typescript
// Source: [CITED: dndkit.com/react/guides/multiple-sortable-lists]
"use client";

import { useState, useRef } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable, isSortable } from "@dnd-kit/react/sortable";

interface PipelineState {
  [stage: string]: string[]; // prospect IDs per stage
}

export function PipelineKanban({ initialState }: { initialState: PipelineState }) {
  const [items, setItems] = useState(initialState);
  const snapshot = useRef(structuredClone(initialState));

  return (
    <DragDropProvider
      onDragStart={() => {
        snapshot.current = structuredClone(items);
      }}
      onDragEnd={async (event) => {
        if (event.canceled) {
          setItems(snapshot.current);
          return;
        }

        const { source } = event.operation;
        if (!isSortable(source)) return;

        const { initialIndex, index, initialGroup, group } = source;
        if (initialGroup == null || group == null) return;

        // Optimistic update
        setItems((prev) => {
          if (initialGroup === group) {
            const groupItems = [...prev[group]];
            const [removed] = groupItems.splice(initialIndex, 1);
            groupItems.splice(index, 0, removed);
            return { ...prev, [group]: groupItems };
          }

          const sourceItems = [...prev[initialGroup]];
          const [removed] = sourceItems.splice(initialIndex, 1);
          const targetItems = [...prev[group]];
          targetItems.splice(index, 0, removed);
          return { ...prev, [initialGroup]: sourceItems, [group]: targetItems };
        });

        // Persist to backend
        const prospectId = items[initialGroup][initialIndex];
        await updateProspectStage(prospectId, group as PipelineStage);
      }}
    >
      {/* Render stages */}
    </DragDropProvider>
  );
}
```

### Anti-Patterns to Avoid

- **Polling for task updates:** Use server actions with revalidation, not client-side polling. The dashboard should revalidate on user interaction, not on a timer.
- **Client-side MRR calculation:** Never calculate financial metrics in the browser. All revenue calculations happen server-side to prevent manipulation and ensure consistency.
- **Storing converted currency amounts:** Store amounts in original currency with currency code. Conversion is display-only, calculated at render time.
- **Global pipeline stages:** Stages are per-workspace. Never use hardcoded global stage list; always fetch from workspace configuration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop | Custom DnD handlers | @dnd-kit | Accessibility, touch support, collision detection already handled |
| Currency formatting | Template strings | Intl.NumberFormat | Locale-aware formatting with currency symbols |
| Date math | Manual calculations | date-fns | Handles DST, leap years, timezone edge cases |
| Sparkline charts | Custom SVG | recharts | Responsive, performant, already integrated |
| ID generation | Math.random | nanoid | Collision-resistant, URL-safe |

**Key insight:** This phase extends proven patterns. The checklist infrastructure, kanban components, and OAuth flow are already battle-tested in production. Reuse, don't reinvent.

## Common Pitfalls

### Pitfall 1: Optimistic Updates Without Rollback

**What goes wrong:** User drags card to new stage, backend fails, UI shows wrong state
**Why it happens:** Forgetting to store snapshot before optimistic update
**How to avoid:** Always save `structuredClone()` snapshot in `onDragStart`, restore on `event.canceled` or API failure
**Warning signs:** Cards "jump back" on save, or get stuck in wrong columns

### Pitfall 2: Race Conditions in Checklist Completion

**What goes wrong:** Two auto-complete events arrive simultaneously, both try to complete same item
**Why it happens:** No idempotency check on completion
**How to avoid:** Check `completedAt` before completing; use database-level constraints or optimistic locking
**Warning signs:** Duplicate activity log entries, completedCount mismatch with actual completed items

### Pitfall 3: Currency Display Inconsistency

**What goes wrong:** MRR shows mixed currencies, totals don't add up
**Why it happens:** Summing amounts without conversion, or converting at different rates
**How to avoid:** All aggregations use single display currency; store original amounts separately; convert at consistent rate
**Warning signs:** "Total MRR" differs depending on which page you view

### Pitfall 4: Pipeline Stage Configuration Drift

**What goes wrong:** Prospect has `pipelineStage: "qualified"` but workspace removed that stage
**Why it happens:** Stage deletion doesn't migrate existing prospects
**How to avoid:** Stage deletion requires target stage for migration; add validation on stage lookup
**Warning signs:** Empty kanban columns, "Unknown stage" errors

### Pitfall 5: Magic Link Token Leakage

**What goes wrong:** Token exposed in logs or analytics
**Why it happens:** Token in URL query param logged by middleware or analytics
**How to avoid:** Use path parameter `/connect/[token]` not query param; exclude from analytics; short expiry (24h)
**Warning signs:** Tokens appearing in server logs, client-side errors with token visible

## Code Examples

### MRR Calculation Service

```typescript
// Source: Derived from invoice-schema.ts and D-12/D-14 decisions
import { db } from "@/db";
import { contracts } from "@/db/contract-schema";
import { invoices } from "@/db/invoice-schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface MrrMetrics {
  currentMrr: number;
  newMrr: number;
  expansionMrr: number;
  churnMrr: number;
  currency: string;
}

export async function calculateMrr(
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
  displayCurrency: string = "EUR"
): Promise<MrrMetrics> {
  // Get all recurring contracts in period
  const recurringContracts = await db
    .select()
    .from(contracts)
    .where(
      and(
        eq(contracts.workspaceId, workspaceId),
        eq(contracts.status, "executed"),
        // Contract must be active in period
        lte(contracts.createdAt, periodEnd)
      )
    );

  // Calculate MRR from each contract type
  // D-14: recurring (MRR), prepaid term (spread), project (excluded), hybrid (recurring portion)
  let currentMrr = 0;
  let newMrr = 0;

  for (const contract of recurringContracts) {
    const proposal = await getProposalForContract(contract.proposalId);
    if (!proposal) continue;

    const monthlyAmount = proposal.monthlyFeeCents / 100;
    currentMrr += monthlyAmount;

    // New if contract started in period
    if (contract.createdAt >= periodStart) {
      newMrr += monthlyAmount;
    }
  }

  return {
    currentMrr,
    newMrr,
    expansionMrr: 0, // Would require tracking tier changes
    churnMrr: 0, // Would require tracking cancellations
    currency: displayCurrency,
  };
}
```

### Urgency Score Algorithm

```typescript
// Source: D-11 urgency score decision
interface Task {
  dueAt: Date | null;
  dealValueCents: number | null;
  daysInStage: number;
  manualPriority: "high" | "medium" | "low" | null;
}

const PRIORITY_WEIGHTS = {
  high: 75,
  medium: 50,
  low: 25,
} as const;

export function calculateUrgencyScore(task: Task): number {
  let score = 0;
  const now = new Date();

  // Overdue penalty: +20 per day overdue
  if (task.dueAt && task.dueAt < now) {
    const daysOverdue = Math.ceil((now.getTime() - task.dueAt.getTime()) / (1000 * 60 * 60 * 24));
    score += daysOverdue * 20;
  }

  // Due today bonus: +50
  if (task.dueAt) {
    const isToday = task.dueAt.toDateString() === now.toDateString();
    if (isToday) score += 50;
  }

  // Deal value: +1 per 1000 cents (10 EUR)
  if (task.dealValueCents) {
    score += Math.floor(task.dealValueCents / 1000);
  }

  // Stale in stage: +3 per day
  score += task.daysInStage * 3;

  // Manual priority: +25/50/75
  if (task.manualPriority) {
    score += PRIORITY_WEIGHTS[task.manualPriority];
  }

  return score;
}
```

### White-Label Magic Link Page

```typescript
// Source: Extension of existing /connect/[token]/page.tsx
import { getWorkspaceBranding } from "@/lib/workspace";

interface WorkspaceBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
}

export default async function ConnectPage({ params }: { params: { token: string } }) {
  const { token } = await params;
  const invite = await validateInvite(token);

  if (!invite?.valid) {
    return <ExpiredInvitePage />;
  }

  // Fetch workspace branding for white-label display
  const branding = await getWorkspaceBranding(invite.workspace_id);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ "--accent": branding.primaryColor } as React.CSSProperties}
    >
      <div className="max-w-md text-center p-8">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.name} className="mx-auto h-12 mb-6" />
        ) : (
          <h2 className="text-xl font-semibold mb-6">{branding.name}</h2>
        )}
        <h1 className="text-2xl font-semibold">Complete Your Onboarding</h1>
        <p className="mt-3 text-muted-foreground">
          Connect your Google accounts to get started with {branding.name}.
        </p>
        {/* OAuth buttons */}
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-dnd | @dnd-kit | 2023 | Better accessibility, simpler API, smaller bundle |
| Moment.js | date-fns | 2022 | Tree-shakeable, immutable, smaller |
| Float currency amounts | Integer cents | Industry standard | No rounding errors, exact calculations |
| Polling for updates | Server Actions + revalidation | Next.js 14+ | Less bandwidth, fresher data |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Archived in 2023, use @dnd-kit or @hello-pangea/dnd
- Float-based currency: Always use integer cents/pence for money

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Workspace branding fields (logo, primaryColor) exist in organization table | Code Examples | Need schema migration to add branding fields |
| A2 | OAuth callback can trigger checklist completion via shared event bus | Architecture Patterns | May need direct service call instead of events |
| A3 | Exchange rates for multi-currency display are acceptable to fetch at render time | Pitfalls | May need cached rates for performance |

## Open Questions

1. **Workspace Branding Storage**
   - What we know: Organization table has `logo` text field but no color fields
   - What's unclear: Where to store primaryColor, accentColor for white-label
   - Recommendation: Add `brandConfig` JSONB column to organization table, or create separate `workspace_branding` table

2. **Exchange Rate Source**
   - What we know: D-13 requires multi-currency display with user-selected display currency
   - What's unclear: Whether to use live rates, daily fixed rates, or user-entered rates
   - Recommendation: Start with user-entered rates per workspace (simplest), add live rates later if needed

3. **Task Reminder Delivery**
   - What we know: D-10 mentions reminders as part of task system
   - What's unclear: Whether reminders are in-app only or also email/push
   - Recommendation: Start with in-app only (bell icon), defer email/push to later phase

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All features | Yes | 15+ | - |
| Redis | Dashboard caching | Yes | 7+ | - |
| @dnd-kit | Pipeline kanban | Yes | 6.3.1 | - |
| recharts | Trend charts | Yes | 3.8.1 | - |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.0.x |
| Config file (backend) | open-seo-main/vitest.config.ts |
| Config file (frontend) | apps/web/vitest.config.ts |
| Quick run command | `pnpm test:unit --run` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | Checklist created on payment | unit | `pnpm --filter open-seo-main test -- OnboardingService.test.ts -x` | Yes (partial) |
| SC-02 | Tier determines items | unit | `pnpm --filter open-seo-main test -- OnboardingService.test.ts -x` | Yes (partial) |
| SC-03 | Auto-complete on OAuth | unit | `pnpm --filter open-seo-main test -- ChecklistCompletionService.test.ts -x` | No (Wave 0) |
| SC-04 | Progress visualization | component | `pnpm --filter @tevero/web test -- ChecklistProgress.test.tsx -x` | No (Wave 0) |
| SC-05 | Pipeline kanban DnD | component | `pnpm --filter @tevero/web test -- PipelineKanban.test.tsx -x` | No (Wave 0) |
| SC-06 | Today's tasks feed | unit | `pnpm --filter open-seo-main test -- TaskAggregationService.test.ts -x` | No (Wave 0) |
| SC-07 | MRR metrics | unit | `pnpm --filter open-seo-main test -- RevenueService.test.ts -x` | No (Wave 0) |
| SC-08 | One-time payment tracking | unit | `pnpm --filter open-seo-main test -- RevenueService.test.ts -x` | No (Wave 0) |
| SC-09 | Churn risk indicators | unit | `pnpm --filter open-seo-main test -- ChurnRiskService.test.ts -x` | No (Wave 0) |
| SC-10 | Prospect -> client conversion | integration | `pnpm --filter open-seo-main test -- ConversionService.test.ts -x` | No (Wave 0) |

### Sampling Rate
- **Per task commit:** `pnpm test:unit --run`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `open-seo-main/src/server/features/onboarding/services/ChecklistCompletionService.test.ts` - covers SC-03
- [ ] `open-seo-main/src/server/features/tasks/services/TaskAggregationService.test.ts` - covers SC-06
- [ ] `open-seo-main/src/server/features/revenue/services/RevenueService.test.ts` - covers SC-07, SC-08
- [ ] `open-seo-main/src/server/features/revenue/services/ChurnRiskService.test.ts` - covers SC-09
- [ ] `apps/web/src/components/onboarding/ChecklistProgress.test.tsx` - covers SC-04
- [ ] `apps/web/src/components/pipeline/PipelineKanban.test.tsx` - covers SC-05

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Clerk (existing) for agency users; magic link tokens for clients |
| V3 Session Management | Yes | Clerk sessions; short-lived magic link tokens (24h expiry) |
| V4 Access Control | Yes | Workspace-scoped queries; userId/orgId from Clerk session |
| V5 Input Validation | Yes | Zod schemas for all API inputs |
| V6 Cryptography | No | No custom crypto; tokens via nanoid (secure random) |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Magic link token enumeration | Information Disclosure | nanoid (21 chars, 128 bits entropy); rate limit token validation |
| Pipeline stage manipulation | Tampering | Server-side validation of stage transitions |
| Revenue data tampering | Tampering | Server-side only calculations; no client-side aggregation |
| Cross-workspace data access | Elevation of Privilege | workspaceId filter on ALL queries; never trust client-provided workspaceId |
| OAuth callback hijacking | Spoofing | State parameter validation; HTTPS only; domain whitelist |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] OnboardingService.ts, ChecklistRepository.ts - existing implementation
- [VERIFIED: codebase] contract-schema.ts, invoice-schema.ts - existing schemas
- [VERIFIED: codebase] @tevero/ui components - Kanban, Checklist, MetricCard, TodayFeedItem
- [VERIFIED: npm registry] @dnd-kit/core 6.3.1, @dnd-kit/sortable 10.0.0
- [CITED: dndkit.com/react/guides/multiple-sortable-lists] - multi-list sortable pattern

### Secondary (MEDIUM confidence)
- [CITED: design-system-v6.md] - v6 design tokens and patterns
- [VERIFIED: codebase] clientOAuth.ts, oauth.ts types - magic link pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - extends proven existing patterns
- Pitfalls: HIGH - derived from existing codebase patterns and past phase issues

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable domain, no major library changes expected)
