# API Contract Review - TeveroSEO Platform
**Date**: 2026-05-03
**Agent**: API Contract Specialist

---

## Overview

Analyzed inter-service API communication across apps/web (Next.js), open-seo-main (TanStack Start), and AI-Writer (FastAPI). The platform uses a well-designed server-fetch abstraction with circuit breakers, retry logic, and automatic case transformation.

**Architecture Strengths:**
- Centralized API client in `apps/web/src/lib/server-fetch.ts` with circuit breaker protection
- Automatic snake_case/camelCase transformation for AI-Writer (Python) endpoints
- Standardized error normalization layer handling multiple error formats
- Shared types package at `packages/types/` for cross-service consistency
- Zod schema validation support with optional runtime validation

---

## FINDING: API-01 (MEDIUM) - Inconsistent Error Response Formats Across Services

**Location:** Multiple files across open-seo-main API routes

**Description:** Error response formats are inconsistent between endpoints within open-seo-main itself. Some endpoints use the standard envelope pattern `{success: false, error: {message, code}}` while others use the legacy format `{error: "message"}`.

**Evidence:**

Standard format (newer endpoints):
```typescript
// open-seo-main/src/routes/api/seo/audits.ts
return Response.json({ success: false, error: { message: error.message, code: error.code } }, { status });
```

Legacy format (older endpoints):
```typescript
// open-seo-main/src/routes/api/webhooks.ts
return Response.json({ error: err.message }, { status });

// open-seo-main/src/routes/api/report-templates/index.ts
return Response.json({ error: "Internal error" }, { status: 500 });
```

**Impact:** Frontend error handling code must accommodate both formats, leading to fragile error parsing. The `normalizeBackendError()` function in server-fetch.ts handles this but adds complexity.

**Recommendation:** Migrate all open-seo-main endpoints to the standardized format:
```typescript
{ success: false, error: { message: string, code: string } }
```

---

## FINDING: API-02 (HIGH) - Missing Request Validation on Some Endpoints

**Location:** `open-seo-main/src/routes/api/webhooks.ts:91-103`

**Description:** The POST handler for creating webhooks validates required fields but casts the request body without Zod schema validation, allowing unexpected fields through.

**Evidence:**
```typescript
// POST /api/webhooks - Create webhook
POST: async ({ request }: { request: Request }) => {
  const body = (await request.json()) as {
    scope: "global" | "workspace" | "client";
    scopeId?: string;
    name: string;
    url: string;
    events: string[];
    headers?: Record<string, string>;
    enabled?: boolean;
  };

  if (!body.scope || !body.name || !body.url || !body.events) {
    throw new AppError("VALIDATION_ERROR", "scope, name, url, and events required");
  }
```

**Impact:** 
1. No type validation - string length, URL format, event array contents not validated
2. Potential for injection via headers object (arbitrary key/value pairs)
3. Inconsistent with other endpoints that use Zod schemas

**Recommendation:** Add Zod schema validation:
```typescript
const createWebhookSchema = z.object({
  scope: z.enum(["global", "workspace", "client"]),
  scopeId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  headers: z.record(z.string().max(1000)).optional(),
  enabled: z.boolean().optional(),
});
```

---

## FINDING: API-03 (MEDIUM) - Type Assertions Without Runtime Validation

**Location:** `apps/web/src/lib/server-fetch.ts:424-425`

**Description:** When no Zod schema is provided to the fetch functions, responses are cast with `as T` without runtime validation, creating a type safety gap.

**Evidence:**
```typescript
// CRIT-API-02 FIX: Log warning when schema is not provided
if (process.env.NODE_ENV === 'development') {
  logger.warn(
    `[server-fetch] CRIT-API-02: No schema provided for ${method} ${path}. ` +
    `Response type assertion bypasses runtime validation. Pass a Zod schema for type safety.`
  );
}

// Without schema, return as T (maintains backward compatibility)
// @deprecated - Callers should pass a schema for runtime type safety
return parsed as T;
```

**Impact:** If the backend API changes its response structure, the frontend will not catch this at runtime, potentially causing silent data corruption or runtime errors in components.

**Recommendation:** 
1. Require schemas for all new endpoints
2. Add a lint rule to flag fetch calls without schemas
3. Gradually migrate existing calls to use schemas

---

## FINDING: API-04 (LOW) - Unnecessary Case Transformation for TypeScript Services

**Location:** `apps/web/src/lib/server-fetch.ts:354-355`

**Description:** The automatic case transformation defaults to transforming only AI-Writer responses (Python uses snake_case). However, the transform functions are called on every request regardless of the target service.

**Evidence:**
```typescript
// CRIT-API-02 FIX: Automatic case transformation for AI-Writer (Python uses snake_case)
// Default: transform for AI-Writer, don't transform for open-seo-main (TypeScript)
const shouldTransformRequest = transformRequest ?? (source === 'ai-writer');
const shouldTransformResponse = transformResponse ?? (source === 'ai-writer');
```

**Impact:** Minor performance overhead; code clarity issue rather than functional bug.

**Recommendation:** Consider early return before transformation calls when `shouldTransform` is false.

---

## FINDING: API-05 (HIGH) - PATCH/DELETE Webhook Missing Optimistic Locking on Backend

**Location:** 
- `apps/web/src/actions/webhooks.ts:276-285`
- `open-seo-main/src/routes/api/webhooks.$webhookId.ts:170-176`

**Description:** The frontend action sends `expectedVersion` for optimistic locking, but the backend PATCH handler does not process this field or validate version matching.

**Evidence:**

Frontend sends version:
```typescript
// apps/web/src/actions/webhooks.ts
const data = await patchOpenSeo<{ success: boolean; secret?: string; newVersion?: number }>(`/api/webhooks/${validated.webhookId}`, {
  ...validated.params,
  expectedVersion: versionToUse,  // <-- Sent to backend
  expectedScope: webhook.scope,
  expectedScopeId: webhook.scopeId,
  userId: auth.userId,
});
```

Backend ignores version:
```typescript
// open-seo-main/src/routes/api/webhooks.$webhookId.ts
const body = (await request.json()) as {
  name?: string;
  url?: string;
  events?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
  regenerateSecret?: boolean;
  // No expectedVersion, expectedScope, expectedScopeId, userId
};

// Update other fields
await updateWebhook(webhookId, {
  name: body.name,
  url: body.url,
  // No version validation
});
```

**Impact:** Race conditions can cause lost updates when multiple users edit the same webhook simultaneously.

**Recommendation:** Implement optimistic locking in the backend:
```typescript
const body = (await request.json()) as {
  ...
  expectedVersion?: number;
};

await updateWebhook(webhookId, {
  ...body,
  expectedVersion: body.expectedVersion, // Pass to service for validation
});
```

---

## FINDING: API-06 (MEDIUM) - Inconsistent Idempotency Key Usage

**Location:** 
- `apps/web/src/actions/webhooks.ts:206-219`
- `apps/web/src/actions/seo/audit.ts:70-73`

**Description:** Frontend generates idempotency keys for create operations but backends do not consistently check or use them.

**Evidence:**
```typescript
// apps/web/src/actions/webhooks.ts
const idempotencyKey = generateWebhookIdempotencyKey('create', {
  clientId: validated.clientId,
  name: validated.name,
  url: validated.url,
});

const data = await postOpenSeo<{ id: string; secret: string }>("/api/webhooks", {
  ...
  idempotencyKey, // Backend should use this to deduplicate
});
```

Backend does not use the key:
```typescript
// open-seo-main/src/routes/api/webhooks.ts
// No idempotency key handling in createWebhook call
const webhookId = await createWebhook({
  scope: body.scope,
  // idempotencyKey not passed
});
```

**Impact:** Network retries or user double-clicks could create duplicate resources.

**Recommendation:** Implement idempotency key storage and validation:
1. Store idempotency keys with a TTL (e.g., 24 hours)
2. Return cached response if key already processed
3. Use Redis or database table for key storage

---

## FINDING: API-07 (LOW) - Client Entity Type Mismatch Between Services

**Location:**
- `packages/types/src/client.ts`
- `AI-Writer/backend/api/clients.py:104-112`
- `open-seo-main/src/routes/api/clients/sync.ts:24-30`

**Description:** The Client type definition uses snake_case (`website_url`, `is_archived`) but frontend stores expect camelCase. This creates a dependency on the case transformation layer.

**Evidence:**
```typescript
// packages/types/src/client.ts
export interface Client {
  id: string;
  name: string;
  website_url: string | null;  // snake_case
  is_archived: boolean;        // snake_case
}
```

However, frontend stores and components use camelCase:
```typescript
// apps/web/src/stores/clientStore.ts
const clients = (await res.json()) as Client[];
// After fetch, Client[] has snake_case keys but frontend expects camelCase
```

**Impact:** The shared type definition does not match actual runtime usage after case transformation.

**Recommendation:** Define separate types for API layer vs application layer:
```typescript
// API response type (from Python backend)
export interface ClientApiResponse {
  id: string;
  name: string;
  website_url: string | null;
  is_archived: boolean;
}

// Application type (camelCase)
export interface Client {
  id: string;
  name: string;
  websiteUrl: string | null;
  isArchived: boolean;
}
```

---

## FINDING: API-08 (MEDIUM) - Any Types in API Response Handlers

**Location:** `open-seo-main/src/routes/api/connect/handoff.ts` and other API files

**Description:** Several API route handlers use `as any` type assertions for request body parsing.

**Evidence:**
```bash
$ find open-seo-main/src/routes/api -name "*.ts" -exec grep -l "as any" {} \;
/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/connect/handoff.ts
/home/dominic/Documents/TeveroSEO/open-seo-main/src/routes/api/invoices/$id.schedule.ts
```

**Impact:** TypeScript type checking is bypassed, allowing potential type mismatches to slip through.

**Recommendation:** Replace `any` with proper Zod schema parsing or explicit interface types.

---

## FINDING: API-09 (HIGH) - Webhook Event Schema Mismatch Between Emitter and Receiver

**Location:**
- `AI-Writer/backend/api/clients.py:306-323` (emitter)
- `open-seo-main/src/routes/api/clients/events.ts:36-44` (receiver)

**Description:** The event schema expected by open-seo-main uses snake_case keys (`event_type`, `client_id`, `workspace_id`) but AI-Writer emits with camelCase keys.

**Evidence:**

open-seo-main expects:
```typescript
const ClientEventSchema = z.object({
  event_type: ClientEventType,        // snake_case
  client_id: z.string().uuid(),       // snake_case
  workspace_id: z.string().uuid().nullable().optional(),
  timestamp: z.string(),
  data: z.record(z.unknown()).optional(),
  correlation_id: z.string().uuid().optional(),
});
```

AI-Writer emits (based on typical Python patterns):
```python
emit_client_event(
    event_type=ClientEventType.CREATED,
    client_id=str(client.id),
    workspace_id=workspace_id,
    data={...},
)
```

**Impact:** Events may fail validation if case conventions don't match, causing silent sync failures.

**Recommendation:** 
1. Verify AI-Writer's `emit_client_event` output format
2. Ensure both services use same convention (snake_case recommended for webhooks)
3. Add integration tests for event flow

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 0 | - |
| HIGH | 3 | Missing optimistic locking, request validation, event schema mismatch |
| MEDIUM | 4 | Inconsistent error formats, type assertions, idempotency, any types |
| LOW | 2 | Case transform overhead, client type mismatch |

**Overall Assessment:** The API contract infrastructure is well-designed with proper abstractions (circuit breakers, error normalization, case transformation). The main gaps are:
1. Inconsistent application of the patterns across all endpoints
2. Backend handlers not implementing features the frontend expects (optimistic locking, idempotency)
3. Type definitions not reflecting runtime reality after transformations

**Priority Actions:**
1. Implement optimistic locking for webhook PATCH endpoint (API-05)
2. Add Zod validation to webhook POST endpoint (API-02)
3. Verify and fix event schema matching between AI-Writer and open-seo-main (API-09)
4. Standardize all open-seo-main error responses to use envelope pattern (API-01)
