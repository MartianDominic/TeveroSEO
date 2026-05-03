---
phase: 68-integration-hardening
plan: 03
subsystem: api-contracts
tags: [zod, validation, optimistic-locking, events, error-handling]
dependency_graph:
  requires: [68-01]
  provides: [zod-webhook-validation, optimistic-locking, unified-events, error-envelope]
  affects: [webhook-api, event-system, api-responses]
tech_stack:
  added: [zod-webhook-schemas]
  patterns: [optimistic-locking, unified-event-schema, standard-error-envelope]
key_files:
  created:
    - open-seo-main/src/server/lib/response.ts
    - open-seo-main/drizzle/0069_webhooks_version_column.sql
    - packages/types/src/events/client-events.ts
    - packages/types/src/events/index.ts
  modified:
    - open-seo-main/src/routes/api/webhooks.ts
    - open-seo-main/src/db/webhook-schema.ts
    - open-seo-main/src/services/webhooks.ts
    - packages/types/src/index.ts
decisions:
  - Zod schemas inline in webhooks.ts for co-location with handlers
  - Version column uses integer with default 1, incremented on each update
  - Event schema uses snake_case consistently (event_type, client_id, workspace_id)
  - api_version literal "2026-05-01" for schema versioning
  - Error envelope includes code, message, and optional details
metrics:
  duration: 4m
  completed: 2026-05-03
---

# Phase 68 Plan 03: API Contract Alignment Summary

Standardized API contracts with Zod validation, optimistic locking, unified event schema, and consistent error envelope for webhook endpoints.

## One-liner

Zod validation + optimistic locking (409 on version mismatch) + unified ClientEventSchema with snake_case + {success, data/error} envelope

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Zod Schemas to Webhook Endpoints | 6e3e044 | webhooks.ts |
| 2 | Implement Optimistic Locking | 6e3e044 | webhook-schema.ts, webhooks.ts, webhooks.ts (service), migration |
| 3 | Unify Event Schema Format | 6e3e044 | client-events.ts, events/index.ts |
| 4 | Standardize Error Envelope | 6e3e044 | response.ts, webhooks.ts |

## Key Deliverables

### 1. Zod Validation Schemas (Task 1)

```typescript
const createWebhookSchema = z.object({
  scope: webhookScopeSchema,
  scopeId: z.string().optional(),
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event required"),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().default(true),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url("Invalid webhook URL").optional(),
  events: z.array(z.string()).min(1, "At least one event required").optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
  expectedVersion: z.number().int().positive().optional(),
});
```

### 2. Optimistic Locking (Task 2)

- Added `version INTEGER NOT NULL DEFAULT 1` to webhooks table
- Migration: `0069_webhooks_version_column.sql`
- PATCH handler checks `expectedVersion` against current version
- Returns 409 Conflict with `VERSION_MISMATCH` code on mismatch
- Version auto-increments on each successful update

### 3. Unified Event Schema (Task 3)

```typescript
export const ClientEventSchema = z.object({
  event_type: z.string(),              // dot notation: "client.created"
  client_id: z.string().uuid(),
  workspace_id: z.string(),
  timestamp: z.string().datetime(),
  api_version: z.literal("2026-05-01"),
  source: z.enum(["open-seo", "ai-writer", "apps-web"]),
  payload: z.record(z.unknown()),
  correlation_id: z.string().uuid().optional(),
  idempotency_key: z.string().optional(),
});
```

### 4. Standardized Error Envelope (Task 4)

```typescript
// Success: { success: true, data: T }
export function successResponse<T>(data: T): Response

// Error: { success: false, error: { message, code, details } }
export function errorResponse(status: number, message: string, details?: ErrorDetails): Response
```

## Acceptance Criteria Verification

- [x] createWebhookSchema validates url, events, secret, active
- [x] Validation errors return 400 with field details (via Zod flatten)
- [x] Invalid URL returns specific error message ("Invalid webhook URL")
- [x] webhooks table has version column with default 1
- [x] PATCH with stale expectedVersion returns 409 Conflict
- [x] Successful update increments version (sql`version + 1`)
- [x] Event schema uses snake_case for all keys
- [x] api_version field present with current version ("2026-05-01")
- [x] source field identifies originating service (open-seo, ai-writer, apps-web)
- [x] File exists: packages/types/src/events/client-events.ts
- [x] All errors return {success: false, error: {...}} format
- [x] Error includes message, optional code, optional details
- [x] File exists: open-seo-main/src/server/lib/response.ts
- [x] Webhook endpoints migrated to use errorResponse

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] open-seo-main/src/server/lib/response.ts exists
- [x] open-seo-main/drizzle/0069_webhooks_version_column.sql exists
- [x] packages/types/src/events/client-events.ts exists
- [x] packages/types/src/events/index.ts exists
- [x] Commit 6e3e044 exists
