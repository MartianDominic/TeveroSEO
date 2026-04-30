# Phase 62: Agency Command Center & Pipeline Intelligence

**Created:** 2026-04-30
**Status:** Design Complete
**Milestone:** v7.0 Onboarding Excellence
**Dependencies:** Phase 56 (i18n Foundation), Phase 57 (Proposal Editor), Phase 59 (Agreement Excellence)
**Estimated Effort:** 70-85 hours across 8 plans (3 waves)

---

## Executive Summary

The Agency Command Center is the unified operations hub for SEO agencies, consolidating prospects, proposals, agreements, payments, and engagement workflows into a single actionable dashboard. It combines real-time pipeline visibility with intelligent automation to ensure no deal falls through the cracks.

**Core Capabilities:**
1. **Pipeline Intelligence** - Real-time visibility into all prospect/client stages
2. **Engagement Workflow Engine** - Automated follow-ups with anti-annoyance safeguards
3. **Smart Alerts** - AI-detected anomalies and at-risk deals
4. **Quick Actions** - One-click operations from anywhere in the dashboard
5. **Win/Loss Analytics** - Data-driven insights on pipeline health

---

## 1. Architecture Overview

### 1.1 System Components

```
+------------------+     +------------------+     +------------------+
|   Command Center |     |   Engagement     |     |   Alert          |
|   Dashboard      |<--->|   Workflow       |<--->|   Detection      |
|   (Next.js)      |     |   Engine         |     |   Worker         |
+------------------+     +------------------+     +------------------+
         |                       |                       |
         v                       v                       v
+------------------+     +------------------+     +------------------+
|   Pipeline       |     |   BullMQ         |     |   WebSocket      |
|   Metrics        |     |   Job Queue      |     |   Server         |
|   (PostgreSQL)   |     |   (Redis)        |     |   (Socket.IO)    |
+------------------+     +------------------+     +------------------+
```

### 1.2 Data Flow

```
Entity Changes → Webhooks/Triggers → Event Bus
                                         ↓
                    +--------------------+--------------------+
                    ↓                    ↓                    ↓
            Metrics Worker      Workflow Engine       Alert Worker
                    ↓                    ↓                    ↓
            pipeline_metrics    workflow_instances    smart_alerts
                    ↓                    ↓                    ↓
                    +--------------------+--------------------+
                                         ↓
                              Command Center Dashboard
                                         ↓
                              Real-time via Socket.IO
```

---

## 2. Database Schema

### 2.1 Follow-up System (Agent 1 Analysis)

```sql
-- Core follow-up tracking with polymorphic entity reference
CREATE TABLE follow_ups (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Polymorphic entity reference
  entity_type TEXT NOT NULL CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')),
  entity_id TEXT NOT NULL,
  
  -- Follow-up details
  follow_up_type TEXT NOT NULL CHECK (follow_up_type IN (
    'reminder', 'check_in', 'escalation', 'deadline', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  snoozed_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'snoozed', 'completed', 'cancelled', 'auto_resolved'
  )),
  
  -- Assignment
  assigned_to TEXT REFERENCES "user"(id),
  created_by TEXT NOT NULL REFERENCES "user"(id),
  
  -- Priority
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Automation
  is_automated BOOLEAN DEFAULT FALSE,
  rule_id TEXT REFERENCES follow_up_rules(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_workspace_status ON follow_ups(workspace_id, status);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(workspace_id, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_follow_ups_entity ON follow_ups(entity_type, entity_id);
CREATE INDEX idx_follow_ups_assigned ON follow_ups(assigned_to, status);

-- Configurable follow-up rules
CREATE TABLE follow_up_rules (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Rule definition
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,
  
  -- Trigger conditions (JSONB for flexibility)
  trigger_conditions JSONB NOT NULL,
  -- Example: {"status_changed_to": "sent", "days_since": 3}
  -- Example: {"status_equals": "overdue", "days_overdue_gte": 7}
  
  -- Action configuration
  action_type TEXT NOT NULL CHECK (action_type IN (
    'create_follow_up', 'send_notification', 'escalate', 'auto_reminder'
  )),
  action_config JSONB NOT NULL,
  -- Example: {"follow_up_type": "reminder", "priority": "high", "assign_to": "owner"}
  
  -- Timing
  delay_hours INTEGER DEFAULT 0,
  repeat_interval_hours INTEGER,
  max_repeats INTEGER DEFAULT 1,
  
  -- State
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_up_rules_workspace ON follow_up_rules(workspace_id, is_active);
CREATE INDEX idx_follow_up_rules_entity ON follow_up_rules(entity_type, is_active);
```

### 2.2 Engagement Workflow Engine (Agent 2 Analysis)

```sql
-- Workflow templates define reusable engagement sequences
CREATE TABLE workflow_templates (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT REFERENCES organization(id) ON DELETE CASCADE, -- NULL = system template
  
  -- Template definition
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('prospect', 'proposal', 'contract', 'invoice', 'client')),
  trigger_event TEXT NOT NULL,
  -- Examples: 'proposal_sent', 'contract_awaiting_signature', 'invoice_overdue', 'prospect_qualified'
  
  -- Anti-annoyance safeguards
  max_touches_per_week INTEGER DEFAULT 3,
  cooldown_hours INTEGER DEFAULT 48,
  skip_on_response BOOLEAN DEFAULT TRUE,
  pause_on_negative_signal BOOLEAN DEFAULT TRUE,
  
  -- Configuration
  steps JSONB NOT NULL,
  -- Array of step definitions (see WorkflowStep interface)
  
  -- State
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- System templates can't be deleted
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_workspace ON workflow_templates(workspace_id, is_active);
CREATE INDEX idx_workflow_templates_trigger ON workflow_templates(entity_type, trigger_event, is_active);

-- Workflow instances track active engagements
CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id),
  
  -- Target entity
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  
  -- State machine
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending', 'active', 'paused', 'snoozed', 'completed', 'cancelled', 'won', 'lost'
  )),
  current_step INTEGER NOT NULL DEFAULT 0,
  
  -- Snooze support ("follow up on May 27th")
  snoozed_until TIMESTAMPTZ,
  snooze_reason TEXT,
  
  -- Tracking
  touches_this_week INTEGER DEFAULT 0,
  last_touch_at TIMESTAMPTZ,
  last_response_at TIMESTAMPTZ,
  
  -- Outcome
  completed_at TIMESTAMPTZ,
  outcome_reason TEXT,
  
  -- Metadata
  context JSONB DEFAULT '{}', -- Dynamic context for step personalization
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_instances_workspace_status ON workflow_instances(workspace_id, status);
CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);
CREATE INDEX idx_workflow_instances_snoozed ON workflow_instances(snoozed_until) WHERE status = 'snoozed';
CREATE INDEX idx_workflow_instances_next ON workflow_instances(workspace_id) WHERE status = 'active';

-- Workflow execution log
CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'started', 'step_executed', 'step_skipped', 'paused', 'resumed', 
    'snoozed', 'unsnoozed', 'response_detected', 'completed', 'cancelled', 'error'
  )),
  step_index INTEGER,
  
  -- Execution details
  action_taken TEXT,
  result JSONB,
  error_message TEXT,
  
  -- Metadata
  triggered_by TEXT, -- 'system', 'user:{id}', 'webhook'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_events_instance ON workflow_events(instance_id, created_at DESC);
```

### 2.3 Lost Deal Analysis (Agent 1 Analysis)

```sql
-- Loss reason taxonomy
CREATE TYPE loss_reason AS ENUM (
  -- Pricing
  'too_expensive', 'budget_cut', 'competitor_cheaper',
  -- Timing
  'bad_timing', 'project_delayed', 'internal_changes',
  -- Fit
  'wrong_fit', 'scope_mismatch', 'different_direction',
  -- Competition
  'chose_competitor', 'went_internal', 'found_alternative',
  -- Process
  'unresponsive', 'ghosted', 'decision_maker_left',
  -- Other
  'unknown', 'other'
);

-- Track deal outcomes for analysis
CREATE TABLE deal_outcomes (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Source entity
  entity_type TEXT NOT NULL CHECK (entity_type IN ('prospect', 'proposal')),
  entity_id TEXT NOT NULL,
  
  -- Outcome
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost')),
  loss_reason loss_reason,
  loss_reason_detail TEXT, -- Free-form additional context
  competitor_name TEXT, -- If lost to competitor
  
  -- Value tracking
  deal_value_cents INTEGER,
  currency TEXT DEFAULT 'EUR',
  
  -- Timeline
  first_contact_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  outcome_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cycle_days INTEGER, -- Computed: outcome_at - first_contact_at
  
  -- Attributed to
  owner_id TEXT REFERENCES "user"(id),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deal_outcomes_workspace ON deal_outcomes(workspace_id, outcome);
CREATE INDEX idx_deal_outcomes_date ON deal_outcomes(workspace_id, outcome_at DESC);
CREATE INDEX idx_deal_outcomes_reason ON deal_outcomes(workspace_id, loss_reason) WHERE outcome = 'lost';
```

### 2.4 Pipeline Metrics (Agent 3 Analysis)

```sql
-- Pre-computed pipeline metrics (refreshed every 5 minutes)
CREATE TABLE pipeline_metrics (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Prospect counts
  prospects_new INTEGER DEFAULT 0,
  prospects_analyzing INTEGER DEFAULT 0,
  prospects_scored INTEGER DEFAULT 0,
  prospects_qualified INTEGER DEFAULT 0,
  prospects_contacted INTEGER DEFAULT 0,
  prospects_negotiating INTEGER DEFAULT 0,
  prospects_converted_30d INTEGER DEFAULT 0,
  prospects_archived_30d INTEGER DEFAULT 0,
  
  -- Proposal counts
  proposals_draft INTEGER DEFAULT 0,
  proposals_sent INTEGER DEFAULT 0,
  proposals_viewed INTEGER DEFAULT 0,
  proposals_accepted INTEGER DEFAULT 0,
  proposals_declined_30d INTEGER DEFAULT 0,
  proposals_expired_30d INTEGER DEFAULT 0,
  
  -- Contract counts
  contracts_draft INTEGER DEFAULT 0,
  contracts_sent INTEGER DEFAULT 0,
  contracts_pending_signature INTEGER DEFAULT 0,
  contracts_signed INTEGER DEFAULT 0,
  contracts_executed INTEGER DEFAULT 0,
  contracts_expiring_7d INTEGER DEFAULT 0,
  
  -- Invoice counts
  invoices_draft INTEGER DEFAULT 0,
  invoices_sent INTEGER DEFAULT 0,
  invoices_paid_30d INTEGER DEFAULT 0,
  invoices_overdue INTEGER DEFAULT 0,
  
  -- Financial (cents)
  pipeline_value_draft_cents INTEGER DEFAULT 0,
  pipeline_value_sent_cents INTEGER DEFAULT 0,
  pipeline_value_signed_cents INTEGER DEFAULT 0,
  revenue_this_month_cents INTEGER DEFAULT 0,
  revenue_last_month_cents INTEGER DEFAULT 0,
  outstanding_cents INTEGER DEFAULT 0,
  overdue_amount_cents INTEGER DEFAULT 0,
  
  -- Conversion rates (percentage * 100 for precision)
  win_rate_pct INTEGER DEFAULT 0,
  prospect_to_qualified_pct INTEGER DEFAULT 0,
  qualified_to_proposal_pct INTEGER DEFAULT 0,
  proposal_to_signed_pct INTEGER DEFAULT 0,
  
  -- Cycle times (days)
  avg_cycle_days INTEGER DEFAULT 0,
  avg_collection_days INTEGER DEFAULT 0,
  
  -- Currency
  currency TEXT DEFAULT 'EUR',
  
  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computation_duration_ms INTEGER,
  
  UNIQUE(workspace_id)
);

CREATE INDEX idx_pipeline_metrics_workspace ON pipeline_metrics(workspace_id);

-- Smart alerts table
CREATE TABLE smart_alerts (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Alert definition
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Related entity (optional)
  entity_type TEXT,
  entity_id TEXT,
  
  -- Metrics comparison
  metric_current NUMERIC,
  metric_previous NUMERIC,
  metric_unit TEXT,
  
  -- Action guidance
  suggested_action TEXT,
  action_url TEXT,
  
  -- State
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_by TEXT REFERENCES "user"(id),
  dismissed_at TIMESTAMPTZ,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-resolve after this time
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_smart_alerts_workspace ON smart_alerts(workspace_id, is_dismissed);
CREATE INDEX idx_smart_alerts_active ON smart_alerts(workspace_id) WHERE is_dismissed = FALSE AND resolved_at IS NULL;
CREATE INDEX idx_smart_alerts_type ON smart_alerts(workspace_id, alert_type);
```

### 2.5 Dashboard Views & Preferences

```sql
-- Saved dashboard views
CREATE TABLE dashboard_views (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES "user"(id), -- NULL = shared workspace view
  
  -- View definition
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  
  -- Filters
  filters JSONB DEFAULT '{}',
  -- { dateRange, teamMembers, entityTypes, priorities }
  
  -- Layout
  layout JSONB DEFAULT '{}',
  -- { cardOrder, collapsedWidgets }
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_views_workspace ON dashboard_views(workspace_id);
CREATE INDEX idx_dashboard_views_user ON dashboard_views(user_id);

-- User notification preferences
CREATE TABLE notification_preferences (
  id TEXT PRIMARY KEY DEFAULT nanoid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  
  -- Channels
  email_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  slack_enabled BOOLEAN DEFAULT FALSE,
  slack_channel TEXT,
  
  -- Event types
  notify_overdue_invoice BOOLEAN DEFAULT TRUE,
  notify_contract_expiring BOOLEAN DEFAULT TRUE,
  notify_proposal_viewed BOOLEAN DEFAULT TRUE,
  notify_contract_signed BOOLEAN DEFAULT TRUE,
  notify_payment_received BOOLEAN DEFAULT TRUE,
  notify_smart_alerts BOOLEAN DEFAULT TRUE,
  notify_follow_up_due BOOLEAN DEFAULT TRUE,
  
  -- Timing
  daily_digest_enabled BOOLEAN DEFAULT TRUE,
  daily_digest_hour INTEGER DEFAULT 9, -- 9 AM in user timezone
  
  -- Quiet hours
  quiet_hours_start INTEGER, -- Hour (0-23)
  quiet_hours_end INTEGER,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, workspace_id)
);
```

---

## 3. Engagement Workflow Engine (Agent 2 Synthesis)

### 3.1 Workflow Step Types

```typescript
interface WorkflowStep {
  index: number;
  type: 'wait' | 'email' | 'task' | 'condition' | 'webhook' | 'alert';
  config: WaitConfig | EmailConfig | TaskConfig | ConditionConfig | WebhookConfig | AlertConfig;
}

interface WaitConfig {
  duration: { value: number; unit: 'hours' | 'days' | 'weeks' };
  skipWeekends?: boolean;
  skipHolidays?: boolean;
}

interface EmailConfig {
  templateId: string;
  subject: string; // Supports {{variables}}
  bodyTemplate: string;
  replyTo?: string;
}

interface TaskConfig {
  title: string;
  description?: string;
  assignTo: 'owner' | 'user:{id}';
  dueIn: { value: number; unit: 'hours' | 'days' };
  priority: 'low' | 'medium' | 'high';
}

interface ConditionConfig {
  field: string; // e.g., 'proposal.status', 'last_response_days'
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
  onTrue: 'continue' | 'skip' | 'complete' | { goto: number };
  onFalse: 'continue' | 'skip' | 'complete' | { goto: number };
}

interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  bodyTemplate: string; // JSON template with {{variables}}
}

interface AlertConfig {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  notifyUsers: string[]; // user IDs or 'owner'
}
```

### 3.2 Default Workflow Templates

```typescript
const DEFAULT_WORKFLOWS: WorkflowTemplateInsert[] = [
  {
    name: 'Proposal Follow-up',
    description: 'Automated follow-up sequence for sent proposals',
    entityType: 'proposal',
    triggerEvent: 'proposal_sent',
    maxTouchesPerWeek: 2,
    cooldownHours: 48,
    skipOnResponse: true,
    steps: [
      { index: 0, type: 'wait', config: { duration: { value: 3, unit: 'days' } } },
      { index: 1, type: 'condition', config: {
        field: 'proposal.status',
        operator: 'equals',
        value: 'viewed',
        onTrue: { goto: 3 }, // Skip to "viewed" follow-up
        onFalse: 'continue'
      }},
      { index: 2, type: 'email', config: {
        templateId: 'proposal_followup_1',
        subject: 'Re: Proposal for {{client.name}}',
        bodyTemplate: 'Just checking in on the proposal I sent...'
      }},
      { index: 3, type: 'wait', config: { duration: { value: 4, unit: 'days' } } },
      { index: 4, type: 'email', config: {
        templateId: 'proposal_followup_2',
        subject: 'Following up on {{client.name}} proposal',
        bodyTemplate: 'I wanted to make sure you had a chance to review...'
      }},
      { index: 5, type: 'wait', config: { duration: { value: 7, unit: 'days' } } },
      { index: 6, type: 'alert', config: {
        severity: 'medium',
        title: 'Proposal needs attention',
        message: 'Proposal for {{client.name}} has no response after 14 days',
        notifyUsers: ['owner']
      }}
    ],
    isSystem: true
  },
  {
    name: 'Contract Signature Reminder',
    description: 'Follow-up sequence for contracts awaiting signature',
    entityType: 'contract',
    triggerEvent: 'contract_sent',
    maxTouchesPerWeek: 2,
    cooldownHours: 72,
    skipOnResponse: true,
    steps: [
      { index: 0, type: 'wait', config: { duration: { value: 2, unit: 'days' } } },
      { index: 1, type: 'email', config: {
        templateId: 'contract_reminder_1',
        subject: 'Agreement ready for your signature',
        bodyTemplate: 'Your agreement is ready to sign...'
      }},
      { index: 2, type: 'wait', config: { duration: { value: 5, unit: 'days' } } },
      { index: 3, type: 'task', config: {
        title: 'Call {{client.name}} about contract',
        description: 'Contract sent 7 days ago, no signature yet',
        assignTo: 'owner',
        dueIn: { value: 1, unit: 'days' },
        priority: 'high'
      }},
      { index: 4, type: 'wait', config: { duration: { value: 7, unit: 'days' } } },
      { index: 5, type: 'alert', config: {
        severity: 'high',
        title: 'Contract stalled',
        message: 'Contract for {{client.name}} unsigned after 14 days - consider lost?',
        notifyUsers: ['owner']
      }}
    ],
    isSystem: true
  },
  {
    name: 'Invoice Collection',
    description: 'Payment reminder sequence for sent invoices',
    entityType: 'invoice',
    triggerEvent: 'invoice_sent',
    maxTouchesPerWeek: 2,
    cooldownHours: 48,
    skipOnResponse: true,
    steps: [
      { index: 0, type: 'wait', config: { duration: { value: 7, unit: 'days' } } },
      { index: 1, type: 'condition', config: {
        field: 'invoice.status',
        operator: 'equals',
        value: 'paid',
        onTrue: 'complete',
        onFalse: 'continue'
      }},
      { index: 2, type: 'email', config: {
        templateId: 'payment_reminder_1',
        subject: 'Invoice #{{invoice.number}} payment reminder',
        bodyTemplate: 'Friendly reminder that invoice #{{invoice.number}} is due...'
      }},
      { index: 3, type: 'wait', config: { duration: { value: 7, unit: 'days' } } },
      { index: 4, type: 'condition', config: {
        field: 'invoice.status',
        operator: 'equals',
        value: 'overdue',
        onTrue: 'continue',
        onFalse: 'complete'
      }},
      { index: 5, type: 'email', config: {
        templateId: 'payment_reminder_2',
        subject: 'Overdue: Invoice #{{invoice.number}}',
        bodyTemplate: 'Your invoice is now overdue...'
      }},
      { index: 6, type: 'alert', config: {
        severity: 'high',
        title: 'Payment collection needed',
        message: 'Invoice #{{invoice.number}} is 14+ days overdue',
        notifyUsers: ['owner']
      }}
    ],
    isSystem: true
  }
];
```

### 3.3 Engagement Service Implementation

```typescript
// open-seo-main/src/server/features/command-center/services/EngagementService.ts

export class EngagementService {
  constructor(
    private readonly db: DrizzleClient,
    private readonly queue: Queue<WorkflowJobData>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Start a workflow instance for an entity
   */
  async startWorkflow(
    workspaceId: string,
    templateId: string,
    entityType: EntityType,
    entityId: string,
    context: Record<string, unknown> = {}
  ): Promise<WorkflowInstance> {
    // Check for existing active workflow
    const existing = await this.db.query.workflowInstances.findFirst({
      where: and(
        eq(workflowInstances.entityType, entityType),
        eq(workflowInstances.entityId, entityId),
        inArray(workflowInstances.status, ['pending', 'active', 'snoozed'])
      )
    });

    if (existing) {
      throw new Error(`Active workflow already exists for ${entityType}:${entityId}`);
    }

    const template = await this.db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, templateId)
    });

    if (!template) throw new Error(`Template ${templateId} not found`);

    const instance = await this.db.insert(workflowInstances).values({
      workspaceId,
      templateId,
      entityType,
      entityId,
      status: 'active',
      currentStep: 0,
      context
    }).returning();

    // Schedule first step
    await this.scheduleNextStep(instance[0]);

    // Log event
    await this.logEvent(instance[0].id, 'started', { templateId });

    return instance[0];
  }

  /**
   * Snooze a workflow ("follow up on May 27th")
   */
  async snoozeWorkflow(
    instanceId: string,
    snoozedUntil: Date,
    reason?: string
  ): Promise<void> {
    await this.db.update(workflowInstances)
      .set({
        status: 'snoozed',
        snoozedUntil,
        snoozeReason: reason,
        updatedAt: new Date()
      })
      .where(eq(workflowInstances.id, instanceId));

    // Schedule unsnooze job
    await this.queue.add('unsnooze-workflow', { instanceId }, {
      delay: snoozedUntil.getTime() - Date.now(),
      jobId: `unsnooze-${instanceId}`
    });

    await this.logEvent(instanceId, 'snoozed', { snoozedUntil, reason });
  }

  /**
   * Pause a workflow
   */
  async pauseWorkflow(instanceId: string): Promise<void> {
    await this.db.update(workflowInstances)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(workflowInstances.id, instanceId));

    await this.logEvent(instanceId, 'paused');
  }

  /**
   * Resume a paused/snoozed workflow
   */
  async resumeWorkflow(instanceId: string): Promise<void> {
    const instance = await this.db.query.workflowInstances.findFirst({
      where: eq(workflowInstances.id, instanceId)
    });

    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    await this.db.update(workflowInstances)
      .set({
        status: 'active',
        snoozedUntil: null,
        snoozeReason: null,
        updatedAt: new Date()
      })
      .where(eq(workflowInstances.id, instanceId));

    await this.scheduleNextStep(instance);
    await this.logEvent(instanceId, 'resumed');
  }

  /**
   * Mark workflow as won/lost
   */
  async completeWorkflow(
    instanceId: string,
    outcome: 'won' | 'lost' | 'completed' | 'cancelled',
    reason?: string
  ): Promise<void> {
    await this.db.update(workflowInstances)
      .set({
        status: outcome,
        completedAt: new Date(),
        outcomeReason: reason,
        updatedAt: new Date()
      })
      .where(eq(workflowInstances.id, instanceId));

    await this.logEvent(instanceId, 'completed', { outcome, reason });
  }

  /**
   * Handle response detection (email reply, proposal viewed, etc.)
   */
  async handleResponseDetected(
    entityType: EntityType,
    entityId: string,
    responseType: string
  ): Promise<void> {
    const instance = await this.db.query.workflowInstances.findFirst({
      where: and(
        eq(workflowInstances.entityType, entityType),
        eq(workflowInstances.entityId, entityId),
        eq(workflowInstances.status, 'active')
      ),
      with: { template: true }
    });

    if (!instance) return;

    // Update last response timestamp
    await this.db.update(workflowInstances)
      .set({ lastResponseAt: new Date(), updatedAt: new Date() })
      .where(eq(workflowInstances.id, instance.id));

    // If skipOnResponse is enabled, pause workflow
    if (instance.template.skipOnResponse) {
      await this.pauseWorkflow(instance.id);
      await this.logEvent(instance.id, 'response_detected', { responseType, action: 'paused' });
    } else {
      await this.logEvent(instance.id, 'response_detected', { responseType, action: 'continued' });
    }
  }

  /**
   * Anti-annoyance check before executing a touch
   */
  private async canExecuteTouch(instance: WorkflowInstanceSelect): Promise<boolean> {
    const template = await this.db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, instance.templateId)
    });

    if (!template) return false;

    // Check weekly touch limit
    if (instance.touchesThisWeek >= template.maxTouchesPerWeek) {
      return false;
    }

    // Check cooldown
    if (instance.lastTouchAt) {
      const hoursSinceLastTouch = (Date.now() - instance.lastTouchAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastTouch < template.cooldownHours) {
        return false;
      }
    }

    return true;
  }

  // ... additional private methods for step execution
}
```

---

## 4. Smart Alert Detection (Agent 3 Synthesis)

### 4.1 Alert Types and Detection Logic

```typescript
// open-seo-main/src/server/features/command-center/services/AlertDetectionService.ts

interface AlertRule {
  type: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectFn: (metrics: PipelineMetrics, workspace: Workspace) => SmartAlertInsert | null;
}

const ALERT_RULES: AlertRule[] = [
  {
    type: 'high_value_stuck',
    name: 'High-value deal stuck',
    severity: 'high',
    detectFn: async (metrics, workspace, db) => {
      // Find proposals > 5000 EUR with no update in 7+ days
      const stuckDeals = await db.query.proposals.findMany({
        where: and(
          eq(proposals.workspaceId, workspace.id),
          inArray(proposals.status, ['sent', 'viewed']),
          gte(proposals.totalValueCents, 500000), // 5000 EUR
          lte(proposals.updatedAt, subDays(new Date(), 7))
        )
      });

      if (stuckDeals.length === 0) return null;

      const topDeal = stuckDeals[0];
      return {
        workspaceId: workspace.id,
        alertType: 'high_value_stuck',
        severity: 'high',
        title: 'High-value deal stuck',
        description: `Proposal for ${topDeal.clientName} (${formatCurrency(topDeal.totalValueCents)}) has no activity in ${daysSince(topDeal.updatedAt)} days`,
        entityType: 'proposal',
        entityId: topDeal.id,
        metricCurrent: daysSince(topDeal.updatedAt),
        metricUnit: 'days',
        suggestedAction: 'Review and follow up',
        actionUrl: `/proposals/${topDeal.id}`
      };
    }
  },
  {
    type: 'win_rate_declining',
    name: 'Win rate declining',
    severity: 'medium',
    detectFn: (metrics) => {
      const current30d = metrics.winRatePct;
      const previous30d = metrics.winRatePreviousPct;
      
      if (!previous30d || current30d >= previous30d - 500) return null; // 5% threshold
      
      return {
        alertType: 'win_rate_declining',
        severity: 'medium',
        title: 'Win rate declining',
        description: `Win rate dropped from ${(previous30d / 100).toFixed(1)}% to ${(current30d / 100).toFixed(1)}% in the last 30 days`,
        metricCurrent: current30d / 100,
        metricPrevious: previous30d / 100,
        metricUnit: '%',
        suggestedAction: 'Review recent lost deals for patterns'
      };
    }
  },
  {
    type: 'unassigned_prospects',
    name: 'Unassigned prospects',
    severity: 'low',
    detectFn: async (metrics, workspace, db) => {
      const unassigned = await db.query.prospects.findMany({
        where: and(
          eq(prospects.workspaceId, workspace.id),
          isNull(prospects.assignedTo),
          gte(prospects.createdAt, subDays(new Date(), 2))
        )
      });

      if (unassigned.length < 3) return null;

      return {
        alertType: 'unassigned_prospects',
        severity: 'low',
        title: 'Unassigned prospects',
        description: `${unassigned.length} prospects without an owner`,
        metricCurrent: unassigned.length,
        metricUnit: 'prospects',
        suggestedAction: 'Assign team members to new prospects'
      };
    }
  },
  {
    type: 'collection_velocity_drop',
    name: 'Payment velocity drop',
    severity: 'medium',
    detectFn: (metrics) => {
      const current = metrics.avgCollectionDays;
      const historical = metrics.avgCollectionDaysHistorical;
      
      if (!historical || current <= historical + 5) return null;

      return {
        alertType: 'collection_velocity_drop',
        severity: 'medium',
        title: 'Payment velocity drop',
        description: `Average collection time increased from ${historical} to ${current} days`,
        metricCurrent: current,
        metricPrevious: historical,
        metricUnit: 'days',
        suggestedAction: 'Review overdue invoices and follow up'
      };
    }
  },
  {
    type: 'contract_expiring_soon',
    name: 'Contracts expiring soon',
    severity: 'high',
    detectFn: async (metrics, workspace, db) => {
      const expiring = await db.query.contracts.findMany({
        where: and(
          eq(contracts.workspaceId, workspace.id),
          eq(contracts.status, 'executed'),
          lte(contracts.expiresAt, addDays(new Date(), 14)),
          gte(contracts.expiresAt, new Date())
        )
      });

      if (expiring.length === 0) return null;

      return {
        alertType: 'contract_expiring_soon',
        severity: 'high',
        title: `${expiring.length} contract(s) expiring soon`,
        description: `${expiring.length} contracts will expire in the next 14 days`,
        metricCurrent: expiring.length,
        metricUnit: 'contracts',
        suggestedAction: 'Review and send renewal proposals'
      };
    }
  }
];
```

### 4.2 Alert Worker

```typescript
// open-seo-main/src/server/workers/alert-detection-worker.ts

export const alertDetectionWorker = new Worker<AlertJobData>(
  'alert-detection',
  async (job) => {
    const { workspaceId } = job.data;
    
    const [workspace, metrics] = await Promise.all([
      db.query.organizations.findFirst({ where: eq(organizations.id, workspaceId) }),
      db.query.pipelineMetrics.findFirst({ where: eq(pipelineMetrics.workspaceId, workspaceId) })
    ]);

    if (!workspace || !metrics) return;

    const alertService = new AlertDetectionService(db);
    
    for (const rule of ALERT_RULES) {
      try {
        const existingAlert = await db.query.smartAlerts.findFirst({
          where: and(
            eq(smartAlerts.workspaceId, workspaceId),
            eq(smartAlerts.alertType, rule.type),
            eq(smartAlerts.isDismissed, false),
            isNull(smartAlerts.resolvedAt)
          )
        });

        const newAlert = await rule.detectFn(metrics, workspace, db);

        if (newAlert && !existingAlert) {
          // Create new alert
          await db.insert(smartAlerts).values({
            ...newAlert,
            workspaceId
          });
          
          // Notify users
          await notificationService.sendAlertNotification(workspaceId, newAlert);
        } else if (!newAlert && existingAlert) {
          // Auto-resolve alert
          await db.update(smartAlerts)
            .set({ resolvedAt: new Date() })
            .where(eq(smartAlerts.id, existingAlert.id));
        }
      } catch (error) {
        console.error(`Alert rule ${rule.type} failed:`, error);
      }
    }
  },
  { connection: redisConnection }
);

// Schedule alert detection every 5 minutes per workspace
export const scheduleAlertDetection = async (workspaceId: string) => {
  await alertQueue.add('detect-alerts', { workspaceId }, {
    repeat: { every: 5 * 60 * 1000 }, // 5 minutes
    jobId: `alert-detection-${workspaceId}`
  });
};
```

---

## 5. Command Center Dashboard Components

### 5.1 Component Hierarchy

```
CommandCenterPage (Server Component)
├── TodayActionBar (Server + Client hydration)
├── PipelineHealthCardsGrid (Client - dnd-kit)
│   ├── ProspectsCard
│   ├── ProposalsCard
│   ├── AgreementsCard
│   └── PaymentsCard
├── Row2Container
│   ├── NeedsAttentionList (Server + Client sorting)
│   └── PipelineFunnel (Client - Recharts)
├── Row3Container
│   ├── RevenuePipeline (Server)
│   └── TimelineWidget (Client)
└── Row4Container
    ├── ActivityFeed (Client - Socket.IO)
    └── SmartAlerts (Server)
```

### 5.2 Server Actions

```typescript
// apps/web/src/app/(dashboard)/command-center/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const sendReminderSchema = z.object({
  entityType: z.enum(['prospect', 'proposal', 'contract', 'invoice']),
  entityId: z.string(),
  message: z.string().optional()
});

export async function sendReminder(formData: z.infer<typeof sendReminderSchema>) {
  const { entityType, entityId, message } = sendReminderSchema.parse(formData);
  
  const response = await fetch(`${process.env.OPEN_SEO_API_URL}/api/actions/send-reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, entityId, message })
  });

  if (!response.ok) throw new Error('Failed to send reminder');
  
  revalidatePath('/command-center');
  return { success: true };
}

export async function snoozeFollowUp(
  entityType: EntityType,
  entityId: string,
  snoozedUntil: Date
) {
  // ... implementation
}

export async function markAsLost(
  entityType: 'prospect' | 'proposal',
  entityId: string,
  reason: string,
  notes?: string
) {
  // ... implementation
}

export async function dismissAlert(alertId: string) {
  // ... implementation
}
```

### 5.3 Real-time Updates via Socket.IO

```typescript
// apps/web/src/hooks/command-center/useActivityFeed.ts
'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ActivityEvent {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  timestamp: Date;
}

export function useActivityFeed(workspaceId: string) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      query: { workspaceId },
      transports: ['websocket']
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('activity:new', (event: ActivityEvent) => {
      setActivities(prev => [event, ...prev.slice(0, 49)]);
    });

    return () => { socket.disconnect(); };
  }, [workspaceId]);

  return { activities, isConnected };
}
```

---

## 6. i18n Integration

All user-facing strings support Lithuanian (LT) and English (EN):

```typescript
// packages/i18n/src/locales/en/command-center.json
{
  "dashboard": {
    "title": "Command Center",
    "today": {
      "overdue": "Overdue",
      "dueToday": "Due Today",
      "awaitingYou": "Awaiting You",
      "new": "New"
    },
    "pipeline": {
      "prospects": "Prospects",
      "proposals": "Proposals",
      "agreements": "Agreements",
      "payments": "Payments"
    },
    "needsAttention": {
      "title": "Needs Attention",
      "priority": {
        "critical": "Critical",
        "high": "High",
        "medium": "Medium",
        "low": "Low"
      }
    },
    "actions": {
      "sendReminder": "Send Reminder",
      "markLost": "Mark as Lost",
      "snooze": "Snooze",
      "addNote": "Add Note"
    }
  },
  "workflow": {
    "status": {
      "active": "Active",
      "paused": "Paused",
      "snoozed": "Snoozed until {{date}}",
      "completed": "Completed",
      "won": "Won",
      "lost": "Lost"
    }
  }
}

// packages/i18n/src/locales/lt/command-center.json
{
  "dashboard": {
    "title": "Valdymo centras",
    "today": {
      "overdue": "Vėluojantys",
      "dueToday": "Šiandien",
      "awaitingYou": "Laukia jūsų",
      "new": "Nauji"
    },
    "pipeline": {
      "prospects": "Potencialūs klientai",
      "proposals": "Pasiūlymai",
      "agreements": "Sutartys",
      "payments": "Mokėjimai"
    },
    "needsAttention": {
      "title": "Reikia dėmesio",
      "priority": {
        "critical": "Kritinis",
        "high": "Aukštas",
        "medium": "Vidutinis",
        "low": "Žemas"
      }
    },
    "actions": {
      "sendReminder": "Siųsti priminimą",
      "markLost": "Pažymėti kaip prarastą",
      "snooze": "Atidėti",
      "addNote": "Pridėti pastabą"
    }
  },
  "workflow": {
    "status": {
      "active": "Aktyvus",
      "paused": "Pristabdytas",
      "snoozed": "Atidėtas iki {{date}}",
      "completed": "Užbaigtas",
      "won": "Laimėtas",
      "lost": "Prarastas"
    }
  }
}
```

---

## 7. Implementation Plans

### Wave 1: Foundation (Plans 62-01 to 62-03)

| Plan | Focus | Effort | Dependencies |
|------|-------|--------|--------------|
| 62-01 | Database schema + migrations | 8h | Phase 56 i18n |
| 62-02 | Follow-up system + rules engine | 12h | 62-01 |
| 62-03 | Engagement workflow engine + BullMQ workers | 14h | 62-02 |

### Wave 2: Dashboard Core (Plans 62-04 to 62-06)

| Plan | Focus | Effort | Dependencies |
|------|-------|--------|--------------|
| 62-04 | Pipeline metrics worker + materialized views | 10h | 62-03 |
| 62-05 | Command Center dashboard (Today Bar, Pipeline Cards, Revenue) | 12h | 62-04 |
| 62-06 | Needs Attention list + Quick Actions | 10h | 62-05 |

### Wave 3: Intelligence & Polish (Plans 62-07 to 62-08)

| Plan | Focus | Effort | Dependencies |
|------|-------|--------|--------------|
| 62-07 | Smart alerts detection + Activity feed (Socket.IO) | 12h | 62-06 |
| 62-08 | Win/Loss analytics + i18n translations + E2E tests | 10h | 62-07 |

---

## 8. Success Criteria

1. **Pipeline Visibility**: All entity statuses visible in single dashboard view
2. **Engagement Automation**: Workflow engine executes follow-ups without manual intervention
3. **Anti-Annoyance**: No more than 3 automated touches per week per entity
4. **Snooze Support**: "Follow up on May 27th" functionality works
5. **Lost Deal Tracking**: All lost deals have recorded reason
6. **Alert Accuracy**: Smart alerts detect 90%+ of stalled high-value deals
7. **Real-time Updates**: Activity feed updates within 100ms
8. **i18n Complete**: All strings translated to LT and EN
9. **Performance**: Dashboard loads in < 1.5s, refreshes in < 500ms

---

## 9. File Structure

```
apps/web/src/
├── app/(dashboard)/command-center/
│   ├── page.tsx
│   ├── actions.ts
│   ├── layout.tsx
│   └── _components/
│       ├── TodayActionBar.tsx
│       ├── PipelineHealthCards.tsx
│       ├── NeedsAttentionList.tsx
│       ├── PipelineFunnel.tsx
│       ├── RevenuePipeline.tsx
│       ├── TimelineWidget.tsx
│       ├── ActivityFeed.tsx
│       ├── SmartAlerts.tsx
│       └── QuickActionDialog.tsx
└── components/command-center/
    ├── DraggableCard.tsx
    ├── PriorityBadge.tsx
    ├── EntityIcon.tsx
    └── TrendIndicator.tsx

open-seo-main/src/server/
├── db/schema/
│   ├── follow-ups.ts
│   ├── workflow-templates.ts
│   ├── workflow-instances.ts
│   ├── deal-outcomes.ts
│   ├── pipeline-metrics.ts
│   └── smart-alerts.ts
├── features/command-center/
│   ├── services/
│   │   ├── EngagementService.ts
│   │   ├── AlertDetectionService.ts
│   │   ├── MetricsService.ts
│   │   └── QuickActionService.ts
│   ├── repositories/
│   │   ├── FollowUpRepository.ts
│   │   ├── WorkflowRepository.ts
│   │   └── PipelineMetricsRepository.ts
│   └── api/
│       ├── dashboard.ts
│       └── actions.ts
└── workers/
    ├── pipeline-metrics-processor.ts
    ├── alert-detection-worker.ts
    └── workflow-processor.ts

packages/i18n/src/locales/
├── en/command-center.json
└── lt/command-center.json
```
