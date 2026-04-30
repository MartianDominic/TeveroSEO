---
phase: 49-51-onboarding-dashboard
plan: "01"
title: "Onboarding Engine: Auto-Create Checklist & Item Completion Service"
subsystem: open-seo-main/onboarding
tags: [onboarding, checklist, magic-link, oauth, white-label]

dependency_graph:
  requires:
    - phase-48-contract-payment (OnboardingService, ChecklistRepository, ActivityRepository)
  provides:
    - ChecklistCompletionService (event-driven item completion)
    - MagicLinkService (white-label credential invitation)
    - magic_links table schema
  affects:
    - OAuth callback routes (will dispatch auto-complete events)
    - /connect/[token] page (will use validateMagicLink)

tech_stack:
  added: []
  patterns:
    - Event-driven checklist completion via AutoCompleteEvent types
    - 24-hour expiring magic link tokens with 128-bit entropy
    - White-label branding lookup from organization table

key_files:
  created:
    - open-seo-main/src/db/magic-link-schema.ts
    - open-seo-main/drizzle/0050_magic_links.sql
    - open-seo-main/src/server/features/onboarding/services/ChecklistCompletionService.ts
    - open-seo-main/src/server/features/onboarding/services/ChecklistCompletionService.test.ts
    - open-seo-main/src/server/features/onboarding/services/MagicLinkService.ts
    - open-seo-main/src/server/features/onboarding/services/MagicLinkService.test.ts
  modified:
    - open-seo-main/src/db/schema.ts (barrel export for onboarding schemas)

decisions:
  - Magic link tokens use 32-char nanoid for 128 bits entropy (T-49-01 mitigation)
  - Default primary color is emerald (#10b981) when workspace has no custom branding
  - Auto-complete events are idempotent - already-completed items return silently

metrics:
  duration_minutes: 4
  completed_at: "2026-04-30T13:29:00Z"
  tasks_completed: 3
  tasks_total: 3
  tests_added: 16
  tests_passing: 16
---

# Phase 49-51 Plan 01: Onboarding Engine Summary

Event-driven checklist completion with white-label magic links for client credential setup.

## One-Liner

Backend services for OAuth-triggered checklist completion and secure white-label invitation links with 24h expiry.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | d71ec66de | feat(49-01): create magic link schema and migration |
| 2 | e664d8e8d | feat(49-01): create ChecklistCompletionService with tests |
| 3 | c97faa744 | feat(49-01): create MagicLinkService with tests |

## Task Breakdown

### Task 1: Magic Link Schema and Migration

Created `magic_links` table with:
- 32-char nanoid token (unique, indexed)
- Foreign keys to organization, clients, onboarding_checklists
- expiresAt timestamp for 24-hour expiry enforcement
- usedAt timestamp for single-use constraint
- Indexes on token (lookup), expiresAt (cleanup), workspaceId (scoped queries)

### Task 2: ChecklistCompletionService

Implemented event-driven completion:
- `handleAutoCompleteEvent(workspaceId, clientId, event)`: Completes items when OAuth succeeds
- `completeItemManually(checklistId, itemId, completedBy)`: Manual completion
- Idempotent: already-completed items return silently without error
- Activity logging with entityType="onboarding", activityType="item_completed"

Supported events: `gsc_connected`, `ga_connected`, `cms_connected`, `gbp_connected`, `kickoff_completed`

### Task 3: MagicLinkService

Implemented white-label invitation links:
- `generateMagicLink(workspaceId, clientId, checklistId, itemId)`: Creates 24h-expiry token
- `validateMagicLink(token)`: Returns validity + workspace branding (name, logoUrl, primaryColor)
- `markMagicLinkUsed(token)`: Sets usedAt to prevent reuse

Per D-02: Validation includes workspace branding for white-label display.

## Deviations from Plan

None - plan executed exactly as written.

## Test Coverage

- ChecklistCompletionService: 7 tests
  - Auto-complete with matching event
  - Idempotency for already-completed items
  - Early return for non-existent event
  - Early return for missing checklist
  - Activity logging verification
  - Manual completion regardless of autoCompleteEvent
  - Invalid itemId handling

- MagicLinkService: 9 tests
  - Token generation with 24h expiry
  - Storage of all required fields
  - URL format /connect/{token}
  - Valid token validation
  - Expired token rejection
  - Used token rejection
  - Non-existent token handling
  - Workspace branding retrieval
  - usedAt timestamp setting

## Security Considerations

Per threat model:
- **T-49-01 (Info Disclosure)**: 32-char nanoid = 128 bits entropy; token excluded from logs
- **T-49-02 (Tampering)**: All validation data from DB lookup, never trust client-provided workspaceId
- **T-49-05 (Repudiation)**: Activity log with entityType, actorId for all completions

## Self-Check: PASSED

All files verified:
- [x] open-seo-main/src/db/magic-link-schema.ts exists
- [x] open-seo-main/drizzle/0050_magic_links.sql exists
- [x] open-seo-main/src/server/features/onboarding/services/ChecklistCompletionService.ts exists
- [x] open-seo-main/src/server/features/onboarding/services/MagicLinkService.ts exists
- [x] Commits d71ec66de, e664d8e8d, c97faa744 verified in git log
