# Phase 98: SEO Chat - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Sales-focused chat that helps agency owners convert Facebook/WhatsApp/email prospects into paying clients in <30 seconds. The 3-analysis MVP (Domain Health, Keyword Feasibility, Proposal Generator) runs within a ChatGPT-like interface with real-time streaming and Right Rail context updates.

**What this phase delivers:**
- Agency-side chat experience with multi-prospect tabs
- Prospect portal with magic link access
- 5 tools integrated via Vercel AI SDK
- v7 three-column layout with transforming Right Rail

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**160KB of requirements are locked.** See `SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- 3-analysis MVP: Domain Health, Keyword Feasibility, Proposal Generator
- Multi-model architecture: Grok 4.1-fast (classification), Gemini 3.1 Pro (generation)
- Three-column v7 layout with transforming Right Rail
- 5 tools: domain_health, keyword_analysis, feasibility_check, add_to_proposal, generate_proposal
- 16 ChatGPT-parity interaction patterns
- Prospect portal with magic links

**Out of scope (from SPEC.md):**
- Full 109-check SEO audit (post-conversion)
- Autonomous monitoring
- Multi-language chat (Lithuanian content, English UI)

</spec_lock>

<decisions>
## Implementation Decisions

### D-01: Parallel Streaming UX

**Decision:** Text streams in chat + Right Rail cards fill simultaneously with micro-animations.

**The experience:**
1. User pastes prospect message
2. **Instantly (<200ms)**: Right Rail shows skeleton cards (Domain Health, Keywords, Proposal Draft) with subtle pulse animation
3. **0-2s**: Chat streams conversational analysis: "Analyzing groziosalon.lt — this is a beauty salon in Vilnius..."
4. **As data arrives**: Right Rail cards fill with micro-animations:
   - Numbers **count up** (like a speedometer settling)
   - Card **slides in** with spring physics when complete
   - Subtle **glow pulse** when a card updates
5. **Highlight sync**: When prose mentions "DA of 12", the Domain Health card briefly highlights

**Why:** Multi-threaded perception — user sees AI thinking, fetching, and analyzing simultaneously. Perplexity + Linear hybrid.

**Implementation:**
- Chat: Vercel AI SDK `streamText()` for prose
- Right Rail: Zustand store updates via SSE, cards subscribe to slices
- Highlight: Stream token matching emits highlight events

### D-02: Error Recovery

**Decision:** Inline retry UI with exponential backoff. Retry only failed parts, not succeeded ones.

**Behavior:**
- 3 automatic retries with backoff (1s → 2s → 4s)
- After 3 failures, show manual "Retry" button inline
- Succeeded tool results are preserved — only failed tools retry
- User never sees raw errors

**Error message tone:** Agency-smart
- Example: "Site may be blocking our analysis — this sometimes happens with Cloudflare-protected domains. Retrying with a different approach..."
- Shows expertise, explains WHY, takes action

### D-03: Topical Map Interaction (3-Level Toggle)

**Decision:** Differentiated interaction based on context with 3-level toggle system.

**Toggle levels:**
1. **Always Off** — View-only everywhere (global setting)
2. **Per-Prospect** — Toggle per prospect, default is OFF (view-only)
3. **Always On** — Full interaction everywhere (global setting)

**Agency side (when enabled):**
- Click node to select (shows keyword details in sidebar)
- Drag to reposition
- Double-click to expand/collapse cluster
- Pinch/scroll zoom
- Minimap toggle

**Prospect portal:** View-only by default, can be enabled per-prospect.

**Implementation:** React Flow with Dagre auto-layout. Two components with shared rendering logic, interaction layer conditionally applied.

### D-04: Map Node Styling

**Decision:** Funnel color + volume size

**Node colors (v6 semantic tokens):**
- BOFU = `success-soft` (green)
- MOFU = `warning-soft` (amber)
- TOFU = `accent-soft` (blue)

**Node size:** Scales with total cluster volume
- Min: 48px
- Max: 120px

**Labels:** Cluster name centered, keyword count as badge

### D-05: Map Edge Styling

**Decision:** Semantic thickness based on cluster similarity

**Line thickness:**
- Similarity ≥ 0.7 → thick (3px)
- Similarity 0.5-0.7 → medium (2px)
- Similarity < 0.5 → thin dashed (1px)

**Path style:** Curved bezier, neutral color (`border-2`)

### Claude's Discretion

- Exact animation timing (spring tension, count-up duration)
- Skeleton placeholder design
- Highlight sync debounce timing
- Error retry toast positioning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Specification
- `.planning/phases/98-general-seo-chat/SPEC.md` — **Locked requirements** (160KB, 10 sections) — MUST read before planning
- `.planning/phases/98-general-seo-chat/98-RESEARCH.md` — Standard stack, architecture patterns, pitfalls

### Design System
- `.planning/design/design-system-v6.md` — Typography (NumMega, NumCard), shadows (ghost-edge), semantic colors
- `.planning/design/v7-master-design-architecture.md` — Three-column shell, Right Rail transformation, trust matrix

### Prior Chat Implementation
- `.planning/phases/82-chat-integration/82-CONTEXT.md` — CopilotKit patterns, SSE streaming, tool definitions
- `.planning/phases/86-semantic-intelligence/86-CONTEXT.md` — Grok 4.1 / Gemini 3.1 Pro model selection, proposal editing

### Existing Code
- `apps/web/src/components/keyword-analysis/KeywordAnalysisChat.tsx` — SSE progress, CopilotKit actions
- `apps/web/src/lib/copilot/provider.tsx` — CopilotKit integration
- `apps/web/src/components/ai/SafeAIOutput.tsx` — XSS protection for LLM output

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CopilotKit integration**: `apps/web/src/lib/copilot/` — provider, tools, actions
- **SSE streaming**: Pattern exists in `KeywordAnalysisChat.tsx` — progress indicators, partial results
- **SafeAIOutput**: DOMPurify wrapper for rendering LLM-generated HTML
- **v6 components**: `@tevero/ui` Card, Badge, Button with semantic variants

### Established Patterns
- **useCopilotAction**: Register tools that AI can invoke
- **Zustand persist**: `skipHydration: true` to prevent race conditions
- **React Flow**: Used elsewhere in codebase for visualizations

### Integration Points
- **Right Rail**: Transform existing sidebar pattern into prospect context panel
- **Session storage**: Extend `analysis_sessions` table from Phase 82
- **Proposal system**: Connect to Phase 86 proposal editing infrastructure

</code_context>

<specifics>
## Specific Ideas

### Parallel Streaming Feel
The user specifically wants the experience to feel "super smart and pleasant" — like having a co-pilot, not using a tool. The parallel perception pattern (prose streaming + Right Rail filling simultaneously) creates this multi-threaded intelligence feeling.

### Agency-Smart Error Messages
Errors should demonstrate expertise: "Site may be blocking our analysis — this sometimes happens with Cloudflare-protected domains." Shows the AI understands the problem space, not just reporting failures.

### Map Toggle Granularity
Three levels (always-off, per-prospect, always-on) gives agencies control over how interactive the prospect experience is — some may want prospects to explore freely, others want a controlled presentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 98-general-seo-chat*
*Context gathered: 2026-05-13*
