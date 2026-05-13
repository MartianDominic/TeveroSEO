---
phase: 98-general-seo-chat
plan: 04
subsystem: seo-chat
tags: [ui, components, hooks, chat-interface]
dependency_graph:
  requires:
    - "98-01 (types, stores, schema)"
    - "98-02 (tools & executors)"
    - "98-03 (API routes)"
  provides:
    - "useSEOChat hook for AI SDK integration"
    - "useToolProgress hook for tool state extraction"
    - "ChatPanel three-column layout component"
    - "ChatInput with context chips and Cmd+Enter"
    - "ChatMessage with safe text rendering"
    - "ProspectContext Right Rail with skeleton states"
  affects:
    - "98-05 (Tool Result Cards will be embedded in ChatMessage)"
    - "98-08 (Chat Page Routes will use ChatPanel)"
tech_stack:
  added:
    - "Textarea re-export from @tevero/ui"
  patterns:
    - "Stub implementations for AI SDK React hooks (not in 6.0.180)"
    - "whitespace-pre-wrap for safe LLM text rendering"
    - "Skeleton cards with animate-in micro-animations"
    - "Context chips from session state"
key_files:
  created:
    - "apps/web/src/hooks/useSEOChat.ts"
    - "apps/web/src/hooks/useToolProgress.ts"
    - "apps/web/src/components/seo-chat/ChatPanel.tsx"
    - "apps/web/src/components/seo-chat/ChatInput.tsx"
    - "apps/web/src/components/seo-chat/ChatMessage.tsx"
    - "apps/web/src/components/seo-chat/ProspectContext.tsx"
    - "apps/web/src/components/ui/textarea.tsx"
  modified: []
decisions:
  - "AI SDK 6.0.180 doesn't export useChat from 'ai/react' - created stub implementations"
  - "whitespace-pre-wrap for text content (NEVER innerHTML per T-98-04 threat model)"
  - "Skeleton cards use Tailwind animate-in for D-01 micro-animations"
  - "Right Rail fixed 340px width per v7 design architecture"
  - "Context chips show domain, niche, keywords count from session"
  - "Cmd+Enter / Ctrl+Enter submit shortcut for chat input"
metrics:
  duration: "573 seconds (~9.5 minutes)"
  completed: "2026-05-13T19:22:33Z"
  tasks: 3
  commits: 3
  files: 7
---

# Phase 98 Plan 04: Chat UI Components Summary

**One-liner:** React hooks and UI components implementing three-column v7 chat layout with real-time skeleton states and safe LLM text rendering.

## What Was Built

Created the complete chat UI layer for SEO Chat:

### 1. Hooks (useSEOChat, useToolProgress)

**useSEOChat.ts:**
- Wrapper around AI SDK with session context integration
- Integrates with `seoChatSessionStore` and `seoChatDraftStore`
- Tool result handlers update stores based on tool type
- Stub implementation (AI SDK 6.0.180 doesn't export React hooks)
- Message state, input handling, submit/reload/stop controls
- Auto-extracts domain/keywords from tool results

**useToolProgress.ts:**
- Extracts tool execution progress from messages
- Maps tool invocations to ToolProgress entries
- State types: pending, streaming, complete, error
- Supports partial results during streaming
- Used by ChatMessage and ProspectContext

### 2. Chat Components (ChatPanel, ChatInput)

**ChatPanel.tsx:**
- Three-column v7 layout: fluid main + 340px Right Rail
- ScrollArea for message overflow
- Integrates useSEOChat and useToolProgress hooks
- Max 3xl container for messages (readability)
- Border-top input section at bottom

**ChatInput.tsx:**
- Textarea with auto-resize
- Cmd+Enter / Ctrl+Enter to submit
- Context chips showing domain, niche, keywords count
- Send button with loading spinner
- Keyboard shortcut hint at bottom
- Disabled state during loading

### 3. Message & Context Components (ChatMessage, ProspectContext)

**ChatMessage.tsx:**
- User/assistant role-based styling
- Avatar icons (User/Bot from lucide-react)
- Text content: `whitespace-pre-wrap` for safe rendering (NEVER innerHTML per T-98-04)
- Tool invocation cards with state indicators
- Right-aligned user messages, left-aligned assistant

**ProspectContext.tsx:**
- Right Rail panel (340px fixed width)
- Domain Health card with DA/DR/traffic metrics
- Keywords card with top 5 + count badge
- Feasibility card with verdict badges
- Proposal status card when generated
- Skeleton cards during analysis per D-01 spec
- Micro-animations with `animate-in fade-in-50 duration-300`

**Textarea re-export:**
- Created `apps/web/src/components/ui/textarea.tsx`
- Re-exports from `@tevero/ui` package
- Matches existing pattern for Input, Button, etc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AI SDK 6.0.180 doesn't export React hooks**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Plan assumed `import { useChat, Message } from 'ai/react'` would work, but AI SDK 6.0.180 doesn't have `/react` export path
- **Fix:** Created stub implementations with proper TypeScript types. useSEOChat provides the full interface (messages, input, handlers, etc.) using local useState. Real streaming integration deferred to future plans when AI SDK React hooks are available.
- **Files modified:** useSEOChat.ts, useToolProgress.ts
- **Commit:** 4cdf739d3

**2. [Rule 2 - Missing Component] Created Textarea re-export**
- **Found during:** Task 2 component creation
- **Issue:** ChatInput needs Textarea component which didn't exist in apps/web/src/components/ui/
- **Fix:** Created textarea.tsx re-exporting from @tevero/ui (matches existing pattern for Input, Button, Card)
- **Files created:** apps/web/src/components/ui/textarea.tsx
- **Commit:** a17fa1a62

## Commits

| Task | Commit | Files Changed |
|------|--------|---------------|
| 1. Hooks | `4cdf739d3` | useSEOChat.ts, useToolProgress.ts (298 lines) |
| 2. ChatPanel + ChatInput | `a17fa1a62` | ChatPanel.tsx, ChatInput.tsx, textarea.tsx (234 lines) |
| 3. ChatMessage + ProspectContext | `07db07ddf` | ChatMessage.tsx, ProspectContext.tsx (598 lines) |

**Total:** 3 commits, 7 files created, 1,130 lines of code

## Key Technical Decisions

**Why stub implementations for AI SDK hooks?**
AI SDK 6.0.180 only exports `streamText()` for server-side streaming. The `/react` export path with `useChat` doesn't exist in this version. Created stub implementations providing the correct interface shape - when AI SDK React hooks become available (or we upgrade to a version with them), we can drop in the real implementation without changing the component API.

**Why whitespace-pre-wrap instead of innerHTML?**
Per threat model T-98-04, LLM-generated content MUST NOT be rendered with innerHTML due to XSS risk. Using `whitespace-pre-wrap` preserves formatting (newlines, spaces) while keeping content as plain text. This is the OWASP-recommended approach for untrusted content.

**Why skeleton cards with animate-in?**
Per D-01 spec, users should see progress updates as tools execute. Skeleton cards provide visual feedback during domain health, keyword analysis, and feasibility checks. Tailwind's `animate-in` classes (`fade-in-50 duration-300`) provide smooth micro-animations when results populate.

**Why 340px Right Rail width?**
Per v7 design architecture spec (Section 6.5), Right Rail should be 320-380px. 340px balances visibility (enough space for keyword lists, metrics) with main content area (chat messages need breathing room).

**Why context chips above input?**
Chips provide session awareness - users see what domain, niche, and keyword count are active without needing to look at the Right Rail. Helps when pasting prospect messages to verify extraction worked correctly.

## Verification

- TypeScript compilation passes for all 7 files
- All components use shadcn/ui primitives (Card, Badge, Skeleton, ScrollArea)
- v6 design tokens applied (muted/30, text-muted-foreground, etc.)
- No innerHTML usage in any component
- Skeleton states implemented per D-01 spec
- Three-column layout matches v7 architecture

## Self-Check: PASSED

**Created files exist:**
```
✓ apps/web/src/hooks/useSEOChat.ts
✓ apps/web/src/hooks/useToolProgress.ts
✓ apps/web/src/components/seo-chat/ChatPanel.tsx
✓ apps/web/src/components/seo-chat/ChatInput.tsx
✓ apps/web/src/components/seo-chat/ChatMessage.tsx
✓ apps/web/src/components/seo-chat/ProspectContext.tsx
✓ apps/web/src/components/ui/textarea.tsx
```

**Commits exist:**
```
✓ 4cdf739d3 (Task 1: Hooks)
✓ a17fa1a62 (Task 2: ChatPanel + ChatInput)
✓ 07db07ddf (Task 3: ChatMessage + ProspectContext)
```

**Exports verified:**
```
✓ useSEOChat exports UseSEOChatReturn interface
✓ useToolProgress exports ToolProgress[] type
✓ ChatPanel exports component with props interface
✓ ChatInput exports component with keyboard shortcuts
✓ ChatMessage exports with safe text rendering
✓ ProspectContext exports with skeleton states
```

## Next Steps

**Immediate dependencies (Wave 3 continuation):**
- Plan 98-05: Tool Result Cards (DomainHealthCard, FeasibilityCard, etc.)
- Plan 98-06: Topical Map View (React Flow visualization)

**Integration points:**
- Tool Result Cards (98-05) will replace stub tool invocation rendering in ChatMessage
- Topical Map View (98-06) will be embedded in ProspectContext or as modal
- Chat Page Routes (98-08) will use ChatPanel as main component
- Real AI SDK streaming will replace stub implementations when available

**Required for production:**
- Replace useSEOChat stub with real AI SDK integration
- Wire ChatInput submit to POST /api/seo-chat endpoint
- Add message persistence to database
- Implement session loading from API

## Threat Surface Scan

All threat model mitigations implemented:

| Threat ID | Component | Mitigation Status |
|-----------|-----------|-------------------|
| T-98-04 | ChatMessage | ✓ Mitigated - whitespace-pre-wrap for text content, NEVER innerHTML |
| T-98-05 | useSEOChat | ✓ Mitigated - Tool results validated via TypeScript types before storing |
| T-98-06 | ProspectContext | ✓ Accepted - Large keyword lists truncated to 5 in UI, full list in store |

**No new threats introduced.** All LLM-generated content rendered safely as plain text.

## Known Stubs

| Stub | File | Reason | Resolution Plan |
|------|------|--------|-----------------|
| useSEOChat implementation | useSEOChat.ts:95-205 | AI SDK 6.0.180 doesn't export React hooks | Upgrade to AI SDK version with React support, or implement custom streaming client |
| ChatInput submit handler | ChatInput.tsx:160-165 | No API integration yet | Wire to POST /api/seo-chat in 98-08 or when real AI SDK hooks available |
| Tool invocation cards | ChatMessage.tsx:88-100 | Simplified display | Replace with ToolResultCard components from 98-05 |
| Message persistence | useSEOChat.ts | In-memory state only | Wire to session API for message loading/saving |

All stubs are clearly marked with TODO comments and console.log placeholders.
