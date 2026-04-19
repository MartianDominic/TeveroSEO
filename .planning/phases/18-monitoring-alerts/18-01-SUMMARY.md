---
phase: 18-monitoring-alerts
plan: 01
subsystem: alert-schema
tags: [alerts, drizzle, schema, rules]
dependency_graph:
  requires: [rank_drop_events from 17-04]
  provides: [alert_rules table, alerts table, alert services]
  affects: [18-02 processor, 18-03 notifications, 18-04 UI]
tech_stack:
  added: []
  patterns: [rule-based alerting, cascading defaults]
key_files:
  created:
    - open-seo-main/src/db/alert-schema.ts
    - open-seo-main/src/services/alerts.ts
    - open-seo-main/drizzle/0007_alert_schema.sql
  modified:
    - open-seo-main/src/db/schema.ts
decisions:
  - "Severity enum: info, warning, critical"
  - "Status enum: pending, acknowledged, resolved, dismissed"
  - "Rule-based thresholds with defaults"
  - "sourceEventId links alerts to trigger events"
metrics:
  duration_minutes: 15
  completed_at: "2026-04-19T19:30:00Z"
---

# Phase 18 Plan 01: Alert Schema & Rules Summary

Drizzle ORM tables and service layer for alerting system

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1-4 | Full implementation | (bundled in 18-02) | 4 files |

## Implementation Details

### alert-schema.ts

- `alert_rules` table:
  - clientId, alertType, enabled, threshold, severity, emailNotify
  - Unique constraint on (clientId, alertType)
  - Indexes on clientId

- `alerts` table:
  - clientId, ruleId, alertType, severity, status
  - title, message, metadata (JSONB)
  - timestamps: createdAt, acknowledgedAt, resolvedAt, emailSentAt
  - sourceEventId for linking to trigger events
  - Indexes on (clientId, status, createdAt), ruleId, createdAt

### alerts.ts Service

- `getAlertRule()` - Get rule for client/type with defaults
- `ensureDefaultRules()` - Create default rules for new clients
- `createAlert()` - Insert alert with rule reference
- `acknowledgeAlert()` - Update status with timestamp
- `resolveAlert()` - Update status with timestamp
- `dismissAlert()` - Update status
- `getClientAlerts()` - List with filters
- `getUnacknowledgedCount()` - Badge count

## Self-Check: PASSED

- [x] alert_rules table with all columns
- [x] alerts table with all columns
- [x] Service functions for CRUD
- [x] TypeScript compiles clean
- [x] Migration file created
