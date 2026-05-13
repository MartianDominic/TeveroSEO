---
phase: 98-general-seo-chat
plan: 07
subsystem: seo-chat
tags: [proposal-portal, magic-links, slide-over, public-route]
dependency_graph:
  requires:
    - "98-03 (API routes, proposals schema)"
    - "98-05 (tool result cards)"
  provides:
    - "ProposalSlideOver component for agency preview"
    - "/p/[token] unified route for SEO Chat + legacy proposals"
    - "Magic link validation and view tracking"
  affects:
    - "98-08 (Chat page will use ProposalSlideOver)"
tech_stack:
  added:
    - "Custom slide-over pattern (Sheet component not available)"
  patterns:
    - "Co-located view components in route file"
    - "Unified route handler for multiple proposal systems"
    - "Fire-and-forget view tracking"
    - "nanoid(32) token validation"
key_files:
  created:
    - "apps/web/src/lib/seo-chat/prospect-portal.ts"
    - "apps/web/src/components/seo-chat/ProposalSlideOver.tsx"
    - "apps/web/src/app/p/[token]/SeoChatProposalView.tsx"
    - "apps/web/src/app/p/[token]/layout.tsx"
  modified:
    - "apps/web/src/db/schema/seo-chat.ts"
    - "apps/web/src/app/p/[token]/page.tsx"
decisions:
  - "Added proposals and proposalViews tables to schema (missing from 98-03)"
  - "Custom slide-over implementation (Sheet component not in UI library)"
  - "Unified /p/[token] route handles both SEO Chat and legacy proposals"
  - "Try SEO Chat validation first, fall back to legacy API"
  - "View tracking uses fire-and-forget pattern (non-blocking)"
  - "SeoChatProposalView separated from co-located components for cleaner separation"
metrics:
  duration: "482 seconds (~8 minutes)"
  completed: "2026-05-13T20:03:38Z"
  tasks: 3
  commits: 3
  files: 7
---

# Phase 98 Plan 07: Proposal Portal Summary

**One-liner:** Proposal slide-over for agency preview and unified /p/[token] public portal supporting both SEO Chat and legacy proposals with magic link validation.

## What Was Built

Created the complete proposal portal system for SEO Chat:

### 1. Proposals Database Schema

**proposals table:**
- id, sessionId, workspaceId, domain, package
- keywords (JSONB array), analysisResults (JSONB)
- narrative (AI-generated text)
- magicLinkToken (unique, indexed)
- status (generated, sent, viewed, converted)
- viewedAt, expiresAt timestamps

**proposalViews table:**
- Analytics tracking with userAgent, ipAddress, referrer
- Foreign key to proposals with cascade delete

**Why added:** Plan 98-03 created proposal.ts service but didn't add the database schema. This is critical functionality for storing proposals (Rule 2 deviation).

### 2. Magic Link Validation Utilities

**validateMagicLink():**
- Validates nanoid(32) token format
- Fetches proposal from database
- Checks expiration
- Returns validation result with proposal data or error

**trackProposalView():**
- Updates proposal status to 'viewed'
- Inserts view event with metadata
- Fire-and-forget pattern (non-blocking)
- Handles errors gracefully

**ProposalData interface:**
- Normalized proposal data for portal rendering
- Includes workspace name, logo (TODO: join with workspace table)
- Domain health, keywords, package, timestamps

### 3. ProposalSlideOver Component

**Custom slide-over implementation:**
- Fixed positioning with backdrop
- Escape key handling
- Close button + click-outside-to-close

**Content sections:**
- Package selection with name, description, price
- Domain health (DA, DR, summary)
- Keywords list with volume and feasibility badges
- Feasibility summary (feasible vs challenging counts)

**Actions:**
- Copy link button with success feedback
- Preview button (opens in new tab)
- Send proposal button with loading state

**Why custom:** Sheet component not available in UI library. Created custom slide-over using fixed positioning, backdrop, and transitions.

### 4. Unified Prospect Portal Route

**/p/[token] route structure:**
```
apps/web/src/app/p/[token]/
├── layout.tsx        # Gradient background, noindex meta
├── page.tsx          # Unified route handler
└── SeoChatProposalView.tsx  # SEO Chat proposal display
```

**Unified route handler logic:**
1. Validate token format (32 char nanoid)
2. Try SEO Chat validation first (validateMagicLink)
3. If SEO Chat proposal found → render SeoChatProposalView
4. Fall back to legacy proposal API
5. If neither found → 404

**Why unified:** Existing /p/[token] route served legacy proposals (Phase 57-08). Extended to support both systems without breaking existing functionality. SEO Chat proposals checked first, legacy as fallback.

**SeoChatProposalView components:**
- Domain health metrics (DA, DR, traffic)
- Keywords list with volume and feasibility
- Package details with features and pricing
- CTA button (Schedule a Call)
- Footer with creation and expiry dates

### 5. View Tracking

**Server-side tracking:**
- Fires on page load (fire-and-forget)
- Captures user agent and referrer
- Updates proposal status on first view
- Logs view event to proposalViews table

**Non-blocking design:**
- Tracking errors don't affect page render
- Promise not awaited
- Errors caught and logged only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added proposals database schema**
- **Found during:** Task 1
- **Issue:** Plan 98-03 created proposal service but didn't add proposals/proposalViews tables to schema
- **Fix:** Added both tables to apps/web/src/db/schema/seo-chat.ts with proper indexes, relations, and types
- **Files modified:** `apps/web/src/db/schema/seo-chat.ts`
- **Commit:** 511fa52c8

**2. [Rule 2 - Missing UI Component] Custom slide-over implementation**
- **Found during:** Task 2
- **Issue:** Plan assumed Sheet component existed in UI library, but it doesn't
- **Fix:** Created custom slide-over using fixed positioning, backdrop, escape key handling, and transitions
- **Files created:** `apps/web/src/components/seo-chat/ProposalSlideOver.tsx`
- **Commit:** d075ce0c2

**3. [Rule 2 - Route Conflict] Unified route handler for multiple proposal systems**
- **Found during:** Task 3
- **Issue:** /p/[token] already exists for legacy proposals (Phase 57-08); creating new route would break existing functionality
- **Fix:** Extended existing route to try SEO Chat validation first, fall back to legacy API; separated SEO Chat view into SeoChatProposalView component
- **Files modified:** `apps/web/src/app/p/[token]/page.tsx`
- **Files created:** `apps/web/src/app/p/[token]/SeoChatProposalView.tsx`, `apps/web/src/app/p/[token]/layout.tsx`
- **Commit:** 3aed1fab6

## Commits

| Task | Commit | Files Changed | Description |
|------|--------|---------------|-------------|
| 1. Magic link utilities | `511fa52c8` | prospect-portal.ts, seo-chat.ts | Validation, tracking, proposals schema |
| 2. Slide-over component | `d075ce0c2` | ProposalSlideOver.tsx | Custom slide-over with preview and send actions |
| 3. Prospect portal route | `3aed1fab6` | page.tsx, SeoChatProposalView.tsx, layout.tsx | Unified route handler, SEO Chat view |

**Total:** 3 commits, 6 files created, 2 files modified

## Key Technical Decisions

**Why add proposals schema in this plan, not 98-03?**
Plan 98-03 created proposal.ts service with stub implementations but didn't add the database schema. This plan discovered the missing schema when implementing validateMagicLink. Added immediately as Rule 2 deviation (missing critical functionality).

**Why custom slide-over instead of Dialog/Modal?**
Neither Sheet nor Dialog components exist in the UI library. Created custom implementation using fixed positioning, backdrop, and CSS transitions. Follows same pattern as ClientSwitchOverlay (existing overlay component).

**Why unified route instead of separate /seo-chat/p/[token]?**
Both proposal systems use 32-char nanoid tokens with the same format. Unified route provides better UX (single URL pattern) and avoids confusion. SEO Chat validation tried first (local DB query), falls back to legacy API if not found. Clean separation via SeoChatProposalView component.

**Why fire-and-forget view tracking?**
View tracking is analytics, not critical path. Non-blocking pattern ensures page renders quickly even if tracking fails. Errors are logged but don't affect user experience.

**Why nanoid(32) validation in validateMagicLink?**
Validates token format before database query (fail fast). Regex check prevents SQL injection attempts and invalid tokens from hitting the database. 32-char nanoid provides 10^57 entropy per SPEC.md Section 5.10.

## Verification

- TypeScript compilation passes for all new files
- ProposalSlideOver renders with draft data from seoChatDraftStore
- validateMagicLink checks token format, expiration, and database
- /p/[token] tries SEO Chat first, falls back to legacy
- View tracking fires on page load without blocking render
- Layout has noindex meta tag to prevent indexing

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/lib/seo-chat/prospect-portal.ts
✓ apps/web/src/components/seo-chat/ProposalSlideOver.tsx
✓ apps/web/src/app/p/[token]/SeoChatProposalView.tsx
✓ apps/web/src/app/p/[token]/layout.tsx
```

**Modified files exist:**
```
✓ apps/web/src/db/schema/seo-chat.ts
✓ apps/web/src/app/p/[token]/page.tsx
```

**Commits exist:**
```
✓ 511fa52c8 (Task 1: Magic link utilities)
✓ d075ce0c2 (Task 2: Slide-over component)
✓ 3aed1fab6 (Task 3: Prospect portal route)
```

**Exports verified:**
```
✓ prospect-portal.ts exports validateMagicLink, trackProposalView, ProposalData, MagicLinkValidation
✓ ProposalSlideOver.tsx exports ProposalSlideOver function component
✓ SeoChatProposalView.tsx exports SeoChatProposalView function component
✓ page.tsx default exports PublicProposalPage
```

## Next Steps

**Immediate dependencies (Wave 5):**
- Plan 98-08: Chat Page Routes (will use ProposalSlideOver to preview proposals)

**Integration points:**
- Chat UI will call ProposalSlideOver when user generates proposal
- Magic links created by POST /api/seo-chat/proposals/generate (98-03)
- Prospects receive links via email (future: email sending service)

**Future enhancements:**
- Join workspace table for agency logo and branding
- Add payment integration to CTA button
- Email delivery service for magic links
- Proposal analytics dashboard
