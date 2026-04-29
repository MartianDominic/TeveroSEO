# GSD Plan: Phase 2 - Proposal System

> **Goal**: Complete proposal lifecycle from draft to sent to viewed to accepted/rejected.
> **Depends on**: Phase 1 component analysis (shared components identified)
> **Design System Reference**: `.planning/design/design-system-v6.md`
> **Architecture Reference**: `.planning/design/v8-agency-pipeline.md`

---

## Executive Summary

Phase 2 implements the complete proposal lifecycle for converting prospects into clients. The backend (open-seo-main) already has substantial infrastructure: database schema, state machine, view tracking, and follow-up email automation via Loops. The apps/web frontend has a proposal builder but lacks the send flow, client-facing view page, and integration with the existing backend services.

**Key Gap**: apps/web proposal UI is disconnected from open-seo-main proposal backend services.

---

## Current State Analysis

### Already Built (open-seo-main)

| Component | Location | Status |
|-----------|----------|--------|
| Proposal schema | `src/db/proposal-schema.ts` | Complete |
| State machine | `src/server/features/proposals/services/ProposalService.ts` | Complete |
| View tracking | `src/server/features/proposals/tracking/` | Complete |
| Engagement signals | `src/server/features/proposals/tracking/EngagementSignals.ts` | Complete |
| Follow-up emails | `src/server/features/proposals/automation/email.ts` | Complete (Loops) |
| Payment (Stripe) | `src/server/features/proposals/payment/` | Complete |
| Signing (Dokobit) | `src/server/features/proposals/signing/` | Complete |
| Onboarding | `src/server/features/proposals/onboarding/` | Complete |
| Email service | `src/server/lib/email.ts` | Complete (Resend) |

### Already Built (apps/web)

| Component | Location | Status |
|-----------|----------|--------|
| Proposal builder | `src/app/(shell)/prospects/[prospectId]/proposal/builder/` | Partial |
| Preview page | `src/app/(shell)/prospects/[prospectId]/proposal/preview/` | Partial |
| Server actions | `src/app/(shell)/prospects/[prospectId]/proposal/builder/actions.ts` | Partial |

### Missing (Critical for Phase 2)

| Feature | Priority |
|---------|----------|
| Send proposal flow (email integration) | Critical |
| Client-facing proposal page (public, token-based) | Critical |
| View tracking pixel/beacon | Critical |
| Accept/reject flow for clients | Critical |
| Proposal list view with status indicators | High |
| Activity logging to pipeline_activities | High |
| Follow-up reminder scheduling | Medium |

---

## State Machine Definition

The proposal state machine is already defined in `ProposalService.ts`:

```
DRAFT --> SENT --> VIEWED --> ACCEPTED --> SIGNED --> PAID --> ONBOARDED
              |          |          |
              v          v          v
           EXPIRED   DECLINED   DECLINED
```

**Valid Transitions** (enforced by `canTransition`):
- `draft` -> `sent`
- `sent` -> `viewed`, `expired`, `declined`
- `viewed` -> `accepted`, `expired`, `declined`
- `accepted` -> `signed`, `expired`, `declined`
- `signed` -> `paid`
- `paid` -> `onboarded`
- `onboarded` -> (terminal)
- `expired` -> (terminal)
- `declined` -> (terminal)

**Side Effects on Transition**:

| Transition | Side Effect |
|------------|-------------|
| draft -> sent | Set `sentAt`, generate token, set expiry (30 days), send email via Loops |
| sent -> viewed | Set `firstViewedAt`, create `proposal_views` record |
| viewed -> accepted | Set `acceptedAt`, trigger contract generation |
| viewed -> declined | Set `declinedReason`, `declinedNotes`, log activity |
| accepted -> signed | Set `signedAt`, create signature record, trigger invoice |
| signed -> paid | Set `paidAt`, trigger onboarding checklist |
| paid -> onboarded | Trigger client conversion |

---

## API Routes

### Backend Routes (open-seo-main)

Most routes exist but need enhancement for apps/web integration.

#### Existing Routes

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/proposals/generate` | Generate proposal from prospect | Agency |
| GET | `/api/proposals/:proposalId` | Get proposal details | Agency |
| PATCH | `/api/proposals/:proposalId/sections` | Update section content | Agency |
| POST | `/api/proposals/:proposalId/generate` | Regenerate section | Agency |
| GET | `/api/proposals/analytics` | Get engagement analytics | Agency |
| POST | `/api/proposals/stage` | Change proposal stage | Agency |
| POST | `/api/proposals/:proposalId/decline` | Record decline reason | Public (token) |

#### New Routes Required

| Method | Path | Purpose | Auth | Priority |
|--------|------|---------|------|----------|
| POST | `/api/proposals/:proposalId/send` | Send proposal via email | Agency | Critical |
| GET | `/api/p/:token` | Client-facing proposal view | Public | Critical |
| POST | `/api/p/:token/view` | Record view event (beacon) | Public | Critical |
| POST | `/api/p/:token/accept` | Client accepts proposal | Public | Critical |
| POST | `/api/p/:token/reject` | Client rejects proposal | Public | Critical |
| GET | `/api/proposals` | List proposals with filters | Agency | High |
| GET | `/api/proposals/:proposalId/activities` | Get activity log | Agency | Medium |

### Frontend Routes (apps/web)

#### New Pages Required

| Path | Purpose | Priority |
|------|---------|----------|
| `/proposals` | Proposal list with status filters | High |
| `/proposals/[proposalId]` | Proposal detail view | High |
| `/p/[token]` | Client-facing proposal page (public) | Critical |
| `/p/[token]/accepted` | Post-acceptance thank you | Critical |
| `/p/[token]/declined` | Post-decline feedback | Critical |

---

## Detailed Implementation Tasks

### Task 1: Send Proposal API Route

**Priority**: Critical
**Depends on**: None
**Effort**: 4 hours

**File**: `open-seo-main/src/routes/api/proposals/$proposalId.send.ts`

**Request Schema**:
```typescript
const sendProposalSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1).max(200).optional(),
  customMessage: z.string().max(2000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
});
```

**Response Schema**:
```typescript
interface SendProposalResponse {
  success: boolean;
  data: {
    proposalId: string;
    token: string;
    sentAt: string;
    expiresAt: string;
    publicUrl: string;
  };
}
```

**Implementation**:
1. Validate proposal exists and is in `draft` status
2. Validate workspace ownership
3. Call `ProposalService.markSent()` to transition state
4. Generate public URL: `https://app.tevero.io/p/{token}`
5. Send email via Loops transactional API with proposal link
6. Log activity to `pipeline_activities`
7. Return public URL and metadata

**Side Effects**:
- Email sent to recipient
- Proposal status changed to `sent`
- `sentAt` timestamp set
- Activity logged

---

### Task 2: Client-Facing Proposal Page (Backend)

**Priority**: Critical
**Depends on**: Task 1
**Effort**: 4 hours

**File**: `open-seo-main/src/routes/api/p.$token.ts`

**Implementation**:
1. Parse token from URL
2. Call `ProposalService.findByToken()` to get proposal
3. Check if expired (throw 410 Gone if so)
4. Return proposal content for rendering:
   - Hero section data
   - Current state metrics
   - Opportunities list
   - ROI calculator data
   - Investment pricing
   - Brand config (colors, logo)
5. Do NOT record view here (use beacon endpoint instead)

**Response Schema**:
```typescript
interface PublicProposalResponse {
  success: boolean;
  data: {
    id: string;
    status: ProposalStatus;
    content: ProposalContent;
    brandConfig: BrandConfig;
    setupFeeCents: number;
    monthlyFeeCents: number;
    currency: string;
    expiresAt: string;
    prospect: {
      companyName: string;
      domain: string;
    };
  };
}
```

---

### Task 3: View Tracking Beacon Endpoint

**Priority**: Critical
**Depends on**: Task 2
**Effort**: 3 hours

**File**: `open-seo-main/src/routes/api/p.$token.view.ts`

**Request Schema**:
```typescript
const recordViewSchema = z.object({
  deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
  sectionsViewed: z.array(z.string()).max(20).optional(),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  roiCalculatorUsed: z.boolean().optional(),
});
```

**Implementation**:
1. Parse token, get proposal via `findByToken()`
2. Hash client IP (SHA-256 with salt)
3. Detect device type from User-Agent
4. Call `ProposalService.recordView()` which:
   - Creates `proposal_views` record
   - Updates `firstViewedAt` if first view
   - Transitions status to `viewed` if first view
5. Return 204 No Content

**Security**:
- Rate limit: 10 requests/minute per IP
- IP hashing: SHA-256 with environment salt
- No PII stored

---

### Task 4: Accept Proposal Endpoint

**Priority**: Critical
**Depends on**: Task 3
**Effort**: 3 hours

**File**: `open-seo-main/src/routes/api/p.$token.accept.ts`

**Request Schema**:
```typescript
const acceptProposalSchema = z.object({
  acceptorName: z.string().min(1).max(200),
  acceptorEmail: z.string().email(),
  acceptorTitle: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});
```

**Implementation**:
1. Parse token, get proposal via `findByToken()`
2. Validate proposal is in `viewed` status
3. Call `ProposalService.markAccepted()` to transition state
4. Log activity with acceptor details
5. Trigger notification to agency (webhook or email)
6. Return success with next steps

**Response Schema**:
```typescript
interface AcceptProposalResponse {
  success: boolean;
  data: {
    proposalId: string;
    acceptedAt: string;
    nextSteps: string[];
  };
}
```

---

### Task 5: Reject Proposal Endpoint

**Priority**: Critical
**Depends on**: Task 3
**Effort**: 2 hours

**File**: `open-seo-main/src/routes/api/p.$token.reject.ts`

**Request Schema** (already exists in `$proposalId.decline.ts`, reuse):
```typescript
const declineSchema = z.object({
  reason: z.enum([
    "budget",
    "timing",
    "competitor",
    "scope",
    "other",
  ]),
  notes: z.string().max(2000).optional(),
});
```

**Implementation**:
1. Parse token, get proposal via `findByToken()`
2. Validate proposal is in `sent` or `viewed` status
3. Update proposal with `declinedReason` and `declinedNotes`
4. Transition to `declined` status
5. Log activity
6. Return confirmation

---

### Task 6: Client-Facing Proposal Page (Frontend)

**Priority**: Critical
**Depends on**: Tasks 2, 3
**Effort**: 8 hours

**Files**:
- `apps/web/src/app/p/[token]/page.tsx` - Main proposal page
- `apps/web/src/app/p/[token]/layout.tsx` - Public layout (no auth)
- `apps/web/src/app/p/[token]/components/` - Proposal components

**Components** (reference design-system-v6.md):

1. **ProposalHero** - Hero section with headline, value prop
   - Newsreader display numerals for traffic value (`--num-mega`)
   - Brand colors from `brandConfig`
   - Ghost-edge shadow card (section 4.1)

2. **CurrentStateCard** - Current metrics with chart
   - Traffic/keywords/value KPIs (`--num-card`)
   - Sparkline chart for trend
   - Hover-to-reveal details (section 11)

3. **OpportunitiesTable** - Keyword opportunities
   - CSS Grid layout (section 8.1)
   - Difficulty pills with semantic colors (section 6.2)
   - Priority row indicator (section 8.3)

4. **ROICalculator** - Interactive calculator
   - Input fields for conversion rate, AOV
   - Real-time calculation
   - Tabular numerals (`tabular-nums lining-nums`)

5. **InvestmentCard** - Pricing breakdown
   - Setup fee + monthly fee
   - Inclusions list
   - Currency formatting

6. **NextStepsCard** - Call-to-action
   - Accept/Decline buttons
   - Primary CTA styling (section 5.2)

7. **ViewTrackingBeacon** - Hidden component
   - Sends view beacon on mount
   - Tracks section visibility via Intersection Observer
   - Debounced updates

**Page Layout**:
```
+----------------------------------------------------------+
|  [Logo]              [Company Name]                       |
+----------------------------------------------------------+
|                                                           |
|  HERO: Headline + Value Proposition                       |
|        Traffic Value: EUR 12,500/mo potential             |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  CURRENT STATE         |  OPPORTUNITIES                   |
|  - Traffic: 5,200      |  +-----------------------------+ |
|  - Keywords: 847       |  | Keyword | Vol | Diff | Pot  | |
|  - Value: EUR 4,100    |  | ...     | ... | ...  | ...  | |
|                        |  +-----------------------------+ |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  ROI CALCULATOR                                           |
|  +-----------------+  +-----------------+                 |
|  | Conv Rate: 2%   |  | AOV: EUR 150    |                 |
|  +-----------------+  +-----------------+                 |
|                                                           |
|  Projected Revenue: EUR 45,000/year                       |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  INVESTMENT                                               |
|  Setup: EUR 2,500 | Monthly: EUR 1,500                    |
|                                                           |
|  Includes:                                                |
|  - Technical SEO audit                                    |
|  - Content optimization                                   |
|  - Monthly reporting                                      |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  NEXT STEPS                                               |
|                                                           |
|  [Accept Proposal]  [Decline]                             |
|                                                           |
+----------------------------------------------------------+
```

---

### Task 7: Send Flow UI in apps/web

**Priority**: Critical
**Depends on**: Task 1
**Effort**: 4 hours

**Files**:
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/send/page.tsx`
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/send/actions.ts`
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/send/components/SendForm.tsx`

**SendForm Component**:
```typescript
interface SendFormProps {
  proposalId: string;
  prospectEmail?: string;
  prospectName?: string;
}

// Fields
- recipientEmail (pre-filled from prospect)
- recipientName (pre-filled from prospect)
- customMessage (optional, textarea)
- expiresInDays (select: 7, 14, 30, 60, 90)
```

**Flow**:
1. Preview proposal summary
2. Enter recipient details
3. Add custom message (optional)
4. Set expiration
5. Send button -> calls `/api/proposals/:id/send`
6. Success: show confirmation with public link
7. Copy link to clipboard option

---

### Task 8: Proposal List Page

**Priority**: High
**Depends on**: None
**Effort**: 6 hours

**Files**:
- `apps/web/src/app/(shell)/proposals/page.tsx`
- `apps/web/src/app/(shell)/proposals/components/ProposalCard.tsx`
- `apps/web/src/app/(shell)/proposals/components/ProposalFilters.tsx`
- `apps/web/src/actions/proposals.ts`

**ProposalCard Design** (reference design-system-v6.md section 4, v8-agency-pipeline.md):

```
+----------------------------------------------------------+
| [Status Indicator] Acme Corp         $4,500/mo  [Actions] |
| Sent Apr 25 | 3 views | Last: Apr 29 14:22                |
+----------------------------------------------------------+
```

**Status Indicators** (reference section 6.1):
- Draft: `bg-zinc-100` + gray dot
- Sent: `bg-amber-50` + amber dot
- Viewed: `bg-blue-50` + blue dot (with view count)
- Accepted: `bg-emerald-50` + green check
- Declined: `bg-red-50` + red X

**Filters**:
- Status dropdown (All, Draft, Sent, Viewed, Accepted, Declined)
- Search by company name/domain
- Sort by: Recent, Value (high-low), Last Activity

**Pagination**: 20 items per page, load more pattern

---

### Task 9: Activity Logging Infrastructure

**Priority**: High
**Depends on**: Tasks 1-5
**Effort**: 4 hours

**Files**:
- `open-seo-main/src/db/activity-schema.ts` (new)
- `open-seo-main/src/server/features/activities/ActivityService.ts` (new)

**Schema** (from v8-agency-pipeline.md):
```typescript
export const pipelineActivities = pgTable("pipeline_activities", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'prospect', 'proposal', 'contract'
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // 'created', 'sent', 'viewed', 'accepted'
  actorType: text("actor_type"), // 'system', 'user', 'client'
  actorId: text("actor_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ix_activities_entity").on(table.entityType, table.entityId),
  index("ix_activities_created").on(table.createdAt),
]);
```

**Activity Types**:
- `proposal.created`
- `proposal.sent`
- `proposal.viewed`
- `proposal.accepted`
- `proposal.declined`
- `proposal.expired`

**Integration Points**:
- Hook into `ProposalService.markSent()`
- Hook into `ProposalService.recordView()`
- Hook into `ProposalService.markAccepted()`
- Hook into decline endpoint

---

### Task 10: Follow-up Reminder Scheduling

**Priority**: Medium
**Depends on**: Tasks 1, 3
**Effort**: 4 hours

**Files**:
- `open-seo-main/src/server/features/proposals/automation/scheduler.ts`
- `open-seo-main/src/server/jobs/proposal-followups.ts`

**Implementation**:
Use existing BullMQ infrastructure for scheduling:

1. **On Send**: Schedule reminder job for 3 days later
   - Job type: `proposal_reminder`
   - Delay: 72 hours
   - Cancel if viewed before trigger

2. **On First View**: Schedule follow-up for 5 days later
   - Job type: `any_questions`
   - Delay: 120 hours
   - Cancel if accepted/declined before trigger

3. **Job Handler**:
   - Check current proposal status
   - If still in `sent` status, send reminder email
   - If in `viewed` status, send "any questions" email
   - Use existing `sendFollowUpEmail()` from automation/email.ts

**BullMQ Queue Config**:
```typescript
const followupQueue = new Queue("proposal-followups", {
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60000, // 1 minute
    },
  },
});
```

---

### Task 11: Accept/Decline UI Pages

**Priority**: Critical
**Depends on**: Tasks 4, 5
**Effort**: 4 hours

**Files**:
- `apps/web/src/app/p/[token]/accepted/page.tsx`
- `apps/web/src/app/p/[token]/declined/page.tsx`
- `apps/web/src/app/p/[token]/components/AcceptModal.tsx`
- `apps/web/src/app/p/[token]/components/DeclineModal.tsx`

**AcceptModal**:
- Name (required)
- Email (required)
- Title (optional)
- Notes (optional)
- "Accept & Continue" button

**DeclineModal**:
- Reason select (Budget, Timing, Competitor, Scope, Other)
- Notes textarea (optional)
- "Submit Feedback" button

**Accepted Page**:
- Thank you message
- "What's next" steps
- Contact information

**Declined Page**:
- Confirmation message
- "Change your mind?" link back to proposal

---

### Task 12: Proposal Preview Enhancement

**Priority**: High
**Depends on**: Task 6
**Effort**: 3 hours

**Files**:
- `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/preview/page.tsx` (update)

**Enhancements**:
1. Render proposal using same components as client-facing page
2. Add "Send Proposal" button (links to send flow)
3. Add "Edit" button (links back to builder)
4. Add "Copy Preview Link" (for internal sharing)
5. Show proposal status indicator

---

## Component Mapping to Design System

| Component | Design System Reference | Notes |
|-----------|------------------------|-------|
| ProposalCard | Section 4.1 (Card Primitive) + 10.2 (Today Feed) | Ghost-edge shadow, timestamp relative |
| StatusIndicator | Section 6.1 (Status Pill) | Small-caps, semantic colors |
| ProposalHero | Section 7.1 (Goal Hero Progress Block) | Newsreader numerals, accent color |
| OpportunitiesTable | Section 8.1 (Table Layout) | CSS Grid, hover state |
| DifficultyPill | Section 6.2 (Effort/Impact Pills) | Semantic coloring |
| ROICalculator | Section 6 (Form Patterns) | Input styling, live update |
| CTAButton | Section 5.2 (Primary Button) | Gradient + glow shadow |
| ActivityFeed | Section 10.2 (Today Feed) | Timestamp + action + metadata |

---

## Email Integration

**Provider**: Loops (transactional API)
- Already configured in `open-seo-main/src/server/features/proposals/automation/email.ts`
- Templates: `proposal-{template}` transactional IDs

**Proposal Send Email**:
```typescript
interface ProposalSendEmailParams {
  to: string;
  companyName: string;
  proposalUrl: string;
  recipientName?: string;
  customMessage?: string;
  senderName: string;
  senderCompany: string;
}
```

**Email Content** (Lithuanian, matching existing templates):
- Subject: `SEO pasiulymas jusu imonei {companyName}`
- Body: Custom message + proposal link + expiry notice

**Tracking**:
- Loops provides open/click tracking
- Additional view beacon on page load for precise timing

---

## Testing Requirements

### Unit Tests

| Test | Location | Coverage |
|------|----------|----------|
| State machine transitions | `ProposalService.test.ts` | All valid/invalid transitions |
| Token generation | `ProposalService.test.ts` | Uniqueness, length |
| View recording | `ViewTrackingService.test.ts` | First view, subsequent views |
| Email generation | `automation/email.test.ts` | All templates |

### Integration Tests

| Test | Description |
|------|-------------|
| Send flow | Create draft -> send -> verify email sent |
| View flow | Access token URL -> verify view recorded |
| Accept flow | View -> accept -> verify status change |
| Decline flow | View -> decline -> verify feedback stored |
| Expiration | Send -> wait -> verify expired status |

### E2E Tests

| Flow | Steps |
|------|-------|
| Happy path | Create prospect -> generate proposal -> send -> accept |
| Decline path | Create prospect -> generate proposal -> send -> decline |
| Reminder flow | Send -> no view -> verify reminder scheduled |

---

## Success Criteria

1. Agency user can send proposal from builder preview
2. Client receives email with unique proposal link
3. Client can view proposal without authentication
4. View is tracked with device type, duration, sections
5. Client can accept proposal (triggers notification)
6. Client can decline proposal (with feedback)
7. Proposal list shows all proposals with status filtering
8. Follow-up reminders are sent automatically
9. All state transitions are logged to activity feed

---

## Dependencies

### External Services

| Service | Purpose | Env Var |
|---------|---------|---------|
| Loops | Transactional email | `LOOPS_API_KEY` |
| Resend | Report emails (backup) | `RESEND_API_KEY` |

### Internal Services

| Service | Purpose |
|---------|---------|
| ProposalService | Core proposal CRUD |
| ProspectService | Prospect data |
| BullMQ | Job scheduling |

---

## File Summary

### New Files (open-seo-main)

1. `src/routes/api/proposals/$proposalId.send.ts`
2. `src/routes/api/p.$token.ts`
3. `src/routes/api/p.$token.view.ts`
4. `src/routes/api/p.$token.accept.ts`
5. `src/routes/api/p.$token.reject.ts`
6. `src/db/activity-schema.ts`
7. `src/server/features/activities/ActivityService.ts`
8. `src/server/features/proposals/automation/scheduler.ts`
9. `src/server/jobs/proposal-followups.ts`

### New Files (apps/web)

1. `src/app/p/[token]/page.tsx`
2. `src/app/p/[token]/layout.tsx`
3. `src/app/p/[token]/accepted/page.tsx`
4. `src/app/p/[token]/declined/page.tsx`
5. `src/app/p/[token]/components/ProposalHero.tsx`
6. `src/app/p/[token]/components/CurrentStateCard.tsx`
7. `src/app/p/[token]/components/OpportunitiesTable.tsx`
8. `src/app/p/[token]/components/ROICalculator.tsx`
9. `src/app/p/[token]/components/InvestmentCard.tsx`
10. `src/app/p/[token]/components/NextStepsCard.tsx`
11. `src/app/p/[token]/components/ViewTrackingBeacon.tsx`
12. `src/app/p/[token]/components/AcceptModal.tsx`
13. `src/app/p/[token]/components/DeclineModal.tsx`
14. `src/app/(shell)/prospects/[prospectId]/proposal/send/page.tsx`
15. `src/app/(shell)/prospects/[prospectId]/proposal/send/actions.ts`
16. `src/app/(shell)/prospects/[prospectId]/proposal/send/components/SendForm.tsx`
17. `src/app/(shell)/proposals/page.tsx`
18. `src/app/(shell)/proposals/components/ProposalCard.tsx`
19. `src/app/(shell)/proposals/components/ProposalFilters.tsx`
20. `src/actions/proposals.ts`

### Modified Files

1. `apps/web/src/app/(shell)/prospects/[prospectId]/proposal/preview/page.tsx`
2. `open-seo-main/src/server/features/proposals/services/ProposalService.ts` (add activity logging)

---

## Effort Estimate

| Task | Hours |
|------|-------|
| Task 1: Send Proposal API | 4 |
| Task 2: Client Proposal Page (Backend) | 4 |
| Task 3: View Tracking Beacon | 3 |
| Task 4: Accept Proposal Endpoint | 3 |
| Task 5: Reject Proposal Endpoint | 2 |
| Task 6: Client Proposal Page (Frontend) | 8 |
| Task 7: Send Flow UI | 4 |
| Task 8: Proposal List Page | 6 |
| Task 9: Activity Logging | 4 |
| Task 10: Follow-up Scheduling | 4 |
| Task 11: Accept/Decline UI | 4 |
| Task 12: Preview Enhancement | 3 |
| **Total** | **49 hours** |

---

## Implementation Order

```
Phase 2 Execution Order
=======================

Week 1: Core Backend (16 hours)
  [x] Task 1: Send Proposal API
  [x] Task 2: Client Proposal Page (Backend)
  [x] Task 3: View Tracking Beacon
  [x] Task 4: Accept Proposal Endpoint
  [x] Task 5: Reject Proposal Endpoint

Week 2: Client-Facing UI (12 hours)
  [ ] Task 6: Client Proposal Page (Frontend)
  [ ] Task 11: Accept/Decline UI Pages

Week 3: Agency UI (17 hours)
  [ ] Task 7: Send Flow UI
  [ ] Task 8: Proposal List Page
  [ ] Task 12: Preview Enhancement

Week 4: Automation & Polish (8 hours)
  [ ] Task 9: Activity Logging
  [ ] Task 10: Follow-up Scheduling
```

---

*Created: 2026-04-29*
*Last Updated: 2026-04-29*
