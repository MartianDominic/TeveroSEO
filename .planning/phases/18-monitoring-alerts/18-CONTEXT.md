# Phase 18: Monitoring & Alerts - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Alert system for ranking drops, backlink changes, and technical issues. Notifications via email and in-app. Alert rules configurable per client.

</domain>

<decisions>
## Implementation Decisions

### Alert Schema
- `alert_rules` table stores threshold configs per client
- `alerts` table stores triggered alerts with severity and status
- Severity levels: info, warning, critical
- Status: pending, acknowledged, resolved, dismissed

### Alert Types (Phase 18 Scope)
- Ranking drops (consumes rank_drop_events from 17-04)
- Sync failures (analytics sync errors)
- Connection expiry warnings

### Alert Processing
- BullMQ alert worker processes rank_drop_events
- Converts events to proper alerts with severity
- Groups related alerts to prevent spam
- Respects per-client alert rules

### Notification Channels
- In-app: alert badge on dashboard, alert drawer
- Email: high-severity alerts via existing Resend integration
- Future: Slack webhooks (Phase 18.5)

### UI Components
- Dashboard alert badge (count of unacknowledged alerts)
- Alert drawer with quick actions
- `/clients/[id]/alerts` history page
- Alert rule configuration UI

### Claude's Discretion
- Alert grouping/deduplication logic
- Badge animation/styling
- Drawer component implementation
- Email notification templates

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- rank_drop_events from Phase 17-04
- Resend email integration from Phase 16
- BullMQ worker patterns
- shadcn/ui components (Badge, Sheet for drawer)

### Established Patterns
- BullMQ with sandboxed processors
- Drizzle schema patterns
- Server actions for data fetching
- Toast notifications pattern

### Integration Points
- Consume: rank_drop_events table (17-04)
- New: alert_rules, alerts tables
- New: BullMQ queue `alert-processor`
- Extend: Dashboard with alert badge
- New: `/clients/[id]/alerts` page

</code_context>

<specifics>
## Specific Ideas

### Alert Rule Schema
```typescript
interface AlertRule {
  id: string;
  clientId: string;
  alertType: 'ranking_drop' | 'sync_failure' | 'connection_expiry';
  enabled: boolean;
  threshold?: number; // For ranking drops
  severity: 'info' | 'warning' | 'critical';
  emailNotify: boolean;
  createdAt: Date;
}
```

### Alert Schema
```typescript
interface Alert {
  id: string;
  clientId: string;
  ruleId?: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}
```

</specifics>

<deferred>
## Deferred Ideas

### Advanced Alerting (Phase 18.5+)
- Webhook notifications
- Slack integration
- Alert escalation rules
- On-call scheduling

### Additional Alert Types (Future)
- Backlink changes
- Technical audit issues
- Traffic anomalies
- Competitor movements

</deferred>
