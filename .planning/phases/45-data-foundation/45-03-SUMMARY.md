---
phase: 45-data-foundation
plan: 03
subsystem: database
tags: [schema, onboarding, activity-feed, drizzle, jsonb, polymorphic]
dependency_graph:
  requires: [organization, clients]
  provides:
    - onboardingChecklists table with JSONB items structure
    - SERVICE_TIERS, CHECKLIST_CATEGORIES const arrays
    - ChecklistItem interface with autoCompleteEvent support
    - pipelineActivities table with polymorphic entity pattern
    - ENTITY_TYPES, ACTIVITY_TYPES const arrays
    - Progress tracking via completedCount/totalCount
  affects: [Phase 46-53 agency pipeline features]
tech_stack:
  added: []
  patterns: [jsonb-storage, polymorphic-reference, progress-tracking]
key_files:
  created:
    - open-seo-main/src/db/onboarding-schema.ts
    - open-seo-main/src/db/onboarding-schema.test.ts
    - open-seo-main/src/db/activity-schema.ts
    - open-seo-main/src/db/activity-schema.test.ts
  modified: []
decisions:
  - "ChecklistItem uses optional autoCompleteEvent for automated progress tracking"
  - "Progress stored as completedCount/totalCount for efficient queries"
  - "Polymorphic activity feed uses entityType + entityId pattern without FK enforcement"
  - "actorId nullable for system-generated events"
  - "UUID FK for clientId in onboarding_checklists to match clients.id type"
metrics:
  duration_seconds: 211
  completed_at: "2026-04-30T00:30:11Z"
  tasks: 4
  files: 4
  lines: 476
  tests: 25
---

# Phase 45 Plan 03: Onboarding & Activity Schema Summary

Onboarding checklists with per-tier templates and polymorphic pipeline activity feed for unified event tracking.

## Objective

Create onboarding checklists and pipeline activities schemas for the agency pipeline. Enable client onboarding tracking with per-tier checklist templates and a unified activity feed for all pipeline entities (prospects, contracts, invoices, clients).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create onboarding-schema.ts with onboarding_checklists table | 7bcd126d5 | onboarding-schema.ts, onboarding-schema.test.ts |
| 2 | Create onboarding-schema.test.ts (combined with Task 1 per TDD) | 7bcd126d5 | (included above) |
| 3 | Create activity-schema.ts with pipeline_activities table | 65971a567 | activity-schema.ts, activity-schema.test.ts |
| 4 | Create activity-schema.test.ts (combined with Task 3 per TDD) | 65971a567 | (included above) |

## Implementation Details

### Onboarding Checklists Schema (onboarding-schema.ts)

- **Table:** `onboarding_checklists` with 9 columns
- **Service Tiers:** starter, growth, enterprise
- **Checklist Categories:** setup, credentials, kickoff, content
- **JSONB Items:** ChecklistItem[] with autoCompleteEvent, completedAt, completedBy
- **Progress Tracking:** completedCount and totalCount integers
- **Foreign Keys:** workspaceId -> organization (cascade), clientId -> clients (uuid, cascade)
- **Indexes:** workspace, client, tier

### Pipeline Activities Schema (activity-schema.ts)

- **Table:** `pipeline_activities` with 8 columns
- **Entity Types:** prospect, contract, invoice, client (polymorphic discriminator)
- **Activity Types:** 9 event types (created, status_changed, viewed, sent, signed, paid, note_added, reminder_set, archived)
- **Polymorphic Pattern:** entityType + entityId fields
- **JSONB Payload:** activityData for flexible event data
- **actorId:** Nullable text for system-generated events
- **Indexes:** workspace+created, entity, actor, type

### Exports

```typescript
// onboarding-schema.ts
export const SERVICE_TIERS = ["starter", "growth", "enterprise"] as const;
export const CHECKLIST_CATEGORIES = ["setup", "credentials", "kickoff", "content"] as const;
export interface ChecklistItem { id, label, category, autoCompleteEvent?, completedAt?, completedBy? }
export const onboardingChecklists = pgTable(...)
export const onboardingChecklistsRelations = relations(...)
export type OnboardingChecklistSelect, OnboardingChecklistInsert

// activity-schema.ts
export const ENTITY_TYPES = ["prospect", "contract", "invoice", "client"] as const;
export const ACTIVITY_TYPES = ["created", "status_changed", "viewed", "sent", "signed", "paid", "note_added", "reminder_set", "archived"] as const;
export const pipelineActivities = pgTable(...)
export const pipelineActivitiesRelations = relations(...)
export type PipelineActivitySelect, PipelineActivityInsert
```

## Test Coverage

25 tests covering:
- SERVICE_TIERS: array length (3), values, readonly
- CHECKLIST_CATEGORIES: array length (4), values
- onboardingChecklists: columns, progress fields
- ChecklistItem: basic structure, completed item, array validation
- Type exports: OnboardingChecklistSelect, OnboardingChecklistInsert
- ENTITY_TYPES: array length (4), values, readonly
- ACTIVITY_TYPES: array length (9), core types, readonly
- pipelineActivities: columns, polymorphic reference columns
- Activity payloads: status change, view tracking, payment
- Type exports: PipelineActivitySelect, PipelineActivityInsert

## Threat Mitigations Applied

| Threat ID | Category | Mitigation |
|-----------|----------|------------|
| T-45-08 | Information Disclosure | workspaceId index enables efficient workspace-scoped queries |
| T-45-09 | Tampering | Polymorphic design without FK; application layer validates entity existence |
| T-45-10 | Spoofing | actorId should be validated against authenticated user in repository layer |
| T-45-11 | Tampering | JSONB updates via atomic replace; repository layer validates item structure |

## Deviations from Plan

None - plan executed exactly as written. Tasks 1+2 and 3+4 were combined per TDD workflow (tests written before implementation, committed together).

## Self-Check: PASSED

- [x] open-seo-main/src/db/onboarding-schema.ts exists (110 lines)
- [x] open-seo-main/src/db/onboarding-schema.test.ts exists (131 lines)
- [x] open-seo-main/src/db/activity-schema.ts exists (97 lines)
- [x] open-seo-main/src/db/activity-schema.test.ts exists (138 lines)
- [x] Commit 7bcd126d5 verified in git log (onboarding schema)
- [x] Commit 65971a567 verified in git log (activity schema)
- [x] All 25 tests pass
- [x] TypeScript compiles without errors
