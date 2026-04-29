# GSD Plan: Phase 4 - Onboarding System & Agency Dashboard

> **Goal**: Complete the prospect -> client -> active pipeline with automated onboarding and agency dashboard  
> **Dependencies**: Existing proposal-schema.ts, prospect-schema.ts, client-schema.ts, OAuth connect flow  
> **Design References**: v8-agency-pipeline.md, design-system-v6.md (sections 7.1, 10.2)

---

## Executive Summary

Phase 4 implements the final pieces of the Agency CRM pipeline:
1. **Onboarding Engine**: Auto-create checklist on payment, track completion, convert prospect -> client
2. **Agency Dashboard**: Pipeline kanban, Today's tasks feed, MRR metrics, retention signals

**Critical Constraint**: Reuse existing schemas (`proposals`, `proposalPayments`, `clients`, `prospects`) rather than creating new tables.

**Data Dependencies** (from Phase 45 - Data Foundation):
- `onboarding_checklists` table - Schema defined in [gsd-phase1-data-foundation.md](./gsd-phase1-data-foundation.md) Task 1.2.3
- `pipeline_activities` table - Schema defined in [gsd-phase1-data-foundation.md](./gsd-phase1-data-foundation.md) Task 1.2.4

**Schema Governance**: Phase 45 owns the table definitions. This phase provides SERVICE logic, templates, and UI that operate on those tables. Schema changes must be made in Phase 45, not here.

---

## Part 1: Onboarding Engine

### 1.1 Database Schema - Onboarding Checklists

> **Data Dependency**: Uses `onboarding_checklists` table defined in **Phase 45 (Data Foundation)**.
> 
> **Schema defined in**: [gsd-phase1-data-foundation.md](./gsd-phase1-data-foundation.md) Task 1.1.3 / Task 1.2.3
> 
> **Canonical checklist structure**: [v8-agency-pipeline.md](./v8-agency-pipeline.md) Section "Stage 5: Onboarding"
> 
> **IMPORTANT**: Schema changes must be made in Phase 45, not here.

Phase 45 provides the complete `onboarding_checklists` table with:
- `id` (uuid), `client_id`, `workspace_id`
- `service_tier` ('starter' | 'growth' | 'enterprise')
- `template_version` (integer)
- `items` (JSONB array of ChecklistItem)
- `total_items`, `completed_items`, `progress_pct`
- `started_at`, `completed_at`, `created_at`, `updated_at`

**ChecklistItem interface** (reference only - defined in Phase 45):
```typescript
interface ChecklistItem {
  key: string;
  label: string;
  category: 'account_setup' | 'technical_connections' | 'brand_strategy' | 'initial_deliverables';
  type: 'manual' | 'auto_oauth' | 'auto_system' | 'external';
  required: boolean;
  serviceTiers: ('starter' | 'growth' | 'enterprise')[];
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  autoCompleteEvent?: string;
  externalLink?: string;
  notes?: string;
}
```

**Tasks** (schema handled by Phase 45):
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.1.1 | Verify Phase 45 onboarding_checklists migration completed | CI/local | Phase 45 Task 1.2.3 | 15m |

---

### 1.2 Checklist Template System

**File**: `open-seo-main/src/server/features/onboarding/checklist-templates.ts` (NEW)

Define the default checklist items per service tier:

```typescript
export const CHECKLIST_TEMPLATES: Record<ServiceTier, ChecklistItem[]> = {
  starter: [
    // Account Setup (2 items)
    { key: 'client_record', label: 'Client record created from prospect', category: 'account_setup', type: 'auto_system', required: true, serviceTiers: ['starter', 'growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    { key: 'keywords_migrated', label: 'Keywords migrated from prospect analysis', category: 'account_setup', type: 'auto_system', required: true, serviceTiers: ['starter', 'growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    
    // Technical Connections (1 item for starter)
    { key: 'gsc_connected', label: 'Google Search Console access granted', category: 'technical_connections', type: 'auto_oauth', required: true, serviceTiers: ['starter', 'growth', 'enterprise'], completed: false, completedAt: null, completedBy: null, autoCompleteEvent: 'oauth.gsc.connected' },
    
    // Initial Deliverables (2 items)
    { key: 'first_audit', label: 'First audit completed', category: 'initial_deliverables', type: 'auto_system', required: true, serviceTiers: ['starter', 'growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    { key: 'kickoff_scheduled', label: 'Kickoff call scheduled', category: 'initial_deliverables', type: 'external', required: true, serviceTiers: ['starter', 'growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
  ],
  
  growth: [
    // ... starter items + 
    // Technical Connections (3 items)
    { key: 'ga4_connected', label: 'Google Analytics 4 access granted', category: 'technical_connections', type: 'auto_oauth', required: true, serviceTiers: ['growth', 'enterprise'], completed: false, completedAt: null, completedBy: null, autoCompleteEvent: 'oauth.ga4.connected' },
    
    // Brand & Strategy (3 items)
    { key: 'voice_profile', label: 'Voice profile configured', category: 'brand_strategy', type: 'manual', required: true, serviceTiers: ['growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    { key: 'competitors_confirmed', label: 'Competitor list confirmed', category: 'brand_strategy', type: 'manual', required: true, serviceTiers: ['growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    { key: 'monthly_goal', label: 'Monthly goal defined', category: 'brand_strategy', type: 'manual', required: true, serviceTiers: ['growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
    
    // Initial Deliverables
    { key: 'first_content', label: 'First content piece generated', category: 'initial_deliverables', type: 'auto_system', required: true, serviceTiers: ['growth', 'enterprise'], completed: false, completedAt: null, completedBy: null },
  ],
  
  enterprise: [
    // ... growth items +
    // Technical Connections (1 more)
    { key: 'cms_connected', label: 'CMS access granted', category: 'technical_connections', type: 'manual', required: true, serviceTiers: ['enterprise'], completed: false, completedAt: null, completedBy: null },
    
    // Brand & Strategy (2 more)
    { key: 'protection_rules', label: 'Brand protection rules configured', category: 'brand_strategy', type: 'manual', required: true, serviceTiers: ['enterprise'], completed: false, completedAt: null, completedBy: null },
    { key: 'custom_templates', label: 'Custom content templates created', category: 'brand_strategy', type: 'manual', required: false, serviceTiers: ['enterprise'], completed: false, completedAt: null, completedBy: null },
  ],
};

export function generateChecklistForTier(tier: ServiceTier): ChecklistItem[] {
  // Collect all items for this tier and lower
  const items: ChecklistItem[] = [];
  const addedKeys = new Set<string>();
  
  // Add items in order: starter -> growth -> enterprise
  for (const t of SERVICE_TIERS) {
    for (const item of CHECKLIST_TEMPLATES[t]) {
      if (item.serviceTiers.includes(tier) && !addedKeys.has(item.key)) {
        items.push({ ...item });
        addedKeys.add(item.key);
      }
    }
    if (t === tier) break;
  }
  
  return items;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.2.1 | Create checklist-templates.ts with tier definitions | `open-seo-main/src/server/features/onboarding/checklist-templates.ts` | 1.1.1 | 2h |
| 1.2.2 | Add unit tests for template generation | `open-seo-main/src/server/features/onboarding/checklist-templates.test.ts` | 1.2.1 | 1h |

---

### 1.3 Onboarding Service

**File**: `open-seo-main/src/server/features/onboarding/onboarding-service.ts` (NEW)

```typescript
export class OnboardingService {
  // Create checklist when payment received
  async createChecklist(clientId: string, serviceTier: ServiceTier): Promise<OnboardingChecklist>;
  
  // Mark item complete (manual or via webhook)
  async completeItem(clientId: string, itemKey: string, completedBy: string): Promise<OnboardingChecklist>;
  
  // Get checklist progress
  async getChecklist(clientId: string): Promise<OnboardingChecklist | null>;
  
  // Check if all required items complete -> mark client as active
  async checkAndActivate(clientId: string): Promise<boolean>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.3.1 | Create OnboardingService class | `open-seo-main/src/server/features/onboarding/onboarding-service.ts` | 1.2.1 | 3h |
| 1.3.2 | Add repository pattern for checklist CRUD | `open-seo-main/src/server/features/onboarding/onboarding-repository.ts` | 1.3.1 | 2h |
| 1.3.3 | Unit tests for service | `open-seo-main/src/server/features/onboarding/onboarding-service.test.ts` | 1.3.1 | 2h |

---

### 1.4 Prospect -> Client Conversion Logic

**File**: `open-seo-main/src/server/features/clients/conversion-service.ts` (NEW)

This handles the data migration when a prospect converts:

```typescript
export interface ConversionResult {
  client: ClientSelect;
  checklist: OnboardingChecklist;
  migratedKeywords: number;
  migratedCompetitors: number;
}

export class ConversionService {
  // Main conversion function - called when payment.completed fires
  async convertProspectToClient(
    prospectId: string,
    proposalId: string,
    serviceTier: ServiceTier
  ): Promise<ConversionResult>;
  
  // Migrate prospect keywords to client target keywords
  private async migrateKeywords(prospectId: string, clientId: string): Promise<number>;
  
  // Migrate competitor data
  private async migrateCompetitors(prospectId: string, clientId: string): Promise<number>;
  
  // Copy audit history for baseline
  private async copyAuditBaseline(prospectId: string, clientId: string): Promise<void>;
  
  // Update prospect status to 'converted' and link to client
  private async linkProspectToClient(prospectId: string, clientId: string): Promise<void>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.4.1 | Create ConversionService | `open-seo-main/src/server/features/clients/conversion-service.ts` | 1.3.1 | 4h |
| 1.4.2 | Add keyword migration logic | Same file | 1.4.1 | 2h |
| 1.4.3 | Add competitor migration logic | Same file | 1.4.1 | 1h |
| 1.4.4 | Add audit baseline copy | Same file | 1.4.1 | 1h |
| 1.4.5 | Unit tests | `open-seo-main/src/server/features/clients/conversion-service.test.ts` | 1.4.1-4 | 3h |

---

### 1.5 Payment Webhook Integration

**Existing File to Extend**: Stripe webhook handler

When `invoice.paid` fires from Stripe:
1. Update proposal status to 'paid'
2. Trigger ConversionService.convertProspectToClient()
3. Auto-complete 'client_record' and 'keywords_migrated' checklist items
4. Send onboarding email with magic links

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.5.1 | Extend Stripe webhook handler for conversion | `open-seo-main/src/routes/api/webhooks/stripe.ts` | 1.4.1 | 2h |
| 1.5.2 | Add email service for onboarding email | `open-seo-main/src/server/features/email/onboarding-email.ts` | 1.5.1 | 2h |
| 1.5.3 | Integration tests for payment -> conversion flow | `open-seo-main/src/routes/api/webhooks/stripe.test.ts` | 1.5.1-2 | 2h |

---

### 1.6 OAuth Auto-Completion Triggers

**Existing File to Extend**: `AI-Writer/backend/main.py` or `apps/web/src/app/connect/`

When OAuth callback fires (GSC, GA4, etc.):
1. Mark connection as active
2. Find associated client's onboarding checklist
3. Auto-complete the relevant checklist item (e.g., 'gsc_connected')
4. Log activity

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.6.1 | Add OAuth completion event emitter | `AI-Writer/backend/routers/oauth.py` | 1.3.1 | 2h |
| 1.6.2 | Create OAuth webhook handler in open-seo-main | `open-seo-main/src/routes/api/webhooks/oauth.ts` | 1.6.1 | 2h |
| 1.6.3 | Wire auto-complete to OnboardingService | Same file | 1.6.2 | 1h |
| 1.6.4 | Integration tests | `open-seo-main/src/routes/api/webhooks/oauth.test.ts` | 1.6.1-3 | 2h |

---

### 1.7 Onboarding UI Components

**Location**: `apps/web/src/app/(shell)/clients/[clientId]/onboarding/`

```
onboarding/
  page.tsx                    # Main onboarding dashboard
  components/
    OnboardingProgress.tsx    # Progress bar with step indicator (design-system-v6 section 7.1)
    ChecklistCategory.tsx     # Category header with items
    ChecklistItem.tsx         # Individual item with status/action
    OAuthConnectionCard.tsx   # Card for OAuth connections (existing pattern)
    MagicLinkButton.tsx       # Send/resend magic link
```

**Design Reference**: design-system-v6.md section 6 (Form Patterns - stepped wizard with progress indicator)

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 1.7.1 | Create onboarding page layout | `apps/web/src/app/(shell)/clients/[clientId]/onboarding/page.tsx` | 1.3.1 | 3h |
| 1.7.2 | Create OnboardingProgress component | `apps/web/src/app/(shell)/clients/[clientId]/onboarding/components/OnboardingProgress.tsx` | 1.7.1 | 2h |
| 1.7.3 | Create ChecklistCategory component | Same dir | 1.7.2 | 1.5h |
| 1.7.4 | Create ChecklistItem component | Same dir | 1.7.3 | 1.5h |
| 1.7.5 | Create OAuthConnectionCard (reuse existing pattern) | Same dir | 1.7.4 | 1h |
| 1.7.6 | Create MagicLinkButton with resend | Same dir | 1.7.5 | 1h |
| 1.7.7 | Add server action for checklist mutations | `apps/web/src/actions/onboarding.ts` | 1.7.1-6 | 2h |
| 1.7.8 | E2E tests for onboarding flow | `apps/web/e2e/onboarding.spec.ts` | 1.7.1-7 | 3h |

---

## Part 2: Agency Dashboard

### 2.1 Database Schema - Pipeline Activities

> **Data Dependency**: Uses `pipeline_activities` table defined in **Phase 45 (Data Foundation)**.
> 
> **Schema defined in**: [gsd-phase1-data-foundation.md](./gsd-phase1-data-foundation.md) Task 1.1.4 / Task 1.2.4
> 
> **Activity actions defined in**: [v8-agency-pipeline.md](./v8-agency-pipeline.md) Data Model section
> 
> **IMPORTANT**: Schema changes must be made in Phase 45, not here.

Phase 45 provides the complete `pipeline_activities` table with:
- `id` (uuid), `workspace_id`
- `entity_type` ('prospect' | 'proposal' | 'contract' | 'invoice' | 'client')
- `entity_id`, `action`, `actor_type`, `actor_id`
- `metadata` (JSONB)
- `created_at` (immutable - no updated_at)

**Activity Actions** (reference only - defined in Phase 45):
```typescript
const ACTIVITY_ACTIONS = [
  'prospect.created', 'prospect.analyzed', 'prospect.qualified',
  'proposal.created', 'proposal.sent', 'proposal.viewed', 'proposal.accepted', 'proposal.declined',
  'contract.signed', 'payment.received', 'payment.failed',
  'onboarding.started', 'onboarding.item_completed', 'onboarding.completed',
  'client.activated', 'client.paused', 'client.churned',
] as const;
```

**Tasks** (schema handled by Phase 45):
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.1.1 | Verify Phase 45 pipeline_activities migration completed | CI/local | Phase 45 Task 1.2.4 | 15m |

---

### 2.2 Activity Logging Service

**File**: `open-seo-main/src/server/features/pipeline/activity-service.ts` (NEW)

```typescript
export class ActivityService {
  // Log a pipeline activity
  async log(activity: Omit<PipelineActivity, 'id' | 'createdAt'>): Promise<PipelineActivity>;
  
  // Get activities for an entity
  async getForEntity(entityType: string, entityId: string, limit?: number): Promise<PipelineActivity[]>;
  
  // Get activities for a workspace (Today feed)
  async getForWorkspace(workspaceId: string, options: {
    since?: Date;
    until?: Date;
    actions?: ActivityAction[];
    limit?: number;
  }): Promise<PipelineActivity[]>;
  
  // Get recent activities for Today feed
  async getTodayFeed(workspaceId: string): Promise<PipelineActivity[]>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.2.1 | Create ActivityService | `open-seo-main/src/server/features/pipeline/activity-service.ts` | 2.1.1 | 2h |
| 2.2.2 | Add activity logging to existing services | Various | 2.2.1 | 3h |
| 2.2.3 | Unit tests | `open-seo-main/src/server/features/pipeline/activity-service.test.ts` | 2.2.1-2 | 2h |

---

### 2.3 Pipeline Metrics Service

**File**: `open-seo-main/src/server/features/pipeline/metrics-service.ts` (NEW)

```typescript
export interface PipelineMetrics {
  // Pipeline counts by stage
  stages: {
    leads: { count: number; potentialMrr: number };
    proposals: { count: number; pendingMrr: number };
    contracts: { count: number; closingMrr: number };
    onboarding: { count: number; startingMrr: number };
    active: { count: number; actualMrr: number };
  };
  
  // Overall metrics
  totalMrr: number;
  projectedMrr: number;  // Active + (Onboarding * conversion rate)
  retentionPct: number;
  avgClientTenure: number;  // months
  
  // Period comparisons
  mrrChange30d: number;
  mrrChangePct30d: number;
  newClients30d: number;
  churnedClients30d: number;
}

export interface RetentionSignals {
  clientsAtRisk: Array<{
    clientId: string;
    clientName: string;
    signals: string[];  // e.g., ['no_login_14d', 'declining_engagement']
    riskScore: number;  // 0-100
    lastActivity: Date;
  }>;
  renewalsUpcoming: Array<{
    clientId: string;
    clientName: string;
    renewalDate: Date;
    mrr: number;
  }>;
}

export class MetricsService {
  async getPipelineMetrics(workspaceId: string): Promise<PipelineMetrics>;
  async getRetentionSignals(workspaceId: string): Promise<RetentionSignals>;
  async getClientHealthScore(clientId: string): Promise<number>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.3.1 | Create MetricsService with pipeline counts | `open-seo-main/src/server/features/pipeline/metrics-service.ts` | None | 3h |
| 2.3.2 | Add MRR calculation logic | Same file | 2.3.1 | 2h |
| 2.3.3 | Add retention signal detection | Same file | 2.3.1 | 3h |
| 2.3.4 | Add client health scoring | Same file | 2.3.3 | 2h |
| 2.3.5 | Unit tests | `open-seo-main/src/server/features/pipeline/metrics-service.test.ts` | 2.3.1-4 | 3h |

---

### 2.4 Tasks Aggregation Service

**File**: `open-seo-main/src/server/features/pipeline/tasks-service.ts` (NEW)

```typescript
export interface DashboardTask {
  id: string;
  type: 'call' | 'follow_up' | 'review' | 'approval' | 'overdue';
  title: string;
  description: string;
  dueAt: Date | null;
  priority: 'high' | 'medium' | 'low';
  entityType: string;
  entityId: string;
  entityName: string;
  stage: string;  // Pipeline stage
  mrr?: number;   // Associated MRR if applicable
  isOverdue: boolean;
  overdueBy?: number;  // days
}

export class TasksService {
  // Get all tasks for today
  async getTodaysTasks(workspaceId: string): Promise<{
    scheduled: DashboardTask[];
    overdue: DashboardTask[];
  }>;
  
  // Get tasks by type
  async getTasksByType(workspaceId: string, type: DashboardTask['type']): Promise<DashboardTask[]>;
  
  // Generate tasks from pipeline state
  private async generateProspectTasks(workspaceId: string): Promise<DashboardTask[]>;
  private async generateProposalTasks(workspaceId: string): Promise<DashboardTask[]>;
  private async generateOnboardingTasks(workspaceId: string): Promise<DashboardTask[]>;
  private async generateClientTasks(workspaceId: string): Promise<DashboardTask[]>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.4.1 | Create TasksService with aggregation logic | `open-seo-main/src/server/features/pipeline/tasks-service.ts` | None | 4h |
| 2.4.2 | Add prospect task generation (follow-ups) | Same file | 2.4.1 | 1.5h |
| 2.4.3 | Add proposal task generation (viewed, no response) | Same file | 2.4.1 | 1.5h |
| 2.4.4 | Add onboarding task generation (pending items) | Same file | 2.4.1 | 1.5h |
| 2.4.5 | Add client task generation (reports, renewals) | Same file | 2.4.1 | 1.5h |
| 2.4.6 | Unit tests | `open-seo-main/src/server/features/pipeline/tasks-service.test.ts` | 2.4.1-5 | 3h |

---

### 2.5 API Endpoints

**File**: `open-seo-main/src/routes/api/pipeline/`

```
pipeline/
  index.ts           # GET /api/pipeline - Overview with all stages
  activities.ts      # GET /api/pipeline/activities - Activity feed
  metrics.ts         # GET /api/pipeline/metrics - MRR, retention
  tasks.ts           # GET /api/pipeline/tasks - Today's tasks
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.5.1 | Create pipeline overview endpoint | `open-seo-main/src/routes/api/pipeline/index.ts` | 2.3.1 | 2h |
| 2.5.2 | Create activities endpoint | `open-seo-main/src/routes/api/pipeline/activities.ts` | 2.2.1 | 1.5h |
| 2.5.3 | Create metrics endpoint | `open-seo-main/src/routes/api/pipeline/metrics.ts` | 2.3.1 | 1.5h |
| 2.5.4 | Create tasks endpoint | `open-seo-main/src/routes/api/pipeline/tasks.ts` | 2.4.1 | 1.5h |
| 2.5.5 | Integration tests for all endpoints | `open-seo-main/src/routes/api/pipeline/*.test.ts` | 2.5.1-4 | 3h |

---

### 2.6 Agency Dashboard UI

**Location**: `apps/web/src/app/(shell)/dashboard/agency/`

```
agency/
  page.tsx                    # Main agency dashboard
  components/
    PipelineKanban.tsx        # Kanban view (view-only with click-to-detail)
    PipelineStageColumn.tsx   # Individual stage column
    PipelineCard.tsx          # Card within a stage
    TodayFeed.tsx             # Today's tasks feed (design-system-v6 section 10.2)
    TodayFeedItem.tsx         # Individual feed item
    MetricsStrip.tsx          # MRR, retention, capacity cards
    MetricCard.tsx            # Individual metric card
    RetentionAlerts.tsx       # Clients at risk panel
    RenewalTimeline.tsx       # Upcoming renewals
```

**Design References**:
- Pipeline kanban: v8-agency-pipeline.md section "Pipeline View"
- Today feed: design-system-v6.md section 10.2
- Metric cards: design-system-v6.md section 7.2
- Progress bars: design-system-v6.md section 7.1

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.6.1 | Create agency dashboard page layout | `apps/web/src/app/(shell)/dashboard/agency/page.tsx` | 2.5.1-4 | 3h |
| 2.6.2 | Create PipelineKanban component | `apps/web/src/app/(shell)/dashboard/agency/components/PipelineKanban.tsx` | 2.6.1 | 4h |
| 2.6.3 | Create PipelineStageColumn component | Same dir | 2.6.2 | 2h |
| 2.6.4 | Create PipelineCard component | Same dir | 2.6.3 | 2h |
| 2.6.5 | Create TodayFeed component | Same dir | 2.6.1 | 3h |
| 2.6.6 | Create TodayFeedItem component | Same dir | 2.6.5 | 1.5h |
| 2.6.7 | Create MetricsStrip component | Same dir | 2.6.1 | 2h |
| 2.6.8 | Create MetricCard component | Same dir | 2.6.7 | 1h |
| 2.6.9 | Create RetentionAlerts component | Same dir | 2.6.1 | 2h |
| 2.6.10 | Create RenewalTimeline component | Same dir | 2.6.9 | 1.5h |
| 2.6.11 | Add server action for dashboard data | `apps/web/src/actions/agency-dashboard.ts` | 2.6.1-10 | 2h |
| 2.6.12 | E2E tests for dashboard | `apps/web/e2e/agency-dashboard.spec.ts` | 2.6.1-11 | 3h |

---

### 2.7 Kanban Interaction Decision

**Decision**: View-only kanban (click to detail), NOT drag-drop

**Rationale**:
1. Drag-drop adds complexity without clear value (stage transitions should be deliberate)
2. Most transitions are system-triggered (payment received -> onboarding)
3. Manual stage changes can use detail page actions
4. Reduces bundle size and accessibility concerns

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 2.7.1 | Document kanban interaction pattern | `apps/web/src/app/(shell)/dashboard/agency/README.md` | None | 30m |

---

## Part 3: Retention Signals & Health Scoring

### 3.1 Client Health Score Algorithm

**File**: `open-seo-main/src/server/features/pipeline/health-scoring.ts` (NEW)

```typescript
export interface HealthFactors {
  // Engagement (40%)
  lastLoginDays: number;           // Days since last login
  loginFrequency30d: number;       // Logins in last 30 days
  pageViews30d: number;            // Dashboard page views
  
  // Results (30%)
  rankingTrend: 'improving' | 'stable' | 'declining';
  trafficTrend: 'improving' | 'stable' | 'declining';
  goalProgress: number;            // % toward monthly goal
  
  // Communication (15%)
  supportTickets7d: number;        // Support tickets in 7 days
  lastContactDays: number;         // Days since last agency contact
  
  // Billing (15%)
  paymentHistory: 'perfect' | 'late' | 'failed';
  renewalDays: number;             // Days until renewal
}

export function calculateHealthScore(factors: HealthFactors): number;
export function getChurnRiskLevel(score: number): 'low' | 'medium' | 'high';
export function generateHealthRecommendations(factors: HealthFactors): string[];
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 3.1.1 | Create health scoring algorithm | `open-seo-main/src/server/features/pipeline/health-scoring.ts` | None | 3h |
| 3.1.2 | Add factor collectors | Same file | 3.1.1 | 2h |
| 3.1.3 | Add recommendation generator | Same file | 3.1.1 | 1.5h |
| 3.1.4 | Unit tests with edge cases | `open-seo-main/src/server/features/pipeline/health-scoring.test.ts` | 3.1.1-3 | 2h |

---

### 3.2 Churn Prediction Triggers

**File**: `open-seo-main/src/server/features/pipeline/churn-triggers.ts` (NEW)

Based on v8-agency-pipeline.md section "Churn Prevention Signals":

```typescript
export const CHURN_TRIGGERS = [
  { signal: 'no_login_14d', threshold: 14, action: 'alert_agency', severity: 'medium' },
  { signal: 'declining_engagement', threshold: 50, action: 'schedule_checkin', severity: 'high' },
  { signal: 'support_tickets_spike', threshold: 3, action: 'flag_review', severity: 'high' },
  { signal: 'invoice_overdue_30d', threshold: 30, action: 'escalate_owner', severity: 'critical' },
] as const;

export class ChurnDetector {
  async detectSignals(clientId: string): Promise<ChurnSignal[]>;
  async runBatchDetection(workspaceId: string): Promise<Map<string, ChurnSignal[]>>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 3.2.1 | Create ChurnDetector | `open-seo-main/src/server/features/pipeline/churn-triggers.ts` | 3.1.1 | 3h |
| 3.2.2 | Add scheduled detection job | `open-seo-main/src/server/jobs/churn-detection.ts` | 3.2.1 | 2h |
| 3.2.3 | Add notification integration | Same file | 3.2.2 | 1.5h |
| 3.2.4 | Unit tests | `open-seo-main/src/server/features/pipeline/churn-triggers.test.ts` | 3.2.1-3 | 2h |

---

### 3.3 Renewal Tracking

**File**: `open-seo-main/src/server/features/pipeline/renewal-service.ts` (NEW)

```typescript
export class RenewalService {
  // Get upcoming renewals within N days
  async getUpcomingRenewals(workspaceId: string, daysAhead: number): Promise<Renewal[]>;
  
  // Check renewal status
  async checkRenewalStatus(clientId: string): Promise<RenewalStatus>;
  
  // Generate renewal tasks for dashboard
  async generateRenewalTasks(workspaceId: string): Promise<DashboardTask[]>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 3.3.1 | Create RenewalService | `open-seo-main/src/server/features/pipeline/renewal-service.ts` | None | 2h |
| 3.3.2 | Add renewal date tracking to clients | Migration | 3.3.1 | 1h |
| 3.3.3 | Unit tests | `open-seo-main/src/server/features/pipeline/renewal-service.test.ts` | 3.3.1-2 | 1.5h |

---

## Part 4: Monthly Touchpoints System (15-20 hours)

> **Source**: [v8-agency-pipeline.md](./v8-agency-pipeline.md) Stage 6: Active Client  
> **Design Reference**: [design-system-v6.md](/.planning/design/design-system-v6.md) sections 4, 7.1, 10.2

Once a client transitions to "active" status, the relationship requires systematic monthly maintenance. This part implements the automation layer that ensures no client is forgotten.

---

### 4.1 Schema Additions

**File**: `open-seo-main/src/db/monthly-touchpoints-schema.ts` (NEW)

```typescript
import { pgTable, uuid, text, timestamp, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { clients } from './client-schema';

// Monthly touchpoint status tracking
export const monthlyTouchpoints = pgTable('monthly_touchpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  
  // Month identifier (first of month)
  month: date('month').notNull(),
  
  // Report lifecycle
  reportGeneratedAt: timestamp('report_generated_at', { withTimezone: true }),
  reportSentAt: timestamp('report_sent_at', { withTimezone: true }),
  reportId: uuid('report_id'),  // FK to generated report
  
  // Strategy call lifecycle
  callScheduledAt: timestamp('call_scheduled_at', { withTimezone: true }),
  callScheduledFor: timestamp('call_scheduled_for', { withTimezone: true }),
  callCompletedAt: timestamp('call_completed_at', { withTimezone: true }),
  callNotes: text('call_notes'),
  
  // Priorities confirmation
  prioritiesConfirmedAt: timestamp('priorities_confirmed_at', { withTimezone: true }),
  nextMonthPriorities: jsonb('next_month_priorities').$type<string[]>(),
  
  // Workspace scoping
  workspaceId: text('workspace_id').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('ix_monthly_touchpoints_client').on(table.clientId),
  index('ix_monthly_touchpoints_month').on(table.month),
  uniqueIndex('ix_monthly_touchpoints_client_month').on(table.clientId, table.month),
  index('ix_monthly_touchpoints_workspace').on(table.workspaceId),
]);

// Type exports
export type MonthlyTouchpoint = typeof monthlyTouchpoints.$inferSelect;
export type MonthlyTouchpointInsert = typeof monthlyTouchpoints.$inferInsert;
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.1.1 | Create monthly-touchpoints-schema.ts | `open-seo-main/src/db/monthly-touchpoints-schema.ts` | None | 1h |
| 4.1.2 | Add export to schema.ts barrel | `open-seo-main/src/db/schema.ts` | 4.1.1 | 5m |
| 4.1.3 | Create migration for monthly_touchpoints | `open-seo-main/drizzle/` | 4.1.1 | 30m |
| 4.1.4 | Run migration, verify table | CI/local | 4.1.3 | 15m |

---

### 4.2 Services

**Location**: `open-seo-main/src/server/features/touchpoints/`

#### MonthlyReportGenerator

**File**: `open-seo-main/src/server/features/touchpoints/report-generator.ts` (NEW)

```typescript
export interface MonthlyReportData {
  clientId: string;
  month: Date;
  rankings: {
    improved: number;
    declined: number;
    newTop10: number;
    trend: 'up' | 'stable' | 'down';
  };
  traffic: {
    sessions: number;
    changePercent: number;
    topPages: Array<{ path: string; views: number }>;
  };
  content: {
    articlesPublished: number;
    totalWords: number;
  };
  audit: {
    currentScore: number;
    previousScore: number;
    issuesFixed: number;
    newIssues: number;
  };
  highlights: string[];  // AI-generated summary points
}

export class MonthlyReportGenerator {
  // Generate report for a single client
  async generateForClient(clientId: string, month?: Date): Promise<MonthlyReportData>;
  
  // Batch generate reports for all active clients
  async generateForAllActive(workspaceId: string): Promise<Map<string, MonthlyReportData>>;
  
  // Get report data sources
  private async getRankingData(clientId: string, month: Date): Promise<MonthlyReportData['rankings']>;
  private async getTrafficData(clientId: string, month: Date): Promise<MonthlyReportData['traffic']>;
  private async getContentData(clientId: string, month: Date): Promise<MonthlyReportData['content']>;
  private async getAuditData(clientId: string, month: Date): Promise<MonthlyReportData['audit']>;
  
  // Generate AI highlights
  private async generateHighlights(data: Omit<MonthlyReportData, 'highlights'>): Promise<string[]>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.2.1 | Create MonthlyReportGenerator class | `open-seo-main/src/server/features/touchpoints/report-generator.ts` | 4.1.1 | 3h |
| 4.2.2 | Add ranking data collector | Same file | 4.2.1 | 1h |
| 4.2.3 | Add traffic data collector (GSC/GA4) | Same file | 4.2.1 | 1.5h |
| 4.2.4 | Add content data collector | Same file | 4.2.1 | 45m |
| 4.2.5 | Add audit data collector | Same file | 4.2.1 | 45m |
| 4.2.6 | Add AI highlights generator | Same file | 4.2.1 | 1h |
| 4.2.7 | Unit tests | `open-seo-main/src/server/features/touchpoints/report-generator.test.ts` | 4.2.1-6 | 2h |

#### ReportEmailService

**File**: `open-seo-main/src/server/features/touchpoints/report-email-service.ts` (NEW)

```typescript
export interface ReportEmailOptions {
  clientId: string;
  reportData: MonthlyReportData;
  recipientEmail: string;
  recipientName: string;
  attachPdf: boolean;
}

export class ReportEmailService {
  // Send report to client
  async sendReport(options: ReportEmailOptions): Promise<{ sent: boolean; messageId?: string }>;
  
  // Generate PDF attachment
  private async generatePdfAttachment(data: MonthlyReportData): Promise<Buffer>;
  
  // Uses Loops transactional email template
  private async sendViaLoops(
    templateId: string,
    recipientEmail: string,
    variables: Record<string, unknown>,
    attachments?: Array<{ filename: string; content: Buffer }>
  ): Promise<string>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.2.8 | Create ReportEmailService | `open-seo-main/src/server/features/touchpoints/report-email-service.ts` | 4.2.1 | 2h |
| 4.2.9 | Add PDF generation for report | Same file | 4.2.8 | 2h |
| 4.2.10 | Integrate with Loops transactional API | Same file | 4.2.8 | 1.5h |
| 4.2.11 | Unit tests | `open-seo-main/src/server/features/touchpoints/report-email-service.test.ts` | 4.2.8-10 | 1.5h |

#### StrategyCallScheduler (Optional V2)

**File**: `open-seo-main/src/server/features/touchpoints/call-scheduler.ts` (NEW)

```typescript
// V1: Manual scheduling with reminder
// V2: Integration with Google/Outlook calendar

export class StrategyCallScheduler {
  // V1: Mark call as scheduled (manual entry)
  async markScheduled(touchpointId: string, scheduledFor: Date): Promise<void>;
  
  // V1: Mark call as completed with notes
  async markCompleted(touchpointId: string, notes: string): Promise<void>;
  
  // V2 (future): Create calendar event
  // async createCalendarEvent(clientId: string, scheduledFor: Date): Promise<string>;
}
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.2.12 | Create StrategyCallScheduler (V1 manual) | `open-seo-main/src/server/features/touchpoints/call-scheduler.ts` | 4.1.1 | 1h |
| 4.2.13 | Unit tests | `open-seo-main/src/server/features/touchpoints/call-scheduler.test.ts` | 4.2.12 | 45m |

---

### 4.3 Background Jobs (BullMQ)

**Location**: `open-seo-main/src/server/jobs/`

#### monthly-report-generation

**File**: `open-seo-main/src/server/jobs/monthly-report-generation.ts` (NEW)

```typescript
import { Queue, Worker } from 'bullmq';

export const monthlyReportQueue = new Queue('monthly-report-generation', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,  // 5s, 25s, 125s
    },
  },
});

// Job: Generate reports for all active clients
// Schedule: 1st of month, 6am UTC
export interface GenerateReportsJob {
  workspaceId: string;
  month: string;  // ISO date string (first of month)
}

export const monthlyReportWorker = new Worker('monthly-report-generation', async (job) => {
  const { workspaceId, month } = job.data as GenerateReportsJob;
  
  const generator = new MonthlyReportGenerator();
  const results = await generator.generateForAllActive(workspaceId);
  
  // Store report data and create touchpoint records
  for (const [clientId, reportData] of results) {
    await createTouchpointRecord(clientId, month, reportData);
  }
  
  return { generatedCount: results.size };
});

// Cron schedule: 0 6 1 * * (1st of month, 6am)
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.3.1 | Create monthly-report-generation job | `open-seo-main/src/server/jobs/monthly-report-generation.ts` | 4.2.1 | 2h |
| 4.3.2 | Add cron schedule configuration | Same file | 4.3.1 | 30m |
| 4.3.3 | Integration tests | `open-seo-main/src/server/jobs/monthly-report-generation.test.ts` | 4.3.1-2 | 1.5h |

#### monthly-report-delivery

**File**: `open-seo-main/src/server/jobs/monthly-report-delivery.ts` (NEW)

```typescript
export const monthlyDeliveryQueue = new Queue('monthly-report-delivery', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,  // 10s, 100s, 1000s
    },
  },
});

// Job: Send reports to clients
// Schedule: 4th of month, 9am UTC (3 days after generation for review)
// Condition: Only if report_sent_at is null
export interface DeliverReportsJob {
  workspaceId: string;
  month: string;
}

export const monthlyDeliveryWorker = new Worker('monthly-report-delivery', async (job) => {
  const { workspaceId, month } = job.data as DeliverReportsJob;
  
  // Get touchpoints where report generated but not sent
  const pendingDeliveries = await getPendingDeliveries(workspaceId, month);
  
  const emailService = new ReportEmailService();
  let sentCount = 0;
  
  for (const touchpoint of pendingDeliveries) {
    const result = await emailService.sendReport({
      clientId: touchpoint.clientId,
      reportData: touchpoint.reportData,
      recipientEmail: touchpoint.client.contactEmail,
      recipientName: touchpoint.client.contactName,
      attachPdf: true,
    });
    
    if (result.sent) {
      await markReportSent(touchpoint.id);
      sentCount++;
    }
  }
  
  return { sentCount };
});

// Cron schedule: 0 9 4 * * (4th of month, 9am)
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.3.4 | Create monthly-report-delivery job | `open-seo-main/src/server/jobs/monthly-report-delivery.ts` | 4.2.8 | 2h |
| 4.3.5 | Add pending delivery query | Same file | 4.3.4 | 30m |
| 4.3.6 | Add cron schedule configuration | Same file | 4.3.4 | 30m |
| 4.3.7 | Integration tests | `open-seo-main/src/server/jobs/monthly-report-delivery.test.ts` | 4.3.4-6 | 1.5h |

---

### 4.4 UI Components

**Location**: `apps/web/src/app/(shell)/dashboard/agency/components/`

#### MonthlyTouchpointsCard

Shows this month's touchpoint completion status on the agency dashboard.

**Design Reference**: [design-system-v6.md](/.planning/design/design-system-v6.md) section 4 (Card Primitive), section 7.1 (Progress)

```
┌──────────────────────────────────────────────────────────────────┐
│ MONTHLY TOUCHPOINTS                              April 2026      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░ 75%          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ Reports Generated (12/12)           Apr 1, 6:02am            │
│  ○ Reports Sent (8/12)                 4 pending review          │
│  ○ Strategy Calls (6/12)               3 scheduled, 3 needed     │
│  ○ Priorities Confirmed (4/12)         8 pending                 │
│                                                                  │
│  [View All Touchpoints]  [Generate Missing Reports]              │
└──────────────────────────────────────────────────────────────────┘
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.4.1 | Create MonthlyTouchpointsCard component | `apps/web/src/app/(shell)/dashboard/agency/components/MonthlyTouchpointsCard.tsx` | 4.1.1 | 2h |
| 4.4.2 | Add touchpoint status aggregation query | `apps/web/src/actions/touchpoints.ts` | 4.4.1 | 1h |

#### ClientReportHistory

Shows past 12 months of reports per client.

**Location**: `apps/web/src/app/(shell)/clients/[clientId]/reports/`

```
┌──────────────────────────────────────────────────────────────────┐
│ MONTHLY REPORTS                                    Acme Corp     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ April 2026                                                │   │
│  │ Generated: Apr 1  |  Sent: Apr 4  |  Call: Apr 8 ✓       │   │
│  │ Rankings: ↑12  |  Traffic: +8.5%  |  Score: 87           │   │
│  │                           [Download PDF] [Resend Email]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ March 2026                                                │   │
│  │ Generated: Mar 1  |  Sent: Mar 4  |  Call: Mar 12 ✓      │   │
│  │ Rankings: ↑8   |  Traffic: +5.2%  |  Score: 84           │   │
│  │                           [Download PDF] [Resend Email]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Load More]                                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.4.3 | Create ClientReportHistory page | `apps/web/src/app/(shell)/clients/[clientId]/reports/page.tsx` | 4.1.1 | 2h |
| 4.4.4 | Create ReportHistoryCard component | `apps/web/src/app/(shell)/clients/[clientId]/reports/components/ReportHistoryCard.tsx` | 4.4.3 | 1.5h |
| 4.4.5 | Add download/resend actions | `apps/web/src/actions/reports.ts` | 4.4.3 | 1.5h |
| 4.4.6 | Add report history query | Same file | 4.4.5 | 1h |

#### TouchpointChecklist (Inline in Client Detail)

Quick touchpoint checklist in client detail sidebar.

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.4.7 | Create TouchpointChecklist component | `apps/web/src/app/(shell)/clients/[clientId]/components/TouchpointChecklist.tsx` | 4.1.1 | 1.5h |
| 4.4.8 | Add to client detail layout | `apps/web/src/app/(shell)/clients/[clientId]/layout.tsx` | 4.4.7 | 30m |

---

### 4.5 API Endpoints

**Location**: `open-seo-main/src/routes/api/touchpoints/`

```
touchpoints/
  index.ts           # GET /api/touchpoints - List touchpoints (with filters)
  [id].ts            # GET/PATCH /api/touchpoints/:id - Get/update touchpoint
  generate.ts        # POST /api/touchpoints/generate - Manual report generation
  send.ts            # POST /api/touchpoints/:id/send - Manual report send
  summary.ts         # GET /api/touchpoints/summary - Aggregated status for dashboard
```

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 4.5.1 | Create touchpoints list endpoint | `open-seo-main/src/routes/api/touchpoints/index.ts` | 4.1.1 | 1.5h |
| 4.5.2 | Create touchpoint detail endpoint | `open-seo-main/src/routes/api/touchpoints/[id].ts` | 4.5.1 | 1h |
| 4.5.3 | Create manual generation endpoint | `open-seo-main/src/routes/api/touchpoints/generate.ts` | 4.2.1 | 1.5h |
| 4.5.4 | Create manual send endpoint | `open-seo-main/src/routes/api/touchpoints/send.ts` | 4.2.8 | 1h |
| 4.5.5 | Create summary endpoint | `open-seo-main/src/routes/api/touchpoints/summary.ts` | 4.5.1 | 1h |
| 4.5.6 | Integration tests | `open-seo-main/src/routes/api/touchpoints/*.test.ts` | 4.5.1-5 | 2h |

---

### 4.6 Success Criteria

- [ ] Reports generate automatically on 1st of month (6am UTC)
- [ ] Reports send automatically on 4th of month (9am UTC)
- [ ] Agency dashboard shows touchpoint completion across all clients
- [ ] Can manually trigger report generation for any client
- [ ] Can manually send/resend reports
- [ ] Report history accessible per client (past 12 months)
- [ ] PDF download available for all generated reports
- [ ] Strategy call can be marked scheduled/completed with notes
- [ ] Churn signals integrate with touchpoint status (Part 3)

---

### 4.7 Task Summary

| Section | Total Tasks | Total Estimate |
|---------|-------------|----------------|
| 4.1 Schema | 4 | 1.75h |
| 4.2 Services | 13 | 17.75h |
| 4.3 Background Jobs | 7 | 8.5h |
| 4.4 UI Components | 8 | 11h |
| 4.5 API Endpoints | 6 | 8h |
| **Total** | **38** | **47h** |

---

### 4.8 Integration with Existing Parts

| Part | Integration Point |
|------|-------------------|
| Part 1 (Onboarding) | When onboarding completes, first touchpoint record is created for current month |
| Part 2 (Agency Dashboard) | MonthlyTouchpointsCard displays in dashboard, touchpoint tasks appear in TodayFeed |
| Part 3 (Retention Signals) | Missed touchpoints trigger churn signals; touchpoint completion improves health score |

---

## Part 5: Shared Components (Reuse from Earlier Phases)

### 5.1 Components Already Built

| Component | Location | Reused In Phase 4 |
|-----------|----------|-------------------|
| OAuth connection flow | `apps/web/src/app/connect/[token]/` | Onboarding OAuth items |
| Invite magic link | `apps/web/src/lib/clientOAuth.ts` | Onboarding resend |
| Proposal schema | `open-seo-main/src/db/proposal-schema.ts` | Pipeline stages |
| Client schema | `open-seo-main/src/db/client-schema.ts` | Onboarding checklist FK |
| Prospect schema | `open-seo-main/src/db/prospect-schema.ts` | Conversion source |
| Webhook infrastructure | `open-seo-main/src/db/webhook-schema.ts` | OAuth events |

### 5.2 New Shared Components to Create

| Component | Purpose | Used By |
|-----------|---------|---------|
| ProgressBar | Generic progress indicator | Onboarding, Pipeline stages |
| StatusPill | Status badge (design-system-v6 section 6.1) | All cards |
| TimeAgo | Relative timestamp | Today feed, activity logs |
| MrrDisplay | Format MRR values | Dashboard, cards |

**Tasks**:
| ID | Task | File | Dependencies | Estimate |
|----|------|------|--------------|----------|
| 5.2.1 | Create ProgressBar component | `apps/web/src/components/ui/progress-bar.tsx` | None | 1h |
| 5.2.2 | Create StatusPill component | `apps/web/src/components/ui/status-pill.tsx` | None | 1h |
| 5.2.3 | Create TimeAgo component | `apps/web/src/components/ui/time-ago.tsx` | None | 1h |
| 5.2.4 | Create MrrDisplay component | `apps/web/src/components/ui/mrr-display.tsx` | None | 45m |

---

## Success Criteria

### Onboarding System

- [ ] Checklist auto-created when payment received
- [ ] Checklist items auto-complete on OAuth connection
- [ ] Prospect data (keywords, competitors) migrates to client
- [ ] Client status transitions from 'onboarding' to 'active' when checklist complete
- [ ] Agency can manually check off items
- [ ] Magic link can be resent for OAuth items
- [ ] Progress percentage updates in real-time

### Agency Dashboard

- [ ] Pipeline kanban shows all stages with counts and MRR
- [ ] Today's tasks shows scheduled calls, follow-ups, overdue items
- [ ] MRR calculation is accurate
- [ ] Retention percentage is calculated correctly
- [ ] Clients at risk are flagged with specific signals
- [ ] Upcoming renewals are visible
- [ ] Activity feed shows recent pipeline events

### Performance

- [ ] Dashboard loads in < 2s
- [ ] Checklist mutations < 500ms
- [ ] Activity feed pagination works smoothly

### Design Compliance

- [ ] Progress bar follows design-system-v6 section 7.1
- [ ] Today feed follows design-system-v6 section 10.2
- [ ] Cards use ghost-edge shadows (section 2.9)
- [ ] No solid borders on cards
- [ ] 12px minimum text size

---

## Task Summary

| Part | Total Tasks | Total Estimate |
|------|-------------|----------------|
| 1. Onboarding Engine | 28 | 48.5h |
| 2. Agency Dashboard | 26 | 52h |
| 3. Retention Signals | 11 | 21h |
| 4. Monthly Touchpoints | 38 | 47h |
| 5. Shared Components | 4 | 3.75h |
| **Total** | **107** | **172.25h** |

---

## Sprint Allocation

**Sprint 1 (Week 1-2)**: Parts 1.1-1.4 (Schema + Templates + Services + Conversion)
**Sprint 2 (Week 3-4)**: Parts 1.5-1.7 (Webhooks + UI)
**Sprint 3 (Week 5-6)**: Parts 2.1-2.5 (Dashboard Backend)
**Sprint 4 (Week 7-8)**: Parts 2.6-2.7 + Part 3 (Dashboard UI + Retention)
**Sprint 5 (Week 9-10)**: Part 4 (Monthly Touchpoints System)
**Sprint 6 (Week 11)**: Part 5 + Polish + E2E Testing

---

## Dependencies Graph

```
1.1.1 (onboarding schema)
  └─> 1.2.1 (templates) ─> 1.3.1 (service) ─> 1.4.1 (conversion)
                                               │
1.5.1 (Stripe webhook) <─────────────────────┘
  └─> 1.5.2 (email) ─> 1.6.1-4 (OAuth hooks)
                           │
1.7.1-8 (Onboarding UI) <──┘

2.1.1 (activities schema)
  └─> 2.2.1 (activity service) ─> 2.5.2 (API)
                                      │
2.3.1 (metrics service) ─> 2.5.3 (API)─┤
                                       │
2.4.1 (tasks service) ─> 2.5.4 (API)───┤
                                       │
2.6.1-12 (Dashboard UI) <──────────────┘

3.1.1 (health scoring) ─> 3.2.1 (churn) ─> 3.3.1 (renewal)
                                               │
2.6.9 (RetentionAlerts) <──────────────────────┘

4.1.1 (touchpoints schema)
  └─> 4.2.1 (report generator) ─> 4.2.8 (email service)
                                        │
      4.3.1 (generation job) <──────────┤
      4.3.4 (delivery job) <────────────┘
                │
      4.4.1 (MonthlyTouchpointsCard) <── 2.6.1 (Dashboard)
                │
      4.5.1-6 (API endpoints) <─────────┘
                │
      4.4.3 (ClientReportHistory) <─────┘

Integration points:
- 1.7 (Onboarding complete) ─> 4.1 (Create first touchpoint)
- 2.6 (Dashboard) ─> 4.4.1 (MonthlyTouchpointsCard)
- 3.2 (Churn detection) ─> 4.x (Missed touchpoints as signal)
```

---

*Last updated: 2026-04-30*

---

## Schema Governance Note

> This plan depends on database tables defined in **Phase 45 (Data Foundation)**.
> 
> | Table | Source of Truth | This Phase Provides |
> |-------|-----------------|---------------------|
> | `onboarding_checklists` | Phase 45 Task 1.2.3 | Service logic, templates, UI |
> | `pipeline_activities` | Phase 45 Task 1.2.4 | Activity logging service, UI |
> 
> **Any schema modifications require updating Phase 45 first.**
