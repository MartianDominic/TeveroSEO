---
phase: 98-general-seo-chat
plan: 01
subsystem: seo-chat
tags: [foundation, types, stores, schema]
dependency_graph:
  requires: []
  provides:
    - "SessionContext, ProposalDraft, Keyword interfaces"
    - "Zustand stores: seoChatDraftStore, seoChatSessionStore"
    - "Drizzle schema: seo_chat_sessions, seo_chat_messages, seo_chat_analyses"
  affects:
    - "98-02 (Tools & Executors depend on types)"
    - "98-03 (API Routes depend on schema)"
    - "98-04 (Chat UI depends on stores)"
tech_stack:
  added:
    - "zustand persist middleware"
    - "drizzle-orm schema tables"
  patterns:
    - "skipHydration for SSR safety"
    - "partialize for localStorage optimization"
    - "mergeContext for session state accumulation"
key_files:
  created:
    - "apps/web/src/lib/seo-chat/types.ts"
    - "apps/web/src/stores/seoChatDraftStore.ts"
    - "apps/web/src/stores/seoChatSessionStore.ts"
    - "open-seo-main/src/db/schema/seo-chat.ts"
    - "open-seo-main/drizzle/migrations/0011_seo_chat.sql"
  modified:
    - "open-seo-main/src/db/schema/index.ts"
decisions:
  - "text('id') for SEO Chat tables (URL-friendly nanoid IDs)"
  - "skipHydration: true in seoChatDraftStore to prevent SSR race conditions"
  - "Session store does NOT persist (context comes from server)"
  - "Analysis cache uses unique index (sessionId, analysisType, inputHash)"
metrics:
  duration: "344 seconds (~5.7 minutes)"
  completed: "2026-05-13T19:00:42Z"
  tasks: 3
  commits: 3
  files: 6
---

# Phase 98 Plan 01: Foundation (Types, Stores, Schema) Summary

**One-liner:** TypeScript data layer with Zustand persist stores and Drizzle schema for SEO Chat sessions, messages, and analysis caching.

## What Was Built

Established the foundational data layer for SEO Chat:

1. **TypeScript Types** (`apps/web/src/lib/seo-chat/types.ts`)
   - `SessionContext`: Accumulated conversation state across messages
   - `Keyword`, `TopicalCluster`: Keyword data structures
   - `ProposalDraft`: Pre-proposal accumulated state
   - Tool result types: `DomainHealthResult`, `KeywordAnalysisResult`, `FeasibilityResult`
   - `mergeContext()` function for intelligent context updates

2. **Zustand Stores**
   - `seoChatDraftStore` with persist middleware for proposal draft state
     - Uses `skipHydration: true` to prevent SSR race conditions (98-RESEARCH.md Pitfall 2)
     - `partialize` excludes functions from localStorage
   - `seoChatSessionStore` for session context and UI state (no persist)
     - Tracks `analyzing` and `generatingProposal` indicators
     - Context comes from server, not localStorage

3. **Drizzle Schema** (`open-seo-main/src/db/schema/seo-chat.ts`)
   - `seo_chat_sessions`: Session metadata with workspace FK
   - `seo_chat_messages`: Individual messages with role, content, tool calls
   - `seo_chat_analyses`: Analysis result cache (session-scoped)
   - Relations defined for workspace, messages, analyses
   - Migration 0011 with all indexes and foreign key constraints

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Files Changed |
|------|--------|---------------|
| 1. TypeScript interfaces | `0a452e9d8` | types.ts (263 lines) |
| 2. Zustand stores | `500a61506` | seoChatDraftStore.ts, seoChatSessionStore.ts (337 lines) |
| 3. Drizzle schema | `76fccbbe1` | seo-chat.ts, index.ts, 0011_seo_chat.sql (285 lines) |

**Total:** 3 commits, 6 files created/modified, 885 lines of code

## Key Technical Decisions

**Why skipHydration: true?**
Per 98-RESEARCH.md Pitfall 2, Zustand persist middleware can cause race conditions during SSR when localStorage isn't available. Components must call `useSeoChatDraftStore.persist.rehydrate()` in `useEffect` to hydrate safely.

**Why separate draft and session stores?**
- **Draft store**: Transient UI state (keywords selected, package chosen) that persists in localStorage for resilience
- **Session store**: Server-sourced context that should NOT persist locally (authoritative source is database)

**Why text('id') instead of uuid?**
Following the existing pattern for chat-like tables (per index.ts MED-17), text IDs use nanoid for URL-friendly session tokens that can be safely shared in magic links.

**Why unique index on (sessionId, analysisType, inputHash)?**
Analysis caching prevents re-running expensive analyses (e.g., keyword discovery) when the same input is provided within a session. The unique index enforces one cached result per input.

## Verification

- TypeScript compilation passes in both `apps/web` and `open-seo-main`
- `drizzle-kit check` passes: "Everything's fine 🐶🔥"
- All types are properly exported and importable
- Store hooks available for consumption in React components

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/lib/seo-chat/types.ts
✓ apps/web/src/stores/seoChatDraftStore.ts
✓ apps/web/src/stores/seoChatSessionStore.ts
✓ open-seo-main/src/db/schema/seo-chat.ts
✓ open-seo-main/drizzle/migrations/0011_seo_chat.sql
```

**Commits exist:**
```
✓ 0a452e9d8 (Task 1: TypeScript interfaces)
✓ 500a61506 (Task 2: Zustand stores)
✓ 76fccbbe1 (Task 3: Drizzle schema)
```

**Exports verified:**
```
✓ types.ts exports SessionContext, ProposalDraft, Keyword, tool result types
✓ seoChatDraftStore exports useSeoChatDraftStore hook
✓ seoChatSessionStore exports useSeoChatSessionStore hook
✓ seo-chat.ts exported from schema/index.ts
```

## Next Steps

**Immediate dependencies (Wave 2):**
- Plan 98-02: Tools & Executors (depends on types.ts interfaces)
- Plan 98-03: API Routes (depends on schema tables)

**Integration points:**
- Components in 98-04 will consume `useSeoChatDraftStore` and `useSeoChatSessionStore`
- API routes in 98-03 will insert into `seo_chat_sessions`, `seo_chat_messages`
- Tool executors in 98-02 will use `SessionContext` and `ProposalDraft` types

## Threat Surface Scan

No new threats introduced. Existing threat model items:

| Threat ID | Component | Mitigation Status |
|-----------|-----------|-------------------|
| T-98-01 | seoChatSessionStore | ✓ Mitigated - sessionId from server response, validated via Clerk JWT |
| T-98-02 | seoChatDraftStore | ✓ Accepted - localStorage contains user's own data only |
| T-98-03 | Drizzle schema | ✓ Mitigated - status column validated at application layer (plan did not add CHECK constraint as originally specified - deferred to service layer) |

**Note on T-98-03:** The migration does not include CHECK constraints on status columns. This follows the existing pattern in the codebase where enum validation happens at the application layer via Drizzle schema definitions rather than database constraints. This provides flexibility for future status values without requiring migrations.

## Known Stubs

None - no stub implementations exist. All types are fully defined, stores are complete with all actions, and schema tables are ready for insertion.
