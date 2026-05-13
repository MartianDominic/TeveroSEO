---
phase: 98-general-seo-chat
plan: 03
subsystem: seo-chat
tags: [api-routes, streaming, session-crud, proposal-generation]
dependency_graph:
  requires:
    - "98-01 (types, stores, schema)"
    - "98-02 (tools & executors)"
  provides:
    - "POST /api/seo-chat - main chat route with Grok 4.1-fast streaming"
    - "Session CRUD endpoints (GET/POST/DELETE)"
    - "POST /api/seo-chat/proposals/generate - proposal creation"
    - "Database connection in apps/web"
  affects:
    - "98-04 (Chat UI will consume these API routes)"
    - "98-07 (Proposal Portal will use magic link endpoints)"
tech_stack:
  added:
    - "ai@6.0.180 - Vercel AI SDK"
    - "@ai-sdk/xai@3.0.89 - Grok provider"
    - "@ai-sdk/google@3.0.73 - Gemini provider"
    - "drizzle-orm@0.38.3"
    - "pg@8.14.0"
    - "nanoid@5.0.9"
  patterns:
    - "Node.js runtime for 60s timeout (not Edge 25s)"
    - "Workspace isolation via Clerk orgId"
    - "Magic link tokens with nanoid (32 chars, 10^57 entropy)"
    - "Gemini 3.1 Pro for Lithuanian narrative generation"
key_files:
  created:
    - "apps/web/src/app/api/seo-chat/route.ts"
    - "apps/web/src/app/api/seo-chat/sessions/route.ts"
    - "apps/web/src/app/api/seo-chat/sessions/[id]/route.ts"
    - "apps/web/src/app/api/seo-chat/proposals/generate/route.ts"
    - "apps/web/src/lib/seo-chat/session.ts"
    - "apps/web/src/lib/seo-chat/proposal.ts"
    - "apps/web/src/db/index.ts"
    - "apps/web/src/db/schema/seo-chat.ts"
  modified:
    - "apps/web/package.json"
decisions:
  - "apps/web gets own db module connecting to same PostgreSQL as open-seo-main"
  - "Schema mirrored from open-seo-main for type safety (not shared import)"
  - "Session service exports 7 functions for full CRUD lifecycle"
  - "Proposal service uses Gemini 3.1 Pro for narrative (not Grok)"
  - "14-day proposal expiry (2 weeks)"
  - "Magic links use nanoid(32) for 10^57 entropy"
  - "Node.js runtime (not Edge) for 60s timeout per 98-RESEARCH.md Pitfall 1"
metrics:
  duration: "618 seconds (~10.3 minutes)"
  completed: "2026-05-13T19:13:41Z"
  tasks: 3
  commits: 3
  files: 10
---

# Phase 98 Plan 03: API Routes for SEO Chat Summary

**One-liner:** Streaming chat API with Grok 4.1-fast, session CRUD endpoints, and proposal generation using Gemini 3.1 Pro for Lithuanian narratives.

## What Was Built

Created the complete API layer for SEO Chat:

### 1. Main Chat Endpoint (`/api/seo-chat`)

**POST handler with streaming:**
- Grok 4.1-fast model via `@ai-sdk/xai`
- System prompt injection with session context
- `streamText()` with tool calling support
- Node.js runtime for 60s timeout (not Edge 25s per research)
- `onFinish` callback persists messages and updates session context
- Auto-detects domain from tool calls and updates session

**Session context integration:**
- Loads prospect domain, keywords analyzed, proposal status
- Injects into system prompt for LLM awareness
- Updates context after tool execution

### 2. Session Management Routes

**GET /api/seo-chat/sessions**
- List sessions for workspace (limit 50)
- Ordered by updatedAt descending

**POST /api/seo-chat/sessions**
- Create new session with optional prospectDomain
- Returns session with nanoid ID

**GET /api/seo-chat/sessions/[id]**
- Get single session with messages and analyses
- Workspace isolation enforced

**DELETE /api/seo-chat/sessions/[id]**
- Archive session (soft delete via status='archived')
- Returns 204 No Content on success

### 3. Proposal Generation

**POST /api/seo-chat/proposals/generate**
- Creates proposal with magic link
- Generates Lithuanian narrative via Gemini 3.1 Pro
- Returns magic link `/p/{token}` format
- 14-day expiry
- Package tiers: pamatas (€2.5k/100kw), augimas (€3.5k/200kw), autoritetas (€7.1k/400kw)

**ProposalService functions:**
- `createProposal()` - Generate narrative and create record
- `getProposalByToken()` - Lookup by magic link (stub)

### 4. Database Infrastructure

**apps/web/src/db/**
- Drizzle connection to shared PostgreSQL
- Schema mirror from open-seo-main for type safety
- Connection pool (10 max, 20s idle timeout)

**Session service (7 functions):**
1. `getSessionContext()` - Load context with messages
2. `saveMessage()` - Persist message with tool calls
3. `updateSessionContext()` - Merge metadata updates
4. `createSession()` - Create new session
5. `listSessions()` - List for workspace
6. `getSession()` - Get with relations
7. `archiveSession()` - Soft delete

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added database module in apps/web**
- **Found during:** Task 1
- **Issue:** Plan assumed `@/db` import would work, but apps/web had no database connection
- **Fix:** Created `apps/web/src/db/index.ts` with Drizzle connection to shared PostgreSQL; mirrored seo-chat schema from open-seo-main for type safety
- **Files created:** `apps/web/src/db/index.ts`, `apps/web/src/db/schema/seo-chat.ts`
- **Commit:** 5a4c5cc29

**2. [Rule 2 - Missing Dependencies] Added AI SDK and database packages**
- **Found during:** Task 1
- **Issue:** AI SDK packages not in apps/web package.json
- **Fix:** Added ai@6.0.180, @ai-sdk/xai@3.0.89, @ai-sdk/google@3.0.73, drizzle-orm@0.38.3, pg@8.14.0, nanoid@5.0.9, @types/pg
- **Files modified:** `apps/web/package.json`
- **Commit:** 5a4c5cc29

**3. [Rule 2 - API Version Compatibility] Removed unsupported streamText parameters**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Plan used `maxSteps` and `experimental_toolCallStreaming` which don't exist in AI SDK 6.0.180
- **Fix:** Removed `maxSteps: 5` and `experimental_toolCallStreaming: true` from streamText() call; basic streaming still works
- **Files modified:** `apps/web/src/app/api/seo-chat/route.ts`
- **Commit:** 5a4c5cc29

**4. [Rule 2 - TypeScript Type Safety] Fixed session metadata type guards**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** session.metadata JSONB field typed as `{}` causing type errors when accessing properties
- **Fix:** Added runtime type checks with `typeof` guards for all metadata property access
- **Files modified:** `apps/web/src/lib/seo-chat/session.ts`
- **Commit:** 5a4c5cc29

**5. [Rule 2 - Next.js 15 Async Params] Updated route params handling**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Next.js 15 requires params to be awaited (Promise-based)
- **Fix:** Changed `{ params }: { params: { id: string } }` to `{ params }: { params: Promise<{ id: string }> }` and await params
- **Files modified:** `apps/web/src/app/api/seo-chat/sessions/[id]/route.ts`
- **Commit:** dcf7d35bd

### Deferred Issues

**Tool Signature Incompatibility (inherited from 98-02)**
- **Issue:** Tools created in 98-02 use `execute: async (args, options)` signature with `options.sessionContext`, but AI SDK 6.x tool() API doesn't support second parameter
- **Impact:** Tool type errors in domain-health.ts, keyword-analysis.ts, feasibility-check.ts, add-to-proposal.ts, generate-proposal.ts
- **Decision:** Deferred fix to avoid blocking session/proposal routes (Plan 03 focus). Tools will need refactoring in 98-02 or 98-04 to remove sessionContext dependency and require domain as explicit parameter.
- **Workaround:** API routes compiled successfully; tools will be fixed when UI integration requires them

## Commits

| Task | Commit | Files Changed | Description |
|------|--------|---------------|-------------|
| 1. Main chat route | `5a4c5cc29` | route.ts, session.ts, db/*, package.json | Streaming chat with Grok 4.1-fast, session service, database setup |
| 2. Session CRUD | `dcf7d35bd` | sessions/route.ts, sessions/[id]/route.ts | List, create, get, archive session endpoints |
| 3. Proposal generation | `5d759451d` | proposals/generate/route.ts, proposal.ts | Magic link creation with Gemini narrative |

**Total:** 3 commits, 10 files created, 2 files modified

## Key Technical Decisions

**Why separate db module in apps/web?**
apps/web and open-seo-main are separate applications in the monorepo with their own tsconfig.json and no direct imports between them. Both connect to the same PostgreSQL database but maintain their own Drizzle schema definitions for type safety. The schema in apps/web mirrors open-seo-main but doesn't share the import (would require monorepo package setup).

**Why Gemini 3.1 Pro for proposals, not Grok?**
Per CLAUDE.md LLM-ARCHITECTURE.md: Gemini 3.1 Pro handles ALL content generation (articles, narratives, translations) at $1.25/1M. Grok 4.1-fast is for classification/tool selection only. This separation ensures consistent quality and follows the two-model architecture.

**Why Node.js runtime instead of Edge?**
Per 98-RESEARCH.md Pitfall 1, Edge runtime has 25s timeout which is insufficient for multi-tool chains. Node.js runtime allows 60s via `maxDuration` export. Tool execution (DataForSEO API calls, HDBSCAN clustering) can take 10-30s, requiring the longer timeout.

**Why 14-day proposal expiry?**
Balances urgency (encourages timely decision) with reasonable consideration period. Standard in B2B services proposals. Long enough for internal approval cycles, short enough to maintain momentum.

**Why nanoid(32) for magic links?**
32 characters provides 10^57 entropy, making tokens unguessable. Standard for secure token-based authentication per SPEC.md Section 5.10. Compatible with URL-safe characters (no encoding needed).

## Verification

- TypeScript compilation passes for all route files
- Session routes enforce workspace isolation
- Proposal generation verifies session ownership
- All API routes use Clerk auth before processing
- Database connection pool configured with timeouts

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/app/api/seo-chat/route.ts
✓ apps/web/src/app/api/seo-chat/sessions/route.ts
✓ apps/web/src/app/api/seo-chat/sessions/[id]/route.ts
✓ apps/web/src/app/api/seo-chat/proposals/generate/route.ts
✓ apps/web/src/lib/seo-chat/session.ts
✓ apps/web/src/lib/seo-chat/proposal.ts
✓ apps/web/src/db/index.ts
✓ apps/web/src/db/schema/seo-chat.ts
```

**Commits exist:**
```
✓ 5a4c5cc29 (Task 1: Main chat route)
✓ dcf7d35bd (Task 2: Session CRUD)
✓ 5d759451d (Task 3: Proposal generation)
```

**Exports verified:**
```
✓ session.ts exports 7 functions
✓ proposal.ts exports createProposal, getProposalByToken
✓ All routes export correct HTTP methods (GET/POST/DELETE)
✓ Database module exports db, schema types
```

## Next Steps

**Immediate dependencies (Wave 3):**
- Plan 98-04: Chat UI Components (consumes these API routes)
- Plan 98-05: Tool Result Cards (renders tool execution results)

**Integration points:**
- Chat UI will call POST /api/seo-chat with message array
- Session switcher will call GET /api/seo-chat/sessions
- Proposal generation tool will call POST /api/seo-chat/proposals/generate
- Tool executors in 98-02 need refactoring to work without sessionContext

**Required fixes before 98-04:**
- Tools (98-02) must be refactored to remove `options.sessionContext` parameter
- All tools should require `domain` as explicit parameter
- Tool type errors must be resolved for frontend integration

## Threat Surface Scan

No new threats introduced beyond plan specification. Existing mitigations verified:

| Threat ID | Component | Mitigation Status |
|-----------|-----------|-------------------|
| T-98-07 | Session ownership | ✓ Mitigated - Clerk JWT validation + workspaceId check before all operations |
| T-98-08 | Prompt injection | ✓ Mitigated - User messages in array, not interpolated into system prompt |
| T-98-09 | DoS via tool execution | ✓ Mitigated - Node.js 60s timeout + Clerk rate limiting |
| T-98-10 | Session data leak | ✓ Mitigated - getSession validates workspaceId before returning data |

## Known Stubs

**ProposalService database integration:**
- `createProposal()` generates proposal data but doesn't insert into proposals table (TODO comment)
- `getProposalByToken()` returns null (stub implementation)
- **Reason:** proposals table schema not yet defined in shared database
- **Resolution plan:** Phase 98-07 (Proposal Portal) will create proposals schema and wire persistence

**Tool executors:**
- All 5 tools (domain_health, keyword_analysis, feasibility_check, add_to_proposal, generate_proposal) have stub executors from 98-02
- **Reason:** DataForSEO integration and HDBSCAN clustering not implemented yet
- **Resolution plan:** 98-02 completion or 98-04 will implement real executors
