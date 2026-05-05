# Phase 90: Client Portal - Research

**Researched:** 2026-05-05
**Domain:** Client Portal, Analytics Dashboard, Notification System
**Confidence:** HIGH

## Summary

This research validates the Phase 90 Client Portal plans against the actual TeveroSEO codebase. The investigation reveals that **significant infrastructure already exists** from Phases 87 and 89, which the plans correctly reference but need updated file paths.

**Key findings:**
1. Portal schema (`portal-schema.ts`) already exists at `/open-seo-main/src/db/portal-schema.ts` (NOT in `schema/` subdirectory) and already includes Phase 90-01 tables (activities, notifications, settings)
2. GSC integration is mature with `gsc-client.ts` service and `seo_gsc_daily_snapshots` / `seo_gsc_query_snapshots` tables
3. Portal routes exist at `/routes/portal/` (TanStack Start frontend) and `/routes/api/portal/` (API endpoints)
4. PortalTokenService already implements token validation, generation, and revocation
5. BullMQ queue infrastructure is extensive (20+ queues) - notification queue needs to be added

**Primary recommendation:** Update file paths in plans to match actual codebase structure. Most schema work is already complete.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **No fake revenue numbers** - Only show verified GSC data + client-provided inputs
2. **Asterisks for estimates** - DataForSEO volume/CPC clearly labeled
3. **GSC required** - Portal cannot function without GSC connection
4. **GA4 optional** - Unlocks verified revenue if connected
5. **Push via PWA** - Native push notifications, not browser-only
6. **Resend for email** - Consistent with existing email infrastructure
7. **BullMQ for async** - Notification jobs, digest generation

### Trust Hierarchy (CRITICAL)
```
VERIFIED (GSC)          <- Always show, source of truth
    |
CALCULATED (our math)   <- Show growth %, changes (derived from GSC)
    |
DEFENSIBLE (CPC data)   <- Optional, clearly labeled with asterisk
    |
CLIENT-OWNED (inputs)   <- Their numbers, their responsibility
    |
INTEGRATED (GA4)        <- Real revenue if connected

X NEVER: Industry average revenue estimates
X NEVER: Conversion rate assumptions we made up
X NEVER: "Your SEO is worth X" without client data
```

### Claude's Discretion
- Component internal implementation details
- Service method organization
- Test structure

### Deferred Ideas (OUT OF SCOPE)
- Mobile app (use PWA)
- Multi-language portal (inherit from workspace)
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portal authentication (token validation) | API / Backend | - | Token DB lookups must be server-side |
| Dashboard data aggregation | API / Backend | - | GSC data queries, aggregation logic |
| Notification dispatch | API / Backend (BullMQ) | - | Async job processing, email via Resend |
| Portal UI rendering | Frontend (Next.js) | - | apps/web for portal pages |
| Real-time updates | Frontend | API (polling) | No WebSocket infrastructure yet |
| GSC data sync | API / Backend | - | OAuth token management, API calls |
| GA4 data sync | API / Backend | - | Similar to GSC pattern |

## Existing Infrastructure Inventory

### Portal Schema (ALREADY EXISTS)

**Location:** `open-seo-main/src/db/portal-schema.ts` [VERIFIED: codebase scan]

**NOT** in `schema/` subdirectory as plans suggest. The file already contains:

| Table | Status | Notes |
|-------|--------|-------|
| `portalTokens` | Complete | From Phase 87-01 |
| `portalUsers` | Complete | Email verification support |
| `portalActivities` | Complete | Phase 90-01 already implemented |
| `portalNotifications` | Complete | Queue-based notification system |
| `portalNotificationSettings` | Complete | Per-client preferences |

**Plan Correction Required:** Task 1 in 90-01-PLAN.md should verify/extend existing schema, not create new.

### GSC Integration (ALREADY EXISTS)

**Location:** `open-seo-main/src/server/services/analytics/gsc-client.ts` [VERIFIED: codebase scan]

**Capabilities:**
- `fetchGSCDateMetrics()` - Daily aggregate clicks/impressions/position
- `fetchGSCTopQueries()` - Top 50 queries per day by clicks
- `fetchGSCQueryPageMetrics()` - Query-page pairs for cannibalization
- `getGSCDateRange()` - Handles 3-day GSC delay automatically

**Data Storage:**
- `seo_gsc_daily_snapshots` - Aggregate metrics per client per day
- `seo_gsc_query_snapshots` - Top queries per client per day

**Plan Impact:** DashboardService can use existing GSC client directly. No new GSC integration needed.

### GA4 Integration (ALREADY EXISTS)

**Location:** `open-seo-main/src/server/services/analytics/ga4-client.ts` [VERIFIED: codebase scan]

**Data Storage:**
- `seo_ga4_daily_snapshots` - Sessions, users, conversions, revenue
- `seo_ga4_page_snapshots` - Page-level metrics

**Plan Impact:** Phase 90-04 GA4 integration can use existing client.

### Portal Token Service (ALREADY EXISTS)

**Location:** `open-seo-main/src/server/services/PortalTokenService.ts` [VERIFIED: codebase scan]

**Methods:**
- `generateToken(options)` - Creates nanoid 12-char token
- `validateToken(token)` - Returns clientId, authLevel, or error
- `revokeToken(token)` - Marks token as revoked
- `listClientTokens(clientId)` - Lists all tokens for client

**Auth Levels:** `token_only`, `email_verify`, `full_login`

### Portal Routes (ALREADY EXISTS)

| Route | Type | Location | Status |
|-------|------|----------|--------|
| `/portal/:token` | Frontend | `routes/portal/$token.tsx` | Placeholder UI |
| `/api/portal/tokens` | API | `routes/api/portal/tokens.ts` | Token generation |
| `/api/portal/tokens/:clientId` | API | `routes/api/portal/tokens.$clientId.ts` | List tokens |
| `/api/portal/revoke/:token` | API | `routes/api/portal/revoke.$token.ts` | Token revocation |
| `/api/portal/scope/:contractId` | API | `routes/api/portal/scope.$contractId.ts` | Contract scope data |

**Plan Impact:** 90-01 Task 3 adds `/api/portal/dashboard.$clientId.ts` - correct pattern.

### Keyword Lock-in Infrastructure (PHASE 89)

**Location:** `open-seo-main/src/server/features/keyword-lockin/` [VERIFIED: codebase scan]

**Services:**
- `LockEventService` - Keyword lock event summary
- `OutOfScopeService` - Out-of-scope request handling
- `ConflictDetectionService` - Keyword conflict detection

**Repositories:**
- `ContractedKeywordRepository` - CRUD for contracted keywords
- `ContractGoalRepository` - Goal tracking
- `OutOfScopeRepository` - Request management
- `ChangeOrderRepository` - Change order handling

**Schemas:**
- `contractedKeywords` - Locked keywords with baseline
- `contractGoals` - Achievement tracking
- `outOfScopeRequests` - Client requests outside scope
- `changeOrders` - Contract modifications

### Portal UI Components (ALREADY EXISTS)

**Location:** `apps/web/src/components/portal/` [VERIFIED: codebase scan]

| Component | Status | Notes |
|-----------|--------|-------|
| `ContractedScopeView.tsx` | Complete | From Phase 89-06 |
| `GoalProgressCard.tsx` | Complete | Goal achievement display |

**Plan Impact:** 90-01 builds on existing patterns. New components go here.

### Email Infrastructure (ALREADY EXISTS)

**Location:** `open-seo-main/src/server/lib/email.ts` [VERIFIED: codebase scan]

- Uses Resend API
- `sendReportEmail()` - PDF attachments, download fallback
- Templates in `server/lib/email-templates.ts`

**Plan Impact:** Notification emails can extend existing infrastructure.

### BullMQ Infrastructure (ALREADY EXISTS)

**Location:** `open-seo-main/src/server/queues/` [VERIFIED: codebase scan]

20+ queues already defined. Missing: `notificationQueue.ts`

**Pattern to follow:** See `alertQueue.ts` or `followUpQueue.ts` for structure.

## Standard Stack

### Core (Already in Use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | current | Database ORM | Already used for all schemas |
| @tanstack/react-router | current | Frontend routing | TanStack Start standard |
| bullmq | current | Job queues | Existing queue infrastructure |
| resend | current | Email delivery | Already configured |
| nanoid | current | Token generation | Used in PortalTokenService |

### Supporting (Required for Phase 90)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-query | current | Data fetching | Portal dashboard polling |
| lucide-react | current | Icons | Already used in portal components |
| date-fns | current | Date formatting | Already in project |

**Installation:** No new dependencies required. All libraries already in project.

## Architecture Patterns

### System Architecture Diagram

```
                    +------------------+
                    |   Client Browser |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   apps/web       |
                    |   (Next.js)      |
                    |   /portal/:token |
                    +--------+---------+
                             |
                    +--------v---------+
                    | open-seo-main    |
                    | (TanStack Start) |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
+--------v--------+  +-------v--------+  +-------v--------+
| PortalToken     |  | Dashboard      |  | Notification   |
| Service         |  | Service        |  | Service        |
| (validates      |  | (aggregates    |  | (queues via    |
|  tokens)        |  |  GSC data)     |  |  BullMQ)       |
+-----------------+  +-------+--------+  +-------+--------+
                             |                   |
                    +--------v--------+  +-------v--------+
                    | GSC Client      |  | Resend         |
                    | (fetches from   |  | (sends emails) |
                    |  Google API)    |  +----------------+
                    +--------+--------+
                             |
                    +--------v---------+
                    |   PostgreSQL     |
                    |   (Drizzle ORM)  |
                    +------------------+
```

### Recommended Project Structure

Plans should use these ACTUAL paths:

```
open-seo-main/src/
+-- db/
|   +-- portal-schema.ts              # Already exists - extend here
|   +-- schema/
|       +-- seo-gsc-snapshots.ts      # GSC data schema
|       +-- seo-ga4-snapshots.ts      # GA4 data schema
+-- server/
|   +-- services/
|   |   +-- PortalTokenService.ts     # Already exists
|   |   +-- analytics/
|   |       +-- gsc-client.ts         # Already exists
|   |       +-- ga4-client.ts         # Already exists
|   +-- features/
|   |   +-- portal/
|   |   |   +-- services/
|   |   |       +-- DashboardService.ts   # NEW - 90-01
|   |   |       +-- NotificationService.ts # NEW - 90-01
|   |   |       +-- ActivityService.ts     # NEW - 90-01
|   |   +-- keyword-lockin/
|   |       +-- services/              # Already exists
|   |       +-- repositories/          # Already exists
|   +-- queues/
|   |   +-- notificationQueue.ts       # NEW - 90-01
|   +-- workers/
|       +-- notification-worker.ts     # NEW - 90-01
+-- routes/
    +-- portal/
    |   +-- $token.tsx                 # Already exists (placeholder)
    +-- api/
        +-- portal/
            +-- dashboard.$clientId.ts # NEW - 90-01
            +-- keywords.$clientId.ts  # NEW - 90-01
            +-- activity.$clientId.ts  # NEW - 90-01
            +-- notifications.$clientId.ts # NEW - 90-01

apps/web/src/
+-- app/
|   +-- portal/
|       +-- [clientId]/               # NEW - 90-01
|           +-- page.tsx              # Dashboard
|           +-- keywords/
|           +-- progress/
|           +-- activity/
+-- components/
|   +-- portal/
|   |   +-- ContractedScopeView.tsx   # Already exists
|   |   +-- GoalProgressCard.tsx      # Already exists
|   |   +-- StatCard.tsx              # NEW - 90-01
|   |   +-- DeltaBadge.tsx            # NEW - 90-01
|   |   +-- TrustIndicator.tsx        # NEW - 90-01
|   |   +-- KeywordTable.tsx          # NEW - 90-01
|   |   +-- ActivityFeed.tsx          # NEW - 90-01
|   +-- ui/
|       +-- card.tsx                   # Already exists
|       +-- badge.tsx                  # Already exists
+-- lib/
    +-- portal/
        +-- types.ts                   # NEW - 90-01
        +-- api.ts                     # NEW - 90-01
        +-- hooks.ts                   # NEW - 90-01
```

### Pattern 1: TanStack Start API Routes

```typescript
// Source: open-seo-main/src/routes/api/portal/scope.$contractId.ts
export const Route = createFileRoute("/api/portal/scope/$contractId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { contractId: string } }) => {
        try {
          const { contractId } = params;
          // ... business logic
          return Response.json({ success: true, data });
        } catch (error) {
          console.error("[portal/scope] Error:", error);
          return Response.json(
            { success: false, error: "Failed to fetch scope data" },
            { status: 500 }
          );
        }
      },
    },
  },
});
```

### Pattern 2: Service with Repository

```typescript
// Source: open-seo-main/src/server/features/keyword-lockin/services/OutOfScopeService.ts
export class OutOfScopeService {
  static async getPendingSummary(contractId: string) {
    // Use repository for data access
    const requests = await OutOfScopeRepository.getByContract(contractId, {
      status: "pending",
    });
    return {
      pendingCount: requests.length,
      requests,
    };
  }
}
```

### Pattern 3: BullMQ Queue Definition

```typescript
// Source: open-seo-main/src/server/queues/alertQueue.ts
import { Queue } from "bullmq";
import { redisConnection } from "@/server/lib/redis";

export const alertQueue = new Queue("alert", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export interface AlertJobData {
  clientId: string;
  type: "win" | "drop" | "anomaly";
  payload: unknown;
}
```

### Anti-Patterns to Avoid

- **Wrong schema location:** Plans reference `db/schema/portal-schema.ts` but actual file is `db/portal-schema.ts`
- **Duplicating GSC integration:** Use existing `gsc-client.ts`, don't create new
- **Console.log in production:** Use `createLogger()` from `server/lib/logger.ts`
- **Missing auth validation:** All portal API routes must validate token before processing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation | Custom random strings | `nanoid(12)` | Already used, URL-safe, collision-resistant |
| Email delivery | SMTP client | Resend | Already configured, handles deliverability |
| Job queuing | setTimeout/setInterval | BullMQ | Existing infrastructure, retries, dead letter |
| GSC API calls | Raw fetch to Google | `gsc-client.ts` | Handles OAuth, retries, rate limiting |
| Date formatting | Manual string manipulation | `date-fns` | Already in project, handles locales |

## Common Pitfalls

### Pitfall 1: GSC Data Delay

**What goes wrong:** Dashboard shows "no data" for recent days
**Why it happens:** GSC data is delayed 2-3 days
**How to avoid:** Use `getGSCDateRange()` which accounts for delay
**Warning signs:** Client complains about missing recent data

### Pitfall 2: Schema Location Confusion

**What goes wrong:** New schemas added to wrong directory
**Why it happens:** Inconsistent file organization (some in `schema/`, some in `db/`)
**How to avoid:** Check existing files, follow portal-schema.ts pattern
**Warning signs:** Import errors, schema not found in migrations

### Pitfall 3: Missing Token Validation

**What goes wrong:** Unauthorized access to portal data
**Why it happens:** API routes skip token validation step
**How to avoid:** Always call `portalTokenService.validateToken()` first
**Warning signs:** Security audit failures, data leaks

### Pitfall 4: Blocking Notification Sends

**What goes wrong:** API response delayed by email sending
**Why it happens:** Sending email synchronously in API handler
**How to avoid:** Queue notification job, return immediately
**Warning signs:** Slow API responses, timeouts

## Code Examples

### Verified GSC Data Fetching

```typescript
// Source: open-seo-main/src/server/services/analytics/gsc-client.ts
import { fetchGSCDateMetrics, getGSCDateRange } from "@/server/services/analytics/gsc-client";

// Get date range accounting for 3-day delay
const { startDate, endDate } = getGSCDateRange("incremental");

// Fetch metrics
const metrics = await fetchGSCDateMetrics(
  accessToken,
  siteUrl,
  startDate,
  endDate
);
// Returns: Array<{ date, clicks, impressions, ctr, position }>
```

### Portal Token Validation

```typescript
// Source: open-seo-main/src/server/services/PortalTokenService.ts
import { portalTokenService } from "@/server/services/PortalTokenService";

const result = await portalTokenService.validateToken(token);
if (!result.valid) {
  return Response.json(
    { success: false, error: result.error },
    { status: 401 }
  );
}
const { clientId, authLevel } = result;
```

### Email via Resend

```typescript
// Source: open-seo-main/src/server/lib/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({
  from: "notifications@tevero.io",
  to: [clientEmail],
  subject: "SEO Win: Your keyword hit Top 10",
  html: winNotificationTemplate(data),
});
```

## Plan Corrections Required

### 90-01-PLAN.md Corrections

| Task | Issue | Correction |
|------|-------|------------|
| Task 1 | Path `db/schema/portal-schema.ts` | Actual path: `db/portal-schema.ts` |
| Task 1 | Schema already exists | Change to "verify and extend" |
| Task 2 | Path `server/features/portal/services/` | Directory exists, is empty - correct path |
| Task 3 | API route pattern | Pattern is correct |
| All Tasks | GSC table name `gsc_search_analytics` | Actual table: `seo_gsc_daily_snapshots`, `seo_gsc_query_snapshots` |

### Schema Already Implemented

The following tables from 90-01 Task 1 **already exist** in `portal-schema.ts`:

- `portalActivities` - Complete with all fields
- `portalNotifications` - Complete with status workflow
- `portalNotificationSettings` - Complete with channel toggles

**Action:** Skip schema creation, proceed to service implementation.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate client tables | `shared_clients` unified | Phase 67 | Use sharedClients for FK |
| Direct GSC API calls | `gsc-client.ts` wrapper | Phase 61 | Use existing service |
| Email templates inline | `email-templates.ts` | Phase 45 | Follow template pattern |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Portal components go in apps/web/src/components/portal/ | Project Structure | Low - directory exists, pattern established |
| A2 | Notification worker pattern follows alert-detection-worker.ts | Architecture | Low - established pattern in codebase |

## Open Questions

1. **Portal URL Structure**
   - What we know: CONTEXT.md shows `/portal/:clientId/...` structure
   - What's unclear: Currently `/portal/:token` validates then shows content - need redirect flow
   - Recommendation: After token validation, store clientId in session/cookie, redirect to `/portal/:clientId/dashboard`

2. **Notification Worker Process**
   - What we know: BullMQ workers exist in `/server/workers/`
   - What's unclear: Worker entry point registration pattern
   - Recommendation: Check `worker-entry.ts` for registration pattern

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All data | Present | - | - |
| Redis | BullMQ queues | Present | - | - |
| Resend API | Email notifications | Present | - | - |
| GSC OAuth | Dashboard data | Present | - | - |

**Missing dependencies with no fallback:** None identified.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | PortalTokenService (token validation) |
| V3 Session Management | Yes | Token expiry, revocation |
| V4 Access Control | Yes | clientId scoping on all queries |
| V5 Input Validation | Yes | Zod schemas for API inputs |
| V6 Cryptography | No | - |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration | Information Disclosure | nanoid 12-char tokens (72 bits entropy) |
| Cross-client data access | Elevation of Privilege | Always filter by clientId from validated token |
| Token replay | Spoofing | Access tracking, revocation support |
| Path traversal in email attachments | Tampering | Path validation in email.ts |

## Sources

### Primary (HIGH confidence)
- `open-seo-main/src/db/portal-schema.ts` - Examined full file
- `open-seo-main/src/server/services/PortalTokenService.ts` - Examined full file
- `open-seo-main/src/server/services/analytics/gsc-client.ts` - Examined full file
- `open-seo-main/src/routes/api/portal/` - Directory listing verified

### Secondary (MEDIUM confidence)
- `open-seo-main/src/server/queues/` - Pattern extrapolation from existing queues
- `apps/web/src/components/portal/` - Component pattern from existing files

## Metadata

**Confidence breakdown:**
- Existing infrastructure: HIGH - Direct codebase verification
- File paths: HIGH - Confirmed via file system
- Patterns: HIGH - Extracted from actual code

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable infrastructure, unlikely to change)
